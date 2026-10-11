// fabric-mcp's state machine (ADR-0134 §1) against a fake hub: Fabric down, the first ask and the operator's Allow,
// a later start that enrolls at once, a revoked credential, a session that ends, a denial. Then ADR-0134 amendment
// 2: a failure under a session is classified (a client-side McpError keeps the session and never says nothing was
// done), one consent across processes (the waiting request on disk), several credentials per runner, a credential
// that could not be saved, the backoff of a folder that is no project, and the files themselves. Pure — no network;
// the file store runs in a temporary folder and the session link over the SDK's in-memory transport.
import path from 'node:path'
import { mkdtempSync, writeFileSync, mkdirSync, statSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import test from 'node:test'

const SRC = path.resolve(import.meta.dirname, '../src/main')
const { FabricMcpProxy, WAITING_TOOL, BACKOFF_MS, classifyFailure } = await import(path.join(SRC, 'fabricMcp.ts'))
const { fileCredentialStore, openSessionLink } = await import(path.join(SRC, 'fabricMcpClient.ts'))

const LIVE = { ok: true, origin: 'http://127.0.0.1:47070', mcpUrl: 'http://127.0.0.1:47070/mcp', doorToken: 'D'.repeat(43), pid: 1 }
const CRED = 'C'.repeat(43)
const CRED2 = 'E'.repeat(43)
const RESOURCE = 'project:0b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d'
const REQ = '11111111-2222-4333-8444-555555555555'
const NEED = { error: { code: 'needs-grant', message: 'ask', data: { projectId: 'p', projectName: 'site', resource: RESOURCE } } }
const SESSION = { session: { bearer: 'B'.repeat(32), sessionId: 's', projectId: 'p', projectName: 'site', how: 'exact' } }

/** An in-memory CredentialStore with the file store's contract. `failSave` makes save throw. */
function memCreds(initial = [], { failSave = null } = {}) {
  const creds = new Map(initial.map((c, i) => [`id${i}`, c]))
  const kept = new Map()
  let n = initial.length
  return {
    creds, kept,
    list: () => [...creds].map(([id, credential]) => ({ id, credential })),
    save: (c) => { if (failSave) throw new Error(failSave); const id = `id${n++}`; creds.set(id, c); return id },
    forget: (id) => { creds.delete(id) },
    pending: (r) => kept.get(r) ?? null,
    keepPending: (r, p) => { kept.set(r, p) },
    forgetPending: (r) => { kept.delete(r) }
  }
}

function harness({ hub = LIVE, store = memCreds(), statuses = ['pending', 'allowed'], enroll = (bearer) => (bearer === LIVE.doorToken ? 'needs-grant' : 'ok'), collected = false } = {}) {
  const calls = [], opened = [], logs = [], slept = []
  let statusIdx = 0, changed = 0
  const label = (b) => (b === LIVE.doorToken ? 'door' : b === CRED ? 'cred' : b === CRED2 ? 'cred2' : b)
  const hubCall = async (url, bearer, tool, args) => {
    calls.push({ bearer: label(bearer), tool, args })
    if (tool === 'fabric.session.enroll') {
      const how = enroll(bearer)
      if (how === 'unauthorized') return { unauthorized: true }
      if (how === 'needs-grant') return { isError: true, value: NEED }
      if (how === 'no-project') return { isError: true, value: { error: { code: 'no-project', message: 'not a project' } } }
      return { isError: false, value: SESSION }
    }
    if (tool === 'fabric.access.request') return { isError: false, value: { requestId: REQ, status: 'pending', ...(bearer === LIVE.doorToken ? { pollSecret: 'S'.repeat(43) } : {}) } }
    if (tool === 'fabric.access.status') {
      const status = statuses[Math.min(statusIdx++, statuses.length - 1)]
      return { isError: false, value: { requestId: REQ, status, ...(status === 'allowed' && bearer === LIVE.doorToken && !collected ? { credential: CRED } : {}) } }
    }
    throw Error('unexpected tool ' + tool)
  }
  const link = { listTools: async () => [{ name: 'fabric_whoami' }, { name: 'fabric_tasks_list' }], callTool: async (n) => ({ content: [{ type: 'text', text: 'real ' + n }] }), close: async () => {} }
  const proxy = new FabricMcpProxy({
    runner: 'claude-code', cwd: '/Users/me/DATA/site',
    locate: () => hub, store,
    hubCall, openSession: async (url, bearer) => { opened.push(bearer); return link },
    sleep: async (ms) => { slept.push(ms) }, log: (l) => logs.push(l), pollMs: 0
  })
  proxy.onToolsChanged = () => { changed++ }
  return { proxy, calls, opened, link, store, logs, slept, get changed() { return changed } }
}
const trail = (h) => h.calls.map((c) => `${c.bearer}:${c.tool}`)

test('Fabric not running (or its hub closed): one tool, an error that says both, nothing asked', async () => {
  const h = harness({ hub: { ok: false, code: 'not-running', reason: 'no hub.json' } })
  assert.equal((await h.proxy.connectOnce()).kind, 'not-running')
  const tools = await h.proxy.tools()
  assert.deepEqual(tools.map((t) => t.name), [WAITING_TOOL])
  const a = await h.proxy.call(WAITING_TOOL, {})
  assert.equal(a.isError, true)
  assert.equal(a.content[0].text, 'Fabric is not running, or its hub is closed (Settings → Agent access says why). Open Fabric, then call this tool again.')
  assert.equal(h.calls.length, 0)
})

test('first start: the door names the project, the operator is asked once with the folder, Allow stores the credential, the session opens', async () => {
  const h = harness()
  const s = await h.proxy.connectOnce()
  assert.equal(s.kind, 'connected')
  assert.deepEqual(h.store.list().map((c) => c.credential), [CRED])
  assert.deepEqual(trail(h), [
    'door:fabric.session.enroll', 'door:fabric.access.request', 'door:fabric.access.status', 'door:fabric.access.status', 'cred:fabric.session.enroll'
  ])
  const req = h.calls.find((c) => c.tool === 'fabric.access.request').args
  assert.deepEqual([req.agentId, req.callee, req.capabilities, req.resources, req.folder], ['claude-code', 'fabric', ['session.enroll'], [RESOURCE], '/Users/me/DATA/site'])
  assert.deepEqual(h.opened, [SESSION.session.bearer])
  assert.equal(h.changed, 1, 'the agent is told its tools changed')
  assert.equal(h.store.kept.size, 0, 'a decided request is not kept')
  assert.deepEqual((await h.proxy.tools()).map((t) => t.name), ['fabric_whoami', 'fabric_tasks_list'])
  assert.equal((await h.proxy.call('fabric_tasks_list', {})).content[0].text, 'real fabric_tasks_list')
})

test('a later start with the credential enrolls at once — no prompt', async () => {
  const h = harness({ store: memCreds([CRED]) })
  assert.equal((await h.proxy.connectOnce()).kind, 'connected')
  assert.deepEqual(trail(h), ['cred:fabric.session.enroll'])
})

test('a revoked credential is forgotten and the proxy goes on to the door, asking again', async () => {
  const h = harness({ store: memCreds([CRED]), enroll: (b) => (b === CRED ? 'unauthorized' : 'needs-grant'), statuses: ['pending'] })
  h.proxy.deps.pollMs = 0
  // The status stays pending: stop the poll after a few reads.
  let reads = 0
  const call = h.proxy.deps.hubCall
  h.proxy.deps.hubCall = async (...a) => { if (a[2] === 'fabric.access.status' && ++reads > 2) return { isError: true, value: { error: { code: 'hub-unavailable' } } }; return call(...a) }
  await h.proxy.connectOnce()
  assert.equal(h.store.creds.size, 0)
  assert.deepEqual(trail(h).slice(0, 3), ['cred:fabric.session.enroll', 'door:fabric.session.enroll', 'door:fabric.access.request'])
})

test('a credential without this project asks for it with the binding, no new credential stored', async () => {
  let first = true
  const h = harness({ store: memCreds([CRED]), enroll: (b) => (b === CRED && first ? ((first = false), 'needs-grant') : 'ok') })
  assert.equal((await h.proxy.connectOnce()).kind, 'connected')
  assert.ok(h.calls.some((c) => c.bearer === 'cred' && c.tool === 'fabric.access.request'))
  assert.deepEqual(h.store.list().map((c) => c.credential), [CRED])
})

test('several credentials: each is tried, the one that enrolls wins, and none is overwritten', async () => {
  const h = harness({ store: memCreds([CRED, CRED2]), enroll: (b) => (b === CRED ? 'needs-grant' : 'ok') })
  assert.equal((await h.proxy.connectOnce()).kind, 'connected')
  assert.deepEqual(trail(h), ['cred:fabric.session.enroll', 'cred2:fabric.session.enroll'])
  assert.deepEqual(h.store.list().map((c) => c.credential), [CRED, CRED2])
})

test('several credentials that all need the grant: one incremental ask, with the first', async () => {
  let asked = false
  const h = harness({ store: memCreds([CRED, CRED2]), enroll: (b) => (asked && b === CRED ? 'ok' : 'needs-grant') })
  const call = h.proxy.deps.hubCall
  h.proxy.deps.hubCall = async (...a) => { if (a[2] === 'fabric.access.request') asked = true; return call(...a) }
  assert.equal((await h.proxy.connectOnce()).kind, 'connected')
  const asks = h.calls.filter((c) => c.tool === 'fabric.access.request')
  assert.deepEqual(asks.map((c) => c.bearer), ['cred'])
  assert.equal(h.calls.some((c) => c.bearer === 'door'), false, 'the door is not asked while a credential can ask for more')
})

test('one consent across processes: a restarted fabric-mcp polls the request already with the operator instead of asking again', async () => {
  const store = memCreds()
  const a = harness({ store, statuses: ['pending'] })
  // The first process asks, then dies while the request waits (its poll is cut after one read).
  const call = a.proxy.deps.hubCall
  let reads = 0
  a.proxy.deps.hubCall = async (...x) => { if (x[2] === 'fabric.access.status' && ++reads > 1) throw new Error('process killed'); return call(...x) }
  assert.equal((await a.proxy.connectOnce()).kind, 'failed')
  assert.equal(a.calls.filter((c) => c.tool === 'fabric.access.request').length, 1)
  assert.deepEqual(store.kept.get(RESOURCE), { requestId: REQ, pollSecret: 'S'.repeat(43), via: 'door' })
  // The second process: same files, no second ask; it polls the kept request with its poll secret and collects.
  const b = harness({ store, statuses: ['pending', 'allowed'] })
  assert.equal((await b.proxy.connectOnce()).kind, 'connected')
  assert.equal(b.calls.filter((c) => c.tool === 'fabric.access.request').length, 0, 'the operator is not asked twice')
  assert.deepEqual(b.calls.find((c) => c.tool === 'fabric.access.status').args, { requestId: REQ, pollSecret: 'S'.repeat(43) })
  assert.equal(store.kept.size, 0, 'the decided request is deleted')
})

test('a kept request that ends denied or expired is deleted, and said', async () => {
  for (const [status, kind] of [['denied', 'denied'], ['expired', 'starting']]) {
    const store = memCreds()
    store.keepPending(RESOURCE, { requestId: REQ, pollSecret: 'S'.repeat(43), via: 'door' })
    const h = harness({ store, statuses: [status] })
    assert.equal((await h.proxy.connectOnce()).kind, kind)
    assert.equal(store.kept.size, 0)
  }
})

test('allowed, but another process of this runner collected the credential: no second prompt; the next pass reads it from disk', async () => {
  const store = memCreds()
  store.keepPending(RESOURCE, { requestId: REQ, pollSecret: 'S'.repeat(43), via: 'door' })
  const h = harness({ store, statuses: ['allowed'], collected: true })
  assert.equal((await h.proxy.connectOnce()).kind, 'failed')
  assert.equal(h.calls.some((c) => c.tool === 'fabric.access.request'), false)
  store.save(CRED) // the other process saved it
  assert.equal((await h.proxy.connectOnce()).kind, 'connected')
})

test('a credential that cannot be saved after its one-time collection: fabric_whoami names the cause and that the Allow must be repeated', async () => {
  const h = harness({ store: memCreds([], { failSave: 'EACCES: permission denied' }) })
  assert.equal((await h.proxy.connectOnce()).kind, 'failed')
  const said = (await h.proxy.call(WAITING_TOOL, {})).content[0].text
  assert.match(said, /EACCES: permission denied/)
  assert.match(said, /allow this agent again/)
  // The next pass asks again; the notice stays until a session opens.
  await h.proxy.connectOnce()
  assert.match((await h.proxy.call(WAITING_TOOL, {})).content[0].text, /could not be saved/)
})

test('the session ending (Fabric quit) drops back to one tool and tells the agent', async () => {
  const h = harness({ store: memCreds([CRED]) })
  await h.proxy.connectOnce()
  h.link.onclose()
  assert.equal(h.proxy.state.kind, 'starting')
  assert.equal(h.changed, 2)
  assert.deepEqual((await h.proxy.tools()).map((t) => t.name), [WAITING_TOOL])
})

test('a denial is said, in Fabric\'s words for the screen, and not asked again in a loop', async () => {
  const h = harness({ statuses: ['denied'] })
  assert.equal((await h.proxy.connectOnce()).kind, 'denied')
  const said = (await h.proxy.call(WAITING_TOOL, {})).content[0].text
  assert.match(said, /denied/)
  assert.match(said, /\(Agent access\)/)
  assert.doesNotMatch(said, /Agents & access/)
  assert.equal(h.store.creds.size, 0)
})

test('a transport failure that was refused before the call ran (HTTP 401): the session drops, and nothing was done', async () => {
  const h = harness({ store: memCreds([CRED]) })
  await h.proxy.connectOnce()
  h.link.callTool = async () => { throw Object.assign(new Error('Streamable HTTP error: 401'), { code: 401 }) }
  const a = await h.proxy.call('fabric_tasks_list', {})
  assert.equal(a.isError, true)
  assert.match(a.content[0].text, /reconnecting/)
  assert.match(a.content[0].text, /Nothing of this call was done/)
  assert.equal(h.proxy.state.kind, 'starting')
  assert.equal(h.changed, 2)
  assert.equal((await h.proxy.connectOnce()).kind, 'connected')
  assert.equal(h.opened.length, 2)
})

test('a connection that broke during the call: the session drops, and the outcome is unknown — never "nothing was done"', async () => {
  const h = harness({ store: memCreds([CRED]) })
  await h.proxy.connectOnce()
  h.link.callTool = async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }) }
  const a = await h.proxy.call('fabric_tasks_list', {})
  assert.match(a.content[0].text, /outcome is unknown/)
  assert.doesNotMatch(a.content[0].text, /[Nn]othing of this call was done/)
  assert.equal(h.proxy.state.kind, 'starting')
})

test('a client-side McpError (the SDK\'s request timeout, an output-schema mismatch) keeps the session and says the outcome is unknown', async () => {
  for (const e of [
    Object.assign(new Error('MCP error -32001: Request timed out'), { name: 'McpError', code: -32001 }),
    Object.assign(new Error('MCP error -32602: Structured content does not match the tool\'s output schema'), { name: 'McpError', code: -32602 })
  ]) {
    const h = harness({ store: memCreds([CRED]) })
    await h.proxy.connectOnce()
    const real = h.link.callTool
    h.link.callTool = async () => { throw e }
    const a = await h.proxy.call('fabric_tasks_list', {})
    assert.equal(a.isError, true)
    assert.match(a.content[0].text, /outcome is unknown — check its effect before you act again/)
    assert.doesNotMatch(a.content[0].text, /[Nn]othing of this call was done/)
    assert.equal(h.proxy.state.kind, 'connected', 'the session is kept')
    assert.equal(h.changed, 1, 'the tools did not change')
    h.link.callTool = real
    assert.equal((await h.proxy.call('fabric_tasks_list', {})).content[0].text, 'real fabric_tasks_list', 'and still serves')
  }
})

test('an McpError on the tool list keeps the session and is thrown, not answered with the one waiting tool', async () => {
  const h = harness({ store: memCreds([CRED]) })
  await h.proxy.connectOnce()
  h.link.listTools = async () => { throw Object.assign(new Error('MCP error -32001: Request timed out'), { name: 'McpError', code: -32001 }) }
  await assert.rejects(() => h.proxy.tools(), /timed out/)
  assert.equal(h.proxy.state.kind, 'connected')
})

test('classifyFailure: what drops the session and what may have run', () => {
  assert.deepEqual(classifyFailure(Object.assign(new Error('x'), { name: 'McpError', code: -32001 })), { drop: false, mayHaveRun: true })
  assert.deepEqual(classifyFailure(Object.assign(new Error('x'), { name: 'McpError', code: -32000 })), { drop: true, mayHaveRun: true })
  assert.deepEqual(classifyFailure(Object.assign(new Error('x'), { code: 404 })), { drop: true, mayHaveRun: false })
  assert.deepEqual(classifyFailure(Object.assign(new Error('x'), { code: 500 })), { drop: true, mayHaveRun: true })
  assert.deepEqual(classifyFailure(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })), { drop: true, mayHaveRun: false })
})

test('a folder that is no project backs off — half a minute — until the agent calls fabric_whoami', async () => {
  const h = harness({ enroll: () => 'no-project' })
  const stop = { stopped: false }
  let release = null
  h.proxy.deps.sleep = (ms) => { h.slept.push(ms); return new Promise((r) => { release = r }) }
  const running = h.proxy.run(stop)
  await new Promise((r) => setImmediate(r))
  assert.equal(h.proxy.state.kind, 'no-project')
  assert.deepEqual(h.slept, [BACKOFF_MS['no-project']])
  assert.equal(BACKOFF_MS['no-project'] >= 30_000, true)
  const before = h.calls.length
  // The agent asks: the wait ends now, and the next pass runs.
  await h.proxy.call(WAITING_TOOL, {})
  await new Promise((r) => setImmediate(r))
  assert.equal(h.calls.length, before + 1, 'one more enroll, right after fabric_whoami')
  stop.stopped = true
  h.proxy.call(WAITING_TOOL, {})
  release?.()
  await running
})

// --- the files ---------------------------------------------------------------------------------------------------

test('the file store: one 0600 file per credential in a 0700 folder, never overwriting another; forget removes one', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-mcp-store-'))
  const s = fileCredentialStore(root, 'claude-code')
  const a = s.save(CRED), b = s.save(CRED2)
  assert.notEqual(a, b)
  assert.deepEqual(s.list().map((c) => c.credential).sort(), [CRED, CRED2])
  assert.deepEqual(readdirSync(s.dir).sort(), [`${a}.credential`, `${b}.credential`].sort())
  if (process.platform !== 'win32') {
    assert.equal(statSync(path.join(s.dir, `${a}.credential`)).mode & 0o777, 0o600)
    assert.equal(statSync(s.dir).mode & 0o777, 0o700)
  }
  s.forget(a)
  assert.deepEqual(s.list().map((c) => c.credential), [CRED2])
})

test('the file store: the wave-1 single credential file is moved into the folder', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-mcp-store-'))
  mkdirSync(path.join(root, 'enrollments'), { recursive: true })
  writeFileSync(path.join(root, 'enrollments', 'claude-code.credential'), CRED + '\n', { mode: 0o600 })
  const s = fileCredentialStore(root, 'claude-code')
  assert.deepEqual(s.list().map((c) => c.credential), [CRED])
  assert.equal(existsSync(path.join(root, 'enrollments', 'claude-code.credential')), false)
  assert.deepEqual(s.list().map((c) => c.credential), [CRED], 'and read from there afterwards')
})

test('the file store: a waiting request is kept 0600 by resource and deleted when decided; the file goes with the last', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-mcp-store-'))
  const s = fileCredentialStore(root, 'codex')
  const p = { requestId: REQ, pollSecret: 'S'.repeat(43), via: 'door' }
  s.keepPending(RESOURCE, p)
  s.keepPending('project:other', { requestId: REQ, via: 'abcd1234' })
  assert.deepEqual(fileCredentialStore(root, 'codex').pending(RESOURCE), p, 'another process reads it')
  if (process.platform !== 'win32') assert.equal(statSync(s.pendingFile).mode & 0o777, 0o600)
  s.forgetPending(RESOURCE)
  assert.equal(s.pending(RESOURCE), null)
  assert.equal(s.pending('project:other').via, 'abcd1234')
  s.forgetPending('project:other')
  assert.equal(existsSync(s.pendingFile), false)
})

// --- the session link ----------------------------------------------------------------------------------------------

test('the session link keeps the SDK\'s own close handling: a request waiting when the transport closes fails, and the proxy is told', async () => {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js')
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js')
  const server = new McpServer({ name: 's', version: '1' })
  server.registerTool('hang', { description: 'never answers' }, () => new Promise(() => {}))
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  const link = await openSessionLink('mem://', 'bearer', () => clientSide)
  let told = 0
  link.onclose = () => { told++ }
  const waiting = link.callTool('hang', {})
  await new Promise((r) => setImmediate(r))
  await serverSide.close()
  const outcome = await Promise.race([waiting.then(() => 'answered', (e) => `failed: ${e.message}`), new Promise((r) => setTimeout(() => r('HUNG'), 1000))])
  assert.match(outcome, /^failed: .*[Cc]onnection closed/)
  assert.equal(told, 1)
})
