// #region resource-pool-accounting — docs: docs/execution/harness-waves/resource-pool-accounting.md#contract
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResourceVector } from '../shared/resourceAdmission.ts'
import { readResourceHostPolicy, resourceData, resourceDigest, resourceInteger, resourceAxes } from './resourceHostPolicy.ts'

export interface ResourcePoolAccountingDeps {
  db: Pick<SupabaseClient, 'rpc'>
  rawPolicy: unknown
  /** Independently supplied trusted installation identity, not task input. */
  trustedHostId: string
  expectedGeneration: number
  maxRoots: number
  timeoutMs: number
  /** Epoch milliseconds in the database clock domain; skew refuses evidence. */
  now?: () => number
}
export interface ResourcePoolAccountingSnapshot {
  hostId: string
  poolId: string
  bindingRevision: string
  configurationGeneration: number
  capacity: ResourceVector
  maxAgeMs: number
  observed: ResourceVector
  observedAtMs: number
  reserved: ResourceVector
  rootCount: number
  snapshotAtMs: number
}
export type ResourcePoolAccountingResult =
  | { state: 'observed'; snapshot: Readonly<ResourcePoolAccountingSnapshot>; snapshotId: string; overlapCredit: 'none-conservative'; executionAuthorized: false }
  | { state: 'unknown' | 'refused'; reason: string; executionAuthorized: false }
const keys = ['state','hostId','poolId','bindingRevision','configurationGeneration','capacity','maxAgeMs','observed','observedAtMs','reserved','rootCount','snapshotAtMs']
const reasons = {
  unknown: ['pool_missing','root_bound_exceeded','reserved_overflow','observation_missing','observation_stale'],
  refused: ['invalid_request','policy_changed','capacity_exceeded'],
}
function vector(raw: unknown): ResourceVector {
  const row = resourceData(raw, resourceAxes)
  return Object.fromEntries(resourceAxes.map(k => [k,resourceInteger(row[k])])) as unknown as ResourceVector
}
function nowValue(read: () => number): number {
  const value: unknown = read()
  // Trusted synchronous DI can accidentally be async. Consume ordinary native
  // rejection without invoking arbitrary thenable accessors or subclass hooks.
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Promise.prototype && !Object.getOwnPropertyDescriptor(value,'constructor')) void Promise.prototype.then.call(value,undefined,()=>{})
  return resourceInteger(value)
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value) }
  return value
}
/** Observation only. Each instance owns one bounded, retained RPC slot. Its
 * timeout stops waiting; it cannot cancel PostgreSQL or grant launch authority. */
export function createResourcePoolAccountingReader(deps: ResourcePoolAccountingDeps) {
  const policy = readResourceHostPolicy(deps.rawPolicy,deps.trustedHostId)
  const bindingRevision = `policy-sha256-v1:${resourceDigest(policy)}`
  const generation = resourceInteger(deps.expectedGeneration,1)
  const maxRoots = resourceInteger(deps.maxRoots,1,1024), timeoutMs = resourceInteger(deps.timeoutMs,1,30000)
  const db = deps.db, now = deps.now ?? Date.now
  let busy = false
  const result = (state: 'unknown'|'refused',reason: string): ResourcePoolAccountingResult => Object.freeze({state,reason,executionAuthorized:false})
  function parse(raw: unknown, startedAt: number): ResourcePoolAccountingResult {
    // Inspect only data descriptors; raw errors or arbitrary getter content never escape.
    if (!raw || typeof raw !== 'object') throw Error('accounting unavailable')
    const state: unknown = Object.getOwnPropertyDescriptor(raw,'state')?.value
    if (state === 'unknown' || state === 'refused') {
      const r = resourceData(raw,['state','reason'])
      if (typeof r.reason !== 'string' || !reasons[state].includes(r.reason)) throw Error('accounting invalid')
      return result(state,r.reason)
    }
    const r = resourceData(raw,keys)
    if (r.state !== 'observed') throw Error('accounting invalid')
    if (r.hostId !== policy.hostId || r.poolId !== policy.poolId || r.bindingRevision !== bindingRevision ||
        r.configurationGeneration !== generation || r.maxAgeMs !== policy.maxAgeMs) return result('refused','policy_changed')
    const capacity = vector(r.capacity), observed = vector(r.observed), reserved = vector(r.reserved)
    if (resourceAxes.some(k => capacity[k] !== policy.capacity[k])) return result('refused','policy_changed')
    const rootCount = resourceInteger(r.rootCount,0,maxRoots), observedAtMs = resourceInteger(r.observedAtMs), snapshotAtMs = resourceInteger(r.snapshotAtMs)
    if (rootCount === 0 && resourceAxes.some(k => reserved[k] !== 0)) throw Error('inconsistent accounting')
    const wall = nowValue(now)
    if (wall < startedAt || observedAtMs > snapshotAtMs || snapshotAtMs > wall || wall-observedAtMs > policy.maxAgeMs) return result('unknown','observation_stale')
    for (const k of resourceAxes) {
      const sum = BigInt(reserved[k])+BigInt(observed[k])
      if (sum > BigInt(Number.MAX_SAFE_INTEGER)) return result('unknown','reserved_overflow')
      if (sum > BigInt(capacity[k])) return result('refused','capacity_exceeded')
    }
    const snapshot = freeze({hostId:policy.hostId,poolId:policy.poolId,bindingRevision,configurationGeneration:generation,
      capacity,maxAgeMs:policy.maxAgeMs,observed,observedAtMs,reserved,rootCount,snapshotAtMs})
    return freeze({state:'observed',snapshot,snapshotId:resourceDigest(['resource-pool-accounting-v1',snapshot]),overlapCredit:'none-conservative',executionAuthorized:false})
  }
  async function read(): Promise<ResourcePoolAccountingResult> {
    if (busy) return result('unknown','io_outstanding')
    busy = true
    let settled = false, finished = false, dispatched = false, timer: ReturnType<typeof setTimeout> | undefined
    const release = () => { if (settled && finished) busy = false }
    try {
      const startedAt = nowValue(now) // Refuse a broken local clock before dispatching any I/O.
      const deadline = performance.now()+timeoutMs
      dispatched = true
      const pending = Promise.resolve().then(()=>db.rpc('read_resource_pool_accounting',{
        p_host:policy.hostId,p_pool:policy.poolId,p_revision:bindingRevision,p_configuration_generation:generation,p_max_roots:maxRoots,
      }))
      void pending.then(()=>{settled=true;release()},()=>{settled=true;release()})
      const reply = await Promise.race([pending,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('accounting deadline')),timeoutMs)})])
      if (performance.now()>=deadline || !reply || reply.error) return result('unknown','unavailable')
      return parse(reply.data,startedAt)
    } catch {
      // Structured uncertainty contains no transport details, host paths or credentials.
      return result('unknown','unavailable')
    } finally {
      if (timer) clearTimeout(timer)
      finished = true
      // A pre-dispatch clock exception created no pending I/O.
      if (!dispatched) settled = true
      release()
    }
  }
  return Object.freeze({policy,bindingRevision,read})
}
// #endregion resource-pool-accounting
