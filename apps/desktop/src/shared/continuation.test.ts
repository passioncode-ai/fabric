import { describe, expect, it } from 'vitest'
import {
  CONTINUATION_STATES,
  RETRY_TOUCHES,
  mayRetry,
  needsNewSession,
  retryPlan,
  routeContinuation,
  type Target
} from './continuation.ts'

const target = (over: Partial<Target> = {}): Target => ({
  taskId: 't1',
  taskRunId: 'r1',
  sessionId: 's1',
  sessionLive: true,
  runEnded: false,
  ...over
})
const route = (over: Partial<Parameters<typeof routeContinuation>[0]> = {}) =>
  routeContinuation({ target: target(), superseded: false, otherBlockers: 0, ...over })

describe('where an answer goes, and what happens when it cannot', () => {
  it('delivers to the live session that asked', () => {
    const got = route()
    expect(got.state).toBe('delivering')
    expect(got.deliver).toBe(true)
  })

  it('calls a dead target NEEDS_RESTART, not a failed delivery', () => {
    // The session may have ended while the operator was thinking. Filing that
    // as a failure invites a retry that cannot possibly work.
    for (const t of [target({ sessionLive: false }), target({ runEnded: true }), target({ sessionId: null })]) {
      const got = route({ target: t })
      expect(got.state).toBe('needs_restart')
      expect(got.deliver).toBe(false)
    }
  })

  it('says the decision is still good when the target is gone', () => {
    const got = route({ target: target({ sessionLive: false }) })
    expect(got.says).toMatch(/still good/)
    expect(got.says).toMatch(/new session carrying it/)
  })

  it('does not deliver an answer a later one replaced', () => {
    // Delivering a replaced decision is worse than delivering nothing.
    const got = route({ superseded: true })
    expect(got.state).toBe('obsolete')
    expect(got.deliver).toBe(false)
  })

  it('checks supersession BEFORE the target, because a replaced answer must not go out at all', () => {
    const got = route({ superseded: true, target: target({ sessionLive: false }) })
    expect(got.state).toBe('obsolete')
  })

  it('holds the answer while other blockers are open, and says why', () => {
    // Sending it now would tell the agent to carry on into a wall it is still
    // behind.
    const got = route({ otherBlockers: 2 })
    expect(got.state).toBe('queued')
    expect(got.deliver).toBe(false)
    expect(got.says).toMatch(/into a wall it is still behind/)
  })

  it('enumerates the states, including the two that are not failures', () => {
    expect(CONTINUATION_STATES).toContain('needs_restart')
    expect(CONTINUATION_STATES).toContain('obsolete')
    expect(retryPlan('outcome_unknown').retryDelivery).toBe(false)
  })
})

describe('a retry retries the DELIVERY, never the answer', () => {
  it('never re-commits the answer, whatever the state', () => {
    // An answer is a decision the estate recorded once. Re-running the commit
    // because a socket dropped would record a second decision where a person
    // made one.
    for (const s of CONTINUATION_STATES) expect(retryPlan(s).recommitAnswer).toBe(false)
    expect(RETRY_TOUCHES.answerCommit).toBe(false)
    expect(RETRY_TOUCHES.grant).toBe(false)
  })

  it('retries only from states where the same delivery could work', () => {
    expect(mayRetry('retryable')).toBe(true)
    expect(mayRetry('queued')).toBe(true)
    for (const s of ['acked', 'obsolete', 'rejected', 'needs_restart'] as const)
      expect(mayRetry(s)).toBe(false)
  })

  it('separates "try again" from "start a new session"', () => {
    expect(needsNewSession('needs_restart')).toBe(true)
    expect(mayRetry('needs_restart')).toBe(false)
  })

  it('says plainly that the answer is not recorded twice', () => {
    expect(retryPlan('retryable').says).toMatch(/not recorded a second time/)
  })
})
