import { describe, expect, it } from 'vitest'
import { boundedMarks } from './commsMarks'

describe('boundedMarks (CO-312)', () => {
  it('merges by the larger seq and leaves a small set alone', () => {
    expect(boundedMarks({ a: 5, b: 9 }, { a: 7, b: 3, c: 1 }, null, 10)).toEqual({ a: 7, b: 9, c: 1 })
  })
  it('over the bound, drops threads the whole list of heads no longer has, never the ones being marked', () => {
    expect(boundedMarks({ a: 1, b: 2, c: 3 }, { d: 4 }, { ids: ['c', 'x'], whole: true }, 3)).toEqual({ c: 3, d: 4 })
  })
  it('with a cut list of heads drops nothing for being unlisted, and keeps the newest marks to fit', () => {
    expect(boundedMarks({ a: 1, b: 2, c: 3 }, { d: 4 }, { ids: ['c'], whole: false }, 3)).toEqual({ b: 2, c: 3, d: 4 })
    expect(Object.keys(boundedMarks(Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`t${i}`, i])), { new: 9999 }, null)).length).toBe(4096)
  })
})
