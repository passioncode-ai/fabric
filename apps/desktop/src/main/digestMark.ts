// Where the operator last left each project (M133).
//
// OPERATOR-LOCAL, NOT ESTATE TRUTH, and therefore not journalled — the same
// reasoning that kept CEO threads out of the record. "Which projects has this
// person already looked at" is a fact about a person at a desk, and putting it
// in the estate's history would mean the record grows every time somebody
// glances at a screen.
//
// A file of its own rather than a field on settings: settings are things the
// operator CHOSE, and this is something the application observed. Mixing them
// would make a settings file that changes when nobody changed anything.
//
// The reading and writing moved to `localStore` when favourites became the
// second file of this shape (M120). Two copies of "tolerate a missing file,
// never let a failed read look like an empty answer" is a pair that drifts.

import { localStore } from './localStore.ts'

type Marks = Record<string, number>

const store = localStore<Marks>('digest-marks.json', {}, (parsed) =>
  parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) &&
  Object.values(parsed as Record<string, unknown>).every((v) => typeof v === 'number')
    ? (parsed as Marks)
    : null
)

/** Null when this project has never been left — a FIRST visit, which the digest
 *  reports differently from "nothing happened". */
export function markFor(projectId: string): number | null {
  return store.read().value[projectId] ?? null
}

export function setMark(projectId: string, seq: number): void {
  // Read-modify-write at the revision that was read, so two windows leaving two
  // projects at once cannot drop one of the marks.
  store.update((marks) => {
    // Never backwards: a stale renderer reporting an older seq must not make
    // things the operator has already seen reappear.
    if ((marks[projectId] ?? -1) >= seq) return marks
    return { ...marks, [projectId]: seq }
  })
}
