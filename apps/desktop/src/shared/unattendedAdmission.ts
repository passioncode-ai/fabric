// One reading authorises one unattended start (FA-03 · ADR-0054).
//
// THE THRESHOLD ALREADY SAID THIS. `quotaGate.ts` states why 90 rather than 99:
// "the number must leave room for a RUN, not for a request." Headroom above the
// threshold is, by the threshold's own definition, room for one run. So a single
// observation of the remainder can justify exactly one start, and this is a
// derivation from a decision already recorded rather than a new judgement.
//
// MEASURED at d28c321: `routineTick` called `mayStart` ONCE and then started up
// to `MAX_STARTS_PER_POLL` (3) routines from that one verdict. Three admissions
// against one observation of the remainder — the second and third started on a
// number that was already out of date, and nothing recorded that they had.
//
// AND CHAINS ASKED NOTHING AT ALL. `chainAdvance` consults `mayStartFanIn`,
// which answers whether the PREDECESSORS are done — a different question with a
// confusingly similar name. No quota gate stood between a finished predecessor
// and a new unattended session.
//
// WHY IN-PROCESS STATE IS THE RIGHT MECHANISM HERE, and where it stops being
// so. The two callers — the routine tick and the chain advance — run in the same
// main process on one event loop, and `claim` is SYNCHRONOUS: nothing can be
// scheduled between its check and its mark, so the claim is atomic by
// construction rather than by a lock. A restart cannot have an in-flight
// admission to lose, so durability buys nothing. A SECOND process would break
// this, and that is the moment it must move into the database beside the other
// admission commands — named here so the boundary is visible before it is
// crossed, not discovered after.

import { mayStart, type Attendance, type GateVerdict } from './quotaGate.ts'
import type { SnapshotExpectation } from './quotaSnapshot.ts'
import type { Quota } from './types'

export interface UnattendedAdmission {
  /**
   * Ask to start ONE unattended run against this reading.
   *
   * Synchronous on purpose — see the header. A refusal never consumes the
   * reading: telling the next caller the remainder was spent on a start that
   * did not happen is the same class of lie as starting on a number nobody has.
   */
  claim(quota: Quota | null, expect?: SnapshotExpectation): GateVerdict
  /** The reading identity already spent, for a receipt. Never a credential. */
  spent(): string | null
}

/** Two readings are the same reading when they are the same account at the same
 *  instant. The producer caches within its TTL, so a repeat call inside one poll
 *  returns a reading with the identical `readAt` — which is the case this
 *  refuses. */
const identityOf = (q: Quota): string => `${q.account ?? 'unknown'}@${q.readAt}`

export function createUnattendedAdmission(
  opts: { threshold?: number; attendance?: Attendance } = {}
): UnattendedAdmission {
  let lastSpent: string | null = null

  return {
    claim(quota, expect = {}) {
      const verdict = mayStart(quota, opts.attendance ?? 'unattended', opts.threshold, expect)
      if (!verdict.ok) return verdict
      // From here the reading is valid, so it HAS an identity.
      const identity = identityOf(quota as Quota)
      if (identity === lastSpent)
        return {
          ok: false,
          reasonCode: 'already-spent',
          reason:
            'this quota reading has already authorised an unattended start. The threshold leaves room for one run, ' +
            'not for as many as one reading is asked about — take a fresh reading before starting another.'
        }
      lastSpent = identity
      return verdict
    },
    spent: () => lastSpent
  }
}
