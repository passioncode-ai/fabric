// #region project-board-tools — docs: docs/adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md#2-the-wire-is-the-contracts-pinned-by-bytes
/**
 * The tools of `fabric-project-comms/0.1` on a session's MCP server (COM-02.2/02.3, ADR-0117 §2, ADR-0149).
 *
 * The input schema handed to the SDK validates nothing: the SDK would otherwise strip an undeclared field
 * (so a forged `estate_id` would pass silently) or answer a malformed call with its own error. The board
 * service validates every call against the contract's own shapes and answers a refusal in the contract's
 * form, `{error: {code, message, retryable}}`, so an agent meets one refusal vocabulary.
 *
 * What tools/list publishes is typed (CO-292): the same strict shape the handler parses with, carried as the
 * open schema's JSON Schema metadata. A client that types its arguments from the published schema — Claude
 * Code sends a value under an undeclared property as a string — could otherwise send no nested argument at all.
 *
 * All seventeen names — DEC-0022's sixteen and `com.directory` (contract DEC-0073; pinned at f00a768, DEC-0078) — are registered, each by a literal call (`scripts/check-surface-tools.mjs`
 * reads literals), so an agent that calls one Fabric does not serve yet is told so in the contract's words —
 * `unsupported_capability` — instead of meeting an unknown tool (ADR-0117 §2, A7-039). Which are served is
 * `PINNED_COMMS_OPERATIONS` (the vendored contract pin) intersected with what this board implements: since COM-03,
 * all seventeen.
 */
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  commsCancelSchema, commsClaimSchema, commsCompleteSchema, commsDirectoryArgsSchema, commsEffectBeginSchema, commsEnrollSchema,
  commsFencedSchema, commsListSchema, commsMessageRefSchema, commsProgressSchema, commsReadAckSchema, commsReconcileSchema, commsReplyAnySchema,
  commsResponderReplaceSchema, commsStatusArgsSchema, commsSubmitSchema,
  isRefusal, PINNED_COMMS_OPERATIONS, refusal, type Board, type BoardCaller, type CommsOperation
} from './boardService.ts'

/** The strict shape each tool's handler parses with (boardService.ts). Published in tools/list, never used to validate. */
export const BOARD_TOOL_INPUT: Readonly<Record<CommsOperation, z.ZodType>> = {
  'com.submit': commsSubmitSchema,
  'com.list': commsListSchema,
  'com.get': commsMessageRefSchema,
  'com.read_ack': commsReadAckSchema,
  'com.reply': commsReplyAnySchema,
  'com.cancel': commsCancelSchema,
  'com.status': commsStatusArgsSchema,
  'com.enroll': commsEnrollSchema,
  'com.claim': commsClaimSchema,
  'com.renew': commsFencedSchema,
  'com.accept': commsFencedSchema,
  'com.progress': commsProgressSchema,
  'com.effect_begin': commsEffectBeginSchema,
  'com.complete': commsCompleteSchema,
  'com.reconcile': commsReconcileSchema,
  'com.responder_replace': commsResponderReplaceSchema,
  'com.directory': commsDirectoryArgsSchema
}

/** A shape as tools/list publishes it. MCP requires an object schema at the top, and a client types each
 *  argument by the top-level properties, so a union of object forms (com.reply: a participant's or a
 *  responder's) is published as one object declaring every form's properties — required only where all forms
 *  require them — with the forms themselves as its anyOf. */
export function publishedBoardSchema(shape: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(shape, { io: 'input', target: 'draft-2020-12', unrepresentable: 'any' }) as Record<string, unknown>
  if (json.type === 'object') return json
  const forms = (json.anyOf ?? []) as Array<{ type?: string; properties?: Record<string, unknown>; required?: string[] }>
  if (forms.length === 0 || forms.some((f) => f.type !== 'object')) return { ...json, type: 'object' }
  const properties = Object.assign({}, ...forms.map((f) => f.properties ?? {})) as Record<string, unknown>
  const required = Object.keys(properties).filter((k) => forms.every((f) => (f.required ?? []).includes(k)))
  return { ...json, type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false }
}

// Open for the SDK's validation, typed for tools/list: zod merges a schema's metadata into its JSON Schema.
const typed = (op: CommsOperation) => z.looseObject({}).meta(publishedBoardSchema(BOARD_TOOL_INPUT[op]))
const reply = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  ...(isRefusal(value) ? { isError: true } : {})
})
type Handler = (caller: BoardCaller, args: unknown) => Promise<unknown>

export function registerBoardTools(target: McpServer, board: Board, caller: () => BoardCaller, served: ReadonlySet<CommsOperation> = PINNED_COMMS_OPERATIONS,
  only?: ReadonlySet<CommsOperation>): void {
  // `only` (a board session, ADR-0149 Amendment 2: BOARD_SESSION_OPERATIONS): the tools outside it are not registered
  // at all, so they are not listed either. Every registration below stays a literal call on `server`.
  const server = only
    ? { registerTool: ((name: string, ...rest: unknown[]) => (only.has(name as CommsOperation) ? (target.registerTool as (...a: unknown[]) => unknown)(name, ...rest) : undefined)) as McpServer['registerTool'] }
    : target
  // The gate (spec §1.3): an operation outside the pin, or one this board has no handler for, is refused in the
  // contract's words before anything is read or stored.
  const gate = (op: CommsOperation, handler?: Handler) => async (args: unknown) =>
    reply(served.has(op) && handler ? await handler(caller(), args) : refusal('unsupported_capability', `This board does not serve ${op} yet.`))

  server.registerTool('com.submit', {
    title: 'Send a message or request to other Projects',
    description:
      'fabric-project-comms/0.1 com.submit. Arguments (comms-submit.schema.json): idempotency {epoch: the one com.status names, key: 8–128 of [A-Za-z0-9._:-]}; ' +
      'thread {id} of a thread you take part in, or {new: {participants: [Project ids, at most 16], subject?}}; ' +
      'kind message|request|reply|finding|announcement; body {text: at most 65,536 UTF-8 bytes, format?: text/plain|text/markdown}; ' +
      'request {target: a participant Project, capability, deadline?} only for kind request; replyTo: a message of the same thread, required for kind reply (another thread\'s message is invalid_arguments; com.reply takes the thread from replyTo); ' +
      'artifacts: at most 8 {id: uri, contentHash: sha256:<hex>}. Your Project and identity are taken from this session, never from the arguments. ' +
      'Retrying with the same key and the same message returns the same receipt; another message under that key is idempotency_conflict. ' +
      'An answer that did not arrive may still have been stored: send it again with the same key to learn which. ' +
      'A request without a deadline gets one 7 days out, then expires. A request nobody can answer now is stored, and its receipt carries noResponder {target, capability, message}: ' +
      'its target can still answer it with a reply (com.reply, or kind reply with replyTo the request), which moves it to answered. ' +
      'noResponder and the request state answered are Fabric\'s own additions, outside the pinned contract: noResponder comes in this receipt only, to you as the requester, without asking for it.',
    inputSchema: typed('com.submit')
  }, gate('com.submit', (c, a) => board.submit(c, a)))

  server.registerTool('com.list', {
    title: 'Read board messages addressed to your Project',
    description:
      'fabric-project-comms/0.1 com.list. Arguments: thread? (one thread you take part in), cursor? (from the previous page), limit? (1 to 100, default 50), ' +
      'unread? (true: only messages your Project has not marked read), since? (date-time: only messages written at or after it). ' +
      'Answers one page (comms-page.schema.json), oldest first; with unread or since each message also carries read (true or false). A request may read as answered (its target replied): Fabric\'s own state, outside the pinned contract. To see what is new, call com.list {unread: true} and mark what you handled with com.read_ack. ' +
      'Reading marks nothing as read. A cursor survives an app restart; one from another filter or another reader answers cursor_reset_required: read again without it. ' +
      'A board that cannot be read answers not_available, never an empty page.',
    inputSchema: typed('com.list')
  }, gate('com.list', (c, a) => board.list(c, a)))

  server.registerTool('com.get', {
    title: 'Read one board message',
    description: 'fabric-project-comms/0.1 com.get. Arguments: message (its id). A message of a thread your Project does not take part in reads as not_authorized, exactly like an absent one. ' +
      'A request may read as answered (its target replied): a state of Fabric\'s own, outside the pinned contract.',
    inputSchema: typed('com.get')
  }, gate('com.get', (c, a) => board.get(c, a)))

  server.registerTool('com.read_ack', {
    title: 'Mark a board message read',
    description: 'fabric-project-comms/0.1 com.read_ack. Arguments, one form per call: message (one id); or messages (1 to 100 ids); or thread and upTo (every message of that thread sent to your Project, at or before the message upTo names). ' +
      'No idempotency key. Explicit and idempotent: the first mark answers repeated: false and its time as at; marking again changes nothing and answers repeated: true. ' +
      'The many forms are all or nothing (a message your Project cannot read refuses the call) and answer marked and alreadyRead counts; more: true means the thread had over 1000 and you should call again.',
    inputSchema: typed('com.read_ack')
  }, gate('com.read_ack', (c, a) => board.readAck(c, a)))

  server.registerTool('com.reply', {
    title: 'Reply to a board message',
    description:
      'fabric-project-comms/0.1 com.reply (comms-reply). A participant: idempotency {epoch: the one com.status names, key}; replyTo (a message of a thread you take part in); body {text, format?}; artifacts?. The reply lands in that message\'s thread. ' +
      'A responder: fence (as com.accept takes it); body; artifacts?. The reply answers fence.request in its thread. Both forms, or neither, are refused. ' +
      'A participant reply from the request\'s target to a queued request answers it: the request moves to answered, and the asker sees it. A reply is not a completion: a responder still completes with com.complete.',
    inputSchema: typed('com.reply')
  }, gate('com.reply', (c, a) => board.reply(c, a)))

  server.registerTool('com.cancel', {
    title: 'Cancel a request your Project sent',
    description:
      'fabric-project-comms/0.1 com.cancel. Arguments: idempotency {epoch: the one com.status names, key}; request (its id); expectedRevision?; reason? (1–300 characters). ' +
      'Only the Project that sent the request may cancel it. A request whose work had begun becomes outcome_unknown: it may have happened; only com.reconcile with an observed result settles it.',
    inputSchema: typed('com.cancel')
  }, gate('com.cancel', (c, a) => board.cancel(c, a)))

  server.registerTool('com.status', {
    title: 'Board health for your Project',
    description:
      'fabric-project-comms/0.1 com.status (comms-status.schema.json). Arguments: project? (omit it, or name your own Project; another Project answers not_authorized, as an unknown one does). ' +
      'Answers whether the board is ready, your unread count, your responders and the mirror (off). ' +
      'A responder that is stale has let its lease lapse — not that it failed or succeeded. idempotency.epoch is the epoch your Project submits under now. Reads no message.',
    inputSchema: typed('com.status')
  }, gate('com.status', (c, a) => board.status(c, a)))

  // The responder tools (COM-03): the holder is this session, under the operator's board.respond grant for the slot
  // (ADR-0149 §2–§3); a lease is 60 s of database time — renew at about 20 s.
  const FENCE = 'fence {request, generation, attempt, digest — the values com.claim returned —, expectedRevision?, idempotency {epoch, key}}'
  server.registerTool('com.enroll', {
    title: 'Hold your Project\'s responder slot for a capability',
    description:
      'fabric-project-comms/0.1 com.enroll (comms-enroll). Arguments: idempotency {epoch: the one com.status names, key}; capability. ' +
      'Takes the slot of your Project for that capability, if the operator let this agent answer it (else not_authorized: the operator grants board.respond for this project and capability in Fabric, Settings → Agent access; until then reply to the request and say it stays queued). ' +
      'The receipt\'s slot carries the generation your fences name and the lease expiry (database time). A live holder answers fenced; a lapsed one is replaced. ' +
      'Leaving or ending this session releases the slot.',
    inputSchema: typed('com.enroll')
  }, gate('com.enroll', (c, a) => board.enroll(c, a)))
  server.registerTool('com.claim', {
    title: 'Claim the next request for a capability',
    description:
      'fabric-project-comms/0.1 com.claim (comms-claim). Arguments: idempotency; capability (a slot you hold); request? (claim that one). ' +
      'Answers request, attempt and message — the attempt is what your fences carry — or {ok, repeated: false} with nothing claimable (nothing stored: poll again with the same key). ' +
      'A request whose claim lapsed is taken again under a new attempt. An accepted request is never claimed or read back here (a transfer\'s attempts arrive in com.responder_replace\'s receipt).',
    inputSchema: typed('com.claim')
  }, gate('com.claim', (c, a) => board.claim(c, a)))
  server.registerTool('com.renew', {
    title: 'Renew your responder lease',
    description: `fabric-project-comms/0.1 com.renew (comms-fenced). Arguments: ${FENCE}. Extends the slot\'s and the attempt\'s leases by 60 s of database time and changes no state; nothing is stored.`,
    inputSchema: typed('com.renew')
  }, gate('com.renew', (c, a) => board.renew(c, a)))
  server.registerTool('com.accept', {
    title: 'Accept a claimed request',
    description: `fabric-project-comms/0.1 com.accept (comms-fenced). Arguments: ${FENCE}. claimed → accepted: you acknowledge this exact request and digest. Nothing has happened yet.`,
    inputSchema: typed('com.accept')
  }, gate('com.accept', (c, a) => board.accept(c, a)))
  server.registerTool('com.progress', {
    title: 'Report progress on a request',
    description: `fabric-project-comms/0.1 com.progress (comms-progress). Arguments: ${FENCE}; note? {text: 1–2,000 characters}. Renews like com.renew; a note is posted on the request\'s thread once per attempt and key (a repeat answers that message with repeated: true).`,
    inputSchema: typed('com.progress')
  }, gate('com.progress', (c, a) => board.progress(c, a)))
  server.registerTool('com.effect_begin', {
    title: 'Say a request\'s effect has begun',
    description: `fabric-project-comms/0.1 com.effect_begin (comms-effect-begin). Arguments: ${FENCE}; summary?. accepted → in_progress, effect started. From here only an observed result settles the request.`,
    inputSchema: typed('com.effect_begin')
  }, gate('com.effect_begin', (c, a) => board.effectBegin(c, a)))
  server.registerTool('com.complete', {
    title: 'Complete a request with its outcome',
    description: `fabric-project-comms/0.1 com.complete (comms-complete). Arguments: ${FENCE}; outcome {state: completed|failed_known, observed, summary?, evidence?}. After an effect began, observed: false is observation_required. A replaced responder is fenced: its late result is refused, never committed.`,
    inputSchema: typed('com.complete')
  }, gate('com.complete', (c, a) => board.complete(c, a)))
  server.registerTool('com.reconcile', {
    title: 'Settle a request whose outcome is unknown',
    description:
      'fabric-project-comms/0.1 com.reconcile (comms-reconcile). Arguments: idempotency; request; digest (the request\'s); expectedRevision?; outcome {state, observed: true, summary?, evidence?}. ' +
      'outcome_unknown means the work may have happened; only an observed result settles it, by the slot\'s current holder.',
    inputSchema: typed('com.reconcile')
  }, gate('com.reconcile', (c, a) => board.reconcile(c, a)))
  server.registerTool('com.responder_replace', {
    title: 'Take over a responder slot',
    description:
      'fabric-project-comms/0.1 com.responder_replace (comms-responder-replace). Arguments: idempotency; capability; expectedGeneration (from com.status); transfer? {requests: accepted request ids, checkpoint {summary, evidence?}}. ' +
      'Takes the slot even from a live holder at generation + 1: its claimed requests return to queued, in_progress ones become outcome_unknown, accepted ones are held unless transferred. ' +
      'A transferred request continues under a new attempt: the receipt\'s transferred names each one once with its revision and attempt — carry those in its next fence (contract DEC-0078).',
    inputSchema: typed('com.responder_replace')
  }, gate('com.responder_replace', (c, a) => board.responderReplace(c, a)))
  server.registerTool('com.directory', {
    title: 'Which Projects of this estate you can address',
    description:
      'fabric-project-comms/0.1 com.directory (comms-directory, DEC-0073). Arguments: capability? (only Projects that list it), cursor?, limit? (1–100). ' +
      'The other Projects of your estate by name then id: their id (what com.submit addresses), name, the capabilities they take requests for and each one\'s responder state. Never a message, a count or who answers. ' +
      'Your own Project is not listed (com.status describes it); a Project its operator unlisted is absent but still reachable by its id.',
    inputSchema: typed('com.directory')
  }, gate('com.directory', (c, a) => board.directory(c, a)))
}
// #endregion project-board-tools
