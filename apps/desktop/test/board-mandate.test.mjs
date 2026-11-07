// CO-409 (DEC-0125 MD-3, the contract's project-comms.md at 18f8d487): a board request from a verified sender may carry
// the operator's mandate as a JSON code block in its body; Fabric reads it and carries it into the run's packet.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { mandateOfRequest } = await import(path.resolve(import.meta.dirname, '../src/main/boardMandate.ts'))

const NOW = Date.parse('2026-11-07T12:00:00Z')
const mandate = {
  kind: 'mandate/1', by: 'operator', task: 'Rotate the release key', instruction: 'rotate the release signing key and redeploy staging',
  at: '2026-11-07T11:00:00Z', expiresAt: '2026-11-10T11:00:00Z',
  scope: { effects: ['none', 'draft', 'deploy'], capabilities: ['release.rotate'] },
  chain: [{ agent: 'sender-agent', at: '2026-11-07T11:00:00Z' }]
}
const message = (over = {}) => ({
  sender: { project: 'p-sender', principal: { kind: 'agent', id: 'x', provenance: 'trusted' } },
  body: { text: 'The operator asked for this in the release session.\n\n```json\n' + JSON.stringify(mandate, null, 2) + '\n```\n' },
  ...over
})

test('a verified sender\'s JSON block that is a mandate in force is read', () => {
  assert.deepEqual(mandateOfRequest(message(), NOW), mandate)
})

test('no mandate: an unverified sender, no block, a block that is not JSON or not mandate/1, expired or not yet in force', () => {
  assert.equal(mandateOfRequest(message({ sender: { project: 'p', principal: { provenance: 'asserted' } } }), NOW), null)
  assert.equal(mandateOfRequest(message({ sender: { project: 'p', principal: null } }), NOW), null)
  assert.equal(mandateOfRequest(message({ body: { text: 'please do it' } }), NOW), null)
  assert.equal(mandateOfRequest(message({ body: undefined }), NOW), null)
  assert.equal(mandateOfRequest(message({ body: { text: '```json\n{not json\n```' } }), NOW), null)
  assert.equal(mandateOfRequest(message({ body: { text: '```json\n' + JSON.stringify({ ...mandate, kind: 'decision/1' }) + '\n```' } }), NOW), null)
  assert.equal(mandateOfRequest(message(), Date.parse('2026-11-11T00:00:00Z')), null, 'expired')
  assert.equal(mandateOfRequest(message(), Date.parse('2026-11-07T10:00:00Z')), null, 'not yet in force')
})

test('the first valid block wins; a prose block before it is skipped', () => {
  const text = '```json\n{"note": 1}\n```\n\n```json\n' + JSON.stringify(mandate) + '\n```'
  assert.deepEqual(mandateOfRequest(message({ body: { text } }), NOW), mandate)
})
