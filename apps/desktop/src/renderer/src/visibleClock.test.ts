import { afterEach, describe, expect, it, vi } from 'vitest'
import { visibleInterval } from './visibleClock'

afterEach(() => { vi.useRealTimers() })

function fakeDoc(state: 'visible' | 'hidden') {
  const listeners = new Set<() => void>()
  return {
    visibilityState: state as DocumentVisibilityState,
    addEventListener: (_: string, f: () => void) => { listeners.add(f) },
    removeEventListener: (_: string, f: () => void) => { listeners.delete(f) },
    show() { this.visibilityState = 'visible'; for (const f of listeners) f() },
    hide() { this.visibilityState = 'hidden'; for (const f of listeners) f() },
    listeners
  }
}

describe('visibleInterval (W3 of the quality waves, perf PF-3)', () => {
  it('ticks while seen, reads nothing while hidden, and reads once when shown again', () => {
    vi.useFakeTimers()
    const doc = fakeDoc('visible')
    const tick = vi.fn()
    const stop = visibleInterval(tick, 2000, doc as never)
    vi.advanceTimersByTime(4000)
    expect(tick).toHaveBeenCalledTimes(2)
    doc.hide()
    vi.advanceTimersByTime(20_000)
    expect(tick).toHaveBeenCalledTimes(2)
    doc.show()
    expect(tick).toHaveBeenCalledTimes(3)
    stop()
    vi.advanceTimersByTime(10_000)
    expect(tick).toHaveBeenCalledTimes(3)
    expect(doc.listeners.size).toBe(0)
  })
})
