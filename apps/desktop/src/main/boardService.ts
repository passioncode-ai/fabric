// #region project-board-service — docs: docs/adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md#3-who-may-take-part-is-a-separate-grant-from-who-may-call-a-product
/**
 * The participant half of the project board (COM-02.2/02.3, ADR-0117 §2–§3, ADR-0149): what a session's `com.*`
 * tools do between the MCP call and the board's SQL commands (migrations 79 and 86).
 *
 * - The caller's estate, Project and principal come from the authenticated scope, never from the input; the
 *   input schemas below are the contract's (`comms-submit.schema.json` …) and refuse any field they do not
 *   name, so a forged `estate_id` or `sender` is refused before anything is stored.
 * - The digest is the contract's: SHA-256 over `fabric-project-comms/0.1 NUL <operation> NUL <canonical JSON>`,
 *   canonical JSON with sorted keys, integers only (|n| ≤ 2^53−1), no lone surrogates, no normalisation.
 * - A cursor is an `opaqueId`: the last seq read plus a MAC binding it to this estate, reader, filter and grant.
 *   Any other reader, filter or a key from another run reads `cursor_reset_required`, never a silent change of
 *   audience (C3).
 * - A board that cannot be read answers `not_available`, never an empty page (COM-02 acceptance). A WRITE whose
 *   answer was lost says so: it may have been stored, and the same idempotency key tells which (A7-035).
 * - Receipts pass only through a strict check against the contract receipt's shape: an estate seq or any other
 *   key it does not name is Fabric's defect, answered `not_available` and logged, never handed to an agent (C3).
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

/** The board's tools: DEC-0022's sixteen and `com.directory`, which contract DEC-0073 adds (pinned since f00a768, DEC-0078). Every one
 *  is registered (A7-039); the gate decides which are served. */
export const COMMS_OPERATIONS = [
  'com.submit', 'com.list', 'com.get', 'com.read_ack', 'com.reply', 'com.cancel', 'com.status',
  'com.enroll', 'com.claim', 'com.renew', 'com.accept', 'com.progress', 'com.effect_begin', 'com.complete',
  'com.reconcile', 'com.responder_replace', 'com.directory'
] as const
export type CommsOperation = (typeof COMMS_OPERATIONS)[number]

// #region comms-pinned-operations — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#decision
/**
 * The operations Fabric serves under the contract pin it vendors (spec §1.3). Since the repin to contract DEC-0073
 * (fabric-agent-contract edc88a6, COM02.3-01) every one of the seventeen has its argument schema in the pin and is
 * served; the pin is now `f00a768` (DEC-0078, which carries DEC-0076 and DEC-0077). The set stays as a tested safeguard: an operation removed from it — or a future tool the pin does not carry
 * yet — answers `unsupported_capability` before anything is read or stored. `board-service.test.mjs` fails when the
 * vendored pin and this set disagree, so a repin cannot land without this line.
 */
export const PINNED_COMMS_OPERATIONS: ReadonlySet<CommsOperation> = new Set<CommsOperation>(COMMS_OPERATIONS)
/** Whether the pinned `comms-status` carries `idempotency.epoch` (DEC-0073 adds it; a viewer principal never reads it). */
export const STATUS_CARRIES_EPOCH = true
// #endregion comms-pinned-operations

// #region board-session-operations — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#amendments
/**
 * What a board session (`fabric.board.join`, surface 'board') is given — ADR-0149 Amendment 2, from ADR-0117 §3: a
 * board enrollment is a respond-only participation. `board.respond` promises that the agent may take and answer the
 * requests other Projects send to this one; so it reads its Project's status and the threads it takes part in, holds
 * the slot and moves the requests it holds, and replies only as a responder (the fenced form). It never sends as the
 * Project (`com.submit`), cancels the Project's requests (`com.cancel`), clears the read marks the Project's coding
 * agents share (`com.read_ack`) or reads the directory (`com.directory`). The service refuses those for a board
 * caller too, before the door, so the narrowing does not rest on the server's tool list alone.
 */
export const BOARD_SESSION_OPERATIONS: ReadonlySet<CommsOperation> = new Set<CommsOperation>([
  'com.status', 'com.list', 'com.get', 'com.reply', 'com.enroll', 'com.claim', 'com.renew', 'com.accept', 'com.progress',
  'com.effect_begin', 'com.complete', 'com.reconcile', 'com.responder_replace'
])
// #endregion board-session-operations

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
  // A NUL inside the operation would move the separator, and two calls would share a digest (contract
  // src/comms-digest.ts; the refusal vectors of fixtures/vectors/canonical.json).
  if (operation === '' || operation.includes('\u0000')) throw new CommsCanonicalError('an operation is a non-empty name without NUL')
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
  idempotency: z.strictObject({ epoch: z.number().int().min(1).max(2147483647), key: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/) }),
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
/** `com.status` (contract DEC-0073, `comms-status-args`): a session omits its Project or names its own. */
export const commsStatusArgsSchema = z.strictObject({ project: projectId.optional() })
const idempotency = z.strictObject({ epoch: z.number().int().min(1).max(2147483647), key: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/) })
const body = z.strictObject({ text: z.string().min(1).max(BODY_MAX_BYTES), format: z.enum(['text/plain', 'text/markdown']).optional() })
/** `com.reply`, a participant's form (spec §1.2, Fabric's proposal; the responder's fenced form is COM-03's). */
export const commsReplySchema = z.strictObject({ idempotency, replyTo: opaqueId, body, artifacts: z.array(artifactRef).max(8).optional() })
/** `com.cancel` (spec §1.2): only the requester's Project may cancel. */
export const commsCancelSchema = z.strictObject({
  idempotency, request: opaqueId, expectedRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(), reason: z.string().min(1).max(300).optional()
})
const timestamp = z.iso.datetime({ offset: true })
const requestState = z.enum(['queued', 'claimed', 'accepted', 'in_progress', 'completed', 'failed_known', 'cancelled', 'expired', 'outcome_unknown'])
const effectState = z.enum(['not_started', 'started', 'succeeded_observed', 'failed_observed', 'unknown'])
const receiptAttempt = z.strictObject({ id: opaqueId, generation: z.number().int().min(1), digest: sha256, leaseExpiresAt: timestamp })
/** The receipt of every successful mutation (spec §1.2, `comms-receipt`): no field it does not name, so no seq (C3).
 *  `transferred` (contract DEC-0078, pinned at f00a768): only com.responder_replace answers it, one entry per request it
 *  transferred — each request once — with its revision and the attempt the new holder continues under. */
export const commsReceiptSchema = z.strictObject({
  ok: z.literal(true),
  repeated: z.boolean(),
  message: opaqueId.optional(),
  thread: opaqueId.optional(),
  at: timestamp.optional(),
  request: z.strictObject({ id: opaqueId, state: requestState, effect: effectState, revision: z.number().int().min(1) }).optional(),
  slot: z.strictObject({ project: projectId, capability: capabilityName, generation: z.number().int().min(1), leaseExpiresAt: timestamp }).optional(),
  attempt: receiptAttempt.optional(),
  transferred: z.array(z.strictObject({ request: opaqueId, revision: z.number().int().min(1), attempt: receiptAttempt })).min(1).max(64)
    .refine((t) => new Set(t.map((x) => x.request)).size === t.length, 'each transferred request once').optional()
})

// ── the responder tools' argument shapes (contract DEC-0073, pinned at f00a768 with DEC-0078), strict ──────
const boardIntSafe = z.number().int().max(Number.MAX_SAFE_INTEGER)
export const commsFenceSchema = z.strictObject({
  request: opaqueId, generation: boardIntSafe.min(1), attempt: opaqueId, digest: sha256, expectedRevision: boardIntSafe.min(1).optional(), idempotency
})
const artifacts = z.array(artifactRef).max(8).refine((a) => new Set(a.map((x) => commsCanonical(x))).size === a.length, 'artifacts are unique')
/** `com.reply` (comms-reply): exactly one of a participant's `{idempotency, replyTo}` or a responder's `{fence}`. */
export const commsReplyResponderSchema = z.strictObject({ fence: commsFenceSchema, body, artifacts: artifacts.optional() })
export const commsReplyAnySchema = z.union([z.strictObject({ idempotency, replyTo: opaqueId, body, artifacts: artifacts.optional() }), commsReplyResponderSchema])
export const commsEnrollSchema = z.strictObject({ idempotency, capability: capabilityName })
export const commsClaimSchema = z.strictObject({ idempotency, capability: capabilityName, request: opaqueId.optional() })
export const commsFencedSchema = z.strictObject({ fence: commsFenceSchema })
export const commsProgressSchema = z.strictObject({ fence: commsFenceSchema, note: z.strictObject({ text: z.string().min(1).max(2000) }).optional() })
export const commsEffectBeginSchema = z.strictObject({ fence: commsFenceSchema, summary: z.string().min(1).max(2000).optional() })
const outcomeBase = { state: z.enum(['completed', 'failed_known']), summary: z.string().min(1).max(2000).optional(), evidence: artifacts.optional() }
export const commsCompleteSchema = z.strictObject({ fence: commsFenceSchema, outcome: z.strictObject({ ...outcomeBase, observed: z.boolean() }) })
export const commsReconcileSchema = z.strictObject({
  idempotency, request: opaqueId, digest: sha256, expectedRevision: boardIntSafe.min(1).optional(), outcome: z.strictObject({ ...outcomeBase, observed: z.literal(true) })
})
export const commsResponderReplaceSchema = z.strictObject({
  idempotency, capability: capabilityName, expectedGeneration: boardIntSafe.min(0),
  transfer: z.strictObject({
    requests: z.array(opaqueId).min(1).max(64).refine((a) => new Set(a).size === a.length, 'requests are unique'),
    checkpoint: z.strictObject({ summary: z.string().min(1).max(2000), evidence: artifacts.optional() })
  }).optional()
})
export const commsDirectoryArgsSchema = z.strictObject({ capability: capabilityName.optional(), cursor: opaqueId.optional(), limit: z.number().int().min(1).max(100).optional() })
/** The directory's answer (comms-directory): closed at every level, so nothing but ids, names, capabilities and responder
 *  state leaves; a page lists each Project once and each capability once per Project (contract DEC-0077, FAC-SEM-107). */
export const commsDirectorySchema = z.strictObject({
  protocol: z.literal(COMMS_PROTOCOL),
  snapshot: z.strictObject({ readAt: timestamp, stale: z.boolean().optional() }),
  projects: z.array(z.strictObject({
    id: projectId, name: z.string().min(1).max(120),
    capabilities: z.array(z.strictObject({ capability: capabilityName, responder: z.enum(['active', 'stale', 'absent']) })).max(64)
      .refine((c) => new Set(c.map((x) => x.capability)).size === c.length, 'each capability once per Project')
  })).max(100).refine((p) => new Set(p.map((x) => x.id)).size === p.length, 'each Project once'),
  cursor: opaqueId.nullable()
})

export interface BoardCaller {
  estateId: string
  projectId: string
  principal: { kind: 'agent' | 'person' | 'operator'; id: string; label?: string; provenance: 'trusted' | 'asserted' }
  /** What the session takes part under (C3: a cursor is bound to it): how it came in today, its grant with COM-03. */
  participationGrant?: string
  /** A Project session (the default) submits and so reads its idempotency epoch; a viewer principal (a host such as
   *  Fabric Dashboards, C9) reads com.status only and is never told an epoch (contract DEC-0073). */
  surface?: 'session' | 'board' | 'viewer'
  /** The responder's facts (COM-03), from the authenticated scope: the session, how it came in, its runner and its
   *  binding — the board answers under the grant these name (ADR-0149 §3). Absent: this caller cannot respond. */
  responder?: { sessionId: string; cameIn: 'launched' | 'enrolled' | 'handed-off' | 'hub'; agent: string | null; bindingId: string | null }
}
/** The SQL door: `db.rpc` in the app, a fake in tests. */
export type BoardRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>

export interface BoardDeps {
  rpc: BoardRpc
  /** Binds cursors to this run; a restart resets them (`cursor_reset_required`), which the contract allows. */
  cursorKey?: Buffer
  now?: () => Date
  /** Whether com.status carries `idempotency.epoch`; the pin decides (`STATUS_CARRIES_EPOCH`), a test may say otherwise. */
  statusCarriesEpoch?: boolean
}

const UNAVAILABLE = refusal('not_available', 'The board cannot be read right now; nothing was changed.', true)
/** A write whose answer was lost may have committed (A7-035): the same key, sent again, tells which. */
const UNCONFIRMED = refusal('not_available', 'The board did not confirm this; it may have been stored. Send it again with the same idempotency key to learn which.', true)
/** The same, for a call that takes no idempotency key or stores no receipt (read_ack, renew, progress): repeating it is
 *  harmless — a read mark is set once, a renewal only extends, a note is posted once per attempt and key. */
const UNCONFIRMED_KEYLESS = refusal('not_available', 'The board did not confirm this; it may have taken effect. It is safe to send again.', true)
/** A board session (ADR-0149 Amendment 2) is respond-only: what it is not given is refused before the door. */
const RESPOND_ONLY = refusal('not_authorized', 'A board session answers requests only: it does not send, cancel, mark read or read the directory as its Project.')
const SQLSTATE = /^[0-9A-Z]{5}$/
type Kind = 'read' | 'write' | 'keyless'

export function createBoard(deps: BoardDeps) {
  const key = deps.cursorKey ?? randomBytes(32)
  const now = deps.now ?? (() => new Date())
  const statusCarriesEpoch = deps.statusCarriesEpoch ?? STATUS_CARRIES_EPOCH

  const mac = (caller: BoardCaller, thread: string | null, seq: number): string =>
    createHmac('sha256', key).update(commsCanonical({ e: caller.estateId, g: 'participant', r: caller.projectId, s: seq, t: thread, v: caller.participationGrant ?? 'participant' })).digest('base64url').slice(0, 22)
  const cursorFor = (caller: BoardCaller, thread: string | null, seq: number): string => `c${seq.toString(36)}_${mac(caller, thread, seq)}`
  const seqFrom = (caller: BoardCaller, thread: string | null, cursor: string): number | null => {
    const m = /^c([0-9a-z]{1,11})_([A-Za-z0-9_-]{22})$/.exec(cursor)
    if (!m) return null
    const seq = parseInt(m[1], 36)
    if (!Number.isSafeInteger(seq)) return null
    const want = Buffer.from(mac(caller, thread, seq)), got = Buffer.from(m[2])
    return want.length === got.length && timingSafeEqual(want, got) ? seq : null
  }

  /**
   * One board command. A7-035 and the A7-017 residual: a thrown error or an error without a SQLSTATE never reached
   * a verdict — a read changed nothing, a write may have committed; a SQLSTATE of class 22 is the caller's value the
   * database could not take; any other SQLSTATE rolled the statement back, so nothing changed.
   */
  const call = async (fn: string, args: Record<string, unknown>, kind: Kind): Promise<Record<string, unknown> | Refusal> => {
    let res: { data: unknown; error: unknown }
    try { res = await deps.rpc(fn, args) } catch (e) {
      ops.failed('board.rpc-threw', e, { note: `the board command ${fn} could not be reached; the caller was told not_available (${kind})` })
      return kind === 'write' ? UNCONFIRMED : kind === 'keyless' ? UNCONFIRMED_KEYLESS : UNAVAILABLE
    }
    if (res.error) {
      const code = typeof (res.error as { code?: unknown }).code === 'string' ? (res.error as { code: string }).code : ''
      if (SQLSTATE.test(code) && code.startsWith('22')) return refusal('invalid_arguments', 'The board could not take a value in these arguments.')
      ops.failed('board.rpc-unreadable', res.error, { note: `the board command ${fn} failed (${code || 'no SQLSTATE'}); the caller was told not_available (${kind})` })
      return SQLSTATE.test(code) || kind === 'read' ? UNAVAILABLE : kind === 'keyless' ? UNCONFIRMED_KEYLESS : UNCONFIRMED
    }
    if (res.data === null || typeof res.data !== 'object') {
      ops.failed('board.rpc-unreadable', new Error('no object answer'), { note: `the board command ${fn} gave no readable answer; the caller was told not_available (${kind})` })
      return kind === 'write' ? UNCONFIRMED : kind === 'keyless' ? UNCONFIRMED_KEYLESS : UNAVAILABLE
    }
    return res.data as Record<string, unknown>
  }

  /** A write's answer, passed on only as the contract's receipt (or the board's own refusal). */
  const receipt = (fn: string, data: Record<string, unknown> | Refusal, kind: Kind = 'write'): Record<string, unknown> | Refusal => {
    if (isRefusal(data)) return data
    const checked = commsReceiptSchema.safeParse(data)
    if (checked.success) return checked.data
    ops.failed('board.receipt-shape', new Error(checked.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.code}`).join('; ')),
      { note: `the board command ${fn} answered a receipt the contract does not name; the caller was told not_available` })
    return kind === 'keyless' ? UNCONFIRMED_KEYLESS : UNCONFIRMED
  }
  /** Whether this caller is a board session (ADR-0149 Amendment 2): respond-only. */
  const respondOnly = (caller: BoardCaller): boolean => caller.surface === 'board'

  /** A board id for a message, thread or request: an id that cannot exist here is refused as unknown, before the door. */
  const idempotencyDigest = (operation: CommsOperation, value: unknown): string | Refusal => {
    try { return commsDigest(operation, value) } catch {
      // Silence is right: the refusal names the cause, and the input is the caller's, not a fault of Fabric's.
      return refusal('invalid_arguments', 'The call cannot be put in canonical form.')
    }
  }

  /** The holder a responder command runs as: built from the authenticated scope (ADR-0149 §3), never from the input. */
  const holderOf = (caller: BoardCaller): Record<string, unknown> | null => {
    const r = caller.responder
    if (!r || caller.principal.provenance !== 'trusted' || (caller.surface ?? 'session') === 'viewer') return null
    return { session_id: r.sessionId, came_in: r.cameIn, agent: r.agent, binding_id: r.bindingId, ...(caller.principal.label ? { label: caller.principal.label.slice(0, 80) } : {}) }
  }
  /** A board id where the contract admits any opaque id: one that is no uuid names nothing here (refused as unknown). */
  const normaliseFence = (f: z.infer<typeof commsFenceSchema>): z.infer<typeof commsFenceSchema> | Refusal => {
    const request = boardId(f.request)
    if (request === null) return refusal('not_authorized', 'This Project cannot act on that request.')
    const attempt = boardId(f.attempt)
    if (attempt === null) return refusal('fenced', 'This attempt is no longer the request\'s; this call was not committed.')
    return { ...f, request, attempt }
  }
  /**
   * One responder command (COM-03): the contract's argument shape, ids normalised, the digest over the arguments as
   * sent to the board, the holder from the scope, and the answer passed on only as the contract's receipt.
   */
  const responderCall = async <T extends z.ZodType>(caller: BoardCaller, op: CommsOperation, fn: string, schema: T, input: unknown, kind: Kind = 'write'): Promise<Record<string, unknown> | Refusal> => {
    const holder = holderOf(caller)
    if (!holder) return refusal('not_authorized', 'This session cannot answer requests: only a Project session or a board session can respond.')
    const parsed = schema.safeParse(input ?? {})
    if (!parsed.success) {
      const big = parsed.error.issues.some((i) => i.path.join('.') === 'body.text' && i.code === 'too_big')
      return big ? refusal('body_too_large', 'The message body is larger than 65,536 bytes.') : refusal('invalid_arguments', `The call does not match ${op}'s arguments.`)
    }
    const args = { ...(parsed.data as Record<string, unknown>) }
    if (args.fence) {
      const f = normaliseFence(args.fence as z.infer<typeof commsFenceSchema>)
      if (isRefusal(f)) return f
      args.fence = f
    }
    if (typeof args.request === 'string') {
      const request = boardId(args.request)
      if (request === null) return refusal('not_authorized', op === 'com.claim' ? 'This Project cannot claim that request.' : 'This Project cannot act on that request.')
      args.request = request
    }
    const transfer = args.transfer as { requests: string[]; checkpoint: unknown } | undefined
    if (transfer) {
      const ids = transfer.requests.map(boardId)
      if (ids.some((x) => x === null)) return refusal('invalid_arguments', 'A transferred request must be an accepted request of this Project and capability.')
      args.transfer = { ...transfer, requests: ids as string[] }
    }
    const body = args.body as { text?: string } | undefined
    if (body?.text !== undefined && Buffer.byteLength(body.text, 'utf8') > BODY_MAX_BYTES) return refusal('body_too_large', 'The message body is larger than 65,536 bytes.')
    const digest = idempotencyDigest(op, args)
    if (typeof digest !== 'string') return digest
    return receipt(fn, await call(fn, { p_estate: caller.estateId, p_holder: holder, p_project: caller.projectId, p_args: args, p_digest: digest }, kind), kind)
  }

  const dirMac = (caller: BoardCaller, capability: string | null, after: string): string =>
    createHmac('sha256', key).update(commsCanonical({ a: after, e: caller.estateId, f: capability, k: 'directory', r: caller.projectId, v: caller.participationGrant ?? 'participant' })).digest('base64url').slice(0, 22)

  return {
    async submit(caller: BoardCaller, input: unknown): Promise<Record<string, unknown> | Refusal> {
      if (respondOnly(caller)) return RESPOND_ONLY
      const parsed = commsSubmitSchema.safeParse(input)
      if (!parsed.success) {
        const big = parsed.error.issues.some((i) => i.path.join('.') === 'body.text' && i.code === 'too_big')
        return big ? refusal('body_too_large', 'The message body is larger than 65,536 bytes.') : refusal('invalid_arguments', 'The submission does not match the board\'s message shape.')
      }
      // Bytes before hashing or storing (the schema counts characters).
      if (Buffer.byteLength(parsed.data.body.text, 'utf8') > BODY_MAX_BYTES) return refusal('body_too_large', 'The message body is larger than 65,536 bytes.')
      // The same id rule as list, get and read_ack (0.3.2 verification DA-5): a thread or message id that
      // cannot exist here is refused before the door; one of any case is sent lower-cased.
      if ('id' in parsed.data.thread) {
        const thread = boardId(parsed.data.thread.id)
        if (thread === null) return refusal('not_authorized', 'This Project cannot write to that thread.')
        parsed.data.thread = { id: thread }
      }
      // Project ids the board compares as lower-case uuids (migration 81): participants and a request's target
      // take the same normalisation, so an upper-case spelling is not refused as an unknown Project (i3 DA-1).
      const lowerUuid = (id: string): string => (BOARD_ID.test(id) ? id.toLowerCase() : id)
      if ('new' in parsed.data.thread) parsed.data.thread = { new: { ...parsed.data.thread.new, participants: parsed.data.thread.new.participants.map(lowerUuid) } }
      if (parsed.data.request) parsed.data.request = { ...parsed.data.request, target: lowerUuid(parsed.data.request.target) }
      // Contract DEC-0073: a reply's thread must be replyTo's own, else invalid_arguments. The board decides the
      // thread first (a thread this Project is not in is not_authorized, whatever replyTo says), so an id that
      // is no board id is passed as given — the board refuses it by its shape, without a cast — and a board id of
      // any case is sent lower-cased.
      if (parsed.data.replyTo !== undefined) parsed.data.replyTo = boardId(parsed.data.replyTo) ?? parsed.data.replyTo
      const digest = idempotencyDigest('com.submit', parsed.data)
      if (typeof digest !== 'string') return digest
      return receipt('board_submit', await call('board_submit', { p_estate_id: caller.estateId, p_sender: caller.projectId, p_principal: caller.principal, p_submit: parsed.data, p_digest: digest }, 'write'))
    },

    /** `com.reply`, a participant's form. The responder's fenced form arrives with the responder tools (COM-03). */
    async reply(caller: BoardCaller, input: unknown): Promise<Record<string, unknown> | Refusal> {
      // A responder's reply carries its fence and answers fence.request (DEC-0073); both forms, or neither, are refused.
      if (input && typeof input === 'object' && 'fence' in input) {
        if ('replyTo' in input || 'idempotency' in input) return refusal('invalid_arguments', 'A reply is a participant\'s (idempotency and replyTo) or a responder\'s (fence), not both.')
        return responderCall(caller, 'com.reply', 'board_reply_fenced', commsReplyResponderSchema, input)
      }
      // A board session replies only as a responder, with the fence of a request it holds (ADR-0149 Amendment 2).
      if (respondOnly(caller)) return refusal('not_authorized', 'A board session replies only as a responder: com.reply with the fence of a request it holds.')
      const parsed = commsReplySchema.safeParse(input)
      if (!parsed.success) {
        const big = parsed.error.issues.some((i) => i.path.join('.') === 'body.text' && i.code === 'too_big')
        return big ? refusal('body_too_large', 'The message body is larger than 65,536 bytes.') : refusal('invalid_arguments', 'The reply does not match the board\'s reply shape.')
      }
      if (Buffer.byteLength(parsed.data.body.text, 'utf8') > BODY_MAX_BYTES) return refusal('body_too_large', 'The message body is larger than 65,536 bytes.')
      const replyTo = boardId(parsed.data.replyTo)
      if (replyTo === null) return refusal('not_authorized', 'This Project cannot reply to that message.')
      parsed.data.replyTo = replyTo
      const digest = idempotencyDigest('com.reply', parsed.data)
      if (typeof digest !== 'string') return digest
      return receipt('board_reply', await call('board_reply', { p_estate_id: caller.estateId, p_sender: caller.projectId, p_principal: caller.principal, p_reply: parsed.data, p_digest: digest }, 'write'))
    },

    /** `com.cancel`: only the Project that sent the request. */
    async cancel(caller: BoardCaller, input: unknown): Promise<Record<string, unknown> | Refusal> {
      if (respondOnly(caller)) return RESPOND_ONLY
      const parsed = commsCancelSchema.safeParse(input)
      if (!parsed.success) return refusal('invalid_arguments', 'The cancellation does not match the board\'s cancel shape.')
      const request = boardId(parsed.data.request)
      if (request === null) return refusal('not_authorized', 'This Project cannot cancel that request.')
      parsed.data.request = request
      const digest = idempotencyDigest('com.cancel', parsed.data)
      if (typeof digest !== 'string') return digest
      return receipt('board_cancel', await call('board_cancel', { p_estate_id: caller.estateId, p_caller: caller.projectId, p_principal: caller.principal, p_cancel: parsed.data, p_digest: digest }, 'write'))
    },

    // ── the responder tools (COM-03, migration 87; contract DEC-0073) ────────────────────────────────────────
    enroll: (caller: BoardCaller, input: unknown) => responderCall(caller, 'com.enroll', 'board_enroll', commsEnrollSchema, input),
    claim: (caller: BoardCaller, input: unknown) => responderCall(caller, 'com.claim', 'board_claim', commsClaimSchema, input),
    renew: (caller: BoardCaller, input: unknown) => responderCall(caller, 'com.renew', 'board_renew', commsFencedSchema, input, 'keyless'),
    accept: (caller: BoardCaller, input: unknown) => responderCall(caller, 'com.accept', 'board_accept', commsFencedSchema, input),
    progress: (caller: BoardCaller, input: unknown) => responderCall(caller, 'com.progress', 'board_progress', commsProgressSchema, input, 'keyless'),
    effectBegin: (caller: BoardCaller, input: unknown) => responderCall(caller, 'com.effect_begin', 'board_effect_begin', commsEffectBeginSchema, input),
    complete: (caller: BoardCaller, input: unknown) => responderCall(caller, 'com.complete', 'board_complete', commsCompleteSchema, input),
    reconcile: (caller: BoardCaller, input: unknown) => responderCall(caller, 'com.reconcile', 'board_reconcile', commsReconcileSchema, input),
    responderReplace: (caller: BoardCaller, input: unknown) => responderCall(caller, 'com.responder_replace', 'board_responder_replace', commsResponderReplaceSchema, input),

    /**
     * `com.directory` (DEC-0073 §8): the estate's addressable Projects. Readers are Project and board sessions the
     * board verified; a viewer or an asserted principal is refused before the door. The cursor is bound to the reader,
     * its grant, the filter and (through the estate id a restore replaces) the restore epoch.
     */
    async directory(caller: BoardCaller, input: unknown): Promise<Record<string, unknown> | Refusal> {
      if ((caller.surface ?? 'session') === 'viewer' || caller.principal.provenance !== 'trusted')
        return refusal('not_authorized', 'Only a session of a Project of this estate reads the directory.')
      if (respondOnly(caller)) return RESPOND_ONLY
      const parsed = commsDirectoryArgsSchema.safeParse(input ?? {})
      if (!parsed.success) return refusal('invalid_arguments', 'com.directory takes capability?, cursor? and limit? (1–100).')
      const capability = parsed.data.capability ?? null
      let after: string | null = null
      if (parsed.data.cursor !== undefined) {
        const m = /^d([0-9a-f]{32})_([A-Za-z0-9_-]{22})$/.exec(parsed.data.cursor)
        const id = m ? `${m[1].slice(0, 8)}-${m[1].slice(8, 12)}-${m[1].slice(12, 16)}-${m[1].slice(16, 20)}-${m[1].slice(20)}` : null
        const want = id ? Buffer.from(dirMac(caller, capability, id)) : null
        if (!m || !id || !want || want.length !== m[2].length || !timingSafeEqual(want, Buffer.from(m[2])))
          return refusal('cursor_reset_required', 'This cursor does not belong to this reader and filter; read again from the start.')
        after = id
      }
      const data = await call('board_directory', { p_estate: caller.estateId, p_reader: caller.projectId, p_capability: capability, p_after: after, p_limit: parsed.data.limit ?? 50 }, 'read')
      if (isRefusal(data)) return data
      const last = typeof data.last === 'string' && BOARD_ID.test(data.last) ? data.last : null
      const out = {
        protocol: COMMS_PROTOCOL,
        snapshot: { readAt: now().toISOString() },
        projects: data.projects,
        cursor: data.more === true && last ? `d${last.replace(/-/g, '')}_${dirMac(caller, capability, last)}` : null
      }
      const checked = commsDirectorySchema.safeParse(out)
      if (checked.success) return checked.data
      ops.failed('board.directory-shape', new Error(checked.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.code}`).join('; ')),
        { note: 'board_directory answered a page the contract does not name; the caller was told not_available' })
      return UNAVAILABLE
    },

    /** A session ended: its slots go (DEC-0073 §5). Best effort, never thrown; the authority recheck is what refuses. */
    async releaseSession(estateId: string, sessionId: string): Promise<number | null> {
      const r = await call('board_release_session', { p_estate: estateId, p_session: sessionId }, 'write')
      return isRefusal(r) ? null : Number(r.released ?? 0)
    },
    /** A board.respond grant was revoked: the enrollments it admitted go. */
    async releaseGrant(estateId: string, grantId: string): Promise<number | null> {
      const r = await call('board_release_grant', { p_estate: estateId, p_grant: grantId }, 'write')
      return isRefusal(r) ? null : Number(r.released ?? 0)
    },
    /** `fabric.board.join`: the capabilities a binding may answer for one Project, or a refusal. */
    async joinCheck(estateId: string, bindingId: string, projectId: string): Promise<{ capabilities: string[]; grants: string[] } | Refusal> {
      const r = await call('board_join_check', { p_estate: estateId, p_binding: bindingId, p_project: projectId }, 'read')
      if (isRefusal(r)) return r
      const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string') : [])
      return Array.isArray(r.capabilities) && Array.isArray(r.grants) ? { capabilities: strings(r.capabilities), grants: strings(r.grants) } : UNAVAILABLE
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
      const data = await call('board_list', { p_estate_id: caller.estateId, p_reader: caller.projectId, p_thread: thread, p_after_seq: after, p_limit: parsed.data.limit ?? 50 }, 'read')
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
      const data = await call('board_get', { p_estate_id: caller.estateId, p_reader: caller.projectId, p_message: message }, 'read')
      if (isRefusal(data)) return data
      return data.ok === true && data.message ? (data.message as Record<string, unknown>) : UNAVAILABLE
    },

    async readAck(caller: BoardCaller, input: unknown): Promise<Record<string, unknown> | Refusal> {
      // Read marks are shared per Project: a service must not clear the unread its coding agents rely on.
      if (respondOnly(caller)) return RESPOND_ONLY
      const parsed = commsMessageRefSchema.safeParse(input)
      if (!parsed.success) return refusal('invalid_arguments', 'Name the message by its id.')
      const message = boardId(parsed.data.message)
      if (message === null) return refusal('not_authorized', 'This Project cannot read that message.')
      return receipt('board_read_ack', await call('board_read_ack', { p_estate_id: caller.estateId, p_reader: caller.projectId, p_principal: caller.principal, p_message: message }, 'keyless'), 'keyless')
    },

    /**
     * `comms-status.schema.json`: health without reading any message (migration 86's `board_status`). A board that
     * cannot be read is `unavailable`, never an empty board; an archived Project is refused, as every read is.
     */
    async status(caller: BoardCaller, input?: unknown): Promise<Record<string, unknown> | Refusal> {
      const args = commsStatusArgsSchema.safeParse(input ?? {})
      if (!args.success) return refusal('invalid_arguments', 'com.status takes one optional argument, project: your Project is this session\'s.')
      // Contract DEC-0073: a session's Project is its endpoint's. Naming another Project answers exactly as an unknown
      // one does (board_status's own refusal), before the door — whether that Project exists is not this session's to learn.
      const named = args.data.project
      if (named !== undefined && (BOARD_ID.test(named) ? named.toLowerCase() : named) !== caller.projectId)
        return refusal('not_authorized', 'This Project may not read the board.')
      const down = { protocol: COMMS_PROTOCOL, board: { state: 'unavailable', reason: 'The board could not be read.' }, project: caller.projectId, responders: [], transport: { telegram: 'off' } }
      const data = await call('board_status', { p_estate_id: caller.estateId, p_reader: caller.projectId }, 'read')
      if (isRefusal(data)) return data.error.code === 'not_available' ? down : data
      const unread = data.unread, responders = data.responders, epoch = data.epoch
      if (data.ok !== true || typeof unread !== 'number' || !Number.isSafeInteger(unread) || unread < 0 || !Array.isArray(responders)
          || typeof epoch !== 'number' || !Number.isSafeInteger(epoch) || epoch < 1) {
        ops.failed('board.status-unreadable', new Error('board_status answered an unexpected shape'), { note: 'status says unavailable' })
        return down
      }
      return {
        protocol: COMMS_PROTOCOL, board: { state: 'ready' }, project: caller.projectId, responders, transport: { telegram: 'off' }, unread,
        // The epoch is every submitting surface's — a Project session's and a board session's, whose responder commands
        // all carry it (ADR-0149 Amendment 1 §5). Only a viewer principal (Dashboards, C9) reads com.status without
        // `idempotency`: it submits nothing (contract DEC-0073).
        ...(statusCarriesEpoch && (caller.surface ?? 'session') !== 'viewer' ? { idempotency: { epoch } } : {})
      }
    }
  }
}
export type Board = ReturnType<typeof createBoard>

export interface BoardTickResult { expired: number; rotated: number; retired: number; receipts_compacted: number; outbox_compacted: number }
/**
 * One pass of the board's own upkeep for one estate (migration 86's `board_tick`), from the app's 60 s cycle:
 * deadline expiry, epoch rotation, receipt and outbox retention. It never throws into the cycle; a pass that
 * fails is logged and the next one tries again — every step is idempotent, and an idle pass writes nothing.
 */
export async function tickBoard(rpc: BoardRpc, estateId: string): Promise<BoardTickResult | null> {
  try {
    const { data, error } = await rpc('board_tick', { p_estate_id: estateId })
    const d = data as Record<string, unknown> | null
    if (error || !d || d.ok !== true) {
      ops.failed('board.tick', error ?? new Error(JSON.stringify(d)), { note: 'the board upkeep pass did not run; the next cycle tries again' })
      return null
    }
    return { expired: Number(d.expired), rotated: Number(d.rotated), retired: Number(d.retired), receipts_compacted: Number(d.receipts_compacted), outbox_compacted: Number(d.outbox_compacted) }
  } catch (e) {
    ops.failed('board.tick', e, { note: 'the board upkeep pass could not reach the database; the next cycle tries again' })
    return null
  }
}
// #endregion project-board-service
