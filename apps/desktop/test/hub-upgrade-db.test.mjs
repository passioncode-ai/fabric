// #region hub-upgrade-rehearsal — docs: docs/handoffs/2026-10-04-hub-upgrade-rehearsal.md#owned-upgrade-rehearsal
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { runPsqlAsync } from './bounded-psql.mjs'
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import path from 'node:path'

const dir = process.env.FABRIC_UPGRADE_DB_DIR, nonce = process.env.FABRIC_UPGRADE_DB_NONCE
const bin = process.env.FABRIC_UPGRADE_PG_BIN, port = '58578'
if (!dir || !nonce || !bin) { console.error('NOT_RUN: use run-hub-upgrade-db.mjs'); process.exit(2) }
assert.match(path.basename(dir), /^fabric-hub-upgrade-[a-zA-Z0-9]+$/)
assert.equal(readFileSync(path.join(dir, 'owner'), 'utf8'), nonce)
const env = { ...process.env }
for (const key of Object.keys(env)) if (key.startsWith('PG')) delete env[key]
const tool = (name, args, input) => execFileSync(path.join(bin, name), args, {
  input, encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'], timeout: 120_000
})
const args = db => ['-h', dir, '-p', port, '-U', 'postgres', '-d', db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1']
const sql = (db, input) => tool('psql', args(db), input).trim()
const lit = v => `convert_from(decode('${Buffer.from(String(v)).toString('hex')}','hex'),'UTF8')`
const uuid = v => `${lit(v)}::uuid`, json = v => `${lit(JSON.stringify(v))}::jsonb`
const id = n => `7800000a-0000-4000-8000-${String(n).padStart(12, '0')}`
const actor = { kind: 'system', id: 'hub-upgrade-fixture' }
const migrations = new URL('../../../supabase/migrations/', import.meta.url)
const files = readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()
const admitted = JSON.parse(readFileSync(new URL('../src/shared/schemaContract.json', import.meta.url), 'utf8'))
// The rehearsal of 0.3.1's upgrade: migration count 78. Later migrations (79, the project board, ADR-0117) continue
// from it, and the last step below applies them to the upgraded database and requires every row to survive.
assert.ok(files.length >= 78, 'the 0.3.1 rehearsal needs the first 78 migrations')
assert.ok(admitted.minimum >= 78 && admitted.maximum === files.length, 'the app admits the chain this checkout carries')
assert.deepEqual(files.slice(75, 78), ['20261003000076_hub_access.sql', '20261004000077_hub_access_at_the_door.sql', '20261004000080_hub_authority_boundaries.sql'])
const mutant = process.env.FABRIC_UPGRADE_MUTANT ?? ''
assert.ok(['', 'restored-poll', 'reconnect-cas'].includes(mutant), 'unknown rehearsal mutant')
if (mutant) console.log(`MUTANT ${mutant}: owned SQL only, ledger still counts 78; not an acceptance receipt`)
const ledger = new Map()
const init = db => {
  assert.match(db, /^fabric_hub_upgrade_(75|77)(?:_restore)?$/)
  tool('createdb', ['-h', dir, '-p', port, '-U', 'postgres', db])
  assert.equal(realpathSync(sql(db, 'show data_directory')), realpathSync(path.join(dir, 'data')))
  assert.equal(sql(db, 'show listen_addresses'), '')
  assert.equal(sql(db, 'show port'), port)
  assert.equal(sql(db, "select count(*) from pg_tables where schemaname='public'"), '0')
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
  for (let i = ledger.get(db); i < through; i++) {
    let body = readFileSync(new URL(files[i], migrations), 'utf8')
    if (i === 77 && mutant === 'restored-poll') {
      assert.ok(body.includes("case when v_restored then null else e.payload->>'poll_verifier' end"))
      body = body.replace("case when v_restored then null else e.payload->>'poll_verifier' end", "e.payload->>'poll_verifier'")
      body = body.replace(/update access_requests r set poll_verifier=null from estate_restore_boundaries b\s+where r\.estate_id=b\.target_estate_id and r\.seq<=b\.watermark_seq;/, '-- watched mutant: existing restored verifier is not repaired')
    }
    if (i === 77 && mutant === 'reconnect-cas') {
      assert.ok(body.includes("if v_live is distinct from identity_uuid(p_payload->>'supersedes') then"))
      body = body.replace("if v_live is distinct from identity_uuid(p_payload->>'supersedes') then", 'if false then')
    }
    sql(db, `begin;\n${body}\ninsert into supabase_migrations.schema_migrations values(${lit(files[i].split('_')[0])});\ncommit;`)
    ledger.set(db, i + 1)
  }
  assert.equal(sql(db, 'set role service_role;select schema_version()'), String(through))
  assert.deepEqual(JSON.parse(sql(db, 'select jsonb_agg(version order by version) from supabase_migrations.schema_migrations')), files.slice(0, through).map(f => f.split('_')[0]))
}
const rows = (db, query) => JSON.parse(sql(db, `select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]') from (${query}) q`))
const snapshot = (db, tables) => Object.fromEntries(tables.map(t => [t, rows(db, `select * from ${t}`)]))
const completeData = db => {
  const tables = rows(db, "select schemaname,tablename from pg_tables where schemaname in ('public','auth','supabase_migrations') order by schemaname,tablename")
  return Object.fromEntries(tables.map(({ schemaname, tablename }) => {
    assert.match(schemaname, /^[a-z_]+$/); assert.match(tablename, /^[a-z_]+$/)
    return [`${schemaname}.${tablename}`, rows(db, `select * from ${schemaname}.${tablename}`)]
  }))
}
const append = (db, estate, type, payload, project = null) => sql(db, `set role service_role;select seq from append_event(${uuid(estate)},${lit(type)},${json(actor)},${json(payload)},'1',${project ? uuid(project) : 'null'})`)
const refusal = (db, query, pattern) => {
  try { sql(db, query) } catch (e) { assert.match(String(e.stderr), pattern); return }
  assert.fail(`SQL accepted an operation expected to refuse ${pattern}`)
}
const coreTables = ['persons', 'estates', 'memberships', 'projects', 'project_tasks', 'memory_facts', 'journal', 'estate_restore_boundaries']
const hubTables = ['access_requests', 'access_bindings', 'access_grants', 'product_connections']
const seedCore = (db, base) => {
  const person = id(base), estate = id(base + 1), project = id(base + 2)
  sql(db, `insert into persons(id,display_name) values(${uuid(person)},'owned upgrade person')`)
  append(db, estate, 'estate.created@1', { name: 'owned upgrade estate', owner_person_id: person })
  append(db, estate, 'project.created@1', { id: project, name: 'Example project', purpose: 'preserve an upgrade fixture' }, project)
  append(db, estate, 'task.created@1', { id: id(base + 3), title: 'preserve task', instruction: 'fixture only' }, project)
  append(db, estate, 'memory.project.recorded@1', { id: id(base + 4), claim: 'owned fixture history', kind: 'decision' }, project)
  return { person, estate, project }
}
const request = requestId => ({ id: requestId, agent_id: 'example-agent', callee: 'fabric-inbox',
  capabilities: ['list_messages'], resources: ['cloudflare:news@example.com'], reason: 'owned upgrade fixture',
  registry: {}, binding_id: null, expires_at: new Date(Date.now() + 600_000).toISOString(), poll_verifier: 'a'.repeat(64) })
const connection = connectionId => ({ id: connectionId, product: 'fabric-inbox', server: 'https://mail.example.com',
  mcp_url: 'https://mail.example.com/mcp', key_id: 'fixture-key-id', client_id: 'fixture-client-id', level: 'admin',
  send: 'send', key_expires_at: null, secret_ref: { project: 'fabric', env: 'local', name: 'UPGRADE_FIXTURE_SLOT' }, supersedes: null })
const allow = (r, b, g) => ({ request_id: r, decision: 'allowed', binding_id: b, new_binding: true,
  grants: [{ id: g, capability: 'list_messages', resource: 'cloudflare:news@example.com', expires_at: new Date(Date.now() + 3600_000).toISOString() }] })
const seedHub77 = (db, core, base) => {
  const liveRequest = id(base), liveBinding = id(base + 1), liveGrant = id(base + 2), liveConnection = id(base + 3)
  append(db, core.estate, 'access.requested@1', request(liveRequest))
  append(db, core.estate, 'access.decided@1', allow(liveRequest, liveBinding, liveGrant))
  append(db, core.estate, 'access.credential.claimed@1', { request_id: liveRequest, binding_id: liveBinding, verifier: 'b'.repeat(64) })
  append(db, core.estate, 'product.connected@1', connection(liveConnection))
  const target = id(base + 10), archivePerson = id(base + 11), r = id(base + 12), b = id(base + 13), g = id(base + 14), c = id(base + 15), pending = id(base + 16)
  sql(db, `insert into persons(id,display_name) values(${uuid(archivePerson)},'archival person');
insert into estates(id,name) values(${uuid(target)},'independent restore target');
insert into memberships(person_id,estate_id,role) values(${uuid(core.person)},${uuid(target)},'owner');`)
  const event = (seq, type, payload) => ({ seq, type, schema_rev: '1', actor, project_id: null, run_id: null, node_id: null, payload, occurred_at: new Date().toISOString() })
  const events = [event(1, 'estate.created@1', { name: 'archived fixture', owner_person_id: archivePerson }),
    event(2, 'access.requested@1', request(r)), event(3, 'access.decided@1', allow(r, b, g)),
    event(4, 'access.credential.claimed@1', { request_id: r, binding_id: b, verifier: 'c'.repeat(64) }),
    event(5, 'product.connected@1', connection(c)), event(6, 'access.requested@1', request(pending))]
  assert.equal(JSON.parse(sql(db, `set role service_role;select restore_estate(${uuid(target)},${uuid(id(base + 19))},'owned archival fixture',${json(events)})`)).restored, true)
  assert.equal(sql(db, `select poll_verifier from access_requests where id=${uuid(pending)}`), 'a'.repeat(64), 'The 77 fixture must reproduce the pre-fix authority defect')
  return { ...core, target, archivePerson, pending, liveRequest, liveBinding, liveGrant, liveConnection }
}
const privileges = db => {
  for (const table of hubTables) for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const operation of ['insert', 'update', 'delete', 'truncate']) assert.equal(sql(db, `select has_table_privilege('${role}','${table}','${operation}')`), 'f')
    assert.equal(sql(db, `select has_table_privilege('${role}','${table}','select')`), role === 'service_role' ? 't' : 'f')
  }
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal(sql(db, `select has_function_privilege('${role}','apply_hub_access(journal)','execute')`), 'f')
    assert.equal(sql(db, `select has_function_privilege('${role}','record_estate_restore_boundary(uuid,uuid,jsonb)','execute')`), 'f')
    assert.equal(sql(db, `select has_table_privilege('${role}','estate_restore_boundaries','INSERT,UPDATE,DELETE,TRUNCATE')`), 'f')
  }
}
const authority = (db, fixture) => {
  const { target, archivePerson, person, pending, liveBinding, liveGrant, liveConnection } = fixture
  assert.equal(sql(db, `select count(*) from memberships where estate_id=${uuid(target)} and person_id=${uuid(archivePerson)}`), '0')
  assert.equal(sql(db, `select count(*) from memberships where estate_id=${uuid(target)} and person_id=${uuid(person)} and role='owner'`), '1')
  assert.equal(sql(db, `select poll_verifier is null from access_requests where id=${uuid(pending)}`), 't', 'restored pending poll verifier must be removed')
  for (const [table, predicate] of [['access_bindings', 'revoked_at is null or verifier is not null'], ['access_grants', 'revoked_at is null'], ['product_connections', 'removed_at is null']])
    assert.equal(sql(db, `select count(*) from ${table} where estate_id=${uuid(target)} and (${predicate})`), '0')
  assert.equal(sql(db, `select verifier from access_bindings where id=${uuid(liveBinding)} and revoked_at is null`), 'b'.repeat(64), 'independent live binding must survive')
  assert.equal(sql(db, `select count(*) from access_grants where id=${uuid(liveGrant)} and revoked_at is null`), '1')
  assert.equal(sql(db, `select count(*) from product_connections where id=${uuid(liveConnection)} and removed_at is null`), '1')
  const before = snapshot(db, ['journal', ...hubTables])
  refusal(db, `set role service_role;select append_event(${uuid(target)},'access.decided@1',${json(actor)},${json({ request_id: pending, decision: 'denied' })})`, /restored request has no authority/)
  assert.deepEqual(snapshot(db, ['journal', ...hubTables]), before, 'refused restored pending decision cannot append or change projections')
}
const parallel = (db, input) => runPsqlAsync(path.join(bin, 'psql'), args(db), input, { env })
  .then(({ code, stdout, stderr }) => ({ code, stdout: stdout.trim(), stderr }))
const reconnect = async (db, fixture, base) => {
  const { estate, liveConnection } = fixture, next = id(base), stale = id(base + 1)
  const before = snapshot(db, ['journal', 'product_connections'])
  refusal(db, `set role service_role;select append_event(${uuid(estate)},'product.connected@1',${json(actor)},${json(connection(stale))})`, /supersedes must name the exact live connection/)
  assert.deepEqual(snapshot(db, ['journal', 'product_connections']), before)
  append(db, estate, 'product.connected@1', { ...connection(next), supersedes: liveConnection })
  const replaced = snapshot(db, ['journal', 'product_connections'])
  refusal(db, `set role service_role;select append_event(${uuid(estate)},'product.connected@1',${json(actor)},${json({ ...connection(stale), supersedes: liveConnection })})`, /supersedes must name the exact live connection/)
  assert.deepEqual(snapshot(db, ['journal', 'product_connections']), replaced)
  const race = n => `begin;set role service_role;select seq from append_event(${uuid(estate)},'product.connected@1',${json(actor)},${json({ ...connection(id(base + n)), supersedes: next })});select pg_sleep(0.15);commit;`
  const outcomes = await Promise.all([parallel(db, race(2)), parallel(db, race(3))])
  assert.equal(outcomes.filter(x => x.code === 0).length, 1, 'exactly one competing reconnect may win')
  assert.match(outcomes.find(x => x.code !== 0).stderr, /supersedes must name the exact live connection/)
  assert.equal(sql(db, `select count(*) from product_connections where estate_id=${uuid(estate)} and removed_at is null`), '1')
  assert.equal(sql(db, `select count(*) from journal where estate_id=${uuid(estate)} and type='product.connected@1'`), '3', 'failed reconnects are absent from the append-only journal')
  const replay = snapshot(db, ['journal', 'product_connections'])
  sql(db, `set role service_role;select rebuild_estate_projections(${uuid(estate)})`)
  assert.deepEqual(snapshot(db, ['journal', 'product_connections']), replay)
}

for (const baseline of [75, 77]) {
  const db = `fabric_hub_upgrade_${baseline}`; init(db); migrate(db, baseline)
  const core = seedCore(db, baseline * 100), beforeCore = snapshot(db, coreTables)
  if (baseline === 75) {
    migrate(db, 77)
    assert.deepEqual(snapshot(db, coreTables), beforeCore, '75→77 must preserve all existing identity/journal/projection rows')
  }
  const fixture = seedHub77(db, core, baseline * 100 + 30)
  const before = snapshot(db, [...coreTables, ...hubTables])
  migrate(db, 78)
  const expected = structuredClone(before)
  for (const row of expected.access_requests) if (row.estate_id === fixture.target) row.poll_verifier = null
  assert.deepEqual(snapshot(db, [...coreTables, ...hubTables]), expected, 'Upgrade changes only restored poll verifiers; journal/history/live authority preserved')
  privileges(db); authority(db, fixture)
  const dump = path.join(dir, `schema-${baseline}-to-78.dump`)
  tool('pg_dump', ['-h', dir, '-p', port, '-U', 'postgres', '-d', db, '-Fc', '-f', dump])
  assert.ok(statSync(dump).size > 0)
  const restored = `${db}_restore`
  tool('createdb', ['-h', dir, '-p', port, '-U', 'postgres', restored])
  tool('pg_restore', ['-h', dir, '-p', port, '-U', 'postgres', '-d', restored, '--exit-on-error', dump])
  assert.equal(realpathSync(sql(restored, 'show data_directory')), realpathSync(path.join(dir, 'data')))
  assert.equal(sql(restored, 'show listen_addresses'), '')
  assert.deepEqual(completeData(restored), completeData(db), 'dump/restore preserves exact rows of every public/auth/ledger table')
  assert.equal(sql(restored, 'set role service_role;select schema_version()'), '78')
  privileges(restored); authority(restored, fixture)
  const replay = snapshot(restored, [...coreTables, ...hubTables])
  for (const estate of [fixture.estate, fixture.target]) sql(restored, `set role service_role;select rebuild_estate_projections(${uuid(estate)})`)
  assert.deepEqual(snapshot(restored, [...coreTables, ...hubTables]), replay, 'dump/restore rebuild preserves projection and authority rows')
  authority(restored, fixture)
  await reconnect(restored, fixture, baseline * 100 + 70)
  const at78 = snapshot(db, [...coreTables, ...hubTables])
  migrate(db, files.length)
  assert.deepEqual(snapshot(db, [...coreTables, ...hubTables]), at78, `78→${files.length} must preserve every existing row`)
  assert.equal(sql(db, 'set role service_role;select schema_version()'), String(files.length))
  console.log(`PASS upgrade ${baseline}→78: exact migration ledger, preserved estate/journal/projections/live authority, restored pending refused, pg_dump/restore, ACLs/replay and concurrent reconnect CAS`)
}
console.log('PASS owned hub upgrade rehearsal; suffix80 is migration count78, no existing database addressed')
// #endregion hub-upgrade-rehearsal
