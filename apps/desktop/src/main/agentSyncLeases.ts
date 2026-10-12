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
    return false
  }
}

export interface LeaseRefDeps {
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
      return unread('remote-unreadable', `the repository's remote could not be read (${e instanceof Error ? e.message : String(e)})`)
    }
    if (!remote) return unread('no-origin', 'the repository has no origin remote, so it carries no agent-sync leases')
    if (!isListableRemote(remote)) return unread('not-listable', 'the origin remote is not an https or ssh URL, and Fabric reads no other kind')
    try {
      const { leases, truncated } = parseLeaseRefs(await deps.lsRemote(remote))
      return { read: true, remote, readAt, leases, truncated }
    } catch (e) {
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
