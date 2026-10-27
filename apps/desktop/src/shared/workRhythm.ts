// #region work-rhythm — docs: docs/reports/2026-10-27-mockup-parity/gaps/2026-10-27-home.md#d-data-bugs-wrong-numbers-order-or-missing-fields
/**
 * «Ритм работы» over 28 local days, and the one definition of its two totals (the mockup parity, 2026-10-27, home gaps
 * D1 and D2). The chart counted the renderer's newest 500 events, under two hours of this journal, so every day read as
 * unknown; the totals counted `task.finished@1` and moves to `done`, which no task reaches, while the strip counted tasks
 * handed in. Here:
 *
 * - A day's WORK is every journal event of that local day except the machine's own ticks (`MACHINE_TICKS`: the cycle's
 *   pass, the sweep's receipt, a claim renewed by a session's keep-alive, the board's retention). The main process reads
 *   the count of each day (`main/workRhythm.ts`); a day it could not read stays unknown (`null`), a read day with no
 *   work is zero.
 * - A RESULT is a task handed in: moved to review, or closed as done (`isHandedIn`, the strip's «Сдано сегодня» and
 *   `shared/projectAnalytics.ts`), each task once a day.
 * - A DECISION is the person's: an answer, an accepted or declined proposal, an access request allowed or denied, a
 *   policy or grant the person decided (`isPersonDecision`). The same event types recorded by an agent or by Fabric
 *   itself (an access request allowed on the operator's own machine by the standing rule, ADR-0115) are not the
 *   person's and are not counted.
 *
 * Pure: the reads live in main.
 */

export const WORK_RHYTHM_DAYS = 28

/** Events the machine writes on its own clock: they show the scheduler, not work. */
export const MACHINE_TICKS: readonly string[] = ['cycle.ran@1', 'work.swept@1', 'work.renewed@1', 'comms.retention_applied@1']

/** The event types a person's decision is recorded as; counted only when the person is the actor. */
export const DECISION_TYPES: readonly string[] = [
  'question.answered@1',
  'proposal.decided@1',
  'access.decided@1',
  'policy.decided@1',
  'grant.issued@1',
  'access.grant.revoked@1'
]

/** The event types a result is recorded as (`isHandedIn` decides which of them count). */
export const RESULT_TYPES: readonly string[] = ['task.moved@1', 'task.closed@1']

export interface RhythmEvent {
  type: string
  occurred_at: string
  actor?: { kind?: string | null; id?: string | null } | null
  payload: Record<string, unknown> | null
}

/** The task a result event hands in, or null when it hands in nothing. */
export function handedInTask(e: RhythmEvent): string | null {
  const p = e.payload ?? {}
  const id = typeof p.task_id === 'string' ? p.task_id : typeof p.id === 'string' ? p.id : null
  if (!id) return null
  if (e.type === 'task.moved@1' && p.to === 'review') return id
  if (e.type === 'task.closed@1' && p.outcome === 'done') return id
  return null
}

export const isHandedIn = (e: RhythmEvent): boolean => handedInTask(e) !== null

/** The person's own decision: a decision type, written with the person (or the operator acting as one) as the actor. */
export function isPersonDecision(e: RhythmEvent): boolean {
  if (!DECISION_TYPES.includes(e.type)) return false
  const kind = e.actor?.kind
  return kind === 'person' || kind === 'operator'
}

/** A local calendar day on this machine's clock, `YYYY-MM-DD`. */
export const localDateKey = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface RhythmWindowDay {
  date: string
  /** The day's first moment, local midnight (ms). */
  from: number
  /** The next day's first moment (ms); the day is [from, to). */
  to: number
}

/** The window's days, oldest first, ending with today, on this machine's clock and zone (DST days are 23 or 25 h). */
export function rhythmWindow(now: number, days = WORK_RHYTHM_DAYS): RhythmWindowDay[] {
  const today = new Date(now)
  const out: RhythmWindowDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i).getTime()
    const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i + 1).getTime()
    out.push({ date: localDateKey(from), from, to })
  }
  return out
}

export interface WorkRhythmDay {
  date: string
  /** Work events that day; null: the day could not be read (never a zero). */
  events: number | null
  /** Tasks handed in that day; null when the marks could not be read, or the read stopped before this day. */
  results: number | null
  /** The person's decisions that day; null as for `results`. */
  decisions: number | null
  today: boolean
}

export interface WorkRhythm {
  days: WorkRhythmDay[]
  /** Over the days whose marks were read; a floor when `marksCapped`. Null when none could be read. */
  totals: { results: number | null; decisions: number | null; events: number | null }
  /** Today alone, the strip's «Сдано сегодня» by the same definition. */
  today: { results: number | null; decisions: number | null; events: number | null }
  /** The read of results and decisions stopped at its bound: the oldest days' marks are not all here. */
  marksCapped: boolean
  /** Why the marks or some days could not be read, for the operations log and a hover; absent when every read answered. */
  unread?: string[]
  timeZone: string
  readAt: string
}

/**
 * The rhythm from the per-day work counts and the result and decision events read for the window (newest first). When
 * the marks read stopped at its bound, the days older than the oldest event read are unknown for results and
 * decisions, never zero.
 */
export function composeRhythm(input: {
  now: number
  days?: number
  /** Work events per local date; a date missing or null was not read. */
  counts: ReadonlyMap<string, number | null>
  /** Result and decision events of the window; null: they could not be read. */
  marks: readonly RhythmEvent[] | null
  marksCapped?: boolean
  unread?: readonly string[]
  timeZone?: string
}): WorkRhythm {
  const window = rhythmWindow(input.now, input.days ?? WORK_RHYTHM_DAYS)
  const todayKey = localDateKey(input.now)
  const results = new Map<string, Set<string>>()
  const decisions = new Map<string, number>()
  let oldestMark = Infinity
  for (const e of input.marks ?? []) {
    const at = Date.parse(e.occurred_at)
    if (!Number.isFinite(at)) continue
    oldestMark = Math.min(oldestMark, at)
    const day = localDateKey(at)
    const task = handedInTask(e)
    if (task) results.set(day, (results.get(day) ?? new Set()).add(task))
    else if (isPersonDecision(e)) decisions.set(day, (decisions.get(day) ?? 0) + 1)
  }
  // A capped read holds the newest events: a day that ends before the oldest one read may have lost some.
  const marksKnown = (d: RhythmWindowDay): boolean => input.marks !== null && (!input.marksCapped || d.from >= oldestMark)
  const days: WorkRhythmDay[] = window.map((d) => {
    const known = marksKnown(d)
    const events = input.counts.get(d.date)
    return {
      date: d.date,
      events: typeof events === 'number' ? events : null,
      results: known ? (results.get(d.date)?.size ?? 0) : null,
      decisions: known ? (decisions.get(d.date) ?? 0) : null,
      today: d.date === todayKey
    }
  })
  const sum = (pick: (d: WorkRhythmDay) => number | null): number | null => {
    const known = days.map(pick).filter((n): n is number => n !== null)
    return known.length ? known.reduce((a, b) => a + b, 0) : null
  }
  const today = days.at(-1)
  return {
    days,
    totals: { results: sum((d) => d.results), decisions: sum((d) => d.decisions), events: sum((d) => d.events) },
    today: { results: today?.results ?? null, decisions: today?.decisions ?? null, events: today?.events ?? null },
    marksCapped: !!input.marksCapped,
    ...(input.unread?.length ? { unread: [...input.unread] } : {}),
    timeZone: input.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    readAt: new Date(input.now).toISOString()
  }
}
// #endregion work-rhythm
