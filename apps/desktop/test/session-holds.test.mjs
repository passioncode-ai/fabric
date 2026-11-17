// The turn-end spec §4.4 (T4): a Claude Code session holding a claim is held by Switchboard until its newest claim
// expires, renewed as the claims are, released when it holds none; one call per change of a minute or more.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { holdUntil, createSessionHolds, HOLD_MAX_MS } = await import(path.resolve(import.meta.dirname, '../src/main/sessionHolds.ts'))

const NOW = Date.parse('2026-11-16T22:00:00Z')
const iso = (ms) => new Date(ms).toISOString()

test('T4: the hold ends at the newest live claim, at most seven days ahead; none live is a release (0)', () => {
  assert.equal(holdUntil([iso(NOW + 10 * 60_000), iso(NOW + 30 * 60_000)], NOW), Math.floor((NOW + 30 * 60_000) / 1000))
  assert.equal(holdUntil([iso(NOW + 30 * 24 * 3_600_000)], NOW), Math.floor((NOW + HOLD_MAX_MS) / 1000))
  assert.equal(holdUntil([], NOW), 0)
  assert.equal(holdUntil([iso(NOW - 1000), 'not a date'], NOW), 0)
})

function holds(answer = () => ({ code: 0, stderr: '' })) {
  const calls = [], failures = []
  const h = createSessionHolds({
    hold: async (sessionId, until) => { calls.push([sessionId, until]); return answer(sessionId, until) },
    failed: (sessionId, until, why) => failures.push([sessionId, until, why])
  })
  return { h, calls, failures }
}

test('T4: one call per change of a minute or more; a release only of a held session; a bad id is never passed', async () => {
  const { h, calls } = holds()
  const until = Math.floor(NOW / 1000) + 1800
  await h.set('sess-1', until)
  await h.set('sess-1', until + 30) // within a minute: not asked again
  await h.set('sess-1', until + 300) // the renewal moved it five minutes: asked
  await h.set('sess-2', 0) // never held: no release
  await h.set('sess-1', 0)
  await h.set('sess-1', 0) // released already
  await h.set('../etc;rm', until)
  assert.deepEqual(calls, [['sess-1', until], ['sess-1', until + 300], ['sess-1', 0]])
  assert.equal(h.asked('sess-1'), undefined)
})

test('T4: a refused or failed hold is said and not remembered, so the next change asks again', async () => {
  let n = 0
  const { h, calls, failures } = holds(() => { n++; if (n === 1) return { code: 2, stderr: 'no such session\n' }; if (n === 2) throw new Error('timed out'); return { code: 0, stderr: '' } })
  const until = Math.floor(NOW / 1000) + 1800
  await h.set('sess-1', until)
  await h.set('sess-1', until)
  await h.set('sess-1', until)
  assert.equal(calls.length, 3)
  assert.deepEqual(failures.map((f) => f[2]), ['exit 2: no such session', 'timed out'])
  assert.equal(h.asked('sess-1'), until)
})
