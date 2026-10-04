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
