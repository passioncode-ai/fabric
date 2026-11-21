// ADR-0207 Decision 3, spec 2026-11-21 §3.3 (R3): a question that needs the owner is signalled once in his personal
// communicator, with a stable eventId; without the key nothing is sent and the log says so once.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createQuestionSignal, questionNotice, KEY_RETRY_MS, MAX_PER_TICK, SIGNAL_WINDOW_MS } from '../src/main/questionSignal.ts'

const NOW = 1_800_000_000_000
const q = (id, over = {}) => ({ id, text: 'Где хранить черновики?', options: [{ id: '1', label: 'В папке проекта', recommended: true }, { id: '2', label: 'В данных приложения' }], project: 'fabric', whyBlocked: null, askedAt: NOW - 60_000, ...over })

function rig(over = {}) {
  const calls = { notices: [], records: [] }
  const sent = new Set()
  let questions = [q('a')]
  const deps = {
    open: async () => questions,
    key: async () => ({ url: 'http://127.0.0.1:1/mcp', key: 'k' }),
    notify: async (_access, n) => { calls.notices.push(n); return { ok: true, reason: null } },
    sent: { has: (id) => sent.has(id), add: (id) => sent.add(id) },
    record: (op, outcome, detail) => calls.records.push({ op, outcome, detail }),
    now: () => NOW, ...over
  }
  return { s: createQuestionSignal(deps), calls, sent, set: (list) => { questions = list } }
}

test('each open question is signalled once, with a stable eventId and the question block', async () => {
  const r = rig()
  assert.equal(await r.s.tick(), 1)
  assert.equal(await r.s.tick(), 0)
  assert.equal(r.calls.notices.length, 1)
  const n = r.calls.notices[0]
  assert.equal(n.eventId, 'fabric-question-a')
  assert.equal(n.kind, 'question')
  assert.equal(n.question.questionId, 'a')
  assert.ok(Number.isInteger(n.question.expiresAt) && n.question.expiresAt > NOW / 1000)
  assert.match(n.text, /^fabric: Где хранить черновики\?/)
  assert.match(n.text, /1\. В папке проекта \(рекомендуется\)/)
  assert.match(n.text, /«Нужны вы»/)
})

test('without the key nothing is sent, the log says so once, and the question waits for the next pass', async () => {
  let key = { reason: 'the vault slot is empty' }
  let reads = 0
  let t = NOW
  const r = rig({ key: async () => { reads++; return key }, now: () => t })
  await r.s.tick()
  await r.s.tick()
  assert.equal(r.calls.notices.length, 0)
  assert.equal(reads, 1, 'a missing key is not read again at every pass')
  assert.equal(r.calls.records.filter((x) => x.op === 'question.signal-off').length, 1)
  key = { url: 'u', key: 'k' }
  t += KEY_RETRY_MS
  assert.equal(await r.s.tick(), 1)
})

test('a refused notice is tried again; at most a few per pass; a question older than the window is not signalled', async () => {
  let n = 0
  const r = rig({ notify: async () => ({ ok: n++ > 0, reason: n === 1 ? 'HTTP 503' : null }) })
  assert.equal(await r.s.tick(), 0)
  assert.equal(await r.s.tick(), 1)
  const many = rig()
  many.set(Array.from({ length: 12 }, (_, i) => q(`m${i}`)))
  assert.equal(await many.s.tick(), MAX_PER_TICK)
  const old = rig()
  old.set([q('old', { askedAt: NOW - SIGNAL_WINDOW_MS - 1 })])
  assert.equal(await old.s.tick(), 0)
})

test('the notice is at most 3,500 characters and always ends with where to answer', () => {
  const n = questionNotice(q('long', { text: 'Слишком длинный вопрос? '.repeat(400) }), NOW)
  assert.ok(n.text.length <= 3500)
  assert.match(n.text, /«Нужны вы»\.$/)
})

test('sendNotice speaks the MCP route: initialize, initialized, one communicator.notify with the notice, the key only in its header', async () => {
  const { sendNotice } = await import('../src/main/questionSignal.ts')
  const seen = []
  const fake = async (_url, init) => {
    const body = JSON.parse(init.body)
    seen.push({ method: body.method, name: body.params?.name, args: body.params?.arguments, key: init.headers['x-agw-key'] })
    const answer = body.method === 'notifications/initialized' ? '' : JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [] } })
    return { status: 200, headers: { get: () => null }, text: async () => answer }
  }
  const n = questionNotice(q('z'), NOW)
  assert.deepEqual(await sendNotice({ url: 'http://127.0.0.1:1/mcp', key: 'secret-k' }, n, fake), { ok: true, reason: null })
  assert.deepEqual(seen.map((s) => s.method), ['initialize', 'notifications/initialized', 'tools/call'])
  assert.equal(seen[2].name, 'communicator.notify')
  assert.equal(seen[2].args.eventId, 'fabric-question-z')
  const failed = await sendNotice({ url: 'u', key: 'secret-k' }, n, async () => { throw new TypeError('boom') })
  assert.equal(failed.ok, false)
  assert.doesNotMatch(failed.reason, /secret-k/)
})

test('on a machine that never signalled, the questions open at the first pass are taken as known; only later ones are sent', async () => {
  const r = rig({ firstRun: true })
  assert.equal(await r.s.tick(), 0)
  assert.equal(r.calls.notices.length, 0)
  assert.ok(r.sent.has('a'))
  r.set([q('a'), q('b')])
  assert.equal(await r.s.tick(), 1)
  assert.equal(r.calls.notices[0].eventId, 'fabric-question-b')
})
