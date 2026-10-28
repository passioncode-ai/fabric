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
import { compileCommsValidators, compilePinnedSchemas, fixtureRoot, loadPinnedFixtures } from './contract-consumer-fixtures.mjs'
import { transitionFindings } from '../src/main/commsTransition.ts'

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

test('every comms fixture the contract grades gets the same verdict from the pinned schemas (DEC-0022, DEC-0073)', () => {
  const comms = compileCommsValidators(fixtures)
  const graded = fixtures.document('current/catalogue.json').filter(entry => /^(positive|negative)\/comms-/.test(entry.path))
  const vendored = new Set(fixtures.source.files.map(file => file.upstreamPath))
  // A comms fixture the contract grades but this copy left out would be a verdict silently skipped.
  assert.deepEqual(graded.map(entry => 'fixtures/' + entry.path).filter(path => !vendored.has(path)), [])
  // DEC-0022's seventeen, DEC-0073's fifty-two (the tools' arguments, the receipt, the directory), DEC-0078's eight
  // (the replace receipt's `transferred`: one positive, seven negatives) at f00a768, and DEC-0079's, DEC-0080's and
  // DEC-0081's fifty-nine (the held refusal and member, the structured finding, the owner's settlement) at a59d04b, and
  // twenty-six at 39c8977 (com.read_ack, the host's wait refusal, the unread filter, reactions, noResponder: ten positive,
  // sixteen negative), and fourteen at 3830a33 (DEC-0135's reply audience, `deliverTo`: six positive, eight negative).
  assert.equal(graded.length, 176)
  for (const entry of graded) {
    const validate = comms[entry.schema]
    assert.ok(validate, `${entry.name}: no compiled comms schema ${entry.schema}`)
    const valid = validate(fixtures.document('current/' + entry.path))
    assert.equal(valid, entry.valid, `${entry.name}: ${JSON.stringify(validate.errors)}`)
    if (!entry.valid && entry.keyword) assert.ok(validate.errors.some(error => error.keyword === entry.keyword), `${entry.name}: expected ${entry.keyword}, got ${JSON.stringify(validate.errors)}`)
  }
  // The board takes estate and sender from the authenticated endpoint, never the payload (C-rules, project-comms.md).
  const forged = graded.filter(entry => /forged/.test(entry.name)).map(entry => entry.valid)
  assert.equal(forged.length, 7)
  assert.ok(forged.every(v => v === false), 'a forged estate, sender, project or principal passed a pinned schema')
})

// #region project-board-settled-by — docs: docs/adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md#7-the-owner-settles-a-request-nobody-can-settle-contract-dec-0081
test('FAC-SEM-109 (DEC-0081): Fabric\'s transition rules give every settlement vector the contract\'s answer, in its order', () => {
  const vectors = fixtures.document('current/vectors/comms-settlement.json')
  assert.equal(vectors.cases.length, 31, 'the pin publishes thirty-one settlement vectors')
  for (const c of vectors.cases) {
    assert.deepEqual(transitionFindings(c.record).map(f => `${f.code} ${f.instancePath}`), c.expect, c.name)
  }
  // The boundaries a port gets wrong, present by name: a vector set that lost them would pass a lax port.
  const names = new Set(vectors.cases.map(c => c.name))
  for (const name of ['owner-summary-2000-astral-characters', 'owner-summary-2001-characters', 'settled-by-null', 'owner-provenance-capitalised',
    'reconcile-record-without-settled-by', 'complete-record-without-settled-by', 'owner-abandons-to-cancelled'])
    assert.ok(names.has(name), name)
  // An op named after an Object.prototype member is a finding, never a throw.
  for (const op of ['constructor', '__proto__', 'toString']) assert.deepEqual(transitionFindings({ op, from: 'queued', to: 'claimed' }).map(f => f.code), ['FAC-SEM-027'])
  assert.deepEqual(transitionFindings(null).map(f => f.code), ['FAC-SEM-027'], 'a record that is not an object is read as an empty one')
})

// The pin's other two vector sets are owed, by name, to the nodes that build what they test (never skipped silently):
// the hold matrix to W4-7 (migration 109's board_hold_refusal), the structured finding to W4-12 (after DEC-0080 is served).
// What READS can say today is said here: the contract never refuses a read under any hold, and every message case of the
// finding vectors is a read of a member Fabric does not serve yet.
test('DEC-0079 hold vectors: the reads are never refused under any hold; the rest are owed to W4-7', () => {
  const v = fixtures.document('current/vectors/comms-hold.json')
  assert.equal(v.cases.length, 114)
  const READS = new Set(['com.list', 'com.get', 'com.status', 'com.directory', 'com.read_ack'])
  const reads = v.cases.filter(c => READS.has(c.tool))
  assert.equal(reads.length, 25, 'each read tool with no hold, under each scope alone and under all three')
  for (const c of reads) assert.equal(c.refused, false, c.name)
  assert.equal(v.cases.length - reads.length, 89, 'the commands\' cases W4-7 runs through its port')
})
test('DEC-0079 hold vectors through Fabric\'s hold check (89 command cases: submit, reply, enroll, responder_replace, claim, accept, effect_begin, complete, reconcile, progress, renew, cancel, release)', { todo: 'owed to W4-7: migration 109 builds the hold check these run through' }, () => {})
test('DEC-0080 finding vectors: 61 cases (57 on com.submit, 4 on a message as read)', { todo: 'owed to W4-12: Fabric serves the structured finding after DEC-0080 is built' }, () => {
  const v = fixtures.document('current/vectors/comms-finding.json')
  assert.equal(v.cases.length, 61)
  assert.equal(v.cases.filter(c => c.on === 'message').length, 4)
})
// #endregion project-board-settled-by

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
