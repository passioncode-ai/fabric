// ADR-0050, the screens waves S2 (2026-11-16): the floor's two tools, moved out of `agentSurface.ts#serverFor` into
// `effectTools.ts`, still ask the policy for the session's own project, name the runner that asks, hand out a permit
// that is not a receipt, and say plainly when no policy port is there.
import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { AgentSurface } from '../src/main/agentSurface.ts'

const ESTATE = '87000000-0000-4000-8000-000000000001', PROJECT = '87000000-0000-4000-8000-000000000012'
const scope = { estateId: ESTATE, projectId: PROJECT, sessionId: 'session-s', taskId: null, cameIn: 'launched', agent: 'claude-code', runtimeSessionId: null, surface: 'session', bindingId: null }
const db = { rpc: async () => ({ data: { ok: true }, error: null }) }
const journal = { append: async () => ({ seq: 1 }) }
const ptys = () => ({ get: (id) => (id === 'session-s' ? { optionId: 'claude-code', permissionMode: 'ask' } : undefined), list: () => [] })

async function linked(server, run) {
  const client = new Client({ name: 'effect-tools', version: '1.0.0' })
  const [ct, st] = InMemoryTransport.createLinkedPair()
  try { await server.connect(st); await client.connect(ct); return await run(client) } finally { await client.close(); await server.close() }
}
const parsed = (out) => JSON.parse(out.content[0].text)
const ASK = { actionClass: 'publish', floorClass: 'publication', target: 'https://example.invalid/post', why: 'The operator asked for the post' }

function policy(verdict) {
  const seen = { grant: [], decide: [], dispatch: [] }
  return {
    seen,
    findGrantFor: async (q) => { seen.grant.push(q); return null },
    decide: async (r) => { seen.decide.push(r); return verdict === 'allow' ? { verdict: 'allow' } : { verdict: 'refuse', reason: 'needs the operator', needs: 'approval' } },
    beginDispatch: async (r) => { seen.dispatch.push(r); return { commandId: '87000000-0000-4000-8000-0000000000f1', idempotencyKey: 'k-1', seq: 7 } }
  }
}

test('a refused ask says the operator was asked, for this project and with the runner that asks', async () => {
  const p = policy('refuse')
  const surface = new AgentSurface({ db, journal, ptys, estateId: ESTATE, policy: p })
  await linked(surface.serverFor(scope), async (client) => {
    const out = parsed(await client.callTool({ name: 'fabric_effect_request', arguments: ASK }))
    assert.equal(out.allowed, false)
    assert.match(out.next, /operator has been asked/)
  })
  assert.equal(p.seen.grant[0].projectId, PROJECT, 'a grant of another project does not serve this one')
  assert.equal(p.seen.decide[0].runner, 'claude-code')
  assert.equal(p.seen.decide[0].permissionMode, 'ask')
  assert.equal(p.seen.decide[0].reason, ASK.why)
  assert.deepEqual(p.seen.dispatch, [], 'nothing is dispatched without an allow')
})

test('an allowed ask is a permit, never a receipt', async () => {
  const p = policy('allow')
  const surface = new AgentSurface({ db, journal, ptys, estateId: ESTATE, policy: p })
  await linked(surface.serverFor(scope), async (client) => {
    const out = parsed(await client.callTool({ name: 'fabric_effect_request', arguments: ASK }))
    assert.equal(out.allowed, true)
    assert.equal(out.effect_id, '87000000-0000-4000-8000-0000000000f1')
    assert.match(out.note, /Permission, not a receipt/)
  })
  assert.equal(p.seen.dispatch[0].actor.id, 'session-s')
})

test('without a policy port both tools say so', async () => {
  const surface = new AgentSurface({ db, journal, ptys, estateId: ESTATE })
  await linked(surface.serverFor(scope), async (client) => {
    assert.equal(parsed(await client.callTool({ name: 'fabric_effect_request', arguments: ASK })).allowed, false)
    const report = parsed(await client.callTool({ name: 'fabric_effect_report', arguments: { effectId: '87000000-0000-4000-8000-0000000000f1', says: 'posted it' } }))
    assert.equal(report.recorded, false)
  })
})
