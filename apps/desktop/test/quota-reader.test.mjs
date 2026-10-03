// What the producer makes of an answer that arrived (FA-03).
//
// MEASURED at d28c321: the vendor returned HTTP 200 with an empty body, and the
// producer built `{ fiveHour: null, sevenDay: null, problem: null }` from it.
// Nothing had failed — the request succeeded, the parse succeeded, both windows
// were legitimately absent — so `problem` stayed null, and the gate, which skips
// an absent window, read that as permission to start unattended work.
//
// The status code was the only thing that succeeded, and it stood in for an
// answer. This probe is where that stops: only the producer knows whether the
// BODY was empty or the PLAN is narrow, and it is the only place that can say.
//
// Pure: it injects its fetch and its clock. Nothing reaches the network, no
// credential is read, and nothing is written.

import { createQuotaReader, readKeychainToken, readToken, forgetCachedToken, personReturned, KEYCHAIN_TIMEOUT_MS, CREDENTIAL_HOLD_MS, FAILURE_HOLD_MS } from '../src/main/quota.ts'
import { mayStart } from '../src/shared/quotaGate.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

const reader = (body, status = 200) =>
  createQuotaReader({
    token: async () => 'test-token',
    fetchUsage: async () => ({ status, body }),
    now: () => 1_757_000_000_000
  })

// ── an answer that said nothing is not an answer ─────────────────────────────
{
  const q = await reader({}).read()
  q && q.problem === 'empty'
    ? ok('an HTTP 200 with an empty body is reported as EMPTY, not as a clean reading')
    : fail('empty body produced: ' + JSON.stringify(q))
}

// ── a narrow plan still reads ────────────────────────────────────────────────
{
  const q = await reader({ five_hour: { utilization: 12, resets_at: null } }).read()
  q && q.problem === null && q.fiveHour && !q.sevenDay
    ? ok('a plan that reports only one window is a reading, not a failure')
    : fail('one-window plan produced: ' + JSON.stringify(q))
}

// ── the reading names the account it is about ────────────────────────────────
{
  const q = await reader({ five_hour: { utilization: 12, resets_at: null } }).read()
  const same = await reader({ five_hour: { utilization: 12, resets_at: null } }).read()
  q?.account && q.account === same?.account && !q.account.includes('test-token')
    ? ok('the reading carries a stable account fingerprint, and it is not the credential')
    : fail('account fingerprint: ' + JSON.stringify(q?.account))
}

// ── a signed-out machine names no account rather than inventing one ──────────
{
  const q = await createQuotaReader({
    token: async () => null,
    fetchUsage: async () => { throw new Error('must not be called') },
    now: () => 1_757_000_000_000
  }).read()
  q && q.problem === 'no-credential' && q.account === null
    ? ok('signed out: no credential, and no account invented for a reading nobody took')
    : fail('signed out produced: ' + JSON.stringify(q))
}

// ── a failed FIRST read is a failed read, not a signed-out account ───────────
//
// MEASURED in the 2026-10-03 release review (data finding 10): with nothing
// cached, an unreachable service, a 429 and a 500 each answered NULL, and the
// quota panel renders null as "Claude Code is not signed in on this machine".
// The operator was told their account was signed out because our own request
// failed. A credential WAS found on each of these paths, so the reading says
// what happened to the request and names no number — and the gate still
// refuses it, because a reading with no windows authorises nothing.
const failedFirst = async (name, make, problem) => {
  const q = await make().read()
  q !== null && q.problem === problem && q.fiveHour === null && q.sevenDay === null &&
  Object.keys(q.byModel).length === 0 && typeof q.account === 'string' && q.account.length > 0
    ? ok(`${name} with no previous reading answers '${problem}', no number, and the account it asked about`)
    : fail(`${name} produced: ` + JSON.stringify(q))
  mayStart(q, 'unattended').ok === false
    ? ok(`and that reading starts nothing unattended (${name})`)
    : fail(`the gate admitted unattended work on a failed first read (${name})`)
}
await failedFirst('a 500', () => reader({ five_hour: { utilization: 1, resets_at: null } }, 500), 'rejected')
await failedFirst('a 429', () => reader({}, 429), 'throttled')
await failedFirst('an unreachable service', () => createQuotaReader({
  token: async () => 'test-token',
  fetchUsage: async () => { throw new Error('getaddrinfo ENOTFOUND') },
  now: () => 1_757_000_000_000
}), 'unreachable')

// ── every outcome is held: no credential read on every poll (lifecycle LC-04) ─────
// MEASURED 2026-10-03: with quota unknown, the renderer's 3 s poll ran `security
// find-generic-password -w` every 3 s, because only a 429 was ever held. With a locked
// keychain that is a dialog every 3 s.
{
  let clock = 1_757_000_000_000
  let asked = 0
  const r = createQuotaReader({ token: async () => { asked++; return null }, fetchUsage: async () => { throw new Error('must not be called') }, now: () => clock })
  await r.read(); clock += 3_000; await r.read(); clock += 3_000; const q = await r.read()
  asked === 1 && q.problem === 'no-credential'
    ? ok('a missing credential is read once and held, not re-read on every poll')
    : fail(`a missing credential was read ${asked} times in 6 s; problem ${q.problem}`)
  clock += CREDENTIAL_HOLD_MS
  await r.read()
  asked === 2 ? ok('and asked again only after the hold') : fail(`after the hold the credential was read ${asked} times`)
  r.forget(); await r.read()
  asked === 3 ? ok('or at once when the person acts (forget)') : fail(`forget did not release the hold: ${asked}`)
}
{
  let clock = 1_757_000_000_000
  let asked = 0
  const r = createQuotaReader({ token: async () => { asked++; return 'test-token' }, fetchUsage: async () => { throw new Error('getaddrinfo ENOTFOUND') }, now: () => clock })
  await r.read(); clock += 3_000; const q = await r.read()
  asked === 1 && q.problem === 'unreachable'
    ? ok('an unreachable service holds the next request back and says why')
    : fail(`unreachable was asked ${asked} times in 3 s; problem ${q.problem}`)
  clock += FAILURE_HOLD_MS; await r.read()
  clock += FAILURE_HOLD_MS; await r.read()
  asked === 2 ? ok('and the hold doubles on a second failure') : fail(`the failure hold did not double: ${asked} asks`)
}
// ── one Keychain read is bounded, and its outcome is named ──────────────────────
{
  let seen
  const found = await readKeychainToken(async (file, args, opts) => { seen = { file, args, opts }; return { stdout: JSON.stringify({ claudeAiOauth: { accessToken: 'tok' } }) } })
  found.token === 'tok' && seen.opts.timeout === KEYCHAIN_TIMEOUT_MS && seen.opts.killSignal === 'SIGKILL' && !seen.args.includes('tok')
    ? ok('the Keychain read carries a deadline and a kill signal')
    : fail('keychain read options: ' + JSON.stringify(seen?.opts))
  const absent = await readKeychainToken(async () => { throw Object.assign(new Error('not found'), { code: 44 }) })
  const denied = await readKeychainToken(async () => { throw Object.assign(new Error('user canceled'), { code: 128 }) })
  const stalled = await readKeychainToken(async () => { throw Object.assign(new Error('killed'), { killed: true, signal: 'SIGKILL' }) })
  absent.outcome === 'absent' && denied.outcome === 'denied' && stalled.outcome === 'timeout'
    ? ok('absent, denied and stalled reads are told apart')
    : fail(`outcomes: ${absent.outcome} ${denied.outcome} ${stalled.outcome}`)
}

// ── unlocking the screen releases a credential hold, never a provider's back-off (review finding 12) ──
{
  let clock = 1_757_000_000_000
  let asked = 0
  const r = createQuotaReader({ token: async () => { asked++; return 'test-token' }, fetchUsage: async () => ({ status: 429, retryAfter: 600 }), now: () => clock })
  await r.read(); r.retryCredential(); clock += 3_000; await r.read()
  asked === 1 ? ok('retryCredential keeps a 429 back-off') : fail(`retryCredential cleared the 429 back-off: ${asked} asks`)
  let asked2 = 0
  const s = createQuotaReader({ token: async () => { asked2++; return null }, fetchUsage: async () => { throw new Error('must not be called') }, now: () => clock })
  await s.read(); s.retryCredential(); await s.read()
  asked2 === 2 ? ok('and releases a no-credential hold') : fail(`retryCredential did not release the credential hold: ${asked2}`)
}

// ── the Keychain token is read once per its lifetime, not on every reading (review finding 10) ──
if (process.platform === 'darwin') {
  forgetCachedToken()
  let reads = 0
  const exec = async () => { reads++; return { stdout: JSON.stringify({ claudeAiOauth: { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 } }) } }
  await readToken(exec); await readToken(exec); await readToken(exec)
  reads === 1 ? ok('a valid token is read from the Keychain once and held in memory') : fail(`the Keychain was read ${reads} times for one valid token`)
  forgetCachedToken(); await readToken(exec)
  reads === 2 ? ok('a rejected token (forgetCachedToken) is read again') : fail(`forgetCachedToken did not force a read: ${reads}`)
  forgetCachedToken()
  let reads2 = 0
  const soon = async () => { reads2++; return { stdout: JSON.stringify({ claudeAiOauth: { accessToken: 'tok', expiresAt: Date.now() + 60_000 } }) } }
  await readToken(soon); await readToken(soon)
  reads2 === 2 ? ok('a token within five minutes of expiry is not served from memory') : fail(`an expiring token was cached: ${reads2}`)
  forgetCachedToken()
} else ok('NOT_RUN: the Keychain token cache is macOS-only')

// ── confirmation review: unreadable is not a refusal; seconds are seconds; the person returning re-checks ──
{
  const spawnFailed = await readKeychainToken(async () => { throw Object.assign(new Error('spawn security ENOENT'), { code: 'ENOENT' }) })
  const notJson = await readKeychainToken(async () => ({ stdout: 'not json' }))
  spawnFailed.outcome === 'unreadable' && notJson.outcome === 'unreadable'
    ? ok('a spawn error or an item that is not JSON is unreadable, not a refusal')
    : fail(`spawn/parse outcomes: ${spawnFailed.outcome} ${notJson.outcome}`)
  const secs = await readKeychainToken(async () => ({ stdout: JSON.stringify({ claudeAiOauth: { accessToken: 't', expiresAt: 1_900_000_000 } }) }))
  secs.expiresAt === 1_900_000_000_000 ? ok('an expiry in seconds is read as seconds') : fail(`expiresAt in seconds read as ${secs.expiresAt}`)
}
if (process.platform === 'darwin') {
  forgetCachedToken()
  let reads = 0
  const exec = async () => { reads++; return { stdout: JSON.stringify({ claudeAiOauth: { accessToken: 'tok', expiresAt: Date.now() + 3_600_000 } }) } }
  await readToken(exec)
  personReturned(Date.now() + 60_000); await readToken(exec)
  personReturned(Date.now() + 11 * 60_000); await readToken(exec)
  reads === 2 ? ok('the person returning after ten minutes re-reads the token (an account switch shows)') : fail(`reads after personReturned: ${reads}`)
  forgetCachedToken()
}

console.log(failures ? '\n  FAIL ' + failures + ' failure(s)' : '\nall green')
process.exit(failures ? 1 : 0)
