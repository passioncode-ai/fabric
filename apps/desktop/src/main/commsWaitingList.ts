// #region comms-waiting-list-read — docs: docs/reports/2026-10-27-mockup-parity/gaps/2026-10-27-home.md#d-data-bugs-wrong-numbers-order-or-missing-fields
/**
 * The reads behind the waiting requests' list (`shared/commsWaitingList.ts`; home gap D11), done only when the board's
 * count says something waits: the requests submitted in the last `WINDOW_DAYS` (newest first, at most the gateway's
 * 1 000 rows), their transitions (by request id, served by `board_transitions_by_request`), the responder slots, and the
 * subjects of the threads with open requests. Any read that fails leaves the reply as the board gave it (the count
 * alone) and is logged; the count is never touched.
 */
import type { CommsRespondersReply, CommsThreadPageReply, CommsWaitingItem, CommsWaitingReply } from '../shared/commsRead.ts'
import { composeWaitingList, type SubmittedRow, type TransitionRow } from '../shared/commsWaitingList.ts'
import { GATEWAY_ROWS } from './homeStrip.ts'
import { ops } from './opsSink.ts'

/** How far back requests are read: past the board's default seven-day deadline, with room for a longer one. */
export const WINDOW_DAYS = 30

type Rows = { rows: Array<Record<string, unknown>>; failed: string | null }
interface SubmittedQuery {
  eq(c: string, v: string): SubmittedQuery
  gte(c: string, v: string): SubmittedQuery
  order(c: string, o: { ascending: boolean }): SubmittedQuery
  limit(n: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
}
export interface WaitingListDeps {
  store: {
    select(table: string, columns: string): unknown
    selectIn(table: string, columns: string, key: string, values: string[], chunk?: number, signal?: AbortSignal, eq?: ReadonlyArray<readonly [string, string]>): Promise<Rows>
  }
  responders(): Promise<CommsRespondersReply>
  threads(): Promise<CommsThreadPageReply>
  now(): number
}

export async function withWaitingList(reply: CommsWaitingReply, deps: WaitingListDeps): Promise<CommsWaitingReply> {
  if (!reply.ok) return reply
  if (reply.requests === 0) return { ...reply, list: [], listComplete: true }
  try {
    const since = new Date(deps.now() - WINDOW_DAYS * 24 * 3600_000).toISOString()
    const q = deps.store.select('journal', 'occurred_at,payload') as SubmittedQuery
    const [submittedRead, responders, threads] = await Promise.all([
      q.eq('type', 'comms.message_submitted@1').eq('payload->>kind', 'request').gte('occurred_at', since).order('seq', { ascending: false }).limit(GATEWAY_ROWS),
      deps.responders(),
      // The subjects are a nicety (below): a thread page that rejects drops them, never the list (the 0.3.15 review,
      // iteration 3, ER-15); not silent, the requests then carry their own subjects.
      Promise.resolve(deps.threads()).catch(() => ({ ok: false }) as unknown as Awaited<ReturnType<typeof deps.threads>>)
    ])
    if (submittedRead.error) throw new Error(`the requests could not be read: ${submittedRead.error.message}`)
    if (!responders.ok) throw new Error(`the responders could not be read: ${responders.error.message}`)
    const submitted = (submittedRead.data ?? []) as SubmittedRow[]
    const ids = submitted.map((s) => s.payload?.message_id).filter((x): x is string => typeof x === 'string')
    const transitions = await deps.store.selectIn('journal', 'seq,occurred_at,payload', 'payload->>request_id', ids, 100, undefined, [['type', 'comms.request_transitioned@1']])
    if (transitions.failed) throw new Error(`the requests' transitions could not be read: ${transitions.failed}`)
    // Subjects are a nicety: a thread page that does not answer leaves the subjects the requests themselves carry.
    const subjects = new Map<string, string | null>(threads.ok ? threads.threads.map((t) => [t.id, t.subject]) : [])
    const { list, listComplete } = composeWaitingList({
      count: reply.requests, submitted, submittedCapped: submitted.length >= GATEWAY_ROWS,
      transitions: transitions.rows as unknown as TransitionRow[], responders: responders.responders, subjects
    })
    return { ...reply, list, listComplete }
  } catch (e) {
    ops.failed('comms.waiting-list-unread', e, { note: 'the home shows the count of waiting requests without the list' })
    return reply
  }
}

/** How long a composed list is answered again while the board's count is unchanged (CO-477, the 0.3.15 review's ER-10). */
export const LIST_MIN_INTERVAL_MS = 15_000

/**
 * The home's reading, coalesced as the rhythm reader is (`workRhythm.ts#createRhythmReader`): one reading at a time,
 * callers meanwhile share it; the board's count is read on every reading, and the list (a thousand journal rows, a
 * thread page and the transitions) is read again only when the count or its oldest request changed, or the last list
 * is `LIST_MIN_INTERVAL_MS` old. Every `comms` event asked for the whole list before (CO-477). A list that could not be
 * read is never kept.
 */
export function createWaitingReader(count: () => Promise<CommsWaitingReply>, deps: WaitingListDeps, opts: { minIntervalMs?: number } = {}) {
  const minInterval = opts.minIntervalMs ?? LIST_MIN_INTERVAL_MS
  let last: { at: number; requests: number; oldest: string | null; list: CommsWaitingItem[]; listComplete: boolean } | null = null
  let flight: Promise<CommsWaitingReply> | null = null
  const readNow = async (): Promise<CommsWaitingReply> => {
    const reply = await count()
    if (!reply.ok) return reply
    const now = deps.now()
    const oldest = reply.oldestRequestAt ?? null
    if (last && last.requests === reply.requests && last.oldest === oldest && now - last.at >= 0 && now - last.at < minInterval) {
      return { ...reply, list: last.list, listComplete: last.listComplete }
    }
    const full = await withWaitingList(reply, deps)
    if (full.ok && full.list) last = { at: now, requests: reply.requests, oldest, list: full.list, listComplete: full.listComplete ?? false }
    return full
  }
  return {
    read(): Promise<CommsWaitingReply> {
      if (flight) return flight
      flight = readNow().finally(() => { flight = null })
      return flight
    }
  }
}
// #endregion comms-waiting-list-read
