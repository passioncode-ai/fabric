/**
 * Which readers a journal event is allowed to wake.
 *
 * FA-08. The window followed the journal through ONE number — the high-water
 * mark — and every reader on the page depended on it. That is the right shape
 * for a journal-as-spine product and the wrong granularity for it: an
 * `agent.heartbeat@1`, which arrives per session per interval and changes
 * nothing anybody is looking at, re-ran the repository list, the project
 * statistics, the transcript list, the quota, the task list, the board, the
 * digest, the decisions, the memory overview, the plan, the retrospective and
 * the harness. Thirteen reads, all of them answering the same thing again.
 *
 * The mark is now one per event FAMILY — the segment before the first dot, which
 * is how the tick already dispatched project and terminal refreshes. A reader
 * names the families it reads and follows their maximum, so a family it does not
 * read cannot move its dependency.
 *
 * Two rules keep this from turning a saving into a stale panel:
 *
 * - **`all` is the default and it still exists.** A reader that genuinely spans
 *   everything — a digest, a count over many tables — follows `all` and behaves
 *   exactly as it did. Narrowing is opt-in, per reader, and wrong only where
 *   somebody names a set that does not cover what the reader reads.
 * - **Untouched families keep their identity.** A React dependency compares by
 *   value, so a new object with the same numbers would wake everything anyway.
 *   `advance` returns the SAME record when nothing it tracks moved.
 */

/** Marks by event family, plus `all` — the journal's own high-water mark. */
export interface FeedMarks {
  readonly all: number
  readonly byFamily: Readonly<Record<string, number>>
}

export const NO_MARKS: FeedMarks = { all: 0, byFamily: {} }

/** The family of an event type: everything before the first dot. */
export function familyOf(type: string): string {
  const dot = type.indexOf('.')
  return dot === -1 ? type : type.slice(0, dot)
}

/**
 * Fold a batch of events into the marks.
 *
 * Returns the previous record unchanged when the batch is empty, so a tick that
 * found nothing cannot wake a reader by identity alone.
 */
export function advance(prev: FeedMarks, events: readonly { seq: number; type: string }[]): FeedMarks {
  if (events.length === 0) return prev
  let all = prev.all
  const byFamily: Record<string, number> = { ...prev.byFamily }
  for (const e of events) {
    if (e.seq > all) all = e.seq
    const family = familyOf(e.type)
    if (e.seq > (byFamily[family] ?? 0)) byFamily[family] = e.seq
  }
  return { all, byFamily }
}

/**
 * The mark a reader of these families should follow.
 *
 * An empty list means "everything", because a reader that names nothing has not
 * been narrowed — and defaulting the other way would freeze it at zero and it
 * would never refresh at all. A wrong default that refreshes too often costs
 * work; one that refreshes never costs the operator the truth.
 */
export function markOf(marks: FeedMarks, families: readonly string[]): number {
  if (families.length === 0) return marks.all
  let mark = 0
  for (const family of families) {
    const seen = marks.byFamily[family] ?? 0
    if (seen > mark) mark = seen
  }
  return mark
}
