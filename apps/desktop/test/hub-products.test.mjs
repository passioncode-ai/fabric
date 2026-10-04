// Connecting a product and forwarding to it (ADR-0115 S4), with everything real except the far ends:
//   · the vault is driven through a FAKE Project Observatory engine built here (same CLI shape as the
//     real `vault.py` / `use_secret.py`, including `run`'s scrubbing of what its child prints), which
//     logs every argv it was given — so "the secret never appears in an argv" is a measurement;
//   · the connect callback is POSTed to the REAL AgentSurface route, as Fabric Inbox's app posts it;
//   · `agent.call` forwards with the real MCP SDK client to a FAKE Fabric Inbox MCP server on loopback,
//     which records the headers it received and narrows exactly as the real one does.
// Pure: no database (the store is a recording stand-in; migration 76 has its own suite).
// #region product-connect — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#4-a-product-is-connected-once-by-the-products-own-consent
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

const SRC = path.resolve(import.meta.dirname, '../src/main')
const { createObservatoryVault } = await import(path.join(SRC, 'observatoryVault.ts'))
const { ProductConnector, FABRIC_INBOX } = await import(path.join(SRC, 'productConnect.ts'))
const { forwardToProduct } = await import(path.join(SRC, 'productForwarder.ts'))
const { createAgentCall } = await import(path.join(SRC, 'hubCall.ts'))
const { AgentSurface } = await import(path.join(SRC, 'agentSurface.ts'))

const SECRET = 'cf-secret-' + 'Zq9'.repeat(10)
const ESTATE_A = '00000000-0000-4000-8000-00000000000a'
const ESTATE_B = '00000000-0000-4000-8000-00000000000b'

// ── a fake Project Observatory engine
function fakeObservatory() {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-observatory-'))
  const engine = path.join(root, 'engine'), tools = path.join(engine, 'tools'), bin = path.join(root, 'bin'), store = path.join(root, 'store')
  mkdirSync(tools, { recursive: true }); mkdirSync(bin); mkdirSync(store)
  const log = path.join(root, 'argv.log')
  writeFileSync(path.join(bin, 'project-observatory'), `#!/bin/sh\n[ "$1" = full-path ] && echo "${engine}" && exit 0\nexit 2\n`)
  chmodSync(path.join(bin, 'project-observatory'), 0o755)
  const common = `import json, os, sys, subprocess\nSTORE = ${JSON.stringify(store)}\nwith open(${JSON.stringify(log)}, 'a') as f: f.write(json.dumps(sys.argv) + '\\n')\n`
  writeFileSync(path.join(tools, 'vault.py'), common + `
verb, project, env, name = sys.argv[1:5]
slot = os.path.join(STORE, project, env, name)
value = sys.stdin.read().strip()
if verb == 'put':
    if os.path.exists(slot): sys.stderr.write('already holds a value\\n'); sys.exit(1)
elif verb == 'rotate':
    if not os.path.exists(slot): sys.stderr.write('nothing to rotate\\n'); sys.exit(1)
else: sys.exit(2)
os.makedirs(os.path.dirname(slot), exist_ok=True)
open(slot, 'w').write(value)
print(f'stored {project}/{env}/{name}: length {len(value)}, mode 600; value hidden')
`)
  writeFileSync(path.join(tools, 'use_secret.py'), common + `
args = sys.argv[1:]
cmd = args[0]
env = args[args.index('--env') + 1]
rest = [a for i, a in enumerate(args[1:]) if a != '--env' and args[1:][i - 1] != '--env'] if '--' not in args else None
if cmd == 'where':
    project, name = [a for a in args[1:] if a not in ('--env', env)][:2]
    slot = os.path.join(STORE, project, env, name)
    if os.path.exists(slot): print(f'vault:{project}/{env}/{name}'); sys.exit(0)
    if os.path.exists(os.path.join(STORE, 'ENVFILE')): print('env:projects/fabric/.env'); sys.exit(0)
    sys.stderr.write(f'{name} is not in the vault\\n'); sys.exit(0)
if cmd == 'run':
    head = args[1:args.index('--')]
    project, name = [a for a in head if a not in ('--env', env, '--vault-only')][:2]
    child = args[args.index('--') + 1:]
    import time
    time.sleep(float(os.environ.get('FAKE_RUN_SLEEP', '0')))
    if os.environ.get('FAKE_RUN_NOWRITE'): sys.exit(0)
    value = open(os.path.join(STORE, project, env, name)).read()
    e = dict(os.environ); e[name] = value
    p = subprocess.run(child, env=e, capture_output=True)
    sys.stdout.write(p.stdout.decode().replace(value, '«' + name + '»'))
    sys.stderr.write(p.stderr.decode().replace(value, '«' + name + '»'))
    sys.exit(p.returncode)
sys.exit(2)
`)
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` }
  return { root, store, log, env, launcher: path.join(bin, 'project-observatory') }
}

const slot = { project: 'fabric', env: 'local', name: 'FABRIC_INBOX_CLIENT_SECRET' }

test('vault: put sends the value on stdin only; a second put rotates; read brings it back through a pipe, never an argv', async () => {
  const o = fakeObservatory()
  const vault = createObservatoryVault({ launcher: o.launcher, env: o.env })
  assert.deepEqual(await vault.put(slot, SECRET), { ok: true })
  assert.equal(readFileSync(path.join(o.store, 'fabric/local/FABRIC_INBOX_CLIENT_SECRET'), 'utf8'), SECRET)
  assert.deepEqual(await vault.put(slot, SECRET + 'x'), { ok: true })
  const verbs = readFileSync(o.log, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((a) => a[0].endsWith('vault.py')).map((a) => a[1])
  assert.deepEqual(verbs, ['put', 'rotate'])
  const read = await vault.read(slot)
  assert.deepEqual(read, { ok: true, value: SECRET + 'x' })
  assert.ok(!readFileSync(o.log, 'utf8').includes(SECRET), 'the secret appeared in an argv')
})

test('vault: a value that resolves outside the vault is refused, and so is a missing one', async () => {
  const o = fakeObservatory()
  const vault = createObservatoryVault({ launcher: o.launcher, env: o.env })
  const missing = await vault.read(slot)
  assert.equal(missing.ok, false)
  assert.match(missing.reason, /not in the vault/)
  writeFileSync(path.join(o.store, 'ENVFILE'), '')
  const elsewhere = await vault.read(slot)
  assert.equal(elsewhere.ok, false)
  assert.match(elsewhere.reason, /outside the vault/)
})

test('vault: without Project Observatory the answer is a refusal with that reason', async () => {
  const vault = createObservatoryVault({ launcher: 'project-observatory-not-installed-here', env: process.env })
  const r = await vault.put(slot, SECRET)
  assert.equal(r.ok, false)
  assert.match(r.reason, /Project Observatory is not installed/)
})

// ── the connect flow, through the real surface route
const open = { closed: false }
async function hubWith(connector) {
  const surface = new AgentSurface({
    db: null, journal: null, ptys: () => undefined, estateId: 'e',
    hub: { doorToken: () => (open.closed ? null : 'd'.repeat(43)), access: { authenticate: async () => null }, tools: () => { throw new Error('no tools here') }, callback: (p, req, res) => connector.callback(p, req, res) }
  })
  await surface.start()
  return surface
}
const recordingStore = () => {
  const events = []
  return { events, append: async (type, actor, payload) => { events.push({ type, actor, payload }); return events.length }, liveConnection: async () => null }
}
const deliver = (origin, body, headers = {}) => fetch(`${origin}/fabric/v1/connect/fabric-inbox`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

test('connect: the link is exactly what Fabric Inbox parses, and the state is single-use', async () => {
  const opened = []
  const o = fakeObservatory()
  const store = recordingStore()
  let origin = ''
  const connector = new ProductConnector({ estateId: ESTATE_A, store, vault: createObservatoryVault({ launcher: o.launcher, env: o.env }), origin: () => origin, openExternal: async (u) => { opened.push(u) }, actor: () => ({ kind: 'person', id: 'operator' }) })
  const surface = await hubWith(connector)
  origin = surface.origin
  assert.equal((await connector.begin(FABRIC_INBOX)).ok, true)
  const link = new URL(opened[0])
  assert.equal(link.protocol, 'fabric-inbox:')
  assert.equal(link.hostname, 'connect')
  assert.equal(link.searchParams.get('client'), 'Fabric')
  assert.equal(link.searchParams.get('client_id'), 'fabric')
  assert.equal(link.searchParams.get('level'), 'admin')
  assert.equal(link.searchParams.get('callback'), `${origin}/fabric/v1/connect/fabric-inbox`)
  assert.match(opened[0], /callback=http%3A%2F%2F127\.0\.0\.1%3A\d+%2Ffabric%2Fv1%2Fconnect%2Ffabric-inbox/)
  const state = link.searchParams.get('state')
  assert.match(state, /^[A-Za-z0-9_-]{22,128}$/)

  const key = { id: 'key-1', clientId: 'abc.access', level: 'admin', send: 'send', expiresAt: '2027-10-03T00:00:00Z' }
  const ok = await deliver(origin, { state, outcome: 'connected', server: 'https://mail.example.com', mcpUrl: 'https://mail.example.com/mcp', key, clientSecret: SECRET })
  assert.equal(ok.status, 200)
  assert.equal(store.events.length, 1)
  assert.equal(store.events[0].type, 'product.connected@1')
  // The slot is this estate's and this connection's own (DA-6): prefix, estate hex, connection hex.
  const ref = store.events[0].payload.secret_ref
  assert.deepEqual(ref, { ...FABRIC_INBOX.secret, name: `FABRIC_INBOX_CLIENT_SECRET_0000000000004000800000000000000A_${store.events[0].payload.id.replace(/-/g, '').toUpperCase()}` })
  assert.equal(readFileSync(path.join(o.store, `fabric/local/${ref.name}`), 'utf8'), SECRET)
  assert.ok(!JSON.stringify(store.events).includes(SECRET), 'the secret reached the journal')
  assert.equal(connector.lastOutcome('fabric-inbox').outcome, 'connected')

  const replay = await deliver(origin, { state, outcome: 'connected', server: 'https://mail.example.com', mcpUrl: 'https://mail.example.com/mcp', key, clientSecret: 'other' })
  assert.equal(replay.status, 400, 'a spent state was accepted twice')
  await surface.stop()
})

test('connect: denied and failed are recorded; a browser, a wrong state, an expired state and a non-https server are refused', async () => {
  const opened = []
  let clock = Date.now()
  const store = recordingStore()
  const puts = []
  let origin = ''
  const connector = new ProductConnector({ estateId: ESTATE_A, store, vault: { put: async (s, v) => { puts.push(v); return { ok: true } }, read: async () => ({ ok: false, reason: 'n/a' }) }, origin: () => origin, openExternal: async (u) => { opened.push(u) }, actor: () => ({ kind: 'person', id: 'operator' }), now: () => clock })
  const surface = await hubWith(connector)
  origin = surface.origin
  const stateOf = async () => { await connector.begin(FABRIC_INBOX); return new URL(opened.at(-1)).searchParams.get('state') }

  assert.equal((await deliver(origin, { state: await stateOf(), outcome: 'denied' })).status, 200)
  assert.equal(connector.lastOutcome('fabric-inbox').outcome, 'denied')
  assert.equal((await deliver(origin, { state: await stateOf(), outcome: 'failed', error: 'sign_in_required' })).status, 200)
  assert.equal(connector.lastOutcome('fabric-inbox').problem.code, 'sign_in_required')
  assert.match(connector.lastOutcome('fabric-inbox').reason, /sign in again/)

  const s1 = await stateOf()
  assert.equal((await deliver(origin, { state: s1, outcome: 'denied' }, { origin: 'https://evil.example.com' })).status, 403)
  assert.equal((await deliver(origin, { state: 'x'.repeat(43), outcome: 'denied' })).status, 400)
  const s2 = await stateOf()
  clock += 11 * 60_000
  assert.equal((await deliver(origin, { state: s2, outcome: 'denied' })).status, 400)
  clock = Date.now()
  const s3 = await stateOf()
  const bad = await deliver(origin, { state: s3, outcome: 'connected', server: 'http://mail.example.com', mcpUrl: 'https://mail.example.com/mcp', key: { id: 'k', clientId: 'c', level: 'admin', send: 'send', expiresAt: null }, clientSecret: SECRET })
  assert.equal(bad.status, 400)
  assert.equal(puts.length, 0, 'an unusable delivery reached the vault')
  // Only the product's own Deny and failure are journalled (DA-7); no refused delivery is.
  assert.deepEqual(store.events.map((e) => e.type), ['product.connect.refused@1', 'product.connect.refused@1'])
  await surface.stop()
})

test('a closed hub (no published door token) opens neither the callback nor any external door', async () => {
  const opened = []
  let origin = ''
  const connector = new ProductConnector({ estateId: ESTATE_A, store: recordingStore(), vault: { put: async () => ({ ok: true }), read: async () => ({ ok: false, reason: 'n/a' }) }, origin: () => origin, openExternal: async (u) => { opened.push(u) }, actor: () => ({ kind: 'person', id: 'operator' }) })
  const surface = await hubWith(connector)
  origin = surface.origin
  await connector.begin(FABRIC_INBOX)
  const state = new URL(opened[0]).searchParams.get('state')
  open.closed = true
  try {
    assert.equal((await deliver(origin, { state, outcome: 'denied' })).status, 404)
  } finally {
    open.closed = false
    await surface.stop()
  }
})

test('connect: without the vault the callback answers 503, so the product revokes the key', async () => {
  const opened = []
  const store = recordingStore()
  let origin = ''
  const connector = new ProductConnector({ estateId: ESTATE_A, store, vault: createObservatoryVault({ launcher: 'project-observatory-not-installed-here' }), origin: () => origin, openExternal: async (u) => { opened.push(u) }, actor: () => ({ kind: 'person', id: 'operator' }) })
  const surface = await hubWith(connector)
  origin = surface.origin
  await connector.begin(FABRIC_INBOX)
  const state = new URL(opened[0]).searchParams.get('state')
  const r = await deliver(origin, { state, outcome: 'connected', server: 'https://mail.example.com', mcpUrl: 'https://mail.example.com/mcp', key: { id: 'k', clientId: 'c', level: 'admin', send: 'send', expiresAt: null }, clientSecret: SECRET })
  assert.equal(r.status, 503)
  assert.match((await r.json()).reason, /Project Observatory is not installed/)
  // The secret first (ER-6): a vault that would not keep it leaves nothing recorded.
  assert.deepEqual(store.events, [])
  assert.equal(connector.lastOutcome('fabric-inbox').problem.code, 'vault')
  assert.match(connector.lastOutcome('fabric-inbox').reason, /not kept/)
  await surface.stop()
})

// ── a fake Fabric Inbox MCP server: checks the Access headers, narrows by X-Fabric-Accounts
// `version` is what the server says it is at initialize (Fabric Inbox's package version); `slowCallMs` holds
// every tools/call that long AFTER the tool ran; `echo500` answers tools/call 500 with the request's headers.
async function fakeInbox({ version = '0.9.0', slowCallMs = 0, echo500 = false } = {}) {
  const seen = []
  const http = createServer(async (req, res) => {
    const headers = { id: req.headers['cf-access-client-id'], secret: req.headers['cf-access-client-secret'], accounts: req.headers['x-fabric-accounts'] ?? null }
    if (headers.id !== 'abc.access' || headers.secret !== SECRET) { res.writeHead(403).end('Forbidden'); return }
    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined
    if (body?.method === 'tools/call') seen.push({ ...headers, tool: body.params.name, arguments: body.params.arguments, traceparent: body.params._meta?.traceparent })
    if (body?.method === 'tools/call' && echo500) { res.writeHead(500, { 'content-type': 'text/plain' }).end(`upstream said: CF-Access-Client-Id=${headers.id}`); return }
    if (body?.method === 'tools/call' && slowCallMs) await new Promise((r) => setTimeout(r, slowCallMs))
    const narrowed = headers.accounts ? headers.accounts.split(',') : null
    const server = new McpServer({ name: 'fabric-inbox', version })
    server.registerTool('read_message', { inputSchema: { accountId: z.string(), messageId: z.string() } }, async (a) =>
      narrowed && !narrowed.includes(a.accountId.startsWith('gmail:') ? a.accountId : `cloudflare:${a.accountId.replace(/^cloudflare:/, '').toLowerCase()}`)
        ? { content: [{ type: 'text', text: '{"error":"forbidden"}' }], isError: true }
        : { content: [{ type: 'text', text: 'ok' }], structuredContent: { subject: 'Weekly news', accountId: a.accountId } })
    server.registerTool('list_messages', { inputSchema: { accountId: z.string().optional() } }, async () => ({ content: [{ type: 'text', text: 'ok' }], structuredContent: { messages: [], scope: narrowed } }))
    server.registerTool('create_address', { inputSchema: { localPart: z.string(), domain: z.string(), forwardTo: z.string().optional() } }, async (a) => ({ content: [{ type: 'text', text: 'ok' }], structuredContent: { created: `${a.localPart}@${a.domain}`, narrowed: narrowed !== null, ...(a.forwardTo ? { forwardTo: a.forwardTo } : {}) } }))
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.on('close', () => { void transport.close(); void server.close() })
    await server.connect(transport)
    await transport.handleRequest(req, res, body)
  })
  await new Promise((r) => http.listen(0, '127.0.0.1', r))
  return { seen, url: `http://127.0.0.1:${http.address().port}/mcp`, close: () => http.close() }
}

const binding = { id: 'b-1', agent_id: 'example-agent.default', request_id: 'r', verifier: 'v', created_at: '', claimed_at: '', revoked_at: null }
const grant = (capability, resource) => ({ id: `${capability}@${resource}`, binding_id: 'b-1', request_id: 'r', agent_id: 'example-agent.default', callee: 'fabric-inbox', capability, resource, decided_at: '', expires_at: '2099-01-01T00:00:00Z', revoked_at: null })
const TRACE = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'

async function hubCall(grants, opts = {}) {
  const inbox = await fakeInbox()
  const events = []
  const connection = opts.connected === false ? null : { id: 'c-1', product: 'fabric-inbox', server: 'https://mail.example.com', mcp_url: inbox.url, key_id: 'key-1', client_id: 'abc.access', level: 'admin', send: 'send', key_expires_at: null, secret_ref: slot, connected_at: '', removed_at: null }
  let reads = 0
  const call = createAgentCall({
    access: { liveGrantsOf: async () => grants },
    store: { liveConnection: async () => connection, append: async (type, actor, payload) => { events.push({ type, actor, payload }); return events.length } },
    vault: { read: async () => { reads++; return { ok: true, value: SECRET } } },
    forward: forwardToProduct,
    estateId: 'estate-1'
  })
  return { inbox, events, call, reads: () => reads }
}

test('agent.call forwards inside the grant: three headers, narrowed to the granted mailboxes, a child span, the interop envelope', async () => {
  const h = await hubCall([grant('read_message', 'cloudflare:news@example.com'), grant('read_message', 'gmail:x1')])
  const r = await h.call(binding, { agentId: 'fabric-inbox', capability: 'read_message', input: { accountId: 'News@Example.com', messageId: 'm1' } }, { traceparent: TRACE })
  assert.equal(r.isError, undefined)
  const env = r.structuredContent
  assert.equal(env.contractVersion, '0.1.0')
  assert.equal(env.outcome, 'succeeded')
  assert.deepEqual(env.output, { subject: 'Weekly news', accountId: 'News@Example.com' })
  assert.deepEqual(env.scope.writeScopes, ['cloudflare:news@example.com', 'gmail:x1'])
  for (const k of ['id', 'done', 'proof', 'scope', 'notVerified', 'artifacts', 'createdAt', 'producer', 'usage', 'output', 'trace']) assert.ok(k in env, `envelope lacks ${k}`)
  const sent = h.inbox.seen[0]
  assert.equal(sent.tool, 'read_message')
  assert.equal(sent.accounts, 'cloudflare:news@example.com,gmail:x1')
  const [, traceId, parent] = /^00-([0-9a-f]{32})-([0-9a-f]{16})-01$/.exec(sent.traceparent)
  assert.equal(traceId, '0af7651916cd43dd8448eb211c80319c', 'the hop is in the caller\'s trace')
  assert.notEqual(parent, 'b7ad6b7169203331', 'the hop is a new span')
  assert.equal(env.trace.traceparent, sent.traceparent)
  assert.equal(h.events.length, 1)
  const span = h.events[0]
  assert.equal(span.type, 'hub.call.forwarded@1')
  assert.equal(span.payload.parent_span_id, 'b7ad6b7169203331')
  assert.equal(span.payload.outcome, 'succeeded')
  assert.deepEqual(span.payload.grant_ids, ['read_message@cloudflare:news@example.com', 'read_message@gmail:x1'])
  assert.match(span.payload.args_hash, /^sha256:[0-9a-f]{64}$/)
  assert.ok(!JSON.stringify(h.events).includes('m1') && !JSON.stringify(h.events).includes(SECRET), 'the span carried arguments or the secret')
  h.inbox.close()
})

test('agent.call outside the grant is access-required with the request arguments, and nothing is sent', async () => {
  const h = await hubCall([grant('read_message', 'cloudflare:news@example.com')])
  const other = await h.call(binding, { agentId: 'fabric-inbox', capability: 'read_message', input: { accountId: 'other@example.com', messageId: 'm' } }, undefined)
  assert.equal(other.isError, true)
  assert.equal(other.structuredContent.error.code, 'access-required')
  assert.deepEqual(other.structuredContent.error.data.request.resources, ['cloudflare:other@example.com'])
  assert.deepEqual(other.structuredContent.error.data.request.capabilities, ['read_message'])
  const send = await h.call(binding, { agentId: 'fabric-inbox', capability: 'send_email', input: { accountId: 'news@example.com' } }, undefined)
  assert.equal(send.structuredContent.error.code, 'access-required')
  const nested = await h.call(binding, { agentId: 'fabric-inbox', capability: 'read_message', input: { accountId: 'news@example.com', messageId: 'm', thread: { accountId: 'other@example.com' } } }, undefined)
  assert.equal(nested.structuredContent.error.code, 'access-required', 'a second mailbox deeper in the input rode along')
  const unreadable = await h.call(binding, { agentId: 'fabric-inbox', capability: 'read_message', input: { accountId: 12 } }, undefined)
  assert.equal(unreadable.structuredContent.error.code, 'invalid-arguments')
  const elsewhere = await h.call(binding, { agentId: 'example-other', capability: 'read_message', input: {} }, undefined)
  assert.equal(elsewhere.structuredContent.error.code, 'unknown-callee')
  assert.equal(h.inbox.seen.length, 0)
  assert.equal(h.reads(), 0, 'the secret was read for a call that was refused')
  assert.deepEqual(h.events.map((e) => e.payload.outcome), ['refused', 'refused', 'refused', 'refused', 'refused'])
  assert.equal(h.events[0].payload.trace_incomplete, true)
  h.inbox.close()
})

test('a call with no mailbox argument is narrowed at the product to the granted ones', async () => {
  const h = await hubCall([grant('list_messages', 'cloudflare:news@example.com')])
  const r = await h.call(binding, { agentId: 'fabric-inbox', capability: 'list_messages', input: {} }, { traceparent: TRACE })
  assert.deepEqual(r.structuredContent.output.scope, ['cloudflare:news@example.com'])
  h.inbox.close()
})

test('a workspace setup runs without the narrowing header only when its own grant names it', async () => {
  const h = await hubCall([grant('create_address', 'cloudflare:news@example.com')])
  const ok = await h.call(binding, { agentId: 'fabric-inbox', capability: 'create_address', input: { localPart: 'news', domain: 'example.com' } }, { traceparent: TRACE })
  assert.deepEqual(ok.structuredContent.output, { created: 'news@example.com', narrowed: false })
  assert.equal(h.inbox.seen[0].accounts, null)
  const other = await h.call(binding, { agentId: 'fabric-inbox', capability: 'create_address', input: { localPart: 'admin', domain: 'example.com' } }, undefined)
  assert.equal(other.structuredContent.error.code, 'access-required')
  assert.equal(h.inbox.seen.length, 1)
  h.inbox.close()
})

test('not connected: product-not-connected, nothing read from the vault', async () => {
  const h = await hubCall([grant('read_message', 'cloudflare:news@example.com')], { connected: false })
  const r = await h.call(binding, { agentId: 'fabric-inbox', capability: 'read_message', input: { accountId: 'news@example.com', messageId: 'm' } }, undefined)
  assert.equal(r.structuredContent.error.code, 'product-not-connected')
  assert.equal(h.reads(), 0)
  h.inbox.close()
})

test('idempotencyKey: a retry returns the first answer and sends nothing; the same key for another call is refused', async () => {
  const h = await hubCall([grant('read_message', 'cloudflare:news@example.com')])
  const args = { agentId: 'fabric-inbox', capability: 'read_message', input: { accountId: 'news@example.com', messageId: 'm' }, idempotencyKey: 'k-1' }
  const a = await h.call(binding, args, undefined)
  const b = await h.call(binding, { ...args, input: { messageId: 'm', accountId: 'news@example.com' } }, undefined)
  assert.deepEqual(b, a)
  assert.equal(h.inbox.seen.length, 1)
  const c = await h.call(binding, { ...args, input: { accountId: 'news@example.com', messageId: 'other' } }, undefined)
  assert.equal(c.structuredContent.error.code, 'idempotency-conflict')
  h.inbox.close()
})

test('a product that refuses Fabric\'s key is said as product-refused, and the secret is in no message', async () => {
  const inbox = await fakeInbox()
  const r = await forwardToProduct({ mcpUrl: inbox.url, clientId: 'abc.access', clientSecret: 'wrong-' + SECRET, narrowing: ['cloudflare:news@example.com'], narrowingSince: { server: 'fabric-inbox', version: '0.9.0' }, capability: 'read_message', input: {}, traceparent: TRACE, timeoutMs: 5000 })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'product-refused')
  assert.ok(!r.message.includes(SECRET))
  const down = await forwardToProduct({ mcpUrl: 'http://127.0.0.1:9/mcp', clientId: 'abc.access', clientSecret: SECRET, narrowing: null, capability: 'read_message', input: {}, traceparent: TRACE, timeoutMs: 3000 })
  assert.equal(down.ok, false)
  assert.equal(down.code, 'product-unreachable')
  inbox.close()
})

// ── finding 1 (security review, PR #7): the SDK's GET stream copies the headers but not requestInit, so
// it followed a redirect WITH the Access secret. Every request now refuses a redirect, the deadline holds
// for the whole exchange, and the connect callback's body has a deadline of its own.
async function redirectingProduct() {
  const elsewhere = []
  const evil = createServer((req, res) => {
    elsewhere.push({ method: req.method, id: req.headers['cf-access-client-id'] ?? null, secret: req.headers['cf-access-client-secret'] ?? null })
    res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write(': hello\n\n')
  })
  await new Promise((r) => evil.listen(0, '127.0.0.1', r))
  const evilUrl = `http://127.0.0.1:${evil.address().port}/collect`
  const http = createServer(async (req, res) => {
    if (req.method === 'GET') { res.writeHead(307, { location: evilUrl }).end(); return }
    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined
    const server = new McpServer({ name: 'fabric-inbox', version: '0.9.0' })
    server.registerTool('list_messages', { inputSchema: { accountId: z.string().optional() } }, async () => ({ content: [{ type: 'text', text: 'ok' }], structuredContent: { messages: [] } }))
    // Stateful enough that the initialized notification is answered 202 — the answer that makes the SDK open its GET stream.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.on('close', () => { void transport.close(); void server.close() })
    await server.connect(transport)
    await transport.handleRequest(req, res, body)
  })
  await new Promise((r) => http.listen(0, '127.0.0.1', r))
  return { elsewhere, url: `http://127.0.0.1:${http.address().port}/mcp`, close: () => { http.close(); evil.closeAllConnections?.(); evil.close() } }
}

test('a product that redirects ANY request — the SDK\'s GET stream included — is refused, and the other origin never sees the key', async () => {
  const p = await redirectingProduct()
  try {
    const r = await forwardToProduct({ mcpUrl: p.url, clientId: 'abc.access', clientSecret: SECRET, narrowing: ['cloudflare:news@example.com'], narrowingSince: { server: 'fabric-inbox', version: '0.9.0' }, capability: 'list_messages', input: {}, traceparent: TRACE, timeoutMs: 5000 })
    await new Promise((resolve) => setTimeout(resolve, 200))
    assert.deepEqual(p.elsewhere, [], 'the redirect target received a request')
    assert.equal(r.ok, false, 'a product that redirected was answered as if nothing happened')
    assert.equal(r.code, 'product-refused')
    assert.match(r.message, /redirect/)
    assert.ok(!r.message.includes(SECRET))
  } finally { p.close() }
})

test('the deadline holds for the whole exchange: a product that never answers is unreachable within the timeout', async () => {
  const sockets = new Set()
  const silent = createServer(() => { /* never answers, not even initialize */ })
  silent.on('connection', (s) => sockets.add(s))
  await new Promise((r) => silent.listen(0, '127.0.0.1', r))
  try {
    const started = Date.now()
    const r = await forwardToProduct({ mcpUrl: `http://127.0.0.1:${silent.address().port}/mcp`, clientId: 'abc.access', clientSecret: SECRET, narrowing: null, capability: 'list_messages', input: {}, traceparent: TRACE, timeoutMs: 400 })
    assert.ok(Date.now() - started < 3000, `the call took ${Date.now() - started} ms against a 400 ms deadline`)
    assert.equal(r.ok, false)
    assert.equal(r.code, 'product-unreachable')
    assert.match(r.message, /did not answer within/)
    assert.equal(r.reached, false, 'a product that never answered initialize was said to have been reached')
  } finally { for (const s of sockets) s.destroy(); silent.close() }
})

// ── ER-1 (verification iteration 2 for 0.3.1): a tool that ran, but whose answer came after the deadline
test('ER-1: a product that runs the tool but answers after the deadline: the forward says the call reached it, and the hub never sends that key again', async () => {
  const inbox = await fakeInbox({ slowCallMs: 1500 })
  try {
    const r = await forwardToProduct({ mcpUrl: inbox.url, clientId: 'abc.access', clientSecret: SECRET, narrowing: ['cloudflare:news@example.com'], narrowingSince: { server: 'fabric-inbox', version: '0.9.0' }, capability: 'read_message', input: { accountId: 'news@example.com', messageId: 'm' }, traceparent: TRACE, timeoutMs: 500 })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'product-unreachable')
    assert.equal(r.reached, true, 'a call the product received was said not to have reached it')
    const events = []
    const call = createAgentCall({
      access: { liveGrantsOf: async () => [grant('read_message', 'cloudflare:news@example.com')] },
      store: { liveConnection: async () => ({ id: 'c-1', product: 'fabric-inbox', server: 'https://mail.example.com', mcp_url: inbox.url, key_id: 'k', client_id: 'abc.access', level: 'admin', send: 'send', key_expires_at: null, secret_ref: slot, connected_at: '', removed_at: null }), append: async (type, actor, payload) => { events.push(payload); return events.length } },
      vault: { read: async () => ({ ok: true, value: SECRET }) },
      forward: (req) => forwardToProduct({ ...req, timeoutMs: 500 }),
      estateId: 'estate-1'
    })
    const a = { agentId: 'fabric-inbox', capability: 'read_message', input: { accountId: 'news@example.com', messageId: 'm' }, idempotencyKey: 'deadline-1' }
    const first = await call(binding, a, undefined)
    assert.equal(first.structuredContent.error.code, 'outcome-unknown')
    const again = await call(binding, a, undefined)
    assert.equal(again.structuredContent.error.code, 'outcome-unknown')
    assert.equal(inbox.seen.length, 2, 'the hub sent the call a second time (one direct forward above, one through the hub)')
  } finally { inbox.close() }
})

// ── ER-11: a product's error that echoes the request's headers carries no client id out of the forwarder
test('ER-11: a product error that echoes its headers: neither the secret nor the client id is in the message', async () => {
  const inbox = await fakeInbox({ echo500: true })
  try {
    const r = await forwardToProduct({ mcpUrl: inbox.url, clientId: 'abc.access', clientSecret: SECRET, narrowing: ['cloudflare:news@example.com'], narrowingSince: { server: 'fabric-inbox', version: '0.9.0' }, capability: 'read_message', input: { accountId: 'news@example.com', messageId: 'm' }, traceparent: TRACE, timeoutMs: 3000 })
    assert.equal(r.ok, false)
    assert.doesNotMatch(r.message, /abc\.access/, 'the client id reached the message')
    assert.ok(!r.message.includes(SECRET))
  } finally { inbox.close() }
})

test('a narrowing entry carrying a separator or a line break is refused before anything is sent', async () => {
  const inbox = await fakeInbox()
  try {
    for (const bad of ['cloudflare:a@example.com,cloudflare:ceo@corp.com', 'cloudflare:a@example.com\r\nX-Other: 1', 'cloudflare:a@example.com\n']) {
      const r = await forwardToProduct({ mcpUrl: inbox.url, clientId: 'abc.access', clientSecret: SECRET, narrowing: [bad], capability: 'list_messages', input: {}, traceparent: TRACE, timeoutMs: 3000 })
      assert.equal(r.ok, false, `${JSON.stringify(bad)} was sent`)
      assert.equal(r.code, 'product-error')
    }
    assert.equal(inbox.seen.length, 0)
  } finally { inbox.close() }
})

test('a vault that cannot hand over the key: the agent hears a plain sentence, never the vault\'s own output', async () => {
  const leaky = 'Traceback (most recent call last): File "/Users/someone/engine/tools/use_secret.py", line 9 — slot fabric/local/FABRIC_INBOX_CLIENT_SECRET'
  const call = createAgentCall({
    access: { liveGrantsOf: async () => [grant('read_message', 'cloudflare:news@example.com')] },
    store: { liveConnection: async () => ({ id: 'c-1', product: 'fabric-inbox', server: 'https://mail.example.com', mcp_url: 'https://mail.example.com/mcp', key_id: 'k', client_id: 'abc.access', level: 'admin', send: 'send', key_expires_at: null, secret_ref: slot, connected_at: '', removed_at: null }), append: async () => 1 },
    vault: { read: async () => ({ ok: false, reason: leaky }) },
    forward: async () => { throw new Error('nothing may be forwarded without the key') },
    estateId: 'estate-1'
  })
  const r = await call(binding, { agentId: 'fabric-inbox', capability: 'read_message', input: { accountId: 'news@example.com', messageId: 'm' } }, undefined)
  assert.equal(r.structuredContent.error.code, 'product-credential-unavailable')
  for (const piece of ['Traceback', '/Users/someone', 'use_secret.py', 'FABRIC_INBOX_CLIENT_SECRET'])
    assert.ok(!r.structuredContent.error.message.includes(piece), `the agent was told ${piece}`)
  assert.match(r.structuredContent.error.message, /Nothing was sent/)
})

test('connect: a callback whose body does not arrive in time is answered 408, and the hub is not held open', async () => {
  const opened = []
  let origin = ''
  const connector = new ProductConnector({ estateId: ESTATE_A, store: recordingStore(), vault: { put: async () => ({ ok: true }), read: async () => ({ ok: false, reason: 'n/a' }) }, origin: () => origin, openExternal: async (u) => { opened.push(u) }, actor: () => ({ kind: 'person', id: 'operator' }), bodyTimeoutMs: 300 })
  const surface = await hubWith(connector)
  origin = surface.origin
  try {
    const { connect } = await import('node:net')
    const port = Number(new URL(origin).port)
    const started = Date.now()
    const answer = await new Promise((resolve, reject) => {
      const s = connect(port, '127.0.0.1', () => {
        s.write(`POST /fabric/v1/connect/fabric-inbox HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 200\r\n\r\n{"state":`)
      })
      let got = ''
      s.on('data', (d) => { got += d.toString('utf8') })
      s.on('close', () => resolve(got))
      s.on('error', reject)
      setTimeout(() => { s.destroy(); resolve(got) }, 4000)
    })
    assert.match(answer, /^HTTP\/1\.1 408/, `answered ${JSON.stringify(answer.slice(0, 40))}`)
    assert.ok(Date.now() - started < 3000)
  } finally { await surface.stop() }
})

test('finding 4: create_address forwards only the address\'s own fields; forwardTo needs its own grant for that address; anything else is refused', async () => {
  const h = await hubCall([grant('create_address', 'cloudflare:news@example.com')])
  const input = { localPart: 'news', domain: 'example.com', forwardTo: 'copy@elsewhere.example' }
  const without = await h.call(binding, { agentId: 'fabric-inbox', capability: 'create_address', input }, undefined)
  assert.equal(without.structuredContent.error.code, 'access-required')
  assert.deepEqual(without.structuredContent.error.data.request.capabilities, ['create_address.forward_to'])
  assert.deepEqual(without.structuredContent.error.data.request.resources, ['cloudflare:news@example.com'])
  const odd = await h.call(binding, { agentId: 'fabric-inbox', capability: 'create_address', input: { localPart: 'news', domain: 'example.com', routeAll: true } }, undefined)
  assert.equal(odd.structuredContent.error.code, 'invalid-arguments')
  const direct = await h.call(binding, { agentId: 'fabric-inbox', capability: 'create_address.forward_to', input: { localPart: 'news', domain: 'example.com' } }, undefined)
  assert.equal(direct.structuredContent.error.code, 'invalid-arguments')
  assert.equal(h.inbox.seen.length, 0, 'an ungranted extra reached the product')
  h.inbox.close()

  const g = await hubCall([grant('create_address', 'cloudflare:news@example.com'), grant('create_address.forward_to', 'cloudflare:news@example.com')])
  const ok = await g.call(binding, { agentId: 'fabric-inbox', capability: 'create_address', input }, { traceparent: TRACE })
  assert.deepEqual(ok.structuredContent.output, { created: 'news@example.com', narrowed: false, forwardTo: 'copy@elsewhere.example' })
  assert.deepEqual(g.events[0].payload.grant_ids, ['create_address@cloudflare:news@example.com', 'create_address.forward_to@cloudflare:news@example.com'])
  g.inbox.close()
})

test('finding 5: a refusal made before forwarding is not remembered — Allow, then the same idempotencyKey reaches the product', async () => {
  const grants = []
  const h = await hubCall(grants)
  const args = { agentId: 'fabric-inbox', capability: 'read_message', input: { accountId: 'news@example.com', messageId: 'm' }, idempotencyKey: 'k-allow' }
  const first = await h.call(binding, args, undefined)
  assert.equal(first.structuredContent.error.code, 'access-required')
  grants.push(grant('read_message', 'cloudflare:news@example.com')) // the operator allowed
  const second = await h.call(binding, args, undefined)
  assert.equal(second.structuredContent.outcome, 'succeeded', 'the 24-hour cache replayed a refusal made before anything was sent')
  assert.equal(h.inbox.seen.length, 1)
  const third = await h.call(binding, args, undefined)
  assert.deepEqual(third, second, 'an answer the product produced is replayed')
  assert.equal(h.inbox.seen.length, 1)
  h.inbox.close()
})

test('finding 5: the idempotency memory is per binding — one binding cannot evict another\'s answers', async () => {
  let forwarded = 0
  const call = createAgentCall({
    access: { liveGrantsOf: async (b) => [{ ...grant('list_messages', 'cloudflare:news@example.com'), binding_id: b.id }] },
    store: { liveConnection: async () => ({ id: 'c-1', product: 'fabric-inbox', server: 'https://mail.example.com', mcp_url: 'https://mail.example.com/mcp', key_id: 'k', client_id: 'abc.access', level: 'admin', send: 'send', key_expires_at: null, secret_ref: slot, connected_at: '', removed_at: null }), append: async () => 1 },
    vault: { read: async () => ({ ok: true, value: SECRET }) },
    forward: async () => { forwarded++; return { ok: true, result: { structuredContent: { n: forwarded } }, wallMs: 1 } },
    estateId: 'estate-1'
  })
  const a = { ...binding, id: 'b-a' }, b = { ...binding, id: 'b-b' }
  const args = (key) => ({ agentId: 'fabric-inbox', capability: 'list_messages', input: {}, idempotencyKey: key })
  const kept = await call(a, args('mine'), undefined)
  for (let i = 0; i < 1100; i++) await call(b, args(`flood-${i}`), undefined)
  const before = forwarded
  const again = await call(a, args('mine'), undefined)
  assert.equal(forwarded, before, 'binding b\'s calls evicted binding a\'s answer, so a retry was sent twice')
  assert.deepEqual(again, kept)
  const sameKeyOtherBinding = await call(b, args('mine'), undefined)
  assert.equal(forwarded, before + 1, 'a key is one binding\'s, not shared')
  assert.notDeepEqual(sameKeyOtherBinding.structuredContent.output, kept.structuredContent.output)
})

// ── the connect write order and an explicit reconnect (security review of PR #7, LOW)
async function connectWith({ append, put, live = null }) {
  const opened = []
  const events = []
  const puts = []
  let origin = ''
  const store = {
    events,
    append: async (type, actor, payload) => { await append?.(type, payload); events.push({ type, payload }); return events.length },
    liveConnection: async () => live
  }
  const connector = new ProductConnector({ estateId: ESTATE_A, store, vault: { put: async (s, v) => { puts.push(v); return put ? put(v) : { ok: true } }, read: async () => ({ ok: false, reason: 'n/a' }) }, origin: () => origin, openExternal: async (u) => { opened.push(u) }, actor: () => ({ kind: 'person', id: 'operator' }) })
  const surface = await hubWith(connector)
  origin = surface.origin
  return { connector, surface, events, puts, opened, origin }
}
const delivery = (state) => ({ state, outcome: 'connected', server: 'https://mail.example.com', mcpUrl: 'https://mail.example.com/mcp', key: { id: 'key-2', clientId: 'new.access', level: 'admin', send: 'send', expiresAt: null }, clientSecret: SECRET + '-new' })

test('connect: a failed record answers non-2xx after the secret went to a slot of its own — the live connection\'s slot is untouched', async () => {
  const c = await connectWith({ append: async () => { throw new Error('journal down') } })
  try {
    await c.connector.begin(FABRIC_INBOX, { reconnect: true })
    const r = await deliver(c.origin, delivery(new URL(c.opened[0]).searchParams.get('state')))
    assert.equal(r.status, 500)
    assert.deepEqual(c.puts, [SECRET + '-new'], 'the new secret goes only to its own new slot')
    assert.deepEqual(c.events, [])
  } finally { await c.surface.stop() }
})

test('connect: a secret the vault would not keep is never recorded, so no client id is left beside another key\'s secret', async () => {
  const c = await connectWith({ put: async () => ({ ok: false, reason: 'vault locked' }) })
  try {
    await c.connector.begin(FABRIC_INBOX)
    const r = await deliver(c.origin, delivery(new URL(c.opened[0]).searchParams.get('state')))
    assert.equal(r.status, 503)
    assert.deepEqual(c.events, [])
    assert.match(c.connector.lastOutcome('fabric-inbox').reason, /not kept/)
  } finally { await c.surface.stop() }
})

test('connect: a product already connected is reconnected only when the operator chose Reconnect', async () => {
  const live = { id: 'c-1', product: 'fabric-inbox', server: 'https://mail.example.com', mcp_url: 'https://mail.example.com/mcp', key_id: 'key-1', client_id: 'abc.access', level: 'admin', send: 'send', key_expires_at: null, secret_ref: slot, connected_at: '', removed_at: null }
  const c = await connectWith({ live })
  try {
    const refused = await c.connector.begin(FABRIC_INBOX)
    assert.equal(refused.ok, false)
    assert.equal(refused.problem.code, 'already-connected')
    assert.match(refused.reason, /already connected.*reconnect it/)
    assert.equal(c.opened.length, 0, 'the product was opened without the operator choosing to reconnect')
    assert.equal((await c.connector.begin(FABRIC_INBOX, { reconnect: true })).ok, true)
    assert.equal(c.opened.length, 1)
  } finally { await c.surface.stop() }
})
// ── verification iteration 1 for 0.3.1: the callback's deadline, a slot per estate and connection, the product's refusals
/** An estate-scoped connection store applying product.connected@1 / product.disconnected@1 as migration 76's projector does. */
function connectionStore(opts = {}) {
  const events = []
  const connections = new Map()
  return {
    events, connections,
    liveConnection: async (p) => [...connections.values()].find((c) => c.product === p && c.removed_at === null) ?? null,
    append: async (type, actor, payload) => {
      await opts.beforeAppend?.(type, payload)
      events.push({ type, payload })
      if (type === 'product.connected@1') {
        for (const c of connections.values()) if (c.product === payload.product && !c.removed_at) c.removed_at = 'superseded'
        connections.set(payload.id, { ...payload, removed_at: null })
      } else if (type === 'product.disconnected@1') connections.get(payload.id).removed_at = 'withdrawn'
      return events.length
    }
  }
}
function memoryVault(opts = {}) {
  const slots = new Map()
  return {
    slots,
    put: async (slot, value) => { await opts.beforePut?.(slot); slots.set(`${slot.project}/${slot.env}/${slot.name}`, value); return opts.answer ?? { ok: true } },
    read: async (slot) => (slots.has(`${slot.project}/${slot.env}/${slot.name}`) ? { ok: true, value: slots.get(`${slot.project}/${slot.env}/${slot.name}`) } : { ok: false, reason: 'no such slot' })
  }
}
async function connectorOn({ store, vault, estateId = ESTATE_A, deadlineMs, now }) {
  const opened = []
  let origin = ''
  const connector = new ProductConnector({ store, vault, estateId, origin: () => origin, openExternal: async (u) => { opened.push(u) }, actor: () => ({ kind: 'person', id: 'operator' }), callbackDeadlineMs: deadlineMs, now })
  const surface = await hubWith(connector)
  origin = surface.origin
  const stateOf = async (opts) => { const r = await connector.begin(FABRIC_INBOX, opts); assert.equal(r.ok, true, JSON.stringify(r)); return new URL(opened.at(-1)).searchParams.get('state') }
  return { connector, surface, origin, opened, stateOf }
}
const late = (ms) => new Promise((r) => setTimeout(r, ms))

test('ER-6: a vault slower than the product\'s deadline is answered non-2xx and NOTHING is recorded — Fabric is never "connected" to a key the product revoked', async () => {
  const store = connectionStore()
  const vault = memoryVault({ beforePut: () => late(600) })
  const c = await connectorOn({ store, vault, deadlineMs: 250 })
  try {
    const r = await deliver(c.origin, delivery(await c.stateOf()))
    assert.ok(r.status >= 400, `answered ${r.status}`)
    await late(800) // the slow vault finishes after the answer
    assert.equal(await store.liveConnection('fabric-inbox'), null, 'Fabric recorded a connection after answering the product non-2xx')
    assert.deepEqual(store.events.filter((e) => e.type === 'product.connected@1'), [])
    assert.equal(c.connector.lastOutcome('fabric-inbox').outcome, 'failed')
    assert.equal(c.connector.lastOutcome('fabric-inbox').problem.code, 'deadline')
  } finally { await c.surface.stop() }
})

test('ER-6: a record that lands after the deadline is withdrawn; a Reconnect says the previous connection is gone', async () => {
  const live = { id: 'c-old', product: 'fabric-inbox', removed_at: null }
  const store = connectionStore({ beforeAppend: (type) => (type === 'product.connected@1' ? late(500) : undefined) })
  store.connections.set('c-old', live)
  const vault = memoryVault()
  const c = await connectorOn({ store, vault, deadlineMs: 250 })
  try {
    const r = await deliver(c.origin, delivery(await c.stateOf({ reconnect: true })))
    assert.ok(r.status >= 400, `answered ${r.status}`)
    await late(700)
    assert.deepEqual(store.events.map((e) => e.type), ['product.connected@1', 'product.disconnected@1'])
    assert.equal(await store.liveConnection('fabric-inbox'), null)
    const last = c.connector.lastOutcome('fabric-inbox')
    assert.equal(last.problem.code, 'withdrawn')
    assert.equal(last.problem.previousLost, true)
  } finally { await c.surface.stop() }
})

test('ER-6: the secret is stored first, in a slot of its own, and only then recorded — a failed record leaves the live connection\'s slot untouched', async () => {
  const order = []
  const store = connectionStore({ beforeAppend: (type) => { order.push(type); throw new Error('journal down') } })
  const vault = memoryVault({ beforePut: (slot) => { order.push(`put ${slot.name}`) } })
  vault.slots.set('fabric/local/LIVE', 'live-secret')
  const c = await connectorOn({ store, vault, deadlineMs: 2000 })
  try {
    const r = await deliver(c.origin, delivery(await c.stateOf({ reconnect: true })))
    assert.equal(r.status, 500)
    assert.match(order[0], /^put FABRIC_INBOX_CLIENT_SECRET_0{8}00004000800000000000000A_[0-9A-F]{32}$/)
    assert.equal(order[1], 'product.connected@1')
    assert.equal(vault.slots.get('fabric/local/LIVE'), 'live-secret')
    assert.equal(c.connector.lastOutcome('fabric-inbox').problem.code, 'record-failed')
  } finally { await c.surface.stop() }
})

test('ER-6: a vault that would not keep the secret answers 503 and records nothing', async () => {
  const store = connectionStore()
  const c = await connectorOn({ store, vault: memoryVault({ answer: { ok: false, reason: 'vault locked' } }), deadlineMs: 2000 })
  try {
    const r = await deliver(c.origin, delivery(await c.stateOf()))
    assert.equal(r.status, 503)
    assert.deepEqual(store.events, [])
    assert.deepEqual(c.connector.lastOutcome('fabric-inbox').problem, { code: 'vault', detail: 'vault locked' })
  } finally { await c.surface.stop() }
})

test('DA-6: two estates on one Mac each keep their own secret — connecting in one never overwrites the other\'s', async () => {
  const vault = memoryVault()
  const a = connectionStore()
  const b = connectionStore()
  const ca = await connectorOn({ store: a, vault, estateId: ESTATE_A })
  const cb = await connectorOn({ store: b, vault, estateId: ESTATE_B })
  try {
    assert.equal((await deliver(ca.origin, { ...delivery(await ca.stateOf()), clientSecret: 'secret-of-A' })).status, 200)
    assert.equal((await deliver(cb.origin, { ...delivery(await cb.stateOf()), clientSecret: 'secret-of-B' })).status, 200)
    const refA = (await a.liveConnection('fabric-inbox')).secret_ref
    const refB = (await b.liveConnection('fabric-inbox')).secret_ref
    assert.notEqual(refA.name, refB.name)
    assert.match(refA.name, /^[A-Z][A-Z0-9_]*$/)
    assert.equal((await vault.read(refA)).value, 'secret-of-A')
    assert.equal((await vault.read(refB)).value, 'secret-of-B')
    assert.deepEqual(Object.keys(refA).sort(), ['env', 'name', 'project'])
  } finally { await ca.surface.stop(); await cb.surface.stop() }
})

test('DA-7: the product\'s own Deny and failure are journalled as product.connect.refused@1', async () => {
  const store = connectionStore()
  const c = await connectorOn({ store, vault: memoryVault() })
  try {
    assert.equal((await deliver(c.origin, { state: await c.stateOf(), outcome: 'denied' })).status, 200)
    assert.equal((await deliver(c.origin, { state: await c.stateOf(), outcome: 'failed', error: 'mint_failed' })).status, 200)
    assert.deepEqual(store.events.map((e) => [e.type, e.payload]), [
      ['product.connect.refused@1', { product: 'fabric-inbox', outcome: 'denied', error: null }],
      ['product.connect.refused@1', { product: 'fabric-inbox', outcome: 'failed', error: 'mint_failed' }]
    ])
  } finally { await c.surface.stop() }
})

test('UX-6: "waiting" ends with the connect state — after 10 minutes with no answer the outcome is failed, no-answer', async () => {
  let clock = Date.now()
  const c = await connectorOn({ store: connectionStore(), vault: memoryVault(), now: () => clock })
  try {
    await c.stateOf()
    assert.equal(c.connector.lastOutcome('fabric-inbox').outcome, 'waiting')
    clock += 10 * 60_000 + 1
    const last = c.connector.lastOutcome('fabric-inbox')
    assert.equal(last.outcome, 'failed')
    assert.equal(last.problem.code, 'no-answer')
  } finally { await c.surface.stop() }
})

test('UX-7: a connect that cannot start says why as a code, naming nothing by its id', async () => {
  const store = connectionStore()
  store.connections.set('c-1', { id: 'c-1', product: 'fabric-inbox', removed_at: null })
  const c = await connectorOn({ store, vault: memoryVault() })
  try {
    const r = await c.connector.begin(FABRIC_INBOX)
    assert.equal(r.ok, false)
    assert.equal(r.problem.code, 'already-connected')
    assert.doesNotMatch(r.reason, /fabric-inbox/)
  } finally { await c.surface.stop() }
})

// #endregion product-connect

// ── ER-3 / ER-4 / ER-10 (verification iteration 1 for 0.3.1): reading the key must not park the main
// process's thread pool, must end even when the vault tool exits 0 without handing anything over, and
// must ask the vault ONLY (`--vault-only`), so a value appearing in an env file between the check and
// the read is never used.
test('vault: six slow reads at once leave an unrelated file read fast (no FIFO open on the thread pool)', async () => {
  const { readFile } = await import('node:fs/promises')
  const o = fakeObservatory()
  const vault = createObservatoryVault({ launcher: o.launcher, env: { ...o.env, FAKE_RUN_SLEEP: '1.5' } })
  assert.deepEqual(await createObservatoryVault({ launcher: o.launcher, env: o.env }).put(slot, SECRET), { ok: true })
  const reads = Array.from({ length: 6 }, () => vault.read(slot))
  await new Promise((r) => setTimeout(r, 900)) // every read has started and its engine is sleeping
  const t0 = Date.now()
  await readFile(o.log)
  const took = Date.now() - t0
  const answers = await Promise.all(reads)
  assert.ok(took < 300, `an unrelated fs read took ${took} ms while six key reads waited`)
  for (const a of answers) assert.deepEqual(a, { ok: true, value: SECRET })
})

test('vault: a run that exits 0 without handing the key over is a refusal, not a call that never ends', async () => {
  const o = fakeObservatory()
  assert.deepEqual(await createObservatoryVault({ launcher: o.launcher, env: o.env }).put(slot, SECRET), { ok: true })
  const vault = createObservatoryVault({ launcher: o.launcher, env: { ...o.env, FAKE_RUN_NOWRITE: '1' } })
  const r = await Promise.race([vault.read(slot), new Promise((resolve) => setTimeout(() => resolve('still pending after 5 s'), 5000))])
  assert.notEqual(r, 'still pending after 5 s', 'the read never ended')
  assert.equal(r.ok, false)
  assert.match(r.reason, /handed nothing over/)
})

test('vault: the read asks the vault only — `run` carries --vault-only', async () => {
  const o = fakeObservatory()
  const vault = createObservatoryVault({ launcher: o.launcher, env: o.env })
  await vault.put(slot, SECRET)
  await vault.read(slot)
  const runs = readFileSync(o.log, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((a) => a[0].endsWith('use_secret.py') && a[1] === 'run')
  assert.equal(runs.length, 1)
  assert.ok(runs[0].slice(0, runs[0].indexOf('--')).includes('--vault-only'), `run was called without --vault-only: ${runs[0].slice(1, 7).join(' ')}`)
})

// ── ER-6 (verification iteration 2 for 0.3.1): X-Fabric-Accounts exists from Fabric Inbox 0.9.0 on; an older
// server ignores it, so a narrowed call reached every mailbox with the admin key. The server says what it is
// at initialize (`serverInfo`: fabric-inbox and its package version); a narrowed call to anything older than
// 0.9.0, or to a server that does not say, is refused before the tool call is sent.
test('ER-6: a narrowed call to a Fabric Inbox server older than 0.9.0 is refused before anything runs; a workspace setup is not narrowed and still goes', async () => {
  const old = await fakeInbox({ version: '0.8.2' })
  try {
    const since = { server: 'fabric-inbox', version: '0.9.0' }
    const r = await forwardToProduct({ mcpUrl: old.url, clientId: 'abc.access', clientSecret: SECRET, narrowing: ['cloudflare:news@example.com'], narrowingSince: since, capability: 'list_messages', input: {}, traceparent: TRACE, timeoutMs: 3000 })
    assert.equal(r.ok, false, 'a server that ignores X-Fabric-Accounts was sent a narrowed call')
    assert.equal(r.code, 'product-outdated')
    assert.equal(r.reached, false)
    assert.equal(old.seen.length, 0, 'the tool call reached an outdated server')
    const rc = await fakeInbox({ version: '0.9.0-rc.1' })
    const pre = await forwardToProduct({ mcpUrl: rc.url, clientId: 'abc.access', clientSecret: SECRET, narrowing: ['cloudflare:news@example.com'], narrowingSince: since, capability: 'list_messages', input: {}, traceparent: TRACE, timeoutMs: 3000 })
    assert.equal(pre.code, 'product-outdated', 'a pre-release is read as below its release (fail closed)')
    rc.close()
    const unsaid = await forwardToProduct({ mcpUrl: old.url, clientId: 'abc.access', clientSecret: SECRET, narrowing: ['cloudflare:news@example.com'], capability: 'list_messages', input: {}, traceparent: TRACE, timeoutMs: 3000 })
    assert.equal(unsaid.code, 'product-outdated', 'a narrowed call with no known narrowing version was sent')
    const setup = await forwardToProduct({ mcpUrl: old.url, clientId: 'abc.access', clientSecret: SECRET, narrowing: null, narrowingSince: since, capability: 'create_address', input: { localPart: 'n', domain: 'example.com' }, traceparent: TRACE, timeoutMs: 3000 })
    assert.equal(setup.ok, true)
  } finally { old.close() }
  const h = await hubCall([grant('list_messages', 'cloudflare:news@example.com')])
  const r = await h.call(binding, { agentId: 'fabric-inbox', capability: 'list_messages', input: {} }, undefined)
  assert.equal(r.isError, undefined, 'a 0.9.0 server was refused')
  h.inbox.close()
})
