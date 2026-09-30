// What is running, what is scheduled, and what happened before (M65).
//
// The panel this replaces said routines "arrive with the agent runtime; today
// agents are launched by hand above". That stopped being true when the tick
// shipped, and a collapsed panel making a false claim is worse than an empty
// one: it answers the question wrongly for anybody who opens it.
//
// THE HISTORY MUST INCLUDE THE RUNS THAT DID NOT HAPPEN. `routine.paused@1` is
// journalled precisely so a refusal can be seen; a history showing only
// successes tells the operator their automation is fine while it has been
// refused every night for a week. If the history omits it, the journalling was
// pointless.
//
// AND CONSECUTIVE PAUSES ARE A FACT ABOUT THE ROUTINE, not a list of events.
// Seven pause rows are seven things to count; "has not run for six days, because
// the quota window is full" is the same information as a sentence somebody
// actually reads. A surface that only lists is one where the operator does the
// derivation, and they will do it late.

export interface AutomationRun {
  routineId: string
  at: string
  outcome: 'ran' | 'paused'
  /** The task a successful run started. */
  taskId: string | null
  /** Why it did not run. Present only on a pause. */
  reason: string | null
}

export interface AutomationState {
  routineId: string
  /** When it last actually started work. Null means: not since we have records. */
  lastRanAt: string | null
  /** Pauses since the last successful run — zero when the last thing was a run. */
  consecutivePauses: number
  /** The most recent pause's reason, when the run of pauses is unbroken. */
  stuckBecause: string | null
}

/**
 * Fold the runs into one state per routine.
 *
 * `runs` may arrive in any order; this sorts, because a caller that happens to
 * query newest-first and a caller that queries oldest-first must not get
 * different answers to "has this been running".
 */
export function automationStates(runs: readonly AutomationRun[]): Record<string, AutomationState> {
  const byRoutine: Record<string, AutomationRun[]> = {}
  for (const r of runs) (byRoutine[r.routineId] ??= []).push(r)

  const out: Record<string, AutomationState> = {}
  for (const [routineId, rows] of Object.entries(byRoutine)) {
    const ordered = [...rows].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    let lastRanAt: string | null = null
    let consecutivePauses = 0
    let stuckBecause: string | null = null
    for (const r of ordered) {
      if (r.outcome === 'ran') {
        lastRanAt = r.at
        // A run CLEARS the count. Otherwise a routine that failed on Monday and
        // has run every night since still reads as stuck, and the one signal
        // that means "look at this" stops meaning anything.
        consecutivePauses = 0
        stuckBecause = null
      } else {
        consecutivePauses++
        stuckBecause = r.reason
      }
    }
    out[routineId] = { routineId, lastRanAt, consecutivePauses, stuckBecause }
  }
  return out
}

/**
 * Whether a routine deserves the operator's eye.
 *
 * One pause is ordinary — a quota window fills, a spawn fails, the next tick
 * tries again. A RUN of them is a routine that is not running, and the whole
 * point of scheduling it was not having to check.
 */
export const STUCK_AFTER = 3

export function isStuck(state: AutomationState | undefined): boolean {
  return (state?.consecutivePauses ?? 0) >= STUCK_AFTER
}
