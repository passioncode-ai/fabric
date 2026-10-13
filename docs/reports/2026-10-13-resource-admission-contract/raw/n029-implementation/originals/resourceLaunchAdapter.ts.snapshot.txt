// #region resource-launch-adapter — docs: docs/execution/harness-waves/resource-launch-adapter.md#contract
import type { AdmissionReceipt, AdmitOutcome } from '../shared/admission.ts'
import { assessResourceAdmission, type ResourceChecks, type ResourceIdentity, type ResourceVector } from '../shared/resourceAdmission.ts'
import type { AdmitInput } from './admitExisting.ts'
import { resourceObservationDigest, resourceObservationDuration, type ResourceAttemptObservation, type ResourceObservationSink } from './resourceAttemptObservation.ts'

export interface ResourceLaunchPreparation {
  request: unknown
  context: unknown
  checks: ResourceChecks
  /** Consumption of this worker within its demand envelope, excluding children. */
  ownDemand: ResourceVector
}
export interface ResourceLaunchBinding {
  input: Readonly<AdmitInput>
  identity: Readonly<ResourceIdentity>
  demand: Readonly<ResourceVector>
  ownDemand: Readonly<ResourceVector>
  parentId: string | null
}
export interface ManagedResourceLaunch {
  readonly mode: 'required'
  matches(receipt: AdmissionReceipt): boolean
  current(receipt: AdmissionReceipt): Promise<boolean>
  cancelUnbegun(receipt: AdmissionReceipt): Promise<boolean>
  releaseCompensated(receipt: AdmissionReceipt): Promise<boolean>
}
export interface ResourceLaunchAdapter extends ManagedResourceLaunch {
  admit(input: AdmitInput): Promise<AdmitOutcome>
}
export interface ResourceLaunchAdapterDeps {
  db: { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error?: unknown }> }
  /** Both are explicit local bounds, not machine capacity defaults. */
  timeoutMs: number
  maxEntries: number
  /** Optional local diagnostics only; no authority or portable event publication. */
  observations?: { sink: ResourceObservationSink; now?: () => number }
  prepare(input: Readonly<AdmitInput>): Promise<ResourceLaunchPreparation>
  /** Trusted currentness provider. Must independently refresh input/scope/fence,
   * ownership and policy; never echo the supplied identity as proof. The SQL
   * validate command separately checks the durable ledger and fresh pool reading.
   * No public receipt or authority is created by this callback.
   */
  current(binding: Readonly<ResourceLaunchBinding>, receipt: Readonly<AdmissionReceipt>): Promise<boolean>
}
const dimensions = ['workerSlots', 'memoryBytes', 'diskBytes', 'cpuMilliCores'] as const
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const refused = (reasonCode: string): AdmitOutcome => ({ admitted: false, reasonCode,
  says: 'The admission receipt is unavailable. Refresh the task before another launch.', retryable: false })
function data(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw Error('invalid data')
  const result: Record<string, unknown> = Object.create(null)
  for (const [key, property] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!('value' in property)) throw Error('invalid data')
    result[key] = property.value
  }
  if (Reflect.ownKeys(value).length !== Object.keys(result).length) throw Error('invalid data')
  return result
}
function ownVector(raw: unknown, envelope: ResourceVector): ResourceVector {
  const value = data(raw)
  if (Object.keys(value).length !== dimensions.length) throw Error('invalid demand')
  const result = {} as ResourceVector
  for (const key of dimensions) {
    const n = value[key]
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0 || n > envelope[key]) throw Error('invalid demand')
    result[key] = n
  }
  if (result.workerSlots < 1) throw Error('invalid demand')
  return result
}
function copyInput(raw: AdmitInput): AdmitInput {
  const value = data(raw), actor = data(value.actor)
  if (!uuid(value.estateId) || !uuid(value.taskId) || !uuid(value.sessionId) ||
      typeof actor.kind !== 'string' || !actor.kind || typeof actor.id !== 'string' || !actor.id ||
      !['operator', 'routine', 'chain', 'answer'].includes(value.trigger as string) ||
      (value.personId !== undefined && !uuid(value.personId)) || (value.revision !== undefined && !positive(value.revision))) throw Error('invalid identity')
  return { estateId: value.estateId, taskId: value.taskId, sessionId: value.sessionId,
    actor: { kind: actor.kind, id: actor.id }, trigger: value.trigger as AdmitInput['trigger'],
    ...(value.personId === undefined ? {} : { personId: value.personId as string }),
    ...(value.revision === undefined ? {} : { revision: value.revision as number }) }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value) }
  return value
}
interface Entry {
  input: Readonly<AdmitInput>
  binding?: Readonly<ResourceLaunchBinding>
  receipt?: AdmissionReceipt
  outcome: Promise<AdmitOutcome>
  observedStartedAt?: number | null
  observedSnapshot?: string
  outstanding?: object
}
/** Optional at composition only. Once installed this adapter never calls legacy
 * admission, even if pending migration107 is missing. No index.ts wiring yet.
 */
export function createResourceLaunchAdapter(deps: ResourceLaunchAdapterDeps): ResourceLaunchAdapter {
  if (!positive(deps.timeoutMs) || deps.timeoutMs > 30_000 || !positive(deps.maxEntries)) throw Error('invalid resource adapter bounds')
  const entries = new Map<string, Entry>()
  // #region resource-attempt-instrumentation — docs: docs/execution/harness-waves/resource-attempt-observation.md#contract
  function observeAccidentalPromise(value: unknown): void {
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Promise.prototype &&
        !Object.getOwnPropertyDescriptor(value, 'constructor')) {
      void Promise.prototype.then.call(value, undefined, () => {})
    }
  }
  function observedNow(): number | null {
    if (!deps.observations) return null
    try {
      const at: unknown = (deps.observations.now ?? (() => performance.now()))()
      observeAccidentalPromise(at)
      return typeof at === 'number' && Number.isFinite(at) && at >= 0 ? at : null
    }
    catch { /* Diagnostic clock is unavailable; the sample stays unknown, never zero or authority. */ return null }
  }
  function observe(entry: Entry, phase: ResourceAttemptObservation['phase'], outcome: ResourceAttemptObservation['outcome'],
    reason: ResourceAttemptObservation['reason'], start: number | null): void {
    if (!deps.observations) return
    try {
      const result = deps.observations.sink.record({
        attemptDigest: resourceObservationDigest([entry.input.estateId, entry.input.taskId, entry.input.sessionId]),
        phase, outcome, reason, durationMs: resourceObservationDuration(start, observedNow()),
        requested: entry.binding ? { ...entry.binding.demand } : null,
        reserved: entry.receipt && entry.binding ? { ...entry.binding.demand } : null,
        snapshotDigest: entry.observedSnapshot ?? null,
        policyDigest: entry.binding ? resourceObservationDigest([entry.binding.identity.hostId, entry.binding.identity.poolId, entry.binding.identity.localPolicyRevision]) : null
      })
      // The sink contract is synchronous. Still absorb an accidental ordinary
      // native Promise rejection; do not inspect arbitrary thenable accessors.
      observeAccidentalPromise(result)
    } catch { /* A failed local diagnostic sink cannot alter admission/currentness/release authority. No raw input is logged. */ }
  }
  // #endregion resource-attempt-instrumentation
  async function bounded<T>(call: () => T | PromiseLike<T>, entry?: Entry): Promise<T> {
    if (entry?.outstanding) throw Error('resource operation outstanding')
    const operation = {}
    // Reserve before invoking the dependency, including synchronous re-entry.
    // A timeout ends only the caller's wait; it cannot cancel underlying I/O.
    if (entry) entry.outstanding = operation
    const pending = Promise.resolve().then(call)
    if (entry) {
      const settled = () => { if (entry.outstanding === operation) delete entry.outstanding }
      // Both branches consume settlement without accepting a late outcome or
      // creating a rejected cleanup promise. Only actual settlement frees the slot.
      void pending.then(settled, settled)
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    try { return await Promise.race([pending, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('resource timeout')), deps.timeoutMs) })]) }
    finally { if (timer) clearTimeout(timer) }
  }
  async function rpc(name: string, args: Record<string, unknown>, entry?: Entry): Promise<unknown> {
    const answer = await bounded(() => deps.db.rpc(name, args), entry)
    if (answer.error) throw Error('resource receipt unavailable')
    return answer.data
  }
  function readReceipt(raw: unknown, entry: Entry): AdmissionReceipt {
    const r = data(raw), resource = data(r.resource_reservation)
    if (r.admitted !== true || r.task_id !== entry.input.taskId || r.session_id !== entry.input.sessionId ||
        !uuid(r.project_id) || !uuid(r.task_run_id) || !positive(r.run_ordinal) || !positive(r.receipt_seq) || typeof r.instruction !== 'string' ||
        resource.reservation_id !== entry.binding?.identity.reservationId || resource.state !== 'held' || resource.run_ordinal !== r.run_ordinal) throw Error('resource receipt mismatch')
    return freeze({ admitted: true, task_id: r.task_id, session_id: r.session_id, project_id: r.project_id,
      task_run_id: r.task_run_id, run_ordinal: r.run_ordinal, receipt_seq: r.receipt_seq, instruction: r.instruction,
      ...(typeof r.option_id === 'string' ? { option_id: r.option_id } : {}),
      resource_reservation: { reservation_id: resource.reservation_id, state: 'held', run_ordinal: resource.run_ordinal } })
  }
  function find(receipt: AdmissionReceipt): Entry | undefined {
    try {
      const raw = data(receipt)
      if (!uuid(raw.session_id)) return undefined
      const entry = entries.get(raw.session_id)
      if (!entry?.receipt || !entry.binding) return undefined
      const verified = readReceipt(receipt, entry)
      return JSON.stringify(verified) === JSON.stringify(entry.receipt) ? entry : undefined
    } catch { /* Malformed receipt is an explicit non-match; never log its untrusted contents. */ return undefined }
  }
  async function settle(receipt: AdmissionReceipt, command: string): Promise<boolean> {
    const entry = find(receipt)
    if (!entry?.binding || !entry.receipt) return false
    const started = observedNow(), phase = command === 'cancel_resource_admission' ? 'cancel' : 'release'
    try {
      const answer = data(await rpc(command, { p_estate: entry.input.estateId, p_reservation: entry.binding.identity.reservationId,
        p_run: entry.receipt.task_run_id, p_session: entry.input.sessionId, p_fence: String(entry.binding.identity.fence) }, entry))
      const released = answer.released === true && positive(answer.receipt_seq)
      observe(entry, phase, released ? 'accepted' : 'unknown', released ? 'released' : 'release-unconfirmed', started)
      return released
    } catch { /* No confirmed release receipt: retain capacity and report uncertainty to the coordinator. */
      observe(entry, phase, 'unknown', 'release-unknown', started); return false
    }
  }
  return {
    mode: 'required',
    admit(raw) {
      let input: Readonly<AdmitInput>
      try { input = freeze(copyInput(raw)) } catch { /* Refusal is returned to the caller; raw identity input is not safe diagnostic material. */ return Promise.resolve(refused('resource_input_invalid')) }
      const previous = entries.get(input.sessionId)
      if (previous) return JSON.stringify(previous.input) === JSON.stringify(input) ? previous.outcome : Promise.resolve(refused('resource_identity_conflict'))
      if (entries.size >= deps.maxEntries) return Promise.resolve(refused('resource_adapter_capacity'))
      const entry: Entry = { input, outcome: Promise.resolve(refused('resource_admission_unknown')), observedStartedAt: observedNow() }
      entries.set(input.sessionId, entry)
      entry.outcome = (async () => {
        try {
          const preparation = await bounded(() => deps.prepare(input))
          const decision = assessResourceAdmission(preparation.request, preparation.context, preparation.checks)
          if (decision.state !== 'eligible') {
            observe(entry, 'admission', decision.state, decision.state === 'unknown' ? 'preflight-unknown' : 'preflight-refused', entry.observedStartedAt ?? null)
            return refused(`resource_${decision.state}`)
          }
          const binding = freeze({ input, identity: decision.identity, demand: decision.demand,
            ownDemand: ownVector(preparation.ownDemand, decision.demand), parentId: decision.parent?.reservationId ?? null })
          entry.binding = binding
          if (deps.observations) entry.observedSnapshot = resourceObservationDigest([binding.identity.hostId, binding.identity.poolId, binding.identity.localPolicyRevision, decision.snapshotId])
          const { hostId, poolId, ...identity } = binding.identity
          const rawReceipt = await rpc('admit_resource_task_launch', { p_estate_id: input.estateId, p_task_id: input.taskId,
            p_actor: { ...input.actor }, p_session_id: input.sessionId, p_host: hostId, p_pool: poolId,
            p_binding: { ...identity }, p_demand: { ...binding.demand }, p_own_demand: { ...binding.ownDemand },
            p_parent: binding.parentId, p_trigger: input.trigger, p_person_id: input.personId ?? null, p_revision: input.revision ?? null })
          const verdict = data(rawReceipt)
          if (verdict.admitted === false) {
            observe(entry, 'admission', 'refused', 'admission-refused', entry.observedStartedAt ?? null)
            return refused('resource_admission_refused')
          }
          entry.receipt = readReceipt(rawReceipt, entry)
          observe(entry, 'admission', 'accepted', 'admitted', entry.observedStartedAt ?? null)
          return { admitted: true as const, receipt: entry.receipt }
        } catch { /* The returned unknown outcome prevents retry/spawn; transport details can contain credentials. */
          observe(entry, 'admission', 'unknown', 'admission-unknown', entry.observedStartedAt ?? null)
          return refused('resource_admission_unknown')
        }
      })()
      return entry.outcome
    },
    matches: receipt => !!find(receipt),
    async current(receipt) {
      const entry = find(receipt)
      if (!entry?.binding || !entry.receipt) return false
      const started = observedNow()
      try {
        const current = await bounded(() => deps.current(entry.binding!, entry.receipt!), entry) === true
        observe(entry, 'currentness', current ? 'accepted' : 'refused', current ? 'current' : 'not-current', started)
        return current
      } catch { /* Failed currentness is a returned refusal, never permission to continue. */
        observe(entry, 'currentness', 'unknown', 'currentness-unknown', started); return false
      }
    },
    // SQL establishes never-begun proof under the same lock as begin. A lost
    // begin response is NOT proof; cancellation can safely refuse in that case.
    cancelUnbegun: receipt => settle(receipt, 'cancel_resource_admission'),
    // Invoked only by the managed coordinator after confirmed no-spawn
    // compensation. SQL independently verifies ended ownership before release.
    releaseCompensated: receipt => settle(receipt, 'release_resource_reservation'),
  }
}
// #endregion resource-launch-adapter
