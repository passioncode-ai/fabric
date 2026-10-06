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

/** Whether a reading may have left earlier events out: it filled the whole window. */
export function mayHaveEarlier(rows: readonly unknown[], window = SESSION_HISTORY_WINDOW): boolean {
  return rows.length >= window
}
