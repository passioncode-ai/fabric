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

export interface BacklogItem {
  id: string
  title: string | null
  instruction: string
  /** The operator's order. Null means nobody has placed it. */
  position: number | null
  goalId: string | null
}

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

/**
 * What the agent is told, or NULL when there is nothing to do.
 *
 * Null is the whole point: the caller must not start a session for it.
 */
export function backlogBrief(items: readonly BacklogItem[]): string | null {
  const ordered = inPriorityOrder(items)
  if (ordered.length === 0) return null

  const shown = ordered.slice(0, BRIEF_MAX)
  const lines = shown.map((i, n) => `${n + 1}. ${(i.title?.trim() || i.instruction).slice(0, 120)}`)
  if (ordered.length > shown.length)
    lines.push(
      `…and ${ordered.length - shown.length} more below these; ask Fabric for the rest rather than assuming this is all of it`
    )

  return [
    `Work this project's backlog, in the order given. It is ${ordered.length} tasks and this is the operator's priority order, not yours to re-rank.`,
    ``,
    lines.join('\n'),
    ``,
    `Take ONE at a time: claim it with fabric_task_claim before you touch anything, and release it when you are done. If you finish it, move it to review and say what you concluded — you cannot close it yourself, and that is deliberate.`,
    ``,
    `If a task turns out to be wrong, blocked or already done, say so and move on rather than inventing work for it. Getting three tasks right and reporting honestly on a fourth is a better night than four tasks half-done.`
  ].join('\n')
}
