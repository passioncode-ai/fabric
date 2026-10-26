// #region agent-goals — docs: docs/ux/2026-10-26-simple-fabric-v2.md#42-an-agents-goal-and-its-step-r-3-r-4
/**
 * Each agent's goal (the operator's second review, 2026-10-26: «мне интересует более high value, какая задача конкретно
 * была, цель ... а это уже динамическая, текущий шаг, как прогресс»; docs/ux/2026-10-26-simple-fabric-v2.md §4.2, R-3).
 * The goal is the root of the current task's decomposition: from `LiveAgent.task`, walk `task_links` `spawned` (a task
 * spawned from its target) up to the root, at most 10 hops and never round a cycle. The root's title (else its
 * `brief_what`) is the goal; a goal the root was spawned from (`target_kind` goal), or the root's `goal_id`, leads with
 * the goal's own title. A task with no parent is its own goal (`isTask`). `origin_kind` person is said as «поставили
 * вы». No task, no goal named (null). A read that fails leaves every goal unknown (absent) and says why in
 * `goalsUnread`: the home never says «Цель не названа» from a read that did not happen.
 */
import type { HomeView } from '../shared/homeLive.ts'
import { ops } from './opsSink.ts'

type Rows = { rows: Array<Record<string, unknown>>; failed: string | null }
export interface GoalStore { selectIn(table: string, columns: string, key: string, values: string[]): Promise<Rows> }

const HOPS = 10
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim() : null)

async function must(read: Promise<Rows>, what: string): Promise<Array<Record<string, unknown>>> {
  const r = await read
  if (r.failed) throw new Error(`${what} could not be read: ${r.failed}`)
  return r.rows
}

export async function withGoals(view: HomeView, store: GoalStore): Promise<HomeView> {
  const current = [...new Set(view.live.map((a) => a.task?.id).filter((id): id is string => !!id))]
  try {
    // Walk every current task up at once, a hop per read.
    const parentOf = new Map<string, { kind: 'task' | 'goal'; id: string }>()
    let frontier = current
    const seen = new Set(current)
    for (let hop = 0; hop < HOPS && frontier.length; hop++) {
      const links = await must(store.selectIn('task_links', 'task_id,rel,target_kind,target_id', 'task_id', frontier), 'the tasks\' links')
      const next: string[] = []
      for (const l of links) {
        if (l.rel !== 'spawned') continue
        const from = str(l.task_id), to = str(l.target_id)
        if (!from || !to || parentOf.has(from)) continue
        const kind = l.target_kind === 'goal' ? 'goal' : 'task'
        parentOf.set(from, { kind, id: to })
        if (kind === 'task' && !seen.has(to)) { seen.add(to); next.push(to) }
      }
      frontier = next
    }
    const rootOf = (id: string): { task: string; goal: string | null } => {
      let at = id
      const walked = new Set([at])
      for (let hop = 0; hop < HOPS; hop++) {
        const p = parentOf.get(at)
        if (!p) break
        if (p.kind === 'goal') return { task: at, goal: p.id }
        if (walked.has(p.id)) break
        walked.add(p.id)
        at = p.id
      }
      return { task: at, goal: null }
    }
    const roots = new Map(current.map((id) => [id, rootOf(id)]))
    const rootIds = [...new Set([...roots.values()].map((r) => r.task))]
    const tasks = await must(store.selectIn('project_tasks', 'id,project_id,title,brief_what,goal_id,origin_kind', 'id', rootIds), 'the goals\' tasks')
    const taskById = new Map(tasks.map((t) => [String(t.id), t]))
    const goalIds = [...new Set([
      ...[...roots.values()].map((r) => r.goal),
      ...tasks.map((t) => str(t.goal_id))
    ].filter((g): g is string => !!g))]
    const goals = goalIds.length ? await must(store.selectIn('goals', 'id,title', 'id', goalIds), 'the goals') : []
    const goalTitle = new Map(goals.map((g) => [String(g.id), str(g.title)]))
    return {
      ...view,
      live: view.live.map((a) => {
        if (!a.task) return { ...a, goal: null }
        const root = roots.get(a.task.id)!
        const t = taskById.get(root.task)
        const fromGoal = (root.goal && goalTitle.get(root.goal)) || (t && str(t.goal_id) ? goalTitle.get(String(t.goal_id)) : null) || null
        const own = t ? (str(t.title) ?? str(t.brief_what)) : null
        const text = fromGoal ?? own ?? (root.task === a.task.id ? str(a.task.summary) : null)
        if (!text) return { ...a, goal: null }
        return {
          ...a,
          goal: {
            taskId: root.task,
            projectId: t ? String(t.project_id) : a.task.projectId,
            text,
            what: t ? str(t.brief_what) : null,
            byPerson: t?.origin_kind === 'person',
            isTask: root.task === a.task.id
          }
        }
      })
    }
  } catch (e) {
    // Recorded, and said on the reading: the goals stay unknown, never «not named».
    ops.failed('work.goals-unread', e)
    return { ...view, goalsUnread: e instanceof Error ? e.message : String(e) }
  }
}
// #endregion agent-goals
