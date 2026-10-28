// CO-478, ADR-0184: an agent closes a task only on the operator's relayed decision (DEC-0121 AP-2).
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { checkRelayedClose, namesTask, CLOSE_ACTION } = await import(path.resolve(import.meta.dirname, '../src/main/relayedClose.ts'))

const taskId = 'c3d81d42-1111-4222-8333-444455556666'
const now = Date.parse('2026-10-27T03:00:00Z')
const decision = (over = {}) => ({ by: 'operator', via: 'relayed-instruction', action: 'task.close', target: 'c3d81d42', instruction: 'Отменить 6 карточек волн. - сделай', at: '2026-10-27T02:40:00Z', source: { project: 'prowlagent', session: '5fefe0d0-335c-4f85-9606-42c8a54bc9c4' }, ...over })

test('without a decision the answer is operator-decision-required, naming the action and the task', () => {
  const v = checkRelayedClose(undefined, taskId, now)
  assert.equal(v.ok, false)
  assert.equal(v.code, 'operator-decision-required')
  assert.deepEqual(v.data, { action: CLOSE_ACTION, target: taskId })
})

test('a decision naming this task by its short id, said before now, is accepted', () => {
  const v = checkRelayedClose(decision(), taskId, now)
  assert.equal(v.ok, true)
  assert.equal(v.decision.instruction, 'Отменить 6 карточек волн. - сделай')
})

test('a malformed decision, another action, another task, no target or a future time is decision-invalid', () => {
  for (const bad of [
    { by: 'agent' },
    decision({ via: 'guess' }),
    decision({ action: 'task.move' }),
    decision({ target: 'ffffffff' }),
    decision({ target: undefined }),
    decision({ target: 'c3d8' }),
    decision({ at: '2026-10-27T03:10:00Z' }),
    decision({ instruction: '' })
  ]) {
    const v = checkRelayedClose(bad, taskId, now)
    assert.equal(v.ok, false, JSON.stringify(bad))
    assert.equal(v.code, 'decision-invalid', JSON.stringify(bad))
  }
})

test('a target is the task id or a prefix of at least 8 characters, in any case', () => {
  assert.equal(namesTask(taskId.toUpperCase(), taskId), true)
  assert.equal(namesTask('C3D81D42-1111', taskId), true)
  assert.equal(namesTask('c3d81d4', taskId), false)
  assert.equal(namesTask('the wave cards', taskId), false)
})
