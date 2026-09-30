/**
 * Which credential a session will actually use, and whether Fabric can tell.
 *
 * M199.auth. The card's failure case is exact: "an inherited API key must not
 * bypass the chosen subscription account". MEASURED on Claude Code 2.1.236,
 * against `claude auth status --json`, which is the provider's own reader:
 *
 * | in the environment            | what the reader then says                    |
 * |-------------------------------|----------------------------------------------|
 * | `ANTHROPIC_API_KEY=<value>`   | `apiKeySource` appears; email, org and        |
 * |                               | subscription ALL become null                  |
 * | `ANTHROPIC_API_KEY=` (empty)  | nothing — an empty value is ignored           |
 * | `ANTHROPIC_AUTH_TOKEN=<value>`| `authMethod` becomes `oauth_token`; identity  |
 * |                               | null; `apiKeySource` stays null               |
 * | `CLAUDE_CODE_USE_BEDROCK=1`   | `authMethod` becomes `third_party`; null      |
 * | `CLAUDE_CODE_USE_VERTEX=1`    | `authMethod` becomes `third_party`; null      |
 * | `ANTHROPIC_BASE_URL=…`        | no change to identity                         |
 * | `ANTHROPIC_CUSTOM_HEADERS=…`  | no change to identity                         |
 *
 * Four override and three do not, so a cleaner built from a guess at the list
 * would either strip things an agent legitimately needs or miss one. And the
 * DETECTORS differ: `apiKeySource` catches exactly one of the four, while
 * `authMethod` catches three — a resolver watching only the obvious field
 * misses `ANTHROPIC_AUTH_TOKEN` entirely.
 *
 * Codex 0.152.1 has NO detector. `codex login status` answers "Logged in using
 * ChatGPT" with `OPENAI_API_KEY` set, unset, or anything else, so Fabric cannot
 * observe which credential a Codex session will use. That is not a claim that
 * the key wins; it is the absence of any way to find out — and by the design's
 * own invariant an unverified capability is never reported as success. So a
 * Codex context is `cleaned-unverified`, never `verified`.
 *
 * THE RULE THAT FALLS OUT: clean, then READ BACK. Cleaning a list is a guess
 * about the list; reading the identity back and comparing it to the one chosen
 * is a measurement. Where the readback disagrees, or where there is no reader
 * to disagree with, the operation is BLOCKED rather than attempted.
 */

/** What an environment variable does to the resolved identity. */
export interface AuthOverride {
  variable: string
  /** In the provider's own terms, from the reader's output. */
  effect: string
  /** Which field of the identity reader exposes it, or null if none does. */
  detector: 'apiKeySource' | 'authMethod' | null
}

/**
 * The variables measured to override a chosen account, per provider.
 *
 * Only the ones OBSERVED to change the resolved identity are here. A variable
 * that changes where requests go without changing who they are from — a base
 * URL, custom headers — is not an authority question and stripping it would be
 * a denylist growing without a reason, which `sessionEnv.ts` already warns
 * about in its own words.
 */
export const AUTH_OVERRIDES: Readonly<Record<string, readonly AuthOverride[]>> = {
  'claude-code': [
    {
      variable: 'ANTHROPIC_API_KEY',
      effect: 'the reader reports apiKeySource and drops email, org and subscription to null',
      detector: 'apiKeySource'
    },
    {
      variable: 'ANTHROPIC_AUTH_TOKEN',
      effect: 'authMethod becomes oauth_token and the identity goes null, with apiKeySource still null',
      detector: 'authMethod'
    },
    {
      variable: 'CLAUDE_CODE_USE_BEDROCK',
      effect: 'authMethod becomes third_party and the identity goes null',
      detector: 'authMethod'
    },
    {
      variable: 'CLAUDE_CODE_USE_VERTEX',
      effect: 'authMethod becomes third_party and the identity goes null',
      detector: 'authMethod'
    }
  ],
  'codex-cli': [
    {
      variable: 'OPENAI_API_KEY',
      effect: 'unknown: `codex login status` answers the same with it set and unset, so nothing can be observed',
      detector: null
    },
    {
      variable: 'CODEX_API_KEY',
      effect: 'unknown, for the same reason',
      detector: null
    }
  ]
}

/**
 * The overrides actually present in an environment.
 *
 * An EMPTY value is not present: `ANTHROPIC_API_KEY=` was measured to change
 * nothing, and treating it as an override would block a session over a variable
 * the provider ignores.
 */
export function overridesPresent(
  provider: string,
  env: Readonly<Record<string, string | undefined>>
): readonly AuthOverride[] {
  return (AUTH_OVERRIDES[provider] ?? []).filter((o) => {
    const value = env[o.variable]
    return typeof value === 'string' && value.length > 0
  })
}

/** The environment with this provider's overrides removed. */
export function withoutOverrides(
  provider: string,
  env: Readonly<Record<string, string | undefined>>
): Record<string, string> {
  const strip = new Set((AUTH_OVERRIDES[provider] ?? []).map((o) => o.variable))
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) continue
    if (strip.has(k)) continue
    out[k] = v
  }
  return out
}

/** Can this provider's reader report that an override is in force? */
export function hasOverrideDetector(provider: string): boolean {
  return (AUTH_OVERRIDES[provider] ?? []).some((o) => o.detector !== null)
}

/** What the provider's identity reader answered. Fields absent on a provider
 *  whose reader does not carry them, which is most of them for Codex. */
export interface ObservedIdentity {
  loggedIn: boolean
  authMethod: string | null
  apiKeySource: string | null
  subject: string | null
  org: string | null
}

/** What the operator chose, from the local account register. */
export interface ChosenIdentity {
  provider: string
  subject: string | null
  org: string | null
}

/**
 * Does the identity the provider resolved match the one chosen?
 *
 * Compared on what the provider VERIFIED — a subject where there is one, an
 * organisation otherwise — and never on the email, which the design forbids as
 * identity. Returns a third answer for the case that is normal rather than
 * exceptional: nothing comparable was returned, so nothing can be concluded.
 */
export function identityAgrees(
  chosen: ChosenIdentity,
  observed: ObservedIdentity
): 'agrees' | 'disagrees' | 'unknowable' {
  if (!observed.loggedIn) return 'disagrees'
  if (chosen.subject && observed.subject) return chosen.subject === observed.subject ? 'agrees' : 'disagrees'
  if (chosen.org && observed.org) return chosen.org === observed.org ? 'agrees' : 'disagrees'
  // THE CHOSEN SIDE HAD SOMETHING AND THE OBSERVED SIDE RETURNED NOTHING.
  //
  // This branch first answered `unknowable`, and three assertions failed on it
  // at once. It is not an absence of information: the chosen account carries an
  // organisation, the reader carries none, and the measured way that happens is
  // an override in force — apiKeySource, oauth_token or third_party, each of
  // which drops the identity to null. Reporting that as "we could not check"
  // when the truth is "we checked and it is somebody else" is exactly the
  // substitution this card exists to refuse.
  if (chosen.subject || chosen.org) return 'disagrees'
  // Neither side has anything comparable. Nothing can be concluded, and CO-141
  // records why that is the normal case rather than an unusual one.
  return 'unknowable'
}

export type AuthContextStatus =
  /** The environment was cleaned AND the reader confirmed the chosen identity. */
  | 'verified'
  /** Cleaned, and there is no way to confirm what the session will use. */
  | 'cleaned-unverified'
  /** Something is wrong that a clean does not fix. Nothing is launched. */
  | 'blocked'

export interface AuthVerdict {
  status: AuthContextStatus
  reason: string
  /** Which overrides were removed, for a receipt the operator can read. */
  removed: readonly string[]
}

/**
 * The verdict on one resolution attempt.
 *
 * `blocked` is the important value and it has three causes, each of which a
 * clean cannot fix: the reader says the identity is somebody else's; an
 * override the reader can see is STILL in force after cleaning, which means
 * something outside this process is putting it there; or the account belongs
 * to another runtime, where this process has no business resolving anything.
 */
export function authVerdict(input: {
  chosen: ChosenIdentity
  accountRuntime: string
  thisRuntime: string
  observed: ObservedIdentity | null
  removed: readonly string[]
  /** Overrides still present in the environment handed to the reader. */
  remaining: readonly AuthOverride[]
}): AuthVerdict {
  const { chosen, observed, removed } = input

  if (input.accountRuntime !== input.thisRuntime)
    return {
      status: 'blocked',
      removed,
      reason:
        `the account was authorised on ${input.accountRuntime} and this is ${input.thisRuntime}. Auth is acquired on a ` +
        `runtime and does not travel: resolving it here would either use the wrong credential or silently make a new one`
    }

  const detectable = input.remaining.filter((o) => o.detector !== null)
  if (detectable.length)
    return {
      status: 'blocked',
      removed,
      reason:
        `${detectable.map((o) => o.variable).join(', ')} is still in the environment after cleaning, so something ` +
        `outside this process is setting it. An external writer to the credential path blocks a managed operation ` +
        `rather than racing it`
    }

  if (!observed)
    return {
      status: 'cleaned-unverified',
      removed,
      reason:
        `${chosen.provider} has no reader that can say which credential a session will use, so the environment was ` +
        `cleaned and nothing was confirmed. This is never reported as a verified continuation`
    }

  const agreement = identityAgrees(chosen, observed)
  if (agreement === 'disagrees')
    return {
      status: 'blocked',
      removed,
      reason:
        `the provider resolved a different identity than the one chosen` +
        (observed.apiKeySource ? ` (${observed.apiKeySource} is in force)` : '') +
        (observed.authMethod ? `, authMethod ${observed.authMethod}` : '') +
        `. Launching would run the work as somebody else`
    }
  if (agreement === 'unknowable')
    return {
      status: 'cleaned-unverified',
      removed,
      reason:
        `the reader returned nothing comparable — no subject and no organisation — so the environment was cleaned and ` +
        `the identity is not confirmed. CO-141 records why no subject is available`
    }
  return {
    status: 'verified',
    removed,
    reason: `the provider's own reader confirms the chosen identity${observed.org ? ` in ${observed.org}` : ''}`
  }
}

/** May work be launched under this verdict? Only a verified one, and the
 *  design's invariant is what says so rather than a preference. */
export function mayLaunch(verdict: AuthVerdict): boolean {
  return verdict.status === 'verified'
}
