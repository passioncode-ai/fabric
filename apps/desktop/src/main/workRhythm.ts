// #region work-rhythm-read — docs: docs/reports/2026-10-27-mockup-parity/gaps/home.md#d-data-bugs-wrong-numbers-order-or-missing-fields
/**
 * The reads behind «Ритм работы» (`shared/workRhythm.ts`; home gaps D1, D2): the count of each local day's work events
 * over 28 days, and the window's results and decisions.
 *
 * BOUNDED. A day is one count request (`count: exact, head: true`: no row crosses the wire), at most `CONCURRENCY` at
 * once, each starting from the window's first `seq` so the database walks the window's part of the journal by its key,
 * not the whole journal. A finished day does not change, so its count is kept for the life of the process (keyed by its
 * date and the machine's zone); only today and the days not yet read are asked again. The marks (results and decisions)
 * are one read of at most the gateway's 1 000 rows, newest first; a full answer is said `marksCapped`, and the days it
 * may have cut are unknown, never zero. A request that fails leaves its day unknown and says why (`unread`); the rhythm
 * never fails as a whole.
 */
import { GATEWAY_ROWS } from './homeStrip.ts'
import { composeRhythm, DECISION_TYPES, MACHINE_TICKS, RESULT_TYPES, rhythmWindow, WORK_RHYTHM_DAYS, type RhythmEvent, type WorkRhythm } from '../shared/workRhythm.ts'

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

export function createRhythmReader(store: RhythmStore, opts: { days?: number; timeZone?: () => string } = {}) {
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

  async function marks(from: number): Promise<{ rows: RhythmEvent[]; capped: boolean }> {
    const q = store.select('journal', 'type,occurred_at,actor,payload') as Query<RhythmEvent[]>
    const { data, error } = await q.in('type', [...RESULT_TYPES, ...DECISION_TYPES]).gte('occurred_at', new Date(from).toISOString())
      .order('seq', { ascending: false }).limit(GATEWAY_ROWS)
    if (error) throw new Error(`the results and decisions could not be read: ${error.message}`)
    const rows = data ?? []
    return { rows, capped: rows.length >= GATEWAY_ROWS }
  }

  return {
    async read(now: number): Promise<WorkRhythm> {
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
    },
    /** How many finished days are kept (for tests). */
    settledDays: (): number => settled.size
  }
}
// #endregion work-rhythm-read
