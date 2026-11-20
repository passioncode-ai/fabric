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

test('0.3.27 review DO-6: a first instruction (quietOnly) is never written while a start-up still prints', async () => {
  const h = spinning({ settleMs: 40, maxWaitMs: 400, busyAfterMs: 60 })
  const r = await h.q.enqueue('the first task', { quietOnly: true })
  h.stop()
  assert.deepEqual(r, { state: 'failed_before_write', reason: 'readiness_timeout' })
  assert.equal(h.writes.length, 0)
})

// 2026-11-20: the first task of a session the CEO started was lost again (0daa75f1, e150fe59). Measured on this Mac:
// Claude Code prints a cursor save and restore about 3 s after its start, then nothing while its start-up hooks run; the
// settle rule took that quiet for ready, and the paste was dropped before the input box existed. Written once the box's
// footer shows, the task was taken in every run.
import { claudePromptDrawn } from '../src/shared/delivery.ts'

test('Claude Code: nothing is typed before its input box is drawn, however quiet the start is', async () => {
  const writes = []
  const q = new DeliveryQueue((t) => writes.push(t), () => true, { settleMs: 30, maxWaitMs: 2000, busyAfterMs: 60, promptDrawn: claudePromptDrawn })
  const r = q.enqueue('the task')
  q.noteOutput('\x1b7\x1b8')
  await after(300)
  assert.equal(writes.length, 0, 'the start-up quiet is not the prompt')
  assert.equal(q.ready, false)
  // The box is drawn in pieces; the footer arrives in its own chunk, with colour codes between the words.
  q.noteOutput('\x1b[2m────────────────────────────\x1b[0m\r\n⏵⏵ auto mode on\r\n (shift+tab ')
  q.noteOutput('\x1b[2mto cycle)\x1b[0m')
  assert.equal(q.ready, true)
  assert.deepEqual(await r, { state: 'written' })
  assert.equal(writes.length, 1)
  q.close()
})

test('Claude Code in its default mode: «? for shortcuts» is the drawn prompt too', () => {
  assert.equal(claudePromptDrawn('> \n  ? for shortcuts'), true)
  assert.equal(claudePromptDrawn('╭───────────────╮\n│ ✻ Welcome to Claude Code │'), false)
})

test('a prompt never recognised does not hold the queue forever: after its wait the settle rule alone applies', async () => {
  const writes = []
  const q = new DeliveryQueue((t) => writes.push(t), () => true, { settleMs: 20, maxWaitMs: 2000, promptDrawn: () => false, promptWaitMs: 200 })
  const r = q.enqueue('hello')
  q.noteOutput('some other screen')
  await after(100)
  assert.equal(writes.length, 0)
  q.noteOutput('still printing')
  assert.deepEqual(await r, { state: 'written' })
  q.close()
})

test('the busy path does not jump the prompt: a working start-up waits for the box too', async () => {
  const writes = []
  const q = new DeliveryQueue((t) => writes.push(t), () => true, { settleMs: 20, maxWaitMs: 600, busyAfterMs: 30, promptDrawn: claudePromptDrawn, promptWaitMs: 5000 })
  const timer = setInterval(() => q.noteOutput('⠋ starting'), 10)
  const r = await q.enqueue('hello')
  clearInterval(timer)
  q.close()
  assert.equal(r.reason, 'readiness_timeout')
  assert.equal(writes.length, 0)
})

test('run four: a hint drawn with cursor moves for its spaces is the prompt (UX-44)', async () => {
  const q = new DeliveryQueue(() => {}, () => true, { settleMs: 20, maxWaitMs: 2000, promptDrawn: claudePromptDrawn })
  assert.equal(q.ready, false)
  q.noteOutput('  ?\x1b[1Cfor\x1b[1Cshortcuts')
  assert.equal(q.ready, true)
  q.close()
})
