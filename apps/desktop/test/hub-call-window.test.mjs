// CO-200 (Fabric 0.4.0 wave 1, REQ-32): a looping agent's calls that Fabric ends before forwarding are itemised
// once per binding and error code in a ten-minute window and counted after that; a forwarded call keeps its span.
// Pure: the grants, the connection and the journal are in-memory stand-ins; the clock and the timers are the test's.
// Watched failing: with `notSentSpan` journalling every hop (the 0.3.x behaviour), the loop writes 7 200 events.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const SRC = path.resolve(import.meta.dirname, '../src/main')
const { createAgentCall, NOT_SENT_WINDOW_MS, NOT_SENT_CODES } = await import(path.join(SRC, 'hubCall.ts'))

test('the codes a summary may carry are the database\'s: NOT_SENT_CODES equals migration 82\'s v_codes', () => {
  const sql = readFileSync(path.resolve(import.meta.dirname, '../../../supabase/migrations/20261011000082_write_rules_at_the_door.sql'), 'utf8')
  const m = /v_codes\s+constant\s+text\[\]\s*:=\s*array\[([^\]]*)\]/.exec(sql)
  assert.ok(m, 'migration 82 declares v_codes')
  const dbCodes = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  assert.ok(dbCodes.length > 0)
  assert.deepEqual([...NOT_SENT_CODES].sort(), dbCodes.sort())
})

const A = { id: '8200000a-0000-4000-8000-0000000000a1', agent_id: 'example-agent.default' }
const B = { id: '8200000a-0000-4000-8000-0000000000b1', agent_id: 'other-agent.default' }
const read = { agentId: 'fabric-inbox', capability: 'read_message', input: { accountId: 'cloudflare:news@example.com', messageId: 'm1' } }
const SUMMARY_KEYS = ['caller', 'error_code', 'first_at', 'last_at', 'outcome', 'suppressed', 'window_ms']

function world({ granted = false, failAppend = null } = {}) {
  let clock = Date.parse('2026-10-11T08:00:00Z')
  const timers = []
  const events = []
  const exp = new Date(clock + 1e10).toISOString()
  const grants = granted ? [{ id: 'g1', binding_id: A.id, callee: 'fabric-inbox', capability: 'read_message', resource: 'cloudflare:news@example.com', expires_at: exp, revoked_at: null }] : []
  const call = createAgentCall({
    access: { liveGrantsOf: async (b) => grants.filter((g) => g.binding_id === b.id) },
    store: {
      liveConnection: async () => ({ id: 'c1', product: 'fabric-inbox', mcp_url: 'https://inbox.example.com/mcp', client_id: 'cid', secret_ref: { project: 'fabric', env: 'local', name: 'FABRIC_INBOX_CLIENT_SECRET' }, removed_at: null }),
      append: async (type, actor, payload) => {
        if (failAppend && failAppend(type)) throw new Error('journal down')
        events.push({ type, actor, payload })
        return events.length
      }
    },
    vault: { read: async () => ({ ok: true, value: 'cf-secret' }) },
    forward: async () => ({ ok: true, result: { content: [{ type: 'text', text: 'MAIL' }] }, wallMs: 1 }),
    estateId: '00000000-0000-4000-8000-000000000000',
    now: () => clock,
    schedule: (fn, ms) => { const t = { at: clock + ms, fn, live: true }; timers.push(t); return () => { t.live = false } }
  })
  /** Moves the clock and runs every timer that has come due, in order. */
  const advance = async (ms) => {
    const until = clock + ms
    for (;;) {
      const due = timers.filter((t) => t.live && t.at <= until).sort((a, b) => a.at - b.at)[0]
      if (!due) break
      clock = due.at
      due.live = false
      await due.fn()
      await new Promise((r) => setImmediate(r))
    }
    clock = until
  }
  return { call, events, advance, spans: () => events.filter((e) => e.type === 'hub.call.forwarded@1'), summaries: () => events.filter((e) => e.type === 'hub.call.refusals.summarized@1'), timers }
}

test('a caller looping on refusals for an hour at 120 calls a minute writes at most two events per window, and every call is accounted for', async () => {
  const w = world()
  const calls = 120 * 60
  for (let i = 0; i < calls; i++) {
    await w.call(A, read, undefined)
    await w.advance(500)
  }
  await w.advance(NOT_SENT_WINDOW_MS)
  const windows = Math.ceil((calls * 500) / NOT_SENT_WINDOW_MS)
  assert.ok(w.events.length <= 2 * windows, `${w.events.length} events for ${calls} refusals; at most ${2 * windows}`)
  assert.equal(w.spans().length, windows, 'one itemised span opens each window')
  const counted = w.summaries().reduce((n, e) => n + e.payload.suppressed, 0)
  assert.equal(w.spans().length + counted, calls, 'a refusal neither itemised nor counted is a refusal the journal lost')
})

test('the summary carries the door\'s fields only: the caller, the outcome and code, how many, and when', async () => {
  const w = world()
  await w.call(A, read, undefined)
  await w.advance(1000)
  await w.call(A, read, undefined)
  await w.advance(2000)
  await w.call(A, read, undefined)
  assert.equal(w.summaries().length, 0, 'the window is still open')
  await w.advance(NOT_SENT_WINDOW_MS)
  const [s] = w.summaries()
  assert.deepEqual(Object.keys(s.payload).sort(), SUMMARY_KEYS)
  assert.deepEqual(s.payload.caller, { binding_id: A.id, agent_id: A.agent_id })
  assert.equal(s.payload.outcome, 'refused')
  assert.equal(s.payload.error_code, 'access-required')
  assert.equal(s.payload.suppressed, 2)
  assert.equal(s.payload.first_at, '2026-10-11T08:00:01.000Z')
  assert.equal(s.payload.last_at, '2026-10-11T08:00:03.000Z')
  assert.equal(s.payload.window_ms, NOT_SENT_WINDOW_MS)
  assert.deepEqual(s.actor, { kind: 'system', id: 'fabric-hub' })
  assert.ok(!JSON.stringify(s.payload).includes('m1'), 'the summary carried the arguments')
})

test('each binding and each error code has its own window', async () => {
  const w = world()
  await w.call(A, read, undefined)
  await w.call(B, read, undefined)
  await w.call(A, { ...read, agentId: 'not-a-product' }, undefined)
  await w.call(A, { ...read, agentId: 'not-a-product' }, undefined)
  assert.deepEqual(w.spans().map((e) => [e.payload.caller.binding_id, e.payload.error_code]),
    [[A.id, 'access-required'], [B.id, 'access-required'], [A.id, 'unknown-callee']])
  await w.advance(NOT_SENT_WINDOW_MS)
  assert.deepEqual(w.summaries().map((e) => [e.payload.caller.binding_id, e.payload.error_code, e.payload.suppressed]), [[A.id, 'unknown-callee', 1]])
})

test('after its window closes, the next refusal of the kind is itemised again', async () => {
  const w = world()
  await w.call(A, read, undefined)
  await w.advance(NOT_SENT_WINDOW_MS + 1)
  await w.call(A, read, undefined)
  assert.equal(w.spans().length, 2)
  assert.equal(w.summaries().length, 0, 'a window with nothing counted writes no summary')
})

test('a forwarded call keeps its own span every time', async () => {
  const w = world({ granted: true })
  for (let i = 0; i < 50; i++) await w.call(A, read, undefined)
  assert.equal(w.spans().length, 50)
  assert.ok(w.spans().every((e) => e.payload.outcome === 'succeeded'))
  assert.equal(w.summaries().length, 0)
})

test('flush writes every open count at once — at quit — and revoking a binding writes its own', async () => {
  const w = world()
  for (let i = 0; i < 3; i++) await w.call(A, read, undefined)
  for (let i = 0; i < 4; i++) await w.call(B, read, undefined)
  w.call.forgetBinding(A.id)
  await new Promise((r) => setImmediate(r))
  assert.deepEqual(w.summaries().map((e) => [e.payload.caller.binding_id, e.payload.suppressed]), [[A.id, 2]])
  await w.call.flush()
  assert.deepEqual(w.summaries().map((e) => [e.payload.caller.binding_id, e.payload.suppressed]), [[A.id, 2], [B.id, 3]])
  assert.ok(w.timers.every((t) => !t.live), 'a flushed window left its timer running')
  await w.call.flush()
  assert.equal(w.summaries().length, 2, 'a second flush wrote the same count again')
})

test('a summary the journal will not take is logged, never thrown at the caller', async () => {
  const w = world({ failAppend: (type) => type === 'hub.call.refusals.summarized@1' })
  await w.call(A, read, undefined)
  await w.call(A, read, undefined)
  await assert.doesNotReject(w.advance(NOT_SENT_WINDOW_MS))
  await assert.doesNotReject(w.call.flush())
  assert.equal(w.summaries().length, 0)
  assert.equal(w.spans().length, 1)
})
