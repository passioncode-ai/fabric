// #region agent-work-read — docs: docs/reports/2026-10-27-mockup-parity/gaps/2026-10-27-home.md#d-data-bugs-wrong-numbers-order-or-missing-fields
/**
 * The reads behind «at work» (`shared/agentWork.ts`; home gaps D3, D4, D7): the turns the session hooks recorded within
 * `AT_WORK_MS` (one bounded read, newest first, at most `TURN_ROWS`), and each Fabric console's last output, which the
 * terminal manager already holds (`HeldSession.outputAt`). A turns read that fails leaves the turns out, is logged and is
 * said on the view (`turnsUnread`): agents are then judged by their tasks, stage reports, heartbeats and consoles alone,
 * never all at work. A turn under an agent's earlier session id (`LiveAgent.aliases`) counts as its own.
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
  // A turn under an agent's earlier session id is its own (ER-5): every id maps to the live session.
  const owner = new Map<string, string>()
  for (const a of view.live) { owner.set(a.sessionId, a.sessionId); for (const id of a.aliases ?? []) if (!owner.has(id)) owner.set(id, a.sessionId) }
  let turnsUnread = false
  if (owner.size) {
    const q = store.select('journal', 'occurred_at,payload') as TurnQuery
    const { data, error } = await Promise.resolve(q.eq('type', 'session.turn.observed@1').gte('occurred_at', new Date(now - AT_WORK_MS).toISOString())
      .order('seq', { ascending: false }).limit(TURN_ROWS)).catch((e: unknown) => ({ data: null, error: { message: e instanceof Error ? e.message : String(e) } }))
    if (error) turnsUnread = true
    if (error) ops.failed('work.turns-unread', new Error(error.message), { note: 'agents are judged at work without their turns' })
    const rows = (data ?? []) as Array<{ occurred_at: string; payload: { session_id?: unknown } | null }>
    if (rows.length >= TURN_ROWS) ops.record({ op: 'work.turns-capped', outcome: 'ok', level: 'info', detail: { rows: rows.length }, ctx: { correlationId: ops.correlate() } })
    for (const r of rows) {
      const id = r.payload?.session_id
      const live = typeof id === 'string' ? owner.get(id) : undefined
      if (live && !turnAt.has(live)) turnAt.set(live, r.occurred_at)
    }
  }
  const outputAt = new Map<string, string>()
  for (const s of held) if (s.console && typeof s.outputAt === 'number' && Number.isFinite(s.outputAt)) outputAt.set(s.sessionId, new Date(s.outputAt).toISOString())
  return withWorkSignals(view, { turnAt, outputAt, turnsUnread }, now)
}
// #endregion agent-work-read
