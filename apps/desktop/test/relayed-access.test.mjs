// CO-506: the operator's relayed words decide Agent access, and what an agent may never do there.
// Spec: docs/evidence/specs/2026-11-05-co506-agent-access-door.md §2.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { checkRelayedAccess, admitAccessAct, DECISION_MAX_AGE_MS } = await import(path.resolve(import.meta.dirname, '../src/main/relayedAccess.ts'))

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
