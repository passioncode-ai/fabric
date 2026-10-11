// ADR-0134: a coding agent asks Fabric itself for `session.enroll` on one project. The asker is a runner of the
// catalogue (never a registry entry), the project must exist, and the request then follows ADR-0115's flow — one
// prompt, a poll secret, the operator's decision. Pure: an in-memory store, no database.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { AccessService } = await import(path.resolve(import.meta.dirname, '../src/main/accessService.ts'))

const PROJECT = '0b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d'
const ask = { agentId: 'claude-code', callee: 'fabric', capabilities: ['session.enroll'], resources: [`project:${PROJECT}`], reason: 'Claude Code in ~/DATA/site wants to work in the project site' }

function harness({ runner = (id) => (id === 'claude-code' ? { key: 'claude-code', name: 'Claude Code', summary: 'a coding agent' } : null), project = async (id) => (id === PROJECT ? { id, name: 'site' } : null) } = {}) {
  const rows = new Map()
  const appended = []
  const presented = []
  const store = {
    requests: async () => [],
    countRequests: async () => 0,
    append: async (type, actor, payload) => { appended.push({ type, payload }); rows.set(payload.id, { ...payload, status: 'pending' }); return appended.length },
    request: async (id) => rows.get(id) ?? null
  }
  const service = new AccessService({
    store,
    registry: { refresh() { throw Error('an enrollment ask must not read the service registry') }, resolve() { throw Error('nor resolve in it') } },
    present: (r) => presented.push(r),
    connected: async () => { throw Error('Fabric itself is not a product to connect') },
    enrollment: { runner, project }
  })
  return { service, appended, presented }
}

test('a coding agent of the catalogue asks once: one prompt, a poll secret, the runner as the registry fact', async () => {
  const h = harness()
  const r = await h.service.request({ kind: 'door' }, ask)
  assert.equal(r.ok, true)
  assert.equal(r.status, 'pending')
  assert.match(r.pollSecret, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(h.presented.length, 1)
  assert.equal(h.presented[0].connected, true, 'nothing to connect for Fabric itself')
  const ev = h.appended.find((e) => e.type === 'access.requested@1')
  assert.deepEqual([ev.payload.agent_id, ev.payload.callee, ev.payload.capabilities, ev.payload.resources], ['claude-code', 'fabric', ['session.enroll'], [`project:${PROJECT}`]])
  assert.equal(ev.payload.registry.kind, 'runner')
})

test('an id that is not a coding agent of the catalogue is refused before any prompt', async () => {
  const h = harness()
  const r = await h.service.request({ kind: 'door' }, { ...ask, agentId: 'some-service' })
  assert.equal(r.ok, false)
  assert.match(r.refused, /not a coding agent/)
  assert.equal(h.presented.length, 0)
})

test('a project that does not exist is refused before any prompt', async () => {
  const h = harness()
  const r = await h.service.request({ kind: 'door' }, { ...ask, resources: ['project:1b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d'] })
  assert.equal(r.ok, false)
  assert.equal(h.presented.length, 0)
})

test('without the enrollment dependency every enrollment ask is refused', async () => {
  const h = harness({ runner: () => null })
  const r = await h.service.request({ kind: 'door' }, ask)
  assert.equal(r.ok, false)
  assert.equal(h.presented.length, 0)
})
