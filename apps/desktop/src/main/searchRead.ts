/**
 * One field, five stores (M141 · SCR-37, completed by UX28-09).
 *
 * Extracted from the IPC handler for the fourth time in this shape, after
 * `digestRead.ts`, `harnessRead.ts` and `memoryOverviewRead.ts`. Here the
 * reason is not only testability: the handler held five queries and their five
 * groups inline, and two more stores would have made it the longest function in
 * the process — with the one property that matters, that the searched set and
 * the declared set are the same, spread across forty lines nobody can check.
 *
 * WHAT WAS MISSING. SCN-048 step 1 has named five stores since it was written —
 * "projects, tasks, memory facts, transcripts, decisions" — and three were
 * searched. A project's own title and a recorded decision were unfindable from
 * the field the scenario calls "one door to everything". Step 4's promise, that
 * an empty result names which stores were searched so "nobody wrote it down"
 * stays distinguishable from "not searched", was kept truthfully about a door
 * two stores narrower than the product behind it.
 *
 * SIXTH CARD RUNNING where the scenario was right and the code was not.
 *
 * AND NO QUERY HERE WRITES AN ESTATE FILTER. `createScopedStore.select` applies
 * `scopeFilters` — `estate_id` on every one of these tables — and the handler
 * used to write `.eq('estate_id', ORG1)` on top of it. Measured by planting the
 * removal of one: nothing changed, because the store had already added it. A
 * duplicated guard reads as the thing that protects you, and the day the two
 * disagree it is the hand-written one that is believed. The store is the single
 * place, exactly as `memoryOverviewRead.ts` established for the memory counts.
 */

import {
  SEARCH_CAP,
  coverageOfStore,
  type SearchGroup,
  type SearchHit,
  type SearchStore
} from '../shared/search.ts'
import type { ScopedStore } from './scopedStore.ts'

/** A read that came back with rows, or with a reason it did not. */
interface Read {
  data: Record<string, unknown>[] | null
  error: { message: string } | null
}

/** The columns each store's hit is built from. */
interface Shape {
  id: string
  text: string
  at: string
  project: string
}

/**
 * Wrap one store's read as a group.
 *
 * `labelProblem` is separate from `problem` and stays separate: the store
 * answered and the hits are real, and only the column saying which project
 * they came from is missing. Folding them together would hide genuine hits
 * behind an error.
 */
function groupOf(input: {
  store: SearchStore
  method: SearchGroup['method']
  read: Read
  shape: Shape
  named: (projectId: string) => string | null
  labelProblem: string | null
}): SearchGroup {
  const rows = input.read.data ?? []
  const hits: SearchHit[] = rows.map((r) => {
    const projectId = String(r[input.shape.project] ?? '')
    return {
      id: String(r[input.shape.id]),
      projectId,
      projectName: input.named(projectId),
      text: String(r[input.shape.text] ?? ''),
      at: typeof r[input.shape.at] === 'string' ? r[input.shape.at] as string : null
    }
  })
  return {
    store: input.store,
    method: input.method,
    coverage: coverageOfStore(hits.length),
    problem: input.read.error?.message ?? null,
    labelProblem: input.labelProblem,
    hits
  }
}

/**
 * A substring match on several columns, as ONE `or()` the gateway cannot misread.
 *
 * The text was interpolated: `or(name.ilike.%TEXT%,…)`. Inside `or()` the
 * characters `,` `.` `:` `(` `)` are PostgREST's own grammar, so a query as
 * ordinary as "auth, billing" split into a malformed second term and the whole
 * group came back refused — and `x%,id.not.is.null` appended a disjunct of the
 * caller's choosing (still inside the estate, because the scope is ANDed
 * outside the `or()`, but no longer the search that was asked). Release review
 * 2026-10-03.
 *
 * Two escapes, in this order. The PATTERN first, then the value is double-quoted,
 * which is PostgREST's documented way to carry reserved characters, with `"` and
 * `\` escaped by a backslash.
 *
 * THE PATTERN IS A REGULAR EXPRESSION, NOT A LIKE (release review iteration 3,
 * harness finding 4). It was `ilike` with `%`, `_` and `\` escaped, and `*` left
 * alone because PostgREST rewrites `*` to `%` in a LIKE value and documents no
 * escape for it — "a `*` widens the match". MEASURED on the disposable stack by
 * `apps/desktop/test/gateway-reads.test.mjs`: a search for `*` returned EVERY
 * project of the estate. `imatch` (`~*`, case-insensitive POSIX regex) has no
 * such rewrite, so every regex metacharacter is escaped with a backslash and the
 * pattern means exactly the text, anywhere in the value: "50%_off" matches only
 * "50%_off", `*` only a `*`. Case folding is the database's, as it was for `ilike`.
 */
export function substringFilter(columns: readonly string[], text: string): string {
  const pattern = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const quoted = `"${pattern.replace(/["\\]/g, '\\$&')}"`
  return columns.map((c) => `${c}.imatch.${quoted}`).join(',')
}

/**
 * Search every declared store.
 *
 * The groups come back in `SEARCH_STORES` order, so the surface's headings and
 * the searched-stores sentence read in one order and cannot disagree about
 * which stores exist.
 */
// #region search-read — docs: docs/ux/scenarios.md#scn-048-find-anything-the-estate-holds-from-one-field
export async function searchFor(store: ScopedStore, query: string): Promise<SearchGroup[]> {
  const text = query?.trim()
  if (!text) return []

  // NEWEST FIRST, in every store (M141, release review 2026-10-03). The word stores were labelled
  // "ranked" while nothing ordered them by rank, so a capped group was an arbitrary subset. Each store
  // now returns its newest matches, and a cut group says so (`truncated`).
  const [projects, tasks, facts, decisions, transcripts] = (await Promise.all([
    // Substring, because `projects` carries no tsvector. The method travels
    // with the group so the reader knows what kind of promise "found" is.
    store
      .select('projects', 'id,name,purpose,created_at')
      .or(substringFilter(['name', 'purpose'], text))
      .order('created_at', { ascending: false })
      .limit(SEARCH_CAP),
    store
      .select('project_tasks', 'id,project_id,title,instruction,started_at')
      .or(substringFilter(['title', 'instruction'], text))
      .order('started_at', { ascending: false, nullsFirst: false })
      .limit(SEARCH_CAP),
    // REMEMBERED AND NOT A DECISION. Without `neq` a decision comes back here
    // AND in its own group below, and a reader counting "found" counts it
    // twice.
    store
      .select('memory_facts', 'id,project_id,claim,recorded_at')
      .is('valid_to', null)
      .neq('kind', 'decision')
      .textSearch('search', text, { type: 'plain', config: 'english' })
      .order('recorded_at', { ascending: false })
      .limit(SEARCH_CAP),
    store
      .select('memory_facts', 'id,project_id,claim,recorded_at')
      .is('valid_to', null)
      .eq('kind', 'decision')
      .textSearch('search', text, { type: 'plain', config: 'english' })
      .order('recorded_at', { ascending: false })
      .limit(SEARCH_CAP),
    store
      .select('session_transcripts', 'session_id,project_id,annotation,captured_at')
      .textSearch('search', text, { type: 'plain', config: 'english' })
      .order('captured_at', { ascending: false })
      .limit(SEARCH_CAP)
  ])) as unknown as [Read, Read, Read, Read, Read]

  // THE LABELS OF THE HITS, AND ONLY THOSE (release review iteration 2, data finding 4). The label map
  // came from one unpaged `projects` read: past the gateway's 1000-row cap a hit from a later project
  // rendered with a blank project while `labelProblem` stayed null. Now the ids the hits carry are asked
  // for by `selectIn` — at most five capped groups' worth, chunked — and a refused read is said, NOT
  // destructured past: a blank project column is indistinguishable from a project with no name.
  const ids = new Set<string>()
  for (const [read, column] of [[projects, 'id'], [tasks, 'project_id'], [facts, 'project_id'], [decisions, 'project_id'], [transcripts, 'project_id']] as const)
    for (const r of read.data ?? []) if (r[column] != null && r[column] !== '') ids.add(String(r[column]))
  const labels = await store.selectIn('projects', 'id,name', 'id', [...ids].sort())
  const names = Object.fromEntries(labels.rows.map((r) => [String(r.id), String(r.name)]))
  const named = (projectId: string): string | null => names[projectId] ?? null
  const labelProblem = labels.failed ? `project names could not be read: ${labels.failed}` : null

  return [
    groupOf({
      store: 'projects',
      method: 'substring',
      read: projects,
      // A project IS its own project, so the label needs no lookup — and
      // `named` is used anyway rather than special-cased, because a project
      // that cannot name itself is a fact worth showing the same way.
      shape: { id: 'id', text: 'name', at: 'created_at', project: 'id' },
      named,
      labelProblem
    }),
    groupOf({
      store: 'tasks',
      method: 'substring',
      read: tasks,
      shape: { id: 'id', text: 'title', at: 'started_at', project: 'project_id' },
      named,
      labelProblem
    }),
    groupOf({
      store: 'facts',
      method: 'words',
      read: facts,
      shape: { id: 'id', text: 'claim', at: 'recorded_at', project: 'project_id' },
      named,
      labelProblem
    }),
    groupOf({
      store: 'decisions',
      method: 'words',
      read: decisions,
      shape: { id: 'id', text: 'claim', at: 'recorded_at', project: 'project_id' },
      named,
      labelProblem
    }),
    groupOf({
      store: 'transcripts',
      method: 'words',
      read: transcripts,
      shape: { id: 'session_id', text: 'annotation', at: 'captured_at', project: 'project_id' },
      named,
      labelProblem
    })
  ]
}
// #endregion search-read
