import { describe, expect, it } from 'vitest'
import { MAX_SNAPSHOT_AGE_SECONDS, readSnapshot } from './quotaSnapshot.ts'
import type { Quota } from './types'

const quota = (over: Partial<Quota> = {}): Quota => ({
  fiveHour: { utilization: 10, resetsAt: '2026-09-05T20:00:00Z' },
  sevenDay: { utilization: 20, resetsAt: '2026-09-09T00:00:00Z' },
  byModel: {},
  readAt: '2026-09-05T17:00:00Z',
  ageSeconds: 5,
  problem: null,
  account: 'acct-a',
  ...over
})

describe('a reading that contains nothing is not a reading (FA-03)', () => {
  it('accepts a complete, fresh, finite reading', () => {
    const got = readSnapshot(quota())
    expect(got.ok).toBe(true)
  })

  it('REFUSES a reading with no windows at all — an HTTP 200 with an empty body', () => {
    // MEASURED: the producer built `{ fiveHour: null, sevenDay: null,
    // problem: null }` from a 200 whose body was `{}`, and the gate skipped both
    // absent windows and returned ok. An empty answer became a green light.
    const got = readSnapshot(quota({ fiveHour: null, sevenDay: null }))
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.why).toBe('empty')
  })

  it('still accepts a plan that reports only one of the two windows', () => {
    // The distinction the type could not make. A plan with no seven-day window
    // is a fact about the PLAN; a reading with no windows is a fact about the
    // READING, and only the second is a failure. Collapsing them is what made
    // the empty body look like a plan with no windows.
    expect(readSnapshot(quota({ sevenDay: null })).ok).toBe(true)
    expect(readSnapshot(quota({ fiveHour: null })).ok).toBe(true)
  })

  it('REFUSES a utilisation that is not a finite number', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const got = readSnapshot(quota({ fiveHour: { utilization: bad, resetsAt: null } }))
      expect(got.ok).toBe(false)
      if (!got.ok) expect(got.why).toBe('not-finite')
    }
  })

  it('REFUSES a utilisation outside the range a percentage can hold', () => {
    for (const bad of [-1, 100.1, 1e9]) {
      const got = readSnapshot(quota({ fiveHour: { utilization: bad, resetsAt: null } }))
      expect(got.ok).toBe(false)
      if (!got.ok) expect(got.why).toBe('out-of-range')
    }
  })

  it('REFUSES a reading the producer already marked as a problem', () => {
    const got = readSnapshot(quota({ problem: 'throttled' }))
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.why).toBe('reported')
  })

  it('REFUSES a reading older than a run takes to start', () => {
    const got = readSnapshot(quota({ ageSeconds: MAX_SNAPSHOT_AGE_SECONDS + 1 }))
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.why).toBe('stale')
  })

  it('REFUSES a reading taken for a different account', () => {
    const got = readSnapshot(quota(), { account: 'acct-b' })
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.why).toBe('wrong-account')
  })

  it('does not invent an account expectation nobody stated', () => {
    // One account exists today. The field is enforced when an expectation is
    // GIVEN, so the rule is testable now and binding the day a second account
    // arrives — rather than a check that has to be remembered then.
    expect(readSnapshot(quota({ account: null })).ok).toBe(true)
    expect(readSnapshot(quota({ account: null }), { account: 'acct-b' }).ok).toBe(false)
  })

  it('REFUSES nothing at all', () => {
    const got = readSnapshot(null)
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.why).toBe('no-reading')
  })

  it('says WHY in a sentence an operator can act on, for every refusal', () => {
    const refusals = [
      readSnapshot(null),
      readSnapshot(quota({ fiveHour: null, sevenDay: null })),
      readSnapshot(quota({ problem: 'unreachable' })),
      readSnapshot(quota({ ageSeconds: 99999 })),
      readSnapshot(quota({ fiveHour: { utilization: Number.NaN, resetsAt: null } }))
    ]
    for (const r of refusals) {
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.says.length).toBeGreaterThan(30)
    }
  })
})
