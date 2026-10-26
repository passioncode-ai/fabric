// #region agent-heartbeats — docs: docs/ux/2026-10-26-simple-fabric-v2.md#45-session-status-r-19
/**
 * Each live agent's newest heartbeat (the 0.3.14 review, iteration 2, ER-18): its phase, when it was said and what it
 * waits on, read once per home reading from `session_heartbeats` (one row per session, its primary key), so the left
 * column, «В работе» and the agent page give `shared/sessionStatus.ts#sessionStatus` the same inputs. Whether the phase
 * still holds is the status function's to judge (`PHASE_FRESH_MS`). A read that fails leaves every heartbeat absent:
 * the screens fall back to what Fabric observes, and the failure is in the operations log.
 */
import type { HomeView } from '../shared/homeLive.ts'
import { ops } from './opsSink.ts'

type Rows = { rows: Array<Record<string, unknown>>; failed: string | null }
export interface HeartbeatStore { selectIn(table: string, columns: string, key: string, values: string[]): Promise<Rows> }

export async function withHeartbeats(view: HomeView, store: HeartbeatStore): Promise<HomeView> {
  const ids = [...new Set(view.live.map((a) => a.sessionId))]
  if (!ids.length) return view
  const r = await store.selectIn('session_heartbeats', 'session_id,phase,last_received_at,waiting_kind', 'session_id', ids).catch(
    (e: unknown) => ({ rows: [], failed: e instanceof Error ? e.message : String(e) })
  )
  if (r.failed) {
    ops.failed('work.heartbeats-unread', new Error(r.failed), { note: 'the status falls back to what Fabric observes' })
    return view
  }
  const of = new Map<string, { phase: string; at: string; waitingOn: string | null }>()
  for (const b of r.rows) {
    if (typeof b.session_id !== 'string' || typeof b.phase !== 'string' || typeof b.last_received_at !== 'string') continue
    of.set(b.session_id, { phase: b.phase, at: b.last_received_at, waitingOn: typeof b.waiting_kind === 'string' ? b.waiting_kind : null })
  }
  return { ...view, live: view.live.map((a) => (of.has(a.sessionId) ? { ...a, heartbeat: of.get(a.sessionId)! } : a)) }
}
// #endregion agent-heartbeats
