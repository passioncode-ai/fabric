// CeoPrivateArchive@1 codec freeze (first-slice plan A1-1).
//
// Golden vectors are frozen FILES: `fixtures/ceo-private-archive/*.archive.json` holds the
// exact bytes, `*.expected.json` the canonical string and SHA-256 they must produce. This
// test decodes the bytes and compares; it never regenerates the expectation, so a codec
// change that moves one canonical byte fails here, and A1-2 holds SQL to the same files.
// Every negative names the one reason code it must refuse with.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { canonicalCeoSend } from '../src/shared/ceoConversation.ts'
import { ARCHIVE_REASON_CODES, ArchiveFormatError, parseArchiveJson, decodeArchiveUtf8 } from '../src/main/archiveJson.ts'
import { decodePrivateArchive, preflightOrdinaryArchive, historicalCeoSendCanonical, privateArchiveCanonical, PRIVATE_ARCHIVE_LIMITS } from '../src/main/ceoPrivateArchive.ts'
import { goldenVectors, bytes, seal, id, sha, envelope, ordinary, line, A, OTHER_PERSON } from './fixtures/ceo-private-archive/vectors.mjs'

const dir = path.join(import.meta.dirname, 'fixtures', 'ceo-private-archive')
const enc = s => new TextEncoder().encode(s)
const code = fn => { try { fn(); return 'accepted' } catch (e) { if (e instanceof ArchiveFormatError) return e.code; throw e } }
let checks = 0
const refuses = (label, fn, expected) => { assert.equal(code(fn), expected, label); checks++ }

// ── 1. The reason-code vocabulary is the one SQL uses (A1-2 asserts the same list).
assert.deepEqual([...ARCHIVE_REASON_CODES], ['invalid_json', 'too_large', 'invalid_archive', 'integrity_mismatch',
  'unsupported_schema', 'archive_stale', 'idempotency_conflict', 'not_found', 'unavailable'])

// ── 2. The historical envelope canonical is migration 64's, byte for byte.
// The existing CeoSend vector from ceo-conversation-db.test.mjs, where SQL produced it.
const golden = { schema: 'CeoSend@1', operation_id: id(3), conversation_id: id(4), message_id: id(5), expected_revision: 0, subject_revision: 0,
  input_channel: 'text', text: 'Привет\n雪: | 😀', preparation_version: 'har06-ceo-v1',
  context: { schema: 'CeoContext@1', mode: 'none', selection_revision: 0, project_id: null, project_revision: null, estate_seq: 0 } }
assert.equal(sha(historicalCeoSendCanonical(id(1), id(2), golden)), 'dffdd4f0c485a4e9fa2bc459e63fb501f7ad37017d4a61d5fb6ea7a1ce864b9d')
// Two implementations of one framing agree where both apply (the prepared path cannot
// take text it would scrub; the historical path must take it unchanged).
for (const text of ['one line', 'Привет, 雪 и 😀', 'a\nb']) {
  const e = { ...golden, text }
  assert.equal(historicalCeoSendCanonical(id(1), id(2), e), canonicalCeoSend(id(1), id(2), e))
}
const secret = { ...golden, text: 'SERVICE_TOKEN=syntheticSecretCanary' }
assert.ok(historicalCeoSendCanonical(id(1), id(2), secret).includes('syntheticSecretCanary'), 'historical text is never scrubbed')

// ── 3. Golden vectors: frozen bytes → frozen canonical and digest.
const names = readdirSync(dir).filter(f => f.endsWith('.archive.json')).map(f => f.slice(0, -'.archive.json'.length)).sort()
assert.deepEqual(names, ['empty', 'global-null-owner-project', 'origin-a-b-c', 'project-mode-none', 'project-open-alias', 'question', 'unicode-newlines'])
for (const name of names) {
  const raw = readFileSync(path.join(dir, name + '.archive.json'))
  const expected = JSON.parse(readFileSync(path.join(dir, name + '.expected.json'), 'utf8'))
  const got = decodePrivateArchive(raw)
  assert.equal(got.canonical, expected.canonical, name + ' canonical')
  assert.equal(got.digest, expected.sha256, name + ' digest')
  assert.equal(createHash('sha256').update(expected.canonical, 'utf8').digest('hex'), expected.sha256, name + ' expected file is self-consistent')
  checks++
}
// The empty vector's canonical, framed by hand here rather than by the codec.
{
  const e = JSON.parse(readFileSync(path.join(dir, 'empty.archive.json'), 'utf8')), m = e.estate_archive
  const f = v => v === null ? '-1:' : `${Buffer.byteLength(String(v))}:${v}`
  const hand = ['CeoPrivateArchive@1', e.archive_id, 66, e.owner_person_id, 'FabricArchive@1', m.sourceEstateId, m.takenAtUtc,
    m.watermarkSeq, m.eventCount, m.digest, 'no-deletion-v1', 0, 0, 0, 0].map(f).join('')
  assert.equal(decodePrivateArchive(readFileSync(path.join(dir, 'empty.archive.json'))).canonical, hand)
}
// Text survives exactly: U+2028, CRLF and astral characters are not normalised.
{
  const got = decodePrivateArchive(readFileSync(path.join(dir, 'unicode-newlines.archive.json')))
  assert.deepEqual(got.archive.messages.map(m => m.envelope.text), ['Привет, 雪 и 😀\nвторая строка', 'разделитель\u2028строк и\r\nCRLF'])
  const relay = decodePrivateArchive(readFileSync(path.join(dir, 'origin-a-b-c.archive.json'))).archive
  assert.notEqual(relay.messages[0].origin.estate_id, relay.estate_archive.sourceEstateId, 'A→B→C keeps the original Estate')
}

// ── 4. Ordinary archive digest corpus: the existing FabricArchive@1 algorithm.
for (const name of ['journal-empty', 'journal-one-line', 'journal-many-lines', 'journal-decimal-seq']) {
  const manifest = readFileSync(path.join(dir, name + '.manifest.json')), journal = readFileSync(path.join(dir, name + '.journal.ndjson'))
  const expected = JSON.parse(readFileSync(path.join(dir, name + '.expected.json'), 'utf8'))
  const got = preflightOrdinaryArchive(manifest, journal)
  assert.equal(got.manifest.digest, expected.sha256, name)
  assert.equal(got.events.length, got.manifest.eventCount, name)
  checks++
}

// The digest is over the ORIGINAL bytes, not a re-encoding: a line spelled with spaces and
// another key order is accepted when its digest matches those exact bytes.
{
  const spaced = '{ "seq": 1, "type": "estate.created@1", "schema_rev": "1", "actor": {"kind":"operator"}, "project_id": null, "run_id": null, "node_id": null, "payload": {"b":1,"a":2}, "occurred_at": "2026-09-28T08:00:00.000000+00:00" }'
  const o = ordinary(A, [spaced])
  assert.equal(code(() => preflightOrdinaryArchive(enc(JSON.stringify(o.manifest)), enc(o.journal))), 'accepted', 'original bytes, not a re-encoding')
  checks++
}

// ── 5. Budgets: one definition (root depth 1, every value a node, keys are not nodes).
const nest = d => '['.repeat(d - 1) + '0' + ']'.repeat(d - 1)
assert.equal(code(() => parseArchiveJson(nest(32), { maxDepth: 32 })), 'accepted')
refuses('depth 33 of 32', () => parseArchiveJson(nest(33), { maxDepth: 32 }), 'too_large')
assert.equal(code(() => parseArchiveJson('[1,2]', { budget: { nodes: 3 } })), 'accepted')
refuses('four nodes in a budget of three', () => parseArchiveJson('[1,[2]]', { budget: { nodes: 3 } }), 'too_large')
assert.equal(code(() => parseArchiveJson('{"a":1,"b":2}', { budget: { nodes: 3 } })), 'accepted', 'object keys are not nodes')
refuses('shared budget across calls', () => { const b = { nodes: 2 }; parseArchiveJson('[1]', { budget: b }); parseArchiveJson('1', { budget: b }) }, 'too_large')

// ── 6. Numbers: the companion takes canonical safe integers only.
for (const [spelling, label] of [['1.0', 'decimal point'], ['1e0', 'exponent'], ['-0', 'negative zero'], ['01', 'leading zero'], ['9007199254740992', 'unsafe']])
  refuses('companion number ' + label, () => parseArchiveJson(`{"n":${spelling}}`, { numbers: 'integers' }), 'invalid_json')
assert.equal(code(() => parseArchiveJson('{"cost":0.5,"n":1.0}', { numbers: 'lossless' })), 'accepted', 'journal payloads keep their numbers')
refuses('journal lossy number', () => parseArchiveJson('{"n":0.1000000000000000055511151231257827}', { numbers: 'lossless' }), 'invalid_json')

// ── 7. Negatives over a valid archive, each with its frozen reason code.
const base = () => structuredClone(goldenVectors()['unicode-newlines'])
const decode = obj => decodePrivateArchive(bytes(obj))
const mutate = (fn, doSeal = true) => { const a = base(); fn(a); return doSeal ? seal(a) : a }
assert.equal(code(() => decode(base())), 'accepted')
const raw = new TextDecoder().decode(bytes(base()))
refuses('duplicate key', () => decodePrivateArchive(enc(raw.replace('"retention": "no-deletion-v1"', '"retention": "no-deletion-v1", "retention": "no-deletion-v1"'))), 'invalid_json')
refuses('invalid UTF-8', () => decodePrivateArchive(new Uint8Array([...bytes(base()).slice(0, -2), 0xc3, 0x28, 0x7d])), 'invalid_json')
refuses('BOM', () => decodePrivateArchive(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes(base())])), 'invalid_json')
refuses('lone surrogate', () => decodePrivateArchive(enc(raw.replace('Привет', '\\ud800'))), 'invalid_json')
refuses('NUL', () => decodePrivateArchive(enc(raw.replace('Привет', '\\u0000'))), 'invalid_json')
refuses('truncation', () => decodePrivateArchive(enc(raw.slice(0, raw.length / 2))), 'invalid_json')
refuses('wrong row order', () => decode(mutate(a => { a.messages.reverse() })), 'invalid_archive')
refuses('duplicate message id', () => decode(mutate(a => { a.messages[1].id = a.messages[0].id })), 'invalid_archive')
refuses('duplicate ordinal', () => decode(mutate(a => { a.messages[1].ordinal = 1 })), 'invalid_archive')
refuses('invalid UUID', () => decode(mutate(a => { a.archive_id = 'not-a-uuid' })), 'invalid_archive')
refuses('negative number', () => decode(mutate(a => { a.messages[0].ordinal = -1 })), 'invalid_archive')
refuses('non-canonical number', () => decodePrivateArchive(enc(raw.replace('"ordinal": 2', '"ordinal": 2.0'))), 'invalid_json')
refuses('unsafe number', () => decodePrivateArchive(enc(raw.replace('"ordinal": 2', '"ordinal": 9007199254740993'))), 'invalid_json')
refuses('missing ordinal', () => decode(mutate(a => { delete a.messages[0].ordinal })), 'invalid_archive')
refuses('missing body', () => decode(mutate(a => { a.messages[0].envelope.text = '   ' })), 'invalid_archive')
refuses('missing message', () => decode(mutate(a => { a.messages.pop() })), 'invalid_archive')
refuses('unknown field', () => decode(mutate(a => { a.messages[0].extra = true })), 'invalid_archive')
refuses('unknown subtype', () => decode(mutate(a => { a.operations[0].kind = 'close' })), 'invalid_archive')
refuses('depth exceeded', () => decode(mutate(a => { a.messages[0].envelope.context.schema = JSON.parse(nest(40)) }, false)), 'too_large')
refuses('oversize', () => decodePrivateArchive(new Uint8Array(PRIVATE_ARCHIVE_LIMITS.privateBytes + 1)), 'too_large')
refuses('edited bytes without recompute', () => decode(mutate(a => { a.messages[0].envelope.text = 'изменено' }, false)), 'integrity_mismatch')
refuses('edited header without recompute', () => decode(mutate(a => { a.archive_id = id(8999) }, false)), 'integrity_mismatch')
refuses('wrong schema', () => decode(mutate(a => { a.schema = 'CeoPrivateArchive@2' })), 'unsupported_schema')
refuses('wrong source schema', () => decode(mutate(a => { a.source_schema_version = 65 })), 'unsupported_schema')
refuses('an unqualified later source schema', () => decode(mutate(a => { a.source_schema_version = 70 })), 'unsupported_schema')
assert.equal(decode(mutate(a => { a.source_schema_version = 67 })).archive.source_schema_version, 67, 'schema 67 is a qualified source (migration 67)'); checks++
assert.equal(decode(mutate(a => { a.source_schema_version = 68 })).archive.source_schema_version, 68, 'schema 68 is a qualified source (migration 68)'); checks++
assert.equal(decode(mutate(a => { a.source_schema_version = 69 })).archive.source_schema_version, 69, 'schema 69 is a qualified source (migration 69)'); checks++
refuses('wrong preparation version', () => decode(mutate(a => { a.messages[0].envelope.preparation_version = 'har07' })), 'unsupported_schema')
refuses('companion seq as a decimal string', () => decode(mutate(a => { a.messages[0].accepted_seq = String(a.messages[0].accepted_seq) })), 'invalid_archive')
refuses('conversation seq as a decimal string', () => decode(mutate(a => { a.conversations[0].created_seq = String(a.conversations[0].created_seq) })), 'invalid_archive')
refuses('non-empty tombstones', () => decode(mutate(a => { a.tombstones = [{ id: id(1) }] })), 'invalid_archive')
refuses('foreign Person', () => decode(mutate(a => { a.owner_person_id = OTHER_PERSON })), 'integrity_mismatch')

// ── 8. Ordinary journal negatives, digest recomputed so each reaches its own check.
const journalCase = (lines, over = {}) => { const o = ordinary(A, lines); return [enc(JSON.stringify({ ...o.manifest, ...over })), enc(o.journal)] }
const [okManifest, okJournal] = journalCase([line(1), line(2)])
assert.equal(code(() => preflightOrdinaryArchive(okManifest, okJournal)), 'accepted')
refuses('journal CRLF', () => preflightOrdinaryArchive(okManifest, enc(new TextDecoder().decode(okJournal).replace('\n', '\r\n'))), 'invalid_archive')
refuses('journal missing final LF', () => preflightOrdinaryArchive(okManifest, okJournal.slice(0, -1)), 'invalid_archive')
{
  const o = ordinary(A, [line(1), '', line(3)], { watermarkSeq: 3 })
  refuses('journal blank row', () => preflightOrdinaryArchive(enc(JSON.stringify(o.manifest)), enc(o.journal)), 'invalid_archive')
}
{
  const cut = line(2).slice(0, 20), o = ordinary(A, [line(1), cut], { watermarkSeq: 2 })
  refuses('journal truncated row', () => preflightOrdinaryArchive(enc(JSON.stringify(o.manifest)), enc(o.journal)), 'invalid_json')
}
refuses('journal edited bytes without recompute', () => preflightOrdinaryArchive(okManifest, enc(new TextDecoder().decode(okJournal).replace('"schema_rev":"1"', '"schema_rev":"2"'))), 'integrity_mismatch')
refuses('journal wrong schema', () => preflightOrdinaryArchive(journalCase([line(1)], { schema: 'FabricArchive@2' })[0], journalCase([line(1)])[1]), 'unsupported_schema')
refuses('journal seq not increasing', () => { const o = ordinary(A, [line(2), line(1)], { watermarkSeq: 2 }); preflightOrdinaryArchive(enc(JSON.stringify(o.manifest)), enc(o.journal)) }, 'invalid_archive')
refuses('manifest watermark as a string', () => preflightOrdinaryArchive(journalCase([line(1)], { watermarkSeq: '1' })[0], okJournal), 'invalid_archive')

// ── 9. Diagnostics never quote the input.
try { decodePrivateArchive(enc(raw.replace('Привет', '\\ud800'))) } catch (e) { assert.equal(e.message, 'invalid_json'); assert.ok(!String(e.stack).includes('разделитель')) }

console.log(`PASS CeoPrivateArchive@1 codec: ${names.length} golden archives, 4 ordinary digests, ${checks} frozen refusals and vectors`)
