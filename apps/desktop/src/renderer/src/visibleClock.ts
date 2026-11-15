// A window's clock that reads only while the window is seen (W3 of the quality waves, 2026-11-15, perf PF-3). The
// feed, the sessions and the Comms count polled every 2, 3 and 5 s whether or not anybody looked: about 8 000 calls an
// hour into main at 40 agents, and each feed batch set off the home, rhythm and board readings too. A hidden window now
// reads nothing; it reads once at the moment it is shown again, so what it shows is never older than one tick.
// `ProjectHome.tsx` keeps the same rule for its repository strip.

export function visibleInterval(tick: () => void, ms: number, doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> = document): () => void {
  const every = setInterval(() => { if (doc.visibilityState === 'visible') tick() }, ms)
  const onVisible = (): void => { if (doc.visibilityState === 'visible') tick() }
  doc.addEventListener('visibilitychange', onVisible)
  return () => {
    clearInterval(every)
    doc.removeEventListener('visibilitychange', onVisible)
  }
}
