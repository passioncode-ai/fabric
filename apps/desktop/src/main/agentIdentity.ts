// #region agent-identity-read — docs: docs/reports/2026-10-27-mockup-parity/gaps/home.md#d-data-bugs-wrong-numbers-order-or-missing-fields
/**
 * The reads behind one agent, one identity (`shared/agentIdentity.ts`; home gaps D5, D6): the live agents' runtime
 * session ids (held in memory by the agent surface), the enrolments that name the same runtime sessions
 * (`session.enrolled@1`, newest first, at most `ENROLMENT_ROWS` per chunk), then the earlier ids' stage reports,
 * heartbeats and claims, and the claimed tasks. Each read is bounded and its error read: a read that fails leaves the
 * reading as it was and is logged; the agents then show only what their current id holds, never a wrong task.
 */
import type { HomeView, StageRow, TaskBrief } from '../shared/homeLive.ts'
import { joinByRuntime, type IdentityClaim, type IdentityHeartbeat } from '../shared/agentIdentity.ts'
import type { HeldSession } from './workRead.ts'
import { ops } from './opsSink.ts'

type Rows = { rows: Array<Record<string, unknown>>; failed: string | null }
export interface IdentityStore {
  selectIn(table: string, columns: string, key: string, values: string[], chunk?: number, signal?: AbortSignal,
    eq?: ReadonlyArray<readonly [string, string]>, order?: { column: string; ascending: boolean; limit: number }): Promise<Rows>
}

/** Enrolments read per chunk of runtime ids: far above any one agent's re-enrolments in a working week. */
export const ENROLMENT_ROWS = 1000
/** Claims read per chunk of session ids, newest first. */
export const CLAIM_ROWS = 1000

const need = (r: Rows, what: string): Array<Record<string, unknown>> => {
  if (r.failed) throw new Error(`${what} could not be read: ${r.failed}`)
  return r.rows
}

export async function withIdentity(view: HomeView, store: IdentityStore, held: readonly HeldSession[]): Promise<HomeView> {
  const liveIds = new Set(view.live.map((a) => a.sessionId))
  const runtimeOf = new Map<string, string>()
  for (const s of held) if (liveIds.has(s.sessionId) && typeof s.runtimeSessionId === 'string' && s.runtimeSessionId) runtimeOf.set(s.sessionId, s.runtimeSessionId)
  const runtimes = [...new Set(runtimeOf.values())]
  if (!runtimes.length) return view
  try {
    const enrolled = need(await store.selectIn('journal', 'payload', 'payload->>runtime_session_id', runtimes, 100, undefined,
      [['type', 'session.enrolled@1']], { column: 'seq', ascending: false, limit: ENROLMENT_ROWS }), 'the agents\' enrolments')
    const siblings = new Map<string, string[]>()
    for (const e of enrolled) {
      const p = (e.payload ?? {}) as { runtime_session_id?: unknown; session_id?: unknown }
      if (typeof p.runtime_session_id !== 'string' || typeof p.session_id !== 'string') continue
      siblings.set(p.runtime_session_id, [...(siblings.get(p.runtime_session_id) ?? []), p.session_id])
    }
    const earlier = [...new Set([...siblings.values()].flat())].filter((id) => !liveIds.has(id))
    const all = [...new Set([...earlier, ...runtimeOf.keys()])]
    if (!earlier.length) return view
    const [stages, beats, claims] = await Promise.all([
      store.selectIn('agent_stages', 'session_id,project_id,task_id,stage,step,of_steps,note,reported_at', 'session_id', earlier),
      store.selectIn('session_heartbeats', 'session_id,phase,last_received_at,waiting_kind', 'session_id', all),
      store.selectIn('work_claims', 'work_id,project_id,owner_session,claimed_at,released_at', 'owner_session', all, 100, undefined, [], { column: 'claimed_at', ascending: false, limit: CLAIM_ROWS })
    ])
    const claimRows = need(claims, 'the agents\' earlier claims') as unknown as IdentityClaim[]
    const tasks = need(await store.selectIn('project_tasks', 'id,project_id,title,brief_what,status', 'id', [...new Set(claimRows.map((c) => c.work_id))]), 'the agents\' earlier tasks')
    return joinByRuntime(view, {
      runtimeOf,
      siblings,
      stages: need(stages, 'the agents\' earlier stage reports') as unknown as StageRow[],
      heartbeats: (need(beats, 'the agents\' heartbeats') as unknown as IdentityHeartbeat[]).filter((b) => typeof b.phase === 'string' && typeof b.last_received_at === 'string'),
      claims: claimRows,
      tasks: tasks as unknown as TaskBrief[]
    })
  } catch (e) {
    ops.failed('work.identity-unread', e, { note: 'each agent shows only what its current session id holds' })
    return view
  }
}
// #endregion agent-identity-read
