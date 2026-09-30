/**
 * The whole question the facts panel asks, in one value (UX28-02).
 *
 * This exists because of the shape of the defect it closes, not because the
 * panel needed a type. The panel fenced its read on the search STRING:
 *
 *     latestQuery.current = q
 *     …
 *     if (latestQuery.current === q) setFacts(found)
 *
 * Change the category and leave the text alone and both requests carry the same
 * `q`. Both pass the fence. Whichever the database answers last is rendered —
 * including the answer for the category the operator has already left. Same for
 * `showSuperseded`, and same across two projects both asking with an empty box.
 *
 * The fix is not a longer comparison written by hand at the call site: it is
 * having ONE value that is the question, so the subject and the request are
 * derived from the same thing. A field added to this interface and forgotten in
 * `factsSubject` is caught by this module's own test, which walks the keys
 * rather than listing them.
 */

import { subjectOf } from './keyedRead'
import type { InsightCategory } from './memoryContract.ts'

export interface FactsQuery {
  projectId: string
  /** What the operator typed. Empty is a real query — "everything". */
  query: string
  showSuperseded: boolean
  /** Null is "every category", which is different from any single one. */
  category: InsightCategory | null
}

/**
 * The keys that make two facts queries different questions.
 *
 * Written down as data so the test can walk them: a fifth filter added to
 * `FactsQuery` and left out of here fails a test that compares this list
 * against the interface, rather than passing quietly and taking the fence with
 * it.
 */
export const FACTS_QUERY_KEYS: readonly (keyof FactsQuery)[] = [
  'projectId',
  'query',
  'showSuperseded',
  'category'
]

/** The subject a facts reading is about. Length-prefixed, so no two questions collide. */
export function factsSubject(q: FactsQuery): string {
  return subjectOf(FACTS_QUERY_KEYS.map((k) => q[k]))
}
