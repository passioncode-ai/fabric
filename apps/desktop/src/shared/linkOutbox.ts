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

/** What the outbox does with a result past its limit (0.3.5 review iteration 2, ER-7): `onDrop` reports it (the caller
 *  logs that one was dropped, never the link), and `mark` puts the count on the newest result the page claims. */
export interface LinkDropHandling<T> {
  onDrop?: (dropped: T) => void
  mark?: (newest: T, dropped: number) => T
}

export function createLinkOutbox<T>(push: (result: T) => void, limit = 8, drops: LinkDropHandling<T> = {}): LinkOutbox<T> {
  let listening = false
  const waiting: T[] = []
  let dropped = 0
  return {
    deliver(result) {
      if (listening) return push(result)
      waiting.push(result)
      if (waiting.length > limit) {
        const lost = waiting.shift() as T
        dropped++
        drops.onDrop?.(lost)
      }
    },
    claim() {
      listening = true
      const out = waiting.splice(0)
      if (dropped > 0 && out.length > 0 && drops.mark) out[out.length - 1] = drops.mark(out[out.length - 1], dropped)
      dropped = 0
      return out
    },
    reset() {
      listening = false
    }
  }
}

/**
 * The links that arrive before startup has finished, or while no window exists (`index.ts#acceptLink`), up to `limit`.
 * Past it the OLDEST goes — the newest is the last button the person pressed, the one a window opens last — and the
 * drop is never silent (0.3.5 review iteration 2, ER-7): `onDrop` is told how many still wait, and `take` hands over
 * how many were dropped with the links, so the window can say so.
 */
export interface LinkHold<T> {
  hold(link: T): void
  /** Everything that waited, oldest first, and how many were dropped since the last take. */
  take(): { links: T[]; dropped: number }
  readonly size: number
}

export function createLinkHold<T>(limit = 8, onDrop: (waiting: number) => void = () => {}): LinkHold<T> {
  const waiting: T[] = []
  let dropped = 0
  return {
    hold(link) {
      waiting.push(link)
      if (waiting.length > limit) {
        waiting.shift()
        dropped++
        onDrop(waiting.length)
      }
    },
    take() {
      const out = { links: waiting.splice(0), dropped }
      dropped = 0
      return out
    },
    get size() {
      return waiting.length
    }
  }
}
// #endregion fabric-link-outbox
