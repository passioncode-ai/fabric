// #region continue-queue — docs: docs/ux/scenarios.md#scn-142-open-fabric-from-a-products-button-in-that-products-project-and-go-on-in-a-coding-agent
/**
 * The `fabric://session/continue` asks App shows, one at a time (the 0.3.26 review, iteration 3: ER-18, ER-23, ER-26). An
 * ask whose press is being answered stays until its answer; a continue link for another session that arrives meanwhile
 * waits behind it and is shown when that ask is done; a link that replaces an idle ask drops what waited. A reducer, so
 * the ask's callbacks dispatch actions and never read a state captured by an older render (ER-26's stale closure).
 */
export interface ContinueAsk { session: string; from?: string }
export interface ContinueQueue { ask: ContinueAsk | null; queued: ContinueAsk | null; busy: string | null }
export type ContinueQueueAction =
  /** A link was applied: its continue ask, or null for a link that is not a continue. */
  | { type: 'link'; next: ContinueAsk | null }
  /** The shown ask's press was sent (its session) or answered (null). */
  | { type: 'busy'; session: string | null }
  /** The shown ask is over: continued, or the person closed it. */
  | { type: 'done' }

export const NO_CONTINUE: ContinueQueue = { ask: null, queued: null, busy: null }

export function continueQueue(state: ContinueQueue, action: ContinueQueueAction): ContinueQueue {
  switch (action.type) {
    case 'link': {
      const next = action.next
      if (state.busy) {
        // The ask in flight stays; another session's continue waits behind it, the newest one winning.
        return next && next.session !== state.busy ? { ...state, queued: next } : state
      }
      return { ask: next ? (state.ask?.session === next.session ? state.ask : next) : null, queued: null, busy: null }
    }
    case 'busy':
      return state.ask && (action.session === null || action.session === state.ask.session) ? { ...state, busy: action.session } : state
    case 'done':
      return { ask: state.queued, queued: null, busy: null }
  }
}
// #endregion continue-queue
