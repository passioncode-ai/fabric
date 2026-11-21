// #region session-launches — docs: docs/evidence/specs/2026-11-19-session-launch-journal.md#2-the-record
/**
 * The journal of session launches (the owner's order, 2026-11-19, board request eef5abeb): every console Fabric
 * starts, who started it and from where, the chain above it, its project, folder, branch and runner, the runner's
 * own session id (what `claude --resume` takes) and how it ended. One JSON line per event in the data folder; this
 * module is the pure half: the line's shape, its parsing and the fold of a session's events into one launch.
 * Nothing here reads a disk or a clock.
 */

/** Who asked for the session. `fabric` is Fabric on its own account (the CEO's console, an unannotated start). */
export const LAUNCH_BY = ['person', 'ceo', 'routine', 'chain', 'answer', 'board-dispatch', 'restore', 'fabric'] as const
export type LaunchBy = (typeof LAUNCH_BY)[number]

/** Through what the ask came: a screen of Fabric, the CEO's console or its voice call, a restart of an ended one. */
export const LAUNCH_VIA = ['console', 'voice', 'screen', 'restart', 'task', 'board', 'switchboard', 'link'] as const
export type LaunchVia = (typeof LAUNCH_VIA)[number]

/** What a caller says about a launch before it happens (`main/launchOrigin.ts` carries it to the spawn). */
export interface LaunchOrigin {
  by: LaunchBy
  via?: LaunchVia
  /** The asker's words, redacted and cut before they are written. */
  reason?: string
  /** The session that asked (the CEO's console when the CEO started it). */
  parentSessionId?: string
  taskId?: string
  /** A board request this launch serves. */
  requestId?: string
}

export type LaunchEnd = 'exited' | 'stopped' | 'crashed' | 'app-quit'

export type LaunchLine =
  | {
      v: 1; at: string; event: 'opened'; session_id: string; project_id: string; cwd: string; branch: string | null
      runner: string; option_id: string; program: string; by: LaunchBy; via: LaunchVia | null; reason: string | null
      parent_session_id: string | null; task_id: string | null; request_id: string | null
      machine: string; app_pid: number; app_version: string; pid: number | null
    }
  | { v: 1; at: string; event: 'runner-session'; session_id: string; runner_session_id: string }
  | { v: 1; at: string; event: 'stop-asked'; session_id: string; by: LaunchBy; reason: string | null }
  | { v: 1; at: string; event: 'ended'; session_id: string; exit_code: number | null; signal: number | null; end: LaunchEnd }

/** One launch, folded from its lines. `end` null: no end was written, so it was running when Fabric last wrote, or
 *  Fabric ended without writing one (a crash, a power cut): the restore of 508c1048 reads exactly those. */
export interface Launch {
  sessionId: string
  projectId: string
  cwd: string
  branch: string | null
  runner: string
  optionId: string
  program: string
  by: LaunchBy
  via: LaunchVia | null
  reason: string | null
  parentSessionId: string | null
  taskId: string | null
  requestId: string | null
  machine: string
  appPid: number
  appVersion: string
  pid: number | null
  startedAt: string
  /** The runner's own session id (Claude Code's, for `claude --resume`); the newest one seen. */
  runnerSessionId: string | null
  stopAskedBy: LaunchBy | null
  stopReason: string | null
  endedAt: string | null
  end: LaunchEnd | null
  exitCode: number | null
  signal: number | null
}

const s = (v: unknown, max = 400): string | null => (typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null)
const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const oneOf = <T extends string>(v: unknown, set: readonly T[]): T | null => (typeof v === 'string' && (set as readonly string[]).includes(v) ? (v as T) : null)

/** A line read back, or null when it is not one of ours (a torn last line, a hand edit). */
export function parseLaunchLine(text: string): LaunchLine | null {
  let j: Record<string, unknown>
  try { j = JSON.parse(text) as Record<string, unknown> } catch { return null /* a torn line: the rest of the file still reads */ }
  if (!j || j.v !== 1 || typeof j.at !== 'string' || typeof j.session_id !== 'string') return null
  const base = { v: 1 as const, at: j.at, session_id: j.session_id }
  switch (j.event) {
    case 'opened': {
      const by = oneOf(j.by, LAUNCH_BY)
      const cwd = s(j.cwd, 4000), project = s(j.project_id), runner = s(j.runner), option = s(j.option_id)
      if (!by || !cwd || !project || !runner || !option) return null
      return { ...base, event: 'opened', project_id: project, cwd, branch: s(j.branch), runner, option_id: option,
        program: s(j.program, 4000) ?? '', by, via: oneOf(j.via, LAUNCH_VIA), reason: s(j.reason, 1000),
        parent_session_id: s(j.parent_session_id), task_id: s(j.task_id), request_id: s(j.request_id),
        machine: s(j.machine) ?? '', app_pid: n(j.app_pid) ?? 0, app_version: s(j.app_version) ?? '', pid: n(j.pid) }
    }
    case 'runner-session': {
      const id = s(j.runner_session_id)
      return id ? { ...base, event: 'runner-session', runner_session_id: id } : null
    }
    case 'stop-asked': {
      const by = oneOf(j.by, LAUNCH_BY)
      return by ? { ...base, event: 'stop-asked', by, reason: s(j.reason, 1000) } : null
    }
    case 'ended': {
      const end = oneOf(j.end, ['exited', 'stopped', 'crashed', 'app-quit'] as const)
      return end ? { ...base, event: 'ended', exit_code: n(j.exit_code), signal: n(j.signal), end } : null
    }
    default: return null
  }
}

/** Every launch the lines tell of, newest start first. Lines of a session whose opening is not among them (an older
 *  month not read) are dropped: a launch is known from its opening. Later lines of one session win. */
export function foldLaunches(lines: Iterable<LaunchLine>): Launch[] {
  const byId = new Map<string, Launch>()
  const all = [...lines]
  // Openings first: an end can be written before its opening (a console that exits while its branch is still read).
  for (const l of all) {
    if (l.event === 'opened') {
      byId.set(l.session_id, {
        sessionId: l.session_id, projectId: l.project_id, cwd: l.cwd, branch: l.branch, runner: l.runner, optionId: l.option_id,
        program: l.program, by: l.by, via: l.via, reason: l.reason, parentSessionId: l.parent_session_id, taskId: l.task_id,
        requestId: l.request_id, machine: l.machine, appPid: l.app_pid, appVersion: l.app_version, pid: l.pid, startedAt: l.at,
        runnerSessionId: null, stopAskedBy: null, stopReason: null, endedAt: null, end: null, exitCode: null, signal: null
      })
    }
  }
  for (const l of all) {
    if (l.event === 'opened') continue
    const launch = byId.get(l.session_id)
    if (!launch) continue
    if (l.event === 'runner-session') launch.runnerSessionId = l.runner_session_id
    else if (l.event === 'stop-asked') { launch.stopAskedBy = l.by; launch.stopReason = l.reason }
    else { launch.endedAt = l.at; launch.end = l.end; launch.exitCode = l.exit_code; launch.signal = l.signal }
  }
  return [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

/** How a session ended, from what Fabric saw: Fabric quitting, a stop someone asked for, a signal nobody asked for
 *  (a crash), or an exit of its own. */
export function endOf(e: { quitting: boolean; stopRequested: boolean; signal: number | null; exitCode: number | null }): LaunchEnd {
  if (e.quitting) return 'app-quit'
  if (e.stopRequested) return 'stopped'
  if (e.signal !== null && e.signal !== 0) return 'crashed'
  return 'exited'
}

/** The chain above a launch, nearest first (the CEO's console above the session it started, and so on), bounded so a
 *  cycle written by hand cannot loop. */
export function chainOf(launch: Launch, all: ReadonlyMap<string, Launch>, max = 10): Launch[] {
  const out: Launch[] = []
  const seen = new Set([launch.sessionId])
  let up = launch.parentSessionId
  while (up && out.length < max && !seen.has(up)) {
    seen.add(up)
    const parent = all.get(up)
    if (!parent) break
    out.push(parent)
    up = parent.parentSessionId
  }
  return out
}
// #endregion session-launches
