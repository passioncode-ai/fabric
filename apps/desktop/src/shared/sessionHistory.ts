// #region session-history — docs: docs/ux/scenarios.md#scn-091-вернуться-к-агенту-у-его-консоли-прочитав-его-собственный-контекст
// One agent session's history, as the agents screen reads it (SCR-39).
//
// Audit 2026-10-05 A5-001: the read sorted ascending and kept 200 rows, so it returned the session's
// OLDEST 200 events. Past 200 the history froze, and the 10 s re-read fetched the same window with no
// sign anything was cut. The read now takes the newest rows and shows them oldest first, and a full
// window says that earlier events exist rather than implying the session began there.

/** How many of a session's newest events the history shows. */
export const SESSION_HISTORY_WINDOW = 200

/** The newest `window` rows, read newest first, put back in the order they happened. */
export function latestInOrder<T extends { seq: number }>(newestFirst: readonly T[], window = SESSION_HISTORY_WINDOW): T[] {
  return [...newestFirst].sort((a, b) => b.seq - a.seq).slice(0, window).reverse()
}

/** Whether earlier events exist. The read takes one event more than it shows, so a session of exactly
 *  `window` events says nothing about earlier ones (0.3.2 verification DO-20). */
export function mayHaveEarlier(rows: readonly unknown[], window = SESSION_HISTORY_WINDOW): boolean {
  return rows.length > window
}

/** The events the history shows: the newest `window` of a reading that may carry one more. */
export function shownHistory<T>(rows: readonly T[], window = SESSION_HISTORY_WINDOW): T[] {
  return rows.slice(Math.max(0, rows.length - window))
}

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The slice of the store's query builder this read uses, so a test can drive it without a database. */
export interface HistoryQuery<T> {
  eq(column: string, value: string): HistoryQuery<T>
  order(column: string, options: { ascending: boolean }): HistoryQuery<T>
  limit(n: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>
}

/** The three ways an event names a session: in its payload as the session or its owner, or as the actor that wrote it
 *  (OF-09: a task it moved, a decision it recorded). */
const SESSION_KEYS = ['payload->>session_id', 'payload->>owner', 'actor->>id'] as const

/**
 * One session's history — the NEWEST `SESSION_HISTORY_WINDOW` journal events that name it, returned in the order they
 * happened (A5-001). A read that fails throws; it is never an empty history.
 *
 * ONE READ PER KEY, not one OR filter (0.3.7 review DA-6). An OR of three keys cannot be read from any index in seq
 * order, so PostgreSQL walked the estate's journal backwards until it had found the window: for a quiet session that
 * is the whole journal, measured at 200 000 events on a disposable PostgreSQL 17, and the agents screen repeats it
 * every 10 s. Each keyed read is served by its own index in seq order (migration 116) and stops at the window; the
 * three are merged here, an event naming the session twice counted once.
 */
export async function readSessionHistory<T extends { seq: number }>(
  select: () => HistoryQuery<T>,
  estateId: string,
  sessionId: unknown
): Promise<T[]> {
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) throw new Error('Invalid session identity')
  const reads = await Promise.all(SESSION_KEYS.map((key) =>
    select()
      .eq('estate_id', estateId)
      .eq(key, sessionId)
      .order('seq', { ascending: false })
      // One beyond the window, so the screen can say whether earlier events exist (`mayHaveEarlier`).
      .limit(SESSION_HISTORY_WINDOW + 1)
  ))
  const bySeq = new Map<number, T>()
  for (const { data, error } of reads) {
    if (error) throw new Error(`the session history could not be read: ${error.message}`)
    for (const row of data ?? []) bySeq.set(Number(row.seq), row)
  }
  return latestInOrder([...bySeq.values()], SESSION_HISTORY_WINDOW + 1)
}
// #endregion session-history
