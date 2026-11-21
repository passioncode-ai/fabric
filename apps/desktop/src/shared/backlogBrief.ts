// The routine that works the backlog (M132).
//
// This is not a new mechanism. A routine already runs work on a schedule with
// the quota gate in front of it and the loop bound behind it; what M132 adds is
// a routine whose instruction is composed AT FIRE TIME from the backlog, rather
// than typed once and repeated.
//
// TWO RULES, and the first is the one that costs money if it is wrong.
//
// 1. A SCHEDULED RUN WITH NOTHING TO DO DOES NOT START. An empty backlog means
//    no session: starting one burns quota and produces a transcript saying there
//    was nothing to do, every night, for as long as the routine exists. It is
//    M121's rule one level up — an offer that cannot be honoured is worse than
//    no offer — and the refusal is journalled as a pause, so the automations
//    surface says "did not run: the backlog is empty" rather than going quiet.
//
// 2. PRIORITY ORDER IS THE ORDER THE OPERATOR SET. `position` is a field
//    precisely so two surfaces cannot disagree about it, and an agent that works
//    the backlog in arrival order is one whose choices the operator cannot
//    predict or correct. A task with no position sorts after every task that has
//    one — unplaced is not "first", and it is not "urgent" either.

// 3. THE BOARD'S ORDER COMES FIRST (ADR-0208). When the queue's order was read (`main/taskOrderRead.ts`), the brief
//    follows it: the owner's places, then what other work waits for, the critical path first. A task that waits for
//    another is named as waiting, so the agent does not start it before its prerequisite. `position` (order inside a
//    goal) is the fallback for a night the order could not be read, and the brief then says so.

export interface BacklogItem {
  id: string
  title: string | null
  instruction: string
  /** The operator's order. Null means nobody has placed it. */
  position: number | null
  goalId: string | null
}

/** A queued task's place on the board and how many open tasks it waits for (`shared/taskRank.ts#orderQueue`). */
export type BoardPlaces = ReadonlyMap<string, { place: number; waitsFor: readonly string[] }>

/** How many the brief names. The rest are counted, never silently dropped. */
export const BRIEF_MAX = 12

/** Priority order: placed tasks by position, then the unplaced, oldest first as
 *  they arrive. Stable, because the same backlog must brief the same way twice. */
export function inPriorityOrder(items: readonly BacklogItem[]): BacklogItem[] {
  return [...items].sort((a, b) => {
    if (a.position === null && b.position === null) return 0
    if (a.position === null) return 1
    if (b.position === null) return -1
    return a.position - b.position
  })
}

/** The board's order: by place; a task the order did not reach comes after the placed ones, in `inPriorityOrder`. */
export function inBoardOrder(items: readonly BacklogItem[], places: BoardPlaces): BacklogItem[] {
  return inPriorityOrder(items)
    .map((item, at) => ({ item, at, place: places.get(item.id)?.place ?? Infinity }))
    .sort((a, b) => (a.place === b.place ? a.at - b.at : a.place < b.place ? -1 : 1))
    .map((x) => x.item)
}

/**
 * What the agent is told, or NULL when there is nothing to do.
 *
 * Null is the whole point: the caller must not start a session for it. `places` is the board's order when it was read;
 * null says the read failed (the brief says so and falls back); absent is a caller from before ADR-0208.
 */
export function backlogBrief(items: readonly BacklogItem[], places?: BoardPlaces | null): string | null {
  const ordered = places ? inBoardOrder(items, places) : inPriorityOrder(items)
  if (ordered.length === 0) return null

  const shown = ordered.slice(0, BRIEF_MAX)
  const lines = shown.map((i, n) => {
    const waits = places?.get(i.id)?.waitsFor.length ?? 0
    return `${n + 1}. ${(i.title?.trim() || i.instruction).slice(0, 120)}${waits ? ` (waits for ${waits} other open task${waits === 1 ? '' : 's'}: not startable yet)` : ''}`
  })
  if (ordered.length > shown.length)
    lines.push(
      `…and ${ordered.length - shown.length} more below these; ask Fabric for the rest rather than assuming this is all of it`
    )

  return [
    places
      ? `Work this project's backlog, in the order given. It is ${ordered.length} tasks in the board's order: the owner's places first, then what other work waits for, the longest chain first. It is not yours to re-rank.`
      : `Work this project's backlog, in the order given. It is ${ordered.length} tasks and this is the operator's priority order, not yours to re-rank.`,
    ...(places === null ? [`The board's order could not be read for this run, so this is the older order inside goals; a task may wait for another without saying so here.`] : []),
    ``,
    lines.join('\n'),
    ``,
    `Take ONE at a time: claim it with fabric_task_claim before you touch anything, and release it when you are done. If you finish it, move it to review and say what you concluded — you cannot close it yourself, and that is deliberate.`,
    ...(places ? [``, `A task marked as waiting cannot start until what it waits for is done: take the next one instead.`] : []),
    ``,
    `If a task turns out to be wrong, blocked or already done, say so and move on rather than inventing work for it. Getting three tasks right and reporting honestly on a fourth is a better night than four tasks half-done.`
  ].join('\n')
}
