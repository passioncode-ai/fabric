// #region launch-overlap — docs: docs/evidence/specs/2026-11-06-session-coordination.md#5-waves
/**
 * CO-522 wave A (SCN-180 step 2): before Fabric starts an agent on a task, the live claims of the task's project are
 * read and the person is told what the new work would run into: another session holding the same task, the same
 * backlog row, a linked task, or files both name. Touches are the agents' own declarations on their claims; for the
 * task about to start they are inferred from the repository paths its text names. A claim with nothing in common is
 * still said, as work already going on in the project. Advisory: the person decides whether to start anyway.
 */
import { relatedTo, normaliseTouch, type ClaimLife, type ClaimRow, type RelatedWhy, type SourceRow, type TaskEdge } from './workClaims.ts'

export type LaunchClaim = ClaimRow & { task: { id: string; title: string }; life: ClaimLife }

export type LaunchWhy = RelatedWhy | { kind: 'same-task' }

export interface LaunchHit {
  claimId: string
  taskId: string
  taskTitle: string
  heldBy: string
  agent: string | null
  since: string
  why: LaunchWhy[]
}

export interface LaunchOverlap {
  /** Live claims the new work runs into, with why. */
  overlaps: LaunchHit[]
  /** Other live claims in the project, nothing in common found. */
  alsoWorking: LaunchHit[]
}

/** A repository-relative path as a task names it: segments joined by `/`, no scheme, not absolute. */
const PATH = /(?<![\w:/.-])(?:[\w.-]+\/)+[\w.-]*/g

/** The repository paths a task's text names, normalised, once each, in the order they appear. */
export function inferTouches(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(PATH)) {
    const before = text.slice(Math.max(0, m.index! - 3), m.index!)
    if (before.endsWith('://')) continue
    const touch = normaliseTouch(m[0].replace(/[.,;:]+$/, ''))
    if (!touch || touch.startsWith('/') || !touch.includes('/') && !/\.\w+$/.test(touch)) continue
    if (!out.includes(touch)) out.push(touch)
  }
  return out
}

export function launchOverlap(
  task: { taskId: string | null; text: string },
  claims: readonly LaunchClaim[],
  sources: ReadonlyMap<string, SourceRow>,
  edges: readonly TaskEdge[]
): LaunchOverlap {
  const live = claims.filter((c) => c.life !== 'lapsed')
  const touches = inferTouches(task.text)
  const mine = task.taskId ?? '\u0000none'
  const related = new Map(relatedTo({ claimId: null, taskId: mine, owner: '\u0000new', touches }, live, sources, edges).map((r) => [r.claimId, r]))
  const hit = (c: LaunchClaim, why: LaunchWhy[]): LaunchHit =>
    ({ claimId: c.id, taskId: c.work_id, taskTitle: c.task.title, heldBy: c.owner_session, agent: c.agent, since: c.claimed_at, why })
  const overlaps: LaunchHit[] = [], alsoWorking: LaunchHit[] = []
  for (const c of live) {
    const why: LaunchWhy[] = [...(task.taskId && c.work_id === task.taskId ? [{ kind: 'same-task' as const }] : []), ...(related.get(c.id)?.why ?? [])]
    ;(why.length ? overlaps : alsoWorking).push(hit(c, why))
  }
  return { overlaps, alsoWorking }
}
// #endregion launch-overlap
