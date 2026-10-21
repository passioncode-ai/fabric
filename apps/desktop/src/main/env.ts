// Supabase connection material for the v1 control plane (ADR-0031 §2: the
// service key exists ONLY in the main process). Explicit env wins; in dev the
// local stack's own `supabase status -o env` is the source, never a hardcoded key.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
import { existsSync } from 'node:fs'
import path from 'node:path'
import { chooseRepoRoot } from './repoRoot'
import { materializeStack } from './bundledStack'
import { widenProbePath } from './executorDetect.ts'
import { app } from 'electron'
import { STACK_EXCLUDED_SERVICES, databaseContainer, removeExcludedContainers } from './stackServices.ts'
import type { StackContainers } from '../shared/stackWatch.ts'
import { recoveryStart, startWithRetry } from '../shared/stackStartRetry.ts'
import { pingDocker } from './dockerPing.ts'
import { ops } from './opsSink.ts'
import { homedir } from 'node:os'
import { mergeLaunchPath, pathAdditions } from './platform.ts'
import { readLoginShellPath } from './loginShellPath.ts'

export interface SupabaseEnv {
  url: string
  serviceKey: string
}

// A .app launched from the Dock inherits a minimal PATH without Homebrew —
// `supabase` and `claude` both live there. Appended once at startup, then the version managers' folders
// that exist (`widenProbePath`), so a coding agent the first run finds is one a session can also launch
// (iteration 2: a volta-only Codex was found by detection and missing from the session's PATH).
// Asynchronous since iteration 3: the folder probes are bounded filesystem calls (errors finding 8).
// #region fix-path — docs: docs/adr/0100-first-run-and-start-paths.md#first-run
export async function fixPath(): Promise<void> {
  // Per OS (0.3.5, REQ-05): Windows joins with ';' and keeps its own installer folders.
  const extra = pathAdditions(process.platform, process.env, homedir())
  // CO-326: the login shell's order first, so a launch runs the binary the operator's terminal runs.
  const shellPath = process.platform === 'win32' ? null : await loginShellPath(process.env.SHELL ?? '')
  process.env.PATH = await widenProbePath(mergeLaunchPath(shellPath, process.env.PATH ?? '', extra, path.delimiter), process.env)
}

/** The login shell's PATH, read once at start under a 3 s deadline that holds (`loginShellPath.ts`, review ER-1); null
 *  when there is no shell or it does not answer in time, and the launch PATH keeps its old order. */
async function loginShellPath(shell: string): Promise<string | null> {
  const r = await readLoginShellPath(shell)
  if (r.failure === 'no-markers')
    ops.record({ op: 'env.shell-path', outcome: 'failed', level: 'warn', detail: { why: 'no PATH between the markers' }, ctx: { correlationId: ops.correlate() } })
  else if (r.failure)
    // An rc file that hangs, prompts or fails leaves the old order (inherited PATH, then the installers' folders).
    ops.failed('env.shell-path', new Error(`${r.failure}: ${r.detail ?? ''}`), { note: 'the login shell did not answer; the launch PATH keeps its old order' })
  return r.path
}
// #endregion fix-path

let bundledRoot: string | null | undefined
/** The shipped stack project, materialized once per launch into the app's data folder. */
function bundledStackRoot(): string | null {
  if (bundledRoot !== undefined) return bundledRoot
  bundledRoot = app.isPackaged
    ? materializeStack({ source: path.join(process.resourcesPath, 'stack'), target: path.join(app.getPath('userData'), 'stack') })?.root ?? null
    : null
  return bundledRoot
}

export function repoRoot(): string {
  return chooseRepoRoot({
    bundled: bundledStackRoot(),
    fromEnv: process.env.FABRIC_REPO,
    packaged: app.isPackaged,
    appPath: app.getAppPath(),
    home: app.getPath('home'),
    exists: existsSync
  })
}

/**
 * ASYNCHRONOUS, and that is the point (M101). Every one of these ran on the
 * main thread, which is Electron's browser-process message loop: for as long as
 * one blocked, nothing was pumped — no window painted, no menu responded, no
 * event was delivered. Thirty seconds of that is bad; the four minutes
 * `startStack` allowed itself is a person watching a rectangle.
 */
export async function stackStatusEnv(): Promise<Record<string, string>> {
  const { stdout: out } = await run('supabase', ['status', '-o', 'env'], {
    cwd: repoRoot(),
    encoding: 'utf8',
    timeout: 30_000
  })
  const vars: Record<string, string> = {}
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?\s*$/)
    if (m) vars[m[1]] = m[2]
  }
  return vars
}

/**
 * Starts the stack without stopping the app.
 *
 * `onLine` receives the stack's own output as it arrives, so the splash can say
 * what is happening instead of holding one sentence for four minutes. It is
 * optional: nothing here depends on being watched.
 */
/** The `supabase start` in flight, if any — so a quit during the splash ends it (review m13, LC-02). */
let starting: { kill(signal?: NodeJS.Signals): boolean } | null = null
/**
 * A quit during startup ends the `supabase start` it launched, instead of leaving it running with ppid 1
 * for up to its 240 s limit. Containers it had already started stay, as they would after any start; the
 * next launch's start picks them up.
 */
/** Set by a quit; the retry between tries reads it so no new start begins after it (DO-5). */
let stopRequested = false
export function stopStartingStack(): void {
  stopRequested = true
  try { starting?.kill('SIGTERM') } catch { /* already gone */ }
  starting = null
}

/**
 * Starts the stack, waiting out the moments it is still coming up (`stackStartRetry.ts`): a container that is
 * «not ready: starting» right after Docker returns is retried, never shown as «The local stack refused to start».
 */
export async function startStack(onLine?: (line: string) => void): Promise<void> {
  stopRequested = false
  let dockerWaitLogged = false
  await startWithRetry(() => startStackOnce(onLine), {
    stopped: () => stopRequested,
    // ER-4: Docker away at start (a login before OrbStack or Docker Desktop has its socket) is waited for, not shown.
    pingDocker: (socket) => pingDocker(socket),
    onDockerWait: (waitedMs) => {
      if (!dockerWaitLogged) {
        dockerWaitLogged = true
        ops.record({ op: 'stack.start.docker-wait', outcome: 'ok', level: 'warn', detail: { why: 'Docker did not answer; waiting for it' }, ctx: { correlationId: ops.correlate() } })
      }
      onLine?.(`Waiting for Docker to answer (${Math.round(waitedMs / 1000)} s)`)
    },
    onRetry: (attempt, attempts, message) => {
      ops.record({ op: 'stack.start.retry', outcome: 'ok', level: 'warn', detail: { attempt, attempts, why: message.split('\n').slice(-2).join(' ').slice(0, 200) }, ctx: { correlationId: ops.correlate() } })
      onLine?.(`The stack is still starting — try ${attempt} of ${attempts}`)
    }
  })
}

// #region stack-recover-once — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
/**
 * One try of the runtime stack watch (0.3.9 review ER-3): the launch's start, run ONCE. `startStack` repeats «supabase
 * start is already running» four times, 10 s apart, which per watch try was four CLI runs against containers that were
 * up; here «already running» ends the try as nothing to start, and the watch's backoff is the retry. Docker that is not
 * there yet is still waited for (90 s), once.
 */
export async function recoverStack(): Promise<'started' | 'already-running'> {
  stopRequested = false
  return recoveryStart(() => startStackOnce(), {
    stopped: () => stopRequested,
    pingDocker: (socket) => pingDocker(socket)
  })
}

/** What Docker says of the stack's database container, for the watch's decision (`stackServices.ts#databaseContainer`). */
export async function stackDatabaseContainer(): Promise<StackContainers> {
  return databaseContainer('fabric', async (args) => (await run('docker', args, { encoding: 'utf8', timeout: 10_000 })).stdout)
}
// #endregion stack-recover-once

async function startStackOnce(onLine?: (line: string) => void): Promise<void> {
  // Only the services Fabric calls (lifecycle LC-09): the rest cost ~1.4 GiB at idle for nothing.
  const child = run('supabase', ['start', '-x', STACK_EXCLUDED_SERVICES.join(',')], {
    cwd: repoRoot(),
    encoding: 'utf8',
    timeout: 240_000,
    // A first-ever start pulls container images and prints a great deal.
    // `execFile` KILLS the child when its buffer overflows, so the default
    // 1 MB would have turned a slow-but-working start into a failure — and
    // reported it as a timeout, because a killed child looks like one. Not a
    // regression this change introduces; it was there before and is fixed
    // here because the streaming above is what made it legible.
    maxBuffer: 16_000_000
  })
  if (onLine) {
    const feed = (chunk: string): void => {
      for (const line of chunk.split('\n')) if (line.trim()) onLine(line.trim())
    }
    // Both streams: `supabase start` reports progress on stderr, and a reader
    // that watched only stdout would show nothing for the whole download.
    child.child.stdout?.on('data', (c: Buffer | string) => feed(String(c)))
    child.child.stderr?.on('data', (c: Buffer | string) => feed(String(c)))
  }
  starting = child.child
  try {
    await child
  } finally {
    starting = null
  }
  // CO-333: containers of the excluded services an older full start left keep coming back with every Docker restart.
  const swept = await removeExcludedContainers('fabric', async (args) =>
    (await run('docker', args, { encoding: 'utf8', timeout: 30_000 })).stdout)
  if (swept.removed.length || swept.error)
    ops.record({ op: 'stack.excluded.removed', outcome: swept.error ? 'failed' : 'ok', level: swept.error ? 'warn' : 'info', detail: { removed: swept.removed, ...(swept.error ? { why: swept.error.slice(0, 200) } : {}) }, ctx: { correlationId: ops.correlate() } })
}

export async function resolveSupabaseEnv(): Promise<SupabaseEnv> {
  const envUrl = process.env.SUPABASE_URL
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (envUrl && envKey) return { url: envUrl, serviceKey: envKey }

  const vars = await stackStatusEnv()
  const url = vars.API_URL ?? vars.SUPABASE_URL
  const serviceKey = vars.SERVICE_ROLE_KEY ?? vars.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      `supabase status did not yield API_URL/SERVICE_ROLE_KEY (got: ${Object.keys(vars).join(', ')})`
    )
  }
  return { url, serviceKey }
}
