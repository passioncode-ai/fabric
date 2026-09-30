/**
 * "Your base moved" has one spelling (UX28-11, R-005).
 *
 * `main/localState.ts` has answered a compare-and-set write with
 * `committed | conflict | failed` since it was written, the conflict carrying
 * `currentRevision` and `currentValue` so the caller can show what it moved to
 * without a second read. That is the right shape and it was already here; the
 * project-settings command needed the same concept across the IPC boundary.
 *
 * So the concept is declared ONCE and `LocalWrite<T>` is expressed in terms of
 * it. Two spellings of "somebody got here first" is how a reader learns to
 * check one of them: the day they disagree, whichever one the reader knows is
 * the one they believe.
 *
 * GENERIC OVER THE REVISION, because the two subjects count differently and
 * neither is wrong. A local file's revision is a content hash (a string); a
 * project's `config_revision` is the journal sequence of the event that set it
 * (a number, deterministic by construction — migration
 * `20260908000037_deterministic_config_revision.sql` says why). Forcing both
 * into one representation would mean converting a revision to compare it, and a
 * converted revision is one a reader cannot match against the row.
 */

/**
 * Refused because the base moved.
 *
 * Carries the CURRENT revision and the CURRENT value together: a conflict that
 * reports only "stale" makes the caller read again to find out what happened,
 * and between the refusal and that read it can move once more.
 */
export interface CasConflict<T, R> {
  status: 'conflict'
  currentRevision: R
  currentValue: T
}

/** Committed, refused because the base moved, or attempted and failed. */
export type CasWrite<T, R> =
  | { status: 'committed'; value: T; revision: R }
  | CasConflict<T, R>
  | { status: 'failed'; reason: string }

/** True when the write landed. A helper rather than a comparison, so no caller
 *  spells the check as `!== 'failed'` and quietly counts a conflict as a save. */
export function committed<T, R>(write: { status: string }): boolean {
  return write.status === 'committed'
}
