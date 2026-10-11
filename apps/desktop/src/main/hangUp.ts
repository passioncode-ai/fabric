// #region request-hang-up — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#1-one-door-a-second-way-in
/**
 * A request's handling, or the caller hanging up — whichever comes first. The MCP SDK never settles
 * `handleRequest` for a response closed under it (I3 E-2), so awaiting it alone keeps the promise and its
 * buffers for the life of the session. The external path races it (I3 E-2); audit 2026-10-05 A7-026
 * found the session-bearer path did not.
 */
export interface Closable {
  readonly destroyed?: boolean
  once(event: 'close', listener: () => void): unknown
  off?(event: 'close', listener: () => void): unknown
}

export async function untilAnsweredOrGone(work: Promise<unknown>, res: Closable): Promise<void> {
  if (res.destroyed) { void work.catch(() => { /* the caller is gone; nothing is left to answer */ }); return }
  let onClose!: () => void
  const gone = new Promise<void>((resolve) => { onClose = resolve; res.once('close', onClose) })
  try {
    await Promise.race([work, gone])
  } finally {
    res.off?.('close', onClose)
  }
}
// #endregion request-hang-up
