// Migration 76 — the hub's standing access, on the fully migrated chain (ADR-0115 S2–S4).
// Every write goes through `append_event`, the one writer, and the projector refuses an impossible
// transition by raising — so the journal never holds an act its projection does not contain. A replay
// of the chain (`rebuild_estate_projections`) must leave every row as it was.
// To WATCH this suite fail, run the runner with FABRIC_SKIP_MIGRATION=20261003000076_hub_access.sql.
// #region hub-access-schema — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#3-grants-are-standing-narrow-and-revocable
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-hub-access-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql = input => execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-F', '|', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const refuses = (input, pattern) => {
  try { sql(input) } catch (e) { assert.match(String(e.stderr ?? e.message), pattern); return }
  assert.fail(`expected a refusal matching ${pattern}`)
}
let count = 0; const failed = []
const test = (name, fn) => {
  try { fn(); console.log('PASS ' + name); count++ } catch (e) { failed.push(name); console.log(`FAIL ${name}\n  ${String(e.message).split('\n')[0]}`) }
}

const E = '76000000-0000-4000-8000-000000000001', OTHER = '76000000-0000-4000-8000-000000000002'
const R1 = '76000000-0000-4000-8000-000000000011', R2 = '76000000-0000-4000-8000-000000000012', R3 = '76000000-0000-4000-8000-000000000013'
const B1 = '76000000-0000-4000-8000-000000000021'
const G1 = '76000000-0000-4000-8000-000000000031', G2 = '76000000-0000-4000-8000-000000000032'
const C1 = '76000000-0000-4000-8000-000000000041', C2 = '76000000-0000-4000-8000-000000000042'
const hub = `'{"kind":"system","id":"fabric-hub"}'`, person = `'{"kind":"person","id":"operator"}'`
const j = v => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
const append = (estate, type, actor, payload) => sql(`set role service_role; select seq from append_event('${estate}','${type}',${actor},${j(payload)})`)
const later = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString()
const request = (id, extra = {}) => ({
  id, agent_id: 'example-agent', callee: 'fabric-inbox', capabilities: ['list_messages', 'read_message'],
  resources: ['cloudflare:news@example.com'], reason: 'summarise the newsletter',
  registry: { key: 'example-agent.default', name: 'Example agent', installed_by: 'example-installer', repository: null },
  binding_id: null, expires_at: later(10), ...extra
})

test('the nine event types are registered and the four tables exist with RLS on', () => {
  assert.equal(sql(`select count(*) from event_types where type in ('access.requested@1','access.decided@1','access.credential.claimed@1','access.grant.revoked@1','access.binding.revoked@1','access.denial.cleared@1','product.connected@1','product.disconnected@1','hub.call.forwarded@1')`), '9')
  assert.equal(sql(`select string_agg(relname || '=' || relrowsecurity, ',' order by relname) from pg_class where relname in ('access_requests','access_bindings','access_grants','product_connections')`),
    'access_bindings=true,access_grants=true,access_requests=true,product_connections=true')
  assert.equal(sql(`select schema_version()`), '76')
})

test('no API role reads or writes the access tables; the service role reads them and writes none', () => {
  for (const t of ['access_requests', 'access_bindings', 'access_grants', 'product_connections']) {
    for (const role of ['anon', 'authenticated'])
      for (const p of ['select', 'insert', 'update', 'delete'])
        assert.equal(sql(`select has_table_privilege('${role}', '${t}', '${p}')`), 'f', `${role} may ${p} ${t}`)
    assert.equal(sql(`select has_table_privilege('service_role', '${t}', 'select')`), 't')
    for (const p of ['insert', 'update', 'delete'])
      assert.equal(sql(`select has_table_privilege('service_role', '${t}', '${p}')`), 'f', `service_role may ${p} ${t} around the journal`)
  }
  for (const role of ['public', 'anon', 'authenticated', 'service_role'])
    assert.equal(sql(`select has_function_privilege('${role}', 'apply_hub_access(journal)', 'execute')`), 'f', `${role} may run the projector`)
})

test('a request projects as pending; an allow writes the binding (no verifier yet) and one grant per capability × resource', () => {
  append(E, 'access.requested@1', hub, request(R1))
  assert.equal(sql(`select status || '|' || array_to_string(capabilities, ',') from access_requests where id='${R1}'`), 'pending|list_messages,read_message')
  append(E, 'access.decided@1', person, {
    request_id: R1, decision: 'allowed', binding_id: B1, new_binding: true,
    grants: [
      { id: G1, capability: 'list_messages', resource: 'cloudflare:news@example.com', expires_at: later(525600) },
      { id: G2, capability: 'read_message', resource: 'cloudflare:news@example.com', expires_at: later(525600) }
    ]
  })
  assert.equal(sql(`select status || '|' || granted_binding_id || '|' || decided_by from access_requests where id='${R1}'`), `allowed|${B1}|operator`)
  assert.equal(sql(`select coalesce(verifier, 'none') || '|' || agent_id from access_bindings where id='${B1}'`), 'none|example-agent')
  assert.equal(sql(`select count(*) from access_grants where binding_id='${B1}' and revoked_at is null`), '2')
})

test('a decided request cannot be decided again, and an allow cannot grant what was not asked', () => {
  refuses(`set role service_role; select append_event('${E}','access.decided@1',${person},${j({ request_id: R1, decision: 'denied' })})`, /already allowed/)
  append(E, 'access.requested@1', hub, request(R2))
  refuses(`set role service_role; select append_event('${E}','access.decided@1',${person},${j({
    request_id: R2, decision: 'allowed', binding_id: '76000000-0000-4000-8000-000000000022', new_binding: true,
    grants: [{ id: '76000000-0000-4000-8000-000000000033', capability: 'send_email', resource: 'cloudflare:news@example.com', expires_at: later(60) }] })})`, /was not asked for/)
  refuses(`set role service_role; select append_event('${E}','access.decided@1',${person},${j({
    request_id: R2, decision: 'allowed', binding_id: '76000000-0000-4000-8000-000000000022', new_binding: true,
    grants: [{ id: '76000000-0000-4000-8000-000000000033', capability: 'list_messages', resource: 'cloudflare:other@example.com', expires_at: later(60) }] })})`, /was not asked for/)
  assert.equal(sql(`select count(*) from journal where estate_id='${E}' and type='access.decided@1'`), '1', 'a refused decision left a journal row')
})

test('a grant without an expiry, or expiring before it was decided, is refused (ADR-0115 §6)', () => {
  refuses(`set role service_role; select append_event('${E}','access.decided@1',${person},${j({
    request_id: R2, decision: 'allowed', binding_id: '76000000-0000-4000-8000-000000000022', new_binding: true,
    grants: [{ id: '76000000-0000-4000-8000-000000000034', capability: 'list_messages', resource: 'cloudflare:news@example.com' }] })})`, /null value in column "expires_at"|violates/)
  refuses(`set role service_role; select append_event('${E}','access.decided@1',${person},${j({
    request_id: R2, decision: 'allowed', binding_id: '76000000-0000-4000-8000-000000000022', new_binding: true,
    grants: [{ id: '76000000-0000-4000-8000-000000000034', capability: 'list_messages', resource: 'cloudflare:news@example.com', expires_at: '2020-01-01T00:00:00Z' }] })})`, /check constraint/)
})

test('an expired request cannot be decided; a denial stands until cleared, and clears once', () => {
  append(E, 'access.requested@1', hub, request(R3, { expires_at: new Date(Date.now() + 1500).toISOString() }))
  execFileSync('sleep', ['2'])
  refuses(`set role service_role; select append_event('${E}','access.decided@1',${person},${j({ request_id: R3, decision: 'denied' })})`, /expired/)
  append(E, 'access.decided@1', person, { request_id: R2, decision: 'denied' })
  assert.equal(sql(`select status || '|' || coalesce(denial_cleared_at::text, 'standing') from access_requests where id='${R2}'`), 'denied|standing')
  append(E, 'access.denial.cleared@1', person, { request_id: R2 })
  assert.notEqual(sql(`select denial_cleared_at from access_requests where id='${R2}'`), '')
  refuses(`set role service_role; select append_event('${E}','access.denial.cleared@1',${person},${j({ request_id: R2 })})`, /no standing denial/)
})

test('a credential is claimed once: the verifier is set, a second claim is refused', () => {
  const v = 'a'.repeat(64)
  append(E, 'access.credential.claimed@1', hub, { binding_id: B1, request_id: R1, verifier: v })
  assert.equal(sql(`select verifier from access_bindings where id='${B1}'`), v)
  assert.notEqual(sql(`select credential_claimed_at from access_requests where id='${R1}'`), '')
  refuses(`set role service_role; select append_event('${E}','access.credential.claimed@1',${hub},${j({ binding_id: B1, request_id: R1, verifier: 'b'.repeat(64) })})`, /no unclaimed credential/)
})

test('another estate cannot decide, claim or revoke this estate\'s rows by naming their ids', () => {
  refuses(`set role service_role; select append_event('${OTHER}','access.decided@1',${person},${j({ request_id: R1, decision: 'denied' })})`, /names no request of this estate/)
  refuses(`set role service_role; select append_event('${OTHER}','access.grant.revoked@1',${person},${j({ grant_id: G1 })})`, /no live grant of this estate/)
  refuses(`set role service_role; select append_event('${OTHER}','access.binding.revoked@1',${person},${j({ binding_id: B1 })})`, /no live binding of this estate/)
  assert.equal(sql(`select count(*) from access_grants where binding_id='${B1}' and revoked_at is null`), '2')
})

test('revoking a grant stops that grant; revoking the binding stops all of them', () => {
  append(E, 'access.grant.revoked@1', person, { grant_id: G1 })
  assert.equal(sql(`select count(*) from access_grants where binding_id='${B1}' and revoked_at is null`), '1')
  refuses(`set role service_role; select append_event('${E}','access.grant.revoked@1',${person},${j({ grant_id: G1 })})`, /no live grant/)
  append(E, 'access.binding.revoked@1', person, { binding_id: B1 })
  assert.equal(sql(`select count(*) from access_grants where binding_id='${B1}' and revoked_at is null`), '0')
  assert.notEqual(sql(`select revoked_at from access_bindings where id='${B1}'`), '')
})

test('a product connection keeps metadata and the vault slot only; a reconnect supersedes, a disconnect removes', () => {
  const conn = (id) => ({ id, product: 'fabric-inbox', server: 'https://mail.example.com', mcp_url: 'https://mail.example.com/mcp',
    key_id: 'key-1', client_id: 'client.access', level: 'admin', send: 'send', key_expires_at: later(525600),
    secret_ref: { project: 'fabric', env: 'local', name: 'FABRIC_INBOX_CLIENT_SECRET' } })
  append(E, 'product.connected@1', person, conn(C1))
  append(E, 'product.connected@1', person, conn(C2))
  assert.equal(sql(`select string_agg(id || '=' || (removed_at is null), ',' order by connected_seq) from product_connections where estate_id='${E}'`), `${C1}=false,${C2}=true`)
  assert.equal(sql(`select secret_ref->>'name' from product_connections where id='${C2}'`), 'FABRIC_INBOX_CLIENT_SECRET')
  assert.equal(sql(`select count(*) from information_schema.columns where table_name='product_connections' and column_name ilike '%secret%' and column_name <> 'secret_ref'`), '0')
  refuses(`set role service_role; select append_event('${E}','product.connected@1',${person},${j({ ...conn('76000000-0000-4000-8000-000000000043'), server: 'http://mail.example.com' })})`, /check constraint/)
  append(E, 'product.disconnected@1', person, { id: C2 })
  assert.equal(sql(`select count(*) from product_connections where estate_id='${E}' and removed_at is null`), '0')
})

test('a replay of the chain leaves every row as it was (rebuild is idempotent)', () => {
  const snapshot = () => sql(`select md5(string_agg(t::text, '|' order by t::text)) from (
    select row(r.*)::text t from access_requests r where estate_id='${E}' union all
    select row(b.*)::text from access_bindings b where estate_id='${E}' union all
    select row(g.*)::text from access_grants g where estate_id='${E}' union all
    select row(c.*)::text from product_connections c where estate_id='${E}') x`)
  const before = snapshot()
  sql(`select rebuild_estate_projections('${E}')`)
  assert.equal(snapshot(), before)
})

if (failed.length) { console.log(JSON.stringify({ status: 'FAIL', passed: count, failed })); process.exit(1) }
console.log(JSON.stringify({ status: 'PASS', cases: count }))
// #endregion hub-access-schema
