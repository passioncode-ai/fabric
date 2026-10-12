// agent-sync's lease refs, read-only (REQ-08): bounded, kept briefly, failing soft with a reason, and never pointed
// at anything but an https or ssh remote. Pure — the remote read is injected; the default one is checked to refuse
// a remote it must not run against before it runs git at all.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { createLeaseRefReader, lsRemoteLeases } = await import(path.resolve(import.meta.dirname, '../src/main/agentSyncLeases.ts'))
const OUT = 'ca5ef24199653c4b651b350ba29097c6f9e13b32\trefs/agent-sync/leases/CONTEXT.md\n'

test('an answer is kept for its minute: one remote read for many lists', async () => {
  let now = 0, calls = 0
  const r = createLeaseRefReader({ remoteOf: async () => 'git@github.com:o/n.git', lsRemote: async () => { calls++; return OUT }, now: () => now })
  const a = await r.read('/repo')
  await r.read('/repo')
  assert.equal(a.read, true)
  assert.deepEqual(a.leases.map((l) => l.key), ['CONTEXT.md'])
  assert.equal(calls, 1)
  now = 61_000
  await r.read('/repo')
  assert.equal(calls, 2, 'read again once the minute is over')
})

test('every failure is an answer with its reason, never a throw and never "no leases"', async () => {
  const cases = [
    [{ remoteOf: async () => null, lsRemote: async () => OUT }, /no origin remote/],
    [{ remoteOf: async () => '/local/path', lsRemote: async () => OUT }, /not an https or ssh URL/],
    [{ remoteOf: async () => { throw new Error('locked') }, lsRemote: async () => OUT }, /remote could not be read \(locked\)/],
    [{ remoteOf: async () => 'https://h/o/n', lsRemote: async () => { throw Object.assign(new Error('x'), { killed: true }) } }, /no answer within 8 s/],
    [{ remoteOf: async () => 'https://h/o/n', lsRemote: async () => { throw new Error('denied') } }, /refused or could not be reached/]
  ]
  for (const [deps, reason] of cases) {
    const got = await createLeaseRefReader(deps).read('/repo')
    assert.equal(got.read, false)
    assert.match(got.reason, reason)
  }
})

test('the default reader refuses a remote that is not https or ssh before running anything', async () => {
  for (const url of ['ext::sh -c id', 'file:///etc', '/local', '--upload-pack=touch /tmp/x'])
    await assert.rejects(() => lsRemoteLeases(url), /not an https or ssh URL/)
})
