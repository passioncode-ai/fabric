// #region comms-screen — docs: docs/ux/screens.md#scr-81-project-comms
/**
 * The operator's read onto the project board (SCR-81, SCN-143; ADR-0117 D3 sanctions the
 * LOCAL operator's read): the shapes `board_threads_operator` and `board_list_operator`
 * (Migration 83, `supabase/migrations/20261011000094_project_board_operator_read.sql`)
 * answer with, carried from the main process to the Comms screen unchanged.
 *
 * One rule the whole path holds: an unread board is `unavailable`, NEVER an empty list —
 * an empty page is a true answer the board gave, a board that did not answer is not
 * (SCN-143 Alt paths). That is why every reply is a union and not an array with a
 * problem field beside it.
 */

/** How many thread heads the board lists to Comms (`board_thread_heads_operator`'s p_limit): the badge's count and
 *  «Mark all read» see at most these, and the settings file holds a read mark for each (0.3.12 review DA-12). */
export const COMMS_THREAD_HEADS_LIMIT = 5000

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
  /** The message kinds the thread HOLDS, sorted and distinct — the kind filter matches on this,
   *  not on the last message (SCN-143, amended 2026-10-11; migration 84). */
  kinds: string[]
  /** Requests of this thread outside the contract's terminal set; outcome_unknown counts as open. */
  openRequests: number
}

/** The principal of a sender, as the board holds it (jsonb): who acted, and whether that
 *  is trusted or merely asserted — the contract's own distinction, shown as-is. */
export interface CommsPrincipal {
  kind?: string
  id?: string
  label?: string
  provenance?: 'trusted' | 'asserted' | string
}

/** A request's lifecycle as TWO separate facts, the way the contract keeps them (SCN-143
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

/** `textsMissing` (SCN-146 alt path): the board holds no thread, yet the journal records this many messages — a
 *  restore whose board history did not come back. Absent when the empty list is the board's true answer. */
export type CommsThreadsReply = { ok: true; threads: CommsThread[]; textsMissing?: number } | { ok: false; error: CommsReadError }

/** One page: messages oldest first, the cursor to continue from, and whether the board
 *  holds more after it — the same paging contract as the board's own `board_list`. */
export type CommsPageReply =
  | { ok: true; messages: CommsMessage[]; lastSeq: number; more: boolean }
  | { ok: false; error: CommsReadError }
// #endregion comms-screen

// #region comms-operator-reads-w4 — docs: docs/adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md#8-what-comms-shows-besides
/** Wave 4's reads (migration 89, `20261013000108_project_board_operator_reads.sql`). Each is a union like the two
 *  above: a door that did not answer is `unavailable`, never an empty answer. */

/** The thread page's filters, applied by the board (SCN-143's wave-4 amendment). Every member is optional; together
 *  they combine as AND. `project` is the participant filter — the entry point another screen may open Comms with. */
export interface CommsThreadFilter {
  project?: string
  kind?: 'message' | 'request' | 'reply' | 'finding' | 'announcement'
  openOnly?: boolean
  /** RFC 3339 UTC: threads whose last message was written at or after it. */
  activeSince?: string
  /** A coding agent (the runner catalogue id) that took part in the thread's requests. */
  provider?: string
}
/** Where the next, older page starts: the last row of the page read, by the page's own order (lastSeq, id). */
export interface CommsThreadCursor { lastSeq: number; id: string }
/** A page row: the thread list's row, plus the coding agents that took part in its requests. */
export interface CommsPageThread extends CommsThread { providers: string[] }
export type CommsThreadPageReply =
  | { ok: true; threads: CommsPageThread[]; more: boolean; before: CommsThreadCursor | null; textsMissing?: number }
  | { ok: false; error: CommsReadError }

export interface CommsHead { id: string; lastSeq: number }
/** `truncated`: the board cut the list at its cap — a count read from it is "at least", never exact. */
export type CommsHeadsReply = { ok: true; heads: CommsHead[]; truncated: boolean } | { ok: false; error: CommsReadError }

/** One responder slot: who answers a (project, capability) now. `stale` is a lapsed lease, which says nothing about
 *  success or failure; `absent` names why the last holder left and when, when the board knows. */
export interface CommsResponder {
  project: string
  capability: string
  state: 'active' | 'stale' | 'absent' | string
  generation: number
  leaseExpiresAt?: string
  agent?: string
  cameIn?: string
  label?: string
  since?: string
  releasedCause?: 'session-ended' | 'revoked' | 'replaced' | 'restore' | string
  releasedAt?: string
  /** A pause on the slot or its project (ADR-0156); read once the controls migration serves it. */
  held?: boolean
}
export type CommsRespondersReply = { ok: true; responders: CommsResponder[] } | { ok: false; error: CommsReadError }

/** An artifact as the sender stated it (contract artifactRef): Fabric never checked the file or its hash. */
export interface CommsArtifact { id: string; contentHash: string; label?: string }
/** What a request ended with: a responder's (or the owner's) outcome, or the requester's cancel reason — told apart by
 *  the journal's op at the outcome's seq, never by guessing from the text. */
export interface CommsOutcome {
  kind: 'outcome' | 'cancel_reason'
  summary?: string
  evidence: CommsArtifact[]
  at: string
  settledBy?: 'responder' | 'owner' | string
}
export interface CommsRequestFacts {
  generation?: number
  attemptLive: boolean
  lastOp?: string
  lastCause?: string
  lastAt?: string
  outcomes: CommsOutcome[]
}
export interface CommsFacts {
  /** Per message: the participant projects that marked it read, never its sender. */
  messages: Record<string, { readBy: string[] }>
  requests: Record<string, CommsRequestFacts>
}
export type CommsFactsReply = ({ ok: true } & CommsFacts) | { ok: false; error: CommsReadError }

export interface CommsTimelineStep {
  op: string
  from: string
  to: string
  effectFrom?: string
  effectTo?: string
  cause?: string
  generation?: number
  settledBy?: string
  at: string
}
export type CommsTimelineReply = { ok: true; steps: CommsTimelineStep[]; more: boolean } | { ok: false; error: CommsReadError }

/** A related thread, with enough of it to open it when the list does not hold it. */
export interface CommsRelatedThread {
  id: string
  subject: string | null
  why: 'same-projects' | 'shared-artifact'
  lastAt: string | null
  participants?: string[]
  createdSeq?: number
  lastSeq?: number
}
export type CommsRelatedReply = { ok: true; threads: CommsRelatedThread[]; more: boolean } | { ok: false; error: CommsReadError }

/** A message a search found, with enough of its thread to open it there when the list does not hold it. */
export interface CommsSearchHit {
  message: string
  thread: string
  seq: number
  at: string
  sender: string
  snippet: string
  subject?: string | null
  participants?: string[]
  createdSeq?: number
}
/** `stoppedEarly`: the search ran out of its time budget; what it found before is in `hits`. `before`: the seq to
 *  continue from when `more`. */
export type CommsSearchReply =
  | { ok: true; hits: CommsSearchHit[]; more: boolean; stoppedEarly: boolean; before: number | null }
  | { ok: false; error: CommsReadError }

/** What waits for one project (COM-05): delivered, held by the board, and not marked read by any of its agents. */
export interface CommsPending {
  project: string
  unread: number
  oldestAt: string
  findings: number
  requests: number
  requestsWithAbsentResponder: number
}
export type CommsPendingReply = { ok: true; projects: CommsPending[]; more: boolean } | { ok: false; error: CommsReadError }

// #region board-core-holds-waiting — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#board
/** What waits on the board for the operator, outside Comms (0.3.9 BD-2): requests nobody can answer now (queued or
 *  otherwise open, no responder holds their slot, read by their target or not), with the oldest. Counts only: no body,
 *  no project. The unread-deliveries half `board_waiting_operator` also answers is not carried (review i1 UX-1, DA-8):
 *  it counts one copy per recipient project, 3,103 on the operator's data, and nothing the operator does lowers it, so
 *  the home does not show it; Comms keeps its own per-project counts. */
export interface CommsWaiting {
  requests: number
  oldestRequestAt?: string
}
export type CommsWaitingReply = ({ ok: true } & CommsWaiting) | { ok: false; error: CommsReadError }
// #endregion board-core-holds-waiting

/** `comms:open-artifact`: only an `https:` link opens, in the browser, through main; anything else is refused. */
export type CommsOpenArtifactReply = { ok: true } | { ok: false; reason: 'refused' | 'failed' }

/** The board's kind of message, the filter's closed set. */
export const COMMS_KINDS = ['message', 'request', 'reply', 'finding', 'announcement'] as const
// #endregion comms-operator-reads-w4
