// Owner, member, outsider — attempted from the roles that would attempt it (FA-07 · R-003).
//
// A STRUCTURAL GATE PROVES STRUCTURE, NEVER AUTHORITY. `check-actor.mjs` proves
// no handler takes an identity from its caller, and `identity.ts` proves the port
// refuses a stranger. Neither can see a GRANT. So this connects as the roles a
// stranger would actually have — `anon` and `authenticated` — and attempts the
// reads and the writes they must not have.
//
// AND THE LAST-OWNER RACE. Migration 52 put the floor in a trigger rather than
// in a command precisely because the application runs as the service role and
// can write the table any way it likes. Two transactions each removing the last
// owner is the case a command-level check cannot survive; the trigger is
// supposed to. This attempts it.
//
// Fresh estates and fresh persons, removed at the end. The working database is
// never reset.

import pg from 'pg'
import { probeEnv } from '../../../scripts/lib/test-stack.mjs'
import { randomUUID } from 'node:crypto'

// The disposable stack the tier started; probeEnv() refuses the live one (54322) before connecting.
const DB_URL = probeEnv().DATABASE_URL
let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.error('  FAIL ' + m) }

const admin = new pg.Client({ connectionString: DB_URL })
await admin.connect()

// FIXED ids, and that is deliberate. An estate keeps an owner — the trigger this
// probe exists to prove — so the last membership can never be removed and a
// fresh estate per run would leak one for ever. Fixed ids make the fixture
// idempotent: the same estate, the same three people, re-used every run.
const ESTATE = '00000000-0000-0000-0000-0000000f0007'
const OWNER_A = '00000000-0000-0000-0000-00000000fa07'
const OWNER_B = '00000000-0000-0000-0000-00000000fb07'
const STRANGER = '00000000-0000-0000-0000-00000000fc07'
const SYSTEM = JSON.stringify({ kind: 'system', id: 'roles-probe' })

await admin.query("insert into estates (id, name) values ($1,'roles probe') on conflict (id) do nothing", [ESTATE])
for (const [id, name] of [[OWNER_A, 'owner a'], [OWNER_B, 'owner b'], [STRANGER, 'a stranger']])
  await admin.query('insert into persons (id, display_name) values ($1,$2) on conflict (id) do nothing', [id, name])
for (const p of [OWNER_A, OWNER_B])
  await admin.query(
    "insert into memberships (person_id, estate_id, role, changed_by) values ($1,$2,'owner','probe') " +
    "on conflict (person_id, estate_id) do update set role = 'owner'",
    [p, ESTATE])

// ── a stranger's roles reach nothing ────────────────────────────────────────
for (const role of ['anon', 'authenticated']) {
  const c = new pg.Client({ connectionString: DB_URL })
  await c.connect()
  await c.query(`set role ${role}`)

  const { rows: projects } = await c.query('select count(*)::int as n from projects where estate_id = $1', [ESTATE])
    .catch((e) => ({ rows: [{ n: 'refused: ' + e.code }] }))
  projects[0].n === 0 || String(projects[0].n).startsWith('refused')
    ? ok(`${role} reads no project of an estate it is not in`)
    : fail(`${role} read ${projects[0].n} project(s)`)

  let resolved = null
  try {
    await c.query('select resolve_subject($1,$2)', [ESTATE, OWNER_A])
    resolved = 'allowed'
  } catch (e) {
    resolved = e.code
  }
  resolved !== 'allowed'
    ? ok(`${role} cannot ask who is a member — resolving identity is not a public question`)
    : fail(`${role} called resolve_subject`)

  let wrote = null
  try {
    await c.query("insert into memberships (person_id, estate_id, role) values ($1,$2,'owner')", [STRANGER, ESTATE])
    wrote = 'allowed'
  } catch (e) {
    wrote = e.code
  }
  wrote !== 'allowed'
    ? ok(`${role} cannot make itself a member`)
    : fail(`${role} granted itself membership`)

  await c.end()
}

// ── the outsider is not a member, and is told what a stranger is told ───────
{
  const { rows } = await admin.query('select resolve_subject($1,$2) as r', [ESTATE, STRANGER])
  rows[0].r.ok === false && rows[0].r.reason_code === 'not_a_member'
    ? ok('a person who exists and is not a member is refused, by the trusted path too')
    : fail('outsider: ' + JSON.stringify(rows[0].r))
}

// ── a stale revision is refused ─────────────────────────────────────────────
{
  const { rows: [before] } = await admin.query(
    'select revision from memberships where estate_id = $1 and person_id = $2', [ESTATE, OWNER_B])
  await admin.query(
    "select change_membership($1,$2,$3,'member','grant',$4,'probe')",
    [randomUUID(), ESTATE, OWNER_B, before.revision])
  let stale = null
  try {
    const { rows } = await admin.query(
      "select change_membership($1,$2,$3,'owner','grant',$4,'probe') as r",
      [randomUUID(), ESTATE, OWNER_B, before.revision])
    stale = rows[0].r
  } catch (e) {
    stale = { raised: e.message }
  }
  // Asserted on the receipt's OWN vocabulary. The first version checked for an
  // `ok` field the command does not return, so a correct refusal read as an
  // acceptance — a test failing about the product because of its own shape.
  stale?.reason_code === 'revision_moved' || stale?.status === 'conflict' || stale?.raised
    ? ok('a command written against a revision that has moved is refused, and says which revision it saw')
    : fail('a stale revision was accepted: ' + JSON.stringify(stale))
  // Put it back so the race below has two owners to fight over.
  const { rows: [now] } = await admin.query(
    'select revision from memberships where estate_id = $1 and person_id = $2', [ESTATE, OWNER_B])
  await admin.query("select change_membership($1,$2,$3,'owner','grant',$4,'probe')",
    [randomUUID(), ESTATE, OWNER_B, now.revision])
}

// ── two transactions each removing the last owner ───────────────────────────
{
  const one = new pg.Client({ connectionString: DB_URL })
  const two = new pg.Client({ connectionString: DB_URL })
  await Promise.all([one.connect(), two.connect()])
  await one.query('begin')
  await two.query('begin')
  const first = await one.query('delete from memberships where estate_id = $1 and person_id = $2', [ESTATE, OWNER_A])
    .then(() => 'ok').catch((e) => e.message)
  const second = two.query('delete from memberships where estate_id = $1 and person_id = $2', [ESTATE, OWNER_B])
    .then(() => 'ok').catch((e) => e.message)
  await one.query('commit')
  const secondResult = await second
  const committed = await two.query('commit').then(() => 'ok').catch((e) => e.message)
  await Promise.all([one.end(), two.end()])

  const { rows: [left] } = await admin.query(
    "select count(*)::int as n from memberships where estate_id = $1 and role = 'owner'", [ESTATE])
  left.n >= 1
    ? ok('two transactions each removing the last owner leave the estate with one')
    : fail('the estate lost its last owner: first=' + first + ' second=' + secondResult + ' commit=' + committed)
}

// ── the floor refuses to be cleaned up, which is the floor working ──────────
{
  let refused = null
  try {
    await admin.query('delete from memberships where estate_id = $1', [ESTATE])
    refused = 'allowed'
  } catch (e) {
    refused = e.message
  }
  refused !== 'allowed' && refused.includes('no owner')
    ? ok('removing every membership is refused: an estate with data and no owner is unreachable, not deleted')
    : fail('the estate could be emptied of owners: ' + refused)
}

// What CAN be cleaned is cleaned. The last owner and its person stay, by design,
// which is why this probe uses fixed ids rather than minting a set per run.
await admin.query("delete from memberships where estate_id = $1 and person_id = $2", [ESTATE, OWNER_B]).catch(() => {})
await admin.query('delete from persons where id = $1', [STRANGER]).catch(() => {})
await admin.query('delete from journal where estate_id = $1', [ESTATE])
await admin.end()

console.log(failures ? `\n  FAIL ${failures} failure(s)` : '\nall green')
process.exit(failures ? 1 : 0)
