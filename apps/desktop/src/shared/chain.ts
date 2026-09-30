// One task hands the next a named thing (slice 3, the last unblocked line).
//
// The links already exist — `spawned`, `blocks`, `follows` — and they say WHICH
// task comes after which. What none of them says is WHAT travels: a follower
// starts with the same blank brief whether its predecessor produced a report, a
// refusal, or nothing at all.
//
// THREE RULES, and the third is the one that decides whether this is worth
// having.
//
// 1. A CANCELLED PREDECESSOR STARTS NOTHING. `done` and `cancelled` are
//    different outcomes and only one means the work happened. A chain that runs
//    on either is a chain that does the second half of work the operator
//    stopped.
//
// 2. A CHAIN IS A HAND-OFF, so it counts against the loop bound (M68). A step
//    that started its follower outside that count would be a way around the only
//    thing standing between a hand-off and a runaway — and the prettiest way,
//    because it would look like a feature.
//
// 3. A MISSING INPUT DOES NOT BECOME AN EMPTY STRING. If B's brief says "review
//    the report A produced" and A produced no report, B must not start with
//    "review the report:" and nothing after it. An agent handed that will invent
//    the report, or review the emptiness, and either way the operator reads a
//    result about something that never existed. The step does not run and says
//    which input was missing — absent is not empty, at the one boundary where
//    the difference becomes work.

export type Outcome = 'done' | 'cancelled' | 'abandoned'

export interface ChainStep {
  /** The task that runs next. */
  taskId: string
  /** Named inputs its brief interpolates: `{report}` needs `report`. */
  needs: readonly string[]
}

export type StartVerdict =
  | { start: true; values: Record<string, string> }
  | { start: false; why: string; missing: readonly string[] }

/**
 * Whether a follower runs, given how its predecessor ended and what it left.
 *
 * `produced` is what the predecessor handed over — a name to a value. A key
 * present with an EMPTY value is treated as missing: handing over nothing under
 * the right name is the failure this rule exists for, and it is the shape a
 * well-meaning agent produces.
 */
export function mayStartStep(
  step: ChainStep,
  previous: Outcome,
  produced: Readonly<Record<string, string | null | undefined>>
): StartVerdict {
  // A ported or foreign graph can hand a status this union never named — a
  // task-pipeline `parked`, a future state, a typo. An UNKNOWN outcome fails
  // CLOSED with the status named (PF-04.02): a parked required edge is not
  // ready, and neither is anything else this chain cannot vouch for. The type
  // says Outcome; the runtime is where a ported value actually arrives.
  const KNOWN: readonly string[] = ['done', 'cancelled', 'abandoned']
  if (!KNOWN.includes(previous as string))
    return {
      start: false,
      why:
        `the previous step's outcome ${String(previous)} is not one this chain knows — ` +
        `an unknown outcome hands nothing on (fail closed)`,
      missing: []
    }
  if (previous !== 'done')
    return {
      start: false,
      why: `the previous step ended as ${previous}, and only work that finished hands anything on`,
      missing: []
    }

  // A non-string value under the right name is MISSING, not a crash: a ported
  // record can carry an object or a number where a hand-off string belongs,
  // and the unknown-shaped input fails closed exactly like the absent one.
  const missing = step.needs.filter((n) => {
    const v = produced[n]
    return typeof v !== 'string' || !v.trim()
  })
  if (missing.length > 0)
    return {
      start: false,
      why:
        `it needs ${missing.join(', ')} and the step before it produced ` +
        `${missing.length === 1 ? 'nothing under that name' : 'nothing under those names'}. ` +
        `Starting anyway would hand an agent an empty quotation and a question about it.`,
      missing
    }

  const values: Record<string, string> = {}
  for (const n of step.needs) values[n] = (produced[n] as string).trim()
  return { start: true, values }
}

/**
 * A follower with SEVERAL predecessors runs on ALL of them, or not at all
 * (PF-08.01). One `done` predecessor out of two is not readiness — it is half
 * a diamond, and starting there hands the agent a brief with an unfilled slot
 * about work still running. Every outcome must be `done` (an unknown or
 * cancelled one refuses with its own message, via the single-step rule), and
 * `produced` is the UNION of every predecessor's hand-offs, checked against
 * the union of needs.
 */
export function mayStartFanIn(
  step: ChainStep,
  outcomes: readonly Outcome[],
  produced: Readonly<Record<string, string | null | undefined>>
): StartVerdict {
  if (outcomes.length === 0)
    return { start: false, why: 'a fan-in with no predecessors is a graph error, not a start', missing: [] }
  for (const outcome of outcomes) {
    const gate = mayStartStep({ taskId: step.taskId, needs: [] }, outcome, {})
    if (!gate.start) return gate
  }
  return mayStartStep(step, 'done', produced)
}

/**
 * Fill a brief's named slots.
 *
 * Only names the step DECLARED are substituted. A `{something}` the step did not
 * ask for is left alone rather than blanked: it is far likelier to be prose the
 * operator wrote than a slot nobody filled, and blanking it would edit their
 * words.
 */
export function fillBrief(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : whole
  )
}
