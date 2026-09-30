// One admitted invocation of one task (M188, ADR-0045).
//
// MEASURED: `run_id` has been on `JournalEvent` and in `append_event` since
// migration one, and across 2 260 events in this estate it is set on ZERO of
// them. The only writer passes `e.runId ?? null` and no caller ever supplies
// one. A column that exists, is projected, is on the wire, and has never held
// a value — so "what happened during that run" has never had an answer, and
// four earlier iterations each named the missing run table as their own
// deferral.
//
// ADR-0030 said a Run is one execution of one graph; ADR-0042 said a run is a
// session bound to a task with no new id. ADR-0045 resolved the vocabulary and
// shipped no table. This is the table.
//
// A FRESH RUN PER ADMISSION, and that is the load-bearing rule. A retry is a
// NEW run rather than a mutated one, because a run that can be re-entered has
// no answer to "how long did it take" or "what did it do" — the second attempt
// overwrites the first's account of itself. A denied admission is no run at
// all: refusing to start is not a run that failed.
//
// AND THE RUNTIME RECEIPT IS IMMUTABLE ONCE ENDED. Verification arriving later
// links to it; it never rewrites it. An assessment that edits the thing it
// assesses leaves nothing to compare against.

export const RUN_STATES = ['admitted', 'launching', 'active', 'ending', 'ended'] as const
export type RunState = (typeof RUN_STATES)[number]

/** How a run ended. Kept apart from the task's own result — the runtime
 *  terminating and the work succeeding are different facts (M180). */
export const RUN_OUTCOMES = ['completed', 'failed_known', 'cancelled', 'outcome_unknown'] as const
export type RunOutcome = (typeof RUN_OUTCOMES)[number]

const NEXT: Record<RunState, readonly RunState[]> = {
  admitted: ['launching', 'ended'],
  launching: ['active', 'ended'],
  active: ['ending', 'ended'],
  ending: ['ended'],
  // TERMINAL. Not "usually terminal": a run that can be reopened is a run whose
  // duration and account of itself are both unanswerable.
  ended: []
}

export type MoveVerdict = { ok: true } | { ok: false; reason: string }

export function mayAdvance(from: RunState, to: RunState): MoveVerdict {
  if (from === to) return { ok: false, reason: `the run is already ${to}` }
  if (from === 'ended')
    return {
      ok: false,
      reason:
        'this run has ended, and an ended run does not reopen. A retry is a NEW run with its own id — the ' +
        'second attempt must not overwrite the first attempt’s account of itself.'
    }
  return NEXT[from].includes(to)
    ? { ok: true }
    : { ok: false, reason: `a run cannot go from ${from} to ${to}` }
}

/** An outcome may only be recorded on the transition into `ended`. */
export function outcomeRequired(to: RunState): boolean {
  return to === 'ended'
}

export interface TaskRun {
  taskRunId: string
  taskId: string
  /** 1, 2, 3 — which attempt at this task this run is. Derived from what came
   *  before rather than chosen, so two concurrent admissions cannot both be
   *  "attempt 2". */
  runOrdinal: number
  state: RunState
  outcome: RunOutcome | null
  /** The session doing the work. A native session may outlive one run; the run
   *  does not outlive itself to follow it. */
  sessionId: string | null
}

export interface AttemptWithin {
  /** A transport retry or a model's hidden internal turn is an ATTEMPT, not
   *  another run. Counting those as runs makes an ordinary retry look like a
   *  second invocation the operator authorised. */
  attemptNo: number
  runId: string
}

/**
 * Does this event belong to a run?
 *
 * Deliberately narrow. A heartbeat, a trace record and a cycle receipt describe
 * the machinery rather than the work, and stamping them with a run id makes
 * "what happened in this run" a list of everything the process did while it was
 * open.
 */
const MACHINERY = new Set([
  'agent.heartbeat@1',
  'cycle.ran@1',
  'session.observed@1',
  'ops.gap'
])

export function belongsToRun(eventType: string): boolean {
  return !MACHINERY.has(eventType)
}
