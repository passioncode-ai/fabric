// A fresh install starts: the seed's estate is one the app can open (0.3.4, CO-241, ADR-0131).
//
// MEASURED 2026-10-10 on a disposable stack (`scripts/test-stack.mjs up`, migrations 79 + seed — the path
// `supabase start` takes on a new volume, which is what the packaged app's bundled stack does on a new Mac):
// `resolve_subject('…0001', '…000a')` answered `not_a_member`. The seed made the default estate's owner a
// person `…0002` the app never runs as, and migration 58 grants the app's person only to estates that exist
// when it runs — none, on a new database. Every fresh install since 0.2.0 stopped at "identity could not
// be established". The identity probe (`identity.test.mjs`) creates its estates through the app's own
// bootstrap, so no tier ever opened the estate the seed makes.
//
// Two cases, one owned cluster each (`run-first-install-db.mjs` sets FIRST_INSTALL_CASE):
// - `fresh`: the seed itself, held to the two constants the app runs with, read from the app's own modules.
//   To WATCH it fail, run from `apps/desktop` with FABRIC_SEED_FILE=test/fixtures/legacy-seed-0.3.3.sql.
// - `legacy`: the database those installs made (the 0.3.3 seed), read the way `seedRepair.ts#seedRepairDb`
//   reads it, decided by `seedOnlyProblem`, and granted through the same door with the same arguments.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { LOCAL_OPERATOR_PERSON } from '../src/main/identity.ts'
import { DEFAULT_ESTATE } from '../src/main/activeEstate.ts'
import { EVENT_READ_LIMIT, LEGACY_SEED_PERSON, SEED_RETIRE_BY, operatorStartedAt, seedOnlyProblem, seedRetireProblem } from '../src/main/seedRepair.ts'

const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-first-install-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const which = process.env.FIRST_INSTALL_CASE ?? 'fresh'

const sql = (input) =>
  execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const json = (q) => JSON.parse(sql(q) || 'null')
const resolve = () => json(`select public.resolve_subject('${DEFAULT_ESTATE}', '${LOCAL_OPERATOR_PERSON}')`)

let failures = 0
const test = (name, fn) => {
  try { fn(); console.log('PASS ' + name) } catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + String(e.message).split('\n').join('\n     ')) }
}

if (which === 'fresh') {
  const seedFile = process.env.FABRIC_SEED_FILE ?? new URL('../../../supabase/seed.sql', import.meta.url).pathname
  const seed = () => sql(readFileSync(seedFile, 'utf8'))
  seed()

  test('the app opens the estate a fresh install seeds: its person resolves there, as owner', () => {
    const read = resolve()
    assert.equal(read.ok, true, `resolve_subject said ${JSON.stringify(read)}`)
    assert.equal(read.role, 'owner')
  })

  test('the seeded estate has no member the app cannot run as', () => {
    const members = sql(`select person_id || ':' || role from memberships where estate_id = '${DEFAULT_ESTATE}' order by 1`)
    assert.equal(members, `${LOCAL_OPERATOR_PERSON}:owner`)
  })

  test('the owner comes from the estate\'s creation event, as the app\'s own bootstrap writes it', () => {
    const events = sql(`select type || ' ' || (actor->>'kind') || '/' || (actor->>'id') || ' ' || coalesce(payload->>'owner_person_id', '-')
      from journal where estate_id = '${DEFAULT_ESTATE}' order by seq`)
    assert.equal(events, `estate.created@1 system/seed ${LOCAL_OPERATOR_PERSON}`)
  })

  test('the seed runs again without a second event or a second owner', () => {
    seed()
    assert.equal(sql(`select count(*) from journal where estate_id = '${DEFAULT_ESTATE}'`), '1')
    assert.equal(sql(`select count(*) from memberships where estate_id = '${DEFAULT_ESTATE}'`), '1')
  })
} else if (which === 'legacy') {
  sql(readFileSync(new URL('./fixtures/legacy-seed-0.3.3.sql', import.meta.url), 'utf8'))
  // The reads `seedRepairDb` makes: the journal oldest first up to its limit, every member, and the decisions on record.
  const read = () => ({
    events: json(`select coalesce(json_agg(e), '[]') from (select type, actor, payload from journal
      where estate_id = '${DEFAULT_ESTATE}' order by seq limit ${EVENT_READ_LIMIT + 1}) e`),
    members: json(`select coalesce(json_agg(m), '[]') from (select person_id, role from memberships where estate_id = '${DEFAULT_ESTATE}') m`),
    decisions: Number(sql(`select count(*) from membership_commands where estate_id = '${DEFAULT_ESTATE}'`))
  })
  const grant = (command) => json(`select change_membership('${command}', '${DEFAULT_ESTATE}', '${LOCAL_OPERATOR_PERSON}',
    'owner', 'grant', 0, 'desktop-bootstrap:seed-repair')`)

  test('the database a 0.3.3 install made is the one the boundary refused', () => {
    assert.equal(resolve().reason_code, 'not_a_member')
  })

  // 0.3.1–0.3.3 opened the hub before identity and kept it open behind the error: a registered agent's request
  // reached the estate while the start was failing (0.3.4 i1 DA-1, measured by the data reviewer). Written the way
  // `accessService.ts` writes it, through the door.
  test('a request an agent made through the hub while the start was failing is accepted by the door', () => {
    sql(`select append_event('${DEFAULT_ESTATE}', 'access.requested@1', '{"kind":"system","id":"fabric-hub"}',
      '${JSON.stringify({ id: '7000000a-0000-4000-8000-000000000101', agent_id: 'example-agent', callee: 'fabric-inbox',
      capabilities: ['list_messages'], resources: ['cloudflare:news@example.com'], reason: 'summarise', registry: {}, binding_id: null,
      expires_at: new Date(Date.now() + 600_000).toISOString() })}', '1', null)`)
    assert.equal(sql(`select count(*) from journal where estate_id = '${DEFAULT_ESTATE}'`), '2')
  })

  test('its rows are the shape the repair takes, read as the app reads them', () => {
    assert.equal(seedOnlyProblem({ estateId: DEFAULT_ESTATE, ...read(), operator: LOCAL_OPERATOR_PERSON }), null)
  })

  const command = randomUUID()
  test('the membership door grants it at revision 0, and the app opens its estate as owner', () => {
    const receipt = grant(command)
    assert.equal(receipt.status, 'committed', JSON.stringify(receipt))
    const now = resolve()
    assert.equal(now.ok, true, JSON.stringify(now))
    assert.equal(now.role, 'owner')
  })

  test('once repaired, the shape no longer holds: a second start grants nothing', () => {
    assert.match(seedOnlyProblem({ estateId: DEFAULT_ESTATE, ...read(), operator: LOCAL_OPERATOR_PERSON }) ?? '', /already a member/)
  })

  test('a grant against a membership that moved is refused, not applied', () => {
    const late = grant(randomUUID())
    assert.equal(late.status, 'conflict', JSON.stringify(late))
  })

  test('the estate\'s history is untouched: the creation and the agent\'s request, nothing journalled by the repair', () => {
    assert.equal(sql(`select count(*) from journal where estate_id = '${DEFAULT_ESTATE}'`), '2')
  })

  test('a revoke through the door is a decision: the repair does not grant the estate again (0.3.4 i1 DA-2)', () => {
    const revoked = json(`select change_membership('${randomUUID()}', '${DEFAULT_ESTATE}', '${LOCAL_OPERATOR_PERSON}',
      null, 'revoke', null, 'probe:revoke')`)
    assert.equal(revoked.status, 'committed', JSON.stringify(revoked))
    assert.equal(resolve().reason_code, 'not_a_member')
    assert.match(seedOnlyProblem({ estateId: DEFAULT_ESTATE, ...read(), operator: LOCAL_OPERATOR_PERSON }) ?? '', /membership decision/)
  })
} else if (which === 'retire') {
  // The database a 0.3.3 install made, repaired the way 0.3.4 repairs it (the `legacy` case holds that repair).
  sql(readFileSync(new URL('./fixtures/legacy-seed-0.3.3.sql', import.meta.url), 'utf8'))
  const repaired = json(`select change_membership('${randomUUID()}', '${DEFAULT_ESTATE}', '${LOCAL_OPERATOR_PERSON}',
    'owner', 'grant', 0, 'desktop-bootstrap:seed-repair')`)
  assert.equal(repaired.status, 'committed', JSON.stringify(repaired))

  // CO-242 (0.4.0 wave 1): the old seed's `…0002` is retired from the repaired estate the way seedRepair.ts#retireSeedOwner
  // retires it — read as seedRetireDb reads it, decided by seedRetireProblem, revoked through the same door.
  const details = () => json(`select coalesce(json_agg(m), '[]') from (select person_id, role, revision, changed_by, created_at
    from memberships where estate_id = '${DEFAULT_ESTATE}') m`)
  const legacy = () => json(`select row_to_json(p) from (select auth_user from persons where id = '${LEGACY_SEED_PERSON}') p`)
  const retireShape = () => seedRetireProblem({ estateId: DEFAULT_ESTATE, members: details(), operator: LOCAL_OPERATOR_PERSON, legacy: legacy() })

  test('CO-242: a repaired estate lists the old seed\'s person as a second owner, in the shape the retirement takes', () => {
    assert.equal(sql(`select string_agg(person_id || ':' || role, ',' order by person_id) from memberships where estate_id = '${DEFAULT_ESTATE}'`),
      `${LEGACY_SEED_PERSON}:owner,${LOCAL_OPERATOR_PERSON}:owner`)
    assert.equal(retireShape(), null)
  })

  test('CO-242: it is revoked through the membership door, at its revision, with a receipt; the operator stays the owner', () => {
    const commands = Number(sql(`select count(*) from membership_commands where estate_id = '${DEFAULT_ESTATE}'`))
    const old = details().find((m) => m.person_id === LEGACY_SEED_PERSON)
    const command = randomUUID()
    const receipt = json(`select change_membership('${command}', '${DEFAULT_ESTATE}', '${LEGACY_SEED_PERSON}', null, 'revoke', ${old.revision}, '${SEED_RETIRE_BY}')`)
    assert.equal(receipt.status, 'committed', JSON.stringify(receipt))
    assert.equal(sql(`select string_agg(person_id || ':' || role, ',') from memberships where estate_id = '${DEFAULT_ESTATE}'`), `${LOCAL_OPERATOR_PERSON}:owner`)
    assert.equal(Number(sql(`select count(*) from membership_commands where estate_id = '${DEFAULT_ESTATE}'`)), commands + 1, 'the revoke is a decision on record')
    assert.equal(sql(`select receipt->>'action' from membership_commands where command_id = '${command}'`), 'revoke')
    const now = resolve()
    assert.equal(now.ok, true, JSON.stringify(now)); assert.equal(now.role, 'owner')
    assert.equal(sql(`select count(*) from persons where id = '${LEGACY_SEED_PERSON}'`), '1', 'the person row stays: a membership is revoked, nothing is deleted')
  })

  test('CO-242: once retired, every later start leaves the estate as it is', () => {
    assert.deepEqual(retireShape(), { why: 'the old seed\'s person is not a member', left: true })
  })

  test('CO-242: the operator\'s tenure counts from the repair, not from the failed install\'s creation event', () => {
    const row = json(`select row_to_json(m) from (select created_at, changed_by from memberships
      where estate_id = '${DEFAULT_ESTATE}' and person_id = '${LOCAL_OPERATOR_PERSON}') m`)
    const firstEvent = sql(`select to_json(occurred_at) from journal where estate_id = '${DEFAULT_ESTATE}' order by seq limit 1`)
    assert.equal(operatorStartedAt(row), row.created_at)
    assert.ok(Date.parse(row.created_at) > Date.parse(JSON.parse(firstEvent)), 'the repair came after the seed\'s creation event')
  })
} else {
  console.error(`unknown FIRST_INSTALL_CASE ${which}`)
  process.exit(2)
}

console.log(failures ? `FAIL ${failures} failure(s)` : 'all green')
process.exit(failures ? 1 : 0)
