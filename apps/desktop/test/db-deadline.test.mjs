// Every database request the main process makes ends by a deadline (audit 2026-10-05 A7-010).
// Run: node --experimental-strip-types test/db-deadline.test.mjs
import assert from 'node:assert/strict'
import { deadlineFor, fetchWithDeadline, DB_DEADLINE_MS, DB_LONG_DEADLINE_MS } from '../src/main/dbDeadline.ts'

/** A fetch that never answers on its own and rejects when its signal ends, as undici does. */
const hanging = (seen) => (input, init) => {
  seen.push(init?.signal)
  return new Promise((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal.reason), { once: true })
  })
}

// AbortSignal.timeout's timer does not hold the process open (it is unref'd); the main process is held
// open by Electron, this probe by one ref'd timer, cleared at the end.
const alive = setTimeout(() => {}, 30_000)

// 1. A request to a database that stops answering ends by the deadline, not after undici's ~300 s.
{
  const seen = []
  const f = fetchWithDeadline(hanging(seen), { ms: 50, longMs: 5_000 })
  const started = Date.now()
  let guard
  const never = new Promise((resolve) => { guard = setTimeout(() => resolve('still waiting'), 2_000) })
  const outcome = await Promise.race([f('http://127.0.0.1:1/rest/v1/journal?select=*').then(() => 'answered', (e) => e?.name), never])
  clearTimeout(guard)
  assert.equal(outcome, 'TimeoutError', 'a request to a database that does not answer did not end by its deadline')
  const took = Date.now() - started
  assert.ok(took < 2_000, `the request ended after ${took} ms, not by its 50 ms deadline`)
  assert.ok(seen[0], 'the request reached fetch with no signal at all')
}

// 2. The caller's own signal still ends the request sooner — composed with the deadline, not replaced.
{
  const seen = []
  const f = fetchWithDeadline(hanging(seen), { ms: 5_000, longMs: 5_000 })
  const caller = new AbortController()
  const pending = f('http://127.0.0.1:1/rest/v1/rpc/schema_version', { method: 'POST', signal: caller.signal })
  caller.abort(new Error('the caller gave up'))
  await assert.rejects(pending, /the caller gave up/)
}

// 3. The long RPCs get the long deadline; everything else the default.
assert.equal(deadlineFor('http://h/rest/v1/rpc/restore_estate_verified'), DB_LONG_DEADLINE_MS)
assert.equal(deadlineFor('http://h/rest/v1/rpc/import_declared_snapshot?x=1'), DB_LONG_DEADLINE_MS)
assert.equal(deadlineFor('http://h/rest/v1/rpc/append_event'), DB_DEADLINE_MS)
assert.equal(deadlineFor('http://h/rest/v1/journal?select=*'), DB_DEADLINE_MS)

// 4. A request that answers in time is passed through unchanged.
{
  const f = fetchWithDeadline(async (input, init) => new Response(JSON.stringify({ url: String(input), method: init?.method }), { status: 200 }), { ms: 1_000 })
  const res = await f('http://h/rest/v1/estates', { method: 'GET' })
  assert.deepEqual(await res.json(), { url: 'http://h/rest/v1/estates', method: 'GET' })
}

clearTimeout(alive)
console.log('db-deadline: PASS — every request ends by its deadline, the caller can end it sooner, long RPCs get longer')
