// First-slice plan B2b-2: Fabric's authenticated loopback controller client against a real
// RFC 6455 server on 127.0.0.1 written here (the vendor backend is exercised by the B2b-3 probe).
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import http from 'node:http'
import { connectLoopback, LOOPBACK_LIMITS } from '../src/main/loopbackWsClient.ts'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', token = randomBytes(32).toString('hex')
const delay = ms => new Promise(r => setTimeout(r, ms))
const until = async (fn, label, ms = 4000) => { const d = performance.now() + ms; while (performance.now() < d) { if (await fn()) return; await delay(5) } throw Error(label) }
const serverFrame = (opcode, payload, { fin = true, mask = false, rsv = 0 } = {}) => {
  const n = payload.length, head = n < 126 ? Buffer.from([(fin ? 0x80 : 0) | rsv | opcode, (mask ? 0x80 : 0) | n])
    : n < 65536 ? Buffer.from([(fin ? 0x80 : 0) | opcode, 126, n >> 8, n & 255]) : (() => { const b = Buffer.alloc(10); b[0] = (fin ? 0x80 : 0) | opcode; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b })()
  return Buffer.concat([head, mask ? Buffer.alloc(4) : Buffer.alloc(0), payload])
}
// One server; `mode` decides how the next connection behaves.
const state = { mode: 'reply', received: [], connections: [], headers: [] }
const server = http.createServer((q, r) => { r.statusCode = 404; r.end() })
server.on('upgrade', (req, socket) => {
  state.headers.push(req.headers)
  if (req.headers.authorization !== `Bearer ${token}`) { socket.end('HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n'); return }
  const accept = state.mode === 'bad-accept' ? 'nope' : createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64')
  const handshake = `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`
  if (state.mode === 'burst') { // the first frame shares the handshake's write; the second follows at once
    const note = (n, pad = '') => serverFrame(1, Buffer.from(JSON.stringify({ method: 'order/note', params: { n, pad } })))
    socket.write(Buffer.concat([Buffer.from(handshake), note(1), note(2, 'y'.repeat(300_000))])); socket.write(Buffer.concat([note(3), note(4)]))
  } else socket.write(handshake)
  const mode = state.mode, conn = { socket, mode, frames: [] }; state.connections.push(conn)
  if (mode === 'pause') socket.pause()
  let buf = Buffer.alloc(0)
  socket.on('error', () => {})
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk])
    while (buf.length >= 2) {
      const masked = (buf[1] & 0x80) !== 0, opcode = buf[0] & 0x0f; let len = buf[1] & 0x7f, off = 2
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4 } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10 }
      if (buf.length < off + 4 + len) return
      assert.ok(masked, 'client frames are masked')
      const key = buf.subarray(off, off + 4), payload = Buffer.from(buf.subarray(off + 4, off + 4 + len)); buf = buf.subarray(off + 4 + len)
      for (let i = 0; i < payload.length; i++) payload[i] ^= key[i & 3]
      conn.frames.push({ opcode, text: payload.toString() })
      if (opcode !== 1) continue
      const v = JSON.parse(payload.toString()); state.received.push(v)
      const reply = o => socket.write(serverFrame(1, Buffer.from(JSON.stringify(o))))
      if (conn.mode === 'silent') continue
      if (conn.mode === 'foreign-id') { reply({ id: 'f'.repeat(36) + v.id.slice(36), result: {} }); continue } // same number, another connection's prefix
      if (conn.mode === 'notify') reply({ method: 'thread/started', params: { threadId: 't' } })
      if (conn.mode === 'server-request' && v.method) { reply({ id: 7, method: 'item/commandExecution/requestApproval', params: {} }); conn.mode = 'reply' }
      if (conn.mode === 'fragmented') { const text = Buffer.from(JSON.stringify({ id: v.id, result: { ok: 1 } })); socket.write(serverFrame(1, text.subarray(0, 5), { fin: false })); socket.write(serverFrame(9, Buffer.from('p'))); socket.write(serverFrame(0, text.subarray(5))); continue }
      if (v.method && 'id' in v) reply({ id: v.id, result: { method: v.method, echo: v.params?.n ?? null } })
    }
  })
  if (mode === 'masked') socket.write(serverFrame(1, Buffer.from('{}'), { mask: true }))
  if (mode === 'binary') socket.write(serverFrame(2, Buffer.from('x')))
  if (mode === 'oversized') socket.write(serverFrame(1, Buffer.alloc(LOOPBACK_LIMITS.frameBytes + 1, 32)))
  if (mode === 'rsv') socket.write(serverFrame(1, Buffer.from('{}'), { rsv: 0x40 }))
  if (mode === 'close') socket.write(serverFrame(8, Buffer.alloc(0)))
  if (mode === 'foreign') socket.write(serverFrame(1, Buffer.from(JSON.stringify({ id: 'someone-else:1', result: {} }))))
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const port = server.address().port
const open = async (mode = 'reply', extra = {}) => { state.mode = mode; const notes = [], reasons = []; const c = await connectLoopback({ port, token, timeoutMs: 1500, onNotification: n => notes.push(n), onClosed: r => reasons.push(r), ...extra }); return { ...c, notes, reasons } }
let count = 0; const test = async (name, fn) => { await fn(); console.log('PASS ' + name); count++ }
try {
  await test('an authorized request is answered over one controller connection', async () => {
    const c = await open(); assert.equal(c.ok, true)
    assert.match(c.client.connectionId, /^controller:[0-9a-f-]{36}$/)
    const r = await c.client.request('initialize', { n: 1 }, () => true)
    assert.deepEqual(r, { status: 'reply', result: { method: 'initialize', echo: 1 } })
    assert.equal(state.headers.at(-1).authorization, `Bearer ${token}`)
    assert.ok(!JSON.stringify(c.client).includes(token), 'the client object never exposes the token')
    c.client.close()
  })

  await test('a wrong token is refused as unauthorized; a malformed or absent token never connects', async () => {
    const before = state.headers.length
    const wrong = await connectLoopback({ port, token: randomBytes(32).toString('hex'), onNotification() {} })
    assert.deepEqual(wrong, { ok: false, reason: 'unauthorized' })
    for (const t of ['', 'short', 'has space in it 1234', undefined, 'x'.repeat(513)])
      assert.deepEqual(await connectLoopback({ port, token: t, onNotification() {} }), { ok: false, reason: 'invalid_request' })
    assert.equal(state.headers.length, before + 1, 'only the wrong-token attempt reached the server')
  })

  await test('a responder whose accept key is wrong is not a WebSocket peer', async () => {
    assert.deepEqual(await open('bad-accept').then(c => ({ ok: c.ok, reason: c.reason })), { ok: false, reason: 'invalid_handshake' })
  })

  await test('a fence revoked between queue and write sends nothing', async () => {
    const c = await open(); let allowed = true
    const p = c.client.request('turn/interrupt', {}, () => allowed)
    allowed = false // after request() returned: the frame is queued, the pump has not run yet
    assert.deepEqual(await p, { status: 'not_sent', reason: 'effect_fenced' })
    await delay(30); assert.equal(state.connections.at(-1).frames.length, 0, 'no frame reached the backend')
    assert.equal((await c.client.request('initialize', {}, () => true)).status, 'reply', 'the connection is still usable')
    c.client.close()
  })

  await test('under backpressure, frames still queued when their fence lapses are never written', async () => {
    const c = await open('pause'), big = 'x'.repeat(900_000); let allowed = true
    const results = []
    for (let i = 0; i < 60 && !c.client.queued; i++) { results.push(c.client.request('turn/start', { n: i, big }, () => allowed)); await delay(5) }
    await until(() => c.client.queued > 0, 'backpressure reached')
    for (let i = 0; i < 3; i++) results.push(c.client.request('turn/start', { n: 100 + i, big }, () => allowed))
    allowed = false
    const conn = state.connections.at(-1); conn.mode = 'reply'; conn.socket.resume()
    const settled = await Promise.all(results)
    const fenced = settled.filter(r => r.reason === 'effect_fenced').length, answered = settled.filter(r => r.status === 'reply').length
    assert.ok(fenced >= 3, `queued frames were fenced (${fenced})`)
    await delay(50)
    assert.equal(conn.frames.length, answered, 'the backend received exactly the frames that were written before the fence lapsed')
    c.client.close()
  })

  await test('a deadline is unknown once written and never resent; a closed client never reopens', async () => {
    const c = await open('silent'), r = await c.client.request('turn/start', {}, () => true)
    assert.deepEqual(r, { status: 'outcome_unknown', reason: 'deadline' })
    await delay(50); assert.equal(state.connections.at(-1).frames.length, 1)
    c.client.close(); assert.equal(c.client.closed, 'closed_locally'); assert.deepEqual(c.reasons, ['closed_locally'])
    assert.deepEqual(await c.client.request('initialize', {}, () => true), { status: 'not_sent', reason: 'closed_locally' })
    const again = await open(); assert.notEqual(again.client.connectionId, c.client.connectionId, 'a reconnect is a new writer identity')
    again.client.close()
  })

  await test('a request pending when the backend goes away is unknown', async () => {
    const c = await open('silent'), p = c.client.request('turn/start', {}, () => true)
    await until(() => state.connections.at(-1).frames.length === 1, 'written')
    state.connections.at(-1).socket.destroy()
    const r = await p; assert.equal(r.status, 'outcome_unknown'); assert.ok(c.client.closed)
  })

  await test('backend requests are refused, never approved; notifications reach the consumer', async () => {
    const c = await open('server-request'), r = await c.client.request('turn/start', {}, () => true)
    assert.equal(r.status, 'reply')
    await until(() => state.connections.at(-1).frames.some(f => f.text.includes('"id":7')), 'refusal written')
    const refusal = JSON.parse(state.connections.at(-1).frames.find(f => f.text.includes('"id":7')).text)
    assert.deepEqual(refusal, { id: 7, error: { code: -32601, message: 'Unsupported request' } })
    c.client.close()
    const n = await open('notify'); assert.equal((await n.client.request('thread/start', {}, () => true)).status, 'reply')
    assert.deepEqual(n.notes, [{ method: 'thread/started', params: { threadId: 't' } }]); n.client.close()
  })

  await test('fragmented replies reassemble around a ping, which is answered', async () => {
    const c = await open('fragmented'), r = await c.client.request('initialize', {}, () => true)
    assert.deepEqual(r, { status: 'reply', result: { ok: 1 } })
    await until(() => state.connections.at(-1).frames.some(f => f.opcode === 10), 'pong written')
    c.client.close()
  })

  await test('bytes that arrive with the handshake are never overtaken by later chunks', async () => {
    for (let i = 0; i < 20; i++) {
      const c = await open('burst'); await until(() => c.notes.length === 4 || c.client.closed, 'four notes'); assert.equal(c.client.closed, null, 'no frame was misparsed')
      assert.deepEqual(c.notes.map(n => n.params.n), [1, 2, 3, 4], 'order'); c.client.close()
    }
  })

  await test('malformed backend frames close the connection with a fixed reason', async () => {
    for (const [mode, reason] of [['masked', 'masked_server_frame'], ['binary', 'binary_frame'], ['oversized', 'frame_limit'], ['rsv', 'reserved_bits'], ['close', 'backend_closed'], ['foreign', 'foreign_response']]) {
      const c = await open(mode); assert.equal(c.ok, true, mode + ' ' + c.reason)
      await until(() => c.client.closed, mode + ' closed'); assert.equal(c.client.closed, reason, mode)
    }
  })

  await test('a reply carrying another prefix with this request\'s number is foreign', async () => {
    const c = await open('foreign-id'), r = await c.client.request('initialize', {}, () => true)
    assert.equal(r.status, 'outcome_unknown'); assert.equal(c.client.closed, 'foreign_response')
  })

  await test('a notification is written under the same edge fence', async () => {
    const c = await open(); let allowed = true
    assert.deepEqual(await c.client.notify('initialized', undefined, () => true), { status: 'written' })
    const p = c.client.notify('initialized', undefined, () => allowed); allowed = false
    assert.deepEqual(await p, { status: 'not_sent', reason: 'effect_fenced' })
    await delay(30); const frames = state.connections.at(-1).frames
    assert.equal(frames.length, 1); assert.deepEqual(JSON.parse(frames[0].text), { method: 'initialized' })
    c.client.close(); assert.deepEqual(await c.client.notify('initialized', undefined, () => true), { status: 'not_sent', reason: 'closed_locally' })
  })

  await test('a throwing, non-boolean or async fence refuses', async () => {
    const c = await open()
    for (const fence of [() => { throw Error('private') }, () => 1, async () => true]) assert.deepEqual(await c.client.request('initialize', {}, fence), { status: 'not_sent', reason: 'effect_fenced' })
    let first = true
    assert.deepEqual(await c.client.request('initialize', {}, () => { if (first) { first = false; return true } throw Error('private') }), { status: 'not_sent', reason: 'effect_fenced' }, 'at the edge too')
    await delay(30); assert.equal(state.connections.at(-1).frames.length, 0)
    c.client.close()
  })
  console.log(`PASS ${count} loopback controller client groups; Node ${process.versions.node}`)
} finally {
  for (const c of state.connections) c.socket.destroy()
  server.close()
}
