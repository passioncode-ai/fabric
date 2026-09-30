import { describe, expect, it } from 'vitest'
import { RUN_OUTCOMES, RUN_STATES, belongsToRun, mayAdvance, outcomeRequired } from './taskRun.ts'

describe('a run walks forward and does not reopen', () => {
  it('walks admitted → launching → active → ending → ended', () => {
    const path: [string, string][] = [
      ['admitted', 'launching'],
      ['launching', 'active'],
      ['active', 'ending'],
      ['ending', 'ended']
    ]
    for (const [from, to] of path) expect(mayAdvance(from as never, to as never).ok).toBe(true)
  })

  it('lets any live state end, because a run can fail at any point', () => {
    for (const from of ['admitted', 'launching', 'active', 'ending'])
      expect(mayAdvance(from as never, 'ended').ok).toBe(true)
  })

  it('REFUSES to reopen an ended run, and says why a retry is a new one', () => {
    // A run that can be re-entered has no answer to "how long did it take" or
    // "what did it do": the second attempt overwrites the first's account.
    const got = mayAdvance('ended', 'active')
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.reason).toMatch(/a NEW run with its own id/)
  })

  it('refuses to skip backwards', () => {
    expect(mayAdvance('active', 'launching').ok).toBe(false)
    expect(mayAdvance('ending', 'active').ok).toBe(false)
  })

  it('refuses a move to the state it is already in', () => {
    expect(mayAdvance('active', 'active').ok).toBe(false)
  })

  it('requires an outcome exactly on ending', () => {
    expect(outcomeRequired('ended')).toBe(true)
    for (const s of ['admitted', 'launching', 'active', 'ending'])
      expect(outcomeRequired(s as never)).toBe(false)
  })

  it('keeps the runtime outcome apart from the task result', () => {
    // The runtime terminating and the work succeeding are different facts
    // (M180), so `completed` here means the run finished, not that it worked.
    expect(RUN_OUTCOMES).toContain('outcome_unknown')
    expect(RUN_STATES).toEqual(['admitted', 'launching', 'active', 'ending', 'ended'])
  })
})

describe('what belongs to a run', () => {
  it('stamps the work', () => {
    for (const t of ['task.moved@1', 'effect.observed@1', 'delivery.accepted@1'])
      expect(belongsToRun(t)).toBe(true)
  })

  it('does NOT stamp the machinery', () => {
    // A heartbeat and a cycle receipt describe the process rather than the
    // work; stamping them makes "what happened in this run" a list of
    // everything that happened while it was open.
    for (const t of ['agent.heartbeat@1', 'cycle.ran@1', 'session.observed@1'])
      expect(belongsToRun(t)).toBe(false)
  })
})
