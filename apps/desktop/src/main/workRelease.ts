// #region work-release — docs: docs/ux/scenarios.md#scn-140-agents-ask-fabric-who-is-working-on-what-claim-their-task-are-warned-of-related-work-and-release-it
/**
 * The two releases Fabric itself makes (REQ-38, SCN-140): a session's claims when the session ends (its terminal
 * exits, its enrollment is revoked or evicted, the app quits), and one claim the operator releases from the project
 * page («Release this claim?»). Both are `work.released@1`, journalled with who released it; the agent's next call
 * reads the release (`fabric_work_list` → released_by_operator).
 */
import type { createScopedStore } from './scopedStore.ts'
import { RELEASE_OUTCOME } from '../shared/workClaims.ts'
import { TERMINAL, mayMove, type TaskState } from '../shared/ladder.ts'
import type { ActorKind } from '@fabric/journal'
import { ops } from './opsSink.ts'
import { readRunHolds } from './workRead.ts'

type Store = ReturnType<typeof createScopedStore>
type Append = (e: { type: 'work.released@1' | 'task.moved@1'; actor: { kind: ActorKind; id: string }; projectId: string; payload: Record<string, unknown> }) => Promise<unknown>

// #region work-release-returns-task — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking
/**
 * A claim released any way but done (let-go, handed-over, the session's end, the app's quit, lapsed, the operator's
 * release) takes its running task back to backlog (review DA-6), so a running task always has an owner. Since 0.3.14
 * wave 2 (task f0ca028a in the live audit of 2026-10-26) whoever moved it to running: before, only the claim's own move
 * was undone, and a task another claim or a person had moved there stayed in running with nobody on it. A task another
 * live claim or another session's live lease still holds stays (`heldElsewhere`); unread holders are never "nobody",
 * so a read that throws moves nothing. Read back, like the claim's move; `failed` says why a move that was due did not
 * land.
 */
export async function returnClaimedTaskToBacklog(
  /** The released claim, named by every caller; the task is judged by what holds it now, not by whose move put it there. */
  _claimId: string,
  readTask: () => Promise<{ id: string; status: TaskState } | null>,
  heldElsewhere: (taskId: string) => Promise<boolean>,
  move: (task: { id: string; status: TaskState }, to: TaskState) => Promise<unknown>
): Promise<{ task_moved_to: 'backlog' | null; task_status: TaskState | null; failed?: string }> {
  const said = (e: unknown): string => (e instanceof Error ? e.message : String(e))
  let task: { id: string; status: TaskState } | null = null
  try {
    task = await readTask()
    if (!task || task.status !== 'running') return { task_moved_to: null, task_status: task?.status ?? null }
    if (await heldElsewhere(task.id)) return { task_moved_to: null, task_status: 'running' }
  } catch (e) {
    // Returned to the caller as `failed`: the release stands, the task stays where it is.
    return { task_moved_to: null, task_status: task?.status ?? null, failed: said(e) }
  }
  const may = mayMove('agent', 'running', 'backlog')
  if (!may.ok) return { task_moved_to: null, task_status: 'running', failed: may.reason }
  let failed: string | null = null
  try {
    await move(task, 'backlog')
  } catch (e) {
    // Returned as `failed`, with the status read back below.
    failed = said(e)
  }
  let after: { id: string; status: TaskState } | null
  try {
    after = await readTask()
  } catch (e) {
    return { task_moved_to: null, task_status: 'running', failed: failed ?? said(e) }
  }
  if (after?.status === 'backlog') return { task_moved_to: 'backlog', task_status: 'backlog' }
  return { task_moved_to: null, task_status: after?.status ?? null, failed: failed ?? 'the move back to backlog could not be confirmed' }
}

/** The reason a task's move back to backlog carries (0.3.14 wave 2): how its claim ended, and the release's own words. */
export function backToBacklogNote(how: string, said: string | null): string {
  return `the claim on this task ended (${how}) and nothing else holds it, so it goes back to the backlog${said ? `: ${said}` : ''}`
}

/** Whether something other than this claim holds the task now: another open claim, or another session's lease (a
 *  launch Fabric manages) that is live, or lapsed while its run is not proved stopped (the 0.3.14 review, iteration 1,
 *  ER-8: the hold `readWork` counts, CO-323). A read that fails throws. */
export async function taskHeldElsewhere(store: Pick<Store, 'select' | 'selectIn'>, taskId: string, claim: { id: string; owner_session: string }, now: number): Promise<boolean> {
  const [claims, lease] = await Promise.all([
    store.select('work_claims', 'id').eq('work_id', taskId).is('released_at', null),
    store.select('leases', 'owner_session,expires_at').eq('work_id', taskId).maybeSingle()
  ])
  if (claims.error) throw new Error(`the task's claims could not be read: ${claims.error.message}`)
  if (lease.error) throw new Error(`the task's lease could not be read: ${lease.error.message}`)
  if (((claims.data ?? []) as Array<{ id: string }>).some((c) => c.id !== claim.id)) return true
  const l = lease.data as { owner_session: string; expires_at: string } | null
  if (!l || l.owner_session === claim.owner_session) return false
  if (Date.parse(l.expires_at) > now) return true
  return (await readRunHolds(store as Store, [taskId])).length > 0
}

/**
 * A done release's second write, READ BACK (0.3.5 review iteration 2, ER-8): the release and the task's move to review
 * are two appends, and only the first was read back, so a move that threw (or that the projection ignored) left the
 * task in running while a retry answered `already-released`. The task is read, moved when the ladder lets an agent move
 * it to review, and read again; `task_moved_to` is `review` only when the board says the task is there, and `failed`
 * says why it is not. A task already in review (a repeat) is not moved twice; no board task, or a closed one, moves
 * nothing and fails nothing.
 */
export async function moveDoneTaskToReview(
  readTask: () => Promise<{ id: string; status: TaskState } | null>,
  move: (task: { id: string; status: TaskState }, to: TaskState) => Promise<unknown>
): Promise<{ task_moved_to: 'review' | null; task_status: TaskState | null; failed?: string }> {
  const said = (e: unknown): string => (e instanceof Error ? e.message : String(e))
  let task: { id: string; status: TaskState } | null
  try {
    task = await readTask()
  } catch (e) {
    // Returned to the agent as `failed`: the release stands, the move is unknown.
    return { task_moved_to: null, task_status: null, failed: said(e) }
  }
  if (!task) return { task_moved_to: null, task_status: null }
  if (task.status === 'review') return { task_moved_to: 'review', task_status: 'review' }
  // A closed task moves nothing and fails nothing: the operator already decided it.
  if (TERMINAL.includes(task.status)) return { task_moved_to: null, task_status: task.status }
  // TR-3: the ladder does not lead from backlog to review; a task released done from backlog goes through running.
  const steps: TaskState[] = task.status === 'backlog' ? ['running', 'review'] : ['review']
  let failed: string | null = null
  let cur: { id: string; status: TaskState } | null = task
  for (const to of steps) {
    if (!cur) break
    const may = mayMove('agent', cur.status, to)
    if (!may.ok) { failed = may.reason; break }
    try {
      await move(cur, to)
    } catch (e) {
      // Returned to the agent as `failed`, with the status read back below.
      failed = said(e)
      break
    }
    try {
      cur = await readTask()
    } catch (e) {
      // Unread is not moved: nothing is claimed as done.
      return { task_moved_to: null, task_status: task.status, failed: said(e) }
    }
    if (cur?.status !== to) { failed = `the move to ${to} could not be confirmed`; break }
  }
  if (cur?.status === 'review') return { task_moved_to: 'review', task_status: 'review' }
  return { task_moved_to: null, task_status: cur?.status ?? null, failed: failed ?? 'the move to review could not be confirmed' }
}

/** The note of the sweep's repair of a done release whose move to review did not land (0.3.14 wave 2). */
export const DONE_LEFT_RUNNING_NOTE = 'its last claim was released done and its move to review did not land, so the sweep moves it to review'

// #region sweep-done-left-running — docs: docs/evidence/plans/2026-10-26-release-0314-plan.md#composition
/** The sweep's repair (0.3.14 wave 2, task b2c42b88 in the live audit of 2026-10-26): a running task whose last claim
 *  ended done with no move since (`shared/abandonedSweep.ts#doneLeftRunning`) and that nothing holds at the moment of
 *  the move goes to review, as the done release meant, read back like the release's own move. */
export async function moveDoneLeftRunningToReview(store: Store, append: Append, taskId: string, projectId: string): Promise<{ task_moved_to: 'review' | null; task_status: TaskState | null; failed?: string }> {
  const actor = { kind: 'system' as const, id: 'work-sweep' }
  // The 0.3.14 review, iteration 2, ER-13: the holders are asked again at the moment of the move, as the backlog retry
  // does; a task someone took since the sweep's read stays where it is.
  try {
    if (await taskHeldElsewhere(store, taskId, { id: '', owner_session: '' }, Date.now())) return { task_moved_to: null, task_status: 'running' }
  } catch (e) {
    return { task_moved_to: null, task_status: null, failed: e instanceof Error ? e.message : String(e) }
  }
  return moveDoneTaskToReview(() => taskOf(store, taskId), (task, to) =>
    append({ type: 'task.moved@1', actor, projectId, payload: { task_id: task.id, from: task.status, to, note: DONE_LEFT_RUNNING_NOTE } }))
}
// #endregion sweep-done-left-running

/** The note of the sweep's retry of a release whose move back to backlog did not land (the 0.3.14 review, iteration 1,
 *  ER-6). */
export const RELEASED_LEFT_RUNNING_NOTE = 'its last claim ended and nothing holds it, but its move back to backlog did not land, so the sweep moves it to backlog'

// #region sweep-released-left-running — docs: docs/evidence/plans/2026-10-26-release-0314-plan.md#review-iteration-1
/** The sweep's retry (the 0.3.14 review, iteration 1, ER-6): a running task whose last claim ended other than done, with
 *  no move since and nothing holding it now, goes back to backlog as its release meant, read back. */
export async function moveReleasedLeftRunningToBacklog(store: Store, append: Append, taskId: string, projectId: string): Promise<{ task_moved_to: 'backlog' | null; task_status: TaskState | null; failed?: string }> {
  const actor = { kind: 'system' as const, id: 'work-sweep' }
  return returnClaimedTaskToBacklog('', () => taskOf(store, taskId), (id) => taskHeldElsewhere(store, id, { id: '', owner_session: '' }, Date.now()), (task, to) =>
    append({ type: 'task.moved@1', actor, projectId, payload: { task_id: task.id, from: task.status, to, note: RELEASED_LEFT_RUNNING_NOTE } }))
}
// #endregion sweep-released-left-running

/** A task of the store's estate by id: its status, or null. */
async function taskOf(store: Store, taskId: string): Promise<{ id: string; status: TaskState } | null> {
  const r = await store.select('project_tasks', 'id,status').eq('id', taskId).maybeSingle()
  if (r.error) throw new Error(`the task could not be read: ${r.error.message}`)
  return (r.data as { id: string; status: TaskState } | null) ?? null
}
// #endregion work-release-returns-task

/** Releases every live claim a session holds, as `session-ended`. Returns the claims released. */
export async function releaseSessionClaims(store: Store, append: Append, sessionId: string, why: 'ended' | 'app-quit'): Promise<string[]> {
  const r = await store.select('work_claims', 'id,work_id,project_id').eq('owner_session', sessionId).is('released_at', null)
  if (r.error) throw new Error(`the session's claims could not be read: ${r.error.message}`)
  const done: string[] = []
  const how = why === 'app-quit' ? 'the app quit' : 'session-ended'
  for (const c of (r.data ?? []) as Array<{ id: string; work_id: string; project_id: string }>) {
    const actor = { kind: 'system' as const, id: why === 'app-quit' ? 'app-quit' : 'session-end' }
    await append({
      type: 'work.released@1',
      actor,
      projectId: c.project_id,
      payload: { work: c.work_id, owner: sessionId, outcome: RELEASE_OUTCOME['session-ended'], how: 'session-ended', claim_id: c.id }
    })
    done.push(c.id)
    // DA-6, 0.3.14: the running task goes back to backlog when nothing else holds it; nobody is on it now.
    const back = await returnClaimedTaskToBacklog(c.id, () => taskOf(store, c.work_id), (id) => taskHeldElsewhere(store, id, { id: c.id, owner_session: sessionId }, Date.now()), (task, to) =>
      append({ type: 'task.moved@1', actor, projectId: c.project_id, payload: { task_id: task.id, from: task.status, to, note: backToBacklogNote(how, null), claim_id: c.id } }))
    // Recorded, not thrown: the session's other claims are still released; the task is moved by hand from the board.
    if (back.failed) ops.failed('work.session-end-task-back', new Error(back.failed), { note: 'the claim is released; its task stays in running', session_id: sessionId, task_id: c.work_id })
  }
  return done
}

export type OperatorRelease =
  | { released: true; claimId: string }
  | { released: false; reason: 'not-found' | 'already-released' | 'unconfirmed' }

/** The operator ends one claim (SCR-31 release confirm). The agent is told on its next call. */
export async function releaseByOperator(
  store: Store,
  append: Append,
  operator: { kind: ActorKind; id: string },
  claimId: string
): Promise<OperatorRelease> {
  const r = await store.select('work_claims', 'id,work_id,project_id,owner_session,released_at').eq('id', claimId).maybeSingle()
  if (r.error) throw new Error(`the claim could not be read: ${r.error.message}`)
  const c = r.data as { id: string; work_id: string; project_id: string; owner_session: string; released_at: string | null } | null
  if (!c) return { released: false, reason: 'not-found' }
  if (c.released_at) return { released: false, reason: 'already-released' }
  await append({
    type: 'work.released@1',
    actor: operator,
    projectId: c.project_id,
    payload: { work: c.work_id, owner: c.owner_session, outcome: RELEASE_OUTCOME.operator, how: 'operator', claim_id: c.id }
  })
  const after = await store.select('work_claims', 'released_at').eq('id', claimId).maybeSingle()
  if (after.error || !(after.data as { released_at: string | null } | null)?.released_at) return { released: false, reason: 'unconfirmed' }
  // 0.3.14 wave 2: the running task the claim leaves with nobody on it goes back to backlog. Recorded, not thrown: the
  // claim is released either way, and the task is moved by hand from the board.
  const back = await returnClaimedTaskToBacklog(c.id, () => taskOf(store, c.work_id), (id) => taskHeldElsewhere(store, id, c, Date.now()), (task, to) =>
    append({ type: 'task.moved@1', actor: operator, projectId: c.project_id, payload: { task_id: task.id, from: task.status, to, note: backToBacklogNote('operator', null), claim_id: c.id } }))
  if (back.failed) ops.failed('work.operator-release-task-back', new Error(back.failed), { note: 'the claim is released; its task stays in running', task_id: c.work_id })
  return { released: true, claimId }
}

/**
 * The sweep of abandoned work releases a claim whose session ended and two sweeps in a row found (0.3.13 wave 2, SW-8;
 * `abandonedSweepRun.ts#createAbandonedSweep`): `work.released@1` as `lapsed` (outcome `expired`), with the reason, then
 * the task its claim moved to running goes back to backlog, as a session's end takes it back (DA-6), so another agent
 * can take it. Read back like the operator's release: `unconfirmed` when the projection did not end the claim.
 */
export async function releaseLapsedClaim(
  store: Store,
  append: Append,
  claimId: string,
  reason: string
): Promise<{ released: boolean; reason?: 'not-found' | 'already-released' | 'unconfirmed'; task_moved_to?: 'backlog' | null; failed?: string }> {
  const r = await store.select('work_claims', 'id,work_id,project_id,owner_session,released_at').eq('id', claimId).maybeSingle()
  if (r.error) throw new Error(`the claim could not be read: ${r.error.message}`)
  const c = r.data as { id: string; work_id: string; project_id: string; owner_session: string; released_at: string | null } | null
  if (!c) return { released: false, reason: 'not-found' }
  if (c.released_at) return { released: false, reason: 'already-released' }
  const actor = { kind: 'system' as const, id: 'work-sweep' }
  await append({
    type: 'work.released@1',
    actor,
    projectId: c.project_id,
    payload: { work: c.work_id, owner: c.owner_session, outcome: RELEASE_OUTCOME.lapsed, how: 'lapsed', claim_id: c.id, note: reason }
  })
  const after = await store.select('work_claims', 'released_at').eq('id', claimId).maybeSingle()
  if (after.error || !(after.data as { released_at: string | null } | null)?.released_at) return { released: false, reason: 'unconfirmed' }
  const back = await returnClaimedTaskToBacklog(c.id, () => taskOf(store, c.work_id), (id) => taskHeldElsewhere(store, id, c, Date.now()), (task, to) =>
    append({ type: 'task.moved@1', actor, projectId: c.project_id, payload: { task_id: task.id, from: task.status, to, note: backToBacklogNote('lapsed', reason), claim_id: c.id } }))
  return { released: true, task_moved_to: back.task_moved_to, ...(back.failed ? { failed: back.failed } : {}) }
}
// #endregion work-release
