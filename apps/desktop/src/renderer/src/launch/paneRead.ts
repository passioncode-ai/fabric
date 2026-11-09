// #region pane-read — docs: docs/evidence/plans/2026-11-08-0318-board-always-on/brief.md#asks-intake-split
import { useEffect, useRef, useState } from 'react'

/** One read of an agent's session card (CO-544): what it holds for `of`, the session it was read for. */
export type PaneRead<T> =
  | { at: 'reading'; of: string }
  | { at: 'ready'; value: T; of: string }
  | { at: 'failed'; says: string; kept: T | null; of: string }

/** How often the card reads again with no journal event: a stack that came back, a message read since. */
export const PANE_REFRESH_MS = 15_000

/**
 * Reads the session card's data when the journal moves, every PANE_REFRESH_MS, and on «Повторить» (CO-544, the
 * operator's «вьюшка справа не обновляется» of 2026-11-08).
 *
 * Coalesced like `useHome` (ER-16): one read in flight; a mark, tick or retry that arrives meanwhile asks for ONE more
 * once it settles. Before, every mark change dropped the read in flight, and an agent's turns (a `session` mark about
 * every 2 s) kept any read slower than that from ever landing.
 *
 * A failure keeps what was shown before, whether that was a read or the kept view of an earlier failure: two failures
 * in a row (a «Повторить» while the stack is still down) no longer empty the card. An answer for another subject
 * (`of` or `key` changed while it was in flight) is dropped, and the new subject is read after it.
 */
export function usePaneRead<T>(of: string, key: string, load: () => Promise<T>, mark: number, attempt: number): PaneRead<T> {
  const [state, setState] = useState<PaneRead<T>>({ at: 'reading', of })
  const [tick, setTick] = useState(0)
  // The read a settled flight asks for again is the CURRENT subject's, so `of` and `load` are read through refs.
  const loadRef = useRef(load)
  loadRef.current = load
  const ofRef = useRef(of)
  ofRef.current = of
  const flight = useRef({ busy: false, dirty: false, alive: true, ident: '' })
  useEffect(() => {
    flight.current.alive = true
    const timer = setInterval(() => setTick((n) => n + 1), PANE_REFRESH_MS)
    return () => {
      flight.current.alive = false
      clearInterval(timer)
    }
  }, [])
  const ident = `${of}\u0000${key}`
  useEffect(() => {
    const f = flight.current
    f.ident = ident
    const read = (): void => {
      if (f.busy) { f.dirty = true; return }
      f.busy = true
      f.dirty = false
      const asked = f.ident
      const askedOf = ofRef.current
      // Through a promise, so a bridge without the read (an older preload, a test double) is a failed read, said.
      Promise.resolve().then(() => loadRef.current()).then(
        (value) => { if (f.alive && f.ident === asked) setState({ at: 'ready', value, of: askedOf }) },
        (e: unknown) => {
          if (!f.alive || f.ident !== asked) return
          const says = e instanceof Error ? e.message : String(e)
          setState((r) => ({ at: 'failed', says, of: askedOf, kept: r.of !== askedOf ? null : r.at === 'ready' ? r.value : r.at === 'failed' ? r.kept : null }))
        }
      ).finally(() => {
        f.busy = false
        if (f.dirty && f.alive) read()
      })
    }
    read()
  }, [ident, mark, tick, attempt]) // eslint-disable-line react-hooks/exhaustive-deps -- `of` is part of `ident`
  return state
}
// #endregion pane-read
