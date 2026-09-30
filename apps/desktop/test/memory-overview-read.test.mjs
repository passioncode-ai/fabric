// Six counts that skipped the one place scope is enforced (UX28-07).
//
// `IPC.memoryOverview` counted its six stores with `db.from(table)` — the RAW
// client — and a hand-written `.eq('project_id', projectId)`. Every other read
// in the main process goes through `store.select(...)`, which applies
// `scopeFilters`: an `estate_id` filter on every scoped table, and it is what
// turns an id from somewhere else into "no such project". `scope.ts` says so in
// its own words: asked whether a scope may touch a project, "the answer must be
// the same as 'no such project'".
//
// Bypassing it, the counts answer for whatever `projectId` arrives. The rows
// are still one project's, so nothing from two estates is added together — the
// leak is narrower and worse-shaped than that: it is an answer given about a
// project this scope was never entitled to read.
//
// TWO MORE, found while looking at the same eight lines:
//
//   * `result.count ?? 0` — a null count with no error becomes zero. Sixth
//     appearance of the family, in its narrowest form: the error path IS
//     checked here, so this only fires when PostgREST answers without a count
//     header. It is still a number nobody measured.
//   * A count carries no `asOf`, so "42 facts" is as old as whenever it was
//     read and reads as current. The card's negative acceptance names it: a
//     stale source cannot present a current count.
//
// And the third state the card asks for: NEVER READ is not the same as read and
// empty, and `StoreCount` could express only two of the three.
//
// The FAKE IS THE DATABASE, not the store: `createScopedStore` is the real one
// (R-007). Third extraction of this shape after `digestRead.ts` and
// `harnessRead.ts` — a decision inside a handler cannot be driven without an
// Electron process.
//
// Pure: no database, no network.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { memoryOverviewFor, NEVER_READ } from '../src/main/memoryOverviewRead.ts'
import { createScopedStore } from '../src/main/scopedStore.ts'
import { fullyRead, missRate } from '../src/shared/memoryOverview.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const ESTATE = 'estate-1'
const PROJECT = 'project-1'
const NOW = '2026-09-10T00:00:00.000Z'

/**
 * A db shaped like PostgREST's client that RECORDS the filters it was given.
 *
 * The filters are the subject here: whether the estate one was applied is not
 * observable from the answer, only from the query.
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
          eq: (c, v) => {
            filters.push([c, v])
            return q
          },
          is: (c, v) => {
            filters.push([c, `is:${String(v)}`])
            return q
          },
          not: (c) => {
            filters.push([c, 'not'])
            return q
          },
          gt: () => q,
          lte: () => q,
          in: () => q,
          order: () => q,
          limit: () => q,
          maybeSingle: () => Promise.resolve(next(table)),
          then: (resolve) => Promise.resolve(next(table)).then(resolve)
        }
        return q
      }
    })
  }
  function next(table) {
    const list = answers[table]
    if (!list) return { data: [], count: 0, error: null }
    const i = taken[table] ?? 0
    taken[table] = i + 1
    return list[Math.min(i, list.length - 1)]
  }
}

const counted = (n) => ({ data: null, count: n, error: null })
const refused = (message) => ({ data: null, count: null, error: { message } })
/** PostgREST answering with no count header — no error, and no number. */
const noHeader = () => ({ data: null, count: null, error: null })

const drive = async (answers) => {
  const db = fakeDb(answers)
  const store = createScopedStore(db, { kind: 'project', estateId: ESTATE, projectId: PROJECT })
  const overview = await memoryOverviewFor(store, PROJECT, NOW)
  return { overview, queries: db.queries }
}

// ── THE SCOPE IS APPLIED, because the store applies it ─────────────────────
{
  const { queries } = await drive({ memory_facts: [counted(3)] })
  queries.length > 0
    ? ok(`${queries.length} count(s) issued`)
    : fail('no query was issued at all')
  const missing = queries.filter((q) => !q.filters.some(([c]) => c === 'estate_id'))
  missing.length === 0
    ? ok('every count carries the estate filter — the raw client bypassed it, and that is what turns a foreign id into "no such project"')
    : fail(`${missing.length} count(s) carry no estate filter: ${JSON.stringify(missing.map((q) => q.table))}`)
  const unprojected = queries.filter((q) => !q.filters.some(([c]) => c === 'project_id'))
  unprojected.length === 0
    ? ok('and the project filter too, from the same place rather than by hand')
    : fail(`${unprojected.length} count(s) carry no project filter`)
}

// ── THE BYPASS IS UNREACHABLE, not merely avoided ──────────────────────────
//
// The first plant here tried to make the counts use a raw client again and
// CRASHED the probe instead of failing it — which proves nothing, and says
// something better than the plant would have: this module receives a
// `ScopedStore` and nothing else, so there is no `db` to reach for. The
// handler had one in scope, which is the whole difference.
//
// Asserted against the source because the property is the ABSENCE of a call,
// and an absence cannot be observed by running the thing.
{
  const source = readFileSync(path.join(import.meta.dirname, '../src/main/memoryOverviewRead.ts'), 'utf8')
  const code = source
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
  !/\.from\(/.test(code)
    ? ok('the read never calls `.from(` — every count goes through the store, which is where `scopeFilters` lives')
    : fail('a count reaches past the store to the client, which is how the estate filter was missed')
  !/SupabaseClient/.test(code)
    ? ok('and the raw client is not even imported: the bypass is unreachable rather than avoided')
    : fail('the raw client is in scope here')
  // And the detector is shown seeing the call it forbids, so a green is not a
  // green from being blind (R-006).
  ;/\.from\(/.test("db.from('memory_facts')")
    ? ok('and the detector is shown catching a raw client call when there is one')
    : fail('the detector cannot see a raw client call')
}

// ── a refused count is unreadable, and says why ────────────────────────────
{
  const { overview } = await drive({ memory_facts: [refused('permission denied for table memory_facts')] })
  eq(overview.facts.rows, null, 'a refused count has no number')
  ;/permission denied/.test(overview.facts.problem ?? '')
    ? ok('and carries the database\'s own words')
    : fail('the reason was lost: ' + JSON.stringify(overview.facts.problem))
  eq(fullyRead(overview), false, 'and the screen can say the reading was partial')
}

// ── A COUNT NOBODY MEASURED IS NOT ZERO ────────────────────────────────────
{
  // `result.count ?? 0`. No error, no count header, and the store reported a
  // number the database never gave it.
  const { overview } = await drive({ memory_facts: [noHeader()] })
  eq(overview.facts.rows, null, 'a count that came back without a number is NOT zero')
  overview.facts.problem !== null
    ? ok('and it says so, rather than looking like an answer')
    : fail('a missing count was silently accepted')
}

// ── NEVER READ is a third state, not a shade of empty ──────────────────────
{
  eq(NEVER_READ.rows, null, 'the never-read count has no number')
  eq(NEVER_READ.problem, null, 'and NO problem, which is what distinguishes it from a refusal')
  eq(NEVER_READ.asOf, null, 'and no timestamp, because nothing happened at any time')
  // The three are distinguishable, which is the whole requirement: an operator
  // asking "does memory work here" gets a different answer from each.
  const { overview } = await drive({ memory_facts: [counted(0)] })
  const read = overview.facts
  const refusedRead = (await drive({ memory_facts: [refused('nope')] })).overview.facts
  new Set([
    `${read.rows}/${read.problem}`,
    `${refusedRead.rows}/${refusedRead.problem}`,
    `${NEVER_READ.rows}/${NEVER_READ.problem}`
  ]).size === 3
    ? ok('read-and-empty, refused, and never-read are three distinguishable answers')
    : fail('two of the three states are indistinguishable')
}

// ── every count carries WHEN it was taken ──────────────────────────────────
{
  const { overview } = await drive({ memory_facts: [counted(7)] })
  eq(overview.facts.asOf, NOW, 'a count that answered says when it was taken')
  eq(overview.facts.rows, 7, 'beside the number itself')
  const refusedRead = (await drive({ memory_facts: [refused('nope')] })).overview.facts
  eq(refusedRead.asOf, null, 'and a refused one has no timestamp to offer')
}

// ── the miss rate still refuses to invent a denominator ────────────────────
{
  // Unchanged by this card and re-asserted, because the shape it protects is
  // the one being extended: a rate with no denominator is UNKNOWN, not 0%.
  const { overview } = await drive({ memory_retrievals: [counted(0), counted(0)] })
  const rate = missRate(overview.retrievals, overview.misses)
  eq(rate.known, false, 'nothing asked means no rate')
  eq(rate.known === false && rate.because, 'never-asked', 'and it names WHICH kind of no rate')
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log(
  '\nall green: the counts go through the scope, a count nobody measured is not zero, and never-read is its own answer'
)
