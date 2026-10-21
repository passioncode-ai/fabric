// 0.3.9 BD-5/BD-6 (docs/evidence/plans/2026-10-21-core-reliability/2026-10-21-board.md): what the IPC wrapper records for a call.
// A reply that says it failed is never logged as ok; a channel polled on a clock does not write one line per tick.
// #region board-core-holds — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#board
import assert from 'node:assert/strict'
import test from 'node:test'
import { createIpcOutcomeLog, QUIET_WHEN_OK } from '../src/main/ipcOutcome.ts'

test('a reply carrying ok: false is a failed or refused call, never ok', () => {
  const log = createIpcOutcomeLog()
  assert.deepEqual(log.decide('comms:pending', { ok: true, projects: [] }), { outcome: 'ok' })
  assert.deepEqual(log.decide('comms:pending', { ok: false, error: { code: 'unavailable', message: 'down' } }), { outcome: 'failed', detail: { reply: 'unavailable' } })
  assert.deepEqual(log.decide('comms:pending', { ok: false, error: { code: 'invalid_arguments', message: 'no' } }), { outcome: 'unknown', detail: { reply: 'invalid_arguments' } })
  assert.deepEqual(log.decide('comms:open-artifact', { ok: false, reason: 'refused' }), { outcome: 'unknown', detail: { reply: 'refused' } })
  assert.deepEqual(log.decide('comms:pending', { ok: false }), { outcome: 'failed', detail: { reply: 'ok:false' } })
  for (const plain of [undefined, null, 3, 'x', [], { saved: true }]) assert.deepEqual(log.decide('settings:write', plain), { outcome: 'ok' })
})

test('the badge poll: a success writes no line; a failure writes one when it starts or changes, and again after a recovery', () => {
  assert.ok(QUIET_WHEN_OK.has('comms:heads'))
  const log = createIpcOutcomeLog()
  const ok = { ok: true, heads: [], truncated: false }
  const down = { ok: false, error: { code: 'unavailable', message: 'the board answered with something that is not the thread heads' } }
  for (let i = 0; i < 3; i++) assert.equal(log.decide('comms:heads', ok), null, 'a successful tick is not logged')
  assert.deepEqual(log.decide('comms:heads', down), { outcome: 'failed', detail: { reply: 'unavailable' } })
  assert.equal(log.decide('comms:heads', down), null, 'the same failure on the next tick is not logged again')
  assert.deepEqual(log.decide('comms:heads', ok), { outcome: 'ok', detail: { recovered: true } }, 'the recovery is said once')
  assert.equal(log.decide('comms:heads', ok), null)
  assert.deepEqual(log.decide('comms:heads', down), { outcome: 'failed', detail: { reply: 'unavailable' } })
})
// #endregion board-core-holds
