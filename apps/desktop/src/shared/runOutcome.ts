// What the RUNTIME did, read from how the process left (AX-01).
//
// Kept apart from whether the WORK succeeded, which is the task's own result and
// is nobody's business here: a run that exits 0 having achieved nothing ended
// cleanly, and a run killed by the operator ended cleanly too, in a different
// way. Collapsing the two is how "exit 0" comes to mean "done", which
// `task_runs`' own header refuses.
//
// ONE definition, because three callers ask it — a session exit, a spawn that
// threw, and a restart that finds a run whose process is gone — and a second
// copy would let them disagree about what a signal means.

/** The outcomes `task_runs.outcome` accepts. */
export type RunOutcome = 'completed' | 'failed_known' | 'cancelled' | 'outcome_unknown'

export interface Exit {
  /** Null when the process left without one — killed, or never started. */
  code: number | null
  /** True when the operator asked for it to stop. */
  cancelled?: boolean
}

/**
 * How a run ended, from how its process left.
 *
 * A NULL exit code is `outcome_unknown` rather than a failure. The process may
 * have finished perfectly and taken its code with it; saying "failed" there is
 * inventing an outcome, and the whole point of a fourth outcome is that "we do
 * not know" is a thing the estate is allowed to say.
 */
export function outcomeOfExit(exit: Exit): RunOutcome {
  if (exit.cancelled) return 'cancelled'
  if (exit.code === null || exit.code === undefined) return 'outcome_unknown'
  if (!Number.isInteger(exit.code)) return 'outcome_unknown'
  return exit.code === 0 ? 'completed' : 'failed_known'
}
