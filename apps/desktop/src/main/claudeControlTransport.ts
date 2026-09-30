import { randomUUID } from 'node:crypto'
import type { Readable, Writable } from 'node:stream'

/** Owned structured Claude stdin/stdout only. SDK envelope reference:
 * anthropics/claude-agent-sdk-python@36f95486ee9fc49d8ee1ed56811f07b5e8e23ac6,
 * types.py SDKControlRequest/SDKControlResponse. An ACK is not a stopped turn,
 * task, process or provider. A write is local Writable acceptance, not delivery.
 * The owner supplies authority and owns stream cleanup. */
export const CLAUDE_CONTROL_LIMITS = Object.freeze({ frameBytes: 1_048_576, chunkBytes: 4_194_304, fragments: 8192, pending: 64, depth: 64, idChars: 128 })
export type ClaudeControlRequest = { subtype: 'interrupt' } | { subtype: 'stop_task'; task_id: string }
export type ClaudeControlResult = { status: 'ack'; requestId: string } |
  { status: 'error'; requestId: string; code: 'provider_control_error' } |
  { status: 'not_sent' | 'outcome_unknown'; reason: string; requestId?: string }
export interface ClaudeControlTransportOptions {
  input: Readable
  output: Writable
  /** Synchronous ordered consumer. Raw events may contain private data; the
   * caller owns validation/redaction before persistence, never this transport. */
  onEvent(event: Readonly<Record<string, unknown>>): void
  onClosed?(reason: string): void
  timeoutMs?: number
  /** The owner's synchronous write edge (B2a): runs `write` with the request's fence checked
   * again after every owner callback. `'fenced'` means no bytes were sent. */
  edge?(fence: () => boolean, write: () => boolean): boolean | 'fenced'
}
interface Pending { resolve(result: ClaudeControlResult): void; timer: ReturnType<typeof setTimeout>; deadline: number }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= CLAUDE_CONTROL_LIMITS.idChars && /^[\x21-\x7e]+$/.test(v)
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k))
function boundedJson(value: unknown): boolean {
  const stack = [{ value, depth: 0 }]
  while (stack.length) {
    const item = stack.pop()!
    if (item.depth > CLAUDE_CONTROL_LIMITS.depth) return false
    if (item.value && typeof item.value === 'object')
      for (const value of Object.values(item.value)) stack.push({ value, depth: item.depth + 1 })
  }
  return true
}
// Copy only data properties. No caller getter/toJSON can rewrite the request
// during encoding, inject approvals, or smuggle context into a control frame.
function controlRequest(value: unknown): ClaudeControlRequest | null {
  try {
    if (!record(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null
    const fields = Object.getOwnPropertyDescriptors(value)
    if (Reflect.ownKeys(value).some(k => typeof k !== 'string' || !['subtype', 'task_id'].includes(k)) ||
        Object.values(fields).some(field => !('value' in field))) return null
    if (fields.subtype?.value === 'interrupt' && !fields.task_id) return { subtype: 'interrupt' }
    if (fields.subtype?.value === 'stop_task' && id(fields.task_id?.value)) return { subtype: 'stop_task', task_id: fields.task_id.value }
  } catch { /* Invalid caller objects never reach a stream. */ }
  return null
}

export function createClaudeControlTransport(options: ClaudeControlTransportOptions) {
  const prefix = randomUUID(), pending = new Map<string, Pending>()
  const configured = options.timeoutMs
  const timeoutMs = typeof configured === 'number' && Number.isFinite(configured) ? Math.max(1, Math.min(60_000, configured)) : 10_000
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let serial = 0, closed: string | null = null, blocked = false, frameBytes = 0
  let fragments: Buffer[] = []
  function close(reason = 'transport_closed') {
    if (closed) return
    closed = reason; fragments = []; frameBytes = 0
    options.input.off('data', data).off('end', ended).off('close', ended)
    options.output.off('drain', drain).off('close', ended)
    // Late write errors remain handled until the owned streams close.
    for (const [requestId, p] of pending) { clearTimeout(p.timer); p.resolve({ status: 'outcome_unknown', reason, requestId }) }
    pending.clear()
    try { Promise.resolve(options.onClosed?.(reason)).catch(() => undefined) } catch { /* No raw error logging. */ }
  }
  function drain() { blocked = false }
  function errored() { close('stream_error') }
  function ended() { close(frameBytes ? 'truncated_frame' : 'stream_closed') }
  function writable() {
    return !closed && !blocked && !options.output.destroyed && !options.output.writableEnded && options.output.writableLength < CLAUDE_CONTROL_LIMITS.frameBytes
  }
  function permitted(fence: () => boolean) {
    try {
      const result: unknown = fence()
      if (result && typeof (result as PromiseLike<unknown>).then === 'function') Promise.resolve(result).catch(() => undefined)
      return result === true
    } catch { /* Unreadable authority refuses effects; never expose its error. */ return false }
  }
  function write(bytes: Buffer, fence: () => boolean = () => true, deadline = Infinity): 'attempted' | 'fenced' | 'expired' | 'unwritable' {
    if (!writable()) return 'unwritable'
    if (performance.now() >= deadline) return 'expired'
    if (!permitted(fence)) return 'fenced'
    if (performance.now() >= deadline) return 'expired'
    if (!writable()) return 'unwritable'
    try {
      const put = () => options.output.write(bytes, error => { if (error) close('write_failed') })
      const accepted = options.edge ? options.edge(fence, put) : put()
      if (accepted === 'fenced') return 'fenced'
      if (!accepted) blocked = true
    } catch { /* A prefix may have been written; report the fixed unknown outcome. */ close('write_failed') }
    return 'attempted'
  }
  function receive(value: unknown) {
    if (!record(value) || !boundedJson(value) || typeof value.type !== 'string' || !/^[a-z][a-z0-9_]{0,127}$/.test(value.type)) { close('invalid_envelope'); return }
    if (value.type === 'control_response') {
      const r = value.response
      if (!keys(value, ['type', 'response']) || !record(r) || !id(r.request_id)) { close('invalid_control_response'); return }
      const requestId = r.request_id, n = Number(requestId.slice(prefix.length + 1))
      if (!requestId.startsWith(prefix + ':') || !Number.isSafeInteger(n) || n < 1 || n > serial || requestId !== `${prefix}:${n}`) { close('foreign_response'); return }
      if (!(r.subtype === 'success' && keys(r, ['subtype', 'request_id', 'response']) && 'response' in r && (r.response === null || record(r.response)) ||
            r.subtype === 'error' && keys(r, ['subtype', 'request_id', 'error']) && typeof r.error === 'string')) { close('invalid_control_response'); return }
      const p = pending.get(requestId)
      if (!p) return // Retired/late/duplicate replies never re-authorize or retry.
      pending.delete(requestId); clearTimeout(p.timer)
      if (performance.now() >= p.deadline) { p.resolve({ status: 'outcome_unknown', reason: 'deadline', requestId }); return }
      p.resolve(r.subtype === 'success' ? { status: 'ack', requestId } : { status: 'error', requestId, code: 'provider_control_error' })
      return
    }
    if (value.type === 'control_request') {
      if (!keys(value, ['type', 'request_id', 'request']) || !id(value.request_id) || !record(value.request) || typeof value.request.subtype !== 'string') { close('invalid_control_request'); return }
      // Includes can_use_tool and hook callbacks: this transport never approves.
      const bytes = Buffer.from(JSON.stringify({ type: 'control_response', response: { subtype: 'error', request_id: value.request_id, error: 'Unsupported control request' } }) + '\n')
      if (write(bytes) !== 'attempted') close('reply_backpressure')
      return
    }
    if (value.type === 'control_cancel_request') {
      if (!keys(value, ['type', 'request_id']) || !id(value.request_id)) close('invalid_control_cancel')
      return // There are no pending approval callbacks: all were denied.
    }
    try {
      const result: unknown = options.onEvent(value)
      if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
        Promise.resolve(result).catch(() => undefined); close('async_event_consumer')
      }
    } catch { /* Close exposes a fixed reason; raw observer errors stay private. */ close('event_consumer_failed') }
  }
  function data(chunk: Buffer | string) {
    if (closed) return
    if (!Buffer.isBuffer(chunk)) { close('byte_stream_required'); return }
    if (chunk.length > CLAUDE_CONTROL_LIMITS.chunkBytes) { close('chunk_limit'); return }
    let offset = 0
    while (!closed && offset < chunk.length) {
      const newline = chunk.indexOf(10, offset), end = newline < 0 ? chunk.length : newline, part = chunk.subarray(offset, end)
      if (frameBytes + part.length + 1 > CLAUDE_CONTROL_LIMITS.frameBytes) { close('frame_limit'); return }
      if (part.length) { fragments.push(Buffer.from(part)); frameBytes += part.length }
      if (fragments.length > CLAUDE_CONTROL_LIMITS.fragments) { close('fragment_limit'); return }
      if (newline < 0) break
      const frame = Buffer.concat(fragments, frameBytes); fragments = []; frameBytes = 0; offset = newline + 1
      try { receive(JSON.parse(decoder.decode(frame))) } catch { /* Never retain malformed provider bytes in diagnostics. */ close('invalid_json') }
    }
  }
  options.input.on('data', data).on('end', ended).on('error', errored).on('close', ended)
  options.output.on('drain', drain).on('error', errored).on('close', ended)
  options.input.once('close', () => options.input.off('error', errored))
  options.output.once('close', () => options.output.off('error', errored))
  if (options.input.destroyed || options.input.readableEnded || options.output.destroyed || options.output.writableEnded) close('stream_closed')
  return {
    close: () => close(),
    get closed() { return closed },
    requestControl(value: ClaudeControlRequest, stillAllowed: () => boolean): Promise<ClaudeControlResult> {
      const deadline = performance.now() + timeoutMs, request = controlRequest(value)
      if (!request) return Promise.resolve({ status: 'not_sent', reason: 'invalid_control_request' })
      if (!writable()) return Promise.resolve({ status: 'not_sent', reason: closed ?? 'backpressure' })
      if (pending.size >= CLAUDE_CONTROL_LIMITS.pending) return Promise.resolve({ status: 'not_sent', reason: 'pending_limit' })
      const requestId = `${prefix}:${++serial}`
      const bytes = Buffer.from(JSON.stringify({ type: 'control_request', request_id: requestId, request }) + '\n')
      return new Promise(resolve => {
        const timer = setTimeout(() => {
          if (!pending.delete(requestId)) return
          resolve({ status: 'outcome_unknown', reason: 'deadline', requestId })
        }, Math.max(0, deadline - performance.now()))
        pending.set(requestId, { resolve, timer, deadline })
        const sent = write(bytes, stillAllowed, deadline)
        if (sent !== 'attempted') {
          clearTimeout(timer); pending.delete(requestId)
          resolve({ status: 'not_sent', reason: closed ?? (sent === 'fenced' ? 'effect_fenced' : sent === 'expired' ? 'deadline' : 'backpressure'), requestId })
        }
      })
    }
  }
}
