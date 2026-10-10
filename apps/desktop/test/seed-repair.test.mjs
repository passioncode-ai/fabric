// A database a fresh 0.3.0–0.3.3 install made is opened, and nothing else is given away (CO-241, ADR-0131).
import assert from 'node:assert/strict'
import { LEGACY_SEED_PERSON, repairSeedOnlyEstate, seedOnlyProblem } from '../src/main/seedRepair.ts'
import { DEFAULT_ESTATE } from '../src/main/activeEstate.ts'
import { LOCAL_OPERATOR_PERSON } from '../src/main/identity.ts'

const seedEvent = { type: 'estate.created@1', actor: { kind: 'system', id: 'seed' }, payload: { name: 'org #1' } }
const phantom = { person_id: LEGACY_SEED_PERSON, role: 'owner' }
const shape = (events, members) => seedOnlyProblem({ estateId: DEFAULT_ESTATE, events, members, operator: LOCAL_OPERATOR_PERSON })

// What the old seed left: one creation event by the seed, its own person as the only owner.
assert.equal(shape([seedEvent], [phantom]), null, 'the old seed\'s estate, untouched since, is the one shape repaired')
assert.equal(shape([seedEvent], []), null, 'the same estate with no member at all')

// Anything that has been used, or whose ownership anybody decided, is left as it is.
assert.match(shape([seedEvent, { type: 'project.created@1', actor: { kind: 'person', id: LEGACY_SEED_PERSON }, payload: {} }], [phantom]), /has history/,
  'an estate with any event after its creation is not "the seed\'s"')
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
const fakeDb = ({ events = [seedEvent], members = [phantom], eventsError = null, membersError = null, receipt = { status: 'committed', role: 'owner', revision: 1 }, grantError = null } = {}) => {
  const calls = []
  return {
    calls,
    async events(estateId) { calls.push(['events', estateId]); return { data: eventsError ? null : events, error: eventsError } },
    async members(estateId) { calls.push(['members', estateId]); return { data: membersError ? null : members, error: membersError } },
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
assert.deepEqual(await run(fakeDb({ grantError: { message: 'permission denied' } })), { repaired: false, why: 'the membership could not be granted: permission denied' })
assert.deepEqual(await run(fakeDb({ receipt: { status: 'conflict', says: 'this membership changed while the decision was being made; read it again' } })),
  { repaired: false, why: 'the membership door said conflict: this membership changed while the decision was being made; read it again' },
  'a membership that moved between the reading and the grant is not overwritten')
{
  const db = fakeDb()
  db.events = async () => { throw new Error('socket hang up') }
  assert.deepEqual(await run(db), { repaired: false, why: 'the repair could not run: socket hang up' }, 'a thrown read is an answer, not a crash of the startup it serves')
}
console.log('seed-repair: all green')
