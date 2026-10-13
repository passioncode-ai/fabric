// #region resource-pool-publisher — docs: docs/execution/harness-waves/resource-pool-publisher.md#contract
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResourceVector } from '../shared/resourceAdmission.ts'
import { readResourceHostPolicy, resourceData, resourceDigest, resourceId, resourceInteger, resourceAxes } from './resourceHostPolicy.ts'
import { createResourceHostSampler, type ResourceHostSamplerDeps, type ResourceHostObservation } from './resourceHostSampler.ts'

export interface ResourcePoolPublisherDeps {
  db: Pick<SupabaseClient, 'from' | 'rpc'>
  rawPolicy: unknown
  /** Installation identity from the trusted host producer, never task input. */
  trustedHostId: string
  samplerDeps: ResourceHostSamplerDeps
  timeoutMs: number
  now?: () => number
}
export interface ResourcePoolExpected { revision: string; generation: number }
export interface ResourcePoolPublication {
  state: 'configured' | 'published' | 'refused' | 'unknown'
  reason: string
  generation: number | null
  snapshotId?: string
  executionAuthorized: false
}
const columns = 'host_id,pool_id,policy_revision,configuration_generation,capacity,max_age_ms,observed,observed_at'
function vector(raw: unknown): ResourceVector {
  const r = resourceData(raw, resourceAxes)
  return Object.fromEntries(resourceAxes.map(k => [k, resourceInteger(r[k])])) as unknown as ResourceVector
}
function sameVector(a: ResourceVector, b: ResourceVector) { return resourceAxes.every(k => a[k] === b[k]) }
/** Exact-millisecond ISO timestamps, including PostgreSQL session offsets.
 * Validate the local calendar before applying the offset: Date.parse alone
 * normalizes invalid dates. Unknown -00:00 and offsets beyond +/-14:00 refuse. */
function epoch(raw: unknown): number {
  if (typeof raw !== 'string') throw Error('invalid observation timestamp')
  const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?(Z|[+-]\d\d:\d\d)$/.exec(raw)
  if (!m || (m[2]?.slice(3) ?? '').replaceAll('0', '') !== '' || m[3] === '-00:00') throw Error('invalid observation timestamp')
  const canonical = `${m[1]}.${(m[2] ?? '').padEnd(3, '0').slice(0, 3)}Z`, local = Date.parse(canonical)
  if (!Number.isSafeInteger(local) || new Date(local).toISOString() !== canonical) throw Error('invalid observation timestamp')
  let offset = 0
  if (m[3] !== 'Z') {
    const hours = Number(m[3].slice(1,3)), minutes = Number(m[3].slice(4,6))
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) throw Error('invalid observation timestamp')
    offset = (hours * 60 + minutes) * 60000 * (m[3][0] === '+' ? 1 : -1)
  }
  const at = local - offset
  if (!Number.isSafeInteger(at) || at < 0 || new Date(at + offset).toISOString() !== canonical) throw Error('invalid observation timestamp')
  return at
}
function nowValue(read: () => number): number {
  const value: unknown = read()
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Promise.prototype && !Object.getOwnPropertyDescriptor(value, 'constructor')) void Promise.prototype.then.call(value, undefined, () => {})
  return resourceInteger(value)
}
interface PoolRow { revision: string; generation: number; capacity: ResourceVector; maxAgeMs: number; observed: ResourceVector | null; atMs: number | null }
interface Sample { vector: ResourceVector; atMs: number; bootId: string; snapshotId: string }
type Intent = { kind: 'configure'; generation: number } | { kind: 'observe'; generation: number; sample: Sample }

/** One fixed policy and one long-lived sampler/publisher per pool. This writes
 * pending107's service-only commands; it neither installs that DDL nor admits work.
 * An ambiguous write retains its exact generation/intent until read reconciliation.
 */
export function createResourcePoolPublisher(deps: ResourcePoolPublisherDeps) {
  const policy = readResourceHostPolicy(deps.rawPolicy, deps.trustedHostId)
  const sampler = createResourceHostSampler(policy, deps.trustedHostId, deps.samplerDeps)
  const db = deps.db, identity = deps.samplerDeps.identity, now = deps.now ?? Date.now
  const timeoutMs = resourceInteger(deps.timeoutMs, 1, 30000), policyDigest = resourceDigest(policy)
  // readResourceHostPolicy produces a fixed field/vector/profile order and
  // normalized disk path. Version this binding if that canonical schema changes.
  const bindingRevision = `policy-sha256-v1:${policyDigest}`
  let generation: number | null = null, intent: Intent | null = null, busy = false
  const result = (state: ResourcePoolPublication['state'], reason: string, snapshotId?: string): ResourcePoolPublication =>
    ({ state, reason, generation, executionAuthorized: false, ...(snapshotId ? { snapshotId } : {}) })
  function row(raw: unknown): PoolRow | null {
    if (raw === null) return null
    const r = resourceData(raw, columns.split(','))
    if (r.host_id !== policy.hostId || r.pool_id !== policy.poolId) throw Error('pool identity mismatch')
    const observed = r.observed === null ? null : vector(r.observed), atMs = r.observed_at === null ? null : epoch(r.observed_at)
    if ((observed === null) !== (atMs === null)) throw Error('incomplete pool observation')
    return { revision: resourceId(r.policy_revision), generation: resourceInteger(r.configuration_generation, 1),
      capacity: vector(r.capacity), maxAgeMs: resourceInteger(r.max_age_ms, 1), observed, atMs }
  }
  function matches(r: PoolRow) { return r.revision === bindingRevision && r.maxAgeMs === policy.maxAgeMs && sameVector(r.capacity, policy.capacity) }
  function fresh(at: number) { const time = nowValue(now); return at <= time && time - at <= policy.maxAgeMs }
  function sample(raw: ResourceHostObservation): Sample {
    const r = resourceData(raw, ['state','reason','observed','axes','physical','hostId','poolId','localPolicyRevision','policyDigest','snapshotId','atMs','completedAtMs','durationMs','source'])
    if (r.state !== 'observed' || r.reason !== 'complete' || r.hostId !== policy.hostId || r.poolId !== policy.poolId ||
        r.localPolicyRevision !== policy.localPolicyRevision || r.policyDigest !== policyDigest) throw Error('sample unavailable')
    const observed = vector(r.observed), axes = vector(r.axes), physical = resourceData(r.physical, ['memoryTotalBytes','diskTotalBytes','cpuMilliCores'])
    // No overcommit contract is installed: a finite configured ceiling is not
    // evidence that this physical host can supply it. Worker slots are logical.
    if (policy.capacity.memoryBytes > resourceInteger(physical.memoryTotalBytes,1) ||
        policy.capacity.diskBytes > resourceInteger(physical.diskTotalBytes,1) ||
        policy.capacity.cpuMilliCores > resourceInteger(physical.cpuMilliCores,1)) throw Error('policy exceeds physical host')
    if (!sameVector(observed, axes) || observed.memoryBytes > resourceInteger(physical.memoryTotalBytes,1) ||
        observed.diskBytes > resourceInteger(physical.diskTotalBytes,1) || observed.cpuMilliCores > resourceInteger(physical.cpuMilliCores,1)) throw Error('invalid physical sample')
    const source = resourceData(r.source, ['bootId','diskDeviceId','diskPathDigest','cpuTopologyDigest'])
    if (source.diskDeviceId !== policy.diskDeviceId || source.diskPathDigest !== resourceDigest(policy.diskPath) ||
        typeof source.cpuTopologyDigest !== 'string' || !/^[a-f0-9]{64}$/.test(source.cpuTopologyDigest)) throw Error('sample source mismatch')
    const atMs = resourceInteger(r.atMs), completed = resourceInteger(r.completedAtMs)
    if (completed < atMs || completed > nowValue(now) || !fresh(atMs) || typeof r.durationMs !== 'number' ||
        !Number.isFinite(r.durationMs) || r.durationMs < policy.sampleWindowMs || r.durationMs > policy.maxAgeMs ||
        r.snapshotId !== resourceDigest([policyDigest, atMs, completed, source, axes])) throw Error('sample evidence mismatch')
    // Conversion is validated before a command is dispatched.
    epoch(new Date(atMs).toISOString())
    return { vector: observed, atMs, bootId: resourceId(source.bootId), snapshotId: r.snapshotId as string }
  }
  async function execute(work: (call: <T>(fn: () => PromiseLike<T> | T) => Promise<T>) => Promise<ResourcePoolPublication>) {
    if (false) return result('unknown','io_outstanding')
    busy = true
    const deadline = performance.now() + timeoutMs
    const outstanding = new Set<Promise<unknown>>()
    let active = true, finished = false
    const release = () => { if (finished && outstanding.size === 0) busy = false }
    async function call<T>(fn: () => PromiseLike<T> | T): Promise<T> {
      const remaining = deadline - performance.now()
      if (!active || remaining <= 0) { active = false; throw Error('publisher deadline') }
      const pending = Promise.resolve().then(() => { if (!active) throw Error('publisher ended'); return fn() })
      outstanding.add(pending)
      const settled = () => { outstanding.delete(pending); release() }
      void pending.then(settled, settled)
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const value = await Promise.race([pending,new Promise<never>((_, reject) => { timer = setTimeout(() => { active = false; reject(Error('publisher deadline')) }, remaining) })])
        if (!active || performance.now() >= deadline) { active = false; throw Error('publisher deadline') }
        return value
      } finally { if (timer) clearTimeout(timer) }
    }
    try { return await work(call) }
    catch { /* Safe structured uncertainty; connection errors and host paths are not diagnostic output. */ return result('unknown',intent ? 'write_unconfirmed' : 'unavailable') }
    finally { active = false; finished = true; release() }
  }
  type Call = Parameters<Parameters<typeof execute>[0]>[0]
  async function read(call: Call): Promise<PoolRow | null> {
    const answer = await call(() => db.from('resource_pools').select(columns).eq('host_id',policy.hostId).eq('pool_id',policy.poolId).maybeSingle())
    if (answer.error) throw Error('pool read unavailable')
    return row(answer.data)
  }
  async function sameHost(call: Call, bootId?: string): Promise<boolean> {
    const r = resourceData(await call(identity), ['hostId','bootId'])
    return r.hostId === policy.hostId && typeof r.bootId === 'string' && resourceId(r.bootId) === r.bootId && (bootId === undefined || r.bootId === bootId)
  }
  async function reconcileWith(call: Call): Promise<ResourcePoolPublication> {
    if (!intent) return result('refused','no_uncertain_write')
    const pending = intent, actual = await read(call)
    if (!actual || !matches(actual) || actual.generation !== pending.generation) return result('unknown','write_superseded_or_unobserved')
    if (pending.kind === 'configure') {
      if (!await sameHost(call)) return result('unknown','host_changed')
      generation = actual.generation; intent = null
      return result('configured','policy_readback')
    }
    if (!actual.observed || actual.atMs !== pending.sample.atMs || !sameVector(actual.observed,pending.sample.vector)) return result('unknown','observation_superseded_or_unobserved')
    const currentHost = await sameHost(call,pending.sample.bootId), current = fresh(pending.sample.atMs)
    // The exact write was observed. A stale or restarted-host sample is still not ready.
    intent = null
    return currentHost && current ? result('published','observation_readback',pending.sample.snapshotId) : result('refused',currentHost ? 'observation_stale' : 'host_changed')
  }
  return { policy, bindingRevision,
    configure(expected?: ResourcePoolExpected): Promise<ResourcePoolPublication> {
      return execute(async call => {
        if (intent) return result('unknown','reconcile_required')
        let expectation: ResourcePoolExpected | null = null
        if (expected !== undefined) {
          const r = resourceData(expected,['revision','generation'])
          expectation = { revision:resourceId(r.revision),generation:resourceInteger(r.generation,1) }
        }
        if (!await sameHost(call)) return result('refused','host_changed')
        const prior = await read(call)
        if (prior && matches(prior)) {
          if (generation !== null && generation !== prior.generation) return result('refused','generation_changed')
          generation = prior.generation; return result('configured','existing_policy')
        }
        if (generation !== null) return result('refused','generation_changed')
        if (prior ? !expectation || prior.revision !== expectation.revision || prior.generation !== expectation.generation || prior.revision === bindingRevision : expectation !== null) return result('refused','configuration_conflict')
        const nextGeneration = prior ? resourceInteger(prior.generation + 1,1) : 1
        intent = { kind:'configure',generation:nextGeneration }
        const answer = await call(() => db.rpc('configure_resource_pool',{p_host:policy.hostId,p_pool:policy.poolId,p_revision:bindingRevision,
          p_capacity:{...policy.capacity},p_max_age_ms:policy.maxAgeMs,p_expected_revision:expectation?.revision ?? null,p_expected_generation:expectation?.generation ?? null}))
        if (answer.error || typeof answer.data !== 'boolean') throw Error('configuration unconfirmed')
        if (!answer.data) { intent = null; return result('refused','configuration_refused') }
        return reconcileWith(call)
      })
    },
    publish(): Promise<ResourcePoolPublication> {
      return execute(async call => {
        if (intent) return result('unknown','reconcile_required')
        if (generation === null) return result('refused','not_configured')
        const before = await read(call)
        if (!before || !matches(before) || before.generation !== generation) return result('refused','generation_changed')
        const measured = sample(await call(() => sampler.sample()))
        const after = await read(call)
        if (!after || !matches(after) || after.generation !== generation || !await sameHost(call,measured.bootId)) return result('refused','generation_or_host_changed')
        if (!fresh(measured.atMs)) return result('refused','observation_stale')
        intent = { kind:'observe',generation,sample:measured }
        const answer = await call(() => db.rpc('observe_resource_pool',{p_host:policy.hostId,p_pool:policy.poolId,p_revision:bindingRevision,
          p_observed:{...measured.vector},p_at:new Date(measured.atMs).toISOString(),p_configuration_generation:generation}))
        if (answer.error || typeof answer.data !== 'boolean') throw Error('observation unconfirmed')
        if (!answer.data) { intent = null; return result('refused','observation_refused') }
        return reconcileWith(call)
      })
    },
    reconcile(): Promise<ResourcePoolPublication> { return execute(reconcileWith) },
  }
}
// #endregion resource-pool-publisher
