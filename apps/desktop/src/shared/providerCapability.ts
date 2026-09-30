/**
 * What a provider's installed CLI actually supports — measured, per build.
 *
 * M199.probe. The nine M199 children design account switching and conversation
 * continuity on top of Claude Code and Codex, and the card's instruction is
 * blunt about where those designs may get their facts: **do not report
 * `supported` from reading somebody else's README**, and "setting an environment
 * variable alone is not evidence" of Keychain isolation.
 *
 * So a capability is a RECORD with a status of three values and a reference to
 * the observation behind it. `unverified` is the default and it is not a
 * near-miss for `supported`: the design's own invariant is that an unverified
 * capability is never reported as successful continuation, which means the
 * difference between the two decides whether an operator is told their
 * conversation continued or told it did not.
 *
 * A receipt is pinned to a CLI BUILD. Capabilities of a program somebody else
 * ships are properties of a version, and an upgrade returns every row about it
 * to `unverified` rather than carrying yesterday's answer forward.
 */

/** The three answers, and the third is not a weak first. */
export type CapabilityStatus = 'supported' | 'unsupported' | 'unverified'

/**
 * The capabilities the M199 children need answered before they can be built.
 *
 * Enumerated rather than free text, because a matrix with a capability spelled
 * two ways has a hole exactly where somebody thought they had covered it.
 */
export type Capability =
  /** A machine-readable reader for the identity currently logged in. */
  | 'identity-read'
  /** A STABLE per-user subject in that reader — not an email, which the design
   *  forbids as identity, and not only an organisation. */
  | 'identity-subject'
  /** Pointing the config home elsewhere makes the identity reader answer for
   *  that home rather than for the machine's one login. */
  | 'login-isolation-by-home'
  /** The credential itself lives under that home, so two homes can hold two
   *  accounts. A shared system keychain item means they cannot. */
  | 'credential-store-per-home'
  /** Saved conversations live under that home. */
  | 'conversation-store-per-home'
  /** A conversation can be named by an opaque reference and resumed by it, and
   *  an unknown reference is refused rather than silently starting fresh. */
  | 'native-resume-by-id'
  /** The resumed session CONFIRMS that the saved context was restored. Without
   *  it a resume is a new conversation wearing an old name. */
  | 'native-resume-ack'
  /** The identity reader can report that an inherited environment variable has
   *  replaced the chosen account. Without it, cleaning the environment is a
   *  guess nobody can check — M199.auth. */
  | 'env-override-detector'

export interface ProviderCapabilityReceipt {
  /** The adapter's provider id, matching the launch options. */
  provider: string
  /** Exactly what was installed when this was observed. */
  cliBuild: string
  /** Where it ran. A capability of a host is not a capability of a distribution. */
  runtime: string
  capability: Capability
  status: CapabilityStatus
  /**
   * How it is known. A command and what it printed, a path and what was found
   * there, or — for `unverified` — the test that would settle it and why it has
   * not been run.
   */
  evidenceRef: string
  /** ISO date of the observation, so a stale matrix is visible as stale. */
  checkedAt: string
}

/** Everything wrong with a receipt, as sentences. Empty means it is well formed. */
export function receiptProblems(r: ProviderCapabilityReceipt): string[] {
  const problems: string[] = []
  if (!r.provider) problems.push('no provider')
  if (!r.cliBuild) problems.push('no CLI build: a capability without a version is a rumour')
  if (!r.runtime) problems.push('no runtime')
  if (!r.checkedAt || !/^\d{4}-\d{2}-\d{2}$/.test(r.checkedAt))
    problems.push('no observation date, so nobody can tell whether this is current')
  // The rule the card states in its own words: no `supported` from reading a
  // README. An evidence reference short enough to be a shrug is one.
  if (r.status === 'supported' && r.evidenceRef.trim().length < 24)
    problems.push('claims `supported` without naming what was observed')
  if (r.status === 'unsupported' && r.evidenceRef.trim().length < 24)
    problems.push('claims `unsupported` without naming what was observed — an absence somebody checked and one nobody looked for read identically')
  if (r.status === 'unverified' && !/\bwould\b|\bneeds\b|\brequires\b|certif/i.test(r.evidenceRef))
    problems.push('is `unverified` and does not name the test that would settle it')
  return problems
}

/**
 * May a conversation be reported to an operator as CONTINUED?
 *
 * Only with a supported ack. The design offers a separately labelled new
 * conversation with a reviewed handoff when it cannot prove native resume, and
 * says that fallback is never reported as successful continuation — so this
 * function is where that sentence becomes a branch instead of a paragraph.
 */
export function mayReportContinuation(
  receipts: readonly ProviderCapabilityReceipt[],
  provider: string,
  cliBuild: string
): { allowed: boolean; reason: string } {
  const ack = receipts.find(
    (r) => r.provider === provider && r.cliBuild === cliBuild && r.capability === 'native-resume-ack'
  )
  if (!ack)
    return {
      allowed: false,
      reason: `nothing has been observed about native resume for ${provider} ${cliBuild}, and an unmeasured capability is not a working one`
    }
  if (ack.status !== 'supported')
    return {
      allowed: false,
      reason: `native resume is ${ack.status} for ${provider} ${cliBuild}: ${ack.evidenceRef}`
    }
  return { allowed: true, reason: `native resume acknowledged: ${ack.evidenceRef}` }
}

/**
 * Does redirecting the config home give two accounts two credentials?
 *
 * Both halves are needed and they are separately observable, which is the trap
 * this answers: an identity reader that answers per home looks like isolation,
 * and if the secret is one keychain item per operating-system user then a second
 * login has one place to write — over the first.
 */
export function isolationByHome(
  receipts: readonly ProviderCapabilityReceipt[],
  provider: string,
  cliBuild: string
): { status: CapabilityStatus; reason: string } {
  const of = (capability: Capability): ProviderCapabilityReceipt | undefined =>
    receipts.find((r) => r.provider === provider && r.cliBuild === cliBuild && r.capability === capability)
  const reader = of('login-isolation-by-home')
  const store = of('credential-store-per-home')
  if (!reader || !store)
    return { status: 'unverified', reason: 'the reader, the store, or both have not been observed for this build' }
  if (store.status === 'unsupported')
    return {
      status: 'unsupported',
      reason: `the identity reader is ${reader.status} per home, and the credential is not: ${store.evidenceRef}`
    }
  if (reader.status === 'supported' && store.status === 'supported')
    return { status: 'supported', reason: `${reader.evidenceRef}; ${store.evidenceRef}` }
  return {
    status: 'unverified',
    reason: `reader ${reader.status}, credential store ${store.status} — one of the two is still unmeasured`
  }
}
