// #region resource-reconciliation — docs: docs/execution/harness-waves/resource-reconciliation.md#contract
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ResourceRecoveryScope { estateId: string; hostId: string; poolId: string }
export interface ResourceRecoveryCursor extends ResourceRecoveryScope { afterSeq: number }
export interface ResourceRecoveryIdentity {
  reservationId: string; runId: string; sessionId: string; runOrdinal: number; admittedSeq: number; fence: number
}
export interface ResourceRecoveryItem extends ResourceRecoveryIdentity {
  state: 'released' | 'retained' | 'unknown'
  reason: string
  receiptSeq?: number
}
export interface ResourceRecoveryResult {
  /** Complete means this bounded scan reached the end of its held-row query,
   * not that all resources ended or that a concurrent/new reservation was seen. */
  scan: 'complete' | 'partial' | 'unavailable'
  next: ResourceRecoveryCursor | null
  items: ResourceRecoveryItem[]
  reason: string
}
export interface ResourceReconciliationDeps extends ResourceRecoveryScope {
  db: Pick<SupabaseClient, 'from' | 'rpc'>
  pageSize: number
  maxPages: number
  /** Whole sweep deadline, including readback. */
  timeoutMs: number
  /** Trusted continuation checkpoint, not caller authority or a snapshot token. */
  initialCursor?: ResourceRecoveryCursor | null
}
const columns = 'reservation_id,estate_id,host_id,pool_id,task_run_id,session_id,run_ordinal,admitted_seq,state,binding,released_seq'
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v)
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v)
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Object.getPrototypeOf(v) !== Object.prototype) throw Error('invalid record')
  const out: Record<string, unknown> = Object.create(null)
  for (const [key, d] of Object.entries(Object.getOwnPropertyDescriptors(v))) {
    if (!('value' in d)) throw Error('invalid record')
    out[key] = d.value
  }
  if (Reflect.ownKeys(v).length !== Object.keys(out).length) throw Error('invalid record')
  return out
}

/** Internal, opt-in recovery only. SQL decides whether exact operational proof
 * permits release; this module never signals, cancels, observes or ends a run. */
export function createResourceReconciliation(deps: ResourceReconciliationDeps) {
  const scope = Object.freeze({ estateId: deps.estateId, hostId: deps.hostId, poolId: deps.poolId })
  const { db, pageSize, maxPages, timeoutMs } = deps
  if (!uuid(scope.estateId) || !id(scope.hostId) || !id(scope.poolId) ||
      !positive(pageSize) || pageSize > 100 || !positive(maxPages) || maxPages > 100 ||
      !positive(timeoutMs) || timeoutMs > 30_000) throw Error('invalid recovery configuration')
  let after: number | null = null
  if (deps.initialCursor != null) {
    const c = record(deps.initialCursor)
    if (c.estateId !== scope.estateId || c.hostId !== scope.hostId || c.poolId !== scope.poolId || !positive(c.afterSeq))
      throw Error('invalid recovery cursor')
    after = c.afterSeq
  }
  const cursor = (): ResourceRecoveryCursor | null => after === null ? null : { ...scope, afterSeq: after }
  function row(raw: unknown, state: 'held' | 'released'): ResourceRecoveryIdentity & { releasedSeq: unknown } {
    const r = record(raw), binding = record(r.binding)
    if (r.estate_id !== scope.estateId || r.host_id !== scope.hostId || r.pool_id !== scope.poolId || r.state !== state ||
        !id(r.reservation_id) || !uuid(r.task_run_id) || !uuid(r.session_id) || !positive(r.run_ordinal) ||
        !positive(r.admitted_seq) || !positive(binding.fence) || binding.reservationId !== r.reservation_id ||
        (state === 'held' && r.released_seq !== null)) throw Error('invalid reservation identity')
    return { reservationId: r.reservation_id, runId: r.task_run_id, sessionId: r.session_id,
      runOrdinal: r.run_ordinal, admittedSeq: r.admitted_seq, fence: binding.fence, releasedSeq: r.released_seq }
  }
  function read() {
    return db.from('resource_reservations').select(columns)
      .eq('estate_id', scope.estateId).eq('host_id', scope.hostId).eq('pool_id', scope.poolId)
  }
  let inflight: Promise<ResourceRecoveryResult> | undefined
  async function execute(): Promise<ResourceRecoveryResult> {
    const items: ResourceRecoveryItem[] = []
    const deadline = performance.now() + timeoutMs
    let expired = false
    async function bounded<T>(call: () => PromiseLike<T>): Promise<T> {
      const remaining = deadline - performance.now()
      if (expired || remaining <= 0) { expired = true; throw Error('recovery deadline') }
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const result = await Promise.race([Promise.resolve().then(call), new Promise<never>((_, reject) => {
          timer = setTimeout(() => { expired = true; reject(Error('recovery deadline')) }, remaining)
        })])
        if (expired || performance.now() >= deadline) { expired = true; throw Error('recovery deadline') }
        return result
      } finally { if (timer) clearTimeout(timer) }
    }
    const result = (scan: ResourceRecoveryResult['scan'], reason: string): ResourceRecoveryResult =>
      ({ scan, next: cursor(), items, reason })
    for (let page = 0; page < maxPages; page++) {
      let rows: ReturnType<typeof row>[]
      try {
        const answer = await bounded(() => {
          let query = read().eq('state', 'held').order('admitted_seq', { ascending: true }).limit(pageSize + 1)
          if (after !== null) query = query.gt('admitted_seq', after)
          return query
        })
        if (answer.error || !Array.isArray(answer.data) || answer.data.length > pageSize + 1) throw Error('page unavailable')
        rows = answer.data.map(raw => row(raw, 'held'))
        let previous = after ?? 0
        const reservations = new Set<string>(), runs = new Set<string>(), sessions = new Set<string>()
        for (const r of rows) {
          if (r.admittedSeq <= previous || reservations.has(r.reservationId) || runs.has(r.runId) || sessions.has(r.sessionId))
            throw Error('invalid page order')
          previous = r.admittedSeq; reservations.add(r.reservationId); runs.add(r.runId); sessions.add(r.sessionId)
        }
      } catch { return result('unavailable', expired ? 'deadline' : 'ledger_read_unavailable') }
      for (const candidate of rows.slice(0, pageSize)) {
        const { releasedSeq: _unused, ...identity } = candidate
        // Advance after attempting this identity, including uncertainty, so a
        // permanently held head cannot starve later entries. A full sweep wraps.
        // Report unknown items to the owner; the cursor does not resolve them.
        after = identity.admittedSeq
        try {
          const answer = await bounded(() => db.rpc('release_resource_reservation', {
            p_estate: scope.estateId, p_reservation: identity.reservationId,
            p_run: identity.runId, p_session: identity.sessionId, p_fence: String(identity.fence)
          }))
          if (answer.error) throw Error('release unavailable')
          const receipt = record(answer.data)
          if (receipt.released === false && (receipt.reason_code === 'resource_children_held' || receipt.reason_code === 'resource_execution_unresolved')) {
            items.push({ ...identity, state: 'retained', reason: receipt.reason_code }); continue
          }
          if (receipt.released !== true || typeof receipt.repeated !== 'boolean' || !positive(receipt.receipt_seq)) throw Error('release unconfirmed')
          const confirmed = await bounded(() => read().eq('reservation_id', identity.reservationId).maybeSingle())
          if (confirmed.error) throw Error('readback unavailable')
          const actual = row(confirmed.data, 'released')
          if (Object.entries(identity).some(([key, value]) => actual[key as keyof typeof actual] !== value) || actual.releasedSeq !== receipt.receipt_seq)
            throw Error('release readback mismatch')
          items.push({ ...identity, state: 'released', reason: receipt.repeated ? 'already_released' : 'release_confirmed', receiptSeq: receipt.receipt_seq })
        } catch {
          items.push({ ...identity, state: 'unknown', reason: expired ? 'deadline' : 'release_unconfirmed' })
          if (expired) return result('partial', 'deadline')
        }
      }
      if (rows.length <= pageSize) {
        after = null
        return result('complete', 'held_query_exhausted')
      }
    }
    return result('partial', 'page_budget')
  }
  return {
    sweep(): Promise<ResourceRecoveryResult> {
      if (inflight) return inflight
      const pending = execute().finally(() => { if (inflight === pending) inflight = undefined })
      inflight = pending
      return pending
    }
  }
}
// #endregion resource-reconciliation
