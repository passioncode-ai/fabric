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

test('the 0.3.17 review, ER-5: a finished request takes its abort listener off the transport\'s one signal', async () => {
  const srv = await server((req, res) => res.end('ok'))
  try {
    let live = 0
    const signal = { aborted: false, reason: undefined, addEventListener: () => { live++ }, removeEventListener: () => { live-- } }
    const f = checkedFetch(async () => null)
    for (let i = 0; i < 5; i++) await (await f(`http://127.0.0.1:${srv.port}/mcp`, { signal })).text()
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(live, 0)
  } finally { await srv.close() }
})

test('the 0.3.17 review, ER-1: a 403 naming a peer code is not a revoked credential; a plain 403 still is', async () => {
  const { makeHubCall, httpTransportWith, HubPeerRefusedError: Peer } = await import(src('fabricMcpClient.ts'))
  const answer = (body) => async () => new Response(JSON.stringify(body), { status: 403, headers: { 'content-type': 'application/json' } })
  await assert.rejects(makeHubCall(httpTransportWith(answer({ error: 'peer-foreign-account: another account', code: 'peer-foreign-account' })))('http://127.0.0.1:1/mcp', 'c', 'fabric.session.enroll', {}), (e) => e instanceof Peer && e.code === 'peer-foreign-account')
  assert.deepEqual(await makeHubCall(httpTransportWith(answer({ error: 'revoked' })))('http://127.0.0.1:1/mcp', 'c', 'fabric.session.enroll', {}), { unauthorized: true })
})

test('the 0.3.17 review, ER-2: a request refused before its head left is reported as not run', async () => {
  const { classifyFailure } = await import(src('fabricMcp.ts'))
  const f = classifyFailure(new HubOwnerRefusedError('foreign-user: table-restricted'))
  assert.equal(f.mayHaveRun, false)
  assert.match(f.refusal.reason, /table-restricted/)
})

test('CO-561: an owner that could not be told keeps the session (a wait); another account\'s end drops it; a slow first read still gets a second', async () => {
  const { classifyFailure } = await import(src('fabricMcp.ts'))
  const { verifyConnection } = await import(src('listenerOwner.ts'))
  const wait = classifyFailure(new HubOwnerRefusedError('foreign-user: the owner of the hub\'s end could not be told (table-restricted: the hub\'s end of this connection could not be seen)'))
  assert.deepEqual([wait.drop, wait.mayHaveRun, wait.refusal.status], [false, false, 503])
  const foreign = classifyFailure(new HubOwnerRefusedError('foreign-user: the hub\'s end of this connection is held by another account of this computer'))
  assert.equal(foreign.drop, true)
  let reads = 0
  const slowThenSeen = async () => { reads++; if (reads === 1) { await new Promise((r) => setTimeout(r, 40)); return { unknown: 'table-restricted' } } return { uid: 501 } }
  assert.equal(await verifyConnection(1, 2, { read: slowThenSeen, me: () => 501, settleMs: 20, stepMs: 1 }), null, 'the window counts from the end of the first read')
  assert.equal(reads, 2)
})

test('CO-532 (DEC-0155 RT-1): with nothing among this account\'s descriptors the table is read: another process\'s row names its owner, a header-only or failing table is table-restricted', async () => {
  const { serverEndPidsFromNetstat } = await import(src('listenerOwner.ts'))
  // Captured on macOS 26 (`netstat -anv -p tcp`), the ports and pids replaced.
  const header = 'Active Internet connections (including servers)\nProto Recv-Q Send-Q  Local Address                                 Foreign Address                               (state)          rxbytes      txbytes  rhiwat  shiwat          process:pid    state  options           gencnt    flags   flags1 usecnt rtncnt fltrs\n'
  const at = (local, remote, proc) => `tcp4       0      0  127.0.0.1.${local}        127.0.0.1.${remote}        ESTABLISHED            0            0  408300  146988           ${proc}  00002 00000000 000000001217af8f 00000080 01000800      2      0 000000\n`
  const row = at(47070, 53211, 'Fabric:777'), client = at(53211, 47070, 'node:888')
  assert.deepEqual(serverEndPidsFromNetstat(header + row + client, 47070, 53211), [777])
  assert.deepEqual(serverEndPidsFromNetstat(header + client, 47070, 53211), [])
  // The 0.3.17 release review, iteration 2, ER-1: the process name is chosen by whoever holds the port, so a name
  // `x:1 y` must not be read as pid 1; its own pid is the column's last `:digits`.
  assert.deepEqual(serverEndPidsFromNetstat(header + at(47070, 53211, 'x:1 y:99325'), 47070, 53211), [99325])
  // A row of another shape (a field missing after the column) names no pid.
  assert.deepEqual(serverEndPidsFromNetstat(header + row.replace(' 000000\n', '\n'), 47070, 53211), [])
  const runs = (table, uid) => async (cmd) => cmd.endsWith('lsof') ? '' : cmd.endsWith('netstat') ? table : `  ${uid}\n`
  assert.deepEqual(await readConnectionOwner(47070, 53211, { platform: 'darwin', run: runs(header + row, 502) }), { uid: 502 })
  assert.match(ownerRefusal(await readConnectionOwner(47070, 53211, { platform: 'darwin', run: runs(header + row, 502) }), 501), /another account/)
  assert.match((await readConnectionOwner(47070, 53211, { platform: 'darwin', run: runs(header, 502) })).unknown, /^table-restricted/)
  assert.match((await readConnectionOwner(47070, 53211, { platform: 'darwin', run: runs('', 502) })).unknown, /^table-restricted/)
  const failing = async (cmd) => { if (cmd.endsWith('lsof')) return ''; throw new Error('exit 1') }
  assert.match((await readConnectionOwner(47070, 53211, { platform: 'darwin', run: failing })).unknown, /^table-restricted: the socket table could not be read/)
})
