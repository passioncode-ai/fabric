import { describe, expect, it } from 'vitest'
import { classifyObservationGap, classifyOrientation, type HostWindow } from './harnessBreak.ts'

const now = 1_000_000_000
const host = (over: Partial<HostWindow> = {}): HostWindow => ({
  watchingSince: now - 3_600_000,
  suspended: [],
  sourceHealthy: true,
  ...over
})
const gap = (over: Partial<Parameters<typeof classifyObservationGap>[0]> = {}) =>
  classifyObservationGap({ since: now - 600_000, now, host: host(), ...over })

describe('the gap is classified before the agent is', () => {
  it('blames nobody when the machine was asleep for part of the interval', () => {
    // A laptop that slept for eight hours produces an eight-hour heartbeat gap
    // on every session. Reporting those as stalled is an alarm on every row at
    // the moment the operator opens the lid.
    const got = gap({ host: host({ suspended: [{ from: now - 500_000, to: now - 100_000 }] }) })
    expect(got.owner).toBe('host_asleep')
    expect(got.blameAgent).toBe(false)
  })

  it('reports how much of the interval was ACTUALLY watched', () => {
    // The number is what makes the suppression checkable rather than a shrug.
    const got = gap({ host: host({ suspended: [{ from: now - 500_000, to: now - 100_000 }] }) })
    expect(got.observedMs).toBe(200_000)
  })

  it('separates an observer that is blind from one that is not there', () => {
    // Different problems: one sends somebody to the database, the other to the
    // machine. Reporting the second when it is the first is a wasted hour.
    expect(gap({ host: host({ sourceHealthy: false }) }).owner).toBe('source_unreachable')
    expect(gap({ host: host({ watchingSince: now - 60_000 }) }).owner).toBe('observer_restarted')
  })

  it('checks the source BEFORE sleep, because a blind observer is the sharper fault', () => {
    const got = gap({
      host: host({ sourceHealthy: false, suspended: [{ from: now - 500_000, to: now - 100_000 }] })
    })
    expect(got.owner).toBe('source_unreachable')
  })

  it('does not mark work failed merely because the app restarted', () => {
    const got = gap({ host: host({ watchingSince: now - 60_000 }) })
    expect(got.blameAgent).toBe(false)
    expect(got.says).toMatch(/nobody watched|no longer running/i)
  })

  it('blames the agent only when the whole interval was watched', () => {
    const got = gap()
    expect(got.owner).toBe('observed')
    expect(got.blameAgent).toBe(true)
    expect(got.observedMs).toBe(600_000)
  })
})

describe('orientation is request-side evidence, and it has three answers', () => {
  const base = { startedAt: now - 600_000, producedOutput: true, now, graceMs: 120_000 }

  it('confirms a session that asked for its rules', () => {
    expect(classifyOrientation({ ...base, orientedAt: now - 590_000 }).verdict).toBe('confirmed')
  })

  it('says UNCONFIRMED rather than "the skill did not load"', () => {
    // The correction to M178: the append can fail while the rules WERE
    // delivered, and it is written when the request arrives rather than when
    // the response completes. "The skill did not load" is a diagnosis; this is
    // what the evidence supports.
    const got = classifyOrientation({ ...base, orientedAt: null })
    expect(got.verdict).toBe('unconfirmed')
    expect(got.says).toMatch(/not proof on its own/i)
    expect(got.says).toMatch(/may mean the record failed/i)
  })

  it('says nothing at all about a session too young to have oriented', () => {
    expect(classifyOrientation({ ...base, orientedAt: null, startedAt: now - 10_000 }).verdict).toBe('too_early')
  })

  it('says nothing about a session that has produced nothing', () => {
    // No output and no orientation is a session that has not started working.
    // Calling that a harness break would alarm on every launch.
    expect(classifyOrientation({ ...base, orientedAt: null, producedOutput: false }).verdict).toBe('too_early')
  })
})
