// Getting the answer back to the work that was waiting (M152.continue).
//
// MEASURED: `answer_question` records the answer, recomputes the blocking set
// and returns which tasks became eligible — and it DELIVERS NOTHING. The
// agent's only route back is polling `fabric_question_check`, whose own
// description tells it "do not wait in a loop". So an agent asks, is told to go
// away, and must come back on its own initiative; a CLI that finished its turn
// never comes back at all. The operator answers on the Board, the projection
// updates, and the session that was blocked learns nothing.
//
// THE RETRY RETRIES THE DELIVERY, NOT THE ANSWER. This is the invariant the
// whole module is arranged around. An answer is a decision the estate has
// recorded once; re-running the commit because a socket dropped would record a
// second decision, and two decisions where a person made one is worse than no
// delivery at all.
//
// AND A DEAD TARGET IS NOT A FAILED DELIVERY. The session that asked may have
// ended while the operator was thinking. That is `needs_restart` — the work is
// still there, the decision is still good, and what is required is a new
// session carrying both. Filing it as a failure invites a retry that cannot
// possibly work.

export const CONTINUATION_STATES = [
  'queued',
  /** Bytes are moving. The transport accepted them; nobody has read them. */
  'delivering',
  /** The agent quoted it back (M103). The only state that means it arrived. */
  'acked',
  /** Possible write with no conclusive receipt. Never automatically replay. */
  'outcome_unknown',
  /** Something transient. Try the same delivery again. */
  'retryable',
  /** The target is gone. A new session is needed, not another attempt. */
  'needs_restart',
  /** A later answer superseded this one; delivering it now would carry a
   *  decision the estate has already replaced. */
  'obsolete',
  /** The target refused it — wrong task, wrong epoch, wrong content. */
  'rejected'
] as const
export type ContinuationState = (typeof CONTINUATION_STATES)[number]

/** States from which trying the SAME delivery again can work. */
export function mayRetry(state: ContinuationState): boolean {
  return state === 'retryable' || state === 'queued'
}

/** States that need a new session rather than another attempt. */
export function needsNewSession(state: ContinuationState): boolean {
  return state === 'needs_restart'
}

export interface Target {
  taskId: string
  /** The run that was waiting. Null before M188's admission, and for a task
   *  answered while nothing was running. */
  taskRunId: string | null
  sessionId: string | null
  /** Whether that session is still alive right now. */
  sessionLive: boolean
  /** The run's state, so an ended run is not addressed as though it were live. */
  runEnded: boolean
}

export interface ContinuationDecision {
  state: ContinuationState
  says: string
  /** True only when the estate should actually write bytes somewhere. */
  deliver: boolean
}

/**
 * Where does this answer go, and what happens if it cannot?
 *
 * Ordered by what is knowable: supersession first, because delivering a
 * replaced decision is worse than delivering nothing; then the target, because
 * a dead one cannot be retried into life.
 */
export function routeContinuation(input: {
  target: Target
  /** A later answer to the same question. */
  superseded: boolean
  /** Other blockers still open on the task — the work is not ready to resume
   *  even though this question is settled. */
  otherBlockers: number
}): ContinuationDecision {
  if (input.superseded)
    return {
      state: 'obsolete',
      deliver: false,
      says: 'a later answer replaced this one; delivering it now would carry a decision the estate has already changed'
    }

  if (input.otherBlockers > 0)
    return {
      state: 'queued',
      deliver: false,
      says:
        `this question is settled and ${input.otherBlockers} other blocker(s) are not. The answer is recorded ` +
        `and waits; sending it now would tell the agent to carry on into a wall it is still behind.`
    }

  if (!input.target.sessionId || input.target.runEnded || !input.target.sessionLive)
    return {
      state: 'needs_restart',
      deliver: false,
      says:
        'the session that asked has ended. The decision is recorded and still good; what is needed is a new ' +
        'session carrying it, not another attempt at a target that is gone.'
    }

  return { state: 'delivering', deliver: true, says: 'delivering the answer to the session that asked' }
}

/**
 * What a retry is allowed to touch.
 *
 * Named as data rather than left to a caller's care: the commit is the estate's
 * record of a person's decision, and a retry that re-ran it would record a
 * second decision where one was made.
 */
export const RETRY_TOUCHES = {
  delivery: true,
  answerCommit: false,
  grant: false
} as const

export function retryPlan(state: ContinuationState): { retryDelivery: boolean; recommitAnswer: false; says: string } {
  return {
    retryDelivery: mayRetry(state),
    // Never. Not "not usually" — an answer is committed once, and the type says
    // so where a comment would be forgotten.
    recommitAnswer: false,
    says: mayRetry(state)
      ? 'the same delivery goes out again; the answer is not recorded a second time'
      : `nothing to retry from ${state}`
  }
}

/** What the waiting agent is handed. It carries the DECISION reference so the
 *  agent can cite what it was told, and says plainly that this is an answer to
 *  something it asked rather than a new instruction. */
export function continuationText(answer: string, decisionId: string): string {
  return (
    `The question you were waiting on has been answered.\n\n` +
    `${answer}\n\n` +
    `This is decision ${decisionId}. It is recorded, so cite it rather than asking again. ` +
    `Carry on with the task you were on.`
  )
}
