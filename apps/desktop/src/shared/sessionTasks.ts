// #region session-tasks — docs: docs/ux/scenarios.md#scn-091-вернуться-к-агенту-у-его-консоли-прочитав-его-собственный-контекст
/**
 * One agent session's tasks, newest first (0.3.14, the operator's request of 2026-10-26: «перейти на агента,
 * посмотреть его флоу, как он по задачам шёл»): every task the session claimed (`work_claims.owner_session`, live and
 * released) and every task Fabric launched in it (`project_tasks.session_id`), one row per task. The newest claim of a
 * task wins and its claims are counted; a launched task with no claim is dated by when Fabric attached it to this
 * session (`task.session.attached@1`, the 0.3.14 review, iteration 1, DA-5), else when it started. Pure: the main
 * process reads the rows (`main/workRead.ts#readSessionTasks`) and a failed read THROWS there, so an empty list here
 * always means the session holds no task, never a read that did not happen.
 */
import { taskSummary } from './homeLive.ts'

/** How many tasks the agent page lists. */
export const SESSION_TASKS_LIMIT = 100

export interface SessionClaimRow {
  work_id: string
  project_id: string
  claimed_at: string
  released_at: string | null
  /** `done`, `handed-over`, `let-go`, `operator`, `session-ended` or `lapsed` (migration 95). */
  released_how: string | null
  /** What the agent said when it let go (`work_claims.release_note`); absent from an older read. */
  release_note?: string | null
}

export interface SessionTaskRow {
  id: string
  project_id: string
  title: string | null
  brief_what: string | null
  brief_why: string | null
  brief_expected: string | null
  status: string
  started_at: string | null
}

export interface SessionTask {
  taskId: string
  projectId: string
  projectName: string | null
  /** What the agent wrote the task is for, else its title; empty when it has neither (the screen says «untitled»). */
  summary: string
  /** The task's own title, apart from the brief's «what» (`brief.what`; the mockup parity: the row heads with the
   *  title). Null when it has none. */
  title?: string | null
  /** How it ended in the agent's own words: its newest claim's release note (the mockup parity, «Чем закончил»), read
   *  from the claim itself so an old task keeps it past the history window. Null when none was written. */
  releaseNote?: string | null
  brief: { what: string | null; why: string | null; expected: string | null }
  /** The task's column now; `unknown` when its row was not found. */
  status: string
  /** When the session took it: its newest claim, or when Fabric launched it. */
  claimedAt: string
  releasedAt: string | null
  releasedHow: string | null
  /** How many times this session claimed it; 0 for a task Fabric launched that was never claimed. */
  claims: number
  via: 'claim' | 'launch'
}

export interface SessionTasksView {
  tasks: SessionTask[]
  /** A read stopped at its limit, or more tasks than the page lists: older tasks exist that are not here. */
  capped: boolean
  /** The questions this agent asked the person that are still open (`questions.asked_by_id` = its session id), newest
   *  first (the mockup parity, agent page «Вопросы этого агента»). Absent: not read; `questionsUnread` says why. */
  questions?: AgentQuestion[]
  questionsUnread?: string
  /** The coding agent the session runs and its version as this machine reports it (`start.executors`; the mockup's
   *  «Агент» fact). Absent: not known. */
  runner?: { id: string; label: string | null; version: string | null }
}

export interface AgentQuestion {
  id: string
  projectId: string | null
  taskId: string | null
  text: string
  /** Why it was asked, in the agent's own words (`questions.why_blocked`); null when it wrote none. */
  why: string | null
  kind: string | null
  options: unknown
  askedAt: string
  /** The revision the page shows, submitted back with an answer (`questions.answer` refuses a stale one). */
  revision: number
}

const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length ? t : null
}

export function composeSessionTasks(input: {
  claims: readonly SessionClaimRow[]
  /** The tasks whose `session_id` is this session. */
  launched: readonly SessionTaskRow[]
  /** The claimed tasks' rows, by id. */
  tasks: readonly SessionTaskRow[]
  projects: ReadonlyArray<{ id: string; name: string }>
  /** One of the main process's reads stopped at its limit. */
  readCapped?: boolean
  /** When each launched task was attached to this session (its newest `task.session.attached@1`), by task id. */
  attachedAt?: Readonly<Record<string, string>>
  limit?: number
}): SessionTasksView {
  const limit = input.limit ?? SESSION_TASKS_LIMIT
  const names = new Map(input.projects.map((p) => [p.id, p.name]))
  const rowOf = new Map<string, SessionTaskRow>()
  for (const t of input.launched) rowOf.set(t.id, t)
  for (const t of input.tasks) rowOf.set(t.id, t)
  const newest = new Map<string, SessionClaimRow>()
  const count = new Map<string, number>()
  for (const c of input.claims) {
    count.set(c.work_id, (count.get(c.work_id) ?? 0) + 1)
    const prev = newest.get(c.work_id)
    if (!prev || prev.claimed_at < c.claimed_at) newest.set(c.work_id, c)
  }
  const view = (id: string, projectId: string, claimedAt: string, released: { at: string | null; how: string | null; note?: string | null }, via: SessionTask['via']): SessionTask => {
    const row = rowOf.get(id)
    return {
      taskId: id,
      projectId,
      projectName: names.get(projectId) ?? null,
      summary: taskSummary(row),
      title: clean(row?.title),
      releaseNote: clean(released.note),
      brief: { what: clean(row?.brief_what), why: clean(row?.brief_why), expected: clean(row?.brief_expected) },
      status: row?.status ?? 'unknown',
      claimedAt,
      releasedAt: released.at,
      releasedHow: released.how,
      claims: count.get(id) ?? 0,
      via
    }
  }
  const out: SessionTask[] = [...newest.values()].map((c) => view(c.work_id, c.project_id, c.claimed_at, { at: c.released_at, how: c.released_how, note: c.release_note ?? null }, 'claim'))
  for (const t of input.launched) {
    const at = input.attachedAt?.[t.id] ?? t.started_at
    if (newest.has(t.id) || !at) continue
    out.push(view(t.id, t.project_id, at, { at: null, how: null }, 'launch'))
  }
  out.sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))
  return { tasks: out.slice(0, limit), capped: !!input.readCapped || out.length > limit }
}
/** The lanes of an agent's tasks (the operator's second review, 2026-10-26, v2 §4.9, R-12): in work, on review, handed
 *  on (released and not finished: let go, handed over, handed in as done with the task back in the queue, or released by
 *  the person, UX-24), dropped (its claim lapsed or its
 *  session ended with the task not finished: what the Board and Главная call «Брошено», the 0.3.14 review, iteration 2,
 *  UX-14), done (finished or cancelled), and not found (the task's row was not read: deleted or out of reach; never
 *  filed as done, DA-4). The page shows «Все» first, every task newest first (UX-20), then a tab per lane. */
export const SESSION_LANES = ['inWork', 'review', 'handed', 'dropped', 'done', 'missing'] as const
export type SessionLane = typeof SESSION_LANES[number]

/** Releases the agent did not choose: its claim ran out, or its session ended with the task still open. */
const DROPPED_HOW = new Set(['lapsed', 'session-ended'])

export function laneOf(x: SessionTask): SessionLane {
  if (x.status === 'unknown') return 'missing'
  if (x.status === 'review') return 'review'
  if (x.status === 'done' || x.status === 'cancelled') return 'done'
  // UX-24 (the 0.3.14 review, iteration 3): a released claim is never «В работе» for this agent. Handed in as done with
  // the task back in the queue (or still running until the sweep moves it to review) is «Передано», as is a claim the
  // person released (its line says «Снята вами»).
  if (x.releasedAt) return x.releasedHow && DROPPED_HOW.has(x.releasedHow) ? 'dropped' : 'handed'
  return 'inWork'
}
/** The runner's version among the machine's coding agents (`start.executors` rows); null when absent or not installed. */
export function runnerOf(agentId: string | null | undefined, executors: ReadonlyArray<{ id: string; label?: string | null; version?: string | null }>): SessionTasksView['runner'] | undefined {
  if (!agentId) return undefined
  const row = executors.find((e) => e.id === agentId)
  return { id: agentId, label: row?.label ?? null, version: row?.version ?? null }
}

/** The open questions an agent asked, as the page shows them; rows of other askers are dropped. */
export function agentQuestions(sessionId: string, rows: ReadonlyArray<Record<string, unknown>>): AgentQuestion[] {
  return rows
    .filter((r) => r.asked_by_id === sessionId && r.status === 'open' && typeof r.id === 'string' && typeof r.text === 'string')
    .map((r) => ({
      id: r.id as string,
      projectId: typeof r.project_id === 'string' ? r.project_id : null,
      taskId: typeof r.task_id === 'string' ? r.task_id : null,
      text: r.text as string,
      why: typeof r.why_blocked === 'string' && r.why_blocked.trim() ? r.why_blocked.trim() : null,
      kind: typeof r.kind === 'string' ? r.kind : null,
      options: r.options ?? null,
      askedAt: typeof r.asked_at === 'string' ? r.asked_at : '',
      revision: typeof r.revision === 'number' ? r.revision : 1
    }))
    .sort((a, b) => b.askedAt.localeCompare(a.askedAt))
}
// #endregion session-tasks
