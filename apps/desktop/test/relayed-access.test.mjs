// CO-506: the operator's relayed words decide Agent access, and what an agent may never do there.
// Spec: docs/evidence/specs/2026-11-05-co506-agent-access-door.md §2.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { checkRelayedAccess, admitAccessAct, relayedDecide, relayedRevoke, createRevokeAgent, DECISION_MAX_AGE_MS } = await import(path.resolve(import.meta.dirname, '../src/main/relayedAccess.ts'))

const NOW = Date.parse('2026-11-05T20:00:00Z')
const ID = '0b4b0d02-d15a-4596-8879-5a22ba74afe7'
const words = (over = {}) => ({ by: 'operator', via: 'relayed-instruction', action: 'access.allow', target: ID, instruction: 'allow it', at: new Date(NOW - 60_000).toISOString(), ...over })

test('no decision asks for the operator\'s words, naming the action and the target', () => {
  const v = checkRelayedAccess(undefined, { verb: 'allow', targetId: ID }, NOW)
  assert.equal(v.code, 'operator-decision-required')
  assert.deepEqual(v.data, { action: 'access.allow', target: ID })
})

test('the verdict is bound into the action: words that said deny cannot allow', () => {
  assert.equal(checkRelayedAccess(words({ action: 'access.deny' }), { verb: 'allow', targetId: ID }, NOW).code, 'decision-invalid')
  assert.equal(checkRelayedAccess(words({ action: 'access.deny' }), { verb: 'deny', targetId: ID }, NOW).ok, true)
})

test('the target names this id, by its full id or an 8-character prefix', () => {
  assert.equal(checkRelayedAccess(words({ target: ID.slice(0, 8) }), { verb: 'allow', targetId: ID }, NOW).ok, true)
  assert.equal(checkRelayedAccess(words({ target: 'something else' }), { verb: 'allow', targetId: ID }, NOW).code, 'decision-invalid')
  assert.equal(checkRelayedAccess(words({ target: undefined }), { verb: 'allow', targetId: ID }, NOW).code, 'decision-invalid')
})

test('words from the future or older than a day are refused; a malformed decision too', () => {
  assert.equal(checkRelayedAccess(words({ at: new Date(NOW + 10 * 60_000).toISOString() }), { verb: 'allow', targetId: ID }, NOW).code, 'decision-invalid')
  assert.equal(checkRelayedAccess(words({ at: new Date(NOW - DECISION_MAX_AGE_MS - 1).toISOString() }), { verb: 'allow', targetId: ID }, NOW).code, 'decision-invalid')
  assert.equal(checkRelayedAccess({ by: 'operator' }, { verb: 'allow', targetId: ID }, NOW).code, 'decision-invalid')
  assert.equal(checkRelayedAccess(words({ extra: 1 }), { verb: 'allow', targetId: ID }, NOW).code, 'decision-invalid')
})

test('an agent may not allow a product, a lane outside Fabric\'s own, or what its own credential asked', () => {
  const base = { verb: 'allow', callerBindingId: 'b1', machineTrust: null }
  assert.equal(admitAccessAct({ ...base, request: { callee: 'gmail', capabilities: ['mail.read'], asked_by_binding: null } }).code, 'human-step-required')
  assert.equal(admitAccessAct({ ...base, request: { callee: 'fabric', capabilities: ['something.else'], asked_by_binding: null } }).code, 'decision-invalid')
  assert.equal(admitAccessAct({ ...base, request: { callee: 'fabric', capabilities: ['board.respond'], asked_by_binding: 'b1' } }).code, 'self-decision')
  assert.equal(admitAccessAct({ ...base, request: { callee: 'fabric', capabilities: ['board.respond'], asked_by_binding: 'b2' } }).ok, true)
  assert.equal(admitAccessAct({ ...base, request: { callee: 'fabric', capabilities: ['board.respond'], asked_by_binding: null } }).ok, true)
})

test('deny and revoke only restrict: allowed for any request; an organization\'s machine refuses everything', () => {
  assert.equal(admitAccessAct({ verb: 'deny', callerBindingId: 'b1', machineTrust: null, request: { callee: 'gmail', capabilities: ['mail.read'], asked_by_binding: 'b1' } }).ok, true)
  assert.equal(admitAccessAct({ verb: 'revoke', callerBindingId: 'b1', machineTrust: 'mine' }).ok, true)
  assert.equal(admitAccessAct({ verb: 'revoke', callerBindingId: 'b1', machineTrust: 'organization' }).code, 'human-step-required')
})

function door(over = {}) {
  const calls = []
  return {
    calls,
    request: async (id) => (id === ID ? { callee: 'fabric', capabilities: ['board.respond'], asked_by_binding: 'b-other' } : null),
    decide: async (...a) => { calls.push(['decide', ...a]); return { ok: true } },
    revokeGrant: async (...a) => { calls.push(['revokeGrant', ...a]); return { ok: true } },
    revokeAgent: async (...a) => { calls.push(['revokeAgent', ...a]); return { ok: true } },
    machineTrust: () => null,
    ...over
  }
}
const CALLER = { sessionId: 'session-1', bindingId: 'b-mine' }

test('relayedDecide: no words decide nothing; with them the session allows, recorded as its act with the words', async () => {
  const d = door()
  const bare = await relayedDecide(d, CALLER, { requestId: ID, verdict: 'allow', decision: undefined }, NOW)
  assert.equal(bare.code, 'operator-decision-required')
  assert.equal(d.calls.length, 0)
  const done = await relayedDecide(d, CALLER, { requestId: ID, verdict: 'allow', decision: words() }, NOW)
  assert.equal(done.ok, true)
  const [verb, id, verdict, actor, relayed] = d.calls[0]
  assert.deepEqual([verb, id, verdict, actor], ['decide', ID, 'allowed', { kind: 'agent', id: 'session-1' }])
  assert.equal(relayed.instruction, 'allow it')
})

test('relayedDecide: a product is refused before the service is asked; the service\'s own refusal passes through', async () => {
  const product = door({ request: async () => ({ callee: 'gmail', capabilities: ['mail.read'], asked_by_binding: null }) })
  assert.equal((await relayedDecide(product, CALLER, { requestId: ID, verdict: 'allow', decision: words() }, NOW)).code, 'human-step-required')
  assert.equal(product.calls.length, 0)
  const late = door({ decide: async () => ({ ok: false, code: 'expired', reason: 'that request expired' }) })
  const r = await relayedDecide(late, CALLER, { requestId: ID, verdict: 'allow', decision: words() }, NOW)
  assert.deepEqual([r.ok, r.code], [false, 'expired'])
  assert.equal((await relayedDecide(door(), CALLER, { requestId: '11111111-1111-4111-8111-111111111111', verdict: 'allow', decision: words({ target: '11111111-1111-4111-8111-111111111111' }) }, NOW)).code, 'not-found')
})

test('relayedRevoke: exactly one id; a grant or a whole agent, on words naming it', async () => {
  const d = door()
  assert.equal((await relayedRevoke(d, CALLER, { decision: words({ action: 'access.revoke' }) }, NOW)).code, 'invalid-arguments')
  assert.equal((await relayedRevoke(d, CALLER, { grantId: ID, credentialId: ID, decision: words({ action: 'access.revoke' }) }, NOW)).code, 'invalid-arguments')
  assert.equal((await relayedRevoke(d, CALLER, { grantId: ID, decision: words() }, NOW)).code, 'decision-invalid', 'words for allow do not revoke')
  assert.equal((await relayedRevoke(d, CALLER, { credentialId: ID, decision: words({ action: 'access.revoke' }) }, NOW)).ok, true)
  assert.equal(d.calls[0][0], 'revokeAgent')
  const org = door({ machineTrust: () => 'organization' })
  assert.equal((await relayedRevoke(org, CALLER, { grantId: ID, decision: words({ action: 'access.revoke' }) }, NOW)).code, 'human-step-required')
})

test('review F1: an agent revoked on relayed words is written in History as the session\'s act, never as the operator\'s', async () => {
  const notes = []
  const revoke = createRevokeAgent({
    nameOf: async () => 'Example agent',
    revokeBinding: async (id) => (id === ID ? { ok: true } : { ok: false, code: 'not-live', reason: 'that credential is not live' }),
    note: async (outcome, opts) => { notes.push([outcome, opts]) }
  })
  const actor = { kind: 'agent', id: 'session-1' }
  assert.deepEqual(await revoke(ID, actor, words({ action: 'access.revoke' })), { ok: true })
  assert.deepEqual(notes[0][1], { actor })
  assert.equal(notes[0][0].subject.label, 'Example agent')
  await revoke('11111111-1111-4111-8111-111111111111', actor, words({ action: 'access.revoke' }))
  assert.equal(notes.length, 1, 'a refused revocation writes no act')
})
