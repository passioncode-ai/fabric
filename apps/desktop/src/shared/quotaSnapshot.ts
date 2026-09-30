// A reading that contains nothing is not a reading (FA-03).
//
// MEASURED at d28c321, and every step of it looks correct in isolation:
//
//   · the producer asked the vendor for usage and got HTTP 200 with `{}`;
//   · `windowOf(undefined)` returned null for both windows, which is right;
//   · the snapshot was built with `problem: null`, because nothing had failed;
//   · `mayStart` looped the two windows, skipped each absent one with
//     `if (!w) continue`, fell out of the loop and returned `{ ok: true }`.
//
// An empty answer became a green light for work nobody is watching. The gate's
// own header says an unknown quota must block; the code said so about a reading
// that FAILED and not about a reading that arrived empty, and those are the same
// thing seen from two sides.
//
// THE DISTINCTION THE TYPE COULD NOT MAKE. A plan with no seven-day window and a
// reading that contained no windows were both `sevenDay: null`. The first is a
// fact about the PLAN and must not block anything; the second is a fact about
// the READING and must block everything unattended. Collapsing them is what let
// an empty body pass as a plan with one window.
//
// So: at least one window present is a reading; none is not. Every window that
// IS present must be a finite percentage — `NaN >= 90` is false, so a corrupt
// number was indistinguishable from an idle account.
//
// AND ABSENCE IS NOT PERMISSION, anywhere in this file. Every branch that cannot
// answer returns a refusal with a sentence, because the one caller is work with
// nobody watching it.

import type { Quota } from './types'

/**
 * How old a reading may be and still authorise an unattended start.
 *
 * A judgement, stated as one. The number that matters is not "how fresh is
 * nice" but "could the account have moved since". Two minutes is shorter than
 * any unattended cadence in this product, so a reading that authorises a start
 * was taken after the previous start finished changing the account.
 */
export const MAX_SNAPSHOT_AGE_SECONDS = 120

export type SnapshotProblem =
  /** Nothing was passed. Not an empty reading — no reading. */
  | 'no-reading'
  /** The producer already said it could not read: unreachable, throttled, … */
  | 'reported'
  /** A reading with no windows in it at all. */
  | 'empty'
  /** A utilisation that is NaN or ±Infinity. */
  | 'not-finite'
  /** A utilisation outside what a percentage can hold. */
  | 'out-of-range'
  | 'stale'
  /** Taken for an account other than the one the work will run as. */
  | 'wrong-account'

export type SnapshotRead =
  | { ok: true; quota: Quota }
  | { ok: false; why: SnapshotProblem; says: string }

export interface SnapshotExpectation {
  /** The account the work will run as, when the caller knows it. */
  account?: string | null
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/**
 * Read a quota snapshot, refusing anything that cannot authorise a start.
 *
 * Deliberately strict, and deliberately NOT a boolean: an operator asking "why
 * did nothing run last night" needs the reason, and a gate that answers only
 * yes or no makes that unanswerable after the window has closed.
 */
export function readSnapshot(quota: Quota | null, expect: SnapshotExpectation = {}): SnapshotRead {
  if (!quota)
    return {
      ok: false,
      why: 'no-reading',
      says: 'there is no quota reading at all, and unattended work does not start on a number nobody has'
    }

  if (quota.problem !== null)
    return {
      ok: false,
      why: 'reported',
      says: `the account's quota could not be read (${quota.problem}), and this is exactly the moment not to start something nobody is watching`
    }

  const windows = [
    ['five-hour', quota.fiveHour] as const,
    ['seven-day', quota.sevenDay] as const
  ]
  const present = windows.filter(([, w]) => w)
  if (!present.length)
    return {
      ok: false,
      why: 'empty',
      says: 'the reading arrived with no quota windows in it. A plan that reports one window is a plan; a reading that reports none is a failure wearing a success, and it does not authorise anything'
    }

  for (const [name, w] of present) {
    if (!finite(w!.utilization))
      return {
        ok: false,
        why: 'not-finite',
        says: `the ${name} window reports a utilisation that is not a number (${String(w!.utilization)}), so nothing can be concluded from it`
      }
    if (w!.utilization < 0 || w!.utilization > 100)
      return {
        ok: false,
        why: 'out-of-range',
        says: `the ${name} window reports ${w!.utilization}%, which is not a percentage this product can act on`
      }
  }

  if (!finite(quota.ageSeconds) || quota.ageSeconds > MAX_SNAPSHOT_AGE_SECONDS)
    return {
      ok: false,
      why: 'stale',
      says: `this reading is ${finite(quota.ageSeconds) ? Math.round(quota.ageSeconds) + 's' : 'of unknown age'} old and the account may have moved since; take a fresh one before starting unattended work`
    }

  // Enforced only when the caller states an expectation. One account exists
  // today, so an unconditional check would compare a field against itself and
  // prove nothing; this way the rule is testable now and binding the day a
  // second account arrives, rather than a check somebody must remember to add.
  if (expect.account != null && quota.account !== expect.account)
    return {
      ok: false,
      why: 'wrong-account',
      says: `this reading was taken for a different account than the work would run as, so its headroom says nothing about the account that would be spent`
    }

  return { ok: true, quota }
}
