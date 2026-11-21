// ADR-0197 Amendment 5 (the owner, 2026-11-21): the CEO's ceo.task slot is held by Fabric while its console lives, and a
// ceo.task request that waits wakes a console that does not run.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCeoBoardKeeper, waitingForCeo, WAKE_GAP_MS } from '../src/main/ceoBoardKeeper.ts'

const P = '87b288a4-2196-46a3-9d54-69e3f649ea53'
const req = (over = {}) => ({ requestId: 'r1', to: P, capability: 'ceo.task', subject: 'x', state: 'queued', from: 'p2', ...over })

function rig(over = {}) {
  const calls = { keep: [], ensure: 0, records: [] }
  let t = 1_000_000
  const deps = {
    state: () => 'running', sessionId: () => 's1', projectId: () => P,
    keepSlot: async (id, cap) => { calls.keep.push([id, cap]); return 'kept' },
    ensure: async () => { calls.ensure++ },
    record: (op, outcome, detail) => calls.records.push({ op, outcome, detail }),
    now: () => t,
    ...over
  }
  return { keeper: createCeoBoardKeeper(deps), calls, tick: (ms) => { t += ms } }
}

test('while the console runs, Fabric holds the ceo.task slot as its session, and logs only a change', async () => {
  const { keeper, calls } = rig()
  assert.equal(await keeper.keep(), 'kept')
  assert.equal(await keeper.keep(), 'kept')
  assert.deepEqual(calls.keep, [['s1', 'ceo.task'], ['s1', 'ceo.task']])
  assert.equal(calls.records.filter((r) => r.op === 'ceo.board-slot').length, 1)
})

test('no console, no hold: the slot goes stale a minute after the console ends', async () => {
  const { keeper, calls } = rig({ state: () => 'ended' })
  assert.equal(await keeper.keep(), 'not-running')
  assert.equal(calls.keep.length, 0)
})

test('a slot another live session holds is said once as held-by-other; a throw is unavailable, never a crash', async () => {
  const a = rig({ keepSlot: async () => 'held-by-other' })
  assert.equal(await a.keeper.keep(), 'held-by-other')
  assert.equal(a.calls.records[0].outcome, 'failed')
  const b = rig({ keepSlot: async () => { throw new TypeError('db') } })
  assert.equal(await b.keeper.keep(), 'unavailable')
})

test('a waiting ceo.task request wakes a console that does not run, at most once per gap', async () => {
  const { keeper, calls, tick } = rig({ state: () => 'ended' })
  assert.equal(await keeper.wake([req()]), 'woken')
  assert.equal(calls.ensure, 1)
  assert.equal(await keeper.wake([req()]), 'too-soon')
  tick(WAKE_GAP_MS)
  assert.equal(await keeper.wake([req()]), 'woken')
  assert.equal(calls.ensure, 2)
})

test('nothing wakes it without a waiting request for its own project and capability', async () => {
  const { keeper, calls } = rig({ state: () => 'idle' })
  assert.equal(await keeper.wake([req({ state: 'claimed' }), req({ capability: 'other.cap' }), req({ to: 'another' })]), 'nothing-waits')
  assert.equal(calls.ensure, 0)
  const running = rig()
  assert.equal(await running.keeper.wake([req()]), 'running')
  assert.equal(running.calls.ensure, 0)
  const unknown = rig({ projectId: () => null, state: () => 'idle' })
  assert.equal(await unknown.keeper.wake([req()]), 'no-project')
})

test('waitingForCeo takes queued and never-moved requests only', () => {
  assert.deepEqual(waitingForCeo([req(), req({ requestId: 'r2', state: null }), req({ requestId: 'r3', state: 'answered' })], P).map((r) => r.requestId), ['r1', 'r2'])
})
