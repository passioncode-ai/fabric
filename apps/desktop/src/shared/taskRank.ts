// #region task-rank — docs: docs/evidence/specs/2026-11-21-task-rank.md#3-the-order
// The order of a project's queue (ADR-0208): one pure function every reader shares, so the kanban, the backlog
// routine's brief and `fabric_work_list` cannot disagree about what comes first.
//
// Two inputs decide it. The owner's rank (`project_tasks.rank`, written only by the person's `task.ranked@1`) and the
// dependency links (`task_links`, rel `blocks` and `follows`). The owner moves; the links make his order workable: a
// task he put first that waits for another pulls that other one up with it.
//
// The walk is topological and driven by priority: a prerequisite in the queue always comes before what waits for it.
// Among the tasks that may come next, in this order:
//   1. ready before blocked (a task with an open prerequisite cannot be worked now);
//   2. the owner's rank, the task's own or inherited from anything that waits for it;
//   3. on the critical path (the longest chain of open tasks) before off it;
//   4. the longer chain behind it;
//   5. the more tasks it unblocks;
//   6. filed earlier.
// Only the queue is ordered. A task in work or in review keeps its place whatever the ranks say: it counts as an open
// prerequisite and never moves (the owner's rule: a nearly finished task is not switched away from).

/** A task still open: it can block what waits for it. */
const OPEN = new Set(['backlog', 'running', 'review'])

export interface RankTask {
  id: string
  status: string
  /** The owner's rank; null when he never placed it. Lower comes first. */
  rank: number | null
  /** Filing order (the journal's seq of its creation): lower was filed earlier. */
  filed: number
}

export interface RankLink {
  taskId: string
  rel: string
  /** Absent reads as a task. */
  targetKind?: string | null
  targetId: string
}

export interface Placed {
  id: string
  /** 1-based place in the queue. */
  place: number
  /** No open prerequisite: it can be taken now. */
  ready: boolean
  /** The open tasks it waits for, directly. */
  waitsFor: string[]
  /** How many open tasks wait for it, directly or through others. */
  unblocks: number
  /** On the longest chain of open tasks, when there is a chain at all. */
  critical: boolean
  /** The owner's own rank for this task. */
  rank: number | null
  /** Its place comes from the rank of a task that waits for it, not from its own. */
  inherited: boolean
}

/** `blocks`: taskId is the prerequisite of the target. `follows`: the target is the prerequisite of taskId. */
function edgeOf(l: RankLink): { before: string; after: string } | null {
  if (l.targetKind != null && l.targetKind !== 'task') return null
  if (l.taskId === l.targetId) return null
  if (l.rel === 'blocks') return { before: l.taskId, after: l.targetId }
  if (l.rel === 'follows') return { before: l.targetId, after: l.taskId }
  return null
}

/** The queue of one project in its order, with the reason for each place. `tasks` are the project's open tasks (and
 *  any linked ones whose status is known); only those in `backlog` are placed. A link to a task that is not listed, or
 *  is closed, blocks nothing. */
export function orderQueue(tasks: readonly RankTask[], links: readonly RankLink[]): Placed[] {
  const open = new Map<string, RankTask>()
  for (const t of tasks) if (OPEN.has(t.status)) open.set(t.id, t)
  const prereqs = new Map<string, Set<string>>()
  const dependents = new Map<string, Set<string>>()
  for (const id of open.keys()) { prereqs.set(id, new Set()); dependents.set(id, new Set()) }
  for (const l of links) {
    const e = edgeOf(l)
    if (!e || !open.has(e.before) || !open.has(e.after)) continue
    prereqs.get(e.after)!.add(e.before)
    dependents.get(e.before)!.add(e.after)
  }

  // Longest chain below and above each task. The write door refuses a cycle; one that reached the tables anyway is cut
  // where the walk meets it again, so the order is still an order.
  const longest = (next: Map<string, Set<string>>): Map<string, number> => {
    const memo = new Map<string, number>()
    const walking = new Set<string>()
    const walk = (id: string): number => {
      const known = memo.get(id)
      if (known !== undefined) return known
      if (walking.has(id)) return 0
      walking.add(id)
      let best = 0
      for (const n of next.get(id) ?? []) best = Math.max(best, walk(n))
      walking.delete(id)
      memo.set(id, best + 1)
      return best + 1
    }
    for (const id of open.keys()) walk(id)
    return memo
  }
  const down = longest(dependents)
  const up = longest(prereqs)
  let longestChain = 1
  for (const id of open.keys()) longestChain = Math.max(longestChain, down.get(id)! + up.get(id)! - 1)

  // Everything that waits for a task, through any number of steps; and the best rank among it and them.
  const reach = new Map<string, Set<string>>()
  const reachOf = (id: string, path: Set<string>): Set<string> => {
    const known = reach.get(id)
    if (known) return known
    const all = new Set<string>()
    if (path.has(id)) return all
    path.add(id)
    for (const d of dependents.get(id) ?? []) { all.add(d); for (const x of reachOf(d, path)) all.add(x) }
    path.delete(id)
    all.delete(id)
    reach.set(id, all)
    return all
  }
  const effective = (id: string): number => {
    let best = open.get(id)!.rank ?? Infinity
    for (const d of reachOf(id, new Set())) best = Math.min(best, open.get(d)!.rank ?? Infinity)
    return best
  }

  interface Row { t: RankTask; ready: boolean; eff: number; critical: boolean; down: number; unblocks: number }
  const rows = new Map<string, Row>()
  for (const t of open.values()) {
    if (t.status !== 'backlog') continue
    rows.set(t.id, {
      t,
      ready: prereqs.get(t.id)!.size === 0,
      eff: effective(t.id),
      critical: longestChain >= 2 && down.get(t.id)! + up.get(t.id)! - 1 === longestChain,
      down: down.get(t.id)!,
      unblocks: reachOf(t.id, new Set()).size
    })
  }
  const first = (a: Row, b: Row): number =>
    Number(b.ready) - Number(a.ready) ||
    (a.eff === b.eff ? 0 : a.eff < b.eff ? -1 : 1) ||
    Number(b.critical) - Number(a.critical) ||
    b.down - a.down ||
    b.unblocks - a.unblocks ||
    a.t.filed - b.t.filed ||
    (a.t.id < b.t.id ? -1 : a.t.id > b.t.id ? 1 : 0)

  // Kahn's walk with a priority pick: a task is free once every prerequisite still in the queue has been placed.
  const left = new Set(rows.keys())
  const waiting = new Map<string, number>()
  let free: string[] = []
  for (const id of left) {
    let n = 0
    for (const p of prereqs.get(id)!) if (left.has(p)) n++
    waiting.set(id, n)
    if (n === 0) free.push(id)
  }
  const out: Placed[] = []
  while (left.size) {
    // Only a cycle leaves tasks with nothing free: they are placed by the same keys, so each still gets one place.
    if (!free.length) { free = [...left]; for (const id of free) waiting.set(id, 0) }
    let at = 0
    for (let i = 1; i < free.length; i++) if (first(rows.get(free[i]!)!, rows.get(free[at]!)!) < 0) at = i
    const r = rows.get(free[at]!)!
    free.splice(at, 1)
    left.delete(r.t.id)
    for (const d of dependents.get(r.t.id)!) {
      if (!left.has(d)) continue
      const n = waiting.get(d)! - 1
      waiting.set(d, n)
      if (n === 0) free.push(d)
    }
    out.push({
      id: r.t.id, place: out.length + 1, ready: r.ready, waitsFor: [...prereqs.get(r.t.id)!].sort(), unblocks: r.unblocks,
      critical: r.critical, rank: r.t.rank, inherited: r.eff < (r.t.rank ?? Infinity)
    })
  }
  return out
}

export interface RankWrite { taskId: string; rank: number }

/** `n` values strictly between `lo` and `hi`, ascending; either bound may be infinite. */
function between(lo: number, hi: number, n: number): number[] {
  const out: number[] = []
  for (let j = 1; j <= n; j++) {
    if (Number.isFinite(lo) && Number.isFinite(hi)) out.push(lo + ((hi - lo) * j) / (n + 1))
    else if (Number.isFinite(hi)) out.push(hi - (n - j + 1))
    else if (Number.isFinite(lo)) out.push(lo + j)
    else out.push(j)
  }
  return out
}

/**
 * The ranks to write when the owner moves `movedId` to stand right after `afterId` (null: first) in the queue he sees.
 *
 * The list he arranged is the list he gets: every task above the drop point is pinned too, so an unranked one above
 * gets a rank of its own. A task whose rank already fits its new place is not written. When a gap has run out of
 * numbers the whole list is respaced. Null when either id is not in the queue.
 */
export function rankWrites(queue: ReadonlyArray<{ id: string; rank: number | null }>, movedId: string, afterId: string | null): RankWrite[] | null {
  const moved = queue.find((q) => q.id === movedId)
  if (!moved || afterId === movedId) return null
  const rest = queue.filter((q) => q.id !== movedId)
  const at = afterId === null ? 0 : rest.findIndex((q) => q.id === afterId) + 1
  if (afterId !== null && at === 0) return null
  const next = [...rest.slice(0, at), moved, ...rest.slice(at)]
  let floor = Infinity
  for (const q of next.slice(at + 1)) if (q.rank !== null) floor = Math.min(floor, q.rank)

  // Above and at the drop point: keep the ranks that already ascend below `floor`, fill the rest between them.
  const want: Array<number | null> = []
  let last = -Infinity
  for (let i = 0; i <= at; i++) {
    const r = next[i]!.rank
    if (r !== null && Number.isFinite(r) && r > last && r < floor) { want.push(r); last = r } else want.push(null)
  }
  let ok = true
  for (let i = 0; i <= at; ) {
    if (want[i] !== null) { i++; continue }
    let end = i
    while (end <= at && want[end] === null) end++
    const lo = i === 0 ? -Infinity : want[i - 1]!
    const hi = end <= at ? want[end]! : floor
    const values = between(lo, hi, end - i)
    let prev = lo
    for (const v of values) { if (!(v > prev && v < hi) || !Number.isFinite(v)) ok = false; prev = v }
    for (let j = i; j < end; j++) want[j] = values[j - i]!
    i = end
  }
  if (!ok)
    return next.map((q, i) => ({ taskId: q.id, rank: i + 1 })).filter((w, i) => next[i]!.rank !== w.rank)
  const writes: RankWrite[] = []
  for (let i = 0; i <= at; i++) if (next[i]!.rank !== want[i]) writes.push({ taskId: next[i]!.id, rank: want[i]! })
  return writes
}
// #endregion task-rank
