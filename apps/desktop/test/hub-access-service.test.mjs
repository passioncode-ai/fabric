// AccessService's rules without a database (verification iteration 1 for 0.3.1): an in-memory store
// that applies the hub's events as migrations 76/77 project them. The stack-backed probes stay
// hub-access-db and hub-door-db; these are the rules a reviewer broke by reasoning, kept in the fast tier.
// #region hub-consent — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#2-an-agent-is-admitted-by-device-style-consent-not-by-a-pasted-key
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { memStore, fakeRegistry } from './helpers/access-memstore.mjs'

const SRC = path.resolve(import.meta.dirname, '../src/main')
const { AccessService } = await import(path.join(SRC, 'accessService.ts'))
const OPERATOR = { kind: 'person', id: 'operator' }
const DOOR = { kind: 'door' }
const ask = (extra = {}) => ({ agentId: 'example-agent', callee: 'fabric-inbox', capabilities: ['read_message'], resources: ['news@example.com'], reason: 'summarise the newsletter', ...extra })

function setup() {
  let clock = Date.parse('2026-10-04T10:00:00Z')
  const store = memStore({ now: () => clock })
  const shown = []
  const access = new AccessService({ store, registry: fakeRegistry(['example-agent', 'other-agent']), present: (p) => shown.push(p), connected: async () => true, now: () => clock })
  return { store, shown, access, tick: (ms) => { clock += ms } }
}

test('ER-2: only the asker that CREATED a request holds its poll secret; an identical ask gets no handle to its status or credential', async () => {
  const { access, shown } = setup()
  const legit = await access.request(DOOR, ask())
  assert.equal(legit.ok, true)
  assert.match(legit.pollSecret ?? '', /^[A-Za-z0-9_-]{43}$/, 'the creating answer carries a poll secret')
  const thief = await access.request(DOOR, ask({ reason: 'anything at all' }))
  assert.equal(thief.ok, true)
  assert.equal(thief.status, 'pending')
  assert.equal(thief.pollSecret, undefined, 'the dedupe answer handed out the poll secret')
  assert.equal(shown.length, 1, 'one prompt for one request')
  assert.deepEqual(await access.decide(legit.requestId, 'allowed', OPERATOR), { ok: true })
  // The thief knows the id (the dedupe told it, or it guessed) and has no secret, or a wrong one.
  for (const secret of [undefined, '', 'x'.repeat(43), thief.pollSecret]) {
    const t = await access.status(DOOR, legit.requestId, secret)
    assert.equal(t.ok, false, `a status read with poll secret ${JSON.stringify(secret)} was answered`)
    assert.equal(t.credential, undefined)
  }
  const l = await access.status(DOOR, legit.requestId, legit.pollSecret)
  assert.equal(l.ok, true)
  assert.match(l.credential, /^[A-Za-z0-9_-]{43}$/, 'the asker that holds the secret collects its credential')
})

test('ER-2: the poll secret is stored only as its hash, in the request event', async () => {
  const { access, store } = setup()
  const r = await access.request(DOOR, ask())
  const ev = store.events.find((e) => e.type === 'access.requested@1')
  assert.match(ev.payload.poll_verifier, /^[0-9a-f]{64}$/)
  assert.ok(!JSON.stringify(ev.payload).includes(r.pollSecret), 'the poll secret itself reached the journal')
})

test('DA-8: an allowed first request keeps listing the grants it gave after an incremental Allow re-grants one of them', async () => {
  const { access, tick } = setup()
  const first = await access.request(DOOR, ask({ capabilities: ['read_message', 'list_messages'] }))
  await access.decide(first.requestId, 'allowed', OPERATOR)
  const claimed = await access.status(DOOR, first.requestId, first.pollSecret)
  const binding = await access.authenticate(claimed.credential)
  tick(60_000)
  const more = await access.request({ kind: 'binding', binding }, ask({ capabilities: ['read_message'] }))
  await access.decide(more.requestId, 'allowed', OPERATOR)
  const again = await access.status(DOOR, first.requestId, first.pollSecret)
  assert.deepEqual(again.grants.map((g) => g.capability).sort(), ['list_messages', 'read_message'], 'the first request stopped listing a grant it still holds')
})

test('ER-12: an Allow whose credential was never collected within the claim window is not listed as an agent with access', async () => {
  const { access, tick } = setup()
  const r = await access.request(DOOR, ask())
  await access.decide(r.requestId, 'allowed', OPERATOR)
  assert.equal((await access.overview()).bindings.length, 1, 'inside the window the allowed agent is listed')
  tick(11 * 60_000)
  assert.equal((await access.overview()).bindings.length, 0, 'a binding that can never be used is listed as live access')
})

test('operator acts answer with a code the window can phrase, and an English reason for the log', async () => {
  const { access, tick } = setup()
  assert.equal((await access.decide('00000000-0000-4000-8000-000000000000', 'allowed', OPERATOR)).code, 'not-found')
  const r = await access.request(DOOR, ask())
  await access.decide(r.requestId, 'denied', OPERATOR)
  const twice = await access.decide(r.requestId, 'allowed', OPERATOR)
  assert.equal(twice.code, 'already-decided')
  assert.equal(typeof twice.reason, 'string')
  const late = await access.request(DOOR, ask({ resources: ['late@example.com'] }))
  tick(11 * 60_000)
  assert.equal((await access.decide(late.requestId, 'allowed', OPERATOR)).code, 'expired')
  assert.equal((await access.revokeGrant('00000000-0000-4000-8000-000000000001', OPERATOR)).code, 'not-live')
  assert.equal((await access.revokeBinding('00000000-0000-4000-8000-000000000002', OPERATOR)).code, 'not-live')
  assert.equal((await access.clearDenial('00000000-0000-4000-8000-000000000003', OPERATOR)).code, 'not-found')
})

test('an incremental request whose asking credential was revoked is refused in plain words, with its code', async () => {
  const { access } = setup()
  const first = await access.request(DOOR, ask())
  await access.decide(first.requestId, 'allowed', OPERATOR)
  const claimed = await access.status(DOOR, first.requestId, first.pollSecret)
  const binding = await access.authenticate(claimed.credential)
  const more = await access.request({ kind: 'binding', binding }, ask({ capabilities: ['list_messages'] }))
  await access.revokeBinding(binding.id, OPERATOR)
  const d = await access.decide(more.requestId, 'allowed', OPERATOR)
  assert.equal(d.code, 'asking-binding-revoked')
  assert.doesNotMatch(d.reason, /door token/, 'the operator is told about a door token')
})
// #endregion hub-consent

// DA-3 (verification iteration 2 for 0.3.1): a revoked binding's agent.call memory is dropped at once —
// the access service tells its listeners after the revocation is recorded.
test('DA-3: revoking a binding tells the agent.call memory, after the revocation is recorded', async () => {
  const { access, store } = setup()
  const asked = await access.request(DOOR, ask())
  await access.decide(asked.requestId, 'allowed', OPERATOR)
  const bindingId = (await access.status(DOOR, asked.requestId, asked.pollSecret)).bindingId
  const told = []
  access.onBindingRevoked((id) => told.push({ id, journalled: store.events.some((e) => e.type === 'access.binding.revoked@1') }))
  assert.deepEqual(await access.revokeBinding(bindingId, OPERATOR), { ok: true })
  assert.deepEqual(told, [{ id: bindingId, journalled: true }], 'the memory was not told the binding was revoked')
})

test('I3: a standing denial survives 501 later denials and remains clearable', async () => {
  const {access,shown,tick}=setup()
  let oldest
  for(let i=0;i<502;i++) {
    const r=await access.request(DOOR,ask({resources:[`mail${i}@example.com`]}))
    assert.equal(r.status,'pending')
    if(!i) oldest=r
    assert.equal((await access.decide(r.requestId,'denied',OPERATOR)).ok,true)
    tick(1)
  }
  const prompts=shown.length
  assert.equal((await access.request(DOOR,ask({resources:['mail0@example.com']}))).status,'denied')
  assert.equal(shown.length,prompts, 'standing denial must not prompt again')
  assert.ok((await access.overview()).denials.some(r=>r.requestId===oldest.requestId || r.id===oldest.requestId), 'old denial must remain visible for clearing')
  assert.equal((await access.clearDenial(oldest.requestId,OPERATOR)).ok,true)
  assert.equal((await access.request(DOOR,ask({resources:['mail0@example.com']}))).status,'pending')
})

test('I3 E-5: a status read whose caller has gone does not spend the one-time credential', async () => {
  // The credential is shown once. A poller that hung up used to have it minted and recorded anyway, so the
  // next poll said "handed over once" and the agent never held it.
  const { access } = setup()
  const r = await access.request(DOOR, ask())
  await access.decide(r.requestId, 'allowed', OPERATOR)
  const gone = new AbortController(); gone.abort()
  const lost = await access.status(DOOR, r.requestId, r.pollSecret, gone.signal)
  assert.equal(lost.credential, undefined, 'nothing is minted for a caller that has gone')
  const kept = await access.status(DOOR, r.requestId, r.pollSecret)
  assert.match(kept.credential, /^[A-Za-z0-9_-]{43}$/, 'the next read still collects it')
})

// CO-206 (release verification of 0.3.1, E-9): every access write shared ONE serial chain, so an agent's
// request the database never answered held the operator's revocation behind it for as long as the client
// waited (undici's ~300 s). The operator's acts now run on a lane of their own; the agents' asks and status
// reads keep theirs, because the dedupe and the pending caps are check-then-append in this process.
// #region hub-access-lanes — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#3-grants-are-standing-narrow-and-revocable
const within = (p, ms, what) => {
  let timer
  return Promise.race([p, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} did not answer within ${ms} ms`)), ms) })]).finally(() => clearTimeout(timer))
}

async function allowedAgent(access, extra = {}) {
  const asked = await access.request(DOOR, ask(extra))
  await access.decide(asked.requestId, 'allowed', OPERATOR)
  const claimed = await access.status(DOOR, asked.requestId, asked.pollSecret)
  return { ...claimed, asked }
}

test('CO-206: an operator revocation and decision do not wait behind an agent request the database never answers', async () => {
  const { access, store } = setup()
  const held = await allowedAgent(access)
  const waiting = await access.request(DOOR, ask({ resources: ['waiting@example.com'] }))
  store.requests = () => new Promise(() => {}) // the database stops answering the agent path's reads
  const stuck = access.request(DOOR, ask({ resources: ['stuck@example.com'] }))
  let stuckSettled = false
  stuck.then(() => { stuckSettled = true }, () => { stuckSettled = true })
  const started = Date.now()
  assert.deepEqual(await within(access.revokeBinding(held.bindingId, OPERATOR), 1000, 'the revocation'), { ok: true })
  assert.notEqual(store.maps.bindings.get(held.bindingId).revoked_at, null, 'the binding is not revoked')
  assert.deepEqual(await within(access.decide(waiting.requestId, 'denied', OPERATOR), 1000, 'the decision'), { ok: true })
  assert.ok(Date.now() - started < 1000)
  assert.equal(stuckSettled, false, 'the stalled request was expected still to be waiting')
})

test('CO-206: agent asks stay one at a time — two identical asks at once open one prompt and hand out one poll secret', async () => {
  const { access, shown } = setup()
  const [a, b] = await Promise.all([access.request(DOOR, ask()), access.request(DOOR, ask())])
  assert.equal(shown.length, 1, 'two prompts for one request')
  assert.equal(a.requestId, b.requestId)
  assert.equal([a, b].filter((r) => r.pollSecret).length, 1)
})

test('CO-206: a revocation landing while a credential is being claimed never leaves the revoked credential known', async () => {
  const { access, store } = setup()
  const asked = await access.request(DOOR, ask())
  await access.decide(asked.requestId, 'allowed', OPERATOR)
  const append = store.append.bind(store)
  let release
  const gate = new Promise((r) => { release = r })
  let claimLanded
  const landed = new Promise((r) => { claimLanded = r })
  // The claim commits, and its answer is slow to come back: the revocation reads the claimed verifier in between.
  store.append = async (type, actor, p) => {
    const seq = await append(type, actor, p)
    if (type === 'access.credential.claimed@1') { claimLanded(); await gate }
    return seq
  }
  const claiming = access.status(DOOR, asked.requestId, asked.pollSecret)
  await landed
  const bindingId = [...store.maps.bindings.values()][0].id
  assert.deepEqual(await within(access.revokeBinding(bindingId, OPERATOR), 1000, 'the revocation'), { ok: true })
  release()
  const answer = await claiming
  assert.equal(access.knownCredential(answer.credential ?? 'x'.repeat(43)), false, 'a revoked credential is still known to the hub')
  assert.equal(await access.authenticate(answer.credential ?? 'x'.repeat(43)), null)
})

test('CO-206: a claim the revocation beat is answered "since revoked", not thrown', async () => {
  const { access, store } = setup()
  const asked = await access.request(DOOR, ask())
  await access.decide(asked.requestId, 'allowed', OPERATOR)
  const append = store.append.bind(store)
  let release
  const gate = new Promise((r) => { release = r })
  let claimAsked
  const asking = new Promise((r) => { claimAsked = r })
  // The revocation commits first; the claim's append reaches the store after it and is refused there.
  store.append = async (type, actor, p) => {
    if (type === 'access.credential.claimed@1') { claimAsked(); await gate }
    return append(type, actor, p)
  }
  const claiming = access.status(DOOR, asked.requestId, asked.pollSecret)
  await asking
  const bindingId = [...store.maps.bindings.values()][0].id
  assert.deepEqual(await within(access.revokeBinding(bindingId, OPERATOR), 1000, 'the revocation'), { ok: true })
  release()
  const answer = await claiming
  assert.equal(answer.ok, true)
  assert.equal(answer.credential, undefined)
  assert.match(answer.note, /since revoked/)
})
// #endregion hub-access-lanes

// CO-206: the stalled-database probe. Every call of the hub's store answers within its deadline — or fails
// saying so — against a database that accepts the request and never answers it, and the signal handed to
// the client is aborted, so the request itself is let go rather than left open for undici's ~300 s.
// #region hub-db-deadline — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#3-grants-are-standing-narrow-and-revocable
const { createAccessStore, HUB_DB_DEADLINE_MS } = await import(path.join(SRC, 'accessStore.ts'))
const { createJournal } = await import(path.resolve(import.meta.dirname, '../../../packages/journal/src/index.ts'))

/** A PostgREST-shaped client that takes every request and answers none; it records the signals it was given. */
function stalledDb() {
  const signals = []
  const calls = []
  const pending = () => {
    const q = {
      then() { /* never settles */ },
      abortSignal(s) { signals.push(s); return q }
    }
    for (const m of ['select', 'eq', 'is', 'gt', 'in', 'order', 'range', 'limit', 'maybeSingle', 'single']) q[m] = () => q
    return q
  }
  return { signals, calls, from: (t) => { calls.push(t); return pending() }, rpc: (fn) => { calls.push(fn); return pending() } }
}

test('CO-206: the hub store answers within its deadline against a database that never answers, and lets the request go', async () => {
  assert.ok(HUB_DB_DEADLINE_MS > 0 && HUB_DB_DEADLINE_MS <= 10_000, `the default deadline is ${HUB_DB_DEADLINE_MS} ms`)
  const db = stalledDb()
  const store = createAccessStore({ db, journal: createJournal(db), estateId: '00000000-0000-4000-8000-0000000000e1', deadlineMs: 60 })
  const id = '00000000-0000-4000-8000-000000000001'
  const calls = {
    request: () => store.request(id),
    requestsByIds: () => store.requestsByIds([id]),
    requests: () => store.requests({ status: 'pending', liveAt: new Date().toISOString() }),
    countRequests: () => store.countRequests({ status: 'pending' }),
    binding: () => store.binding(id),
    bindingByVerifier: () => store.bindingByVerifier('a'.repeat(64)),
    liveBindings: () => store.liveBindings(),
    grants: () => store.grants({ bindingId: id, liveAt: new Date().toISOString() }),
    grant: () => store.grant(id),
    liveConnection: () => store.liveConnection('fabric-inbox'),
    append: () => store.append('access.binding.revoked@1', OPERATOR, { binding_id: id })
  }
  for (const [name, call] of Object.entries(calls)) {
    const before = db.signals.length
    const started = Date.now()
    await assert.rejects(within(call(), 1000, `store.${name}`), (e) => {
      assert.equal(e.name, 'DatabaseDeadline', `store.${name} failed with ${e.message}`)
      assert.match(e.message, /did not answer within 60 ms/)
      return true
    })
    assert.ok(Date.now() - started < 500, `store.${name} took ${Date.now() - started} ms`)
    const given = db.signals.slice(before)
    assert.ok(given.length >= 1, `store.${name} handed the client no signal`)
    assert.ok(given.every((s) => s.aborted), `store.${name} left its request open`)
  }
  assert.match((await store.append('x@1', OPERATOR, {}).catch((e) => e)).message, /may or may not have been recorded/, 'an append past its deadline claims to know its outcome')
})

test('CO-206: the operator\'s revocation fails within its deadline when the database stops answering, instead of hanging', async () => {
  const db = stalledDb()
  const store = createAccessStore({ db, journal: createJournal(db), estateId: '00000000-0000-4000-8000-0000000000e1', deadlineMs: 60 })
  const access = new AccessService({ store, registry: fakeRegistry(['example-agent']), present: () => {}, connected: async () => true })
  await assert.rejects(within(access.revokeBinding('00000000-0000-4000-8000-000000000002', OPERATOR), 1000, 'the revocation'), /did not answer within 60 ms/)
  await assert.rejects(within(access.request(DOOR, ask()), 1000, 'the agent request'), /did not answer within 60 ms/)
})
// #endregion hub-db-deadline

// A6-041 (0.3.2 audit, W1): each overview read every live binding's origin request one at a time (N+1),
// and the open panel re-reads every 4 s. The origins are now one id-filtered read, chunked by the store.
test('A6-041: the overview reads the origin requests of every live binding in ONE read, not one per binding', async () => {
  const { access, store } = setup()
  for (const r of ['a@example.com', 'b@example.com', 'c@example.com', 'd@example.com']) await allowedAgent(access, { resources: [r] })
  let single = 0, batched = 0
  const one = store.request.bind(store), many = store.requestsByIds.bind(store)
  store.request = async (id) => { single++; return one(id) }
  store.requestsByIds = async (ids) => { batched++; return many(ids) }
  const o = await access.overview()
  assert.equal(o.bindings.length, 4)
  assert.ok(o.bindings.every((b) => b.registry?.name === 'example-agent'), 'a binding lost its origin request')
  assert.equal(single, 0, `the overview read ${single} origin requests one at a time`)
  assert.equal(batched, 1)
})

test('0.3.8: a registered service asks Fabric for folder attribution and is allowed at once, read-only (Observatory\'s live check of 0.3.7)', async () => {
  const { access, shown } = setup()
  const r = await access.request(DOOR, { agentId: 'example-agent', callee: 'fabric', capabilities: ['project.resolve'], resources: ['projects'], reason: 'attribute the folders this machine has to Fabric projects' })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(r.status, 'allowed')
  assert.equal(shown.length, 0, 'a read-only local lane opens no prompt')
  const s = await access.status(DOOR, r.requestId, r.pollSecret)
  assert.equal(s.ok, true)
  assert.match(s.credential, /^[A-Za-z0-9_-]{43}$/)
})

test('0.3.8: project.resolve takes exactly the resource projects, and an unknown asker is refused before any prompt', async () => {
  const { access, shown } = setup()
  const wrong = await access.request(DOOR, { agentId: 'example-agent', callee: 'fabric', capabilities: ['project.resolve'], resources: ['project:abc'], reason: 'x' })
  assert.equal(wrong.ok, false)
  const stranger = await access.request(DOOR, { agentId: 'nobody-here', callee: 'fabric', capabilities: ['project.resolve'], resources: ['projects'], reason: 'x' })
  assert.equal(stranger.ok, false)
  assert.equal(shown.length, 0)
})
