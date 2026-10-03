// The hub's door and device-style consent (ADR-0115 S2–S3), probed the way an external agent reaches it:
// a real MCP client over Streamable HTTP against the real AgentSurface, the real AccessService and its
// store on the fully migrated schema (an owned PostgreSQL cluster, through the PostgREST-shaped
// `psql-rest`), and a real registry read from directories built here. The operator's prompt is the only
// stand-in: it records what it was shown, and the probe answers for the operator.
//
// What must hold, because the whole door rests on it:
//   1. The door token reaches two tools and a binding four; neither reaches a session tool, and a
//      session's one-shot bearer is unchanged — a second initialize is still refused.
//   2. An agent the registry does not know is refused before any prompt.
//   3. Allow → the first status read carries the credential once; the credential then calls, and
//      its grants are what was asked, nothing wider.
//   4. Deny stands until cleared; an expired request cannot be decided; revoking stops the next call.
// #region hub-consent — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#2-an-agent-is-admitted-by-device-style-consent-not-by-a-pasted-key
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-hub-access-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)

const SRC = path.resolve(import.meta.dirname, '../src/main')
const { createPsqlRest } = await import(path.resolve(import.meta.dirname, 'helpers/psql-rest.mjs'))
const { createJournal } = await import(path.resolve(import.meta.dirname, '../../../packages/journal/src/index.ts'))
const { AgentSurface, HubPortUnavailable } = await import(path.join(SRC, 'agentSurface.ts'))
const { AgentRegistry } = await import(path.join(SRC, 'agentRegistry.ts'))
const { createAccessStore } = await import(path.join(SRC, 'accessStore.ts'))
const { AccessService } = await import(path.join(SRC, 'accessService.ts'))
const { hubServerFor, HUB_TOOLS } = await import(path.join(SRC, 'hubTools.ts'))

let count = 0; const failed = []
const test = async (name, fn) => {
  try { await fn(); console.log('PASS ' + name); count++ } catch (e) { failed.push(name); console.log(`FAIL ${name}\n  ${String(e.stack ?? e.message).split('\n').slice(0, 3).join('\n  ')}`) }
}

// ── the machine: a registry with one agent, an estate, the service, the surface
const root = mkdtempSync(path.join(tmpdir(), 'fabric-hub-door-'))
const services = path.join(root, 'services'), providers = path.join(root, 'providers')
mkdirSync(services); mkdirSync(providers)
writeFileSync(path.join(services, 'example-agent.default.json'), JSON.stringify({
  protocol: 'fabric-service/0.1', id: 'example-agent', instance: 'default', name: 'Example agent',
  origin: 'http://127.0.0.1:47501', auth: { tokenFile: '~/.config/example-agent/token' }, lifecycle: { manager: 'none' },
  paths: { data: '~/.local/share/example-agent', logs: [] }, source: { repository: 'https://github.com/example/example-agent' },
  installedAt: '2026-10-03T10:00:00Z', installedBy: 'example-installer'
}))
const registry = new AgentRegistry({ servicesDir: services, providersDir: providers })
const db = createPsqlRest(url)
const journal = createJournal(db)
const E = randomUUID()
const store = createAccessStore({ db, journal, estateId: E })
let clock = Date.now()
const shown = []
const access = new AccessService({ store, registry, present: (p) => shown.push(p), connected: async () => true, now: () => clock })
const OPERATOR = { kind: 'person', id: 'operator' }
const DOOR = 'd'.repeat(43)
const surface = new AgentSurface({
  db, journal, ptys: () => undefined, estateId: E, limits: { budgetCalls: 200 },
  hub: { doorToken: () => DOOR, access, tools: (p) => hubServerFor(p, { access }) }
})
await surface.start()

const connect = async (bearer) => {
  const client = new Client({ name: 'example-agent', version: '0.0.0' })
  await client.connect(new StreamableHTTPClientTransport(new URL(surface.endpoint), { requestInit: { headers: { Authorization: `Bearer ${bearer}` } } }))
  return client
}
const call = async (client, name, args) => {
  const r = await client.callTool({ name, arguments: args })
  return { isError: r.isError === true, value: r.structuredContent }
}
const ask = (extra = {}) => ({ agentId: 'example-agent', callee: 'fabric-inbox', capabilities: ['read_message'], resources: ['news@example.com'], reason: 'summarise the newsletter', ...extra })

let credential = null
let firstRequest = null

await test('the door token reaches exactly the two asking tools, and nothing of a session', async () => {
  const door = await connect(DOOR)
  const names = (await door.listTools()).tools.map((t) => t.name).sort()
  assert.deepEqual(names, [...HUB_TOOLS.door].sort())
  await door.close()
})

await test('an unknown bearer and a near-miss of the door token are refused 401', async () => {
  for (const bearer of ['nope', 'd'.repeat(42), 'e'.repeat(43)]) {
    const r = await fetch(surface.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${bearer}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })
    assert.equal(r.status, 401, `${bearer.slice(0, 4)}… answered ${r.status}`)
  }
})

await test('an agent the registry does not know is refused before any prompt', async () => {
  const door = await connect(DOOR)
  const r = await call(door, 'fabric.access.request', ask({ agentId: 'nobody-here' }))
  assert.equal(r.isError, true)
  assert.match(r.value.error.message, /not registered on this machine.*Nothing was shown to the operator/)
  assert.equal(shown.length, 0)
  await door.close()
})

await test('a request reaches the operator once, naming the agent as the registry knows it; a retry is the same request', async () => {
  const door = await connect(DOOR)
  const r = await call(door, 'fabric.access.request', ask())
  assert.equal(r.isError, false)
  assert.equal(r.value.status, 'pending')
  firstRequest = r.value.requestId
  assert.equal(shown.length, 1)
  assert.equal(shown[0].row.agent_id, 'example-agent.default', 'a bare service id is its .default instance')
  assert.equal(shown[0].row.registry.name, 'Example agent')
  assert.equal(shown[0].row.registry.installed_by, 'example-installer')
  assert.equal(shown[0].row.registry.repository, 'https://github.com/example/example-agent')
  assert.deepEqual(shown[0].row.resources, ['cloudflare:news@example.com'])
  const again = await call(door, 'fabric.access.request', ask())
  assert.equal(again.value.requestId, firstRequest)
  assert.equal(shown.length, 1, 'a retry prompted twice')
  assert.equal((await call(door, 'fabric.access.status', { requestId: firstRequest })).value.status, 'pending')
  await door.close()
})

await test('Allow: the first status read carries the credential once; the second does not', async () => {
  assert.deepEqual(await access.decide(firstRequest, 'allowed', OPERATOR), { ok: true })
  const door = await connect(DOOR)
  const first = await call(door, 'fabric.access.status', { requestId: firstRequest })
  assert.equal(first.value.status, 'allowed')
  assert.match(first.value.credential, /^[A-Za-z0-9_-]{43}$/)
  assert.deepEqual(first.value.grants.map((g) => [g.capability, g.resource]), [['read_message', 'cloudflare:news@example.com']])
  credential = first.value.credential
  const second = await call(door, 'fabric.access.status', { requestId: firstRequest })
  assert.equal(second.value.status, 'allowed')
  assert.equal(second.value.credential, undefined)
  assert.match(second.value.note, /handed over once/)
  const stored = await store.binding(first.value.bindingId)
  assert.match(stored.verifier, /^[0-9a-f]{64}$/)
  assert.notEqual(stored.verifier, credential, 'Fabric kept the credential, not its hash')
  assert.deepEqual(await access.decide(firstRequest, 'denied', OPERATOR), { ok: false, reason: 'that request was already allowed' })
  await door.close()
})

await test('the binding reaches its four tools, lists exactly its grants, and no session tool', async () => {
  const agent = await connect(credential)
  assert.deepEqual((await agent.listTools()).tools.map((t) => t.name).sort(), [...HUB_TOOLS.binding].sort())
  const grants = await call(agent, 'fabric.access.grants', {})
  assert.deepEqual(grants.value.grants.map((g) => [g.callee, g.capability, g.resource]), [['fabric-inbox', 'read_message', 'cloudflare:news@example.com']])
  const r = await call(agent, 'agent.call', { agentId: 'fabric-inbox', capability: 'read_message', input: {} })
  assert.equal(r.value.error.code, 'hub-unavailable', 'with no forwarder configured the call is refused, not faked')
  await agent.close()
})

await test('a field beyond the contract\'s four is refused, so nothing can ride in the arguments', async () => {
  const agent = await connect(credential)
  const r = await agent.callTool({ name: 'agent.call', arguments: { agentId: 'fabric-inbox', capability: 'read_message', input: {}, token: 'x' } })
  assert.equal(r.isError, true)
  await agent.close()
})

await test('incremental consent: the binding asks for more, the operator is asked again, the grants join the same credential', async () => {
  const agent = await connect(credential)
  const more = await call(agent, 'fabric.access.request', ask({ capabilities: ['list_messages'] }))
  assert.equal(more.value.status, 'pending')
  assert.equal(shown.length, 2)
  assert.equal(shown[1].row.asked_by_binding !== null, true)
  await access.decide(more.value.requestId, 'allowed', OPERATOR)
  const status = await call(agent, 'fabric.access.status', { requestId: more.value.requestId })
  assert.equal(status.value.status, 'allowed')
  assert.equal(status.value.credential, undefined, 'an incremental allow mints no second credential')
  const grants = await call(agent, 'fabric.access.grants', {})
  assert.deepEqual(grants.value.grants.map((g) => g.capability).sort(), ['list_messages', 'read_message'])
  const foreign = await call(agent, 'fabric.access.request', ask({ agentId: 'nobody-here' }))
  assert.equal(foreign.isError, true)
  await agent.close()
})

await test('asking again for what the binding already holds extends that grant: one live grant, a later expiry, no duplicate', async () => {
  const agent = await connect(credential)
  const before = (await call(agent, 'fabric.access.grants', {})).value.grants.filter((g) => g.capability === 'read_message')
  assert.equal(before.length, 1)
  clock += 60_000
  const again = await call(agent, 'fabric.access.request', ask({ capabilities: ['read_message'] }))
  assert.equal(again.value.status, 'pending')
  assert.deepEqual(await access.decide(again.value.requestId, 'allowed', OPERATOR), { ok: true })
  const after = (await call(agent, 'fabric.access.grants', {})).value.grants.filter((g) => g.capability === 'read_message')
  assert.equal(after.length, 1, 'a second live grant for the same capability and mailbox was written')
  assert.ok(Date.parse(after[0].expiresAt) > Date.parse(before[0].expiresAt), 'the allow did not extend the grant')
  const status = await call(agent, 'fabric.access.status', { requestId: again.value.requestId })
  assert.deepEqual(status.value.grants.map((g) => [g.capability, g.resource]), [['read_message', 'cloudflare:news@example.com']])
  clock = Date.now()
  await agent.close()
})

await test('Deny stands until cleared: the same request answers denied without prompting; cleared, it prompts again', async () => {
  const door = await connect(DOOR)
  const r = await call(door, 'fabric.access.request', ask({ resources: ['other@example.com'] }))
  const before = shown.length
  await access.decide(r.value.requestId, 'denied', OPERATOR)
  assert.equal((await call(door, 'fabric.access.status', { requestId: r.value.requestId })).value.status, 'denied')
  const again = await call(door, 'fabric.access.request', ask({ resources: ['OTHER@example.com'] }))
  assert.equal(again.value.status, 'denied')
  assert.equal(shown.length, before)
  assert.deepEqual(await access.clearDenial(r.value.requestId, OPERATOR), { ok: true })
  const third = await call(door, 'fabric.access.request', ask({ resources: ['other@example.com'] }))
  assert.equal(third.value.status, 'pending')
  assert.equal(shown.length, before + 1)
  await door.close()
})

await test('a request nobody answered expires after ten minutes and can no longer be decided', async () => {
  const door = await connect(DOOR)
  const r = await call(door, 'fabric.access.request', ask({ resources: ['late@example.com'] }))
  clock += 11 * 60_000
  assert.equal((await call(door, 'fabric.access.status', { requestId: r.value.requestId })).value.status, 'expired')
  const d = await access.decide(r.value.requestId, 'allowed', OPERATOR)
  assert.equal(d.ok, false)
  assert.match(d.reason, /expired/)
  clock = Date.now()
  await door.close()
})

await test('a binding reads only its own requests; the door cannot collect an incremental grant', async () => {
  const agent = await connect(credential)
  const r = await call(agent, 'fabric.access.status', { requestId: randomUUID() })
  assert.equal(r.value.error.code, 'unknown-request')
  await agent.close()
})

await test('revoking a grant removes it from the next answer; revoking the binding closes the door to that credential', async () => {
  const ov = await access.overview()
  const mine = ov.bindings.find((b) => b.agent_id === 'example-agent.default')
  const read = mine.grants.find((g) => g.capability === 'read_message')
  assert.deepEqual(await access.revokeGrant(read.id, OPERATOR), { ok: true })
  const agent = await connect(credential)
  assert.deepEqual((await call(agent, 'fabric.access.grants', {})).value.grants.map((g) => g.capability), ['list_messages'])
  await agent.close()
  assert.deepEqual(await access.revokeBinding(mine.id, OPERATOR), { ok: true })
  const r = await fetch(surface.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${credential}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })
  assert.equal(r.status, 401)
})

await test('a session Fabric starts keeps its one-shot bearer: one initialize, the second refused, no hub tool', async () => {
  const scope = surface.mint(randomUUID(), randomUUID(), null)
  const session = await connect(scope.token)
  const names = (await session.listTools()).tools.map((t) => t.name)
  assert.ok(names.includes('fabric_whoami'))
  assert.ok(!names.some((n) => n.startsWith('fabric.access') || n === 'agent.call'))
  const second = new Client({ name: 'thief', version: '0' })
  await assert.rejects(second.connect(new StreamableHTTPClientTransport(new URL(surface.endpoint), { requestInit: { headers: { Authorization: `Bearer ${scope.token}` } } })))
  await session.close()
})

await test('a port in use is an error naming it, never a quiet move to another port', async () => {
  const blocker = createServer()
  await new Promise((r) => blocker.listen(0, '127.0.0.1', r))
  const port = blocker.address().port
  const other = new AgentSurface({ db, journal, ptys: () => undefined, estateId: E })
  await assert.rejects(other.start({ port }), (e) => e instanceof HubPortUnavailable && e.port === port && /already in use/.test(e.message))
  assert.equal(other.origin, '')
  blocker.close()
})

await surface.stop()
if (failed.length) { console.log(JSON.stringify({ status: 'FAIL', passed: count, failed })); process.exit(1) }
console.log(JSON.stringify({ status: 'PASS', cases: count }))
// #endregion hub-consent
