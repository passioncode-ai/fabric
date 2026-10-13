// #region git-lease-snapshot — docs: docs/execution/harness-waves/resource-ownership-snapshot.md#contract
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, rm, opendir, lstat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { HARDENED_GIT_ARGS, hardenedGitEnv } from './gitRun.ts'

const exec = promisify(execFile)
const SHA = /^[a-f0-9]{40}$/
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const MAX_COMMIT_BYTES = 16_384
const FETCH_SCRATCH_BYTES = 8 * 1024 * 1024

export interface LeaseSnapshotConfig {
  /** Kernel configuration, never task input or a repository's remote.origin.url. */
  approvedRemote: string
  key: string
  runId: string
  repositoryName: string
  /** Exact previously observed Git tip, or null for an explicitly new observation. */
  expectedTip: string | null
  maxAgeMs: number
  timeoutMs: number
}
export interface LeaseGitOptions { cwd: string; timeoutMs: number; maxBytes: number }
export type LeaseGitRunner = (args: readonly string[], options: LeaseGitOptions) => Promise<string>
export interface LeaseSnapshotDeps {
  /** Trusted transport substitution, not exposed to the task. No caller-supplied verdict. */
  git?: LeaseGitRunner
  now?: () => number
}
export type LeaseSnapshotResult = {
  status: 'observed'
  remoteDigest: string
  key: string
  runId: string
  repositoryName: string
  tip: string
  observedAt: number
  leaseUpdatedAt: number
  expiresAt: number
  /** No external numeric fence exists in the agent-sync Git payload. */
  executionAuthorized: false
} | { status: 'unknown' | 'refused'; reason: string; executionAuthorized: false }

const failure = (status: 'unknown' | 'refused', reason: string): LeaseSnapshotResult =>
  ({ status, reason, executionAuthorized: false })

/** agent-sync 1.22.1 lease_name encoding; no lossy legacy-slug fallback. */
export function exactLeaseRef(key: string): string {
  if (!key || key.length > 200 || /[\s`|\x00-\x1f\x7f]/u.test(key) || /[\ud800-\udfff]/u.test(key)) throw new Error('invalid_lease_key')
  const chars = Array.from(key)
  let name = chars.map((ch, i) => {
    const badDot = ch === '.' && (i === 0 || i === chars.length - 1 || chars[i + 1] === '.')
    if (/^[A-Za-z0-9._-]$/.test(ch) && !badDot) return ch
    return Array.from(Buffer.from(ch)).map(b => '%' + b.toString(16).toUpperCase().padStart(2, '0')).join('')
  }).join('')
  if (name.endsWith('.lock')) name = name.slice(0, -5) + '%2Elock'
  if (name.length > 200) throw new Error('invalid_lease_key')
  return 'refs/agent-sync/leases/' + name
}
function remote(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password && !u.search && !u.hash &&
      !/[\s\x00-\x1f\x7f]/u.test(value) && u.href === value
  } catch { /* Invalid configured URL refuses before I/O; never expose its raw value. */ return false }
}
function configValid(c: LeaseSnapshotConfig): boolean {
  return remote(c.approvedRemote) && [c.runId, c.repositoryName].every(v =>
    typeof v === 'string' && v.length > 0 && Buffer.byteLength(v) <= 200 && !/[\x00-\x1f\x7f]/u.test(v)) &&
    (c.expectedTip === null || SHA.test(c.expectedTip)) &&
    Number.isSafeInteger(c.maxAgeMs) && c.maxAgeMs > 0 && c.maxAgeMs <= 86_400_000 &&
    Number.isSafeInteger(c.timeoutMs) && c.timeoutMs > 0 && c.timeoutMs <= 30_000
}
// Fetch filters are hints: an approved server may ignore them. Monitor the owned scratch,
// with finite traversal work, and stop Git on overflow. This is NOT a hard filesystem quota.
async function scratchWithinBudget(root: string): Promise<void> {
  let entries = 0, bytes = 0
  const visit = async (directory: string): Promise<void> => {
    const stream = await opendir(directory)
    for await (const entry of stream) {
      if (++entries > 1024) throw new Error('scratch_entries')
      const file = join(directory, entry.name), stat = await lstat(file)
      if (stat.isSymbolicLink()) throw new Error('scratch_symlink')
      bytes += stat.size
      if (bytes > FETCH_SCRATCH_BYTES) throw new Error('scratch_bytes')
      if (stat.isDirectory()) await visit(file)
    }
  }
  await visit(root)
}
/** No repository or inherited Git config may redirect the approved URL or execute helpers. */
export const leaseGit: LeaseGitRunner = async (args, options) => {
  const pending = exec('git', [
    ...HARDENED_GIT_ARGS, '-c', 'protocol.https.allow=always',
    '-c', 'http.followRedirects=false', '-c', 'credential.helper=',
    '-c', 'fetch.writeCommitGraph=false', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false',
    ...args
  ], {
    cwd: options.cwd, timeout: options.timeoutMs, maxBuffer: options.maxBytes,
    env: { ...hardenedGitEnv(Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      ['PATH', 'HOME', 'SystemRoot', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL'].includes(key)))), GIT_CONFIG_GLOBAL: '/dev/null', GIT_TEMPLATE_DIR: '',
      GIT_ASKPASS: 'true', SSH_ASKPASS: 'true', GIT_ALLOW_PROTOCOL: 'https', GIT_NO_REPLACE_OBJECTS: '1' }
  })
  let monitor: Promise<void> | null = null, violated = false
  const check = (): void => {
    if (monitor !== null) return
    monitor = scratchWithinBudget(options.cwd).catch(() => {
      // Resource uncertainty refuses; never report an unchecked oversized transfer as a proof.
      violated = true; pending.child.kill('SIGKILL')
    }).finally(() => { monitor = null })
  }
  const timer = args[0] === 'fetch' ? setInterval(check, 25) : null
  try {
    const { stdout } = await pending
    if (timer !== null) clearInterval(timer)
    await monitor
    if (args[0] === 'fetch') await scratchWithinBudget(options.cwd)
    if (violated) throw new Error('scratch_limit')
    return stdout
  } finally {
    if (timer !== null) clearInterval(timer)
    await monitor
  }
}
function tipOf(text: string, ref: string): string | null {
  const lines = text.trim().split('\n')
  if (lines.length !== 1) return null
  const parts = lines[0].split('\t')
  return parts.length === 2 && SHA.test(parts[0]) && parts[1] === ref ? parts[0] : null
}
// Reused lesson: resourceWaitQueue's ordinary native-Promise clock rejection handling.
// Time is synchronous authority input. Reject async/exotic values without reading then
// or constructor accessors; consume only an ordinary native Promise's rejection.
function clock(read: () => number): number | null {
  try {
    const value: unknown = read()
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Promise.prototype &&
        !Object.prototype.hasOwnProperty.call(value, 'constructor')) {
      try { void Promise.prototype.then.call(value, undefined, () => {}) }
      catch { /* A spoofed Promise prototype remains invalid clock data. */ }
    }
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
  } catch {
    // A failed diagnostic clock is unavailable; never substitute fabricated time.
    return null
  }
}
function parseTime(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|\+00:00)$/.test(value)) return null
  const n = Date.parse(value)
  // Round-trip calendar fields: Date.parse normalises impossible dates on some hosts.
  return Number.isSafeInteger(n) && new Date(n).toISOString().slice(0, 19) === value.slice(0, 19) ? n : null
}
function payloadOf(raw: string, tip: string): Record<string, unknown> | null {
  const bytes = Buffer.from(raw)
  if (bytes.length > MAX_COMMIT_BYTES || createHash('sha1').update(`commit ${bytes.length}\0`).update(bytes).digest('hex') !== tip) return null
  const split = raw.indexOf('\n\n')
  if (split < 0) return null
  const headers = raw.slice(0, split).split('\n')
  if (headers[0] !== 'tree ' + EMPTY_TREE || headers.some(h => h.startsWith('parent '))) return null
  try {
    const payload: unknown = JSON.parse(raw.slice(split + 2))
    return payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : null
  } catch { /* Malformed payload becomes the caller's structured refusal, without logging remote data. */ return null }
}

/** A fresh snapshot only. No cache, lease acquisition, mutation, numeric fence, or launch grant. */
export function createGitLeaseSnapshotReader(config: LeaseSnapshotConfig, deps: LeaseSnapshotDeps = {}) {
  const c = { ...config }, git = deps.git ?? leaseGit, now = deps.now ?? Date.now
  let ref = '', valid = false
  try { ref = exactLeaseRef(c.key); valid = configValid(c) } catch { /* Invalid fixed configuration refuses before I/O. */ }
  let outstanding: Promise<LeaseSnapshotResult> | null = null
  async function inspect(): Promise<LeaseSnapshotResult> {
    const started = clock(now)
    if (started === null) return failure('unknown', 'clock_invalid')
    const deadline = performance.now() + c.timeoutMs
    let scratch: string | null = null
    try {
      scratch = await mkdtemp(join(tmpdir(), 'fabric-lease-read-'))
      const run = async (args: string[], maxBytes = MAX_COMMIT_BYTES): Promise<string> => {
        const remaining = Math.ceil(deadline - performance.now())
        if (remaining <= 0) throw new Error('deadline')
        const result = await git(args, { cwd: scratch!, timeoutMs: remaining, maxBytes })
        if (typeof result !== 'string' || Buffer.byteLength(result) > maxBytes) throw new Error('bounded_output')
        return result
      }
      await run(['init', '--bare', '--quiet', '--template='])
      const tip = tipOf(await run(['ls-remote', '--refs', c.approvedRemote, ref], 512), ref)
      if (!tip) return failure('refused', 'missing_or_ambiguous_ref')
      if (c.expectedTip !== null && tip !== c.expectedTip) return failure('refused', 'tip_changed')
      // Fetch only the named lease. The exact object is then read, never a mutable FETCH_HEAD alias.
      await run(['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', '--depth=1', '--filter=tree:0', c.approvedRemote, ref])
      const raw = await run(['cat-file', 'commit', tip])
      const payload = payloadOf(raw, tip)
      if (!payload) return failure('refused', 'unsupported_or_malformed_lease')
      const again = tipOf(await run(['ls-remote', '--refs', c.approvedRemote, ref], 512), ref)
      if (again !== tip) return failure('refused', 'tip_changed')
      if (payload.key !== c.key || payload.run !== c.runId || payload.repo !== c.repositoryName) return failure('refused', 'binding_mismatch')
      const updated = parseTime(payload.ts), since = parseTime(payload.since), ttl = payload.ttl
      if (updated === null || since === null || since > updated + 1000 || typeof ttl !== 'number' || !Number.isSafeInteger(ttl) || ttl <= 0 || ttl > 86_400) return failure('refused', 'malformed_freshness')
      const ended = clock(now), expires = updated + ttl * 1000
      if (ended === null || ended < started) return failure('unknown', 'clock_invalid')
      if (updated > started || since > ended || ended >= expires) return failure('refused', 'expired_or_future')
      if (ended - updated > c.maxAgeMs) return failure('refused', 'stale_observation')
      return { status: 'observed', remoteDigest: createHash('sha256').update(c.approvedRemote).digest('hex'),
        key: c.key, runId: c.runId, repositoryName: c.repositoryName, tip, observedAt: ended,
        leaseUpdatedAt: updated, expiresAt: expires, executionAuthorized: false }
    } catch {
      // The transport's raw error may contain URLs, credentials, paths or remote content. Keep it local.
      return failure('unknown', 'remote_unreadable')
    } finally {
      if (scratch !== null) await rm(scratch, { recursive: true, force: true })
    }
  }
  return {
    read(): Promise<LeaseSnapshotResult> {
      if (!valid) return Promise.resolve(failure('refused', 'invalid_configuration'))
      if (outstanding !== null) return Promise.resolve(failure('unknown', 'prior_io_unresolved'))
      // A caller deadline does not cancel Git/DI promises. Hold the slot until cleanup settles;
      // never publish a late verdict, and never accumulate I/O on repeated reads after timeout.
      const work = Promise.resolve().then(inspect).catch(() => failure('unknown', 'remote_unreadable'))
      outstanding = work
      void work.then(() => { if (outstanding === work) outstanding = null })
      return new Promise(resolve => {
        let delivered = false
        const finish = (result: LeaseSnapshotResult): void => {
          if (delivered) return
          delivered = true; clearTimeout(timer)
          // Scratch cleanup is asynchronous too. Recheck time immediately before publishing,
          // so an observed lease cannot expire during cleanup and emerge as a fresh proof.
          if (result.status === 'observed') {
            const finalNow = clock(now)
            if (finalNow === null || finalNow < result.observedAt) result = failure('unknown', 'clock_invalid')
            else if (finalNow >= result.expiresAt) result = failure('refused', 'expired_or_future')
            else if (finalNow - result.leaseUpdatedAt > c.maxAgeMs) result = failure('refused', 'stale_observation')
            else result = { ...result, observedAt: finalNow }
          }
          resolve(result)
        }
        const timer = setTimeout(() => finish(failure('unknown', 'timeout')), c.timeoutMs)
        void work.then(finish)
      })
    }
  }
}
// #endregion git-lease-snapshot
