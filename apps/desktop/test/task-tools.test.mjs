// The screens waves S2 (2026-11-16): the task tools, moved out of `agentSurface.ts#serverFor` into `taskTools.ts`,
// still act on the session's own project only: a note and a move are one event by the agent, a move the ladder forbids
// writes nothing, a task of another project reads as none, and closing without the operator's words is refused.
import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { AgentSurface } from '../src/main/agentSurface.ts'

const ESTATE = '87000000-0000-4000-8000-000000000001', PROJECT = '87000000-0000-4000-8000-000000000012', OTHER = '87000000-0000-4000-8000-000000000013'
const RUNNING = '87000000-0000-4000-8000-0000000000a1', DONE = '87000000-0000-4000-8000-0000000000a2', FOREIGN = '87000000-0000-4000-8000-0000000000a3'
const scope = { estateId: ESTATE, projectId: PROJECT, sessionId: 'session-s', taskId: null, cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: null, surface: 'session', bindingId: null }
const ROWS = { project_tasks: [
  { id: RUNNING, estate_id: ESTATE, project_id: PROJECT, status: 'running', title: 'Own', instruction: 'x' },
  { id: DONE, estate_id: ESTATE, project_id: PROJECT, status: 'done', title: 'Closed', instruction: 'y' },
  { id: FOREIGN, estate_id: ESTATE, project_id: OTHER, status: 'running', title: 'Foreign', instruction: 'z' }
] }
function fakeDb() {
  return {
    rpc: async () => ({ data: { ok: true }, error: null }),
    from(table) {
      const filters = []
      const matched = () => (ROWS[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v))
      const b = { select: () => b, eq: (k, v) => { filters.push([k, v]); return b }, maybeSingle: async () => ({ data: matched()[0] ?? null, error: null }),
        then: (ok, no) => Promise.resolve({ data: matched(), error: null }).then(ok, no) }
      return b
    }
  }
}
async function linked(server, run) {
  const client = new Client({ name: 'task-tools', version: '1.0.0' })
  const [ct, st] = InMemoryTransport.createLinkedPair()
  try { await server.connect(st); await client.connect(ct); return await run(client) } finally { await client.close(); await server.close() }
}
const parsed = (out) => JSON.parse(out.content[0].text)
function surface() {
  const appended = []
  const journal = { append: async (e) => { appended.push(e); return { seq: appended.length } } }
  return { appended, s: new AgentSurface({ db: fakeDb(), journal, ptys: () => undefined, estateId: ESTATE }) }
}

test('a note and a move are one event each, by the agent, for its own project', async () => {
  const { s, appended } = surface()
  await linked(s.serverFor(scope), async (client) => {
    assert.equal(parsed(await client.callTool({ name: 'fabric_task_note', arguments: { taskId: RUNNING, body: 'Tried the split; the order of reads broke.' } })).noted, true)
    const moved = parsed(await client.callTool({ name: 'fabric_task_move', arguments: { taskId: RUNNING, to: 'review', note: 'done, see the test' } }))
    assert.deepEqual([moved.moved, moved.from, moved.to], [true, 'running', 'review'])
  })
  assert.deepEqual(appended.map((e) => e.type), ['task.note.added@1', 'task.moved@1'])
  for (const e of appended) {
    assert.equal(e.projectId, PROJECT)
    assert.deepEqual(e.actor, { kind: 'agent', id: 'session-s' })
  }
})

test('a move the ladder forbids, a task of another project and a close without the operator\'s words write nothing', async () => {
  const { s, appended } = surface()
  await linked(s.serverFor(scope), async (client) => {
    assert.equal(parsed(await client.callTool({ name: 'fabric_task_move', arguments: { taskId: DONE, to: 'running' } })).moved, false)
    assert.match(parsed(await client.callTool({ name: 'fabric_task_note', arguments: { taskId: FOREIGN, body: 'not mine' } })).reason, /no such task in this project/)
    const close = await client.callTool({ name: 'fabric_task_close', arguments: { taskId: RUNNING, outcome: 'done' } })
    assert.match(close.content[0].text, /operator/)
  })
  assert.deepEqual(appended, [])
})
