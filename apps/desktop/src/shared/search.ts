// One field, several stores (M141 · SCR-37).
//
// WHY THE RESULTS ARE GROUPED AND NOT MERGED. `memory_facts` and
// `session_transcripts` carry a tsvector with a GIN index and are matched by WORDS;
// `projects` and `project_tasks` have no such index and are matched by substring.
// Every store returns its newest matches — nothing is ranked by relevance (release
// review 2026-10-03). Merging them into one list would imply one ordering across
// different matchers, and the reader would take the top of that list as the best
// answer. Grouped, each store says how it
// was searched and the reader knows what kind of promise each result is.
//
// AND DECISIONS ARE A SUBSET OF FACTS, which is why adding them is not simply
// one more query. A decision is a `memory_facts` row with `kind = 'decision'`,
// and the product treats it as a register of its own: its own surface, its own
// lineage, its own cap. A decisions group beside an unnarrowed facts group
// would return one row twice under two headings, and a reader counting "found"
// would count it twice. So `facts` means "remembered and not a decision" —
// which is what grouping BY NATURE requires once the natures are named.
//
// AND A STORE THAT DID NOT ANSWER IS NOT A STORE WITH NOTHING IN IT. The total
// excludes it, and "nothing matches" cannot be said at all while one store is
// silent — the same rule the memory screen applies to its counts, at the level
// of a whole search. It is the difference between "we looked everywhere and
// found nothing" and "we looked in two of three places".

import { coverageOfList } from './planProgress.ts'
import type { EntityKind } from './entityRef.ts'

/**
 * The stores this field searches, declared as data (UX28-09).
 *
 * SCN-048 step 1 has named five since it was written — "projects, tasks, memory
 * facts, transcripts, decisions" — and the code searched three. So a project's
 * own title and a recorded decision were unfindable from the field the scenario
 * calls "one door to everything", while step 4's promise to name the stores
 * that WERE searched stayed truthful about a door two stores narrower than the
 * product behind it.
 *
 * A list rather than a union alone, because the searched-stores sentence and
 * the queries must be the same set: a store added to one and not the other is
 * either a promise nobody keeps or a result nobody accounts for.
 */
export const SEARCH_STORES = ['projects', 'tasks', 'facts', 'decisions', 'transcripts'] as const

export type SearchStore = (typeof SEARCH_STORES)[number]

/** How many rows each store returns at most. ONE constant, used by the query
 *  and by the sentence that declares the cut, so the two cannot drift. */
export const SEARCH_CAP = 20

/** What a hit in each store IS. A hit carries the id of a thing, and the store
 *  is the only place that knows which kind of thing. */
export const SEARCH_SUBJECT: Record<SearchStore, EntityKind> = {
  // The first hit in this search that can open EXACTLY: `destinationOf`
  // resolves a fact or a transcript to its PROJECT, because no surface can
  // focus one of either (CO-148). A project is a project.
  projects: 'project',
  tasks: 'task',
  facts: 'fact',
  // A decision IS a memory fact — `memory_facts` with `kind = 'decision'` —
  // so its hit is a fact, and `ENTITY_KINDS` has no separate `decision`. The
  // GROUP is its own because the product treats the register as its own; the
  // KIND is what the row actually is.
  decisions: 'fact',
  transcripts: 'transcript'
}

export interface SearchHit {
  id: string
  projectId: string
  projectName: string | null
  text: string
  at: string | null
}

export interface SearchGroup {
  store: SearchStore
  /** How this store was searched. Shown, because a word match (stemmed full-text, `words`) and a
   *  substring match are different promises about what "found" means. Neither is a relevance rank:
   *  every store returns its newest matches. */
  method: 'words' | 'substring'
  hits: SearchHit[]
  /** Why it could not be searched, when it could not. */
  problem: string | null
  /**
   * WAS THIS STORE CUT OFF.
   *
   * Measured before this existed: every store was queried with `.limit(20)` and
   * the group said nothing about it, so a search for a common word returned
   * sixty rows and the panel reported "60 found" with `partial: false` — a
   * completeness claim, made by a list that had been cut three times. `problem`
   * only ever meant "this store REFUSED"; a store that answered with a fraction
   * of what it holds is not a store that answered.
   */
  coverage: { truncated: boolean | 'unknown'; says: string }
  /**
   * Why the project LABELS are missing, when they are.
   *
   * Its own channel rather than `problem`, and the distinction is the whole
   * point: the store answered and the hits are real; only the column that says
   * which project they came from is unavailable. Folding this into `problem`
   * would hide sixty genuine hits behind an error, which is the same class of
   * lie as showing them with a blank column — the previous behaviour, where the
   * read was destructured past its error and nobody was told anything.
   */
  labelProblem: string | null
}

/** The coverage of one store's answer, from its row count alone. `available` is
 *  known exactly below the cap — a capped query that returned fewer rows than
 *  the cap returned all of them — and unknown at it. */
export function coverageOfStore(returned: number): SearchGroup['coverage'] {
  return coverageOfList({
    returned,
    available: returned < SEARCH_CAP ? returned : null,
    cap: SEARCH_CAP
  })
}

export type SearchOutcome =
  | { state: 'found'; total: number; partial: boolean }
  /** Every store answered and none matched — the only case where "nothing"
   *  is a fact rather than a guess. */
  | { state: 'nothing' }
  /** Nothing matched in the stores that DID answer, and at least one did not. */
  | { state: 'inconclusive'; silent: SearchStore[] }

export function outcomeOf(groups: readonly SearchGroup[]): SearchOutcome {
  const silent = groups.filter((g) => g.problem !== null).map((g) => g.store)
  // Only what was actually read is counted. A failed store contributing zero
  // would make the total a measurement of our luck rather than of the estate.
  const total = groups
    .filter((g) => g.problem === null)
    .reduce((sum, g) => sum + g.hits.length, 0)
  // PARTIAL MEANS INCOMPLETE, not merely refused. A store that was cut off at
  // the cap makes the total a floor, exactly as a store that stayed silent does.
  const cut = groups.some((g) => g.problem === null && g.coverage.truncated !== false)
  if (total > 0) return { state: 'found', total, partial: silent.length > 0 || cut }
  // "Nothing matches" needs every store to have answered. A truncated store
  // contributed no hits and cannot have hidden any — a cut list with zero rows
  // is an empty list — so truncation does not block the claim here.
  return silent.length === 0 ? { state: 'nothing' } : { state: 'inconclusive', silent }
}
