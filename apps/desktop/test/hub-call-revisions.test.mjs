// CT-26 (fabric-agent-contract, DEC-0043; asked as blocking for 0.3.7 on 2026-10-19): a reference's `contentHash` is
// `sha256:` over the RFC 8785 canonical JSON of the referenced revisioned object with `contentHash` omitted. Fabric's
// hub-call envelopes hashed a joined string of grant ids and the text 'fabric-hub/0.1', so no other verifier could
// reproduce them.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
const { revisionRef, bindingRevision, HUB_PRODUCER } = await import('../src/main/hubCall.ts')

const sha = (s) => 'sha256:' + createHash('sha256').update(s, 'utf8').digest('hex')

test('a reference hashes the canonical JSON of its object, keys sorted, contentHash left out', () => {
  const ref = revisionRef({ revision: 3, id: 'urn:x:y', contentHash: 'sha256:stale', b: [1, 'é'], a: { d: null, c: true } })
  assert.deepEqual(ref, { id: 'urn:x:y', revision: 3, contentHash: sha('{"a":{"c":true,"d":null},"b":[1,"é"],"id":"urn:x:y","revision":3}') })
})

test('the binding and the hub are revisioned objects of their own, and their hashes are theirs, not a joined string', () => {
  const binding = { id: 'b-1', agent_id: 'example-agent', request_id: 'r', verifier: null, created_at: '2026-10-19T10:00:00.000Z', claimed_at: null, revoked_at: null }
  const revision = bindingRevision(binding, ['g-2', 'g-1'])
  assert.deepEqual(revision, {
    id: 'urn:fabric:binding:b-1', revision: 1, createdAt: '2026-10-19T10:00:00.000Z', createdBy: 'urn:fabric:hub',
    agent: 'example-agent', grants: ['urn:fabric:grant:g-1', 'urn:fabric:grant:g-2']
  })
  const ref = revisionRef(revision)
  assert.notEqual(ref.contentHash, sha('g-1,g-2'), 'the old joined-string hash')
  assert.equal(ref.contentHash, sha(JSON.stringify(Object.fromEntries(Object.entries(revision).sort(([a], [b]) => (a < b ? -1 : 1))))))
  assert.equal(revisionRef(bindingRevision(binding, ['g-1', 'g-2'])).contentHash, ref.contentHash, 'the order of grants does not change it')
  assert.notEqual(revisionRef(HUB_PRODUCER).contentHash, sha('fabric-hub/0.1'))
  assert.match(revisionRef(HUB_PRODUCER).contentHash, /^sha256:[0-9a-f]{64}$/)
})
