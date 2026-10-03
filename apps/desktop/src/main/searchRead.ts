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
 * Two escapes, in this order. LIKE first: `%`, `_` and `\` are wildcards or the
 * escape character in a PostgreSQL LIKE pattern, so a literal "50%_off" must
 * not match "50 anything off". Then the value is double-quoted, which is
 * PostgREST's documented way to carry reserved characters, with `"` and `\`
 * escaped by a backslash. `*` is left alone: PostgREST also reads it as a LIKE
 * wildcard and documents no escape for it, so a `*` widens the match — it can
 * no longer change the filter.
 */
export function substringFilter(columns: readonly string[], text: string): string {
  const like = `%${text.replace(/[\\%_]/g, '\\$&')}%`
  const quoted = `"${like.replace(/["\\]/g, '\\$&')}"`
  return columns.map((c) => `${c}.ilike.${quoted}`).join(',')
}

/**
 * Search every declared store.
 *
 * The groups come back in `SEARCH_STORES` order, so the surface's headings and
 * the searched-stores sentence read in one order and cannot disagree about
 * which stores exist.
 */
export async function searchFor(store: ScopedStore, query: string): Promise<SearchGroup[]> {
  const text = query?.trim()
  if (!text) return []

  // NOT destructured past the error. A refused projects read used to leave the
  // label map empty, and every hit then rendered with a blank project column —
  // indistinguishable from hits that genuinely have no project name, and
  // reported to nobody.
  const projectRead = (await store.select('projects', 'id,name')) as Read
  const names = Object.fromEntries(
    (projectRead.data ?? []).map((r) => [String(r.id), String(r.name)])
  )
  const named = (projectId: string): string | null => names[projectId] ?? null
  const labelProblem = projectRead.error
    ? `project names could not be read: ${projectRead.error.message}`
    : null

  const [projects, tasks, facts, decisions, transcripts] = (await Promise.all([
    // Substring, because `projects` carries no tsvector. The method travels
    // with the group so the reader knows what kind of promise "found" is.
    store
      .select('projects', 'id,name,purpose,created_at')
      .or(substringFilter(['name', 'purpose'], text))
      .limit(SEARCH_CAP),
    store
      .select('project_tasks', 'id,project_id,title,instruction,started_at')
      .or(substringFilter(['title', 'instruction'], text))
      .limit(SEARCH_CAP),
    // REMEMBERED AND NOT A DECISION. Without `neq` a decision comes back here
    // AND in its own group below, and a reader counting "found" counts it
    // twice.
    store
      .select('memory_facts', 'id,project_id,claim,recorded_at')
      .is('valid_to', null)
      .neq('kind', 'decision')
      .textSearch('search', text, { type: 'plain', config: 'english' })
      .limit(SEARCH_CAP),
    store
      .select('memory_facts', 'id,project_id,claim,recorded_at')
      .is('valid_to', null)
      .eq('kind', 'decision')
      .textSearch('search', text, { type: 'plain', config: 'english' })
      .limit(SEARCH_CAP),
    store
      .select('session_transcripts', 'session_id,project_id,annotation,captured_at')
      .textSearch('search', text, { type: 'plain', config: 'english' })
      .limit(SEARCH_CAP)
  ])) as unknown as [Read, Read, Read, Read, Read]

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
      method: 'ranked',
      read: facts,
      shape: { id: 'id', text: 'claim', at: 'recorded_at', project: 'project_id' },
      named,
      labelProblem
    }),
    groupOf({
      store: 'decisions',
      method: 'ranked',
      read: decisions,
      shape: { id: 'id', text: 'claim', at: 'recorded_at', project: 'project_id' },
      named,
      labelProblem
    }),
    groupOf({
      store: 'transcripts',
      method: 'ranked',
      read: transcripts,
      shape: { id: 'session_id', text: 'annotation', at: 'captured_at', project: 'project_id' },
      named,
      labelProblem
    })
  ]
}
