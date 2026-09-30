/**
 * Continuing allowed work without asking again — and why it cannot, here.
 *
 * M199.auto, ADR-0052. Turning this on is a single opt-in that authorises every
 * later switch: the point of the feature is that nobody is asked at three in the
 * morning. That makes it the sharpest instance of the operator's standing
 * priority — data preservation and a reliable launch BEFORE expanding autonomy —
 * because everything here runs while nobody is watching.
 *
 * SO THE FIRST THING THIS FILE DOES IS REFUSE. A candidate account needs a
 * VERIFIED resume, and M199.probe measured `native-resume-ack` as `unverified`
 * on Claude Code 2.1.236 and Codex 0.152.1. On this machine, today, no account
 * is eligible and every decision is `hold` with that reason. The engine is
 * built, deterministic and tested anyway: the day a build acknowledges a resume,
 * the rules that decide whether to act have already been written and watched
 * refusing the ways they can be wrong.
 *
 * THE ENGINE IS PURE. Given a policy, a set of readings and a clock, it returns
 * one decision and the same decision every time. Everything that can fail —
 * a lease, a persisted cooldown, a provider call — lives in the loop around it,
 * so the part that decides whether to move somebody's work is the part with
 * nothing to mock.
 */

import { headroomOf, isReading, type UsageObservation } from './usageObservation.ts'

export type Strategy =
  /** Move to the account with the most headroom. */
  | 'best'
  /**
   * Move to the account whose weekly window resets SOONEST, spending what is
   * about to be refilled anyway. It may switch BEFORE the threshold, which
   * `best` never does — the only case where the two strategies disagree about
   * whether to act at all rather than about where to go.
   */
  | 'consume-first'

export interface AutoPolicy {
  policyId: string
  revision: number
  enabled: boolean
  scope: { provider: string; runtime: string; projectId: string | null }
  /** Explicit. An empty allowlist with `enabled` is a policy that authorises
   *  nothing, and saying so beats silently meaning every account. */
  accountAllowlist: readonly string[]
  strategy: Strategy
  /** Used-percentage at which `best` starts looking for somewhere to go. */
  thresholdPct: number
  /** Which windows count. An empty list means the five-hour window alone. */
  modelWindows: readonly string[]
  cooldownSeconds: number
  /** How much better a candidate must be before moving. Without it, two
   *  readings either side of the threshold move the work back and forth. */
  hysteresisPct: number
  maxSwitchesPerHour: number
  /** The budget a switch must not reset. */
  enclosingBudgetRef: string | null
}

/**
 * The proposed defaults, and they are PROPOSED.
 *
 * The card's own words: "Editable, explicit and finite; evidence for cswap
 * defaults is in the source comparison." So these are a starting point somebody
 * chose, not a measurement — and the one relationship between them that IS
 * arithmetic is stated rather than left to be noticed: twelve switches an hour
 * is exactly 3600 divided by a 300-second cooldown, so the two numbers describe
 * one limit from two directions and a policy where they disagree has a cap that
 * can never be reached or a cooldown that can never bind.
 */
export const AUTO_DEFAULTS = {
  strategy: 'best' as Strategy,
  thresholdPct: 90,
  pollSeconds: 60,
  cooldownSeconds: 300,
  hysteresisPct: 10,
  maxSwitchesPerHour: 12
} as const

/** Everything wrong with a policy, as sentences. Empty means it is usable. */
export function policyProblems(policy: AutoPolicy): string[] {
  const problems: string[] = []
  if (policy.thresholdPct <= 0 || policy.thresholdPct > 100)
    problems.push(`the threshold is ${policy.thresholdPct}% and must be above 0 and at most 100`)
  if (policy.hysteresisPct < 0 || policy.hysteresisPct >= 100)
    problems.push(`the hysteresis is ${policy.hysteresisPct} percentage points and must be at least 0 and under 100`)
  if (policy.cooldownSeconds <= 0) problems.push('the cooldown must be a positive number of seconds')
  if (policy.maxSwitchesPerHour <= 0) problems.push('the hourly cap must allow at least one switch, or the policy is off')
  // The arithmetic the defaults state. A cap looser than the cooldown allows is
  // unreachable; a tighter one is the real limit and the cooldown is decoration.
  const allowedByCooldown = Math.floor(3600 / policy.cooldownSeconds)
  if (policy.maxSwitchesPerHour > allowedByCooldown)
    problems.push(
      `the cap allows ${policy.maxSwitchesPerHour} switches an hour and a ${policy.cooldownSeconds}-second cooldown ` +
        `allows ${allowedByCooldown}: the cap can never be reached, so it is not a limit`
    )
  if (policy.enabled && policy.accountAllowlist.length === 0)
    problems.push('the policy is enabled and its account allowlist is empty, so it authorises nothing')
  return problems
}

/** Why an account is not a candidate. Named, so an interface can show it. */
export type Exclusion =
  | 'not-allowlisted'
  | 'manually-pinned'
  | 'foreign-scope'
  | 'usage-unknown'
  | 'usage-stale'
  | 'resume-unverified'
  | 'quarantined'
  | 'exhausted'
  | 'is-current'
  | 'requires-explicit-admission'

export interface Candidate {
  accountId: string
  observation: UsageObservation | null
  /** The reading's window this policy cares about. */
  windowId: string
  /** From the capability matrix, per build. Never assumed. */
  resumeVerified: boolean
  /** Billed or API-key accounts need their own admission (ADR-0052). */
  requiresExplicitAdmission: boolean
  quarantined: boolean
  manuallyPinned: boolean
  sameScope: boolean
  /** When this account's weekly window resets, for `consume-first`. */
  weeklyResetAt: string | null
}

export interface Decision {
  kind: 'stay' | 'queue_switch' | 'hold'
  reason: string
  from: string | null
  to?: string
  observationRefs: readonly string[]
  policyRevision: number
  nextCheckAt: string
  eligible: readonly string[]
  excluded: readonly { accountId: string; why: Exclusion }[]
}

export interface DecideInput {
  policy: AutoPolicy
  /** The conversation's current account, or null for the system login. */
  from: string | null
  /** The current account's own reading. */
  current: UsageObservation | null
  candidates: readonly Candidate[]
  /** Switches already made inside the trailing hour. */
  switchesThisHour: number
  /** When the last switch for this conversation happened, or null. */
  lastSwitchAt: number | null
  /** Has the operator enrolled this conversation? Enrolment is per conversation. */
  enrolled: boolean
  now: number
}

const at = (ms: number): string => new Date(ms).toISOString()

/**
 * The one decision, and the same one every time.
 *
 * Order matters and it is not arbitrary: the cheapest and most absolute
 * refusals come first, so a disabled policy never reads a usage number and a
 * conversation nobody enrolled is never considered. Every path returns
 * `nextCheckAt`, because a decision with no next moment is a loop that stops.
 */
export function decide(input: DecideInput): Decision {
  const { policy, now } = input
  const base = {
    from: input.from,
    policyRevision: policy.revision,
    observationRefs: [input.current?.sampledAt, ...input.candidates.map((c) => c.observation?.sampledAt)].filter(
      (x): x is string => typeof x === 'string'
    ),
    eligible: [] as string[],
    excluded: [] as { accountId: string; why: Exclusion }[]
  }
  const soon = at(now + AUTO_DEFAULTS.pollSeconds * 1000)

  const problems = policyProblems(policy)
  if (problems.length)
    return { ...base, kind: 'hold', reason: `the policy is not usable: ${problems.join('; ')}`, nextCheckAt: soon }
  if (!policy.enabled)
    return { ...base, kind: 'stay', reason: 'automatic switching is off', nextCheckAt: soon }
  if (!input.enrolled)
    return {
      ...base,
      kind: 'stay',
      reason: 'this conversation is not enrolled; enrolment is per conversation and turning the policy on does not enrol one',
      nextCheckAt: soon
    }

  // THE HARD CAP, and it binds before anything else is considered — including
  // at 100% used. A cap that yielded to an exhausted account would be a cap
  // that stops working exactly when it is needed.
  if (input.switchesThisHour >= policy.maxSwitchesPerHour)
    return {
      ...base,
      kind: 'hold',
      reason:
        `${input.switchesThisHour} switch(es) in the trailing hour and the cap is ${policy.maxSwitchesPerHour}. ` +
        `The cap holds at 100% used as well: a limit that gives way when it matters is not one`,
      nextCheckAt: at(now + 60_000)
    }

  if (input.lastSwitchAt !== null && now - input.lastSwitchAt < policy.cooldownSeconds * 1000) {
    const waited = Math.round((now - input.lastSwitchAt) / 1000)
    return {
      ...base,
      kind: 'hold',
      reason: `${waited}s since the last switch and the cooldown is ${policy.cooldownSeconds}s`,
      nextCheckAt: at(input.lastSwitchAt + policy.cooldownSeconds * 1000)
    }
  }

  const windowId = policy.modelWindows[0] ?? 'five-hour'
  const currentHeadroom = headroomOf(input.current, windowId)

  // UNKNOWN IS NOT A REASON TO MOVE. The card is explicit: unknown usage does
  // not permit a blind fallback. A reading nobody took cannot say the current
  // account is short, and moving on it would be acting on an absence.
  if (!currentHeadroom.known)
    return {
      ...base,
      kind: 'hold',
      reason: `the current account's ${windowId} is not known: ${currentHeadroom.why}. Unknown is not a reason to move`,
      nextCheckAt: soon
    }

  const eligible: { candidate: Candidate; freePct: number }[] = []
  for (const candidate of input.candidates) {
    const why = exclusionFor(candidate, input, windowId)
    if (why) {
      base.excluded.push({ accountId: candidate.accountId, why })
      continue
    }
    const headroom = headroomOf(candidate.observation, windowId)
    // `exclusionFor` has already established this is a reading with headroom.
    if (!headroom.known) {
      base.excluded.push({ accountId: candidate.accountId, why: 'usage-unknown' })
      continue
    }
    eligible.push({ candidate, freePct: headroom.freePct })
  }
  base.eligible = eligible.map((e) => e.candidate.accountId)

  const usedPct = 100 - currentHeadroom.freePct
  const overThreshold = usedPct >= policy.thresholdPct

  if (!eligible.length) {
    if (overThreshold)
      return {
        ...base,
        kind: 'hold',
        reason:
          `${usedPct}% of ${windowId} is used and no account is eligible ` +
          `(${base.excluded.map((e) => `${e.accountId}: ${e.why}`).join(', ') || 'there are none'}). ` +
          `Dispatch pauses rather than continuing on an account that cannot serve it`,
        nextCheckAt: soon
      }
    return { ...base, kind: 'stay', reason: `${usedPct}% used, below the ${policy.thresholdPct}% threshold`, nextCheckAt: soon }
  }

  if (policy.strategy === 'consume-first') {
    // The one case where the strategies disagree about whether to act at all:
    // a candidate whose weekly window resets sooner is worth moving to BEFORE
    // the threshold, because what it spends is about to be refilled anyway.
    // A missing or stale reset timestamp does not permit it — the card says so,
    // and without a confirmed reset there is nothing to be early about.
    const withReset = eligible
      .filter((e) => e.candidate.weeklyResetAt !== null && e.freePct >= policy.hysteresisPct)
      .sort((a, b) => String(a.candidate.weeklyResetAt).localeCompare(String(b.candidate.weeklyResetAt)))
    if (withReset.length) {
      const pick = withReset[0]
      return {
        ...base,
        kind: 'queue_switch',
        to: pick.candidate.accountId,
        reason:
          `consume-first: ${pick.candidate.accountId} resets at ${pick.candidate.weeklyResetAt} with ` +
          `${pick.freePct}% free, so spending it first costs nothing that was not about to be refilled`,
        nextCheckAt: soon
      }
    }
    if (!overThreshold)
      return {
        ...base,
        kind: 'stay',
        reason:
          `consume-first found no candidate with a confirmed weekly reset and enough headroom, and ${usedPct}% is ` +
          `below the ${policy.thresholdPct}% threshold. A missing or stale reset does not permit moving early`,
        nextCheckAt: soon
      }
  }

  if (!overThreshold)
    return {
      ...base,
      kind: 'stay',
      reason: `${usedPct}% used, below the ${policy.thresholdPct}% threshold`,
      nextCheckAt: soon
    }

  // HYSTERESIS. Two readings either side of the threshold would otherwise move
  // the work back and forth: 89% stays, 91% switches, 89% switches back. The
  // candidate has to be better by a margin, not merely better.
  const best = eligible.reduce((a, b) => (b.freePct > a.freePct ? b : a))
  const gain = best.freePct - currentHeadroom.freePct
  if (gain < policy.hysteresisPct)
    return {
      ...base,
      kind: 'hold',
      reason:
        `${usedPct}% used and the best candidate offers ${gain} percentage point(s) more headroom, under the ` +
        `${policy.hysteresisPct}-point margin. Moving on less than that is how two readings either side of the ` +
        `threshold send the work back and forth`,
      nextCheckAt: soon
    }

  return {
    ...base,
    kind: 'queue_switch',
    to: best.candidate.accountId,
    reason:
      `${usedPct}% of ${windowId} is used, over the ${policy.thresholdPct}% threshold, and ` +
      `${best.candidate.accountId} has ${best.freePct}% free — ${gain} points better`,
    nextCheckAt: soon
  }
}

/**
 * Why this account is not a candidate, or null if it is one.
 *
 * ORDER IS A PRODUCT DECISION here too: the most specific reason wins, so an
 * operator who pinned a conversation is told about the pin rather than about a
 * stale reading they did not cause.
 */
function exclusionFor(candidate: Candidate, input: DecideInput, windowId: string): Exclusion | null {
  if (candidate.accountId === input.from) return 'is-current'
  if (candidate.manuallyPinned) return 'manually-pinned'
  if (!input.policy.accountAllowlist.includes(candidate.accountId)) return 'not-allowlisted'
  if (!candidate.sameScope) return 'foreign-scope'
  if (candidate.quarantined) return 'quarantined'
  if (candidate.requiresExplicitAdmission) return 'requires-explicit-admission'
  // A resume nobody can confirm is not a place to move work to. On both
  // installed builds this is the branch every candidate falls into.
  if (!candidate.resumeVerified) return 'resume-unverified'
  if (!candidate.observation) return 'usage-unknown'
  if (candidate.observation.status === 'stale') return 'usage-stale'
  if (!isReading(candidate.observation.status)) return 'usage-unknown'
  const headroom = headroomOf(candidate.observation, windowId)
  if (!headroom.known) return 'usage-unknown'
  if (headroom.freePct <= 0) return 'exhausted'
  return null
}
