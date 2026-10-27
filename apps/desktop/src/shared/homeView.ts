// What the launch home (SCR-30/SCR-01) reads out of the journal the window already holds:
// the rhythm of work over 28 days, where the operator left off, and what the agents did.
//
// All three are computed from the displayed feed and nothing else, so the home cannot
// disagree with the history it links to. The feed keeps only the newest FEED_WINDOW
// events, and that bound is said rather than hidden: a day the window may have cut off is
// UNKNOWN, never a zero. Главная's chart itself reads its own per-day counts from main (`work.rhythm`,
// `workRhythm.ts`); Пульс still reads the feed, by the same definitions of a result and a decision.

import { handedInTask, isHandedIn, isPersonDecision } from './workRhythm.ts'

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

// One definition of a decision and a result for every screen (the mockup parity, home gap D2): `workRhythm.ts` owns
// it, and «Ритм работы» on Главная, the strip's «сдано сегодня» and Пульс all count by it. A RESULT is a task handed in
// (moved to review, or closed as done), each task once a day; a DECISION is the person's own (an answer, a proposal, an
// access request or a policy decided by the person), never the same event written by an agent or by Fabric itself.
const isResult = (e: Ev): boolean => isHandedIn({ type: e.type, occurred_at: e.occurred_at, payload: e.payload ?? null })
const isDecision = (e: Ev): boolean => isPersonDecision({ type: e.type, occurred_at: e.occurred_at, actor: e.actor, payload: e.payload ?? null })

/** Decisions and results inside the rhythm's days, and every event there. A task handed in twice on one day is one
 *  result, as «Ритм работы» counts it. */
export function rhythmTotals(events: readonly Ev[] | null, now: Date, days = RHYTHM_DAYS): { decisions: number; results: number; events: number } {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)).getTime()
  const inside = (events ?? []).filter((e) => Date.parse(e.occurred_at) >= from)
  const results = new Set<string>()
  for (const e of inside) {
    const task = handedInTask({ type: e.type, occurred_at: e.occurred_at, payload: e.payload ?? null })
    if (task) results.add(`${localDate(new Date(e.occurred_at))}|${task}`)
  }
  return {
    decisions: inside.filter(isDecision).length,
    results: results.size,
    events: inside.length
  }
}

export interface ResumePoint { projectId: string; type: string; seq: number; occurredAt: string; unread: number }

/** The project of the person's newest event that names one, and how many of its events (anyone's) are past the read
 *  position. Only the person's own acts decide where they stopped (OF-07, the operator, 2026-10-19): with agents' events
 *  counted too, «where you stopped» jumped to whichever project an agent last touched. */
export function resumePoint(events: readonly Ev[] | null, readThroughSeq: number): ResumePoint | null {
  if (!events) return null
  let last: Ev | null = null
  for (const e of events) if (e.project_id && e.actor.kind === 'person' && (!last || e.seq > last.seq)) last = e
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
  return isDecision(e) ? 'decision' : isResult(e) ? 'result' : 'other'
}

/** One local day's events, newest first, optionally only decisions or results. */
export function eventsOfDay<T extends Ev>(events: readonly T[] | null, date: string, kind: 'all' | 'decision' | 'result' = 'all'): T[] {
  return (events ?? [])
    .filter((e) => localDate(new Date(e.occurred_at)) === date && (kind === 'all' || eventKind(e) === kind))
    .sort((a, b) => b.seq - a.seq)
}

/** The part of the day Главная greets by (SCN-163 step 1): morning 5–11, day 12–16, evening 17–22, night otherwise. */
export function dayPart(now: Date): 'morning' | 'day' | 'evening' | 'night' {
  const h = now.getHours()
  return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'day' : h >= 17 && h < 23 ? 'evening' : 'night'
}
