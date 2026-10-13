// #region resource-wait-queue — docs: docs/execution/harness-waves/resource-wait-queue.md#contract
import type { ResourceVector } from '../shared/resourceAdmission.ts'

export interface WaitQueueScope { estateId: string; hostId: string; poolId: string }
export interface ResourceWaitInput {
  scope: WaitQueueScope
  id: string
  taskId: string
  sessionId: string
  attemptId: string
  ownerId: string
  fence: number
  inputDigest: string
  scopeDigest: string
  conditionKey: string
  resumePoint: string
  action: 'managed_task_launch'
  demand: ResourceVector
  createdAt: number
  deadlineAt: number
}
export type ResourceWaitState = 'waiting' | 'claimed' | 'dispatch_started' | 'outcome_unknown' |
  'dispatched' | 'refused_before_start' | 'cancelled' | 'expired' | 'invalidated'
export interface ResourceWaitRecord {
  input: ResourceWaitInput
  ordinal: number
  revision: number
  state: ResourceWaitState
  updatedAt: number
  nextCheckAt: number
  claim: { workerId: string; until: number } | null
}
/** Trusted linearizable port, not an implementation or a durability claim.
 * insert is idempotent on exact input, rejects changed identities, assigns a unique
 * increasing ordinal per scope, and enforces a configured queue capacity. page
 * returns the oldest ACTIVE rows, never omitting a blocked/unknown head. cas must
 * enforce revision+1, immutable input/ordinal and the scope, atomically. */
export interface ResourceWaitStore {
  insert(input: ResourceWaitInput): Promise<ResourceWaitRecord>
  read(scope: WaitQueueScope, id: string): Promise<ResourceWaitRecord | null>
  page(scope: WaitQueueScope, limit: number): Promise<{ rows: ResourceWaitRecord[]; more: boolean }>
  cas(scope: WaitQueueScope, id: string, revision: number, next: ResourceWaitRecord): Promise<boolean>
}
export type ResourceWaitCheck = { state: 'ready' | 'invalid' | 'unknown' } |
  { state: 'wait'; nextCheckAt: number }
export interface ResourceWaitDeps {
  store: ResourceWaitStore
  /** Trusted epoch milliseconds. Backwards readings refuse; deadlines do not authorize effects. */
  now(): number
  workerId: string
  pageSize: number
  claimMs: number
  timeoutMs: number
  /** Independent proof, not a caller-controlled "never started" flag. SQL must repeat atomically at insert. */
  neverStarted(input: ResourceWaitInput): Promise<boolean>
  /** Re-read condition, input/scope digests, ownership fence and authority; unknown is never ready. */
  inspect(input: ResourceWaitInput): Promise<ResourceWaitCheck>
  /** Re-enter the existing managed admission path with this exact attempt/session.
   * It MUST call/obey permit at its effect boundary and retain its own final fences.
   * Refusal means proven no start; uncertainty is not retry permission. */
  dispatch(input: ResourceWaitInput, permit: () => Promise<boolean>): Promise<'started' | 'refused_before_start' | 'unknown'>
}
export interface ResourceWaitOutcome {
  state: ResourceWaitState | 'empty' | 'deferred' | 'contended' | 'busy' | 'unknown'
  id?: string
}
const active = new Set<ResourceWaitState>(['waiting', 'claimed', 'dispatch_started', 'outcome_unknown'])
const states = new Set<ResourceWaitState>([...active, 'dispatched', 'refused_before_start', 'cancelled', 'expired', 'invalidated'])
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const positive = (v: unknown): v is number => integer(v) && v > 0
const identifier = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(v)
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
function shape(v: unknown, keys: string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Object.getPrototypeOf(v) !== Object.prototype) throw Error('invalid shape')
  const own = Reflect.ownKeys(v)
  if (own.length !== keys.length || own.some(k => typeof k !== 'string' || !keys.includes(k))) throw Error('invalid shape')
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    const d = Object.getOwnPropertyDescriptor(v, k)
    if (!d || !('value' in d)) throw Error('invalid shape')
    out[k] = d.value
  }
  return out
}
function scopeOf(v: unknown): WaitQueueScope {
  const x = shape(v, ['estateId', 'hostId', 'poolId'])
  if (!Object.values(x).every(identifier)) throw Error('invalid scope')
  return x as unknown as WaitQueueScope
}
function inputOf(v: unknown): ResourceWaitInput {
  const x = shape(v, ['scope', 'id', 'taskId', 'sessionId', 'attemptId', 'ownerId', 'fence', 'inputDigest',
    'scopeDigest', 'conditionKey', 'resumePoint', 'action', 'demand', 'createdAt', 'deadlineAt'])
  x.scope = scopeOf(x.scope)
  for (const k of ['id', 'taskId', 'sessionId', 'attemptId', 'ownerId', 'conditionKey', 'resumePoint'])
    if (!identifier(x[k])) throw Error('invalid identity')
  if (!positive(x.fence) || !digest(x.inputDigest) || !digest(x.scopeDigest) || x.action !== 'managed_task_launch' ||
      !integer(x.createdAt) || !integer(x.deadlineAt) || x.deadlineAt <= x.createdAt) throw Error('invalid binding')
  const vct = shape(x.demand, ['workerSlots', 'memoryBytes', 'diskBytes', 'cpuMilliCores'])
  if (!Object.values(vct).every(integer) || !positive(vct.workerSlots)) throw Error('invalid demand')
  x.demand = vct
  return freeze(x as unknown as ResourceWaitInput)
}
function freeze<T>(v: T): T {
  if (v && typeof v === 'object') { for (const x of Object.values(v)) freeze(x); Object.freeze(v) }
  return v
}
function rowOf(v: unknown): ResourceWaitRecord {
  const r = shape(v, ['input', 'ordinal', 'revision', 'state', 'updatedAt', 'nextCheckAt', 'claim'])
  r.input = inputOf(r.input)
  if (!positive(r.ordinal) || !positive(r.revision) || !states.has(r.state as ResourceWaitState) ||
      !integer(r.updatedAt) || !integer(r.nextCheckAt) || r.updatedAt < (r.input as ResourceWaitInput).createdAt)
    throw Error('invalid row')
  if (r.claim !== null) {
    const c = shape(r.claim, ['workerId', 'until'])
    if (!identifier(c.workerId) || !integer(c.until)) throw Error('invalid claim')
    r.claim = c
  }
  if (['claimed', 'dispatch_started'].includes(r.state as string) && r.claim === null) throw Error('missing claim')
  return freeze(r as unknown as ResourceWaitRecord)
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function createResourceWaitQueue(deps: ResourceWaitDeps) {
  if (!identifier(deps.workerId) || !positive(deps.pageSize) || deps.pageSize > 100 ||
      !positive(deps.claimMs) || deps.claimMs > 300_000 || !positive(deps.timeoutMs) || deps.timeoutMs > 30_000)
    throw Error('invalid queue bounds')
  const { workerId, pageSize, claimMs, timeoutMs } = deps
  type Operation = { valid: boolean; finished: boolean; pending: Set<Promise<unknown>> }
  let operation: Operation | null = null
  const release = (op: Operation) => {
    if (op.finished && op.pending.size === 0 && operation === op) operation = null
  }
  async function run(call: (op: Operation) => Promise<ResourceWaitOutcome>): Promise<ResourceWaitOutcome> {
    if (operation) return { state: 'busy' }
    const op: Operation = { valid: true, finished: false, pending: new Set() }
    operation = op
    try { return await call(op) } finally { op.valid = false; op.finished = true; release(op) }
  }
  const now = () => { const n = deps.now(); if (!integer(n)) throw Error('invalid clock'); return n }
  async function bounded<T>(op: Operation, call: () => Promise<T>): Promise<T> {
    if (!op.valid) throw Error('wait operation revoked')
    let timer: ReturnType<typeof setTimeout> | undefined
    // A response timeout is not cancellation of the underlying dependency. Keep
    // ownership until it really settles; nested permits share the same token.
    const pending = Promise.resolve().then(() => {
      if (!op.valid) throw Error('wait operation revoked')
      return call()
    })
    op.pending.add(pending)
    const settled = () => { op.pending.delete(pending); release(op) }
    void pending.then(settled, settled)
    try { return await Promise.race([pending, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { op.valid = false; reject(Error('wait dependency timeout')) }, timeoutMs)
    })]) } finally { clearTimeout(timer) }
  }
  async function checked(op: Operation, input: ResourceWaitInput): Promise<ResourceWaitCheck> {
    const raw = await bounded(op, () => deps.inspect(input))
    const d = Object.getOwnPropertyDescriptor(raw, 'state')
    if (!d || !('value' in d)) throw Error('invalid observation')
    const x = shape(raw, d.value === 'wait' ? ['state', 'nextCheckAt'] : ['state'])
    if (!['ready', 'wait', 'invalid', 'unknown'].includes(x.state as string)) throw Error('invalid observation')
    if (x.state === 'wait' && (!integer(x.nextCheckAt) || x.nextCheckAt <= now())) throw Error('invalid next check')
    return x as unknown as ResourceWaitCheck
  }
  async function change(op: Operation, row: ResourceWaitRecord, patch: Partial<ResourceWaitRecord>): Promise<ResourceWaitRecord | null> {
    const t = now()
    if (t < row.updatedAt || !positive(row.revision + 1)) throw Error('invalid revision or clock')
    const next = rowOf({ ...row, ...patch, revision: row.revision + 1, updatedAt: t })
    const applied = await bounded(op, () => deps.store.cas(row.input.scope, row.input.id, row.revision, next))
    if (typeof applied !== 'boolean') throw Error('invalid CAS receipt')
    return applied ? next : null
  }
  async function read(op: Operation, input: ResourceWaitInput): Promise<ResourceWaitRecord | null> {
    const raw = await bounded(op, () => deps.store.read(input.scope, input.id))
    if (raw === null) return null
    const row = rowOf(raw)
    if (!same(row.input, input)) throw Error('changed wait identity')
    return row
  }
  const actions = {
    async enqueue(op: Operation, raw: ResourceWaitInput): Promise<ResourceWaitOutcome> {
      try {
        const input = inputOf(raw), t = now()
        if (input.createdAt > t || input.deadlineAt <= t || await bounded(op, () => deps.neverStarted(input)) !== true)
          return { state: 'unknown' }
        const row = rowOf(await bounded(op, () => deps.store.insert(input)))
        if (!same(row.input, input) || row.updatedAt > now()) return { state: 'unknown' }
        return { state: row.state, id: input.id }
      } catch { return { state: 'unknown' } }
    },
    async cancel(op: Operation, raw: ResourceWaitInput): Promise<ResourceWaitOutcome> {
      try {
        const input = inputOf(raw), row = await read(op, input)
        if (!row) return { state: 'unknown' }
        // Cancellation of a request is not termination of a dispatch or process.
        if (row.state !== 'waiting' && row.state !== 'claimed') return { state: row.state, id: input.id }
        const next = await change(op, row, { state: 'cancelled', claim: null })
        return { state: next ? 'cancelled' : 'contended', id: input.id }
      } catch { return { state: 'unknown' } }
    },
    async pass(op: Operation, rawScope: WaitQueueScope): Promise<ResourceWaitOutcome> {
      let begun: ResourceWaitRecord | null = null
      try {
        const scope = freeze(scopeOf(rawScope))
        const page = shape(await bounded(op, () => deps.store.page(scope, pageSize)), ['rows', 'more'])
        if (!Array.isArray(page.rows) || page.rows.length > pageSize || typeof page.more !== 'boolean' ||
            (page.more && page.rows.length === 0)) throw Error('invalid page')
        const rows = page.rows.map(rowOf)
        for (let i = 0; i < rows.length; i++) {
          if (!same(rows[i].input.scope, scope) || !active.has(rows[i].state) || rows[i].updatedAt > now() ||
              (i > 0 && rows[i].ordinal <= rows[i - 1].ordinal) || rows.slice(0, i).some(r => r.input.id === rows[i].input.id))
            throw Error('invalid page order or scope')
        }
        const head = rows[0]
        if (!head) return { state: 'empty' }
        const result = (state: ResourceWaitOutcome['state']): ResourceWaitOutcome => ({ state, id: head.input.id })
        if (head.state === 'outcome_unknown' || head.state === 'dispatch_started') return result('outcome_unknown')
        if (head.state === 'claimed' && head.claim!.until > now()) return result('deferred')
        if (head.input.deadlineAt <= now()) return result(await change(op, head, { state: 'expired', claim: null }) ? 'expired' : 'contended')
        if (head.nextCheckAt > now()) return result('deferred')
        const until = now() + claimMs
        if (!integer(until)) throw Error('claim overflow')
        const claim = await change(op, head, { state: 'claimed', claim: { workerId: workerId, until } })
        if (!claim) return result('contended')
        const verdict = await checked(op, claim.input)
        if (verdict.state !== 'ready') {
          const next = await change(op, claim, verdict.state === 'invalid' ? { state: 'invalidated', claim: null } :
            { state: 'waiting', claim: null, nextCheckAt: verdict.state === 'wait' ? verdict.nextCheckAt : until })
          return result(next ? next.state === 'waiting' ? 'deferred' : next.state : 'contended')
        }
        if (now() >= until || now() >= claim.input.deadlineAt) return result('deferred')
        begun = await change(op, claim, { state: 'dispatch_started' })
        if (!begun) return result('contended')
        const boundary = begun
        let permitRequested = false, permitGranted = false
        const permit = async () => {
          if (!op.valid || permitRequested) return false
          permitRequested = true
          try {
            if ((await checked(op, boundary.input)).state !== 'ready') return false
            const current = await read(op, boundary.input), t = now()
            permitGranted = op.valid && !!current && same(current, boundary) && t >= boundary.updatedAt &&
              t < until && t < boundary.input.deadlineAt
            return permitGranted
          } catch { return false }
        }
        const effect = await bounded(op, () => deps.dispatch(boundary.input, permit))
        const state: ResourceWaitState = effect === 'started' && permitGranted ? 'dispatched' :
          effect === 'refused_before_start' ? 'refused_before_start' : 'outcome_unknown'
        return result(await change(op, boundary, { state }) ? state : 'unknown')
      } catch {
        // A lost begin/dispatch/settlement reply never authorizes another effect.
        // A claimed row may expire safely; dispatch_started is deliberately unreclaimable.
        if (begun) { try { await change(op, begun, { state: 'outcome_unknown' }) } catch { /* Retain the durable begin fence. */ } }
        return { state: 'unknown' }
      }
    }
  }
  return {
    enqueue: (input: ResourceWaitInput) => run(op => actions.enqueue(op, input)),
    cancel: (input: ResourceWaitInput) => run(op => actions.cancel(op, input)),
    pass: (scope: WaitQueueScope) => run(op => actions.pass(op, scope))
  }
}
// #endregion resource-wait-queue
