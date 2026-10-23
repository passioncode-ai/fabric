import { describe, expect, it } from 'vitest'
import { boundedMarks } from './commsMarks'
import { COMMS_READ_THROUGH_MAX } from './appSettings'

describe('boundedMarks (CO-312)', () => {
  it('merges by the larger seq and leaves a small set alone', () => {
    expect(boundedMarks({ a: 5, b: 9 }, { a: 7, b: 3, c: 1 }, null, 10)).toEqual({ a: 7, b: 9, c: 1 })
  })
  it('over the bound, drops threads the whole list of heads no longer has, never the ones being marked', () => {
    expect(boundedMarks({ a: 1, b: 2, c: 3 }, { d: 4 }, { ids: ['c', 'x'], whole: true }, 3)).toEqual({ c: 3, d: 4 })
  })
  it('with a cut list of heads drops nothing for being unlisted, and keeps the newest marks to fit', () => {
    expect(boundedMarks({ a: 1, b: 2, c: 3 }, { d: 4 }, { ids: ['c'], whole: false }, 3)).toEqual({ b: 2, c: 3, d: 4 })
    expect(Object.keys(boundedMarks(Object.fromEntries(Array.from({ length: 6000 }, (_, i) => [`t${i}`, i])), { new: 9999 }, null)).length).toBe(COMMS_READ_THROUGH_MAX)
  })
  it('«Mark all read» over every thread the board lists keeps every mark (0.3.12 review DA-12)', () => {
    // The board lists up to 5000 thread heads (`board_thread_heads_operator`, p_limit 5000); 4097 or 5000 listed
    // threads marked at once must all stay marked, or the badge cannot clear.
    for (const n of [4097, 5000]) {
      const ids = Array.from({ length: n }, (_, i) => `t${i}`)
      const all = Object.fromEntries(ids.map((id, i) => [id, i + 1]))
      expect(Object.keys(boundedMarks({}, all, { ids, whole: true })).length, String(n)).toBe(n)
    }
  })
})
