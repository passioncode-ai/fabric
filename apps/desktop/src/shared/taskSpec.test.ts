import { describe, expect, it } from 'vitest'
import { specGaps, specMissing } from './taskSpec'

describe('a task spec is whole when the brief has its three parts (ADR-0176 §1)', () => {
  it('names each missing part in the brief\'s order', () => {
    expect(specGaps({})).toEqual(['what', 'why', 'expected'])
    expect(specGaps({ brief_what: 'Make it', brief_why: null, brief_expected: '  ' })).toEqual(['why', 'expected'])
    expect(specGaps({ brief_what: 'a', brief_why: 'b', brief_expected: 'c' })).toEqual([])
  })

  it('says so on a task to do or in work, never on a finished or cancelled one', () => {
    expect(specMissing({ status: 'running', brief_what: 'a' })).toBe(true)
    expect(specMissing({ status: 'backlog' })).toBe(true)
    expect(specMissing({ status: 'review' })).toBe(true)
    expect(specMissing({ status: 'done' })).toBe(false)
    expect(specMissing({ status: 'cancelled' })).toBe(false)
    expect(specMissing({ status: 'running', brief_what: 'a', brief_why: 'b', brief_expected: 'c' })).toBe(false)
  })
})
