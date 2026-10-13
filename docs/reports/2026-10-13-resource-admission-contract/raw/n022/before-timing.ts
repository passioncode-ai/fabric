// #region resource-host-sampler — docs: docs/execution/harness-waves/resource-host-observation.md#contract
import os from 'node:os'
import { realpath, stat, statfs } from 'node:fs/promises'
import { readResourceHostPolicy, resourceData, resourceDigest, resourceId, resourceInteger, type ResourceHostPolicy } from './resourceHostPolicy.ts'
import type { ResourceVector } from '../shared/resourceAdmission.ts'

export interface ResourceHostSamplerDeps {
  /** Existing installation/invocation authority, independent of policy/task input.
   * Return {hostId: hostInstanceId, bootId} from the trusted runtime identity.
   */
  identity(): unknown | Promise<unknown>
  /** Complete current inventory of this explicit pool, not task-authored counts.
   * {hostId,bootId,poolId,localPolicyRevision,atMs,complete:true,workers:[unique ID]}.
   * Absent/unreadable/incomplete inventory leaves workerSlots unknown.
   */
  workers?(): unknown | Promise<unknown>
  system?(): unknown | Promise<unknown>
  disk?(canonicalPath: string): unknown | Promise<unknown>
  pause?(ms: number): Promise<unknown>
  now?(): number
  monotonic?(): number
}
export interface ResourceHostObservation {
  state: 'observed' | 'unknown'
  reason: 'complete' | 'worker-inventory-unavailable' | 'busy' | 'unavailable'
  /** No reservation/ownership/spawn authority follows from an observation. */
  observed: ResourceVector | null
  axes: { workerSlots: number | null; memoryBytes: number | null; diskBytes: number | null; cpuMilliCores: number | null }
  physical: { memoryTotalBytes: number; diskTotalBytes: number; cpuMilliCores: number } | null
  hostId: string
  poolId: string
  localPolicyRevision: string
  policyDigest: string
  snapshotId: string | null
  atMs: number | null // epoch of the earliest read; safe for SQL timestamptz conversion
  completedAtMs: number | null
  durationMs: number | null // monotonic duration; never an SQL epoch
  source: { bootId: string; diskDeviceId: string; diskPathDigest: string; cpuTopologyDigest: string } | null
}
/** Actual host counters, not loadavg, configured capacity or reservation demand. */
export function readResourceHostSystem(): unknown {
  return { totalMemory: os.totalmem(), freeMemory: os.freemem(), cpus: os.cpus().map(c => ({ model: c.model, times: { ...c.times } })) }
}
/** Canonical path plus device checks reject symlink/remount changes around the read. */
export async function readResourceHostDisk(folder: string, current: () => boolean = () => true): Promise<unknown> {
  async function read<T>(operation: () => Promise<T>): Promise<T> {
    if (!current()) throw Error('resource disk read ended')
    return await operation()
  }
  const beforePath = await read(() => realpath(folder)), before = await read(() => stat(beforePath, { bigint: true }))
  const reading = await read(() => statfs(beforePath, { bigint: true }))
  const afterPath = await read(() => realpath(folder)), after = await read(() => stat(afterPath, { bigint: true }))
  if (beforePath !== afterPath || before.dev !== after.dev) throw Error('resource disk changed')
  return { path: beforePath, deviceId: before.dev.toString(), blockSize: reading.bsize, blocks: reading.blocks, availableBlocks: reading.bavail }
}
function identity(raw: unknown) {
  const r = resourceData(raw, ['hostId', 'bootId'])
  return { hostId: resourceId(r.hostId), bootId: resourceId(r.bootId) }
}
function array(raw: unknown, limit: number): unknown[] {
  if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype || raw.length > limit) throw Error('invalid resource array')
  const descriptors = Object.getOwnPropertyDescriptors(raw)
  if (Reflect.ownKeys(raw).length !== raw.length + 1) throw Error('invalid resource array')
  return Array.from({ length: raw.length }, (_, i) => {
    const d = descriptors[String(i)]
    if (!d || !('value' in d)) throw Error('invalid resource array')
    return d.value
  })
}
function system(raw: unknown) {
  const r = resourceData(raw, ['totalMemory', 'freeMemory', 'cpus'])
  const total = resourceInteger(r.totalMemory, 1), free = resourceInteger(r.freeMemory, 0, total)
  const cpus = array(r.cpus, 4096)
  if (cpus.length < 1) throw Error('resource CPU unavailable')
  const counters: bigint[][] = [], models: string[] = []
  for (const item of cpus) {
    const c = resourceData(item, ['model', 'times']), t = resourceData(c.times, ['user', 'nice', 'sys', 'idle', 'irq'])
    if (typeof c.model !== 'string' || c.model.length > 512) throw Error('resource CPU unavailable')
    models.push(c.model); counters.push(['user', 'nice', 'sys', 'idle', 'irq'].map(k => BigInt(resourceInteger(t[k]))))
  }
  return { total, used: total - free, counters, topology: resourceDigest(models) }
}
function disk(raw: unknown, policy: Readonly<ResourceHostPolicy>) {
  const r = resourceData(raw, ['path', 'deviceId', 'blockSize', 'blocks', 'availableBlocks'])
  if (r.path !== policy.diskPath || r.deviceId !== policy.diskDeviceId) throw Error('resource disk mismatch')
  const [size, blocks, available] = [r.blockSize, r.blocks, r.availableBlocks]
  if (typeof size !== 'bigint' || typeof blocks !== 'bigint' || typeof available !== 'bigint' || size < 1n || blocks < 1n || available < 0n || available > blocks) throw Error('resource disk unavailable')
  const total = size * blocks, used = size * (blocks - available)
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('resource disk overflow')
  return { total: Number(total), used: Number(used) }
}
function workers(raw: unknown, policy: Readonly<ResourceHostPolicy>, bootId: string, now: number): number | null {
  try {
    const r = resourceData(raw, ['hostId', 'bootId', 'poolId', 'localPolicyRevision', 'atMs', 'complete', 'workers'])
    if (r.hostId !== policy.hostId || r.poolId !== policy.poolId || r.bootId !== bootId || r.localPolicyRevision !== policy.localPolicyRevision || r.complete !== true) return null
    const at = resourceInteger(r.atMs)
    if (at > now || now - at > policy.maxAgeMs) return null
    const ids = array(r.workers, 100000).map(resourceId)
    return new Set(ids).size === ids.length ? ids.length : null
  } catch { /* Missing or malformed inventory never means an empty pool. */ return null }
}
function clock(read: () => number): number {
  const value: unknown = read()
  // Accidental async clocks are invalid, but ordinary rejection must be observed.
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Promise.prototype && !Object.getOwnPropertyDescriptor(value, 'constructor')) void Promise.prototype.then.call(value, undefined, () => {})
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw Error('resource clock unavailable')
  return value
}
/** One long-lived sampler per explicit pool. Timeout revokes this observation,
 * retaining its I/O slot until every underlying call settles. Replacing the
 * instance does not cancel I/O. No timer, DB writer or production policy is installed.
 */
export function createResourceHostSampler(rawPolicy: unknown, expectedHostId: string, deps: ResourceHostSamplerDeps) {
  const policy = readResourceHostPolicy(rawPolicy, expectedHostId), policyDigest = resourceDigest(policy)
  const readIdentity = deps.identity, readSystem = deps.system ?? readResourceHostSystem, readDisk = deps.disk
  const readWorkers = deps.workers, pause = deps.pause ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  const now = deps.now ?? Date.now, monotonic = deps.monotonic ?? (() => performance.now())
  let busy = false
  const unknown = (reason: ResourceHostObservation['reason']): ResourceHostObservation => ({ state: 'unknown', reason, observed: null,
    axes: { workerSlots: null, memoryBytes: null, diskBytes: null, cpuMilliCores: null }, physical: null,
    hostId: policy.hostId, poolId: policy.poolId, localPolicyRevision: policy.localPolicyRevision, policyDigest, snapshotId: null, atMs: null, completedAtMs: null, durationMs: null, source: null })
  return { policy, async sample(): Promise<ResourceHostObservation> {
    if (busy) return unknown('busy')
    busy = true
    let active = true, finished = false, lastMono = 0
    const outstanding = new Set<Promise<unknown>>()
    const release = () => { if (finished && outstanding.size === 0) busy = false }
    try {
      const start = resourceInteger(clock(now)), startedMono = clock(monotonic); lastMono = startedMono
      const deadline = startedMono + policy.timeoutMs
      async function call<T>(fn: () => T | Promise<T>): Promise<T> {
        const at = clock(monotonic)
        if (!active || at < lastMono || at >= deadline) { active = false; throw Error('resource sampling deadline') }
        lastMono = at
        const pending = Promise.resolve().then(() => { if (!active) throw Error('resource sampling ended'); return fn() })
        outstanding.add(pending)
        const settled = () => { outstanding.delete(pending); release() }
        void pending.then(settled, settled)
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          const value = await Promise.race([pending, new Promise<never>((_, reject) => { timer = setTimeout(() => { active = false; reject(Error('resource sampling deadline')) }, deadline - at) })])
          const ended = clock(monotonic)
          if (!active || ended < lastMono || ended >= deadline) { active = false; throw Error('resource sampling deadline') }
          lastMono = ended
          return value
        } finally { if (timer) clearTimeout(timer) }
      }
      const initialIdentity = identity(await call(readIdentity))
      if (initialIdentity.hostId !== policy.hostId) throw Error('resource host mismatch')
      const first = system(await call(readSystem))
      const volume = disk(await call(() => (readDisk ? readDisk(policy.diskPath) : readResourceHostDisk(policy.diskPath, () => active && clock(monotonic) < deadline))), policy)
      let inventory: unknown = null
      if (readWorkers) {
        try { inventory = await call(readWorkers) }
        catch { if (!active) throw Error('resource sampling ended'); /* An unavailable inventory leaves workers unknown. */ }
      }
      await call(() => pause(policy.sampleWindowMs))
      const last = system(await call(readSystem)), finalIdentity = identity(await call(readIdentity))
      const atMs = resourceInteger(clock(now)), durationMs = clock(monotonic) - startedMono
      if (initialIdentity.hostId !== finalIdentity.hostId || initialIdentity.bootId !== finalIdentity.bootId ||
          last.topology !== first.topology || last.total !== first.total || atMs < start || atMs - start > policy.maxAgeMs || durationMs < policy.sampleWindowMs || durationMs > policy.maxAgeMs) throw Error('resource observation changed')
      let total = 0n, idle = 0n
      first.counters.forEach((row, i) => row.forEach((value, k) => {
        const delta = last.counters[i][k] - value
        if (delta < 0n) throw Error('resource CPU reset')
        total += delta; if (k === 3) idle += delta
      }))
      if (total <= 0n) throw Error('resource CPU interval unavailable')
      const cores = BigInt(first.counters.length * 1000), cpu = Number(((total - idle) * cores + total - 1n) / total)
      const slots = workers(inventory, policy, finalIdentity.bootId, atMs)
      const axes = { workerSlots: slots, memoryBytes: Math.max(first.used, last.used), diskBytes: volume.used, cpuMilliCores: cpu }
      const source = { bootId: finalIdentity.bootId, diskDeviceId: policy.diskDeviceId, diskPathDigest: resourceDigest(policy.diskPath), cpuTopologyDigest: first.topology }
      return { state: slots === null ? 'unknown' : 'observed', reason: slots === null ? 'worker-inventory-unavailable' : 'complete',
        observed: slots === null ? null : { ...axes, workerSlots: slots }, axes,
        physical: { memoryTotalBytes: last.total, diskTotalBytes: volume.total, cpuMilliCores: Number(cores) },
        hostId: policy.hostId, poolId: policy.poolId, localPolicyRevision: policy.localPolicyRevision, policyDigest,
        snapshotId: resourceDigest([policyDigest, start, atMs, source, axes]), atMs: start, completedAtMs: atMs, durationMs, source }
    } catch { /* Structured unknown retains failed readings without exposing paths or dependency errors. */ return unknown('unavailable') }
    finally { active = false; finished = true; release() }
  } }
}
// #endregion resource-host-sampler
