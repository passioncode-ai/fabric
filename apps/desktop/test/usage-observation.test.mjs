// Whose headroom a reading is about, and what an absent window means.
//
// M199.usage. Two defects were REPRODUCED by a dated probe that still runs —
// `docs/audit/2026-09-09-provider-accounts.probe.mjs`. The dangerous one is
// silent and points the wrong way: account A has headroom, the operator
// switches to B which is exhausted, and for the length of the TTL the product
// reports headroom. A gate that starts unattended work on that reading starts
// it on an account that cannot serve it.
//
// The other rule here is the third answer. A window the provider did not return
// is UNKNOWN, never free — the difference between "nothing is stopping you" and
// "nobody asked".
//
// Pure: the credential resolver and the fetch are injected, the clock is
// injected, nothing reaches the network and no keychain is read.

import { createQuotaReader } from '../src/main/quota.ts'
import {
  headroomOf,
  isReading,
  keyOf,
  mayStartUnattended,
  sameAccount
} from '../src/shared/usageObservation.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const KEY_A = {
  provider: 'claude-code',
  subject: 'sub-A',
  org: 'org-1',
  accountId: 'acct-A',
  runtime: 'darwin-arm64 host',
  authRevision: 1
}
const KEY_B = { ...KEY_A, subject: 'sub-B', accountId: 'acct-B' }

// ── the key names every way two accounts differ ─────────────────────────────
{
  sameAccount(KEY_A, { ...KEY_A }) ? ok('a key equals itself') : fail('a key did not equal itself')
  for (const [field, value] of [
    ['provider', 'codex-cli'],
    ['subject', 'sub-other'],
    ['org', 'org-2'],
    ['accountId', 'acct-other'],
    ['runtime', 'wsl:ubuntu'],
    ['authRevision', 2]
  ])
    sameAccount(KEY_A, { ...KEY_A, [field]: value })
      ? fail(`two keys differing only in ${field} compared EQUAL — that merges two accounts`)
      : ok(`a different ${field} is a different account`)
}

// ── a null and an empty value must not collide ─────────────────────────────
{
  // CO-141 makes a null subject the normal case, so a collision here would be
  // constant rather than rare.
  const nulls = keyOf({ ...KEY_A, subject: null, org: null })
  const empties = keyOf({ ...KEY_A, subject: '', org: '' })
  nulls !== empties
    ? ok('a null subject and an empty one are different keys, which matters because null is the normal case')
    : fail('null and empty collided: ' + nulls)
  const shifted = keyOf({ ...KEY_A, subject: 'a', org: 'b|c' })
  const other = keyOf({ ...KEY_A, subject: 'a|b', org: 'c' })
  shifted !== other
    ? ok('and a value containing the separator cannot be made to look like another key')
    : fail('a separator inside a value collided two keys')
}

// ── one reading is never served for another account ────────────────────────
{
  let instant = 1_000_000
  let fetches = 0
  const reader = createQuotaReader({
    tokenFor: async (key) => (key.accountId === 'acct-A' ? 'A' : 'B'),
    fetchUsage: async (token) => {
      fetches++
      return { status: 200, body: { five_hour: { utilization: token === 'A' ? 15 : 85 } } }
    },
    now: () => instant,
    ttlMs: 120_000
  })
  const a = await reader.read(KEY_A)
  const b = await reader.read(KEY_B)
  a.fiveHour.utilization === 15 && b.fiveHour.utilization === 85
    ? ok('A reads 15 and B reads 85 inside one TTL — the defect the dated probe reproduced')
    : fail('the readings were ' + JSON.stringify([a.fiveHour, b.fiveHour]))
  eq(fetches, 2, 'each account was asked for itself')
  instant += 1_000
  const again = await reader.read(KEY_A)
  again.fiveHour.utilization === 15 && fetches === 2
    ? ok('and A is still served from its OWN cache entry')
    : fail('A was re-fetched or answered wrongly: ' + JSON.stringify({ again: again.fiveHour, fetches }))
  reader.stop()
}

// ── a moved auth revision is a different question ──────────────────────────
{
  let instant = 2_000_000
  let fetches = 0
  const reader = createQuotaReader({
    tokenFor: async () => 'A',
    fetchUsage: async () => {
      fetches++
      return { status: 200, body: { five_hour: { utilization: 40 + fetches } } }
    },
    now: () => instant,
    ttlMs: 120_000
  })
  await reader.read(KEY_A)
  await reader.read({ ...KEY_A, authRevision: 2 })
  eq(fetches, 2, 'a re-authentication is asked again inside the TTL — the plan may have changed with it')
  reader.stop()
}

// ── one account's backoff does not silence another ─────────────────────────
{
  let instant = 3_000_000
  const asked = []
  const reader = createQuotaReader({
    tokenFor: async (key) => key.accountId,
    fetchUsage: async (token) => {
      asked.push(token)
      return token === 'acct-A' ? { status: 429, retryAfter: 60 } : { status: 200, body: { five_hour: { utilization: 10 } } }
    },
    now: () => instant,
    ttlMs: 120_000
  })
  const throttled = await reader.read(KEY_A)
  throttled === null ? ok('A is rate-limited and has no previous reading, so it answers null') : fail('A answered ' + JSON.stringify(throttled))
  const other = await reader.read(KEY_B)
  other?.fiveHour?.utilization === 10
    ? ok('and B is asked and answered — a 429 about A does not silence an account nobody asked about')
    : fail('B was silenced by A’s backoff: ' + JSON.stringify(other))
  asked.includes('acct-B') ? ok('B’s request actually reached the provider') : fail('B was never asked: ' + asked.join(','))
  reader.stop()
}

// ── forgetting one account leaves another's backoff alone ──────────────────
{
  let instant = 4_000_000
  let asks = 0
  const reader = createQuotaReader({
    tokenFor: async (key) => key.accountId,
    fetchUsage: async () => {
      asks++
      return { status: 429, retryAfter: 60 }
    },
    now: () => instant,
    ttlMs: 120_000
  })
  await reader.read(KEY_A)
  await reader.read(KEY_B)
  eq(asks, 2, 'both accounts were asked once and both were throttled')
  reader.forget(KEY_A)
  await reader.read(KEY_B)
  eq(asks, 2, 'forgetting A does not clear B’s backoff, so B is not asked again')
  await reader.read(KEY_A)
  eq(asks, 3, 'and A, whose backoff was forgotten, is asked again')
  reader.stop()
}

// ── two callers asking at once ask the provider once ───────────────────────
{
  let instant = 5_000_000
  let asks = 0
  const reader = createQuotaReader({
    tokenFor: async () => 'A',
    fetchUsage: async () => {
      asks++
      await new Promise((r) => setTimeout(r, 10))
      return { status: 200, body: { five_hour: { utilization: 20 } } }
    },
    now: () => instant,
    ttlMs: 120_000
  })
  const [x, y] = await Promise.all([reader.read(KEY_A), reader.read(KEY_A)])
  eq(asks, 1, 'two concurrent reads for one account ask the provider once')
  x.fiveHour.utilization === 20 && y.fiveHour.utilization === 20
    ? ok('and both callers get the same answer')
    : fail('the two callers disagreed')
  reader.stop()
}

// ── with an account chosen, the system default is NOT an answer ────────────
{
  let instant = 6_000_000
  let systemDefaultReads = 0
  const reader = createQuotaReader({
    token: async () => {
      systemDefaultReads++
      return 'the-system-default'
    },
    // No tokenFor wired: an account is chosen and nothing can resolve it.
    fetchUsage: async () => ({ status: 200, body: { five_hour: { utilization: 5 } } }),
    now: () => instant,
    ttlMs: 120_000
  })
  const answer = await reader.read(KEY_A)
  answer?.problem === 'no-credential'
    ? ok('an account with no resolver answers NO CREDENTIAL rather than the system default’s headroom')
    : fail('a chosen account was answered from somewhere: ' + JSON.stringify(answer))
  eq(systemDefaultReads, 0, 'and the system default was never read')

  const free = await reader.read()
  free?.fiveHour?.utilization === 5
    ? ok('while a read with NO account still uses the system default — today’s behaviour, unchanged')
    : fail('the no-account path broke: ' + JSON.stringify(free))
  eq(systemDefaultReads, 1, 'which is the only path that reads it')
  reader.stop()
}

// ── an absent window is unknown, never free ────────────────────────────────
{
  const observation = (over = {}) => ({
    contextIdentity: KEY_A,
    authRevision: 1,
    windows: [{ id: 'five-hour', kind: 'five-hour', usedPct: 30, resetAt: null }],
    sampledAt: '2026-09-10T00:00:00.000Z',
    source: 'oauth usage endpoint',
    status: 'fresh',
    reason: 'read',
    nextProbeAt: '2026-09-10T00:02:00.000Z',
    ...over
  })

  const known = headroomOf(observation(), 'five-hour')
  known.known && known.freePct === 70 ? ok('a window that was returned has known headroom') : fail('headroom: ' + JSON.stringify(known))

  const absent = headroomOf(observation(), 'seven-day-opus')
  absent.known === false && /not the same as an empty one/.test(absent.why)
    ? ok('a window the provider did NOT return is unknown — not a window at zero and not free quota')
    : fail('an absent window answered ' + JSON.stringify(absent))

  const nothing = headroomOf(null, 'five-hour')
  nothing.known === false ? ok('and nothing read at all is unknown too') : fail('null answered known')

  for (const status of ['stale', 'rate-limited', 'auth-required', 'source-failure', 'unknown']) {
    const v = headroomOf(observation({ status }), 'five-hour')
    v.known === false
      ? ok(`a ${status} observation has no known headroom, whatever number it still carries`)
      : fail(`${status} answered known: ` + JSON.stringify(v))
  }
  const exhausted = headroomOf(observation({ status: 'exhausted', windows: [{ id: 'five-hour', kind: 'five-hour', usedPct: 100, resetAt: null }] }), 'five-hour')
  exhausted.known === true && exhausted.freePct === 0
    ? ok('and an EXHAUSTED account is a reading — zero left, known, not a failure')
    : fail('exhausted answered ' + JSON.stringify(exhausted))
}

// ── which statuses are numbers somebody may act on ─────────────────────────
{
  eq(isReading('fresh'), true, 'fresh is a reading')
  eq(isReading('exhausted'), true, 'and so is exhausted — zero is a number')
  for (const status of ['stale', 'rate-limited', 'auth-required', 'source-failure', 'unknown'])
    isReading(status) === false ? ok(`${status} is not a reading`) : fail(`${status} counted as a reading`)
}

// ── the unattended floor refuses for reasons a caller can show ─────────────
{
  const observation = (usedPct, status = 'fresh') => ({
    contextIdentity: KEY_A,
    authRevision: 1,
    windows: [{ id: 'five-hour', kind: 'five-hour', usedPct, resetAt: null }],
    sampledAt: '2026-09-10T00:00:00.000Z',
    source: 'oauth usage endpoint',
    status,
    reason: 'read',
    nextProbeAt: '2026-09-10T00:02:00.000Z'
  })
  const allowed = mayStartUnattended(observation(30), 'five-hour', 20)
  allowed.allowed && /70% of five-hour is left/.test(allowed.reason)
    ? ok('headroom above the floor allows unattended work and says how much')
    : fail('allowed: ' + JSON.stringify(allowed))

  const tight = mayStartUnattended(observation(90), 'five-hour', 20)
  tight.allowed === false && /is the floor/.test(tight.reason)
    ? ok('below the floor it refuses and names the floor')
    : fail('tight: ' + JSON.stringify(tight))

  const unknownWindow = mayStartUnattended(observation(30), 'seven-day-opus', 20)
  unknownWindow.allowed === false
    ? ok('and an unknown window refuses — absence is never read as permission')
    : fail('an unknown window allowed unattended work')

  const staleOne = mayStartUnattended(observation(1, 'stale'), 'five-hour', 20)
  staleOne.allowed === false && /stale/.test(staleOne.reason)
    ? ok('a stale reading with plenty of headroom still refuses, and says which status stopped it')
    : fail('stale: ' + JSON.stringify(staleOne))
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log('\nall green: one reading per account, one backoff per account, and an absent window that is never free')
