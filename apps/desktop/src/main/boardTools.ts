// #region project-board-tools — docs: docs/adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md#2-the-wire-is-the-contracts-pinned-by-bytes
/**
 * The participant tools of `fabric-project-comms/0.1` on a session's MCP server (COM-02.2, ADR-0117 §2).
 *
 * The input schema handed to the SDK is deliberately open: the SDK would otherwise strip an undeclared field
 * (so a forged `estate_id` would pass silently) or answer a malformed call with its own error. The board
 * service validates every call against the contract's own shapes and answers a refusal in the contract's
 * form, `{error: {code, message, retryable}}`, so an agent meets one refusal vocabulary.
 *
 * Only the tools served are registered (contract "Capability negotiation"). `com.reply` and `com.cancel`
 * arrive with COM-02.3, the responder tools with COM-03.
 */
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { isRefusal, type Board, type BoardCaller } from './boardService.ts'

export const BOARD_TOOLS = ['com.submit', 'com.list', 'com.get', 'com.read_ack', 'com.status'] as const

const open = z.looseObject({})
const reply = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  ...(isRefusal(value) ? { isError: true } : {})
})

export function registerBoardTools(server: McpServer, board: Board, caller: () => BoardCaller): void {
  server.registerTool('com.submit', {
    title: 'Send a message or request to other Projects',
    description:
      'fabric-project-comms/0.1 com.submit. Arguments (comms-submit.schema.json): idempotency {epoch: 1, key: 8–128 of [A-Za-z0-9._:-]}; ' +
      'thread {id} of a thread you take part in, or {new: {participants: [Project ids, at most 16], subject?}}; ' +
      'kind message|request|reply|finding|announcement; body {text: at most 65,536 UTF-8 bytes, format?: text/plain|text/markdown}; ' +
      'request {target: a participant Project, capability, deadline?} only for kind request; replyTo: a message of the same thread, required for kind reply; ' +
      'artifacts: at most 8 {id: uri, contentHash: sha256:<hex>}. Your Project and identity are taken from this session, never from the arguments. ' +
      'Retrying with the same key and the same message returns the same receipt; another message under that key is idempotency_conflict.',
    inputSchema: open
  }, async (args) => reply(await board.submit(caller(), args)))

  server.registerTool('com.list', {
    title: 'Read board messages addressed to your Project',
    description:
      'fabric-project-comms/0.1 com.list. Arguments: thread? (one thread you take part in), cursor? (from the previous page), limit? (1–100, default 50). ' +
      'Answers one page (comms-page.schema.json), oldest first. Reading marks nothing as read: use com.read_ack. ' +
      'A cursor from another filter or an earlier run answers cursor_reset_required; read again without it. A board that cannot be read answers not_available, never an empty page.',
    inputSchema: open
  }, async (args) => reply(await board.list(caller(), args)))

  server.registerTool('com.get', {
    title: 'Read one board message',
    description: 'fabric-project-comms/0.1 com.get. Arguments: message (its id). A message of a thread your Project does not take part in reads as not_authorized, exactly like an absent one.',
    inputSchema: open
  }, async (args) => reply(await board.get(caller(), args)))

  server.registerTool('com.read_ack', {
    title: 'Mark a board message read',
    description: 'fabric-project-comms/0.1 com.read_ack. Arguments: message (its id). Explicit and idempotent: marking it again returns the same receipt.',
    inputSchema: open
  }, async (args) => reply(await board.readAck(caller(), args)))

  server.registerTool('com.status', {
    title: 'Board health for your Project',
    description: 'fabric-project-comms/0.1 com.status (comms-status.schema.json): whether the board is ready, your unread count, responders (none until COM-03) and the mirror (off). Reads no message.',
    inputSchema: open
  }, async () => reply(await board.status(caller())))
}
// #endregion project-board-tools
