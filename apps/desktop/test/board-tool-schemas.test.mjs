// CO-292: the board's tools publish the contract's argument types, so a client that types its arguments from
// tools/list — Claude Code sends a value the schema does not declare as a string — can still call them. The
// board service stays the one validator: the published schema is generated from the same strict shapes it
// parses with, and a forged field is still refused in the contract's words, before any database call.
// #region board-tool-schemas — docs: docs/adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md#2-the-wire-is-the-contracts-pinned-by-bytes
import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { AgentSurface } from '../src/main/agentSurface.ts'
import { COMMS_OPERATIONS } from '../src/main/boardService.ts'
import { BOARD_TOOL_INPUT, publishedBoardSchema } from '../src/main/boardTools.ts'

const ESTATE = '87000000-0000-4000-8000-000000000001', PROJECT = '87000000-0000-4000-8000-000000000012', OTHER = '87000000-0000-4000-8000-000000000013'
const scope = { estateId: ESTATE, projectId: PROJECT, sessionId: 'session-s', taskId: null, cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: null, surface: 'session', bindingId: null }

async function linked(server, run) {
  const client = new Client({ name: 'board-tool-schemas', version: '1.0.0' })
  const [ct, st] = InMemoryTransport.createLinkedPair()
  try { await server.connect(st); await client.connect(ct); return await run(client) } finally { await client.close(); await server.close() }
}
function surfaceWith() {
  const calls = []
  const db = { rpc: async (fn, args) => { calls.push({ fn, args }); return { data: { ok: true }, error: null } } }
  const surface = new AgentSurface({ db, journal: { append: async () => ({ seq: 1 }) }, ptys: () => undefined, estateId: ESTATE })
  return { surface, calls }
}
// What the field report's Claude Code did (CO-292): a value under a property the published schema does not
// declare reaches the server as a string.
function asTypedClient(schema, args) {
  const declared = schema?.properties ?? {}
  return Object.fromEntries(Object.entries(args).map(([k, v]) => [k, k in declared || typeof v === 'string' ? v : JSON.stringify(v)]))
}
const errorOf = (out) => { try { return JSON.parse(out.content[0].text).error?.code ?? null } catch { return null } }

test('every com.* tool publishes the strict shape its handler parses with, as an object schema', async () => {
  const { surface } = surfaceWith()
  await linked(surface.serverFor(scope), async (client) => {
    const tools = new Map((await client.listTools()).tools.map((t) => [t.name, t]))
    for (const op of COMMS_OPERATIONS) {
      const tool = tools.get(op)
      assert.ok(tool, `${op} is not listed`)
      assert.equal(tool.inputSchema.type, 'object', `${op} publishes no object schema`)
      assert.ok(BOARD_TOOL_INPUT[op], `${op} has no declared input shape`)
      const { $schema, ...expected } = publishedBoardSchema(BOARD_TOOL_INPUT[op])
      const { $schema: listed, ...got } = tool.inputSchema
      assert.deepEqual(got, expected, `${op} publishes a schema other than its handler's`)
    }
    const submit = tools.get('com.submit').inputSchema
    assert.equal(submit.properties.idempotency.type, 'object')
    assert.equal(submit.properties.body.type, 'object')
    assert.equal(tools.get('com.list').inputSchema.properties.limit.type, 'integer')
  })
})

test('a client that types arguments from tools/list delivers a nested com.submit and com.list {limit: 50}', async () => {
  const { surface, calls } = surfaceWith()
  await linked(surface.serverFor(scope), async (client) => {
    const tools = new Map((await client.listTools()).tools.map((t) => [t.name, t.inputSchema]))
    const submit = {
      idempotency: { epoch: 1, key: 'co292-submit-00001' },
      thread: { new: { participants: [OTHER], subject: 'CO-292' } },
      kind: 'request',
      request: { target: OTHER, capability: 'owner-review' },
      body: { text: 'Typed arguments reach the board.', format: 'text/markdown' }
    }
    const out = await client.callTool({ name: 'com.submit', arguments: asTypedClient(tools.get('com.submit'), submit) })
    assert.notEqual(errorOf(out), 'invalid_arguments', 'a typed client\'s com.submit was refused by shape')
    const stored = calls.find((c) => c.fn === 'board_submit')
    assert.ok(stored, 'com.submit never reached the board')
    assert.deepEqual(stored.args.p_submit.idempotency, submit.idempotency)
    const list = await client.callTool({ name: 'com.list', arguments: asTypedClient(tools.get('com.list'), { limit: 50 }) })
    assert.notEqual(errorOf(list), 'invalid_arguments', 'a typed client\'s com.list {limit: 50} was refused by shape')
  })
})

test('the board stays the validator: a forged field and a string where the contract wants a number are refused before the database', async () => {
  const { surface, calls } = surfaceWith()
  await linked(surface.serverFor(scope), async (client) => {
    const forged = await client.callTool({ name: 'com.submit', arguments: {
      idempotency: { epoch: 1, key: 'co292-forged-0001' }, thread: { new: { participants: [OTHER] } }, kind: 'message',
      body: { text: 'forged' }, estate_id: ESTATE
    } })
    assert.equal(errorOf(forged), 'invalid_arguments')
    const stringy = await client.callTool({ name: 'com.list', arguments: { limit: '50' } })
    assert.equal(errorOf(stringy), 'invalid_arguments')
  })
  assert.equal(calls.filter((c) => c.fn === 'board_submit').length, 0, 'a forged submission reached the board')
})
// #endregion board-tool-schemas
