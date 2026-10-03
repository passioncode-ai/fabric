// What the code is doing (M56).
//
// The project page had nothing to say about its own repositories: no branch, no
// uncommitted count, no ahead/behind, no last commit. On a page whose subject IS
// a repository that was the largest single omission, and it is the fact an
// operator checks more often than any other.
//
// CO-098 asked how to read it without making the page slow. The answer is here
// and it has two halves. **Never from a render**: a panel that shells out to git
// while React draws will shell out on every draw. And **never blindly cached**:
// a branch name that is thirty seconds stale is a lie told confidently. So a
// short TTL plus a watch on the repository's own `.git`, debounced — the watch
// makes it feel immediate, the TTL makes it correct when the watch misses
// something (and `fs.watch` on macOS does miss things).
//
// Every reading carries `readAt`. A caller that cannot tell fresh from stale
// cannot decide anything, and this is the same rule the memory tools follow.

import { existsSync, watch, type FSWatcher } from 'node:fs'
import path from 'node:path'
import { gitRun } from './gitRun.ts'
import { ops } from './opsSink.ts'

export interface RepoState {
  path: string
  /** Null when the directory is not a git repository at all. */
  branch: string | null
  /** Null when the branch has no upstream — which is not an error, it is a fact. */
  ahead: number | null
  behind: number | null
  /** Working-tree entries, split so "8 changed" and "3 untracked" are different. */
  changed: number
  untracked: number
  lastCommit: { sha: string; subject: string; at: string } | null
  /** When this reading was taken. Present on every reading, fresh or cached. */
  readAt: string
  /** Set when git could not be read; the rest is then the last good reading. */
  error: string | null
}

export interface RepoStateReader {
  /** The current reading, from cache when it is young enough. */
  read(repoPath: string): Promise<RepoState>
  /** Drop the cache for one path, or all of them. */
  invalidate(repoPath?: string): void
  /** Watch a set of repositories; replaces any previous set. */
  watchAll(paths: string[], onChange: (repoPath: string) => void): void
  stop(): void
}

export interface RepoStateDeps {
  /** Injected so the parsing can be probed without a repository. */
  git?: (repoPath: string, args: string[]) => Promise<string>
  ttlMs?: number
  debounceMs?: number
  now?: () => number
}

const DEFAULT_TTL = 5_000
const DEFAULT_DEBOUNCE = 300

/** `git status --porcelain=v1` — `??` is untracked, everything else is a change. */
export function parseStatus(porcelain: string): { changed: number; untracked: number } {
  let changed = 0
  let untracked = 0
  for (const line of porcelain.split('\n')) {
    if (!line.trim()) continue
    if (line.startsWith('??')) untracked++
    else changed++
  }
  return { changed, untracked }
}

/** `git rev-list --left-right --count @{u}...HEAD` → "behind<TAB>ahead". */
export function parseAheadBehind(out: string): { ahead: number; behind: number } | null {
  const m = out.trim().match(/^(\d+)\s+(\d+)$/)
  if (!m) return null
  return { behind: Number(m[1]), ahead: Number(m[2]) }
}

export function createRepoStateReader(deps: RepoStateDeps = {}): RepoStateReader {
  const git = deps.git ?? gitRun
  const ttl = deps.ttlMs ?? DEFAULT_TTL
  const debounce = deps.debounceMs ?? DEFAULT_DEBOUNCE
  const now = deps.now ?? Date.now

  const cache = new Map<string, { at: number; state: RepoState }>()
  const watchers = new Map<string, FSWatcher>()
  const timers = new Map<string, NodeJS.Timeout>()

  // #region repo-state-measure — docs: docs/adr/0100-first-run-and-start-paths.md#scan
  // Every read goes through the hardened runner (`gitRun.ts`, ADR-0100 §3); what it cannot read is said.
  async function measure(repoPath: string): Promise<RepoState> {
    const base: RepoState = {
      path: repoPath,
      branch: null,
      ahead: null,
      behind: null,
      changed: 0,
      untracked: 0,
      lastCommit: null,
      readAt: new Date(now()).toISOString(),
      error: null
    }
    try {
      // Detached HEAD returns "HEAD", which is a real state and not an error.
      const branch = (await git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
      base.branch = branch || null
    } catch (e) {
      // The branch reading failed and the caller already renders that as a
      // fact rather than as a failure; the read itself is recorded above.
      return { ...base, error: e instanceof Error ? e.message.split('\n')[0] : String(e) }
    }

    // Each of the three is allowed to fail on its own. A branch with no upstream
    // has no ahead/behind, and an empty repository has no commit — neither makes
    // the other two unknowable, and reporting the whole reading as broken
    // because one part is absent is how a panel ends up permanently empty.
    await Promise.all([
      git(repoPath, ['status', '--porcelain=v1'])
        .then((out) => Object.assign(base, parseStatus(out)))
        .catch((e) => {
          // Unlike a missing upstream or an empty history, a failing status is not a fact about the
          // repository: zero changes with `error: null` would show a clean tree nobody saw (iteration 3,
          // errors finding 7). Recorded, so the last good counts are kept and the failure is said.
          base.error = `git status failed: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`
        }),
      git(repoPath, ['rev-list', '--left-right', '--count', '@{u}...HEAD'])
        .then((out) => {
          const ab = parseAheadBehind(out)
          if (ab) Object.assign(base, ab)
        })
        .catch(() => {}),
      git(repoPath, ['log', '-1', '--format=%H%x00%s%x00%cI'])
        .then((out) => {
          const [sha, subject, at] = out.trim().split('\0')
          if (sha) base.lastCommit = { sha: sha.slice(0, 8), subject: subject ?? '', at: at ?? '' }
        })
        .catch(() => {})
    ])
    return base
  }
  // #endregion repo-state-measure

  return {
    async read(repoPath: string): Promise<RepoState> {
      const hit = cache.get(repoPath)
      if (hit && now() - hit.at < ttl) return hit.state
      const state = await measure(repoPath)
      // A failed reading keeps the last good one's facts and carries the error,
      // rather than blanking the panel: "we could not look just now" is a
      // different statement from "there is nothing here".
      const merged = state.error && hit ? { ...hit.state, readAt: state.readAt, error: state.error } : state
      cache.set(repoPath, { at: now(), state: merged })
      return merged
    },

    invalidate(repoPath?: string): void {
      if (repoPath) cache.delete(repoPath)
      else cache.clear()
    },

    watchAll(paths: string[], onChange: (repoPath: string) => void): void {
      for (const w of watchers.values()) w.close()
      watchers.clear()
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()

      for (const repoPath of paths) {
        const gitDir = path.join(repoPath, '.git')
        if (!existsSync(gitDir)) continue
        try {
          // Not recursive: `.git` holds objects, and watching those is thousands
          // of events for one commit. HEAD, index and refs live at this level.
          const w = watch(gitDir, { persistent: false }, () => {
            clearTimeout(timers.get(repoPath))
            timers.set(
              repoPath,
              setTimeout(() => {
                cache.delete(repoPath)
                onChange(repoPath)
              }, debounce)
            )
          })
          watchers.set(repoPath, w)
        } catch (e) {
          // A repository that cannot be watched is still readable on the TTL.
          ops.failed('repoState.failure', e, { note: `could not watch ${gitDir}:` })
        }
      }
    },

    stop(): void {
      for (const w of watchers.values()) w.close()
      watchers.clear()
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
    }
  }
}
