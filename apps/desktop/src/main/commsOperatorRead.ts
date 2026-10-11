// #region comms-screen — docs: docs/ux/screens.md#scr-77-project-comms
/**
 * The operator's read path onto the project board (SCR-77, SCN-137), between the Comms
 * screen's IPC handlers and migration 80's two security-definer functions
 * (`board_threads_operator`, `board_list_operator`,
 * `supabase/migrations/20261011000084_project_board_operator_read.sql`).
 *
 * Two rules, both from the scenario:
 *
 * - UNAVAILABLE IS NOT EMPTY. A PostgREST error, a missing function (the migration not
 *   applied) or a payload that is not the shape the migration promises all answer
 *   `unavailable` — an empty list is something only the board itself may say (SCN-137
 *   Alt paths: "it NEVER shows an empty list in that case").
 * - THE BOARD'S REFUSALS TRAVEL AS THEY ARE. `not_found` (a thread outside this estate)
 *   and `invalid_arguments` keep their codes and messages; they are the board's answer,
 *   not a transport failure.
 *
 * The shapes are checked field by field rather than cast: what crosses here is jsonb
 * from SQL, and a blind `as CommsMessage[]` is how a changed migration would render
 * undefined on screen as if it were data.
 */

import type {
  CommsMessage,
  CommsPageReply,
  CommsPrincipal,
  CommsReadError,
  CommsRequest,
  CommsThread,
  CommsThreadsReply
} from '../shared/commsRead.ts'
import { ops } from './opsSink.ts'

/** The SQL door: `db.rpc` in the app, a fake in tests (the same seam as boardService's). */
export type CommsRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>

export interface CommsOperatorReadDeps {
  rpc: CommsRpc
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
  if (!id || createdBy === null || createdSeq === null || messageCount === null || lastSeq === null) return null
  if (!(subject === null || typeof subject === 'string')) return null
  if (!(lastAt === null || lastAt === undefined || typeof lastAt === 'string')) return null
  if (!Array.isArray(v.participants)) return null
  const participants: string[] = []
  for (const p of v.participants) {
    if (typeof p !== 'string') return null
    participants.push(p)
  }
  return { id, subject, participants, createdBy, createdSeq, messageCount, lastSeq, lastAt: lastAt ?? null }
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

export function createCommsOperatorRead(deps: CommsOperatorReadDeps) {
  /** The door, with a thrown transport read as the same answer as a returned one:
   *  unavailable. `supabase-js` reports failures in `error`, but the door is a seam —
   *  a throw crossing it must not become an IPC rejection the screen has to guess at. */
  const call = async (fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> => {
    try {
      return await deps.rpc(fn, args)
    } catch (e) {
      // The caller is told `unavailable`; the record of WHY the board went quiet
      // belongs here, in the log Diagnostics reads — not only on a screen.
      ops.failed('comms.rpc-threw', e, { note: `the board read ${fn} could not be reached; the caller was told unavailable` })
      return { data: null, error: e }
    }
  }
  return {
    /** Every thread of the estate, oldest first. */
    async threads(estateId: string): Promise<CommsThreadsReply> {
      const { data, error } = await call('board_threads_operator', { p_estate_id: estateId })
      if (error) return unavailable(errorMessage(error))
      if (!isObj(data)) return unavailable('the board answered with something that is not a thread list')
      if (isObj(data.error)) {
        const code = asStr(data.error.code)
        const message = asStr(data.error.message) ?? 'the board refused the read'
        return failed(code === 'invalid_arguments' ? 'invalid_arguments' : code === 'not_found' ? 'not_found' : 'unavailable', message)
      }
      if (data.ok !== true || !Array.isArray(data.threads)) return unavailable('the board answered with something that is not a thread list')
      const threads: CommsThread[] = []
      for (const row of data.threads) {
        const thread = threadOf(row)
        if (!thread) return unavailable('the board answered with a thread row in a shape this build cannot read')
        threads.push(thread)
      }
      return { ok: true, threads }
    },

    /** One page of a thread (or of the estate when threadId is null), after `afterSeq`,
     *  oldest first — the board's own paging contract, so the screen's cursor logic is
     *  the board's (SCN-137 step 5). */
    async list(estateId: string, threadId: string | null, afterSeq: number, limit = 50): Promise<CommsPageReply> {
      if (!Number.isSafeInteger(afterSeq) || afterSeq < 0) return failed('invalid_arguments', 'The page request is not valid.')
      if (threadId !== null && !threadId) return failed('invalid_arguments', 'The page request is not valid.')
      const bounded = Math.max(1, Math.min(100, Math.floor(limit)))
      const { data, error } = await call('board_list_operator', {
        p_estate_id: estateId,
        p_thread: threadId,
        p_after_seq: afterSeq,
        p_limit: bounded
      })
      if (error) return unavailable(errorMessage(error))
      if (!isObj(data)) return unavailable('the board answered with something that is not a page')
      if (isObj(data.error)) {
        const code = asStr(data.error.code)
        const message = asStr(data.error.message) ?? 'the board refused the read'
        return failed(code === 'not_found' ? 'not_found' : code === 'invalid_arguments' ? 'invalid_arguments' : 'unavailable', message)
      }
      if (data.ok !== true || !Array.isArray(data.messages)) return unavailable('the board answered with something that is not a page')
      const lastSeq = asNum(data.last_seq)
      if (lastSeq === null) return unavailable('the board answered with a page that carries no cursor')
      const messages: CommsMessage[] = []
      for (const row of data.messages) {
        const message = messageOf(row)
        if (!message) return unavailable('the board answered with a message in a shape this build cannot read')
        messages.push(message)
      }
      return { ok: true, messages, lastSeq, more: data.more === true }
    }
  }
}
// #endregion comms-screen
