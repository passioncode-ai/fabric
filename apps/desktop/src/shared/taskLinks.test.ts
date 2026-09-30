import { describe, expect, it } from 'vitest'
import { linkOutcome, linkRefusal, type LinkVerdict } from './taskLinks.ts'

describe('a link the command could not confirm is not a link', () => {
  it('refuses when the call itself failed', () => {
    const got = linkOutcome(null, { message: 'connection refused' })
    expect(got.linked).toBe(false)
    expect(got.reason_code).toBe('unavailable')
    expect(got.says).toContain('connection refused')
  })

  it('refuses a NULL verdict rather than reading it as no objection', () => {
    // The exact defect this replaces: `const { data: closes } = …` dropped the
    // error, so an unanswered question became "nothing said no" and the write
    // went ahead. An answer that did not arrive is not an answer that said yes.
    expect(linkOutcome(null, null).reason_code).toBe('unavailable')
    expect(linkOutcome(undefined, null).linked).toBe(false)
  })

  it('refuses a verdict that is the wrong shape', () => {
    expect(linkOutcome({ seq: 7 }, null).linked).toBe(false)
    expect(linkOutcome({ linked: 'yes' }, null).reason_code).toBe('unavailable')
  })

  it('passes a real refusal through with its code intact', () => {
    const cycle: LinkVerdict = { linked: false, reason_code: 'cycle', says: 'it loops', remedy: 'break the other edge' }
    expect(linkOutcome(cycle, null)).toEqual(cycle)
    expect(linkRefusal(cycle)).toBe('it loops break the other edge')
  })

  it('passes a success through, including the already-recorded one', () => {
    expect(linkOutcome({ linked: true, seq: 12 }, null).seq).toBe(12)
    expect(linkOutcome({ linked: true, already: true, reason_code: 'exists' }, null).already).toBe(true)
  })
})
