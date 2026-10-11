// The hub's write rules hold at the write boundary and never in replay (CO-201), a fresh database and an
// upgraded one are the same schema (CO-199), and the refusal summary has the door's shape (CO-200).
// Migration 82 (count 80), Fabric 0.4.0 wave 1, REQ-32. Run through run-write-rules-db.mjs: one owned cluster.
//
// The upgraded database is a development database of the hub's first days: at migration count 76 nothing
// refused a request that lives an hour, a grant that lasts two years, a vault slot named in lower case or a
// span with an extra field, and at 77 nothing refused a decision on a request a restore brought. Each is
// written then, through the door of that schema. Then the chain is applied to the end, and:
//   * `rebuild_estate_projections` replays every event in place, and leaves every projection row as it was;
//   * the same journal replayed from nothing, in a fresh database, projects the same rows;
//   * the door refuses each of the six now, in its own sentence, and a restore refuses the same;
//   * the fresh database's schema (functions, tables, constraints, indexes, policies, triggers, grants, the
//     registered event types) is the upgraded one's.
// Watched failing: FABRIC_SKIP_MIGRATION=20261011000082_write_rules_at_the_door.sql — the in-place rebuild
// raises "a request lives 10 minutes" (the first planted event).
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { catalogOf, catalogDifferences } from '../../../scripts/lib/schema-catalog.mjs'

const dir = process.env.FABRIC_WRITE_RULES_DB_DIR, nonce = process.env.FABRIC_WRITE_RULES_DB_NONCE
const bin = process.env.FABRIC_WRITE_RULES_PG_BIN, port = process.env.FABRIC_WRITE_RULES_PORT
if (!dir || !nonce || !bin || !port) { console.error('NOT_RUN: use run-write-rules-db.mjs'); process.exit(2) }
assert.match(path.basename(dir), /^fabric-write-rules-[a-zA-Z0-9]+$/)
assert.equal(readFileSync(path.join(dir, 'owner'), 'utf8'), nonce)
const env = { ...process.env }
for (const key of Object.keys(env)) if (key.startsWith('PG')) delete env[key]
const tool = (name, args, input) => execFileSync(path.join(bin, name), args, { input, encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'], timeout: 120_000 })
const args = db => ['-h', dir, '-p', port, '-U', 'postgres', '-d', db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1']
const sql = (db, input) => tool('psql', args(db), input).trim()
const lit = v => `convert_from(decode('${Buffer.from(String(v)).toString('hex')}','hex'),'UTF8')`
const uuid = v => `${lit(v)}::uuid`, json = v => `${lit(JSON.stringify(v))}::jsonb`
const id = n => `8200000a-0000-4000-8000-${String(n).padStart(12, '0')}`
const actor = { kind: 'system', id: 'write-rules-fixture' }
const hubActor = { kind: 'system', id: 'fabric-hub' }

const migrations = new URL('../../../supabase/migrations/', import.meta.url)
const skip = process.env.FABRIC_SKIP_MIGRATION ?? ''
const files = readdirSync(migrations).filter(f => f.endsWith('.sql')).sort().filter(f => f !== skip)
if (skip) console.log(`  (chain WITHOUT ${skip} — a watched-failure run, not a receipt)`)
const count = name => { const i = files.indexOf(name); assert.ok(i >= 0, `${name} is in the chain`); return i + 1 }
const AT76 = count('20261003000076_hub_access.sql'), AT77 = count('20261004000077_hub_access_at_the_door.sql')
assert.equal(AT76, 76); assert.equal(AT77, 77)

// The CO-199 hazard, planted (FABRIC_WRITE_RULES_MUTANT=out-of-order, never in CI): the upgraded database applies 82
// before 81 — what a late-merged file sorting below an applied one does; both redefine `append_event` and the archive
// canonicaliser — and the schema count still matches. The catalog comparison must catch it.
const mutant = process.env.FABRIC_WRITE_RULES_MUTANT ?? ''
assert.ok(['', 'out-of-order'].includes(mutant), 'unknown mutant')
if (mutant) console.log(`MUTANT ${mutant}: not an acceptance receipt`)
const upgradeOrder = (() => {
  if (mutant !== 'out-of-order') return files
  const o = [...files], i81 = o.indexOf('20261005000081_project_board.sql'), i82 = o.indexOf('20261011000082_write_rules_at_the_door.sql')
  assert.ok(i81 > 0 && i82 === i81 + 1, 'the mutant swaps 81 and 82')
  ;[o[i81], o[i82]] = [o[i82], o[i81]]
  return o
})()
const ledger = new Map()
const init = db => {
  assert.match(db, /^fabric_write_rules_(upgraded|fresh|replayed)$/)
  tool('createdb', ['-h', dir, '-p', port, '-U', 'postgres', db])
  assert.equal(realpathSync(sql(db, 'show data_directory')), realpathSync(path.join(dir, 'data')))
  assert.equal(sql(db, 'show listen_addresses'), '')
  sql(db, `do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
create schema auth; create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.auth_uid',true),'')::uuid$$;
create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key);
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`)
  ledger.set(db, 0)
}
const migrate = (db, through) => {
  const order = db === 'fabric_write_rules_upgraded' ? upgradeOrder : files
  for (let i = ledger.get(db); i < through; i++) {
    sql(db, `begin;\n${readFileSync(new URL(order[i], migrations), 'utf8')}\ninsert into supabase_migrations.schema_migrations values(${lit(order[i].split('_')[0])});\ncommit;`)
    ledger.set(db, i + 1)
  }
  assert.equal(sql(db, 'set role service_role;select schema_version()'), String(through))
}
const rows = (db, query) => JSON.parse(sql(db, `select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]') from (${query}) q`))
const hubTables = ['access_requests', 'access_bindings', 'access_grants', 'product_connections']
const snapshot = (db, tables) => Object.fromEntries(tables.map(t => [t, rows(db, `select * from ${t}`)]))
const append = (db, estate, type, payload, who = actor) =>
  sql(db, `set role service_role;select seq from append_event(${uuid(estate)},${lit(type)},${json(who)},${json(payload)},'1',null)`)
const refused = (db, query, pattern) => {
  try { sql(db, query) } catch (e) { assert.match(String(e.stderr), pattern); return }
  assert.fail(`SQL accepted an operation expected to refuse ${pattern}`)
}
const at = ms => new Date(Date.now() + ms).toISOString()
const HOUR = 3600_000, DAY = 24 * HOUR

let failures = 0, passed = 0
const test = (name, fn) => {
  try { fn(); passed++; console.log(`PASS ${name}`) } catch (e) { failures++; console.log(`FAIL ${name}\n     ${String(e.message).split('\n').slice(0, 12).join('\n     ')}`) }
}

// ── the development database: events the schema of their day accepted ──────────────────────────────────────
const up = 'fabric_write_rules_upgraded'
init(up); migrate(up, AT76)
const person = id(1), estate = id(2)
sql(up, `insert into persons(id,display_name) values(${uuid(person)},'write-rules person')`)
append(up, estate, 'estate.created@1', { name: 'write-rules estate', owner_person_id: person })
const request = (rid, expires) => ({ id: rid, agent_id: 'example-agent', callee: 'fabric-inbox', capabilities: ['list_messages'],
  resources: ['cloudflare:news@example.com'], reason: 'write-rules fixture', registry: {}, binding_id: null, expires_at: expires })
const allow = (r, b, g, expires) => ({ request_id: r, decision: 'allowed', binding_id: b, new_binding: true,
  grants: [{ id: g, capability: 'list_messages', resource: 'cloudflare:news@example.com', expires_at: expires }] })
const connection = (cid, name) => ({ id: cid, product: 'fabric-inbox', server: 'https://mail.example.com', mcp_url: 'https://mail.example.com/mcp',
  key_id: 'fixture-key-id', client_id: 'fixture-client-id', level: 'admin', send: 'send', key_expires_at: null,
  secret_ref: { project: 'fabric', env: 'local', name }, supersedes: null })
const span = extra => ({ trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16), parent_span_id: null, trace_incomplete: true,
  caller: { binding_id: id(11), agent_id: 'example-agent' }, callee: 'fabric-inbox', capability: 'list_messages',
  args_hash: `sha256:${'c'.repeat(64)}`, outcome: 'succeeded', error_code: null, grant_ids: [id(12)], wall_ms: 3, ...extra })
// At 76: a request for an hour, a grant for two years, a lower-case vault slot, a span with the arguments in it.
append(up, estate, 'access.requested@1', request(id(10), at(HOUR)), hubActor)
append(up, estate, 'access.decided@1', allow(id(10), id(11), id(12), at(730 * DAY)), { kind: 'operator', id: 'operator' })
append(up, estate, 'access.credential.claimed@1', { request_id: id(10), binding_id: id(11), verifier: 'd'.repeat(64) }, hubActor)
append(up, estate, 'product.connected@1', connection(id(13), 'lower_case_slot'), { kind: 'operator', id: 'operator' })
append(up, estate, 'hub.call.forwarded@1', span({ args: { messageId: 'm1' } }), hubActor)
// At 77: a restore brings a pending request, and the operator decides it here — above the watermark.
migrate(up, AT77)
const target = id(20), archivePerson = id(21), restoredRequest = id(22)
sql(up, `insert into persons(id,display_name) values(${uuid(archivePerson)},'archival person');
insert into estates(id,name) values(${uuid(target)},'restore target');
insert into memberships(person_id,estate_id,role) values(${uuid(person)},${uuid(target)},'owner');`)
const archived = (seq, type, payload) => ({ seq, type, schema_rev: '1', actor, project_id: null, run_id: null, node_id: null, payload, occurred_at: new Date().toISOString() })
const restoredEvents = [archived(1, 'estate.created@1', { name: 'archived', owner_person_id: archivePerson }),
  archived(2, 'access.requested@1', { ...request(restoredRequest, at(600_000)), poll_verifier: 'e'.repeat(64) })]
assert.equal(JSON.parse(sql(up, `set role service_role;select restore_estate(${uuid(target)},${uuid(id(29))},'write-rules archive',${json(restoredEvents)})`)).restored, true)
append(up, target, 'access.decided@1', allow(restoredRequest, id(23), id(24), at(30 * DAY)), { kind: 'operator', id: 'operator' })
const journalAt77 = rows(up, 'select estate_id, seq, type from journal order by estate_id, seq')
migrate(up, files.length)

test('the upgrade applies every migration after the planted events and keeps the journal as it was', () => {
  assert.deepEqual(rows(up, 'select estate_id, seq, type from journal order by estate_id, seq'), journalAt77)
  assert.equal(sql(up, 'set role service_role;select schema_version()'), String(files.length))
})

const live = snapshot(up, hubTables)
test('CO-201: a database holding events today\'s door refuses rebuilds in place, and every projection row stays as it was', () => {
  for (const e of [estate, target]) sql(up, `set role service_role;select rebuild_estate_projections(${uuid(e)})`)
  assert.deepEqual(snapshot(up, hubTables), live)
})

test('CO-201: the same journal replayed from nothing projects the same hub rows', () => {
  const re = 'fabric_write_rules_replayed'
  init(re); migrate(re, files.length)
  // The identity plane and the restore boundary are not journal events; they are copied as they are.
  const copy = (table, cols) => {
    const data = rows(up, `select ${cols} from ${table}`)
    if (data.length) sql(re, `insert into ${table}(${cols}) select ${cols} from jsonb_populate_recordset(null::${table}, ${json(data)}) on conflict do nothing`)
  }
  copy('persons', 'id,display_name')
  copy('estates', 'id,name')
  copy('memberships', 'person_id,estate_id,role')
  copy('estate_restore_boundaries', rows(up, `select column_name from information_schema.columns where table_schema='public'
    and table_name='estate_restore_boundaries' order by ordinal_position`).map(r => r.column_name).join(','))
  copy('journal', 'estate_id,seq,type,schema_rev,actor,project_id,run_id,node_id,payload,occurred_at')
  for (const e of [estate, target]) sql(re, `set role service_role;select rebuild_estate_projections(${uuid(e)})`)
  assert.deepEqual(snapshot(re, hubTables), live)
})

// ── today's door ─────────────────────────────────────────────────────────────────────────────────────────────
const fresh = 'fabric_write_rules_fresh'
init(fresh); migrate(fresh, files.length)
const doorPerson = id(40), door = id(41)
sql(fresh, `insert into persons(id,display_name) values(${uuid(doorPerson)},'door person')`)
append(fresh, door, 'estate.created@1', { name: 'door estate', owner_person_id: doorPerson })
append(fresh, door, 'access.requested@1', request(id(42), at(9 * 60_000)), hubActor)
append(fresh, door, 'access.decided@1', allow(id(42), id(43), id(44), at(300 * DAY)), { kind: 'operator', id: 'operator' })
const doorJournal = () => sql(fresh, `select count(*) from journal where estate_id=${uuid(door)}`)
const appendSql = (type, payload, who = actor) => `set role service_role;select append_event(${uuid(door)},${lit(type)},${json(who)},${json(payload)},'1',null)`

test('the door refuses each rule 77 and 80 made, in its own sentence, and journals nothing', () => {
  const before = doorJournal()
  refused(fresh, appendSql('access.requested@1', request(id(45), at(HOUR)), hubActor), /a request lives 10 minutes/)
  // One transaction: the request it decides is rolled back with the refused decision.
  refused(fresh, 'begin;' + appendSql('access.requested@1', request(id(46), at(9 * 60_000)), hubActor) + ';' +
    appendSql('access.decided@1', allow(id(46), id(47), id(48), at(400 * DAY))) + ';commit;', /a grant lasts a year/)
  refused(fresh, appendSql('product.connected@1', connection(id(49), 'lower_case_slot')), /names a vault slot/)
  refused(fresh, appendSql('product.connected@1', { ...connection(id(50), 'SLOT'), secret_ref: { project: 'fabric', env: 'local', name: 'SLOT', value: 'the-secret' } }), /never the secret/)
  refused(fresh, appendSql('product.connect.refused@1', { product: 'fabric-inbox', outcome: 'denied', error: null, extra: 1 }), /not product, outcome or error/)
  refused(fresh, appendSql('product.connect.refused@1', { product: 'fabric-inbox', outcome: 'maybe', error: null }), /outcome: denied \| failed/)
  refused(fresh, appendSql('hub.call.forwarded@1', span({ args: { messageId: 'm1' } }), hubActor), /not a span field/)
  assert.equal(doorJournal(), before)
})

test('the door still accepts what the rules allow: a span, a refused connect, a slot', () => {
  const before = Number(doorJournal())
  append(fresh, door, 'hub.call.forwarded@1', span({}), hubActor)
  append(fresh, door, 'product.connect.refused@1', { product: 'fabric-inbox', outcome: 'failed', error: 'the product timed out' })
  append(fresh, door, 'product.connected@1', connection(id(51), 'FABRIC_INBOX_CLIENT_SECRET'))
  assert.equal(Number(doorJournal()), before + 3)
})

test('the door refuses a decision on a request a restore brought (80, DA-2), and a restore\'s own history is accepted', () => {
  const t = id(60), src = id(69), pending = id(61)
  sql(fresh, `insert into estates(id,name) values(${uuid(t)},'door restore target');
insert into memberships(person_id,estate_id,role) values(${uuid(doorPerson)},${uuid(t)},'owner');`)
  const events = [archived(1, 'estate.created@1', { name: 'archived', owner_person_id: id(62) }),
    archived(2, 'access.requested@1', { ...request(pending, at(600_000)), poll_verifier: 'f'.repeat(64) }),
    archived(3, 'access.decided@1', allow(pending, id(63), id(64), at(30 * DAY)))]
  sql(fresh, `insert into persons(id,display_name) values(${uuid(id(62))},'archival person')`)
  // The archive decided its own request: history, projected revoked, never live.
  assert.equal(JSON.parse(sql(fresh, `set role service_role;select restore_estate(${uuid(t)},${uuid(src)},'door archive',${json(events.slice(0, 2))})`)).restored, true)
  refused(fresh, `set role service_role;select append_event(${uuid(t)},'access.decided@1',${json({ kind: 'operator', id: 'operator' })},${json(allow(pending, id(65), id(66), at(30 * DAY)))},'1',null)`, /restored request has no authority here/)
  assert.equal(sql(fresh, `select count(*) from access_grants where estate_id=${uuid(t)} and revoked_at is null`), '0')
})

test('a restore is a write: an archive carrying an event the door refuses is refused, and nothing lands', () => {
  const t = id(70)
  sql(fresh, `insert into estates(id,name) values(${uuid(t)},'refused restore target');
insert into memberships(person_id,estate_id,role) values(${uuid(doorPerson)},${uuid(t)},'owner');`)
  sql(fresh, `insert into persons(id,display_name) values(${uuid(id(72))},'archival person 2')`)
  const events = [archived(1, 'estate.created@1', { name: 'archived', owner_person_id: id(72) }),
    archived(2, 'access.requested@1', { ...request(id(71), new Date(Date.now() + HOUR).toISOString()) })]
  refused(fresh, `set role service_role;select restore_estate(${uuid(t)},${uuid(id(79))},'refused archive',${json(events)})`, /a request lives 10 minutes/)
  assert.equal(sql(fresh, `select count(*) from journal where estate_id=${uuid(t)}`), '0')
})

const summary = over => ({ caller: { binding_id: id(43), agent_id: 'example-agent' }, outcome: 'refused', error_code: 'access-required',
  suppressed: 119, first_at: new Date(Date.now() - 590_000).toISOString(), last_at: new Date(Date.now() - 1000).toISOString(), window_ms: 600_000, ...over })
test('CO-200: a refusal summary is journalled with the door\'s shape and projects nothing', () => {
  const before = { journal: Number(doorJournal()), hub: snapshot(fresh, hubTables) }
  append(fresh, door, 'hub.call.refusals.summarized@1', summary({}), hubActor)
  assert.equal(Number(doorJournal()), before.journal + 1)
  assert.deepEqual(snapshot(fresh, hubTables), before.hub)
  assert.equal(sql(fresh, `select projects from event_types where type='hub.call.refusals.summarized@1'`), 'f')
  sql(fresh, `set role service_role;select rebuild_estate_projections(${uuid(door)})`)
  assert.deepEqual(snapshot(fresh, hubTables), before.hub)
})

test('CO-200: a summary carrying anything but counts and times, or a code Fabric does not end a call with, is refused', () => {
  const before = doorJournal()
  for (const bad of [summary({ args: { messageId: 'm1' } }), summary({ error_code: 'idempotency-conflict' }), summary({ suppressed: 0 }),
    summary({ suppressed: 1.5 }), summary({ outcome: 'succeeded' }), summary({ caller: { binding_id: 'not-a-uuid', agent_id: 'example-agent' } }),
    summary({ caller: { binding_id: id(43), agent_id: 'example-agent', mailbox: 'x' } }), summary({ window_ms: '600000' }),
    summary({ first_at: new Date().toISOString(), last_at: new Date(Date.now() - 60_000).toISOString() }),
    summary({ last_at: new Date(Date.now() + 10 * 60_000).toISOString() })])
    refused(fresh, appendSql('hub.call.refusals.summarized@1', bad, hubActor), /summarized@1 (is \{caller|counts calls between)/)
  assert.equal(doorJournal(), before)
})

// ── CO-199: fresh and upgraded are one schema ─────────────────────────────────────────────────────────────────
const catalog = db => catalogOf(q => JSON.parse(sql(db, q)))
test('CO-199: a database upgraded across 76, 77 and the rest is the schema a fresh install makes', () => {
  assert.deepEqual(catalogDifferences(catalog(up), catalog(fresh)), [], 'the upgraded and the fresh database differ')
})

console.log(failures ? `FAIL ${failures} of ${failures + passed}` : `all green (${passed})`)
process.exit(failures ? 1 : 0)
