// The client half of the contention fix (SEC-REQ-014).
//
// Migration 7 makes the database fail fast on a contended append (55P03 after
// its lock_timeout). That is only half a fix: a caller that turns a transient
// 55P03 into a user-visible error has replaced a hang with a false failure.
// This suite drives a fake PostgREST so the retry policy can be proved without
// a database — and proves the three things that actually matter:
//
//   1. a contended append is retried and succeeds
//   2. a NON-contention error is not retried, because the database already
//      decided and asking again only repeats the answer
//   3. giving up says it was contention, not "failed"
//
// The clock and the dice are injected: a test that really slept would be a test
// nobody runs.

import { createJournal, LOCK_NOT_AVAILABLE } from '../src/index.ts'

let failures = 0
const ok = (n) => console.log(`  ok   ${n}`)
const fail = (n, d) => {
  failures++
  console.error(`  FAIL ${n}${d ? ` — ${d}` : ''}`)
}

/** A SupabaseClient-shaped stub: `rpc` returns the next scripted outcome. */
function fakeDb(script) {
  const calls = []
  return {
    calls,
    rpc: async (fn, args) => {
      calls.push({ fn, args })
      const next = script.shift()
      if (!next) throw new Error('fake db ran out of scripted outcomes')
      return next
    }
  }
}

const EVENT = { estateId: 'e1', type: 'project.created@1', actor: { kind: 'system', id: 't' } }
const lockError = { error: { code: LOCK_NOT_AVAILABLE, message: 'canceling statement due to lock timeout' } }
const success = { data: { seq: 7, type: 'project.created@1' }, error: null }

async function t1_retriesContention() {
  const slept = []
  const db = fakeDb([lockError, lockError, success])
  const journal = createJournal(db, {
    maxAttempts: 3,
    backoffMs: 100,
    sleep: async (ms) => void slept.push(ms),
    random: () => 0.5
  })
  try {
    const e = await journal.append(EVENT)
    if (e.seq !== 7) fail('T1 append returned the wrong event', JSON.stringify(e))
    else if (db.calls.length !== 3) fail(`T1 expected 3 attempts, made ${db.calls.length}`)
    else ok(`T1 a contended append is retried and succeeds (attempts: ${db.calls.length})`)
    // 100·2^0·1.0 = 100, 100·2^1·1.0 = 200 — growing, not flat.
    if (slept.length !== 2 || !(slept[1] > slept[0]))
      fail(`T1 backoff is not growing: ${JSON.stringify(slept)}`)
    else ok(`T1 backoff grows between attempts (${slept.join(' -> ')} ms)`)
  } catch (e) {
    fail('T1 a retryable append threw', e.message)
  }
}

async function t2_doesNotRetryOtherErrors() {
  // 22023 is migration 7's unregistered-type refusal: a decision, not a wait.
  const db = fakeDb([
    { error: { code: '22023', message: 'unregistered event type porject.created@1' } },
    success
  ])
  const journal = createJournal(db, { maxAttempts: 3, sleep: async () => {}, random: () => 0.5 })
  try {
    await journal.append(EVENT)
    fail('T2 a rejected event type was retried into success — the door was argued with')
  } catch (e) {
    if (db.calls.length !== 1) fail(`T2 a non-contention error was retried ${db.calls.length} times`)
    else if (!/unregistered event type/.test(e.message))
      fail('T2 the database’s own reason was lost', e.message)
    else ok('T2 a non-contention error fails immediately, carrying the database reason')
  }
}

async function t3_givingUpSaysWhy() {
  const db = fakeDb([lockError, lockError, lockError])
  const journal = createJournal(db, { maxAttempts: 3, sleep: async () => {}, random: () => 0.5 })
  try {
    await journal.append(EVENT)
    fail('T3 an append that never got the lock reported success')
  } catch (e) {
    if (db.calls.length !== 3) fail(`T3 gave up after ${db.calls.length} attempts, wanted 3`)
    else if (!/contending for the estate lock/.test(e.message))
      fail('T3 the give-up message does not say it was contention', e.message)
    else ok(`T3 giving up names contention, not a generic failure (${db.calls.length} attempts)`)
  }
}

async function t4_defaultsAreBounded() {
  // A default of "retry forever" would reintroduce the hang this fix removed.
  const db = fakeDb(Array.from({ length: 50 }, () => lockError))
  const journal = createJournal(db, { sleep: async () => {}, random: () => 0.5 })
  try {
    await journal.append(EVENT)
    fail('T4 the default policy succeeded against a permanently locked estate')
  } catch {
    if (db.calls.length > 5) fail(`T4 the default made ${db.calls.length} attempts — not bounded`)
    else ok(`T4 the default policy is bounded (${db.calls.length} attempts)`)
  }
}

console.log('journal: contention retry policy')
await t1_retriesContention()
await t2_doesNotRetryOtherErrors()
await t3_givingUpSaysWhy()
await t4_defaultsAreBounded()

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED — the retry policy does not hold its contract`)
  process.exit(1)
}
console.log('\nall green: contention is retried, decisions are not, and giving up is honest')
