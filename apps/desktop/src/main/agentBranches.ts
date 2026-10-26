// #region agent-branches — docs: docs/ux/2026-10-26-simple-fabric.md#1-the-left-column
/**
 * The git branch each agent at work is on (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §1 «Where the
 * branch comes from»): a console Fabric holds knows its folder (`HeldSession.folder`), and its branch is
 * `git rev-parse --abbrev-ref HEAD` there, through the hardened runner (`gitRun.ts`). Read never from a render: once per
 * folder per 60 s (`BRANCH_TTL_MS`, above the home's 15 s reading, the 0.3.14 review, iteration 2, ER-16, DA-2), shared
 * by every console in that folder, at most `concurrency` folders at a time, each with its own deadline; a git that does
 * not answer by the deadline (one that ignores SIGTERM included) counts as unread and is held for the same 60 s, and
 * the reading never waits on it past `timeoutMs` + 1 s. A folder git cannot read, and a detached HEAD, give no branch: the screens say
 * «ветка неизвестна», and the reading of who works is never failed by it. An agent that joined from its own terminal
 * shares no folder (`session.enrolled@1` keeps a digest only), so it carries none until 0.3.15 (open choice 3).
 */
import type { HomeView } from '../shared/homeLive.ts'
import { gitRun } from './gitRun.ts'

/** How long a folder's branch, or its failure to read, is kept: above the home's 15 s reading, so a reading does not
 *  run git each time (the 0.3.14 review, iteration 2, ER-16, DA-2). */
export const BRANCH_TTL_MS = 60_000

export interface BranchReader {
  /** The folder's branch, or null when it has none git could name. Never throws. */
  read(folder: string): Promise<string | null>
}

export function createBranchReader(deps: {
  git?: (folder: string, args: string[]) => Promise<string>
  now?: () => number
  ttlMs?: number
  concurrency?: number
  timeoutMs?: number
} = {}): BranchReader {
  const ttl = deps.ttlMs ?? BRANCH_TTL_MS
  const now = deps.now ?? Date.now
  const limit = Math.max(1, deps.concurrency ?? 4)
  const timeoutMs = deps.timeoutMs ?? 3_000
  const git = deps.git ?? ((folder: string, args: string[]) => gitRun(folder, args, { timeoutMs }))
  const cache = new Map<string, { at: number; branch: Promise<string | null> }>()
  let running = 0
  const queue: Array<() => void> = []
  const slot = async <T>(work: () => Promise<T>): Promise<T> => {
    if (running >= limit) await new Promise<void>((go) => queue.push(go))
    running++
    try {
      return await work()
    } finally {
      running--
      queue.shift()?.()
    }
  }
  return {
    // The folder is a console's own working directory (the operator's repository), never Fabric's own provenance.
    read(repoPath) {
      const at = now()
      const kept = cache.get(repoPath)
      if (kept && at - kept.at <= ttl) return kept.branch
      let timer: ReturnType<typeof setTimeout> | undefined
      const late = new Promise<null>((done) => { timer = setTimeout(() => done(null), timeoutMs + 1_000) })
      const asked = slot(() => git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])).then(
        (out) => {
          const name = out.trim()
          return name && name !== 'HEAD' ? name : null
        },
        () => null
      )
      const branch = Promise.race([asked, late]).finally(() => clearTimeout(timer))
      cache.set(repoPath, { at, branch })
      // A folder no longer asked about leaves the cache once its window has passed.
      for (const [k, v] of cache) if (at - v.at > ttl * 4) cache.delete(k)
      return branch
    }
  }
}

/** The home's reading with each live agent's branch: the folder's, for a console Fabric holds; null otherwise. */
export async function withBranches(
  view: HomeView,
  held: ReadonlyArray<{ sessionId: string; folder?: string | null }>,
  reader: BranchReader
): Promise<HomeView> {
  const folderOf = new Map(held.filter((h) => typeof h.folder === 'string' && h.folder).map((h) => [h.sessionId, h.folder as string]))
  const live = await Promise.all(view.live.map(async (a) => {
    const folder = a.console ? folderOf.get(a.sessionId) : undefined
    return { ...a, branch: folder ? await reader.read(folder) : null }
  }))
  return { ...view, live }
}
// #endregion agent-branches
