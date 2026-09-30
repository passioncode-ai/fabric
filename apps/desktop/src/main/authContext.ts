/**
 * Resolving one account's auth, and the two races that would substitute another.
 *
 * M199.auth. Three ports the card names — `resolveAuthContext`, `verifyIdentity`,
 * `coordinatedRefresh` — and the reason each exists is a way one account can
 * end up doing another's work:
 *
 *  * **Inherited environment.** Measured and tabulated in `authResolution.ts`:
 *    four variables replace the resolved identity on Claude Code, and the
 *    reader reports them through two different fields. Cleaned, then READ BACK.
 *  * **Two refreshes at once.** A rotating credential written twice leaves one
 *    of the two writers holding a token the store no longer knows about. One
 *    writer per lineage, and the second caller gets the first's answer rather
 *    than a second attempt.
 *  * **An old revision arriving late.** A refresh that started before a newer
 *    one finished must not write its result on top. The expected revision is
 *    compared at the moment of writing, not when the caller was created.
 *
 * The identity reader is INJECTED. It runs the provider's own command, and a
 * probe must be able to hand this module an answer without a login, a keychain
 * or a network.
 */

import { randomUUID } from 'node:crypto'
import {
  authVerdict,
  hasOverrideDetector,
  overridesPresent,
  withoutOverrides,
  type AuthVerdict,
  type ChosenIdentity,
  type ObservedIdentity
} from '../shared/authResolution.ts'

export interface AuthContext {
  /** Opaque. A caller passes it back; it carries no credential and no path. */
  contextRef: string
  verdict: AuthVerdict
  /** The environment a child should be launched with, overrides removed. */
  env: Readonly<Record<string, string>>
  /** The revision this context was resolved at. */
  authRevision: number
}

export interface Blocked {
  contextRef: null
  verdict: AuthVerdict
}

export type Resolution = AuthContext | Blocked

export interface RefreshOutcome {
  status: 'refreshed' | 'joined' | 'stale' | 'failed'
  authRevision: number
  reason: string
}

export interface AuthDeps {
  /**
   * Ask the provider who it thinks it is, under this environment. Returns null
   * when the provider has no reader that can answer — Codex 0.152.1 is that
   * case, and the resolution's status says so rather than pretending.
   */
  readIdentity: (
    provider: string,
    env: Readonly<Record<string, string>>
  ) => ObservedIdentity | null
  /** This host, so an account authorised elsewhere is refused rather than used. */
  runtime: string
  /**
   * Perform the provider's own refresh. Called under the lineage lock, at most
   * once per concurrent burst. Returns the new revision.
   */
  refresh?: (lineage: string, at: number) => Promise<number>
}

export function createAuthContexts(deps: AuthDeps) {
  /** lineage → the revision the store currently holds. */
  const revisions = new Map<string, number>()
  /** lineage → the refresh in flight, so a second caller joins rather than races. */
  const inFlight = new Map<string, Promise<RefreshOutcome>>()

  const resolve = (input: {
    account: ChosenIdentity & { accountId: string; runtime: string; lineage: string }
    env: Readonly<Record<string, string | undefined>>
    expectedAuthRevision?: number
  }): Resolution => {
    const { account } = input
    const chosen: ChosenIdentity = { provider: account.provider, subject: account.subject, org: account.org }

    const present = overridesPresent(account.provider, input.env)
    const cleaned = withoutOverrides(account.provider, input.env)
    // The readback happens under the CLEANED environment: reading under the
    // dirty one would report the override and prove nothing about what a child
    // is going to get.
    const observed = deps.readIdentity(account.provider, cleaned)
    const remaining = overridesPresent(account.provider, cleaned)

    const verdict = authVerdict({
      chosen,
      accountRuntime: account.runtime,
      thisRuntime: deps.runtime,
      observed,
      removed: present.map((o) => o.variable),
      remaining
    })

    if (verdict.status === 'blocked') return { contextRef: null, verdict }

    const current = revisions.get(account.lineage) ?? 1
    if (input.expectedAuthRevision !== undefined && input.expectedAuthRevision !== current)
      return {
        contextRef: null,
        verdict: {
          status: 'blocked',
          removed: verdict.removed,
          reason:
            `the caller expected auth revision ${input.expectedAuthRevision} and the store holds ${current}. ` +
            `A context resolved against a revision that has moved would hand a child a credential the store has ` +
            `already replaced`
        }
      }

    return { contextRef: randomUUID(), verdict, env: cleaned, authRevision: current }
  }

  return {
    resolveAuthContext: resolve,

    /** What the provider says right now, under an environment this decides. */
    verifyIdentity(input: {
      account: ChosenIdentity & { runtime: string }
      env: Readonly<Record<string, string | undefined>>
    }): AuthVerdict {
      const cleaned = withoutOverrides(input.account.provider, input.env)
      return authVerdict({
        chosen: input.account,
        accountRuntime: input.account.runtime,
        thisRuntime: deps.runtime,
        observed: deps.readIdentity(input.account.provider, cleaned),
        removed: overridesPresent(input.account.provider, input.env).map((o) => o.variable),
        remaining: overridesPresent(input.account.provider, cleaned)
      })
    },

    /** Whether this provider can be verified at all, for a caller deciding
     *  what to tell the operator before anything is attempted. */
    verifiable: (provider: string): boolean => hasOverrideDetector(provider),

    /** The revision the store holds for a lineage. */
    revisionOf: (lineage: string): number => revisions.get(lineage) ?? 1,

    /** Set by a completed login, so the probes and the caller share one path. */
    noteRevision(lineage: string, revision: number): void {
      const current = revisions.get(lineage) ?? 0
      // Monotonic. An older revision arriving late is dropped rather than
      // written: that is the card's second failure case, and the guard belongs
      // where the write happens rather than where the caller was created.
      if (revision > current) revisions.set(lineage, revision)
    },

    /**
     * Refresh once per burst, whoever asks.
     *
     * The second caller JOINS the first rather than starting a second: two
     * rotating credentials written in either order leave one writer holding a
     * token the store does not know about, and the provider may have revoked
     * the other.
     */
    async coordinatedRefresh(input: { lineage: string; at: number; expectedAuthRevision: number }): Promise<RefreshOutcome> {
      const current = revisions.get(input.lineage) ?? 1
      if (input.expectedAuthRevision < current)
        return {
          status: 'stale',
          authRevision: current,
          reason:
            `this attempt was made against revision ${input.expectedAuthRevision} and the store holds ${current}: ` +
            `a newer refresh already landed, and writing over it would restore a credential the provider may have rotated`
        }

      const running = inFlight.get(input.lineage)
      if (running) {
        const outcome = await running
        return { ...outcome, status: 'joined', reason: `joined the refresh already in flight: ${outcome.reason}` }
      }

      const attempt = (async (): Promise<RefreshOutcome> => {
        if (!deps.refresh)
          return {
            status: 'failed',
            authRevision: current,
            reason: 'no refresh is wired for this provider, and inventing one would write a credential nobody issued'
          }
        try {
          const next = await deps.refresh(input.lineage, input.at)
          if (next <= current)
            return {
              status: 'stale',
              authRevision: current,
              reason: `the provider returned revision ${next} and the store already holds ${current}`
            }
          revisions.set(input.lineage, next)
          return { status: 'refreshed', authRevision: next, reason: `one writer, one new revision (${next})` }
        } catch (e) {
          return { status: 'failed', authRevision: current, reason: String(e) }
        }
      })()

      inFlight.set(input.lineage, attempt)
      try {
        return await attempt
      } finally {
        inFlight.delete(input.lineage)
      }
    }
  }
}
