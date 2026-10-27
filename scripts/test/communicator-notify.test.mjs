// CO-411: the workspace sync's failure reaches the operator's private chat through the communicator's narrow key.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { notifyCommunicator, COMMUNICATOR_URL } from '../lib/communicator-notify.mjs'

function fakeGateway({ refuse = false, toolError = false } = {}) {
  const seen = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      const msg = JSON.parse(body)
      seen.push({ method: msg.method, key: req.headers['x-agw-key'], session: req.headers['mcp-session-id'] ?? null, params: msg.params })
      if (refuse) { res.writeHead(401); res.end('no'); return }
      if (!msg.id) { res.writeHead(202); res.end(); return }
      const result = msg.method === 'initialize'
        ? { protocolVersion: '2025-06-18', capabilities: {} }
        : toolError ? { isError: true, content: [{ type: 'text', text: 'question_expired' }] } : { content: [{ type: 'text', text: '{"status":"queued"}' }] }
      res.writeHead(200, { 'content-type': 'text/event-stream', ...(msg.method === 'initialize' ? { 'mcp-session-id': 's-1' } : {}) })
      res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result })}\n\n`)
    })
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, seen, url: `http://127.0.0.1:${server.address().port}/mcp` })))
}

test('CO-411: a notice is one initialize, the initialized notification and one communicator.notify call, with the key as a header', async () => {
  const g = await fakeGateway()
  try {
    const r = await notifyCommunicator({ url: g.url, key: 'k-1', eventId: 'e-1', kind: 'failure', text: 'it failed', subject: 'Fabric' })
    assert.equal(r.ok, true)
    assert.deepEqual(g.seen.map((s) => s.method), ['initialize', 'notifications/initialized', 'tools/call'])
    assert.ok(g.seen.every((s) => s.key === 'k-1'), 'every request carries the key header')
    assert.equal(g.seen[2].session, 's-1', 'the call carries the session the gateway named')
    assert.deepEqual(g.seen[2].params, { name: 'communicator.notify', arguments: { eventId: 'e-1', kind: 'failure', text: 'it failed', subject: 'Fabric' } })
  } finally { g.server.close() }
})

test('CO-411: a refused request or a tool error is a failed notice, never a sent one', async () => {
  for (const opts of [{ refuse: true }, { toolError: true }]) {
    const g = await fakeGateway(opts)
    try {
      const r = await notifyCommunicator({ url: g.url, key: 'k', eventId: 'e', kind: 'failure', text: 't' })
      assert.equal(r.ok, false, JSON.stringify(opts))
      assert.doesNotMatch(r.reason, /k-1|x-agw-key/, 'the reason never carries the key')
    } finally { g.server.close() }
  }
})

test('CO-411: no key, a bad kind or an empty text sends nothing', async () => {
  let called = 0
  const fetchImpl = async () => { called++; throw new Error('must not be called') }
  assert.equal((await notifyCommunicator({ key: '', eventId: 'e', kind: 'failure', text: 't', fetchImpl })).ok, false)
  assert.equal((await notifyCommunicator({ key: 'k', eventId: 'e', kind: 'shout', text: 't', fetchImpl })).ok, false)
  assert.equal((await notifyCommunicator({ key: 'k', eventId: 'e', kind: 'failure', text: '', fetchImpl })).ok, false)
  assert.equal(called, 0)
  assert.equal(COMMUNICATOR_URL, 'http://127.0.0.1:47835/mcp/personal-communicator')
})
