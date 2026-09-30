// What a cycle is doing, in three columns that answer different questions (M186).
//
// MEASURED, and there are three defects.
//
//   `automations.read` destructures `data` past `error` on both journal
//   windows. A refused read becomes an empty array, which renders as "this
//   routine has never run" when the truth is "we could not read whether it
//   did" — the exact defect S14 exists to prevent, still standing here.
//
//   Both windows carry an undeclared `.limit(200)`.
//
//   And `outcome: 'ran'` means a task was STARTED. Not that the work finished,
//   not that it succeeded — the routine opened a session. A screen that reads
//   `ran` as a green tick reports success the estate never observed.
//
// PLUS THE ONE STEP 0 FOUND: `readCycleGap`, built in S15 precisely to say
// "the app was closed, not that nothing needed doing", has NO CALLER. The
// receipt is written and never read.
//
// THREE COLUMNS, because they fail independently. Configuration says what was
// asked for; observation says whether anybody was watching; outcome says what
// the last window did. A single "status" merges a paused routine, an unwatched
// one and a healthy idle one into one word, and they need different acts.

import { readCycleGap } from './cyclePort.ts'

export type ConfigState =
  | 'enabled'
  | 'disabled'
  /** Declared in the design and not wired: a CEO review, a retro, a letter.
   *  Distinct from disabled, which is a thing somebody turned off. */
  | 'planned'

export type ObservationHealth =
  /** A detector exists and answered. */
  | 'observed'
  /** No detector for this kind of cycle. Not a fault — an absence of
   *  instrumentation, and a screen that renders it as a fault teaches the
   *  operator to ignore the column. */
  | 'uninstrumented'
  /**
   * Nothing was watching. WHY is a separate question (AX-08).
   *
   * This used to read "the app was not running, so nothing could be watched",
   * and that is one of two causes: a pass that ran and could not record itself
   * produces the same silence, which `index.ts` says in its own words when it
   * logs `cycle.receipt`. The cause travels beside the health as `explained`
   * rather than being folded into the name of the state.
   */
  | 'monitor_absent'

export type LastOutcome =
  /** A task was STARTED. Never "succeeded": the cycle opened a session and
   *  what happened inside it is the run's business, not the cycle's. */
  | 'started'
  /** It ran and had nothing to do. NOT a failure. */
  | 'skipped'
  /** It was not due. Also not a failure, and distinct from having nothing to
   *  do — one is the clock, the other is the workload. */
  | 'not_due'
  /** It was refused: quota, a full window, a missing input. */
  | 'paused'
  /** The pass itself threw. */
  | 'failed'
  /** No receipt at all for the last window. */
  | 'unknown'

export interface CycleRow {
  cycleKey: string
  kind: string
  projectId: string | null
  config: { state: ConfigState; cadenceMinutes: number | null }
  observation: {
    health: ObservationHealth
    lastCheckedAt: string | null
    says: string
    /**
     * Whether the observation's state has an established cause (AX-08).
     *
     * An absence nobody can explain is the one a person should look at; a
     * laptop that was closed is not. `needsIntervention` reads exactly this
     * distinction, which is what stops a normal overnight gap queueing up as
     * work.
     */
    explained: boolean
  }
  outcome: { last: LastOutcome; at: string | null; reason: string | null }
}

/**
 * Whether anybody was watching, from the cycle receipt S15 records.
 *
 * NEVER inferred from the cadence. "It should have run four times by now" is an
 * expectation, and reporting an expectation as an observation is how a screen
 * claims health for a machine that was asleep.
 */
export function observationOf(input: {
  hasDetector: boolean
  lastCycleAt: number | null
  now: number
  expectedEveryMs: number
}): CycleRow['observation'] {
  if (!input.hasDetector)
    return {
      health: 'uninstrumented',
      lastCheckedAt: null,
      // Explained: nobody built a detector, and that is a complete account of
      // why there is no observation.
      explained: true,
      says: 'nothing watches this kind of cycle yet — that is an absence of instrumentation, not a fault'
    }
  const gap = readCycleGap({
    lastCycleAt: input.lastCycleAt,
    now: input.now,
    expectedEveryMs: input.expectedEveryMs
  })
  if (gap.neverRan || gap.silentForMs > input.expectedEveryMs * 2)
    return {
      health: 'monitor_absent',
      lastCheckedAt: input.lastCycleAt === null ? null : new Date(input.lastCycleAt).toISOString(),
      explained: gap.explained,
      says: gap.says
    }
  return {
    health: 'observed',
    lastCheckedAt: new Date(input.lastCycleAt as number).toISOString(),
    explained: gap.explained,
    says: gap.says
  }
}

/**
 * Does this row need somebody?
 *
 * A real refusal or a real failure does — and so does a silence NOBODY CAN
 * ACCOUNT FOR (AX-08). The third case is the one that used to be invisible:
 * the reader asserted that a long gap meant the app had been closed, so an
 * estate whose passes were running and failing to record themselves looked
 * exactly like a laptop shut for the night, and nothing asked for a person.
 * A closed laptop is still not work: `explained` is what tells them apart.
 */
export function needsIntervention(row: CycleRow): boolean {
  if (row.outcome.last === 'paused' || row.outcome.last === 'failed') return true
  return row.observation.health === 'monitor_absent' && !row.observation.explained
}

/** Is this row working as intended, whatever it did last? */
export function isWorking(row: CycleRow): boolean {
  if (row.config.state !== 'enabled') return false
  if (row.observation.health !== 'observed') return false
  return row.outcome.last === 'started' || row.outcome.last === 'skipped' || row.outcome.last === 'not_due'
}

export interface CycleSummary {
  needsIntervention: number
  working: number
  /** Enabled and nobody is watching. The number that makes the other two
   *  honest: without it "12 working" is a claim about the watched subset. */
  unobserved: number
  says: string
}

export function summarise(rows: readonly CycleRow[]): CycleSummary {
  const needs = rows.filter(needsIntervention).length
  const working = rows.filter(isWorking).length
  const unobserved = rows.filter(
    (r) => r.config.state === 'enabled' && r.observation.health !== 'observed'
  ).length
  return {
    needsIntervention: needs,
    working,
    unobserved,
    says:
      unobserved > 0
        ? `${needs} need you · ${working} working · ${unobserved} enabled with nothing watching`
        : `${needs} need you · ${working} working`
  }
}
