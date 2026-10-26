// #region agent-branches — docs: docs/ux/2026-10-26-simple-fabric.md#1-the-left-column
/**
 * The git branch each agent at work is on (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §1 «Where the
 * branch comes from»): a console Fabric holds knows its folder (`HeldSession.folder`), and its branch is
 * `git rev-parse --abbrev-ref HEAD` there, through the hardened runner (`gitRun.ts`). Read never from a render: once per
 * folder per window (the home's 15 s reading), shared by every console in that folder, at most `concurrency` folders at
 * a time, each with its own deadline. A folder git cannot read, and a detached HEAD, give no branch: the screens say
 * «ветка неизвестна», and the reading of who works is never failed by it. An agent that joined from its own terminal
 * shares no folder (`session.enrolled@1` keeps a digest only), so it carries none until 0.3.15 (open choice 3).
 */
import type { HomeView } from '../shared/homeLive.ts'
import { gitRun } from './gitRun.ts'

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
  const ttl = deps.ttlMs ?? 15_000
  const now = deps.now ?? Date.now
  const limit = Math.max(1, deps.concurrency ?? 4)
  const git = deps.git ?? ((folder: string, args: string[]) => gitRun(folder, args, { timeoutMs: deps.timeoutMs ?? 3_000 }))
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
    read(folder) {
      const at = now()
      const kept = cache.get(folder)
      if (kept && at - kept.at <= ttl) return kept.branch
      const branch = slot(() => git(folder, ['rev-parse', '--abbrev-ref', 'HEAD'])).then(
        (out) => {
          const name = out.trim()
          return name && name !== 'HEAD' ? name : null
        },
        () => null
      )
      cache.set(folder, { at, branch })
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
