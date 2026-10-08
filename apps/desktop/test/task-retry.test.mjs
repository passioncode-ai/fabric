// A retry of an onboarding launch is the same task: the id the window chose is reused, never a second task.
import assert from 'node:assert/strict'
import { planTaskStart } from '../src/main/taskRetry.ts'

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const reads = []
const reader = (row, error = null) => async (id) => { reads.push(id); return { data: row, error } }

assert.deepEqual(await planTaskStart({ projectId: 'p' }, reader(null)), { kind: 'new', taskId: undefined }, 'no id: a new task, nothing read')
assert.equal(reads.length, 0)
assert.deepEqual(await planTaskStart({ projectId: 'p', taskId: ID }, reader(null)), { kind: 'new', taskId: ID }, 'first try: recorded under the caller id')
const row = { id: ID, project_id: 'p', status: 'backlog' }
assert.deepEqual(await planTaskStart({ projectId: 'p', taskId: ID }, reader(row)), { kind: 'again', task: row }, 'retry: the recorded task is started again')
assert.deepEqual(await planTaskStart({ projectId: 'p', taskId: ID }, reader(row), (id) => (id === ID ? 'sess-1' : null)),
  { kind: 'running', task: row, sessionId: 'sess-1' }, 'a session this process already runs for the task is brought forward, not refused')
assert.deepEqual(await planTaskStart({ projectId: 'p', taskId: ID }, reader(row), () => null), { kind: 'again', task: row })
await assert.rejects(planTaskStart({ projectId: 'q', taskId: ID }, reader(row)), /task-id-refused: the task belongs to another project/)
await assert.rejects(planTaskStart({ projectId: 'p', taskId: 'not-a-uuid' }, reader(null)), /task-id-refused: not an id/)
await assert.rejects(planTaskStart({ projectId: 'p', taskId: 42 }, reader(null)), /task-id-refused: not an id/)
await assert.rejects(planTaskStart({ projectId: 'p', taskId: ID }, reader(null, { message: 'connection refused' })), /could not be read.*connection refused/, 'a failed read is not "no such task"')
console.log('PASS task retry: a caller id is the same task on retry; a foreign, malformed or unread id is refused; a running one is brought forward')
