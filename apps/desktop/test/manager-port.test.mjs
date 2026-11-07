// CO-522 wave D, step 4's second half: the manager's tools reach the SAME handlers the window calls, by channel.
// Spec: docs/evidence/specs/2026-11-06-fabric-manager-agent.md §3.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { readFileSync } from 'node:fs'

const root = path.resolve(import.meta.dirname, '..')
const { createManagerPort } = await import(path.join(root, 'src/main/managerPort.ts'))
const { createManagerTools } = await import(path.join(root, 'src/main/managerTools.ts'))
const { IPC } = await import(path.join(root, 'src/shared/types.ts'))

const P = '11111111-1111-4111-8111-111111111111'
const T = '22222222-2222-4222-8222-222222222222'
const S = '33333333-3333-4333-8333-333333333333'

function recorder(answers = {}) {
  const calls = []
  const call = async (channel, ...args) => {
    calls.push([channel, ...args])
    const a = answers[channel]
    if (a instanceof Error) throw a
    return typeof a === 'function' ? a(...args) : (a ?? { ok: true })
  }
  return { calls, call }
}

test('each tool calls its handler by the channel the window uses, with the window\'s arguments', async () => {
  const r = recorder({ [IPC.tasksFileIdea]: { id: T } })
  const tools = createManagerTools(createManagerPort({ call: r.call }), { newKey: () => 'k-1' })
  await tools.call('sessions_list', {})
  await tools.call('work_list', { projectId: P })
  await tools.call('task_get', { taskId: T })
  await tools.call('waiting_for_person', { projectId: P, limit: 3 })
  await tools.call('say_to_session', { sessionId: S, text: 'stop after this test' })
  await tools.call('file_task', { projectId: P, text: 'measure the cold start' })
  await tools.call('assign_across', { fromTaskId: T, toProjectId: P, text: 'take the docs part' })
  assert.deepEqual(r.calls, [
    [IPC.workHome],
    [IPC.workProject, P],
    [IPC.tasksDetail, T],
    [IPC.boardQuery, { projectId: P, limit: 3, personOnly: true }],
    [IPC.workSay, { sessionId: S, text: 'stop after this test' }],
    [IPC.tasksFileIdea, P, 'measure the cold start'],
    [IPC.tasksAssignAcross, { fromTaskId: T, toProjectId: P, text: 'take the docs part', key: 'k-1' }]
  ])
})

test('a person-gated proposal reaches no handler; its confirmation reaches tasks:decide and work:overlapDecide', async () => {
  const r = recorder()
  const port = createManagerPort({ call: r.call })
  const tools = createManagerTools(port)
  const review = await tools.call('decide_review', { taskId: T, decision: 'return', comment: 'add the test' })
  assert.ok(review.proposal)
  assert.deepEqual(r.calls, [])
  const { confirmProposal } = await import(path.join(root, 'src/main/managerTools.ts'))
  assert.deepEqual(await confirmProposal(review.proposal, port), { ok: true })
  const key = `overlap-unsettled:${T}:${S}`
  assert.deepEqual(await confirmProposal({ tool: 'decide_overlap', args: { key, choice: 'wait' } }, port), { ok: true })
  assert.deepEqual(r.calls, [[IPC.tasksDecide, T, 'return', 'add the test'], [IPC.workOverlapDecide, { key, choice: 'wait' }]])
})

test('a handler that throws or answers without ok is a refusal the model reads, never a success', async () => {
  const r = recorder({
    [IPC.tasksFileIdea]: new Error('an idea needs a title'),
    [IPC.workSay]: { ok: false, reason: 'Fabric is still starting' },
    [IPC.tasksDecide]: 'done',
    [IPC.tasksAssignAcross]: new Error('the board refused')
  })
  const tools = createManagerTools(createManagerPort({ call: r.call }))
  assert.deepEqual(await tools.call('file_task', { projectId: P, text: 'x' }), { ok: false, reason: 'door-refused', says: 'an idea needs a title' })
  assert.deepEqual(await tools.call('say_to_session', { sessionId: S, text: 'hi' }), { ok: false, reason: 'door-refused', says: 'Fabric is still starting' })
  assert.deepEqual(await tools.call('assign_across', { fromTaskId: T, toProjectId: P, text: 'y' }), { ok: false, reason: 'door-refused', says: 'the board refused' })
  const port = createManagerPort({ call: r.call })
  assert.deepEqual(await port.decideReview(T, 'accept', ''), { ok: false, reason: 'the door answered without ok' })
})

test('a filed task that does not read back is not filed', async () => {
  const r = recorder({ [IPC.tasksFileIdea]: null })
  const port = createManagerPort({ call: r.call })
  assert.deepEqual(await port.fileTask(P, 'z'), { ok: false, reason: 'the task was not read back' })
})

test('asking the person without a conversation says it is not wired, so the model never believes it asked', async () => {
  const tools = createManagerTools(createManagerPort({ call: recorder().call }))
  const a = await tools.call('ask_person', { text: 'Which model?', options: ['Kimi', 'Sonnet'] })
  assert.equal(a.ok, false)
  assert.match(a.says, /not wired/)
  const asked = []
  const wired = createManagerTools(createManagerPort({ call: recorder().call, ask: async (text, options) => { asked.push([text, options]); return { ok: true, questionId: 'q' } } }))
  assert.equal((await wired.call('ask_person', { text: 'Which model?', options: ['Kimi', 'Sonnet'] })).ok, true)
  assert.deepEqual(asked, [['Which model?', ['Kimi', 'Sonnet']]])
})

test('every channel the port calls has a handler registered in index.ts, so a renamed door fails here', () => {
  const index = readFileSync(path.join(root, 'src/main/index.ts'), 'utf8')
  const port = readFileSync(path.join(root, 'src/main/managerPort.ts'), 'utf8')
  const used = [...new Set([...port.matchAll(/IPC\.([A-Za-z]+)/g)].map((m) => m[1]))]
  assert.ok(used.length >= 9)
  for (const name of used) assert.match(index, new RegExp(`handle\\(\\s*IPC\\.${name},`), `no handler for IPC.${name}`)
  assert.match(index, /doors\.set\(channel, fn\)/)
})
