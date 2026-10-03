// #region memory-overview-read — docs: docs/ux/screens.md#scr-34-project-memory
/**
 * Counting the four stores, through the one place scope is enforced (UX28-07).
 *
 * Extracted from the IPC handler for the third time in this shape, after
 * `digestRead.ts` and `harnessRead.ts`: a decision inside a handler cannot be
 * driven without standing up an Electron process, and these eight lines held
 * three decisions.
 *
 * WHAT WAS WRONG, and the first one is the reason this file exists:
 *
 *  * **The counts used the RAW client.** `db.from(table)` with a hand-written
 *    `.eq('project_id', projectId)`, where every other read in the process goes
 *    through `store.select(...)` and gets `scopeFilters` applied — an
 *    `estate_id` filter on every scoped table. That filter is what turns an id
 *    from somewhere else into "no such project"; `scope.ts` says exactly that
 *    in its own words. Without it the counts answer for whatever project id
 *    arrives. The rows are still one project's, so nothing from two estates is
 *    summed — the leak is narrower and worse-shaped: it is an answer about a
 *    project this scope was never entitled to read.
 *  * **`result.count ?? 0`.** A null count with no error became zero. Sixth
 *    appearance of the family and its narrowest form, since the error path IS
 *    checked — it fires only when PostgREST answers without a count header.
 *    Still a number nobody measured.
 *  * **No `asOf`.** "42 facts" was as old as whenever it was read and read as
 *    current. The card's negative acceptance names it: a stale source cannot
 *    present a current count.
 *
 * And the third state: NEVER READ is not read-and-empty, and `StoreCount` could
 * express only two of the three.
 */

import type { MemoryOverview, StoreCount } from '../shared/memoryOverview.ts'
import type { ScopedStore } from './scopedStore.ts'

/**
 * The count of a store nobody has asked about yet.
 *
 * No rows, NO problem, no timestamp — and the missing problem is what
 * distinguishes it from a refusal. A surface showing this must say "not read",
 * which is a different sentence from "empty" and from "could not be read", and
 * an operator asking whether memory works here needs all three.
 */
export const NEVER_READ: StoreCount = { rows: null, problem: null, asOf: null }

/**
 * Just the filters these counts use, and it is a local shape on purpose.
 *
 * `ReturnType<ScopedStore['select']>` was tried and costs a `TS2589`: the
 * PostgREST builder's generics are deep enough that naming the whole type here
 * cannot be instantiated. This names the three methods used and nothing else,
 * which is also the more honest declaration — a count narrows, it does not
 * select.
 */
interface CountQuery {
  eq(column: string, value: unknown): CountQuery
  is(column: string, value: unknown): CountQuery
  not(column: string, operator: string, value: unknown): CountQuery
}

/** One count, with its refusal or its absence kept rather than defaulted. */
async function countOf(
  store: ScopedStore,
  table: string,
  /** A column the table HAS — its key. Two of the six key on `session_id`, and counting them by `id`
   *  was refused by the database on every read (release review 2026-10-03: every project's memory
   *  panel said "not the whole picture"). `read-schema-db.test.mjs` checks each pair. */
  key: string,
  narrow: (q: CountQuery) => CountQuery,
  now: string
): Promise<StoreCount> {
  const query = store.select(table, key, { count: 'exact', head: true }) as unknown as CountQuery
  const result = (await (narrow(query) as unknown as Promise<{
    count: number | null
    error: { message: string } | null
  }>)) ?? { count: null, error: null }
  if (result.error) return { rows: null, problem: result.error.message, asOf: null }
  // NOT `?? 0`. A read that came back without a number did not answer, and the
  // most reassuring thing this panel can say about a memory store is that it is
  // empty — which is exactly why the unmeasured case must not borrow that word.
  if (typeof result.count !== 'number')
    return {
      rows: null,
      problem: 'the store answered without a count, so there is no number to show',
      asOf: null
    }
  return { rows: result.count, problem: null, asOf: now }
}

/**
 * What the project remembers, as six counts.
 *
 * `now` is passed rather than read so the caller owns the clock — the same
 * reason `digestFor` takes it, and what makes this drivable.
 */
export async function memoryOverviewFor(
  store: ScopedStore,
  projectId: string,
  now: string
): Promise<MemoryOverview> {
  const [facts, superseded, retrievals, misses, transcripts, packs] = await Promise.all([
    // Only what is currently true (M48). A corrected fact is kept and readable,
    // and counting it as current is what bi-temporality exists to prevent.
    countOf(store, 'memory_facts', 'id', (q) => q.eq('project_id', projectId).is('valid_to', null), now),
    countOf(store, 'memory_facts', 'id', (q) => q.eq('project_id', projectId).not('valid_to', 'is', null), now),
    countOf(store, 'memory_retrievals', 'id', (q) => q.eq('project_id', projectId), now),
    // THE MISSES ARE THE POINT (M46): a memory screen showing only what it
    // holds is the screen that cannot answer "does memory work here".
    countOf(store, 'memory_retrievals', 'id', (q) => q.eq('project_id', projectId).eq('hits', 0), now),
    countOf(store, 'session_transcripts', 'session_id', (q) => q.eq('project_id', projectId), now),
    countOf(store, 'session_context_packs', 'session_id', (q) => q.eq('project_id', projectId), now)
  ])
  return { facts, superseded, retrievals, misses, transcripts, packs }
}
// #endregion memory-overview-read
