// #region fabric-link-outbox — docs: docs/ux/scenarios.md#scn-142-open-fabric-from-a-products-button-in-that-products-project-and-go-on-in-a-coding-agent
/**
 * Where an opened `fabric://` link waits for the window that shows it (SCN-142).
 *
 * A link that starts Fabric cold is resolved when the page has loaded, but the page subscribes a moment later, once
 * React has mounted: a result pushed in between reached no listener and the link was lost. So a result is pushed only
 * to a page that has said it is listening (`claim`), and until then it waits here; `claim` hands the page what waited.
 * A new page (a reload, or a new window after the last one closed on macOS) has not said so yet: `reset`.
 */
export interface LinkOutbox<T> {
  /** A resolved link: pushed to a listening page, else kept for its `claim` (the oldest dropped past `limit`). */
  deliver(result: T): void
  /** The page is listening: what waited, oldest first; later results are pushed. */
  claim(): T[]
  /** A new page is loading: nothing listens until it claims. */
  reset(): void
}

export function createLinkOutbox<T>(push: (result: T) => void, limit = 8): LinkOutbox<T> {
  let listening = false
  const waiting: T[] = []
  return {
    deliver(result) {
      if (listening) return push(result)
      waiting.push(result)
      if (waiting.length > limit) waiting.shift()
    },
    claim() {
      listening = true
      return waiting.splice(0)
    },
    reset() {
      listening = false
    }
  }
}
// #endregion fabric-link-outbox
