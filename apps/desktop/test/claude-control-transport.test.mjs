import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { PassThrough, Writable } from 'node:stream'
import { createClaudeControlTransport, CLAUDE_CONTROL_LIMITS as L } from '../src/main/claudeControlTransport.ts'

const fixtures = [], sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const busy = ms => { const end = performance.now() + ms; while (performance.now() < end) {} }
function fixture({ timeoutMs = 1000, onEvent, onClosed, write, highWaterMark } = {}) {
  const input = new PassThrough(), frames = [], events = [], reasons = []
  const output = new Writable({ highWaterMark, write(bytes, _encoding, callback) {
    frames.push(JSON.parse(bytes.toString())); if (write) write(bytes, callback); else callback()
  } })
  const transport = createClaudeControlTransport({ input, output, timeoutMs,
    onEvent: onEvent ?? (event => events.push(event)), onClosed: reason => { reasons.push(reason); return onClosed?.(reason) } })
  const f = { input, output, frames, events, reasons, transport,
    raw(bytes) { input.emit('data', bytes) },
    send(event) { input.emit('data', Buffer.from(JSON.stringify(event) + '\n')) },
    response(subtype = 'success', extra = { response: {} }, index = frames.length - 1) {
      this.send({ type: 'control_response', response: { subtype, request_id: frames[index].request_id, ...extra } })
    } }
  fixtures.push(f); return f
}
try {
  // Exact SDK envelopes, no JSON-RPC or raw error/result content in receipts.
  for (const request of [{ subtype: 'interrupt' }, { subtype: 'stop_task', task_id: 'task-123' }]) {
    const f = fixture(), p = f.transport.requestControl(request, () => true)
    assert.deepEqual(f.frames[0], { type: 'control_request', request_id: f.frames[0].request_id, request })
    assert.equal('jsonrpc' in f.frames[0], false)
    f.response('success', { response: { SECRET: 'native body' } })
    const result = await p
    assert.deepEqual(result, { status: 'ack', requestId: f.frames[0].request_id })
    assert.equal('stopped' in result, false); assert.equal('quiescent' in result, false)
    f.response(); assert.equal(f.transport.closed, null, 'duplicate response is retired')
    f.transport.close()
  }
  {
    const f = fixture(), p = f.transport.requestControl({ subtype: 'interrupt' }, () => true)
    f.response('success', { response: null }); assert.equal((await p).status, 'ack')
    const p2 = f.transport.requestControl({ subtype: 'interrupt' }, () => true)
    f.response('error', { error: 'SECRET provider diagnostic' })
    assert.deepEqual(await p2, { status: 'error', requestId: f.frames[1].request_id, code: 'provider_control_error' })
    f.transport.close()
  }
  // Responses resolve only their exact nested request_id, even out of order.
  {
    const f = fixture(), a = f.transport.requestControl({ subtype: 'interrupt' }, () => true), b = f.transport.requestControl({ subtype: 'stop_task', task_id: 'task' }, () => true)
    f.response('success', { response: {} }, 1); f.response('error', { error: 'PRIVATE' }, 0)
    assert.equal((await a).status, 'error'); assert.equal((await b).status, 'ack'); f.transport.close()
  }
  for (const invalid of [null, [], { subtype: ['interrupt'] }, { subtype: 'interrupt', task_id: 'extra' },
    { subtype: 'stop_task' }, { subtype: 'stop_task', task_id: ['task'] }, { subtype: 'stop_task', task_id: '' },
    { subtype: 'stop_task', task_id: 'x'.repeat(129) }, { subtype: 'stop_task', task_id: 'task\nspoof' },
    { subtype: 'can_use_tool' }, { subtype: 'interrupt', permission: 'allow' }, { subtype: 'interrupt', toJSON() { throw Error('PRIVATE') } },
    Object.create({ subtype: 'interrupt' }), Object.defineProperty({}, 'subtype', { get() { throw Error('PRIVATE') } })]) {
    const f = fixture(); assert.equal((await f.transport.requestControl(invalid, () => true)).reason, 'invalid_control_request')
    assert.equal(f.frames.length, 0); f.transport.close()
  }
  for (const gate of [() => false, () => 1, () => ({}), () => Promise.resolve(true), () => Promise.reject(Error('PRIVATE')), () => { throw Error('PRIVATE') }]) {
    const f = fixture(); assert.equal((await f.transport.requestControl({ subtype: 'interrupt' }, gate)).reason, 'effect_fenced')
    assert.equal(f.frames.length, 0); f.transport.close()
  }
  {
    const f = fixture({ timeoutMs: 5 }); const result = await f.transport.requestControl({ subtype: 'interrupt' }, () => { busy(20); return true })
    assert.equal(result.status, 'not_sent'); assert.equal(result.reason, 'deadline'); assert.equal(f.frames.length, 0); f.transport.close()
  }
  {
    const f = fixture(); const r = await f.transport.requestControl({ subtype: 'interrupt' }, () => { f.transport.close(); return true })
    assert.notEqual(r.status, 'ack'); assert.equal(f.frames.length, 0)
  }
  // Lost/late response never retries; timer-starved replies cannot become ACKs.
  {
    // Hold the monotonic clock during synchronous enqueue: host scheduling must not
    // turn this lost-reply case into the separately tested pre-send expiry case.
    const clock = mock.method(performance, 'now', () => 0)
    try {
      const f = fixture({ timeoutMs: 5 }), p = f.transport.requestControl({ subtype: 'interrupt' }, () => true)
      assert.equal(f.frames.length, 1, 'the request crossed the write boundary')
      const result = await p; assert.equal(result.status, 'outcome_unknown'); assert.equal(result.reason, 'deadline')
      f.response(); await sleep(1); assert.equal(f.frames.length, 1); assert.equal(f.transport.closed, null); f.transport.close()
    } finally { clock.mock.restore() }
  }
  {
    let now = 0
    const clock = mock.method(performance, 'now', () => now)
    try {
      const f = fixture({ timeoutMs: 5 }), p = f.transport.requestControl({ subtype: 'interrupt' }, () => true)
      assert.equal(f.frames.length, 1)
      now = 6; f.response()
      const result = await p
      assert.equal(result.status, 'outcome_unknown'); assert.equal(result.reason, 'deadline'); f.transport.close()
    } finally { clock.mock.restore() }
  }
  // Ordinary raw events remain ordered and intact, with no session/origin inference.
  {
    const f = fixture(), events = [{ type: 'system', subtype: 'init', session_id: 'native' },
      { type: 'user', uuid: 'user', isReplay: true, origin: { type: 'unknown-future' }, message: 'PRIVATE' },
      { type: 'result', subtype: 'success', is_error: true, terminal_reason: 'aborted_tools' }]
    f.raw(Buffer.from(events.map(e => JSON.stringify(e)).join('\n') + '\n'))
    assert.deepEqual(f.events, events); assert.equal(f.frames.length, 0)
    const raw = Buffer.from(JSON.stringify({ type: 'assistant', text: 'Привет 🌈' }) + '\n')
    for (const byte of raw) f.raw(Buffer.from([byte]))
    assert.equal(f.events.at(-1).text, 'Привет 🌈'); f.transport.close()
  }
  // Unsupported inbound approvals/hooks are denied, never echoed or authorized.
  for (const subtype of ['can_use_tool', 'hook_callback', 'future_callback']) {
    const f = fixture(); f.send({ type: 'control_request', request_id: 'server-req', request: { subtype, input: 'PRIVATE' } })
    assert.deepEqual(f.frames, [{ type: 'control_response', response: { subtype: 'error', request_id: 'server-req', error: 'Unsupported control request' } }])
    f.send({ type: 'control_cancel_request', request_id: 'server-req' }); assert.equal(f.events.length, 0); assert.equal(f.transport.closed, null); f.transport.close()
  }
  for (const make of [id => ({ type: 'control_response', response: { subtype: 'success', request_id: id } }),
    id => ({ type: 'control_response', response: { subtype: 'success', request_id: id, response: [] } }),
    id => ({ type: 'control_response', response: { subtype: 'future', request_id: id, response: {} } }),
    id => ({ type: 'control_response', response: { subtype: ['success'], request_id: id, response: {} } }),
    id => ({ type: 'control_response', response: { subtype: 'error', request_id: id, error: {} } }),
    id => ({ type: 'control_response', response: { subtype: 'success', request_id: id, response: {}, error: 'PRIVATE' } }),
    id => ({ type: 'control_response', request_id: id, response: { subtype: 'success', request_id: id, response: {} } }),
    () => ({ type: 'control_request', request_id: [], request: { subtype: 'hook_callback' } }),
    () => ({ type: 'control_cancel_request', request_id: 'id', unknown: true }),
    () => ({ type: ['result'] })]) {
    const f = fixture(), p = f.transport.requestControl({ subtype: 'interrupt' }, () => true)
    f.send(make(f.frames[0].request_id)); assert.equal((await p).status, 'outcome_unknown'); assert.ok(f.transport.closed); assert.equal(f.events.length, 0)
  }
  for (const mutate of [() => 'foreign', id => id.replace(/:1$/, ':01'), id => id.replace(/:1$/, ':2')]) {
    const f = fixture(), p = f.transport.requestControl({ subtype: 'interrupt' }, () => true)
    f.send({ type: 'control_response', response: { subtype: 'success', request_id: mutate(f.frames[0].request_id), response: {} } })
    assert.equal((await p).reason, 'foreign_response')
  }
  // Pending and output backpressure are bounded; no hidden write queue/retry.
  {
    const f = fixture(), pending = Array.from({ length: L.pending }, () => f.transport.requestControl({ subtype: 'interrupt' }, () => true))
    assert.equal((await f.transport.requestControl({ subtype: 'interrupt' }, () => true)).reason, 'pending_limit')
    assert.equal(f.frames.length, L.pending); f.transport.close(); assert.ok((await Promise.all(pending)).every(r => r.status === 'outcome_unknown'))
  }
  {
    let release; const f = fixture({ highWaterMark: 1, write: (_bytes, callback) => { release = callback } })
    const p = f.transport.requestControl({ subtype: 'interrupt' }, () => true)
    assert.equal((await f.transport.requestControl({ subtype: 'interrupt' }, () => true)).reason, 'backpressure')
    release(); await sleep(0); f.response(); assert.equal((await p).status, 'ack')
    const p2 = f.transport.requestControl({ subtype: 'stop_task', task_id: 'task' }, () => true)
    assert.equal(f.frames.length, 2); f.transport.close(); release(); assert.equal((await p2).status, 'outcome_unknown')
  }
  {
    const f = fixture({ highWaterMark: 1, write: () => {} }), p = f.transport.requestControl({ subtype: 'interrupt' }, () => true)
    f.send({ type: 'control_request', request_id: 'approval', request: { subtype: 'can_use_tool' } })
    assert.equal((await p).reason, 'reply_backpressure'); assert.equal(f.frames.length, 1)
  }
  for (const [raw, reason] of [[Buffer.from([0xff, 10]), 'invalid_json'], [Buffer.from('{PRIVATE}\n'), 'invalid_json'],
    [Buffer.from('\n'), 'invalid_json'], ['{"type":"result"}\n', 'byte_stream_required'],
    [Buffer.alloc(L.chunkBytes + 1), 'chunk_limit'], [Buffer.alloc(L.frameBytes), 'frame_limit']]) {
    const f = fixture(), p = f.transport.requestControl({ subtype: 'interrupt' }, () => true)
    f.raw(raw); assert.equal((await p).reason, reason); assert.equal(JSON.stringify(f.reasons).includes('PRIVATE'), false)
  }
  {
    const f = fixture(); let value = 'PRIVATE'; for (let i = 0; i < L.depth + 1; i++) value = { inner: value }
    f.send({ type: 'result', value }); assert.equal(f.transport.closed, 'invalid_envelope')
  }
  {
    const f = fixture(); for (let i = 0; i <= L.fragments; i++) f.raw(Buffer.from(' '))
    assert.equal(f.transport.closed, 'fragment_limit')
  }
  {
    const f = fixture(), fragment = Buffer.from('{"type":"result","value":"safe')
    f.raw(fragment); fragment.fill(0xff); f.raw(Buffer.from('"}\n'))
    assert.deepEqual(f.events, [{ type: 'result', value: 'safe' }], 'buffered fragments are copied before source reuse'); f.transport.close()
  }
  {
    const f = fixture(), p = f.transport.requestControl({ subtype: 'interrupt' }, () => true)
    f.raw(Buffer.from('{"type":')); f.input.emit('end'); assert.equal((await p).reason, 'truncated_frame')
  }
  for (const onEvent of [() => { throw Error('PRIVATE') }, () => Promise.reject(Error('PRIVATE')), () => Promise.resolve()]) {
    const f = fixture({ onEvent }); f.send({ type: 'system', subtype: 'init' })
    assert.ok(['event_consumer_failed', 'async_event_consumer'].includes(f.transport.closed))
  }
  {
    let callback; const f = fixture({ write: (_bytes, cb) => { callback = cb }, onClosed: () => Promise.reject(Error('PRIVATE')) })
    const p = f.transport.requestControl({ subtype: 'interrupt' }, () => true)
    f.transport.close(); callback(Error('PRIVATE')); await sleep(1)
    assert.equal((await p).status, 'outcome_unknown'); assert.deepEqual(f.reasons, ['transport_closed'])
  }
  {
    const f = fixture({ write: () => { throw Error('PRIVATE') } })
    assert.equal((await f.transport.requestControl({ subtype: 'interrupt' }, () => true)).reason, 'write_failed')
  }
  for (const side of ['input', 'output']) {
    const f = fixture(), p = f.transport.requestControl({ subtype: 'interrupt' }, () => true)
    f[side].emit('error', Error('PRIVATE'))
    assert.equal((await p).reason, 'stream_error'); assert.equal((await f.transport.requestControl({ subtype: 'interrupt' }, () => true)).status, 'not_sent')
  }
  {
    const input = new PassThrough(), output = new PassThrough(); input.destroy()
    const transport = createClaudeControlTransport({ input, output, onEvent() {} })
    assert.equal(transport.closed, 'stream_closed'); assert.equal((await transport.requestControl({ subtype: 'interrupt' }, () => true)).status, 'not_sent'); output.destroy()
  }
  // A synchronous provider fixture can answer inside write: pending exists first.
  {
    let f; f = fixture({ write: (bytes, callback) => { const request = JSON.parse(bytes); f.send({ type: 'control_response', response: { subtype: 'success', request_id: request.request_id, response: {} } }); callback() } })
    assert.equal((await f.transport.requestControl({ subtype: 'interrupt' }, () => true)).status, 'ack'); f.transport.close()
  }
  await sleep(1)
  console.log('PASS Claude control transport: pinned envelopes, ACK-only, denial, exact IDs, strict frames, bounded streams, deadlines and final effect fences; no native provider proof')
} finally {
  for (const f of fixtures) { f.transport.close(); f.input.destroy(); f.output.destroy() }
}
