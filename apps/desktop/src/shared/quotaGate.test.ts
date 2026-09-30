import { describe, expect, it } from 'vitest'
import { DEFAULT_THRESHOLD, mayStart } from './quotaGate.ts'
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

describe('starting work nobody is watching', () => {
  it('NEVER blocks the operator, at any utilisation', () => {
    // The whole design in one test. A person starting something at 99% is
    // present and will see it stop; that is their call to make and not this
    // function's. Blocking them turns a safety rail into a nanny.
    const full = quota({ fiveHour: { utilization: 100, resetsAt: null } })
    expect(mayStart(full, 'operator').ok).toBe(true)
    expect(mayStart(null, 'operator').ok).toBe(true)
  })

  it('lets unattended work start with room to finish', () => {
    expect(mayStart(quota(), 'unattended').ok).toBe(true)
  })

  it('blocks unattended work at the threshold and NAMES the window and its reset', () => {
    // "Wait an hour" and "wait until the weekly window turns over" are different
    // answers. A gate that says only "quota" makes them one shrug.
    const v = mayStart(quota({ fiveHour: { utilization: 95, resetsAt: '2026-09-05T20:00:00Z' } }), 'unattended')
    expect(v.ok).toBe(false)
    expect(v.window).toBe('fiveHour')
    expect(v.reason).toContain('five-hour')
    expect(v.reason).toContain('2026-09-05T20:00:00Z')
  })

  it('reports the SEVEN-DAY window when that is the one that is full', () => {
    const v = mayStart(quota({ sevenDay: { utilization: 99, resetsAt: null } }), 'unattended')
    expect(v.window).toBe('sevenDay')
    expect(v.reason).toContain('seven-day')
    expect(v.reason).toContain('no reset time')
  })

  it('BLOCKS unattended work when the quota could not be read', () => {
    // Absent is not zero and not a hundred: it is "we cannot see", and the
    // reason this gate exists is that nobody else is looking either.
    //
    // Asserted on the CODE rather than on a shared phrase (FA-03). This used to
    // require every refusal to contain "could not be read", which forced three
    // different causes into one sentence — and a refusal an operator cannot tell
    // apart from another refusal is the shape that hid the empty reading.
    const cases: [Quota | null, string][] = [
      [null, 'no-reading'],
      [quota({ problem: 'unreachable' }), 'reported'],
      [quota({ problem: 'no-credential' }), 'reported'],
      [quota({ fiveHour: null, sevenDay: null }), 'empty'],
      [quota({ fiveHour: { utilization: Number.NaN, resetsAt: null } }), 'not-finite'],
      [quota({ ageSeconds: 100000 }), 'stale']
    ]
    for (const [q, why] of cases) {
      const v = mayStart(q, 'unattended')
      expect(v.ok).toBe(false)
      expect(v.reasonCode).toBe(why)
      expect(v.reason && v.reason.length).toBeGreaterThan(30)
    }
  })

  it('treats the threshold as reached, not merely passed', () => {
    // At exactly the threshold there is by definition only the margin the
    // threshold was chosen to preserve, so this is the boundary that matters.
    const at = quota({ fiveHour: { utilization: DEFAULT_THRESHOLD, resetsAt: null } })
    expect(mayStart(at, 'unattended').ok).toBe(false)
    const under = quota({ fiveHour: { utilization: DEFAULT_THRESHOLD - 0.1, resetsAt: null } })
    expect(mayStart(under, 'unattended').ok).toBe(true)
  })

  it('ignores a window the account does not report rather than reading it as full', () => {
    // A plan with no seven-day window must not be treated as a blocked one.
    // Still true after FA-03, and the reason it is still true matters: ONE
    // missing window is a fact about the plan. NO windows is a fact about the
    // reading, and that case is refused above.
    expect(mayStart(quota({ sevenDay: null }), 'unattended').ok).toBe(true)
    expect(mayStart(quota({ fiveHour: null }), 'unattended').ok).toBe(true)
    expect(mayStart(quota({ fiveHour: null, sevenDay: null }), 'unattended').ok).toBe(false)
  })

  it('honours a threshold the caller chose', () => {
    const q = quota({ fiveHour: { utilization: 50, resetsAt: null } })
    expect(mayStart(q, 'unattended', 40).ok).toBe(false)
    expect(mayStart(q, 'unattended', 60).ok).toBe(true)
  })
})
