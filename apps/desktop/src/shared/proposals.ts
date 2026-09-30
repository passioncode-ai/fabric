// One checker in front of every proposal write (M168, ADR-0046).
//
// MEASURED BEFORE THIS: two entry points wrote proposal events and they checked
// different things. The agent surface asked `mayChain` and nothing else. The
// operator's `proposals.decide` asked only "does it exist and is it undecided",
// then appended `task.created@1` using the proposal's `project_id` without
// looking at whether that project is still there. Neither shared a line of
// validation, and a third entry point added tomorrow would share nothing with
// either.
//
// A REFUSAL IS A RECEIPT, NOT A THROWN ERROR. Both paths threw. M106 already
// established what a thrown error looks like on the far side of the bridge —
// "Error invoking remote method" — and a checker whose refusals arrive that way
// is a checker the operator experiences as a broken button. Every refusal here
// carries a reason code, what it is about, a REMEDY, and whether trying again
// could ever work.
//
// FAILING CLOSED IS NOT THE SAME AS REJECTING. A checker that cannot run
// refuses to commit and says `retryable` — the draft survives and the operator
// is told to try again. A checker that ran and said no is `retryable: false`.
// Collapsing those two teaches people to retry things that will never work, and
// to abandon things that would have worked on the next attempt.

/** Versioned, because a surface stores these and a renamed code silently stops
 *  matching. Adding is free; renaming is a migration. */
export const REJECTION_CODES = [
  'not_found',
  'already_decided',
  'unknown_decision',
  'project_missing',
  'superseded',
  'not_eligible',
  'checker_unavailable'
] as const
export type RejectionCode = (typeof REJECTION_CODES)[number]

/** Bumped when a validator's MEANING changes, so a receipt says which rules
 *  produced it. A receipt from an older version is not silently re-read as
 *  though today's rules had refused it. */
export const CHECKER_VERSION = 1

export interface Rejection {
  ok: false
  reasonCode: RejectionCode
  /** For a person, in their words. */
  says: string
  /** What to DO. A refusal with no next step is a wall. */
  remedy: string
  /** Could this ever succeed on another attempt? `checker_unavailable` is the
   *  only refusal here that is retryable, and it is the one that means the
   *  checker did not run at all. */
  retryable: boolean
  /** Which field, when the fault is in one. */
  fieldPath?: string
  checkerVersion: number
}

export type CheckResult<T> =
  | { ok: true; command: T; checkerVersion: number; inputRevisions: Record<string, string | number | null> }
  | Rejection

const reject = (
  reasonCode: RejectionCode,
  says: string,
  remedy: string,
  extra: { retryable?: boolean; fieldPath?: string } = {}
): Rejection => ({
  ok: false,
  reasonCode,
  says,
  remedy,
  retryable: extra.retryable ?? false,
  ...(extra.fieldPath ? { fieldPath: extra.fieldPath } : {}),
  checkerVersion: CHECKER_VERSION
})

export const DECISIONS = ['accepted', 'declined'] as const
export type ProposalDecision = (typeof DECISIONS)[number]

/** What the checker was given, already read from the store by its caller. The
 *  checker does not fetch: it is pure, so every rule it holds is testable
 *  without a database. */
export interface ProposalFacts {
  id: string
  /** Null when nothing with that id is in this scope — which is the same answer
   *  as "it belongs to another estate", deliberately. */
  proposal: {
    id: string
    project_id: string | null
    title: string
    decided_at: string | null
    decision: string | null
  } | null
  /** Whether the project the proposal names still exists, read at check time.
   *  Revalidated again at commit, because between the two it can vanish. */
  projectExists: boolean
}

export interface DecideCommand {
  proposalId: string
  decision: ProposalDecision
  projectId: string
  title: string
}

/**
 * May this proposal be decided, and does the decision mean anything?
 *
 * Every rule that was scattered across the two entry points, in one place that
 * a third entry point cannot avoid without being caught by `check-checker.mjs`.
 */
export function checkProposalDecision(input: {
  facts: ProposalFacts
  decision: unknown
}): CheckResult<DecideCommand> {
  const { facts } = input

  if (!facts.proposal)
    return reject(
      'not_found',
      'that proposal is not in this estate',
      'Refresh the board — it may have been decided from another window, or it belongs to a different estate.'
    )

  if (facts.proposal.decided_at !== null)
    return reject(
      'already_decided',
      `that proposal was already ${facts.proposal.decision ?? 'decided'}`,
      'Nothing to do. If the outcome is wrong, file a new proposal rather than deciding this one twice.'
    )

  // TYPE-CHECKED ON ONE SIDE IS NOT CHECKED. The renderer declares this as a
  // union, which the compiler enforces in the renderer's own build and nowhere
  // on the wire. Anything reaching the bridge can send any string.
  if (typeof input.decision !== 'string' || !DECISIONS.includes(input.decision as ProposalDecision))
    return reject(
      'unknown_decision',
      `"${String(input.decision)}" is not a decision`,
      `Send one of: ${DECISIONS.join(', ')}.`,
      { fieldPath: 'decision' }
    )

  if (!facts.proposal.project_id)
    return reject(
      'project_missing',
      'that proposal names no project',
      'It cannot become a task without one. Decline it and file the work against a project.',
      { fieldPath: 'project_id' }
    )

  // The gap the old path had: it read `p.project_id` and appended
  // `task.created@1` against it without asking whether the project is still
  // there. A task in a project nobody has is not visible anywhere.
  if (!facts.projectExists)
    return reject(
      'project_missing',
      'the project this proposal belongs to is gone',
      'Decline it. Accepting would create a task in a project that no longer exists, and nothing would show it.',
      { fieldPath: 'project_id' }
    )

  return {
    ok: true,
    command: {
      proposalId: facts.proposal.id,
      decision: input.decision as ProposalDecision,
      projectId: facts.proposal.project_id,
      title: facts.proposal.title
    },
    checkerVersion: CHECKER_VERSION,
    // What the decision was made AGAINST. Revalidated at commit; a change
    // between the two is `superseded` rather than a silent overwrite.
    inputRevisions: { decided_at: facts.proposal.decided_at, project_id: facts.proposal.project_id }
  }
}

/** The refusal a caller returns when the checker itself could not run. Kept
 *  here so every entry point fails closed the same way rather than each
 *  inventing its own shape at the moment things are already going wrong. */
export function checkerUnavailable(because: string): Rejection {
  return reject(
    'checker_unavailable',
    `the check could not be made: ${because}`,
    'Nothing was written and your draft is intact. Try again.',
    { retryable: true }
  )
}
