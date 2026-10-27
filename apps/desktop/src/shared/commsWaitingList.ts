// #region comms-waiting-list — docs: docs/reports/2026-10-27-mockup-parity/gaps/home.md#d-data-bugs-wrong-numbers-order-or-missing-fields
/**
 * The board's waiting requests as a list (the mockup parity, 2026-10-27, home gap D11): «Fabric → Dashboards: «…»» with
 * how long it waits, beside the count `board_waiting_operator` gives. Composed without a new database function from
 * what is already readable: the requests submitted (`comms.message_submitted@1` with a `request`), their newest
 * transition (`comms.request_transitioned@1`; a request id is its message id), the live responder slots, and the threads'
 * subjects. A request is open by the board's own rule (`board_request_open`: not completed, failed_known, cancelled,
 * expired or answered) and waits when no ACTIVE responder holds its (project, capability). The board also counts a
 * capability a project lists as answered; that list is not readable here, so when the candidates outnumber the count the
 * list is said incomplete (`listComplete: false`), never trimmed by a guess.
 *
 * Pure: main reads the rows (`main/commsWaitingList.ts`).
 */
import { COMMS_WAITING_LIST_LIMIT, type CommsResponder, type CommsWaitingItem } from './commsRead.ts'

/** The board's terminal request states (`board_request_open`, migration 120). */
export const TERMINAL_REQUEST_STATES: readonly string[] = ['completed', 'failed_known', 'cancelled', 'expired', 'answered']

export interface SubmittedRow { occurred_at: string; payload: Record<string, unknown> | null }
export interface TransitionRow { seq?: number; occurred_at?: string; payload: Record<string, unknown> | null }

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

export function composeWaitingList(input: {
  count: number
  submitted: readonly SubmittedRow[]
  /** The submitted read stopped at its bound: older requests may be missing. */
  submittedCapped: boolean
  transitions: readonly TransitionRow[]
  responders: readonly CommsResponder[]
  /** Thread subjects by thread id, where the board gave one. */
  subjects: ReadonlyMap<string, string | null>
  limit?: number
}): { list: CommsWaitingItem[]; listComplete: boolean } {
  const latest = new Map<string, { key: number; to: string }>()
  input.transitions.forEach((t, i) => {
    const p = t.payload ?? {}
    const id = str(p.request_id)
    const to = str(p.to)
    if (!id || !to) return
    const key = typeof t.seq === 'number' ? t.seq : t.occurred_at ? Date.parse(t.occurred_at) : i
    const prev = latest.get(id)
    if (!prev || prev.key < key) latest.set(id, { key, to })
  })
  const live = new Set(input.responders.filter((r) => r.state === 'active').map((r) => `${r.project}|${r.capability}`))
  const candidates: CommsWaitingItem[] = []
  for (const s of input.submitted) {
    const p = s.payload ?? {}
    const req = (p.request ?? null) as Record<string, unknown> | null
    const id = str(p.message_id)
    const thread = str(p.thread_id)
    const to = str(req?.target_project_id)
    const capability = str(req?.capability)
    if (!req || !id || !thread || !to || !capability) continue
    const state = latest.get(id)?.to
    if (state && TERMINAL_REQUEST_STATES.includes(state)) continue
    if (live.has(`${to}|${capability}`)) continue
    const newSubject = str((p.thread_new as Record<string, unknown> | null | undefined)?.subject)
    candidates.push({ requestId: id, threadId: thread, from: str(p.sender_project_id), to, capability, subject: input.subjects.get(thread) ?? newSubject, at: s.occurred_at })
  }
  candidates.sort((a, b) => a.at.localeCompare(b.at) || a.requestId.localeCompare(b.requestId))
  return {
    list: candidates.slice(0, input.limit ?? COMMS_WAITING_LIST_LIMIT),
    listComplete: !input.submittedCapped && candidates.length === input.count
  }
}
// #endregion comms-waiting-list
