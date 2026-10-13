// #region resource-attempt-observation — docs: docs/execution/harness-waves/resource-attempt-observation.md#contract
import { createHash } from 'node:crypto'
import type { ResourceVector } from '../shared/resourceAdmission.ts'

/** Local diagnostic evidence, never a portable event or an authority receipt. */
export const RESOURCE_OBSERVATION_REASONS = [
  'admitted', 'preflight-refused', 'preflight-unknown', 'admission-refused', 'admission-unknown',
  'current', 'not-current', 'currentness-unknown', 'released', 'release-unconfirmed', 'release-unknown'
] as const
type Reason = typeof RESOURCE_OBSERVATION_REASONS[number]
type Phase = 'admission' | 'currentness' | 'cancel' | 'release'
type Outcome = 'accepted' | 'refused' | 'unknown'
export interface ResourceAttemptObservation {
  attemptDigest: string
  phase: Phase
  outcome: Outcome
  reason: Reason
  durationMs: number | null
  requested: ResourceVector | null
  reserved: ResourceVector | null
  snapshotDigest: string | null
  policyDigest: string | null
}
export interface ResourceObservationExport {
  kind: 'fabric-local-resource-observations'
  version: 1
  records: ResourceAttemptObservation[]
  coverage: { complete: boolean; duplicates: number; invalid: number; dropped: number }
}
export interface ResourceObservationSink {
  /** Synchronous local sink. An asynchronous implementation is unsupported. */
  record(value: ResourceAttemptObservation): unknown
}
const dimensions = ['workerSlots', 'memoryBytes', 'diskBytes', 'cpuMilliCores'] as const
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const count = (value: number) => Math.min(Number.MAX_SAFE_INTEGER, value + 1)
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw Error('invalid observation')
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Reflect.ownKeys(descriptors).length !== keys.length) throw Error('invalid observation')
  const result: Record<string, unknown> = {}
  for (const key of keys) {
    const descriptor = descriptors[key]
    if (!descriptor || !('value' in descriptor)) throw Error('invalid observation')
    result[key] = descriptor.value
  }
  return result
}
function vector(value: unknown): ResourceVector | null {
  if (value === null) return null
  const r = record(value, dimensions)
  if (!dimensions.every(key => integer(r[key]))) throw Error('invalid resource observation')
  return { workerSlots: r.workerSlots, memoryBytes: r.memoryBytes, diskBytes: r.diskBytes, cpuMilliCores: r.cpuMilliCores } as ResourceVector
}
const states: Record<Phase, Partial<Record<Reason, Outcome>>> = {
  admission: { admitted: 'accepted', 'preflight-refused': 'refused', 'preflight-unknown': 'unknown', 'admission-refused': 'refused', 'admission-unknown': 'unknown' },
  currentness: { current: 'accepted', 'not-current': 'refused', 'currentness-unknown': 'unknown' },
  cancel: { released: 'accepted', 'release-unconfirmed': 'unknown', 'release-unknown': 'unknown' },
  release: { released: 'accepted', 'release-unconfirmed': 'unknown', 'release-unknown': 'unknown' }
}
function observation(value: unknown): ResourceAttemptObservation {
  const r = record(value, ['attemptDigest', 'phase', 'outcome', 'reason', 'durationMs', 'requested', 'reserved', 'snapshotDigest', 'policyDigest'])
  if (!digest(r.attemptDigest) || !Object.hasOwn(states, r.phase as string) ||
      !Object.hasOwn(states[r.phase as Phase], r.reason as string) || states[r.phase as Phase][r.reason as Reason] !== r.outcome ||
      (r.durationMs !== null && (typeof r.durationMs !== 'number' || !Number.isFinite(r.durationMs) || r.durationMs < 0 || r.durationMs > Number.MAX_SAFE_INTEGER)) ||
      (r.snapshotDigest !== null && !digest(r.snapshotDigest)) || (r.policyDigest !== null && !digest(r.policyDigest))) throw Error('invalid observation')
  const requested = vector(r.requested), reserved = vector(r.reserved)
  if (reserved && (!requested || dimensions.some(key => reserved[key] > requested[key]))) throw Error('invalid reservation observation')
  return { attemptDigest: r.attemptDigest, phase: r.phase as Phase, outcome: r.outcome as Outcome, reason: r.reason as Reason,
    durationMs: r.durationMs as number | null, requested, reserved, snapshotDigest: r.snapshotDigest as string | null, policyDigest: r.policyDigest as string | null }
}
/** Identity input is already validated by the caller. Hash its tuple; do not
 * export actor names, paths, task text, credentials or raw policy labels. */
export function resourceObservationDigest(parts: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex')
}
/** Missing/backwards clock readings never manufacture a zero-duration sample. */
export function resourceObservationDuration(start: number | null, end: number | null): number | null {
  return start !== null && end !== null && Number.isFinite(start) && Number.isFinite(end) &&
    start >= 0 && end >= start && end - start <= Number.MAX_SAFE_INTEGER ? end - start : null
}
export function createResourceAttemptObservation(maxRecords: number) {
  if (!integer(maxRecords) || maxRecords < 1 || maxRecords > 10_000) throw Error('invalid observation bound')
  const records = new Map<string, ResourceAttemptObservation>()
  const admissions = new Map<string, string>()
  let duplicates = 0, invalid = 0, dropped = 0
  return {
    record(raw: unknown): 'recorded' | 'duplicate' | 'invalid' | 'overflow' {
      let value: ResourceAttemptObservation
      try { value = observation(raw) } catch {
        // The exported invalid counter marks incomplete evidence; raw rejected input is dropped, never logged.
        invalid = count(invalid); return 'invalid'
      }
      // A repeated condition within this attempt is one occurrence, not new
      // corroboration. Keep its first sample, never inflate measured duration.
      const key = [value.attemptDigest, value.phase, value.outcome, value.reason].join(':')
      if (value.phase === 'admission' && admissions.has(value.attemptDigest) && admissions.get(value.attemptDigest) !== key) { invalid = count(invalid); return 'invalid' }
      const previous = records.get(key)
      if (previous) {
        const evidence = ({ durationMs: _duration, ...rest }: ResourceAttemptObservation) => rest
        if (JSON.stringify(evidence(previous)) !== JSON.stringify(evidence(value))) { invalid = count(invalid); return 'invalid' }
        duplicates = count(duplicates); return 'duplicate'
      }
      if (records.size >= maxRecords) { dropped = count(dropped); return 'overflow' }
      records.set(key, value)
      if (value.phase === 'admission') admissions.set(value.attemptDigest, key)
      return 'recorded'
    },
    export(): ResourceObservationExport {
      return { kind: 'fabric-local-resource-observations', version: 1,
        records: structuredClone([...records.values()]),
        coverage: { complete: invalid === 0 && dropped === 0, duplicates, invalid, dropped } }
    }
  }
}
function corpus(raw: unknown): ResourceObservationExport {
  const r = record(raw, ['kind', 'version', 'records', 'coverage']), c = record(r.coverage, ['complete', 'duplicates', 'invalid', 'dropped'])
  if (r.kind !== 'fabric-local-resource-observations' || r.version !== 1 || !Array.isArray(r.records) || r.records.length > 10_000 ||
      ![c.duplicates, c.invalid, c.dropped].every(integer) || c.complete !== (c.invalid === 0 && c.dropped === 0)) throw Error('invalid corpus')
  if (Object.getPrototypeOf(r.records) !== Array.prototype) throw Error('invalid corpus')
  const descriptors = Object.getOwnPropertyDescriptors(r.records)
  if (Reflect.ownKeys(descriptors).length !== r.records.length + 1) throw Error('invalid corpus')
  const records: ResourceAttemptObservation[] = []
  for (let i = 0; i < r.records.length; i++) {
    const descriptor = descriptors[String(i)]
    if (!descriptor || !('value' in descriptor)) throw Error('invalid corpus')
    records.push(observation(descriptor.value))
  }
  const keys = records.map(v => [v.attemptDigest, v.phase, v.outcome, v.reason].join(':'))
  const admissions = records.filter(r => r.phase === 'admission').map(r => r.attemptDigest)
  if (new Set(admissions).size !== admissions.length) throw Error('conflicting admission evidence')
  if (new Set(keys).size !== keys.length) throw Error('duplicate corpus evidence')
  return { kind: 'fabric-local-resource-observations', version: 1, records, coverage: c as ResourceObservationExport['coverage'] }
}
export function summarizeResourceObservations(raw: unknown) {
  const c = corpus(raw), admissions = c.records.filter(r => r.phase === 'admission')
  const known = admissions.filter(r => r.durationMs !== null)
  // Mean is accumulated as fractions to avoid an unsafe integer sum.
  return { coverage: c.coverage, attempts: new Set(admissions.map(r => r.attemptDigest)).size,
    admitted: admissions.filter(r => r.outcome === 'accepted').length,
    refused: admissions.filter(r => r.outcome === 'refused').length,
    unknown: admissions.filter(r => r.outcome === 'unknown').length,
    admissionLatencyMs: known.length ? known.reduce((sum, r) => sum + r.durationMs! / known.length, 0) : null,
    knownLatencySamples: known.length, unknownLatencySamples: admissions.length - known.length,
    queueDelayMs: null, observedResourcePeak: null, energySaved: null, lessonsHelped: null }
}
/** Caller-supplied manifest describes a controlled comparison, not a proof of
 * equivalence. No causal gain, lesson adoption or permission follows from it. */
export interface ResourceComparisonInput {
  mode: 'synthetic' | 'observed'
  taskSetDigest: string
  acceptanceDigest: string
  environmentDigest: string
  policyDigest: string
  sourceDigest: string
  evidence: ResourceObservationExport
}
export function compareResourceObservations(before: ResourceComparisonInput, after: ResourceComparisonInput) {
  const read = (raw: unknown) => {
    const r = record(raw, ['mode', 'taskSetDigest', 'acceptanceDigest', 'environmentDigest', 'policyDigest', 'sourceDigest', 'evidence'])
    if (!['synthetic', 'observed'].includes(r.mode as string) ||
      !['taskSetDigest', 'acceptanceDigest', 'environmentDigest', 'policyDigest', 'sourceDigest'].every(key => digest(r[key]))) throw Error('invalid comparison')
    return { ...r, evidence: corpus(r.evidence) } as unknown as ResourceComparisonInput
  }
  const a = read(before), b = read(after), x = summarizeResourceObservations(a.evidence), y = summarizeResourceObservations(b.evidence)
  let reason: 'scope-mismatch' | 'incomplete-evidence' | 'outcome-mismatch' | 'controlled-descriptive-comparison' = 'controlled-descriptive-comparison'
  if (a.mode !== b.mode || a.taskSetDigest !== b.taskSetDigest || a.acceptanceDigest !== b.acceptanceDigest || a.environmentDigest !== b.environmentDigest) reason = 'scope-mismatch'
  else if (!x.coverage.complete || !y.coverage.complete || x.unknownLatencySamples || y.unknownLatencySamples || !x.attempts || !y.attempts || x.unknown || y.unknown) reason = 'incomplete-evidence'
  else if (a.evidence.records.some(r => r.phase === 'admission' && r.policyDigest !== a.policyDigest) || b.evidence.records.some(r => r.phase === 'admission' && r.policyDigest !== b.policyDigest)) reason = 'scope-mismatch'
  else if (x.attempts !== y.attempts || x.admitted !== y.admitted || x.refused !== y.refused) reason = 'outcome-mismatch'
  return { comparable: reason === 'controlled-descriptive-comparison', reason, mode: a.mode,
    admissionLatencyDeltaMs: reason === 'controlled-descriptive-comparison' ? y.admissionLatencyMs! - x.admissionLatencyMs! : null,
    before: x, after: y, helped: 'not_established' as const, energySaved: null, policyPromotion: false as const }
}
// #endregion resource-attempt-observation
