// A retry of an onboarding launch is the same task: the id the window chose is reused, never a second task.
import assert from 'node:assert/strict'
import { createKeyedQueue, liveSessionOf, planTaskStart, refuseSetupWithoutSurface } from '../src/main/taskRetry.ts'

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const reads = []
const reader = (row, error = null) => async (id) => { reads.push(id); return { data: row, error } }

assert.deepEqual(await planTaskStart({ projectId: 'p' }, reader(null)), { kind: 'new', taskId: undefined }, 'no id: a new task, nothing read')
assert.equal(reads.length, 0)
assert.deepEqual(await planTaskStart({ projectId: 'p', taskId: ID }, reader(null)), { kind: 'new', taskId: ID }, 'first try: recorded under the caller id')
const row = { id: ID, project_id: 'p', status: 'backlog' }
const runningRow = { ...row, status: 'running' }
assert.deepEqual(await planTaskStart({ projectId: 'p', taskId: ID }, reader(row)), { kind: 'again', task: row }, 'retry: the recorded task is started again')
assert.deepEqual(await planTaskStart({ projectId: 'p', taskId: ID }, reader(row), (id) => (id === ID ? 'sess-1' : null)),
  { kind: 'again', task: row }, 'a process left by a failed launch, with the task still in backlog, is not "running" (iteration 2, ER-2)')
assert.deepEqual(await planTaskStart({ projectId: 'p', taskId: ID }, reader(runningRow), (id) => (id === ID ? 'sess-1' : null)),
  { kind: 'running', task: runningRow, sessionId: 'sess-1' }, 'a session this process already runs for the task is brought forward, not refused')
assert.deepEqual(await planTaskStart({ projectId: 'p', taskId: ID }, reader(row), () => null), { kind: 'again', task: row })
await assert.rejects(planTaskStart({ projectId: 'q', taskId: ID }, reader(row)), /task-refused:other-project/)
await assert.rejects(planTaskStart({ projectId: 'p', taskId: 'not-a-uuid' }, reader(null)), /task-refused:not-an-id/)
await assert.rejects(planTaskStart({ projectId: 'p', taskId: 42 }, reader(null)), /task-refused:not-an-id/)
await assert.rejects(planTaskStart({ projectId: 'p', taskId: ID }, reader(null, { message: 'connection refused' })), /task-refused:read-failed: connection refused/, 'a failed read is not "no such task"')
const tracked = new Map([['old', ID], ['other', 'x'], ['new', ID], ['ended', ID]])
const running = new Set(['old', 'new', 'other'])
assert.equal(liveSessionOf(tracked, (s) => running.has(s), ID), 'new', 'the newest RUNNING session of the task, never an ended one')
assert.equal(liveSessionOf(new Map([['ended', ID]]), () => false, ID), null, 'an ended session is not brought forward: the task starts again')
{ // DA-8: two starts with one id run one after the other; other ids do not wait; a failure does not jam the key.
  const queue = createKeyedQueue(), log = []
  let release
  const gate = new Promise((r) => { release = r })
  const first = queue('a', async () => { log.push('a1 in'); await gate; log.push('a1 out'); return 1 })
  const second = queue('a', async () => { log.push('a2'); return 2 })
  const other = queue('b', async () => { log.push('b'); return 3 })
  await other
  assert.deepEqual(log, ['a1 in', 'b'], 'another key runs at once; the same key waits')
  release()
  assert.deepEqual(await Promise.all([first, second]), [1, 2])
  assert.deepEqual(log, ['a1 in', 'b', 'a1 out', 'a2'])
  await assert.rejects(queue('c', async () => { throw new Error('boom') }), /boom/)
  assert.equal(await queue('c', async () => 'after'), 'after', 'a failed start does not jam the next one')
}
{ // iteration 2: the setup preset only on a runner that connects to Fabric's tools, whatever the window chose.
  assert.doesNotThrow(() => refuseSetupWithoutSurface('claude-code'))
  for (const r of ['codex', 'cline', 'kimi-code', 'shell', 'not-a-runner']) assert.throws(() => refuseSetupWithoutSurface(r), /task-refused:setup-needs-surface/, r)
  assert.throws(() => refuseSetupWithoutSurface('claude-code', false), /task-refused:setup-surface-down/, 'iteration 3: the surface not listening')
}
console.log('PASS task retry: a caller id is the same task on retry; a foreign, malformed or unread id is refused; a running one is brought forward, an ended one is not; one id at a time')
