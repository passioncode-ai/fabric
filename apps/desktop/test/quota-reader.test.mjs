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

import { createQuotaReader } from '../src/main/quota.ts'
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

console.log(failures ? '\n  FAIL ' + failures + ' failure(s)' : '\nall green')
process.exit(failures ? 1 : 0)
