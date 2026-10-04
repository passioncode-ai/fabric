// `agent.call` past its happy path (verification iteration 1 for 0.3.1): a remembered idempotency key
// after the operator revoked the grant or disconnected the product (ER-5), a throw or an absurd input
// inside the hop (ER-11), and an agent that hangs up mid-call (ER-13). Pure: the grants, the connection
// and the journal are an in-memory stand-in; the forward is a fake that records what reached it.
// #region hub-call — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#5-every-forwarded-call-is-narrowed-twice
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

const SRC = path.resolve(import.meta.dirname, '../src/main')
const { createAgentCall } = await import(path.join(SRC, 'hubCall.ts'))

const A = { id: 'b-a', agent_id: 'example-agent.default' }
const args = (extra = {}) => ({ agentId: 'fabric-inbox', capability: 'read_message', input: { accountId: 'cloudflare:news@example.com', messageId: 'm1' }, ...extra })

function world({ forwardMs = 0, grantsThrow = false } = {}) {
  const exp = new Date(Date.now() + 1e9).toISOString()
  const grants = new Map([['g1', { id: 'g1', binding_id: A.id, callee: 'fabric-inbox', capability: 'read_message', resource: 'cloudflare:news@example.com', expires_at: exp, revoked_at: null }]])
  const connection = { id: 'c1', product: 'fabric-inbox', mcp_url: 'https://inbox.example.com/mcp', client_id: 'cid', secret_ref: { project: 'fabric', env: 'local', name: 'FABRIC_INBOX_CLIENT_SECRET' }, removed_at: null }
  const spans = []
  const seen = { vaultReads: 0, forwards: 0, forwardSignals: [] }
  const call = createAgentCall({
    access: { liveGrantsOf: async (b) => { if (grantsThrow) throw new Error('relation "access_grants" is unreadable: secret-internal-detail'); return [...grants.values()].filter((g) => g.binding_id === b.id && !g.revoked_at) } },
    store: {
      liveConnection: async () => (connection.removed_at ? null : connection),
      append: async (type, actor, payload) => { spans.push({ type, payload }); return spans.length }
    },
    vault: { read: async () => { seen.vaultReads++; return { ok: true, value: 'cf-secret' } } },
    forward: async (req) => {
      seen.forwards++
      seen.forwardSignals.push(req.signal)
      if (forwardMs) await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, forwardMs)
        req.signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')) })
      }).catch(() => undefined)
      if (req.signal?.aborted) return { ok: false, code: 'cancelled', message: 'the caller hung up', wallMs: forwardMs }
      return { ok: true, result: { content: [{ type: 'text', text: `MAIL BODY #${seen.forwards}` }] }, wallMs: 1 }
    },
    estateId: '00000000-0000-4000-8000-000000000000'
  })
  return { call, grants, connection, spans, seen }
}
const code = (r) => r.structuredContent?.error?.code ?? null

test('ER-5: a remembered idempotency key is not replayed once the grant is revoked', async () => {
  const w = world()
  const first = await w.call(A, args({ idempotencyKey: 'k1' }), undefined)
  assert.equal(first.isError, undefined)
  w.grants.get('g1').revoked_at = new Date().toISOString()
  const again = await w.call(A, args({ idempotencyKey: 'k1' }), undefined)
  assert.equal(code(again), 'access-required', 'a revoked grant still got the remembered answer')
  assert.equal(w.seen.forwards, 1)
})

test('ER-5: a remembered idempotency key is not replayed once the product is disconnected', async () => {
  const w = world()
  await w.call(A, args({ idempotencyKey: 'k1' }), undefined)
  w.connection.removed_at = new Date().toISOString()
  const again = await w.call(A, args({ idempotencyKey: 'k1' }), undefined)
  assert.equal(code(again), 'product-not-connected', 'a disconnected product still got the remembered answer')
})

test('ER-5: while the grant and the connection hold, the same key still replays and sends nothing', async () => {
  const w = world()
  const first = await w.call(A, args({ idempotencyKey: 'k1' }), undefined)
  const again = await w.call(A, args({ idempotencyKey: 'k1' }), undefined)
  assert.deepEqual(again.structuredContent.output, first.structuredContent.output)
  assert.equal(w.seen.forwards, 1)
})

test('ER-11: an input nested past 16 levels is invalid-arguments before anything is hashed, with its span', async () => {
  const w = world()
  let deep = []
  for (let i = 0; i < 20_000; i++) deep = [deep]
  const r = await w.call(A, args({ input: { accountId: 'cloudflare:news@example.com', x: deep } }), undefined)
  assert.equal(code(r), 'invalid-arguments')
  assert.equal(w.spans.length, 1, 'no span for the refused hop')
  assert.equal(w.spans[0].payload.error_code, 'invalid-arguments')
})

test('ER-11: a throw inside the hop is a failed span and a fixed sentence; the cause is not handed to the agent', async () => {
  const w = world({ grantsThrow: true })
  const r = await w.call(A, args(), undefined)
  assert.equal(code(r), 'hub-unavailable')
  assert.doesNotMatch(JSON.stringify(r), /secret-internal-detail|access_grants/, 'the raw exception reached the agent')
  assert.equal(w.spans.length, 1, 'a hop that threw left no span')
  assert.equal(w.spans[0].payload.outcome, 'failed')
  assert.equal(w.spans[0].payload.error_code, 'hub-unavailable')
})

test('ER-13: an agent that has already hung up reads no key and sends nothing; the span says cancelled', async () => {
  const w = world()
  const gone = AbortSignal.abort()
  await w.call(A, args(), undefined, gone)
  assert.equal(w.seen.vaultReads, 0, 'the key was read for a caller that had gone')
  assert.equal(w.seen.forwards, 0, 'the call was forwarded for a caller that had gone')
  assert.equal(w.spans.at(-1).payload.outcome, 'cancelled')
})

test('ER-13: the caller\'s signal reaches the forward, so hanging up mid-call aborts it', async () => {
  const w = world({ forwardMs: 800 })
  const ac = new AbortController()
  setTimeout(() => ac.abort(), 100)
  const started = Date.now()
  await w.call(A, args(), undefined, ac.signal)
  assert.ok(w.seen.forwardSignals[0], 'the forward was given no signal')
  assert.equal(w.seen.forwardSignals[0].aborted, true)
  assert.ok(Date.now() - started < 700, 'the forward ran to its end after the caller hung up')
  assert.equal(w.spans.at(-1).payload.outcome, 'cancelled')
})

// ER-11 (the tools' own guard): a throw inside fabric.access.request/status reached the agent as
// "Fabric could not complete this: <the exception text>" — a store error's detail handed to an agent.
test('ER-11: a throw inside an access tool gives the agent a fixed sentence, never the exception text', async () => {
  const { hubServerFor } = await import(path.join(SRC, 'hubTools.ts'))
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js')
  const access = { request: async () => { throw new Error('relation "access_requests": secret-internal-detail') }, status: async () => { throw new Error('secret-internal-detail') } }
  const server = hubServerFor({ kind: 'door' }, { access })
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 't', version: '0' })
  await Promise.all([server.connect(a), client.connect(b)])
  const r = await client.callTool({ name: 'fabric.access.request', arguments: { agentId: 'example-agent', callee: 'fabric-inbox', capabilities: ['read_message'], resources: ['cloudflare:news@example.com'], reason: 'r' } })
  assert.equal(r.isError, true)
  assert.equal(r.structuredContent.error.code, 'hub-unavailable')
  assert.doesNotMatch(JSON.stringify(r), /secret-internal-detail/, 'the exception text reached the agent')
  await client.close()
})
// #endregion hub-call
