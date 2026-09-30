/**
 * Proving an account changed and the conversation continued — or refusing to.
 *
 * M199.acceptance. The card is blunt about its own outcome, and the sentence is
 * the whole design: **"without test accounts or capability evidence the status
 * stays `not executed`, not `passed`"**, and **"fixture tests alone cannot pass
 * acceptance"**.
 *
 * There are no authorised test accounts on this machine. M199.probe reserved
 * them for a separately granted certification, for a concrete reason: a second
 * Claude Code login overwrites the one keychain item per operating-system user
 * and logs the operator out of their live session. So the verdict here is `not
 * executed`, and that is CORRECT rather than a shortfall.
 *
 * WHAT THIS FILE IS FOR, then. Three things that are worth building before the
 * accounts exist:
 *
 *  1. **The judge.** Given a receipt, does it prove what it claims? Four of the
 *     card's failure cases are judgements rather than runs — a wrong-account
 *     acknowledgement must fail, a transcript read must not pass as an
 *     independent observation, a repeated tool effect must fail, a second
 *     conversation moving must fail — and all four are testable now.
 *  2. **The refusal.** `passed` is unreachable without independent observations
 *     and negative controls, mechanically. A card can say "fixtures cannot
 *     pass"; a function can make it so.
 *  3. **The plan, as data.** What would be run, in order, so that granted
 *     certification is one command rather than a project.
 */

export type AcceptanceOutcome =
  /** Nothing was run. The honest state without authorised accounts. */
  | 'not-executed'
  /** Run, and it proved what it claims. Reachable only with real evidence. */
  | 'passed'
  /** Run, and something it must refuse was accepted, or a control did not fire. */
  | 'failed'
  /** Run, and the evidence is not enough to say either way. */
  | 'inconclusive'

/**
 * How a claim about the resumed conversation was checked.
 *
 * `transcript-read` is here to be REFUSED. Reading Fabric's own saved terminal
 * output proves what Fabric wrote down, not that the provider restored a
 * conversation — and it is the substitution the card names first, because it is
 * the one that looks like evidence.
 */
export type ObservationMethod =
  /** A marker added to conversation A before the switch, found after it. */
  | 'pre-placed-marker'
  /** The provider's own identity reader, after the resume. */
  | 'provider-identity-reader'
  /** The provider's own conversation reference, echoed back. */
  | 'provider-native-ref'
  /** The tool-call history the provider itself reports. */
  | 'provider-tool-history'
  /** Fabric's own transcript. NOT independent. */
  | 'transcript-read'

export interface Observation {
  method: ObservationMethod
  says: string
  /** True when the observation came back as expected. */
  confirmed: boolean
}

/** A control that must FAIL, and whether it did. */
export interface NegativeControl {
  name:
    | 'wrong-account-ack'
    | 'wrong-native-ref-ack'
    | 'transcript-instead-of-resume'
    | 'repeated-tool-effect'
    | 'second-conversation-moved'
    | 'crash-mid-switch'
    | 'concurrent-refresh'
    | 'exhausted-pool'
    | 'stale-usage'
    | 'quarantine'
    | 'disable-while-waiting'
  /** Did acceptance REFUSE it? A control that passed is a control that failed. */
  refused: boolean
  says: string
}

export interface AcceptanceReceipt {
  provider: string
  cliBuild: string
  runtime: string
  /** Which capability matrix these rows were judged against. */
  capabilityRevision: string
  /** Opaque references to the two account subjects. Never a credential. */
  subjectRefs: readonly string[]
  nativeRef: string | null
  /** Digests of what a checkpoint carried, never its contents. */
  checkpointDigests: readonly string[]
  /** One per switch attempted, in order. */
  switchReceipts: readonly { from: string | null; to: string | null; phase: string; reason: string }[]
  independentObservations: readonly Observation[]
  negativeControls: readonly NegativeControl[]
  outcome: AcceptanceOutcome
  at: string
}

/** The controls that must be present for a run to mean anything. */
export const REQUIRED_CONTROLS: readonly NegativeControl['name'][] = [
  'wrong-account-ack',
  'wrong-native-ref-ack',
  'transcript-instead-of-resume',
  'repeated-tool-effect',
  'second-conversation-moved'
]

/** Observation methods that count as INDEPENDENT of Fabric's own record. */
export const INDEPENDENT_METHODS: readonly ObservationMethod[] = [
  'pre-placed-marker',
  'provider-identity-reader',
  'provider-native-ref',
  'provider-tool-history'
]

export interface Verdict {
  outcome: AcceptanceOutcome
  /** Everything that stops this being a pass. Empty only for a real pass. */
  blockers: readonly string[]
  says: string
}

/**
 * Judge a receipt.
 *
 * The order is the order of the card's own failure cases, and `not-executed`
 * comes first because it is the state that must not be dressed up: a receipt
 * with no observations and no controls has not measured anything, and calling
 * that `failed` would be as wrong as calling it `passed` — one invents a defect
 * and the other invents a capability.
 */
export function judge(receipt: AcceptanceReceipt): Verdict {
  const blockers: string[] = []

  const independent = receipt.independentObservations.filter((o) =>
    INDEPENDENT_METHODS.includes(o.method)
  )
  const ran = receipt.switchReceipts.length > 0 || receipt.independentObservations.length > 0

  if (!ran)
    return {
      outcome: 'not-executed',
      blockers: [
        'no switch was attempted and nothing was observed: this is the state without authorised test accounts, and it is not a failure'
      ],
      says:
        `${receipt.provider} ${receipt.cliBuild} on ${receipt.runtime}: acceptance has not been executed. ` +
        `Live tests need scoped authorised provider test accounts, and fixture tests alone cannot pass it`
    }

  if (receipt.subjectRefs.length < 2)
    blockers.push(
      `acceptance needs two account subjects in one permitted scope and this receipt names ${receipt.subjectRefs.length}`
    )

  // THE SUBSTITUTION THE CARD NAMES FIRST. Fabric's own transcript proves what
  // Fabric wrote down. Showing it is not showing that the provider restored a
  // conversation, and it is the easiest thing to mistake for evidence.
  if (!independent.length)
    blockers.push(
      'no independent observation: reading Fabric\'s own transcript proves what Fabric recorded, not that the ' +
        'provider restored the conversation'
    )
  else if (!independent.every((o) => o.confirmed))
    blockers.push(
      `${independent.filter((o) => !o.confirmed).length} independent observation(s) did not come back as expected`
    )

  const present = new Set(receipt.negativeControls.map((c) => c.name))
  for (const required of REQUIRED_CONTROLS)
    if (!present.has(required)) blockers.push(`the negative control ${required} was not run`)

  // A CONTROL THAT PASSED IS A CONTROL THAT FAILED. Each of these is something
  // acceptance must refuse; `refused: false` means it got through.
  const gotThrough = receipt.negativeControls.filter((c) => !c.refused)
  for (const control of gotThrough)
    blockers.push(`${control.name} was NOT refused: ${control.says}`)

  if (blockers.length)
    return {
      outcome: gotThrough.length ? 'failed' : 'inconclusive',
      blockers,
      says: gotThrough.length
        ? `acceptance FAILED: ${gotThrough.length} thing(s) that must be refused were accepted`
        : `acceptance is inconclusive: ${blockers.length} piece(s) of evidence are missing`
    }

  return {
    outcome: 'passed',
    blockers: [],
    says:
      `${receipt.provider} ${receipt.cliBuild} on ${receipt.runtime} passed: ` +
      `${independent.length} independent observation(s) confirmed and ` +
      `${receipt.negativeControls.length} control(s) refused`
  }
}

/**
 * May a capability be marked `supported` from this receipt?
 *
 * The card's exit condition, as a function: only after a pass, and only for the
 * exact provider, build and runtime the receipt names. A pass on one build says
 * nothing about the next one.
 */
export function maySupport(
  receipt: AcceptanceReceipt,
  claim: { provider: string; cliBuild: string; runtime: string }
): { allowed: boolean; reason: string } {
  const verdict = judge(receipt)
  if (verdict.outcome !== 'passed')
    return { allowed: false, reason: `acceptance is ${verdict.outcome}: ${verdict.says}` }
  if (receipt.provider !== claim.provider || receipt.cliBuild !== claim.cliBuild)
    return {
      allowed: false,
      reason:
        `the receipt is for ${receipt.provider} ${receipt.cliBuild} and the claim is about ${claim.provider} ` +
        `${claim.cliBuild}. A capability of somebody else's program is a property of its version`
    }
  if (receipt.runtime !== claim.runtime)
    return {
      allowed: false,
      reason: `the receipt is from ${receipt.runtime} and the claim is about ${claim.runtime}`
    }
  return { allowed: true, reason: verdict.says }
}

/**
 * The plan, as data, so a granted certification is one command.
 *
 * Written down rather than described, because a plan in prose is re-derived by
 * whoever runs it and a plan as a list is executed.
 */
export const ACCEPTANCE_PLAN: readonly { step: string; needs: string; proves: string }[] = [
  {
    step: 'prepare a separate permitted test workspace and two account subjects in one permitted scope',
    needs: 'scoped authorised provider test accounts',
    proves: 'nothing yet — it is the precondition the card reserves'
  },
  {
    step: 'record provider, CLI build, operating system, runtime and the capability revision',
    needs: 'nothing',
    proves: 'which build any later claim is about'
  },
  {
    step: 'place a distinct marker in conversation A before any switch',
    needs: 'a live conversation',
    proves: 'that a resumed conversation is the same one, independently of Fabric\'s record'
  },
  {
    step: 'run A→B→A by hand, then a quota-triggered A→B with no second confirmation',
    needs: 'two accounts and an enrolled conversation',
    proves: 'the manual and the automatic path, separately'
  },
  {
    step: 'check the actual identity, the exact native reference, the pre-placed markers and the tool history',
    needs: 'the provider\'s own readers',
    proves: 'that the account changed AND the conversation continued'
  },
  {
    step: 'hold a second conversation on A throughout, with a pending draft and a spent budget',
    needs: 'a second conversation',
    proves: 'that one switch moves one conversation, loses no draft and resets no budget'
  },
  {
    step: 'repeat under crash, wrong identity, concurrent refresh, exhausted pool, stale usage, quarantine, disable-while-waiting and reconnect',
    needs: 'the ability to interrupt a run',
    proves: 'that each failure leaves an honest hold rather than a false success'
  },
  {
    step: 'keep the redacted receipts and the negative controls',
    needs: 'nothing',
    proves: 'that the run happened, without putting a credential in Git or a log'
  },
  {
    step: 'only then mark the capability supported, for that version and runtime alone',
    needs: 'a pass',
    proves: 'the measured boundary CO-112 may be closed by, and nothing wider'
  }
]

/** The receipt for a run that did not happen — the honest one, on this machine. */
export function notExecuted(input: {
  provider: string
  cliBuild: string
  runtime: string
  capabilityRevision: string
  at: string
  why: string
}): AcceptanceReceipt {
  return {
    provider: input.provider,
    cliBuild: input.cliBuild,
    runtime: input.runtime,
    capabilityRevision: input.capabilityRevision,
    subjectRefs: [],
    nativeRef: null,
    checkpointDigests: [],
    switchReceipts: [],
    independentObservations: [],
    negativeControls: [],
    outcome: 'not-executed',
    at: input.at
  }
}
