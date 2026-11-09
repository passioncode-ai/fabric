// #region work-directions — docs: docs/ux/scenarios.md#scn-181-see-a-projects-work-by-where-it-came-from-and-where-it-goes
/**
 * A project's work by direction (SCN-181, CO-543; the operator, 2026-11-08: the project page mixed backlog, board and
 * plans in one pile): where each piece of work came from and where it goes, one row per direction, each row newest
 * first. Pure: the project page and the agent page compose their rows from what they already read (the tasks, the
 * backlog rows linked to them in `task_sources`, the agents on them from `work.home`) and the project's board requests
 * (`main/projectRequests.ts`).
 *
 * THE ORDER, and why «От других проектов» holds requests and never tasks. SCN-181 files a task under the first
 * direction that applies: another project, the operator, the backlog, the plan, the agents. Nothing a task carries today
 * says it came from another project: `origin_kind` is one of `observation`, `person`, `task`, `document`, `memory`
 * (`origin.ts#ORIGIN_KINDS`), `assigned_by` is written only as `agent:<session>` (`workTools.ts`), `task_links` points
 * only at a task or a goal, and the board dispatcher starts a session for a request without filing a task. A guess
 * (an `origin_ref` naming a task this page did not read, say) would file a task under the wrong row, so the row carries
 * the requests addressed to this project themselves, and a task is filed by the rest of the order:
 *
 *   0. in review: «Ждут вашей проверки» (outgoing; a task waiting for the person is said there and only there, so every
 *      task is in exactly one row);
 *   1. the operator: `origin_kind` `person`, or none (a task from before origins; the board says «by you» for both);
 *   2. the backlog: a row of `task_sources` links it;
 *   3. the plan: it serves a goal (`goal_id`);
 *   4. the agents: everything else an agent filed (an observation, a document, memory, a task it split off, and the
 *      sweep's abandoned work, which keeps the origin its author gave it).
 *
 * A finished task (done or cancelled) leaves the rows seven days after it finished; a finished request seven days after
 * its last transition. They stay in «Сделано недавно», on the board and in Comms.
 */
import { taskSummary } from './homeLive.ts'
import type { SessionTask } from './sessionTasks.ts'

export const DIRECTIONS = ['fromProjects', 'fromYou', 'fromBacklog', 'fromPlan', 'fromAgents', 'toReview', 'toProjects'] as const
export type Direction = (typeof DIRECTIONS)[number]

/** How long a finished task or request stays in the rows. */
export const FINISHED_WINDOW_DAYS = 7

/** The fields of a task the rows read (a `TaskRow`, or an agent's task with the same fields). */
export interface DirectionTask {
  id: string
  status: string
  title: string | null
  brief_what: string | null
  origin_kind: string | null
  assigned_by: string | null
  goal_id: string | null
  started_at: string
  finished_at: string | null
  moved_at: string | null
}

/** A backlog row linked to a task (`task_sources`). */
export interface DirectionSource {
  task_id: string
  path: string
  row_id: string
}

/** A board request between this project and another, as `main/projectRequests.ts` reads it. */
export interface ProjectRequest {
  requestId: string
  threadId: string
  /** The asking project; null when the board did not name it. */
  from: string | null
  /** The project asked. */
  to: string
  capability: string
  subject: string | null
  /** The request's newest state (`board_requests.state`); null: submitted and never moved, so queued. */
  state: string | null
  /** When it was submitted. */
  at: string
  /** When it last moved; null: never. */
  changedAt: string | null
}

/** One project's board requests as main reads them (`main/projectRequests.ts#readProjectRequests`). */
export interface ProjectRequestsView {
  requests: ProjectRequest[]
  /** The other projects' names by id; a project not found is absent and the card says the request has no project name. */
  names: Record<string, string>
  /** A read stopped at its bound: older requests exist that are not here. */
  capped: boolean
  windowDays: number
}

export type TaskWord = 'queued' | 'working' | 'review' | 'done' | 'cancelled' | 'unknown'
export type RequestWord = 'waiting' | 'working' | 'answered' | 'done' | 'expired' | 'cancelled' | 'failed' | 'unknown'

export interface TaskCard {
  kind: 'task'
  id: string
  /** The brief's «what», else the title; empty when it has neither (the screen says «Задача без описания»). */
  summary: string
  status: string
  word: TaskWord
  /** When it last moved. */
  at: string
  agent: string | null
  source: { path: string; rowId: string } | null
}

export interface RequestCard {
  kind: 'request'
  requestId: string
  threadId: string
  /** The other project: the asker of an incoming request, the one asked of an outgoing one. */
  projectId: string | null
  projectName: string | null
  subject: string | null
  capability: string
  state: string | null
  word: RequestWord
  at: string
}

export type DirectionItem = TaskCard | RequestCard
export interface DirectionRow {
  direction: Direction
  items: DirectionItem[]
}

export function taskWord(status: string): TaskWord {
  switch (status) {
    case 'backlog': return 'queued'
    case 'running': return 'working'
    case 'review': return 'review'
    case 'done': return 'done'
    case 'cancelled': return 'cancelled'
    default: return 'unknown'
  }
}

/** The board's request states (migration 81) in words; a request never moved is queued. */
export function requestWord(state: string | null): RequestWord {
  switch (state) {
    case null:
    case 'queued': return 'waiting'
    case 'claimed':
    case 'accepted':
    case 'in_progress': return 'working'
    case 'answered': return 'answered'
    case 'completed': return 'done'
    case 'expired': return 'expired'
    case 'cancelled': return 'cancelled'
    case 'failed_known': return 'failed'
    default: return 'unknown'
  }
}

const FINISHED_TASK = new Set(['done', 'cancelled'])
/** The board's terminal request states (`board_request_open`, migration 120). */
const FINISHED_REQUEST = new Set(['completed', 'failed_known', 'cancelled', 'expired', 'answered'])

/** The direction of one task, by the order above. `sources` holds the ids of the tasks a backlog row links. */
export function directionOfTask(t: Pick<DirectionTask, 'id' | 'status' | 'origin_kind' | 'goal_id'>, sources: ReadonlySet<string>): Direction {
  if (t.status === 'review') return 'toReview'
  if ((t.origin_kind ?? null) === null || t.origin_kind === 'person') return 'fromYou'
  if (sources.has(t.id)) return 'fromBacklog'
  if (t.goal_id) return 'fromPlan'
  return 'fromAgents'
}

const movedAt = (t: DirectionTask): string =>
  (FINISHED_TASK.has(t.status) ? t.finished_at ?? t.moved_at : t.moved_at) ?? t.started_at

export function composeDirections(input: {
  projectId: string
  tasks: readonly DirectionTask[]
  sources?: readonly DirectionSource[]
  /** The agent on a task, by task id (`work.home`'s work in progress). */
  agents?: ReadonlyMap<string, string | null>
  /** The project's board requests; null or absent: not read, and the request rows are left out (the page says why). */
  requests?: readonly ProjectRequest[] | null
  projectNames?: ReadonlyMap<string, string>
  now: number
  windowDays?: number
}): DirectionRow[] {
  const since = input.now - (input.windowDays ?? FINISHED_WINDOW_DAYS) * 24 * 3600_000
  const recent = (iso: string): boolean => {
    const at = Date.parse(iso)
    return !Number.isFinite(at) || at >= since
  }
  const sourceOf = new Map((input.sources ?? []).map((s) => [s.task_id, s]))
  const ids = new Set(sourceOf.keys())
  const rows = new Map<Direction, DirectionItem[]>(DIRECTIONS.map((d) => [d, []]))
  for (const t of input.tasks) {
    const at = movedAt(t)
    if (FINISHED_TASK.has(t.status) && !recent(at)) continue
    const s = sourceOf.get(t.id)
    rows.get(directionOfTask(t, ids))!.push({
      kind: 'task', id: t.id, summary: taskSummary(t), status: t.status, word: taskWord(t.status), at,
      agent: input.agents?.get(t.id) ?? null, source: s ? { path: s.path, rowId: s.row_id } : null
    })
  }
  for (const r of input.requests ?? []) {
    const incoming = r.to === input.projectId
    if (!incoming && r.from !== input.projectId) continue
    if (r.state !== null && FINISHED_REQUEST.has(r.state) && !recent(r.changedAt ?? r.at)) continue
    const other = incoming ? r.from : r.to
    rows.get(incoming ? 'fromProjects' : 'toProjects')!.push({
      kind: 'request', requestId: r.requestId, threadId: r.threadId, projectId: other,
      projectName: other ? input.projectNames?.get(other) ?? null : null,
      subject: r.subject, capability: r.capability, state: r.state, word: requestWord(r.state), at: r.changedAt ?? r.at
    })
  }
  const newest = (a: DirectionItem, b: DirectionItem): number => b.at.localeCompare(a.at)
  return DIRECTIONS.map((direction) => ({ direction, items: rows.get(direction)!.sort(newest) })).filter((r) => r.items.length > 0)
}
/** An agent's task (`sessionTasks.ts`) as a task of the rows (SCN-181 step 5). A task whose row was not read carries no
 *  origin: it is filed with the agents, never as the person's. */
export function directionTaskOfSession(x: SessionTask): DirectionTask {
  return {
    id: x.taskId,
    status: x.status,
    // The page's own words for it (the brief, then the title) stand in when the row gave no title.
    title: x.title ?? (x.summary || null),
    brief_what: x.brief.what,
    origin_kind: x.origin ? x.origin.kind : 'unread',
    assigned_by: x.origin?.assignedBy ?? null,
    goal_id: x.origin?.goalId ?? null,
    started_at: x.origin?.startedAt ?? x.claimedAt,
    finished_at: x.origin?.finishedAt ?? null,
    moved_at: x.origin?.movedAt ?? null
  }
}
// #endregion work-directions
