// A fresh install starts: the seed's estate is one the app can open (0.3.4, CO-241, ADR-0131).
//
// MEASURED 2026-10-10 on a disposable stack (`scripts/test-stack.mjs up`, migrations 79 + seed — the path
// `supabase start` takes on a new volume, which is what the packaged app's bundled stack does on a new Mac):
// `resolve_subject('…0001', '…000a')` answered `not_a_member`. The seed made the default estate's owner a
// person `…0002` the app never runs as, and migration 58 grants the app's person only to estates that exist
// when it runs — none, on a new database. Every fresh install of 0.3.0–0.3.3 stopped at "identity could not
// be established". The identity probe (`identity.test.mjs`) creates its estates through the app's own
// bootstrap, so no tier ever opened the estate the seed makes.
//
// Two cases, one owned cluster each (`run-first-install-db.mjs` sets FIRST_INSTALL_CASE):
// - `fresh`: the seed itself, held to the two constants the app runs with, read from the app's own modules.
//   To WATCH it fail, run with FABRIC_SEED_FILE=test/fixtures/legacy-seed-0.3.3.sql.
// - `legacy`: the database those installs made (the 0.3.3 seed), read the way `seedRepair.ts#seedRepairDb`
//   reads it, decided by `seedOnlyProblem`, and granted through the same door with the same arguments.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { LOCAL_OPERATOR_PERSON } from '../src/main/identity.ts'
import { DEFAULT_ESTATE } from '../src/main/activeEstate.ts'
import { seedOnlyProblem } from '../src/main/seedRepair.ts'

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
  // The reads `seedRepairDb` makes: the first two events oldest first, and every member.
  const read = () => ({
    events: json(`select coalesce(json_agg(e), '[]') from (select type, actor, payload from journal
      where estate_id = '${DEFAULT_ESTATE}' order by seq limit 2) e`),
    members: json(`select coalesce(json_agg(m), '[]') from (select person_id, role from memberships where estate_id = '${DEFAULT_ESTATE}') m`)
  })
  const grant = (command) => json(`select change_membership('${command}', '${DEFAULT_ESTATE}', '${LOCAL_OPERATOR_PERSON}',
    'owner', 'grant', 0, 'desktop-bootstrap:seed-repair')`)

  test('the database a 0.3.3 install made is the one the boundary refused', () => {
    assert.equal(resolve().reason_code, 'not_a_member')
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

  test('the estate\'s history is untouched: one creation event, nothing journalled by the repair', () => {
    assert.equal(sql(`select count(*) from journal where estate_id = '${DEFAULT_ESTATE}'`), '1')
  })
} else {
  console.error(`unknown FIRST_INSTALL_CASE ${which}`)
  process.exit(2)
}

console.log(failures ? `FAIL ${failures} failure(s)` : 'all green')
process.exit(failures ? 1 : 0)
