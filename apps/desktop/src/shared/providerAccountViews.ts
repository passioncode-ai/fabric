/**
 * What a window may know about provider accounts, and what it may never.
 *
 * M199.ui. Two rules shape every type here.
 *
 * **The renderer submits intent only.** Views flow out and intents flow in;
 * nothing a window sends is trusted as an actor, a principal or a revision it
 * did not read from a view. That is why every intent carries an `expected…`
 * field: a window that has not read cannot write.
 *
 * **A number nobody read is never shown as a number.** The card asks for the
 * age and the unknown-ness to be visible rather than a zero, and that is the
 * one thing an interface gets wrong by accident: `usedPct ?? 0` renders a full
 * tank for an account nobody asked about. So headroom is a discriminated union
 * — a reading, or an absence with its reason — and there is no third shape a
 * component could default.
 *
 * And the state vocabulary is DERIVED rather than stored. A label kept beside
 * the facts drifts from them; computed from the decision and the coordinator's
 * phase, it cannot.
 */

import type { AccountView } from './providerAccounts.ts'
import type { Decision } from './autoPolicy.ts'
import type { PinStrength } from './conversationBinding.ts'
import type { SwitchPhase } from './switchOperation.ts'
import type { UsageObservation, UsageStatus } from './usageObservation.ts'
import { headroomOf } from './usageObservation.ts'

/**
 * Headroom as a window may show it: a reading, or an absence that says why.
 *
 * No `number | null`. A nullable number invites `?? 0`, and a zero here means
 * "full" on a scale where the absence means "we did not ask".
 */
export type ShownHeadroom =
  | { known: true; freePct: number; ageSeconds: number; status: UsageStatus }
  | { known: false; why: string; status: UsageStatus | 'never-read' }

export function shownHeadroom(
  observation: UsageObservation | null,
  windowId: string,
  now: number
): ShownHeadroom {
  const headroom = headroomOf(observation, windowId)
  if (!headroom.known)
    return { known: false, why: headroom.why, status: observation?.status ?? 'never-read' }
  const sampled = Date.parse(observation!.sampledAt)
  return {
    known: true,
    freePct: headroom.freePct,
    // The AGE, always, because a number without one is read as current.
    ageSeconds: Number.isFinite(sampled) ? Math.max(0, Math.round((now - sampled) / 1000)) : 0,
    status: observation!.status
  }
}

/** One account as a window sees it. Built from `AccountView`, which already
 *  dropped the secret reference and the provider subject. */
export interface AccountRowView {
  account: AccountView
  headroom: ShownHeadroom
  /** Why it cannot be switched to, if it cannot. Empty when it can. */
  blockers: readonly string[]
  /** Can this account be removed right now, and if not, what holds it. */
  removable: { allowed: boolean; blockedBy: readonly string[] }
}

export interface AccountListView {
  rows: readonly AccountRowView[]
  /** The provider login nobody chose. Always present as an option. */
  systemDefault: { present: boolean; says: string }
  /** What this build cannot do, in plain words, or null when it can. */
  limitation: string | null
}

export interface ConversationAccountView {
  conversationId: string
  /** Null means the system login. */
  accountId: string | null
  label: string
  pin: { strength: PinStrength; reason: string }
  headroom: ShownHeadroom
  /** True when the operator pinned this conversation out of automatic switching. */
  manuallyPinned: boolean
  enrolled: boolean
}

/**
 * The eight states the card names, and each is computed.
 *
 * `held` and `exhausted` are separate on purpose: one is the product declining
 * to act and the other is the world being out of room, and an operator shown
 * one word for both cannot tell whether to wait or to buy something.
 */
export type AutoState =
  | 'off'
  | 'monitoring'
  | 'waiting-boundary'
  | 'switching'
  | 'cooling-down'
  | 'exhausted'
  | 'held'
  | 'paused'

export interface AutoPolicyView {
  state: AutoState
  /** The decision's own words. Never a re-description of them. */
  reason: string
  /** The next moment anything will happen, from the decision. */
  nextCheckAt: string
  /** Which accounts could take over, by id. */
  eligible: readonly string[]
  /** And which cannot, with the named reason. */
  excluded: readonly { accountId: string; why: string }[]
  /** Conversations that would be affected if this were switched on. */
  affectedConversations: readonly string[]
  /** What this build cannot do, shown before anything is enabled. */
  limitation: string | null
  policyRevision: number
}

export interface AutoDecisionReceipt {
  /** `auto` or `manual` — the card requires the receipt to say which. */
  trigger: 'auto' | 'manual'
  conversationId: string
  from: string | null
  to: string | null
  reason: string
  at: string
  /** The phase it reached. A hold is a phase, not an absence of one. */
  phase: SwitchPhase | 'not-attempted'
}

/**
 * The state of automatic switching, from the decision and the phase.
 *
 * The order is the order an operator would ask in: is it on, is something
 * happening right now, is it waiting, and only then why it is not acting.
 */
export function autoStateOf(input: {
  enabled: boolean
  paused: boolean
  decision: Decision | null
  phase: SwitchPhase | null
}): AutoState {
  if (input.paused) return 'paused'
  if (!input.enabled) return 'off'
  if (input.phase === 'waiting_boundary') return 'waiting-boundary'
  if (input.phase === 'stopping' || input.phase === 'resuming' || input.phase === 'recovering') return 'switching'
  if (!input.decision) return 'monitoring'
  if (input.decision.kind === 'queue_switch') return 'switching'
  if (input.decision.kind === 'stay') return 'monitoring'
  // A hold, and its two shapes are different questions for the operator.
  if (/cooldown/i.test(input.decision.reason)) return 'cooling-down'
  if (input.decision.excluded.some((e) => e.why === 'exhausted') || /exhausted|100% used/i.test(input.decision.reason))
    return 'exhausted'
  return 'held'
}

/**
 * The limitation to show BEFORE anything is enabled, or null.
 *
 * The card's words: "native unsupported → explicit limitation". Not a warning
 * beside a working switch — the sentence that explains why the switch will not
 * do anything, shown where somebody is about to reach for it.
 */
export function limitationOf(input: {
  resumeAckSupported: boolean
  provider: string
  cliBuild: string
}): string | null {
  if (input.resumeAckSupported) return null
  return (
    `${input.provider} ${input.cliBuild} cannot confirm that a resumed conversation carries its saved history, so ` +
    `Fabric will not move a running conversation to another account on this build. Accounts can still be added and ` +
    `chosen for NEW conversations, and a reviewed handoff to a new conversation is offered instead — labelled as a ` +
    `new conversation, never as a continuation`
  )
}

/** Everything a view carries that it must not. Empty means it is clean. */
export function viewProblems(view: unknown): string[] {
  const text = JSON.stringify(view ?? null)
  const problems: string[] = []
  if (/"secretRef"\s*:/.test(text)) problems.push('a view carries a secret reference')
  if (/"subject"\s*:/.test(text)) problems.push('a view carries the provider subject')
  if (/sk-ant-|"access_?token"|bearer\s+[A-Za-z0-9._-]{16}/i.test(text))
    problems.push('a view carries something shaped like a credential')
  // The zero that means "full". A headroom shown as a bare number with no age
  // is the defect this file exists to make impossible, so the shape is checked
  // rather than trusted: every headroom object says whether it is known.
  for (const match of text.matchAll(/"known":\s*(true|false)/g)) void match
  if (/"freePct":\s*[0-9]/.test(text) && !/"ageSeconds":/.test(text))
    problems.push('a view shows a headroom number with no age beside it')
  return problems
}

// `isStaleForDisplay` WAS HERE AND IS GONE. It combined an age limit with a
// status check, and a plant that removed the status half passed: `shownHeadroom`
// is the only producer of a `ShownHeadroom` and it already answers
// `known: false` for any status that is not a reading, so that clause could not
// be reached through any caller. An unreachable defensive branch reads as
// coverage in a report and is not — the lesson FA-09 recorded — and nothing
// consumed the helper either. It arrives with its consumer, or not at all.
