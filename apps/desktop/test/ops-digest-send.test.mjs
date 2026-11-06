// CO-503: a collected daily digest reaches Observatory 0.34.0's `ops.digest.record` over stdio, under the operator's
// access binding. No Observatory: the tool call is a stand-in with the shapes `ops_digest_store.record_call` answers.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { createOpsDigestSender, RECORD_TOOL } = await import(path.resolve(import.meta.dirname, '../src/main/opsDigestSend.ts'))

const line = JSON.stringify({ schema: 'ops.digest.daily@1', day: '2026-11-05', hours: 2, ops: [], total: { ok: 0, failed: 0, unknown: 0 }, risen: [] })
const own = { service: { id: 'fabric', instance: 'default' }, source: 'app', day: '2026-11-05', line }

function sender({ token = true, answer = { recorded: true } } = {}) {
  const calls = []
  const s = createOpsDigestSender({ tokenFile: '/data/observatory/ops-digest-binding.token', exists: () => token, call: async (n, a) => { calls.push([n, a]); return answer } })
  return { s, calls }
}

test('Fabric\'s own line goes to ops_digest_record with its source and the parsed line, and no service argument', async () => {
  const { s, calls } = sender()
  await s.send(own)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], RECORD_TOOL)
  assert.deepEqual(calls[0][1], { source: 'app', digest: JSON.parse(line) })
  assert.equal(s.ready(), true)
})

test('without the operator\'s binding nothing is called, and the refusal names it', async () => {
  const { s, calls } = sender({ token: false })
  assert.equal(s.ready(), false)
  await assert.rejects(s.send(own), /binding-required/)
  assert.equal(calls.length, 0)
})

test('Observatory\'s typed refusal is a failure with its code, never a send', async () => {
  const { s } = sender({ answer: { error: 'ops digest refused', code: 'binding-refused', detail: 'binding-expired', hint: 'x' } })
  await assert.rejects(s.send(own), /binding-refused: binding-expired/)
})

test('another service\'s line is not carried over stdio: the sender says why, and refuses it if asked', async () => {
  const { s, calls } = sender()
  assert.equal(s.accepts({ id: 'fabric', instance: 'default' }), null)
  assert.match(s.accepts({ id: 'inbox', instance: 'default' }), /delegation token/)
  await assert.rejects(s.send({ ...own, service: { id: 'inbox', instance: 'default' } }), /delegation-required/)
  assert.equal(calls.length, 0)
})

test('a line that does not parse is refused before any call', async () => {
  const { s, calls } = sender()
  await assert.rejects(s.send({ ...own, line: '{not json' }), /digest-refused/)
  assert.equal(calls.length, 0)
})

const { createOpsDigestPass } = await import(path.resolve(import.meta.dirname, '../src/main/opsDigestSend.ts'))

test('the cycle collects at most once an hour, and without the binding says so once and sends nothing', async () => {
  let t = 0, ready = false, passes = 0
  const logs = []
  const p = createOpsDigestPass({ ready: () => ready, pass: async () => { passes++; return { sent: 1, failed: 0, skipped: [] } }, log: (o, d) => logs.push([o, d]), now: () => t })
  await p.onPass(); t += 60_000; await p.onPass()
  assert.deepEqual(logs, [['ok', { sent: 0, reason: 'binding-required' }]], 'said once in the hour')
  t += 3_600_000; await p.onPass()
  assert.equal(logs.length, 1, 'and not again while it is still missing')
  assert.equal(passes, 0)
  ready = true; t += 3_600_000; await p.onPass()
  assert.equal(passes, 1)
  assert.deepEqual(logs.at(-1), ['ok', { sent: 1, failed: 0, skipped: 0 }])
  t += 60_000; await p.onPass()
  assert.equal(passes, 1, 'not twice in an hour')
})

test('a collection that throws is logged and tried at the next hour', async () => {
  let t = 0
  const logs = []
  const p = createOpsDigestPass({ ready: () => true, pass: async () => { throw new Error('observatory down') }, log: (o, d) => logs.push([o, d]), now: () => t })
  await p.onPass()
  assert.deepEqual(logs, [['failed', { note: 'observatory down' }]])
})
