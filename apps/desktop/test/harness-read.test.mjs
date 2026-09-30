// A count that could not fail (UX28-05).
//
// The harness panel's three grant figures came from three
// `{ count: 'exact', head: true }` reads whose `error` was never looked at,
// followed by `live.count ?? 0`. A refused read became "no live authority
// here".
//
// That is the FIFTH appearance of one shape in this repository — FA-04, FA-03,
// FA-02 and the 414 each closed one — and it is the worst of the five for one
// reason: the empty answer flatters the system. "0 live grants" reads as
// nothing is authorised, which is what an auditor wants to hear, so nobody
// looks twice. The other four produced a missing list; this one produced
// reassurance.
//
// The handler also took `projectId` and never used it, so two projects
// rendered the same snapshot under two different titles.
//
// The FAKE IS THE DATABASE, not the store: `createScopedStore` is the real one
// (R-007). Only the `db` underneath answers from a literal, which is what makes
// the refusal branch reachable at all — against the live stack a count read
// does not fail, and an unreachable branch and a covered one look identical in
// a report.
//
// Pure: no database, no network.

import { grantsOf, harnessFor, projectAgentsOf, ESTATE_WIDE } from '../src/main/harnessRead.ts'
import { createScopedStore } from '../src/main/scopedStore.ts'
import { SURFACE_TOOLS } from '../src/shared/surfaceTools.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const ESTATE = 'estate-1'
const PROJECT = 'project-1'
const NOW = '2026-09-10T00:00:00.000Z'

/**
 * A db shaped like PostgREST's client.
 *
 * `answers` maps a table to a list of answers, taken in order — the three grant
 * reads hit the same table and must be able to answer differently, which is
 * the whole point of the partial case below.
 */
function fakeDb(answers) {
  const taken = {}
  return {
    from: (table) => ({
      select: () => {
        const q = {
          eq: () => q,
          gt: () => q,
          gte: () => q,
          lte: () => q,
          is: () => q,
          not: () => q,
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

const storeOf = (answers) =>
  createScopedStore(fakeDb(answers), { estateId: ESTATE, projectIds: [PROJECT] })

const counted = (n) => ({ data: null, count: n, error: null })
const refused = (message) => ({ data: null, count: null, error: { message } })

// ── A REFUSED COUNT IS NOT A COUNT OF ZERO ─────────────────────────────────
{
  const store = storeOf({ grants: [refused('permission denied for table grants')] })
  const read = await grantsOf(store, ESTATE, NOW)
  eq(read.availability, 'unavailable', 'when every grant read refuses, the reading is UNAVAILABLE')
  eq(read.data, null, 'and it carries no numbers at all — `envelope` nulls what nothing measured')
  read.sources.every((s) => s.status === 'error')
    ? ok('with a receipt per read, each saying it refused')
    : fail('a receipt claims ok: ' + JSON.stringify(read.sources))
  ;/permission denied/.test(read.sources[0].errorCode ?? '')
    ? ok('and the database\'s own words are carried, not a stack')
    : fail('the reason was lost: ' + JSON.stringify(read.sources[0]))
}

// ── a real zero is still a zero, because it is a measurement ───────────────
{
  const store = storeOf({ grants: [counted(0), counted(0), counted(0)] })
  const read = await grantsOf(store, ESTATE, NOW)
  eq(read.availability, 'complete', 'three reads that answered make a COMPLETE reading')
  eq(read.data?.live, 0, 'and zero live grants is reported as zero')
  eq(read.asOf, NOW, 'with the instant it was read at')
}

// ── one of three refusing is PARTIAL, not complete and not unavailable ─────
{
  // The case a single boolean cannot express, and the reason these three counts
  // share one envelope: a `live` that answered beside a `spent` that refused is
  // a partial reading of one table, and a surface quoting the total would be
  // quoting a number one of whose parts is missing.
  const store = storeOf({ grants: [counted(4), refused('statement timeout'), counted(1)] })
  const read = await grantsOf(store, ESTATE, NOW)
  eq(read.availability, 'partial', 'one refusal of three is PARTIAL')
  eq(read.data?.live, 4, 'what did answer is still there')
  read.sources.filter((s) => s.status === 'error').length === 1
    ? ok('and exactly one receipt says which')
    : fail('receipts: ' + JSON.stringify(read.sources.map((s) => s.status)))
}

// ── the created agents are read with the SAME definition as `agents:list` ──
{
  const store = storeOf({ agent_bindings: [{ data: [{ id: 'a1', role: 'The auditor' }], error: null }] })
  const read = await projectAgentsOf(store, PROJECT, NOW)
  eq(read.availability, 'complete', 'the project agents read completely')
  eq(read.data?.[0]?.name, 'The auditor', 'and `role` is the name the operator picks it by')
}

{
  const store = storeOf({ agent_bindings: [{ data: null, error: { message: 'bindings refused' } }] })
  const read = await projectAgentsOf(store, PROJECT, NOW)
  eq(read.availability, 'unavailable', 'a refused bindings read is unavailable')
  eq(read.data, null, 'and NOT an empty list, which would say this project has created nothing')
}

// ── THE SCOPE IS DECLARED, and one figure is honestly estate-wide ──────────
{
  const store = storeOf({ grants: [counted(1), counted(2), counted(3)] })
  const harness = await harnessFor({
    store,
    estateId: ESTATE,
    projectId: PROJECT,
    now: NOW,
    providers: () => [{ id: 'claude-code', description: 'Claude Code', available: true, permissionModes: [] }],
    endpoint: 'http://127.0.0.1:1/mcp',
    tools: SURFACE_TOOLS
  })
  eq(harness.scope.projectId, PROJECT, 'the snapshot names the project it was read FOR')
  harness.scope.estateWide.includes('grants')
    ? ok('and declares that the grant figures are estate-wide — `grants` has no project column at all')
    : fail('the estate-wide list does not name grants: ' + JSON.stringify(harness.scope.estateWide))
  // Two projects, two snapshots. Before this the handler ignored `projectId`
  // entirely, so the two were identical objects under two titles.
  const other = await harnessFor({
    store: storeOf({ grants: [counted(1), counted(2), counted(3)] }),
    estateId: ESTATE,
    projectId: 'project-2',
    now: NOW,
    providers: () => [],
    endpoint: null,
    tools: SURFACE_TOOLS
  })
  other.scope.projectId !== harness.scope.projectId
    ? ok('and two projects produce two snapshots')
    : fail('two projects produced the same scope')
}

// ── the surface not listening is not "no server configured" ────────────────
{
  const harness = await harnessFor({
    store: storeOf({ grants: [counted(0), counted(0), counted(0)] }),
    estateId: ESTATE,
    projectId: PROJECT,
    now: NOW,
    providers: () => [],
    endpoint: null,
    tools: SURFACE_TOOLS
  })
  eq(harness.servers.availability, 'unavailable', 'with no endpoint the server reading is UNAVAILABLE')
  eq(harness.servers.sources[0].status, 'not_configured', 'and says WHY: nothing is configured')
  // An empty list with `ok` would tell the operator a session here has no
  // tools, which is a claim about the product rather than about this process.
  eq(harness.servers.data, null, 'rather than an empty list, which is a different fact')
}

// ── the tool contract is not a read, and pretending otherwise would lie ────
{
  const harness = await harnessFor({
    store: storeOf({ grants: [counted(0), counted(0), counted(0)] }),
    estateId: ESTATE,
    projectId: PROJECT,
    now: NOW,
    providers: () => [],
    endpoint: 'http://127.0.0.1:1/mcp',
    tools: SURFACE_TOOLS
  })
  eq(harness.tools.length, SURFACE_TOOLS.length, 'every declared tool travels to the panel')
  Array.isArray(harness.tools)
    ? ok('as a plain list: it is a constant in this process, so there is no read to fail')
    : fail('the tool list was wrapped in an envelope it cannot need')
}

// ── the estate-wide list is data, so nothing can forget to say it ──────────
{
  ESTATE_WIDE.includes('grants') && ESTATE_WIDE.length === 1
    ? ok('exactly one field is estate-wide today, and it is declared rather than described')
    : fail('ESTATE_WIDE is ' + JSON.stringify(ESTATE_WIDE))
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log(
  '\nall green: a refused count reports unavailable, a partial reading says so, and the snapshot names its own scope'
)
