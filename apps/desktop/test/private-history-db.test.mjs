// Private export, import and receipt (first-slice plan A1-4, ADR-0079 §4) on separate
// databases inside one owned cluster: a source, B1–B4 and C. History is written by the real
// ceo_open_conversation and ceo_send_message; the ordinary archive is taken the way
// backup.take takes it; the exported companion is decoded by the native codec.
import assert from 'node:assert/strict'
import { ownedCluster, connect, freshDatabase, journalLines, lit, uuid, jsonb, id } from './archive-db-support.mjs'
import { ordinary } from './fixtures/ceo-private-archive/vectors.mjs'
import { decodePrivateArchive } from '../src/main/ceoPrivateArchive.ts'

const cluster = ownedCluster()
let groups = 0
const pass = name => { groups++; console.log('PASS ' + name) }
const U = id(1), V = id(2), S = id(10), P = id(40)
const actor = p => ({ kind: 'person', id: p })
const CANARY = 'SERVICE_TOKEN=syntheticImportCanary'

// ── source: an Estate with a project, and two Persons' private history ──────────
const src = freshDatabase(cluster, 'archive_source')
src.sql(`insert into persons(id,display_name) values(${uuid(U)},'owner'),(${uuid(V)},'member');
insert into estates(id,name) values(${uuid(S)},'source');
insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(S)},'owner'),(${uuid(V)},${uuid(S)},'member');
select append_event(${uuid(S)},'estate.created@1',${jsonb(actor(U))},${jsonb({ name: 'Source estate', owner_person_id: U })});
select append_event(${uuid(S)},'project.created@1',${jsonb(actor(U))},${jsonb({ id: P, name: 'Atlas', purpose: 'the project' })},'1',${uuid(P)});`)
const maxSeq = c => Number(c.sql(`select coalesce(max(seq),0) from journal where estate_id=${uuid(S)}`))
const open = (c, e, person, op, conversation, kind, subject) => c.rpc(`ceo_open_conversation(${uuid(e)},${uuid(person)},1,${jsonb(actor(person))},${uuid(op)},${uuid(conversation)},${lit(kind)},${uuid(subject)})`)
const envelope = (op, conversation, message, expected, text, context = { schema: 'CeoContext@1', mode: 'none', selection_revision: 0, project_id: null, project_revision: null, estate_seq: 0 }, subject_revision = 0) =>
  ({ schema: 'CeoSend@1', operation_id: op, conversation_id: conversation, message_id: message, expected_revision: expected, subject_revision,
    input_channel: 'text', text, preparation_version: 'har06-ceo-v1', context })
const send = (c, e, person, env) => c.rpc(`ceo_send_message(${uuid(e)},${uuid(person)},1,${jsonb(actor(person))},${jsonb(env)})`)
const G = id(100), PC = id(101), VG = id(110)
assert.equal(open(src, S, U, id(500), G, 'global', G).ok, true)
const m1 = envelope(id(600), G, id(700), 0, 'Первое сообщение: 雪 и 😀\nвторая строка')
const m2 = envelope(id(601), G, id(701), 1, 'Второе, с разделителем строк')
assert.equal(send(src, S, U, m1).ok, true); assert.equal(send(src, S, U, m2).ok, true)
assert.equal(open(src, S, U, id(501), PC, 'project', P).ok, true)
const projectRevision = Number(src.sql(`select config_revision from projects where id=${uuid(P)}`))
const m3 = envelope(id(602), PC, id(702), 0, 'Что изменилось в Atlas?',
  { schema: 'CeoContext@1', mode: 'one', selection_revision: 1, project_id: P, project_revision: projectRevision, estate_seq: maxSeq(src) }, projectRevision)
assert.equal(send(src, S, U, m3).ok, true, 'project message')
const alias = open(src, S, U, id(502), id(199), 'project', P)
assert.equal(alias.conversation_id, PC, 'an alias resolves to the canonical conversation')
assert.equal(open(src, S, V, id(510), VG, 'global', VG).ok, true)
assert.equal(send(src, S, V, envelope(id(610), VG, id(710), 0, 'Сообщение участника ' + CANARY)).ok, true)
const ordinaryOf = (c, e) => ordinary(e, journalLines(c, e), { takenAtUtc: '2026-09-28T10:00:00.000Z' })
const exportFrom = (c, e, person, archive, revision = 1) => c.rpc(`ceo_export_private_archive(${uuid(e)},${uuid(person)},${revision},${jsonb(archive.manifest)},${lit(archive.journal)})`)

// ── 1. Export: read-only, one snapshot, decoded by the native codec. ─────────────
{
  const stale = ordinaryOf(src, S)
  assert.equal(send(src, S, U, envelope(id(603), G, id(703), 2, 'Третье, после снимка')).ok, true)
  assert.deepEqual(exportFrom(src, S, U, stale), { ok: false, reason_code: 'archive_stale' }, 'a writer advanced the journal')
}
const A0 = ordinaryOf(src, S)
const exportU = exportFrom(src, S, U, A0), exportV = exportFrom(src, S, V, A0)
assert.equal(exportU.ok, true); assert.equal(exportV.ok, true)
assert.equal(exportU.archive.source_schema_version, 73, 'an export names the schema it was taken from (migration 73)')
const bytes = a => new TextEncoder().encode(JSON.stringify(a))
const decodedU = decodePrivateArchive(bytes(exportU.archive)), decodedV = decodePrivateArchive(bytes(exportV.archive))
assert.equal(decodedU.digest, exportU.archive.archive_digest, 'SQL and the codec agree on the digest of a real export')
assert.deepEqual([decodedU.archive.conversations.length, decodedU.archive.messages.length, decodedU.archive.operations.length], [2, 4, 7])
assert.deepEqual([decodedV.archive.conversations.length, decodedV.archive.messages.length], [1, 1])
assert.ok(decodedU.archive.operations.some(o => o.kind === 'open' && o.requested_conversation_id === id(199) && o.receipt.conversation_id === PC), 'the open alias keeps its requested id')
assert.ok(!JSON.stringify(exportU.archive).includes('syntheticImportCanary'), "one Person's export holds nobody else's text")
assert.deepEqual(exportFrom(src, S, id(9), A0), { ok: false, reason_code: 'unavailable' })
{
  const edited = { ...A0, journal: A0.journal.replace('Source estate', 'Other estate') }
  const resealed = ordinary(S, edited.journal.trim().split('\n'), { takenAtUtc: '2026-09-28T10:00:00.000Z' })
  assert.deepEqual(exportFrom(src, S, U, resealed), { ok: false, reason_code: 'integrity_mismatch' }, 'a re-sealed journal that is not this Estate\'s')
}
assert.equal(src.sql(`select count(*) from ceo_private_import_receipts`), '0')
pass('export: stale refused, real history decodes in the codec with the same digest, alias and ownership kept, foreign and re-sealed journals refused')

// ── restore into a target database, as ADR-0079 §2 requires ────────────────────
function target(name, { control = id(20), targetEstate = id(30), archive = A0, restoreOp = id(800), members = [V] } = {}) {
  const c = freshDatabase(cluster, name)
  c.sql(`insert into persons(id,display_name) values(${uuid(U)},'owner'),(${uuid(V)},'member');
   insert into estates(id,name) values(${uuid(control)},'control');insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(control)},'owner');`)
  const r = c.rpc(`restore_estate_verified(${uuid(control)},${uuid(U)},1,${jsonb(actor(U))},${uuid(restoreOp)},${uuid(targetEstate)},${jsonb(archive.manifest)},${lit(archive.journal)},${lit('Restored')})`)
  assert.equal(r.ok, true, 'verified restore into ' + name)
  for (const m of members) assert.equal(c.rpc(`change_membership(${uuid(id(900 + m.slice(-1).charCodeAt(0)))},${uuid(targetEstate)},${uuid(m)},'member','grant',null,'test: fresh member')`).status, 'committed')
  return { c, T: targetEstate, restoreOp }
}
const importInto = ({ c, T, restoreOp }, person, archive, op, restore = restoreOp) =>
  c.rpc(`ceo_import_private_archive(${uuid(T)},${uuid(person)},1,${jsonb(actor(person))},${uuid(op)},${uuid(restore)},${jsonb(archive)})`)
const counts = c => JSON.parse(c.sql(`select jsonb_build_object('conversations',(select count(*) from ceo_conversations),'contents',(select count(*) from ceo_private_contents),
  'messages',(select count(*) from ceo_messages),'operations',(select count(*) from ceo_operations),'pending',(select count(*) from ceo_pending_requests),
  'receipts',(select count(*) from ceo_private_import_receipts),'provenance',(select count(*) from ceo_content_provenance),'journal',(select count(*) from journal),
  'authorizations',(select count(*) from ceo_write_authorizations))`))
const read = ({ c, T }, person, conversation) => c.rpc(`ceo_read_conversation(${uuid(T)},${uuid(person)},1,${uuid(conversation)},0,50)`)

// ── 2. Two owners, in both orders; neither can read the other. ─────────────────
const expectedU = { ok: true, archive_id: exportU.archive.archive_id, source_estate_id: S, conversations: 2, messages: 4, operations: 7, state: 'history_restored', dispatch: 'unavailable', repeated: false }
for (const [name, order] of [['archive_b1', [U, V]], ['archive_b2', [V, U]]]) {
  const t = target(name)
  const before = counts(t.c)
  for (const person of order) {
    const r = importInto(t, person, person === U ? exportU.archive : exportV.archive, id(person === U ? 850 : 851))
    assert.equal(r.ok, true, `${name}: ${person} imports`)
    if (person === U) assert.deepEqual({ ...r, operation_id: undefined, restore_operation_id: undefined, target_estate_id: undefined },
      { ...expectedU, operation_id: undefined, restore_operation_id: undefined, target_estate_id: undefined })
  }
  const after = counts(t.c)
  assert.equal(after.pending, 0, 'no pending request is restored'); assert.equal(after.authorizations, 0)
  assert.equal(after.journal, before.journal, 'import appends no journal event')
  assert.equal(after.messages - before.messages, 5)
  const mine = read(t, U, G)
  assert.deepEqual(mine.messages.map(m => m.envelope.text), [m1.text, m2.text, 'Третье, после снимка'], 'text is exactly as written')
  assert.equal(read(t, V, G).reason_code, 'unavailable', "a member cannot read the owner's conversation")
  assert.equal(read(t, U, VG).reason_code, 'unavailable', "the owner cannot read the member's conversation")
  if (name === 'archive_b1') globalThis.B1 = t
}
pass('two owners import in both orders into one restored Estate; zero pending requests, no journal event; neither can read the other')

// ── 3. Concurrent imports by the two owners. ─────────────────────────────────────
{
  const t = target('archive_b3')
  const [a, b] = (await Promise.all([
    t.c.sqlAsync(`set role service_role;select ceo_import_private_archive(${uuid(t.T)},${uuid(U)},1,${jsonb(actor(U))},${uuid(id(850))},${uuid(t.restoreOp)},${jsonb(exportU.archive)})`),
    t.c.sqlAsync(`set role service_role;select ceo_import_private_archive(${uuid(t.T)},${uuid(V)},1,${jsonb(actor(V))},${uuid(id(851))},${uuid(t.restoreOp)},${jsonb(exportV.archive)})`)])).map(JSON.parse)
  assert.equal(a.ok, true); assert.equal(b.ok, true)
  assert.equal(counts(t.c).receipts, 2)
}
pass('concurrent imports by two owners both commit, each once')

// ── 4. Lost reply, receipt, retry, and a repeated historical send. ────────────────
{
  const t = globalThis.B1
  const original = t.c.rpc(`ceo_private_import_receipt(${uuid(t.T)},${uuid(U)},1,${uuid(id(850))})`)
  assert.equal(original.ok, true); assert.equal(original.repeated, true)
  const retry = importInto(t, U, exportU.archive, id(850))
  assert.deepEqual(retry, original, 'the retry returns the original receipt')
  assert.deepEqual(t.c.rpc(`ceo_private_import_receipt(${uuid(t.T)},${uuid(U)},1,${uuid(id(859))})`), { ok: false, reason_code: 'not_found' })
  const before = counts(t.c)
  assert.deepEqual(importInto(t, U, exportU.archive, id(852)), { ok: false, reason_code: 'idempotency_conflict' }, 'a second import for the same Person')
  const historical = t.c.rpc(`ceo_send_message(${uuid(t.T)},${uuid(U)},1,${jsonb(actor(U))},${jsonb(m1)})`)
  assert.equal(historical.repeated, true, 'a repeated historical send is answered from the imported operation')
  assert.deepEqual(counts(t.c), before, 'and creates no pending row')
}
pass('lost reply → receipt → retry returns the original; not_found for an unknown operation; a second import conflicts; a historical repeat creates no pending row')

// ── 5. A→B→C: export from the restored Estate, restore and import again. ────────────
{
  const t = globalThis.B1, AB = ordinaryOf(t.c, t.T)
  const second = exportFrom(t.c, t.T, U, AB)
  assert.equal(second.ok, true, 'export from B')
  const d = decodePrivateArchive(bytes(second.archive))
  assert.ok(d.archive.messages.every(m => m.origin.estate_id === S), 'the original Estate travels')
  assert.ok(d.archive.messages.every(m => m.source_digest !== exportU.archive.messages.find(x => x.id === m.id).source_digest), 'the source digest is re-bound to B')
  const c = target('archive_c', { control: id(21), targetEstate: id(31), archive: AB, restoreOp: id(801), members: [] })
  assert.equal(importInto(c, U, second.archive, id(853)).ok, true, 'import into C')
  assert.equal(c.c.sql(`select count(*) from ceo_content_provenance where origin_estate_id=${uuid(S)} and source_estate_id=${uuid(t.T)}`), '4')
  assert.deepEqual(read(c, U, G).messages.map(m => m.envelope.text), [m1.text, m2.text, 'Третье, после снимка'])
  for (const db of [src, t.c, c.c]) assert.equal(db.sql(`select count(*) from journal where payload::text like '%syntheticImportCanary%' or actor::text like '%syntheticImportCanary%'`), '0', 'the journal carries no private text')
}
pass('A→B→C keeps the original Estate, re-binds the source digest, and no journal holds private text')

// ── 6. Refusals, each leaving zero rows. ────────────────────────────────────────
{
  const t = target('archive_b4')
  const seal = a => ({ ...a, archive_digest: t.c.sql(`select ceo_private_archive_digest(${jsonb(a)})`) })
  const refused = (label, archive, code, op = id(860), restore = t.restoreOp, person = U) => {
    const before = counts(t.c), r = importInto(t, person, archive, op, restore)
    assert.deepEqual(r, { ok: false, reason_code: code }, label)
    assert.deepEqual(counts(t.c), before, label + ' left rows behind')
  }
  const a = exportU.archive, edit = fn => { const x = structuredClone(a); fn(x); return x }
  refused('edited without recompute', edit(x => { x.messages[0].envelope.text = 'изменено' }), 'integrity_mismatch')
  refused('truncated and re-sealed', seal(edit(x => { x.messages.pop() })), 'invalid_archive')
  refused('text edited and the archive re-sealed', seal(edit(x => { x.messages[0].envelope.text = 'изменено' })), 'integrity_mismatch')
  refused('a message the journal does not attest, re-sealed', seal(edit(x => { x.messages[0].request_id = id(999) })), 'invalid_archive')
  refused('foreign: another Person\'s archive', exportV.archive, 'unavailable')
  refused('malformed: a key removed', edit(x => { delete x.retention }), 'invalid_archive')
  refused('deep: nested structure where a string belongs', edit(x => { x.messages[0].envelope.context.schema = JSON.parse('['.repeat(40) + ']'.repeat(40)) }), 'invalid_archive')
  refused('oversize: too many conversations', edit(x => { x.conversations = Array(257).fill(x.conversations[0]) }), 'too_large')
  refused('wrong manifest', seal(edit(x => { x.estate_archive = { ...x.estate_archive, takenAtUtc: '2026-09-28T11:00:00.000Z' } })), 'invalid_archive')
  refused('wrong target restore operation', a, 'unavailable', id(861), id(899))
  // A partial collision: one conversation id already exists globally, in another Estate.
  t.c.sql(`insert into estates(id,name) values(${uuid(id(50))},'elsewhere');insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(id(50))},'owner')`)
  assert.equal(open(t.c, id(50), U, id(520), G, 'global', G).ok, true)
  refused('partial collision', a, 'unavailable', id(862))
  // The target moved on after its restore: the prefix is no longer the archive's.
  t.c.sql(`select append_event(${uuid(t.T)},'project.updated@1',${jsonb(actor(U))},${jsonb({ id: P, purpose: 'changed after restore' })},'1',${uuid(P)})`)
  refused('target journal advanced after the restore', a, 'archive_stale', id(864))
  const other = target('archive_b5')
  // A forced failure after the first insert rolls every row back.
  other.c.sql(`create function test_forced_failure() returns trigger language plpgsql as $$begin raise exception 'forced failure' using errcode='check_violation'; end$$;
   create trigger test_forced_failure before insert on ceo_content_provenance for each row execute function test_forced_failure();`)
  const before = counts(other.c)
  assert.deepEqual(importInto(other, U, a, id(863)), { ok: false, reason_code: 'unavailable' }, 'forced failure after the first insert')
  assert.deepEqual(counts(other.c), before, 'the forced failure left rows behind')
  other.c.sql('drop trigger test_forced_failure on ceo_content_provenance;drop function test_forced_failure()')
  assert.equal(importInto(other, U, a, id(863)).ok, true, 'the same operation succeeds once the fault is gone')
  // A raw append cannot forge a receipt.
  assert.throws(() => other.c.sql(`set role service_role;select append_event(${uuid(other.T)},'ceo.message.accepted@1',${jsonb(actor(U))},${jsonb({ conversation_id: G, operation_id: id(1), message_id: id(2), request_id: id(3), content_id: id(4) })})`), /CEO private commands|permission denied/)
}
pass('edited (with and without re-sealing), truncated, unattested, stale-target, foreign, malformed, deep, oversize, wrong-manifest, wrong-target and colliding archives, a forced mid-import failure and a raw append: refused, zero rows')

console.log(`PASS private export, import and receipt: ${groups} groups across 7 databases of one owned cluster; native file handling NOT_RUN (A1-6)`)
