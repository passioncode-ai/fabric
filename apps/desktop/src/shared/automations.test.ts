import { describe, expect, it } from 'vitest'
import { automationStates, isStuck, STUCK_AFTER, type AutomationRun } from './automations.ts'

const run = (at: string, outcome: 'ran' | 'paused', reason: string | null = null): AutomationRun => ({
  routineId: 'r1',
  at,
  outcome,
  taskId: outcome === 'ran' ? 't' : null,
  reason
})

describe('what has been happening to a routine', () => {
  it('reports when it last actually ran', () => {
    const s = automationStates([run('2026-09-01T00:00:00Z', 'ran')])
    expect(s.r1.lastRanAt).toBe('2026-09-01T00:00:00Z')
    expect(s.r1.consecutivePauses).toBe(0)
  })

  it('COUNTS the runs that did not happen, and carries the last reason', () => {
    // The rule the journalling exists for. A history of successes tells the
    // operator their automation is fine while it has been refused every night.
    const s = automationStates([
      run('2026-09-01T00:00:00Z', 'ran'),
      run('2026-09-02T00:00:00Z', 'paused', 'the five-hour quota window is at 95%'),
      run('2026-09-03T00:00:00Z', 'paused', 'the five-hour quota window is at 97%')
    ])
    expect(s.r1.consecutivePauses).toBe(2)
    expect(s.r1.stuckBecause).toContain('97%')
    expect(s.r1.lastRanAt).toBe('2026-09-01T00:00:00Z')
  })

  it('a successful run CLEARS the count', () => {
    // Otherwise a routine that failed on Monday and has run nightly since still
    // reads as stuck, and the one signal meaning "look at this" stops meaning
    // anything at all.
    const s = automationStates([
      run('2026-09-01T00:00:00Z', 'paused', 'quota'),
      run('2026-09-02T00:00:00Z', 'paused', 'quota'),
      run('2026-09-03T00:00:00Z', 'ran')
    ])
    expect(s.r1.consecutivePauses).toBe(0)
    expect(s.r1.stuckBecause).toBeNull()
    expect(s.r1.lastRanAt).toBe('2026-09-03T00:00:00Z')
  })

  it('gives the same answer whichever order the rows arrive in', () => {
    // A caller that queries newest-first and one that queries oldest-first must
    // not disagree about whether a routine is running.
    const rows = [
      run('2026-09-03T00:00:00Z', 'ran'),
      run('2026-09-01T00:00:00Z', 'paused', 'quota'),
      run('2026-09-02T00:00:00Z', 'paused', 'quota')
    ]
    const forwards = automationStates(rows)
    const backwards = automationStates([...rows].reverse())
    expect(forwards).toEqual(backwards)
    expect(forwards.r1.consecutivePauses).toBe(0)
  })

  it('keeps routines apart', () => {
    const s = automationStates([
      { ...run('2026-09-01T00:00:00Z', 'paused', 'quota'), routineId: 'a' },
      { ...run('2026-09-01T00:00:00Z', 'ran'), routineId: 'b' }
    ])
    expect(s.a.consecutivePauses).toBe(1)
    expect(s.b.consecutivePauses).toBe(0)
  })

  it('says nothing about a routine with no history rather than inventing a state', () => {
    expect(automationStates([])).toEqual({})
    expect(isStuck(undefined)).toBe(false)
  })

  it('calls it stuck only after a RUN of pauses, not one', () => {
    // One pause is ordinary: a window fills, a spawn fails, the next tick tries
    // again. A run of them is a routine that is not running.
    const pauses = (n: number) =>
      automationStates(
        Array.from({ length: n }, (_, i) => run(`2026-09-0${i + 1}T00:00:00Z`, 'paused', 'quota'))
      ).r1
    expect(isStuck(pauses(1))).toBe(false)
    expect(isStuck(pauses(STUCK_AFTER - 1))).toBe(false)
    expect(isStuck(pauses(STUCK_AFTER))).toBe(true)
  })
})
