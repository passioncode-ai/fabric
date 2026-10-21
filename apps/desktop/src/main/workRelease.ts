// #region work-release — docs: docs/ux/scenarios.md#scn-140-agents-ask-fabric-who-is-working-on-what-claim-their-task-are-warned-of-related-work-and-release-it
/**
 * The two releases Fabric itself makes (REQ-38, SCN-140): a session's claims when the session ends (its terminal
 * exits, its enrollment is revoked or evicted, the app quits), and one claim the operator releases from the project
 * page («Release this claim?»). Both are `work.released@1`, journalled with who released it; the agent's next call
 * reads the release (`fabric_work_list` → released_by_operator).
 */
import type { createScopedStore } from './scopedStore.ts'
import { RELEASE_OUTCOME } from '../shared/workClaims.ts'
import { mayMove, type TaskState } from '../shared/ladder.ts'
import type { ActorKind } from '@fabric/journal'
import { ops } from './opsSink.ts'

type Store = ReturnType<typeof createScopedStore>
type Append = (e: { type: 'work.released@1' | 'task.moved@1'; actor: { kind: ActorKind; id: string }; projectId: string; payload: Record<string, unknown> }) => Promise<unknown>

// #region work-release-returns-task — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking
/**
 * A claim that moved its task from backlog to running (TR-3, `task.moved@1` with its `claim_id`), released any way but
 * done (let-go, handed-over, the session's end, the app's quit), takes the task back to backlog (review DA-6): before,
 * the task stayed in running with nobody on it. Only the claim's own move is undone: the task must be in running and
 * its last move must be that claim's move there; a move since (by the operator, by another claim) wins. Read back, like
 * the claim's move; `failed` says why a move that was due did not land.
 */
export async function returnClaimedTaskToBacklog(
  claimId: string,
  readTask: () => Promise<{ id: string; status: TaskState } | null>,
  lastMove: (taskId: string) => Promise<{ to?: unknown; claim_id?: unknown } | null>,
  move: (task: { id: string; status: TaskState }, to: TaskState) => Promise<unknown>
): Promise<{ task_moved_to: 'backlog' | null; task_status: TaskState | null; failed?: string }> {
  const said = (e: unknown): string => (e instanceof Error ? e.message : String(e))
  let task: { id: string; status: TaskState } | null
  let last: { to?: unknown; claim_id?: unknown } | null
  try {
    task = await readTask()
    if (!task || task.status !== 'running') return { task_moved_to: null, task_status: task?.status ?? null }
    last = await lastMove(task.id)
  } catch (e) {
    // Returned to the caller as `failed`: the release stands, the task stays where it is.
    return { task_moved_to: null, task_status: null, failed: said(e) }
  }
  if (last?.to !== 'running' || last.claim_id !== claimId) return { task_moved_to: null, task_status: 'running' }
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

/** The last `task.moved@1` of a task, its payload, or null (DA-6). */
export async function lastTaskMove(store: Store, taskId: string): Promise<{ to?: unknown; claim_id?: unknown } | null> {
  const r = await store.select('journal', 'payload').eq('type', 'task.moved@1').eq('payload->>task_id', taskId).order('seq', { ascending: false }).limit(1)
  if (r.error) throw new Error(`the task's moves could not be read: ${r.error.message}`)
  return ((r.data ?? [])[0] as { payload?: { to?: unknown; claim_id?: unknown } } | undefined)?.payload ?? null
}

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
  for (const c of (r.data ?? []) as Array<{ id: string; work_id: string; project_id: string }>) {
    const actor = { kind: 'system' as const, id: why === 'app-quit' ? 'app-quit' : 'session-end' }
    await append({
      type: 'work.released@1',
      actor,
      projectId: c.project_id,
      payload: { work: c.work_id, owner: sessionId, outcome: RELEASE_OUTCOME['session-ended'], how: 'session-ended', claim_id: c.id }
    })
    done.push(c.id)
    // DA-6: the task this claim moved to running goes back to backlog; nobody is on it now.
    const back = await returnClaimedTaskToBacklog(c.id, () => taskOf(store, c.work_id), (id) => lastTaskMove(store, id), (task, to) =>
      append({ type: 'task.moved@1', actor, projectId: c.project_id, payload: { task_id: task.id, from: task.status, to, note: null, claim_id: c.id } }))
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
  return { released: true, claimId }
}
// #endregion work-release
