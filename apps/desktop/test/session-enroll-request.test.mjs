// ADR-0134: a coding agent asks Fabric itself for `session.enroll` on one project. The asker is a runner of the
// catalogue (never a registry entry), the project must exist, and the request then follows ADR-0115's flow — one
// prompt, a poll secret, the operator's decision. Pure: an in-memory store, no database.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { AccessService } = await import(path.resolve(import.meta.dirname, '../src/main/accessService.ts'))

const PROJECT = '0b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d'
const ask = { agentId: 'claude-code', callee: 'fabric', capabilities: ['session.enroll'], resources: [`project:${PROJECT}`], reason: 'Claude Code in ~/DATA/site wants to work in the project site' }

const OTHER = '1b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d'
/** Fabric's own resolution of a folder, as index.ts wires it (sessionEnroll.ts#resolveAgentFolder). */
const resolveFolder = async (folder) =>
  folder.startsWith('/Users/me/DATA/site') ? { ok: true, projectId: PROJECT, root: '/Users/me/DATA/site', how: folder === '/Users/me/DATA/site' ? 'exact' : 'ancestor' }
  : folder.startsWith('/Users/me/DATA/other') ? { ok: true, projectId: OTHER, root: '/Users/me/DATA/other', how: 'exact' }
  : { ok: false, message: 'This folder is not a project in Fabric yet.' }

function harness({ runner = (id) => (id === 'claude-code' ? { key: 'claude-code', name: 'Claude Code', summary: 'a coding agent' } : null), project = async (id) => (id === PROJECT || id === OTHER ? { id, name: id === PROJECT ? 'site' : 'other' } : null), available = async () => true, resolve = resolveFolder } = {}) {
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
    enrollment: { runner, project, available, resolve }
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
  const r = await h.service.request({ kind: 'door' }, { ...ask, resources: ['project:2b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d'] })
  assert.equal(r.ok, false)
  assert.equal(h.presented.length, 0)
})

test('the folder is Fabric\'s fact: resolved by Fabric, journalled as registry.project {id, name, root, how}', async () => {
  const h = harness()
  const r = await h.service.request({ kind: 'door' }, { ...ask, folder: '/Users/me/DATA/site/src' })
  assert.equal(r.ok, true)
  const ev = h.appended.find((e) => e.type === 'access.requested@1')
  assert.deepEqual(ev.payload.registry.project, { id: PROJECT, name: 'site', root: '/Users/me/DATA/site', how: 'ancestor' })
  assert.equal(JSON.stringify(ev.payload).includes('/Users/me/DATA/site/src'), false, 'the agent\'s own folder is not what is journalled — the admitted one is')
})

test('without a folder, registry.project still carries the project, with root and how null', async () => {
  const h = harness()
  assert.equal((await h.service.request({ kind: 'door' }, ask)).ok, true)
  assert.deepEqual(h.appended.find((e) => e.type === 'access.requested@1').payload.registry.project, { id: PROJECT, name: 'site', root: null, how: null })
})

test('a folder of another project, of no project, or not absolute is refused before any prompt', async () => {
  for (const folder of ['/Users/me/DATA/other', '/Users/me/elsewhere', 'relative/dir', 42]) {
    const h = harness()
    const r = await h.service.request({ kind: 'door' }, { ...ask, folder })
    assert.equal(r.ok, false, String(folder))
    assert.match(r.refused, /Nothing was shown to the operator/)
    assert.equal(h.presented.length, 0)
    assert.equal(h.appended.length, 0)
  }
  const h = harness()
  assert.match((await h.service.request({ kind: 'door' }, { ...ask, folder: '/Users/me/DATA/other' })).refused, /another project/)
})

test('the hub tool fabric.access.request takes the folder and passes it through to Fabric\'s resolution', async () => {
  const { hubServerFor } = await import(path.resolve(import.meta.dirname, '../src/main/hubTools.ts'))
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js')
  const h = harness()
  const server = hubServerFor({ kind: 'door' }, { access: h.service })
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 't', version: '1' })
  await Promise.all([server.connect(a), client.connect(b)])
  const r = await client.callTool({ name: 'fabric.access.request', arguments: { ...ask, folder: '/Users/me/DATA/site' } })
  assert.equal(r.isError, undefined, JSON.stringify(r.structuredContent))
  assert.equal(h.appended.find((e) => e.type === 'access.requested@1').payload.registry.project.how, 'exact')
  const tooLong = await client.callTool({ name: 'fabric.access.request', arguments: { ...ask, folder: '/' + 'x'.repeat(4096) } })
  assert.equal(tooLong.isError, true)
  await client.close()
})

test('a catalogue runner whose program is not on this computer is refused before any prompt', async () => {
  const h = harness({ available: async (key) => key !== 'claude-code' })
  const r = await h.service.request({ kind: 'door' }, ask)
  assert.equal(r.ok, false)
  assert.match(r.refused, /not installed on this computer/)
  assert.equal(h.presented.length, 0)
})

test('without the enrollment dependency every enrollment ask is refused', async () => {
  const h = harness({ runner: () => null })
  const r = await h.service.request({ kind: 'door' }, ask)
  assert.equal(r.ok, false)
  assert.equal(h.presented.length, 0)
})

test('the access overview names each enrollment grant\'s own project — an incremental grant on a second project too', async () => {
  const { memStore } = await import('./helpers/access-memstore.mjs')
  const { askLines } = await import(path.resolve(import.meta.dirname, '../src/shared/access.ts'))
  const store = memStore()
  const service = new AccessService({
    store, registry: { refresh() {}, resolve() { return { ok: false, reason: 'none' } } }, present: () => {}, connected: async () => true,
    enrollment: { runner: (id) => (id === 'claude-code' ? { key: id, name: 'Claude Code', summary: null } : null), project: async (id) => (id === PROJECT || id === OTHER ? { id, name: id === PROJECT ? 'site' : 'other' } : null), resolve: resolveFolder }
  })
  const op = { kind: 'operator', id: 'op' }
  const first = await service.request({ kind: 'door' }, { ...ask, folder: '/Users/me/DATA/site' })
  await service.decide(first.requestId, 'allowed', op)
  const binding = await service.authenticate((await service.status({ kind: 'door' }, first.requestId, first.pollSecret)).credential)
  const more = await service.request({ kind: 'binding', binding }, { ...ask, resources: [`project:${OTHER}`], folder: '/Users/me/DATA/other' })
  await service.decide(more.requestId, 'allowed', op)
  const [b] = (await service.overview()).bindings
  const names = b.grants.map((g) => askLines({ capabilities: [g.capability], resources: [g.resource], registry: g.registry ?? b.registry })[0].project.name).sort()
  assert.deepEqual(names, ['other', 'site'])
})

// ADR-0149 §2: board.respond — asked of Fabric itself by a coding agent of the catalogue or a registered service, on
// 1–8 capabilities of one existing Project; anything else is refused before any prompt.
const respondAsk = (agentId = 'claude-code', resources = [`board:${PROJECT}/analytics.retention`]) =>
  ({ agentId, callee: 'fabric', capabilities: ['board.respond'], resources, reason: 'I answer the analytics requests of this project' })
function respondHarness() {
  const rows = new Map(), appended = [], presented = []
  const store = {
    requests: async () => [], countRequests: async () => 0,
    append: async (type, actor, payload) => { appended.push({ type, payload }); rows.set(payload.id, { ...payload, status: 'pending' }); return appended.length },
    request: async (id) => rows.get(id) ?? null
  }
  const service = new AccessService({
    store,
    registry: { refresh() {}, resolve: (id) => (id === 'example-agent' ? { ok: true, entry: { key: 'example-agent', kind: 'service', name: 'Example agent', installedBy: 'example-installer', repository: null, summary: null } } : { ok: false, reason: `${id} is not registered` }) },
    present: (r) => presented.push(r),
    connected: async () => { throw Error('Fabric itself is not a product to connect') },
    enrollment: { runner: (id) => (id === 'claude-code' ? { key: 'claude-code', name: 'Claude Code', summary: null } : null), project: async (id) => (id === PROJECT ? { id, name: 'site' } : null), available: async () => true, resolve: resolveFolder }
  })
  return { service, appended, presented }
}

test('board.respond: a coding agent or a registered service asks once, with the project named in the snapshot', async () => {
  for (const [agentId, kind] of [['claude-code', 'runner'], ['example-agent', 'service']]) {
    const h = respondHarness()
    const r = await h.service.request({ kind: 'door' }, respondAsk(agentId))
    assert.equal(r.ok, true, JSON.stringify(r))
    const ev = h.appended.find((e) => e.type === 'access.requested@1')
    assert.deepEqual([ev.payload.capabilities, ev.payload.resources], [['board.respond'], [`board:${PROJECT}/analytics.retention`]])
    assert.equal(ev.payload.registry.kind, kind); assert.deepEqual(ev.payload.registry.project, { id: PROJECT, name: 'site', root: null, how: null })
    assert.equal(h.presented.length, 1); assert.equal(h.presented[0].connected, true)
  }
})

test('board.respond: an unknown agent, an unknown project, a folder or a second project is refused before any prompt', async () => {
  const cases = [
    [respondAsk('nobody-here'), /neither a coding agent/],
    [respondAsk('claude-code', [`board:${OTHER}/analytics.retention`]), /not one of this Fabric/],
    [{ ...respondAsk(), folder: '/Users/me/DATA/site' }, /folder belongs to a session\.enroll ask/],
    [respondAsk('claude-code', [`board:${PROJECT}/a.x`, `board:${OTHER}/a.x`]), /one ask names one project/]
  ]
  for (const [a, why] of cases) {
    const h = respondHarness()
    const r = await h.service.request({ kind: 'door' }, a)
    assert.equal(r.ok, false); assert.match(r.refused, why)
    assert.equal(h.presented.length, 0); assert.equal(h.appended.length, 0)
  }
})
