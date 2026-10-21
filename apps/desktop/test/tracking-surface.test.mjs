// The tracking half of 0.3.9 "the core holds" (docs/evidence/plans/2026-10-21-core-reliability/2026-10-21-tracking.md), through
// the real AgentSurface and real MCP clients over Streamable HTTP, with no database: every read answers "nothing
// recorded yet". What it shows:
//   TR-6  fabric_agents_list lists an agent that enrolled from its own terminal, with how it came in — not only the
//         terminals Fabric runs (it answered `sessions: []` on a machine where every agent runs outside Fabric);
//   TR-1  a rejoin minted under a new runtime id (the rename the enrollment matched by the agent's process) is what
//         the session carries from then on;
//   TR-2  an end from the hooks' rejoin while the agent's own fabric-mcp signs does not end the session, and an end
//         observed before the session enrolled does not either.
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const { AgentSurface } = await import(path.resolve(import.meta.dirname, '../src/main/agentSurface.ts'))

/** A database whose every read answers "nothing recorded yet". */
const emptyDb = {
  from() {
    const chain = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (resolve) => resolve({ data: [], error: null })
        if (prop === 'maybeSingle' || prop === 'single') return async () => ({ data: null, error: null })
        return () => chain
      }
    })
    return chain
  },
  rpc: async () => ({ data: null, error: null })
}

async function surfaceWith(ptyList = []) {
  const ended = []
  const surface = new AgentSurface({
    db: emptyDb, journal: null, estateId: 'e',
    ptys: () => ({ list: () => ptyList, get: (id) => ptyList.find((p) => p.sessionId === id) ?? null }),
    work: { resolveSource: async () => ({ ok: false, part: 'repository', reason: 'none' }), leaseRefs: async () => null, endSession: (id) => ended.push(id) }
  })
  await surface.start()
  return { surface, ended }
}
async function connect(surface, token) {
  const client = new Client({ name: 'probe', version: '0.0.0' })
  await client.connect(new StreamableHTTPClientTransport(new URL(surface.endpoint), { requestInit: { headers: { Authorization: 'Bearer ' + token } } }))
  return client
}
const call = async (client, name, args = {}) => JSON.parse((await client.callTool({ name, arguments: args })).content[0].text)
const END = (over = {}) => ({ event: 'end', runtime: 'claude-code', runtimeSessionId: 'rt-1', observedAt: new Date().toISOString().slice(0, 19) + 'Z', reason: 'prompt_input_exit', idempotencyKey: 'rt-1:0001780000001', ...over })

test('TR-6: an agent enrolled from its own terminal is listed by fabric_agents_list, with how it came in', async (t) => {
  const { surface } = await surfaceWith([])
  t.after(() => surface.stop())
  const scope = surface.mint('p', 's-enrolled', null, { cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-1' })
  const client = await connect(surface, scope.token)
  t.after(() => client.close())
  const listed = await call(client, 'fabric_agents_list')
  assert.deepEqual(listed.sessions.map((s) => [s.session_id, s.came_in, s.is_you, s.observed.agent, s.observed.state]), [['s-enrolled', 'enrolled', true, 'claude-code', 'active']])
})

test('TR-6: a terminal Fabric runs is listed as before, with its terminal\'s state', async (t) => {
  const pty = { sessionId: 's-pty', projectId: 'p', optionId: 'claude-code', state: 'running', running: true, startedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), exitCode: null }
  const { surface } = await surfaceWith([pty])
  t.after(() => surface.stop())
  const scope = surface.mint('p', 's-pty', null)
  const client = await connect(surface, scope.token)
  t.after(() => client.close())
  const listed = await call(client, 'fabric_agents_list')
  assert.deepEqual(listed.sessions.map((s) => [s.session_id, s.came_in, s.observed.state]), [['s-pty', 'launched', 'running']])
})

test('TR-1: a rejoin minted under a new runtime id renames the session it belongs to', async (t) => {
  const { surface } = await surfaceWith([])
  t.after(() => surface.stop())
  surface.mint('p', 's-1', null, { cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-old' })
  surface.mint('p', 's-1', null, { cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-new', rejoin: true })
  assert.equal(surface.heldSessions('p')[0].runtimeSessionId, 'rt-new')
})

test('TR-2: while the agent\'s own fabric-mcp signs, a rejoin\'s end does not end the session; the agent\'s own does', async (t) => {
  const { surface, ended } = await surfaceWith([])
  t.after(() => surface.stop())
  const own = surface.mint('p', 's-1', null, { cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-1' })
  const ownClient = await connect(surface, own.token)
  t.after(() => ownClient.close())
  const hook = surface.mint('p', 's-1', null, { cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-1', rejoin: true })
  const hookClient = await connect(surface, hook.token)
  t.after(() => hookClient.close())
  const r = await call(hookClient, 'fabric_session_observe', END())
  assert.deepEqual([r.recorded, r.code], [false, 'agent-still-connected'])
  const rel = await call(hookClient, 'fabric_work_release', { claims: 'session', outcome: 'let-go', reason: 'the Claude Code session ended (other)' })
  assert.deepEqual([rel.released, rel.code], [false, 'agent-still-connected'])
  assert.deepEqual(ended, [])
})

test('TR-2: an end observed before the session enrolled does not end it', async (t) => {
  const { surface, ended } = await surfaceWith([])
  t.after(() => surface.stop())
  const own = surface.mint('p', 's-1', null, { cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-1' })
  const client = await connect(surface, own.token)
  t.after(() => client.close())
  const r = await call(client, 'fabric_session_observe', END({ observedAt: '2026-10-18T03:02:07Z' }))
  assert.deepEqual([r.recorded, r.code], [false, 'stale-end'])
  assert.deepEqual(ended, [])
})

// ── 0.3.9 review iteration 1 ────────────────────────────────────────────────────────────────────────────────────

/** A surface with a journal that keeps what is appended, and a clock the test moves. */
async function recordingSurface() {
  const appended = []
  let now = Date.parse('2026-10-21T10:00:00Z')
  const ended = []
  const journal = { append: async (e) => { appended.push(e); return { seq: appended.length } } }
  const surface = new AgentSurface({
    db: emptyDb, journal, estateId: 'e', now: () => now,
    ptys: () => ({ list: () => [], get: () => null }),
    work: { resolveSource: async () => ({ ok: false, part: 'repository', reason: 'none' }), leaseRefs: async () => null, endSession: (id) => ended.push(id) }
  })
  await surface.start()
  return { surface, appended, ended, advance: (ms) => { now += ms }, at: () => now }
}
async function connectWithTransport(surface, token) {
  const client = new Client({ name: 'probe', version: '0.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL(surface.endpoint), { requestInit: { headers: { Authorization: 'Bearer ' + token } } })
  await client.connect(transport)
  return { client, transport }
}
const settle = () => new Promise((r) => setTimeout(r, 50))
const endsOf = (appended) => appended.filter((e) => e.type === 'session.ended@1')

// DA-1 / TR-13: 0.3.9 refuses the hook's end while the agent's own fabric-mcp signs, so the end must be recorded when
// that fabric-mcp leaves; before this fix the leave wrote only an ops line and no enrolled session's end was journalled.
test('DA-1: the hook\'s end is refused while the agent signs; the agent\'s own fabric-mcp leaving records the end once and ends the session', async (t) => {
  const { surface, appended, ended } = await recordingSurface()
  t.after(() => surface.stop())
  const own = surface.mint('p', 's-1', null, { cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-1' })
  const ownLink = await connectWithTransport(surface, own.token)
  const hook = surface.mint('p', 's-1', null, { cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-1', rejoin: true })
  const hookLink = await connectWithTransport(surface, hook.token)
  t.after(() => hookLink.client.close())
  const r = await call(hookLink.client, 'fabric_session_observe', END())
  assert.equal(r.code, 'agent-still-connected')
  // The hook's own rejoin leaving takes only itself: no end is recorded for it.
  await hookLink.transport.terminateSession()
  await settle()
  assert.equal(endsOf(appended).length, 0)
  await ownLink.transport.terminateSession()
  await ownLink.client.close()
  await settle()
  const ends = endsOf(appended)
  assert.equal(ends.length, 1)
  assert.equal(ends[0].payload.session_id, 's-1')
  assert.equal(ends[0].payload.observed_by, 'fabric')
  assert.equal(ends[0].payload.reason, 'agent-left')
  assert.equal(ends[0].payload.runtime_session_id, 'rt-1')
  assert.equal(ends[0].projectId, 'p')
  assert.deepEqual(ended, ['s-1'])
})

test('DA-1: a hook end recorded first (the agent\'s fabric-mcp silent) is not recorded again when that fabric-mcp then leaves', async (t) => {
  const { surface, appended, advance } = await recordingSurface()
  t.after(() => surface.stop())
  const own = surface.mint('p', 's-2', null, { cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-2' })
  const ownLink = await connectWithTransport(surface, own.token)
  advance(6 * 60_000)
  const hook = surface.mint('p', 's-2', null, { cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-2', rejoin: true })
  const hookLink = await connectWithTransport(surface, hook.token)
  t.after(() => hookLink.client.close())
  const r = await call(hookLink.client, 'fabric_session_observe', END({ runtimeSessionId: 'rt-2', observedAt: new Date(Date.parse('2026-10-21T10:06:00Z')).toISOString().slice(0, 19) + 'Z' }))
  assert.equal(r.recorded, true)
  await ownLink.transport.terminateSession()
  await ownLink.client.close()
  await settle()
  const ends = endsOf(appended)
  assert.equal(ends.length, 1)
  assert.equal(ends[0].payload.observed_by, 'hook')
})

// UX-9: the descriptions an agent reads say the 0.3.9 rules, without an em dash.
test('UX-9: the tool descriptions say which ends do not end the session, that a claim moves its task, and where a release moves it', async (t) => {
  const { surface } = await surfaceWith([])
  t.after(() => surface.stop())
  const scope = surface.mint('p', 's-d', null, { cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-d' })
  const client = await connect(surface, scope.token)
  t.after(() => client.close())
  const tools = new Map((await client.listTools()).tools.map((x) => [x.name, x.description]))
  const observe = tools.get('fabric_session_observe')
  assert.match(observe, /reason clear/)
  assert.match(observe, /before this session enrolled/)
  assert.match(observe, /own fabric-mcp/)
  assert.match(observe, /renamed/)
  assert.match(tools.get('fabric_work_claim'), /moves its task from backlog to running/)
  assert.match(tools.get('fabric_work_release'), /done moves the task to review/)
  assert.match(tools.get('fabric_work_release'), /back to backlog/)
  for (const name of ['fabric_session_observe', 'fabric_work_claim', 'fabric_work_release']) assert.doesNotMatch(tools.get(name), /—/, name)
  const stale = await call(client, 'fabric_session_observe', END({ runtimeSessionId: 'rt-d', observedAt: '2026-10-18T03:02:07Z' }))
  assert.match(stale.reason, /\.$/, 'the stale-end reason ends with a full stop')
})
