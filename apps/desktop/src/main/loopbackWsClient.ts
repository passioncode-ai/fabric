/**
 * Fabric's controller connection to an owned loopback backend (first-slice plan B2b-2, ADR-0081 §3, §5).
 *
 * A bounded RFC 6455 client over a plain `net.Socket` rather than the built-in `WebSocket`, whose
 * `send()` is already a queue and so has no edge at which a command's authority can still be
 * checked. Here Fabric keeps its own queue, and one pump checks each frame's fence immediately
 * before `socket.write`: a command whose authority lapses between queue and write is not sent.
 *
 * - The bearer token travels only in the upgrade header; it is never returned, logged or thrown.
 * - Each connection is one writer, `controller:<uuid>`. A closed client never reopens; a new
 *   connection is a new identity, which a binding must be told about explicitly.
 * - Requests the backend sends (approvals, callbacks) are always answered with an error: this
 *   client never approves anything.
 * - A reply is JSON-RPC data, not proof that a turn ran, stopped or quiesced. A written frame is
 *   local socket acceptance, not delivery.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { connect as netConnect, type Socket } from 'node:net'

export const LOOPBACK_LIMITS = Object.freeze({ frameBytes: 1_048_576, messageBytes: 4_194_304, fragments: 64, pending: 64, queue: 64, headerBytes: 16_384, depth: 64 })
export type LoopbackReply =
  | { status: 'reply'; result: unknown }
  | { status: 'error'; code: 'provider_rpc_error' }
  | { status: 'not_sent' | 'outcome_unknown'; reason: string }
export interface LoopbackClient {
  readonly connectionId: string
  readonly closed: string | null
  /** Frames waiting for the pump; diagnostic only. */
  readonly queued: number
  request(method: string, params: unknown, stillAllowed: () => boolean): Promise<LoopbackReply>
  /** A notification under the same edge fence; `written` is local socket acceptance, not delivery. */
  notify(method: string, params: unknown, stillAllowed: () => boolean): Promise<{ status: 'written' | 'not_sent'; reason?: string }>
  close(): void
}
export type LoopbackConnect = { ok: true; client: LoopbackClient } | { ok: false; reason: 'invalid_request' | 'connect_failed' | 'handshake_timeout' | 'unauthorized' | 'upgrade_refused' | 'invalid_handshake' }
export interface LoopbackConnectOptions {
  port: number
  token: string
  timeoutMs?: number
  /** Synchronous ordered consumer; bodies may hold private data and are the caller's to redact. */
  onNotification(notification: Readonly<{ method: string; params: unknown }>): void
  onClosed?(reason: string): void
}

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
const TOKEN = /^[A-Za-z0-9._~-]{16,512}$/
const METHOD = /^[A-Za-z][A-Za-z0-9_/.-]{0,127}$/
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const absorb = (v: unknown) => { try { if (v && typeof (v as PromiseLike<unknown>).then === 'function') void Promise.resolve(v).catch(() => undefined) } catch { /* A hostile thenable is already refused. */ } }
const grant = (fence: () => boolean) => { try { const v: unknown = fence(); if (v === true) return true; absorb(v) } catch { /* A throwing fence refuses the effect; its error stays private. */ } return false }
function bounded(value: unknown): boolean {
  const stack = [{ value, depth: 0 }]
  while (stack.length) {
    const item = stack.pop()!
    if (item.depth > LOOPBACK_LIMITS.depth) return false
    if (item.value && typeof item.value === 'object') for (const v of Object.values(item.value)) stack.push({ value: v, depth: item.depth + 1 })
  }
  return true
}
function frame(opcode: number, payload: Buffer): Buffer {
  const mask = randomBytes(4), n = payload.length
  const head = n < 126 ? Buffer.from([0x80 | opcode, 0x80 | n]) : n < 65536 ? Buffer.from([0x80 | opcode, 0x80 | 126, n >> 8, n & 255])
    : Buffer.concat([Buffer.from([0x80 | opcode, 0x80 | 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b })()])
  const body = Buffer.alloc(n); for (let i = 0; i < n; i++) body[i] = payload[i] ^ mask[i & 3]
  return Buffer.concat([head, mask, body])
}

export function connectLoopback(options: LoopbackConnectOptions): Promise<LoopbackConnect> {
  const configured = options.timeoutMs
  const timeoutMs = typeof configured === 'number' && Number.isFinite(configured) ? Math.max(1, Math.min(60_000, configured)) : 10_000
  if (!Number.isSafeInteger(options.port) || options.port < 1 || options.port > 65535 || typeof options.token !== 'string' || !TOKEN.test(options.token) || typeof options.onNotification !== 'function')
    return Promise.resolve({ ok: false, reason: 'invalid_request' })
  const key = randomBytes(16).toString('base64'), accept = createHash('sha1').update(key + GUID).digest('base64')
  return new Promise(resolve => {
    let settled = false, head = Buffer.alloc(0)
    const socket = netConnect({ host: '127.0.0.1', port: options.port })
    const fail = (reason: Exclude<LoopbackConnect, { ok: true }>['reason']) => { if (settled) return; settled = true; clearTimeout(timer); socket.destroy(); resolve({ ok: false, reason }) }
    const timer = setTimeout(() => fail('handshake_timeout'), timeoutMs)
    socket.on('error', () => fail('connect_failed'))
    socket.once('close', () => fail('connect_failed'))
    socket.once('connect', () => {
      // The token is only ever in this header; nothing else in this module holds it after here.
      socket.write(`GET / HTTP/1.1\r\nHost: 127.0.0.1:${options.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\nAuthorization: Bearer ${options.token}\r\n\r\n`)
    })
    const onHead = (chunk: Buffer) => {
      head = Buffer.concat([head, chunk])
      const end = head.indexOf('\r\n\r\n')
      if (end < 0) { if (head.length > LOOPBACK_LIMITS.headerBytes) fail('invalid_handshake'); return }
      socket.off('data', onHead)
      const lines = head.subarray(0, end).toString('latin1').split('\r\n'), status = /^HTTP\/1\.1 (\d{3})(?: |$)/.exec(lines[0] ?? '')
      if (!status) return fail('invalid_handshake')
      if (status[1] === '401' || status[1] === '403') return fail('unauthorized')
      if (status[1] !== '101') return fail('upgrade_refused')
      const headers = new Map<string, string>()
      for (const line of lines.slice(1)) { const i = line.indexOf(':'); if (i > 0) headers.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()) }
      if (headers.get('upgrade')?.toLowerCase() !== 'websocket' || !/(^|,)\s*upgrade\s*(,|$)/i.test(headers.get('connection') ?? '') ||
          headers.get('sec-websocket-accept') !== accept || headers.has('sec-websocket-extensions') || headers.has('sec-websocket-protocol')) return fail('invalid_handshake')
      settled = true; clearTimeout(timer)
      socket.removeAllListeners('close'); socket.removeAllListeners('error')
      resolve({ ok: true, client: open(socket, head.subarray(end + 4), options, timeoutMs) })
    }
    socket.on('data', onHead)
  })
}

interface Queued { bytes: Buffer; fence: () => boolean; sent(): void; fenced(): void; dropped(reason: string): void }
interface Pending { resolve(r: LoopbackReply): void; timer: ReturnType<typeof setTimeout>; written: boolean }

function open(socket: Socket, initial: Buffer, options: LoopbackConnectOptions, timeoutMs: number): LoopbackClient {
  const connectionId = `controller:${randomUUID()}`, prefix = randomUUID(), pending = new Map<string, Pending>(), queue: Queued[] = []
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let closed: string | null = null, serial = 0, buffer: Buffer = Buffer.alloc(0), fragments: Buffer[] = [], messageBytes = 0, pumping = false, scheduled = false
  function close(reason: string) {
    if (closed) return
    closed = reason; socket.destroy(); fragments = []; buffer = Buffer.alloc(0)
    for (const q of queue.splice(0)) q.dropped(reason)
    for (const [, p] of pending) { clearTimeout(p.timer); p.resolve({ status: p.written ? 'outcome_unknown' : 'not_sent', reason }) }
    pending.clear()
    try { absorb(options.onClosed?.(reason)) } catch { /* The close reason is fixed; an observer's error stays private. */ }
  }
  /** The write edge: each frame's fence is checked here, immediately before `socket.write`. */
  function pump() {
    scheduled = false
    if (pumping) return
    pumping = true
    try {
      while (!closed && queue.length && !socket.writableNeedDrain) {
        const q = queue.shift()!
        if (!grant(q.fence)) { q.fenced(); continue }
        if (closed) { q.dropped(closed); break }
        q.sent()
        socket.write(q.bytes)
      }
    } catch { /* A throwing write may have sent a prefix: the connection is unknown from here. */ close('write_failed') }
    finally { pumping = false }
  }
  const schedule = () => { if (!scheduled) { scheduled = true; setImmediate(pump) } }
  function enqueue(q: Queued): boolean { if (closed || queue.length >= LOOPBACK_LIMITS.queue) return false; queue.push(q); schedule(); return true }
  const control = (opcode: number, payload: Buffer) => enqueue({ bytes: frame(opcode, payload), fence: () => true, sent() {}, fenced() {}, dropped() {} })
  function receive(text: string) {
    let v: unknown
    try { v = JSON.parse(text) } catch { /* Malformed backend bytes are never kept. */ close('invalid_json'); return }
    if (!record(v) || !bounded(v)) { close('invalid_envelope'); return }
    if ('method' in v) {
      if (typeof v.method !== 'string' || !METHOD.test(v.method)) { close('invalid_method'); return }
      if ('id' in v) {
        // Approvals and callbacks from the backend: always refused, never approved.
        if (!(typeof v.id === 'string' && v.id.length <= 128 || Number.isSafeInteger(v.id))) { close('invalid_server_request'); return }
        if (!control(1, Buffer.from(JSON.stringify({ id: v.id, error: { code: -32601, message: 'Unsupported request' } })))) close('reply_backpressure')
        return
      }
      try { const r: unknown = options.onNotification(Object.freeze({ method: v.method, params: v.params })); if (r && typeof (r as PromiseLike<unknown>).then === 'function') { absorb(r); close('async_notification_consumer') } }
      catch { /* The consumer's error stays private; the connection is fenced. */ close('notification_consumer_failed') }
      return
    }
    const requestId = v.id
    if (typeof requestId !== 'string' || !(('result' in v) !== ('error' in v)) || Object.keys(v).some(k => !['id', 'result', 'error', 'jsonrpc'].includes(k))) { close('invalid_response'); return }
    const n = Number(requestId.slice(prefix.length + 1))
    if (!Number.isSafeInteger(n) || n < 1 || n > serial || requestId !== `${prefix}:${n}`) { close('foreign_response'); return }
    const p = pending.get(requestId)
    if (!p) return // Late or duplicate replies never re-authorise or retry.
    pending.delete(requestId); clearTimeout(p.timer)
    p.resolve('error' in v ? { status: 'error', code: 'provider_rpc_error' } : { status: 'reply', result: v.result })
  }
  function data(chunk: Buffer) {
    if (closed) return
    buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk
    while (!closed && buffer.length >= 2) {
      const b0 = buffer[0], b1 = buffer[1], opcode = b0 & 0x0f, fin = (b0 & 0x80) !== 0
      if (b0 & 0x70) return close('reserved_bits')
      if (b1 & 0x80) return close('masked_server_frame')
      let length = b1 & 0x7f, offset = 2
      if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4 }
      else if (length === 127) { if (buffer.length < 10) return; const big = buffer.readBigUInt64BE(2); if (big > BigInt(LOOPBACK_LIMITS.frameBytes)) return close('frame_limit'); length = Number(big); offset = 10 }
      if (length > LOOPBACK_LIMITS.frameBytes) return close('frame_limit')
      if (opcode >= 8 && (!fin || length > 125)) return close('invalid_control_frame')
      if (buffer.length < offset + length) return
      const payload = Buffer.from(buffer.subarray(offset, offset + length)); buffer = buffer.subarray(offset + length)
      if (opcode === 8) return close('backend_closed')
      if (opcode === 9) { if (!control(10, payload)) close('reply_backpressure'); continue }
      if (opcode === 10) continue
      if (opcode === 2) return close('binary_frame')
      if (opcode === 1 ? fragments.length > 0 : opcode === 0 ? fragments.length === 0 : true) return close('invalid_fragmentation')
      fragments.push(payload); messageBytes += payload.length
      if (fragments.length > LOOPBACK_LIMITS.fragments || messageBytes > LOOPBACK_LIMITS.messageBytes) return close('message_limit')
      if (!fin) continue
      const message = Buffer.concat(fragments, messageBytes); fragments = []; messageBytes = 0
      let text: string
      try { text = decoder.decode(message) } catch { /* Invalid UTF-8 is never retained. */ return close('invalid_utf8') }
      receive(text)
    }
  }
  socket.on('data', data)
  socket.on('drain', () => schedule())
  socket.on('error', () => close('socket_error'))
  socket.on('end', () => close('socket_ended'))
  socket.on('close', () => close('socket_closed'))
  // Bytes that arrived with the handshake come first: they are the buffer every later chunk is
  // appended to, so no chunk can overtake them.
  if (initial.length) { buffer = Buffer.from(initial); setImmediate(() => data(Buffer.alloc(0))) }
  return {
    connectionId,
    get closed() { return closed },
    get queued() { return queue.length },
    close: () => close('closed_locally'),
    notify(method, params, stillAllowed) {
      if (typeof method !== 'string' || !METHOD.test(method) || typeof stillAllowed !== 'function') return Promise.resolve({ status: 'not_sent', reason: 'invalid_request' })
      if (closed) return Promise.resolve({ status: 'not_sent', reason: closed })
      let bytes: Buffer
      try {
        if (!bounded(params)) return Promise.resolve({ status: 'not_sent', reason: 'invalid_request' })
        const text = JSON.stringify(params === undefined ? { method } : { method, params })
        if (Buffer.byteLength(text) > LOOPBACK_LIMITS.frameBytes) return Promise.resolve({ status: 'not_sent', reason: 'frame_limit' })
        bytes = frame(1, Buffer.from(text))
      } catch { /* Unencodable params never reach the socket. */ return Promise.resolve({ status: 'not_sent', reason: 'invalid_request' }) }
      if (!grant(stillAllowed)) return Promise.resolve({ status: 'not_sent', reason: 'effect_fenced' })
      return new Promise(resolve => {
        if (!enqueue({ bytes, fence: stillAllowed, sent: () => resolve({ status: 'written' }), fenced: () => resolve({ status: 'not_sent', reason: 'effect_fenced' }), dropped: reason => resolve({ status: 'not_sent', reason }) }))
          resolve({ status: 'not_sent', reason: closed ?? 'pending_limit' })
      })
    },
    request(method, params, stillAllowed) {
      if (typeof method !== 'string' || !METHOD.test(method) || typeof stillAllowed !== 'function') return Promise.resolve({ status: 'not_sent', reason: 'invalid_request' })
      if (closed) return Promise.resolve({ status: 'not_sent', reason: closed })
      if (pending.size >= LOOPBACK_LIMITS.pending || queue.length >= LOOPBACK_LIMITS.queue) return Promise.resolve({ status: 'not_sent', reason: 'pending_limit' })
      let bytes: Buffer
      try {
        if (!bounded(params)) return Promise.resolve({ status: 'not_sent', reason: 'invalid_request' })
        const text = JSON.stringify({ id: `${prefix}:${serial + 1}`, method, params })
        if (text === undefined || Buffer.byteLength(text) > LOOPBACK_LIMITS.frameBytes) return Promise.resolve({ status: 'not_sent', reason: 'frame_limit' })
        bytes = frame(1, Buffer.from(text))
      } catch { /* Unencodable params never reach the socket. */ return Promise.resolve({ status: 'not_sent', reason: 'invalid_request' }) }
      if (!grant(stillAllowed)) return Promise.resolve({ status: 'not_sent', reason: 'effect_fenced' })
      const requestId = `${prefix}:${++serial}`
      return new Promise<LoopbackReply>(resolve => {
        const settle = (r: LoopbackReply) => { if (pending.get(requestId) === p) { pending.delete(requestId); clearTimeout(p.timer) }; resolve(r) }
        const q: Queued = { bytes, fence: stillAllowed,
          sent: () => { p.written = true },
          fenced: () => settle({ status: 'not_sent', reason: 'effect_fenced' }),
          dropped: reason => settle({ status: 'not_sent', reason }) }
        const p: Pending = { resolve, written: false, timer: setTimeout(() => {
          const i = queue.indexOf(q); if (i >= 0) queue.splice(i, 1)
          settle(p.written ? { status: 'outcome_unknown', reason: 'deadline' } : { status: 'not_sent', reason: 'deadline' })
        }, timeoutMs) }
        pending.set(requestId, p)
        if (!enqueue(q)) settle({ status: 'not_sent', reason: closed ?? 'pending_limit' })
      })
    },
  }
}
