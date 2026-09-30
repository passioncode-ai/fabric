// When an editor buffer is clean, and when its window may close (UX-04, UX-05).
//
// Two rules, both of which were wrong, and they compounded into one loss.
//
// A SAVE IS ABOUT THE TEXT THAT WAS SENT, not about the buffer. The content is
// read before the round-trip, so anything typed while it is in flight is not in
// what was written. Declaring the buffer clean on success marked those
// keystrokes as saved when they were not.
//
// AND A CLOSE IS ABOUT THE BUFFER. Nothing believed there was anything to lose,
// so closing the window discarded them without asking. Either rule alone is a
// nuisance; together they are silent data loss.
//
// Extracted here because the editor component cannot be rendered in a test — it
// mounts Monaco — and because these are the rules rather than the plumbing. A
// rule that only exists inside a component nobody can render is a rule nobody
// can check.

export interface BufferState {
  /** There is work in the buffer that is not on disk. */
  dirty: boolean
  /** Say so on screen. Never true at the same time as `dirty`: "saved" beside
   *  unsaved work is the confusion that made the loss invisible. */
  saved: boolean
}

/**
 * What a SUCCESSFUL write means for the buffer.
 *
 * `written` is what the save actually sent; `buffer` is what the editor holds
 * now. They differ exactly when the operator kept typing during the round-trip.
 */
export function afterSave(written: string, buffer: string): BufferState {
  const stillDirty = buffer !== written
  return { dirty: stillDirty, saved: !stillDirty }
}

/**
 * Whether closing now would lose work.
 *
 * `confirmed` is the operator having already said discard — the one case where
 * a dirty buffer may go, because they were asked and answered.
 */
export function closeWouldLoseWork(state: BufferState, confirmed: boolean): boolean {
  return state.dirty && !confirmed
}
