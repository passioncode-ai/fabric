// `fabric.session.enroll` (ADR-0134 §2): a live grant on the resolved project mints a session like a launched
// one and journals it; no grant, no project or a bad folder are typed answers. A revocation of the grant or of the
// binding ends the sessions minted under it (§3), a mint the journal refused does not stay usable, and an enroll in
// a loop neither grows the surface nor the journal (ADR-0134 amendment 2). Pure — injected store, except the
// revocation tests, which drive the real AccessService (in-memory store) and the real AgentSurface.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { memStore } from './helpers/access-memstore.mjs'

const SRC = path.resolve(import.meta.dirname, '../src/main')
const { enrollSession, EnrolledSessions, MAX_ENROLLED_PER_BINDING } = await import(path.join(SRC, 'sessionEnroll.ts'))
const { AccessService } = await import(path.join(SRC, 'accessService.ts'))
const { AgentSurface } = await import(path.join(SRC, 'agentSurface.ts'))

const P = '0b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d'
const binding = { id: 'b-1', agent_id: 'claude-code', revoked_at: null }
const grant = (over = {}) => ({ id: 'g-1', callee: 'fabric', capability: 'session.enroll', resource: `project:${P}`, revoked_at: null, expires_at: new Date(Date.now() + 86400000).toISOString(), ...over })

/** A fake surface: bearers it holds, with their state; `end` drops one, as AgentSurface.revokeSession does, and keeps
 *  the reason it was given; `signs` is each session's last call (AgentSurface.sessionSign); `drop` revokes one bearer. */
function fakeSurface() {
  const held = new Map() // bearer -> { sessionId, state }
  const signs = new Map() // sessionId -> last call
  const why = new Map() // sessionId -> the reason it was ended with
  let n = 0
  return {
    held, signs, why,
    mint: (projectId, sessionId) => { const token = `T${++n}`.padEnd(32, 'x'); held.set(token, { sessionId, state: 'unclaimed' }); return { token } },
    end: (sessionId, reason) => { why.set(sessionId, reason ?? null); for (const [t, v] of held) if (v.sessionId === sessionId) held.delete(t) },
    drop: (token) => { held.delete(token) },
    state: (token) => held.get(token)?.state ?? null,
    lastSign: (sessionId) => signs.get(sessionId) ?? null,
    claimAll: () => { for (const v of held.values()) v.state = 'claimed' }
  }
}

function deps(over = {}) {
  const minted = [], journaled = []
  const surface = fakeSurface()
  const sessions = new EnrolledSessions({ end: surface.end, state: surface.state, lastSign: surface.lastSign, drop: surface.drop })
  return {
    minted, journaled, surface, sessions,
    d: {
      liveGrants: async () => [grant()],
      admittedFolders: async () => [{ projectId: P, path: '/Users/me/DATA/site' }],
      projectName: async () => 'site',
      realpath: (f) => f,
      mint: (projectId, sessionId, taskId) => { minted.push({ projectId, sessionId, taskId }); return surface.mint(projectId, sessionId) },
      sessions,
      stillLive: async () => true,
      journal: async (type, projectId, payload) => { journaled.push({ type, projectId, payload }) },
      gitCommonDir: async () => null,
      ...over
    }
  }
}

test('a live grant on the folder\'s project mints one session for that project, no task, and journals it', async () => {
  const h = deps()
  const r = await enrollSession(binding, { cwd: '/Users/me/DATA/site/src', runtimeSessionId: 'abc-123' }, h.d)
  assert.equal(r.ok, true)
  assert.equal(r.session.projectId, P)
  assert.equal(r.session.how, 'ancestor')
  assert.deepEqual(h.minted.map((m) => [m.projectId, m.taskId]), [[P, null]])
  assert.equal(h.journaled[0].type, 'session.enrolled@1')
  assert.equal(h.journaled[0].payload.runner, 'claude-code')
  assert.equal(h.journaled[0].payload.grant_id, 'g-1')
  assert.equal(h.journaled[0].payload.runtime_session_id, 'abc-123')
  assert.equal(JSON.stringify(h.journaled).includes('/Users/me'), false, 'the folder itself is not journalled')
  assert.equal(h.sessions.size(), 1, 'the session is registered under its binding and grant')
})

test('no grant, a revoked grant, an expired grant or a grant on another project: needs-grant, nothing minted', async () => {
  for (const grants of [[], [grant({ revoked_at: 'x' })], [grant({ expires_at: new Date(Date.now() - 1).toISOString() })], [grant({ resource: 'project:1b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d' })], [grant({ capability: 'agent.call' })]]) {
    const h = deps({ liveGrants: async () => grants })
    const r = await enrollSession(binding, { cwd: '/Users/me/DATA/site' }, h.d)
    assert.deepEqual([r.ok, r.code, r.resource], [false, 'needs-grant', `project:${P}`])
    assert.equal(h.minted.length, 0)
    assert.equal(h.journaled.length, 0)
  }
})

test('a folder no project holds: no-project, with what to do in Fabric\'s own words', async () => {
  const h = deps()
  const r = await enrollSession(binding, { cwd: '/Users/me/elsewhere' }, h.d)
  assert.deepEqual([r.ok, r.code], [false, 'no-project'])
  assert.match(r.message, /\+ Project → Open a project/)
  // Said as the person's step: an agent told "open it in Fabric" could take it as its own (attach the folder, create
  // a project), which the project board rule forbids — the R-010 real client read this sentence back verbatim.
  assert.match(r.message, /the person's step/)
  assert.match(r.message, /never create a project or attach a folder yourself/)
})

test('a relative, missing or non-string folder: bad-folder, said of this computer', async () => {
  for (const cwd of ['relative', 42, undefined]) assert.equal((await enrollSession(binding, { cwd }, deps().d)).code, 'bad-folder')
  const gone = await enrollSession(binding, { cwd: '/gone' }, deps({ realpath: () => null }).d)
  assert.equal(gone.code, 'bad-folder')
  assert.match(gone.message, /this computer/)
  assert.doesNotMatch(gone.message, /Mac/)
})

test('through the door (no binding) the folder\'s project is named, never a session', async () => {
  const h = deps()
  const r = await enrollSession(null, { cwd: '/Users/me/DATA/site' }, h.d)
  assert.deepEqual([r.ok, r.code, r.projectName], [false, 'needs-grant', 'site'])
  assert.equal(h.minted.length, 0)
})

test('the read-then-mint race: a grant found revoked when read again after the mint ends the session — needs-grant', async () => {
  const h = deps({ stillLive: async () => false })
  const r = await enrollSession(binding, { cwd: '/Users/me/DATA/site' }, h.d)
  assert.deepEqual([r.ok, r.code], [false, 'needs-grant'])
  assert.equal(h.minted.length, 1, 'it was minted')
  assert.equal(h.surface.held.size, 0, 'and its bearer is gone again')
  assert.equal(h.sessions.size(), 0)
  assert.equal(h.journaled.length, 0, 'nothing journalled for a session that never stood')
})

test('mint then journal: a journal that refuses the event takes the minted session with it, and the failure is thrown', async () => {
  const h = deps({ journal: async () => { throw new Error('the journal refused session.enrolled@1') } })
  await assert.rejects(() => enrollSession(binding, { cwd: '/Users/me/DATA/site' }, h.d), /journal refused/)
  assert.equal(h.minted.length, 1)
  assert.equal(h.surface.held.size, 0, 'no usable bearer the journal does not know of')
  assert.equal(h.sessions.size(), 0)
})

test('a loop of 200 enrolls hands out the one unspent bearer: one mint, one journal event, one credential', async () => {
  const h = deps()
  const bearers = new Set()
  for (let i = 0; i < 200; i++) {
    const r = await enrollSession(binding, { cwd: '/Users/me/DATA/site' }, h.d)
    assert.equal(r.ok, true)
    bearers.add(r.session.bearer)
  }
  assert.equal(bearers.size, 1)
  assert.equal(h.minted.length, 1)
  assert.equal(h.journaled.length, 1)
  assert.equal(h.surface.held.size, 1)
})

test('a loop that spends every bearer is capped: the binding keeps at most MAX_ENROLLED_PER_BINDING live sessions, the oldest end', async () => {
  const h = deps()
  const first = await enrollSession(binding, { cwd: '/Users/me/DATA/site' }, h.d)
  for (let i = 0; i < 199; i++) {
    h.surface.claimAll()
    assert.equal((await enrollSession(binding, { cwd: '/Users/me/DATA/site' }, h.d)).ok, true)
  }
  assert.ok(h.surface.held.size <= MAX_ENROLLED_PER_BINDING, `the surface holds ${h.surface.held.size}`)
  assert.equal(h.sessions.size(), h.surface.held.size)
  assert.equal(h.surface.state(first.session.bearer), null, 'the oldest session was ended')
})

test('past the cap the least recently active session ends, never one that called within the renewal window while an idle one exists, and it is told why (0.3.5 review i2 ER-4)', async () => {
  let now = 1_000_000
  const h = deps({ now: () => now })
  const ids = []
  for (let i = 0; i < MAX_ENROLLED_PER_BINDING; i++) {
    now += 60_000
    const r = await enrollSession(binding, { cwd: '/Users/me/DATA/site' }, h.d)
    ids.push(r.session.sessionId)
    h.surface.claimAll()
  }
  // The FIRST minted is the long-running agent still at work: it called a minute ago. The others exited long since.
  now += 30 * 60_000
  h.surface.signs.set(ids[0], now - 60_000)
  for (let i = 1; i < ids.length; i++) h.surface.signs.set(ids[i], 1_000_000 + i * 60_000 + 5_000)
  const ninth = await enrollSession(binding, { cwd: '/Users/me/DATA/site' }, h.d)
  assert.equal(ninth.ok, true)
  assert.equal(h.surface.why.has(ids[0]), false, 'the live session is kept')
  assert.equal(h.surface.why.has(ids[1]), true, 'the session idle the longest ended')
  assert.equal(h.surface.why.size, 1, 'one, to make room for one')
  assert.match(h.surface.why.get(ids[1]), /least recently active/)
  assert.match(h.surface.why.get(ids[1]), /claims were released/)
  assert.doesNotMatch(h.surface.why.get(ids[1]), /restart/i)
  // A session with no call at all counts from its mint: the next to go is ids[2], still not the live one.
  h.surface.claimAll()
  await enrollSession(binding, { cwd: '/Users/me/DATA/site' }, h.d)
  assert.equal(h.surface.why.has(ids[2]), true)
  assert.equal(h.surface.why.has(ids[0]), false)
})

test('the session hooks\' rejoins hold at most one bearer per session: an unspent one is handed out again, a spent one is replaced (0.3.5 review i2 ER-5)', async () => {
  const h = deps()
  const first = await enrollSession(binding, { cwd: '/Users/me/DATA/site', runtimeSessionId: 'rt-1' }, h.d)
  h.surface.claimAll()
  const bearers = new Set()
  for (let i = 0; i < 50; i++) {
    const r = await enrollSession(binding, { cwd: '/Users/me/DATA/site', runtimeSessionId: 'rt-1', rejoinOnly: true }, h.d)
    assert.equal(r.ok, true)
    assert.equal(r.session.sessionId, first.session.sessionId)
    bearers.add(r.session.bearer)
    assert.ok(h.surface.held.size <= 2, `the surface holds ${h.surface.held.size} bearers for one session`)
    // Every other turn the hook's client spends its bearer before the next turn comes.
    if (i % 2 === 1) h.surface.claimAll()
  }
  assert.equal(h.surface.state(first.session.bearer), 'claimed', 'the agent\'s own bearer is never touched')
  assert.equal(h.minted.length, 1 + 25, 'a new bearer only after the last one was spent')
  assert.equal(bearers.size, 25)
  assert.equal(h.journaled.length, 1)
})

// --- revocation, with the real AccessService and AgentSurface ---------------------------------------------------

async function enrolledWorld() {
  const store = memStore()
  const access = new AccessService({
    store,
    registry: { refresh() {}, resolve() { return { ok: false, reason: 'none' } } },
    present: () => {}, connected: async () => true,
    enrollment: { runner: (id) => (id === 'claude-code' ? { key: id, name: 'Claude Code', summary: null } : null), project: async (id) => (id === P ? { id, name: 'site' } : null) }
  })
  const ask = await access.request({ kind: 'door' }, { agentId: 'claude-code', callee: 'fabric', capabilities: ['session.enroll'], resources: [`project:${P}`], reason: 'work here' })
  assert.equal((await access.decide(ask.requestId, 'allowed', { kind: 'operator', id: 'op' })).ok, true)
  const st = await access.status({ kind: 'door' }, ask.requestId, ask.pollSecret)
  const b = await access.authenticate(st.credential)
  const surface = new AgentSurface({ db: null, journal: null, ptys: () => undefined, estateId: 'e' })
  await surface.start()
  const sessions = new EnrolledSessions({ end: (id) => surface.revokeSession(id), state: (t) => surface.credentialState(t) })
  access.onGrantRevoked((grantId) => sessions.endForGrant(grantId))
  access.onBindingRevoked((bindingId) => sessions.endForBinding(bindingId))
  const d = {
    liveGrants: (x) => access.liveGrantsOf(x),
    admittedFolders: async () => [{ projectId: P, path: '/Users/me/DATA/site' }],
    projectName: async () => 'site', realpath: (f) => f, gitCommonDir: async () => null,
    mint: (projectId, sessionId, taskId) => surface.mint(projectId, sessionId, taskId),
    sessions, stillLive: (bid, gid) => access.enrollmentLive(bid, gid),
    journal: async () => {}
  }
  const call = async (bearer) => {
    const r = await fetch(`${surface.origin}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } }) })
    return { status: r.status, text: await r.text() }
  }
  return { access, surface, sessions, binding: b, d, call }
}

test('revoking the grant ends the enrolled session: its bearer is refused on the next call, and the next enroll answers needs-grant', async (t) => {
  const w = await enrolledWorld()
  t.after(() => w.surface.stop())
  const r = await enrollSession(w.binding, { cwd: '/Users/me/DATA/site' }, w.d)
  assert.equal(r.ok, true)
  assert.equal(w.surface.credentialState(r.session.bearer), 'unclaimed')
  const [g] = (await w.access.liveGrantsOf(w.binding)).filter((x) => x.capability === 'session.enroll')
  assert.equal((await w.access.revokeGrant(g.id, { kind: 'operator', id: 'op' })).ok, true)
  assert.equal(w.surface.credentialState(r.session.bearer), null)
  const next = await w.call(r.session.bearer)
  assert.equal(next.status, 401)
  assert.match(next.text, /unknown or revoked credential/)
  const again = await enrollSession(w.binding, { cwd: '/Users/me/DATA/site' }, w.d)
  assert.deepEqual([again.ok, again.code], [false, 'needs-grant'])
})

test('revoking the binding ends the enrolled session: its bearer is refused on the next call, and the next enroll answers needs-grant', async (t) => {
  const w = await enrolledWorld()
  t.after(() => w.surface.stop())
  const r = await enrollSession(w.binding, { cwd: '/Users/me/DATA/site' }, w.d)
  assert.equal(r.ok, true)
  assert.equal((await w.access.revokeBinding(w.binding.id, { kind: 'operator', id: 'op' })).ok, true)
  assert.equal((await w.call(r.session.bearer)).status, 401)
  const again = await enrollSession(w.binding, { cwd: '/Users/me/DATA/site' }, w.d)
  assert.deepEqual([again.ok, again.code], [false, 'needs-grant'])
})

test('a revocation that lands between the mint and the re-read: the minted bearer never stands', async (t) => {
  const w = await enrolledWorld()
  t.after(() => w.surface.stop())
  const [g] = (await w.access.liveGrantsOf(w.binding)).filter((x) => x.capability === 'session.enroll')
  let minted = null
  const d = {
    ...w.d,
    mint: (...a) => (minted = w.d.mint(...a)),
    // The operator revokes while the enrollment awaits its re-read.
    stillLive: async (bid, gid) => { await w.access.revokeGrant(g.id, { kind: 'operator', id: 'op' }); return w.access.enrollmentLive(bid, gid) }
  }
  const r = await enrollSession(w.binding, { cwd: '/Users/me/DATA/site' }, d)
  assert.deepEqual([r.ok, r.code], [false, 'needs-grant'])
  assert.equal(w.surface.credentialState(minted.token), null)
  assert.equal((await w.call(minted.token)).status, 401)
})

// An MCP client that leaves says so (DELETE with its bearer and mcp-session-id, 0.3.5 review i2 ER-4): an enrolled
// session ends then, and its claims are released; a rejoin's bearer leaving takes only itself.
async function initialize(surface, bearer) {
  const r = await fetch(`${surface.origin}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } }) })
  await r.text()
  return r.headers.get('mcp-session-id')
}
const leave = (surface, bearer, mcpSessionId) => fetch(`${surface.origin}/mcp`, { method: 'DELETE', headers: { authorization: `Bearer ${bearer}`, ...(mcpSessionId ? { 'mcp-session-id': mcpSessionId } : {}) } })

test('an enrolled agent that leaves (DELETE) ends its session and its claims go; a rejoin bearer that leaves takes only itself (0.3.5 review i2 ER-4)', async (t) => {
  const ended = []
  const surface = new AgentSurface({ db: null, journal: null, ptys: () => undefined, estateId: 'e', onSessionEnded: async (id, why) => { ended.push([id, why]) } })
  await surface.start()
  t.after(() => surface.stop())
  const sessions = new EnrolledSessions({ end: (id, why) => surface.revokeSession(id, why), state: (tok) => surface.credentialState(tok), lastSign: (id) => surface.sessionSign(id)?.lastSignAt ?? null, drop: (tok) => surface.revokeCredential(tok) })
  const d = { ...deps().d, sessions, mint: (p, s, task, origin) => surface.mint(p, s, task, origin) }
  const first = await enrollSession(binding, { cwd: '/Users/me/DATA/site', runtimeSessionId: 'rt-1' }, d)
  const mcp = await initialize(surface, first.session.bearer)
  assert.ok(mcp)
  const hook = await enrollSession(binding, { cwd: '/Users/me/DATA/site', runtimeSessionId: 'rt-1', rejoinOnly: true }, d)
  const hookMcp = await initialize(surface, hook.session.bearer)
  // A leave without the session's handshake id is refused and ends nothing.
  assert.equal((await leave(surface, first.session.bearer, null)).status, 401)
  assert.equal(surface.credentialState(first.session.bearer), 'claimed')
  // The hook's client leaves: its bearer goes, the session stays.
  assert.equal((await leave(surface, hook.session.bearer, hookMcp)).status, 200)
  assert.equal(surface.credentialState(hook.session.bearer), null)
  assert.equal(surface.credentialState(first.session.bearer), 'claimed')
  assert.deepEqual(ended, [])
  // The agent's own client leaves: the session ends, its claims are released through the session-end hook.
  assert.equal((await leave(surface, first.session.bearer, mcp)).status, 200)
  assert.equal(surface.credentialState(first.session.bearer), null)
  assert.equal(surface.heldSessions().length, 0)
  assert.deepEqual(ended, [[first.session.sessionId, 'ended']])
  assert.equal(sessions.liveOf(binding.id).length, 0)
})

test('an evicted session\'s next call is told it was evicted and that its claims were released, not that Fabric restarted (0.3.5 review i2 ER-4)', async (t) => {
  const surface = new AgentSurface({ db: null, journal: null, ptys: () => undefined, estateId: 'e' })
  await surface.start()
  t.after(() => surface.stop())
  const sessions = new EnrolledSessions({ end: (id, why) => surface.revokeSession(id, why), state: (tok) => surface.credentialState(tok), lastSign: (id) => surface.sessionSign(id)?.lastSignAt ?? null, drop: (tok) => surface.revokeCredential(tok) })
  const d = { ...deps().d, sessions, maxSessionsPerBinding: 1, mint: (p, s, task, origin) => surface.mint(p, s, task, origin) }
  const first = await enrollSession(binding, { cwd: '/Users/me/DATA/site' }, d)
  const mcp = await initialize(surface, first.session.bearer)
  assert.ok(mcp)
  await enrollSession(binding, { cwd: '/Users/me/DATA/site' }, d)
  const r = await fetch(`${surface.origin}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${first.session.bearer}`, 'mcp-session-id': mcp, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) })
  assert.equal(r.status, 401)
  const body = await r.json()
  assert.match(body.error, /least recently active/)
  assert.match(body.error, /claims were released/)
})

test('a bearer minted and never presented does not stay: the next mint sweeps the ones past their claim window (0.3.5 review i2 ER-5)', () => {
  let now = 1_000_000
  const surface = new AgentSurface({ db: null, journal: null, ptys: () => undefined, estateId: 'e', now: () => now })
  for (let i = 0; i < 20; i++) surface.mint(P, 'dead-hook-' + i, null)
  assert.equal(surface.credentialCount(), 20)
  now += 10 * 60_000
  surface.mint(P, 'next', null)
  assert.equal(surface.credentialCount(), 1, 'only the fresh one is held')
})

// D2 (fabric-agent-adapter#53): the session hooks' fabric-mcp joins the session its coding agent already holds.
test('a rejoin joins the live session of that runtime session — the same session, a second bearer, nothing journalled', async () => {
  const h = deps()
  const first = await enrollSession(binding, { cwd: '/Users/me/DATA/site', runtimeSessionId: 'rt-1' }, h.d)
  h.surface.claimAll()
  const again = await enrollSession(binding, { cwd: '/Users/me/DATA/site/src', runtimeSessionId: 'rt-1', rejoinOnly: true }, h.d)
  assert.equal(again.ok, true)
  assert.equal(again.session.sessionId, first.session.sessionId, 'the same Fabric session')
  assert.notEqual(again.session.bearer, first.session.bearer, 'its own bearer: the first is spent by the agent')
  assert.equal(h.journaled.length, 1, 'no second session.enrolled@1')
  assert.equal(h.sessions.size(), 1, 'no second session registered under the binding')
})

test('a rejoin with no live session of that runtime session asks nothing and mints nothing', async () => {
  for (const args of [{ runtimeSessionId: 'rt-other', rejoinOnly: true }, { rejoinOnly: true }]) {
    const h = deps()
    await enrollSession(binding, { cwd: '/Users/me/DATA/site', runtimeSessionId: 'rt-1' }, h.d)
    const r = await enrollSession(binding, { cwd: '/Users/me/DATA/site', ...args }, h.d)
    assert.deepEqual([r.ok, r.code], [false, 'no-session'])
    assert.equal(h.minted.length, 1, 'only the first enrollment minted')
  }
  const door = deps()
  const r = await enrollSession(null, { cwd: '/Users/me/DATA/site', runtimeSessionId: 'rt-1', rejoinOnly: true }, door.d)
  assert.deepEqual([r.ok, r.code], [false, 'no-session'], 'through the door a rejoin is no-session, never needs-grant')
  const revoked = deps()
  await enrollSession(binding, { cwd: '/Users/me/DATA/site', runtimeSessionId: 'rt-1' }, revoked.d)
  revoked.d.stillLive = async () => false
  const gone = await enrollSession(binding, { cwd: '/Users/me/DATA/site', runtimeSessionId: 'rt-1', rejoinOnly: true }, revoked.d)
  assert.deepEqual([gone.ok, gone.code], [false, 'no-session'], 'a grant no longer live joins nothing')
})

test('an enrolled mint tells the surface it is an enrollment, its runner and its runtime session', async () => {
  const origins = []
  const h = deps()
  h.d.mint = (projectId, sessionId, taskId, origin) => { origins.push(origin); return h.surface.mint(projectId, sessionId) }
  await enrollSession(binding, { cwd: '/Users/me/DATA/site', runtimeSessionId: 'rt-9' }, h.d)
  assert.deepEqual(origins, [{ cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-9' }])
})
