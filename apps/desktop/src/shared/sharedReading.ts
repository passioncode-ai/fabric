// One reading shared by every reader (W3 of the quality waves, 2026-11-15, perf PF-2). The home was read once per reader
// and per mark, eight awaited stages each, up to 809 times an hour and up to 18.6 s a read: every window, the rail and
// each screen asked for its own. A reading in flight is joined; a reading that ended within `reuseMs` is answered again;
// a reading that failed is never answered again, so the next reader reads anew.

export interface SharedReading<T> {
  read(): Promise<T>
}

export function createSharedReading<T>(read: () => Promise<T>, reuseMs: number, now: () => number = Date.now): SharedReading<T> {
  let inFlight: Promise<T> | null = null
  let kept: { at: number; value: T } | null = null
  return {
    read(): Promise<T> {
      if (inFlight) return inFlight
      if (kept && now() - kept.at < reuseMs) return Promise.resolve(kept.value)
      const p = read().then(
        (value) => { kept = { at: now(), value }; return value },
        (e: unknown) => { kept = null; throw e }
      ).finally(() => { if (inFlight === p) inFlight = null })
      inFlight = p
      return p
    }
  }
}
