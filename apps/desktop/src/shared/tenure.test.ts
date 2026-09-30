import { describe, expect, it } from 'vitest'
import { tenureFrom } from './tenure.ts'

const now = new Date('2026-09-05T12:00:00Z')

describe('how long the estate has been running', () => {
  it('counts whole days from the first event', () => {
    expect(tenureFrom('2026-09-01T00:00:00Z', now)).toEqual({
      known: true,
      days: 4,
      since: '2026-09-01T00:00:00Z'
    })
  })

  it('an estate with NOTHING recorded has no tenure — not zero days', () => {
    // Zero days would make an unstarted estate look like a new one. The same
    // family as a miss rate with no denominator: absent is not zero.
    expect(tenureFrom(null, now)).toEqual({ known: false, because: 'nothing-recorded' })
  })

  it('but an estate whose first event is TODAY has started, and says zero', () => {
    expect(tenureFrom('2026-09-05T09:00:00Z', now)).toEqual({
      known: true,
      days: 0,
      since: '2026-09-05T09:00:00Z'
    })
  })

  it('never reports a negative age when the clock disagrees with the database', () => {
    const future = tenureFrom('2026-09-09T00:00:00Z', now)
    expect(future).toMatchObject({ known: true, days: 0 })
  })

  it('an unparseable timestamp is unknown rather than a wild number', () => {
    expect(tenureFrom('not a date', now)).toEqual({ known: false, because: 'nothing-recorded' })
  })
})
