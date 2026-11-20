// The delivery queue's busy path (2026-11-20, the owner's «what blocks work first»): the owner's messages to a working
// CEO timed out (5 of 20), because a working Claude Code prints its spinner without the quiet the settle rule waits for,
// while it takes a message typed mid-turn (measured that day). An item that waited `busyAfterMs` is written while the
// console keeps printing; never without fresh output, never for an item with a write gate.
import assert from 'node:assert/strict'
import test from 'node:test'
import { DeliveryQueue } from '../src/main/deliveryQueue.ts'

const after = (ms) => new Promise((r) => setTimeout(r, ms))

function spinning(timing) {
  const writes = []
  const q = new DeliveryQueue((t) => writes.push(t), () => true, timing)
  const timer = setInterval(() => q.noteOutput(), 10)
  return { q, writes, stop: () => { clearInterval(timer); q.close() } }
}

test('a working console that never goes quiet takes the item once it waited busyAfterMs', async () => {
  const h = spinning({ settleMs: 40, maxWaitMs: 1500, busyAfterMs: 120 })
  const t0 = Date.now()
  const r = await h.q.enqueue('hello')
  h.stop()
  assert.equal(r.state, 'written')
  assert.ok(Date.now() - t0 < 1000, 'written on the busy path, long before the deadline')
  assert.equal(h.writes.length, 1)
})

test('without busyAfterMs the same console times out, as before (other runners keep the quiet rule)', async () => {
  const h = spinning({ settleMs: 40, maxWaitMs: 300 })
  const r = await h.q.enqueue('hello')
  h.stop()
  assert.deepEqual(r, { state: 'failed_before_write', reason: 'readiness_timeout' })
  assert.equal(h.writes.length, 0)
})

test('the busy path never writes blind: a console that printed nothing since the last write gets nothing', async () => {
  const writes = []
  const q = new DeliveryQueue((t) => writes.push(t), () => true, { settleMs: 20, maxWaitMs: 300, busyAfterMs: 50 })
  const r = await q.enqueue('hello')
  q.close()
  assert.equal(r.reason, 'readiness_timeout')
  assert.equal(writes.length, 0)
})

test('an item with a write gate waits for quiet even on a busy runner', async () => {
  const h = spinning({ settleMs: 40, maxWaitMs: 300, busyAfterMs: 50 })
  let asked = 0
  const r = await h.q.enqueue('hello', { beforeWrite: async () => { asked++; return true } })
  h.stop()
  assert.equal(r.reason, 'readiness_timeout')
  assert.equal(asked, 0)
})

test('a quiet console is still written on the settle rule, before busyAfterMs', async () => {
  const writes = []
  const q = new DeliveryQueue((t) => writes.push(t), () => true, { settleMs: 20, maxWaitMs: 1000, busyAfterMs: 5000 })
  q.noteOutput()
  const t0 = Date.now()
  const r = await q.enqueue('hello')
  q.close()
  assert.equal(r.state, 'written')
  assert.ok(Date.now() - t0 < 500)
  await after(1)
})
