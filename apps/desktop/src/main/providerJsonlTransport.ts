import { randomUUID } from 'node:crypto'
import type { Readable, Writable } from 'node:stream'

/** One owned structured stdio connection, never a TUI parser. The process owner
 * supplies pipes and is responsible for termination. Closing this transport
 * cannot prove provider quiescence, and a reply cannot prove a tool effect. */
export const PROVIDER_RPC_LIMITS = Object.freeze({ frameBytes: 1_048_576, chunkBytes: 4_194_304, fragments: 8192, pending: 64, depth: 64 })
type RpcResult = { status: 'reply'; result: unknown } | { status: 'error'; code: number } |
  { status: 'not_sent' | 'outcome_unknown'; reason: string }
export interface ProviderJsonlOptions {
  input: Readable
  output: Writable
  onNotification(method: string, params: unknown): void
  onClosed?(reason: string): void
  timeoutMs?: number
}
interface Pending { resolve(result: RpcResult): void; timer: ReturnType<typeof setTimeout>; deadline: number }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const methodName = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z][a-zA-Z0-9_./-]{0,127}$/.test(v)
// Iterative: malformed deep JSON must not recurse through a validator's stack.
function boundedJson(value: unknown): boolean {
  const queue: { value: unknown; depth: number }[] = [{ value, depth: 0 }]
  while (queue.length) {
    const item = queue.pop()!
    if (item.depth > PROVIDER_RPC_LIMITS.depth) return false
    if (item.value && typeof item.value === 'object')
      for (const child of Object.values(item.value)) queue.push({ value: child, depth: item.depth + 1 })
  }
  return true
}

export function createProviderJsonlTransport(options: ProviderJsonlOptions) {
  const prefix = randomUUID(), pending = new Map<string, Pending>()
  const configuredTimeout = options.timeoutMs
  const timeoutMs = typeof configuredTimeout === 'number' && Number.isFinite(configuredTimeout)
    ? Math.max(1, Math.min(60_000, configuredTimeout)) : 10_000
  let serial = 0, closed: string | null = null, blocked = false, frameBytes = 0
  let fragments: Buffer[] = []
  const decoder = new TextDecoder('utf-8', { fatal: true })
  function close(reason = 'transport_closed') {
    if (closed) return
    closed = reason
    fragments = []; frameBytes = 0
    options.input.off('data', data).off('end', ended).off('close', ended)
    options.output.off('drain', drain).off('close', ended)
    // Retain error sinks until owned streams close: a delayed write callback
    // may emit after timeout/close, and must not become an uncaught exception.
    for (const p of pending.values()) { clearTimeout(p.timer); p.resolve({ status: 'outcome_unknown', reason }) }
    pending.clear()
    // No raw bytes or provider error messages enter diagnostics here.
    try {
      const observed: unknown = options.onClosed?.(reason)
      Promise.resolve(observed).catch(() => undefined)
    } catch { /* Observer failure does not reopen the transport. */ }
  }
  function drain() { blocked = false }
  function errored() { close('stream_error') }
  function ended() { close(frameBytes ? 'truncated_frame' : 'stream_closed') }
  function encode(value: unknown): Buffer | null {
    try {
      const text = JSON.stringify(value)
      if (Buffer.byteLength(text) + 1 > PROVIDER_RPC_LIMITS.frameBytes || !boundedJson(JSON.parse(text))) return null
      return Buffer.from(text + '\n')
    } catch { /* Cycles/unsupported values are rejected before writing. */ return null }
  }
  function writable() {
    return !closed && !blocked && !options.output.destroyed && !options.output.writableEnded &&
      options.output.writableLength < PROVIDER_RPC_LIMITS.frameBytes
  }
  function permitted(stillAllowed: () => boolean) {
    try {
      const value: unknown = stillAllowed()
      if (value && typeof (value as PromiseLike<unknown>).then === 'function') Promise.resolve(value).catch(() => undefined)
      return value === true
    } catch { /* Unreadable authority refuses the write without exposing its error. */ return false }
  }
  function write(bytes: Buffer, stillAllowed: () => boolean = () => true, deadline = Infinity): 'attempted' | 'fenced' | 'unwritable' | 'expired' {
    if (!writable()) return 'unwritable'
    if (performance.now() >= deadline) return 'expired'
    if (!permitted(stillAllowed)) return 'fenced'
    if (performance.now() >= deadline) return 'expired'
    if (!writable()) return 'unwritable' // The authority port can synchronously close the connection.
    try {
      if (!options.output.write(bytes, error => { if (error) close('write_failed') })) blocked = true
    } catch { /* write may have accepted a prefix; never classify this as not sent. */ close('write_failed') }
    return 'attempted'
  }
  function receive(value: unknown) {
    if (!record(value) || !boundedJson(value) || ('jsonrpc' in value && value.jsonrpc !== '2.0')) { close('invalid_envelope'); return }
    if ('method' in value) {
      if (!methodName(value.method) || 'result' in value || 'error' in value) { close('invalid_envelope'); return }
      if ('id' in value) {
        // Unsupported provider requests (including approvals) receive a refusal,
        // never an implicit authorization. A future authority router owns them.
        if (!(typeof value.id === 'string' && value.id.length <= 128 || Number.isSafeInteger(value.id))) { close('invalid_request_id'); return }
        const bytes = encode({ id: value.id, error: { code: -32601, message: 'Unsupported method' } })!
        if (!writable()) { close('reply_backpressure'); return }
        write(bytes)
        return
      }
      try {
        const observed: unknown = options.onNotification(value.method, value.params)
        if (observed && typeof (observed as PromiseLike<unknown>).then === 'function') {
          // Event order belongs to the caller's synchronous fold. Do not allow
          // unbounded asynchronous consumers or unhandled promise rejections.
          Promise.resolve(observed).catch(() => undefined)
          close('async_notification_consumer')
        }
      } catch { /* A failed consumer loses evidence; fence the connection. */ close('notification_failed') }
      return
    }
    if (typeof value.id !== 'string' || !value.id.startsWith(prefix + ':')) { close('foreign_response'); return }
    const n = Number(value.id.slice(prefix.length + 1))
    if (!Number.isSafeInteger(n) || n < 1 || n > serial || value.id !== `${prefix}:${n}`) { close('foreign_response'); return }
    if (('result' in value) === ('error' in value)) { close('invalid_response'); return }
    if ('error' in value && (!record(value.error) || !Number.isSafeInteger(value.error.code))) { close('invalid_response'); return }
    const p = pending.get(value.id)
    if (!p) return // Late or duplicate replies cannot authorize anything or resend.
    pending.delete(value.id); clearTimeout(p.timer)
    if (performance.now() >= p.deadline) { p.resolve({ status: 'outcome_unknown', reason: 'deadline' }); return }
    p.resolve('error' in value ? { status: 'error', code: (value.error as { code: number }).code } : { status: 'reply', result: value.result })
  }
  function data(chunk: Buffer | string) {
    if (closed) return
    if (!Buffer.isBuffer(chunk)) { close('byte_stream_required'); return }
    const bytes = chunk
    if (bytes.length > PROVIDER_RPC_LIMITS.chunkBytes) { close('chunk_limit'); return }
    let offset = 0
    while (!closed && offset < bytes.length) {
      const newline = bytes.indexOf(10, offset), end = newline < 0 ? bytes.length : newline
      const part = bytes.subarray(offset, end)
      if (frameBytes + part.length + 1 > PROVIDER_RPC_LIMITS.frameBytes) { close('frame_limit'); return }
      if (part.length) { fragments.push(Buffer.from(part)); frameBytes += part.length }
      if (fragments.length > PROVIDER_RPC_LIMITS.fragments) { close('fragment_limit'); return }
      if (newline < 0) break
      const frame = Buffer.concat(fragments, frameBytes); fragments = []; frameBytes = 0; offset = newline + 1
      try { receive(JSON.parse(decoder.decode(frame))) } catch { /* Never include malformed/secret-bearing bytes in diagnostics. */ close('invalid_json') }
    }
  }
  options.input.on('data', data).on('end', ended).on('error', errored).on('close', ended)
  options.output.on('drain', drain).on('error', errored).on('close', ended)
  options.input.once('close', () => options.input.off('error', errored))
  options.output.once('close', () => options.output.off('error', errored))
  if (options.input.destroyed || options.input.readableEnded || options.output.destroyed || options.output.writableEnded)
    close('stream_closed')
  return {
    close: () => close(),
    get closed() { return closed },
    request(method: string, params: unknown, stillAllowed: () => boolean = () => true): Promise<RpcResult> {
      if (!methodName(method)) return Promise.resolve({ status: 'not_sent', reason: 'invalid_method' })
      if (!writable()) return Promise.resolve({ status: 'not_sent', reason: closed ?? 'backpressure' })
      if (pending.size >= PROVIDER_RPC_LIMITS.pending) return Promise.resolve({ status: 'not_sent', reason: 'pending_limit' })
      const id = `${prefix}:${++serial}`, bytes = encode({ id, method, params })
      if (!bytes) return Promise.resolve({ status: 'not_sent', reason: 'invalid_payload' })
      // Serialization may call application getters/toJSON. Recheck at the
      // actual write boundary, including closure/reentrancy during encoding.
      if (!writable()) return Promise.resolve({ status: 'not_sent', reason: closed ?? 'backpressure' })
      if (pending.size >= PROVIDER_RPC_LIMITS.pending) return Promise.resolve({ status: 'not_sent', reason: 'pending_limit' })
      return new Promise(resolve => {
        const timer = setTimeout(() => {
          if (!pending.delete(id)) return
          resolve({ status: 'outcome_unknown', reason: 'deadline' })
        }, timeoutMs)
        const deadline = performance.now() + timeoutMs
        pending.set(id, { resolve, timer, deadline })
        const sent = write(bytes, stillAllowed, deadline)
        if (sent !== 'attempted') {
          clearTimeout(timer); pending.delete(id)
          resolve({ status: 'not_sent', reason: closed ?? (sent === 'fenced' ? 'effect_fenced' : sent === 'expired' ? 'deadline' : 'backpressure') })
        }
      })
    },
    /** submitted means accepted by the local Writable, not received or applied
     * by the provider. Later stream failure closes the whole connection. */
    notify(method: string, params?: unknown, stillAllowed: () => boolean = () => true): { status: 'submitted' | 'not_sent' | 'outcome_unknown'; reason?: string } {
      if (!methodName(method) || !writable()) return { status: 'not_sent', reason: closed ?? 'unwritable' }
      const bytes = encode({ method, ...(params === undefined ? {} : { params }) })
      if (!bytes) return { status: 'not_sent', reason: 'invalid_payload' }
      const sent = write(bytes, stillAllowed)
      if (sent !== 'attempted') return { status: 'not_sent', reason: closed ?? (sent === 'fenced' ? 'effect_fenced' : 'backpressure') }
      return closed ? { status: 'outcome_unknown', reason: closed } : { status: 'submitted' }
    }
  }
}
