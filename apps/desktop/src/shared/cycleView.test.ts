import { describe, expect, it } from 'vitest'
import { isWorking, needsIntervention, observationOf, summarise, type CycleRow } from './cycleView.ts'

const now = 1_000_000_000
const EVERY = 60_000

const row = (over: Partial<CycleRow> = {}): CycleRow => ({
  cycleKey: 'routine:r1',
  kind: 'routine',
  projectId: 'p1',
  config: { state: 'enabled', cadenceMinutes: 60 },
  observation: { health: 'observed', lastCheckedAt: '2026-09-09T00:00:00Z', says: 'on schedule', explained: true },
  outcome: { last: 'started', at: '2026-09-09T00:00:00Z', reason: null },
  ...over
})

describe('observation is measured, never inferred from the cadence', () => {
  it('reports OBSERVED when the cycle receipt is recent', () => {
    const got = observationOf({ hasDetector: true, lastCycleAt: now - 30_000, now, expectedEveryMs: EVERY })
    expect(got.health).toBe('observed')
  })

  it('reports MONITOR ABSENT when the app was not running', () => {
    // "It should have run four times by now" is an expectation. Reporting one
    // as an observation claims health for a machine that was asleep.
    const got = observationOf({ hasDetector: true, lastCycleAt: now - 3_600_000, now, expectedEveryMs: EVERY })
    expect(got.health).toBe('monitor_absent')
    expect(got.says).toMatch(/no always-on process/i)
  })

  it('separates NO DETECTOR from no observation', () => {
    // An absence of instrumentation is not a fault, and a screen that renders
    // it as one teaches the operator to ignore the column.
    const got = observationOf({ hasDetector: false, lastCycleAt: now, now, expectedEveryMs: EVERY })
    expect(got.health).toBe('uninstrumented')
    expect(got.says).toMatch(/not a fault/)
  })

  it('reports monitor absent, not observed, when nothing has ever run', () => {
    expect(observationOf({ hasDetector: true, lastCycleAt: null, now, expectedEveryMs: EVERY }).health).toBe(
      'monitor_absent'
    )
  })
})

describe('started is not succeeded, and skipped is not failed', () => {
  it('counts a started task as working', () => {
    expect(isWorking(row())).toBe(true)
  })

  it('counts NOTHING TO DO as working, not as a failure', () => {
    expect(isWorking(row({ outcome: { last: 'skipped', at: null, reason: null } }))).toBe(true)
    expect(needsIntervention(row({ outcome: { last: 'skipped', at: null, reason: null } }))).toBe(false)
  })

  it('counts NOT DUE as working, and keeps it distinct from nothing to do', () => {
    // One is the clock, the other is the workload, and an operator chasing an
    // idle routine needs to know which.
    expect(isWorking(row({ outcome: { last: 'not_due', at: null, reason: null } }))).toBe(true)
  })

  it('asks for a person only on a real refusal or a real failure', () => {
    expect(needsIntervention(row({ outcome: { last: 'paused', at: null, reason: 'quota' } }))).toBe(true)
    expect(needsIntervention(row({ outcome: { last: 'failed', at: null, reason: 'threw' } }))).toBe(true)
    expect(needsIntervention(row({ outcome: { last: 'unknown', at: null, reason: null } }))).toBe(false)
  })

  it('does not call an unwatched routine working, however good its last outcome', () => {
    // The claim would be about the watched subset, and this row is not in it.
    const blind = row({ observation: { health: 'monitor_absent', lastCheckedAt: null, says: 'x', explained: true } })
    expect(isWorking(blind)).toBe(false)
  })
})

describe('the summary carries the number that makes the others honest', () => {
  it('counts enabled cycles nobody is watching, separately', () => {
    const got = summarise([
      row(),
      row({ cycleKey: 'b', observation: { health: 'monitor_absent', lastCheckedAt: null, says: 'x', explained: true } }),
      row({ cycleKey: 'c', outcome: { last: 'paused', at: null, reason: 'quota' } })
    ])
    expect(got.working).toBe(1)
    expect(got.needsIntervention).toBe(1)
    expect(got.unobserved).toBe(1)
    expect(got.says).toMatch(/enabled with nothing watching/)
  })

  it('says nothing about unobserved when everything is watched', () => {
    expect(summarise([row()]).says).not.toMatch(/nothing watching/)
  })

  it('does not count a disabled cycle as unobserved', () => {
    // Nobody watching something nobody asked for is not a gap.
    const off = row({ config: { state: 'disabled', cadenceMinutes: null }, observation: { health: 'monitor_absent', lastCheckedAt: null, says: 'x', explained: true } })
    expect(summarise([off]).unobserved).toBe(0)
  })
})

describe('a silence nobody can account for is work; a closed laptop is not', () => {
  // MEASURED at `4263727`: `readCycleGap` asserted that a long gap "means the
  // app was closed", and the repository's own code disproves it thirty lines
  // away — `index.ts` logs `cycle.receipt` when a pass ran and could not record
  // itself, which produces exactly this silence. So an estate whose passes were
  // running and failing to record looked identical to a laptop shut for the
  // night, and nothing asked for a person.
  it('asks for somebody when the absence has no established cause', () => {
    const unexplained = row({
      observation: { health: 'monitor_absent', lastCheckedAt: null, says: 'x', explained: false }
    })
    expect(needsIntervention(unexplained)).toBe(true)
  })

  it('but not for an overnight gap that explains itself', () => {
    // The other direction, and it is the one that keeps the first useful: if
    // every absence asked for a person, closing the laptop would queue work.
    const explained = row({
      observation: { health: 'monitor_absent', lastCheckedAt: null, says: 'x', explained: true }
    })
    expect(needsIntervention(explained)).toBe(false)
  })

  it('and an uninstrumented row is never work, however long it is silent', () => {
    const none = row({
      observation: { health: 'uninstrumented', lastCheckedAt: null, says: 'x', explained: true }
    })
    expect(needsIntervention(none)).toBe(false)
  })
})
