// #region agent-identity-read — docs: docs/reports/2026-10-27-mockup-parity/gaps/2026-10-27-home.md#d-data-bugs-wrong-numbers-order-or-missing-fields
/**
 * The reads behind one agent, one identity (`shared/agentIdentity.ts`; home gaps D5, D6): the live agents' runtime
 * session ids (held in memory by the agent surface), the enrolments that name the same runtime sessions
 * (`session.enrolled@1`, newest first, at most `ENROLMENT_ROWS` per chunk), then the earlier ids' stage reports,
 * heartbeats and claims, and the claimed tasks. Each read is bounded and its error read: a read that fails leaves the
 * reading as it was, is logged and is said on the view (`identityUnread`); the agents then show only what their current id
 * holds, never a wrong task.
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
/** Stage reports read per chunk of session ids, newest first. `agent_stages` keeps one row per session, so a chunk of
 *  100 ids never reaches it; the bound and the order keep the read what it says it is (CO-477, ER-12). */
export const STAGE_ROWS = 1000

const need = (r: Rows, what: string): Array<Record<string, unknown>> => {
  if (r.failed) throw new Error(`${what} could not be read: ${r.failed}`)
  return r.rows
}

/**
 * CO-473 (0.3.15 review, iteration 1, DA-6): an agent that enrols with no runtime session id (Codex and Kimi send none,
 * `fabricMcp.ts#runtimeSessionIdOf`) is one agent across its enrolments of the same binding in the same folder
 * (`binding_id` and `cwd_sha256` of `session.enrolled@1`), earlier ones without a runtime id only. A key two live
 * sessions share is left unjoined: the folder cannot tell them apart. Two bounded reads: the live sessions' own
 * enrolments by their session ids, then their bindings' enrolments newest first.
 */
export async function folderSiblings(store: IdentityStore, bare: readonly string[], liveIds: ReadonlySet<string>):
  Promise<{ keyOf: Map<string, string>; siblings: Map<string, string[]>; capped: boolean }> {
  const keyOf = new Map<string, string>(), siblings = new Map<string, string[]>()
  const keyOfPayload = (p: { binding_id?: unknown; cwd_sha256?: unknown }): string | null =>
    typeof p.binding_id === 'string' && typeof p.cwd_sha256 === 'string' ? `folder:${p.binding_id}|${p.cwd_sha256}` : null
  const own = need(await store.selectIn('journal', 'payload', 'payload->>session_id', [...bare], 100, undefined, [['type', 'session.enrolled@1']]), 'the agents\' own enrolments')
  const live = new Map<string, string[]>(), bindings = new Set<string>()
  for (const e of own) {
    const p = (e.payload ?? {}) as { session_id?: unknown; binding_id?: unknown; cwd_sha256?: unknown; runtime_session_id?: unknown }
    const key = keyOfPayload(p)
    if (typeof p.session_id !== 'string' || !key || p.runtime_session_id !== undefined) continue
    live.set(key, [...new Set([...(live.get(key) ?? []), p.session_id])])
    bindings.add(p.binding_id as string)
  }
  for (const [key, ids] of live) if (ids.length === 1) keyOf.set(ids[0], key)
  if (!keyOf.size) return { keyOf, siblings, capped: false }
  const theirs = need(await store.selectIn('journal', 'payload', 'payload->>binding_id', [...bindings], 100, undefined,
    [['type', 'session.enrolled@1']], { column: 'seq', ascending: false, limit: ENROLMENT_ROWS }), 'the agents\' earlier enrolments by folder')
  const wanted = new Set(keyOf.values())
  for (const e of theirs) {
    const p = (e.payload ?? {}) as { session_id?: unknown; binding_id?: unknown; cwd_sha256?: unknown; runtime_session_id?: unknown }
    const key = keyOfPayload(p)
    if (!key || !wanted.has(key) || typeof p.session_id !== 'string' || p.runtime_session_id !== undefined) continue
    // Another live session of the same folder is a second agent, never this one's earlier id.
    if (liveIds.has(p.session_id) && keyOf.get(p.session_id) !== key) continue
    siblings.set(key, [...new Set([...(siblings.get(key) ?? []), p.session_id])])
  }
  return { keyOf, siblings, capped: theirs.length >= ENROLMENT_ROWS }
}

export async function withIdentity(view: HomeView, store: IdentityStore, held: readonly HeldSession[], now: number = Date.now()): Promise<HomeView> {
  const liveIds = new Set(view.live.map((a) => a.sessionId))
  const runtimeOf = new Map<string, string>()
  for (const s of held) if (liveIds.has(s.sessionId) && typeof s.runtimeSessionId === 'string' && s.runtimeSessionId) runtimeOf.set(s.sessionId, s.runtimeSessionId)
  const runtimes = [...new Set(runtimeOf.values())]
  // CO-473: an agent that enrols with no runtime session id (Codex, Kimi) is joined by its folder instead.
  const bare = view.live.filter((a) => !runtimeOf.has(a.sessionId) && held.some((s) => s.sessionId === a.sessionId && s.cameIn === 'enrolled')).map((a) => a.sessionId)
  if (!runtimes.length && !bare.length) return view
  try {
    const enrolled = runtimes.length ? need(await store.selectIn('journal', 'payload', 'payload->>runtime_session_id', runtimes, 100, undefined,
      [['type', 'session.enrolled@1']], { column: 'seq', ascending: false, limit: ENROLMENT_ROWS }), 'the agents\' enrolments') : []
    // A full chunk may have cut an agent's older ids: said on the view (the 0.3.15 review, iteration 2, ER-10).
    let enrolCapped = enrolled.length >= ENROLMENT_ROWS
    const siblings = new Map<string, string[]>()
    for (const e of enrolled) {
      const p = (e.payload ?? {}) as { runtime_session_id?: unknown; session_id?: unknown }
      if (typeof p.runtime_session_id !== 'string' || typeof p.session_id !== 'string') continue
      siblings.set(p.runtime_session_id, [...(siblings.get(p.runtime_session_id) ?? []), p.session_id])
    }
    if (bare.length) {
      const folders = await folderSiblings(store, bare, liveIds)
      for (const [sessionId, key] of folders.keyOf) runtimeOf.set(sessionId, key)
      for (const [key, ids] of folders.siblings) siblings.set(key, ids)
      enrolCapped ||= folders.capped
    }
    if (enrolCapped) ops.record({ op: 'work.identity-capped', outcome: 'ok', level: 'info', detail: { rows: enrolled.length }, ctx: { correlationId: ops.correlate() } })
    const earlier = [...new Set([...siblings.values()].flat())].filter((id) => !liveIds.has(id))
    const all = [...new Set([...earlier, ...runtimeOf.keys()])]
    if (!earlier.length) return enrolCapped ? { ...view, identityUnread: true } : view
    const [stages, beats, claims] = await Promise.all([
      store.selectIn('agent_stages', 'session_id,project_id,task_id,stage,step,of_steps,note,reported_at', 'session_id', earlier, 100, undefined, [], { column: 'reported_at', ascending: false, limit: STAGE_ROWS }),
      store.selectIn('session_heartbeats', 'session_id,phase,last_received_at,waiting_kind', 'session_id', all),
      store.selectIn('work_claims', 'work_id,project_id,owner_session,claimed_at,released_at,released_how', 'owner_session', all, 100, undefined, [], { column: 'claimed_at', ascending: false, limit: CLAIM_ROWS })
    ])
    const claimRows = need(claims, 'the agents\' earlier claims') as unknown as IdentityClaim[]
    // As many claims as one chunk's bound: an older claim may be cut, said on the view as the enrolments' cut is
    // (CO-477, ER-13). Over several chunks this can say partial when nothing was cut; it never stays silent on a cut.
    const claimsCapped = claimRows.length >= CLAIM_ROWS
    if (claimsCapped) ops.record({ op: 'work.identity-capped', outcome: 'ok', level: 'info', detail: { rows: claimRows.length, read: 'claims' }, ctx: { correlationId: ops.correlate() } })
    const tasks = need(await store.selectIn('project_tasks', 'id,project_id,title,brief_what,status', 'id', [...new Set(claimRows.map((c) => c.work_id))]), 'the agents\' earlier tasks')
    const joined = joinByRuntime(view, {
      runtimeOf,
      siblings,
      stages: need(stages, 'the agents\' earlier stage reports') as unknown as StageRow[],
      heartbeats: (need(beats, 'the agents\' heartbeats') as unknown as IdentityHeartbeat[]).filter((b) => typeof b.phase === 'string' && typeof b.last_received_at === 'string'),
      claims: claimRows,
      tasks: tasks as unknown as TaskBrief[],
      now
    })
    return enrolCapped || claimsCapped ? { ...joined, identityUnread: true } : joined
  } catch (e) {
    ops.failed('work.identity-unread', e, { note: 'each agent shows only what its current session id holds' })
    return { ...view, identityUnread: true }
  }
}
// #endregion agent-identity-read
