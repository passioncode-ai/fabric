/**
 * Which account a conversation runs on, and what a binding may promise.
 *
 * M199.binding. Two changes are being separated that look alike and are not:
 * changing the DEFAULT for future work, and changing the account a conversation
 * already running is using. The first must leave every live conversation
 * exactly where it is; the second is a different operation with a different
 * receipt, and M199.resume owns it.
 *
 * WHAT M199.probe MEASURED DECIDES WHAT A BINDING MAY PROMISE. A binding pins an
 * account only where the credential follows the config home — Codex, whose
 * `auth.json` lives inside `CODEX_HOME`. On Claude Code the credential is one
 * keychain item per operating-system user, so the login can change under a
 * running conversation and no record here can stop it. The design's own
 * instruction for that case is to SHOW THE DRIFT rather than promise pinning,
 * which is why `PinStrength` has two values and the weaker one carries its
 * reason.
 *
 * The resolution order is fixed and resolved ONCE, at admission: an explicit
 * choice for this run, then the project's binding, then the provider's default,
 * then the system login. Resolving it again later would let a default change
 * reach a conversation that had already started — the first failure case.
 */

import { isolationByHome, type ProviderCapabilityReceipt } from './providerCapability.ts'

export interface ConversationBinding {
  conversationId: string
  projectId: string
  provider: string
  /** The provider's own opaque handle for the saved conversation. Local. */
  nativeRef: string | null
  /** Null means the system login — which is exactly the case that cannot be pinned. */
  accountId: string | null
  authRevision: number
  runtime: string
  /** What the work was pointed at. A binding is not portable across it. */
  workspaceFingerprint: string
  /** Bumped by every accepted write. The token a caller compares against. */
  bindingRevision: number
  /** A restart makes a new Session, and a callback from the old one is late. */
  sessionGeneration: number
}

/** Where the account came from, so a receipt can say which rule applied. */
export type AccountSource = 'explicit' | 'project' | 'default' | 'system'

export interface Resolved {
  accountId: string | null
  source: AccountSource
  says: string
}

/**
 * The four steps, in order, resolved once.
 *
 * `null` at the end is not a failure: the system login is a legitimate answer
 * and the product works with no account chosen at all. What it is not is a
 * PINNABLE answer — see `pinStrength`.
 */
export function resolveAccount(input: {
  explicit?: string | null
  projectBinding?: string | null
  providerDefault?: string | null
}): Resolved {
  if (input.explicit)
    return { accountId: input.explicit, source: 'explicit', says: 'the operator chose this account for this run' }
  if (input.projectBinding)
    return { accountId: input.projectBinding, source: 'project', says: 'the project names this account' }
  if (input.providerDefault)
    return { accountId: input.providerDefault, source: 'default', says: 'the provider default at the moment of admission' }
  return {
    accountId: null,
    source: 'system',
    says: 'the login the provider already had — no account was chosen, which is a valid state'
  }
}

export type PinStrength = 'pinned' | 'drifting'

export interface PinVerdict {
  strength: PinStrength
  reason: string
}

/**
 * Can this binding promise that the conversation keeps using this account?
 *
 * Only where the credential follows the config home. The system login never
 * can: it is whatever the provider's own store holds, and on Claude Code that
 * is one keychain item per operating-system user which anything on the machine
 * may replace. Saying `pinned` there would be promising something no record
 * can deliver, and the design says to show the drift instead.
 */
export function pinStrength(input: {
  matrix: readonly ProviderCapabilityReceipt[]
  provider: string
  cliBuild: string
  accountId: string | null
}): PinVerdict {
  if (!input.accountId)
    return {
      strength: 'drifting',
      reason:
        'this conversation uses the login the provider already had. Nothing here owns it, so it can change under the ' +
        'conversation and the change will be shown rather than prevented'
    }
  const isolation = isolationByHome(input.matrix, input.provider, input.cliBuild)
  if (isolation.status === 'supported')
    return { strength: 'pinned', reason: `the credential follows the home on ${input.provider} ${input.cliBuild}` }
  return {
    strength: 'drifting',
    reason:
      `${input.provider} ${input.cliBuild} keeps its credential where this binding cannot own it ` +
      `(${isolation.status}): ${isolation.reason}. The account is recorded and the drift is shown; it is not pinned`
  }
}

export type WriteRefusal =
  | 'stale-revision'
  | 'old-generation'
  | 'foreign-project'
  | 'foreign-workspace'
  | 'foreign-runtime'

export interface WriteVerdict {
  allowed: boolean
  refusal?: WriteRefusal
  reason: string
}

/**
 * May this caller write to this binding?
 *
 * ONE WRITER, and the four refusals are the card's own failure cases. The
 * generation check is the one that is easy to leave out and hardest to notice
 * missing: a session that has been replaced still has callbacks in flight, and
 * a late one carries a true statement about a process nobody is watching any
 * more.
 */
export function mayWrite(
  binding: ConversationBinding,
  caller: {
    expectedRevision: number
    sessionGeneration: number
    projectId: string
    workspaceFingerprint: string
    runtime: string
  }
): WriteVerdict {
  if (caller.projectId !== binding.projectId)
    return {
      allowed: false,
      refusal: 'foreign-project',
      reason: `this binding belongs to project ${binding.projectId} and the caller named ${caller.projectId}`
    }
  if (caller.runtime !== binding.runtime)
    return {
      allowed: false,
      refusal: 'foreign-runtime',
      reason: `the conversation was admitted on ${binding.runtime} and the caller is on ${caller.runtime}`
    }
  if (caller.workspaceFingerprint !== binding.workspaceFingerprint)
    return {
      allowed: false,
      refusal: 'foreign-workspace',
      reason:
        'the workspace this conversation was pointed at has changed. A binding is not portable across it: the saved ' +
        'conversation refers to files that are no longer the ones in front of it'
    }
  if (caller.sessionGeneration < binding.sessionGeneration)
    return {
      allowed: false,
      refusal: 'old-generation',
      reason:
        `generation ${caller.sessionGeneration} is behind ${binding.sessionGeneration}: this callback is from a ` +
        `session that has already been replaced, and what it says is true about a process nobody is watching`
    }
  if (caller.expectedRevision !== binding.bindingRevision)
    return {
      allowed: false,
      refusal: 'stale-revision',
      reason: `the caller expected revision ${caller.expectedRevision} and the binding holds ${binding.bindingRevision}`
    }
  return { allowed: true, reason: 'one writer, at the revision it read' }
}

export interface Drift {
  drifted: boolean
  reason: string
}

/**
 * Has the account this conversation was admitted with changed underneath it?
 *
 * Compared on the AUTH REVISION rather than the account id, because the id can
 * stay the same across a re-authentication that changed the plan, the
 * organisation or the subject — and the conversation would be running on
 * something else while the record still looked right.
 */
export function driftOf(binding: ConversationBinding, observedAuthRevision: number | null): Drift {
  if (observedAuthRevision === null)
    return {
      drifted: false,
      reason: 'the current auth revision could not be read, which is not the same as it having changed'
    }
  if (observedAuthRevision === binding.authRevision)
    return { drifted: false, reason: `still auth revision ${binding.authRevision}` }
  return {
    drifted: true,
    reason:
      `admitted at auth revision ${binding.authRevision} and the store now holds ${observedAuthRevision}. The ` +
      `credential was replaced under this conversation: the plan, the organisation or the subject may all differ`
  }
}

/**
 * May a dispatch proceed against this binding?
 *
 * The card's second failure case, and the reason it is separate from
 * `mayWrite`: a revision that moved between the READ and the SPAWN is not a
 * conflicting writer, it is the ground moving. Nothing is written and nothing
 * is launched.
 */
export function mayDispatch(input: {
  binding: ConversationBinding
  observedAuthRevision: number | null
}): { allowed: boolean; reason: string } {
  const drift = driftOf(input.binding, input.observedAuthRevision)
  if (drift.drifted)
    return {
      allowed: false,
      reason: `${drift.reason}. The dispatch stops rather than starting work under a credential nobody chose`
    }
  if (input.observedAuthRevision === null)
    return {
      allowed: false,
      reason:
        'the current auth revision could not be read, so whether this conversation still runs on the account it was ' +
        'admitted with is unknown — and unknown is not permission'
    }
  return { allowed: true, reason: drift.reason }
}
