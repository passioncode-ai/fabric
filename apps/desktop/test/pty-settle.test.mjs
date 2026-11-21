// CO-625: before the quit's last app.quit(), every console's exit is delivered while the event loop still runs, so no
// node-pty exit arrives during Node's teardown (which aborted Fabric with SIGABRT on a signalled stop).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { settleExits } from '../src/main/ptySettle.ts'

function clock() {
  let t = 0
  return { now: () => t, sleep: async (ms) => { t += ms } }
}

test('nothing pending: nothing waited, nothing killed', async () => {
  assert.deepEqual(await settleExits(() => [], clock()), { waited: 0, killed: 0, left: 0 })
})

test('a console whose exit arrives within the grace is waited for and never killed', async () => {
  const c = clock()
  let left = [{ sessionId: 'a', kill: () => { throw new Error('must not be killed') } }]
  const sleep = async (ms) => { await c.sleep(ms); if (c.now() >= 300) left = [] }
  const r = await settleExits(() => left, { now: c.now, sleep, graceMs: 1500, killMs: 700 })
  assert.equal(r.killed, 0)
  assert.equal(r.left, 0)
  assert.ok(r.waited >= 300 && r.waited < 1500)
})

test('a console still running after the grace is sent SIGKILL and its exit waited for', async () => {
  const c = clock()
  const signals = []
  let alive = true
  const pending = () => (alive ? [{ sessionId: 'b', kill: (s) => { signals.push(s); setTimeout(() => {}, 0); alive = 'dying' } }] : [])
  const sleep = async (ms) => { await c.sleep(ms); if (alive === 'dying' && c.now() > 1600) alive = false }
  const r = await settleExits(pending, { now: c.now, sleep, graceMs: 1500, killMs: 700 })
  assert.deepEqual(signals, ['SIGKILL'])
  assert.equal(r.killed, 1)
  assert.equal(r.left, 0)
})

test('the whole settle is bounded: a console that never exits is left after grace plus kill wait', async () => {
  const c = clock()
  const r = await settleExits(() => [{ sessionId: 'c', kill: () => {} }], { ...c, graceMs: 1500, killMs: 700 })
  assert.equal(r.left, 1)
  assert.ok(r.waited >= 2200 && r.waited <= 2300)
})

test('a console already gone when killed is not counted as killed and does not stop the others', async () => {
  const c = clock()
  const signals = []
  const r = await settleExits(() => [
    { sessionId: 'gone', kill: () => { throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' }) } },
    { sessionId: 'live', kill: (s) => signals.push(s) }
  ], { ...c, graceMs: 100, killMs: 100 })
  assert.equal(r.killed, 1)
  assert.deepEqual(signals, ['SIGKILL'])
})
