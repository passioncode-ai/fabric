import { describe, expect, it } from 'vitest'
import { dueRoutines, nextDue, type Routine } from './routine.ts'

const T0 = Date.parse('2026-09-05T12:00:00Z')
const r = (over: Partial<Routine> = {}): Routine => ({
  id: 'r1',
  projectId: 'p1',
  instruction: 'work the backlog',
  optionId: 'claude-code',
  everyMinutes: 1440,
  lastRunAt: '2026-09-05T11:00:00Z',
  running: false,
  enabled: true,
  ...over
})

describe('which routines start now', () => {
  it('runs one that has never run, so the operator sees it work', () => {
    const [d] = dueRoutines([r({ lastRunAt: null })], T0)
    expect(d.because).toContain('never run')
  })

  it('does not run one whose interval has not elapsed', () => {
    expect(dueRoutines([r()], T0)).toEqual([])
  })

  it('RUNS ONCE after three days shut, not three times', () => {
    // The rule that fails invisibly. A catch-up reading turns a week away into a
    // queue of agents all starting at once — precisely the shape M94 warns
    // about. A routine says "keep this current", not "produce three reports".
    const threeDaysAgo = new Date(T0 - 3 * 24 * 60 * 60_000).toISOString()
    const due = dueRoutines([r({ lastRunAt: threeDaysAgo })], T0)
    expect(due).toHaveLength(1)
  })

  it('does NOT start over its own last run', () => {
    // Two agents on one backlog is the contention the lease exists for, and a
    // scheduler that creates it every night has made a bug into a schedule.
    const old = new Date(T0 - 3 * 24 * 60 * 60_000).toISOString()
    expect(dueRoutines([r({ lastRunAt: old, running: true })], T0)).toEqual([])
  })

  it('skips a disabled routine even when it is overdue', () => {
    const old = new Date(T0 - 10 * 24 * 60 * 60_000).toISOString()
    expect(dueRoutines([r({ lastRunAt: old, enabled: false })], T0)).toEqual([])
  })

  it('never runs a routine whose timestamp cannot be read', () => {
    // An unreadable timestamp is not "a long time ago". Read that way, one
    // corrupt row runs every tick, forever.
    expect(dueRoutines([r({ lastRunAt: 'not a date' })], T0)).toEqual([])
  })

  it('is due exactly at the interval, not a tick later', () => {
    const exactly = new Date(T0 - 1440 * 60_000).toISOString()
    expect(dueRoutines([r({ lastRunAt: exactly })], T0)).toHaveLength(1)
  })
})

describe('when a routine is next expected', () => {
  it('gives a time when there is one', () => {
    expect(nextDue(r(), T0)).toBe('2026-09-06T11:00:00.000Z')
  })

  it('says NULL rather than inventing a time for one that is overdue or new', () => {
    // Null is "as soon as the next tick comes round", which is a different
    // statement from a time — and rendering it as one is a measurement nobody
    // took.
    expect(nextDue(r({ lastRunAt: null }), T0)).toBeNull()
    expect(nextDue(r({ lastRunAt: '2026-09-01T00:00:00Z' }), T0)).toBeNull()
    expect(nextDue(r({ enabled: false }), T0)).toBeNull()
  })
})
