// #region hub-doors-test — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
// ADR-0195 W2c.2b, the first group: the window's nine Agent access doors as functions (`main/hubDoors.ts`), and the
// same functions served on the board's operator door. The hub is a stand-in that records what it was asked; the door
// is a real loopback listener under a temporary root, called through the published files as the window will call it.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { HUB_DOOR_NAMES, createHubDoors, hubDoorTable } from '../src/main/hubDoors.ts'
import { callOperatorDoor, startOperatorDoor } from '../src/main/operatorDoor.ts'

const OPERATOR = { kind: 'person', id: 'op-1' }

/** A hub that answers from fixed rows and records every write it was asked for. */
function standIn(over = {}) {
  const calls = []
  const requests = new Map([
    ['req-inbox', { id: 'req-inbox', callee: 'fabric-inbox', agent_id: 'claude-code', registry: { name: 'Claude Code' } }],
    ['req-self', { id: 'req-self', callee: 'fabric', agent_id: 'claude-code', registry: null }]
  ])
  const hub = {
    doorToken: 'token',
    down: null,
    downCode: undefined,
    downFact: undefined,
    access: {
      overview: async () => ({ pending: [], bindings: [], denials: [] }),
      decide: async (id, decision, actor) => { calls.push(['decide', id, decision, actor]); return { ok: true } },
      revokeGrant: async (id, actor) => { calls.push(['revokeGrant', id, actor]); return { ok: true } },
      revokeBinding: async (id, actor) => { calls.push(['revokeBinding', id, actor]); return { ok: true } },
      clearDenial: async (id, actor) => { calls.push(['clearDenial', id, actor]); return { ok: true } }
    },
    accessStore: {
      liveConnection: async () => null,
      request: async (id) => requests.get(id) ?? null,
      binding: async (id) => (id === 'bind-1' ? { id, agent_id: 'claude-code', request_id: 'req-inbox' } : null)
    },
    connector: {
      lastOutcome: () => null,
      begin: async (flow, opts) => { calls.push(['begin', flow.product, opts]); return { ok: true } },
      disconnect: async (product) => { calls.push(['disconnect', product]); return { ok: true } }
    },
    ...over
  }
  const marks = []
  const notes = []
  const failures = []
  const deps = {
    hub: () => hub,
    origin: () => 'http://127.0.0.1:47070',
    operator: () => OPERATOR,
    keptOut: { readable: () => true, list: () => [{ agentId: 'codex', name: 'Codex', at: '2026-11-21T00:00:00.000Z' }] },
    personEnded: { markGrant: (id) => marks.push(['grant', id]), markBinding: (id) => marks.push(['binding', id]) },
    acts: () => ({
      note: async (a) => { notes.push(a) },
      perform: async (kind, args) => { calls.push(['perform', kind, args]); return args.agent_id ? { ok: true, seq: 7 } : { ok: false, reason: 'no agent named' } }
    }),
    ops: { failed: (op, e, fields) => failures.push([op, String(e), fields]) },
    home: () => '/home/person'
  }
  return { hub, deps, calls, marks, notes, failures }
}

test('the table serves exactly the nine doors of the window, each a name the operator door accepts', () => {
  const table = hubDoorTable(createHubDoors(standIn().deps))
  assert.deepEqual([...table.keys()], [...HUB_DOOR_NAMES])
  assert.equal(table.size, 9)
})

test('a door before the hub exists says agent access is not ready, as the window door did', async () => {
  const s = standIn()
  const doors = createHubDoors({ ...s.deps, hub: () => null })
  await assert.rejects(doors.overview(), /agent access is not ready yet/)
  await assert.rejects(doors.clearDenial('r'), /agent access is not ready yet/)
})

test('the overview says the hub by facts: listening with the surface origin, or down with its reason', async () => {
  const up = await createHubDoors(standIn().deps).overview()
  assert.deepEqual(up.hub, { listening: true, origin: 'http://127.0.0.1:47070' })
  assert.deepEqual(up.keptOut, { readable: true, agents: [{ agentId: 'codex', name: 'Codex', at: '2026-11-21T00:00:00.000Z' }] })
  assert.ok(up.products.length > 0 && up.products.every((p) => p.connection === null && p.lastAttempt === null))
  const down = await createHubDoors(standIn({ doorToken: null, down: 'the port is taken', downCode: 'port-taken', downFact: '47070' }).deps).overview()
  assert.deepEqual(down.hub, { listening: false, reason: 'the port is taken', code: 'port-taken', fact: '47070' })
})

test('a decision is allowed or denied; an Allow of a product not yet connected opens its connect flow', async () => {
  const s = standIn()
  const doors = createHubDoors(s.deps)
  assert.deepEqual(await doors.decide('req-inbox', 'maybe'), { ok: false, reason: 'a decision is allowed or denied' })
  assert.equal(s.calls.length, 0)
  assert.deepEqual(await doors.decide('req-inbox', 'allowed'), { ok: true })
  assert.deepEqual(s.calls, [['decide', 'req-inbox', 'allowed', OPERATOR], ['begin', 'fabric-inbox', { reconnect: false }]])
  s.calls.length = 0
  // Fabric itself is not a product: nothing to connect.
  assert.deepEqual(await doors.decide('req-self', 'allowed'), { ok: true })
  assert.deepEqual(s.calls, [['decide', 'req-self', 'allowed', OPERATOR]])
  s.calls.length = 0
  assert.deepEqual(await doors.decide('req-inbox', 'denied'), { ok: true })
  assert.deepEqual(s.calls, [['decide', 'req-inbox', 'denied', OPERATOR]])
})

test('an Allow whose product cannot be opened is still an Allow, with the problem beside it', async () => {
  const s = standIn()
  s.hub.connector.begin = async () => ({ ok: false, problem: { code: 'no-browser' }, reason: 'no browser' })
  assert.deepEqual(await createHubDoors(s.deps).decide('req-inbox', 'allowed'), { ok: true, connect: { problem: { code: 'no-browser' } } })
})

test('a revocation is marked as the person\'s before it is written, and an agent\'s is noted in History by name', async () => {
  const s = standIn()
  const doors = createHubDoors(s.deps)
  assert.deepEqual(await doors.revokeGrant('grant-1'), { ok: true })
  assert.deepEqual(s.marks, [['grant', 'grant-1']])
  assert.deepEqual(await doors.revokeAgent('bind-1'), { ok: true })
  assert.deepEqual(s.marks[1], ['binding', 'bind-1'])
  assert.deepEqual(s.calls.at(-1), ['revokeBinding', 'bind-1', OPERATOR])
  assert.equal(s.notes.length, 1)
  assert.equal(s.notes[0].kind, 'agent.disconnect')
  assert.deepEqual(s.notes[0].subject, { type: 'agent', id: 'bind-1', label: 'Claude Code' })
  assert.equal(s.notes[0].whyNot, 'credential_gone')
})

test('a binding that cannot be read leaves the act unnamed and says why in the operations log; a refused revocation notes nothing', async () => {
  const s = standIn()
  s.hub.accessStore.binding = async () => { throw new Error('db down') }
  assert.deepEqual(await createHubDoors(s.deps).revokeAgent('bind-1'), { ok: true })
  assert.equal(s.notes[0].subject.label, null)
  assert.deepEqual(s.failures.map((f) => [f[0], f[2]]), [['hub.access.revoke-name-unreadable', { binding_id: 'bind-1' }]])
  const r = standIn()
  r.hub.access.revokeBinding = async () => ({ ok: false, reason: 'gone already' })
  assert.deepEqual(await createHubDoors(r.deps).revokeAgent('bind-1'), { ok: false, reason: 'gone already' })
  assert.equal(r.notes.length, 0)
})

test('disconnect and let-in are History\'s acts; an agent id that is not a string is an empty one, refused by the act', async () => {
  const s = standIn()
  const doors = createHubDoors(s.deps)
  assert.deepEqual(await doors.disconnectAgent('codex'), { ok: true, seq: 7 })
  assert.deepEqual(await doors.letAgentIn('codex'), { ok: true, seq: 7 })
  assert.deepEqual(await doors.disconnectAgent({ id: 'codex' }), { ok: false, reason: 'no agent named' })
  assert.deepEqual(s.calls, [['perform', 'agent.disconnect', { agent_id: 'codex' }], ['perform', 'agent.let_in', { agent_id: 'codex' }], ['perform', 'agent.disconnect', { agent_id: '' }]])
})

test('connect opens only a product with a flow; a reconnect is the explicit true, never a truthy value', async () => {
  const s = standIn()
  const doors = createHubDoors(s.deps)
  assert.deepEqual(await doors.connect('unknown-product'), { ok: false, problem: { code: 'no-flow' }, reason: 'unknown-product has no connect flow' })
  await doors.connect('fabric-inbox', { reconnect: 'yes' })
  await doors.connect('fabric-inbox', { reconnect: true })
  assert.deepEqual(s.calls, [['begin', 'fabric-inbox', { reconnect: false }], ['begin', 'fabric-inbox', { reconnect: true }]])
  assert.deepEqual(await doors.disconnect('fabric-inbox'), { ok: true })
  assert.deepEqual(await doors.clearDenial('req-9'), { ok: true })
  assert.deepEqual(s.calls.slice(2), [['disconnect', 'fabric-inbox'], ['clearDenial', 'req-9', OPERATOR]])
})

test('the same doors through the board\'s operator door: positional arguments in, the door\'s answer out', async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-hub-doors-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const s = standIn()
  const door = await startOperatorDoor({ root: dir, peerAccount: async () => 'own', doors: hubDoorTable(createHubDoors(s.deps)) })
  t.after(() => door.stop())
  const overview = await callOperatorDoor(dir, 'hub.overview', [])
  assert.equal(overview.ok, true)
  assert.deepEqual(overview.value.hub, { listening: true, origin: 'http://127.0.0.1:47070' })
  assert.deepEqual(await callOperatorDoor(dir, 'hub.decide', ['req-inbox', 'allowed']), { ok: true, value: { ok: true } })
  assert.deepEqual(await callOperatorDoor(dir, 'hub.decide', ['req-inbox', 'perhaps']), { ok: true, value: { ok: false, reason: 'a decision is allowed or denied' } })
  assert.deepEqual(await callOperatorDoor(dir, 'hub.connect', ['fabric-inbox', { reconnect: true }]), { ok: true, value: { ok: true } })
  assert.deepEqual(await callOperatorDoor(dir, 'hub.revokeAgent', ['bind-1']), { ok: true, value: { ok: true } })
  assert.deepEqual(await callOperatorDoor(dir, 'hub.disconnectAgent', ['codex']), { ok: true, value: { ok: true, seq: 7 } })
  assert.deepEqual(s.calls, [
    ['decide', 'req-inbox', 'allowed', OPERATOR], ['begin', 'fabric-inbox', { reconnect: false }],
    ['begin', 'fabric-inbox', { reconnect: true }], ['revokeBinding', 'bind-1', OPERATOR], ['perform', 'agent.disconnect', { agent_id: 'codex' }]
  ])
  assert.deepEqual(s.marks, [['binding', 'bind-1']])
  // Arguments that are not a list never reach a door: no write, and the refusal is the door's failure answer.
  const before = s.calls.length
  const refused = await callOperatorDoor(dir, 'hub.revokeGrant', { grantId: 'grant-1' })
  assert.equal(refused.ok, false)
  assert.equal(s.calls.length, before)
  assert.deepEqual(s.marks, [['binding', 'bind-1']])
})
// #endregion hub-doors-test
