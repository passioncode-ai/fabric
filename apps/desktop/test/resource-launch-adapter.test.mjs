import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createResourceLaunchAdapter } from '../src/main/resourceLaunchAdapter.ts'
import { createAdmitExisting } from '../src/main/admitExisting.ts'
import { createManagedLaunch } from '../src/main/managedLaunch.ts'
import { LaunchRefusedBeforeSpawn, ProcessLaunchFailure } from '../src/main/launchFailure.ts'

const ids = { estate: '11111111-1111-4111-8111-111111111111', task: '22222222-2222-4222-8222-222222222222',
  session: '33333333-3333-4333-8333-333333333333', project: '44444444-4444-4444-8444-444444444444', run: '55555555-5555-4555-8555-555555555555' }
const vector = (workerSlots = 1) => ({ workerSlots, memoryBytes: 100, diskBytes: 10, cpuMilliCores: 1000 })
const zero = { workerSlots: 0, memoryBytes: 0, diskBytes: 0, cpuMilliCores: 0 }
const input = () => ({ estateId: ids.estate, taskId: ids.task, sessionId: ids.session, actor: { kind: 'system', id: 'chain' }, trigger: 'chain' })
function fixture() {
  const calls = [], sessions = new Map(), f = { calls, sessions, spawned: 0, released: false, current: true, timeoutMs: 50, prepares: 0 }
  const db = { rpc: async (name, args) => {
    calls.push({ name, args: structuredClone(args) })
    if (f.rpc) { const result = f.rpc(name, args); if (result !== undefined) return await result }
    if (name === 'admit_resource_task_launch' || name === 'admit_task_launch') {
      const data = { admitted: true, task_id: args.p_task_id, session_id: args.p_session_id, project_id: ids.project,
        task_run_id: ids.run, run_ordinal: 2, receipt_seq: 12, instruction: 'bounded work', option_id: 'shell' }
      if (name === 'admit_resource_task_launch') data.resource_reservation = { reservation_id: args.p_binding.reservationId, state: 'held', run_ordinal: 2 }
      f.changeReceipt?.(data)
      return { data }
    }
    if (name === 'begin_task_run_launch') return { data: { granted: true, task_run_id: ids.run, session_id: args.p_session_id } }
    if (name === 'validate_task_run_launch') return { data: { valid: true, task_run_id: ids.run, session_id: args.p_session_id } }
    if (name === 'bind_task_run') return { data: { bound: true, task_run_id: ids.run, session_id: args.p_session_id } }
    if (name === 'fail_task_launch') return { data: { compensated: true } }
    if (name === 'release_resource_reservation' || name === 'cancel_resource_admission') { f.released = true; return { data: { released: true, receipt_seq: 20 } } }
    throw Error(`unexpected ${name}`)
  } }
  const deps = { db, timeoutMs: f.timeoutMs, maxEntries: 16,
    prepare: async supplied => {
      f.prepares++; assert.ok(Object.isFrozen(supplied)); assert.ok(Object.isFrozen(supplied.actor))
      const identity = { hostId: 'host', poolId: 'shared', localPolicyRevision: 'policy-1', reservationId: `r-${supplied.sessionId}`,
        attemptId: `a-${supplied.sessionId}`, fence: 2, ownerId: 'agent', role: 'builder', inputDigest: 'a'.repeat(64), scopeDigest: 'b'.repeat(64) }
      const result = { request: { ...identity, demand: vector() }, ownDemand: vector(),
        context: { nowMs: 100, policy: { hostId: 'host', poolId: 'shared', localPolicyRevision: 'policy-1', capacity: vector(4), maxAgeMs: 10 },
          snapshot: { id: 'snapshot', hostId: 'host', poolId: 'shared', localPolicyRevision: 'policy-1', atMs: 100,
            reserved: { ...zero }, observed: { ...zero }, reservedObserved: { ...zero } } },
        checks: { ownership: () => ({ state: 'held', identity, snapshotId: 'snapshot', atMs: 100 }) } }
      f.changePreparation?.(result)
      return result
    },
    current: async (binding, receipt) => {
      calls.push({ name: 'current' }); assert.ok(Object.isFrozen(binding)); assert.ok(Object.isFrozen(binding.identity)); assert.ok(Object.isFrozen(receipt))
      if (f.currentHook) return await f.currentHook(binding, receipt)
      return f.current
    } }
  const adapter = createResourceLaunchAdapter(deps)
  const admit = createAdmitExisting(db, adapter)
  const managed = {
    db, estateId: ids.estate, actor: { kind: 'system', id: 'test' }, authority: () => null, resources: adapter,
    admit: (taskId, sessionId, trigger) => admit({ estateId: ids.estate, taskId, sessionId, trigger, actor: { kind: 'system', id: 'test' } }),
    prepare: async () => {
      if (f.prepareFailure) throw Error('preparation failed')
      return async (sessionId, guard) => {
        if (!await guard()) throw new LaunchRefusedBeforeSpawn(sessionId, 'resource_currentness')
        f.spawned++; sessions.set(sessionId, { running: true })
        if (f.spawnUnknown) throw new ProcessLaunchFailure(sessionId, 'unknown', 'unknown')
        return { sessionId }
      }
    }, track() {}, untrack() {}, get: sessionId => sessions.get(sessionId) ?? null, stop: async () => {},
    dispatch: async () => ({ state: 'delivering', says: 'queued' }),
  }
  return Object.assign(f, { db, deps, adapter, admit, managed })
}
const names = f => f.calls.map(call => call.name)
function noLegacy(f) { assert.equal(names(f).includes('admit_task_launch'), false) }

test('absent adapter is explicitly legacy NOT_ENFORCED and preserves launch', async () => {
  const f = fixture(), legacy = createAdmitExisting(f.db)
  assert.equal(legacy.resourceMode, 'legacy_not_enforced')
  assert.equal((await legacy(input())).admitted, true)
  assert.deepEqual(names(f), ['admit_task_launch'])
})
test('required factory uses R1 and the combined atomic RPC with exact SQL fields', async () => {
  const f = fixture(), outcome = await f.admit(input())
  assert.equal(f.admit.resourceMode, 'required'); assert.equal(outcome.admitted, true); noLegacy(f)
  const call = f.calls[0]
  assert.equal(call.name, 'admit_resource_task_launch')
  assert.deepEqual(Object.keys(call.args.p_binding).sort(), ['reservationId', 'attemptId', 'fence', 'ownerId', 'role', 'inputDigest', 'scopeDigest', 'localPolicyRevision'].sort())
  assert.deepEqual(call.args.p_own_demand, vector()); assert.equal(call.args.p_host, 'host'); assert.equal(call.args.p_pool, 'shared')
  assert.equal(f.adapter.matches(outcome.receipt), true)
})
for (const failure of ['unknown-ownership', 'stale-reading', 'malformed-demand', 'own-demand-over-envelope', 'zero-own-worker']) test(`preflight ${failure} refuses before any RPC`, async () => {
  const f = fixture()
  f.changePreparation = p => {
    if (failure === 'unknown-ownership') p.checks.ownership = () => ({ state: 'unknown' })
    if (failure === 'stale-reading') p.context.snapshot.atMs = 1
    if (failure === 'malformed-demand') p.request.demand.workerSlots = NaN
    if (failure === 'own-demand-over-envelope') p.ownDemand.memoryBytes = 101
    if (failure === 'zero-own-worker') p.ownDemand.workerSlots = 0
  }
  assert.equal((await f.admit(input())).admitted, false); assert.equal(f.calls.length, 0)
})
for (const failure of ['missing-rpc', 'throw', 'timeout', 'empty', 'refused']) test(`required ${failure} never falls back or retries a new attempt`, async () => {
  const f = fixture(); f.rpc = name => {
    if (name !== 'admit_resource_task_launch') return
    if (failure === 'missing-rpc') return { data: null, error: { message: 'private missing SQL function' } }
    if (failure === 'throw') throw Error('private transport')
    if (failure === 'timeout') return new Promise(() => {})
    if (failure === 'empty') return { data: null }
    return { data: { admitted: false, reason_code: 'capacity' } }
  }
  const result = await f.admit(input()); assert.equal(result.admitted, false); assert.equal(result.retryable, false)
  assert.ok(!JSON.stringify(result).includes('private'))
  assert.deepEqual(await f.admit(input()), result); assert.equal(f.calls.length, 1); noLegacy(f)
})
for (const key of ['task_id', 'session_id', 'task_run_id', 'project_id', 'run_ordinal', 'receipt_seq', 'instruction', 'resource_id', 'resource_state', 'resource_ordinal']) test(`malformed ${key} receipt cannot authorize launch`, async () => {
  const f = fixture(); f.changeReceipt = r => {
    if (key === 'resource_id') r.resource_reservation.reservation_id = 'foreign'
    else if (key === 'resource_state') r.resource_reservation.state = 'released'
    else if (key === 'resource_ordinal') r.resource_reservation.run_ordinal = 1
    else r[key] = key.endsWith('_id') ? 'foreign' : null
  }
  assert.equal((await f.admit(input())).admitted, false); noLegacy(f)
})
test('same identity shares one inflight admission; changed estate or actor conflicts', async () => {
  const f = fixture(); const [a, b] = await Promise.all([f.admit(input()), f.admit(input())])
  assert.equal(a.admitted, true); assert.deepEqual(a, b); assert.equal(f.calls.length, 1)
  const changed = input(); changed.actor.id = 'other'; assert.equal((await f.admit(changed)).reasonCode, 'resource_identity_conflict')
  changed.estateId = ids.project; assert.equal((await f.admit(changed)).admitted, false)
})
test('adapter tracked entry limit is explicit and never evicts unknown attempts', async () => {
  const f = fixture(), adapter = createResourceLaunchAdapter({ ...f.deps, maxEntries: 1 })
  await adapter.admit(input()); const next = { ...input(), sessionId: ids.run }
  assert.equal((await adapter.admit(next)).reasonCode, 'resource_adapter_capacity'); assert.equal(f.calls.length, 1)
})
for (const trigger of ['operator', 'routine', 'chain', 'answer']) test(`${trigger} managed launch revalidates resource identity before owned spawn`, async () => {
  const f = fixture(); let admission
  if (trigger === 'chain') { const a = await f.admit(input()); admission = { receipt: a.receipt, sessionId: ids.session } }
  const result = await createManagedLaunch(f.managed)({ taskId: ids.task, trigger, ...(admission ? { admission } : {}) })
  assert.equal(result.started, true); assert.equal(f.spawned, 1); noLegacy(f)
  assert.equal(names(f).filter(n => n === 'admit_resource_task_launch').length, 1)
  assert.ok(names(f).indexOf('current') < names(f).indexOf('validate_task_run_launch'))
  assert.ok(names(f).indexOf('current') < names(f).indexOf('bind_task_run'))
})
for (const preAdmitted of [false, true]) test(`SQL fence changed during async currentness refuses ${preAdmitted ? 'pre-admitted' : 'ordinary'} spawn`, async () => {
  const f = fixture(); let sqlStillValid = true
  f.currentHook = async () => {
    await new Promise(resolve => setImmediate(resolve))
    sqlStillValid = false
    return true // Resource/input refresh succeeded, but SQL authority changed while it waited.
  }
  f.rpc = (name, args) => name === 'validate_task_run_launch'
    ? { data: { valid: sqlStillValid, task_run_id: ids.run, session_id: args.p_session_id } } : undefined
  let admission
  if (preAdmitted) {
    const a = await f.admit(input()); assert.equal(a.admitted, true)
    admission = { receipt: a.receipt, sessionId: ids.session }
  }
  const result = await createManagedLaunch(f.managed)({ taskId: ids.task, trigger: preAdmitted ? 'chain' : 'operator', ...(admission ? { admission } : {}) })
  assert.equal(result.started, false)
  assert.equal(f.spawned, 0, 'a successful refresh cannot reuse the SQL verdict taken before it')
  assert.equal(names(f).includes('bind_task_run'), false)
  assert.ok(names(f).indexOf('validate_task_run_launch') > names(f).indexOf('current'))
  assert.ok(names(f).indexOf('release_resource_reservation') > names(f).indexOf('fail_task_launch'))
})
for (const failure of ['changed', 'throw', 'timeout']) test(`currentness ${failure} prevents spawn and releases only after compensation`, async () => {
  const f = fixture()
  f.currentHook = () => { if (failure === 'throw') throw Error('private proof'); if (failure === 'timeout') return new Promise(() => {}); return false }
  const result = await createManagedLaunch(f.managed)({ taskId: ids.task, trigger: 'operator' })
  assert.equal(result.started, false); assert.equal(f.spawned, 0)
  const order = names(f)
  if (failure === 'timeout') assert.equal(order.includes('release_resource_reservation'), false, 'unsettled currentness retains the shared I/O slot and capacity')
  else assert.ok(order.indexOf('release_resource_reservation') > order.indexOf('fail_task_launch'))
  const failed = f.calls.find(c => c.name === 'fail_task_launch'); assert.equal(failed.args.p_process_started, false)
})
test('a chain cannot supply an untracked legacy or altered receipt in required mode', async () => {
  const f = fixture(), legacy = createAdmitExisting(f.db), a = await legacy(input())
  assert.equal((await createManagedLaunch(f.managed)({ taskId: ids.task, trigger: 'chain', admission: { receipt: a.receipt, sessionId: ids.session } })).started, false)
  assert.equal(names(f).includes('begin_task_run_launch'), false)
})
test('resource-marked receipt refuses when managed currentness dependency is absent', async () => {
  const f = fixture(), a = await f.admit(input()); delete f.managed.resources
  const result = await createManagedLaunch(f.managed)({ taskId: ids.task, trigger: 'chain', admission: { receipt: a.receipt, sessionId: ids.session } })
  assert.equal(result.started, false); assert.equal(f.spawned, 0); assert.equal(names(f).includes('begin_task_run_launch'), false)
})
test('never-begun cancellation asks SQL for proof with exact immutable identity', async () => {
  const f = fixture(); f.rpc = name => name === 'begin_task_run_launch' ? { data: { granted: false, reason_code: 'refused' } } : undefined
  const result = await createManagedLaunch(f.managed)({ taskId: ids.task, trigger: 'operator' })
  assert.equal(result.started, false); assert.equal(f.spawned, 0)
  const admission = f.calls.find(c => c.name === 'admit_resource_task_launch'), cancel = f.calls.find(c => c.name === 'cancel_resource_admission')
  assert.deepEqual(cancel.args, { p_estate: ids.estate, p_reservation: admission.args.p_binding.reservationId, p_run: ids.run, p_session: admission.args.p_session_id, p_fence: '2' })
  assert.equal(names(f).includes('release_resource_reservation'), false)
})
test('lost begin reply does not infer never-spawned; SQL cancellation may refuse', async () => {
  const f = fixture(); f.rpc = name => {
    if (name === 'begin_task_run_launch') throw Error('lost after begin')
    if (name === 'cancel_resource_admission') return { data: { released: false, reason_code: 'resource_execution_unresolved' } }
  }
  const result = await createManagedLaunch(f.managed)({ taskId: ids.task, trigger: 'operator' })
  assert.equal(result.reasonCode, 'launch_receipt_unknown'); assert.equal(f.released, false); assert.equal(f.spawned, 0)
  assert.equal(names(f).includes('fail_task_launch'), false)
})
for (const fault of ['spawn-unknown', 'compensation-lost', 'release-lost']) test(`${fault} cannot claim released capacity`, async () => {
  const f = fixture(); f.spawnUnknown = fault === 'spawn-unknown'; f.prepareFailure = fault !== 'spawn-unknown'
  f.rpc = name => {
    if (fault === 'compensation-lost' && name === 'fail_task_launch') throw Error('lost')
    if (fault === 'release-lost' && name === 'release_resource_reservation') throw Error('lost')
  }
  const result = await createManagedLaunch(f.managed)({ taskId: ids.task, trigger: 'operator' })
  assert.equal(result.reasonCode, 'launch_outcome_unknown'); assert.equal(f.released, false)
  if (fault !== 'release-lost') assert.equal(names(f).includes('release_resource_reservation'), false)
})
test('input and returned receipt mutation cannot change exact cancel identity', async () => {
  const f = fixture(), supplied = input(), pending = f.admit(supplied); supplied.taskId = ids.project; supplied.actor.id = 'changed'
  const outcome = await pending; assert.equal(outcome.admitted, true); assert.ok(Object.isFrozen(outcome.receipt))
  const altered = { ...outcome.receipt, instruction: 'different' }
  assert.equal(f.adapter.matches(altered), false); assert.equal(await f.adapter.cancelUnbegun(altered), false)
  assert.equal(await f.adapter.cancelUnbegun(outcome.receipt), true)
})
test('nested R1 proof routes child allocation to the same SQL parent without a new pool', async () => {
  const f = fixture()
  f.changePreparation = p => {
    const parent = { reservationId: 'parent-reservation', attemptId: 'parent-attempt', fence: 1, rootReservationId: 'root-reservation' }
    p.request.parent = parent
    p.context.snapshot.reserved = { ...p.context.policy.capacity }
    const { demand, parent: ignored, ...identity } = p.request
    p.checks.parent = () => ({ state: 'held', identity, snapshotId: 'snapshot', atMs: 100,
      parent, rootCharged: { ...p.context.policy.capacity }, parentCapacity: { ...p.context.policy.capacity }, remaining: vector() })
  }
  assert.equal((await f.admit(input())).admitted, true)
  assert.equal(f.calls[0].args.p_parent, 'parent-reservation')
  assert.deepEqual(f.calls[0].args.p_demand, vector()); assert.deepEqual(f.calls[0].args.p_own_demand, vector())
  assert.equal(f.calls[0].args.p_pool, 'shared')
})
test('late successful RPC after timeout never enables a later spawn', async () => {
  const f = fixture(); let finish
  f.rpc = name => name === 'admit_resource_task_launch' ? new Promise(resolve => { finish = resolve }) : undefined
  const a = await f.admit(input()); assert.equal(a.admitted, false)
  finish({ data: { admitted: true, task_id: ids.task, task_run_id: ids.run, project_id: ids.project, session_id: ids.session,
    instruction: 'late', run_ordinal: 2, receipt_seq: 12, resource_reservation: { reservation_id: `r-${ids.session}`, state: 'held', run_ordinal: 2 } } })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(await f.admit(input()), a); assert.equal(f.calls.length, 1)
})

// N-020: deadlines bound waiting, while one shared slot bounds actual unsettled work.
for (const first of ['current', 'cancelUnbegun', 'releaseCompensated']) {
  for (const completion of ['resolve', 'reject']) test(`one outstanding entry operation across methods: ${first}, late ${completion}`, async () => {
    const f = fixture(), observations = []
    const adapter = createResourceLaunchAdapter({ ...f.deps, maxEntries: 1, timeoutMs: 5,
      observations: { sink: { record: sample => observations.push(sample) } } })
    const admission = await adapter.admit(input()); assert.equal(admission.admitted, true)
    let finish, requests = 0
    const pending = new Promise((resolve, reject) => { finish = completion === 'resolve' ? resolve : reject })
    f.currentHook = () => { requests++; return pending }
    f.rpc = name => {
      if (name === 'cancel_resource_admission' || name === 'release_resource_reservation') { requests++; return pending }
    }
    const firstResult = adapter[first](admission.receipt)
    const crossMethods = ['current', 'cancelUnbegun', 'releaseCompensated']
    assert.deepEqual(await Promise.all(crossMethods.map(method => adapter[method](admission.receipt))), [false, false, false])
    assert.equal(await firstResult, false)
    for (let repeat = 0; repeat < 3; repeat++) {
      for (const method of crossMethods) assert.equal(await adapter[method](admission.receipt), false)
    }
    assert.equal(requests, 1, 'timeouts and cross-method retries must retain the same unsettled operation slot')
    assert.deepEqual(await adapter.admit(input()), admission, 'cached admission remains available without new I/O')
    assert.equal(f.prepares, 1)
    assert.equal(names(f).filter(name => name === 'admit_resource_task_launch').length, 1)
    const samplesBeforeSettlement = observations.length
    finish(completion === 'reject' ? Error('private late rejection') : first === 'current' ? true : { data: { released: true, receipt_seq: 25 } })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(observations.length, samplesBeforeSettlement, 'late success never adds an accepted diagnostic or permission')
    assert.equal(observations.filter(sample => sample.phase !== 'admission').every(sample => sample.outcome === 'unknown'), true)
    assert.equal(await firstResult, false, 'late proof/release success cannot change the timed-out result')
    f.currentHook = undefined; f.rpc = undefined
    assert.equal(await adapter.current(admission.receipt), true, 'actual settlement permits a fresh independent check')
    assert.equal(await adapter.cancelUnbegun(admission.receipt), true)
    assert.equal(await adapter.releaseCompensated(admission.receipt), true)
  })
}
test('pending operation blocks only its own entry and consumes a late rejection', async () => {
  const f = fixture(), adapter = createResourceLaunchAdapter({ ...f.deps, maxEntries: 2, timeoutMs: 5 })
  const a = await adapter.admit(input()), b = await adapter.admit({ ...input(), sessionId: ids.project })
  let rejectFirst, firstCalls = 0
  f.currentHook = (_binding, receipt) => receipt.session_id === ids.session
    ? (firstCalls++, new Promise((_resolve, reject) => { rejectFirst = reject })) : true
  const waiting = adapter.current(a.receipt)
  assert.equal(await adapter.current(b.receipt), true)
  assert.equal(await adapter.releaseCompensated(b.receipt), true)
  assert.equal(await waiting, false)
  assert.equal(await adapter.current(a.receipt), false); assert.equal(firstCalls, 1)
  rejectFirst(Error('private failed I/O'))
  await new Promise(resolve => setImmediate(resolve))
  f.currentHook = undefined
  assert.equal(await adapter.current(a.receipt), true)
})
