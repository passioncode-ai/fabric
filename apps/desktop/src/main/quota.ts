// How much of the account's Claude quota is gone, and when it resets (M83).
//
// CO-096 asked where a token or cost number could come from and the answer,
// measured rather than argued, is: not where anyone expects. The endpoint the
// Claude Code client uses returns UTILISATION AGAINST RATE-LIMIT WINDOWS —
// `five_hour.utilization`, `seven_day.utilization`, per-model windows, reset
// timestamps. Measured on this machine 2026-09-01: `limit_dollars`,
// `used_dollars` and `remaining_dollars` all came back null, and nothing in the
// response is per-session or per-project.
//
// So there is no per-project cost, and the cell for it is absent rather than
// zero. What there is answers the question a subscription operator actually
// asks: **can I start a big job now, or wait for the reset.**
//
// THREE THINGS THIS MODULE OWES ITS CALLER, because each is a way to be wrong:
//
//   1. The endpoint is UNDOCUMENTED and internal to the Claude Code client. It
//      can change or vanish without notice, so a failure returns the last known
//      reading WITH ITS AGE, and never a stale number dressed as current.
//   2. It reads the operator's OAuth token. That token can act as them against
//      Anthropic. It is never logged, never written anywhere, and goes to no
//      host but api.anthropic.com.
//   3. It is a shared rate-limited service. Polling backs off and honours
//      Retry-After, because the one thing worse than not knowing your quota is
//      being throttled for asking.

import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { ops } from './opsSink.ts'

const run = promisify(execFile)

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const OAUTH_BETA = 'oauth-2025-04-20'
/** macOS keeps the credential here; the JSON file is the Linux/Windows path. */
const KEYCHAIN_SERVICE = 'Claude Code-credentials'

// ONE DEFINITION, and it lives in `shared/` (R-005). `Quota` and `QuotaWindow`
// were declared HERE as well, and neither was wrong alone: the two were
// identical the day they were written. FA-03 added `account` and the `empty`
// problem to the shared one, and the producer that fills those fields could not
// compile against its own copy — which is the drift arriving, three fields at a
// time, at the exact moment the contract mattered.
import type { Quota, QuotaWindow } from '../shared/types'
export type { Quota, QuotaWindow }
import { keyOf, type ObservationKey } from '../shared/usageObservation.ts'

export interface QuotaReader {
  /**
   * The reading for one account, or for the system default when no account is
   * named — which is what every existing caller does and what it still means.
   *
   * NEVER NULL (release review 2026-10-03). A failed first read used to answer
   * null, and the panel renders null as "Claude Code is not signed in" — so our
   * own unreachable request was reported as the operator's signed-out account.
   * Every path now answers a reading whose `problem` names what happened; one
   * with no window authorises nothing, which the gate already enforces.
   */
  read(key?: ObservationKey): Promise<Quota>
  /** Forget one account's cache and backoff, or all of them. Removing an
   *  account must not clear another's backoff (M199.usage). */
  forget(key?: ObservationKey): void
  stop(): void
}

export interface QuotaDeps {
  /** Injected so the policy is probed without a network or a keychain. */
  token?: () => Promise<string | null>
  /**
   * The credential for ONE chosen account (M199.usage).
   *
   * Separate from `token` on purpose. `token` reads the system default, which
   * is right when nobody has chosen an account and WRONG the moment somebody
   * has — a dated probe reproduces it reading the keychain service regardless
   * of `CLAUDE_CONFIG_DIR`, while M199.auth measured that the CLI itself does
   * follow the config home. With an account chosen and no resolver wired, the
   * read is refused rather than answered from the system default.
   */
  tokenFor?: (key: ObservationKey) => Promise<string | null>
  fetchUsage?: (token: string) => Promise<{ status: number; retryAfter?: number; body?: unknown }>
  ttlMs?: number
  now?: () => number
  /**
   * How many accounts may be asked in one tick. `resetAt` passing is not a
   * reason to ask again — the TTL is — and an unbounded tick with several
   * accounts turns a switch into a burst.
   */
  probesPerTick?: number
}

const DEFAULT_TTL = 120_000

/** The bearer, from the Keychain on macOS and the JSON file elsewhere. Never logged. */
async function readToken(): Promise<string | null> {
  if (process.platform === 'darwin') {
    try {
      const { stdout } = await run('security', [
        'find-generic-password',
        '-s',
        KEYCHAIN_SERVICE,
        '-w'
      ])
      const oauth = JSON.parse(stdout.trim())?.claudeAiOauth
      return typeof oauth?.accessToken === 'string' ? oauth.accessToken : null
    } catch {
      /* fall through to the file, which some setups still use */
    }
  }
  // THE CONFIG HOME, not a fixed path (M199.usage). The dated probe reproduces
  // this reading `$HOME/.claude` whatever `CLAUDE_CONFIG_DIR` says, while
  // M199.auth measured that the CLI itself DOES follow that variable — so
  // Fabric and the provider could read two different credentials and disagree
  // about whose headroom this is. On macOS the secret is one keychain item per
  // operating-system user and the branch above wins, which is why the
  // capability row for isolation-by-home reads `unsupported` rather than fixed.
  const home = process.env.CLAUDE_CONFIG_DIR ?? path.join(process.env.HOME ?? '', '.claude')
  const file = path.join(home, '.credentials.json')
  if (!existsSync(file)) return null
  try {
    const oauth = JSON.parse(readFileSync(file, 'utf8'))?.claudeAiOauth
    return typeof oauth?.accessToken === 'string' ? oauth.accessToken : null
  } catch (e) {
    // The FALLBACK is unchanged; what is new is that the reason survives. A
    // quota that cannot be read blocks unattended work, and "why" used to exist
    // only in the moment it happened.
    ops.failed('quota.read', e)
    return null
  }
}

async function realFetch(
  token: string
): Promise<{ status: number; retryAfter?: number; body?: unknown }> {
  const res = await fetch(USAGE_URL, {
    headers: {
      authorization: `Bearer ${token}`,
      'anthropic-beta': OAUTH_BETA,
      'user-agent': 'fabric/0.1'
    },
    signal: AbortSignal.timeout(8_000)
  })
  const retryAfterRaw = res.headers.get('retry-after')
  const retryAfter = retryAfterRaw ? Number(retryAfterRaw) : undefined
  if (!res.ok) return { status: res.status, retryAfter }
  return { status: res.status, body: await res.json() }
}

/**
 * A stable name for the account a reading is about, derived from the credential
 * and revealing nothing about it. Truncated because it is an equality check, not
 * a secret to be reversed — and never logged with the token beside it.
 */
function accountOf(bearer: string): string {
  return createHash('sha256').update(bearer).digest('hex').slice(0, 12)
}

function windowOf(raw: unknown): QuotaWindow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const util = r.utilization
  if (typeof util !== 'number') return null
  return { utilization: util, resetsAt: typeof r.resets_at === 'string' ? r.resets_at : null }
}

export function createQuotaReader(deps: QuotaDeps = {}): QuotaReader {
  const token = deps.token ?? readToken
  const fetchUsage = deps.fetchUsage ?? realFetch
  const ttl = deps.ttlMs ?? DEFAULT_TTL
  const now = deps.now ?? Date.now

  /**
   * PER ACCOUNT, and that is the whole of M199.usage's second defect.
   *
   * These were two variables — `last` and `backoffUntil` — shared by every
   * account. The dated probe reproduces what that does: A's reading is served
   * for B until the TTL expires, so a switch from an account with headroom to
   * one that is exhausted reports headroom for two minutes. And a 429 for A
   * silenced B, which had not been asked.
   *
   * The key carries provider, subject, org, account, runtime AND auth revision,
   * because dropping any one of them merges two accounts that are different
   * questions: two subjects in one organisation, one subject on two runtimes,
   * or the same account across a re-authentication that may have changed plan.
   */
  const entries = new Map<string, { at: number; quota: Quota }>()
  const backoffs = new Map<string, number>()
  /** One in-flight read per account, so two callers do not both ask. */
  const inFlight = new Map<string, Promise<Quota>>()
  const SYSTEM_DEFAULT = 'system-default'

  const withAge = (q: Quota, at: number, problem: Quota['problem']): Quota => ({
    ...q,
    ageSeconds: Math.max(0, Math.round((now() - at) / 1000)),
    problem
  })

  /**
   * A request that produced no reading, when there is no earlier one to fall
   * back to. No window, so no number is invented; the account is named because
   * a credential WAS found and asked with — this is a fact about the request,
   * and saying "not signed in" here would be a diagnosis of the operator's
   * machine produced by our own failure.
   */
  const noReading = (problem: NonNullable<Quota['problem']>, account: string | null): Quota => ({
    fiveHour: null,
    sevenDay: null,
    byModel: {},
    readAt: new Date(now()).toISOString(),
    ageSeconds: 0,
    problem,
    account
  })

  const readFor = async (slot: string, key: ObservationKey | undefined): Promise<Quota> => {
      const last = entries.get(slot) ?? null
      const backoffUntil = backoffs.get(slot) ?? 0
      if (last && now() - last.at < ttl) return withAge(last.quota, last.at, last.quota.problem)
      if (now() < backoffUntil)
        // No credential has been read yet on this path, so no account is named.
        return last ? withAge(last.quota, last.at, 'throttled') : noReading('throttled', null)

      // WITH AN ACCOUNT CHOSEN, the system default is not an answer. Reading it
      // is the first defect the dated probe reproduces, and answering from it
      // would attribute one account's headroom to another.
      const bearer = key
        ? deps.tokenFor
          ? await deps.tokenFor(key)
          : null
        : await token()
      if (!bearer) {
        // Not signed in. A real state, not a failure — and the only one where
        // there is nothing to fall back to.
        // Not signed in: there is no account to name, and naming one would be
        // inventing the thing the reading is about.
        return last ? withAge(last.quota, last.at, 'no-credential') : noReading('no-credential', null)
      }

      let result: { status: number; retryAfter?: number; body?: unknown }
      try {
        result = await fetchUsage(bearer)
      } catch (e) {
      ops.failed('quota.snapshot', e)
        return last ? withAge(last.quota, last.at, 'unreachable') : noReading('unreachable', accountOf(bearer))
      }

      if (result.status === 429) {
        backoffs.set(slot, now() + (result.retryAfter ?? 60) * 1000)
        return last ? withAge(last.quota, last.at, 'throttled') : noReading('throttled', accountOf(bearer))
      }
      if (result.status !== 200 || !result.body) {
        return last ? withAge(last.quota, last.at, 'rejected') : noReading('rejected', accountOf(bearer))
      }

      const body = result.body as Record<string, unknown>
      const byModel: Record<string, QuotaWindow> = {}
      for (const key of Object.keys(body)) {
        // Only the windows this product understands. The response also carries
        // internal buckets under codenames; showing a number whose meaning is
        // unknown is worse than showing none.
        if (!/^seven_day_(opus|sonnet|haiku)$/.test(key)) continue
        const w = windowOf(body[key])
        if (w) byModel[key.replace('seven_day_', '')] = w
      }

      const at = now()
      const fiveHour = windowOf(body.five_hour)
      const sevenDay = windowOf(body.seven_day)
      // A 200 THAT SAID NOTHING IS NOT A READING (FA-03). Measured: an empty
      // body produced `{ fiveHour: null, sevenDay: null, problem: null }`, and
      // the gate — which skips absent windows — read that as permission. The
      // status code was the only thing that succeeded, and it was standing in
      // for an answer. Named here rather than left for the reader to infer,
      // because the producer is the only place that knows the body was empty
      // rather than the plan being narrow.
      if (!fiveHour && !sevenDay)
        return last ? withAge(last.quota, last.at, 'empty') : noReading('empty', accountOf(bearer))
      const quota: Quota = {
        fiveHour,
        sevenDay,
        byModel,
        readAt: new Date(at).toISOString(),
        ageSeconds: 0,
        problem: null,
        // WHICH account this is about. A fingerprint of the credential, never
        // the credential: headroom is a fact about one account, and a reading
        // taken for another is an answer to a different question.
        account: accountOf(bearer)
      }
      entries.set(slot, { at, quota })
      return quota
  }

  return {
    async read(key?: ObservationKey): Promise<Quota> {
      const slot = key ? keyOf(key) : SYSTEM_DEFAULT
      const running = inFlight.get(slot)
      if (running) return running
      const attempt = readFor(slot, key).finally(() => inFlight.delete(slot))
      inFlight.set(slot, attempt)
      return attempt
    },

    forget(key?: ObservationKey): void {
      if (!key) {
        entries.clear()
        backoffs.clear()
        return
      }
      // ONE slot. Removing an account or moving its auth revision must not
      // clear another's backoff — the provider asked us to wait about THAT
      // account, and forgetting it would make the next tick ask again.
      const slot = keyOf(key)
      entries.delete(slot)
      backoffs.delete(slot)
    },

    stop(): void {
      entries.clear()
      backoffs.clear()
      inFlight.clear()
    }
  }
}
