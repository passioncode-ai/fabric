// #region contract-consumer-regression — docs: docs/handoffs/2026-10-04-contract-consumer-regression.md#scope-and-contract
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { hubServerFor } from '../src/main/hubTools.ts'
import { normaliseAccessRequest } from '../src/shared/access.ts'
import { AgentSurface } from '../src/main/agentSurface.ts'
import { compilePinnedSchemas, fixtureRoot, loadPinnedFixtures } from './contract-consumer-fixtures.mjs'

const fixtures = loadPinnedFixtures()
const current = compilePinnedSchemas(fixtures)
const legacy = compilePinnedSchemas(fixtures, 'legacy')
const names = [
  ['underscore', 'receive_project_message', true], ['dotted', 'demo.run', true],
  ['two', 'ab', true], ['maximum', 'a'.repeat(128), true], ['maximum-underscore', 'a' + '_'.repeat(127), true],
  ['leading-underscore', '_leading', false], ['one', 'a', false], ['too-long', 'a'.repeat(129), false],
  ['uppercase', 'Uppercase', false], ['space', 'bad space', false], ['slash', 'bad/name', false],
  ['colon', 'bad:name', false], ['number', 42, false],
  ['prototype', 'constructor', true], ['prototype-dotted', 'demo.constructor', true],
  ['middle-newline', 'read\nmessage', false], ['terminal-LF', 'read_message\n', false],
  ['terminal-CR', 'read_message\r', false], ['terminal-CRLF', 'read_message\r\n', false],
  ['terminal-LS', 'read_message\u2028', false], ['terminal-PS', 'read_message\u2029', false]
]
const args = capability => ({ agentId: 'example-agent', capability, input: {} })
const extraCalls = [
  ['unknown-field', { ...args('read_message'), extra: true }, false],
  ['array-input', { ...args('read_message'), input: [] }, false],
  ['null-input', { ...args('read_message'), input: null }, false],
  ['wrong-agent-id', { ...args('read_message'), agentId: 'Invalid Agent' }, false],
  ['empty-key', { ...args('read_message'), idempotencyKey: '' }, false],
  ['maximum-key', { ...args('read_message'), idempotencyKey: 'k'.repeat(256) }, true],
  ['over-key', { ...args('read_message'), idempotencyKey: 'k'.repeat(257) }, false]
]
const calls = [...names.map(([id, name, valid]) => [id, args(name), valid]), ...extraCalls]

function documentFor(surface, name) {
  const files = { manifest: 'manifest-mcp', 'interop-agent-call': 'interop-agent-call',
    'service-well-known': 'service-well-known-capabilities', pipeline: 'pipeline' }
  const value = fixtures.document(`current/positive/${files[surface]}.json`)
  if (surface === 'manifest') value.capabilities[0].name = name
  else if (surface === 'interop-agent-call') value.capability = name
  else if (surface === 'pipeline') value.stages[0].capability = name
  else value.surfaces.mcp.capabilities = [name]
  return value
}

async function linked(server, run) {
  const client = new Client({ name: 'contract-regression', version: '1.0.0' })
  const [ct, st] = InMemoryTransport.createLinkedPair()
  try {
    await server.connect(st)
    await client.connect(ct)
    return await run(client)
  } finally {
    await client.close()
    await server.close()
  }
}

function shapeServer(received) {
  return hubServerFor({ kind: 'binding', binding: { id: 'shape-fixture', agent_id: 'example-agent' } }, {
    access: {}, call: async (_binding, value) => {
      received.push(value)
      return { content: [{ type: 'text', text: 'shape handler reached; no product called or grant checked' }] }
    }
  })
}

for (const surface of Object.keys(current)) {
  test(`compiled pinned ${surface} capability names (${names.length} cases)`, () => {
    for (const [id, name, expected] of names) {
      assert.equal(current[surface](documentFor(surface, name)), expected,
        `${surface}/${id}: ${JSON.stringify(current[surface].errors)}`)
    }
  })
}

test(`real SDK agent.call argument validation matches compiled current schema (${calls.length} cases)`, async () => {
  const received = []
  await linked(shapeServer(received), async client => {
    assert.ok((await client.listTools()).tools.some(tool => tool.name === 'agent.call'))
    for (const [id, value, expected] of calls) {
      const before = received.length
      const normative = current['interop-agent-call'](value)
      assert.equal(normative, expected, `${id}: compiled fixture expectation`)
      const reply = await client.callTool({ name: 'agent.call', arguments: value })
      assert.equal(received.length - before, normative ? 1 : 0, `${id}: SDK dispatch differs from compiled schema`)
      assert.equal(reply.isError === true, !normative, `${id}: malformed call must return a real SDK refusal`)
      if (normative) assert.deepEqual(received.at(-1), value, `${id}: exact arguments reach the handler`)
    }
  })
})

test('legacy compiled schema is a negative control, never a fallback compatibility result', async () => {
  const received = []
  const differences = calls.filter(([, value]) => current['interop-agent-call'](value) !== legacy['interop-agent-call'](value)).map(([id]) => id)
  assert.deepEqual(differences, ['underscore', 'maximum-underscore', 'maximum-key'])
  await linked(shapeServer(received), async client => {
    const value = args('receive_project_message')
    assert.equal(legacy['interop-agent-call'](value), false)
    assert.equal(current['interop-agent-call'](value), true)
    const reply = await client.callTool({ name: 'agent.call', arguments: value })
    assert.notEqual(reply.isError, true)
    assert.deepEqual(received, [value], 'historical schema would miss this real SDK dispatch')
  })
})

test('schema-valid prototype names remain refused by separate local consent policy', async () => {
  const received = []
  await linked(shapeServer(received), async client => {
    for (const capability of ['constructor', 'demo.constructor']) {
      assert.equal(current['interop-agent-call'](args(capability)), true)
      const reply = await client.callTool({ name: 'agent.call', arguments: args(capability) })
      assert.notEqual(reply.isError, true, 'argument shape is valid; fake dispatch proves no grant')
      assert.equal(normaliseAccessRequest({ agentId: 'example-agent', callee: 'fabric-inbox',
        capabilities: [capability], resources: ['news@example.com'], reason: 'bounded fixture' }).ok, false)
    }
    assert.equal(received.length, 2)
  })
})

test('session tools are a separate surface with no agent.call', async () => {
  let written = 0
  const surface = new AgentSurface({ db: {}, journal: { append: async () => ({ seq: ++written }) },
    ptys: () => undefined, estateId: 'fixture-estate' })
  const server = surface.serverFor({ estateId: 'fixture-estate', projectId: 'fixture-project', sessionId: 'fixture-session', taskId: null })
  await linked(server, async client => {
    const tools = (await client.listTools()).tools.map(tool => tool.name)
    assert.ok(tools.includes('fabric_stage_report'))
    assert.ok(!tools.includes('agent.call'), 'session tools are not the interop-agent-call validator')
    await client.callTool({ name: 'fabric_stage_report', arguments: { stage: 'review', step: 1 } })
    assert.equal(written, 1)
    const malformed = await client.callTool({ name: 'fabric_stage_report', arguments: { stage: 42 } })
    assert.equal(malformed.isError, true)
    const absent = await client.callTool({ name: 'agent.call', arguments: args('read_message') })
    assert.equal(absent.isError, true)
    assert.equal(written, 1, 'invalid session requests write no journal event')
  })
})

test('planted schema byte drift refuses before compilation; no regex or revision fallback', () => {
  const root = mkdtempSync(join(tmpdir(), 'fabric-contract-byte-drift-'))
  try {
    cpSync(fixtureRoot, root, { recursive: true })
    const path = join(root, 'current/schemas/common.schema.json')
    const changed = JSON.parse(readFileSync(path, 'utf8'))
    changed.$defs.capabilityName.pattern = '.*'
    writeFileSync(path, JSON.stringify(changed))
    assert.throws(() => compilePinnedSchemas(loadPinnedFixtures(root)), /pinned schema\/fixture byte drift/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
// #endregion contract-consumer-regression
