// What is happening right now, as claim and observation kept apart (M189).
//
// MEASURED: the agent tile shows `session.state` — `running | idle | ended`
// from `pty.ts#stateOf`, one subtraction against a sixty-second timer. That is
// exactly the signal M178 replaced. So a thinking agent, an agent blocked on an
// unanswered question and an agent whose process is wedged all read `idle` on
// the screen, while the estate has recorded, for the last six iterations, which
// of the three it is.
//
// Nothing in the renderer reads a heartbeat, a run or an observation. The whole
// liveness apparatus — M178's derivation, M179's observer, M181's honest
// coverage, M188's run identity — is correct, recorded, and invisible to the
// person it exists for.
//
// TWO HEADINGS, NEVER ONE BADGE. The agent's own account and what Fabric
// watched are different kinds of fact (ADR-0008), and merging them into one
// status is how "it says it is verifying" becomes "it is verifying".
//
// AND NO INVENTED TOTAL. There are no plan steps yet — M188 named
// PlanRevision and StepClaim as not built — so this says "no plan declared"
// rather than rendering 0 of 0, which a progress bar draws as complete.

import type { Liveness, Coverage } from './liveness.ts'
import type { RunOutcome, RunState } from './taskRun.ts'

/** What the AGENT said. An account, under its own heading. */
export interface RunClaim {
  phase: string | null
  /** When the estate received it — its clock, not the agent's (M178). */
  reportedAt: string | null
  /** What it said it was waiting on, when it said it was waiting. */
  waitingOn: { kind: string; id: string } | null
}

/** What FABRIC watched. Independent of anything the agent reported. */
export interface RunObservation {
  /** The derived liveness (M178/M179), with its reason and how much of the
   *  answer rests on something observed. */
  liveness: Liveness
  reason: string
  coverage: Coverage
  processRunning: boolean
  lastOutputAt: string | null
  /** What the reading was computed from, so a surface can show its working
   *  rather than asking for trust (AX-02). */
  evidence?: string[]
  /** Which inputs nobody read, in the reader's own words. A reading assembled
   *  from four sources and three answers is not the same claim as one assembled
   *  from four, and the difference used to be invisible. */
  unread?: string[]
}

export interface RunStatusView {
  taskId: string | null
  taskTitle: string | null
  /** M188's identity. `null` for a session with no admitted run — an operator's
   *  bare terminal, which is a real thing and not a broken run. */
  runRef: string | null
  /** "Run 2". Never invented: it comes from the admission that created it. */
  ordinal: number | null
  runState: RunState | null
  runOutcome: RunOutcome | null
  claim: RunClaim
  observation: RunObservation
  /**
   * How many questions are still holding this task, or NULL when that could not
   * be read (AX-02).
   *
   * It was `number`, so the handler wrote `(read.data ?? []).length` and a
   * refused query reported a task with no blockers at all — the type made
   * "unknown" inexpressible and the zero was the only thing left to say. Zero
   * blockers and an unreadable blocking set are different facts and only one of
   * them is safe to act on.
   */
  blockers: number | null
  /** Declared plan steps. Zero means NO PLAN, and the surface says so rather
   *  than drawing an empty bar. */
  steps: { done: number; declared: number; skipped: number; failed: number }
}

/** What the widget should say about progress, given there may be no plan. */
export function progressLine(steps: RunStatusView['steps']): string {
  if (steps.declared === 0)
    // Not "0 of 0". A progress bar renders that as complete, and an agent that
    // declared no plan has not finished — it has not said what it intends.
    return 'no plan declared'
  const extra = [
    steps.skipped > 0 ? `${steps.skipped} skipped` : null,
    steps.failed > 0 ? `${steps.failed} failed` : null
  ].filter(Boolean)
  return `${steps.done} of ${steps.declared} declared${extra.length ? ` · ${extra.join(', ')}` : ''}`
}

/** How the run itself should be named. */
export function runLine(view: Pick<RunStatusView, 'ordinal' | 'runState' | 'runOutcome'>): string {
  if (view.ordinal === null) return 'not admitted as a run'
  const base = `run ${view.ordinal}`
  if (view.runState !== 'ended') return `${base} · ${view.runState}`
  return `${base} · ended ${view.runOutcome ?? 'outcome_unknown'}`
}

/**
 * The two lines a person reads, and they are never merged.
 *
 * The claim is prefixed with who said it, because a phase that reads like a
 * status is a status as far as anybody scanning is concerned.
 */
export function twoHeadings(view: RunStatusView): { claim: string; observed: string } {
  return {
    claim:
      view.claim.phase === null
        ? 'this agent has not said what it is doing'
        : `it says: ${view.claim.phase}${view.claim.waitingOn ? ` (waiting on a ${view.claim.waitingOn.kind})` : ''}`,
    observed: `Fabric sees: ${view.observation.liveness} — ${view.observation.reason}`
  }
}

/**
 * May this view be shown as authoritative about the agent?
 *
 * No, when the coverage says the answer rests on nothing observed. A tile that
 * renders `unsupported` coverage as a confident state is the false alarm M181
 * removed, put back by the surface.
 */
export function isTrustworthy(view: RunStatusView): boolean {
  return view.observation.coverage === 'available'
}
