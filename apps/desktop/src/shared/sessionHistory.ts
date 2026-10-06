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
  or(filter: string): HistoryQuery<T>
  order(column: string, options: { ascending: boolean }): HistoryQuery<T>
  limit(n: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>
}

/**
 * One session's history: the NEWEST `SESSION_HISTORY_WINDOW` journal events that name it, returned in the
 * order they happened (A5-001). The id is interpolated into a PostgREST filter expression, so nothing but
 * a session id's own shape is let through. A read that fails throws; it is never an empty history.
 */
export async function readSessionHistory<T extends { seq: number }>(
  select: () => HistoryQuery<T>,
  estateId: string,
  sessionId: unknown
): Promise<T[]> {
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) throw new Error('Invalid session identity')
  const { data, error } = await select()
    .eq('estate_id', estateId)
    .or(`payload->>session_id.eq.${sessionId},payload->>owner.eq.${sessionId}`)
    .order('seq', { ascending: false })
    .limit(SESSION_HISTORY_WINDOW + 1)
  if (error) throw new Error(`the session history could not be read: ${error.message}`)
  // One beyond the window, so the screen can say whether earlier events exist (`mayHaveEarlier`).
  return latestInOrder(data ?? [], SESSION_HISTORY_WINDOW + 1)
}
// #endregion session-history
