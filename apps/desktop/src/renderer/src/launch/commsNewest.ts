// The newest posts of the board, for Comms' «Лента» (OF-29). A post's sequence number is its journal number, which
// every other event takes too, so "the last 100 numbers" holds a handful of posts or none (0.3.11 review, iteration 1,
// DA-1: 8 of 887 on the operator's database). The board's page reads forward from a number, so this reads a window
// back from the newest number, widens it while it holds too few posts, and narrows it when it holds more than a few
// pages can read, so what it keeps is always the newest ones.
import type { CommsPageReply, CommsMessage } from '../../../shared/commsRead.ts'

type List = (threadId: string | null, afterSeq: number, limit?: number) => Promise<CommsPageReply>

/** How many pages of 100 one window may read before it is called too wide. */
const PAGES = 5
/** How many windows one reading may try. */
const PASSES = 14

/** The newest `want` posts, newest first; null when the board did not answer. */
export async function newestPosts(list: List, lastSeq: number, want = 100, firstWindow = 2000): Promise<CommsMessage[] | null> {
  // A window either reads to its end holding too few posts (`few`), or holds more than PAGES can reach (`many`).
  // The next window lies between the widest too-few and the narrowest too-many, so the search converges instead of
  // swinging between them (0.3.11 review, iteration 2, DA-2: a quiet newest stretch over a busy older one).
  let window = Math.max(1, firstWindow)
  let few = 0
  let many = Infinity
  let best: CommsMessage[] = []
  for (let pass = 0; pass < PASSES; pass++) {
    const after = Math.max(0, lastSeq - window)
    const seen: CommsMessage[] = []
    let cursor = after
    let more = true
    for (let page = 0; page < PAGES && more; page++) {
      const reply = await list(null, cursor, 100)
      if (!reply.ok) return null
      seen.push(...reply.messages)
      more = reply.more && reply.lastSeq > cursor
      cursor = reply.lastSeq
    }
    if (more) {
      many = Math.min(many, window)
    } else {
      if (seen.length >= best.length) best = seen
      if (seen.length >= want || after === 0) break
      few = Math.max(few, window)
    }
    const next = many === Infinity ? window * 4 : Math.floor((few + many) / 2)
    if (next <= few || next >= many) break
    window = next
  }
  return [...best].sort((a, b) => b.at.localeCompare(a.at)).slice(0, want)
}
