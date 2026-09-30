// Work nobody is watching stops before the quota does (M94).
//
// The measurement has existed since M83 and nothing consumed it. M94's row names
// the failure it prevents: "a canvas of hourly agents burns the account's quota
// unattended", and the answer is that at a threshold automations pause **and say
// so** rather than failing one by one.
//
// THE GATE APPLIES TO WORK NOBODY IS WATCHING, and that is the whole design.
// The operator's own hands are never blocked: if they want to start a session at
// 99% that is their call, they are present, and they will see it stop. An
// unattended agent at 99% burns the remainder with nobody there — and worse,
// stops halfway through a task, leaving the board holding a card that cannot be
// told apart from one that failed.
//
// WHICH IS THE REAL ARGUMENT FOR A THRESHOLD, and it is not about the account.
// A run needs room to FINISH. Half-done unattended work costs more than work not
// started, because somebody has to work out which half happened. 90 is a
// judgement rather than a derivation and is stated as one; what is not a
// judgement is that the number must leave room for a run, not for a request.
//
// AN UNKNOWN QUOTA BLOCKS UNATTENDED WORK. Absent is not zero and not a hundred:
// it is "we cannot see", and the entire reason this gate exists is that nobody
// else is looking either. A reading that failed is exactly the moment to not
// start something unwatched.

import { readSnapshot, type SnapshotExpectation, type SnapshotProblem } from './quotaSnapshot.ts'
import type { Quota } from './types'

/** Who is there when this starts. */
export type Attendance = 'operator' | 'unattended'

export interface GateVerdict {
  ok: boolean
  /** Why, in a code a surface and a receipt can both act on (FA-03). A refusal
   *  that is only a sentence cannot be counted, filtered or tested. */
  reasonCode?: SnapshotProblem | 'over-threshold' | 'already-spent'
  /** Said to the operator and journalled. Names the window and its reset, so
   *  "wait an hour" and "wait until the weekly window turns over" are different
   *  answers rather than one shrug. */
  reason?: string
  window?: 'fiveHour' | 'sevenDay'
  resetsAt?: string | null
}

export const DEFAULT_THRESHOLD = 90

export function mayStart(
  quota: Quota | null,
  attendance: Attendance,
  threshold: number = DEFAULT_THRESHOLD,
  expect: SnapshotExpectation = {}
): GateVerdict {
  // A person asking for something is not gated by this. They are present.
  if (attendance === 'operator') return { ok: true }

  // THE READING IS VALIDATED BEFORE IT IS CONSULTED (FA-03). This used to test
  // `quota.problem !== null` and nothing else, then loop the windows and SKIP
  // each absent one — so a snapshot with no windows at all fell out of the loop
  // and returned ok. Measured: an HTTP 200 with an empty body produced exactly
  // that shape, and unattended work started on a reading containing nothing.
  const read = readSnapshot(quota, expect)
  if (!read.ok)
    return {
      ok: false,
      reasonCode: read.why,
      reason: `${read.says} Start it yourself if you want it now.`
    }

  // The tightest window decides, and it is named: five hours and seven days are
  // different waits and the operator plans around them differently. Every window
  // present here is finite and in range, because the read above refused
  // otherwise — `NaN >= 90` is false, which made a corrupt number look like an
  // idle account.
  const windows: [Exclude<GateVerdict['window'], undefined>, Quota['fiveHour']][] = [
    ['fiveHour', read.quota.fiveHour],
    ['sevenDay', read.quota.sevenDay]
  ]
  for (const [name, w] of windows) {
    if (!w) continue
    if (w.utilization >= threshold)
      return {
        ok: false,
        reasonCode: 'over-threshold',
        window: name,
        resetsAt: w.resetsAt,
        reason:
          `the ${name === 'fiveHour' ? 'five-hour' : 'seven-day'} quota window is at ` +
          `${Math.round(w.utilization)}%, and an unattended run started here would stop ` +
          `part-way — leaving work nobody can tell apart from work that failed. ` +
          (w.resetsAt ? `It resets at ${w.resetsAt}.` : 'It reports no reset time.')
      }
  }
  return { ok: true }
}
