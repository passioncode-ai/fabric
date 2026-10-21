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
