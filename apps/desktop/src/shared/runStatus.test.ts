import { describe, expect, it } from 'vitest'
import { isTrustworthy, progressLine, runLine, twoHeadings, type RunStatusView } from './runStatus.ts'

const view = (over: Partial<RunStatusView> = {}): RunStatusView => ({
  taskId: 't1',
  taskTitle: 'wire the outbox',
  runRef: 'r1',
  ordinal: 2,
  runState: 'active',
  runOutcome: null,
  claim: { phase: 'working', reportedAt: '2026-09-09T12:00:00Z', waitingOn: null },
  observation: {
    liveness: 'working',
    reason: 'it reported "working"',
    coverage: 'available',
    processRunning: true,
    lastOutputAt: '2026-09-09T12:00:00Z'
  },
  blockers: 0,
  steps: { done: 0, declared: 0, skipped: 0, failed: 0 },
  ...over
})

describe('claim and observation are two headings, never one badge', () => {
  it('says WHO said the phase', () => {
    // A phase that reads like a status is a status as far as anybody scanning
    // is concerned (ADR-0008).
    const got = twoHeadings(view())
    expect(got.claim).toMatch(/^it says:/)
    expect(got.observed).toMatch(/^Fabric sees:/)
  })

  it('reports an agent that has said nothing as exactly that', () => {
    const got = twoHeadings(view({ claim: { phase: null, reportedAt: null, waitingOn: null } }))
    expect(got.claim).toMatch(/has not said what it is doing/)
  })

  it('carries the blocker into the claim line when the agent named one', () => {
    const got = twoHeadings(
      view({ claim: { phase: 'blocked', reportedAt: 'x', waitingOn: { kind: 'question', id: 'q1' } } })
    )
    expect(got.claim).toMatch(/waiting on a question/)
  })

  it('keeps the observation independent of what the agent claimed', () => {
    // The agent says it is working; Fabric has not heard from it in a while.
    // Both are shown, and neither overwrites the other.
    const got = twoHeadings(
      view({
        claim: { phase: 'working', reportedAt: 'x', waitingOn: null },
        observation: { ...view().observation, liveness: 'stalled', reason: 'no heartbeat for 900s' }
      })
    )
    expect(got.claim).toMatch(/working/)
    expect(got.observed).toMatch(/stalled/)
  })
})

describe('no invented total', () => {
  it('says NO PLAN rather than 0 of 0', () => {
    // A progress bar renders 0 of 0 as complete, and an agent that declared no
    // plan has not finished — it has not said what it intends.
    expect(progressLine({ done: 0, declared: 0, skipped: 0, failed: 0 })).toBe('no plan declared')
  })

  it('counts against what was DECLARED, and names skipped and failed apart', () => {
    expect(progressLine({ done: 2, declared: 5, skipped: 1, failed: 1 })).toBe(
      '2 of 5 declared · 1 skipped, 1 failed'
    )
  })

  it('does not mention skipped or failed when there are none', () => {
    expect(progressLine({ done: 2, declared: 5, skipped: 0, failed: 0 })).toBe('2 of 5 declared')
  })
})

describe('the run is named from its admission, never derived', () => {
  it('says which attempt this is', () => {
    expect(runLine({ ordinal: 2, runState: 'active', runOutcome: null })).toBe('run 2 · active')
  })

  it('names the outcome once it has ended', () => {
    expect(runLine({ ordinal: 1, runState: 'ended', runOutcome: 'failed_known' })).toBe('run 1 · ended failed_known')
  })

  it('says outcome_unknown rather than nothing when a run ended without one', () => {
    expect(runLine({ ordinal: 1, runState: 'ended', runOutcome: null })).toMatch(/outcome_unknown/)
  })

  it('does not call a bare terminal a broken run', () => {
    // A session with no admitted run is a real thing an operator does, not a
    // run that failed to start.
    expect(runLine({ ordinal: null, runState: null, runOutcome: null })).toBe('not admitted as a run')
  })
})

describe('what may be shown as authoritative', () => {
  it('trusts a reading whose coverage rests on something observed', () => {
    expect(isTrustworthy(view())).toBe(true)
  })

  it('does NOT trust a reading from a runner that cannot report', () => {
    // Rendering `unsupported` coverage as a confident state is the false alarm
    // M181 removed, put back by the surface.
    expect(isTrustworthy(view({ observation: { ...view().observation, coverage: 'unsupported' } }))).toBe(false)
    expect(isTrustworthy(view({ observation: { ...view().observation, coverage: 'unobserved' } }))).toBe(false)
  })
})
