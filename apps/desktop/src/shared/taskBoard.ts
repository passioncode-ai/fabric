// #region task-board — docs: docs/ux/scenarios.md#scn-173-see-all-the-work-as-a-board-and-follow-a-task-through-its-stages
// The Board screen's kanban (the operator's walk of 2026-10-22, OF-19; decision D-1): the ladder Fabric enforces
// (`ladder.ts`) laid out as four columns, Очередь, В работе, На проверке, Готово. Built from the home's own reading
// (who works on what, review, finished) plus the queue, so the home and the board never disagree about a task.
import { specFlag, taskSummary, type HomeView, type TaskBrief } from './homeLive.ts'
import type { Placed } from './taskRank.ts'

export type BoardStage = 'backlog' | 'running' | 'review' | 'done'

export interface BoardCard {
  taskId: string
  projectId: string
  projectName: string
  summary: string
  /** The coding agent that holds it, when one does. */
  agent: string | null
  /** 0.3.14: the session working on it, for «В работе» and «Брошено»; the card links to that agent. */
  sessionId?: string | null
  /** When it entered its column, when known. */
  since: string | null
  /** ADR-0176 §1: a queued or running task whose brief lacks a part; absent when the brief was not read. */
  specMissing?: boolean
  /** ADR-0208: a queued task's place in its own project's queue and why; absent when the order was not read. */
  order?: CardOrder
  /** ADR-0208: an agent's open proposal of a place for this queued task; the person accepts or declines it. */
  proposal?: { afterTaskId: string | null; why: string }
}

/** Why a queued task stands where it does (`shared/taskRank.ts#orderQueue`). */
export interface CardOrder {
  place: number
  /** The owner placed it himself. */
  ranked: boolean
  /** It stands here because a task the owner placed waits for it. */
  inherited: boolean
  /** How many open tasks it waits for; 0 is ready. */
  waits: number
  /** How many open tasks wait for it. */
  unblocks: number
  /** On the longest chain of open tasks. */
  critical: boolean
}

export interface BoardColumn {
  stage: BoardStage
  cards: BoardCard[]
  /** The read stopped at its limit: the count is a floor. */
  capped: boolean
  /** The column could not be read: said, never shown as empty. */
  unread?: string
}

export interface TaskBoardView {
  columns: BoardColumn[]
  /** «Отменено» (SCN-173 step 1, CO-401): cancelled tasks, newest first, shown only when the person turns them on.
   *  Absent from a reader that did not ask; a failed read is `unread`, never an empty list. */
  cancelled?: { cards: BoardCard[]; capped: boolean; unread?: string }
  /** 0.3.14 «Брошено»: tasks in work with no live claim and no live session, not counted in «В работе». Absent from an
   *  older reader. */
  abandoned?: BoardCard[]
  projects: Array<{ id: string; name: string }>
  /** ADR-0208: the queue's order could not be read, so «Очередь» is shown newest first and says so. */
  orderUnread?: string
  /** ADR-0208: a read behind the order stopped at its bound: the order is of what was read. */
  orderCapped?: boolean
  readAt: string
}

export function composeTaskBoard(input: {
  home: HomeView
  queued: readonly TaskBrief[]
  projects: ReadonlyArray<{ id: string; name: string }>
  queuedLimit: number
  /** The queue was read in two parts (the placed and the newest): either stopped at its limit. */
  queuedCapped?: boolean
  /** ADR-0208: each queued task's place, or why it could not be read. Absent from an older caller: newest first. */
  order?: { byTask: ReadonlyMap<string, Placed>; capped?: boolean } | { unread: string }
  /** Cancelled tasks, newest first; with the limit they were read under. */
  cancelled?: { rows: readonly (TaskBrief & { updated_at?: string | null })[]; limit: number } | { unread: string }
}): TaskBoardView {
  const names = new Map(input.projects.map((p) => [p.id, p.name]))
  const places = input.order && 'byTask' in input.order ? input.order.byTask : null
  const proposalOf = (t: TaskBrief): BoardCard['proposal'] | undefined => {
    const p = (t as TaskBrief & { rank_proposal?: { after_task_id?: string | null; why?: string } | null }).rank_proposal
    return p && typeof p === 'object' ? { afterTaskId: typeof p.after_task_id === 'string' ? p.after_task_id : null, why: typeof p.why === 'string' ? p.why : '' } : undefined
  }
  const queue: BoardCard[] = input.queued
    .filter((t) => t.status === 'backlog' && names.has(t.project_id))
    .map((t) => {
      const o = places?.get(t.id)
      const proposal = proposalOf(t)
      return {
        taskId: t.id, projectId: t.project_id, projectName: names.get(t.project_id) ?? '', summary: taskSummary(t), agent: null, since: t.updated_at ?? null, ...specFlag(t),
        ...(o ? { order: { place: o.place, ranked: o.rank !== null, inherited: o.inherited, waits: o.waitsFor.length, unblocks: o.unblocks, critical: o.critical } } : {}),
        ...(proposal ? { proposal } : {})
      }
    })
  // In order when it was read: each project's first task before any project's second, so the top of every queue is at
  // the top of the column; a task the order did not reach keeps its place after the placed ones. Stable otherwise.
  if (places)
    queue.sort((a, b) => (a.order?.place ?? Infinity) - (b.order?.place ?? Infinity) || a.projectName.localeCompare(b.projectName))
  const h = input.home
  const workCard = (w: HomeView['inWork'][number]): BoardCard => ({ taskId: w.taskId, projectId: w.projectId, projectName: w.projectName, summary: w.summary, agent: w.agent, sessionId: w.sessionId, since: w.since, ...(w.specMissing !== undefined ? { specMissing: w.specMissing } : {}) })
  return {
    columns: [
      { stage: 'backlog', cards: queue, capped: input.queuedCapped ?? input.queued.length >= input.queuedLimit },
      { stage: 'running', cards: h.inWork.map(workCard), capped: !!h.inWorkCapped },
      { stage: 'review', cards: h.review.map((r) => ({ ...r, agent: null })), capped: !!h.reviewCapped },
      { stage: 'done', cards: h.done.map((r) => ({ ...r, agent: null })), capped: !!h.doneCapped, ...(h.doneUnread ? { unread: h.doneUnread } : {}) }
    ],
    abandoned: (h.abandoned ?? []).map(workCard),
    projects: input.projects.map((p) => ({ id: p.id, name: p.name })),
    readAt: h.readAt,
    ...(input.order && 'unread' in input.order ? { orderUnread: input.order.unread } : {}),
    ...(input.order && 'byTask' in input.order && input.order.capped ? { orderCapped: true } : {}),
    ...(input.cancelled
      ? {
          cancelled: 'unread' in input.cancelled
            ? { cards: [], capped: false, unread: input.cancelled.unread }
            : {
                cards: input.cancelled.rows
                  .filter((t) => names.has(t.project_id))
                  .map((t) => ({ taskId: t.id, projectId: t.project_id, projectName: names.get(t.project_id) ?? '', summary: taskSummary(t), agent: null, since: t.updated_at ?? null })),
                capped: input.cancelled.rows.length >= input.cancelled.limit
              }
        }
      : {})
  }
}
// #endregion task-board
