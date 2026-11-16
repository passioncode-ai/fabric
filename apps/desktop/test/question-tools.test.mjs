// The screens waves S2 (2026-11-16): the owner's questions, moved out of `agentSurface.ts#serverFor` into
// `questionTools.ts`, still reach the owner from the session's own project: an ask is one `question.asked@1` written for
// the server's project and author, a retry with the same command id is the same question, a foreign task is refused
// before anything is written, and a question of another project reads as none.
import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { AgentSurface } from '../src/main/agentSurface.ts'

const ESTATE = '87000000-0000-4000-8000-000000000001', PROJECT = '87000000-0000-4000-8000-000000000012', OTHER = '87000000-0000-4000-8000-000000000013'
const OWN_TASK = '87000000-0000-4000-8000-0000000000a1', FOREIGN_TASK = '87000000-0000-4000-8000-0000000000a2'
const ASKED = '87000000-0000-4000-8000-0000000000c1', SEEN_Q = '87000000-0000-4000-8000-0000000000b1', FOREIGN_Q = '87000000-0000-4000-8000-0000000000b2'
const scope = { estateId: ESTATE, projectId: PROJECT, sessionId: 'session-s', taskId: null, cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: null, surface: 'session', bindingId: null }

// Rows by table, each with its estate and project; the scoped store adds those filters itself.
function fakeDb(rows) {
  return {
    rpc: async () => ({ data: { ok: true }, error: null }),
    from(table) {
      const filters = []
      const matched = () => (rows[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v))
      const b = {
        select: () => b,
        eq: (k, v) => { filters.push([k, v]); return b },
        maybeSingle: async () => ({ data: matched()[0] ?? null, error: null }),
        then: (ok, no) => Promise.resolve({ data: matched(), error: null }).then(ok, no)
      }
      return b
    }
  }
}
const ROWS = {
  project_tasks: [
    { id: OWN_TASK, estate_id: ESTATE, project_id: PROJECT, status: 'running', title: 'Own', instruction: 'x' },
    { id: FOREIGN_TASK, estate_id: ESTATE, project_id: OTHER, status: 'running', title: 'Foreign', instruction: 'y' }
  ],
  questions: [
    { id: SEEN_Q, estate_id: ESTATE, project_id: PROJECT, asked_command_id: ASKED, status: 'answered', seq: 4, answer: 'Ship now', chosen_option: 'now', answered_at: '2026-11-16T11:00:00Z', text: 'When?' },
    { id: FOREIGN_Q, estate_id: ESTATE, project_id: OTHER, status: 'open', seq: 5, text: 'Not yours' }
  ],
  question_blocks: [{ question_id: SEEN_Q, task_id: OWN_TASK, estate_id: ESTATE, project_id: PROJECT }]
}

async function linked(server, run) {
  const client = new Client({ name: 'question-tools', version: '1.0.0' })
  const [ct, st] = InMemoryTransport.createLinkedPair()
  try { await server.connect(st); await client.connect(ct); return await run(client) } finally { await client.close(); await server.close() }
}
const parsed = (out) => JSON.parse(out.content[0].text)
function surface() {
  const appended = []
  const journal = { append: async (e) => { appended.push(e); return { seq: 10 + appended.length } } }
  return { appended, surface: new AgentSurface({ db: fakeDb(ROWS), journal, ptys: () => undefined, estateId: ESTATE }) }
}

test('an ask is one question.asked@1 for the server\'s project and author, blocking the project\'s own task', async () => {
  const { surface: s, appended } = surface()
  await linked(s.serverFor(scope), async (client) => {
    const out = parsed(await client.callTool({ name: 'fabric_question_ask', arguments: {
      commandId: '87000000-0000-4000-8000-0000000000c2', text: 'Release 0.3.22 now or with wave 5?', blocks: [OWN_TASK],
      options: [{ id: 'now', label: 'Now', consequence: 'ships today', recommended: true }, { id: 'later', label: 'With wave 5' }] } }))
    assert.equal(out.asked, true, JSON.stringify(out))
    assert.equal(out.repeated, false)
    assert.equal(out.blocks, 1)
  })
  assert.equal(appended.length, 1)
  assert.equal(appended[0].type, 'question.asked@1')
  assert.equal(appended[0].projectId, PROJECT)
  assert.equal(appended[0].payload.project_id, PROJECT)
  assert.deepEqual(appended[0].actor, { kind: 'agent', id: 'session-s' })
  assert.deepEqual(appended[0].payload.blocks, [OWN_TASK])
})

test('the same command id is the same question; a foreign task is refused before anything is written', async () => {
  const { surface: s, appended } = surface()
  await linked(s.serverFor(scope), async (client) => {
    const again = parsed(await client.callTool({ name: 'fabric_question_ask', arguments: { commandId: ASKED, text: 'When?' } }))
    assert.deepEqual([again.repeated, again.question_id], [true, SEEN_Q])
    const foreign = parsed(await client.callTool({ name: 'fabric_question_ask', arguments: { commandId: '87000000-0000-4000-8000-0000000000c3', text: 'Block theirs?', blocks: [FOREIGN_TASK] } }))
    assert.equal(foreign.asked, false)
    assert.match(foreign.reason, /not in this project/)
  })
  assert.deepEqual(appended, [])
})

test('a question\'s state is read with what it blocks; another project\'s reads as none', async () => {
  const { surface: s } = surface()
  await linked(s.serverFor(scope), async (client) => {
    const seen = parsed(await client.callTool({ name: 'fabric_question_check', arguments: { questionId: SEEN_Q } }))
    assert.deepEqual([seen.found, seen.status, seen.answer, seen.chosen_option, seen.blocks], [true, 'answered', 'Ship now', 'now', [OWN_TASK]])
    const foreign = parsed(await client.callTool({ name: 'fabric_question_check', arguments: { questionId: FOREIGN_Q } }))
    assert.equal(foreign.found, false)
  })
})
