import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { usePaneRead, type PaneRead } from './paneRead'

afterEach(() => cleanup())

/** A read the test settles by hand, one at a time, in the order asked. */
function deferredLoads(): { load(): Promise<string>; pending: Array<{ ok(v: string): void; no(e: Error): void }> } {
  const pending: Array<{ ok(v: string): void; no(e: Error): void }> = []
  return {
    pending,
    load: () => new Promise<string>((ok, no) => { pending.push({ ok, no }) })
  }
}

function Probe({ of, mark, attempt, load, seen }: { of: string; mark: number; attempt: number; load(): Promise<string>; seen: Array<PaneRead<string>> }): null {
  seen.push(usePaneRead(of, '', load, mark, attempt))
  return null
}

const flush = (): Promise<void> => act(async () => { await Promise.resolve(); await Promise.resolve() })

describe('usePaneRead (CO-544)', () => {
  it('shows the read in flight when the journal moved meanwhile, then reads once more', async () => {
    const d = deferredLoads()
    const seen: Array<PaneRead<string>> = []
    const view = render(<Probe of="s1" mark={0} attempt={0} load={d.load} seen={seen} />)
    await flush()
    expect(d.pending).toHaveLength(1)
    // Three marks arrive while the first read runs: none of them drops it, and they ask for ONE more read.
    view.rerender(<Probe of="s1" mark={1} attempt={0} load={d.load} seen={seen} />)
    view.rerender(<Probe of="s1" mark={2} attempt={0} load={d.load} seen={seen} />)
    view.rerender(<Probe of="s1" mark={3} attempt={0} load={d.load} seen={seen} />)
    await flush()
    expect(d.pending).toHaveLength(1)
    d.pending[0].ok('first')
    await flush()
    expect(seen.at(-1)).toEqual({ at: 'ready', value: 'first', of: 's1' })
    expect(d.pending).toHaveLength(2)
    d.pending[1].ok('second')
    await flush()
    expect(seen.at(-1)).toEqual({ at: 'ready', value: 'second', of: 's1' })
    expect(d.pending).toHaveLength(2)
  })

  it('keeps what was shown through two failures in a row', async () => {
    const d = deferredLoads()
    const seen: Array<PaneRead<string>> = []
    const view = render(<Probe of="s1" mark={0} attempt={0} load={d.load} seen={seen} />)
    await flush()
    d.pending[0].ok('shown')
    await flush()
    view.rerender(<Probe of="s1" mark={0} attempt={1} load={d.load} seen={seen} />)
    await flush()
    d.pending[1].no(new Error('stack lost'))
    await flush()
    expect(seen.at(-1)).toEqual({ at: 'failed', says: 'stack lost', kept: 'shown', of: 's1' })
    view.rerender(<Probe of="s1" mark={0} attempt={2} load={d.load} seen={seen} />)
    await flush()
    d.pending[2].no(new Error('still lost'))
    await flush()
    expect(seen.at(-1)).toEqual({ at: 'failed', says: 'still lost', kept: 'shown', of: 's1' })
  })

  it('drops an answer for the session it no longer shows, and reads the new one', async () => {
    const d = deferredLoads()
    const seen: Array<PaneRead<string>> = []
    const view = render(<Probe of="s1" mark={0} attempt={0} load={d.load} seen={seen} />)
    await flush()
    view.rerender(<Probe of="s2" mark={0} attempt={0} load={d.load} seen={seen} />)
    await flush()
    d.pending[0].ok('for s1')
    await flush()
    expect(seen.some((r) => r.at === 'ready' && r.value === 'for s1')).toBe(false)
    expect(d.pending).toHaveLength(2)
    d.pending[1].ok('for s2')
    await flush()
    expect(seen.at(-1)).toEqual({ at: 'ready', value: 'for s2', of: 's2' })
  })
})
