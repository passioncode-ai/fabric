import { describe, expect, it } from 'vitest'
import { FAILURE_KINDS, classifyFailure, type TerminationEvidence } from './failure.ts'

const ev = (over: Partial<TerminationEvidence> = {}): TerminationEvidence => ({
  exitCode: 0,
  deliveryAccepted: true,
  ...over
})

describe('an exit code answers a different question from the one anybody asks', () => {
  it('does not call a CLEAN exit a finished task', () => {
    // The measured defect: `task.finished@1` on process exit, which the
    // projector turns into status = finished. The process ended tidily; nobody
    // said the work was done.
    const got = classifyFailure(ev())
    expect(got?.kind).toBe('unknown')
    expect(got?.says).toMatch(/what it achieved is not recorded/i)
  })

  it('reads exit 127 as a runner that is not installed, not as an agent fault', () => {
    const got = classifyFailure(ev({ exitCode: 127 }))
    expect(got?.kind).toBe('runner-missing')
    expect(got?.origin).toBe('spawn')
    expect(got?.recovery).toContain('install_runner')
  })

  it('reads ENOENT the same way, whatever the code', () => {
    expect(classifyFailure(ev({ exitCode: null, spawnError: { code: 'ENOENT', message: 'x' } }))?.kind)
      .toBe('runner-missing')
  })

  it('is NOT a failure when Fabric asked for the shutdown', () => {
    // The app quitting used to mark every open task finished.
    expect(classifyFailure(ev({ exitCode: 143, requestedByFabric: true }))).toBeNull()
  })

  it('lets the agent OWN RESULT outrank the exit code', () => {
    // The only evidence about the work rather than about the process.
    const got = classifyFailure(ev({ exitCode: 1, agentReportedResult: 'failed' }))
    expect(got?.kind).toBe('task-failed-honestly')
    expect(got?.abnormal).toBe(false)
  })

  it('does not file an honest failure as a crash', () => {
    // A successful test of impossibility is a task outcome, and filing it as a
    // crash loses the finding.
    expect(classifyFailure(ev({ agentReportedResult: 'failed' }))?.origin).toBe('domain')
  })

  it('records nothing when the agent said it succeeded', () => {
    expect(classifyFailure(ev({ exitCode: 0, agentReportedResult: 'succeeded' }))).toBeNull()
  })

  it('reads a non-zero exit with no result as a crash', () => {
    const got = classifyFailure(ev({ exitCode: 1 }))
    expect(got?.kind).toBe('agent-crashed')
    expect(got?.certainty).toBe('observed')
  })
})

describe('evidence decides the certainty, not the conclusion', () => {
  it('makes a gap-only wedge a SUSPICION', () => {
    // Presenting a suspicion as a diagnosis is how an operator learns to
    // distrust the whole taxonomy.
    const got = classifyFailure(ev({ heartbeatGapMs: 900_000 }))
    expect(got?.kind).toBe('agent-wedged')
    expect(got?.certainty).toBe('suspected')
  })

  it('will not call it skill-failed-to-load without a reported loader error', () => {
    // A missing orientation record is request-side evidence only (M179), and
    // may not produce this kind.
    const got = classifyFailure(ev({ orientationConfirmed: false }))
    expect(got?.kind).not.toBe('skill-failed-to-load')
  })

  it('does call it skill-failed-to-load when the harness actually reported one', () => {
    const got = classifyFailure(ev({ loaderError: 'the skill manifest did not parse' }))
    expect(got?.kind).toBe('skill-failed-to-load')
    expect(got?.certainty).toBe('observed')
  })

  it('flags a clean exit that never acknowledged the instruction', () => {
    // It may have exited before reading it. Nothing here says the work was
    // done, and the old code called this finished.
    const got = classifyFailure(ev({ deliveryAccepted: false }))
    expect(got?.abnormal).toBe(true)
    expect(got?.retryability).toBe('reconcile_only')
  })

  it('offers reconcile rather than retry where something may already have happened', () => {
    expect(classifyFailure(ev({ heartbeatGapMs: 900_000 }))?.recovery).toContain('reconcile_effect')
  })

  it('enumerates the kinds ADR-0040 names', () => {
    for (const k of ['runner-missing', 'skill-failed-to-load', 'agent-wedged', 'task-failed-honestly'])
      expect(FAILURE_KINDS).toContain(k)
  })
})
