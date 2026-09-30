/**
 * One assembly of `deriveLiveness`'s input, so its callers cannot disagree
 * about what they do not know (AX-02).
 *
 * MEASURED 2026-09-10. `deriveLiveness` is careful and correct, and BOTH of its
 * callers built its input as a literal — so each decided for itself what to put
 * where it had no answer, and they decided differently:
 *
 *                        watcher (runtimeObserver)   widget (runs.status)
 *   gap                  classifyObservationGap      ABSENT
 *   orientedAt           read from session.oriented   ALWAYS null
 *   waitingOn            not selected at all         SELECTED AND DROPPED
 *   beatsSupported       capabilitiesFor(optionId)   declaredCapabilities({…})
 *
 * Run against one fresh, oriented, beating session:
 *
 *   watcher: working | available
 *   widget : stalled | available
 *
 * The same agent, healthy, reported to the operator as stalled — with
 * `coverage: available`, so the false alarm arrived as a complete answer, and
 * with the reason "Fabric has no record of it reading its rules", which was
 * untrue: the record existed and the widget never asked.
 *
 * THE TYPE IS WHY, and this is the shape this cycle keeps meeting.
 * `classifyOrientation` takes `number | null | undefined` and treats null and
 * undefined identically, so "no orientation was recorded" and "nobody read the
 * orientation" were one value with two meanings. The widget had no way to say
 * which it meant, so it said the alarming one on every call. The fix is a third
 * answer, not a more careful caller — and the fields below are DISCRIMINATED
 * UNIONS for exactly that reason: a caller with no answer must say so, and
 * cannot pass a null that reads as a measurement.
 *
 * Pure: no database, no clock of its own.
 */

import type { ObservationGap } from './harnessBreak.ts'
import type { HeartbeatClaim, Observation, Thresholds } from './liveness.ts'

/** A heartbeat row as `session_heartbeats` stores it. */
export interface BeatRow {
  beat_seq: number
  phase: string
  last_received_at: string
  waiting_kind: string | null
  waiting_id: string | null
}

/**
 * Whether the orientation record was READ, and what it said.
 *
 * The middle case — read, and there is none — is a suspicion worth raising. The
 * third — nobody read it — is not, and had nowhere to live.
 */
export type OrientationSource =
  | { read: true; orientedAt: number | null }
  | { read: false; why: string }

/**
 * The thing an agent said it is waiting on, and when that was resolved.
 *
 * `resolvedAt` cannot come from the heartbeat: `session_heartbeats` has
 * `waiting_kind` and `waiting_id` and no resolution column, because the
 * resolution belongs to the THING — a question's `answered_at`, a grant's
 * decision. So a reader that has not looked it up says `resolved: 'unread'`
 * rather than passing a null that reads as "still open".
 */
export type WaitResolution =
  | { resolved: 'open' }
  | { resolved: 'at'; when: number }
  | { resolved: 'unread'; why: string }

export interface LivenessSources {
  session: { processEnded: boolean; lastOutputAt?: number; startedAt: number }
  beat: BeatRow | null
  beatsSupported: boolean
  orientation: OrientationSource
  /** How the wait target resolved. Required when the beat names one; a reader
   *  that did not look says so. */
  wait?: WaitResolution
  gap: ObservationGap | undefined
  thresholds: Thresholds
  now: number
}

/** What `deriveLiveness` takes, assembled once. */
export interface LivenessInput {
  gap?: ObservationGap
  heartbeat: HeartbeatClaim | null
  beatsSupported: boolean
  observation: Observation
  thresholds: Thresholds
  now: number
}

export function livenessInputFrom(sources: LivenessSources): LivenessInput {
  const beat = sources.beat
  const target =
    beat && beat.waiting_kind && beat.waiting_id
      ? {
          kind: beat.waiting_kind as 'question' | 'grant' | 'continuation',
          id: beat.waiting_id,
          // `undefined` and `null` mean different things to the derivation, and
          // the difference is the whole reason `WaitResolution` exists: `null`
          // is "still open", and an unread resolution must not claim that.
          resolvedAt: sources.wait?.resolved === 'at' ? sources.wait.when : null
        }
      : null

  return {
    ...(sources.gap ? { gap: sources.gap } : {}),
    heartbeat: beat
      ? {
          beatSeq: beat.beat_seq,
          phase: beat.phase as HeartbeatClaim['phase'],
          receivedAt: Date.parse(beat.last_received_at),
          waitingOn: target
        }
      : null,
    beatsSupported: sources.beatsSupported,
    observation: {
      processEnded: sources.session.processEnded,
      lastOutputAt: sources.session.lastOutputAt,
      // THE THIRD ANSWER, carried as `undefined` for "unread" and `number |
      // null` for "read". `deriveLiveness` is told which through
      // `orientationRead` below, because `undefined` alone was already taken.
      orientedAt: sources.orientation.read ? sources.orientation.orientedAt : undefined,
      orientationRead: sources.orientation.read,
      startedAt: sources.session.startedAt
    },
    thresholds: sources.thresholds,
    now: sources.now
  }
}

/** Why a reading may be incomplete, for a surface that shows its working. */
export function unreadInputs(sources: LivenessSources): string[] {
  const missing: string[] = []
  if (!sources.orientation.read) missing.push(`orientation: ${sources.orientation.why}`)
  if (sources.beat?.waiting_kind && sources.wait?.resolved === 'unread')
    missing.push(`wait resolution: ${sources.wait.why}`)
  if (!sources.gap) missing.push('observation gap: not classified by this reader')
  return missing
}
