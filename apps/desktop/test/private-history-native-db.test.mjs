// The private history service in main (first-slice plan A1-6a) over an owned PostgreSQL:
// a source database where history is written by the real CEO commands, and a second one the
// archive is restored into — two machines, one cluster. The ordinary archive is taken by the
// REAL backup.take over a psql-backed journal read; every RPC reaches the real migration 66.
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, rmSync, statSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ownedCluster, freshDatabase, lit, uuid, jsonb, id } from './archive-db-support.mjs'
import { createBackups } from '../src/main/backup.ts'
import { createPrivateHistory } from '../src/main/privateHistory.ts'

const cluster = ownedCluster()
const U = id(1), V = id(2), S = id(10), CB = id(20), P = id(40)
const actor = p => ({ kind: 'person', id: p })
const roots = []
let groups = 0
const pass = name => { groups++; console.log('PASS ' + name) }

/** A supabase-js shaped journal read, answered by psql, so the real `take` runs unchanged. */
function journalDb(c) {
  return { from: () => ({ select: () => ({ eq: (_col, estate) => ({ order: async () => {
    const rows = JSON.parse(c.sql(`select coalesce(jsonb_agg(jsonb_build_object('seq',seq,'type',type,'schema_rev',schema_rev,'actor',actor,'project_id',project_id,'run_id',run_id,'node_id',node_id,'payload',payload,
      'occurred_at',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'+00:00') order by seq),'[]') from journal where estate_id=${uuid(estate)}`))
    return { data: rows, error: null } } }) }) }) }
}
/** Named-argument RPC over psql; `drop` loses the reply AFTER the database answered. */
function rpcOver(c, faults = {}) {
  const typed = v => v === null ? 'null' : typeof v === 'object' ? jsonb(v) : typeof v === 'number' ? String(v) : /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(v) ? uuid(v) : lit(v)
  const calls = []
  const rpc = async (name, args) => {
    calls.push(name)
    const data = JSON.parse(c.sql(`set role service_role;select ${name}(${Object.entries(args).map(([k, v]) => `${k}=>${typed(v)}`).join(',')})`))
    if (faults[name] && faults[name]-- > 0) throw new Error('reply lost')
    return { data, error: null }
  }
  return { rpc, calls }
}
function service(c, who, faults) {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-private-history-')); roots.push(root)
  const { rpc, calls } = rpcOver(c, faults)
  const history = createPrivateHistory({ rootDir: root, identity: { held: () => who }, take: (e, dir) => createBackups(journalDb(c)).take(e, dir), rpc })
  return { history, calls, root }
}
const count = (c, table, estate) => Number(c.sql(`select count(*) from ${table}${estate ? ` where estate_id=${uuid(estate)}` : ''}`))

try {
  // ── the source machine: U owns S, with a project and a private conversation ───────
  const src = freshDatabase(cluster, 'native_source')
  src.sql(`insert into persons(id,display_name) values(${uuid(U)},'owner'),(${uuid(V)},'member');
  insert into estates(id,name) values(${uuid(S)},'source');
  insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(S)},'owner'),(${uuid(V)},${uuid(S)},'member');
  select append_event(${uuid(S)},'estate.created@1',${jsonb(actor(U))},${jsonb({ name: 'Source estate', owner_person_id: U })});
  select append_event(${uuid(S)},'project.created@1',${jsonb(actor(U))},${jsonb({ id: P, name: 'Atlas' })},'1',${uuid(P)});`)
  const G = id(100)
  src.rpc(`ceo_open_conversation(${uuid(S)},${uuid(U)},1,${jsonb(actor(U))},${uuid(id(500))},${uuid(G)},'global',${uuid(G)})`)
  const env = { schema: 'CeoSend@1', operation_id: id(600), conversation_id: G, message_id: id(700), expected_revision: 0, subject_revision: 0, input_channel: 'text',
    text: 'Что изменилось в Atlas?', preparation_version: 'har06-ceo-v1', context: { schema: 'CeoContext@1', mode: 'none', selection_revision: 0, project_id: null, project_revision: null, estate_seq: 0 } }
  assert.equal(src.rpc(`ceo_send_message(${uuid(S)},${uuid(U)},1,${jsonb(actor(U))},${jsonb(env)})`).ok, true)
  const onSource = service(src, { estateId: S, personId: U, revision: 1, actor: actor(U) })

  // ── 1. Export: three private files, complete or not at all ──────────────────────
  const exported = await onSource.history.exportHistory()
  assert.equal(exported.ok, true, JSON.stringify(exported))
  assert.deepEqual([exported.conversations, exported.messages], [1, 1])
  assert.deepEqual(readdirSync(exported.dir).sort(), ['ceo-private.json', 'journal.ndjson', 'manifest.json'])
  assert.equal(statSync(exported.dir).mode & 0o777, 0o700)
  for (const f of readdirSync(exported.dir)) assert.equal(statSync(path.join(exported.dir, f)).mode & 0o777, 0o600, f)
  assert.deepEqual(onSource.history.exports().map(e => e.dir), [exported.dir])
  assert.deepEqual(onSource.calls, ['ceo_export_private_archive'], 'export writes nothing to the database')
  const inspected = onSource.history.inspect(exported.dir)
  assert.equal(inspected.ok, true); assert.deepEqual(inspected.companion, { owner: U, conversations: 1, messages: 1 })
  pass('export takes the real ordinary archive, the SQL companion and the codec\'s decode into three private files')

  // A failed export leaves nothing that could be offered.
  {
    const denied = service(src, { estateId: S, personId: id(9), revision: 1, actor: actor(id(9)) })
    assert.equal((await denied.history.exportHistory()).reason_code, 'unavailable')
    assert.deepEqual(denied.history.exports(), [])
    assert.deepEqual(readdirSync(path.join(denied.root, 'private-history', 'exports')), [], 'no .partial directory left behind')
  }
  {
    const root = mkdtempSync(path.join(tmpdir(), 'fabric-private-history-')); roots.push(root)
    const broken = createPrivateHistory({ rootDir: root, identity: { held: () => ({ estateId: S, personId: U, revision: 1, actor: actor(U) }) },
      take: async () => ({ ok: false, says: 'journal unreadable' }), rpc: async () => { throw new Error('must not be called') } })
    assert.equal((await broken.exportHistory()).reason_code, 'unavailable')
    assert.deepEqual(readdirSync(path.join(root, 'private-history', 'exports')), [], 'a failed take leaves no .partial directory')
  }
  pass('a refused export leaves no partial directory and lists nothing')

  // ── the second machine: U owns a control Estate there ─────────────────────────────
  const b = freshDatabase(cluster, 'native_target')
  b.sql(`insert into persons(id,display_name) values(${uuid(U)},'owner'),(${uuid(V)},'member');
  insert into estates(id,name) values(${uuid(CB)},'control');insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(CB)},'owner');`)
  const who = { estateId: CB, personId: U, revision: 1, actor: actor(U) }

  // ── 2. Restore and import, with the reply lost at each step ─────────────────────
  {
    const onB = service(b, who, { restore_estate_verified: 1 })
    const first = await onB.history.restore(exported.dir, 'Restored Atlas')
    assert.deepEqual([first.ok, first.state, first.reason_code], [false, 'result_unknown', 'result_unknown'], 'the restore committed, its reply was lost')
    assert.equal(count(b, 'estate_restore_boundaries'), 1)
    const again = await onB.history.check(first.operation_id)
    assert.equal(again.ok, true, JSON.stringify(again))
    assert.equal(count(b, 'estate_restore_boundaries'), 1, 'check repeated the same restore; no second target')
    assert.equal(count(b, 'ceo_messages', again.target_estate_id), 1)
    assert.equal(b.sql(`select envelope->>'text' from ceo_private_contents where estate_id=${uuid(again.target_estate_id)}`), 'Что изменилось в Atlas?')
    assert.equal(count(b, 'ceo_pending_requests'), 0)
    assert.equal(count(b, 'memberships', again.target_estate_id), 1)
    assert.deepEqual(await onB.history.check(first.operation_id), again, 'a later check returns the same result')
    assert.deepEqual(onB.history.restored(), [again.target_estate_id], 'a completed restore is the one Estate that may be opened')
    assert.deepEqual(onB.calls, ['restore_estate_verified', 'restore_estate_verified', 'ceo_import_private_archive'])
  }
  pass('a lost restore reply is resolved by the same operation: one target, history imported, zero pending requests')
  {
    const c = freshDatabase(cluster, 'native_target_import_lost')
    c.sql(`insert into persons(id,display_name) values(${uuid(U)},'owner');insert into estates(id,name) values(${uuid(CB)},'control');insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(CB)},'owner');`)
    const onC = service(c, who, { ceo_import_private_archive: 1 })
    const first = await onC.history.restore(exported.dir, 'Restored Atlas')
    assert.equal(first.state, 'result_unknown')
    assert.equal(count(c, 'ceo_private_import_receipts'), 1, 'the import committed, its reply was lost')
    const again = await onC.history.check(first.operation_id)
    assert.equal(again.ok, true); assert.equal(count(c, 'ceo_private_import_receipts'), 1); assert.equal(count(c, 'ceo_messages'), 1)
  }
  pass('a lost import reply is resolved by the same import operation: one receipt, one copy of each message')

  // ── 3. Refusals ─────────────────────────────────────────────────────────────────
  {
    const c = freshDatabase(cluster, 'native_target_refusals')
    c.sql(`insert into persons(id,display_name) values(${uuid(U)},'owner'),(${uuid(V)},'member');insert into estates(id,name) values(${uuid(CB)},'control');
     insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(CB)},'owner'),(${uuid(V)},${uuid(CB)},'member');`)
    const asV = service(c, { estateId: CB, personId: V, revision: 1, actor: actor(V) })
    assert.equal((await asV.history.restore(exported.dir, 'x')).reason_code, 'unavailable', "another Person's history is never imported")
    assert.deepEqual(asV.calls, [], 'refused before any database call')
    const onC = service(c, who)
    assert.equal((await onC.history.restore(path.join(exported.dir, 'missing'), 'x')).reason_code, 'not_found')
    assert.equal((await onC.history.check(id(999))).reason_code, 'not_found', 'an unknown operation is not a new one')
    assert.deepEqual(onC.history.restored(), [], 'a refused restore opens nothing')
    assert.equal(onC.history.inspect(exported.dir + '.partial').reason_code, 'not_found')
    assert.equal(count(c, 'estate_restore_boundaries'), 0)
    const noone = service(c, null)
    assert.equal((await noone.history.restore(exported.dir, 'x')).reason_code, 'unavailable')
  }
  pass("another Person's archive, a missing directory, an unknown operation and no held identity: refused, zero rows")

  console.log(`PASS private history in main: ${groups} groups on an owned cluster; the running app NOT_RUN (N1)`)
} finally { for (const r of roots) rmSync(r, { recursive: true, force: true }) }
