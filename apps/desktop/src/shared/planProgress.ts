// How far along a goal is, and whether the number can be trusted (M190).
//
// TWO MEASURED DEFECTS, and they compound.
//
//   `IPC.tasksList` caps closed tasks at TWENTY and says nothing. It returns a
//   flat array of open plus closed, so a consumer counting it counts a
//   truncated set as the whole. A project with two hundred finished tasks hands
//   the renderer twenty and no indication that it did.
//
//   `PlanSection` renders `under.length` — the number of OPEN tasks under a
//   goal — as a bare figure beside the goal's title. A goal with three open and
//   forty done reads "3". There is no denominator, so "how far along is this"
//   has no answer, and the number shown looks like an amount of work rather
//   than a remainder.
//
// A TRUNCATED SOURCE NEVER BECOMES A TOTAL. ADR-0042's own rule for these
// screens is that nodes are not silently removed; a count computed from a
// capped read is exactly that removal, arithmetic instead of a missing row.
//
// AND NOTHING PLANNED IS NOT ZERO PER CENT. A goal with no tasks at all has not
// started badly — nobody has said what it involves. A progress bar at 0% says
// the first; the difference is what an operator does next.

export interface GoalTally {
  goalId: string
  /** Tasks that are still to do. */
  open: number
  /** Tasks that are finished — and this is the half that was missing. */
  closed: number
  /** True when the closed side came from a capped read, so the total below is
   *  a FLOOR rather than a count. */
  closedTruncated: boolean
}

export type ProgressKind =
  /** Nothing has been planned under this goal at all. */
  | 'nothing_planned'
  /** A real fraction. */
  | 'measured'
  /** The closed side was truncated: the fraction is a lower bound on the work
   *  done, and the surface must say so rather than draw a bar. */
  | 'at_least'
  /** Everything under it is finished. */
  | 'complete'

export interface GoalProgress {
  kind: ProgressKind
  done: number
  total: number
  says: string
}

export function goalProgress(tally: GoalTally): GoalProgress {
  const total = tally.open + tally.closed
  if (total === 0)
    return {
      kind: 'nothing_planned',
      done: 0,
      total: 0,
      // NOT zero per cent. A goal with nothing under it has not started badly;
      // nobody has said what it involves, and those need different next acts.
      says: 'nothing planned under this goal yet'
    }
  if (tally.closedTruncated)
    return {
      kind: 'at_least',
      done: tally.closed,
      total,
      says: `at least ${tally.closed} of ${total} done — the finished list was cut short, so both numbers are floors`
    }
  if (tally.open === 0) return { kind: 'complete', done: tally.closed, total, says: `all ${total} done` }
  return { kind: 'measured', done: tally.closed, total, says: `${tally.closed} of ${total} done` }
}

/** May a progress bar be drawn from this? Only for a fraction that is one. */
export function drawable(progress: GoalProgress): boolean {
  return progress.kind === 'measured' || progress.kind === 'complete'
}

export interface ListCoverage {
  /** How many rows came back. */
  returned: number
  /** How many exist, when that is known. Null when nobody counted. */
  available: number | null
  cap: number
}

/**
 * Was this list cut short, and does it know?
 *
 * `available === null` is NOT "nothing was cut". It is "nobody counted", and
 * reporting it as complete is how a capped read becomes a total one screen
 * along.
 */
export function coverageOfList(input: ListCoverage): {
  truncated: boolean | 'unknown'
  says: string
} {
  if (input.available === null)
    return {
      truncated: input.returned >= input.cap ? true : 'unknown',
      says:
        input.returned >= input.cap
          ? `this list stops at ${input.cap}; there may be more`
          : 'nobody counted how many there are, so this may or may not be all of them'
    }
  return input.available > input.returned
    ? { truncated: true, says: `showing ${input.returned} of ${input.available}` }
    : { truncated: false, says: `all ${input.available}` }
}
