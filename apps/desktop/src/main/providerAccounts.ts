/**
 * The local account registry, and the login that stages beside the live one.
 *
 * M199.accounts. Built on `localState` rather than beside it: a file that will
 * not parse is quarantined instead of overwritten, a write says whether it
 * committed or conflicted, and the revision is the token `setDefault` and
 * `removeLocal` compare against. Those were bought once, in S14, and buying
 * them again here would be buying a second version of them.
 *
 * NOT IN THE JOURNAL, deliberately. A provider account grants no Fabric
 * membership and belongs to one device, so putting it in the estate's event log
 * would replicate a device-local fact to every window and every replica of the
 * estate. The register a person reads is the account list; the register the
 * estate reads is the journal, and this is not in it.
 *
 * The trusted-owner seam the card asks for is the module boundary: every
 * function here takes the principal as an argument and none reads it from a
 * caller's payload. The renderer cannot name a principal, because nothing here
 * accepts one from it.
 */

import { randomUUID } from 'node:crypto'
import { readLocal, writeLocal, type LocalFile, type LocalWrite } from './localState.ts'
import {
  accountView,
  compareIdentity,
  confidenceOf,
  mayStageLogin,
  removalVerdict,
  type AccountIdentity,
  type AccountView,
  type ProviderAccount
} from '../shared/providerAccounts.ts'
import type { ProviderCapabilityReceipt } from '../shared/providerCapability.ts'

/** What the file holds. Versioned so a later shape is additive, not a rewrite. */
interface AccountFile {
  schema: 'ProviderAccounts@1'
  accounts: ProviderAccount[]
  /** provider → accountId, for future admissions only. Changing it rewrites no
   *  existing binding, which is the design's own rule. */
  defaults: Record<string, string>
}

const EMPTY: AccountFile = { schema: 'ProviderAccounts@1', accounts: [], defaults: {} }

function validate(parsed: unknown): AccountFile | null {
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Partial<AccountFile>
  if (o.schema !== 'ProviderAccounts@1') return null
  if (!Array.isArray(o.accounts)) return null
  if (!o.defaults || typeof o.defaults !== 'object') return null
  for (const a of o.accounts) {
    if (!a || typeof a.accountId !== 'string' || typeof a.secretRef !== 'string') return null
    if (!a.identity || typeof a.identity.provider !== 'string') return null
  }
  return { schema: 'ProviderAccounts@1', accounts: o.accounts, defaults: o.defaults as Record<string, string> }
}

/** A login in progress. In memory only: a staging context that survived a
 *  restart would be a half-finished login nobody remembers starting. */
interface Staging {
  attemptId: string
  provider: string
  runtime: string
  principal: string
  /** Where the provider is being asked to put the credential. */
  secretRef: string
  startedAt: number
}

export interface LoginBegun {
  ok: true
  attemptId: string
  /** What the operator is about to be shown, in the provider's own flow. */
  says: string
  secretRef: string
}

export interface Refused {
  ok: false
  reason: string
}

export interface LoginCompleted {
  ok: true
  account: AccountView
  /** True when the attempt resolved to a record that already existed. */
  existing: boolean
}

export interface AccountsDeps {
  dir: string
  matrix: readonly ProviderCapabilityReceipt[]
  /** The installed build per provider, so a capability answer is never read
   *  across versions. */
  builds: Readonly<Record<string, string>>
  now?: () => number
  /** Where a staged login should ask the provider to write. Injected so a probe
   *  does not have to invent a home layout. */
  stagingRef?: (provider: string, attemptId: string) => string
}

export function createProviderAccounts(deps: AccountsDeps) {
  const spec: LocalFile<AccountFile> = {
    dir: deps.dir,
    file: 'provider-accounts.json',
    empty: EMPTY,
    validate
  }
  const now = deps.now ?? Date.now
  const stagingRef =
    deps.stagingRef ?? ((provider, attemptId) => `${provider}:staging:${attemptId}`)
  const staging = new Map<string, Staging>()

  const read = (): AccountFile => readLocal(spec).value

  const listFor = (provider?: string): AccountView[] => {
    const file = read()
    return file.accounts
      .filter((a) => !provider || a.identity.provider === provider)
      .map((a) => accountView(a, file.defaults[a.identity.provider] === a.accountId))
  }

  return {
    /** Every account, redacted. The only reader a window ever gets. */
    listAccounts: listFor,

    /** The revision to pass back to `setDefault` or `removeLocal`. */
    revision: (): string => readLocal(spec).revision,

    /**
     * Start a login, or refuse it with the measurement as the reason.
     *
     * The refusal is the interesting half: on a provider whose credential does
     * not follow the config home, a second login overwrites the first, and the
     * first is the operator's live session.
     */
    beginLogin(input: { provider: string; runtime: string; principal: string }): LoginBegun | Refused {
      const build = deps.builds[input.provider]
      if (!build)
        return {
          ok: false,
          reason: `no build is recorded for ${input.provider}, and a capability answer read across versions is not an answer`
        }
      const existing = read().accounts.filter(
        (a) => a.identity.provider === input.provider && a.identity.runtime === input.runtime
      ).length
      const verdict = mayStageLogin(deps.matrix, input.provider, build, existing)
      if (!verdict.allowed) return { ok: false, reason: verdict.reason }

      const attemptId = randomUUID()
      const ref = stagingRef(input.provider, attemptId)
      staging.set(attemptId, {
        attemptId,
        provider: input.provider,
        runtime: input.runtime,
        principal: input.principal,
        secretRef: ref,
        startedAt: now()
      })
      return {
        ok: true,
        attemptId,
        secretRef: ref,
        says:
          `The provider's own login runs next, on ${input.runtime}, and the browser consent is theirs rather than ` +
          `ours. Nothing is added here until the identity comes back verified. ${verdict.reason}`
      }
    },

    /** Abandon a staged login. Never touches another account, by construction:
     *  the only thing removed is the map entry for this attempt. */
    cancelLogin(attemptId: string): { ok: boolean; reason: string } {
      const had = staging.delete(attemptId)
      return {
        ok: had,
        reason: had
          ? 'the staging context is dropped and no other login was read or written'
          : 'no such attempt — it was already completed, cancelled, or never begun'
      }
    },

    /** Attempts still open, so a probe can assert that a cancel emptied one. */
    stagingCount: (): number => staging.size,

    /**
     * Finish a login with what the provider's identity reader returned.
     *
     * Refuses an unverified identity, and refuses one it cannot tell apart from
     * an account already there — because the alternative is silently replacing
     * somebody's account with somebody else's. Idempotent by attempt: the same
     * attempt id completes once and answers with the same record afterwards.
     */
    completeLogin(input: {
      attemptId: string
      identity: AccountIdentity
      label: string
    }): LoginCompleted | Refused {
      const attempt = staging.get(input.attemptId)
      if (!attempt) {
        // Not necessarily an error: a retry after the first success arrives
        // here, and the answer is the record rather than a second one.
        const file = read()
        const already = file.accounts.find((a) => a.accountId === input.attemptId)
        if (already)
          return { ok: true, existing: true, account: accountView(already, file.defaults[already.identity.provider] === already.accountId) }
        return { ok: false, reason: 'no staged login for that attempt: it was cancelled, expired, or never begun' }
      }
      if (attempt.provider !== input.identity.provider)
        return { ok: false, reason: `the attempt was staged for ${attempt.provider} and the identity is for ${input.identity.provider}` }

      const confidence = confidenceOf(input.identity)
      if (confidence === 'unconfirmed')
        return {
          ok: false,
          reason:
            'the provider confirmed nothing machine-readable about who this is. A label and an email cannot complete ' +
            'a login: the design forbids the email as identity, so there would be nothing to tell this account from ' +
            'the next one'
        }

      const file = read()
      for (const other of file.accounts) {
        const verdict = compareIdentity(input.identity, other.identity)
        if (verdict === 'same') {
          staging.delete(input.attemptId)
          return {
            ok: true,
            existing: true,
            account: accountView(other, file.defaults[other.identity.provider] === other.accountId)
          }
        }
        if (verdict === 'indistinguishable')
          return {
            ok: false,
            reason:
              `this identity cannot be told apart from ${other.accountId} by anything the provider verified ` +
              `(confidence: ${confidence}). Neither installed provider returns a stable per-user subject — CO-141 — ` +
              `and completing would risk replacing that account rather than adding one`
          }
      }

      const account: ProviderAccount = {
        // The attempt id becomes the account id, which is what makes a retry
        // idempotent without a second index to keep in step.
        accountId: input.attemptId,
        identity: input.identity,
        confidence,
        secretRef: attempt.secretRef,
        label: input.label,
        addedAt: new Date(now()).toISOString()
      }
      const written = writeLocal(spec, { ...file, accounts: [...file.accounts, account] }, readLocal(spec).revision)
      if (written.status !== 'committed')
        return {
          ok: false,
          reason:
            written.status === 'conflict'
              ? 'the account list changed while this login was finishing; nothing was added — read it again and retry'
              : `the account list could not be saved: ${written.reason}`
        }
      staging.delete(input.attemptId)
      const after = read()
      return { ok: true, existing: false, account: accountView(account, after.defaults[account.identity.provider] === account.accountId) }
    },

    /** The account future admissions use. Changing it rewrites no binding. */
    setDefault(input: { provider: string; accountId: string; expectedRevision: string }): LocalWrite<AccountFile> | Refused {
      const file = read()
      const found = file.accounts.find(
        (a) => a.accountId === input.accountId && a.identity.provider === input.provider
      )
      if (!found) return { ok: false, reason: `no ${input.provider} account with that id on this device` }
      return writeLocal(
        spec,
        { ...file, defaults: { ...file.defaults, [input.provider]: input.accountId } },
        input.expectedRevision
      )
    },

    /**
     * Forget the local record. Not a sign-out, and it says so.
     *
     * `boundConversations` arrives from the caller because the binding register
     * is M199.binding's and does not exist yet; asking for it as an argument
     * makes the dependency visible instead of assuming an empty list.
     */
    removeLocal(input: {
      accountId: string
      expectedRevision: string
      boundConversations: readonly string[]
    }): (LocalWrite<AccountFile> & { says: string }) | Refused {
      const file = read()
      const found = file.accounts.find((a) => a.accountId === input.accountId)
      if (!found) return { ok: false, reason: 'no account with that id on this device' }
      const provider = found.identity.provider
      const verdict = removalVerdict({
        accountId: input.accountId,
        boundConversations: input.boundConversations,
        isDefault: file.defaults[provider] === input.accountId,
        otherAccounts: file.accounts.filter((a) => a.identity.provider === provider && a.accountId !== input.accountId).length
      })
      if (!verdict.allowed) return { ok: false, reason: `${verdict.reason}: ${verdict.blockedBy.join('; ')}` }

      const defaults = { ...file.defaults }
      if (defaults[provider] === input.accountId) delete defaults[provider]
      const written = writeLocal(
        spec,
        { ...file, accounts: file.accounts.filter((a) => a.accountId !== input.accountId), defaults },
        input.expectedRevision
      )
      return { ...written, says: verdict.reason }
    }
  }
}
