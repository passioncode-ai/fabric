// A database a fresh install of 0.2.0 or 0.3.0–0.3.3 made is opened, and nothing else is given away (CO-241, ADR-0131).
import assert from 'node:assert/strict'
import { EVENT_READ_LIMIT, LEGACY_SEED_PERSON, repairSeedOnlyEstate, seedOnlyProblem, seedRepairDb } from '../src/main/seedRepair.ts'
import { DEFAULT_ESTATE } from '../src/main/activeEstate.ts'
import { LOCAL_OPERATOR_PERSON } from '../src/main/identity.ts'

const seedEvent = { type: 'estate.created@1', actor: { kind: 'system', id: 'seed' }, payload: { name: 'org #1' } }
const phantom = { person_id: LEGACY_SEED_PERSON, role: 'owner' }
const shape = (events, members, decisions = 0) => seedOnlyProblem({ estateId: DEFAULT_ESTATE, events, members, decisions, operator: LOCAL_OPERATOR_PERSON })
// What a 0.3.1–0.3.3 start that failed at identity could still write: the hub opened first, and an agent asked (0.3.4 i1 DA-1).
const hubAsked = { type: 'access.requested@1', actor: { kind: 'system', id: 'fabric-hub' }, payload: { agent_id: 'a' } }

// What the old seed left: one creation event by the seed, its own person as the only owner.
assert.equal(shape([seedEvent], [phantom]), null, 'the old seed\'s estate, untouched since, is the one shape repaired')
assert.equal(shape([seedEvent], []), null, 'the same estate with no member at all')
assert.equal(shape([seedEvent, hubAsked, hubAsked], [phantom]), null,
  'an agent that asked through the hub while the start was failing has not used the estate (0.3.4 i1 DA-1)')

// Anything that has been used, or whose ownership anybody decided, is left as it is.
assert.match(shape([seedEvent, { type: 'project.created@1', actor: { kind: 'person', id: LEGACY_SEED_PERSON }, payload: {} }], [phantom]), /has history/,
  'an estate with any event after its creation is not "the seed\'s"')
assert.match(shape([seedEvent, { ...hubAsked, type: 'access.decided@1' }], [phantom]), /has history/,
  'a decided request is a decision, even when the hub wrote it')
assert.match(shape([seedEvent, { ...hubAsked, actor: { kind: 'person', id: LEGACY_SEED_PERSON } }], [phantom]), /has history/,
  'a request a person wrote is a person acting in the estate')
assert.match(shape([seedEvent, { ...hubAsked, actor: { kind: 'system', id: 'another-system' } }], [phantom]), /has history/,
  'only the hub\'s own request, never another system actor')
assert.match(shape([seedEvent, ...Array(EVENT_READ_LIMIT).fill(hubAsked)], [phantom]), /more events than/,
  'a journal longer than the repair reads is not called untouched')
assert.match(shape([seedEvent], [phantom], 1), /membership decision/,
  'a membership granted or revoked by anyone is a decision the repair does not undo (0.3.4 i1 DA-2)')
assert.match(shape([], [phantom]), /no creation event/, 'an estate with no journal is not the seed\'s either')
assert.match(shape([{ ...seedEvent, actor: { kind: 'system', id: 'desktop-bootstrap' } }], []), /not created by the seed/,
  'created by the app\'s bootstrap: it names its owner, and refusing is the identity boundary working')
assert.match(shape([{ ...seedEvent, payload: { name: 'org #1', owner_person_id: LEGACY_SEED_PERSON } }], [phantom]), /named its owner/,
  'a creation that named an owner is that owner\'s decision')
assert.match(shape([seedEvent], [phantom, { person_id: '7000000a-0000-4000-8000-000000000001', role: 'member' }]), /another person/,
  'a member who is not the old seed\'s person is a decision somebody made')
assert.match(shape([seedEvent], [{ person_id: LOCAL_OPERATOR_PERSON, role: 'member' }]), /already a member/,
  'the operator already there (as a member) is not a missing owner')
assert.match(seedOnlyProblem({ estateId: '7000000a-0000-4000-8000-000000000009', events: [seedEvent], members: [phantom], operator: LOCAL_OPERATOR_PERSON }),
  /not the default estate/, 'only the estate the seed makes, never a chosen or restored one')

// The repair: read, decide, grant through the membership door (compare-and-set at revision 0), once.
const fakeDb = ({ events = [seedEvent], members = [phantom], decisions = 0, eventsError = null, membersError = null, decisionsError = null, receipt = { status: 'committed', role: 'owner', revision: 1 }, grantError = null } = {}) => {
  const calls = []
  return {
    calls,
    async events(estateId) { calls.push(['events', estateId]); return { data: eventsError ? null : events, error: eventsError } },
    async members(estateId) { calls.push(['members', estateId]); return { data: membersError ? null : members, error: membersError } },
    async decisions(estateId) { calls.push(['decisions', estateId]); return { data: decisionsError ? null : decisions, error: decisionsError } },
    async grant(input) { calls.push(['grant', input]); return { data: grantError ? null : receipt, error: grantError } }
  }
}
const COMMAND = '0f8fad5b-d9cb-469f-a165-70867728950e'
const run = (db) => repairSeedOnlyEstate(db, { estateId: DEFAULT_ESTATE, operator: LOCAL_OPERATOR_PERSON, commandId: COMMAND })

{
  const db = fakeDb()
  assert.deepEqual(await run(db), { repaired: true })
  assert.deepEqual(db.calls.at(-1), ['grant', { estateId: DEFAULT_ESTATE, personId: LOCAL_OPERATOR_PERSON, commandId: COMMAND }])
}
{
  const db = fakeDb({ events: [seedEvent, seedEvent] })
  const out = await run(db)
  assert.equal(out.repaired, false)
  assert.match(out.why, /has history/)
  assert.ok(!db.calls.some(([k]) => k === 'grant'), 'nothing is granted when the shape does not hold')
}
assert.deepEqual(await run(fakeDb({ eventsError: { message: 'connection refused' } })), { repaired: false, why: 'the estate\'s journal could not be read: connection refused' },
  'a failed read is said, never taken for "no history"')
assert.deepEqual(await run(fakeDb({ membersError: { message: 'timeout' } })), { repaired: false, why: 'the estate\'s members could not be read: timeout' })
assert.deepEqual(await run(fakeDb({ decisionsError: { message: 'permission denied for table membership_commands' } })),
  { repaired: false, why: 'the estate\'s membership decisions could not be read: permission denied for table membership_commands' })
assert.deepEqual(await run(fakeDb({ grantError: { message: 'permission denied' } })), { repaired: false, why: 'the membership could not be granted: permission denied' })
assert.deepEqual(await run(fakeDb({ receipt: { status: 'conflict', says: 'this membership changed while the decision was being made; read it again' } })),
  { repaired: false, why: 'the membership door said conflict: this membership changed while the decision was being made; read it again' },
  'a membership that moved between the reading and the grant is not overwritten')
{
  const db = fakeDb()
  db.events = async () => { throw new Error('socket hang up') }
  assert.deepEqual(await run(db), { repaired: false, why: 'the repair could not run: socket hang up' }, 'a thrown read is an answer, not a crash of the startup it serves')
}
// The reads and the grant as they go to the stack (0.3.4 i1 DA-3): a shorter read would hide history, and a grant
// without the revision would drop the compare-and-set. A recording client holds both to what ADR-0131 says.
{
  const log = []
  const builder = (table) => {
    const b = { table }
    for (const m of ['select', 'eq', 'order', 'limit']) b[m] = (...a) => { log.push([table, m, ...a]); return b }
    b.then = (ok) => ok({ data: table === 'membership_commands' ? [] : [], error: null, count: 0 })
    return b
  }
  const client = { from: (t) => builder(t), rpc: async (name, args) => { log.push(['rpc', name, args]); return { data: { status: 'committed' }, error: null } } }
  const real = seedRepairDb(client)
  await real.events(DEFAULT_ESTATE); await real.members(DEFAULT_ESTATE); await real.decisions(DEFAULT_ESTATE)
  await real.grant({ estateId: DEFAULT_ESTATE, personId: LOCAL_OPERATOR_PERSON, commandId: COMMAND })
  assert.deepEqual(log, [
    ['journal', 'select', 'type, actor, payload'], ['journal', 'eq', 'estate_id', DEFAULT_ESTATE],
    ['journal', 'order', 'seq', { ascending: true }], ['journal', 'limit', EVENT_READ_LIMIT + 1],
    ['memberships', 'select', 'person_id, role'], ['memberships', 'eq', 'estate_id', DEFAULT_ESTATE],
    ['membership_commands', 'select', 'command_id', { count: 'exact', head: true }], ['membership_commands', 'eq', 'estate_id', DEFAULT_ESTATE],
    ['rpc', 'change_membership', { p_command_id: COMMAND, p_estate_id: DEFAULT_ESTATE, p_target_person: LOCAL_OPERATOR_PERSON,
      p_role: 'owner', p_action: 'grant', p_expected_revision: 0, p_changed_by: 'desktop-bootstrap:seed-repair' }]
  ])
}
// The wiring (0.3.4 i1 DA-1, DA-3): the repair runs before the retry point and before the hub opens, and a refusal
// carries the repair's reason into the startup failure the person sees. Read from the source, as other wiring gates are.
{
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8')
  const at = (needle) => { const i = src.indexOf(needle); assert.ok(i >= 0, `index.ts no longer has: ${needle}`); return i }
  const repairAt = at('await repairSeedOnlyEstate(seedRepairDb(db)')
  const refusalAt = at('throw new Error(`identity could not be established: ${gate.says}`')
  for (const [what, needle] of [['the point after which retrying is unsafe', 'pastRetryPoint = true'], ['the hub opens', 'await startHub(']]) {
    assert.ok(repairAt < at(needle), `the repair runs before ${what}`)
    assert.ok(refusalAt < at(needle), `a refusal is thrown before ${what} (i2 ER-2, UX-3)`)
  }
  assert.ok(at('let gate = await identity.establish()') < repairAt, 'identity is read before the repair')
  assert.ok(at("gate.why === 'not_a_member' && estate && ACTIVE_ESTATE === DEFAULT_ESTATE") < repairAt, 'only for the default estate, once it exists')
  assert.ok(src.indexOf('gate = await identity.establish()', repairAt) > repairAt, 'identity is read again after any repair attempt (ER-4)')
  assert.match(src.slice(refusalAt, refusalAt + 300), /seedRepairWhy/, 'a refusal says why the repair did not apply')
}
console.log('seed-repair: all green')
