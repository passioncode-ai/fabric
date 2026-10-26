// #region home-strip — docs: docs/ux/2026-10-26-simple-fabric.md#2a-ритм-работы-the-statistics-strip
/**
 * The home's statistics strip, its reads in main (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §2a).
 * «Сдано сегодня»: the tasks handed in since this machine's local midnight, a task moved to review
 * (`task.moved@1`, `to: review`) or closed as done by the person (`task.closed@1`, outcome done), each task once, the
 * same events `shared/projectAnalytics.ts` counts per project. «Работают без задачи»: the sessions the latest sweep of
 * abandoned work found changing files with no claim (`work-unclaimed`, which stays the agent's reminder and out of the
 * operator's queue); null before the first sweep and whenever that sweep could not see them. A read that fails is said
 * as unread on its own number, never as zero, and never fails the home.
 */
import type { HomeView } from '../shared/homeLive.ts'

type JournalRow = { type: string; occurred_at: string; payload: Record<string, unknown> | null }

/** The tasks handed in among these events: moved to review, or closed as done; each task once. */
export function countHandedIn(rows: readonly JournalRow[]): number {
  const tasks = new Set<string>()
  for (const r of rows) {
    const p = r.payload ?? {}
    const id = typeof p.task_id === 'string' ? p.task_id : typeof p.id === 'string' ? p.id : null
    if (!id) continue
    if ((r.type === 'task.moved@1' && p.to === 'review') || (r.type === 'task.closed@1' && p.outcome === 'done')) tasks.add(id)
  }
  return tasks.size
}

/** The start of the local day `now` falls in, on this machine's clock and zone (the window's own). */
export function localMidnight(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

interface JournalQuery {
  in(column: string, values: string[]): JournalQuery
  gte(column: string, value: string): JournalQuery
  order(column: string, options: { ascending: boolean }): JournalQuery
  limit(n: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
}

/** The gateway answers at most this many rows (`supabase/config.toml` `max_rows`): a read that asks for more cannot
 *  tell a capped answer from a whole one (CO-310; the 0.3.14 review, iteration 2, DA-3). */
export const GATEWAY_ROWS = 1000

/** «Сдано сегодня»: at most the gateway's 1 000 events read (a read at its bound makes the count a floor, `capped`,
 *  said as «N+»); throws when the journal does not answer. */
export async function readHandedInToday(store: { select(table: string, columns: string): unknown }, opts: { now: number; limit?: number }): Promise<{ today: number; capped: boolean }> {
  const limit = Math.min(opts.limit ?? GATEWAY_ROWS, GATEWAY_ROWS)
  const q = store.select('journal', 'type,occurred_at,payload') as JournalQuery
  const { data, error } = await q.in('type', ['task.moved@1', 'task.closed@1'])
    .gte('occurred_at', new Date(localMidnight(opts.now)).toISOString())
    .order('seq', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`the tasks handed in today could not be read: ${error.message}`)
  const rows = (data ?? []) as JournalRow[]
  return { today: countHandedIn(rows), capped: rows.length >= limit }
}

/** The home's reading with the strip's two reads of its own: each failure kept on its number. */
export async function withStrip(view: HomeView, reads: {
  handedIn(): Promise<{ today: number; capped: boolean }>
  sweep(): { unclaimed?: number | null; unclaimedSessions?: string[] } | null
}): Promise<HomeView> {
  const handedIn = await reads.handedIn().then(
    (v) => v,
    (e: unknown) => ({ unread: e instanceof Error ? e.message : String(e) })
  )
  const swept = reads.sweep()
  const unclaimed = swept && typeof swept.unclaimed === 'number' ? swept.unclaimed : null
  return { ...view, handedIn, unclaimed, ...(unclaimed !== null && swept?.unclaimedSessions?.length ? { unclaimedSessions: [...swept.unclaimedSessions] } : {}) }
}
// #endregion home-strip
