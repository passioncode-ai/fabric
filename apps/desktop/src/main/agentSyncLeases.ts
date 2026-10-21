// #region agent-sync-lease-refs — docs: docs/evidence/plans/2026-10-11-release-040-agents-first.md#c4--work-log-protocol-every-coding-agent-knows-how-to-log-and-track
/**
 * agent-sync's leases, shown read-only (REQ-08): `git ls-remote <origin> 'refs/agent-sync/leases/*'` of a project's
 * repository — the refs a lease taken on any machine leaves on the remote (AGENTS.md, "Coordination from a second
 * machine"). Fabric never takes, renews or releases one; it shows that they exist.
 *
 * WHY NOT `gitRun`. The repository read refuses every transport (`protocol.allow=never`), which is right for a read
 * of a working tree and makes `ls-remote` impossible. So the remote is read the other way round: its URL is read
 * from the repository's config by the hardened `gitRun` (reading config runs nothing), checked to be https or ssh
 * (`workClaims.ts#isListableRemote` — never a local path, `file://` or `ext::`), and `ls-remote` runs OUTSIDE the
 * repository, in the temporary folder: no setting of the repository being read applies to it — not its
 * `core.sshCommand`, not its credential helper, not its `url.*.insteadOf`. Only https and ssh are allowed, hooks
 * are off, no prompt can open, the read is bounded in time (8 s) and size (1 MB), and its answer — or its failure,
 * with the reason — is kept for a minute, so a list that is called on every agent's start costs one remote read.
 */
import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { gitRun, hardenedGitEnv } from './gitRun.ts'
import { isListableRemote, parseLeaseRefs, LEASE_REF_PREFIX, type LeaseReadCode, type LeaseRef } from '../shared/workClaims.ts'

const exec = promisify(execFile)

/** An unread list carries a `code` the screens translate (0.3.5 review UX-5) and the `reason` in English for the
 *  agents' `fabric_work_list`, which reads words, not codes. The reason never repeats a prefix a screen adds. */
export type LeaseRefsRead =
  | { read: true; remote: string; readAt: string; leases: LeaseRef[]; truncated: boolean }
  | { read: false; code: LeaseReadCode; reason: string; readAt: string }

/** Whether a repository uses agent-sync: its coordination config is committed at `.claude/agent-sync.json`
 *  (`npx @ssheleg/agent-sync install` writes it). Only such a repository's remote is asked for leases. */
export async function usesAgentSync(repoPath: string): Promise<boolean> {
  try {
    await access(path.join(repoPath, '.claude', 'agent-sync.json'))
    return true
  } catch {
    // No config file is the answer "this repository does not use agent-sync", not a failure to report.
    return false
  }
}

export interface LeaseRefDeps {
  /** A lease ref's commit message, read from the local repository (TR-7), or null when the object is not here. The
   *  default reads it with the hardened `gitRun`: no transport, nothing fetched. */
  bodyOf?(repoPath: string, sha: string): Promise<string | null>
  /** The repository's `origin` URL, or null when it has none. */
  remoteOf(repoPath: string): Promise<string | null>
  /** `git ls-remote` of a checked URL; resolves to its stdout. */
  lsRemote(url: string): Promise<string>
  /** Whether the repository uses agent-sync; default `usesAgentSync` (its config file is there). */
  usesAgentSync?(repoPath: string): Promise<boolean>
  now?: () => number
  /** How long an answer (or a failure) is kept. Default one minute. */
  ttlMs?: number
}

export const LS_REMOTE_TIMEOUT_MS = 8_000
export const LS_REMOTE_MAX_BYTES = 1_000_000
/** How many lease bodies are read at once (TR-7): at most LEASE_REFS_MAX refs, each one local `git log`. */
export const LEASE_BODY_READS_AT_ONCE = 8

/** The default `remoteOf`: the hardened repository read, bounded. */
export async function originOf(repoPath: string): Promise<string | null> {
  try {
    const out = (await gitRun(repoPath, ['config', '--get', 'remote.origin.url'], { timeoutMs: 3_000 })).trim()
    return out || null
  } catch (e) {
    // Exit 1 is "no such key": the repository has no origin, which the caller says.
    if ((e as { code?: unknown }).code === 1) return null
    throw e
  }
}

/** The default `lsRemote`: outside any repository, https and ssh only, bounded, no prompt. */
export async function lsRemoteLeases(url: string): Promise<string> {
  if (!isListableRemote(url)) throw new Error('the remote is not an https or ssh URL')
  const args = [
    '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always', '-c', 'protocol.ssh.allow=always',
    '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false',
    'ls-remote', '--refs', url, `${LEASE_REF_PREFIX}*`
  ]
  const { stdout } = await exec('git', args, {
    cwd: tmpdir(),
    timeout: LS_REMOTE_TIMEOUT_MS,
    maxBuffer: LS_REMOTE_MAX_BYTES,
    env: { ...hardenedGitEnv(), GIT_ASKPASS: 'true', SSH_ASKPASS: 'true', SSH_ASKPASS_REQUIRE: 'never' }
  })
  return stdout
}

// #region agent-sync-lease-expiry — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking
/** The default `bodyOf`: the lease commit's message from the local object store, bounded; null when it is not here. */
export async function leaseBodyOf(repoPath: string, sha: string): Promise<string | null> {
  if (!/^([0-9a-f]{40}|[0-9a-f]{64})$/.test(sha)) return null
  try {
    return (await gitRun(repoPath, ['log', '-1', '--format=%B', sha], { timeoutMs: 3_000 })).trim() || null
  } catch {
    // The object is not in this repository (a lease another machine took and nobody fetched): its state is unknown.
    return null
  }
}

/** What a lease body says of its life (agent-sync's own rule, `ts + ttl`): live until then, expired after it, or
 *  unknown when the body is not a lease agent-sync wrote. */
export function leaseLife(body: string | null, now: number): { state: 'live' | 'expired' | 'unknown'; expiresAt: string | null } {
  let v: { ts?: unknown; ttl?: unknown } | null = null
  try {
    v = body ? (JSON.parse(body) as { ts?: unknown; ttl?: unknown }) : null
  } catch {
    // Not JSON: not a lease agent-sync wrote, so its state is unknown (said by the caller), never live.
    v = null
  }
  const at = typeof v?.ts === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/.test(v.ts) ? Date.parse(v.ts) : NaN
  const ttl = typeof v?.ttl === 'number' ? v.ttl : typeof v?.ttl === 'string' && /^\d+$/.test(v.ttl) ? Number(v.ttl) : NaN
  if (!Number.isFinite(at) || !Number.isFinite(ttl) || ttl < 0) return { state: 'unknown', expiresAt: null }
  const expires = at + ttl * 1000
  return { state: expires > now ? 'live' : 'expired', expiresAt: new Date(expires).toISOString() }
}

/** What is shown as current (TR-7): live and unread leases listed, expired ones only counted. */
export type CurrentLeases = Extract<LeaseRefsRead, { read: false }> | (Extract<LeaseRefsRead, { read: true }> & { expired: number })
export function currentLeases<T extends LeaseRefsRead>(read: T): CurrentLeases & Omit<T, 'leases' | 'read'> {
  if (!read.read) return read as CurrentLeases & Omit<T, 'leases' | 'read'>
  const expired = read.leases.filter((l) => l.state === 'expired').length
  return { ...read, leases: read.leases.filter((l) => l.state !== 'expired'), expired } as CurrentLeases & Omit<T, 'leases' | 'read'>
}
// #endregion agent-sync-lease-expiry

export function createLeaseRefReader(deps: LeaseRefDeps = { remoteOf: originOf, lsRemote: lsRemoteLeases }) {
  const now = deps.now ?? Date.now
  const ttl = deps.ttlMs ?? 60_000
  const cache = new Map<string, { at: number; value: Promise<LeaseRefsRead> }>()

  const uses = deps.usesAgentSync ?? usesAgentSync
  async function readOnce(repoPath: string): Promise<LeaseRefsRead> {
    const readAt = new Date(now()).toISOString()
    const unread = (code: LeaseReadCode, reason: string): LeaseRefsRead => ({ read: false, code, reason, readAt })
    // A repository that does not use agent-sync is not asked: no remote read, and no block on its project page.
    if (!(await uses(repoPath).catch(() => false))) return unread('not-used', 'this repository does not use agent-sync (no .claude/agent-sync.json)')
    let remote: string | null
    try {
      remote = await deps.remoteOf(repoPath)
    } catch (e) {
      // Not silent: the reason goes back to the caller as a typed `remote-unreadable` reading.
      return unread('remote-unreadable', `the repository's remote could not be read (${e instanceof Error ? e.message : String(e)})`)
    }
    if (!remote) return unread('no-origin', 'the repository has no origin remote, so it carries no agent-sync leases')
    if (!isListableRemote(remote)) return unread('not-listable', 'the origin remote is not an https or ssh URL, and Fabric reads no other kind')
    try {
      const { leases, truncated } = parseLeaseRefs(await deps.lsRemote(remote))
      // TR-7: each ref's own body says whether it is still held. Read locally, eight at a time, never fetched.
      const bodyOf = deps.bodyOf ?? leaseBodyOf
      const at = now()
      const lived: LeaseRef[] = []
      for (let i = 0; i < leases.length; i += LEASE_BODY_READS_AT_ONCE) {
        const batch = leases.slice(i, i + LEASE_BODY_READS_AT_ONCE)
        lived.push(...(await Promise.all(batch.map(async (l) => ({ ...l, ...leaseLife(await bodyOf(repoPath, l.sha).catch(() => null), at) })))))
      }
      return { read: true, remote, readAt, leases: lived, truncated }
    } catch (e) {
      // Not silent: every branch below returns a typed reading with its reason.
      const err = e as { killed?: boolean; signal?: string; code?: unknown; message?: string }
      if (err.killed || err.signal === 'SIGTERM') return unread('timeout', `no answer within ${LS_REMOTE_TIMEOUT_MS / 1000} s`)
      if (err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return unread('too-large', 'the answer was larger than Fabric reads')
      return unread('refused', 'the remote refused or could not be reached')
    }
  }

  return {
    /** The lease refs on a repository's origin: kept for `ttlMs`, failing soft with a reason, never a throw. */
    read(repoPath: string): Promise<LeaseRefsRead> {
      const hit = cache.get(repoPath)
      if (hit && now() - hit.at < ttl) return hit.value
      const value = readOnce(repoPath)
      cache.set(repoPath, { at: now(), value })
      // Bounded: a long-running app forgets repositories it has not read for a while.
      if (cache.size > 64) for (const [k, v] of cache) if (now() - v.at >= ttl) cache.delete(k)
      return value
    }
  }
}
export type LeaseRefReader = ReturnType<typeof createLeaseRefReader>
// #endregion agent-sync-lease-refs
