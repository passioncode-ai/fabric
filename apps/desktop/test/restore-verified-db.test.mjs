// restore_estate_verified against an owned PostgreSQL (first-slice plan A1-3, ADR-0079 §2–3).
// Every refusal is checked by a before/after snapshot: a refused restore leaves no shell, no
// membership, no boundary, no journal row and no projection behind.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { runPsqlAsync } from './bounded-psql.mjs'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { ordinary } from './fixtures/ceo-private-archive/vectors.mjs'

const dir = process.env.FABRIC_ARCHIVE_DB_DIR, nonce = process.env.FABRIC_ARCHIVE_DB_NONCE, bin = process.env.FABRIC_ARCHIVE_PG_BIN, db = process.env.FABRIC_ARCHIVE_DB_NAME
if (!dir || !nonce || !bin || !db) { console.error('NOT_RUN: use run-ceo-private-archive-db.mjs'); process.exit(2) }
assert.match(path.basename(dir), /^fabric-ceo-private-archive-[a-zA-Z0-9]+$/)
assert.equal(readFileSync(path.join(dir, 'owner'), 'utf8'), nonce)
const args = ['-h', dir, '-p', '58467', '-U', 'postgres', '-d', db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1']
const sql = input => execFileSync(path.join(bin, 'psql'), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const sqlAsync = input => runPsqlAsync(path.join(bin, 'psql'), args, input).then(r => {
  if (r.code !== 0) throw new Error(r.stderr)
  return r.stdout.trim()
})
assert.equal(realpathSync(sql('show data_directory')), realpathSync(path.join(dir, 'data')))
assert.equal(sql("select count(*) from pg_tables where schemaname='public'"), '0')
// Roles are cluster-wide: the second database in this owned cluster finds them already made.
sql(`do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;create role authenticated;create role service_role bypassrls; end if; end $$;
create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.auth_uid',true),'')::uuid$$;
create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text);`)
const lit = v => `convert_from(decode('${Buffer.from(String(v)).toString('hex')}','hex'),'UTF8')`
const uuid = v => `${lit(v)}::uuid`, jsonb = v => `${lit(JSON.stringify(v))}::jsonb`
const migrations = new URL('../../../supabase/migrations/', import.meta.url)
for (const file of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) {
  sql(readFileSync(new URL(file, migrations), 'utf8'))
  sql(`insert into supabase_migrations.schema_migrations values(${lit(file.split('_')[0])})`)
}

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const U = id(1), M = id(2), X = id(3), CONTROL = id(10), SOURCE = id(20)
sql(`insert into persons(id,display_name) values(${uuid(U)},'control owner'),(${uuid(M)},'control member'),(${uuid(X)},'archival owner');
insert into estates(id,name) values(${uuid(CONTROL)},'control');
insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(CONTROL)},'owner'),(${uuid(M)},${uuid(CONTROL)},'member');`)

// An ordinary archive whose history names X as founder and creates one project.
const at = s => `2026-09-${String(10 + s).padStart(2, '0')}T08:00:00.000000+00:00`
// Event 3 is schema_rev 2: the landed history must be the archive's exactly, which the
// prefix fingerprint checks before commit.
const event = (seq, type, payload, project = null) => JSON.stringify({ seq, type, schema_rev: seq === 3 ? '2' : '1', actor: { kind: 'person', id: X },
  project_id: project, run_id: null, node_id: null, payload, occurred_at: at(seq) })
const archiveOf = (project = id(30)) => ordinary(SOURCE, [
  event(1, 'estate.created@1', { name: 'archived atlas', owner_person_id: X }),
  event(2, 'project.created@1', { id: project, name: 'Atlas', purpose: 'the restored project' }, project),
  event(3, 'project.updated@1', { id: project, purpose: 'Привет, 雪 и 😀' }, project),
], { takenAtUtc: '2026-09-28T09:00:00.000Z' })
const good = archiveOf()
const restore = ({ person = U, revision = 1, actor = { kind: 'person', id: person }, operation, target, archive = good, name = 'Restored Atlas', control = CONTROL }) =>
  `set role service_role;select restore_estate_verified(${uuid(control)},${uuid(person)},${revision},${jsonb(actor)},${uuid(operation)},${uuid(target)},${jsonb(archive.manifest)},${lit(archive.journal)},${lit(name)})`
const call = opts => JSON.parse(sql(restore(opts)))
const snapshot = () => sql(`select jsonb_build_object(
  'estates',(select count(*) from estates),'memberships',(select jsonb_agg(to_jsonb(m) order by estate_id,person_id) from (select person_id,estate_id,role,revision from memberships) m),
  'journal',(select count(*) from journal),'boundaries',(select count(*) from estate_restore_boundaries),'projects',(select count(*) from projects))`)
const refusedWithoutMutation = (label, opts, code) => {
  const before = snapshot(), r = call(opts)
  assert.deepEqual(r, { ok: false, reason_code: code }, label)
  assert.equal(snapshot(), before, label + ' left rows behind')
}
const members = e => JSON.parse(sql(`select coalesce(jsonb_agg(jsonb_build_object('person',person_id,'role',role,'revision',revision) order by person_id),'[]') from memberships where estate_id=${uuid(e)}`))
let groups = 0
const pass = name => { groups++; console.log('PASS ' + name) }

// ── 1. The owner restores into a fresh target and resolves there as owner.
const T1 = id(101), OP1 = id(201)
const first = call({ operation: OP1, target: T1 })
assert.deepEqual(first, { ok: true, operation_id: OP1, source_estate_id: SOURCE, target_estate_id: T1, watermark_seq: 3, event_count: 3,
  state: 'estate_restored', access: 'verified', target_revision: 1, repeated: false })
assert.deepEqual(members(T1), [{ person: U, role: 'owner', revision: 1 }], 'only the restoring owner, fresh')
assert.equal(sql(`select count(*) from journal where estate_id=${uuid(T1)}`), '3')
assert.equal(sql(`select purpose from projects where estate_id=${uuid(T1)}`), 'Привет, 雪 и 😀')
assert.equal(sql(`select mode||':'||(authority_estate_id=${uuid(CONTROL)})||':'||(person_id=${uuid(U)}) from estate_restore_boundaries where target_estate_id=${uuid(T1)}`), 'verified:true:true')
assert.equal(JSON.parse(sql(`set role service_role;select read_estate_restore_boundary(${uuid(T1)},${uuid(U)},1)`)).mode, 'verified')
sql(`set role service_role;select rebuild_estate_projections(${uuid(T1)})`)
assert.deepEqual(members(T1), [{ person: U, role: 'owner', revision: 1 }], 'the archived founder gets no membership, even after rebuild')
pass('owner restores into a fresh Estate, owns it at revision 1; the archived founder is never a member, before or after rebuild')

// ── 2. A lost reply, retried with the same operation, returns the same receipt.
const again = call({ operation: OP1, target: T1 })
assert.deepEqual(again, { ...first, repeated: true })
assert.equal(sql(`select count(*) from estate_restore_boundaries where operation_id=${uuid(OP1)}`), '1')
refusedWithoutMutation('changed name, same operation', { operation: OP1, target: T1, name: 'Another name' }, 'idempotency_conflict')
refusedWithoutMutation('another target, same operation', { operation: OP1, target: id(102) }, 'idempotency_conflict')
pass('exact retry returns the original receipt; any change under the same operation is idempotency_conflict')

// ── 3. Two concurrent identical requests produce one target.
{
  const T = id(103), OP = id(203)
  const [a, b] = (await Promise.all([sqlAsync(restore({ operation: OP, target: T, archive: archiveOf(id(32)) })), sqlAsync(restore({ operation: OP, target: T, archive: archiveOf(id(32)) }))])).map(JSON.parse)
  assert.deepEqual([a.repeated, b.repeated].sort(), [false, true])
  assert.equal(a.target_estate_id, T); assert.equal(b.target_estate_id, T)
  assert.equal(sql(`select count(*) from estates where id=${uuid(T)}`), '1')
  assert.equal(sql(`select count(*) from journal where estate_id=${uuid(T)}`), '3')
}
pass('two concurrent identical requests: one target, one original receipt and one repeat')

// ── 4. The legacy marker is never upgraded.
{
  const L = id(104)
  sql(`insert into estates(id,name) values(${uuid(L)},'legacy shell');insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(L)},'owner');
   set role service_role;select restore_estate(${uuid(L)},${uuid(id(21))},'legacy',${jsonb(good.journal.trim().split('\n').map(l => JSON.parse(l)).map(e => ({ ...e, payload: e.type === 'project.created@1' ? { ...e.payload, id: id(31) } : e.payload, project_id: e.project_id ? id(31) : null })))})`)
  assert.equal(sql(`select mode from estate_restore_boundaries where target_estate_id=${uuid(L)}`), 'legacy_unverified')
  refusedWithoutMutation('verified restore onto a legacy target', { operation: id(204), target: L }, 'unavailable')
  assert.equal(sql(`select mode from estate_restore_boundaries where target_estate_id=${uuid(L)}`), 'legacy_unverified')
  assert.throws(() => sql(`update estate_restore_boundaries set mode='verified' where target_estate_id=${uuid(L)}`), /immutable/)
  assert.deepEqual(members(L), [{ person: U, role: 'owner', revision: 1 }], 'legacy restore still assigns no archived membership')
}
pass('a legacy boundary is never upgraded; the legacy entry point keeps its A0 guarantee over the shared body')

// ── 5. Refusals, each with zero mutation.
refusedWithoutMutation('member-only caller', { person: M, operation: id(205), target: id(105) }, 'unavailable')
refusedWithoutMutation('missing Person', { person: id(9), operation: id(206), target: id(106) }, 'unavailable')
refusedWithoutMutation('forged actor', { actor: { kind: 'person', id: M }, operation: id(207), target: id(107) }, 'unavailable')
refusedWithoutMutation('stale revision', { revision: 7, operation: id(208), target: id(108) }, 'unavailable')
refusedWithoutMutation('existing target', { operation: id(209), target: CONTROL }, 'unavailable')
{ const T = id(110); sql(`insert into estates(id,name) values(${uuid(T)},'someone else''s shell')`); refusedWithoutMutation('pre-existing shell', { operation: id(210), target: T }, 'unavailable') }
refusedWithoutMutation('source equals target', { operation: id(211), target: SOURCE }, 'invalid_archive')
refusedWithoutMutation('edited journal', { operation: id(212), target: id(112), archive: { ...good, journal: good.journal.replace('Atlas', 'Orbit') } }, 'integrity_mismatch')
refusedWithoutMutation('malformed manifest', { operation: id(213), target: id(113), archive: { ...good, manifest: { ...good.manifest, eventCount: 'three' } } }, 'invalid_archive')
// Collides after the shell, membership and boundary were written: every one rolls back.
refusedWithoutMutation('a project colliding with another Estate', { operation: id(214), target: id(114), archive: archiveOf(id(30)) }, 'unavailable')
assert.equal(sql(`select count(*) from estate_restore_boundaries where target_estate_id=${uuid(id(114))}`), '0')
pass('member, missing Person, forged actor, stale revision, existing target or shell, source=target, edited, malformed and colliding archives: refused, zero rows')

// ── 6. The revision moved by a concurrent change_membership: the restore waits, then refuses.
{
  const before = snapshot()
  const moving = sqlAsync(`begin;set role service_role;select change_membership(${uuid(id(300))},${uuid(CONTROL)},${uuid(U)},'owner','grant',1,'test: revision moves');select pg_sleep(1.5);commit;`)
  await new Promise(r => setTimeout(r, 400))
  const r = JSON.parse(await sqlAsync(restore({ operation: id(215), target: id(115), archive: archiveOf(id(33)) })))
  await moving
  assert.deepEqual(r, { ok: false, reason_code: 'unavailable' }, 'authority read under the row lock sees the moved revision')
  const after = JSON.parse(snapshot()), was = JSON.parse(before)
  assert.equal(after.estates, was.estates); assert.equal(after.boundaries, was.boundaries); assert.equal(after.journal, was.journal)
  assert.equal(sql(`select revision from memberships where estate_id=${uuid(CONTROL)} and person_id=${uuid(U)}`), '2')
  const retried = call({ revision: 2, operation: id(215), target: id(115), archive: archiveOf(id(33)) })
  assert.equal(retried.ok, true, 'the same operation succeeds once the caller holds the new revision')
}
pass('a revision moved by a concurrent change_membership is refused under the row lock, and the retry at the new revision succeeds')

console.log(`PASS restore_estate_verified: ${groups} groups on an owned cluster; active-Estate selection and restart NOT_RUN (A1-6, N1)`)
