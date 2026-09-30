import { describe, expect, it } from 'vitest'
import { outcomeOfExit } from './runOutcome.ts'

describe('how a run ended, read from how its process left (AX-01)', () => {
  it('exit 0 is completed — the RUNTIME finished, whatever the work achieved', () => {
    expect(outcomeOfExit({ code: 0 })).toBe('completed')
  })

  it('a non-zero code is a KNOWN failure, because the process said so', () => {
    expect(outcomeOfExit({ code: 1 })).toBe('failed_known')
    expect(outcomeOfExit({ code: 137 })).toBe('failed_known')
  })

  it('NO exit code is outcome_unknown, never a failure', () => {
    // The process may have finished perfectly and taken its code with it.
    // Recording that as failure invents an outcome; the fourth outcome exists so
    // the estate can say "we do not know" out loud.
    expect(outcomeOfExit({ code: null })).toBe('outcome_unknown')
    expect(outcomeOfExit({ code: undefined as unknown as number })).toBe('outcome_unknown')
    expect(outcomeOfExit({ code: Number.NaN })).toBe('outcome_unknown')
  })

  it('a cancellation is its own outcome, above any code the process left', () => {
    expect(outcomeOfExit({ code: 0, cancelled: true })).toBe('cancelled')
    expect(outcomeOfExit({ code: 1, cancelled: true })).toBe('cancelled')
    expect(outcomeOfExit({ code: null, cancelled: true })).toBe('cancelled')
  })
})
