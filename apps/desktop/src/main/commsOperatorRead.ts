// #region comms-screen — docs: docs/ux/screens.md#scr-81-project-comms
/**
 * The operator's read path onto the project board (SCR-81, SCN-143), between the Comms
 * screen's IPC handlers and Migration 83's two security-definer functions
 * (`board_threads_operator`, `board_list_operator`,
 * `supabase/migrations/20261011000094_project_board_operator_read.sql`).
 *
 * Two rules, both from the scenario:
 *
 * - UNAVAILABLE IS NOT EMPTY. A PostgREST error, a missing function (the migration not
 *   applied) or a payload that is not the shape the migration promises all answer
 *   `unavailable` — an empty list is something only the board itself may say (SCN-143
 *   Alt paths: "it NEVER shows an empty list in that case").
 * - THE BOARD'S REFUSALS TRAVEL AS THEY ARE. `not_found` (a thread outside this estate)
 *   and `invalid_arguments` keep their codes and messages; they are the board's answer,
 *   not a transport failure.
 *
 * The shapes are checked field by field rather than cast: what crosses here is jsonb
 * from SQL, and a blind `as CommsMessage[]` is how a changed migration would render
 * undefined on screen as if it were data.
 */

import {
  COMMS_KINDS,
  type CommsArtifact,
  type CommsFactsReply,
  type CommsHead,
  type CommsHeadsReply,
  type CommsMessage,
  type CommsOpenArtifactReply,
  type CommsOutcome,
  type CommsPageReply,
  type CommsPageThread,
  type CommsPending,
  type CommsPendingReply,
  type CommsPrincipal,
  type CommsReadError,
  type CommsRelatedReply,
  type CommsRelatedThread,
  type CommsRequest,
  type CommsRequestFacts,
  type CommsResponder,
  type CommsRespondersReply,
  type CommsSearchHit,
  type CommsSearchReply,
  type CommsThread,
  type CommsThreadCursor,
  type CommsThreadFilter,
  type CommsThreadPageReply,
  type CommsThreadsReply,
  type CommsTimelineReply,
  type CommsWaitingReply,
  type CommsTimelineStep,
  COMMS_THREAD_HEADS_LIMIT
} from '../shared/commsRead.ts'
import { ops } from './opsSink.ts'

/** The SQL door: `db.rpc` in the app, a fake in tests (the same seam as boardService's). */
export type CommsRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>

export interface CommsOperatorReadDeps {
  rpc: CommsRpc
  /** How many `comms.message_submitted@1` events the estate's journal records, or null when it cannot be read. Read
   *  only when the board holds no thread (SCN-146 alt path): a restore whose board history did not come back leaves
   *  the journal's messages without their texts, and the screen must not say nothing was ever said. */
  journalMessages?: (estateId: string) => Promise<number | null>
  /** Opens an `https:` link in the browser (`shell.openExternal` in the app). Absent, an artifact link fails rather
   *  than pretending it opened. */
  openExternal?: (url: string) => Promise<void>
}

const failed = (code: CommsReadError['code'], message: string): { ok: false; error: CommsReadError } => ({ ok: false, error: { code, message } })
const unavailable = (message: string) => failed('unavailable', message)

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const asStr = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const asNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
/** A PostgREST error is `{ message, … }`; anything else is described as it is. */
const errorMessage = (error: unknown): string => (isObj(error) && asStr(error.message)) || String(error)

function threadOf(v: unknown): CommsThread | null {
  if (!isObj(v)) return null
  const id = asStr(v.id)
  const createdBy = asStr(v.createdBy)
  const createdSeq = asNum(v.createdSeq)
  const messageCount = asNum(v.messageCount)
  const lastSeq = asNum(v.lastSeq)
  const subject = v.subject
  const lastAt = v.lastAt
  const openRequests = asNum(v.openRequests)
  if (!id || createdBy === null || createdSeq === null || messageCount === null || lastSeq === null) return null
  // The aggregates are REQUIRED (SCN-143's filter slice): a row without them comes from a database the
  // aggregate migration has not reached, and answering with a zero would silently read as "no open
  // requests" — unavailable is the honest answer, never an invented one.
  if (openRequests === null) return null
  if (!Array.isArray(v.kinds)) return null
  const kinds: string[] = []
  for (const k of v.kinds) {
    if (typeof k !== 'string') return null
    kinds.push(k)
  }
  if (!(subject === null || typeof subject === 'string')) return null
  if (!(lastAt === null || lastAt === undefined || typeof lastAt === 'string')) return null
  if (!Array.isArray(v.participants)) return null
  const participants: string[] = []
  for (const p of v.participants) {
    if (typeof p !== 'string') return null
    participants.push(p)
  }
  return { id, subject, participants, createdBy, createdSeq, messageCount, lastSeq, lastAt: lastAt ?? null, kinds, openRequests }
}

function principalOf(v: unknown): CommsPrincipal | null {
  if (!isObj(v)) return null
  const out: CommsPrincipal = {}
  if (typeof v.kind === 'string') out.kind = v.kind
  if (typeof v.id === 'string') out.id = v.id
  if (typeof v.label === 'string') out.label = v.label
  if (typeof v.provenance === 'string') out.provenance = v.provenance
  return out
}

function requestOf(v: unknown): CommsRequest | null {
  if (!isObj(v)) return null
  const id = asStr(v.id)
  const target = asStr(v.target)
  const capability = asStr(v.capability)
  const state = asStr(v.state)
  const effect = asStr(v.effect)
  const revision = asNum(v.revision)
  if (!id || !target || !capability || !state || !effect || revision === null) return null
  return { id, target, capability, state, effect, revision, ...(typeof v.deadline === 'string' ? { deadline: v.deadline } : {}) }
}

function messageOf(v: unknown): CommsMessage | null {
  if (!isObj(v)) return null
  const id = asStr(v.id)
  const thread = asStr(v.thread)
  const kind = asStr(v.kind)
  const at = asStr(v.at)
  const digest = asStr(v.digest)
  if (!id || !thread || !kind || !at || !digest) return null
  if (!isObj(v.sender)) return null
  const project = asStr(v.sender.project)
  if (!project) return null
  const out: CommsMessage = { id, thread, kind, sender: { project, principal: principalOf(v.sender.principal) }, at, digest }
  if (v.body !== undefined) {
    if (!isObj(v.body) || typeof v.body.text !== 'string') return null
    out.body = { text: v.body.text, ...(typeof v.body.format === 'string' ? { format: v.body.format } : {}) }
  }
  if (v.redacted === true) out.redacted = true
  if (typeof v.replyTo === 'string') out.replyTo = v.replyTo
  if (v.request !== undefined) {
    const request = requestOf(v.request)
    if (!request) return null
    out.request = request
  }
  if (Array.isArray(v.artifacts)) out.artifacts = v.artifacts
  return out
}


// #region comms-operator-reads-w4 — docs: docs/adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md#8-what-comms-shows-besides
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)
const strings = (v: unknown): string[] | null => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null)
const optStr = (v: unknown): boolean => v === undefined || typeof v === 'string'

function cursorOf(v: unknown): CommsThreadCursor | null {
  if (!isObj(v) || !isInt(v.lastSeq) || v.lastSeq < 0 || !isUuid(v.id)) return null
  return { lastSeq: v.lastSeq, id: v.id }
}

/** The filter as the board takes it, or null when the board would refuse it (refused here instead). */
function filterOf(v: unknown): CommsThreadFilter | null {
  if (!isObj(v)) return null
  const out: CommsThreadFilter = {}
  for (const [k, x] of Object.entries(v)) {
    if (x === undefined) continue
    if (k === 'project' && isUuid(x)) out.project = x
    else if (k === 'kind' && typeof x === 'string' && (COMMS_KINDS as readonly string[]).includes(x)) out.kind = x as CommsThreadFilter['kind']
    else if (k === 'openOnly' && typeof x === 'boolean') out.openOnly = x
    else if (k === 'activeSince' && typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/.test(x) && !Number.isNaN(Date.parse(x))) out.activeSince = x
    else if (k === 'provider' && typeof x === 'string' && x.length >= 1 && x.length <= 200) out.provider = x
    else return null
  }
  return out
}

function pageThreadOf(v: unknown): CommsPageThread | null {
  const thread = threadOf(v)
  if (!thread || !isObj(v)) return null
  const providers = strings(v.providers)
  return providers ? { ...thread, providers } : null
}

function responderOf(v: unknown): CommsResponder | null {
  if (!isObj(v) || !isUuid(v.project) || typeof v.capability !== 'string' || typeof v.state !== 'string' || !isInt(v.generation)) return null
  for (const k of ['leaseExpiresAt', 'agent', 'cameIn', 'label', 'since', 'releasedCause', 'releasedAt'] as const) if (!optStr(v[k])) return null
  if (v.held !== undefined && typeof v.held !== 'boolean') return null
  return v as unknown as CommsResponder
}

function artifactOf(v: unknown): CommsArtifact | null {
  if (!isObj(v) || typeof v.id !== 'string' || typeof v.contentHash !== 'string' || !optStr(v.label)) return null
  return { id: v.id, contentHash: v.contentHash, ...(typeof v.label === 'string' ? { label: v.label } : {}) }
}

function outcomeOf(v: unknown): CommsOutcome | null {
  if (!isObj(v) || (v.kind !== 'outcome' && v.kind !== 'cancel_reason') || typeof v.at !== 'string' || !optStr(v.summary) || !optStr(v.settledBy)) return null
  if (!Array.isArray(v.evidence)) return null
  const evidence: CommsArtifact[] = []
  for (const a of v.evidence) {
    const artifact = artifactOf(a)
    if (!artifact) return null
    evidence.push(artifact)
  }
  return { kind: v.kind, evidence, at: v.at, ...(typeof v.summary === 'string' ? { summary: v.summary } : {}), ...(typeof v.settledBy === 'string' ? { settledBy: v.settledBy } : {}) }
}

function requestFactsOf(v: unknown): CommsRequestFacts | null {
  if (!isObj(v) || typeof v.attemptLive !== 'boolean' || !Array.isArray(v.outcomes)) return null
  if (v.generation !== undefined && !isInt(v.generation)) return null
  for (const k of ['lastOp', 'lastCause', 'lastAt'] as const) if (!optStr(v[k])) return null
  const outcomes: CommsOutcome[] = []
  for (const o of v.outcomes) {
    const outcome = outcomeOf(o)
    if (!outcome) return null
    outcomes.push(outcome)
  }
  const out: CommsRequestFacts = { attemptLive: v.attemptLive, outcomes }
  if (isInt(v.generation)) out.generation = v.generation
  if (typeof v.lastOp === 'string') out.lastOp = v.lastOp
  if (typeof v.lastCause === 'string') out.lastCause = v.lastCause
  if (typeof v.lastAt === 'string') out.lastAt = v.lastAt
  return out
}

function stepOf(v: unknown): CommsTimelineStep | null {
  if (!isObj(v) || typeof v.op !== 'string' || typeof v.from !== 'string' || typeof v.to !== 'string' || typeof v.at !== 'string') return null
  for (const k of ['effectFrom', 'effectTo', 'cause', 'settledBy'] as const) if (!optStr(v[k])) return null
  if (v.generation !== undefined && !isInt(v.generation)) return null
  return v as unknown as CommsTimelineStep
}

function relatedOf(v: unknown): CommsRelatedThread | null {
  if (!isObj(v) || !isUuid(v.id) || (v.why !== 'same-projects' && v.why !== 'shared-artifact')) return null
  if (!(v.subject === null || typeof v.subject === 'string') || !(v.lastAt === null || v.lastAt === undefined || typeof v.lastAt === 'string')) return null
  const out: CommsRelatedThread = { id: v.id, subject: v.subject, why: v.why, lastAt: v.lastAt ?? null }
  // What opens it when the list does not hold it: optional, and only as the board shaped it.
  if (v.participants !== undefined) { const p = strings(v.participants); if (!p) return null; out.participants = p }
  if (v.createdSeq !== undefined) { if (!isInt(v.createdSeq)) return null; out.createdSeq = v.createdSeq }
  if (v.lastSeq !== undefined) { if (!isInt(v.lastSeq)) return null; out.lastSeq = v.lastSeq }
  return out
}

function hitOf(v: unknown): CommsSearchHit | null {
  if (!isObj(v) || !isUuid(v.message) || !isUuid(v.thread) || !isInt(v.seq) || typeof v.at !== 'string' || !isUuid(v.sender) || typeof v.snippet !== 'string') return null
  const out: CommsSearchHit = { message: v.message, thread: v.thread, seq: v.seq, at: v.at, sender: v.sender, snippet: v.snippet }
  if (v.subject !== undefined) { if (!(v.subject === null || typeof v.subject === 'string')) return null; out.subject = v.subject }
  if (v.participants !== undefined) { const p = strings(v.participants); if (!p) return null; out.participants = p }
  if (v.createdSeq !== undefined) { if (!isInt(v.createdSeq)) return null; out.createdSeq = v.createdSeq }
  return out
}

function pendingOf(v: unknown): CommsPending | null {
  if (!isObj(v) || !isUuid(v.project) || typeof v.oldestAt !== 'string') return null
  for (const k of ['unread', 'findings', 'requests', 'requestsWithAbsentResponder'] as const) if (!isInt(v[k]) || (v[k] as number) < 0) return null
  return v as unknown as CommsPending
}

/** Every item of `v` through `of`, or null when `v` is not a list or any item does not read. */
function every<T>(v: unknown, of: (x: unknown) => T | null): T[] | null {
  if (!Array.isArray(v)) return null
  const out: T[] = []
  for (const x of v) {
    const item = of(x)
    if (item === null) return null
    out.push(item)
  }
  return out
}
// #endregion comms-operator-reads-w4

export function createCommsOperatorRead(deps: CommsOperatorReadDeps) {
  // #region board-core-holds-read-failures — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#board
  /**
   * Why each door last failed, while it is failing (0.3.9 BD-5). A read that answers `unavailable` is recorded in the log
   * Diagnostics reads, with its door and reason: once when it starts failing or its reason changes, never once per tick
   * of the 5 s badge poll; and once more, as recovered, when it answers again. The board's own refusals (not_found,
   * invalid_arguments) are answers, not failures, and are not recorded.
   */
  const failing = new Map<string, string>()
  const noteFailed = (fn: string, reason: string, error?: unknown): void => {
    if (failing.get(fn) === reason) return
    failing.set(fn, reason)
    ops.failed('comms.read-unavailable', error ?? new Error(reason), { door: fn, reason, note: 'the operator read answered unavailable; recorded again only when the reason changes or after it recovers' })
  }
  const noteOk = (fn: string): void => {
    if (!failing.delete(fn)) return
    ops.record({ op: 'comms.read-recovered', outcome: 'ok', detail: { door: fn }, ctx: { correlationId: ops.correlate() } })
  }
  /** `unavailable`, recorded for its door. */
  const down = (fn: string, message: string, error?: unknown) => {
    noteFailed(fn, message, error)
    return unavailable(message)
  }
  // #endregion board-core-holds-read-failures
  /** The door, with a thrown transport read as the same answer as a returned one:
   *  unavailable. `supabase-js` reports failures in `error`, but the door is a seam —
   *  a throw crossing it must not become an IPC rejection the screen has to guess at.
   *  WHY the board went quiet is recorded by `down`, once per change (0.3.9 BD-5). */
  const call = async (fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> => {
    try {
      return await deps.rpc(fn, args)
    } catch (e) {
      // Not silence: the caller is told unavailable, and `down` records why, once per change of reason.
      return { data: null, error: e instanceof Error ? e : new Error(String(e)) }
    }
  }
  /** One wave-4 read: the door's transport error and a payload that is not an object are `unavailable`; the board's
   *  refusal travels with its code; anything else is `body`'s to read, and null from it is `unavailable` too. */
  const answer = async <T,>(fn: string, args: Record<string, unknown>, what: string, body: (data: Record<string, unknown>) => T | null): Promise<T | { ok: false; error: CommsReadError }> => {
    const { data, error } = await call(fn, args)
    if (error) return down(fn, errorMessage(error), error)
    if (!isObj(data)) return down(fn, `the board answered with something that is not ${what}`)
    if (isObj(data.error)) {
      const code = asStr(data.error.code)
      const message = asStr(data.error.message) ?? 'the board refused the read'
      if (code === 'not_found' || code === 'invalid_arguments') { noteOk(fn); return failed(code, message) }
      return down(fn, message)
    }
    if (data.ok !== true) return down(fn, `the board answered with something that is not ${what}`)
    const out = body(data)
    if (out === null) return down(fn, `the board answered ${what} in a shape this build cannot read`)
    noteOk(fn)
    return out
  }
  const refused = (message: string) => failed('invalid_arguments', message)
  return {
    /** Every thread of the estate, oldest first. */
    async threads(estateId: string): Promise<CommsThreadsReply> {
      const door = 'board_threads_operator'
      const { data, error } = await call(door, { p_estate_id: estateId })
      if (error) return down(door, errorMessage(error), error)
      if (!isObj(data)) return down(door, 'the board answered with something that is not a thread list')
      if (isObj(data.error)) {
        const code = asStr(data.error.code)
        const message = asStr(data.error.message) ?? 'the board refused the read'
        if (code === 'invalid_arguments' || code === 'not_found') return failed(code, message)
        return down(door, message)
      }
      if (data.ok !== true || !Array.isArray(data.threads)) return down(door, 'the board answered with something that is not a thread list')
      const threads: CommsThread[] = []
      for (const row of data.threads) {
        const thread = threadOf(row)
        if (!thread) return down(door, 'the board answered with a thread row in a shape this build cannot read')
        threads.push(thread)
      }
      noteOk(door)
      if (threads.length === 0 && deps.journalMessages) {
        // Best effort: an unreadable count leaves the board's own answer standing, and is logged.
        try {
          const n = await deps.journalMessages(estateId)
          if (typeof n === 'number' && Number.isSafeInteger(n) && n > 0) return { ok: true, threads, textsMissing: n }
        } catch (e) {
          ops.failed('comms.journal-count', e, { note: 'the journal\'s message count could not be read; Comms shows the board\'s empty answer' })
        }
      }
      return { ok: true, threads }
    },

    // #region comms-operator-reads-w4 — docs: docs/adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md#8-what-comms-shows-besides
    /** One bounded page of threads, newest activity first, filtered by the board (SCN-143's wave-4 amendment). The first
     *  unfiltered page of an empty board says when the journal holds messages whose texts did not come back (SCN-146). */
    async threadPage(estateId: string, filter: unknown, before: unknown, limit = 50): Promise<CommsThreadPageReply> {
      const f = filterOf(filter)
      if (!f) return refused('The thread filter is not one the board takes.')
      const cursor = before === null || before === undefined ? null : cursorOf(before)
      if (before !== null && before !== undefined && !cursor) return refused('The page cursor is not valid.')
      const bounded = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.floor(limit))) : 50
      const reply = await answer('board_thread_page_operator', { p_estate: estateId, p_filter: f, p_before: cursor, p_limit: bounded }, 'a thread page', (d) => {
        const threads = every(d.threads, pageThreadOf)
        if (!threads || typeof d.more !== 'boolean') return null
        const next = d.before === null || d.before === undefined ? null : cursorOf(d.before)
        if (d.before !== null && d.before !== undefined && !next) return null
        return { ok: true as const, threads, more: d.more, before: next }
      })
      if (reply.ok && reply.threads.length === 0 && cursor === null && Object.keys(f).length === 0 && deps.journalMessages) {
        try {
          const n = await deps.journalMessages(estateId)
          if (typeof n === 'number' && Number.isSafeInteger(n) && n > 0) return { ...reply, textsMissing: n }
        } catch (e) {
          ops.failed('comms.journal-count', e, { note: 'the journal\'s message count could not be read; Comms shows the board\'s empty answer' })
        }
      }
      return reply
    },

    /** Each thread's id and last seq, newest first, capped by the board (the rail's count, "mark all read"). */
    async heads(estateId: string): Promise<CommsHeadsReply> {
      return answer('board_thread_heads_operator', { p_estate: estateId, p_limit: COMMS_THREAD_HEADS_LIMIT }, 'the thread heads', (d) => {
        const heads = every(d.heads, (h): CommsHead | null => (isObj(h) && isUuid(h.id) && isInt(h.lastSeq) ? { id: h.id, lastSeq: h.lastSeq } : null))
        return heads && typeof d.truncated === 'boolean' ? { ok: true as const, heads, truncated: d.truncated } : null
      })
    },

    /** Who answers each (project, capability) now (SCN-147 step 1). */
    async responders(estateId: string): Promise<CommsRespondersReply> {
      return answer('board_responders_operator', { p_estate: estateId }, 'the responders', (d) => {
        const responders = every(d.responders, responderOf)
        return responders ? { ok: true as const, responders } : null
      })
    },

    /** Read marks for at most 100 messages, and for the requests among them what they ended with (SCN-147 steps 2–4). */
    async facts(estateId: string, messages: unknown): Promise<CommsFactsReply> {
      if (!Array.isArray(messages) || messages.length > 100 || !messages.every(isUuid)) return refused('Ask for the facts of at most 100 messages.')
      return answer('board_message_facts_operator', { p_estate: estateId, p_messages: messages }, 'message facts', (d) => {
        if (!isObj(d.messages) || !isObj(d.requests)) return null
        const out: { ok: true; messages: Record<string, { readBy: string[] }>; requests: Record<string, CommsRequestFacts> } = { ok: true, messages: {}, requests: {} }
        for (const [id, m] of Object.entries(d.messages)) {
          const readBy = isObj(m) ? strings(m.readBy) : null
          if (!isUuid(id) || !readBy) return null
          out.messages[id] = { readBy }
        }
        for (const [id, r] of Object.entries(d.requests)) {
          const facts = requestFactsOf(r)
          if (!isUuid(id) || !facts) return null
          out.requests[id] = facts
        }
        return out
      })
    },

    /** A request's transitions from the journal, oldest first (SCN-147 step 7). */
    async timeline(estateId: string, requestId: unknown): Promise<CommsTimelineReply> {
      if (!isUuid(requestId)) return refused('Name the request.')
      return answer('board_request_timeline_operator', { p_estate: estateId, p_request: requestId }, 'a request timeline', (d) => {
        const steps = every(d.steps, stepOf)
        return steps && typeof d.more === 'boolean' ? { ok: true as const, steps, more: d.more } : null
      })
    },

    /** Threads between the same projects, or carrying the same stated file (SCN-147 step 7). */
    async related(estateId: string, threadId: unknown): Promise<CommsRelatedReply> {
      if (!isUuid(threadId)) return refused('Name the thread.')
      return answer('board_related_threads_operator', { p_estate: estateId, p_thread: threadId }, 'related threads', (d) => {
        const threads = every(d.threads, relatedOf)
        return threads && typeof d.more === 'boolean' ? { ok: true as const, threads, more: d.more } : null
      })
    },

    /** History search, newest first (SCN-156). The words go to the board as typed; the board searches them as themselves. */
    async search(estateId: string, query: unknown, before: unknown): Promise<CommsSearchReply> {
      if (typeof query !== 'string' || [...query].length < 2 || [...query].length > 200) return refused('Search for 2 to 200 characters.')
      if (before !== null && before !== undefined && !(isInt(before) && before >= 1)) return refused('The search cursor is not valid.')
      return answer('board_search_operator', { p_estate: estateId, p_query: query, p_before_seq: before ?? null, p_limit: 50 }, 'search results', (d) => {
        const hits = every(d.hits, hitOf)
        if (!hits || typeof d.more !== 'boolean' || typeof d.stoppedEarly !== 'boolean') return null
        const next = d.before === null || d.before === undefined ? null : isInt(d.before) ? d.before : undefined
        return next === undefined ? null : { ok: true as const, hits, more: d.more, stoppedEarly: d.stoppedEarly, before: next }
      })
    },

    // #region board-core-holds-waiting — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#board
    /** What waits for the operator outside Comms (0.3.9 BD-2): requests nobody can answer, with the oldest. A count
     *  above zero always comes with its oldest time; anything else is unavailable. The unread-deliveries half the
     *  database also answers is read past, not carried (review i1 UX-1, DA-8: one copy per recipient project, a standing
     *  number nobody can lower); a later database that drops it reads the same. */
    async waiting(estateId: string): Promise<CommsWaitingReply> {
      return answer('board_waiting_operator', { p_estate: estateId }, 'what waits on the board', (d) => {
        const requests = isInt(d.requests) && d.requests >= 0 ? d.requests : null
        if (requests === null || !optStr(d.oldestRequestAt)) return null
        if ((requests > 0) !== (typeof d.oldestRequestAt === 'string')) return null
        return { ok: true as const, requests, ...(typeof d.oldestRequestAt === 'string' ? { oldestRequestAt: d.oldestRequestAt } : {}) }
      })
    },
    // #endregion board-core-holds-waiting

    /** What waits for each project: delivered, held and not read (SCN-157, COM-05). */
    async pending(estateId: string): Promise<CommsPendingReply> {
      return answer('board_pending_operator', { p_estate: estateId, p_limit: 100 }, 'what waits', (d) => {
        const projects = every(d.projects, pendingOf)
        return projects && typeof d.more === 'boolean' ? { ok: true as const, projects, more: d.more } : null
      })
    },

    /** `comms:open-artifact` (SCN-147 step 5): an artifact's link opens in the browser only when it is `https:`; any
     *  other scheme — `javascript:`, `file:`, `data:`, `http:` — is refused and never handed to the system. */
    async openArtifact(url: unknown): Promise<CommsOpenArtifactReply> {
      let parsed: URL | null = null
      try {
        parsed = typeof url === 'string' ? new URL(url) : null
      } catch {
        // A link that does not parse is no https: link: it is refused just below, and that refusal is recorded.
        parsed = null
      }
      if (!parsed || parsed.protocol !== 'https:') {
        ops.record({ op: 'comms.artifact-refused', outcome: 'ok', level: 'warn', detail: { scheme: typeof url === 'string' ? url.split(':')[0].slice(0, 20) : typeof url }, ctx: { correlationId: ops.correlate() } })
        return { ok: false, reason: 'refused' }
      }
      if (!deps.openExternal) return { ok: false, reason: 'failed' }
      try {
        await deps.openExternal(parsed.href)
        return { ok: true }
      } catch (e) {
        ops.failed('comms.artifact-open', e, { note: 'the browser did not take the artifact link' })
        return { ok: false, reason: 'failed' }
      }
    },
    // #endregion comms-operator-reads-w4

    /** One page of a thread (or of the estate when threadId is null), after `afterSeq`,
     *  oldest first — the board's own paging contract, so the screen's cursor logic is
     *  the board's (SCN-143 step 5). */
    async list(estateId: string, threadId: string | null, afterSeq: number, limit = 50): Promise<CommsPageReply> {
      if (!Number.isSafeInteger(afterSeq) || afterSeq < 0) return failed('invalid_arguments', 'The page request is not valid.')
      if (threadId !== null && !threadId) return failed('invalid_arguments', 'The page request is not valid.')
      const bounded = Math.max(1, Math.min(100, Math.floor(limit)))
      const door = 'board_list_operator'
      const { data, error } = await call(door, {
        p_estate_id: estateId,
        p_thread: threadId,
        p_after_seq: afterSeq,
        p_limit: bounded
      })
      if (error) return down(door, errorMessage(error), error)
      if (!isObj(data)) return down(door, 'the board answered with something that is not a page')
      if (isObj(data.error)) {
        const code = asStr(data.error.code)
        const message = asStr(data.error.message) ?? 'the board refused the read'
        if (code === 'not_found' || code === 'invalid_arguments') return failed(code, message)
        return down(door, message)
      }
      if (data.ok !== true || !Array.isArray(data.messages)) return down(door, 'the board answered with something that is not a page')
      const lastSeq = asNum(data.last_seq)
      if (lastSeq === null) return down(door, 'the board answered with a page that carries no cursor')
      const messages: CommsMessage[] = []
      for (const row of data.messages) {
        const message = messageOf(row)
        if (!message) return down(door, 'the board answered with a message in a shape this build cannot read')
        messages.push(message)
      }
      noteOk(door)
      return { ok: true, messages, lastSeq, more: data.more === true }
    }
  }
}
// #endregion comms-screen
