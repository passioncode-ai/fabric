// agent-sync's lease refs, read-only (REQ-08): bounded, kept briefly, failing soft with a reason, and never pointed
// at anything but an https or ssh remote. Pure — the remote read is injected; the default one is checked to refuse
// a remote it must not run against before it runs git at all.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { createLeaseRefReader, lsRemoteLeases, usesAgentSync } = await import(path.resolve(import.meta.dirname, '../src/main/agentSyncLeases.ts'))
const { leasesView } = await import(path.resolve(import.meta.dirname, '../src/main/workRead.ts'))
const USES = { usesAgentSync: async () => true }
const OUT = 'ca5ef24199653c4b651b350ba29097c6f9e13b32\trefs/agent-sync/leases/CONTEXT.md\n'

test('an answer is kept for its minute: one remote read for many lists', async () => {
  let now = 0, calls = 0
  const r = createLeaseRefReader({ ...USES, remoteOf: async () => 'git@github.com:o/n.git', lsRemote: async () => { calls++; return OUT }, now: () => now })
  const a = await r.read('/repo')
  await r.read('/repo')
  assert.equal(a.read, true)
  assert.deepEqual(a.leases.map((l) => l.key), ['CONTEXT.md'])
  assert.equal(calls, 1)
  now = 61_000
  await r.read('/repo')
  assert.equal(calls, 2, 'read again once the minute is over')
})

test('every failure is an answer with its code and reason, never a throw and never "no leases"', async () => {
  const cases = [
    [{ remoteOf: async () => null, lsRemote: async () => OUT }, 'no-origin', /no origin remote/],
    [{ remoteOf: async () => '/local/path', lsRemote: async () => OUT }, 'not-listable', /not an https or ssh URL/],
    [{ remoteOf: async () => { throw new Error('locked') }, lsRemote: async () => OUT }, 'remote-unreadable', /remote could not be read \(locked\)/],
    [{ remoteOf: async () => 'https://h/o/n', lsRemote: async () => { throw Object.assign(new Error('x'), { killed: true }) } }, 'timeout', /no answer within 8 s/],
    [{ remoteOf: async () => 'https://h/o/n', lsRemote: async () => { throw Object.assign(new Error('x'), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }) } }, 'too-large', /larger than Fabric reads/],
    [{ remoteOf: async () => 'https://h/o/n', lsRemote: async () => { throw new Error('denied') } }, 'refused', /refused or could not be reached/]
  ]
  for (const [deps, code, reason] of cases) {
    const got = await createLeaseRefReader({ ...USES, ...deps }).read('/repo')
    assert.equal(got.read, false)
    assert.equal(got.code, code, 'a code each window translates (0.3.5 review UX-5)')
    assert.match(got.reason, reason)
    // The screens add "could not be read" themselves; a reason that says it too reads the clause twice (UX-5).
    assert.doesNotMatch(got.reason, /leases could not be read/)
  }
})

test('a repository that does not use agent-sync is not asked at all, and its project page shows no block (UX-5)', async () => {
  let remoteReads = 0
  const got = await createLeaseRefReader({ usesAgentSync: async () => false, remoteOf: async () => { remoteReads++; return 'https://h/o/n' }, lsRemote: async () => { remoteReads++; return OUT } }).read('/repo')
  assert.equal(got.read, false)
  assert.equal(got.code, 'not-used')
  assert.equal(remoteReads, 0, 'no remote read for a repository that does not use agent-sync')
  assert.equal(leasesView({ ...got, repository: '/repo' }), null, 'no block on the project page')
  assert.deepEqual(leasesView({ read: false, code: 'timeout', reason: 'no answer within 8 s', readAt: 'x', repository: '/repo' }), { read: false, code: 'timeout' })
  assert.deepEqual(leasesView({ read: true, remote: 'https://h/o/n', readAt: 'x', leases: [{ key: 'CONTEXT.md', sha: 'a' }], truncated: false, repository: '/repo' }).leases, [{ key: 'CONTEXT.md' }])
})

test('agent-sync use is read from the committed config file', async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const dir = await mkdtemp(path.join(tmpdir(), 'fabric-agent-sync-'))
  try {
    assert.equal(await usesAgentSync(dir), false)
    await mkdir(path.join(dir, '.claude'))
    await writeFile(path.join(dir, '.claude', 'agent-sync.json'), '{}')
    assert.equal(await usesAgentSync(dir), true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('the default reader refuses a remote that is not https or ssh before running anything', async () => {
  for (const url of ['ext::sh -c id', 'file:///etc', '/local', '--upload-pack=touch /tmp/x'])
    await assert.rejects(() => lsRemoteLeases(url), /not an https or ssh URL/)
})

// ── TR-7 (0.3.9): only live leases are shown as current ──────────────────────────────────────────────────────────
// The audit decoded 49 lease refs on the fabric remote: 49 expired, 0 live, the oldest 16.9 days. A ref's commit body
// is the lease (`{"key","run","ts","ttl","host"}`, ts ISO in UTC, ttl seconds); Fabric now reads it.
const { currentLeases } = await import(path.resolve(import.meta.dirname, '../src/main/agentSyncLeases.ts'))
const SHA = (c) => c.repeat(40)
const THREE = `${SHA('a')}\trefs/agent-sync/leases/live.md\n${SHA('b')}\trefs/agent-sync/leases/old.md\n${SHA('c')}\trefs/agent-sync/leases/unread.md\n`
const BODIES = {
  [SHA('a')]: JSON.stringify({ key: 'live.md', run: 'r1', ts: '2026-10-21T12:00:00Z', ttl: 3600, host: 'h' }),
  [SHA('b')]: JSON.stringify({ key: 'old.md', run: 'r2', ts: '2026-10-04T12:00:00Z', ttl: 3600, host: 'h' })
}

test('TR-7: each lease is read from its commit: live with its expiry, expired, or unread when the object is not here', async () => {
  const r = createLeaseRefReader({ ...USES, remoteOf: async () => 'https://h/o/n', lsRemote: async () => THREE,
    bodyOf: async (_repo, sha) => BODIES[sha] ?? null, now: () => Date.parse('2026-10-21T12:30:00Z') })
  const got = await r.read('/repo')
  assert.equal(got.read, true)
  const by = Object.fromEntries(got.leases.map((l) => [l.key, l]))
  assert.equal(by['live.md'].state, 'live')
  assert.equal(by['live.md'].expiresAt, '2026-10-21T13:00:00.000Z')
  assert.equal(by['old.md'].state, 'expired')
  assert.equal(by['unread.md'].state, 'unknown')
})

test('TR-7: what agents and screens are shown: live (and unread) leases, and only a count of the expired', async () => {
  const r = createLeaseRefReader({ ...USES, remoteOf: async () => 'https://h/o/n', lsRemote: async () => THREE,
    bodyOf: async (_repo, sha) => BODIES[sha] ?? null, now: () => Date.parse('2026-10-21T12:30:00Z') })
  const shown = currentLeases(await r.read('/repo'))
  assert.deepEqual(shown.leases.map((l) => l.key), ['live.md', 'unread.md'])
  assert.equal(shown.expired, 1)
  const view = leasesView({ ...(await r.read('/repo')), repository: '/repo' })
  assert.deepEqual(view.leases.map((l) => l.key), ['live.md', 'unread.md'])
  assert.equal(view.expired, 1)
  assert.deepEqual(currentLeases({ read: false, code: 'timeout', reason: 'x', readAt: 'y' }), { read: false, code: 'timeout', reason: 'x', readAt: 'y' })
})

test('TR-7: a body that is not a lease (not JSON, no ts, a ttl that is no number) is unread, never live', async () => {
  for (const body of ['nope', JSON.stringify({ key: 'k' }), JSON.stringify({ ts: 'soon', ttl: 60 }), JSON.stringify({ ts: '2026-10-21T12:00:00Z', ttl: 'long' })]) {
    const r = createLeaseRefReader({ ...USES, remoteOf: async () => 'https://h/o/n', lsRemote: async () => OUT, bodyOf: async () => body, now: () => Date.parse('2026-10-21T12:30:00Z') })
    assert.equal((await r.read('/repo')).leases[0].state, 'unknown', body)
  }
})
