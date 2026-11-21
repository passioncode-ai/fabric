// #region task-rank-write — docs: docs/evidence/specs/2026-11-21-task-rank.md#5-the-writes
// The owner's acts on the queue's order (ADR-0208): a move, and the decision on an agent's proposal. Each is the
// person's own: the caller appends with the operator's actor, and the projector takes `task.ranked@1` and
// `task.rank.declined@1` from a person only. The order the move is judged against is read fresh here, never taken
// from the window: the queue he saw may be a few seconds old, and ranks are written against the one that stands.
import { rankWrites } from '../shared/taskRank.ts'

export interface RankTaskRow {
  id: string
  projectId: string
  status: string
  rank: number | null
  proposal: { afterTaskId: string | null } | null
}

export interface RankWriteDeps {
  /** The task by id, or null when this estate has none. */
  readTask(taskId: string): Promise<RankTaskRow | null>
  /** The project's queue in the board's order, each task with its own rank. Throws when it cannot be read. */
  readQueue(projectId: string): Promise<Array<{ id: string; rank: number | null }>>
  /** Appends one event of the person's. */
  append(projectId: string, type: 'task.ranked@1' | 'task.rank.declined@1', payload: Record<string, unknown>): Promise<void>
}

/** A refusal the window says in its own words. */
export class RankRefusal extends Error {
  readonly code: 'no_task' | 'not_queued' | 'other_project' | 'not_in_queue' | 'no_proposal' | 'proposal_stale'
  constructor(code: RankRefusal['code'], message: string) {
    super(message)
    this.name = 'RankRefusal'
    this.code = code
  }
}

/** Moves `taskId` to stand right after `afterTaskId` (null: first) in its project's queue. Answers how many ranks it
 *  wrote: one for a move between placed tasks, more when unplaced tasks above the drop point are pinned with it. */
export async function reorderTask(deps: RankWriteDeps, taskId: string, afterTaskId: string | null): Promise<{ written: number }> {
  const task = await deps.readTask(taskId)
  if (!task) throw new RankRefusal('no_task', 'no such task')
  if (task.status !== 'backlog') throw new RankRefusal('not_queued', 'only a task in the queue is placed: one in work or in review keeps its place')
  if (afterTaskId !== null) {
    const after = await deps.readTask(afterTaskId)
    if (!after) throw new RankRefusal('no_task', 'the task to stand after is not there')
    if (after.projectId !== task.projectId) throw new RankRefusal('other_project', 'a task is placed among the tasks of its own project')
  }
  const queue = await deps.readQueue(task.projectId)
  const writes = rankWrites(queue, taskId, afterTaskId)
  if (writes === null) throw new RankRefusal('not_in_queue', 'the queue changed: the task, or the one to stand after, is no longer in it')
  for (const w of writes) await deps.append(task.projectId, 'task.ranked@1', { task_id: w.taskId, rank: w.rank })
  return { written: writes.length }
}

/** The person's decision on an agent's proposed place. Accepting moves the task there and clears the proposal (a
 *  `task.ranked@1` for the task always follows, so the proposal never outlives its acceptance); declining clears it. */
export async function decideRankProposal(deps: RankWriteDeps, taskId: string, accept: boolean): Promise<{ accepted: boolean; written: number }> {
  const task = await deps.readTask(taskId)
  if (!task) throw new RankRefusal('no_task', 'no such task')
  if (!task.proposal) throw new RankRefusal('no_proposal', 'there is no proposal on this task')
  if (!accept) {
    await deps.append(task.projectId, 'task.rank.declined@1', { task_id: taskId })
    return { accepted: false, written: 0 }
  }
  if (task.status !== 'backlog') throw new RankRefusal('not_queued', 'the task left the queue: the proposal no longer applies')
  const queue = await deps.readQueue(task.projectId)
  const writes = rankWrites(queue, taskId, task.proposal.afterTaskId)
  if (writes === null) throw new RankRefusal('proposal_stale', 'the task it was to stand after is no longer in the queue: decline the proposal or move the task yourself')
  const own = writes.some((w) => w.taskId === taskId)
  for (const w of writes) await deps.append(task.projectId, 'task.ranked@1', { task_id: w.taskId, rank: w.rank })
  // Already where the proposal wanted it: its own rank is written again, which is what clears the proposal.
  if (!own) {
    const rank = queue.find((q) => q.id === taskId)?.rank
    if (rank === null || rank === undefined) throw new RankRefusal('proposal_stale', 'the queue changed while the proposal was read: try again')
    await deps.append(task.projectId, 'task.ranked@1', { task_id: taskId, rank })
  }
  return { accepted: true, written: writes.length + (own ? 0 : 1) }
}
// #endregion task-rank-write
