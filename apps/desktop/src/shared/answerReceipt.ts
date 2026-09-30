// The answer, and where it went — as two facts (M152).
//
// MEASURED: the Board's receipt shows one banner. `committed`, then either
// "still blocked by N" or "N eligible", and the continuation half is not shown
// AT ALL. So an answer whose delivery landed as `needs_restart` — the session
// that asked has gone — reads to the operator as "answered · 2 eligible": the
// full closed loop, when in truth the answer reached nobody.
//
// THE AGGREGATE NEVER COMPRESSES. M152's own invariant, and it is not style: a
// commit that succeeded and a delivery that could not be made are different
// outcomes with different next acts, and one enum has room for neither. The
// operator who reads "answered" and walks away is right to; the one who reads
// it when the agent never heard has been misled by the summary rather than by
// anybody's mistake.
//
// AND A PARTIAL LOOP SAYS SO. `commit ready with continuation unavailable` is a
// partial milestone, and the product does not present it as a closed one.

import type { ContinuationState } from './continuation.ts'

export interface ContinuationOutcome {
  taskId: string
  state: ContinuationState
  says: string
  deliveryId?: string
  /**
   * This delivery already existed and nothing was sent again (AX-03).
   *
   * Distinct from the commit's `repeated`, which says the ANSWER was already
   * recorded. They can differ: a first commit whose delivery half failed and
   * was retried is not a repeated commit, but the second attempt may still find
   * the delivery already made.
   */
  alreadyDelivered?: boolean
}

export interface AnswerSummary {
  /** The decision is recorded. This is true whatever happened to the delivery,
   *  and it is the half an operator most needs to be able to rely on. */
  committed: boolean
  /** Whether the loop actually closed: answered AND the work heard about it. */
  loopClosed: boolean
  /** One line per fact, never merged. The order is commit first, because the
   *  durable thing comes before the transient one. */
  lines: { kind: 'commit' | 'blockers' | 'delivery'; tone: 'ok' | 'warn'; says: string }[]
  /** The single act that most helps, when there is one. Named rather than a
   *  list, because a receipt offering four buttons is a receipt nobody reads. */
  primaryAction: 'none' | 'restart_session' | 'retry_delivery' | 'answer_remaining'
}

export function summariseAnswer(input: {
  committed: boolean
  reason?: string
  /**
   * The estate had ALREADY recorded this answer, and returned the first commit
   * rather than making a second (AX-03).
   *
   * MEASURED at `38c37d3`: this flag crossed the IPC boundary on every answer
   * and was read by NOTHING — its only consumers were assertions in
   * `BoardPanel.test.tsx` that it had been sent. Sixth field of that shape in
   * forty iterations, and a test is not a reader. So an operator who pressed
   * the button twice — because the first response was lost — read a receipt
   * word for word identical to a first commit, and had no way to tell whether
   * the estate now held one decision or two. It holds one; the surface simply
   * never said so.
   */
  repeated?: boolean
  unblocked: readonly string[]
  stillBlocked: readonly { task_id: string; open_blockers: number }[]
  continuations: readonly ContinuationOutcome[]
}): AnswerSummary {
  if (!input.committed)
    return {
      committed: false,
      loopClosed: false,
      lines: [{ kind: 'commit', tone: 'warn', says: input.reason ?? 'the answer was not recorded' }],
      primaryAction: 'none'
    }

  const lines: AnswerSummary['lines'] = [
    {
      kind: 'commit',
      tone: 'ok',
      says: input.repeated
        ? 'this answer was ALREADY recorded — the estate returned the first decision rather than making a second'
        : 'the answer is recorded, and it stays recorded whatever happens next'
    }
  ]

  if (input.stillBlocked.length > 0)
    lines.push({
      kind: 'blockers',
      tone: 'warn',
      says: `${input.stillBlocked.length} task(s) are still blocked by another question`
    })

  // THE HALF THAT WAS MISSING. Absent, the operator reads a commit as a closed
  // loop even when the agent never heard.
  // ALREADY TOLD is not a failed delivery and not a fresh one. An operator who
  // pressed twice needs to know the agent heard once — which is the whole point
  // of deriving the delivery's identity rather than minting it (AX-03).
  const alreadyTold = input.continuations.filter((c) => c.alreadyDelivered)
  if (alreadyTold.length > 0)
    lines.push({
      kind: 'delivery',
      tone: 'ok',
      says: `${alreadyTold.length} delivery(ies) already had a terminal receipt — nothing was sent a second time`
    })

  const restarts = input.continuations.filter((c) => c.state === 'needs_restart')
  const delivering = input.continuations.filter((c) => c.state === 'delivering')
  const retryable = input.continuations.filter((c) => c.state === 'retryable')

  if (input.continuations.length === 0 && input.unblocked.length > 0)
    lines.push({
      kind: 'delivery',
      tone: 'warn',
      says:
        'nothing was delivered — no session was waiting for this answer. The work can now proceed, and ' +
        'nothing was started: somebody has to pick it up.'
    })
  if (restarts.length > 0)
    lines.push({
      kind: 'delivery',
      tone: 'warn',
      says: `the session that asked has ended for ${restarts.length} task(s). The decision is recorded and still good; the work needs a new session carrying it.`
    })
  if (retryable.length > 0)
    lines.push({ kind: 'delivery', tone: 'warn', says: `${retryable.length} delivery(ies) can be tried again` })
  if (delivering.length > 0)
    lines.push({
      kind: 'delivery',
      tone: 'ok',
      says: `sent to ${delivering.length} session(s). They confirm receipt themselves, and nothing was started on your behalf.`
    })

  for (const c of input.continuations) {
    if (['outcome_unknown', 'rejected', 'obsolete', 'queued'].includes(c.state))
      lines.push({ kind: 'delivery', tone: 'warn', says: c.says })
    if (c.state === 'acked')
      lines.push({ kind: 'delivery', tone: 'ok', says: c.says })
  }

  // CLOSED means answered AND heard. A delivery that went out unconfirmed is
  // not yet a closed loop, and saying so is the difference between a receipt
  // and a reassurance.
  const loopClosed = input.stillBlocked.length === 0 && input.unblocked.every((taskId) =>
    input.continuations.some((c) => c.taskId === taskId && c.state === 'acked'))

  return {
    committed: true,
    loopClosed,
    lines,
    primaryAction:
      restarts.length > 0
        ? 'restart_session'
        : retryable.length > 0
          ? 'retry_delivery'
          : input.stillBlocked.length > 0
            ? 'answer_remaining'
            : 'none'
  }
}
