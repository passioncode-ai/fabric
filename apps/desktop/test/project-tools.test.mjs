// W2-3 and CO-489, the screens waves S2 (2026-11-16): a session's project tools, moved out of `agentSurface.ts#serverFor`
// into `projectTools.ts`, still act for the session's own project only: the profile is one `project.profiled@1` by the
// agent, and the folder buttons reach the door with the session's project and id, or say they cannot.
import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { AgentSurface } from '../src/main/agentSurface.ts'

const ESTATE = '87000000-0000-4000-8000-000000000001', PROJECT = '87000000-0000-4000-8000-000000000012'
const scope = { estateId: ESTATE, projectId: PROJECT, sessionId: 'session-s', taskId: null, cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: null, surface: 'session', bindingId: null }

async function linked(server, run) {
  const client = new Client({ name: 'project-tools', version: '1.0.0' })
  const [ct, st] = InMemoryTransport.createLinkedPair()
  try { await server.connect(st); await client.connect(ct); return await run(client) } finally { await client.close(); await server.close() }
}
const parsed = (out) => JSON.parse(out.content[0].text)
// A project with no business yet, which the person never set: the only reads `writeAgentProfile` makes.
function fakeDb() {
  const reads = []
  const db = {
    rpc: async () => ({ data: { ok: true }, error: null }),
    from(table) {
      const filters = []
      const b = {
        select: () => b, not: () => b,
        eq: (k, v) => { filters.push([k, v]); return b },
        maybeSingle: async () => { reads.push({ table, filters }); return { data: { business: null }, error: null } },
        limit: async () => { reads.push({ table, filters }); return { data: [], error: null } }
      }
      return b
    }
  }
  return { db, reads }
}

test('fabric_project_profile writes one project.profiled@1 by the agent, for its own project only', async () => {
  const { db, reads } = fakeDb()
  const appended = []
  const journal = { append: async (e) => { appended.push(e); return { seq: appended.length } } }
  const surface = new AgentSurface({ db, journal, ptys: () => undefined, estateId: ESTATE })
  await linked(surface.serverFor(scope), async (client) => {
    const out = await client.callTool({ name: 'fabric_project_profile', arguments: { summary: 'A desktop app for teams', goal: 'Ship the board' } })
    assert.notEqual(out.isError, true, out.content[0].text)
  })
  const profiled = appended.filter((e) => e.type === 'project.profiled@1')
  assert.equal(profiled.length, 1)
  assert.equal(profiled[0].estateId, ESTATE)
  assert.equal(profiled[0].projectId, PROJECT)
  assert.deepEqual(profiled[0].actor, { kind: 'agent', id: 'session-s' })
  assert.equal(profiled[0].payload.summary, 'A desktop app for teams')
  for (const r of reads) assert.ok(r.filters.some(([k, v]) => (k === 'id' || k === 'project_id') && v === PROJECT), `${r.table} read only this project`)
})

test('the folder tools reach the door with the session\'s project and id; without a door they say so', async () => {
  const { db } = fakeDb()
  const journal = { append: async () => ({ seq: 1 }) }
  const calls = []
  const folders = {
    attach: async (...a) => { calls.push(['attach', ...a]); return { done: true, folders: ['/work/atlas'] } },
    detach: async (...a) => { calls.push(['detach', ...a]); throw new Error('disk gone') }
  }
  const surface = new AgentSurface({ db, journal, ptys: () => undefined, estateId: ESTATE, folders })
  await linked(surface.serverFor(scope), async (client) => {
    assert.deepEqual(parsed(await client.callTool({ name: 'fabric_project_folder_attach', arguments: { path: '/work/atlas' } })), { done: true, folders: ['/work/atlas'] })
    assert.equal(parsed(await client.callTool({ name: 'fabric_project_folder_detach', arguments: { path: '/work/old' } })).reason, 'failed', 'a failure is said, never done')
  })
  assert.deepEqual(calls, [['attach', PROJECT, '/work/atlas', 'session-s'], ['detach', PROJECT, '/work/old', 'session-s']])
  const bare = new AgentSurface({ db, journal, ptys: () => undefined, estateId: ESTATE })
  await linked(bare.serverFor(scope), async (client) => {
    assert.equal(parsed(await client.callTool({ name: 'fabric_project_folder_attach', arguments: { path: '/work/atlas' } })).reason, 'unavailable')
  })
})
