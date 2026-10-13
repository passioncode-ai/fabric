import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assessResourceAdmission } from '../src/shared/resourceAdmission.ts'

const v = (workerSlots = 1, memoryBytes = 100, diskBytes = 10, cpuMilliCores = 1000) => ({ workerSlots, memoryBytes, diskBytes, cpuMilliCores })
const zero = () => v(0, 0, 0, 0)
function fixture() {
  const request = {
    hostId: 'host-a', poolId: 'shared', localPolicyRevision: 'policy-1', reservationId: 'reservation-2', attemptId: 'attempt-2',
    fence: 2, ownerId: 'agent-b', role: 'builder', inputDigest: 'a'.repeat(64), scopeDigest: 'b'.repeat(64), demand: v(),
  }
  const context = {
    nowMs: 1000,
    policy: { hostId: 'host-a', poolId: 'shared', localPolicyRevision: 'policy-1', maxAgeMs: 100, capacity: v(4, 1000, 100, 4000) },
    snapshot: { id: 'snapshot-1', hostId: 'host-a', poolId: 'shared', localPolicyRevision: 'policy-1', atMs: 950, reserved: v(), observed: v(), reservedObserved: v() },
  }
  const { demand, ...identity } = request
  const ownership = { state: 'held', identity, snapshotId: context.snapshot.id, atMs: 950 }
  const checks = { ownership: () => ownership }
  return { request, context, ownership, checks }
}
function run(f) { return assessResourceAdmission(f.request, f.context, f.checks) }
function rejected(f, state = 'refused', reason) {
  const result = run(f)
  assert.equal(result.state, state)
  if (reason) assert.equal(result.reason, reason)
  assert.equal(result.executionAuthorized, false)
  assert.equal(result.reservationRequired, true)
}
function nested() {
  const f = fixture()
  f.request.parent = { reservationId: 'reservation-1', attemptId: 'attempt-1', fence: 1, rootReservationId: 'reservation-1' }
  f.context.snapshot.reserved = v(4, 1000, 100, 4000)
  f.context.snapshot.observed = v()
  f.context.snapshot.reservedObserved = v()
  f.parent = { ...f.ownership, parent: { ...f.request.parent }, rootCharged: v(4, 1000, 100, 4000), parentCapacity: v(4, 1000, 100, 4000), remaining: v(2, 300, 30, 2000) }
  f.checks.parent = () => f.parent
  return f
}
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value) }
  return value
}
for (const role of ['builder', 'reviewer', 'test']) test(`${role} uses the same explicit host/pool model`, () => {
  const f = fixture(); f.request.role = role; f.ownership.identity.role = role
  const result = run(f)
  assert.equal(result.state, 'eligible')
  assert.deepEqual(result.additionalPoolCharge, v())
  assert.deepEqual(result.effectiveUsage, v())
  assert.equal(result.executionAuthorized, false)
  assert.equal(result.reservationRequired, true)
})
test('unreserved observed work consumes capacity, covered work is counted once', () => {
  const f = fixture(); f.context.snapshot.observed = v(2, 200, 20, 2000)
  assert.deepEqual(run(f).effectiveUsage, v(2, 200, 20, 2000))
  f.context.policy.capacity = v(2, 200, 20, 2000)
  rejected(f, 'refused', 'pool-capacity-exhausted')
})
test('exact boundary fits and zero overlap is explicitly supported', () => {
  const f = fixture(); f.context.snapshot.reservedObserved = zero(); f.context.policy.capacity = v(3, 300, 30, 3000)
  assert.equal(run(f).state, 'eligible')
})
for (const key of ['workerSlots', 'memoryBytes', 'diskBytes', 'cpuMilliCores']) {
  for (const bad of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null, undefined]) test(`${key} rejects ${String(bad)} demand`, () => {
    const f = fixture(); f.request.demand[key] = bad; rejected(f)
  })
  test(`${key} independently refuses insufficient free capacity`, () => {
    const f = fixture(); f.context.policy.capacity[key] = f.request.demand[key]; rejected(f, 'refused', 'pool-capacity-exhausted')
  })
  test(`${key} rejects unsafe accounted sum`, () => {
    const f = fixture(); f.context.snapshot.reserved[key] = Number.MAX_SAFE_INTEGER; f.context.snapshot.observed[key] = 1; f.context.snapshot.reservedObserved[key] = 0
    rejected(f, 'refused', 'accounting-overflow')
  })
}
for (const [label, mutate, state, reason] of [
  ['zero worker slot', f => { f.request.demand.workerSlots = 0 }, 'refused', 'worker-slot-required'],
  ['unsupported dimension', f => { f.request.demand.gpu = 1 }, 'refused', 'unsupported-field'],
  ['missing dimension', f => { delete f.request.demand.diskBytes }, 'refused', 'missing-field'],
  ['caller ownership assertion', f => { f.request.ownsScope = true }, 'refused', 'unsupported-field'],
  ['missing snapshot', f => { delete f.context.snapshot }, 'unknown', 'reading-unavailable'],
  ['null observation', f => { f.context.snapshot.observed = null }, 'unknown', 'reading-unavailable'],
  ['future snapshot', f => { f.context.snapshot.atMs = 1001 }, 'unknown', 'future-evidence'],
  ['stale snapshot', f => { f.context.snapshot.atMs = 899 }, 'unknown', 'stale-evidence'],
  ['stale ownership', f => { f.ownership.atMs = 899 }, 'unknown', 'stale-evidence'],
  ['future ownership', f => { f.ownership.atMs = 1001 }, 'unknown', 'future-evidence'],
  ['invalid now', f => { f.context.nowMs = NaN }, 'refused', 'invalid-integer'],
  ['invalid freshness policy', f => { f.context.policy.maxAgeMs = -1 }, 'refused', 'invalid-integer'],
  ['revision mismatch', f => { f.request.localPolicyRevision = 'policy-2' }, 'refused', 'policy-scope-mismatch'],
  ['foreign host', f => { f.request.hostId = 'host-b' }, 'refused', 'policy-scope-mismatch'],
  ['foreign pool', f => { f.context.snapshot.poolId = 'other' }, 'refused', 'snapshot-scope-mismatch'],
  ['overlap beyond observed', f => { f.context.snapshot.observed = zero() }, 'refused', 'invalid-overlap'],
  ['overlap beyond reservation', f => { f.context.snapshot.reserved = zero() }, 'refused', 'invalid-overlap'],
  ['missing ownership checker', f => { delete f.checks.ownership }, 'unknown', 'ownership-unavailable'],
  ['ownership denied', f => { f.ownership.state = 'refused' }, 'refused', 'ownership-refused'],
  ['ownership unknown', f => { f.ownership.state = 'unknown' }, 'unknown', 'evidence-unavailable'],
  ['checker unavailable', f => { f.checks.ownership = () => { throw new Error('secret') } }, 'unknown', 'evidence-unavailable'],
  ['foreign evidence snapshot', f => { f.ownership.snapshotId = 'snapshot-0' }, 'refused', 'evidence-mismatch'],
  ['stale fence', f => { f.ownership.identity.fence = 1 }, 'refused', 'evidence-mismatch'],
  ['changed input', f => { f.ownership.identity.inputDigest = 'c'.repeat(64) }, 'refused', 'evidence-mismatch'],
  ['changed mutable scope', f => { f.ownership.identity.scopeDigest = 'c'.repeat(64) }, 'refused', 'evidence-mismatch'],
  ['foreign owner', f => { f.ownership.identity.ownerId = 'agent-a' }, 'refused', 'evidence-mismatch'],
  ['invalid digest', f => { f.request.inputDigest = '../secret' }, 'refused', 'invalid-digest'],
  ['invalid fence', f => { f.request.fence = 0 }, 'refused', 'invalid-integer'],
  ['unsupported role', f => { f.request.role = 'admin' }, 'refused', 'unsupported-role'],
]) test(label, () => { const f = fixture(); mutate(f); rejected(f, state, reason) })
test('exact freshness boundary is accepted', () => { const f = fixture(); f.context.snapshot.atMs = 900; assert.equal(run(f).state, 'eligible') })
test('nested task debits verified remainder without charging root capacity again', () => {
  const f = nested(); const result = run(f)
  assert.equal(result.state, 'eligible'); assert.deepEqual(result.additionalPoolCharge, zero()); assert.deepEqual(result.parentAllocation, f.request.demand)
  assert.deepEqual(result.effectiveUsage, f.context.policy.capacity)
})
for (const [label, mutate, state, reason] of [
  ['missing verifier', f => { delete f.checks.parent }, 'unknown', 'parent-unavailable'],
  ['self reference', f => { f.request.parent.reservationId = f.request.reservationId }, 'refused', 'self-parent'],
  ['root self reference', f => { f.request.parent.rootReservationId = f.request.reservationId }, 'refused', 'self-parent'],
  ['same attempt', f => { f.request.parent.attemptId = f.request.attemptId }, 'refused', 'self-parent'],
  ['wrong parent fence', f => { f.parent.parent.fence = 9 }, 'refused', 'parent-mismatch'],
  ['wrong root', f => { f.parent.parent.rootReservationId = 'other' }, 'refused', 'parent-mismatch'],
  ['foreign pool snapshot', f => { f.parent.snapshotId = 'other' }, 'refused', 'evidence-mismatch'],
  ['stale parent', f => { f.parent.atMs = 800 }, 'unknown', 'stale-evidence'],
  ['unreserved root', f => { f.parent.rootCharged.workerSlots = 5 }, 'refused', 'invalid-parent-accounting'],
  ['unbacked parent envelope', f => { f.parent.parentCapacity.workerSlots = 5 }, 'refused', 'invalid-parent-accounting'],
  ['inflated remainder', f => { f.parent.remaining.workerSlots = 5 }, 'refused', 'invalid-parent-accounting'],
  ['exhausted remainder', f => { f.parent.remaining.diskBytes = 0 }, 'refused', 'parent-capacity-exhausted'],
  ['external pressure still blocks', f => { f.context.snapshot.observed = v(2, 200, 20, 2000) }, 'refused', 'pool-capacity-exhausted'],
]) test(`nested: ${label}`, () => { const f = nested(); mutate(f); rejected(f, state, reason) })
test('deeper child consumes a parent envelope in the same root', () => {
  const f = nested(); f.request.parent.rootReservationId = 'root-0'; f.parent.parent.rootReservationId = 'root-0'
  f.parent.parentCapacity = v(2, 300, 30, 2000)
  assert.equal(run(f).state, 'eligible')
})
test('inputs are immutable and callbacks receive frozen copied identities', () => {
  const f = nested(); const before = structuredClone({ request: f.request, context: f.context, parent: f.parent, ownership: f.ownership })
  const original = f.checks.ownership
  f.checks.ownership = expected => { assert.ok(Object.isFrozen(expected)); assert.notEqual(expected, f.request); return original() }
  freeze(f); const result = run(f); assert.equal(result.state, 'eligible')
  result.demand.workerSlots = 99; result.parent.fence = 99
  assert.deepEqual({ request: f.request, context: f.context, parent: f.parent, ownership: f.ownership }, before)
})
test('getters are rejected without invoking them and errors do not leak their contents', () => {
  const f = fixture(); let called = false
  Object.defineProperty(f.request.demand, 'workerSlots', { get() { called = true; throw new Error('secret') } })
  rejected(f); assert.equal(called, false); assert.ok(!JSON.stringify(run(f)).includes('secret'))
})
test('untrusted shapes and unsupported protocol fields never authorize work', () => {
  for (const value of [null, [], true, 'request', new Date(), { protocolRevision: 'v1' }]) {
    const f = fixture(); f.request = value; assert.notEqual(run(f).state, 'eligible')
  }
})
test('a throwing proxy fails closed without propagating its error', () => {
  const f = fixture(); f.request = new Proxy({}, { getPrototypeOf() { throw new Error('secret') } })
  rejected(f, 'unknown', 'evidence-unavailable')
})
for (const key of ['reservationId', 'attemptId', 'hostId', 'poolId', 'localPolicyRevision']) test(`ownership binds ${key}`, () => {
  const f = fixture(); f.ownership.identity[key] = 'different'; rejected(f, 'refused', 'evidence-mismatch')
})
test('public protocol revision is not accepted as a local policy revision', () => {
  const f = fixture(); f.context.policy.protocolRevision = 'fabric-resources/1'; rejected(f, 'refused', 'unsupported-field')
})
test('every required snapshot vector must be explicit, including zero overlap', () => {
  for (const key of ['reserved', 'observed', 'reservedObserved']) {
    const f = fixture(); delete f.context.snapshot[key]; rejected(f, 'refused', 'missing-field')
  }
})
test('unknown parent result is not a fresh pool or zero allocation', () => {
  const f = nested(); f.checks.parent = () => ({ state: 'unknown' }); rejected(f, 'unknown', 'evidence-unavailable')
})
test('symbol fields and asynchronous proof are unsupported and cannot admit', () => {
  const f = fixture(); f.request[Symbol('extra')] = true; rejected(f)
  const other = fixture(); other.checks.ownership = () => Promise.resolve(other.ownership); rejected(other)
})
for (const checker of ['ownership', 'parent']) test(`rejected async ${checker} proof cannot terminate the host`, async () => {
  const { spawnSync } = await import('node:child_process')
  const f = checker === 'parent' ? nested() : fixture()
  const script = `
    import { assessResourceAdmission } from ${JSON.stringify(new URL('../src/shared/resourceAdmission.ts', import.meta.url).href)};
    const f = ${JSON.stringify(f)};
    const checks = { ownership: () => f.ownership, parent: () => f.parent };
    checks[${JSON.stringify(checker)}] = async () => { throw new Error('synthetic proof failure'); };
    const result = assessResourceAdmission(f.request, f.context, checks);
    if (result.state === 'eligible') process.exit(2);
    await new Promise(resolve => setImmediate(resolve));
  `
  const child = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { encoding: 'utf8' })
  assert.equal(child.status, 0, child.stderr)
})
test('proof thenable accessors are not invoked when unsupported evidence is refused', () => {
  for (const checker of ['ownership', 'parent']) {
    const f = checker === 'parent' ? nested() : fixture(); let called = false
    const unsupported = Object.defineProperty({}, 'then', { get() { called = true; throw new Error('must not execute') } })
    f.checks[checker] = () => unsupported
    rejected(f); assert.equal(called, false)
  }
})
