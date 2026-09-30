// What the project remembers, read as four stores (M135 · SCR-34).
//
// The stores exist and have since M44–M49; what has never existed is a surface
// that says what is IN them. An operator could not answer "does memory work
// here" except by asking an agent and believing the answer.
//
// THE MISSES ARE THE POINT. `memory_retrievals` records hits AND misses (M46),
// and a memory screen that shows only what it holds is exactly the screen that
// cannot answer the question. Measured on this machine while building it: 1112
// retrievals, 484 of them empty. That is not a fault — it is a list of things
// nobody has written down yet, and it is the most actionable thing here.
//
// A RATE WITH NO DENOMINATOR IS NOT ZERO. With nothing asked, the miss rate is
// UNKNOWN, not 0%. The same rule M57 applies to the status bar: a cell with no
// source is absent rather than zero, because a confident zero is a measurement
// and this would be an invention.

export interface StoreCount {
  /** How many rows, or null when the store could not be read (IMP-04). */
  rows: number | null
  /** Why it could not be read, in the database's own words. */
  problem: string | null
  /**
   * When this count was taken, or null when there is no count (UX28-07).
   *
   * THREE STATES, not two. `rows: n` is a measurement; `rows: null` WITH a
   * problem is a refusal; `rows: null` with NO problem is a store nobody has
   * asked about yet — `memoryOverviewRead.ts#NEVER_READ`. An operator asking
   * "does memory work here" needs a different sentence for each, and the count
   * carried only the first two.
   *
   * And the timestamp is the card's own negative acceptance: a stale source
   * cannot present a current count. "42 facts" with no age was as old as
   * whenever it was read and read as now.
   */
  asOf: string | null
}

export interface MemoryOverview {
  facts: StoreCount
  /** Corrected facts. Kept and readable — never deleted (M48). */
  superseded: StoreCount
  retrievals: StoreCount
  misses: StoreCount
  transcripts: StoreCount
  packs: StoreCount
}

export type MissRate =
  | { known: true; percent: number; of: number }
  /** Nothing was asked, or the store could not be read. Two different reasons
   *  to have no rate, and neither of them is zero. */
  | { known: false; because: 'never-asked' | 'unreadable' }

export function missRate(retrievals: StoreCount, misses: StoreCount): MissRate {
  if (retrievals.rows === null || misses.rows === null)
    return { known: false, because: 'unreadable' }
  if (retrievals.rows === 0) return { known: false, because: 'never-asked' }

  return {
    known: true,
    percent: Math.round((misses.rows / retrievals.rows) * 100),
    of: retrievals.rows
  }
}

/**
 * True when EVERY store answered. Shown so the screen can say it is partial
 * rather than quietly showing fewer stores than it has.
 *
 * ANSWERED means it produced a number — not merely that it produced no
 * complaint. This asked `problem === null`, which was right while there were
 * two states and wrong the moment there were three: a store nobody has asked
 * about has no problem to report, so a never-read overview called itself whole
 * (UX28-07). The screen would then say the reading is complete about stores it
 * had never looked at.
 */
export function fullyRead(overview: MemoryOverview): boolean {
  return Object.values(overview).every((s: StoreCount) => s.problem === null && s.rows !== null)
}
