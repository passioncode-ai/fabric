/**
 * Changing which account runs a conversation, without claiming it worked.
 *
 * M199.resume. The card's third failure case is the one that decides the shape
 * of this file: **a wrong identity or a missing native-reference acknowledgement
 * does not commit success.** And M199.probe measured `native-resume-ack` as
 * `unverified` on both installed builds — Claude Code refuses an unknown session
 * id loudly, which proves the REFERENCE is checked and says nothing about the
 * restored context; Codex exits on a terminal check before validating anything.
 *
 * So on this machine, today, a switch CANNOT reach `committed`. That is not a
 * gap to apologise for: it is the design's own invariant with a measurement
 * behind it, and the coordinator's job is to stop at `needs_reconciliation`
 * with the reason rather than to write a receipt nobody earned. The alternative
 * the design offers — a separately labelled new conversation with a reviewed
 * handoff — is a different operation and is never reported as continuation.
 *
 * THE ORDER MATTERS MORE THAN THE PHASES. Feasibility is decided BEFORE anything
 * stops: identity, data scope, native compatibility, the checkpoint manifest,
 * pending input and unresolved effects. Stopping first and asking afterwards is
 * how a conversation ends up neither running nor resumable.
 */

/** The eight phases, in the order the card names them. */
export const SWITCH_PHASES = [
  'preparing',
  'waiting_boundary',
  'stopping',
  'resuming',
  'committed',
  'recovering',
  'restored',
  'needs_reconciliation'
] as const
export type SwitchPhase = (typeof SWITCH_PHASES)[number]

export interface SwitchOperation {
  switchId: string
  /** The caller's own key. A retry with the same key resumes THIS operation. */
  idempotencyKey: string
  conversationId: string
  from: string | null
  to: string | null
  /** The binding revision this operation was planned against. */
  expectedBinding: number
  policyRevision?: string
  phase: SwitchPhase
  /** Where the prior state is kept, so `restored` has something to restore. */
  checkpointRef: string | null
  oldGeneration: number
  newGeneration: number
  receipt: string
}

const NEXT: Readonly<Record<SwitchPhase, readonly SwitchPhase[]>> = {
  // Feasibility is decided here. Everything below it has already stopped
  // something, which is why nothing may skip back into `preparing`.
  preparing: ['waiting_boundary', 'needs_reconciliation'],
  waiting_boundary: ['stopping', 'needs_reconciliation'],
  stopping: ['resuming', 'recovering', 'needs_reconciliation'],
  // `committed` is reachable only through `resuming`, and only with both
  // acknowledgements — see `mayCommit`.
  resuming: ['committed', 'recovering', 'needs_reconciliation'],
  committed: [],
  recovering: ['restored', 'needs_reconciliation'],
  restored: [],
  needs_reconciliation: ['recovering']
}

export type MoveVerdict = { ok: true } | { ok: false; reason: string }

export function mayAdvance(from: SwitchPhase, to: SwitchPhase): MoveVerdict {
  if (from === to) return { ok: false, reason: `already ${from}` }
  if (!NEXT[from].includes(to))
    return { ok: false, reason: `a switch cannot go from ${from} to ${to}; only ${NEXT[from].join(', ') || 'nothing'}` }
  return { ok: true }
}

/** A phase from which nothing more happens without a person. */
export function isTerminal(phase: SwitchPhase): boolean {
  return NEXT[phase].length === 0
}

/** Everything that must be true before anything is stopped. */
export interface Feasibility {
  /** The identity the target account resolves to, as the provider reports it. */
  targetIdentityKnown: boolean
  /** Same provider — a cross-provider handoff is a different operation (M169). */
  sameProvider: boolean
  /** Same organisation, or the conversation's data would move between scopes. */
  sameDataScope: boolean
  /** Does this build acknowledge a native resume at all? From the matrix. */
  nativeAckSupported: boolean
  /** A manifest of what would be carried, or null when nothing is. */
  checkpointEntries: readonly string[] | null
  /** Input the operator has typed and not yet sent. */
  pendingInput: boolean
  /** Effects reserved or dispatching, whose outcome nobody has observed. */
  unresolvedEffects: readonly string[]
}

export interface FeasibilityVerdict {
  feasible: boolean
  /** Every reason it is not, so a person sees the whole list at once. */
  blockers: readonly string[]
  says: string
}

/**
 * May this switch be attempted at all?
 *
 * Every blocker is collected rather than returned one at a time: an operator
 * shown one reason, fixing it, and being shown the next has been told the truth
 * three times and lied to about the shape of the problem twice.
 */
export function feasibility(input: Feasibility): FeasibilityVerdict {
  const blockers: string[] = []
  if (!input.sameProvider)
    blockers.push('the target account belongs to another provider — that is a cross-provider handoff, a different operation')
  if (!input.targetIdentityKnown)
    blockers.push('the provider has not confirmed who the target account is, so there is nothing to switch to')
  if (!input.sameDataScope)
    blockers.push(
      'the target account is in another organisation: continuing would move the conversation between data scopes, ' +
        'which is not a switch but a copy nobody authorised'
    )
  if (!input.nativeAckSupported)
    blockers.push(
      'this build cannot acknowledge a native resume, so a switch could not be confirmed even if it worked — the ' +
        'reviewed handoff to a NEW conversation is the honest alternative and is never reported as continuation'
    )
  if (input.pendingInput)
    blockers.push('there is input typed and not sent; stopping now would lose it silently')
  if (input.unresolvedEffects.length)
    blockers.push(
      `${input.unresolvedEffects.length} effect(s) are reserved or dispatching with no observed outcome ` +
        `(${input.unresolvedEffects.slice(0, 3).join(', ')}). Resuming would re-run them, and an effect run twice is ` +
        `the one failure no receipt can undo`
    )
  const manifest = input.checkpointEntries ? manifestProblems(input.checkpointEntries) : []
  blockers.push(...manifest)
  return {
    feasible: blockers.length === 0,
    blockers,
    says: blockers.length
      ? `this switch is not attemptable yet: ${blockers.length} thing(s) stand in the way`
      : 'the target is reachable, the scope matches, nothing is pending and nothing is unresolved'
  }
}

/**
 * Entries a checkpoint manifest may not carry.
 *
 * Path traversal and symlinks, refused by shape rather than by resolving them:
 * a check that resolves a link asks the filesystem a question whose answer can
 * change between the check and the copy.
 */
export function manifestProblems(entries: readonly string[]): string[] {
  const problems: string[] = []
  for (const entry of entries) {
    if (entry.startsWith('/') || /^[A-Za-z]:[\\/]/.test(entry))
      problems.push(`the manifest carries an absolute path (${entry}); a checkpoint is relative to its own root`)
    else if (entry.split(/[\\/]/).includes('..'))
      problems.push(`the manifest escapes its root (${entry})`)
    else if (entry.includes('\0')) problems.push('the manifest carries a null byte in a path')
  }
  return problems
}

export interface Acknowledgement {
  /** Who the provider says is logged in, after the resume. */
  identity: string | null
  /** Which conversation the provider says it restored. */
  nativeRef: string | null
}

export interface CommitVerdict {
  allowed: boolean
  reason: string
}

/**
 * May this switch be recorded as having WORKED?
 *
 * Both acknowledgements, and both compared against what was expected. A resume
 * that restored a different conversation, or restored the right one as the wrong
 * account, is not a partial success — it is a different thing that happened, and
 * writing a receipt for it is the false report the card forbids.
 */
export function mayCommit(input: {
  expectedIdentity: string
  expectedNativeRef: string | null
  ack: Acknowledgement | null
}): CommitVerdict {
  if (!input.ack)
    return {
      allowed: false,
      reason:
        'the provider acknowledged nothing. An unacknowledged resume is a new conversation wearing an old name, and ' +
        'committing would report a continuation nobody observed'
    }
  if (!input.ack.identity)
    return { allowed: false, reason: 'the provider did not say who is logged in after the resume' }
  if (input.ack.identity !== input.expectedIdentity)
    return {
      allowed: false,
      reason:
        `the resume came back as ${input.ack.identity} and the switch was to ${input.expectedIdentity}. The work ` +
        `would run as somebody else`
    }
  // A conversation with no native reference has nothing to restore, so there is
  // nothing to acknowledge either — and that is a NEW conversation, which this
  // operation is not.
  if (!input.expectedNativeRef)
    return {
      allowed: false,
      reason:
        'this conversation has no native reference, so there is no saved history to resume. Starting fresh is the ' +
        'reviewed-handoff path and it is a different operation'
    }
  if (input.ack.nativeRef !== input.expectedNativeRef)
    return {
      allowed: false,
      reason:
        `the provider restored ${input.ack.nativeRef ?? 'nothing'} and this switch is about ` +
        `${input.expectedNativeRef}. A different conversation is not a partial success`
    }
  return { allowed: true, reason: `${input.ack.identity} resumed ${input.ack.nativeRef}, both acknowledged` }
}

/**
 * What the old run becomes when the switch stops it.
 *
 * `cancelled` requires having OBSERVED the stop. Anything else is
 * `outcome_unknown` — the same distinction ADR-0050 makes one level up, and for
 * the same reason: a process we stopped asking about is not a process we know
 * the end of.
 */
export function oldRunOutcome(stopObserved: boolean): 'cancelled' | 'outcome_unknown' {
  return stopObserved ? 'cancelled' : 'outcome_unknown'
}

export interface Budget {
  attemptsUsed: number
  msSpent: number
  spend: number
}

/**
 * A new Session and TaskRun do NOT reset the enclosing budget.
 *
 * The card states it as an invariant and it is easy to get wrong by accident:
 * the natural thing is to build a fresh run record with fresh counters, and the
 * enclosing work has already spent what it spent.
 */
export function carryBudget(before: Budget): Budget {
  return { ...before }
}

export function budgetWasReset(before: Budget, after: Budget): boolean {
  return after.attemptsUsed < before.attemptsUsed || after.msSpent < before.msSpent || after.spend < before.spend
}
