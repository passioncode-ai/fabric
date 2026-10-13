import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createResourceLaunchAdapter } from '../src/main/resourceLaunchAdapter.ts'
import { createResourceAttemptObservation, resourceObservationDigest as hash, resourceObservationDuration,
  summarizeResourceObservations, compareResourceObservations } from '../src/main/resourceAttemptObservation.ts'

// Drives the actual optional production adapter. Only its RPC/currentness and
// clocks are synthetic. This does not exercise SQL, native spawn or energy use.
const id = n => `74000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const vector = n => ({ workerSlots: n, memoryBytes: n * 100, diskBytes: n * 10, cpuMilliCores: n * 1000 })
const policy = hash(['host', 'pool', 'revision'])
function fixture({ delay = 10, sink = createResourceAttemptObservation(30), clock, admission = 'accepted', current = 'current', settlement = 'released' } = {}) {
  let at = 0, rpcCalls = 0
  const input = { estateId: id(1), taskId: id(2), sessionId: id(3), actor: { kind: 'system', id: 'SECRET-ACTOR' }, trigger: 'chain' }
  const identity = { hostId: 'host', poolId: 'pool', localPolicyRevision: 'revision', reservationId: 'reservation',
    attemptId: 'attempt', fence: 1, ownerId: 'SECRET-OWNER', role: 'reviewer', inputDigest: 'a'.repeat(64), scopeDigest: 'b'.repeat(64) }
  const deps = { timeoutMs: 10, maxEntries: 10, observations: { sink, now: clock ?? (() => at) },
    prepare: async () => ({ request: { ...identity, demand: vector(1) }, ownDemand: vector(1),
      context: { nowMs: 10, policy: { hostId: 'host', poolId: 'pool', localPolicyRevision: 'revision', maxAgeMs: 10, capacity: vector(4) },
        snapshot: { id: 'snapshot', hostId: 'host', poolId: 'pool', localPolicyRevision: 'revision', atMs: 10,
          reserved: vector(0), observed: vector(0), reservedObserved: vector(0) } },
      checks: { ownership: () => admission === 'preflight-unknown' ? { state: 'unknown' } :
        { state: 'held', identity, snapshotId: 'snapshot', atMs: 10 } } }),
    current: async () => { at += 2; if (current === 'throw') throw Error('SECRET-CURRENT'); return current === 'current' },
    db: { rpc: async (name, args) => {
      rpcCalls++; at += delay
      if (name === 'admit_resource_task_launch') {
        if (admission === 'throw') throw Error('SECRET-RPC')
        if (admission === 'timeout') return new Promise(() => {})
        if (admission === 'refused') return { data: { admitted: false, reason_code: 'SECRET-REASON' } }
        return { data: { admitted: true, task_id: args.p_task_id, session_id: args.p_session_id, project_id: id(4),
          task_run_id: id(5), run_ordinal: 1, receipt_seq: 2, instruction: 'SECRET-INSTRUCTION',
          resource_reservation: { reservation_id: args.p_binding.reservationId, state: 'held', run_ordinal: 1 } } }
      }
      if (settlement === 'throw') throw Error('SECRET-SETTLE')
      return { data: { released: settlement === 'released', receipt_seq: 3 } }
    } } }
  return { input, deps, sink, adapter: createResourceLaunchAdapter(deps), rpcCalls: () => rpcCalls }
}
function row(overrides = {}) {
  return { attemptDigest: hash(['attempt']), phase: 'admission', outcome: 'accepted', reason: 'admitted', durationMs: 10,
    requested: vector(1), reserved: vector(1), snapshotDigest: hash(['snapshot']), policyDigest: policy, ...overrides }
}
const manifest = evidence => ({ mode: 'synthetic', taskSetDigest: hash(['fixed task']), acceptanceDigest: hash(['same assertions']),
  environmentDigest: hash(['fake clock + fake RPC']), policyDigest: policy, sourceDigest: hash(['fixture source']), evidence })

test('real adapter records admission once, currentness condition once, and confirmed cancellation/release', async () => {
  const f = fixture(), a = await f.adapter.admit(f.input)
  assert.equal(a.admitted, true)
  assert.equal((await f.adapter.admit(f.input)).receipt, a.receipt)
  assert.equal(await f.adapter.current(a.receipt), true)
  assert.equal(await f.adapter.current(a.receipt), true)
  assert.equal(await f.adapter.cancelUnbegun(a.receipt), true)
  assert.equal(await f.adapter.releaseCompensated(a.receipt), true)
  const evidence = f.sink.export()
  assert.deepEqual(evidence.records.map(r => r.phase), ['admission', 'currentness', 'cancel', 'release'])
  assert.equal(evidence.coverage.duplicates, 1)
  assert.deepEqual(evidence.records[0], row({ attemptDigest: hash([id(1), id(2), id(3)]),
    snapshotDigest: hash(['host', 'pool', 'revision', 'snapshot']) }))
  const summary = summarizeResourceObservations(evidence)
  assert.equal(summary.attempts, 1); assert.equal(summary.admitted, 1); assert.equal(summary.admissionLatencyMs, 10)
  for (const key of ['queueDelayMs', 'observedResourcePeak', 'energySaved', 'lessonsHelped']) assert.equal(summary[key], null)
  assert.ok(!JSON.stringify(evidence).includes('SECRET'))
})

for (const mode of ['preflight-unknown', 'throw', 'timeout', 'refused']) test(`actual ${mode} admission stays attributable without raw errors`, async () => {
  const f = fixture({ admission: mode }), result = await f.adapter.admit(f.input)
  assert.equal(result.admitted, false)
  const exported = f.sink.export(), event = exported.records[0]
  assert.equal(event.outcome, mode === 'refused' ? 'refused' : 'unknown')
  assert.equal(event.reserved, null)
  assert.equal(event.requested === null, mode === 'preflight-unknown')
  assert.ok(!JSON.stringify(exported).includes('SECRET'))
  assert.equal((await f.adapter.admit(f.input)).reasonCode, result.reasonCode)
  assert.equal(f.sink.export().records.length, 1)
})
for (const current of ['false', 'throw']) test(`actual ${current} currentness retains refusal/unknown distinction`, async () => {
  const f = fixture({ current }), a = await f.adapter.admit(f.input)
  assert.equal(await f.adapter.current(a.receipt), false)
  assert.equal(f.sink.export().records[1].outcome, current === 'false' ? 'refused' : 'unknown')
})
for (const settlement of ['false', 'throw']) test(`unconfirmed ${settlement} settlement is never a released observation`, async () => {
  const f = fixture({ settlement }), a = await f.adapter.admit(f.input)
  assert.equal(await f.adapter.cancelUnbegun(a.receipt), false)
  assert.equal(f.sink.export().records[1].outcome, 'unknown')
})
test('absent, throwing and rejected ordinary Promise sinks cannot change authority', async () => {
  for (const sink of [undefined, { record() { throw Error('SECRET-SINK') } }, { record() { return Promise.reject(Error('SECRET-ASYNC-SINK')) } }]) {
    const f = fixture({ sink })
    if (!sink) delete f.deps.observations
    const adapter = createResourceLaunchAdapter(f.deps), a = await adapter.admit(f.input)
    assert.equal(a.admitted, true); assert.equal(await adapter.current(a.receipt), true)
    assert.equal(await adapter.cancelUnbegun(a.receipt), true)
  }
  await new Promise(resolve => setImmediate(resolve)) // rejected native Promise must not escape Node's handler
})
test('clock gaps/backwards reads are unknown; wall clock is irrelevant', async () => {
  for (const readings of [[5, 4], [NaN, 4], [5, Infinity]]) {
    const f = fixture({ clock: () => readings.shift() }), a = await f.adapter.admit(f.input)
    assert.equal(a.admitted, true)
    assert.equal(summarizeResourceObservations(f.sink.export()).admissionLatencyMs, null)
  }
  assert.equal(resourceObservationDuration(5, 5), 0)
  assert.equal(resourceObservationDuration(null, 5), null)
  const f = fixture({ clock: () => { throw Error('clock unavailable') } })
  assert.equal((await f.adapter.admit(f.input)).admitted, true)
  assert.equal(f.sink.export().records[0].durationMs, null)
  const asyncClock = fixture({ clock: () => Promise.reject(Error('SECRET-CLOCK')) })
  assert.equal((await asyncClock.adapter.admit(asyncClock.input)).admitted, true)
  assert.equal(asyncClock.sink.export().records[0].durationMs, null)
  await new Promise(resolve => setImmediate(resolve))
})
test('dedup does not become independent evidence; overflow and conflicting admission expose incomplete corpus', () => {
  const c = createResourceAttemptObservation(1)
  assert.equal(c.record(row()), 'recorded')
  assert.equal(c.record(row({ durationMs: 99 })), 'duplicate')
  assert.equal(c.record(row({ outcome: 'refused', reason: 'admission-refused' })), 'invalid')
  assert.equal(c.record(row({ attemptDigest: hash(['second']) })), 'overflow')
  const e = c.export()
  assert.deepEqual(e.coverage, { complete: false, duplicates: 1, invalid: 1, dropped: 1 })
  assert.equal(summarizeResourceObservations(e).admissionLatencyMs, 10)
  e.records[0].requested.workerSlots = 99
  assert.equal(c.export().records[0].requested.workerSlots, 1)
})
test('same-condition evidence conflicts are invalid, not fresh corroboration or harmless repeats', () => {
  for (const change of [{ requested: vector(2) }, { reserved: vector(0) }, { snapshotDigest: hash(['different']) }, { policyDigest: hash(['different']) }]) {
    const c = createResourceAttemptObservation(10)
    assert.equal(c.record(row()), 'recorded')
    assert.equal(c.record(row(change)), 'invalid')
    assert.equal(c.export().coverage.complete, false)
    assert.equal(c.export().coverage.duplicates, 0)
  }
})
test('strict local receipt rejects getters, secrets, extra properties, bogus enums and malformed quantities', () => {
  let reads = 0
  const getter = row(); Object.defineProperty(getter, 'requested', { get() { reads++; return vector(1) } })
  const attacks = [getter, row({ reason: 'SECRET-REASON' }), { ...row(), token: 'SECRET-TOKEN' },
    row({ requested: { ...vector(1), private: 'SECRET' } }), row({ durationMs: NaN }), row({ reserved: vector(2) }),
    { ...row(), lesson: { confidence: 1, adopted: true, text: 'SECRET' } }, row({ policyDigest: 'SECRET' }), row({ phase: 'toString' }), row({ reason: '__proto__' })]
  const c = createResourceAttemptObservation(20)
  for (const attack of attacks) assert.equal(c.record(attack), 'invalid')
  assert.equal(reads, 0); assert.equal(c.export().records.length, 0)
  assert.ok(!JSON.stringify(c.export()).includes('SECRET'))
})
test('corpus reducer refuses duplicate or conflicting admission rather than counting mentions', () => {
  const c = createResourceAttemptObservation(10); c.record(row()); const e = c.export()
  e.records.push({ ...e.records[0] })
  assert.throws(() => summarizeResourceObservations(e), /evidence/)
  e.records[1] = row({ outcome: 'refused', reason: 'admission-refused' })
  assert.throws(() => summarizeResourceObservations(e), /evidence/)
  let reads = 0
  Object.defineProperty(e.records, '0', { get() { reads++; return row() } })
  assert.throws(() => summarizeResourceObservations(e), /corpus/)
  assert.equal(reads, 0)
})
test('counterfactual constraints require equivalent manifests, complete timing and outcome coverage', () => {
  const c = createResourceAttemptObservation(10); c.record(row()); const baseline = manifest(c.export())
  for (const key of ['mode', 'taskSetDigest', 'acceptanceDigest', 'environmentDigest']) {
    const changed = { ...baseline, [key]: key === 'mode' ? 'observed' : hash(['different']) }
    assert.equal(compareResourceObservations(baseline, changed).comparable, false)
  }
  const gap = createResourceAttemptObservation(10); gap.record(row({ durationMs: null }))
  assert.equal(compareResourceObservations(baseline, manifest(gap.export())).reason, 'incomplete-evidence')
  const refused = createResourceAttemptObservation(10); refused.record(row({ outcome: 'refused', reason: 'admission-refused' }))
  assert.equal(compareResourceObservations(baseline, manifest(refused.export())).reason, 'outcome-mismatch')
  assert.equal(compareResourceObservations(baseline, { ...baseline, policyDigest: hash(['wrong']) }).comparable, false)
  const result = compareResourceObservations(baseline, baseline)
  assert.equal(result.comparable, true); assert.equal(result.admissionLatencyDeltaMs, 0)
  assert.equal(result.helped, 'not_established'); assert.equal(result.policyPromotion, false)
})
test('bounded synthetic export records before/after actual adapter observations without savings claims', async () => {
  const a = fixture({ delay: 10 }), b = fixture({ delay: 6 })
  await a.adapter.admit(a.input); await b.adapter.admit(b.input)
  const files = ['resourceAttemptObservation.ts', 'resourceLaunchAdapter.ts']
  const sourceDigests = Object.fromEntries(files.map(name => [name, createHash('sha256').update(readFileSync(new URL(`../src/main/${name}`, import.meta.url))).digest('hex')]))
  const before = { ...manifest(a.sink.export()), sourceDigest: hash(Object.values(sourceDigests)) }
  const after = { ...manifest(b.sink.export()), sourceDigest: before.sourceDigest }
  const comparison = compareResourceObservations(before, after)
  assert.equal(comparison.admissionLatencyDeltaMs, -4)
  assert.equal(comparison.helped, 'not_established'); assert.equal(comparison.energySaved, null)
  const artifact = { kind: 'synthetic-resource-observation-fixture', sourceDigests, before, after, comparison,
    limits: ['injected RPC durations, not measured runtime speedup', 'no native, database, provider, energy or lesson-effect acceptance'] }
  const json = JSON.stringify(artifact, null, 2) + '\n'
  assert.ok(Buffer.byteLength(json) < 32_768)
  if (process.env.FABRIC_RESOURCE_OBSERVATION_EXPORT) writeFileSync(process.env.FABRIC_RESOURCE_OBSERVATION_EXPORT, json, { mode: 0o600 })
})
