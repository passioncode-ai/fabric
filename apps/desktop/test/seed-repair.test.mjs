// A database a fresh install of 0.2.0 or 0.3.0–0.3.3 made is opened, and nothing else is given away (CO-241, ADR-0131).
import assert from 'node:assert/strict'
import { EVENT_READ_LIMIT, LEGACY_SEED_PERSON, SEED_REPAIR_BY, SEED_RETIRE_BY, operatorStartedAt, repairSeedOnlyEstate, retireSeedOwner, seedOnlyProblem, seedRepairDb, seedRetireDb, seedRetireProblem } from '../src/main/seedRepair.ts'
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
// The read must be able to see one event past the limit: PostgREST answers at most `max_rows` rows, so a limit
// at or above it hides the very event that makes a journal "too long" (0.3.4 i3 DA-1, ER-1: with 1000, a used
// estate behind 999 hub requests was granted on a disposable stack).
{
  const { readFileSync } = await import('node:fs')
  const toml = readFileSync(new URL('../../../supabase/config.toml', import.meta.url), 'utf8')
  const maxRows = Number(/^max_rows\s*=\s*(\d+)/m.exec(toml)?.[1])
  assert.ok(Number.isInteger(maxRows), 'supabase/config.toml names max_rows')
  assert.ok(EVENT_READ_LIMIT + 1 <= maxRows, `the repair reads ${EVENT_READ_LIMIT + 1} rows, more than the API returns (${maxRows})`)
}
// ── CO-242: the old seed's `…0002` is retired from a repaired estate, through the door ─────────────────────────
const me = { person_id: LOCAL_OPERATOR_PERSON, role: 'owner', revision: 1, changed_by: SEED_REPAIR_BY, created_at: '2026-10-10T09:00:00Z' }
const old = { person_id: LEGACY_SEED_PERSON, role: 'owner', revision: 1, changed_by: null, created_at: '2026-10-08T07:00:00Z' }
const noSignIn = { auth_user: null }
const retireShape = (members, legacy = noSignIn, estateId = DEFAULT_ESTATE) => seedRetireProblem({ estateId, members, operator: LOCAL_OPERATOR_PERSON, legacy })
assert.equal(retireShape([me, old]), null, 'the shape the repair leaves: the operator made owner by the repair, beside the seed\'s untouched owner')
assert.deepEqual(retireShape([me]), { why: 'the old seed\'s person is not a member', left: true }, 'once retired, every later start leaves it')
assert.match(retireShape([{ ...me, changed_by: 'migration:subject-resolution' }, old]).why, /not given by the seed repair/,
  'an estate the operator was given another way (migration 58, the bootstrap) keeps its members')
assert.match(retireShape([{ ...me, role: 'member' }, old]).why, /not an owner/, 'the operator must already own it: a revoke never leaves it ownerless')
assert.match(retireShape([me, { ...old, revision: 2 }]).why, /changed since the seed wrote it/, 'a membership somebody changed is a decision')
assert.match(retireShape([me, { ...old, changed_by: 'invite:accepted' }]).why, /changed since the seed wrote it/)
assert.match(retireShape([me, old], { auth_user: '7000000a-0000-4000-8000-0000000000aa' }).why, /can sign in/, 'a person who signs in is a person, not a seed row')
assert.match(retireShape([me, old], null).why, /could not be found/)
assert.match(retireShape([me, old], noSignIn, '7000000a-0000-4000-8000-000000000009').why, /not the default estate/)
assert.ok([[me], [{ ...me, changed_by: 'x' }, old]].every((m) => retireShape(m).left === true), 'a shape refusal is the rule leaving the estate, not a failure')

const retireDb = ({ members = [me, old], legacy = noSignIn, membersError = null, legacyError = null, receipt = { status: 'committed', action: 'revoke', revision: 1 }, revokeError = null } = {}) => {
  const calls = []
  return {
    calls,
    async memberDetails(estateId) { calls.push(['memberDetails', estateId]); return { data: membersError ? null : members, error: membersError } },
    async legacyPerson() { calls.push(['legacyPerson']); return { data: legacyError ? null : legacy, error: legacyError } },
    async revoke(input) { calls.push(['revoke', input]); return { data: revokeError ? null : receipt, error: revokeError } }
  }
}
const RETIRE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const retire = (db) => retireSeedOwner(db, { estateId: DEFAULT_ESTATE, operator: LOCAL_OPERATOR_PERSON, commandId: RETIRE })
{
  const db = retireDb()
  assert.deepEqual(await retire(db), { retired: true })
  assert.deepEqual(db.calls.at(-1), ['revoke', { estateId: DEFAULT_ESTATE, personId: LEGACY_SEED_PERSON, commandId: RETIRE, expectedRevision: 1 }],
    'the revoke names the seed\'s person, at the revision read')
}
{
  const db = retireDb({ members: [{ ...me, changed_by: 'x' }, old] })
  const out = await retire(db)
  assert.equal(out.retired, false); assert.equal(out.left, true)
  assert.ok(!db.calls.some(([k]) => k === 'revoke'), 'nothing is revoked when the shape does not hold')
}
assert.deepEqual(await retire(retireDb({ membersError: { message: 'timeout' } })), { retired: false, why: 'the estate\'s members could not be read: timeout' },
  'a failed read is said, and is not `left`: it is recorded')
assert.deepEqual(await retire(retireDb({ legacyError: { message: 'permission denied' } })), { retired: false, why: 'the old seed\'s person could not be read: permission denied' })
assert.deepEqual(await retire(retireDb({ revokeError: { message: 'permission denied' } })), { retired: false, why: 'the membership could not be revoked: permission denied' })
assert.deepEqual(await retire(retireDb({ receipt: { status: 'conflict', says: 'this membership changed while the decision was being made; read it again' } })),
  { retired: false, why: 'the membership door said conflict: this membership changed while the decision was being made; read it again' },
  'a membership that moved between the reading and the revoke is not removed')
{
  const db = retireDb()
  db.memberDetails = async () => { throw new Error('socket hang up') }
  assert.deepEqual(await retire(db), { retired: false, why: 'the retirement could not run: socket hang up' })
}
// The reads and the revoke as they go to the stack: through change_membership, a revoke at the read revision.
{
  const log = []
  const builder = (table) => {
    const b = { table }
    for (const m of ['select', 'eq', 'maybeSingle']) b[m] = (...a) => { log.push([table, m, ...a]); return b }
    b.then = (ok) => ok({ data: [], error: null })
    return b
  }
  const client = { from: (t) => builder(t), rpc: async (name, args) => { log.push(['rpc', name, args]); return { data: { status: 'committed' }, error: null } } }
  const real = seedRetireDb(client)
  await real.memberDetails(DEFAULT_ESTATE); await real.legacyPerson()
  await real.revoke({ estateId: DEFAULT_ESTATE, personId: LEGACY_SEED_PERSON, commandId: RETIRE, expectedRevision: 1 })
  assert.deepEqual(log, [
    ['memberships', 'select', 'person_id, role, revision, changed_by, created_at'], ['memberships', 'eq', 'estate_id', DEFAULT_ESTATE],
    ['persons', 'select', 'auth_user'], ['persons', 'eq', 'id', LEGACY_SEED_PERSON], ['persons', 'maybeSingle'],
    ['rpc', 'change_membership', { p_command_id: RETIRE, p_estate_id: DEFAULT_ESTATE, p_target_person: LEGACY_SEED_PERSON,
      p_role: null, p_action: 'revoke', p_expected_revision: 1, p_changed_by: SEED_RETIRE_BY }]
  ])
}
// The operator's tenure: a repaired estate counts from the repair, every other from its first event.
assert.equal(operatorStartedAt(me), '2026-10-10T09:00:00Z')
assert.equal(operatorStartedAt({ ...me, changed_by: 'estate.created@1' }), null)
assert.equal(operatorStartedAt({ ...me, created_at: null }), null)
assert.equal(operatorStartedAt(null), null)
// The wiring: after the identity gate admitted the operator, before the retry point and the hub; the estate summary
// reads the operator's membership for the tenure.
{
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8')
  const at = (needle, from = 0) => { const i = src.indexOf(needle, from); assert.ok(i >= 0, `index.ts no longer has: ${needle}`); return i }
  const refusalAt = at('throw new Error(`identity could not be established: ${gate.says}`')
  const retireAt = at('await retireSeedOwner(seedRetireDb(db)')
  assert.ok(refusalAt < retireAt, 'the retirement runs only once identity is established')
  assert.ok(retireAt < at('pastRetryPoint = true') && retireAt < at('await startHub('), 'and before the retry point and the hub')
  assert.ok(at('if (retire.retired || !retire.left)') > retireAt, 'a failure is recorded; a shape the rule leaves is not')
  const summaryAt = at('handle(IPC.estateSummary')
  assert.ok(at("store.select('memberships', 'created_at, changed_by')", summaryAt) > summaryAt, 'the summary reads the operator\'s membership')
  assert.ok(at('tenure: tenureFrom(operatorStartedAt(', summaryAt) > summaryAt, 'and the tenure starts at the repair when there was one')
}
console.log('seed-repair: all green')
