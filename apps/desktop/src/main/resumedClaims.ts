// #region resumed-claims-read — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#312-a-resumed-session-takes-its-claims-back
/**
 * The reads and writes behind a resumed session taking its claims back (`shared/resumedClaims.ts`). Called once, at the
 * enrollment that minted a new Fabric session under a runtime session id (`sessionEnroll.ts`, `resumeClaims`): the
 * earlier Fabric sessions of that runtime session (its enrolments by the runtime id, and its ends, which carry the id a
 * /clear renamed it to, TR-1) of the same binding, their released claims in this project, and for those tasks their
 * newest claim, column and run holds. Each claim given back is a new `work.claimed@1` for the new session, by the
 * system `session-resume`, naming the claim it continues (`resumed_from`) and its workflow, read back from the
 * projection; the task goes back to running as a claim takes it there (TR-3). Bounded reads; a read that fails throws
 * to the caller, which logs it: the enrollment never waits on it or fails for it.
 */
import { randomUUID } from 'node:crypto'
import { claimsToHandBack, HANDBACK_HOWS, type HandBackTask, type LeftClaim } from '../shared/resumedClaims.ts'
import { CLAIM_DEFAULT_MINUTES } from '../shared/workClaims.ts'
import type { TaskState } from '../shared/ladder.ts'
import { moveClaimedTaskToRunning } from './workTools.ts'
import type { createScopedStore } from './scopedStore.ts'

type Store = Pick<ReturnType<typeof createScopedStore>, 'select' | 'selectIn'>
export type HandBackAppend = (e: { type: string; actor: { kind: 'system'; id: string }; projectId: string; payload: Record<string, unknown> }) => Promise<unknown>

/** The actor of a claim given back: Fabric, on the resumed session's behalf. */
export const HANDBACK_ACTOR = 'session-resume'
/** Earlier sessions read per runtime id: far above one coding-agent session's re-enrolments in a week. */
const SESSIONS_READ = 200
/** The gateway's own bound (`supabase/config.toml` `max_rows`). */
const GATEWAY_ROWS = 1000
const CHUNK = 100
const WORKFLOW = /^wf_[0-9a-f]{16}$/

export interface HandBack { claimId: string; taskId: string; from: string; taskMovedTo: 'running' | null }

export async function handBackResumedClaims(store: Store, append: HandBackAppend, a: {
  projectId: string; sessionId: string; runtimeSessionId: string; bindingId: string; agent: string | null; now: number
  /** The run holds of these tasks (`workRead.ts#readRunHolds`), by task id. */
  runHolds(taskIds: string[]): Promise<string[]>
}): Promise<{ handedBack: HandBack[]; refused: Array<{ taskId: string; reason: string }> }> {
  const none = { handedBack: [], refused: [] }
  // The earlier sessions: enrolled under this runtime id, or ended under it (renamed by a /clear).
  const [enrolled, ended] = await Promise.all([
    store.select('journal', 'payload').eq('type', 'session.enrolled@1').eq('payload->>runtime_session_id', a.runtimeSessionId).order('seq', { ascending: false }).limit(SESSIONS_READ),
    store.select('journal', 'payload').eq('type', 'session.ended@1').eq('payload->>runtime_session_id', a.runtimeSessionId).order('seq', { ascending: false }).limit(SESSIONS_READ)
  ])
  for (const r of [enrolled, ended]) if (r.error) throw new Error(`the earlier sessions could not be read: ${r.error.message}`)
  const named = new Set<string>()
  for (const row of [...(enrolled.data ?? []), ...(ended.data ?? [])] as Array<{ payload: { session_id?: unknown } }>)
    if (typeof row.payload?.session_id === 'string' && row.payload.session_id !== a.sessionId) named.add(row.payload.session_id)
  if (!named.size) return none
  // Of the same binding only: their own enrolments say which agent they were.
  const own = await store.selectIn('journal', 'payload', 'payload->>session_id', [...named], CHUNK, undefined, [['type', 'session.enrolled@1']])
  if (own.failed) throw new Error(`the earlier sessions' enrolments could not be read: ${own.failed}`)
  const earlier = new Set<string>()
  for (const row of own.rows as Array<{ payload: { session_id?: unknown; binding_id?: unknown } }>)
    if (row.payload?.binding_id === a.bindingId && typeof row.payload.session_id === 'string') earlier.add(row.payload.session_id)
  if (!earlier.size) return none
  const claims = await store.selectIn('work_claims', 'id,work_id,owner_session,released_at,released_how,touches', 'owner_session', [...earlier], CHUNK, undefined, [['project_id', a.projectId]])
  if (claims.failed) throw new Error(`the earlier sessions' claims could not be read: ${claims.failed}`)
  type Row = { id: string; work_id: string; owner_session: string; released_at: string | null; released_how: string | null; touches: string[] | null }
  const rows = (claims.rows as Row[]).filter((c) => c.released_how && HANDBACK_HOWS.has(c.released_how))
  if (!rows.length) return none
  const taskIds = [...new Set(rows.map((c) => c.work_id))]
  const [newestRows, taskRows, held, linked] = await Promise.all([
    store.selectIn('work_claims', 'id,work_id,claimed_at', 'work_id', taskIds, CHUNK, undefined, [], { column: 'claimed_at', ascending: false, limit: GATEWAY_ROWS }),
    store.selectIn('project_tasks', 'id,status,moved_at,started_at,moved_by_kind', 'id', taskIds, CHUNK),
    a.runHolds(taskIds),
    // The workflow each earlier claim named, from its own event (indexed by its owner).
    store.selectIn('journal', 'payload', 'payload->>owner', [...earlier], CHUNK, undefined, [['type', 'work.claimed@1']])
  ])
  if (newestRows.failed) throw new Error(`the tasks' claims could not be read: ${newestRows.failed}`)
  if (taskRows.failed) throw new Error(`the tasks could not be read: ${taskRows.failed}`)
  if (linked.failed) throw new Error(`the claims' workflows could not be read: ${linked.failed}`)
  const newest = new Map<string, { id: string; claimed_at: string }>()
  for (const c of newestRows.rows as Array<{ id: string; work_id: string; claimed_at: string }>) {
    const prior = newest.get(c.work_id)
    if (!prior || Date.parse(c.claimed_at) > Date.parse(prior.claimed_at)) newest.set(c.work_id, c)
  }
  const workflowOf = new Map<string, string>()
  for (const row of linked.rows as Array<{ payload: { claim_id?: unknown; workflow_id?: unknown } }>)
    if (typeof row.payload?.claim_id === 'string' && typeof row.payload.workflow_id === 'string' && WORKFLOW.test(row.payload.workflow_id)) workflowOf.set(row.payload.claim_id, row.payload.workflow_id)
  const heldSet = new Set(held)
  const tasks = new Map<string, HandBackTask>((taskRows.rows as Array<{ id: string; status: string; moved_at: string | null; started_at: string | null; moved_by_kind: string | null }>).map((t) => [t.id, {
    id: t.id, status: t.status, movedAt: t.moved_at ?? t.started_at ?? null, movedByKind: t.moved_by_kind ?? null,
    newestClaimId: newest.get(t.id)?.id ?? null, runHeld: heldSet.has(t.id)
  }]))
  const left: LeftClaim[] = rows.map((c) => ({ claimId: c.id, taskId: c.work_id, ownerSession: c.owner_session, releasedAt: c.released_at, how: c.released_how,
    touches: c.touches ?? [], workflowId: workflowOf.get(c.id) ?? null }))
  const out: { handedBack: HandBack[]; refused: Array<{ taskId: string; reason: string }> } = { handedBack: [], refused: [] }
  const actor = { kind: 'system' as const, id: HANDBACK_ACTOR }
  for (const c of claimsToHandBack({ earlierSessions: earlier, left, tasks, now: a.now })) {
    const claimId = randomUUID()
    await append({ type: 'work.claimed@1', actor, projectId: a.projectId, payload: {
      work: c.taskId, owner: a.sessionId, idempotency_key: `resume:${a.sessionId}:${c.claimId}`,
      expires_at: new Date(a.now + CLAIM_DEFAULT_MINUTES * 60_000).toISOString(), write_scopes: c.touches, claim_id: claimId,
      agent: a.agent, came_in: 'enrolled', resumed_from: c.claimId, ...(c.workflowId ? { workflow_id: c.workflowId } : {})
    } })
    // The projection decides: a claim the lease did not take (someone took the task meanwhile) has no row.
    const back = await store.select('work_claims', 'id,released_at').eq('id', claimId).limit(1)
    const row = ((back.data ?? []) as Array<{ released_at: string | null }>)[0]
    if (back.error || !row || row.released_at) { out.refused.push({ taskId: c.taskId, reason: back.error ? back.error.message : 'the claim did not stand' }); continue }
    const readTask = async () => {
      const t = await store.select('project_tasks', 'id,status').eq('id', c.taskId).limit(1)
      if (t.error) throw new Error(t.error.message)
      return ((t.data ?? []) as Array<{ id: string; status: TaskState }>)[0] ?? null
    }
    const moved = await moveClaimedTaskToRunning(readTask, (t, to) =>
      append({ type: 'task.moved@1', actor, projectId: a.projectId, payload: { task_id: t.id, from: t.status, to, note: null, claim_id: claimId } }))
    out.handedBack.push({ claimId, taskId: c.taskId, from: c.claimId, taskMovedTo: moved.task_moved_to })
  }
  return out
}
// #endregion resumed-claims-read
