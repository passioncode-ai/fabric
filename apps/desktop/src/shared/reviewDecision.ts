// #region review-decision — docs: docs/ux/scenarios.md#scn-179-decide-on-work-handed-in-for-review-in-one-place
/**
 * SCN-179 (CO-521): a task in review waits for one decision of the person: accept it, return it to work with what to
 * change, or cancel it. What the person decides on is what the agent handed in, read from the journal rows the task
 * page already has: the note of the newest move to review, else the note of the done release that led to it (an agent
 * often releases its claim done, then moves the task through running to review with a shorter note, or none).
 */
import type { FeedEvent } from './types'

export type ReviewDecision = 'accept' | 'return' | 'cancel'

export interface ReviewAsk {
  /** The agent's own words on what it handed in; null when it wrote none. */
  said: string | null
  by: 'person' | 'agent' | 'system'
  /** When the task was put in review. */
  at: string
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function reviewAsk(status: string, events: readonly FeedEvent[]): ReviewAsk | null {
  if (status !== 'review') return null
  const ordered = [...events].sort((a, b) => a.seq - b.seq)
  const moves = ordered.filter((e) => e.type === 'task.moved@1')
  const handIn = [...moves].reverse().find((e) => e.payload.to === 'review')
  if (!handIn) return null
  // The hand-in this ask is about starts after the previous visit to review (handed in, or sent back from it).
  const before = [...moves].reverse().find((e) => e.seq < handIn.seq && (e.payload.to === 'review' || e.payload.from === 'review'))
  const release = [...ordered].reverse().find((e) => e.type === 'work.released@1' && e.payload.how === 'done'
    && e.seq < handIn.seq && (before === undefined || e.seq > before.seq))
  const by = handIn.actor.kind === 'person' ? 'person' : handIn.actor.kind === 'agent' ? 'agent' : 'system'
  return { said: text(handIn.payload.note) ?? text(release?.payload.note), by, at: handIn.occurred_at }
}

/** Why a decision cannot be sent as given: returning and cancelling carry words for the agent and the record. */
export function reviewDecisionProblem(decision: ReviewDecision, comment: string): 'return-needs-comment' | 'cancel-needs-reason' | 'unknown-decision' | null {
  if (decision === 'accept') return null
  if (decision === 'return') return comment.trim() ? null : 'return-needs-comment'
  if (decision === 'cancel') return comment.trim() ? null : 'cancel-needs-reason'
  return 'unknown-decision'
}
// #endregion review-decision
