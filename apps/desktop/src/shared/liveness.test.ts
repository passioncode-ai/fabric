import { describe, expect, it } from 'vitest'
import {
  LIVENESS,
  PHASES,
  UnorderedThresholds,
  deriveLiveness,
  validateThresholds,
  type Observation,
  type Thresholds
} from './liveness.ts'

const T: Thresholds = {
  expectedIntervalMs: 30_000,
  quietAfterMs: 90_000,
  stallAfterMs: 300_000,
  orientationGraceMs: 120_000,
  resumeGraceMs: 120_000
}
const now = 1_000_000_000
const obs = (over: Partial<Observation> = {}): Observation => ({
  processEnded: false,
  startedAt: now - 600_000,
  orientedAt: now - 590_000,
  lastOutputAt: now - 10_000,
  ...over
})
const read = (over: Partial<Parameters<typeof deriveLiveness>[0]> = {}) =>
  deriveLiveness({
    heartbeat: { beatSeq: 1, phase: 'working', receivedAt: now - 10_000 },
    beatsSupported: true,
    observation: obs(),
    thresholds: T,
    now,
    ...over
  })

describe('the three inputs are never merged', () => {
  it('reads a recent beat as working', () => {
    expect(read().state).toBe('working')
  })

  it('calls a long silence QUIET, and says it is not a fault', () => {
    // The state that must not cry wolf: a real tool call takes minutes, and an
    // alerting state that fires on thinking is one people learn to ignore.
    const got = read({ heartbeat: { beatSeq: 1, phase: 'working', receivedAt: now - 120_000 } })
    expect(got.state).toBe('quiet')
    expect(got.reason).toMatch(/Not a fault/i)
  })

  it('calls a much longer silence STALLED, as a suspicion and not a diagnosis', () => {
    const got = read({ heartbeat: { beatSeq: 1, phase: 'working', receivedAt: now - 400_000 } })
    expect(got.state).toBe('stalled')
    expect(got.reason).toMatch(/MAY be wrong|nothing here proves/i)
  })

  it('reads an ended process as gone, whatever the agent last claimed', () => {
    // The one input here that is not an inference.
    const got = read({
      observation: obs({ processEnded: true }),
      heartbeat: { beatSeq: 9, phase: 'working', receivedAt: now - 1_000 }
    })
    expect(got.state).toBe('gone')
  })

  it('has exactly the five states the ADR names, and one of them asserts a fault', () => {
    expect(LIVENESS).toEqual(['working', 'waiting', 'quiet', 'stalled', 'gone'])
    expect(PHASES).toEqual(['reading', 'working', 'waiting', 'verifying', 'blocked'])
  })
})

describe('a runner that cannot beat is answered from what was observed', () => {
  it('never calls it stalled, and declares that the coverage is unsupported', () => {
    // Silently giving an unwired runner a sixty-second fault threshold is how a
    // working agent gets reported dead.
    const got = read({
      beatsSupported: false,
      heartbeat: null,
      observation: obs({ lastOutputAt: now - 1_000_000 })
    })
    expect(got.state).not.toBe('stalled')
    expect(got.coverage).toBe('unsupported')
    expect(got.reason).toMatch(/not evidence of a fault/i)
  })

  it('separates "supports beats and none arrived" from "cannot beat"', () => {
    // Different problems: one is a session that may be broken, the other is a
    // runner nobody wired. Merging them makes the first invisible.
    const none = read({ heartbeat: null, observation: obs({ startedAt: now - 600_000 }) })
    expect(none.state).toBe('stalled')
    expect(none.coverage).toBe('unobserved')
  })
})

describe('the harness break — the signal nothing surfaced before', () => {
  it('catches a session producing output with no record of reading its rules', () => {
    // CORRECTED IN M179. This first asserted "the skill did not load", which is
    // a diagnosis rather than what the evidence supports: the append can fail
    // while the rules WERE delivered, and it is written when the request
    // arrives rather than when the response completes. The state is still a
    // suspicion worth surfacing; the sentence no longer claims a cause.
    const got = read({ observation: obs({ orientedAt: null }) })
    expect(got.state).toBe('stalled')
    expect(got.reason).toMatch(/no record of it reading its rules/i)
    expect(got.reason).toMatch(/not proof on its own/i)
  })

  it('does not fire before the grace, because orientation is not instant', () => {
    const got = read({ observation: obs({ orientedAt: null, startedAt: now - 10_000, lastOutputAt: now - 5_000 }) })
    expect(got.reason).not.toMatch(/no record of it reading its rules/i)
  })

  it('does not fire on a session that has produced nothing at all', () => {
    // No output and no orientation is a session that has not started working.
    // Calling that a harness break would alarm on every launch.
    const got = read({ observation: obs({ orientedAt: null, lastOutputAt: undefined }) })
    expect(got.reason).not.toMatch(/no record of it reading its rules/i)
  })

  it('outranks the beat gap, because the two have different answers', () => {
    const got = read({
      observation: obs({ orientedAt: null }),
      heartbeat: { beatSeq: 1, phase: 'working', receivedAt: now - 1_000 }
    })
    expect(got.reason).toMatch(/no record of it reading its rules/i)
  })

  it('is SUPPRESSED when the observer could not watch the interval', () => {
    // M179 — a stall reported from an interval nobody was watching is a guess
    // wearing the clothes of a measurement.
    const got = read({
      heartbeat: { beatSeq: 1, phase: 'working', receivedAt: now - 400_000 },
      gap: { owner: 'host_asleep', blameAgent: false, says: 'the machine was suspended', observedMs: 0 }
    })
    expect(got.state).toBe('quiet')
    expect(got.coverage).toBe('unobserved')
    expect(got.reason).toMatch(/Nothing here is a judgement about this agent/i)
  })

  it('still reports an ended process even across an observation gap', () => {
    // The one input that is not an inference. A process that exited exited,
    // whether or not anybody was watching when it did.
    const got = read({
      observation: obs({ processEnded: true }),
      gap: { owner: 'host_asleep', blameAgent: false, says: 'suspended', observedMs: 0 }
    })
    expect(got.state).toBe('gone')
  })
})

describe('waiting is an explanation, and it expires', () => {
  it('reads a blocked agent as waiting, naming what it waits on', () => {
    const got = read({
      heartbeat: {
        beatSeq: 3,
        phase: 'blocked',
        receivedAt: now - 400_000,
        waitingOn: { kind: 'question', id: 'q1' }
      }
    })
    // Past the stall threshold, and NOT stalled: the silence has a reason.
    expect(got.state).toBe('waiting')
    expect(got.reason).toMatch(/q1/)
  })

  it('keeps waiting for a grace after the thing was resolved', () => {
    const got = read({
      heartbeat: {
        beatSeq: 3,
        phase: 'waiting',
        receivedAt: now - 400_000,
        waitingOn: { kind: 'question', id: 'q1', resolvedAt: now - 10_000 }
      }
    })
    expect(got.state).toBe('waiting')
  })

  it('STOPS explaining once the thing was resolved and nothing was said since', () => {
    // The failure this prevents: an agent says "waiting on a question", the
    // operator answers it, and the agent stays "waiting" forever on a report
    // that is no longer true. The grace runs from the resolution, not the beat.
    const got = read({
      heartbeat: {
        beatSeq: 3,
        phase: 'waiting',
        receivedAt: now - 400_000,
        waitingOn: { kind: 'question', id: 'q1', resolvedAt: now - 400_000 }
      }
    })
    expect(got.state).toBe('stalled')
    expect(got.reason).toMatch(/no longer explains/i)
  })

  it('does not let a working agent name a blocker', () => {
    // A `working` phase carrying a blocker is describing a wish. The gap rules
    // apply to it like any other beat.
    const got = read({
      heartbeat: {
        beatSeq: 3,
        phase: 'working',
        receivedAt: now - 400_000,
        waitingOn: { kind: 'question', id: 'q1' }
      }
    })
    expect(got.state).toBe('stalled')
  })
})

describe('thresholds are checked, not trusted', () => {
  it('refuses an order in which stalled is reached before quiet', () => {
    // Out of order, the soft state never appears at all — which is the alerting
    // state losing the credibility the whole design rests on.
    expect(() => validateThresholds({ ...T, stallAfterMs: 1_000 })).toThrow(UnorderedThresholds)
  })

  it('refuses a zero or negative interval', () => {
    expect(() => validateThresholds({ ...T, expectedIntervalMs: 0 })).toThrow(UnorderedThresholds)
  })

  it('accepts an order where each threshold is at least the one before', () => {
    expect(validateThresholds({ ...T, quietAfterMs: 30_000 })).toBeTruthy()
  })
})
