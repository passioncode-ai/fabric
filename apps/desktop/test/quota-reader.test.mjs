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

// ── a non-200 is still a rejection ───────────────────────────────────────────
{
  const q = await reader({ five_hour: { utilization: 1, resets_at: null } }, 500).read()
  q === null
    ? ok('a 500 with no previous reading answers null rather than a number nobody has')
    : fail('500 produced: ' + JSON.stringify(q))
}

console.log(failures ? '\n  FAIL ' + failures + ' failure(s)' : '\nall green')
process.exit(failures ? 1 : 0)
