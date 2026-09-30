// How long this estate has been running, and what it has done (M131 · SCR-36).
//
// The operator asked for a manager with a portrait, a name, a length of service
// and a count of projects delivered. Three of those four are IN THE RECORD
// already: the estate knows when it started, what it holds and what has passed
// through it. The portrait and the name are not data — one needs an image
// nobody has generated, the other is a decision about the product's own
// character, and inventing either would be the surface asserting something
// nobody chose.
//
// So this file owns the part that is measured, and the surface leaves the rest
// visibly empty with what it would take.
//
// NOTHING RECORDED IS NOT ZERO DAYS. An estate with no events has not started;
// one whose first event is today has. Reporting the first as "0 days" makes an
// unstarted estate look like a new one, which is the same family of lie as a
// miss rate with no denominator.

export type Tenure =
  | { known: true; days: number; since: string }
  | { known: false; because: 'nothing-recorded' }

export function tenureFrom(firstEventAt: string | null, now: Date): Tenure {
  if (!firstEventAt) return { known: false, because: 'nothing-recorded' }
  const started = Date.parse(firstEventAt)
  if (Number.isNaN(started)) return { known: false, because: 'nothing-recorded' }
  // Whole days, and never negative: a clock that disagrees with the database
  // must not produce an estate that started tomorrow.
  const days = Math.max(0, Math.floor((now.getTime() - started) / 86_400_000))
  return { known: true, days, since: firstEventAt }
}
