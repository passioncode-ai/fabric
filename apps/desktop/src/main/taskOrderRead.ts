// #region task-order-read — docs: docs/evidence/specs/2026-11-21-task-rank.md#4-the-readers
// One read of the queue's order (ADR-0208) for every reader: the kanban, the backlog routine and `fabric_work_list`.
// It reads the open tasks with their ranks and the dependency links, and answers each queued task's place in its own
// project with the reason for it. A read that stopped at its bound is named in `capped`; a read that failed THROWS,
// so a caller says «the order could not be read» and never shows a guessed order as the board's.
import type { createScopedStore } from './scopedStore.ts'
import { orderQueue, type Placed, type RankLink, type RankTask } from '../shared/taskRank.ts'

type Store = ReturnType<typeof createScopedStore>

/** Open tasks read for the order; past it the order is of the newest only, and `capped` says `tasks`. */
export const ORDER_TASKS = 2000
/** Dependency links read; past it `capped` says `links`. */
export const ORDER_LINKS = 5000

export interface QueueOrder {
  /** Each queued task's place in its own project's queue, 1-based, with why. */
  byTask: Map<string, Placed>
  /** The queued tasks of each project, in order. */
  byProject: Map<string, Placed[]>
  capped: Array<'tasks' | 'links'>
}

interface TaskRow { id: string; project_id: string; status: string; rank: number | null; seq: number }
interface LinkRow { task_id: string; rel: string; target_kind: string | null; target_id: string }

/** Pure: the rows as read, split into each project's queue. One walk over the whole graph, so a prerequisite in
 *  another project still blocks; each project's places are then numbered on their own. */
export function composeQueueOrder(tasks: readonly TaskRow[], links: readonly LinkRow[]): Pick<QueueOrder, 'byTask' | 'byProject'> {
  const projectOf = new Map(tasks.map((t) => [t.id, t.project_id]))
  const rankTasks: RankTask[] = tasks.map((t) => ({ id: t.id, status: t.status, rank: t.rank === null || t.rank === undefined ? null : Number(t.rank), filed: Number(t.seq) }))
  const rankLinks: RankLink[] = links.map((l) => ({ taskId: l.task_id, rel: l.rel, targetKind: l.target_kind, targetId: l.target_id }))
  const byProject = new Map<string, Placed[]>()
  const byTask = new Map<string, Placed>()
  for (const p of orderQueue(rankTasks, rankLinks)) {
    const project = projectOf.get(p.id)!
    const list = byProject.get(project) ?? []
    const placed = { ...p, place: list.length + 1 }
    list.push(placed)
    byProject.set(project, list)
    byTask.set(p.id, placed)
  }
  return { byTask, byProject }
}

export async function readQueueOrder(store: Store, opts: { projectId?: string | null } = {}): Promise<QueueOrder> {
  const tasksQ = store.select('project_tasks', 'id,project_id,status,rank,seq').in('status', ['backlog', 'running', 'review'])
  const linksQ = store.select('task_links', 'task_id,rel,target_kind,target_id').in('rel', ['blocks', 'follows']).eq('target_kind', 'task')
  const [tasks, links] = await Promise.all([
    // Newest first at the bound: an old task past it is the one left out, and `capped` says so.
    (opts.projectId ? tasksQ.eq('project_id', opts.projectId) : tasksQ).order('seq', { ascending: false }).limit(ORDER_TASKS),
    (opts.projectId ? linksQ.eq('project_id', opts.projectId) : linksQ).order('seq', { ascending: false }).limit(ORDER_LINKS)
  ])
  if (tasks.error) throw new Error(`the open tasks could not be read: ${tasks.error.message}`)
  if (links.error) throw new Error(`the task links could not be read: ${links.error.message}`)
  const taskRows = (tasks.data ?? []) as unknown as TaskRow[]
  const linkRows = (links.data ?? []) as unknown as LinkRow[]
  // A prerequisite in another project is not in a one-project read: its status is read by id, so it still blocks.
  const known = new Set(taskRows.map((t) => t.id))
  const outside = [...new Set(linkRows.flatMap((l) => [l.task_id, l.target_id]).filter((id) => !known.has(id)))]
  let extra: TaskRow[] = []
  if (outside.length) {
    const read = await store.selectIn('project_tasks', 'id,project_id,status,rank,seq', 'id', outside)
    if (read.failed) throw new Error(`the linked tasks could not be read: ${read.failed}`)
    extra = read.rows as unknown as TaskRow[]
  }
  const composed = composeQueueOrder([...taskRows, ...extra], linkRows)
  if (opts.projectId) for (const project of [...composed.byProject.keys()]) {
    if (project === opts.projectId) continue
    for (const p of composed.byProject.get(project)!) composed.byTask.delete(p.id)
    composed.byProject.delete(project)
  }
  return { ...composed, capped: [...(taskRows.length >= ORDER_TASKS ? ['tasks' as const] : []), ...(linkRows.length >= ORDER_LINKS ? ['links' as const] : [])] }
}
// #endregion task-order-read
