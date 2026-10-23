// #region task-board — docs: docs/ux/scenarios.md#scn-173-see-all-the-work-as-a-board-and-follow-a-task-through-its-stages
// The Board screen's kanban (the operator's walk of 2026-10-22, OF-19; decision D-1): the ladder Fabric enforces
// (`ladder.ts`) laid out as four columns, Очередь, В работе, На проверке, Готово. Built from the home's own reading
// (who works on what, review, finished) plus the queue, so the home and the board never disagree about a task.
import { taskSummary, type HomeView, type TaskBrief } from './homeLive.ts'

export type BoardStage = 'backlog' | 'running' | 'review' | 'done'

export interface BoardCard {
  taskId: string
  projectId: string
  projectName: string
  summary: string
  /** The coding agent that holds it, when one does. */
  agent: string | null
  /** When it entered its column, when known. */
  since: string | null
}

export interface BoardColumn {
  stage: BoardStage
  cards: BoardCard[]
  /** The read stopped at its limit: the count is a floor. */
  capped: boolean
}

export interface TaskBoardView {
  columns: BoardColumn[]
  projects: Array<{ id: string; name: string }>
  readAt: string
}

export function composeTaskBoard(input: {
  home: HomeView
  queued: readonly TaskBrief[]
  projects: ReadonlyArray<{ id: string; name: string }>
  queuedLimit: number
}): TaskBoardView {
  const names = new Map(input.projects.map((p) => [p.id, p.name]))
  const queue: BoardCard[] = input.queued
    .filter((t) => t.status === 'backlog' && names.has(t.project_id))
    .map((t) => ({ taskId: t.id, projectId: t.project_id, projectName: names.get(t.project_id) ?? '', summary: taskSummary(t), agent: null, since: t.updated_at ?? null }))
  const h = input.home
  return {
    columns: [
      { stage: 'backlog', cards: queue, capped: input.queued.length >= input.queuedLimit },
      { stage: 'running', cards: h.inWork.map((w) => ({ taskId: w.taskId, projectId: w.projectId, projectName: w.projectName, summary: w.summary, agent: w.agent, since: w.since })), capped: !!h.inWorkCapped },
      { stage: 'review', cards: h.review.map((r) => ({ ...r, agent: null })), capped: !!h.reviewCapped },
      { stage: 'done', cards: h.done.map((r) => ({ ...r, agent: null })), capped: !!h.doneCapped }
    ],
    projects: input.projects.map((p) => ({ id: p.id, name: p.name })),
    readAt: h.readAt
  }
}
// #endregion task-board
