// #region work-release — docs: docs/ux/scenarios.md#scn-140-agents-ask-fabric-who-is-working-on-what-claim-their-task-are-warned-of-related-work-and-release-it
/**
 * The two releases Fabric itself makes (REQ-38, SCN-140): a session's claims when the session ends (its terminal
 * exits, its enrollment is revoked or evicted, the app quits), and one claim the operator releases from the project
 * page («Release this claim?»). Both are `work.released@1`, journalled with who released it; the agent's next call
 * reads the release (`fabric_work_list` → released_by_operator).
 */
import type { createScopedStore } from './scopedStore.ts'
import { RELEASE_OUTCOME } from '../shared/workClaims.ts'
import type { ActorKind } from '@fabric/journal'

type Store = ReturnType<typeof createScopedStore>
type Append = (e: { type: 'work.released@1'; actor: { kind: ActorKind; id: string }; projectId: string; payload: Record<string, unknown> }) => Promise<unknown>

/** Releases every live claim a session holds, as `session-ended`. Returns the claims released. */
export async function releaseSessionClaims(store: Store, append: Append, sessionId: string, why: 'ended' | 'app-quit'): Promise<string[]> {
  const r = await store.select('work_claims', 'id,work_id,project_id').eq('owner_session', sessionId).is('released_at', null)
  if (r.error) throw new Error(`the session's claims could not be read: ${r.error.message}`)
  const done: string[] = []
  for (const c of (r.data ?? []) as Array<{ id: string; work_id: string; project_id: string }>) {
    await append({
      type: 'work.released@1',
      actor: { kind: 'system', id: why === 'app-quit' ? 'app-quit' : 'session-end' },
      projectId: c.project_id,
      payload: { work: c.work_id, owner: sessionId, outcome: RELEASE_OUTCOME['session-ended'], how: 'session-ended', claim_id: c.id }
    })
    done.push(c.id)
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
