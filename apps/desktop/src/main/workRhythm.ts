// #region work-rhythm-read — docs: docs/reports/2026-10-27-mockup-parity/gaps/2026-10-27-home.md#d-data-bugs-wrong-numbers-order-or-missing-fields
/**
 * The reads behind «Ритм работы» (`shared/workRhythm.ts`; home gaps D1, D2): the count of each local day's work events
 * over 28 days, and the window's results and decisions.
 *
 * BOUNDED. A day is one count request (`count: exact, head: true`: no row crosses the wire), at most `CONCURRENCY` at
 * once, each starting from the window's first `seq` so the database walks the window's part of the journal by its key,
 * not the whole journal. A finished day does not change, so its count is kept for the life of the process (keyed by its
 * date and the machine's zone); only today and the days not yet read are asked again. The marks (results and decisions)
 * are three reads filtered by the database (moves into review, closes as done, the person's decisions), each of at
 * most the gateway's 1 000 rows, newest first; a full answer is said `marksCapped`, and the days it
 * may have cut are unknown, never zero. A request that fails leaves its day unknown and says why (`unread`); the rhythm
 * never fails as a whole.
 */
import { GATEWAY_ROWS } from './homeStrip.ts'
import { composeRhythm, DECISION_TYPES, MACHINE_TICKS, rhythmWindow, WORK_RHYTHM_DAYS, type RhythmEvent, type WorkRhythm } from '../shared/workRhythm.ts'

type Answer<T> = PromiseLike<{ data: T | null; error: { message: string } | null; count?: number | null }>
interface Query<T = unknown[]> extends Answer<T> {
  eq(column: string, value: unknown): Query<T>
  in(column: string, values: readonly string[]): Query<T>
  not(column: string, op: string, value: string): Query<T>
  gte(column: string, value: string | number): Query<T>
  lt(column: string, value: string | number): Query<T>
  order(column: string, options: { ascending: boolean }): Query<T>
  limit(n: number): Query<T>
}
export interface RhythmStore {
  select(table: string, columns: string, options?: { head?: boolean; count?: 'exact' }): unknown
}

/** At most this many day counts in flight at once. */
export const CONCURRENCY = 4

/** The PostgREST list literal for `not.in`: each value quoted, so a type's `@` and `.` stay part of it. */
const notIn = (values: readonly string[]): string => `(${values.map((v) => `"${v}"`).join(',')})`

/** A reading younger than this is answered again. */
export const MIN_INTERVAL_MS = 15_000

const sameLocalDay = (a: number, b: number): boolean => new Date(a).toDateString() === new Date(b).toDateString()

export function createRhythmReader(store: RhythmStore, opts: { days?: number; timeZone?: () => string; minIntervalMs?: number } = {}) {
  const days = opts.days ?? WORK_RHYTHM_DAYS
  const zone = opts.timeZone ?? (() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  /** Finished days' counts, by `zone|date`: they cannot change once the day is over. */
  const settled = new Map<string, number>()

  async function windowStartSeq(from: number): Promise<number | null> {
    const q = store.select('journal', 'seq') as Query<Array<{ seq: number }>>
    const { data, error } = await q.gte('occurred_at', new Date(from).toISOString()).order('seq', { ascending: true }).limit(1)
    if (error) throw new Error(`the start of the rhythm's window could not be read: ${error.message}`)
    return data?.[0]?.seq ?? null
  }

  async function countDay(from: number, to: number, startSeq: number): Promise<number> {
    const q = store.select('journal', 'seq', { head: true, count: 'exact' }) as Query
    const { error, count } = await q.gte('seq', startSeq).gte('occurred_at', new Date(from).toISOString()).lt('occurred_at', new Date(to).toISOString())
      .not('type', 'in', notIn(MACHINE_TICKS))
    if (error) throw new Error(error.message)
    if (typeof count !== 'number') throw new Error('the database gave no count')
    return count
  }

  /** The results and decisions, filtered by the database (the 0.3.15 review, iteration 1, ER-3): a move into review, a
   *  close as done, a decision by the person. Unfiltered, every move and every agent's decision filled the 1 000 rows in
   *  days, not 28. Three reads of at most the gateway's rows each, newest first; any full one is said `capped`. */
  async function marks(from: number): Promise<{ rows: RhythmEvent[]; capped: boolean }> {
    const since = new Date(from).toISOString()
    const read = async (what: string, q: Query<RhythmEvent[]>): Promise<RhythmEvent[]> => {
      const { data, error } = await q.gte('occurred_at', since).order('seq', { ascending: false }).limit(GATEWAY_ROWS)
      if (error) throw new Error(`the ${what} could not be read: ${error.message}`)
      return data ?? []
    }
    const cols = 'type,occurred_at,actor,payload'
    const parts = await Promise.all([
      read('tasks handed in', (store.select('journal', cols) as Query<RhythmEvent[]>).eq('type', 'task.moved@1').eq('payload->>to', 'review')),
      read('tasks closed', (store.select('journal', cols) as Query<RhythmEvent[]>).eq('type', 'task.closed@1').eq('payload->>outcome', 'done')),
      read('decisions', (store.select('journal', cols) as Query<RhythmEvent[]>).in('type', DECISION_TYPES).in('actor->>kind', ['person', 'operator']))
    ])
    return { rows: parts.flat(), capped: parts.some((p) => p.length >= GATEWAY_ROWS) }
  }

  /** One reading at a time for every window, and a reading younger than `MIN_INTERVAL_MS` is answered again (the 0.3.15
   *  review, iteration 1, ER-2: every agent's turn moves a mark, and each mark asked for a new reading). */
  let last: { at: number; rhythm: WorkRhythm } | null = null
  let flight: Promise<WorkRhythm> | null = null
  const minInterval = opts.minIntervalMs ?? MIN_INTERVAL_MS

  return {
    async read(now: number): Promise<WorkRhythm> {
      if (last && now - last.at >= 0 && now - last.at < minInterval && sameLocalDay(last.at, now)) return last.rhythm
      if (flight) return flight
      flight = readNow(now).then((rhythm) => { last = { at: now, rhythm }; return rhythm }).finally(() => { flight = null })
      return flight
    },
    /** How many finished days are kept (for tests). */
    settledDays: (): number => settled.size
  }

  async function readNow(now: number): Promise<WorkRhythm> {
    const tz = zone()
    const window = rhythmWindow(now, days)
    const unread: string[] = []
    const counts = new Map<string, number | null>()
    const [startSeq, marksRead] = await Promise.all([
      windowStartSeq(window[0].from).catch((e: unknown) => { unread.push(String(e instanceof Error ? e.message : e)); return undefined }),
      marks(window[0].from).catch((e: unknown) => { unread.push(String(e instanceof Error ? e.message : e)); return null })
    ])
    if (startSeq === null) {
      // No event since the window opened: every day read, every day empty.
      for (const d of window) counts.set(d.date, 0)
    } else if (startSeq !== undefined) {
      const todo = window.filter((d) => {
        const kept = d.to <= now ? settled.get(`${tz}|${d.date}`) : undefined
        if (kept !== undefined) counts.set(d.date, kept)
        return kept === undefined
      })
      let next = 0
      const worker = async (): Promise<void> => {
        while (next < todo.length) {
          const d = todo[next++]
          try {
            const n = await countDay(d.from, d.to, startSeq)
            counts.set(d.date, n)
            if (d.to <= now) settled.set(`${tz}|${d.date}`, n)
          } catch (e) {
            counts.set(d.date, null)
            unread.push(`${d.date}: ${e instanceof Error ? e.message : String(e)}`)
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker))
    }
    // Kept days outside the window are dropped, so the cache holds at most the window.
    const inWindow = new Set(window.map((d) => `${tz}|${d.date}`))
    for (const k of [...settled.keys()]) if (!inWindow.has(k)) settled.delete(k)
    return composeRhythm({ now, days, counts, marks: marksRead ? marksRead.rows : null, marksCapped: marksRead?.capped ?? false, unread, timeZone: tz })
  }
}
// #endregion work-rhythm-read
