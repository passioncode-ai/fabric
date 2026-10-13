// #region resource-admission — docs: docs/execution/harness-waves/resource-implementation.md#r1-resource-demand-and-decision-contract
/** Internal advisory preflight. This is neither a wire protocol nor a reservation.
 * A later atomic admission must revalidate every bound before allocating capacity.
 * All quantities refer to one explicitly selected host/pool; provider quota is separate.
 */
export interface ResourceVector {
  workerSlots: number
  memoryBytes: number
  diskBytes: number
  cpuMilliCores: number // 1000 = one CPU core
}
export interface ResourceIdentity {
  hostId: string
  poolId: string
  localPolicyRevision: string
  reservationId: string
  attemptId: string
  fence: number
  ownerId: string
  role: 'builder' | 'reviewer' | 'test'
  inputDigest: string // lowercase SHA-256
  scopeDigest: string // lowercase SHA-256 of the mutable scope
}
export interface ParentLink {
  reservationId: string
  attemptId: string
  fence: number
  rootReservationId: string
}
export interface ResourceRequest extends ResourceIdentity {
  demand: ResourceVector
  parent?: ParentLink
}
export interface ResourceContext {
  nowMs: number // injected, same clock domain as all evidence timestamps
  policy: {
    hostId: string
    poolId: string
    localPolicyRevision: string // local configuration identity, never a protocol version
    maxAgeMs: number
    capacity: ResourceVector
  }
  snapshot: {
    id: string
    hostId: string
    poolId: string
    localPolicyRevision: string
    atMs: number
    reserved: ResourceVector
    observed: ResourceVector
    reservedObserved: ResourceVector // measured observed usage already covered by reserved
  }
}
export interface ResourceChecks {
  /** Trusted local ownership provider, independent of task-authored metadata.
   * Return { state:'held', identity:<exact expected identity>, snapshotId, atMs }.
   * Denial: { state:'refused' }; unavailable: { state:'unknown' }.
   */
  ownership: (expected: Readonly<ResourceIdentity>, snapshotId: string) => unknown
  /** Trusted ledger reader. Return { state:'held', identity, snapshotId, atMs,
   * parent:<exact requested link>, rootCharged, parentCapacity, remaining }.
   * rootCharged is a vector already included in snapshot.reserved; parentCapacity
   * is the parent's allocation inside that root, and remaining is unallocated.
   * The reader must derive all three from one coherent ledger snapshot.
   */
  parent?: (expected: Readonly<ResourceIdentity>, link: Readonly<ParentLink>, snapshotId: string) => unknown
}
export type ResourceDecision = {
  state: 'refused' | 'unknown'
  reason: string
  executionAuthorized: false
  reservationRequired: true
} | {
  state: 'eligible'
  executionAuthorized: false
  reservationRequired: true
  identity: ResourceIdentity
  snapshotId: string
  demand: ResourceVector
  effectiveUsage: ResourceVector
  additionalPoolCharge: ResourceVector
  parentAllocation: ResourceVector | null
  parent: ParentLink | null
}
const dimensions = ['workerSlots', 'memoryBytes', 'diskBytes', 'cpuMilliCores'] as const
const identityKeys = ['hostId', 'poolId', 'localPolicyRevision', 'reservationId', 'attemptId', 'fence', 'ownerId', 'role', 'inputDigest', 'scopeDigest']
const parentKeys = ['reservationId', 'attemptId', 'fence', 'rootReservationId']
type RecordValue = Record<string, unknown>
class Invalid extends Error {
  readonly reason: string
  readonly state: 'refused' | 'unknown'
  constructor(reason: string, state: 'refused' | 'unknown' = 'refused') { super(reason); this.reason = reason; this.state = state }
}
function fail(reason: string, state: 'refused' | 'unknown' = 'refused'): never { throw new Invalid(reason, state) }
// Read data properties only: no coercion, getters or mutation of caller objects.
function record(value: unknown, required: readonly string[], optional: readonly string[] = []): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid-shape')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail('invalid-shape')
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || (!required.includes(key) && !optional.includes(key)))) fail('unsupported-field')
  const result: RecordValue = Object.create(null)
  for (const key of [...required, ...optional]) {
    const descriptor = descriptors[key]
    if (!descriptor) { if (required.includes(key)) fail('missing-field'); continue }
    if (!('value' in descriptor)) fail('invalid-shape')
    result[key] = descriptor.value
  }
  return result
}
function integer(value: unknown, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) fail('invalid-integer')
  return value
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) fail('invalid-identity')
  return value
}
function digest(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('invalid-digest')
  return value
}
function vector(value: unknown): ResourceVector {
  const data = record(value, dimensions)
  return Object.fromEntries(dimensions.map(key => [key, integer(data[key])])) as unknown as ResourceVector
}
function identity(value: unknown): ResourceIdentity {
  const data = record(value, identityKeys)
  if (!['builder', 'reviewer', 'test'].includes(data.role as string)) fail('unsupported-role')
  return {
    hostId: id(data.hostId), poolId: id(data.poolId), localPolicyRevision: id(data.localPolicyRevision),
    reservationId: id(data.reservationId), attemptId: id(data.attemptId), fence: integer(data.fence, 1),
    ownerId: id(data.ownerId), role: data.role as ResourceIdentity['role'],
    inputDigest: digest(data.inputDigest), scopeDigest: digest(data.scopeDigest),
  }
}
function link(value: unknown): ParentLink {
  const data = record(value, parentKeys)
  return { reservationId: id(data.reservationId), attemptId: id(data.attemptId), fence: integer(data.fence, 1), rootReservationId: id(data.rootReservationId) }
}
function same(a: object, b: object, keys: readonly string[]): boolean {
  return keys.every(key => (a as RecordValue)[key] === (b as RecordValue)[key])
}
function within(a: ResourceVector, b: ResourceVector): boolean { return dimensions.every(key => a[key] <= b[key]) }
function fresh(value: unknown, now: number, maxAge: number): void {
  const at = integer(value)
  if (at > now) fail('future-evidence', 'unknown')
  if (now - at > maxAge) fail('stale-evidence', 'unknown')
}
function proof(call: () => unknown, expected: ResourceIdentity, snapshotId: string, now: number, maxAge: number, extra: string[] = []): RecordValue {
  let raw: unknown
  try { raw = call() } catch { fail('evidence-unavailable', 'unknown') }
  if (raw === null || raw === undefined) fail('evidence-unavailable', 'unknown')
  // A trusted synchronous provider can accidentally be declared async. Refuse its
  // value, but observe an ordinary native Promise's rejection so it cannot kill
  // the host after this function returns. Never read an arbitrary `then` getter.
  // Exotic Promise subclasses/constructor overrides are outside this DI contract;
  // attaching to them can itself execute user code through Symbol.species.
  if (typeof raw === 'object' && Object.getPrototypeOf(raw) === Promise.prototype &&
      !Object.getOwnPropertyDescriptor(raw, 'constructor')) {
    try { void Promise.prototype.then.call(raw, undefined, () => {}) }
    catch { /* A prototype spoof is not a branded Promise and remains refused. */ }
    fail('invalid-evidence')
  }
  const state = record(raw, ['state'], ['identity', 'snapshotId', 'atMs', ...extra])
  if (state.state === 'unknown') fail('evidence-unavailable', 'unknown')
  if (state.state === 'refused') fail('ownership-refused')
  if (state.state !== 'held') fail('invalid-evidence')
  const data = record(raw, ['state', 'identity', 'snapshotId', 'atMs', ...extra])
  if (!same(identity(data.identity), expected, identityKeys) || id(data.snapshotId) !== snapshotId) fail('evidence-mismatch')
  fresh(data.atMs, now, maxAge)
  return data
}
/** No IO, reservation, quota debit, lock acquisition, or permission grant occurs here.
 * `checks` is trusted dependency injection, not proof supplied by an untrusted task.
 * Missing readings stay unknown. Callers must not interpret eligible as spawn permission.
 */
export function assessResourceAdmission(request: unknown, context: unknown, checks: ResourceChecks): ResourceDecision {
  try {
    const req = record(request, [...identityKeys, 'demand'], ['parent'])
    const expected = Object.freeze(identity(Object.fromEntries(identityKeys.map(key => [key, req[key]]))))
    const demand = vector(req.demand)
    if (demand.workerSlots < 1) fail('worker-slot-required')
    const parent = 'parent' in req ? Object.freeze(link(req.parent)) : null
    if (parent && (parent.reservationId === expected.reservationId || parent.rootReservationId === expected.reservationId || parent.attemptId === expected.attemptId)) fail('self-parent')
    const ctx = record(context, ['nowMs', 'policy'], ['snapshot'])
    const now = integer(ctx.nowMs)
    const policy = record(ctx.policy, ['hostId', 'poolId', 'localPolicyRevision', 'maxAgeMs', 'capacity'])
    const scope = { hostId: id(policy.hostId), poolId: id(policy.poolId), localPolicyRevision: id(policy.localPolicyRevision) }
    if (!same(expected, scope, ['hostId', 'poolId', 'localPolicyRevision'])) fail('policy-scope-mismatch')
    const maxAge = integer(policy.maxAgeMs)
    const capacity = vector(policy.capacity)
    if (!within(demand, capacity)) fail('demand-exceeds-capacity')
    if (ctx.snapshot === null || ctx.snapshot === undefined) fail('reading-unavailable', 'unknown')
    const snapshot = record(ctx.snapshot, ['id', 'hostId', 'poolId', 'localPolicyRevision', 'atMs', 'reserved', 'observed', 'reservedObserved'])
    const snapshotId = id(snapshot.id)
    if (!same(snapshot, scope, ['hostId', 'poolId', 'localPolicyRevision'])) fail('snapshot-scope-mismatch')
    fresh(snapshot.atMs, now, maxAge)
    if (snapshot.reserved == null || snapshot.observed == null || snapshot.reservedObserved == null) fail('reading-unavailable', 'unknown')
    const reserved = vector(snapshot.reserved), observed = vector(snapshot.observed), overlap = vector(snapshot.reservedObserved)
    if (!within(overlap, reserved) || !within(overlap, observed)) fail('invalid-overlap')
    const effectiveUsage = {} as ResourceVector
    for (const key of dimensions) {
      const uncovered = observed[key] - overlap[key]
      if (reserved[key] > Number.MAX_SAFE_INTEGER - uncovered) fail('accounting-overflow')
      effectiveUsage[key] = reserved[key] + uncovered
    }
    if (!checks || typeof checks.ownership !== 'function') fail('ownership-unavailable', 'unknown')
    proof(() => checks.ownership(expected, snapshotId), expected, snapshotId, now, maxAge)
    let charge = { ...demand }
    if (parent) {
      if (typeof checks.parent !== 'function') fail('parent-unavailable', 'unknown')
      const evidence = proof(() => checks.parent!(expected, parent, snapshotId), expected, snapshotId, now, maxAge, ['parent', 'rootCharged', 'parentCapacity', 'remaining'])
      if (!same(link(evidence.parent), parent, parentKeys)) fail('parent-mismatch')
      const rootCharged = vector(evidence.rootCharged), parentCapacity = vector(evidence.parentCapacity), remaining = vector(evidence.remaining)
      if (rootCharged.workerSlots < 1 || !within(rootCharged, reserved) || !within(parentCapacity, rootCharged) || !within(remaining, parentCapacity)) fail('invalid-parent-accounting')
      if (!within(demand, remaining)) fail('parent-capacity-exhausted')
      charge = { workerSlots: 0, memoryBytes: 0, diskBytes: 0, cpuMilliCores: 0 }
    }
    for (const key of dimensions) {
      if (effectiveUsage[key] > capacity[key] || charge[key] > capacity[key] - effectiveUsage[key]) fail('pool-capacity-exhausted')
    }
    return { state: 'eligible', executionAuthorized: false, reservationRequired: true, identity: { ...expected }, snapshotId, demand, effectiveUsage, additionalPoolCharge: charge, parentAllocation: parent ? { ...demand } : null, parent: parent ? { ...parent } : null }
  } catch (error) {
    return { state: error instanceof Invalid ? error.state : 'unknown', reason: error instanceof Invalid ? error.reason : 'evidence-unavailable', executionAuthorized: false, reservationRequired: true }
  }
}
// #endregion resource-admission
