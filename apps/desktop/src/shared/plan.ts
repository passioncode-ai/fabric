// Grouping tasks under goals (M146 step 7).
//
// THE INVARIANT THIS FILE EXISTS FOR: every task the plan is given comes out
// exactly once — under a goal, or in the unattached list. Not "usually", and
// not "unless its goal was deleted". A grouping that can silently drop a row is
// the most dangerous kind of view, because a board that shows less than there
// is looks exactly like a project with less to do.
//
// So the unattached list is not a leftover bucket, it is the POINT: work nobody
// has connected to a direction is the most useful thing on a planning surface,
// and hiding it is how a backlog becomes a place things go to be forgotten.

export interface GoalRow {
  id: string
  project_id: string
  title: string
  autonomy: 'safe' | 'guarded' | 'maximum'
  created_at: string
}

export interface Positioned {
  id: string
  goal_id: string | null
  position: number | null
}

export interface Plan<T extends Positioned> {
  goals: { goal: GoalRow; tasks: T[] }[]
  /** Tasks under no goal — named, never hidden. */
  unattached: T[]
}

export function planOf<T extends Positioned>(goals: readonly GoalRow[], tasks: readonly T[]): Plan<T> {
  const known = new Set(goals.map((g) => g.id))
  const byGoal = new Map<string, T[]>()
  const unattached: T[] = []
  for (const task of tasks) {
    // A task pointing at a goal that no longer exists is UNATTACHED, not
    // invisible. The alternative — keeping it under a goal nobody can see — is
    // how a row disappears from a surface while still existing in the database.
    if (task.goal_id !== null && known.has(task.goal_id)) {
      const list = byGoal.get(task.goal_id)
      if (list) list.push(task)
      else byGoal.set(task.goal_id, [task])
    } else {
      unattached.push(task)
    }
  }
  const ordered = (list: T[]): T[] =>
    [...list].sort((a, b) => {
      // A task with no position sorts after every task that has one, rather
      // than at zero: an unordered task is unranked, not first.
      if (a.position === null && b.position === null) return 0
      if (a.position === null) return 1
      if (b.position === null) return -1
      return a.position - b.position
    })
  return {
    goals: goals.map((goal) => ({ goal, tasks: ordered(byGoal.get(goal.id) ?? []) })),
    unattached
  }
}
