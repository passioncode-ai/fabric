// #region comms-screen — docs: docs/ux/screens.md#scr-77-project-comms
/**
 * The operator's read onto the project board (SCR-77, SCN-137; ADR-0117 D3 sanctions the
 * LOCAL operator's read): the shapes `board_threads_operator` and `board_list_operator`
 * (migration 80, `supabase/migrations/20261011000084_project_board_operator_read.sql`)
 * answer with, carried from the main process to the Comms screen unchanged.
 *
 * One rule the whole path holds: an unread board is `unavailable`, NEVER an empty list —
 * an empty page is a true answer the board gave, a board that did not answer is not
 * (SCN-137 Alt paths). That is why every reply is a union and not an array with a
 * problem field beside it.
 */

/** One thread as `board_threads_operator` returns it. Project names are resolved by the
 *  caller — the board keeps its own ids (the migration's header says so). */
export interface CommsThread {
  id: string
  subject: string | null
  /** Participant Project ids (uuids). */
  participants: string[]
  createdBy: string
  createdSeq: number
  messageCount: number
  lastSeq: number
  lastAt: string | null
}

/** The principal of a sender, as the board holds it (jsonb): who acted, and whether that
 *  is trusted or merely asserted — the contract's own distinction, shown as-is. */
export interface CommsPrincipal {
  kind?: string
  id?: string
  label?: string
  provenance?: 'trusted' | 'asserted' | string
}

/** A request's lifecycle as TWO separate facts, the way the contract keeps them (SCN-137
 *  step 3): state and effect are never merged into one word. */
export interface CommsRequest {
  id: string
  target: string
  capability: string
  state: string
  effect: string
  deadline?: string
  revision: number
}

export interface CommsMessage {
  id: string
  thread: string
  kind: 'message' | 'request' | 'reply' | 'finding' | 'announcement' | string
  sender: { project: string; principal: CommsPrincipal | null }
  at: string
  digest: string
  /** Absent when the body was removed: a redacted message keeps its place, id and digest. */
  body?: { text: string; format?: string }
  redacted?: true
  replyTo?: string
  request?: CommsRequest
  artifacts?: unknown[]
}

/** Why a read did not answer. `unavailable` covers the board/RPC not answering at all
 *  (PostgREST error, a missing function, a malformed payload); `not_found` and
 *  `invalid_arguments` are the board's own refusals, passed through with their message. */
export interface CommsReadError {
  code: 'unavailable' | 'not_found' | 'invalid_arguments'
  message: string
}

export type CommsThreadsReply = { ok: true; threads: CommsThread[] } | { ok: false; error: CommsReadError }

/** One page: messages oldest first, the cursor to continue from, and whether the board
 *  holds more after it — the same paging contract as the board's own `board_list`. */
export type CommsPageReply =
  | { ok: true; messages: CommsMessage[]; lastSeq: number; more: boolean }
  | { ok: false; error: CommsReadError }
// #endregion comms-screen
