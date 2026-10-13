// #region resource-host-policy — docs: docs/execution/harness-waves/resource-host-observation.md#contract
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { ResourceVector } from '../shared/resourceAdmission.ts'

export interface ResourceHostPolicy {
  hostId: string
  poolId: string
  localPolicyRevision: string
  capacity: ResourceVector
  demandProfiles: Record<'builder' | 'reviewer' | 'test', ResourceVector>
  diskPath: string
  diskDeviceId: string
  maxAgeMs: number
  sampleWindowMs: number
  timeoutMs: number
}
export const resourceAxes = ['workerSlots', 'memoryBytes', 'diskBytes', 'cpuMilliCores'] as const
/** Internal data boundary, not an arbitrary object/thenable evaluator. */
export function resourceData(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error('invalid resource data')
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Reflect.ownKeys(value).length !== keys.length || keys.some(k => !descriptors[k] || !('value' in descriptors[k]))) throw Error('invalid resource data')
  return Object.fromEntries(keys.map(k => [k, descriptors[k].value]))
}
export function resourceInteger(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) throw Error('invalid resource quantity')
  return value
}
export function resourceId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) throw Error('invalid resource identity')
  return value
}
export function resourceDigest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
function vector(value: unknown): ResourceVector {
  const r = resourceData(value, resourceAxes)
  return Object.fromEntries(resourceAxes.map(k => [k, resourceInteger(r[k])])) as unknown as ResourceVector
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value) }
  return value
}
/** The expected installation ID comes from the trusted host identity producer,
 * independently of this configuration. No pool/capacity/demand defaults exist.
 * This validates local configuration; it does not establish ownership or admission.
 */
export function readResourceHostPolicy(raw: unknown, expectedHostId: string): Readonly<ResourceHostPolicy> {
  const r = resourceData(raw, ['hostId', 'poolId', 'localPolicyRevision', 'capacity', 'demandProfiles', 'diskPath', 'diskDeviceId', 'maxAgeMs', 'sampleWindowMs', 'timeoutMs'])
  const hostId = resourceId(r.hostId)
  if (hostId !== resourceId(expectedHostId)) throw Error('resource host mismatch')
  const capacity = vector(r.capacity), profiles = resourceData(r.demandProfiles, ['builder', 'reviewer', 'test'])
  resourceInteger(capacity.workerSlots, 1)
  const demandProfiles = {} as ResourceHostPolicy['demandProfiles']
  for (const role of ['builder', 'reviewer', 'test'] as const) {
    const demand = vector(profiles[role]); resourceInteger(demand.workerSlots, 1)
    if (resourceAxes.some(k => demand[k] > capacity[k])) throw Error('resource demand exceeds policy')
    demandProfiles[role] = demand
  }
  if (typeof r.diskPath !== 'string' || !path.isAbsolute(r.diskPath) || r.diskPath.includes('\0') || r.diskPath.length > 4096 ||
      typeof r.diskDeviceId !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(r.diskDeviceId)) throw Error('invalid resource disk source')
  const timeoutMs = resourceInteger(r.timeoutMs, 1, 30000), sampleWindowMs = resourceInteger(r.sampleWindowMs, 1, 10000)
  const maxAgeMs = resourceInteger(r.maxAgeMs, 1)
  if (sampleWindowMs >= timeoutMs || sampleWindowMs > maxAgeMs) throw Error('invalid resource sample window')
  return freeze({ hostId, poolId: resourceId(r.poolId), localPolicyRevision: resourceId(r.localPolicyRevision), capacity, demandProfiles,
    diskPath: path.normalize(r.diskPath), diskDeviceId: r.diskDeviceId, maxAgeMs, sampleWindowMs, timeoutMs })
}
// #endregion resource-host-policy
