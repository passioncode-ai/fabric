// CO-528 (the contract's CT-254, v0.1.0+2026-11-07.3): the owner of the hub's end of THIS connection is read on the open
// socket before a request with a token is written, with no cache. Spec: the studio spaces gaps §2.2 (CO-514).
import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import path from 'node:path'

const src = (f) => path.resolve(import.meta.dirname, '../src/main', f)
const { serverEndUidsFromLsof, serverEndFromProcNet, connectionOwnerFromProcNet, readConnectionOwner, ownerRefusal, verifyConnection } = await import(src('listenerOwner.ts'))
const { checkedFetch, HubOwnerRefusedError } = await import(src('fabricMcpClient.ts'))

test('macOS: only the socket holding 127.0.0.1:<hub>->127.0.0.1:<client> counts, never the client\'s own end or another connection', () => {
  const lsof = ['p100', 'u501', 'n127.0.0.1:47070->127.0.0.1:53211', 'p200', 'u501', 'n127.0.0.1:53211->127.0.0.1:47070', 'p300', 'u502', 'n127.0.0.1:47070->127.0.0.1:60000'].join('\n')
  assert.deepEqual(serverEndUidsFromLsof(lsof, 47070, 53211), [501])
  assert.deepEqual(serverEndUidsFromLsof(lsof, 47070, 60000), [502])
  assert.deepEqual(serverEndUidsFromLsof('p200\nu501\nn127.0.0.1:53211->127.0.0.1:47070\n', 47070, 53211), [])
})

test('macOS: a table that shows no end of the connection is table-restricted, never this account\'s', async () => {
  const owner = await readConnectionOwner(47070, 53211, { platform: 'darwin', run: async () => '' })
  assert.match(owner.unknown, /^table-restricted/)
  assert.match(ownerRefusal(owner, 501), /^foreign-user/)
  const failing = await readConnectionOwner(47070, 53211, { platform: 'darwin', run: async () => { throw Object.assign(new Error('exit 1'), { stdout: '' }) } })
  assert.match(failing.unknown, /^table-restricted/)
})

const hdr = '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n'
const row = (local, rem, st, uid, inode) => `   0: ${local} ${rem} ${st} 00000000:00000000 00:00000000 00000000  ${uid}        0 ${inode} 1 0000000000000000 20 4 30 10 -1\n`
// 47070 = 0x B7DE; 53211 = 0x CFDB
const H = 'B7DE', C = 'CFDB'

test('Linux: the accepted connection\'s row decides by its uid when its inode is not 0', () => {
  const t = hdr + row(`0100007F:${H}`, `0100007F:${C}`, '01', 1001, '4242') + row(`0100007F:${H}`, '00000000:0000', '0A', 1002, '99')
  assert.deepEqual(serverEndFromProcNet(t, 47070, 53211), [{ uid: 1001, inode: '4242' }])
  assert.deepEqual(connectionOwnerFromProcNet([t], 47070, 53211), { uid: 1001 })
})

test('Linux: an inode of 0 falls back to the listener on the connection\'s address before the wildcard; several accounts or none are unknown', () => {
  const zero = row(`0100007F:${H}`, `0100007F:${C}`, '01', 0, '0')
  const exact = row(`0100007F:${H}`, '00000000:0000', '0A', 1001, '7')
  const wild = row(`00000000:${H}`, '00000000:0000', '0A', 1002, '8')
  assert.deepEqual(connectionOwnerFromProcNet([hdr + zero + exact + wild], 47070, 53211), { uid: 1001 })
  assert.deepEqual(connectionOwnerFromProcNet([hdr + zero + wild], 47070, 53211), { uid: 1002 })
  assert.match(connectionOwnerFromProcNet([hdr + zero + exact + row(`0100007F:${H}`, '00000000:0000', '0A', 1003, '9')], 47070, 53211).unknown, /2 accounts/)
  assert.match(connectionOwnerFromProcNet([hdr + zero], 47070, 53211).unknown, /could be seen/)
})

test('the check reads again while the end cannot be told yet, then answers; it never keeps an answer', async () => {
  let reads = 0
  const seq = [{ unknown: 'table-restricted: not yet' }, { uid: 501 }]
  assert.equal(await verifyConnection(1, 2, { read: async () => seq[Math.min(reads++, 1)], me: () => 501, stepMs: 1 }), null)
  assert.equal(reads, 2)
  reads = 0
  assert.match(await verifyConnection(1, 2, { read: async () => { reads++; return { unknown: 'table-restricted' } }, me: () => 501, settleMs: 20, stepMs: 5 }), /foreign-user/)
  assert.ok(reads >= 2)
  assert.match(await verifyConnection(1, 2, { read: async () => ({ uid: 502 }), me: () => 501 }), /another account/)
  assert.equal(await verifyConnection(1, 2, { read: async () => ({ sid: 'S-1', mine: true }), me: () => -1 }), null)
})

async function server(handler) {
  const seen = { bytes: 0, requests: [], remotePorts: [] }
  const s = http.createServer((req, res) => handler(req, res, seen))
  s.on('connection', (sock) => { seen.remotePorts.push(sock.remotePort); sock.on('data', (d) => { seen.bytes += d.length }) })
  await new Promise((r) => s.listen(0, '127.0.0.1', r))
  return { port: s.address().port, seen, close: () => new Promise((r) => { s.closeAllConnections(); s.close(r) }) }
}

test('a refused owner: the request fails and the server receives not one byte, so the bearer never left', async () => {
  const srv = await server((req, res) => res.end('no'))
  let asked = null
  try {
    const f = checkedFetch(async (hubPort, clientPort) => { asked = [hubPort, clientPort]; return 'foreign-user: another account' })
    await assert.rejects(f(`http://127.0.0.1:${srv.port}/mcp`, { method: 'POST', headers: { authorization: 'Bearer secret-token' }, body: '{}' }), (e) => e instanceof HubOwnerRefusedError)
    await new Promise((r) => setTimeout(r, 50))
    assert.equal(srv.seen.bytes, 0)
    assert.equal(asked[0], srv.port)
    assert.ok(srv.seen.remotePorts.includes(asked[1]), 'the check names the client port of the connection the server saw')
  } finally { await srv.close() }
})

test('an owned connection: the request carries its headers and body, and a streamed answer arrives whole', async () => {
  const srv = await server((req, res, seen) => {
    let body = ''
    req.on('data', (d) => { body += d })
    req.on('end', () => {
      seen.requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, body })
      res.writeHead(200, { 'content-type': 'text/event-stream', 'mcp-session-id': 's1' })
      res.write('event: message\ndata: 1\n\n')
      setTimeout(() => res.end('event: message\ndata: 2\n\n'), 20)
    })
  })
  try {
  const f = checkedFetch(async () => null)
  const r = await f(`http://127.0.0.1:${srv.port}/mcp?x=1`, { method: 'POST', headers: { Authorization: 'Bearer t' }, body: '{"a":1}' })
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('mcp-session-id'), 's1')
  assert.equal(await r.text(), 'event: message\ndata: 1\n\nevent: message\ndata: 2\n\n')
  assert.deepEqual(srv.seen.requests, [{ method: 'POST', url: '/mcp?x=1', auth: 'Bearer t', body: '{"a":1}' }])
  } finally { await srv.close() }
})

test('only http://127.0.0.1 is spoken, and an aborted request rejects', async () => {
  const f = checkedFetch(async () => null)
  await assert.rejects(f('http://localhost:1/mcp'), /only spoken to on http:\/\/127\.0\.0\.1/)
  const ac = new AbortController()
  ac.abort()
  await assert.rejects(f('http://127.0.0.1:1/mcp', { signal: ac.signal }))
})
