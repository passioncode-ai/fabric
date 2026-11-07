// CO-522 wave D, step 4's first half: the manager's closed tool set over Fabric's existing doors, before any model.
// Spec: docs/evidence/specs/2026-11-06-fabric-manager-agent.md §3.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { MANAGER_TOOLS, TOOL_CALLS_PER_MESSAGE, createManagerTools, confirmProposal } = await import(path.resolve(import.meta.dirname, '../src/main/managerTools.ts'))

const P = '11111111-1111-4111-8111-111111111111'
const T = '22222222-2222-4222-8222-222222222222'
const S = '33333333-3333-4333-8333-333333333333'
function port() {
  const calls = []
  const ok = (name) => async (...a) => { calls.push([name, ...a]); return { ok: true } }
  return {
    calls,
    sessions: async () => { calls.push(['sessions']); return [{ sessionId: S }] },
    work: async (p) => { calls.push(['work', p]); return { claims: [] } },
    task: async (t) => { calls.push(['task', t]); return { id: t } },
    waiting: async (p, l) => { calls.push(['waiting', p, l]); return [] },
    say: ok('say'), fileTask: ok('fileTask'), assignAcross: ok('assignAcross'),
    decideReview: ok('decideReview'), decideOverlap: ok('decideOverlap'), ask: ok('ask')
  }
}

test('the set is closed: ten tools, each a read, an act or a person-gated act, each describing its neighbour where it has one', () => {
  assert.deepEqual(Object.keys(MANAGER_TOOLS), ['sessions_list', 'work_list', 'task_get', 'waiting_for_person', 'say_to_session', 'file_task', 'assign_across', 'decide_review', 'decide_overlap', 'ask_person'])
  assert.deepEqual(Object.entries(MANAGER_TOOLS).filter(([, t]) => t.kind === 'person-gated').map(([n]) => n), ['decide_review', 'decide_overlap'])
  assert.match(MANAGER_TOOLS.say_to_session.description, /file_task/)
  assert.match(MANAGER_TOOLS.file_task.description, /say_to_session/)
})

test('reads and acts reach their door with checked arguments; an unknown tool, a wrong enum or an extra field never does', async () => {
  const p = port()
  const tools = createManagerTools(p, { newKey: () => 'k1' })
  assert.equal((await tools.call('sessions_list', {})).ok, true)
  assert.equal((await tools.call('say_to_session', { sessionId: S, text: 'pause and rebase' })).ok, true)
  assert.equal((await tools.call('assign_across', { fromTaskId: T, toProjectId: P, text: 'do it there' })).ok, true)
  assert.deepEqual(p.calls.map((c) => c[0]), ['sessions', 'say', 'assignAcross'])
  assert.equal(p.calls[2][4], 'k1', 'a hand-over carries a fresh idempotency key')
  assert.equal((await tools.call('delete_everything', {})).reason, 'unknown-tool')
  assert.equal((await tools.call('decide_review', { taskId: T, decision: 'approve' })).reason, 'invalid-arguments')
  assert.equal((await tools.call('file_task', { projectId: P, text: 'x', priority: 'high' })).reason, 'invalid-arguments')
  assert.equal((await tools.call('say_to_session', { sessionId: 'not-a-uuid', text: 'x' })).reason, 'invalid-arguments')
  assert.equal(p.calls.length, 3, 'nothing refused reached a door')
})

test('a person-gated act never runs: it comes back as a proposal, and only the person\'s click applies it', async () => {
  const p = port()
  const tools = createManagerTools(p)
  const a = await tools.call('decide_review', { taskId: T, decision: 'accept' })
  assert.equal(a.ok, true)
  assert.equal(a.proposal.tool, 'decide_review')
  const b = await tools.call('decide_overlap', { key: `overlap-unsettled:${T}:${S}`, choice: 'wait' })
  assert.equal(b.proposal.tool, 'decide_overlap')
  assert.equal(p.calls.length, 0, 'no decision door was called')
  await confirmProposal(a.proposal, p)
  await confirmProposal(b.proposal, p)
  assert.deepEqual(p.calls, [['decideReview', T, 'accept', ''], ['decideOverlap', `overlap-unsettled:${T}:${S}`, 'wait']])
})

test('one message is held to twelve tool calls; a new message starts again', async () => {
  const tools = createManagerTools(port())
  for (let i = 0; i < TOOL_CALLS_PER_MESSAGE; i++) assert.equal((await tools.call('sessions_list', {})).ok, true)
  assert.equal((await tools.call('sessions_list', {})).reason, 'budget-spent')
  tools.newMessage()
  assert.equal((await tools.call('sessions_list', {})).ok, true)
})

test('a door that refuses or throws is said in one line, never retried', async () => {
  const p = port()
  p.say = async () => ({ ok: false, reason: 'that session ended' })
  p.fileTask = async () => { throw new Error('the database did not answer') }
  const tools = createManagerTools(p)
  assert.deepEqual(await tools.call('say_to_session', { sessionId: S, text: 'x' }), { ok: false, reason: 'door-refused', says: 'that session ended' })
  const f = await tools.call('file_task', { projectId: P, text: 'x' })
  assert.equal(f.reason, 'door-failed')
  assert.match(f.says, /did not answer/)
})
