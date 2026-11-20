import { describe, expect, it } from 'vitest'
import { processGone } from './stop'

describe('processGone (the operator, 2026-11-19: «Завершить сессию» closes at once)', () => {
  it('is true for a stop and for an end whose process tree went quiet, false while the process may live', () => {
    expect(processGone({ sessionId: 's', state: 'stopped', reasonCode: 'unmanaged_shell_observed' })).toBe(true)
    expect(processGone({ sessionId: 's', state: 'outcome_unknown', reasonCode: 'provider_termination_unproved' })).toBe(true)
    expect(processGone({ sessionId: 's', state: 'outcome_unknown', reasonCode: 'termination_unproved' })).toBe(false)
    expect(processGone({ sessionId: 's', state: 'requested', reasonCode: 'stop_requested' })).toBe(false)
    expect(processGone({ sessionId: 's', state: 'refused', reasonCode: 'stop_request_refused' })).toBe(false)
    expect(processGone(null)).toBe(false)
  })
})
