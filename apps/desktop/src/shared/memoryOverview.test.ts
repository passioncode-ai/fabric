import { describe, expect, it } from 'vitest'
import { fullyRead, missRate, type MemoryOverview, type StoreCount } from './memoryOverview.ts'

const AT = '2026-09-10T00:00:00.000Z'
const n = (rows: number): StoreCount => ({ rows, problem: null, asOf: AT })
const broken = (problem: string): StoreCount => ({ rows: null, problem, asOf: null })
/** Nobody has asked. Not empty, and not refused (UX28-07). */
const unread = (): StoreCount => ({ rows: null, problem: null, asOf: null })

describe('the miss rate', () => {
  it('is a percentage of what was actually asked', () => {
    expect(missRate(n(1112), n(484))).toEqual({ known: true, percent: 44, of: 1112 })
  })

  it('is UNKNOWN when nothing was asked — not zero', () => {
    // A confident 0% would read as "memory answers everything", which is the
    // opposite of what an empty log means.
    expect(missRate(n(0), n(0))).toEqual({ known: false, because: 'never-asked' })
  })

  it('is unknown for a DIFFERENT reason when the store could not be read', () => {
    // Two reasons to have no rate, and the screen must be able to tell them
    // apart: one is a young project, the other is a broken read.
    expect(missRate(broken('permission denied'), n(0))).toEqual({
      known: false,
      because: 'unreadable'
    })
    expect(missRate(n(10), broken('timeout'))).toEqual({ known: false, because: 'unreadable' })
  })

  it('reports 100 when everything missed, rather than treating it as an error', () => {
    expect(missRate(n(7), n(7))).toEqual({ known: true, percent: 100, of: 7 })
  })

  it('rounds rather than inventing precision', () => {
    expect(missRate(n(3), n(1)).known && missRate(n(3), n(1))).toMatchObject({ percent: 33 })
  })
})

describe('whether the overview is whole', () => {
  const whole: MemoryOverview = {
    facts: n(456),
    superseded: n(95),
    retrievals: n(1112),
    misses: n(484),
    transcripts: n(332),
    packs: n(40)
  }

  it('is whole when every store answered', () => {
    expect(fullyRead(whole)).toBe(true)
  })

  it('is NOT whole when one store failed — a screen showing five of six stores must say so', () => {
    expect(fullyRead({ ...whole, packs: broken('relation does not exist') })).toBe(false)
  })

  it('a store with zero rows is still an answer', () => {
    expect(fullyRead({ ...whole, superseded: n(0) })).toBe(true)
  })
})

describe('never read is not empty, and not a refusal (UX28-07)', () => {
  it('gives no rate, for a reason that is neither of the other two', () => {
    // A store nobody has asked about looks exactly like an empty one if the
    // count is the only field. The rate must not read as "nothing was asked
    // and we know it" when nobody looked at all.
    const rate = missRate(unread(), unread())
    expect(rate.known).toBe(false)
    expect(rate.known === false && rate.because).toBe('unreadable')
  })

  it('and a screen holding one cannot call the reading whole', () => {
    // `fullyRead` asks whether every store ANSWERED. A never-read store has no
    // problem to report, so a naive check on `problem === null` calls it read —
    // which is the trap this case exists for.
    const overview = {
      facts: unread(),
      superseded: n(0),
      retrievals: n(0),
      misses: n(0),
      transcripts: n(0),
      packs: n(0)
    } as MemoryOverview
    expect(fullyRead(overview)).toBe(false)
  })

  it('but every store answering IS whole, including at zero', () => {
    const overview = {
      facts: n(0),
      superseded: n(0),
      retrievals: n(0),
      misses: n(0),
      transcripts: n(0),
      packs: n(0)
    } as MemoryOverview
    expect(fullyRead(overview)).toBe(true)
  })
})
