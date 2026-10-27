// #region agent-work-read — docs: docs/reports/2026-10-27-mockup-parity/gaps/home.md#d-data-bugs-wrong-numbers-order-or-missing-fields
/**
 * The reads behind «at work» (`shared/agentWork.ts`; home gaps D3, D4, D7): the turns the session hooks recorded within
 * `AT_WORK_MS` (one bounded read, newest first, at most `TURN_ROWS`), and each Fabric console's last output, which the
 * terminal manager already holds (`HeldSession.outputAt`). A turns read that fails leaves the turns out and is logged:
 * agents are then judged by their tasks, stage reports, heartbeats and consoles alone, never all at work.
 */
import type { HomeView } from '../shared/homeLive.ts'
import { AT_WORK_MS, withWorkSignals } from '../shared/agentWork.ts'
import type { HeldSession } from './workRead.ts'
import { ops } from './opsSink.ts'

/** At most this many turns read: past it the oldest turns of the window are not here (logged, never fatal). */
export const TURN_ROWS = 500

interface TurnQuery {
  eq(column: string, value: string): TurnQuery
  gte(column: string, value: string): TurnQuery
  order(column: string, options: { ascending: boolean }): TurnQuery
  limit(n: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
}

export async function withWork(view: HomeView, store: { select(table: string, columns: string): unknown }, held: readonly HeldSession[], now: number): Promise<HomeView> {
  const turnAt = new Map<string, string>()
  const ids = new Set(view.live.map((a) => a.sessionId))
  if (ids.size) {
    const q = store.select('journal', 'occurred_at,payload') as TurnQuery
    const { data, error } = await Promise.resolve(q.eq('type', 'session.turn.observed@1').gte('occurred_at', new Date(now - AT_WORK_MS).toISOString())
      .order('seq', { ascending: false }).limit(TURN_ROWS)).catch((e: unknown) => ({ data: null, error: { message: e instanceof Error ? e.message : String(e) } }))
    if (error) ops.failed('work.turns-unread', new Error(error.message), { note: 'agents are judged at work without their turns' })
    const rows = (data ?? []) as Array<{ occurred_at: string; payload: { session_id?: unknown } | null }>
    if (rows.length >= TURN_ROWS) ops.record({ op: 'work.turns-capped', outcome: 'ok', level: 'info', detail: { rows: rows.length }, ctx: { correlationId: ops.correlate() } })
    for (const r of rows) {
      const id = r.payload?.session_id
      if (typeof id === 'string' && ids.has(id) && !turnAt.has(id)) turnAt.set(id, r.occurred_at)
    }
  }
  const outputAt = new Map<string, string>()
  for (const s of held) if (s.console && typeof s.outputAt === 'number' && Number.isFinite(s.outputAt)) outputAt.set(s.sessionId, new Date(s.outputAt).toISOString())
  return withWorkSignals(view, { turnAt, outputAt }, now)
}
// #endregion agent-work-read
