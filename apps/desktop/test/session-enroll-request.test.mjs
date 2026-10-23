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

function harness({ keptOut = undefined, runner = (id) => (id === 'claude-code' ? { key: 'claude-code', name: 'Claude Code', summary: 'a coding agent' } : null), project = async (id) => (id === PROJECT || id === OTHER ? { id, name: id === PROJECT ? 'site' : 'other' } : null), available = async () => true, resolve = resolveFolder, admit = undefined } = {}) {
  const rows = new Map(), bindings = new Map(), grants = new Map()
  const appended = []
  const presented = []
  const matching = (r, f = {}) => (!f.status || r.status === f.status) && (!f.agentId || r.agent_id === f.agentId) &&
    (!f.callee || r.callee === f.callee) && (!f.liveAt || Date.parse(r.expires_at) > Date.parse(f.liveAt)) &&
    (!f.standingOnly || r.denial_cleared_at === null)
  const store = {
    requests: async (f) => [...rows.values()].filter((r) => matching(r, f)),
    countRequests: async (f) => [...rows.values()].filter((r) => matching(r, f)).length,
    binding: async (id) => bindings.get(id) ?? null,
    bindingByVerifier: async (verifier) => [...bindings.values()].find((b) => b.verifier === verifier) ?? null,
    liveBindings: async () => [...bindings.values()].filter((b) => b.revoked_at === null),
    grants: async (f = {}) => [...grants.values()].filter((g) => (!f.bindingId || g.binding_id === f.bindingId) &&
      (!f.requestId || g.request_id === f.requestId) && (!(f.unrevoked || f.liveAt) || g.revoked_at === null) &&
      (!f.liveAt || Date.parse(g.expires_at) > Date.parse(f.liveAt))),
    grant: async (id) => grants.get(id) ?? null,
    append: async (type, actor, payload) => {
      appended.push({ type, actor, payload })
      if (type === 'access.requested@1') rows.set(payload.id, { ...payload, asked_by_binding: payload.binding_id, status: 'pending', decided_at: null, granted_binding_id: null, credential_claimed_at: null, denial_cleared_at: null })
      else if (type === 'access.decided@1') {
        const row = rows.get(payload.request_id)
        row.status = payload.decision
        row.decided_at = new Date().toISOString()
        if (payload.decision === 'allowed') {
          row.granted_binding_id = payload.binding_id
          if (payload.new_binding) bindings.set(payload.binding_id, { id: payload.binding_id, agent_id: row.agent_id, request_id: row.id, verifier: null, created_at: row.decided_at, claimed_at: null, revoked_at: null })
          for (const g of payload.grants) grants.set(g.id, { ...g, binding_id: payload.binding_id, request_id: row.id, agent_id: row.agent_id, callee: row.callee, decided_at: row.decided_at, revoked_at: null })
        }
      } else if (type === 'access.credential.claimed@1') {
        const binding = bindings.get(payload.binding_id)
        binding.verifier = payload.verifier
        binding.claimed_at = new Date().toISOString()
      } else if (type === 'access.grant.revoked@1') grants.get(payload.grant_id).revoked_at = new Date().toISOString()
      else if (type === 'access.binding.revoked@1') bindings.get(payload.binding_id).revoked_at = new Date().toISOString()
      else if (type === 'access.denial.cleared@1') rows.get(payload.request_id).denial_cleared_at = new Date().toISOString()
      return appended.length
    },
    request: async (id) => rows.get(id) ?? null
  }
  const service = new AccessService({
    store,
    registry: { refresh() { throw Error('an enrollment ask must not read the service registry') }, resolve() { throw Error('nor resolve in it') } },
    present: (r) => presented.push(r),
    connected: async () => { throw Error('Fabric itself is not a product to connect') },
    enrollment: { runner, project, available, resolve, admit },
    ...(keptOut ? { keptOut } : {})
  })
  return { service, appended, presented, rows }
}

test('on the operator\'s own machine a coding agent is allowed at once, recorded as its own reversible act', async () => {
  const h = harness()
  const r = await h.service.request({ kind: 'door' }, ask)
  assert.equal(r.ok, true)
  assert.equal(r.status, 'allowed')
  assert.match(r.pollSecret, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(h.presented.length, 0, 'ADR-0160 removes the enrollment prompt, not the journal or revocation')
  const requested = h.appended.find((e) => e.type === 'access.requested@1')
  assert.deepEqual([requested.payload.agent_id, requested.payload.callee, requested.payload.capabilities, requested.payload.resources], ['claude-code', 'fabric', ['session.enroll'], [`project:${PROJECT}`]])
  assert.equal(requested.payload.registry.kind, 'runner')
  const decided = h.appended.find((e) => e.type === 'access.decided@1')
  assert.deepEqual(decided.actor, { kind: 'agent', id: 'claude-code' })
  const claimed = await h.service.status({ kind: 'door' }, r.requestId, r.pollSecret)
  assert.equal(claimed.status, 'allowed')
  assert.match(claimed.credential, /^[A-Za-z0-9_-]{43}$/)
})

test('an unknown eligible Git folder is admitted through the canonical service before the local allow', async () => {
  const admitted = []
  const h = harness({
    resolve: async (folder) => ({ ok: true, projectId: PROJECT, root: '/Users/me/DATA/new', real: folder, how: 'create', projectName: 'new', candidate: 'create', remoteKey: null }),
    admit: async (resolved, agentId) => { admitted.push({ resolved, agentId }); return { id: PROJECT, name: 'new', root: resolved.root, how: 'exact' } }
  })
  const r = await h.service.request({ kind: 'door' }, { ...ask, folder: '/Users/me/DATA/new' })
  assert.equal(r.status, 'allowed')
  assert.equal(admitted.length, 1)
  assert.equal(admitted[0].agentId, 'claude-code')
  assert.equal(admitted[0].resolved.candidate, 'create')
  assert.equal(h.presented.length, 0)
  assert.equal(h.appended.find((e) => e.type === 'access.decided@1').payload.grants[0].resource, `project:${PROJECT}`)
})

test('a standing denial is checked before any project admission write', async () => {
  const admitted = []
  const h = harness({
    resolve: async (folder) => ({ ok: true, projectId: PROJECT, root: '/Users/me/DATA/new', real: folder, how: 'create', projectName: 'new', candidate: 'create', remoteKey: null }),
    admit: async (resolved) => { admitted.push(resolved); return { id: PROJECT, name: 'new', root: resolved.root, how: 'exact' } }
  })
  const first = await h.service.request({ kind: 'door' }, { ...ask, folder: '/Users/me/DATA/new' })
  h.rows.get(first.requestId).status = 'denied'
  const again = await h.service.request({ kind: 'door' }, { ...ask, folder: '/Users/me/DATA/new' })
  assert.equal(again.status, 'denied')
  assert.equal(admitted.length, 1, 'the denied retry never calls admission again')
  assert.equal(h.presented.length, 0)
})

// ADR-0160 §3, SCN-167 (0.3.7 wave 3): «Отключить» keeps the agent out of EVERY project until the person lets it back
// in. The kept-out set is read before admission, so a disconnected agent cannot create or attach a project either.
test('a coding agent the person disconnected stays out of every project, before any admission write, until let back in', async () => {
  const out = new Set(['claude-code'])
  const admitted = []
  const h = harness({
    keptOut: (key) => out.has(key),
    resolve: async (folder) => ({ ok: true, projectId: PROJECT, root: '/Users/me/DATA/new', real: folder, how: 'create', projectName: 'new', candidate: 'create', remoteKey: null }),
    admit: async (resolved) => { admitted.push(resolved); return { id: PROJECT, name: 'new', root: resolved.root, how: 'exact' } }
  })
  const refused = await h.service.request({ kind: 'door' }, { ...ask, folder: '/Users/me/DATA/new' })
  assert.equal(refused.ok, false)
  assert.match(refused.refused, /disconnected/)
  assert.equal(admitted.length, 0, 'a kept-out agent never reaches admission')
  assert.equal(h.appended.length, 0, 'nothing is journalled for a kept-out ask')
  out.delete('claude-code')
  const back = await h.service.request({ kind: 'door' }, { ...ask, folder: '/Users/me/DATA/new' })
  assert.equal(back.status, 'allowed')
  assert.equal(admitted.length, 1)
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
  const first = await service.request({ kind: 'door' }, { ...ask, folder: '/Users/me/DATA/site' })
  const binding = await service.authenticate((await service.status({ kind: 'door' }, first.requestId, first.pollSecret)).credential)
  await service.request({ kind: 'binding', binding }, { ...ask, resources: [`project:${OTHER}`], folder: '/Users/me/DATA/other' })
  const [b] = (await service.overview()).bindings
  const names = b.grants.map((g) => askLines({ capabilities: [g.capability], resources: [g.resource], registry: g.registry ?? b.registry })[0].project.name).sort()
  assert.deepEqual(names, ['other', 'site'])
})

// ADR-0149 §2: board.respond — asked of Fabric itself by a coding agent of the catalogue or a registered service, on
// 1–8 capabilities of one existing Project; anything else is refused before any prompt.
const respondAsk = (agentId = 'claude-code', resources = [`board:${PROJECT}/analytics.retention`]) =>
  ({ agentId, callee: 'fabric', capabilities: ['board.respond'], resources, reason: 'I answer the analytics requests of this project' })
function respondHarness({ keptOut = undefined } = {}) {
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
    enrollment: { runner: (id) => (id === 'claude-code' ? { key: 'claude-code', name: 'Claude Code', summary: null } : null), project: async (id) => (id === PROJECT ? { id, name: 'site' } : null), available: async () => true, resolve: resolveFolder },
    ...(keptOut ? { keptOut } : {})
  })
  return { service, appended, presented }
}

test('board.respond: an agent the person disconnected is refused before any prompt, a coding agent and a service alike (CO-347)', async () => {
  for (const agentId of ['claude-code', 'example-agent']) {
    const h = respondHarness({ keptOut: (key) => key === agentId })
    const r = await h.service.request({ kind: 'door' }, respondAsk(agentId))
    assert.equal(r.ok, false)
    assert.match(r.refused, /disconnected/)
    assert.equal(h.presented.length, 0, 'nothing reached the person')
    assert.equal(h.appended.some((e) => e.type === 'access.requested@1'), false)
  }
})

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

test('0.3.8 review i3 ER-4: a coding agent that is not installed records no project.resolve grant as its own act', async () => {
  const h = harness({ available: async () => false })
  const r = await h.service.request({ kind: 'door' }, { agentId: 'claude-code', callee: 'fabric', capabilities: ['project.resolve'], resources: ['projects'], reason: 'attribute folders' })
  assert.equal(r.ok, false)
  assert.match(r.refused, /not installed/)
  assert.equal(h.appended.length, 0, 'nothing was journalled')
  const ok = await harness().service.request({ kind: 'door' }, { agentId: 'claude-code', callee: 'fabric', capabilities: ['project.resolve'], resources: ['projects'], reason: 'attribute folders' })
  assert.equal(ok.status, 'allowed')
})
