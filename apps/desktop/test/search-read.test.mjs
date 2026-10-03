// A search that promised five stores and asked three (UX28-09).
//
// SCN-048 step 1 has said since it was written that results are grouped by
// nature across "projects, tasks, memory facts, transcripts, decisions". The
// code searched three: facts, transcripts, tasks. So a project's own title and
// a recorded decision were unfindable from the one field the scenario calls
// "one door to everything" — and step 4's promise, that an empty result "names
// which stores were searched, so 'nobody wrote it down' stays distinguishable
// from 'not searched'", named three stores truthfully while the door was two
// stores narrower than the product it opens onto.
//
// SIXTH ITERATION RUNNING where the scenario was right and the code was not.
//
// AND DECISIONS ARE A SUBSET OF FACTS, which is why this is not simply two more
// queries. A decision is a `memory_facts` row with `kind = 'decision'`, and the
// product treats it as a register of its own — its own surface, its own
// lineage, its own cap. Adding a decisions group without narrowing the facts
// group would return one row twice under two headings, and a reader counting
// "found" would count it twice. So `facts` now means "what is remembered and is
// not a decision", which is what "grouped BY NATURE" requires once the natures
// are named.
//
// The FAKE IS THE DATABASE, not the store: `createScopedStore` is the real one
// (R-007). Fourth extraction of this shape after `digestRead.ts`,
// `harnessRead.ts` and `memoryOverviewRead.ts`.
//
// Pure: no database, no network.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { searchFor } from '../src/main/searchRead.ts'
import { createScopedStore } from '../src/main/scopedStore.ts'
import { SEARCH_CAP, SEARCH_STORES, SEARCH_SUBJECT, outcomeOf } from '../src/shared/search.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const ESTATE = 'estate-1'

/**
 * A db shaped like PostgREST's client, recording the filters each query used.
 *
 * The filters matter twice here: the estate scope, and whether the facts query
 * excludes decisions — neither is observable from the rows that come back.
 */
function fakeDb(answers) {
  const queries = []
  const taken = {}
  return {
    queries,
    from: (table) => ({
      select: () => {
        const filters = []
        queries.push({ table, filters })
        const q = {
          eq: (c, v) => { filters.push(['eq', c, String(v)]); return q },
          neq: (c, v) => { filters.push(['neq', c, String(v)]); return q },
          is: (c, v) => { filters.push(['is', c, String(v)]); return q },
          not: (c, op, v) => { filters.push(['not', c, String(v)]); return q },
          or: (s) => { filters.push(['or', s, '']); return q },
          gt: () => q,
          lte: () => q,
          in: () => q,
          textSearch: (c, t) => { filters.push(['textSearch', c, t]); return q },
          order: (c, o) => { filters.push(['order', c, o?.ascending === false ? 'desc' : 'asc']); return q },
          limit: (n) => { filters.push(['limit', String(n), '']); return q },
          maybeSingle: () => Promise.resolve(next(table)),
          then: (resolve) => Promise.resolve(next(table)).then(resolve)
        }
        return q
      }
    })
  }
  function next(table) {
    const list = answers[table]
    if (!list) return { data: [], error: null }
    const i = taken[table] ?? 0
    taken[table] = i + 1
    return list[Math.min(i, list.length - 1)]
  }
}

const rows = (data) => ({ data, error: null })
const refused = (message) => ({ data: null, error: { message } })

const drive = async (answers, query = 'ledger') => {
  const db = fakeDb(answers)
  const store = createScopedStore(db, { kind: 'estate', estateId: ESTATE })
  const groups = await searchFor(store, query)
  return { groups, queries: db.queries, of: (s) => groups.find((g) => g.store === s) }
}

const PROJECTS = [{ id: 'p1', name: 'Atlas ledger', purpose: 'keep the ledger' }]

// ── FIVE STORES, and the scenario named them first ─────────────────────────
{
  eq(SEARCH_STORES.length, 5, 'the declared store list has five members')
  ;['projects', 'tasks', 'facts', 'transcripts', 'decisions'].every((s) => SEARCH_STORES.includes(s))
    ? ok('and they are the five SCN-048 step 1 names: projects, tasks, facts, transcripts, decisions')
    : fail('the declared stores are ' + JSON.stringify(SEARCH_STORES))
  SEARCH_STORES.every((s) => SEARCH_SUBJECT[s])
    ? ok('and every store says what KIND of thing its hits are')
    : fail('a store has no subject kind: ' + JSON.stringify(SEARCH_SUBJECT))
  // A project hit is the first kind in this search that can open EXACTLY —
  // `destinationOf` resolves a fact or a transcript to its project, because no
  // surface can focus one (CO-148). That is worth stating, not assuming.
  eq(SEARCH_SUBJECT.projects, 'project', 'a project hit is a project, which opens exactly')
  eq(SEARCH_SUBJECT.decisions, 'fact', 'and a decision hit is a fact, because that is what a decision IS')
}

// ── a project title is findable ────────────────────────────────────────────
{
  const { of } = await drive({ projects: [rows(PROJECTS), rows(PROJECTS)] })
  const group = of('projects')
  group && group.hits.length === 1
    ? ok('a project whose name matches is returned')
    : fail('the projects group returned ' + JSON.stringify(group?.hits))
  eq(group?.hits[0]?.text, 'Atlas ledger', 'with the name as its text')
  eq(group?.hits[0]?.projectId, 'p1', 'and the project as its own project')
  eq(group?.method, 'substring', 'searched by substring, because `projects` carries no tsvector — and the method is SHOWN, since a ranked match and a substring match are different promises')
}

// ── a decision is findable, and is its own group ───────────────────────────
{
  const { of, queries } = await drive({
    projects: [rows(PROJECTS)],
    memory_facts: [
      rows([{ id: 'f1', project_id: 'p1', claim: 'we chose the ledger', recorded_at: 'x' }]),
      rows([{ id: 'd1', project_id: 'p1', claim: 'the ledger is append-only', recorded_at: 'y' }])
    ]
  })
  const decisions = of('decisions')
  decisions && decisions.hits.length === 1
    ? ok('a recorded decision is returned in its own group')
    : fail('the decisions group returned ' + JSON.stringify(decisions?.hits))
  eq(decisions?.method, 'words', 'matched by words, because memory_facts carries the tsvector — and not called ranked, since nothing orders it by rank')

  // NEWEST FIRST, in every store (release review 2026-10-03): a capped group is the newest matches,
  // never an arbitrary subset of them.
  const searchQueries = queries.filter((q) => q.filters.some(([op]) => op === 'limit'))
  const unordered = searchQueries.filter((q) => !q.filters.some(([op, , dir]) => op === 'order' && dir === 'desc'))
  unordered.length === 0 && searchQueries.length === 5
    ? ok('all 5 store queries return their newest matches first')
    : fail(`${unordered.length} of ${searchQueries.length} store queries are not ordered newest first: ` + unordered.map((q) => q.table).join(', '))

  // AND NOT TWICE. Two queries hit `memory_facts`: one must exclude decisions
  // and one must require them, or a decision is counted under both headings.
  const factQueries = queries.filter((q) => q.table === 'memory_facts')
  eq(factQueries.length, 2, 'memory_facts is queried twice — once for facts, once for decisions')
  const excludes = factQueries.some((q) =>
    q.filters.some(([op, col, val]) => op === 'neq' && col === 'kind' && val === 'decision')
  )
  const requires = factQueries.some((q) =>
    q.filters.some(([op, col, val]) => op === 'eq' && col === 'kind' && val === 'decision')
  )
  excludes && requires
    ? ok('one excludes decisions and one requires them, so a decision cannot be counted under two headings')
    : fail(`facts/decisions split not applied — excludes:${excludes} requires:${requires}`)
}

// ── the scope is applied, because the store applies it ─────────────────────
{
  const { queries } = await drive({ projects: [rows(PROJECTS)] })
  const missing = queries.filter((q) => !q.filters.some(([op, col]) => op === 'eq' && col === 'estate_id'))
  missing.length === 0
    ? ok(`all ${queries.length} queries carry the estate filter, and NONE of them writes it`)
    : fail(`${missing.length} query(ies) carry no estate filter: ${JSON.stringify(missing.map((q) => q.table))}`)
  // MEASURED BY PLANTING: removing a hand-written `.eq('estate_id', …)` from
  // one query changed nothing, because `createScopedStore` had already applied
  // it. The hand-written ones were duplication, and a duplicated guard reads as
  // the thing that protects you. So the property is now guaranteed by
  // construction, and asserted as such: the module writes no estate filter at
  // all, which is what makes the plant impossible rather than merely inert.
  const source = readFileSync(path.join(import.meta.dirname, '../src/main/searchRead.ts'), 'utf8')
  !/estate_id/.test(source.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n'))
    ? ok('and the module names `estate_id` nowhere in its code: the scope comes from the store, once')
    : fail('a query writes its own estate filter, duplicating what the store already applies')
}

// ── one store refusing leaves the others answering ─────────────────────────
{
  const { of, groups } = await drive({
    projects: [rows(PROJECTS)],
    session_transcripts: [refused('transcripts refused')]
  })
  eq(of('transcripts')?.problem, 'transcripts refused', 'a refused store carries its own reason')
  of('projects')?.problem === null
    ? ok('and the stores beside it still answer')
    : fail('a refusal spread: ' + JSON.stringify(of('projects')?.problem))
  const outcome = outcomeOf(groups)
  outcome.state !== 'nothing'
    ? ok('and "nothing matches" cannot be claimed while a store is silent: ' + outcome.state)
    : fail('a silent store was counted as searched')
}

// ── every store is capped, and says so ─────────────────────────────────────
{
  const many = Array.from({ length: SEARCH_CAP }, (_, i) => ({
    id: `p${i}`,
    name: `ledger ${i}`,
    purpose: '',
    project_id: 'p1',
    claim: 'x',
    recorded_at: 'x',
    session_id: `s${i}`,
    annotation: 'x',
    ended_at: 'x',
    title: 'x',
    instruction: 'x',
    started_at: 'x'
  }))
  const { of, queries } = await drive({
    projects: [rows(PROJECTS), rows(many)],
    memory_facts: [rows(many), rows(many)],
    session_transcripts: [rows(many)],
    project_tasks: [rows(many)]
  })
  const capped = queries.filter((q) => q.filters.some(([op, v]) => op === 'limit' && v === String(SEARCH_CAP)))
  capped.length === queries.length - 1
    ? ok(`every search query is capped at ${SEARCH_CAP} (the project-label read is not a search)`)
    : fail(`${queries.length - capped.length - 1} query(ies) uncapped`)
  of('facts')?.coverage.truncated !== false
    ? ok('and a store that came back full says its answer may be cut short')
    : fail('a full page claimed to be complete')
}

// ── THE TEXT IS A VALUE, NOT A FILTER (release review 2026-10-03) ──────────
//
// The substring groups built `or(name.ilike.%TEXT%,purpose.ilike.%TEXT%)` by
// interpolation. `,` `(` `)` `.` and `:` are PostgREST's own grammar inside
// `or()`, so "auth, billing" split into a malformed second term and the group
// came back refused, and `x%,id.not.is.null` added a disjunct of the caller's
// choosing. PostgREST's documented remedy is a double-quoted value with `"` and
// `\` escaped by a backslash; `%` and `_` are LIKE wildcards and are escaped for
// LIKE first. The parser below is a MODEL of that grammar (R-007 applies: it
// proves the string matches the documented shape, not what the gateway does).
{
  /** Split an or() list at top-level commas, honouring double quotes and escapes. */
  const terms = (list) => {
    const out = []
    let cur = '', quoted = false
    for (let i = 0; i < list.length; i++) {
      const ch = list[i]
      if (quoted && ch === '\\') { cur += ch + list[++i]; continue }
      if (ch === '"') quoted = !quoted
      if (ch === ',' && !quoted) { out.push(cur); cur = ''; continue }
      cur += ch
    }
    out.push(cur)
    return out
  }
  const valueOf = (term) => {
    const m = term.match(/^([a-z_]+)\.ilike\.(".*")$/s)
    if (!m) return null
    return { column: m[1], value: m[2].slice(1, -1).replace(/\\(.)/g, '$1') }
  }
  for (const text of ['auth, billing', 'x%,id.not.is.null', 'a"b\\c', '50%_off', 'f(x).y:z']) {
    const { queries } = await drive({ projects: [rows(PROJECTS), rows([])] }, text)
    const ors = queries.flatMap((q) => q.filters.filter(([op]) => op === 'or').map(([, v]) => ({ table: q.table, v })))
    eq(ors.length, 2, `two substring groups ask an or() for ${JSON.stringify(text)}`)
    for (const { table, v } of ors) {
      const parsed = terms(v).map(valueOf)
      const columns = table === 'projects' ? ['name', 'purpose'] : ['title', 'instruction']
      const like = '%' + text.replace(/[\\%_]/g, '\\$&') + '%'
      parsed.length === 2 && parsed.every((p, i) => p && p.column === columns[i] && p.value === like)
        ? ok(`${table}: ${JSON.stringify(text)} stays one quoted value per column, wildcards escaped`)
        : fail(`${table}: ${JSON.stringify(text)} became ${JSON.stringify(v)}`)
    }
  }
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log(
  '\nall green: five stores are searched, a decision is its own group and counted once, and a refusal stays local'
)
