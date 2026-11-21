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

// ADR-0203: the owner's approval mode. An act that does not wait for the owner under it gets a grant Fabric issues
// itself, as the system `approval-mode:<mode>`, scoped to this project, act and target; one that waits is asked as before.
function modal({ actedBefore = false } = {}) {
  const p = policy('allow')
  p.seen.issued = []
  p.actedBefore = async () => actedBefore
  p.issueGrant = async (g) => { p.seen.issued.push(g); return { grantId: 'g-mode', seq: 3, expiresAt: 'x' } }
  return p
}
const ask = async (p, mode, args = ASK) => {
  const surface = new AgentSurface({ db, journal, ptys, estateId: ESTATE, policy: p, approvalMode: () => mode })
  return linked(surface.serverFor(scope), async (client) => parsed(await client.callTool({ name: 'fabric_effect_request', arguments: args })))
}

test('ADR-0203: under «nothing» and «only spending» a publication gets the mode\'s own grant, named in the journal and the answer', async () => {
  for (const mode of ['none', 'spending']) {
    const p = modal()
    const out = await ask(p, mode)
    assert.equal(out.allowed, true)
    assert.match(out.allowed_by, new RegExp(mode))
    assert.equal(p.seen.issued.length, 1)
    assert.deepEqual({ ...p.seen.issued[0], ttlMs: undefined }, { estateId: ESTATE, projectId: PROJECT, floorClass: 'publication', target: ASK.target, actionClass: 'publish', actor: { kind: 'system', id: `approval-mode:${mode}` }, ttlMs: undefined })
    assert.ok(p.seen.issued[0].ttlMs <= 10 * 60_000, 'a mode grant is one-shot and short, never a standing permission')
    assert.equal(p.seen.decide[0].grantId, 'g-mode', 'the policy still decides, with the grant the mode issued')
  }
})

test('ADR-0203: the default, «only critical» for a publication and «only unusual» on a first act wait for the owner', async () => {
  for (const [mode, before] of [['important', true], ['critical', false], ['unusual', false]]) {
    const p = modal({ actedBefore: before })
    await ask(p, mode)
    assert.deepEqual(p.seen.issued, [], `${mode}: no grant is issued by the mode`)
    assert.equal(p.seen.decide[0].grantId, null)
  }
  const repeat = modal({ actedBefore: true })
  await ask(repeat, 'unusual')
  assert.equal(repeat.seen.issued.length, 1, '«only unusual»: a repeat of an act done before goes ahead')
  const unknown = modal({ actedBefore: null })
  await ask(unknown, 'unusual')
  assert.deepEqual(unknown.seen.issued, [], 'an unreadable history is a first time')
})

test('ADR-0203: a grant the mode cannot issue leaves the act waiting', async () => {
  const p = modal()
  p.issueGrant = async () => { throw new Error('the journal is down') }
  const out = await ask(p, 'none')
  assert.equal(p.seen.decide[0].grantId, null)
  assert.equal(out.allowed, true, 'the fake policy allows; what matters is that no grant was presented')
})

test('ADR-0203 §6: each decision above the floor is written to the behaviour journal with whose word it was', async () => {
  const lines = []
  const behaviour = { note: (e) => lines.push(e) }
  const run = async (p, mode) => {
    const surface = new AgentSurface({ db, journal, ptys, estateId: ESTATE, policy: p, approvalMode: () => mode, behaviour })
    await linked(surface.serverFor(scope), async (client) => client.callTool({ name: 'fabric_effect_request', arguments: ASK }))
  }
  await run(modal(), 'none')
  const refused = policy('refuse'); refused.actedBefore = async () => false
  await run(refused, 'important')
  assert.deepEqual(lines.map((l) => [l.actor.id, l.act, l.word.of, l.word.via, l.decision]), [
    ['session-s', 'effect.publication', 'approval-mode', 'none', 'allowed'],
    ['session-s', 'effect.publication', 'agent', 'request', 'waits-for-owner']
  ])
  assert.equal(lines[0].reason, ASK.why)
})
