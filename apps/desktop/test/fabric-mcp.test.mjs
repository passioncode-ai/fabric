// fabric-mcp's state machine (ADR-0134 §1) against a fake hub: Fabric down, the first ask and the operator's Allow,
// a later start that enrolls at once, a revoked credential, a session that ends, a denial. Pure — no network.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { FabricMcpProxy, WAITING_TOOL } = await import(path.resolve(import.meta.dirname, '../src/main/fabricMcp.ts'))

const LIVE = { ok: true, origin: 'http://127.0.0.1:47070', mcpUrl: 'http://127.0.0.1:47070/mcp', doorToken: 'D'.repeat(43), pid: 1 }
const CRED = 'C'.repeat(43)
const NEED = { error: { code: 'needs-grant', message: 'ask', data: { projectId: 'p', projectName: 'site', resource: 'project:0b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d' } } }
const SESSION = { session: { bearer: 'B'.repeat(32), sessionId: 's', projectId: 'p', projectName: 'site', how: 'exact' } }

function harness({ hub = LIVE, credential = null, statuses = ['pending', 'allowed'], enrollWithCred = 'ok' } = {}) {
  let stored = credential
  const calls = [], opened = [], logs = []
  let statusIdx = 0, changed = 0
  const hubCall = async (url, bearer, tool, args) => {
    calls.push({ bearer: bearer === LIVE.doorToken ? 'door' : bearer === CRED ? 'cred' : bearer, tool, args })
    if (tool === 'fabric.session.enroll') {
      if (bearer === LIVE.doorToken) return { isError: true, value: NEED }
      if (enrollWithCred === 'unauthorized') return { unauthorized: true }
      if (enrollWithCred === 'needs-grant') { enrollWithCred = 'ok'; return { isError: true, value: NEED } }
      return { isError: false, value: SESSION }
    }
    if (tool === 'fabric.access.request') return { isError: false, value: { requestId: 'r-1', status: 'pending', ...(bearer === LIVE.doorToken ? { pollSecret: 'S'.repeat(43) } : {}) } }
    if (tool === 'fabric.access.status') {
      const status = statuses[Math.min(statusIdx++, statuses.length - 1)]
      return { isError: false, value: { requestId: 'r-1', status, ...(status === 'allowed' && bearer === LIVE.doorToken ? { credential: CRED } : {}) } }
    }
    throw Error('unexpected tool ' + tool)
  }
  const link = { listTools: async () => [{ name: 'fabric_whoami' }, { name: 'fabric_tasks_list' }], callTool: async (n) => ({ content: [{ type: 'text', text: 'real ' + n }] }), close: async () => {} }
  const proxy = new FabricMcpProxy({
    runner: 'claude-code', cwd: '/Users/me/DATA/site',
    locate: () => hub,
    readCredential: () => stored, writeCredential: (c) => { stored = c }, forgetCredential: () => { stored = null },
    hubCall, openSession: async (url, bearer) => { opened.push(bearer); return link },
    sleep: async () => {}, log: (l) => logs.push(l), pollMs: 0
  })
  proxy.onToolsChanged = () => { changed++ }
  return { proxy, calls, opened, link, get stored() { return stored }, get changed() { return changed } }
}

test('Fabric not running: one tool, an error that says so, nothing asked', async () => {
  const h = harness({ hub: { ok: false, code: 'not-running', reason: 'no hub.json' } })
  assert.equal((await h.proxy.connectOnce()).kind, 'not-running')
  const tools = await h.proxy.tools()
  assert.deepEqual(tools.map((t) => t.name), [WAITING_TOOL])
  const a = await h.proxy.call(WAITING_TOOL, {})
  assert.equal(a.isError, true)
  assert.match(a.content[0].text, /not running/)
  assert.equal(h.calls.length, 0)
})

test('first start: the door names the project, the operator is asked once, Allow stores the credential, the session opens', async () => {
  const h = harness()
  const s = await h.proxy.connectOnce()
  assert.equal(s.kind, 'connected')
  assert.equal(h.stored, CRED)
  assert.deepEqual(h.calls.map((c) => `${c.bearer}:${c.tool}`), [
    'door:fabric.session.enroll', 'door:fabric.access.request', 'door:fabric.access.status', 'door:fabric.access.status', 'cred:fabric.session.enroll'
  ])
  const req = h.calls.find((c) => c.tool === 'fabric.access.request').args
  assert.deepEqual([req.agentId, req.callee, req.capabilities, req.resources], ['claude-code', 'fabric', ['session.enroll'], [NEED.error.data.resource]])
  assert.deepEqual(h.opened, [SESSION.session.bearer])
  assert.equal(h.changed, 1, 'the agent is told its tools changed')
  assert.deepEqual((await h.proxy.tools()).map((t) => t.name), ['fabric_whoami', 'fabric_tasks_list'])
  assert.equal((await h.proxy.call('fabric_tasks_list', {})).content[0].text, 'real fabric_tasks_list')
})

test('a later start with the credential enrolls at once — no prompt', async () => {
  const h = harness({ credential: CRED })
  assert.equal((await h.proxy.connectOnce()).kind, 'connected')
  assert.deepEqual(h.calls.map((c) => `${c.bearer}:${c.tool}`), ['cred:fabric.session.enroll'])
})

test('a revoked credential is forgotten and the proxy goes back to asking', async () => {
  const h = harness({ credential: CRED, enrollWithCred: 'unauthorized' })
  assert.equal((await h.proxy.connectOnce()).kind, 'starting')
  assert.equal(h.stored, null)
})

test('a credential without this project asks for it with the binding, no new credential stored', async () => {
  const h = harness({ credential: CRED, enrollWithCred: 'needs-grant' })
  assert.equal((await h.proxy.connectOnce()).kind, 'connected')
  assert.ok(h.calls.some((c) => c.bearer === 'cred' && c.tool === 'fabric.access.request'))
  assert.equal(h.stored, CRED)
})

test('the session ending (Fabric quit) drops back to one tool and tells the agent', async () => {
  const h = harness({ credential: CRED })
  await h.proxy.connectOnce()
  h.link.onclose()
  assert.equal(h.proxy.state.kind, 'starting')
  assert.equal(h.changed, 2)
  assert.deepEqual((await h.proxy.tools()).map((t) => t.name), [WAITING_TOOL])
})

test('a denial is said and not asked again in a loop', async () => {
  const h = harness({ statuses: ['denied'] })
  assert.equal((await h.proxy.connectOnce()).kind, 'denied')
  assert.match((await h.proxy.call(WAITING_TOOL, {})).content[0].text, /denied/)
  assert.equal(h.stored, null)
})

test('a call that fails under the session (Fabric restarted) drops it, says so, and the next pass enrolls again', async () => {
  const h = harness({ credential: CRED })
  await h.proxy.connectOnce()
  h.link.callTool = async () => { throw Object.assign(new Error('Streamable HTTP error: 401'), { code: 401 }) }
  const a = await h.proxy.call('fabric_tasks_list', {})
  assert.equal(a.isError, true)
  assert.match(a.content[0].text, /reconnecting/)
  assert.equal(h.proxy.state.kind, 'starting')
  assert.equal(h.changed, 2)
  assert.equal((await h.proxy.connectOnce()).kind, 'connected')
  assert.equal(h.opened.length, 2)
})
