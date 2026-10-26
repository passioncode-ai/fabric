// CO-428 (0.3.13): a stack that is half up (db and kong running, rest and auth gone after the container engine
// restarted) answers `supabase status` without keys and `supabase start` with "already running". Fabric heals it once:
// stop keeping the volumes, start with its exclusions, read again.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { resolveHealingHalfUp, isHalfUp } = await import(path.resolve(import.meta.dirname, '../src/main/stackHalfUp.ts'))

const silent = () => new Error('supabase status did not yield API_URL/SERVICE_ROLE_KEY (got: API_URL, DB_URL)')
const env = { url: 'http://127.0.0.1:54321', serviceKey: 'k' }

test('a half-up stack is healed once: stop, start, read again, and the heal is recorded', async () => {
  const calls = []
  let reads = 0
  const got = await resolveHealingHalfUp({
    resolve: async () => { reads++; calls.push('resolve'); if (reads === 1) throw silent(); return env },
    stop: async () => { calls.push('stop') },
    start: async () => { calls.push('start') },
    record: (r) => calls.push(`record:${r.outcome}`)
  })
  assert.deepEqual(got, env)
  assert.deepEqual(calls, ['resolve', 'stop', 'start', 'resolve', 'record:ok'])
})

test('a stack still silent after the heal fails with the original words, and the failed heal is recorded', async () => {
  const calls = []
  await assert.rejects(resolveHealingHalfUp({
    resolve: async () => { calls.push('resolve'); throw silent() },
    stop: async () => { calls.push('stop') },
    start: async () => { calls.push('start') },
    record: (r) => calls.push(`record:${r.outcome}`)
  }), /did not yield API_URL/)
  assert.deepEqual(calls, ['resolve', 'stop', 'start', 'resolve', 'record:failed'])
})

test('any other failure is not healed: no stop, no start', async () => {
  const calls = []
  await assert.rejects(resolveHealingHalfUp({
    resolve: async () => { calls.push('resolve'); throw new Error('connect ECONNREFUSED 127.0.0.1:54321') },
    stop: async () => { calls.push('stop') },
    start: async () => { calls.push('start') },
    record: () => calls.push('record')
  }), /ECONNREFUSED/)
  assert.deepEqual(calls, ['resolve'])
})

test('a heal whose stop fails says so and does not start', async () => {
  const calls = []
  await assert.rejects(resolveHealingHalfUp({
    resolve: async () => { calls.push('resolve'); throw silent() },
    stop: async () => { calls.push('stop'); throw new Error('docker gone') },
    start: async () => { calls.push('start') },
    record: (r) => calls.push(`record:${r.outcome}`)
  }), /did not yield API_URL/)
  assert.deepEqual(calls, ['resolve', 'stop', 'record:failed'])
})

test('isHalfUp recognises only the missing-keys answer', () => {
  assert.equal(isHalfUp(silent()), true)
  assert.equal(isHalfUp(new Error('ECONNREFUSED')), false)
  assert.equal(isHalfUp('not an error'), false)
})
