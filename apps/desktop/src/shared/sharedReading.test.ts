import { describe, expect, it } from 'vitest'
import { createSharedReading } from './sharedReading'

describe('createSharedReading (W3 of the quality waves, perf PF-2)', () => {
  it('joins a reading in flight, answers a fresh one again, and reads anew once it is old', async () => {
    let t = 0, reads = 0
    let release!: (v: number) => void
    const s = createSharedReading(() => { reads++; return new Promise<number>((r) => { release = r }) }, 2000, () => t)
    const a = s.read(), b = s.read()
    expect(reads).toBe(1)
    release(7)
    expect(await a).toBe(7); expect(await b).toBe(7)
    t = 1500
    expect(await s.read()).toBe(7)
    expect(reads).toBe(1)
    t = 2500
    const c = s.read()
    expect(reads).toBe(2)
    release(8)
    expect(await c).toBe(8)
  })

  it('never answers a failed reading again', async () => {
    let reads = 0
    const s = createSharedReading(async () => { reads++; if (reads === 1) throw new Error('db down'); return 'ok' }, 2000, () => 0)
    await expect(s.read()).rejects.toThrow('db down')
    expect(await s.read()).toBe('ok')
    expect(reads).toBe(2)
  })
})
