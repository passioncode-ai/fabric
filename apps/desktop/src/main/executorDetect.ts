// #region executor-detect — docs: docs/ux/scenarios.md#scn-126-first-run-name-look-coding-agents-where-to-start
/**
 * Which coding agents this machine can run, for the first run's second step
 * (ADR-0100, SCN-126). A program is FOUND when it is on PATH and answers
 * `--version` in time; UNRESPONSIVE when it is on PATH and does not answer —
 * a timeout or a failing exit, both of which leave it unusable;
 * MISSING when it is not on PATH. Three states, because "it hung" is not "it is
 * not installed", and telling the operator to install what they already have is
 * the failure this separates.
 *
 * Found is not signed in and not admitted: whether the account works is
 * answered the first time a session runs, by the provider itself. This module
 * says only what the machine has.
 *
 * Install commands are listed only where the vendor publishes them as the
 * install path; a program without one gets `null`, never a guessed command.
 */

import { spawn } from 'node:child_process'
import { constants, type Stats } from 'node:fs'
import { access, readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

/**
 * The filesystem calls detection makes — every one asynchronous and bounded (iteration 3, errors finding 8:
 * `accessSync`/`statSync`/`readdirSync`/`readFileSync` ran on Electron's main process, so a PATH folder on
 * a hung mount froze every window). Injectable for tests.
 */
export interface ExecutorFs {
  access(p: string, mode: number): Promise<void>
  stat(p: string): Promise<Stats>
  readdir(p: string): Promise<string[]>
  readFile(p: string, encoding: 'utf8'): Promise<string>
}
const REAL_FS: ExecutorFs = { access, stat, readdir: (p) => readdir(p), readFile: (p, e) => readFile(p, e) }
/** How long one filesystem call may take before its folder is passed over. */
const FS_TIMEOUT_MS = 2000

interface FsCtx { fs: ExecutorFs; ms: number }

/** The call's answer, or null when it fails or does not answer within `ms` (the stuck call is abandoned). */
async function bounded<T>(call: () => Promise<T>, ms: number): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([call(), new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms) })])
  } catch {
    // Absent, unreadable or not executable: the same answer as "not here".
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** `connected`: whether Fabric's own tools reach a session of this agent (`AgentDescriptor.connectsToSurface`). */
export interface ExecutorProbe { id: string; label: string; program: string; connected: boolean }
import type { ExecutorRow } from '../shared/startPaths.ts'
export type { ExecutorRow } from '../shared/startPaths.ts'

/** The vendors' published install commands: Anthropic's native installer, OpenAI's npm package. */
const INSTALL: Readonly<Record<string, string>> = {
  'claude-code': 'curl -fsSL https://claude.ai/install.sh | bash',
  codex: 'npm install -g @openai/codex'
}

async function onPath(program: string, envPath: string, { fs, ms }: FsCtx): Promise<string | null> {
  for (const dir of envPath.split(path.delimiter)) {
    if (!dir) continue
    const candidate = path.join(dir, program)
    // `access` resolves to undefined: map it to a flag so "answered yes" differs from "failed or timed out".
    const executable = await bounded(() => fs.access(candidate, constants.X_OK).then(() => true), ms)
    if (!executable) continue
    // A DIRECTORY of that name is executable-bit "searchable", not a program; keep looking.
    const st = await bounded(() => fs.stat(candidate), ms)
    if (st?.isFile()) return candidate
  }
  return null
}

const isDir = async (p: string, { fs, ms }: FsCtx): Promise<boolean> => (await bounded(() => fs.stat(p), ms))?.isDirectory() ?? false

/** nvm's installed Node versions' bin folders, the `alias/default` version first, then newest first. */
async function nvmBins(nvmDir: string, ctx: FsCtx): Promise<string[]> {
  const versions = path.join(nvmDir, 'versions', 'node')
  // No nvm installation here (or it did not answer): nothing to add.
  const listed = await bounded(() => ctx.fs.readdir(versions), ctx.ms)
  if (!listed) return []
  const names = listed.filter((n) => /^v\d+/.test(n))
  const parts = (n: string): number[] => n.slice(1).split('.').map((x) => Number.parseInt(x, 10) || 0)
  names.sort((a, b) => {
    const [pa, pb] = [parts(a), parts(b)]
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return (pb[i] ?? 0) - (pa[i] ?? 0)
    return 0
  })
  // No default alias: newest first is the order.
  const alias = ((await bounded(() => ctx.fs.readFile(path.join(nvmDir, 'alias', 'default'), 'utf8'), ctx.ms)) ?? '').trim().replace(/^v/, '')
  // `20` matches v20.x.y, `20.1` matches v20.1.y; `node`/`lts/*` name no folder and leave newest first.
  const isDefault = (n: string): boolean => !!alias && /^\d/.test(alias) && (n.slice(1) === alias || n.slice(1).startsWith(alias + '.'))
  const ordered = [...names.filter(isDefault), ...names.filter((n) => !isDefault(n))]
  return ordered.map((n) => path.join(versions, n, 'bin'))
}

/**
 * PATH for the probe: the PATH given, then the version managers' well-known folders that EXIST — nvm,
 * volta, asdf, fnm. A Dock-launched app inherits launchd's minimal PATH (`env.ts#fixPath` adds only
 * Homebrew and `~/.local/bin`), so an agent installed through one of them read as "not installed" and was
 * offered an install command for what the operator already has (iteration 2, errors finding 8). Nothing is
 * guessed: a folder that does not exist (or does not answer in time) is not added, and without a HOME
 * nothing is.
 */
export async function widenProbePath(
  envPath: string,
  env: Record<string, string | undefined>,
  opts: { fs?: ExecutorFs; fsTimeoutMs?: number } = {}
): Promise<string> {
  const ctx: FsCtx = { fs: opts.fs ?? REAL_FS, ms: opts.fsTimeoutMs ?? FS_TIMEOUT_MS }
  const home = env.HOME
  const parts = envPath.split(path.delimiter).filter(Boolean)
  if (!home) return parts.join(path.delimiter)
  const extra = [
    ...(await nvmBins(env.NVM_DIR || path.join(home, '.nvm'), ctx)),
    path.join(env.VOLTA_HOME || path.join(home, '.volta'), 'bin'),
    path.join(env.ASDF_DATA_DIR || path.join(home, '.asdf'), 'shims'),
    // asdf's shims call `asdf` itself.
    path.join(home, '.asdf', 'bin'),
    ...(env.FNM_DIR ? [path.join(env.FNM_DIR, 'aliases', 'default', 'bin')] : []),
    path.join(home, '.local', 'share', 'fnm', 'aliases', 'default', 'bin'),
    path.join(home, 'Library', 'Application Support', 'fnm', 'aliases', 'default', 'bin')
  ]
  const fresh = extra.filter((d, i) => !parts.includes(d) && extra.indexOf(d) === i)
  // Asked at once, added in the declared order.
  const present = await Promise.all(fresh.map((d) => isDir(d, ctx)))
  fresh.forEach((d, i) => { if (present[i]) parts.push(d) })
  return parts.join(path.delimiter)
}

const SEMVER = /\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?/
/** A line that announces something other than this program's version. */
const NOTICE = /\b(update|upgrade|available|latest|newer|new version)\b/i

/**
 * The version in a `--version` answer: from a line that names the program, else the first version on the
 * first line; notice lines ("update available 3.4.5") are never the answer. Null when there is no version —
 * text that is not one is not shown as one (iteration 2, errors finding 8).
 */
export function versionFrom(out: string, program: string): string | null {
  const all = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const lines = all.filter((l) => !NOTICE.test(l))
  const name = path.basename(program).toLowerCase()
  const named = lines.find((l) => l.toLowerCase().includes(name) && SEMVER.test(l))
  const m = SEMVER.exec(named ?? lines[0] ?? '')
  return m ? m[0] : null
}

const MAX_OUTPUT = 65536
/** How long output may keep arriving after the program exited: its last write, not a child's. */
const DRAIN_MS = 100

/**
 * `--version`, in its own process GROUP, killed when the answer is settled — timeout OR normal exit — so a
 * program that hangs, or that exits leaving a background child, leaves nothing running behind the first
 * run. The answer is settled at the program's EXIT (plus a short drain), not at end of output: a child
 * still holding stdout made a program that had answered read as unresponsive. Output is read up to
 * 64 KiB — a version line is short, and a program that prints more is not answering the question.
 */
function versionOf(file: string, env: Record<string, string>, timeoutMs: number): Promise<string | null | 'timeout'> {
  return new Promise((resolve) => {
    const child = spawn(file, ['--version'], { env, detached: true, stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    let done = false
    let drain: NodeJS.Timeout | undefined
    const killGroup = (): void => {
      try {
        process.kill(-(child.pid as number), 'SIGKILL')
      } catch {
        // Already gone, the whole group: nothing left to stop.
      }
    }
    const finish = (v: string | null | 'timeout'): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      clearTimeout(drain)
      killGroup()
      child.stdout?.destroy()
      resolve(v)
    }
    const timer = setTimeout(() => finish('timeout'), timeoutMs)
    let closed = false
    let exited = false
    const settle = (): void => finish(versionFrom(out, file))
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (d: string) => { if (out.length < MAX_OUTPUT) out += d.slice(0, MAX_OUTPUT - out.length) })
    // The output may close before or after the exit is reported; whichever is second settles at once.
    child.stdout?.on('close', () => { closed = true; if (exited) settle() })
    child.on('error', () => finish('timeout')) // on PATH but could not be started: not usable, not missing
    child.on('exit', (code) => {
      exited = true
      // On PATH but failed (or was killed) answering: not usable, not missing.
      if (code !== 0) return finish('timeout')
      if (closed) return settle()
      // Still open after the exit: a child holds it. The drain window takes the program's last write.
      drain = setTimeout(settle, DRAIN_MS)
    })
  })
}

export async function detectExecutors(
  probes: readonly ExecutorProbe[],
  opts: { env: Record<string, string>; timeoutMs?: number; fs?: ExecutorFs; fsTimeoutMs?: number }
): Promise<ExecutorRow[]> {
  const timeoutMs = opts.timeoutMs ?? 5000
  const ctx: FsCtx = { fs: opts.fs ?? REAL_FS, ms: opts.fsTimeoutMs ?? FS_TIMEOUT_MS }
  const PATH = await widenProbePath(opts.env.PATH ?? '', opts.env, { fs: ctx.fs, fsTimeoutMs: ctx.ms })
  const env = { ...opts.env, PATH }
  return Promise.all(
    probes.map(async (p): Promise<ExecutorRow> => {
      const install = INSTALL[p.id] ?? null
      const file = await onPath(p.program, PATH, ctx)
      const base = { id: p.id, label: p.label, connected: p.connected }
      if (!file) return { ...base, state: 'missing', version: null, path: null, install }
      const v = await versionOf(file, env, timeoutMs)
      // Installed but not answering: telling the operator to INSTALL it is the wrong advice (no command).
      if (v === 'timeout') return { ...base, state: 'unresponsive', version: null, path: file, install: null }
      return { ...base, state: 'found', version: v, path: file, install: null }
    })
  )
}
// #endregion executor-detect
