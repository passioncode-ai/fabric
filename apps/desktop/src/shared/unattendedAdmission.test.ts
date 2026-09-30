import { describe, expect, it } from 'vitest'
import { createUnattendedAdmission } from './unattendedAdmission.ts'
import type { Quota } from './types'

const quota = (over: Partial<Quota> = {}): Quota => ({
  fiveHour: { utilization: 10, resetsAt: null },
  sevenDay: { utilization: 20, resetsAt: null },
  byModel: {},
  readAt: '2026-09-10T01:00:00.000Z',
  ageSeconds: 5,
  problem: null,
  account: 'acct-a',
  ...over
})

describe('one reading authorises one unattended start (FA-03)', () => {
  it('admits the first start on a good reading', () => {
    const door = createUnattendedAdmission()
    expect(door.claim(quota()).ok).toBe(true)
  })

  it('REFUSES a second start on the SAME reading', () => {
    // MEASURED: `routineTick` took one verdict and started up to
    // MAX_STARTS_PER_POLL routines from it. Three admissions spent one
    // observation of the remainder.
    const door = createUnattendedAdmission()
    expect(door.claim(quota()).ok).toBe(true)
    const second = door.claim(quota())
    expect(second.ok).toBe(false)
    expect(second.reasonCode).toBe('already-spent')
  })

  it('admits again once the reading has moved', () => {
    const door = createUnattendedAdmission()
    expect(door.claim(quota()).ok).toBe(true)
    expect(door.claim(quota({ readAt: '2026-09-10T01:02:00.000Z' })).ok).toBe(true)
  })

  it('treats a reading for another account as another reading, not the same one', () => {
    const door = createUnattendedAdmission()
    expect(door.claim(quota()).ok).toBe(true)
    expect(door.claim(quota({ account: 'acct-b' })).ok).toBe(true)
  })

  it('does not spend a reading it refused', () => {
    // A refusal must not consume the observation: the next caller would then be
    // told the remainder was already spent on a start that never happened.
    const door = createUnattendedAdmission()
    expect(door.claim(quota({ fiveHour: null, sevenDay: null })).ok).toBe(false)
    expect(door.claim(quota()).ok).toBe(true)
  })

  it('refuses an empty, stale or corrupt reading before it considers spending it', () => {
    for (const bad of [
      quota({ fiveHour: null, sevenDay: null }),
      quota({ ageSeconds: 10_000 }),
      quota({ fiveHour: { utilization: Number.NaN, resetsAt: null } }),
      quota({ problem: 'throttled' }),
      null
    ]) {
      const door = createUnattendedAdmission()
      const v = door.claim(bad)
      expect(v.ok).toBe(false)
      expect(v.reasonCode).not.toBe('already-spent')
    }
  })

  it('still refuses over the threshold, and still names the window', () => {
    const door = createUnattendedAdmission()
    const v = door.claim(quota({ fiveHour: { utilization: 95, resetsAt: '2026-09-10T06:00:00Z' } }))
    expect(v.ok).toBe(false)
    expect(v.reasonCode).toBe('over-threshold')
    expect(v.window).toBe('fiveHour')
  })

  it('claims SYNCHRONOUSLY, which is what makes it atomic in one process', () => {
    // Two callers interleaving across an await is exactly how both would read
    // "not spent" and both start. The claim takes no promise and returns no
    // promise, so nothing can run between the check and the mark.
    const door = createUnattendedAdmission()
    const verdicts = [door.claim(quota()), door.claim(quota()), door.claim(quota())]
    expect(verdicts.filter((v) => v.ok)).toHaveLength(1)
  })
})
