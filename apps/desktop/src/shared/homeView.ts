// What the launch home (SCR-30/SCR-01) reads out of the journal the window already holds:
// the rhythm of work over 28 days, where the operator left off, and what the agents did.
//
// All three are computed from the displayed feed and nothing else, so the home cannot
// disagree with the history it links to. The feed keeps only the newest FEED_WINDOW
// events, and that bound is said rather than hidden: a day the window may have cut off is
// UNKNOWN, never a zero.

export const FEED_WINDOW = 500
export const RHYTHM_DAYS = 28

interface Ev { seq: number; type: string; actor: { kind: string; id: string }; project_id: string | null; occurred_at: string; payload?: Record<string, unknown> }

export interface RhythmDay { date: string; count: number; known: boolean }

const localDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** One entry per local day, oldest first, ending today. */
export function rhythmDays(events: readonly Ev[] | null, now: Date, days = RHYTHM_DAYS): RhythmDay[] {
  const counts = new Map<string, number>()
  for (const e of events ?? []) {
    const d = localDate(new Date(e.occurred_at))
    counts.set(d, (counts.get(d) ?? 0) + 1)
  }
  // Full window: history older than its oldest event may exist and is not held.
  const cut = events && events.length >= FEED_WINDOW
    ? localDate(new Date(Math.min(...events.map((e) => Date.parse(e.occurred_at)))))
    : null
  const out: RhythmDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const date = localDate(d)
    const known = events !== null && (cut === null || date > cut)
    out.push({ date, count: known ? (counts.get(date) ?? 0) : 0, known })
  }
  return out
}

const DECISIONS = new Set(['question.answered@1', 'proposal.decided@1', 'policy.decided@1'])
const RESULTS = new Set(['task.finished@1', 'delivery.accepted@1'])
/** A task moved to done is a result too: that move is how the board closes one. */
const isResult = (e: Ev): boolean => RESULTS.has(e.type) || (e.type === 'task.moved@1' && e.payload?.to === 'done')

/** Decisions and results inside the rhythm's days, and every event there. */
export function rhythmTotals(events: readonly Ev[] | null, now: Date, days = RHYTHM_DAYS): { decisions: number; results: number; events: number } {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)).getTime()
  const inside = (events ?? []).filter((e) => Date.parse(e.occurred_at) >= from)
  return {
    decisions: inside.filter((e) => DECISIONS.has(e.type)).length,
    results: inside.filter(isResult).length,
    events: inside.length
  }
}

export interface ResumePoint { projectId: string; type: string; seq: number; occurredAt: string; unread: number }

/** The project of the newest event that names one, and how many of its events are past the read position. */
export function resumePoint(events: readonly Ev[] | null, readThroughSeq: number): ResumePoint | null {
  if (!events) return null
  let last: Ev | null = null
  for (const e of events) if (e.project_id && (!last || e.seq > last.seq)) last = e
  if (!last || !last.project_id) return null
  const projectId = last.project_id
  return {
    projectId, type: last.type, seq: last.seq, occurredAt: last.occurred_at,
    unread: events.filter((e) => e.project_id === projectId && e.seq > readThroughSeq).length
  }
}

export interface LiveRow { seq: number; type: string; sessionId: string; projectId: string | null; occurredAt: string }

/** Agent events, newest first. Null while the journal is unread. */
export function liveRows(events: readonly Ev[] | null, limit: number): LiveRow[] | null {
  if (!events) return null
  return events.filter((e) => e.actor.kind === 'agent').sort((a, b) => b.seq - a.seq).slice(0, limit)
    .map((e) => ({ seq: e.seq, type: e.type, sessionId: e.actor.id, projectId: e.project_id, occurredAt: e.occurred_at }))
}

/** Whether the newest agent action is recent enough to call the feed live (ten minutes). */
export function liveIsFresh(rows: readonly LiveRow[] | null, now: Date): boolean {
  return !!rows && rows.length > 0 && now.getTime() - Date.parse(rows[0].occurredAt) < 10 * 60_000
}

/** What an event counts as on the rhythm (SCR-42): a decision, a result, or neither. */
export function eventKind(e: Ev): 'decision' | 'result' | 'other' {
  return DECISIONS.has(e.type) ? 'decision' : isResult(e) ? 'result' : 'other'
}

/** One local day's events, newest first, optionally only decisions or results. */
export function eventsOfDay<T extends Ev>(events: readonly T[] | null, date: string, kind: 'all' | 'decision' | 'result' = 'all'): T[] {
  return (events ?? [])
    .filter((e) => localDate(new Date(e.occurred_at)) === date && (kind === 'all' || eventKind(e) === kind))
    .sort((a, b) => b.seq - a.seq)
}
