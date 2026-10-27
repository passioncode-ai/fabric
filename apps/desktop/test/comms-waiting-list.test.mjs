// The waiting requests' list read in main (the mockup parity, home gap D11): only when the count says something waits,
// a failed read leaves the board's reply untouched.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { withWaitingList } = await import(path.resolve(import.meta.dirname, '../src/main/commsWaitingList.ts'))

const submitted = [{ occurred_at: '2026-10-25T09:00:00Z', payload: { kind: 'request', message_id: 'r1', thread_id: 't1', sender_project_id: 'fab', request: { target_project_id: 'dash', capability: 'question' } } }]
function deps({ journalError = null, transitionsFailed = null, responders = { ok: true, responders: [] } } = {}) {
  const calls = []
  return {
    calls,
    now: () => Date.parse('2026-10-27T10:00:00Z'),
    responders: async () => responders,
    threads: async () => ({ ok: true, threads: [{ id: 't1', subject: 'API page' }], more: false, before: null }),
    store: {
      select: (table, columns) => {
        const call = { table, columns, eq: [] }
        calls.push(call)
        const chain = { eq: (c, v) => { call.eq.push([c, v]); return chain }, gte: () => chain, order: () => chain, limit: (n) => { call.limit = n; return Promise.resolve(journalError ? { data: null, error: { message: journalError } } : { data: submitted, error: null }) } }
        return chain
      },
      selectIn: async (table, columns, key, values, chunk, signal, eq) => { calls.push({ table, key, values, eq }); return transitionsFailed ? { rows: [], failed: transitionsFailed } : { rows: [], failed: null } }
    }
  }
}

test('lists the waiting requests with their subjects when the count says some wait', async () => {
  const d = deps()
  const r = await withWaitingList({ ok: true, requests: 1, oldestRequestAt: '2026-10-25T09:00:00Z' }, d)
  assert.deepEqual(r.list, [{ requestId: 'r1', threadId: 't1', from: 'fab', to: 'dash', capability: 'question', subject: 'API page', at: '2026-10-25T09:00:00Z' }])
  assert.equal(r.listComplete, true)
  assert.equal(r.requests, 1)
  assert.deepEqual(d.calls[0].eq, [['type', 'comms.message_submitted@1'], ['payload->>kind', 'request']])
  assert.equal(d.calls[0].limit, 1000)
  assert.deepEqual(d.calls[1].eq, [['type', 'comms.request_transitioned@1']])
  assert.equal(d.calls[1].key, 'payload->>request_id')
})

test('nothing waits: an empty, complete list and no read', async () => {
  const d = deps()
  assert.deepEqual(await withWaitingList({ ok: true, requests: 0 }, d), { ok: true, requests: 0, list: [], listComplete: true })
  assert.equal(d.calls.length, 0)
})

test('a read that fails leaves the board\'s reply as it was; an unavailable board stays unavailable', async () => {
  const reply = { ok: true, requests: 1, oldestRequestAt: '2026-10-25T09:00:00Z' }
  assert.equal(await withWaitingList(reply, deps({ journalError: 'away' })), reply)
  assert.equal(await withWaitingList(reply, deps({ transitionsFailed: 'away' })), reply)
  assert.equal(await withWaitingList(reply, deps({ responders: { ok: false, error: { code: 'unavailable', message: 'x' } } })), reply)
  const down = { ok: false, error: { code: 'unavailable', message: 'board away' } }
  assert.equal(await withWaitingList(down, deps()), down)
})

test('ER-15 (0.3.15 review, iteration 3): a thread page that rejects drops the subjects, never the list', async () => {
  const d = deps()
  d.threads = async () => { throw new Error('board away') }
  const r = await withWaitingList({ ok: true, requests: 1, oldestRequestAt: '2026-10-25T09:00:00Z' }, d)
  assert.equal(r.list.length, 1)
  assert.equal(r.list[0].requestId, 'r1')
})
