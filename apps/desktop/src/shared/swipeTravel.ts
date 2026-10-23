// #region swipe-travel — docs: docs/ux/scenarios.md#scn-162-move-between-the-five-places-and-the-projects-from-the-rail
/**
 * The trackpad's two-finger swipe as the way back and forward (SCN-162 step 3, CO-401), as Safari reads it: fingers to
 * the right go back, to the left go forward. One gesture is the wheel events until a pause; it counts only when it is
 * clearly sideways and far enough, and never when what is under the pointer can still scroll that way (the Board's
 * columns, a wide table), so a sideways scroll is never taken for a page turn.
 */
export const SWIPE_DISTANCE = 160
export const SWIPE_PAUSE_MS = 250

export interface SwipeState { dx: number; dy: number; last: number; fired: boolean }

export const swipeStart = (): SwipeState => ({ dx: 0, dy: 0, last: 0, fired: false })

/** Adds one wheel event; answers the travel it completes, once per gesture. `canScroll(dir)` says whether the element
 *  under the pointer can still scroll left (dx < 0) or right (dx > 0). */
export function swipeStep(state: SwipeState, e: { deltaX: number; deltaY: number; at: number }, canScroll: (towardRight: boolean) => boolean): { state: SwipeState; travel: 'back' | 'forward' | null } {
  const fresh = e.at - state.last > SWIPE_PAUSE_MS ? swipeStart() : state
  const next = { dx: fresh.dx + e.deltaX, dy: fresh.dy + e.deltaY, last: e.at, fired: fresh.fired }
  if (next.fired || Math.abs(next.dx) < SWIPE_DISTANCE || Math.abs(next.dx) < 2 * Math.abs(next.dy)) return { state: next, travel: null }
  if (canScroll(next.dx > 0)) return { state: { ...next, dx: 0, dy: 0 }, travel: null }
  return { state: { ...next, fired: true }, travel: next.dx < 0 ? 'back' : 'forward' }
}
// #endregion swipe-travel
