/**
 * Several logins on one device, without Fabric ever holding the credential.
 *
 * M199.accounts. The record is Fabric's own and it is LOCAL: a provider account
 * grants no membership, appears in no journal payload, and reaches no shared
 * read model. What Fabric keeps is the metadata needed to route a conversation
 * to the right login, plus an opaque reference to where the secret is — never
 * the secret.
 *
 * TWO THINGS M199.probe MEASURED SHAPE THIS FILE, and both of them make the
 * design smaller than it was written:
 *
 * 1. **No provider returns a stable per-user subject** (CO-141). `ProviderAccount`
 *    was specified as carrying a verified subject and detecting duplicates by
 *    `provider/subject/org/runtime`. `claude auth status --json` returns an
 *    organisation and an email — and the design forbids the email as identity —
 *    while `codex login status` returns one line and no fields at all. So the
 *    subject is nullable, what it is missing is NAMED as a confidence, and
 *    duplicate detection has a third answer: two accounts can be
 *    `indistinguishable`, which is not the same as being the same one.
 *
 * 2. **A second login is only stageable where the credential follows the home.**
 *    Codex keeps `auth.json` inside `CODEX_HOME`, so two homes are two accounts.
 *    Claude Code keeps one keychain item per operating-system user, so a second
 *    login writes over the first — over the operator's live session. Staging is
 *    refused there, with the measurement as the reason, rather than attempted
 *    and apologised for.
 */

import type { ProviderCapabilityReceipt } from './providerCapability.ts'
import { isolationByHome } from './providerCapability.ts'

/**
 * What the provider actually confirmed about who this is.
 *
 * Three values, because the difference between them decides whether a second
 * account may be added at all. A caller that treated `org-only` as `subject`
 * would merge two people in one organisation into one account record.
 */
export type IdentityConfidence =
  /** A stable per-user subject was read from a supported identity reader. */
  | 'subject'
  /** Only the organisation was confirmed. Two accounts inside it cannot be
   *  told apart by anything this design permits as identity. */
  | 'org-only'
  /** The provider confirmed nothing machine-readable. */
  | 'unconfirmed'

export interface AccountIdentity {
  provider: string
  /** Null on every provider measured on 2026-09-10 — see CO-141. */
  subject: string | null
  org: string | null
  /** A display label. NEVER identity, and never compared as one. */
  email: string | null
  /** Where the auth was acquired. A login on one host is not a login on another. */
  runtime: string
  /** The operating-system principal that owns it. */
  principal: string
}

export function confidenceOf(identity: AccountIdentity): IdentityConfidence {
  if (identity.subject) return 'subject'
  if (identity.org) return 'org-only'
  return 'unconfirmed'
}

export interface ProviderAccount {
  /** Opaque, generated here. Not derived from the email or the subject: an id
   *  that carries identity leaks it wherever the id travels. */
  accountId: string
  identity: AccountIdentity
  confidence: IdentityConfidence
  /**
   * WHERE the secret is, in the provider's own terms — a config-home path, a
   * keychain service name. Never the secret, and never a value that could be
   * exchanged for one without the operator's own keychain.
   */
  secretRef: string
  /** The operator's own words for it. */
  label: string
  addedAt: string
}

/** What a renderer, an IPC read model or a log may see. */
export interface AccountView {
  accountId: string
  provider: string
  org: string | null
  email: string | null
  runtime: string
  confidence: IdentityConfidence
  label: string
  addedAt: string
  isDefault: boolean
}

/**
 * The redacted view, and the ONLY way an account leaves this module.
 *
 * `secretRef` and `subject` are both dropped: the reference is the route to a
 * secret and the subject is the identity the provider verified, neither of
 * which a window needs to show a list of accounts.
 */
export function accountView(account: ProviderAccount, isDefault: boolean): AccountView {
  return {
    accountId: account.accountId,
    provider: account.identity.provider,
    org: account.identity.org,
    email: account.identity.email,
    runtime: account.identity.runtime,
    confidence: account.confidence,
    label: account.label,
    addedAt: account.addedAt,
    isDefault
  }
}

/** Everything about a view that should not have left. Empty means it is clean. */
export function viewLeaks(view: unknown): string[] {
  const text = JSON.stringify(view ?? null)
  const leaks: string[] = []
  if (/"secretRef"\s*:/.test(text)) leaks.push('the view carries a secret reference')
  // The KEY, not the word. `confidence` legitimately takes the VALUE "subject",
  // and a check that matched the word failed its own redacted view — found by
  // the probe before this shipped, which is the only reason it is not shipping.
  if (/"subject"\s*:/.test(text)) leaks.push('the view carries the provider subject')
  // Shapes a token takes in the two providers measured, plus the generic ones.
  for (const [what, re] of [
    ['an OAuth access token', /sk-ant-|"access_?token"/i],
    ['a bearer header', /bearer\s+[A-Za-z0-9._-]{16}/i],
    ['a private key block', /BEGIN [A-Z ]*PRIVATE KEY/]
  ] as const)
    if (re.test(text)) leaks.push(`the view carries ${what}`)
  return leaks
}

/**
 * Are these the same account?
 *
 * Three answers, and the third is the one CO-141 forces. `same` requires the
 * providers to agree on something verified. `different` requires evidence that
 * they differ. Without a subject, two accounts in one organisation on one
 * runtime are `indistinguishable` — and a login that cannot be told apart from
 * an existing one must not complete, because the alternative is silently
 * replacing somebody's account with somebody else's.
 */
export function compareIdentity(
  a: AccountIdentity,
  b: AccountIdentity
): 'same' | 'different' | 'indistinguishable' {
  if (a.provider !== b.provider) return 'different'
  if (a.runtime !== b.runtime || a.principal !== b.principal) return 'different'
  if (a.subject && b.subject) return a.subject === b.subject ? 'same' : 'different'
  // One side has a subject and the other does not: the one without it may be
  // the same person and nothing here can say so.
  if (a.subject || b.subject) return 'indistinguishable'
  if (a.org && b.org && a.org !== b.org) return 'different'
  return 'indistinguishable'
}

export interface StageVerdict {
  allowed: boolean
  reason: string
}

/**
 * May a second login be staged for this provider on this build?
 *
 * Read from the measured matrix, never from a provider's documentation. The
 * question is not whether the CLI has a login command — both do — but whether
 * running it can leave the existing login intact.
 */
export function mayStageLogin(
  matrix: readonly ProviderCapabilityReceipt[],
  provider: string,
  cliBuild: string,
  existingAccounts: number
): StageVerdict {
  const isolation = isolationByHome(matrix, provider, cliBuild)
  if (existingAccounts === 0)
    // The first login is the one the operator already has, or the ordinary CLI
    // flow. Nothing is at risk of being overwritten because there is nothing
    // there, and refusing it would make the feature unreachable on a provider
    // whose isolation is merely unproven.
    return {
      allowed: true,
      reason: `the first login for ${provider} cannot overwrite another; isolation is ${isolation.status}`
    }
  if (isolation.status === 'supported')
    return { allowed: true, reason: `credentials are isolated per home on ${provider} ${cliBuild}: ${isolation.reason}` }
  return {
    allowed: false,
    reason:
      `a second login for ${provider} ${cliBuild} would not be isolated (${isolation.status}): ${isolation.reason}. ` +
      `Running it would write over the login already there — the operator's live session. Add the account on a ` +
      `runtime where the credential follows the home, or wait for the capability to be certified.`
  }
}

export interface RemovalVerdict {
  allowed: boolean
  reason: string
  /** What has to be resolved first, for an interface to offer the next step. */
  blockedBy: readonly string[]
}

/**
 * May this account be removed from the LOCAL registry?
 *
 * Local removal is not a sign-out: the provider's own login and the saved
 * conversations survive it, which the design states and which this reflects by
 * saying so in the reason rather than doing anything about them.
 */
export function removalVerdict(input: {
  accountId: string
  boundConversations: readonly string[]
  isDefault: boolean
  otherAccounts: number
}): RemovalVerdict {
  const blockedBy: string[] = []
  if (input.boundConversations.length)
    blockedBy.push(
      `${input.boundConversations.length} conversation(s) are bound to it: ${input.boundConversations.slice(0, 3).join(', ')}`
    )
  // The default is refused only while there is something to move it to. A last
  // account that is also the default would otherwise be unremovable forever.
  if (input.isDefault && input.otherAccounts > 0)
    blockedBy.push('it is the default for future admissions — choose another default first')
  if (blockedBy.length)
    return {
      allowed: false,
      reason: `removing ${input.accountId} would leave work pointing at an account that is gone`,
      blockedBy
    }
  return {
    allowed: true,
    reason:
      'the local record is removed; the provider login and the saved conversations are untouched, and signing out ' +
      'of the provider is a separate act the operator performs with the provider',
    blockedBy: []
  }
}
