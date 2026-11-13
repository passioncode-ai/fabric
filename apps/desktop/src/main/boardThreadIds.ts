// The request threads a board pass reads: open ones first, then the newest (CO-572).
//
// One week of the board held 326 request threads on 2026-11-13 while the dispatcher and the sweep read only the
// newest 300 by last activity, so the threads quiet longest, the ones whose open request most needs a wake, were the
// ones left out, and the dispatcher said nothing about it. The threads with an open request come first now (the
// board's own `openOnly` filter, `board_request_open`), then the newest of all for the answered requests a pass
// still judges; each read has its own bound, and `capped` says when either stopped there.

import type { CommsThreadPageReply } from '../shared/commsRead.ts'

// #region board-open-threads-first — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#39-two-machines-sleep-retries-and-memory-2026-11-12
/** Pages of 100 threads with an open request a pass reads: a request open on more than 1 000 threads is past the board. */
export const OPEN_THREAD_PAGES = 10
/** Pages of 100 of the newest request threads, open or not, read after them. */
export const RECENT_THREAD_PAGES = 3

export interface ThreadPager {
  threadPage(estateId: string, filter: unknown, before: unknown, limit?: number): Promise<CommsThreadPageReply>
}

/**
 * The ids of the request threads active since `since`, those with an open request first, each once. A page that does
 * not answer throws (an unread board is never "nothing waits"); `capped` is true when a read stopped at its bound.
 */
export async function readRequestThreadIds(comms: ThreadPager, estateId: string, since: string): Promise<{ ids: string[]; capped: boolean }> {
  const ids: string[] = []
  const seen = new Set<string>()
  let capped = false
  for (const [filter, pages] of [[{ kind: 'request', activeSince: since, openOnly: true }, OPEN_THREAD_PAGES], [{ kind: 'request', activeSince: since }, RECENT_THREAD_PAGES]] as const) {
    let before: unknown = null
    for (let page = 0; page < pages; page++) {
      const r = await comms.threadPage(estateId, filter, before, 100)
      if (!r.ok) throw new Error(`the board's threads could not be read: ${r.error?.message ?? 'no reason given'}`)
      for (const t of r.threads) if (!seen.has(t.id)) { seen.add(t.id); ids.push(t.id) }
      if (!r.more || !r.before) break
      if (page === pages - 1) capped = true
      before = r.before
    }
  }
  return { ids, capped }
}
// #endregion board-open-threads-first
