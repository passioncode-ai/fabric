// ADR-0197 Amendment 5: Fabric holds a kept session's slot as that session's own com.enroll (the CEO's ceo.task), through
// the same caller its MCP tools build, under a fresh idempotency key and the epoch com.status names.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AgentSurface } from '../src/main/agentSurface.ts'

const ESTATE = '00000000-0000-4000-8000-000000000001'
const P = '87b288a4-2196-46a3-9d54-69e3f649ea53'
const S = '53895bdc-e5e7-4c40-89d7-3f96ce6b321e'

function rig(enrollAnswer) {
  const calls = []
  const db = { rpc: async (fn, args) => {
    calls.push({ fn, args })
    if (fn === 'board_status') return { data: { ok: true, unread: 0, responders: [], epoch: 3 }, error: null }
    if (fn === 'board_enroll') return { data: enrollAnswer, error: null }
    return { data: { ok: true }, error: null }
  } }
  const surface = new AgentSurface({ db, journal: { append: async () => ({ seq: 1 }) }, ptys: () => undefined, estateId: ESTATE })
  return { surface, calls }
}
const kept = { ok: true, repeated: false, slot: { project: P, capability: 'ceo.task', generation: 4, leaseExpiresAt: '2026-11-21T02:00:00.000Z' } }

test('the kept session enrolls as itself, with a fresh key each time under the board\'s epoch', async () => {
  const { surface, calls } = rig(kept)
  surface.mint(P, S, null, { cameIn: 'launched', agent: 'claude-code' })
  assert.equal(await surface.keepResponderSlot(S, 'ceo.task'), 'kept')
  assert.equal(await surface.keepResponderSlot(S, 'ceo.task'), 'kept')
  const enrolls = calls.filter((c) => c.fn === 'board_enroll')
  assert.equal(enrolls.length, 2)
  const [a, b] = enrolls.map((c) => c.args)
  assert.equal(a.p_holder.session_id, S)
  assert.equal(a.p_holder.came_in, 'launched')
  assert.equal(a.p_holder.agent, 'claude-code')
  assert.equal(a.p_project, P)
  assert.equal(a.p_args.capability, 'ceo.task')
  assert.equal(a.p_args.idempotency.epoch, 3)
  assert.notEqual(a.p_args.idempotency.key, b.p_args.idempotency.key)
})

test('another live holder is left alone; no grant is refused; a session Fabric does not hold is not-live', async () => {
  const fenced = rig({ ok: false, error: { code: 'fenced', message: 'Another responder holds this slot; use com.responder_replace.' } })
  fenced.surface.mint(P, S, null, { cameIn: 'launched', agent: 'claude-code' })
  assert.equal(await fenced.surface.keepResponderSlot(S, 'ceo.task'), 'held-by-other')
  const refused = rig({ ok: false, error: { code: 'not_authorized', message: 'no grant' } })
  refused.surface.mint(P, S, null, { cameIn: 'launched', agent: 'claude-code' })
  assert.equal(await refused.surface.keepResponderSlot(S, 'ceo.task'), 'refused')
  const none = rig(kept)
  assert.equal(await none.surface.keepResponderSlot(S, 'ceo.task'), 'not-live')
  assert.equal(none.calls.length, 0)
})
