// #region comms-operator-reads-w4 — docs: docs/ux/screens.md#scr-81-project-comms
// The Comms thread list's pure rules (SCN-143's wave-4 amendment, W4-3): the filter the board is asked, how the polled
// first page and the older pages the operator asked for merge into what the screen holds, the 200-thread bound, and
// the rail's count from the heads. Kept apart from the component so each rule is tested without a render.
import type { CommsHead, CommsPageThread, CommsThreadCursor, CommsThreadFilter } from '../../../shared/commsRead.ts'

/** One page, as the board pages it (it caps a page at 100). */
export const PAGE = 50
/** The most threads the screen holds; past it the oldest go (bounded rendering, no new dependency). */
export const MAX_HELD = 200

/** The five filters, each at its widest by default, combining as AND. `project` is the participant filter — the entry
 *  point another screen may open Comms with (SCN-143, kept stable). */
export interface ThreadFilters {
  project: string | null
  kind: CommsThreadFilter['kind'] | null
  openOnly: boolean
  /** Last activity: the last 24 hours, the last 7 days, or all time — measured back from now, inclusive at the edge. */
  activity: 'all' | 'day' | 'week'
  /** A coding agent that took part in the thread's requests. */
  provider: string | null
}
export const ALL_THREADS: ThreadFilters = { project: null, kind: null, openOnly: false, activity: 'all', provider: null }
const WINDOW_MS = { day: 24 * 3_600_000, week: 7 * 24 * 3_600_000 } as const

/** The board's filter for these choices. The window becomes the instant it starts, from the clock the caller reads once
 *  per read; an undated thread is in no window, which the board decides (it holds no `lastAt` for it). */
export function boardFilterOf(f: ThreadFilters, nowMs: number): CommsThreadFilter {
  const out: CommsThreadFilter = {}
  if (f.project !== null) out.project = f.project
  if (f.kind !== null) out.kind = f.kind
  if (f.openOnly) out.openOnly = true
  if (f.activity !== 'all') out.activeSince = new Date(nowMs - WINDOW_MS[f.activity]).toISOString()
  if (f.provider !== null) out.provider = f.provider
  return out
}

/** The page order: newest activity first, then id — the board's keyset, compared the same way (ids are lower-case). */
const order = (a: CommsPageThread, b: CommsPageThread): number =>
  a.lastSeq !== b.lastSeq ? b.lastSeq - a.lastSeq : a.id < b.id ? 1 : a.id > b.id ? -1 : 0
/** Is `a` strictly after `boundary` in the page order — older than it? */
const olderThan = (a: CommsPageThread, boundary: CommsPageThread): boolean => order(a, boundary) > 0

/** What the screen holds: the threads, and whether the board has older ones beyond the oldest held. */
export interface Held { rows: CommsPageThread[]; more: boolean }

const bound = (rows: CommsPageThread[], more: boolean): Held =>
  rows.length > MAX_HELD ? { rows: rows.slice(0, MAX_HELD), more: true } : { rows, more }

/** A polled first page replaces its own window of the list — everything at or above its last row, so a thread that no
 *  longer matches drops out — and keeps the older pages already read below it. A thread that moved up is held once. */
export function mergeFirstPage(held: Held | null, first: { threads: CommsPageThread[]; more: boolean }): Held {
  const top = [...first.threads].sort(order)
  if (!first.more || top.length === 0 || !held) return bound(top, first.more)
  const boundary = top[top.length - 1]
  const ids = new Set(top.map((t) => t.id))
  const kept = held.rows.filter((r) => !ids.has(r.id) && olderThan(r, boundary))
  return bound([...top, ...kept].sort(order), kept.length > 0 ? held.more : first.more)
}

/** An older page the operator asked for, appended below by the same order. */
export function appendOlder(held: Held, older: { threads: CommsPageThread[]; more: boolean }): Held {
  const ids = new Set(held.rows.map((t) => t.id))
  return bound([...held.rows, ...older.threads.filter((t) => !ids.has(t.id))].sort(order), older.more)
}

/** Where "Show older threads" continues from: the oldest thread held. */
export function cursorOf(rows: CommsPageThread[]): CommsThreadCursor | null {
  const last = rows[rows.length - 1]
  return last ? { lastSeq: last.lastSeq, id: last.id } : null
}

/** The rail's count: threads whose last message is newer than this operator's read mark. `atLeast` when the board cut
 *  the heads at its cap — the count is then a floor, said as "5000+", never a smaller number. Null before any answer. */
export function unreadOf(heads: { heads: CommsHead[]; truncated: boolean } | null, marks: Record<string, number>): { count: number; atLeast: boolean } | null {
  if (!heads) return null
  return { count: heads.heads.filter((h) => h.lastSeq > (marks[h.id] ?? 0)).length, atLeast: heads.truncated }
}
// #endregion comms-operator-reads-w4
