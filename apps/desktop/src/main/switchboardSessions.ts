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
export type { SwitchboardSessions }

export const SWITCHBOARD_SESSIONS_DEADLINE_MS = 10_000

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

/** In the app: Switchboard found on the session PATH (widened as agent detection widens it), asked with a deadline. */
export async function readMachineSwitchboardSessions(env: Record<string, string>, now: number): Promise<SwitchboardSessions> {
  const PATH = await widenProbePath(env.PATH ?? '', env)
  return readSwitchboardSessions({
    find: () => findOnPath('switchboard', PATH),
    now,
    run: (file, args) => new Promise((resolve, reject) => {
      execFile(file, [...args], { env: { ...env, PATH }, timeout: SWITCHBOARD_SESSIONS_DEADLINE_MS, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
        const exit = (err as { code?: unknown } | null)?.code
        if (err && typeof exit !== 'number') return reject(err)
        resolve({ code: err ? (exit as number) : 0, stdout: String(stdout), stderr: String(stderr) })
      })
    })
  })
}
// #endregion switchboard-sessions
