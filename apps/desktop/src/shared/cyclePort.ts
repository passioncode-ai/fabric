// One contract for everything that runs on a cadence (S15, ADR-0037).
//
// MEASURED: the tick is a `setInterval` calling two producers directly, and it
// leaves NO RECEIPT. `routine.ran@1` records a routine that ran; nothing records
// that a cycle happened. So "did the tick run at 14:00" has no answer, and —
// the part that matters — after the app has been closed, nothing distinguishes
// "nothing was due" from "nobody was watching". ADR-0037 says plainly that
// Fabric has no always-on process; without a cycle receipt the product says it
// by omission, which reads as a promise it does not keep.
//
// AND THERE IS NO BOUND. Every routine whose interval elapsed is returned at
// once, so a day offline launches every due routine simultaneously on the first
// tick after launch. The missed windows are already coalesced — `lastRunAt` is
// one timestamp, so an hourly routine missed for a day is due once, not
// twenty-four times — but ten routines coming due together still start ten
// sessions in the same second.
//
// A WINDOW THAT DID NOTHING IS NOT A WINDOW THAT FAILED, and neither is one
// whose outcome nobody knows. `skipped_no_delta` advances the watermark because
// there was genuinely nothing to do; `outcome_unknown` never advances it,
// because advancing past work nobody can account for is how work disappears.

export const WINDOW_STATES = [
  'pending',
  'leased',
  'running',
  /** It did the work. */
  'completed',
  /** There was nothing to do. Not a failure — and it still advances. */
  'skipped_no_delta',
  /** Some of it was committed. Only the committed part advances. */
  'partial',
  'failed_known',
  /** Started and never accounted for. NEVER advances the watermark. */
  'outcome_unknown',
  'cancelled_before_dispatch'
] as const
export type WindowState = (typeof WINDOW_STATES)[number]

/** Whether reaching this state may move the cycle's watermark forward. */
export function advancesWatermark(state: WindowState): boolean {
  return state === 'completed' || state === 'skipped_no_delta'
}

/**
 * How many starts one poll may make.
 *
 * A BOUND, not a queue drain. Ten routines coming due together after a day
 * offline would otherwise start ten sessions in the same second — ten agents
 * competing for the same machine, and an operator who opened the app to look at
 * one thing. The rest stay due and are taken on the next poll; nothing is lost,
 * because being due is a fact about the routine rather than a message in a
 * queue that can be dropped.
 */
export const MAX_STARTS_PER_POLL = 3

export interface CycleOutcome {
  /** What ran, what was deferred to the next poll, what was skipped. */
  started: string[]
  deferred: string[]
  state: WindowState
}

/**
 * Decide what this poll does, given everything that is due.
 *
 * Deterministic order — the caller's — so a routine at the back of a long queue
 * is not starved by an arbitrary reshuffle each poll.
 */
export function planCycle(due: readonly string[], cap: number = MAX_STARTS_PER_POLL): CycleOutcome {
  if (due.length === 0) return { started: [], deferred: [], state: 'skipped_no_delta' }
  const started = due.slice(0, Math.max(0, cap))
  const deferred = due.slice(started.length)
  return {
    started,
    deferred,
    // A poll that started everything it found is complete. One that deferred
    // work is PARTIAL — and saying so is what stops "the cycle ran" being read
    // as "everything due has been handled".
    state: deferred.length > 0 ? 'partial' : 'completed'
  }
}

/**
 * The state of a pass built from several steps (AX-08).
 *
 * A pass is one window and it gets ONE receipt, so the several things it does
 * must resolve to a single state. The rule is the pessimistic one, and it is
 * the only safe rule here: `advancesWatermark` decides whether the estate may
 * move past this window, and a window that moves past unaccounted work is how
 * work disappears — the vocabulary's own words, sixteen lines up.
 *
 * MEASURED at `4263727`: the outer cycle initialised `state` to `completed` and
 * only ever left it for `failed_known` on a throw. `tick()` returned `void`, so
 * the `partial` that `planCycle` had already computed could not reach the
 * receipt at all, and a refused routines read — silently early-returning —
 * produced a receipt saying the pass completed.
 */
export function worstOf(states: readonly WindowState[]): WindowState {
  if (states.length === 0) return 'skipped_no_delta'
  // Worst first. `outcome_unknown` outranks `failed_known` deliberately: a
  // failure that was SEEN is accounted for, and one nobody can account for is
  // the thing the watermark must never step over.
  const order: WindowState[] = [
    'outcome_unknown',
    'failed_known',
    'partial',
    'cancelled_before_dispatch',
    'running',
    'leased',
    'pending',
    'completed',
    'skipped_no_delta'
  ]
  for (const state of order) if (states.includes(state)) return state
  return 'outcome_unknown'
}

export interface CycleGap {
  /** How long the estate went without a cycle receipt. */
  silentForMs: number
  /** True when there is no receipt at all — the app has never run a cycle. */
  neverRan: boolean
  says: string
  /**
   * Whether a silence is EXPLAINED, or merely long (AX-08).
   *
   * The sentence used to assert one cause: "this means the app was closed". It
   * cannot mean that, and the repository's own code says why thirty lines away
   * — `index.ts` logs `cycle.receipt` with the note "the pass ran but left no
   * receipt; a reader will see a gap". A pass that ran and could not record
   * itself produces EXACTLY this silence. Two causes, one absence, and the
   * reader was being handed a certainty.
   */
  explained: boolean
}

/**
 * What the absence of recent cycle receipts means.
 *
 * The honest reading of ADR-0037: Fabric has no always-on process, so a silent
 * hour is not evidence that nothing needed doing. It is evidence that nobody
 * was there — which the product must SAY rather than let the empty feed imply.
 */
export function readCycleGap(input: {
  lastCycleAt: number | null
  now: number
  expectedEveryMs: number
}): CycleGap {
  if (input.lastCycleAt === null)
    return {
      silentForMs: 0,
      neverRan: true,
      explained: true,
      says: 'no cycle has run in this estate yet, so nothing here has been checked on a schedule'
    }
  const silentForMs = Math.max(0, input.now - input.lastCycleAt)
  // Two missed polls is noise; more is the app having been closed.
  if (silentForMs <= input.expectedEveryMs * 2)
    return { silentForMs, neverRan: false, explained: true, says: 'the cycle is running on schedule' }
  return {
    silentForMs,
    neverRan: false,
    // NOT explained. The absence is real and its cause is not in evidence.
    explained: false,
    says:
      `nothing has run on a schedule here for ${Math.round(silentForMs / 60_000)} minutes. Fabric has no ` +
      `always-on process, so either the app was closed, or a pass ran and could not record itself. ` +
      `Either way nothing here has been checked on a schedule since then — and it does not mean ` +
      `nothing needed doing.`
  }
}
