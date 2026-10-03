// Migration 66 against an owned PostgreSQL (first-slice plan A1-2). No caller database,
// model or provider. The A1-1 vectors are replayed through SQL byte for byte: one canonical
// form, one digest, one budget definition and one reason-code vocabulary on both sides.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { ARCHIVE_REASON_CODES } from '../src/main/archiveJson.ts'
import { ordinary, line, A } from './fixtures/ceo-private-archive/vectors.mjs'

const dir = process.env.FABRIC_ARCHIVE_DB_DIR, nonce = process.env.FABRIC_ARCHIVE_DB_NONCE, bin = process.env.FABRIC_ARCHIVE_PG_BIN
if (!dir || !nonce || !bin) { console.error('NOT_RUN: use run-ceo-private-archive-db.mjs'); process.exit(2) }
assert.match(path.basename(dir), /^fabric-ceo-private-archive-[a-zA-Z0-9]+$/)
assert.equal(readFileSync(path.join(dir, 'owner'), 'utf8'), nonce)
const args = ['-h', dir, '-p', '58467', '-U', 'postgres', '-d', process.env.FABRIC_ARCHIVE_DB_NAME ?? 'fabric_ceo_private_archive_owned', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1']
const sql = input => execFileSync(path.join(bin, 'psql'), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
/** The refusal's whole message, or 'accepted'. */
const refusal = input => {
  try { sql(input); return 'accepted' } catch (e) {
    const m = /ERROR:\s+(\S+)/.exec(String(e.stderr)); assert.ok(m, 'an error with a message: ' + e.stderr); return m[1]
  }
}
assert.equal(realpathSync(sql('show data_directory')), realpathSync(path.join(dir, 'data')))
assert.equal(sql('show listen_addresses'), '')
assert.equal(sql("select count(*) from pg_tables where schemaname='public'"), '0')
// Roles are cluster-wide: the second database in this owned cluster finds them already made.
sql(`do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;create role authenticated;create role service_role bypassrls; end if; end $$;
create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.auth_uid',true),'')::uuid$$;
create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text);`)
const lit = v => `convert_from(decode('${Buffer.from(String(v)).toString('hex')}','hex'),'UTF8')`
const jsonb = v => `${lit(typeof v === 'string' ? v : JSON.stringify(v))}::jsonb`

// ── 1. The full chain, 66 included (67, 68, 69, 70, 71, 72, 73 and 74 each redefine the export and canonical form for their schema).
const migrations = new URL('../../../supabase/migrations/', import.meta.url)
const files = readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()
assert.ok(files.includes('20260927000066_ceo_private_archive.sql'))
for (const file of files) {
  sql(readFileSync(new URL(file, migrations), 'utf8'))
  sql(`insert into supabase_migrations.schema_migrations values(${lit(file.split('_')[0])})`)
}
assert.equal(sql('set role service_role;select schema_version()'), String(files.length))
let groups = 0
const pass = name => { groups++; console.log('PASS ' + name) }
pass(`full migration chain applied, schema_version ${files.length}`)

// ── 2. No role reaches a helper or a new table directly.
const own = readFileSync(new URL('20260927000066_ceo_private_archive.sql', migrations), 'utf8')
const helpers = [...own.matchAll(/^create function (\w+)\(/gm)].map(m => m[1])
assert.ok(helpers.length > 0, 'the helper list was parsed')
// The commands trusted main calls are granted to service_role and nobody else; every other
// function this migration creates is a helper nobody reaches directly.
const COMMANDS = new Set(['restore_estate_verified', 'ceo_export_private_archive', 'ceo_import_private_archive', 'ceo_private_import_receipt'])
for (const name of helpers) for (const role of ['anon', 'authenticated', 'service_role']) {
  const reach = sql(`select coalesce(bool_or(has_function_privilege(${lit(role)},p.oid,'execute')),false) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=${lit(name)}`)
  assert.equal(reach, role === 'service_role' && COMMANDS.has(name) ? 't' : 'f', `${role} execute ${name}`)
}
for (const name of COMMANDS) assert.ok(helpers.includes(name), name + ' is created by migration 66')
for (const table of ['ceo_private_import_receipts', 'ceo_content_provenance']) for (const role of ['anon', 'authenticated', 'service_role'])
  for (const privilege of ['select', 'insert', 'update', 'delete'])
    assert.equal(sql(`select has_table_privilege(${lit(role)},${lit('public.' + table)},${lit(privilege)})`), 'f', `${role} ${privilege} ${table}`)
pass(`${helpers.length - COMMANDS.size} helpers and 2 tables unreachable by every role; ${COMMANDS.size} command(s) reachable by service_role only`)

// ── 3. The A1-1 companion vectors: SQL reproduces the frozen canonical and digest.
const fixtures = new URL('./fixtures/ceo-private-archive/', import.meta.url)
const names = readdirSync(fixtures).filter(f => f.endsWith('.archive.json')).map(f => f.slice(0, -'.archive.json'.length)).sort()
assert.equal(names.length, 7)
for (const name of names) {
  const archive = readFileSync(new URL(name + '.archive.json', fixtures), 'utf8')
  const expected = JSON.parse(readFileSync(new URL(name + '.expected.json', fixtures), 'utf8'))
  assert.equal(sql(`select ceo_private_archive_canonical(${jsonb(archive)})`), expected.canonical, name + ' canonical')
  assert.equal(sql(`select ceo_private_archive_digest(${jsonb(archive)})`), expected.sha256, name + ' digest')
}
pass(`${names.length} companion vectors: byte-identical canonical strings and digests in SQL`)

// ── 4. The ordinary archive corpus: same digest algorithm over the original bytes.
const rows = (manifest, journal) => `select jsonb_array_length(ceo_archive_estate_rows(${jsonb(manifest)},${lit(journal)}))`
for (const name of ['journal-empty', 'journal-one-line', 'journal-many-lines', 'journal-decimal-seq']) {
  const manifest = readFileSync(new URL(name + '.manifest.json', fixtures), 'utf8'), journal = readFileSync(new URL(name + '.journal.ndjson', fixtures), 'utf8')
  assert.equal(sql(rows(manifest, journal)), String(JSON.parse(manifest).eventCount), name)
}
{
  const spaced = '{ "seq": 1, "type": "estate.created@1", "schema_rev": "1", "actor": {"kind":"operator"}, "project_id": null, "run_id": null, "node_id": null, "payload": {"b":1,"a":2}, "occurred_at": "2026-09-28T08:00:00.000000+00:00" }'
  const o = ordinary(A, [spaced])
  assert.equal(sql(rows(o.manifest, o.journal)), '1', 'original bytes, not a re-encoding')
}
pass('4 ordinary archives and the original-bytes case accepted by SQL')

// ── 5. Ordinary-journal negatives, each with its fixed reason code and nothing else.
const codes = new Set(ARCHIVE_REASON_CODES)
const refuses = (label, input, code) => {
  const got = refusal(input)
  assert.ok(codes.has(got), `${label}: "${got}" is not in ARCHIVE_REASON_CODES`)
  assert.equal(got, code, label)
}
const ok2 = ordinary(A, [line(1), line(2)])
refuses('journal CRLF', rows(ok2.manifest, ok2.journal.replace('\n', '\r\n')), 'invalid_archive')
refuses('journal missing final LF', rows(ok2.manifest, ok2.journal.slice(0, -1)), 'invalid_archive')
{ const o = ordinary(A, [line(1), '', line(3)], { watermarkSeq: 3 }); refuses('journal blank row', rows(o.manifest, o.journal), 'invalid_archive') }
{ const o = ordinary(A, [line(1), line(2).slice(0, 20)], { watermarkSeq: 2 }); refuses('journal truncated row', rows(o.manifest, o.journal), 'invalid_json') }
refuses('journal edited bytes without recompute', rows(ok2.manifest, ok2.journal.replace('"schema_rev":"1"', '"schema_rev":"2"')), 'integrity_mismatch')
refuses('journal wrong schema', rows({ ...ok2.manifest, schema: 'FabricArchive@2' }, ok2.journal), 'unsupported_schema')
{ const o = ordinary(A, [line(2), line(1)], { watermarkSeq: 2 }); refuses('journal seq not increasing', rows(o.manifest, o.journal), 'invalid_archive') }
refuses('manifest watermark as a string', rows({ ...ok2.manifest, watermarkSeq: '2' }, ok2.journal), 'invalid_archive')
{ const o = ordinary(A, [line(1, { payload: { k: 1, k2: 2 } }).replace('"k2"', '"k"')]); refuses('journal duplicate key', rows(o.manifest, o.journal), 'invalid_json') }
{ const o = ordinary(A, [line(1, { payload: { t: 'x' } }).replace('"x"', '"\\u0000"')]); refuses('journal NUL', rows(o.manifest, o.journal), 'invalid_json') }
{ const o = ordinary(A, [line(1, { payload: { t: 'x' } }).replace('"x"', '"\\ud800"')]); refuses('journal lone surrogate', rows(o.manifest, o.journal), 'invalid_json') }
{ const o = ordinary(A, [line(1, { payload: JSON.parse('['.repeat(40) + ']'.repeat(40)) })]); refuses('journal depth exceeded', rows(o.manifest, o.journal), 'too_large') }
refuses('manifest event count over the limit', rows({ ...ok2.manifest, eventCount: 65537, watermarkSeq: 65537 }, ok2.journal), 'too_large')
{
  const leak = refusal(rows(ok2.manifest, ok2.journal.replace('"schema_rev":"1"', '"schema_rev":"SECRET-canary"')))
  assert.equal(leak, 'integrity_mismatch'); assert.doesNotMatch(leak, /canary|FabricArchive|[0-9a-f]{64}/)
}
pass('13 ordinary-journal refusals, each one fixed code from ARCHIVE_REASON_CODES, no body or digest in the message')

// ── 6. One budget definition: root depth 1, every value a node, keys are not nodes.
const admit = (raw, budget = 1000000) => `select (ceo_archive_json_admit(${lit(raw)},${budget})).nodes`
const nest = d => '['.repeat(d - 1) + '0' + ']'.repeat(d - 1)
assert.equal(sql(admit(nest(32))), '32')
refuses('depth 33 of 32', admit(nest(33)), 'too_large')
assert.equal(sql(admit('[1,2]', 3)), '3')
refuses('four nodes in a budget of three', admit('[1,[2]]', 3), 'too_large')
assert.equal(sql(admit('{"a":1,"b":2}', 3)), '3', 'object keys are not nodes')
pass('budget parity with the codec: depth 32 passes, 33 refuses; keys are not nodes')

// ── 7. Companion shape negatives the canonical form must refuse.
const empty = readFileSync(new URL('empty.archive.json', fixtures), 'utf8'), unicode = readFileSync(new URL('unicode-newlines.archive.json', fixtures), 'utf8')
const canon = raw => `select ceo_private_archive_canonical(${jsonb(raw)})`
const edit = (raw, fn) => { const a = JSON.parse(raw); fn(a); return JSON.stringify(a) }
refuses('companion wrong schema', canon(edit(empty, a => { a.schema = 'CeoPrivateArchive@2' })), 'unsupported_schema')
refuses('companion wrong source schema', canon(edit(empty, a => { a.source_schema_version = 65 })), 'unsupported_schema')
refuses('companion unqualified later source schema', canon(edit(empty, a => { a.source_schema_version = 75 })), 'unsupported_schema')
refuses('companion non-empty tombstones', canon(edit(empty, a => { a.tombstones = [{}] })), 'invalid_archive')
refuses('companion unknown field', canon(edit(empty, a => { a.extra = true })), 'invalid_archive')
refuses('companion unknown operation kind', canon(edit(unicode, a => { a.operations[0].kind = 'close' })), 'invalid_archive')
refuses('companion wrong preparation version', canon(edit(unicode, a => { a.messages[0].envelope.preparation_version = 'har07' })), 'unsupported_schema')
refuses('companion non-canonical integer', canon(unicode.replace('"ordinal": 2', '"ordinal": 2.0')), 'invalid_json')
refuses('companion negative ordinal', canon(edit(unicode, a => { a.messages[0].ordinal = -1 })), 'invalid_archive')
refuses('companion oversize conversation list', canon(edit(empty, a => { a.conversations = Array(257).fill({}) })), 'too_large')
pass('9 companion refusals with the codec\'s codes')

console.log(`PASS migration 66 base: ${groups} groups on an owned cluster; restore, export and import commands NOT_RUN (A1-3, A1-4)`)
