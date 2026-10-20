import { describe, expect, it } from 'vitest'
import { answerSaid, validateAnswer } from './answerCommit.ts'

const options = [
  { id: 'a', label: 'postgres 17' },
  { id: 'b', label: 'postgres 15' }
]

describe('what may be submitted as an answer', () => {
  it('accepts free text when there are no options', () => {
    const got = validateAnswer({ answer: 'use whatever ships in the image', options: [] })
    expect(got.ok).toBe(true)
  })

  it('accepts a chosen option, and carries its label as the answer text', () => {
    const got = validateAnswer({ chosenOption: 'a', options })
    expect(got.ok).toBe(true)
    if (got.ok) {
      expect(got.value.chosenOption).toBe('a')
      // The text is what a later reader sees in project memory. An answer that
      // is only an opaque id is a decision nobody can read.
      expect(got.value.answer).toBe('postgres 17')
    }
  })

  it('lets free text accompany a chosen option, and keeps both', () => {
    const got = validateAnswer({ chosenOption: 'b', answer: 'and pin the minor', options })
    expect(got.ok).toBe(true)
    if (got.ok) expect(got.value.answer).toContain('and pin the minor')
  })

  it('refuses an empty answer with no option — there is nothing to record', () => {
    expect(validateAnswer({ options }).ok).toBe(false)
    expect(validateAnswer({ answer: '   ', options }).ok).toBe(false)
  })

  it('refuses an option id that is not in the CURRENT options', () => {
    // The stale-revision case: the question was revised and the option the
    // operator clicked no longer exists. Matching by label instead would answer
    // a different question with the same words.
    const got = validateAnswer({ chosenOption: 'gone', options })
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.reason).toMatch(/option/i)
  })

  it('never matches an option by its label', () => {
    const got = validateAnswer({ chosenOption: 'postgres 17', options })
    expect(got.ok).toBe(false)
  })

  it('caps the answer rather than putting an essay into project memory', () => {
    const got = validateAnswer({ answer: 'x'.repeat(9_000), options: [] })
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.reason).toMatch(/too long|shorter/i)
  })
})

// 0.3.7 review UX-6: the act line read «Ответ «opt_b» отправлен», the option's id in place of what was decided.
describe('the answer as the act line words it', () => {
  it('is the chosen option’s label, never its id', () => {
    expect(answerSaid({ chosenOption: 'b', options })).toBe('postgres 15')
    expect(answerSaid({ chosenOption: 'b', options })).not.toBe('b')
  })
  it('is what the person wrote when there is no option', () => {
    expect(answerSaid({ answer: '  keep 16  ', options })).toBe('keep 16')
  })
})
