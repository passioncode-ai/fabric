// #region project-board-service — docs: docs/adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md#3-who-may-take-part-is-a-separate-grant-from-who-may-call-a-product
/**
 * The participant half of the project board (COM-02.2, ADR-0117 §2–§3): what a session's `com.*` tools do
 * between the MCP call and the board's SQL commands (migration 79).
 *
 * - The caller's estate, Project and principal come from the authenticated scope, never from the input; the
 *   input schemas below are the contract's (`comms-submit.schema.json` …) and refuse any field they do not
 *   name, so a forged `estate_id` or `sender` is refused before anything is stored.
 * - The digest is the contract's: SHA-256 over `fabric-project-comms/0.1 NUL <operation> NUL <canonical JSON>`,
 *   canonical JSON with sorted keys, integers only (|n| ≤ 2^53−1), no lone surrogates, no normalisation.
 * - A cursor is an `opaqueId`: the last seq read plus a MAC binding it to this estate, reader, filter and grant.
 *   Any other reader, filter or a key from another run reads `cursor_reset_required`, never a silent change of
 *   audience (C3).
 * - A board that cannot be read answers `not_available`, never an empty page (COM-02 acceptance).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { ops } from './opsSink.ts'

export const COMMS_PROTOCOL = 'fabric-project-comms/0.1'
export const BODY_MAX_BYTES = 65_536

export type RefusalCode =
  | 'invalid_arguments' | 'body_too_large' | 'not_authorized' | 'authority_changed' | 'unsupported_capability'
  | 'unsupported_operation' | 'not_available' | 'idempotency_conflict' | 'idempotency_window_expired' | 'capacity_exceeded'
  | 'digest_conflict' | 'revision_conflict' | 'fenced' | 'lease_expired' | 'invalid_transition' | 'reconcile_required'
  | 'observation_required' | 'cursor_reset_required' | 'immutable_participants'
export interface Refusal { error: { code: RefusalCode; message: string; retryable: boolean } }
export const refusal = (code: RefusalCode, message: string, retryable = false): Refusal => ({ error: { code, message, retryable } })
export const isRefusal = (v: unknown): v is Refusal =>
  !!v && typeof v === 'object' && 'error' in v && typeof (v as Refusal).error?.code === 'string'

export class CommsCanonicalError extends Error {}

/** The contract's canonical JSON. Throws on anything it does not admit rather than guessing a spelling. */
export function commsCanonical(value: unknown): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new CommsCanonicalError('canonical JSON admits integers within ±(2^53−1) only')
    return String(value)
  }
  if (typeof value === 'string') {
    if (/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(value)) throw new CommsCanonicalError('canonical JSON refuses a lone surrogate')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(commsCanonical).join(',')}]`
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    return `{${Object.keys(o).sort().map((k) => {
      if (o[k] === undefined) throw new CommsCanonicalError('canonical JSON has no undefined')
      return `${commsCanonical(k)}:${commsCanonical(o[k])}`
    }).join(',')}}`
  }
  throw new CommsCanonicalError(`canonical JSON has no ${typeof value}`)
}

export function commsDigest(operation: string, value: unknown): string {
  return 'sha256:' + createHash('sha256').update(`${COMMS_PROTOCOL}\u0000${operation}\u0000${commsCanonical(value)}`, 'utf8').digest('hex')
}

// ── the contract's input shapes (comms-common / comms-submit), strict ─────────────────────────────────
const projectId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/)
const opaqueId = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/)
/** This board's thread and message ids are uuids. The contract admits any opaque id, so one that is not a
 *  uuid is an id no message here has: it is answered as the database answers an unknown id, before the RPC
 *  whose uuid cast would fail and read as "board unavailable" (0.3.2 verification DA-9). */
const BOARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const boardId = (id: string): string | null => (BOARD_ID.test(id) ? id.toLowerCase() : null)
const capabilityName = z.string().regex(/^[a-z][a-z0-9._-]{1,127}$/)
const sha256 = z.string().regex(/^sha256:[a-f0-9]{64}$/)
const artifactRef = z.strictObject({ id: z.url().min(1), contentHash: sha256, label: z.string().max(120).optional() })
export const commsSubmitSchema = z.strictObject({
  idempotency: z.strictObject({ epoch: z.number().int().min(1), key: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/) }),
  thread: z.union([
    z.strictObject({ id: opaqueId }),
    z.strictObject({ new: z.strictObject({ participants: z.array(projectId).min(1).max(16), subject: z.string().min(1).max(200).optional() }) })
  ]),
  kind: z.enum(['message', 'request', 'reply', 'finding', 'announcement']),
  body: z.strictObject({ text: z.string().min(1).max(BODY_MAX_BYTES), format: z.enum(['text/plain', 'text/markdown']).optional() }),
  replyTo: opaqueId.optional(),
  request: z.strictObject({ target: projectId, capability: capabilityName, deadline: z.iso.datetime({ offset: true }).optional() }).optional(),
  artifacts: z.array(artifactRef).max(8).optional()
}).superRefine((v, ctx) => {
  // The contract's allOf: a request carries request details and nothing else does; a reply names its message.
  if (v.kind === 'request' && !v.request) ctx.addIssue({ code: 'custom', path: ['request'], message: 'a request names its target and capability' })
  if (v.kind !== 'request' && v.request) ctx.addIssue({ code: 'custom', path: ['request'], message: 'only a request carries request details' })
  if (v.kind === 'reply' && !v.replyTo) ctx.addIssue({ code: 'custom', path: ['replyTo'], message: 'a reply names the message it answers' })
})
export type CommsSubmit = z.infer<typeof commsSubmitSchema>
export const commsListSchema = z.strictObject({ thread: opaqueId.optional(), cursor: opaqueId.optional(), limit: z.number().int().min(1).max(100).optional() })
export const commsMessageRefSchema = z.strictObject({ message: opaqueId })

export interface BoardCaller {
  estateId: string
  projectId: string
  principal: { kind: 'agent' | 'person' | 'operator'; id: string; label?: string; provenance: 'trusted' | 'asserted' }
}
/** The SQL door: `db.rpc` in the app, a fake in tests. */
export type BoardRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>

export interface BoardDeps {
  rpc: BoardRpc
  /** Binds cursors to this run; a restart resets them (`cursor_reset_required`), which the contract allows. */
  cursorKey?: Buffer
  now?: () => Date
}

const UNAVAILABLE = refusal('not_available', 'The board cannot be read right now; nothing was changed.', true)

export function createBoard(deps: BoardDeps) {
  const key = deps.cursorKey ?? randomBytes(32)
  const now = deps.now ?? (() => new Date())

  const mac = (caller: BoardCaller, thread: string | null, seq: number): string =>
    createHmac('sha256', key).update(commsCanonical({ e: caller.estateId, g: 'participant', r: caller.projectId, s: seq, t: thread })).digest('base64url').slice(0, 22)
  const cursorFor = (caller: BoardCaller, thread: string | null, seq: number): string => `c${seq.toString(36)}_${mac(caller, thread, seq)}`
  const seqFrom = (caller: BoardCaller, thread: string | null, cursor: string): number | null => {
    const m = /^c([0-9a-z]{1,11})_([A-Za-z0-9_-]{22})$/.exec(cursor)
    if (!m) return null
    const seq = parseInt(m[1], 36)
    if (!Number.isSafeInteger(seq)) return null
    const want = Buffer.from(mac(caller, thread, seq)), got = Buffer.from(m[2])
    return want.length === got.length && timingSafeEqual(want, got) ? seq : null
  }

  const call = async (fn: string, args: Record<string, unknown>): Promise<Record<string, unknown> | Refusal> => {
    let res: { data: unknown; error: unknown }
    try { res = await deps.rpc(fn, args) } catch (e) {
      ops.failed('board.rpc-threw', e, { note: `the board command ${fn} could not be reached; the caller was told not_available` })
      return UNAVAILABLE
    }
    if (res.error || res.data === null || typeof res.data !== 'object') {
      ops.failed('board.rpc-unreadable', res.error ?? new Error('no object answer'), { note: `the board command ${fn} gave no readable answer; the caller was told not_available` })
      return UNAVAILABLE
    }
    return res.data as Record<string, unknown>
  }

  return {
    async submit(caller: BoardCaller, input: unknown): Promise<Record<string, unknown> | Refusal> {
      const parsed = commsSubmitSchema.safeParse(input)
      if (!parsed.success) {
        const big = parsed.error.issues.some((i) => i.path.join('.') === 'body.text' && i.code === 'too_big')
        return big ? refusal('body_too_large', 'The message body is larger than 65,536 bytes.') : refusal('invalid_arguments', 'The submission does not match the board\'s message shape.')
      }
      // Bytes before hashing or storing (the schema counts characters).
      if (Buffer.byteLength(parsed.data.body.text, 'utf8') > BODY_MAX_BYTES) return refusal('body_too_large', 'The message body is larger than 65,536 bytes.')
      let digest: string
      try { digest = commsDigest('com.submit', parsed.data) } catch {
        // Silence is right: the refusal names the cause (a value canonical JSON does not admit), and the
        // input is the caller's, not a fault of Fabric's to record.
        return refusal('invalid_arguments', 'The submission cannot be put in canonical form.')
      }
      return call('board_submit', { p_estate_id: caller.estateId, p_sender: caller.projectId, p_principal: caller.principal, p_submit: parsed.data, p_digest: digest })
    },

    async list(caller: BoardCaller, input: unknown): Promise<Record<string, unknown> | Refusal> {
      const parsed = commsListSchema.safeParse(input ?? {})
      if (!parsed.success) return refusal('invalid_arguments', 'The page request does not match the board\'s shape.')
      const named = parsed.data.thread ?? null
      const thread = named === null ? null : boardId(named)
      if (named !== null && thread === null) return refusal('not_authorized', 'This Project cannot read that thread.')
      let after = 0
      if (parsed.data.cursor !== undefined) {
        const seq = seqFrom(caller, thread, parsed.data.cursor)
        if (seq === null) return refusal('cursor_reset_required', 'This cursor does not belong to this reader and filter; read again from the start.')
        after = seq
      }
      const data = await call('board_list', { p_estate_id: caller.estateId, p_reader: caller.projectId, p_thread: thread, p_after_seq: after, p_limit: parsed.data.limit ?? 50 })
      if (isRefusal(data)) return data
      if (data.ok !== true || !Array.isArray(data.messages) || typeof data.last_seq !== 'number') return UNAVAILABLE
      return {
        protocol: COMMS_PROTOCOL,
        audience: { project: caller.projectId, grant: 'participant' },
        snapshot: { readAt: now().toISOString() },
        messages: data.messages,
        cursor: data.more === true ? cursorFor(caller, thread, data.last_seq) : null
      }
    },

    async get(caller: BoardCaller, input: unknown): Promise<Record<string, unknown> | Refusal> {
      const parsed = commsMessageRefSchema.safeParse(input)
      if (!parsed.success) return refusal('invalid_arguments', 'Name the message by its id.')
      const message = boardId(parsed.data.message)
      if (message === null) return refusal('not_authorized', 'This Project cannot read that message.')
      const data = await call('board_get', { p_estate_id: caller.estateId, p_reader: caller.projectId, p_message: message })
      if (isRefusal(data)) return data
      return data.ok === true && data.message ? (data.message as Record<string, unknown>) : UNAVAILABLE
    },

    async readAck(caller: BoardCaller, input: unknown): Promise<Record<string, unknown> | Refusal> {
      const parsed = commsMessageRefSchema.safeParse(input)
      if (!parsed.success) return refusal('invalid_arguments', 'Name the message by its id.')
      const message = boardId(parsed.data.message)
      if (message === null) return refusal('not_authorized', 'This Project cannot read that message.')
      return call('board_read_ack', { p_estate_id: caller.estateId, p_reader: caller.projectId, p_principal: caller.principal, p_message: message })
    },

    /** `comms-status.schema.json`: health without reading any message. COM-02 has no responders and no mirror. */
    async status(caller: BoardCaller): Promise<Record<string, unknown>> {
      let unread: unknown = null
      try {
        const res = await deps.rpc('board_unread', { p_estate_id: caller.estateId, p_reader: caller.projectId })
        if (!res.error) unread = res.data
      } catch (e) {
        ops.failed('board.status-unreadable', e, { note: 'the unread count could not be read; status says unavailable' })
        unread = null
      }
      // A board it cannot reach is shown as unreachable, never as an empty board (contract "host health").
      if (typeof unread !== 'number' || !Number.isSafeInteger(unread) || unread < 0)
        return { protocol: COMMS_PROTOCOL, board: { state: 'unavailable', reason: 'The board could not be read.' }, project: caller.projectId, responders: [], transport: { telegram: 'off' } }
      return { protocol: COMMS_PROTOCOL, board: { state: 'ready' }, project: caller.projectId, responders: [], transport: { telegram: 'off' }, unread }
    }
  }
}
export type Board = ReturnType<typeof createBoard>
// #endregion project-board-service
