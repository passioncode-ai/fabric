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
const { FabricMcpProxy, WAITING_TOOL, BACKOFF_MS, classifyFailure, runtimeSessionIdOf } = await import(path.join(SRC, 'fabricMcp.ts'))
const clientModule = async () => await import(path.join(SRC, 'fabricMcpClient.ts'))

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

function harness({ hub = LIVE, store = memCreds(), statuses = ['pending', 'allowed'], enroll = (bearer) => (bearer === LIVE.doorToken ? 'needs-grant' : 'ok'), collected = false, requestStatus = 'pending', extra = {} } = {}) {
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
      if (how === 'too-broad') return { isError: true, value: { error: { code: 'no-project', message: 'This folder is too broad for a Project: the home folder.' } } }
      return { isError: false, value: SESSION }
    }
    if (tool === 'fabric.access.request') return { isError: false, value: { requestId: REQ, status: requestStatus, ...(bearer === LIVE.doorToken ? { pollSecret: 'S'.repeat(43) } : {}) } }
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
    sleep: async (ms) => { slept.push(ms) }, log: (l) => logs.push(l), pollMs: 0, random: () => 0, ...extra
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
  // The agent is pointed at the lifecycle broker, never told to open the app itself: an "Open Fabric" read as
  // `open -a` is exactly what the machine's rules forbid (design §0 finding 10; agents-first.md "The project board").
  const said = a.content[0].text
  assert.match(said, /^Fabric is not running, or its hub is closed \(Settings → Agent access says why\)\./)
  assert.match(said, /lifecycle\.list, lifecycle\.ensure_running, then lifecycle\.operation\.get/)
  assert.match(said, /never start, quit or kill it yourself \(no open -a, osascript or pkill\)/)
  assert.match(said, /held_off or in_use_by_person/)
  assert.doesNotMatch(said, /Open Fabric/)
  assert.equal(h.calls.length, 0)
})

test('a hub that cannot be verified is sent nothing, and the agent is pointed at the broker, not at opening Fabric', async () => {
  const h = harness({ hub: { ok: false, code: 'not-a-hub', reason: 'hub.json names process 4242, which is not Fabric' } })
  assert.equal((await h.proxy.connectOnce()).kind, 'not-a-hub')
  const said = (await h.proxy.call(WAITING_TOOL, {})).content[0].text
  assert.match(said, /^Fabric's hub could not be verified \(hub\.json names process 4242, which is not Fabric\)\. Nothing is sent to it/)
  assert.match(said, /lifecycle\.ensure_running/)
  assert.doesNotMatch(said, /Open Fabric/)
  assert.equal(h.calls.length, 0)
})

test('while the operator is asked, the agent is not told the prompt is on their screen: Fabric may be in the background', async () => {
  const h = harness()
  // The state the run loop sets while a request waits (set directly: the loop itself polls until it is decided).
  h.proxy.state = { kind: 'waiting', projectName: 'site' }
  const text = (await h.proxy.call(WAITING_TOOL, {})).content[0].text
  assert.match(text, /^Waiting for the operator to allow this coding agent in Fabric to work in the project site/)
  assert.match(text, /a notification when Fabric is in the background/)
  assert.doesNotMatch(text, /on their screen/)
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

test('an immediate local allow is collected without a wait or an operator prompt', async () => {
  const h = harness({ requestStatus: 'allowed', statuses: ['allowed'] })
  const s = await h.proxy.connectOnce()
  assert.equal(s.kind, 'connected')
  assert.deepEqual(h.slept, [], 'an already-allowed request polls at once, not after the consent interval')
  assert.deepEqual(h.store.list().map((c) => c.credential), [CRED])
  assert.deepEqual(trail(h), ['door:fabric.session.enroll', 'door:fabric.access.request', 'door:fabric.access.status', 'cred:fabric.session.enroll'])
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

// 0.3.5 review ER-7: the hub contract is "re-read hub.json and check its pid before sending a binding credential".
// A poll that went on sending the credential to the origin located once would hand it to whatever took the port.
test('a binding credential is never sent to a hub that is no longer the one located: every poll re-reads hub.json first', async () => {
  for (const after of [{ ...LIVE, pid: 2 }, { ok: false, code: 'not-running', reason: 'the pid in hub.json is not alive' }]) {
    let restarted = false
    const h = harness({ store: memCreds([CRED]), enroll: (b) => (b === CRED ? 'needs-grant' : 'ok'), statuses: ['pending', 'pending', 'denied'], extra: { locate: () => (restarted ? after : LIVE) } })
    const call = h.proxy.deps.hubCall
    h.proxy.deps.hubCall = async (...a) => { const r = await call(...a); if (a[2] === 'fabric.access.status') restarted = true; return r }
    const s = await h.proxy.connectOnce()
    assert.equal(s.kind, 'not-running')
    assert.equal(h.calls.filter((c) => c.tool === 'fabric.access.status').length, 1, 'no poll after the hub changed')
    assert.equal(h.store.list().length, 1, 'the credential is kept: it was not refused, the hub went away')
  }
})

test('the same check runs before each held credential is tried', async () => {
  let restarted = false
  const h = harness({ store: memCreds([CRED, CRED2]), enroll: (b) => (b === CRED ? 'needs-grant' : 'ok'), extra: { locate: () => (restarted ? { ...LIVE, origin: 'http://127.0.0.1:47071', mcpUrl: 'http://127.0.0.1:47071/mcp' } : LIVE) } })
  const call = h.proxy.deps.hubCall
  h.proxy.deps.hubCall = async (...a) => { const r = await call(...a); restarted = true; return r }
  assert.equal((await h.proxy.connectOnce()).kind, 'not-running')
  assert.deepEqual(trail(h), ['cred:fabric.session.enroll'], 'the second credential is not sent to the moved hub')
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

test('Fabric\'s own refusals (429 call budget, 413, 408, 400) are passed on as Fabric\'s: the session stays, nothing was done, no new enrollment (0.3.5 review i2 ER-3)', async () => {
  const { createRequire } = await import('node:module')
  const sdk = createRequire(import.meta.url).resolve('@modelcontextprotocol/sdk/client/streamableHttp.js')
  const { StreamableHTTPError } = await import(sdk)
  const cases = [
    [429, 'call budget exhausted: 120 calls per 60s. Retry in 30s.'],
    [429, 'too many concurrent requests'],
    [413, 'request body too large'],
    [408, 'request body deadline exceeded'],
    [400, 'JSON-RPC batches are not accepted']
  ]
  for (const [status, reason] of cases) {
    // The SDK's own error, as the HTTP client throws it for a non-2xx answer: the status as code, the body in the message.
    const e = new StreamableHTTPError(status, `Error POSTing to endpoint: ${JSON.stringify({ error: reason })}`)
    assert.deepEqual(classifyFailure(e), { drop: false, mayHaveRun: false, refusal: { status, reason } }, `${status}`)
    let now = 1000
    const h = harness({ store: memCreds([CRED]), extra: { now: () => now } })
    await h.proxy.connectOnce()
    const real = h.link.callTool
    h.link.callTool = async () => { throw e }
    const a = await h.proxy.call('fabric_work_list', {})
    assert.equal(a.isError, true)
    assert.match(a.content[0].text, new RegExp(`Fabric refused fabric_work_list \\(HTTP ${status}: ${reason.replace(/[.()]/g, '\\$&')}\\)`))
    assert.match(a.content[0].text, /Nothing of this call was done/)
    assert.match(a.content[0].text, /The session stays open/)
    assert.doesNotMatch(a.content[0].text, /outcome is unknown|connection to Fabric broke|reconnecting/)
    assert.equal(h.proxy.state.kind, 'connected', 'the session is kept')
    assert.equal(h.changed, 1, 'the tools did not change')
    assert.equal((await h.proxy.connectOnce()).kind, 'connected')
    assert.equal(h.calls.filter((c) => c.tool === 'fabric.session.enroll').length, 1, 'no second enrollment: a fresh budget is never minted')
    assert.equal(h.opened.length, 1)
    h.link.callTool = real
    if (status === 429) {
      assert.match((await h.proxy.call('fabric_work_list', {})).content[0].text, /No new request was sent/)
      now += 60_000 // A bare SDK error has no header: the conservative fallback expires.
    }
    assert.equal((await h.proxy.call('fabric_work_list', {})).content[0].text, 'real fabric_work_list', 'and still serves after any cooldown')
    // The tool list under a refusal: thrown, the session kept.
    h.link.listTools = async () => { throw e }
    await assert.rejects(() => h.proxy.tools(), (thrown) => thrown === e)
    assert.equal(h.proxy.state.kind, 'connected')
  }
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

test('the file store: one 0600 file per credential in a 0700 folder, never overwriting another; forget removes one', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-mcp-store-'))
  const s = (await clientModule()).fileCredentialStore(root, 'claude-code')
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

test('the file store: the wave-1 single credential file is moved into the folder', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-mcp-store-'))
  mkdirSync(path.join(root, 'enrollments'), { recursive: true })
  writeFileSync(path.join(root, 'enrollments', 'claude-code.credential'), CRED + '\n', { mode: 0o600 })
  const s = (await clientModule()).fileCredentialStore(root, 'claude-code')
  assert.deepEqual(s.list().map((c) => c.credential), [CRED])
  assert.equal(existsSync(path.join(root, 'enrollments', 'claude-code.credential')), false)
  assert.deepEqual(s.list().map((c) => c.credential), [CRED], 'and read from there afterwards')
})

test('the file store: a waiting request is kept 0600 by resource and deleted when decided; the file goes with the last', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-mcp-store-'))
  const s = (await clientModule()).fileCredentialStore(root, 'codex')
  const p = { requestId: REQ, pollSecret: 'S'.repeat(43), via: 'door' }
  s.keepPending(RESOURCE, p)
  s.keepPending('project:other', { requestId: REQ, via: 'abcd1234' })
  assert.deepEqual((await clientModule()).fileCredentialStore(root, 'codex').pending(RESOURCE), p, 'another process reads it')
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
  const link = await (await clientModule()).openSessionLink('mem://', 'bearer', () => clientSide)
  let told = 0
  link.onclose = () => { told++ }
  const waiting = link.callTool('hang', {})
  await new Promise((r) => setImmediate(r))
  await serverSide.close()
  const outcome = await Promise.race([waiting.then(() => 'answered', (e) => `failed: ${e.message}`), new Promise((r) => setTimeout(() => r('HUNG'), 1000))])
  assert.match(outcome, /^failed: .*[Cc]onnection closed/)
  assert.equal(told, 1)
})

test('fabric-mcp leaving says so: the session link ends its HTTP session (DELETE) before it closes, and the proxy leaves that way (0.3.5 review i2 ER-4)', async () => {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js')
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js')
  const server = new McpServer({ name: 's', version: '1' })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  const order = []
  // The HTTP transport's terminateSession is the DELETE; the in-memory pair stands in for it.
  clientSide.terminateSession = async () => { order.push('terminate') }
  const realClose = clientSide.close.bind(clientSide)
  clientSide.close = async () => { order.push('close'); await realClose() }
  const link = await (await clientModule()).openSessionLink('mem://', 'bearer', () => clientSide)
  await link.leave()
  assert.equal(order[0], 'terminate', 'Fabric is told first')
  assert.ok(order.slice(1).length > 0 && order.slice(1).every((x) => x === 'close'), 'then the transport closes')
  // A Fabric that is gone cannot be told: the leave still closes, and never hangs the exit.
  const [c2, s2] = InMemoryTransport.createLinkedPair()
  await new McpServer({ name: 's', version: '1' }).connect(s2)
  c2.terminateSession = () => new Promise(() => {})
  const link2 = await (await clientModule()).openSessionLink('mem://', 'bearer', () => c2, { leaveMs: 20 })
  const outcome = await Promise.race([link2.leave().then(() => 'left'), new Promise((r) => setTimeout(() => r('HUNG'), 1000))])
  assert.equal(outcome, 'left')
  // The proxy, on stdin's end, leaves through the link.
  const h = harness({ store: memCreds([CRED]) })
  await h.proxy.connectOnce()
  const seen = []
  h.link.leave = async () => { seen.push('leave') }
  h.link.close = async () => { seen.push('close') }
  await h.proxy.close()
  assert.deepEqual(seen, ['leave'])
})

// D1/D2 (fabric-agent-adapter#53): the runtime session id travels with every enrollment; a rejoin asks nothing.
test('the runtime session id is sent with every enrollment, credential and door alike', async () => {
  const h = harness({ extra: { runtimeSessionId: 'rt-42' } })
  await h.proxy.connectOnce()
  const enrolls = h.calls.filter((c) => c.tool === 'fabric.session.enroll')
  assert.ok(enrolls.length >= 2)
  for (const c of enrolls) assert.deepEqual(c.args, { cwd: '/Users/me/DATA/site', runtimeSessionId: 'rt-42' })
})

test('a runtime session id that is not one is not sent', async () => {
  const h = harness({ store: memCreds([CRED]), extra: { runtimeSessionId: 'bad id with spaces' } })
  await h.proxy.connectOnce()
  assert.deepEqual(h.calls[0].args, { cwd: '/Users/me/DATA/site' })
})

test('--rejoin-only joins through a held credential, never the door, never a request, and forgets nothing', async () => {
  const store = memCreds([CRED])
  const h = harness({ store, extra: { runtimeSessionId: 'rt-42', rejoinOnly: true } })
  assert.equal((await h.proxy.connectOnce()).kind, 'connected')
  assert.deepEqual(trail(h), ['cred:fabric.session.enroll'])
  assert.deepEqual(h.calls[0].args, { cwd: '/Users/me/DATA/site', runtimeSessionId: 'rt-42', rejoinOnly: true })
})

test('--rejoin-only with no live session, or no credential: not enrolled, quietly — no door, no ask', async () => {
  const none = harness({ store: memCreds([CRED]), enroll: () => 'no-project', extra: { runtimeSessionId: 'rt-42', rejoinOnly: true } })
  const s1 = await none.proxy.connectOnce()
  assert.equal(s1.kind, 'not-enrolled')
  assert.deepEqual(trail(none), ['cred:fabric.session.enroll'])
  const empty = harness({ extra: { runtimeSessionId: 'rt-42', rejoinOnly: true } })
  assert.equal((await empty.proxy.connectOnce()).kind, 'not-enrolled')
  assert.deepEqual(trail(empty), [], 'nothing is called without a credential')
  const revoked = harness({ store: memCreds([CRED]), enroll: () => 'unauthorized', extra: { runtimeSessionId: 'rt-42', rejoinOnly: true } })
  await revoked.proxy.connectOnce()
  assert.equal(revoked.store.creds.size, 1, 'a rejoin forgets no credential')
  const answer = await empty.proxy.call(WAITING_TOOL, {})
  assert.match(answer.content[0].text, /asks nothing and starts no session/)
})

// D1 for the other runners (design §0 finding 6), measured 2026-10-13 by reading the environment NAMES of the
// fabric-mcp child each CLI started (ADR-0134, Amendments): Codex 0.162.1 gives its MCP stdio servers a fixed dozen
// variables and no session or thread id; Kimi Code 2.1.1 gives them its whole parent environment and adds none — so a
// Kimi started inside a Claude Code session hands fabric-mcp THAT session's CLAUDE_CODE_SESSION_ID. Only Claude Code's
// own variable names its own session, and only for --runner claude-code.
test('the runtime session id: Claude Code\'s own variable for claude-code only; an inherited one never names a Codex or Kimi session', () => {
  const env = { CLAUDE_CODE_SESSION_ID: '0f3c2a1e-5b7d-4c8e-9a10-2b3c4d5e6f70' }
  assert.equal(runtimeSessionIdOf('claude-code', ['--runner', 'claude-code'], env), '0f3c2a1e-5b7d-4c8e-9a10-2b3c4d5e6f70')
  assert.equal(runtimeSessionIdOf('kimi-code', ['--runner', 'kimi-code'], env), null)
  assert.equal(runtimeSessionIdOf('codex', ['--runner', 'codex'], env), null)
  // The flag names it for any runner (the hooks' rejoin passes it), and wins over the variable.
  assert.equal(runtimeSessionIdOf('codex', ['--runner', 'codex', '--runtime-session-id', 'thr-1'], env), 'thr-1')
  assert.equal(runtimeSessionIdOf('claude-code', ['--runner', 'claude-code', '--runtime-session-id', 'rt-2'], env), 'rt-2')
  assert.equal(runtimeSessionIdOf('claude-code', ['--runner', 'claude-code'], {}), null)
})


// CO-282: the real HTTP boundary must preserve throttling; no native hub or network.
test('HTTP 429 retains Retry-After through the actual hub client', async () => {
  const { makeHubCall } = await import(path.join(SRC, 'fabricMcpClient.ts'))
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return new Response('{"error":"call budget exhausted before body admission"}', {
      status: 429, headers: { 'retry-after': '60', 'content-type': 'application/json' }
    })
  }
  try {
    await assert.rejects(makeHubCall()('http://127.0.0.1:47070/mcp', CRED, 'fabric.session.enroll', {}), e => {
      assert.equal(e.code, 429)
      assert.equal(e.retryAfterMs, 60_000)
      assert.ok(!JSON.stringify(e).includes(CRED))
      return true
    })
    assert.equal(calls, 1)
  } finally { globalThis.fetch = originalFetch }
})

test('HTTP 429 cooldown survives whoami wakes and direct connection retries', async () => {
  let now = 1000, calls = 0
  const h = harness({ extra: { now: () => now, random: () => 0, hubCall: async () => {
    calls++
    throw Object.assign(new Error('rate limited'), { code: 429, retryAfterMs: 60_000 })
  } } })
  assert.equal((await h.proxy.connectOnce()).kind, 'failed')
  await h.proxy.call(WAITING_TOOL, {})
  await h.proxy.connectOnce()
  assert.equal(calls, 1, 'whoami and another pass must not send before Retry-After')
  now += 59_999
  await h.proxy.connectOnce()
  assert.equal(calls, 1)
  now++
  await h.proxy.connectOnce()
  assert.equal(calls, 2, 'a pass may try after the server delay')
})


test('HTTP 429 parses seconds and dates with bounded invalid-header fallback', async () => {
  const { retryAfterMs } = await import(path.join(SRC, 'fabricMcpClient.ts'))
  const now = Date.parse('2026-10-13T00:00:00Z')
  assert.equal(retryAfterMs('60', now), 60_000)
  assert.equal(retryAfterMs('Tue, 13 Oct 2026 00:00:45 GMT', now), 45_000)
  assert.equal(retryAfterMs('0', now), 1000)
  assert.equal(retryAfterMs('300', now), 300_000)
  for (const value of [null, '', '-1', 'NaN', 'Infinity', '99999999999999999999999999', '301',
    'Tue, 13 Oct 2026 00:00:00 GMT garbage', 'Mon, 12 Oct 2026 23:59:00 GMT']) {
    assert.equal(retryAfterMs(value, now), 60_000, String(value))
  }
})

test('HTTP 429 run loop cannot be accelerated by whoami and closes without another attempt', async () => {
  let calls = 0
  const waits = []
  const h = harness({ extra: { now: () => 1000, hubCall: async () => {
    calls++; throw Object.assign(new Error('limited'), { code: 429, retryAfterMs: 60_000 })
  }, sleep: ms => { waits.push(ms); return new Promise(() => {}) } } })
  const running = h.proxy.run({ stopped: false })
  await new Promise(r => setImmediate(r))
  assert.deepEqual(waits, [60_000])
  await h.proxy.call(WAITING_TOOL, {})
  await new Promise(r => setImmediate(r))
  assert.equal(calls, 1)
  await h.proxy.close()
  await running
  await h.proxy.connectOnce()
  assert.equal(calls, 1)
})

test('HTTP 429 cooldown does not follow a changed hub identity or send its old door credential', async () => {
  let current = LIVE
  const seen = []
  const h = harness({ extra: { now: () => 1000, locate: () => current, hubCall: async (url, bearer) => {
    seen.push({ url, bearer })
    if (current === LIVE) throw Object.assign(new Error('limited'), { code: 429, retryAfterMs: 60_000 })
    return { isError: true, value: { error: { code: 'no-project', message: 'not a project' } } }
  } } })
  await h.proxy.connectOnce()
  current = { ...LIVE, pid: 2, origin: 'http://127.0.0.1:47071', mcpUrl: 'http://127.0.0.1:47071/mcp', doorToken: 'N'.repeat(43) }
  assert.equal((await h.proxy.connectOnce()).kind, 'no-project')
  assert.equal(seen.length, 2)
  assert.deepEqual(seen[1], { url: current.mcpUrl, bearer: current.doorToken })
})

test('HTTP 429 pending consent keeps its request and close interrupts polling without approving or denying', async () => {
  const store = memCreds()
  const h = harness({ store, extra: { sleep: () => new Promise(() => {}) } })
  const connecting = h.proxy.connectOnce()
  await new Promise(r => setImmediate(r))
  assert.equal(h.proxy.state.kind, 'waiting')
  assert.ok(store.pending(RESOURCE))
  const before = h.calls.length
  await h.proxy.close()
  await connecting
  assert.equal(h.calls.length, before)
  assert.equal(store.creds.size, 0)
  assert.ok(store.pending(RESOURCE), 'closing a child does not decide or remove operator consent')
})

test('HTTP 429 under a live session keeps enrollment and suppresses calls and tools during cooldown', async () => {
  let now = 1000, calls = 0
  const h = harness({ store: memCreds([CRED]), extra: { now: () => now } })
  await h.proxy.connectOnce()
  const enrolls = h.calls.length
  h.link.callTool = async () => {
    calls++; throw Object.assign(new Error('limited'), { code: 429, retryAfterMs: 60_000 })
  }
  await h.proxy.call('fabric_work_list', {})
  await h.proxy.call('fabric_work_list', {})
  await assert.rejects(h.proxy.tools(), e => e.code === 429 && e.retryAfterMs === 60_000)
  assert.equal(calls, 1)
  assert.equal(h.proxy.state.kind, 'connected')
  assert.equal(h.calls.length, enrolls)
  now += 60_000
  await h.proxy.call('fabric_work_list', {})
  assert.equal(calls, 2)
})


test('HTTP 429 during consent polling resumes the kept request only after expiry', async () => {
  let now = 1000, polls = 0
  const store = memCreds()
  const h = harness({ store, statuses: ['allowed'], extra: { now: () => now } })
  const original = h.proxy.deps.hubCall
  h.proxy.deps.hubCall = async (...args) => {
    if (args[2] === 'fabric.access.status' && ++polls === 1)
      throw Object.assign(new Error('limited poll'), { code: 429, retryAfterMs: 60_000 })
    return original(...args)
  }
  assert.equal((await h.proxy.connectOnce()).kind, 'failed')
  assert.ok(store.pending(RESOURCE))
  const before = h.calls.length
  await h.proxy.call(WAITING_TOOL, {})
  await h.proxy.connectOnce()
  assert.equal(h.calls.length, before)
  now += 60_000
  assert.equal((await h.proxy.connectOnce()).kind, 'connected')
  assert.equal(h.calls.filter(c => c.tool === 'fabric.access.request').length, 1)
  assert.equal(polls, 2)
  assert.equal(store.pending(RESOURCE), null)
})


test('HTTP 429 from SDK background SSE prevents the following tool POST', async () => {
  const { makeHubCall } = await import(path.join(SRC, 'fabricMcpClient.ts'))
  const originalFetch = globalThis.fetch
  const sent = []
  globalThis.fetch = async (_input, init) => {
    if (init.method === 'GET') {
      sent.push('GET')
      return new Response(null, { status: 429, headers: { 'retry-after': '60' } })
    }
    const request = JSON.parse(init.body)
    sent.push(request.method)
    if (request.method === 'notifications/initialized') return new Response(null, { status: 202 })
    const result = request.method === 'initialize'
      ? { protocolVersion: '2025-11-25', capabilities: {}, serverInfo: { name: 'fixture', version: '1' } }
      : { content: [], structuredContent: { ok: true } }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), {
      status: 200, headers: { 'content-type': 'application/json' }
    })
  }
  try {
    await assert.rejects(makeHubCall()('http://127.0.0.1:47070/mcp', CRED, 'fabric.access.status', {}), e => {
      assert.equal(e.code, 429)
      assert.ok(e.retryAfterMs > 59_000 && e.retryAfterMs <= 60_000)
      return true
    })
    assert.deepEqual(sent, ['initialize', 'notifications/initialized', 'GET'])
  } finally { globalThis.fetch = originalFetch }
})

test('HTTP 429 lifecycle: a session that opens after close is left and never attached', async () => {
  let finishOpen, opened = 0, left = 0, calls = 0
  const link = {
    listTools: async () => [], callTool: async () => { calls++; return {} },
    close: async () => {}, leave: async () => { left++ }
  }
  const h = harness({ store: memCreds([CRED]), extra: { openSession: () => {
    opened++
    return new Promise(resolve => { finishOpen = resolve })
  } } })
  const connecting = h.proxy.connectOnce()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(opened, 1)
  await h.proxy.close()
  finishOpen(link)
  await connecting
  await h.proxy.call('fabric_work_list', {})
  assert.equal(left, 1)
  assert.equal(calls, 0)
  assert.notEqual(h.proxy.state.kind, 'connected')
  assert.equal(h.changed, 0)
})


test('HTTP 429 lifecycle: a late allowed poll saves the one-shot credential after close without enrolling', async () => {
  const store = memCreds()
  const h = harness({ store })
  let finishStatus
  const original = h.proxy.deps.hubCall
  h.proxy.deps.hubCall = (...args) => args[2] === 'fabric.access.status'
    ? new Promise(resolve => { finishStatus = resolve }) : original(...args)
  const connecting = h.proxy.connectOnce()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(typeof finishStatus, 'function')
  const before = h.calls.length
  await h.proxy.close()
  finishStatus({ isError: false, value: { status: 'allowed', credential: CRED } })
  await connecting
  assert.deepEqual([...store.creds.values()], [CRED], 'already consumed one-shot response must remain recoverable')
  assert.equal(store.pending(RESOURCE), null)
  assert.equal(h.calls.length, before, 'no new enrollment after close')
  assert.equal(h.opened.length, 0)
  assert.notEqual(h.proxy.state.kind, 'connected')
})

// 2026-10-19 (board thread 1afd08e7): ~40 fabric-mcp clients refused together woke together on the same Retry-After.
test('HTTP 429 cooldown adds a jitter of up to half the server delay, so refused clients do not return as one', async () => {
  let now = 1000, calls = 0
  const h = harness({ extra: { now: () => now, random: () => 0.5, hubCall: async () => {
    calls++
    throw Object.assign(new Error('rate limited'), { code: 429, retryAfterMs: 60_000 })
  } } })
  await h.proxy.connectOnce()
  now += 60_000
  await h.proxy.connectOnce()
  assert.equal(calls, 1, 'a client with jitter waits past the bare server delay')
  now += 15_000
  await h.proxy.connectOnce()
  assert.equal(calls, 2, 'and no longer than the delay plus half of it times its draw')
})

test('a folder refused as too broad waits longer each time, up to 10 minutes; what the person can lift in Fabric does not grow (0.3.8 audit, review UX-6, i3 UX-1)', async () => {
  const { backoffFor, BACKOFF_MS: B, BACKOFF_CEILING_MS, LASTING_NO_PROJECT } = await import(path.join(SRC, 'fabricMcp.ts'))
  const { TOO_BROAD_MESSAGE, DETACHED_PROJECT_MESSAGE, AMBIGUOUS_PROJECT_MESSAGE } = await import(path.join(SRC, 'sessionEnroll.ts'))
  assert.ok(TOO_BROAD_MESSAGE.startsWith(LASTING_NO_PROJECT), 'the hub\'s too-broad words are the ones the backoff reads')
  assert.equal(backoffFor('no-project', 1, TOO_BROAD_MESSAGE), B['no-project'])
  assert.equal(backoffFor('no-project', 2, TOO_BROAD_MESSAGE), B['no-project'] * 2)
  assert.equal(backoffFor('no-project', 3, TOO_BROAD_MESSAGE), B['no-project'] * 4)
  assert.equal(backoffFor('no-project', 40, TOO_BROAD_MESSAGE), BACKOFF_CEILING_MS)
  assert.equal(backoffFor('no-project', 5, DETACHED_PROJECT_MESSAGE), B['no-project'], 'an undone detach is seen within 30 s')
  assert.equal(backoffFor('no-project', 5, AMBIGUOUS_PROJECT_MESSAGE), B['no-project'])
  assert.equal(backoffFor('no-project', 5, 'that folder could not be read as a Git repository on this computer'), B['no-project'], 'a failed Git read passes by itself')
  assert.equal(BACKOFF_CEILING_MS, 10 * 60_000)
  assert.equal(backoffFor('denied', 5), B.denied, 'a denial the person withdraws is seen within its base')
  assert.equal(backoffFor('not-enrolled', 5), B['not-enrolled'], 'a folder the person attaches is seen within its base')
  assert.equal(backoffFor('failed', 2), B.failed * 2, 'a repeated failure grows')
  assert.equal(backoffFor('failed', 40), 60_000, 'to a minute, no further')
  assert.equal(backoffFor('not-running', 50), B['not-running'])
  assert.equal(backoffFor('connected', 50), B.connected)
})

test('the run loop waits longer at each repeated too-broad refusal, and starts over after the agent asks (0.3.8 audit)', async () => {
  const h = harness({ enroll: () => 'too-broad' })
  const stop = { stopped: false }
  h.proxy.deps.sleep = (ms) => { h.slept.push(ms); if (h.slept.length >= 4) stop.stopped = true; return Promise.resolve() }
  await h.proxy.run(stop)
  const base = BACKOFF_MS['no-project']
  assert.deepEqual(h.slept.slice(0, 4), [base, base * 2, base * 4, base * 8])
})

test('HTTP 503 with Retry-After is waited out like a 429; a 503 without one is not (0.3.8 review i2 DA-6)', async () => {
  const { makeHubCall } = await import(path.join(SRC, 'fabricMcpClient.ts'))
  const originalFetch = globalThis.fetch
  let withHeader = true
  globalThis.fetch = async () => new Response(null, { status: 503, headers: withHeader ? { 'retry-after': '5' } : {} })
  try {
    await assert.rejects(makeHubCall()('http://127.0.0.1:47070/mcp', CRED, 'fabric.access.status', {}), (e) => {
      assert.equal(e.code, 429); assert.equal(e.status, 503)
      assert.ok(e.retryAfterMs > 4_000 && e.retryAfterMs <= 5_000)
      return true
    })
    withHeader = false
    await assert.rejects(makeHubCall()('http://127.0.0.1:47070/mcp', CRED, 'fabric.access.status', {}), (e) => {
      assert.notEqual(e.code, 429)
      return true
    })
  } finally { globalThis.fetch = originalFetch }
})

test('a detached folder is asked about again every 30 s, so undoing the detach in Fabric is seen within a minute (0.3.8 review i3 UX-1)', async () => {
  const h = harness({ enroll: () => 'no-project' })
  const stop = { stopped: false }
  h.proxy.deps.sleep = (ms) => { h.slept.push(ms); if (h.slept.length >= 4) stop.stopped = true; return Promise.resolve() }
  await h.proxy.run(stop)
  const base = BACKOFF_MS['no-project']
  assert.deepEqual(h.slept.slice(0, 4), [base, base, base, base])
})

test('a 503 cooldown is told to the agent as the 503 it was, not as a 429 (0.3.8 review i3 ER-3, UX-4)', async () => {
  const { classifyFailure, FabricRateLimitError } = await import(path.join(SRC, 'fabricMcp.ts'))
  const f = classifyFailure(new FabricRateLimitError(5000, 503))
  assert.equal(f.refusal.status, 503)
  assert.equal(classifyFailure(new FabricRateLimitError(5000)).refusal.status, 429)
})
