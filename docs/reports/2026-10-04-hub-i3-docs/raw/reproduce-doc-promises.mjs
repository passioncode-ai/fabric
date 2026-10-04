// Local injected dependencies only: no HTTP, vault subprocess, credentials or database.
import assert from 'node:assert/strict'
import { createAgentCall } from '../../../../apps/desktop/src/main/hubCall.ts'
const binding = { id: 'example-binding', agent_id: 'example-agent.default' }
const input = { accountId: 'cloudflare:news@example.com', to: 'reader@example.com', subject: 'Example', body: 'Example' }
const args = key => ({ agentId: 'fabric-inbox', capability: 'send_email', input, idempotencyKey: key })
const code = answer => answer.structuredContent?.error?.code ?? null
function world() {
  let clock = Date.parse('2026-10-04T12:00:00Z')
  let forwards = 0
  const call = createAgentCall({
    estateId: '00000000-0000-4000-8000-000000000000', now: () => clock,
    access: { liveGrantsOf: async () => [{ id: 'g-example', binding_id: binding.id, callee: 'fabric-inbox', capability: 'send_email', resource: input.accountId, expires_at: '2027-10-04T00:00:00Z', revoked_at: null }] },
    store: { liveConnection: async () => ({ id: 'c-example', product: 'fabric-inbox', mcp_url: 'https://inbox.example.com/mcp', client_id: 'example-client', secret_ref: {} }), append: async () => 1 },
    vault: { read: async () => ({ ok: true, value: 'example-placeholder' }) },
    forward: async () => { forwards++; return { ok: false, code: 'product-unreachable', message: 'injected missing answer', reached: true, wallMs: 1 } }
  })
  return { call, count: () => forwards, advance: ms => { clock += ms } }
}
const ttl = world()
assert.equal(code(await ttl.call(binding, args('example-original'))), 'outcome-unknown')
await ttl.call(binding, args('example-original'))
assert.equal(ttl.count(), 1)
ttl.advance(24 * 60 * 60 * 1000 + 1)
await ttl.call(binding, args('example-original'))
console.log(JSON.stringify({ case: 'expiry', forwards: ttl.count(), expectedByADR21: 1 }))
const capacity = world()
await capacity.call(binding, args('example-original'))
for (let i = 0; i < 256; i++) await capacity.call(binding, args(`example-next-${i}`))
const before = capacity.count()
await capacity.call(binding, args('example-original'))
console.log(JSON.stringify({ case: 'capacity', retryForwardDelta: capacity.count() - before, expectedByADR21: 0 }))
const revoked = world()
await revoked.call(binding, args('example-original'))
revoked.call.forgetBinding(binding.id)
await revoked.call(binding, args('example-original'))
console.log(JSON.stringify({ case: 'effect-facts-after-forget', forwards: revoked.count(), expectedByADR21: 1, caveat: 'Direct injected call; HTTP authorization after revocation is not tested here.' }))
