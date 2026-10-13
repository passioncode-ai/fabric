// COM-03 (ADR-0149 §1–§4) over the real MCP surface, without a database: the SQL door is a fake that records every
// call. What a session is on the board comes from its scope; a board session from `fabric.board.join` is given the
// `com.*` tools and nothing else; a session's end and a revoked grant release responder slots.
// #region board-session-join — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#4-service-agents-join-with-a-board-session
import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { AgentSurface } from '../src/main/agentSurface.ts'
import { HUB_TOOLS, hubServerFor } from '../src/main/hubTools.ts'
import { COMMS_OPERATIONS } from '../src/main/boardService.ts'

const ESTATE = '87000000-0000-4000-8000-000000000001', PROJECT = '87000000-0000-4000-8000-000000000012', BINDING = '87000000-0000-4000-8000-000000000402'
const GRANT = '87000000-0000-4000-8000-000000000602'
async function linked(server, run) {
  const client = new Client({ name: 'board-surface', version: '1.0.0' })
  const [ct, st] = InMemoryTransport.createLinkedPair()
  try { await server.connect(st); await client.connect(ct); return await run(client) } finally { await client.close(); await server.close() }
}
function surfaceWith(answers = {}) {
  const calls = []
  const db = { rpc: async (fn, args) => { calls.push({ fn, args }); return answers[fn] ?? { data: { ok: true, released: 1 }, error: null } } }
  const surface = new AgentSurface({ db, journal: { append: async () => ({ seq: 1 }) }, ptys: () => undefined, estateId: ESTATE })
  return { surface, calls }
}
const enrolledScope = (extra = {}) => ({ estateId: ESTATE, projectId: PROJECT, sessionId: 'session-b', taskId: null, cameIn: 'enrolled', agent: 'codex', runtimeSessionId: null, surface: 'session', bindingId: BINDING, ...extra })

test('a board session lists exactly the seventeen com.* tools: no fabric_* tool, fabric_whoami not found', async () => {
  const { surface } = surfaceWith()
  await linked(surface.serverFor(enrolledScope({ cameIn: 'hub', agent: 'example-agent', surface: 'board' })), async (client) => {
    const names = (await client.listTools()).tools.map((t) => t.name).sort()
    assert.deepEqual(names, [...COMMS_OPERATIONS].sort())
    const whoami = await client.callTool({ name: 'fabric_whoami', arguments: {} }).catch((e) => ({ isError: true, thrown: String(e) }))
    assert.equal(whoami.isError, true, 'fabric_whoami answered on a board session')
  })
  await linked(surface.serverFor(enrolledScope()), async (client) => {
    const names = (await client.listTools()).tools.map((t) => t.name)
    assert.ok(names.includes('fabric_whoami') && names.includes('com.enroll'), 'a project session keeps its tools and the board\'s')
  })
})

test('a session responds as itself: the holder — session, how it came in, runner, binding — comes from the scope, never the arguments', async () => {
  const slot = { ok: true, repeated: false, slot: { project: PROJECT, capability: 'analytics.retention', generation: 1, leaseExpiresAt: '2026-10-13T07:00:00.000Z' } }
  const { surface, calls } = surfaceWith({ board_enroll: { data: slot, error: null } })
  await linked(surface.serverFor(enrolledScope()), async (client) => {
    const out = await client.callTool({ name: 'com.enroll', arguments: { idempotency: { epoch: 1, key: 'enroll-00001' }, capability: 'analytics.retention' } })
    assert.equal(JSON.parse(out.content[0].text).slot.generation, 1)
    const forged = await client.callTool({ name: 'com.enroll', arguments: { idempotency: { epoch: 1, key: 'enroll-00002' }, capability: 'analytics.retention', session_id: 'someone-else' } })
    assert.equal(JSON.parse(forged.content[0].text).error.code, 'invalid_arguments')
  })
  const enroll = calls.filter((c) => c.fn === 'board_enroll')
  assert.equal(enroll.length, 1)
  assert.deepEqual(enroll[0].args.p_holder, { session_id: 'session-b', came_in: 'enrolled', agent: 'codex', binding_id: BINDING, label: 'codex' })
  assert.equal(enroll[0].args.p_project, PROJECT)
})

test('fabric.board.join mints a one-bearer board session for a binding with a grant; refused without; absent on the door', async () => {
  const { surface, calls } = surfaceWith({ board_join_check: { data: { ok: true, capabilities: ['finance.close'], grants: [GRANT] }, error: null } })
  const joined = await surface.joinBoard({ id: BINDING, agent_id: 'example-agent' }, PROJECT, 'board-session-1')
  assert.deepEqual(joined.capabilities, ['finance.close']); assert.deepEqual(joined.grants, [GRANT])
  assert.equal(surface.credentialState(joined.token), 'unclaimed')
  assert.deepEqual(calls.at(-1), { fn: 'board_join_check', args: { p_estate: ESTATE, p_binding: BINDING, p_project: PROJECT } })
  const refusedSurface = surfaceWith({ board_join_check: { data: { error: { code: 'not_authorized', message: 'This binding may not join that Project\'s board.', retryable: false } }, error: null } }).surface
  const refused = await refusedSurface.joinBoard({ id: BINDING, agent_id: 'example-agent' }, PROJECT, 'board-session-2')
  assert.equal(refused.error.code, 'not_authorized'); assert.equal(refusedSurface.credentialCount(), 0, 'a refused join minted a bearer')
  assert.ok(HUB_TOOLS.binding.includes('fabric.board.join')); assert.ok(!HUB_TOOLS.door.includes('fabric.board.join'))
  const access = { request: async () => ({ ok: false, refused: 'x' }), status: async () => ({ ok: false, refused: 'x' }), liveGrantsOf: async () => [] }
  await linked(hubServerFor({ kind: 'door' }, { access }), async (client) => {
    assert.ok(!(await client.listTools()).tools.map((t) => t.name).includes('fabric.board.join'), 'the door serves fabric.board.join')
  })
  const binding = { id: BINDING, agent_id: 'example-agent', revoked_at: null }
  await linked(hubServerFor({ kind: 'binding', binding }, { access, joinBoard: async (b, a) => ({ ok: true, session: { bearer: 'b'.repeat(32), sessionId: 's', projectId: a.projectId, capabilities: ['finance.close'] } }) }), async (client) => {
    const names = (await client.listTools()).tools.map((t) => t.name).sort()
    assert.deepEqual(names, [...HUB_TOOLS.binding].sort())
    const out = await client.callTool({ name: 'fabric.board.join', arguments: { projectId: PROJECT.toUpperCase() } })
    assert.equal(out.structuredContent.session.projectId, PROJECT)
  })
})

test('a session\'s end releases its responder slots; a revoked grant releases the enrollments it admitted (COM03-10)', async () => {
  const { surface, calls } = surfaceWith()
  surface.mint(PROJECT, 'session-z', null, { cameIn: 'enrolled', agent: 'codex', bindingId: BINDING })
  surface.revokeSession('session-z')
  await new Promise((r) => setTimeout(r, 10))
  assert.deepEqual(calls.find((c) => c.fn === 'board_release_session'), { fn: 'board_release_session', args: { p_estate: ESTATE, p_session: 'session-z' } })
  await surface.releaseBoardGrant(GRANT)
  assert.deepEqual(calls.find((c) => c.fn === 'board_release_grant'), { fn: 'board_release_grant', args: { p_estate: ESTATE, p_grant: GRANT } })
  // A release that fails never throws into the session's end.
  const down = new AgentSurface({ db: { rpc: async () => { throw new Error('down') } }, journal: { append: async () => ({ seq: 1 }) }, ptys: () => undefined, estateId: ESTATE })
  down.mint(PROJECT, 'session-y', null)
  down.revokeSession('session-y')
  await down.releaseBoardGrant(GRANT)
})
// #endregion board-session-join
