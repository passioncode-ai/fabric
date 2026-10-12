// #region project-board-tools — docs: docs/adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md#2-the-wire-is-the-contracts-pinned-by-bytes
/**
 * The tools of `fabric-project-comms/0.1` on a session's MCP server (COM-02.2/02.3, ADR-0117 §2, ADR-0149).
 *
 * The input schema handed to the SDK is deliberately open: the SDK would otherwise strip an undeclared field
 * (so a forged `estate_id` would pass silently) or answer a malformed call with its own error. The board
 * service validates every call against the contract's own shapes and answers a refusal in the contract's
 * form, `{error: {code, message, retryable}}`, so an agent meets one refusal vocabulary.
 *
 * All seventeen names — DEC-0022's sixteen and `com.directory` (contract DEC-0073, merged in the contract at f8ae4e1 and not yet pinned) — are registered, each by a literal call (`scripts/check-surface-tools.mjs`
 * reads literals), so an agent that calls one Fabric does not serve yet is told so in the contract's words —
 * `unsupported_capability` — instead of meeting an unknown tool (ADR-0117 §2, A7-039). Which are served is
 * `PINNED_COMMS_OPERATIONS` (the vendored contract pin) intersected with what this board implements; the
 * responder tools are implemented with COM-03.
 */
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { isRefusal, PINNED_COMMS_OPERATIONS, refusal, type Board, type BoardCaller, type CommsOperation } from './boardService.ts'

const open = z.looseObject({})
const reply = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  ...(isRefusal(value) ? { isError: true } : {})
})
type Handler = (caller: BoardCaller, args: unknown) => Promise<unknown>

export function registerBoardTools(server: McpServer, board: Board, caller: () => BoardCaller, served: ReadonlySet<CommsOperation> = PINNED_COMMS_OPERATIONS): void {
  // The gate (spec §1.3): an operation outside the pin, or one this board has no handler for, is refused in the
  // contract's words before anything is read or stored.
  const gate = (op: CommsOperation, handler?: Handler) => async (args: unknown) =>
    reply(served.has(op) && handler ? await handler(caller(), args) : refusal('unsupported_capability', `This board does not serve ${op} yet.`))
  const later = 'Served with the responder tools (COM-03); until then it answers unsupported_capability.'

  server.registerTool('com.submit', {
    title: 'Send a message or request to other Projects',
    description:
      'fabric-project-comms/0.1 com.submit. Arguments (comms-submit.schema.json): idempotency {epoch: the one com.status names, key: 8–128 of [A-Za-z0-9._:-]}; ' +
      'thread {id} of a thread you take part in, or {new: {participants: [Project ids, at most 16], subject?}}; ' +
      'kind message|request|reply|finding|announcement; body {text: at most 65,536 UTF-8 bytes, format?: text/plain|text/markdown}; ' +
      'request {target: a participant Project, capability, deadline?} only for kind request; replyTo: a message of the same thread, required for kind reply; ' +
      'artifacts: at most 8 {id: uri, contentHash: sha256:<hex>}. Your Project and identity are taken from this session, never from the arguments. ' +
      'Retrying with the same key and the same message returns the same receipt; another message under that key is idempotency_conflict. ' +
      'An answer that did not arrive may still have been stored: send it again with the same key to learn which.',
    inputSchema: open
  }, gate('com.submit', (c, a) => board.submit(c, a)))

  server.registerTool('com.list', {
    title: 'Read board messages addressed to your Project',
    description:
      'fabric-project-comms/0.1 com.list. Arguments: thread? (one thread you take part in), cursor? (from the previous page), limit? (1–100, default 50). ' +
      'Answers one page (comms-page.schema.json), oldest first. Reading marks nothing as read: use com.read_ack. ' +
      'A cursor from another filter or an earlier run answers cursor_reset_required; read again without it. A board that cannot be read answers not_available, never an empty page.',
    inputSchema: open
  }, gate('com.list', (c, a) => board.list(c, a)))

  server.registerTool('com.get', {
    title: 'Read one board message',
    description: 'fabric-project-comms/0.1 com.get. Arguments: message (its id). A message of a thread your Project does not take part in reads as not_authorized, exactly like an absent one.',
    inputSchema: open
  }, gate('com.get', (c, a) => board.get(c, a)))

  server.registerTool('com.read_ack', {
    title: 'Mark a board message read',
    description: 'fabric-project-comms/0.1 com.read_ack. Arguments: message (its id). Explicit and idempotent: marking it again returns the same receipt.',
    inputSchema: open
  }, gate('com.read_ack', (c, a) => board.readAck(c, a)))

  server.registerTool('com.reply', {
    title: 'Reply to a board message',
    description:
      'fabric-project-comms/0.1 com.reply. Arguments: idempotency {epoch: the one com.status names, key}; replyTo (a message of a thread you take part in); ' +
      'body {text, format?}; artifacts?. The reply lands in that message\'s thread. A reply is not a completion: no request changes state.',
    inputSchema: open
  }, gate('com.reply', (c, a) => board.reply(c, a)))

  server.registerTool('com.cancel', {
    title: 'Cancel a request your Project sent',
    description:
      'fabric-project-comms/0.1 com.cancel. Arguments: idempotency {epoch: the one com.status names, key}; request (its id); expectedRevision?; reason? (1–300 characters). ' +
      'Only the Project that sent the request may cancel it. A request whose work had begun becomes outcome_unknown: it may have happened; only com.reconcile with an observed result settles it.',
    inputSchema: open
  }, gate('com.cancel', (c, a) => board.cancel(c, a)))

  server.registerTool('com.status', {
    title: 'Board health for your Project',
    description:
      'fabric-project-comms/0.1 com.status (comms-status.schema.json): whether the board is ready, your unread count, your responders and the mirror (off). ' +
      'A responder that is stale has let its lease lapse — not that it failed or succeeded. Reads no message.',
    inputSchema: open
  }, gate('com.status', (c, a) => board.status(c, a)))

  server.registerTool('com.enroll', { title: 'Hold a responder slot for your Project', description: `fabric-project-comms/0.1 com.enroll. ${later}`, inputSchema: open }, gate('com.enroll'))
  server.registerTool('com.claim', { title: 'Claim the next request for a capability', description: `fabric-project-comms/0.1 com.claim. ${later}`, inputSchema: open }, gate('com.claim'))
  server.registerTool('com.renew', { title: 'Renew a responder lease', description: `fabric-project-comms/0.1 com.renew. ${later}`, inputSchema: open }, gate('com.renew'))
  server.registerTool('com.accept', { title: 'Accept a claimed request', description: `fabric-project-comms/0.1 com.accept. ${later}`, inputSchema: open }, gate('com.accept'))
  server.registerTool('com.progress', { title: 'Report progress on a request', description: `fabric-project-comms/0.1 com.progress. ${later}`, inputSchema: open }, gate('com.progress'))
  server.registerTool('com.effect_begin', { title: 'Say a request\'s effect has begun', description: `fabric-project-comms/0.1 com.effect_begin. ${later}`, inputSchema: open }, gate('com.effect_begin'))
  server.registerTool('com.complete', { title: 'Complete a request with its outcome', description: `fabric-project-comms/0.1 com.complete. ${later}`, inputSchema: open }, gate('com.complete'))
  server.registerTool('com.reconcile', {
    title: 'Settle a request whose outcome is unknown',
    description: `fabric-project-comms/0.1 com.reconcile. outcome_unknown means the work may have happened; only an observed result settles it. ${later}`,
    inputSchema: open
  }, gate('com.reconcile'))
  server.registerTool('com.responder_replace', { title: 'Take over a responder slot', description: `fabric-project-comms/0.1 com.responder_replace. ${later}`, inputSchema: open }, gate('com.responder_replace'))
  server.registerTool('com.directory', {
    title: 'Which Projects of this estate you can address',
    description: 'fabric-project-comms/0.1 com.directory (contract DEC-0073). Served once the contract pin carries it; until then it answers unsupported_capability.',
    inputSchema: open
  }, gate('com.directory'))
}
// #endregion project-board-tools
