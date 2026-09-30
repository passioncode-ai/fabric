// Whether an agent is alive, and what the answer rests on (M178, ADR-0040).
//
// MEASURED BEFORE THIS: `pty.ts#stateOf` answers `running | idle | ended` from
// one subtraction — no output for sixty seconds is `idle`. So an agent thinking
// through a long tool call, an agent blocked on a question nobody has answered,
// and an agent whose process is wedged all read the same, and the operator has
// no way to tell which. ADR-0040 says plainly why shortening that timer is not
// the fix: it would call the thinking one dead too, and a state that cries wolf
// is one people learn to ignore.
//
// THREE INPUTS, AND THEY ARE NEVER MERGED.
//
//   the CLAIM       — what the agent says about itself (a heartbeat). Cheap to
//                     produce, and the thing most likely to be broken is the
//                     reporter.
//   the OBSERVATION — what Fabric watched from outside: the process, its output.
//                     True, and nearly silent about intent.
//   the ORIENTATION — whether the session ever read its own rules. A session
//                     producing output that never called `fabric_whoami` is
//                     running WITHOUT the harness, and ADR-0040 calls this the
//                     load-bearing harness-break signal.
//
// ONLY ONE STATE ASSERTS A FAULT. `quiet` deliberately does not, because a real
// tool call takes minutes; `stalled` is a suspicion with a named reason, never a
// proven wedge.

/** What an agent may say it is doing. ENUMERATED, because an agent asked for a
 *  status invents a vocabulary otherwise (the same reason the task ladder is). */
import { classifyOrientation, type ObservationGap } from './harnessBreak.ts'

export const PHASES = ['reading', 'working', 'waiting', 'verifying', 'blocked'] as const
export type Phase = (typeof PHASES)[number]

/** Only these two phases may name something they wait on. A `working` agent
 *  naming a blocker is describing a wish, not a state. */
export const WAITING_PHASES: readonly Phase[] = ['waiting', 'blocked']

export const LIVENESS = ['working', 'waiting', 'quiet', 'stalled', 'gone'] as const
export type Liveness = (typeof LIVENESS)[number]

/**
 * How much of the answer rests on something observed.
 *
 * `unsupported` is not a failure and must never be treated as one: a runner that
 * cannot beat is a runner nobody wired a heartbeat into, and silently giving it
 * a universal sixty-second fault threshold is how a working agent gets reported
 * dead. It is DECLARED.
 */
export type Coverage = 'available' | 'unsupported' | 'unobserved'

export interface Thresholds {
  expectedIntervalMs: number
  quietAfterMs: number
  stallAfterMs: number
  /** How long a session may produce output without having read its rules before
   *  that becomes the harness-break signal. */
  orientationGraceMs: number
  /** After the thing an agent said it was waiting on is resolved, how long it
   *  has to say something before the wait stops being an explanation. */
  resumeGraceMs: number
}

export class UnorderedThresholds extends Error {
  constructor(t: Thresholds) {
    super(
      `stallAfterMs (${t.stallAfterMs}) must be at least quietAfterMs (${t.quietAfterMs}), which must be at ` +
        `least expectedIntervalMs (${t.expectedIntervalMs}). Out of order, an agent reaches "stalled" before ` +
        `"quiet" and the soft state never appears — which is the alerting state losing its credibility.`
    )
    this.name = 'UnorderedThresholds'
  }
}

export function validateThresholds(t: Thresholds): Thresholds {
  const positive = [t.expectedIntervalMs, t.quietAfterMs, t.stallAfterMs, t.orientationGraceMs, t.resumeGraceMs]
  if (positive.some((v) => !Number.isFinite(v) || v <= 0)) throw new UnorderedThresholds(t)
  if (!(t.stallAfterMs >= t.quietAfterMs && t.quietAfterMs >= t.expectedIntervalMs)) throw new UnorderedThresholds(t)
  return t
}

export interface HeartbeatClaim {
  beatSeq: number
  phase: Phase
  /** THE SERVER'S receive time, never the client's. A client clock a year out
   *  must not be able to make an agent look alive or dead. */
  receivedAt: number
  /** `resolvedAt` accepts null because the derivation already reads it —
   *  branch 5 tests `resolved === undefined || resolved === null` and treats
   *  both as still open. The type was narrower than the behaviour, so an
   *  assembler could not say "open" the way the code reads it (AX-02). */
  waitingOn?: { kind: 'question' | 'grant' | 'continuation'; id: string; resolvedAt?: number | null } | null
}

export interface Observation {
  /** What the harness watched: the process is gone, or it is not. */
  processEnded: boolean
  /** Last output seen, if the harness sees output at all. */
  lastOutputAt?: number
  /** Whether the session ever read its rules (`session.oriented@1`, M177).
   *  `null` means the record was READ and there is none; `undefined` with
   *  `orientationRead: false` means nobody looked. */
  orientedAt?: number | null
  /**
   * WHETHER ANYBODY LOOKED (AX-02).
   *
   * `classifyOrientation` treats `null` and `undefined` identically, so "no
   * orientation was recorded" and "nobody read the orientation" were one value
   * with two meanings — and the widget, which never read it, passed the
   * alarming one on every call: a fresh oriented worker was reported `stalled`
   * with `coverage: available`, for a record that existed.
   *
   * Absent counts as READ, so every existing caller keeps its meaning; only a
   * reader that admits it did not look gets the third answer.
   */
  orientationRead?: boolean
  /** When the session started, so the orientation grace has an origin. */
  startedAt: number
}

export interface LivenessReading {
  state: Liveness
  /** WHY, in a form an operator acts on. `stalled` without a reason is an alarm
   *  with no next step. */
  reason: string
  coverage: Coverage
  /** What the answer was computed from, so a surface can show its working
   *  rather than asking for trust. */
  evidence: string[]
}

/**
 * The reading, with its coverage told the truth about what was read (AX-02).
 *
 * ONE WRAPPER RATHER THAN EIGHT EDITS. The derivation below is a chain of eight
 * returns, each building its own `coverage`, and a reader that did not look up
 * the orientation must not receive `available` from any of them — `available`
 * is what made the widget's false stall arrive as a complete answer. Editing
 * every return site would work until somebody added a ninth.
 *
 * It degrades `available` only. `unsupported` and `unobserved` already say the
 * answer is partial, and overwriting them would lose which part.
 */
export function deriveLiveness(input: Parameters<typeof derive>[0]): LivenessReading {
  const reading = derive(input)
  if (input.observation.orientationRead !== false || reading.coverage !== 'available') return reading
  return {
    ...reading,
    coverage: 'unobserved',
    evidence: [...reading.evidence, 'orientation not read by this reader']
  }
}

function derive(input: {
  /** M179 — when the observer could not watch, the silence is the OBSERVER'S
   *  and agent-specific blame is suppressed. A stall reported from an interval
   *  nobody was watching is a guess wearing the clothes of a measurement. */
  gap?: ObservationGap
  heartbeat: HeartbeatClaim | null
  /** False when this runner has no heartbeat wired at all. */
  beatsSupported: boolean
  observation: Observation
  thresholds: Thresholds
  now: number
}): LivenessReading {
  const { heartbeat: hb, observation: obs, now } = input
  const t = validateThresholds(input.thresholds)
  const evidence: string[] = []

  // 0 — COULD THE OBSERVER SEE? Asked before anything is attributed. A laptop
  //     that slept for eight hours produces an eight-hour gap on every session,
  //     and calling all of them stalled is an alarm on every row at the moment
  //     the operator opens the lid.
  if (input.gap && !input.gap.blameAgent && !obs.processEnded)
    return {
      state: 'quiet',
      reason: `${input.gap.says}. Nothing here is a judgement about this agent.`,
      coverage: 'unobserved',
      evidence: [`observation gap: ${input.gap.owner}`]
    }

  // 1 — the process. The one thing here that is not an inference.
  if (obs.processEnded)
    return { state: 'gone', reason: 'the process ended', coverage: 'available', evidence: ['process exit'] }

  // 2 — ORIENTATION UNCONFIRMED, and M179 corrected what this used to say. The
  //     first version called a missing `session.oriented@1` a proven harness
  //     break — "the skill did not load". It is not proof: the append can fail
  //     while the rules WERE delivered, and it is written when the request
  //     arrives rather than when the response completes. `classifyOrientation`
  //     keeps the three answers apart, and this branch reports the middle one
  //     as a suspicion — which is what `stalled` means everywhere else here.
  const producedOutput = obs.lastOutputAt !== undefined && obs.lastOutputAt > obs.startedAt
  const orientation = classifyOrientation({
    orientedAt: obs.orientedAt,
    startedAt: obs.startedAt,
    producedOutput,
    now,
    graceMs: t.orientationGraceMs
  })
  // AX-02 — a suspicion needs somebody to have LOOKED. When the orientation
  // record was not read, this branch is skipped and the reading continues from
  // the beat, carrying `unobserved` coverage: the answer is real as far as it
  // goes and says which part of it nobody took. Suppressing the branch without
  // degrading the coverage would be the same false confidence in the other
  // direction.
  const orientationRead = obs.orientationRead !== false
  if (orientation.verdict === 'unconfirmed' && orientationRead)
    return {
      state: 'stalled',
      reason: orientation.says,
      coverage: 'available',
      evidence: ['no session.oriented@1', 'output observed']
    }

  // 3 — a runner with no heartbeat is answered from observation ALONE, and says
  //     so. Assigning it a beat threshold it was never wired for reports a
  //     working agent as dead.
  if (!input.beatsSupported) {
    const quietFor = obs.lastOutputAt === undefined ? null : now - obs.lastOutputAt
    return {
      state: quietFor !== null && quietFor > t.stallAfterMs ? 'quiet' : 'working',
      reason:
        'this runner does not report a heartbeat, so only its output is observed. Silence here is not evidence ' +
        'of a fault.',
      coverage: 'unsupported',
      evidence: obs.lastOutputAt === undefined ? [] : ['last output']
    }
  }

  // 4 — supported, but nothing has arrived yet.
  if (!hb) {
    const age = now - obs.startedAt
    return age > t.stallAfterMs
      ? {
          state: 'stalled',
          reason: 'no heartbeat has ever arrived from a session that reports them',
          coverage: 'unobserved',
          evidence: ['no agent.heartbeat@1']
        }
      : {
          state: 'quiet',
          reason: 'the session has not beaten yet, and has not been running long enough for that to mean anything',
          coverage: 'unobserved',
          evidence: ['no agent.heartbeat@1 yet']
        }
  }

  const gap = now - hb.receivedAt
  evidence.push(`beat #${hb.beatSeq}`, `${Math.round(gap / 1000)}s since the last beat`)

  // 5 — WAITING, and it expires. An agent said it was waiting on a question; the
  //     operator answered it. The old self-report must not keep explaining the
  //     silence forever — the grace runs from the RESOLUTION, not from the beat.
  if (WAITING_PHASES.includes(hb.phase) && hb.waitingOn) {
    const resolved = hb.waitingOn.resolvedAt
    if (resolved === undefined || resolved === null)
      return {
        state: 'waiting',
        reason: `waiting on ${hb.waitingOn.kind} ${hb.waitingOn.id}`,
        coverage: 'available',
        evidence: [...evidence, `waiting on ${hb.waitingOn.kind}`]
      }
    if (now - resolved <= t.resumeGraceMs)
      return {
        state: 'waiting',
        reason: `what it was waiting on was resolved; it has not spoken since, and has not had long to`,
        coverage: 'available',
        evidence: [...evidence, 'wait target resolved']
      }
    return {
      state: 'stalled',
      reason:
        `it said it was waiting on ${hb.waitingOn.kind} ${hb.waitingOn.id}, that was resolved, and it has not ` +
        `spoken since. The wait no longer explains the silence.`,
      coverage: 'available',
      evidence: [...evidence, 'wait target resolved, no beat since']
    }
  }

  // 6 — the gaps. `quiet` asserts nothing; only `stalled` does, and it says so
  //     as a suspicion rather than a diagnosis.
  if (gap > t.stallAfterMs)
    return {
      state: 'stalled',
      reason: `no heartbeat for ${Math.round(gap / 1000)}s, past the ${Math.round(t.stallAfterMs / 1000)}s this estate calls a stall. Something MAY be wrong; nothing here proves where.`,
      coverage: 'available',
      evidence
    }
  if (gap > t.quietAfterMs)
    return {
      state: 'quiet',
      reason: 'nothing for a while, which a real tool call does too. Not a fault.',
      coverage: 'available',
      evidence
    }
  return { state: 'working', reason: `it reported "${hb.phase}"`, coverage: 'available', evidence }
}
