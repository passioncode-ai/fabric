// CO-428 (0.3.13): a stack that is half up (db and kong running, rest and auth gone after the container engine
// restarted) answers `supabase status` without keys and `supabase start` with "already running". Fabric heals it once:
// stop keeping the volumes, start with its exclusions, read again.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { resolveHealingHalfUp, isHalfUp, recoverThenHeal } = await import(path.resolve(import.meta.dirname, '../src/main/stackHalfUp.ts'))

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
  }), (e) => e.code === 'FABRIC_STACK_HEAL_FAILED' && /docker gone/.test(e.message))
  assert.deepEqual(calls, ['resolve', 'stop', 'record:failed'])
  // UX-8: the startup window reads the restart's failure as that, with the restart's words.
  const { classifyStartupFailure } = await import(path.resolve(import.meta.dirname, '../src/shared/startupFailure.ts'))
  let thrown
  try { await resolveHealingHalfUp({ resolve: async () => { throw silent() }, stop: async () => { throw new Error('docker gone') }, start: async () => {}, record: () => {} }) } catch (e) { thrown = e }
  const said = classifyStartupFailure(thrown)
  assert.equal(said.remedyKey, 'startup.stack-up-but-silent.remedy.healFailed')
})

test('isHalfUp recognises only the missing-keys answer', () => {
  assert.equal(isHalfUp(silent()), true)
  assert.equal(isHalfUp(new Error('ECONNREFUSED')), false)
  assert.equal(isHalfUp('not an error'), false)
})

// 0.3.13 review, iteration 1, ER-1: Supabase CLI 2.114 exits 0 against a stack that is already up, so the watch's try
// reads «started» and the heal must run anyway; ER-3: containers Fabric's own heal stopped are Fabric's to start again.
test('ER-1: the heal runs after a try that the CLI called started, and after one it called already running', async () => {
  for (const answer of ['started', 'already-running']) {
    const calls = []
    const r = await recoverThenHeal(async () => { calls.push('start'); return answer }, async () => { calls.push('heal') }, () => false)
    assert.equal(r, answer)
    assert.deepEqual(calls, ['start', 'heal'], answer)
  }
  const calls = []
  await recoverThenHeal(async () => { calls.push('start'); return 'started' }, async () => { calls.push('heal') }, () => true)
  assert.deepEqual(calls, ['start'], 'nothing is healed while quitting')
})

test('ER-3: containers gone after Fabric\'s own heal stopped them read as stopped, never as the operator\'s stop', async () => {
  const { afterOwnStop } = await import(path.resolve(import.meta.dirname, '../src/main/stackServices.ts'))
  const { recoveryPlan } = await import(path.resolve(import.meta.dirname, '../src/shared/stackWatch.ts'))
  assert.equal(recoveryPlan(afterOwnStop('absent', true)), 'start')
  assert.equal(recoveryPlan(afterOwnStop('absent', false)), 'stopped', 'a stop someone made is respected')
  assert.equal(afterOwnStop('running', true), 'running')
})

// The 0.3.13 review, iteration 2: ER-1, a heal that stopped the stack starts nothing once Fabric is quitting; UX-1, a
// start that fails after the heal's stop is the start's own failure, so the window says it in its own terms.
test('iteration 2 ER-1: a heal that stopped the stack while Fabric quits starts nothing', async () => {
  const calls = []
  let quitting = false
  await assert.rejects(resolveHealingHalfUp({
    resolve: async () => { calls.push('resolve'); throw silent() },
    stop: async () => { calls.push('stop'); quitting = true },
    start: async () => { calls.push('start') },
    record: (r) => calls.push(`record:${r.outcome}`),
    stopped: () => quitting
  }), /did not yield API_URL/)
  assert.deepEqual(calls, ['resolve', 'stop', 'record:failed'], 'no start after the quit began')
})

test('iteration 2 UX-1: a start that fails after the heal\'s stop is thrown as the start\'s own failure', async () => {
  const docker = new Error('Cannot connect to the Docker daemon at unix:///var/run/docker.sock')
  let thrown
  try {
    await resolveHealingHalfUp({ resolve: async () => { throw silent() }, stop: async () => {}, start: async () => { throw docker }, record: () => {} })
  } catch (e) { thrown = e }
  assert.equal(thrown, docker)
  assert.notEqual(thrown.code, 'FABRIC_STACK_HEAL_FAILED')
})

// The 0.3.13 review, iteration 3: ER-1, a quit during the first status read spawns no stop; ER-4, rest alone gone leaves
// the keys in status, so the watch heals by the containers; UX-5, the splash is told before the stop.
test('iteration 3 ER-1: a quit that came during the status read spawns no stop', async () => {
  const calls = []
  await assert.rejects(resolveHealingHalfUp({
    resolve: async () => { calls.push('resolve'); throw silent() },
    stop: async () => { calls.push('stop') },
    start: async () => { calls.push('start') },
    record: (r) => calls.push(`record:${r.outcome}`),
    stopped: () => true
  }), /did not yield API_URL/)
  assert.deepEqual(calls, ['resolve', 'record:failed'], 'no stop once Fabric is quitting')
})

test('iteration 3 ER-4: a status that names the keys while Docker shows the stack partial is healed by stop and start', async () => {
  const calls = []
  let partial = true
  const got = await resolveHealingHalfUp({
    resolve: async () => { calls.push('resolve'); return env },
    stop: async () => { calls.push('stop') },
    start: async () => { calls.push('start'); partial = false },
    record: (r) => calls.push(`record:${r.outcome}`),
    partial: async () => { calls.push('partial'); return partial }
  })
  assert.deepEqual(got, env)
  assert.deepEqual(calls, ['resolve', 'partial', 'stop', 'start', 'resolve', 'record:ok'])
  // A healthy stack: one status and one container read, nothing stopped; a container read that fails heals nothing.
  const quiet = []
  await resolveHealingHalfUp({ resolve: async () => env, stop: async () => { quiet.push('stop') }, start: async () => { quiet.push('start') }, record: () => {}, partial: async () => false })
  await resolveHealingHalfUp({ resolve: async () => env, stop: async () => { quiet.push('stop') }, start: async () => { quiet.push('start') }, record: () => {}, partial: async () => { throw new Error('docker ps failed') } })
  assert.deepEqual(quiet, [])
})

test('iteration 3 UX-5: the splash is told the stack is being restarted before the stop, in the person\'s language', async () => {
  const { HEAL_LINE } = await import(path.resolve(import.meta.dirname, '../src/main/stackHalfUp.ts'))
  const { splashProgress } = await import(path.resolve(import.meta.dirname, '../src/shared/splashProgress.ts'))
  const said = []
  await resolveHealingHalfUp({ resolve: (() => { let n = 0; return async () => { if (n++ === 0) throw silent(); return env } })(), stop: async () => { said.push('stop') }, start: async () => {}, record: () => {}, say: (line) => said.push(line) })
  assert.deepEqual(said, [HEAL_LINE, 'stop'])
  assert.match(splashProgress({ elapsedMs: 1000, lastLine: HEAL_LINE, locale: 'ru' }), /Перезапускаю локальную базу, данные сохраняются/)
  assert.match(splashProgress({ elapsedMs: 1000, lastLine: HEAL_LINE, locale: 'en' }), /Restarting the local stack, keeping its data/)
})
