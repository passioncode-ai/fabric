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
import { BOARD_SESSION_OPERATIONS, COMMS_OPERATIONS } from '../src/main/boardService.ts'

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

test('a board session lists exactly the thirteen respond-only com.* tools (ADR-0149 Amendment 2): no com.submit, com.cancel, com.read_ack or com.directory, no fabric_* tool', async () => {
  const { surface } = surfaceWith()
  await linked(surface.serverFor(enrolledScope({ cameIn: 'hub', agent: 'example-agent', surface: 'board' })), async (client) => {
    const names = (await client.listTools()).tools.map((t) => t.name).sort()
    assert.deepEqual(names, ['com.accept', 'com.claim', 'com.complete', 'com.effect_begin', 'com.enroll', 'com.get', 'com.list', 'com.progress',
      'com.reconcile', 'com.renew', 'com.reply', 'com.responder_replace', 'com.status'])
    assert.deepEqual(names, [...BOARD_SESSION_OPERATIONS].sort())
    for (const absent of ['com.submit', 'com.cancel', 'com.read_ack', 'com.directory']) assert.ok(!names.includes(absent), `${absent} on a board session`)
    const whoami = await client.callTool({ name: 'fabric_whoami', arguments: {} }).catch((e) => ({ isError: true, thrown: String(e) }))
    assert.equal(whoami.isError, true, 'fabric_whoami answered on a board session')
  })
  await linked(surface.serverFor(enrolledScope()), async (client) => {
    const names = (await client.listTools()).tools.map((t) => t.name)
    assert.ok(names.includes('fabric_whoami') && names.includes('com.enroll'), 'a project session keeps its tools and the board\'s')
    for (const op of COMMS_OPERATIONS) assert.ok(names.includes(op), `a project session lost ${op}`)
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

test('fabric.project.resolve answers the contract attribution for a binding and is absent on the door (F9, DEC-0089)', async () => {
  const access = { request: async () => ({ ok: false, refused: 'x' }), status: async () => ({ ok: false, refused: 'x' }), liveGrantsOf: async () => [] }
  assert.ok(HUB_TOOLS.binding.includes('fabric.project.resolve')); assert.ok(!HUB_TOOLS.door.includes('fabric.project.resolve'))
  await linked(hubServerFor({ kind: 'door' }, { access }), async (client) => {
    assert.ok(!(await client.listTools()).tools.map((t) => t.name).includes('fabric.project.resolve'), 'the door resolves folders')
  })
  const asked = []
  const binding = { id: BINDING, agent_id: 'example-agent', revoked_at: null }
  await linked(hubServerFor({ kind: 'binding', binding }, { access, resolveProject: async (p) => { asked.push(p); return { outcome: 'attached', project: PROJECT, rule: 'worktree' } } }), async (client) => {
    const out = await client.callTool({ name: 'fabric.project.resolve', arguments: { path: '/Users/ana/DATA/_worktrees/f9' } })
    assert.deepEqual(out.structuredContent, { outcome: 'attached', project: PROJECT, rule: 'worktree' })
    assert.ok(!out.isError)
    assert.deepEqual(asked, ['/Users/ana/DATA/_worktrees/f9'])
  })
  await linked(hubServerFor({ kind: 'binding', binding }, { access }), async (client) => {
    const out = await client.callTool({ name: 'fabric.project.resolve', arguments: { path: '/x' } })
    assert.equal(out.structuredContent.error.code, 'hub-unavailable')
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

// The wave-2 fix round (COM-03), each seen red first.
test('a board session is told its idempotency epoch by com.status (fix 1)', async () => {
  const { surface } = surfaceWith({ board_status: { data: { ok: true, unread: 0, epoch: 2, responders: [] }, error: null } })
  await linked(surface.serverFor(enrolledScope({ cameIn: 'hub', agent: 'example-agent', surface: 'board' })), async (client) => {
    const out = JSON.parse((await client.callTool({ name: 'com.status', arguments: {} })).content[0].text)
    assert.deepEqual(out.idempotency, { epoch: 2 }, 'a board session cannot learn the epoch its responder commands need')
  })
})

// A client leaving: a DELETE with its bearer and its mcp-session-id (the leave path of agentSurface.ts).
async function leave(surface, token) {
  const st = surface['states'].get(token); st.claimedAt = Date.now(); st.mcpSessionId = 'mcp-1'
  let body = ''
  surface['leave'](token, st, { headers: { 'mcp-session-id': 'mcp-1' } }, { writeHead() {}, end(b) { body = b } }, { refused() {} })
  await new Promise((r) => setTimeout(r, 10))
  return JSON.parse(body)
}

test('a board session\'s client leaving ends the session: its slots are released and it is no longer held (fix 2)', async () => {
  const { surface, calls } = surfaceWith({ board_join_check: { data: { ok: true, capabilities: ['finance.close'], grants: [GRANT] }, error: null } })
  const joined = await surface.joinBoard({ id: BINDING, agent_id: 'example-agent' }, PROJECT, 'board-1')
  // Held, and marked as a board session: the home and «Where work is» leave it out of the sessions at work (i3 DA-2).
  assert.deepEqual(surface.heldSessions(PROJECT).map((s) => s.surface), ['board'])
  const left = await leave(surface, joined.token)
  assert.equal(left.sessionEnded, true, 'a board session\'s leave dropped only the bearer')
  assert.deepEqual(calls.find((c) => c.fn === 'board_release_session'), { fn: 'board_release_session', args: { p_estate: ESTATE, p_session: 'board-1' } })
  assert.deepEqual(surface.heldSessions(PROJECT), [], 'an ended board session is still listed as held')
  // A launched session's bearer still takes only itself.
  const launched = surface.mint(PROJECT, 'launched-1', null)
  assert.equal((await leave(surface, launched.token)).sessionEnded, false)
})

test('a launched session of a created agent responds as its runner — the catalogue id its binding names — not as the created agent (fix 12)', async () => {
  const slot = { ok: true, repeated: false, slot: { project: PROJECT, capability: 'analytics.retention', generation: 1, leaseExpiresAt: '2026-10-13T07:00:00.000Z' } }
  const calls = []
  const db = { rpc: async (fn, args) => { calls.push({ fn, args }); return { data: slot, error: null } } }
  const ptys = { get: () => ({ optionId: 'agent-7f3a' }), runnerOf: () => 'claude-code', list: () => [] }
  const surface = new AgentSurface({ db, journal: { append: async () => ({ seq: 1 }) }, ptys: () => ptys, estateId: ESTATE })
  await linked(surface.serverFor({ estateId: ESTATE, projectId: PROJECT, sessionId: 'launched-7', taskId: null, cameIn: 'launched', agent: null, runtimeSessionId: null, surface: 'session', bindingId: null }), async (client) => {
    await client.callTool({ name: 'com.enroll', arguments: { idempotency: { epoch: 1, key: 'enroll-00001' }, capability: 'analytics.retention' } })
  })
  const enroll = calls.find((c) => c.fn === 'board_enroll')
  assert.equal(enroll.args.p_holder.agent, 'claude-code', 'board_grant_for compares the runner\'s binding, so the created agent\'s id can never respond')
})

test('a board session whose board.respond grant expired is ended at its next call, its slots released, and told why (fix 14)', async () => {
  let now = Date.parse('2026-10-13T08:00:00Z')
  const calls = []
  const db = { rpc: async (fn, args) => { calls.push({ fn, args }); return fn === 'board_join_check' ? { data: { ok: true, capabilities: ['finance.close'], grants: [GRANT] }, error: null } : { data: { ok: true, released: 1 }, error: null } } }
  const surface = new AgentSurface({ db, journal: { append: async () => ({ seq: 1 }) }, ptys: () => undefined, estateId: ESTATE, now: () => now })
  await surface.start()
  try {
    const joined = await surface.joinBoard({ id: BINDING, agent_id: 'example-agent' }, PROJECT, 'board-x', { authorityUntil: now + 60_000 })
    now += 61_000
    const res = await fetch(surface.endpoint, { method: 'POST', headers: { authorization: `Bearer ${joined.token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } }) })
    assert.equal(res.status, 401, 'an expired grant\'s board session was served')
    assert.match(await res.text(), /expired/)
    await new Promise((r) => setTimeout(r, 10))
    assert.ok(calls.some((c) => c.fn === 'board_release_session' && c.args.p_session === 'board-x'), 'its slots were not released')
    assert.deepEqual(surface.heldSessions(PROJECT), [])
  } finally { await surface.stop() }
})
// #endregion board-session-join
