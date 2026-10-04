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

// ── Verification iteration 2 for 0.3.1 ────────────────────────────────────────────────────────────────
// ER-1: an idempotencyKey did not stop a second send. A call that was cancelled or timed out AFTER it had
// reached the product was forgotten, and the tool told the agent to retry with the same key — which sent
// again. A key whose call may have run is now remembered as outcome-unknown and refused, typed and final.
function sender({ outcome = 'cancelled', reached, waitMs = 50 } = {}) {
  const exp = new Date(Date.now() + 1e9).toISOString()
  const grants = [{ id: 'g1', binding_id: A.id, callee: 'fabric-inbox', capability: 'send_email', resource: 'cloudflare:news@example.com', expires_at: exp, revoked_at: null }]
  const seen = { executed: 0, spans: [] }
  let next = { outcome, reached }
  const call = createAgentCall({
    access: { liveGrantsOf: async () => grants },
    store: { liveConnection: async () => ({ id: 'c1', product: 'fabric-inbox', mcp_url: 'https://inbox.example.com/mcp', client_id: 'cid-123', secret_ref: { project: 'fabric', env: 'local', name: 'X' }, removed_at: null }), append: async (t, a, p) => { seen.spans.push(p); return 1 } },
    vault: { read: async () => ({ ok: true, value: 's' }) },
    forward: async (req) => {
      seen.executed++ // the POST reached the product, and it sent the mail
      await new Promise((r) => setTimeout(r, waitMs))
      const n = next
      if (n.outcome === 'succeeded') return { ok: true, result: { structuredContent: { sent: true } }, wallMs: waitMs }
      if (req.signal?.aborted || n.outcome === 'cancelled') return { ok: false, code: 'cancelled', message: 'hung up', wallMs: waitMs, ...(n.reached === undefined ? {} : { reached: n.reached }) }
      return { ok: false, code: n.outcome, message: 'the product did not answer within 60s', wallMs: waitMs, ...(n.reached === undefined ? {} : { reached: n.reached }) }
    },
    estateId: '00000000-0000-4000-8000-000000000000'
  })
  return { call, seen, then: (o) => { next = o } }
}
const send = (key = 'K1') => ({ agentId: 'fabric-inbox', capability: 'send_email', input: { accountId: 'cloudflare:news@example.com', to: 'x@example.com', subject: 's', text: 'b' }, idempotencyKey: key })

test('ER-1: a call cancelled after it reached the product is never sent again with the same key', async () => {
  const w = sender({ outcome: 'cancelled' })
  const ac = new AbortController()
  const first = w.call(A, send(), undefined, ac.signal)
  setTimeout(() => ac.abort(), 10)
  await first
  w.then({ outcome: 'succeeded' })
  const retry = await w.call(A, send(), undefined, new AbortController().signal)
  assert.equal(code(retry), 'outcome-unknown', 'the retry with the same key was sent again')
  assert.equal(w.seen.executed, 1, 'the product ran send_email twice')
  assert.equal(retry.structuredContent.error.data.mayHaveRun, true)
  assert.match(retry.structuredContent.error.message, /may have run/)
  assert.match(retry.structuredContent.error.message, /get_send_status/)
})

test('ER-1: a forward that timed out after it reached the product is outcome-unknown at once, and the same key stays refused', async () => {
  const w = sender({ outcome: 'product-unreachable', reached: true })
  const first = await w.call(A, send('K2'), undefined)
  assert.equal(code(first), 'outcome-unknown', 'a timeout after the call reached the product read as a plain retryable failure')
  assert.equal(first.structuredContent.error.data.cause, 'product-unreachable')
  w.then({ outcome: 'succeeded' })
  const retry = await w.call(A, send('K2'), undefined)
  assert.equal(code(retry), 'outcome-unknown')
  assert.equal(w.seen.executed, 1)
  assert.equal(w.seen.spans.at(0).error_code, 'outcome-unknown', 'the journal span does not say the outcome is unknown')
})

test('ER-1: a forward that provably sent nothing is said as such, and the same key may try again', async () => {
  const w = sender({ outcome: 'product-unreachable', reached: false })
  const first = await w.call(A, send('K3'), undefined)
  assert.equal(code(first), 'product-unreachable')
  assert.equal(first.structuredContent.error.data?.mayHaveRun, false)
  w.then({ outcome: 'succeeded' })
  const retry = await w.call(A, send('K3'), undefined)
  assert.equal(retry.isError, undefined, 'a call that never left Fabric could not be retried')
  assert.equal(w.seen.executed, 2)
})

test('ER-1: no text tells an agent to retry a call that may have run', async () => {
  const { hubServerFor } = await import(path.join(SRC, 'hubTools.ts'))
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js')
  const server = hubServerFor({ kind: 'binding', binding: { id: 'b', agent_id: 'example-agent.default' } }, { access: { liveGrantsOf: async () => [] }, call: async () => ({ content: [] }) })
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 't', version: '0' })
  await Promise.all([server.connect(a), client.connect(b)])
  const tool = (await client.listTools()).tools.find((t) => t.name === 'agent.call')
  const text = JSON.stringify(tool)
  assert.doesNotMatch(text, /retry (it )?with the SAME key|retry it with the same idempotencyKey/i, 'agent.call still advises retrying a call that may have run')
  assert.match(text, /outcome-unknown/)
  await client.close()
  const w = sender({ outcome: 'succeeded' })
  const gone = await w.call(A, send('K4'), undefined, AbortSignal.abort())
  assert.equal(code(gone), 'cancelled')
  assert.doesNotMatch(gone.structuredContent.error.message, /reuse its idempotencyKey/, 'the cancel refusal still advises a retry with the key')
})

// ER-11: the product's error text — which can echo its request headers — reached the agent; it carried the
// client id. The agent hears a fixed sentence per code; the product's words go to the operations log.
test('ER-11: a product error is a fixed sentence to the agent; neither the client id nor the product text reaches it', async () => {
  const exp = new Date(Date.now() + 1e9).toISOString()
  const call = createAgentCall({
    access: { liveGrantsOf: async () => [{ id: 'g1', binding_id: A.id, callee: 'fabric-inbox', capability: 'read_message', resource: 'cloudflare:news@example.com', expires_at: exp, revoked_at: null }] },
    store: { liveConnection: async () => ({ id: 'c1', mcp_url: 'https://inbox.example.com/mcp', client_id: 'cid-123', secret_ref: {} }), append: async () => 1 },
    vault: { read: async () => ({ ok: true, value: 's' }) },
    forward: async () => ({ ok: false, code: 'product-error', message: 'Error POSTing to endpoint: upstream said: CF-Access-Client-Id=cid-123', wallMs: 3, reached: false }),
    estateId: '00000000-0000-4000-8000-000000000000'
  })
  const r = await call(A, args(), undefined)
  assert.equal(code(r), 'product-error')
  assert.doesNotMatch(JSON.stringify(r), /cid-123|upstream said|POSTing/, 'the product\'s own error text reached the agent')
})

// DA-3: the memory kept every produced answer whole, 256 per binding, with no byte bound, and a revoked
// binding's answers stayed until the app quit (64 calls of a 4 MiB answer pinned 512 MiB).
function big({ answerBytes, now }) {
  const exp = new Date(Date.now() + 1e9).toISOString()
  const seen = { forwards: 0 }
  const call = createAgentCall({
    access: { liveGrantsOf: async (b) => [{ id: 'g-' + b.id, binding_id: b.id, callee: 'fabric-inbox', capability: 'read_message', resource: 'cloudflare:news@example.com', expires_at: exp, revoked_at: null }] },
    store: { liveConnection: async () => ({ id: 'c1', mcp_url: 'https://inbox.example.com/mcp', client_id: 'cid', secret_ref: {} }), append: async () => 1 },
    vault: { read: async () => ({ ok: true, value: 's' }) },
    forward: async () => { seen.forwards++; return { ok: true, result: { structuredContent: { body: 'x'.repeat(answerBytes) } }, wallMs: 1 } },
    estateId: '00000000-0000-4000-8000-000000000000',
    now
  })
  return { call, seen }
}

test('DA-3: answers are remembered under a byte bound; a call too large to keep is still never sent twice', async () => {
  const w = big({ answerBytes: 4 * 1024 * 1024 })
  for (let i = 0; i < 64; i++) await w.call(A, args({ idempotencyKey: `big-${i}` }), undefined)
  const m = w.call.memory()
  assert.ok(m.bytes <= 32 * 1024 * 1024, `the memory holds ${m.bytes} bytes of answers`)
  assert.equal(m.keys, 64, 'a key was forgotten, so its call could be sent twice')
  const again = await w.call(A, args({ idempotencyKey: 'big-0' }), undefined)
  assert.equal(code(again), 'answer-not-kept', 'an answer too large to keep was replayed whole or sent again')
  assert.equal(w.seen.forwards, 64)
})

test('DA-3: a revoked binding\'s memory is released, and memory past its 24 hours is swept for every binding', async () => {
  let t = Date.now()
  const w = big({ answerBytes: 1000, now: () => t })
  const B = { id: 'b-b', agent_id: 'example-agent.other' }
  await w.call(A, args({ idempotencyKey: 'a1' }), undefined)
  await w.call(B, args({ idempotencyKey: 'b1' }), undefined)
  w.call.forgetBinding(B.id)
  assert.equal(w.call.memory().keys, 1, 'the revoked binding\'s answers stayed')
  t += 25 * 60 * 60 * 1000
  await w.call(B, args({ idempotencyKey: 'b2' }), undefined)
  assert.equal(w.call.memory().keys, 1, 'another binding\'s expired memory was never swept')
})
// #endregion hub-call
