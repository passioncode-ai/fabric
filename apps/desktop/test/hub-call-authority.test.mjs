// The operator's decision (DEC-0121 AP-2) and mandate (DEC-0125 MD-3) on the hub's `agent.call` (CO-434, CO-435):
// the arguments take `decision` and `mandate` exactly as the pinned schemas define them, a malformed one is refused
// `decision-invalid` before anything is sent, a valid one reaches the callee unchanged as the hop's `_meta.decision`
// and `_meta.mandate`, its `at` and `source` are recorded in the operations log (OA-6) and never in the journal span
// (OA-7: `source`, like `instruction`, stays off the feed), and the callee's DL-19 refusals come back unchanged.
// #region hub-call-authority — docs: docs/evidence/plans/2026-10-26-0313-w4-contract-delta.md#3-every-decision-of-the-delta-as-it-touches-fabric
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import path from 'node:path'
import test from 'node:test'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { z } from 'zod'
import { loadPinnedFixtures, schemaPrefix } from './contract-consumer-fixtures.mjs'

const SRC = path.resolve(import.meta.dirname, '../src/main')
const { decisionSchema, mandateSchema, agentCallArgsSchema, readCallAuthority, isContractDateTime } = await import(path.join(SRC, 'hubAuthority.ts'))
const { hubServerFor } = await import(path.join(SRC, 'hubTools.ts'))
const { createAgentCall } = await import(path.join(SRC, 'hubCall.ts'))
const { forwardToProduct } = await import(path.join(SRC, 'productForwarder.ts'))
const { useOps } = await import(path.join(SRC, 'opsSink.ts'))

// ── the pinned schemas, compiled the way the contract compiles them ─────────────────────────────────────────────
const fixtures = loadPinnedFixtures()
const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
for (const f of fixtures.source.files) if (f.path.startsWith('current/schemas/')) ajv.addSchema(fixtures.document(f.path))
const pinned = (name) => { const v = ajv.getSchema(`${schemaPrefix}${name}.schema.json`); assert.ok(v, name); return v }
const pinnedDecision = pinned('decision'), pinnedMandate = pinned('mandate'), pinnedCall = pinned('interop-agent-call')

const AT = '2026-10-26T09:00:00Z'
const decision = (extra = {}) => ({ by: 'operator', via: 'relayed-instruction', action: 'approve_reply', instruction: 'Одобряю ответ на отзыв.', at: AT, ...extra })
const scope = (extra = {}) => ({ effects: ['draft'], ...extra })
const mandate = (extra = {}) => ({
  kind: 'mandate/1', by: 'operator', task: 'CO-434', instruction: 'Run the research.', at: AT, expiresAt: '2026-10-27T09:00:00Z',
  scope: scope(), chain: [{ agent: 'claude-code', at: AT }, { agent: 'fabric-inbox', at: '2026-10-26T09:01:00Z' }], ...extra
})
const without = (o, k) => { const c = { ...o }; delete c[k]; return c }
const astral = (n) => '\u{1F600}'.repeat(n)

// Each case is graded by the pinned schema itself (ajv), then the mirror must reach the same verdict.
const decisionCases = [
  decision(), decision({ target: 'review-42' }), decision({ source: { project: 'fabric', session: 's-1' } }),
  decision({ source: { project: 'fabric', thread: 't.2' } }), decision({ source: { project: 'fabric', session: 's', thread: 't' } }),
  decision({ instruction: astral(500) }), decision({ instruction: astral(501) }), decision({ instruction: 'x'.repeat(501) }),
  decision({ target: astral(200) }), decision({ target: '' }), decision({ instruction: '' }),
  decision({ by: 'agent' }), decision({ via: 'elicitation' }), decision({ action: 'a b' }), decision({ action: 'x'.repeat(65) }),
  decision({ action: 'x'.repeat(64) }), decision({ relayer: 'claude-code' }), without(decision(), 'action'), without(decision(), 'at'),
  decision({ at: '2026-10-26 09:00:00z' }), decision({ at: '2026-10-26t09:00:00+0200' }), decision({ at: '2026-02-30T09:00:00Z' }),
  decision({ at: '2024-02-29T09:00:00Z' }), decision({ at: '2026-10-26T23:59:60Z' }), decision({ at: '2026-10-26T12:59:60Z' }),
  decision({ at: '2026-10-26T09:00:00' }), decision({ at: '2026-10-26T24:00:00Z' }), decision({ at: '2026-10-26T09:00:00.123456+05:30' }),
  decision({ at: 1700000000 }), decision({ source: { project: 'fabric' } }), decision({ source: { session: 's' } }),
  decision({ source: { project: 'fabric', session: 's', extra: 1 } }), decision({ source: { project: '-x', session: 's' } }),
  'decision', null, [decision()]
]
const mandateCases = [
  mandate(), mandate({ source: { project: 'fabric', thread: 't' } }),
  mandate({ scope: scope({ capabilities: ['read_message'], actions: ['approve_reply'], perCallMaxUsd: 0.5, projects: ['fabric', 'p:1'] }) }),
  mandate({ scope: scope({ effects: ['draft', 'draft'] }) }), mandate({ scope: scope({ effects: [] }) }), mandate({ scope: scope({ effects: ['launch'] }) }),
  mandate({ scope: scope({ capabilities: [] }) }), mandate({ scope: scope({ capabilities: ['Read'] }) }), mandate({ scope: scope({ perCallMaxUsd: -1 }) }),
  mandate({ scope: scope({ perCallMaxUsd: 100001 }) }), mandate({ scope: scope({ projects: ['a', 'a'] }) }), mandate({ scope: { capabilities: ['x.y'] } }),
  mandate({ scope: scope({ owner: 'me' }) }), mandate({ chain: [] }), mandate({ chain: Array.from({ length: 5 }, (_, i) => ({ agent: `agent-${i}`, at: AT })) }),
  mandate({ chain: [{ agent: 'Claude', at: AT }] }), mandate({ chain: [{ agent: 'claude-code', at: AT, scope: scope({ effects: ['none'] }) }] }),
  mandate({ chain: [{ agent: 'claude-code', at: AT, note: 'x' }] }), mandate({ kind: 'mandate/2' }), mandate({ by: 'agent' }),
  mandate({ task: '' }), mandate({ task: astral(200) }), mandate({ instruction: astral(501) }), mandate({ expiresAt: 'tomorrow' }),
  without(mandate(), 'scope'), without(mandate(), 'expiresAt'), mandate({ extra: true }), mandate({ source: { project: 'fabric' } })
]
const callCases = [
  { agentId: 'fabric-inbox', capability: 'read_message', input: {} },
  { agentId: 'fabric-inbox', capability: 'read_message', input: { a: 1 }, idempotencyKey: 'k', decision: decision(), mandate: mandate() },
  { agentId: 'fabric-inbox', capability: 'read_message', input: {}, decision: decision({ by: 'agent' }) },
  { agentId: 'fabric-inbox', capability: 'read_message', input: {}, mandate: mandate({ chain: [] }) },
  { agentId: 'fabric-inbox', capability: 'read_message', input: {}, credential: 'x' },
  { agentId: 'fabric-inbox', capability: 'read_message', input: {}, _meta: {} },
  fixtures.document('current/positive/interop-agent-call.json')
]

test('the decision and mandate mirrors reach the pinned schemas\' verdict on every case (DEC-0121, DEC-0125, DEC-0126)', () => {
  let accepted = 0, refused = 0
  for (const [name, schema, contract, cases] of [['decision', decisionSchema, pinnedDecision, decisionCases], ['mandate', mandateSchema, pinnedMandate, mandateCases],
    ['agent.call', agentCallArgsSchema, pinnedCall, callCases]]) {
    for (const doc of cases) {
      const want = contract(doc) === true
      assert.equal(schema.safeParse(doc).success, want, `${name}: the mirror disagrees with the pinned schema on ${JSON.stringify(doc).slice(0, 160)}`)
      want ? accepted++ : refused++
    }
  }
  assert.ok(accepted >= 15 && refused >= 40, `too few cases on one side: ${accepted} accepted, ${refused} refused`)
})

test('the date-time reader is the contract compiler\'s format, not a stricter or looser one', () => {
  for (const s of ['2026-10-26T09:00:00Z', '2026-10-26t09:00:00z', '2026-10-26 09:00:00+02:00', '2026-10-26T09:00:00.5-0130', '2026-10-26T23:59:60Z', '2026-10-27T01:59:60+02:00'])
    assert.equal(isContractDateTime(s), true, s)
  for (const s of ['2026-10-26T09:00:00', '2026-13-01T00:00:00Z', '2026-02-29T00:00:00Z', '2026-10-26T09:60:00Z', '2026-10-26T12:59:60Z', '2026-10-26', '2026-10-26T09:00:00Z ', '2026-10-26T24:00:00+25:00'])
    assert.equal(isContractDateTime(s), false, s)
})

test('readCallAuthority: absent is nothing, valid is returned as given, malformed names which one', () => {
  assert.deepEqual(readCallAuthority({}), { ok: true, authority: {} })
  const d = decision({ source: { project: 'fabric', session: 's-1' } }), m = mandate()
  const r = readCallAuthority({ decision: d, mandate: m })
  assert.equal(r.ok, true)
  assert.deepEqual(r.authority, { decision: d, mandate: m })
  assert.deepEqual(readCallAuthority({ decision: decision({ by: 'agent' }) }), { ok: false, detail: 'decision-malformed' })
  assert.deepEqual(readCallAuthority({ mandate: mandate({ chain: [] }) }), { ok: false, detail: 'mandate-malformed' })
  assert.deepEqual(readCallAuthority({ decision: decision(), mandate: 'm' }), { ok: false, detail: 'mandate-malformed' })
})

// ── the tool: what reaches `call`, and what is refused before it ───────────────────────────────────────────────
async function tool() {
  const reached = []
  const binding = { id: 'b-1', agent_id: 'example-agent.default' }
  const server = hubServerFor({ kind: 'binding', binding }, { access: {}, call: async (b, args, meta) => { reached.push({ args, meta }); return { content: [{ type: 'text', text: 'ok' }], structuredContent: { ok: true } } } })
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 't', version: '0' })
  await Promise.all([server.connect(a), client.connect(b)])
  return { client, reached }
}
const base = { agentId: 'fabric-inbox', capability: 'read_message', input: { accountId: 'cloudflare:news@example.com', messageId: 'm1' } }

test('agent.call takes a decision and a mandate and hands them to the hop unchanged', async () => {
  const { client, reached } = await tool()
  const d = decision({ target: 'm1', source: { project: 'fabric', thread: 'th-1' } }), m = mandate()
  const r = await client.callTool({ name: 'agent.call', arguments: { ...base, decision: d, mandate: m } })
  assert.equal(r.isError, undefined, JSON.stringify(r))
  assert.equal(reached.length, 1)
  assert.deepEqual(reached[0].args.decision, d)
  assert.deepEqual(reached[0].args.mandate, m)
  const plain = await client.callTool({ name: 'agent.call', arguments: base })
  assert.equal(plain.isError, undefined)
  assert.ok(!('decision' in reached[1].args) && !('mandate' in reached[1].args), 'a call without them gained them')
  await client.close()
})

test('a malformed decision or mandate is refused decision-invalid, typed, and nothing is handed on', async () => {
  const { client, reached } = await tool()
  for (const [args, detail] of [[{ ...base, decision: decision({ by: 'agent' }) }, 'decision-malformed'], [{ ...base, decision: 'yes' }, 'decision-malformed'],
    [{ ...base, mandate: mandate({ scope: { effects: [] } }) }, 'mandate-malformed'], [{ ...base, decision: decision(), mandate: mandate({ chain: [] }) }, 'mandate-malformed']]) {
    const r = await client.callTool({ name: 'agent.call', arguments: args })
    assert.equal(r.isError, true)
    assert.equal(r.structuredContent?.error?.code, 'decision-invalid', JSON.stringify(r))
    assert.equal(r.structuredContent.error.data?.detail, detail)
  }
  assert.equal(reached.length, 0, 'a malformed decision or mandate reached the hop')
  await client.close()
})

test('anything else beside the contract\'s members is still refused, and never reaches the hop', async () => {
  const { client, reached } = await tool()
  for (const extra of [{ credential: 'x' }, { approval: { by: 'operator' } }, { meta: {} }]) {
    const r = await client.callTool({ name: 'agent.call', arguments: { ...base, ...extra } }).catch((e) => ({ isError: true, thrown: String(e) }))
    assert.equal(r.isError, true, `${Object.keys(extra)[0]} was accepted`)
  }
  assert.equal(reached.length, 0)
  await client.close()
})

// ── the hop: what the forward carries, what is recorded, what comes back ──────────────────────────────────────────
function hop(answers = []) {
  const grants = [{ id: 'g1', binding_id: 'b-1', callee: 'fabric-inbox', capability: 'read_message', resource: 'cloudflare:news@example.com', expires_at: '2099-01-01T00:00:00Z', revoked_at: null }]
  const sent = [], spans = [], recs = []
  useOps({ record: (r) => recs.push(r), correlate: () => 'c', begin: () => () => {}, read: () => [], file: () => null, lost: () => 0 })
  const call = createAgentCall({
    access: { liveGrantsOf: async () => grants },
    store: { liveConnection: async () => ({ id: 'c1', product: 'fabric-inbox', mcp_url: 'https://inbox.example.com/mcp', client_id: 'cid', secret_ref: { project: 'fabric', env: 'local', name: 'X' }, removed_at: null }),
      append: async (type, actor, payload) => { spans.push({ type, payload }); return spans.length } },
    vault: { read: async () => ({ ok: true, value: 'cf-secret' }) },
    forward: async (req) => { sent.push(req); return answers.shift() ?? { ok: true, result: { structuredContent: { subject: 'hi' } }, wallMs: 1 } },
    estateId: '00000000-0000-4000-8000-000000000000'
  })
  return { call, sent, spans, recs }
}
const B = { id: 'b-1', agent_id: 'example-agent.default' }

test('the forward carries the decision and the mandate unchanged; the operations log records their at and source, the span neither', async () => {
  const h = hop()
  const d = decision({ source: { project: 'fabric', session: 'sess-9' } }), m = mandate({ source: { project: 'fabric', thread: 'th-1' } })
  const r = await h.call(B, { ...base, decision: d, mandate: m }, undefined)
  assert.equal(r.isError, undefined, JSON.stringify(r))
  assert.deepEqual(h.sent[0].decision, d)
  assert.deepEqual(h.sent[0].mandate, m)
  const line = h.recs.find((x) => x.op === 'hub.call' && x.outcome === 'ok')
  assert.ok(line, 'no operations record of the forwarded hop')
  assert.deepEqual(line.detail.operator, {
    decision: { action: 'approve_reply', at: AT, source: { project: 'fabric', session: 'sess-9' } },
    mandate: { task: 'CO-434', at: AT, source: { project: 'fabric', thread: 'th-1' }, chain: 2 }
  })
  assert.doesNotMatch(JSON.stringify(h.recs), /Одобряю|Run the research/, 'the operator\'s words reached the operations log')
  assert.doesNotMatch(JSON.stringify(h.spans), /sess-9|th-1|approve_reply|Одобряю/, 'the decision reached the journal span')
  const plain = hop()
  await plain.call(B, base, undefined)
  assert.ok(!('decision' in plain.sent[0]) && !('mandate' in plain.sent[0]), 'a call without them forwarded them')
  assert.ok(!('operator' in plain.recs.find((x) => x.op === 'hub.call').detail))
})

test('the callee\'s DL-19 refusals come back unchanged, never as a product error, and the key may carry the decision next', async () => {
  const refusedBy = (code, data) => ({ ok: true, result: { isError: true, content: [{ type: 'text', text: code }], structuredContent: { error: { code, message: `the callee says ${code}`, data } } }, wallMs: 1 })
  for (const [code, data] of [['operator-decision-required', { detail: 'outside-mandate: spend', estimateUsd: 3, perCallMaxUsd: 1 }], ['decision-invalid', { detail: 'mandate-expired' }],
    ['human-step-required', { humanStep: 'payment', url: 'https://example.com/pay' }]]) {
    const h = hop([refusedBy(code, data)])
    const r = await h.call(B, { ...base, idempotencyKey: 'k1' }, undefined)
    assert.equal(r.isError, true)
    assert.deepEqual(r.structuredContent, { error: { code, message: `the callee says ${code}`, data } }, `${code} did not come back unchanged`)
    const again = await h.call(B, { ...base, idempotencyKey: 'k1', decision: decision() }, undefined)
    assert.equal(again.isError, undefined, `${code}: the same key with the operator's decision was not sent: ${JSON.stringify(again)}`)
    assert.equal(h.sent.length, 2)
    assert.deepEqual(h.sent[1].decision, decision())
  }
  const other = hop([refusedBy('forbidden', { why: 'internal cid' })])
  const r = await other.call(B, base, undefined)
  assert.equal(r.structuredContent.output.error.code, 'product-error', 'any other product error is still the fixed sentence')
})

test('a resend that adds a decision is never answered from what the hub remembered of the call without one', async () => {
  const h = hop()
  const first = await h.call(B, { ...base, idempotencyKey: 'k2' }, undefined)
  assert.equal(first.isError, undefined)
  const withDecision = await h.call(B, { ...base, idempotencyKey: 'k2', decision: decision() }, undefined)
  assert.notDeepEqual(withDecision, first, 'the remembered answer was given to a call carrying a decision')
  assert.equal(withDecision.structuredContent.error.code, 'idempotency-conflict')
  const withMandate = await h.call(B, { ...base, idempotencyKey: 'k2', mandate: mandate() }, undefined)
  assert.equal(withMandate.structuredContent.error.code, 'idempotency-conflict')
  assert.equal(h.sent.length, 1)
  const same = await h.call(B, { ...base, idempotencyKey: 'k2' }, undefined)
  assert.deepEqual(same, first, 'the plain resend no longer replays')
})

// ── the wire: what the product receives in `_meta` ─────────────────────────────────────────────────────────────
test('the product receives them as _meta.decision and _meta.mandate beside the traceparent', async () => {
  const metas = []
  const http = createServer(async (req, res) => {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined
    if (body?.method === 'tools/call') metas.push(body.params._meta)
    const server = new McpServer({ name: 'fabric-inbox', version: '0.9.0' })
    server.registerTool('read_message', { inputSchema: { messageId: z.string() } }, async () => ({ content: [{ type: 'text', text: 'ok' }], structuredContent: { ok: true } }))
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.on('close', () => { void transport.close(); void server.close() })
    await server.connect(transport)
    await transport.handleRequest(req, res, body)
  })
  await new Promise((r) => http.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${http.address().port}/mcp`
  const TRACE = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
  try {
    const d = decision(), m = mandate()
    const r = await forwardToProduct({ mcpUrl: url, clientId: 'c', clientSecret: 's', narrowing: null, capability: 'read_message', input: { messageId: 'm1' }, traceparent: TRACE, timeoutMs: 5000, decision: d, mandate: m })
    assert.equal(r.ok, true, JSON.stringify(r))
    assert.deepEqual(metas[0], { traceparent: TRACE, decision: d, mandate: m })
    const plain = await forwardToProduct({ mcpUrl: url, clientId: 'c', clientSecret: 's', narrowing: null, capability: 'read_message', input: { messageId: 'm1' }, traceparent: TRACE, timeoutMs: 5000 })
    assert.equal(plain.ok, true)
    assert.deepEqual(metas[1], { traceparent: TRACE })
  } finally {
    http.close()
  }
})
// #endregion hub-call-authority
