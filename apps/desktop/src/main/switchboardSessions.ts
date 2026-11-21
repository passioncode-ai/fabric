// #region switchboard-sessions — docs: docs/ux/scenarios.md#scn-166-see-every-agent-and-open-its-console-in-one-press
/**
 * CO-457, Fabric's half of one sessions screen with Fabric Dashboards: the sessions Switchboard launched on this Mac
 * (`switchboard --json sessions --all`) and the ones it holds as stopped on a usage limit (`switchboard --json
 * recovery`), merged by Dashboards' own pure module (`shared/vendor/dashboardsSessions.ts`), so a row here is the row
 * Dashboards shows. Read-only: Fabric never runs `switchboard handovers run` or `switchboard recovery claim`; a
 * ready stop is Dashboards' to continue, so it reads as waiting here. Ids, folders, labels and times only: never a
 * prompt, a transcript's content or a token. Each read has its deadline and no shell; a failure is named per source.
 */
import { execFile } from 'node:child_process'
import path from 'node:path'
import { findOnPath, widenProbePath } from './executorDetect.ts'
import { mergeSessions, type SbSessionRecord } from '../shared/vendor/dashboardsSessions.ts'
import type { SwitchboardSessions } from '../shared/switchboardSessions.ts'
import type { SbSessionLite } from '../shared/sessionMeta.ts'
export type { SwitchboardSessions }

/** 30 s (Switchboard's measure of 2026-11-19, board thread 3ca40854: under a load average of 120 its slow answers took
 *  28 s at the median, so 10 s killed calls that would have answered). */
export const SWITCHBOARD_SESSIONS_DEADLINE_MS = 30_000

type Run = (file: string, args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>

const ms = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) : null)
const dataOf = (stdout: string): Record<string, unknown> | null => {
  try {
    const j = JSON.parse(stdout) as { data?: unknown }
    return j && typeof j === 'object' && j.data && typeof j.data === 'object' ? (j.data as Record<string, unknown>) : null
  } catch { /* not JSON: the caller names the source as unread, never an empty list */ return null }
}

/** Switchboard's session list, as Dashboards' `allSessionsOf` reads it (its `src/core/switchboard.ts` at c43b38a): a
 *  malformed record is skipped, never guessed at. The launch facts are left out: no screen here shows them. */
export function parseSessions(stdout: string): SbSessionRecord[] | null {
  const data = dataOf(stdout)
  if (!data) return null
  const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '')
  const out: SbSessionRecord[] = []
  for (const x of Array.isArray(data.sessions) ? (data.sessions as Record<string, unknown>[]) : []) {
    if (!x || typeof x !== 'object' || typeof x.working_directory !== 'string' || !path.isAbsolute(x.working_directory)) continue
    const state = x.state === 'starting' || x.state === 'running' || x.state === 'ended' ? x.state : 'unknown'
    const provider = str(x.provider, 32)
    const agent = typeof x.agent === 'string' && /^[a-z][a-z0-9._-]{0,63}$/.test(x.agent) ? x.agent
      : provider === 'claude' ? 'claude-code' : provider === 'kimi' ? 'kimi-code' : provider
    out.push({
      home: str(x.home, 400), folder: x.working_directory, provider, agent, pool: str(x.pool, 64) || 'default', mode: str(x.mode, 32),
      account: str(x.label) || str(x.account_id, 64), accountId: str(x.account_id, 64),
      context: typeof x.context === 'string' ? x.context.slice(0, 120) : null, contextName: typeof x.context_name === 'string' ? x.context_name.slice(0, 120) : null,
      continues: typeof x.continues === 'string' && x.continues ? x.continues.slice(0, 64) : null, inPlace: x.in_place === true,
      launchedAt: ms(x.launched_at), startedAt: ms(x.started_at), state, launch: null
    })
  }
  return out
}

const EVENT = /^[A-Za-z0-9._:-]{1,128}$/
const SESSION = /^[A-Za-z0-9._-]{1,128}$/
const WAIT_REASONS = ['billing', 'account_removed', 'no_account', 'backoff'] as const
type WaitReason = (typeof WAIT_REASONS)[number]

/** The open limit stops (waiting or claimed), as Dashboards' `parseRecovery` reads them (its `src/core/recovery.ts` at
 *  c43b38a), as the merge's input: a billing stop needs the person; every other one waits here, for its `probe_at`. */
export function parseStops(stdout: string, labelOf: (accountId: string) => string | null): Parameters<typeof mergeSessions>[0]['stops'] | null {
  const data = dataOf(stdout)
  if (!data) return null
  const out: Parameters<typeof mergeSessions>[0]['stops'] = []
  for (const row of Array.isArray(data.sessions) ? (data.sessions as Record<string, unknown>[]) : []) {
    const s = (row?.stop ?? null) as Record<string, unknown> | null
    if (!s || typeof s !== 'object') continue
    const { event, session, directory, provider } = s
    if (typeof event !== 'string' || !EVENT.test(event) || typeof session !== 'string' || !SESSION.test(session)) continue
    if (typeof directory !== 'string' || !path.isAbsolute(directory) || (provider !== 'claude' && provider !== 'codex')) continue
    const state = typeof s.state === 'string' ? s.state : 'waiting'
    if (state !== 'waiting' && state !== 'claimed') continue
    const account = typeof s.account === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(s.account) ? s.account : null
    out.push({
      event, session, dir: directory, provider,
      stoppedAt: typeof s.stopped_at === 'number' && Number.isFinite(s.stopped_at) ? s.stopped_at * 1000 : 0,
      attempt: typeof s.attempt === 'number' ? s.attempt : 1,
      verdict: s.kind === 'billing' ? 'billing' : 'waiting',
      probeAt: typeof row.probe_at === 'number' && Number.isFinite(row.probe_at) ? row.probe_at * 1000 : null,
      account: account ? labelOf(account) ?? account : null,
      waitReason: typeof row.reason === 'string' && (WAIT_REASONS as readonly string[]).includes(row.reason) ? row.reason as WaitReason : null
    })
  }
  return out
}

/** The two reads and the merge. `run` is injected for tests; in the app it is `execFile` with a deadline and no shell. */
export async function readSwitchboardSessions(deps: { find(): Promise<string | null>; run: Run; now: number }): Promise<SwitchboardSessions> {
  const sb = await deps.find()
  if (!sb) return { installed: false, rows: [], unread: [] }
  const unread: SwitchboardSessions['unread'] = []
  const ask = async (source: 'sessions' | 'recovery', args: string[]): Promise<string | null> => {
    try {
      const r = await deps.run(sb, args)
      if (r.code === 0) return r.stdout
      unread.push({ source, reason: `exit ${r.code}: ${(r.stderr || r.stdout).trim().split('\n').pop()?.slice(0, 200) ?? ''}` })
    } catch (e) {
      // Not silent: the failure is this source's `unread` entry, which the screen says («Switchboard не ответил»).
      unread.push({ source, reason: e instanceof Error ? e.message : String(e) })
    }
    return null
  }
  const [sessionsOut, recoveryOut] = await Promise.all([ask('sessions', ['--json', 'sessions', '--all']), ask('recovery', ['--json', 'recovery'])])
  const sessions = sessionsOut === null ? null : parseSessions(sessionsOut)
  if (sessionsOut !== null && sessions === null) unread.push({ source: 'sessions', reason: 'not JSON with a data object' })
  const labels = new Map((sessions ?? []).map((s) => [s.accountId, s.account]))
  const stops = recoveryOut === null ? null : parseStops(recoveryOut, (id) => labels.get(id) ?? null)
  if (recoveryOut !== null && stops === null) unread.push({ source: 'recovery', reason: 'not JSON with a data object' })
  const rows = mergeSessions({ now: deps.now, switchboard: sessions, pending: null, stops: stops ?? [], consoles: [], records: [], dismissed: [] })
  return { installed: true, rows, unread }
}

// #region switchboard-limit-stops — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#312-a-resumed-session-takes-its-claims-back
/** §3.12: the coding-agent session ids Switchboard holds on a usage limit (waiting or being continued) and will continue
 *  itself; a billing stop needs the person, so it holds nothing. Empty without Switchboard; null when unread. */
export async function readLimitStops(deps: { find(): Promise<string | null>; run: Run }): Promise<ReadonlySet<string> | null> {
  const sb = await deps.find()
  if (!sb) return new Set()
  const r = await deps.run(sb, ['--json', 'recovery']).catch(() => null)
  const stops = r && r.code === 0 ? parseStops(r.stdout, () => null) : null
  return stops === null ? null : new Set(stops.filter((x) => x.verdict !== 'billing').map((x) => x.session))
}

/** In the app, as `readMachineSwitchboardSessions` asks. */
export async function readMachineLimitStops(env: Record<string, string>): Promise<ReadonlySet<string> | null> {
  const PATH = await widenProbePath(env.PATH ?? '', env)
  return readLimitStops({ find: () => findOnPath('switchboard', PATH), run: (file, args) => withOneRetry((d) => runSwitchboard(file, args, env, PATH, d), SWITCHBOARD_SESSIONS_DEADLINE_MS) })
}
// #endregion switchboard-limit-stops

/** In the app: Switchboard found on the session PATH (widened as agent detection widens it), asked with a deadline. */
export async function readMachineSwitchboardSessions(env: Record<string, string>, now: number): Promise<SwitchboardSessions> {
  const PATH = await widenProbePath(env.PATH ?? '', env)
  return readSwitchboardSessions({
    find: () => findOnPath('switchboard', PATH),
    now,
    run: (file, args) => withOneRetry((d) => runSwitchboard(file, args, env, PATH, d), SWITCHBOARD_SESSIONS_DEADLINE_MS)
  })
}
// #endregion switchboard-sessions

/** One `switchboard` call in the app (the CEO's session control, ADR-0197): found on the session PATH, a deadline, no
 *  shell; null when Switchboard is not installed. */
export async function runMachineSwitchboard(env: Record<string, string>, args: string[]): Promise<{ code: number; stdout: string; stderr: string } | null> {
  const PATH = await widenProbePath(env.PATH ?? '', env)
  const sb = await findOnPath('switchboard', PATH)
  if (!sb) return null
  // Only a read is tried twice: a `sessions end` or `continue` that timed out may have acted, and acting twice is not
  // the person's ask.
  return readOnlySwitchboardCall(args)
    ? withOneRetry((deadline) => runSwitchboard(sb, args, env, PATH, deadline), SWITCHBOARD_SESSIONS_DEADLINE_MS)
    : runSwitchboard(sb, args, env, PATH)
}

/** A `switchboard --json sessions [--rows|--all|show …]` or `--json recovery` read: nothing on the machine changes.
 *  Since 2026-11-20 also the console line's reads (`accounts list`, `project list`, `shell env --dir <folder>`). */
export function readOnlySwitchboardCall(args: readonly string[]): boolean {
  if (args[0] !== '--json') return false
  if (args[1] === 'recovery') return args.length === 2
  if ((args[1] === 'accounts' || args[1] === 'project') && args[2] === 'list') return args.length === 3
  if (args[1] === 'shell' && args[2] === 'env') return args.length === 5 && args[3] === '--dir' && path.isAbsolute(args[4] ?? '')
  return args[1] === 'sessions' && args.slice(2).every((a) => a === '--rows' || a === '--all' || a === '--tree' || a === '--machine')
}

// #region switchboard-run-failure — docs: docs/evidence/specs/2026-11-19-session-launch-journal.md#5-when-switchboard-does-not-answer
/** Switchboard's output may be large (184 KB for 445 rows, measured 2026-11-19); 16 MB keeps a busy machine readable. */
export const SWITCHBOARD_MAX_OUTPUT = 16 * 1024 * 1024

/**
 * Why a `switchboard` call gave no exit code, in words a person reads (board request eef5abeb: the CEO saw only
 * «Command failed: …/switchboard --json sessions --rows», `execFile`'s message for a child that was killed, which says
 * neither the deadline nor the signal). `retry` is true for what a second try can cure: the deadline, a signal (the
 * app's binary being replaced by its own update), an output over the buffer is not.
 */
export function switchboardFailure(err: unknown, deadlineMs: number): { reason: string; retry: boolean } {
  const e = (err ?? {}) as { code?: unknown; signal?: unknown; killed?: unknown; message?: unknown }
  const tail = typeof e.message === 'string' ? e.message.split('\n').slice(1).join(' ').trim().slice(0, 160) : ''
  const said = (s: string): string => (tail ? `${s} (${tail})` : s)
  if (e.code === 'ENOENT') return { reason: 'the switchboard program is not where it was found (being updated or removed)', retry: true }
  if (e.code === 'EACCES') return { reason: 'the switchboard program may not be run (permission denied)', retry: false }
  if (e.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return { reason: 'switchboard answered more than Fabric reads at once', retry: false }
  if (e.killed === true && (e.signal === 'SIGTERM' || e.signal === null || e.signal === undefined))
    return { reason: said(`switchboard did not answer within ${Math.round(deadlineMs / 1000)} s`), retry: true }
  if (typeof e.signal === 'string') return { reason: said(`switchboard was ended by ${e.signal}`), retry: true }
  return { reason: said(typeof e.message === 'string' ? e.message.split('\n')[0]!.slice(0, 200) : String(err)), retry: false }
}

/** `execFile` with a deadline and no shell. A call that gave no exit code throws an Error naming why
 *  (`switchboardFailure`), with `retry` on it. */
function runSwitchboard(file: string, args: string[], env: Record<string, string>, PATH: string, deadlineMs = SWITCHBOARD_SESSIONS_DEADLINE_MS): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, [...args], { env: { ...env, PATH }, timeout: deadlineMs, maxBuffer: SWITCHBOARD_MAX_OUTPUT }, (err, stdout, stderr) => {
      const exit = (err as { code?: unknown } | null)?.code
      if (err && typeof exit !== 'number') {
        const f = switchboardFailure(err, deadlineMs)
        return reject(Object.assign(new Error(f.reason), { retry: f.retry }))
      }
      resolve({ code: err ? (exit as number) : 0, stdout: String(stdout), stderr: String(stderr) })
    })
  })
}

/** One call with one more try, a second later and with the same deadline, for a failure a second try can cure
 *  (Switchboard's advice, board thread 3ca40854: 30 s and one retry; it joins concurrent calls itself, SB-580). */
export async function withOneRetry<T>(call: (deadlineMs: number) => Promise<T>, deadlineMs: number, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))): Promise<T> {
  try { return await call(deadlineMs) } catch (e) {
    if (!(e as { retry?: unknown })?.retry) throw e
    await sleep(1000)
    return call(deadlineMs)
  }
}
// #endregion switchboard-run-failure

// #region session-meta-switchboard — docs: docs/ux/scenarios.md#scn-188-read-a-consoles-system-line
/** The console line's half of `sessions --all` (2026-11-20): the runner's own session id and who asked Switchboard,
 *  which `parseSessions` leaves out; the same record, the same checks. */
export function parseSessionLites(stdout: string): SbSessionLite[] | null {
  const data = dataOf(stdout)
  if (!data) return null
  const out: SbSessionLite[] = []
  for (const x of Array.isArray(data.sessions) ? (data.sessions as Record<string, unknown>[]) : []) {
    if (!x || typeof x !== 'object' || typeof x.working_directory !== 'string' || !path.isAbsolute(x.working_directory)) continue
    const by = x.launched_by && typeof x.launched_by === 'object' ? (x.launched_by as Record<string, unknown>) : null
    out.push({
      providerSessionId: typeof x.provider_session_id === 'string' && SESSION.test(x.provider_session_id) ? x.provider_session_id : null,
      folder: x.working_directory,
      label: typeof x.label === 'string' ? x.label.slice(0, 200) : '',
      contextName: typeof x.context_name === 'string' ? x.context_name.slice(0, 120) : null,
      context: typeof x.context === 'string' ? x.context.slice(0, 120) : null,
      surface: by && typeof by.surface === 'string' && /^[a-z-]{1,32}$/.test(by.surface) ? by.surface : null,
      launchedAt: ms(x.launched_at)
    })
  }
  return out
}

/** `accounts list`: the routes (`provider:pool` → account id) and each account's label. Never a credential. */
export function parseAccounts(stdout: string): { routes: Record<string, string>; labels: Record<string, string> } | null {
  const data = dataOf(stdout)
  if (!data) return null
  const routes: Record<string, string> = {}
  if (data.routes && typeof data.routes === 'object')
    for (const [k, v] of Object.entries(data.routes as Record<string, unknown>)) if (/^[a-z]+:[A-Za-z0-9._-]{1,64}$/.test(k) && typeof v === 'string' && v.length <= 64) routes[k] = v
  const labels: Record<string, string> = {}
  for (const a of Array.isArray(data.accounts) ? (data.accounts as Record<string, unknown>[]) : [])
    if (a && typeof a.id === 'string' && typeof a.label === 'string') labels[a.id] = a.label.slice(0, 200)
  return { routes, labels }
}

/** `project list`: each group's organisation name. */
export function parseGroupOrgs(stdout: string): Record<string, string> | null {
  const data = dataOf(stdout)
  if (!data) return null
  const out: Record<string, string> = {}
  for (const p of Array.isArray(data.projects) ? (data.projects as Record<string, unknown>[]) : [])
    if (p && typeof p.pool === 'string' && typeof p.organization_name === 'string' && p.organization_name) out[p.pool] = p.organization_name.slice(0, 120)
  return out
}

/** `shell env --dir`: `none`, or the group, its context, the Claude home and the Codex home, tab-separated. */
export function parseShellEnv(stdout: string): { pool: string; context: string | null; claudeHome: string | null } | null {
  const line = stdout.trim().split('\n')[0] ?? ''
  if (!line || line === 'none') return null
  const [pool, context, claudeHome] = line.split('\t')
  if (!pool || !/^[A-Za-z0-9._-]{1,64}$/.test(pool)) return null
  return { pool, context: context && context !== '-' ? context : null, claudeHome: claudeHome && claudeHome !== '-' && path.isAbsolute(claudeHome) ? claudeHome : null }
}
// #endregion session-meta-switchboard

