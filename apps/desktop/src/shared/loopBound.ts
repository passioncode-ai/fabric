// How far a hand-off may travel before a person sees it (M68).
//
// The runaway M68 names is not a bug in any step: developer finishes → validator
// runs → validator files fixes → developer. Each hand-off is reasonable and the
// whole thing never stops. Nothing in the product notices, because every
// individual act is one an agent is allowed to do — and discovered in
// production, this costs money for as long as nobody looks.
//
// THE BOUND IS ON THE CHAIN FROM ONE ORIGINATING TASK, and getting that wrong
// fails silently in both directions:
//
//   * Count every task in the project and a busy project trips the bound and
//     stops working, for a reason that has nothing to do with looping.
//   * Count only the immediate parent and the bound never trips at all, because
//     each individual hand-off is depth one.
//
// So depth is the length of the `spawned` chain back to a task nothing spawned.
// `blocks` and `follows` are not counted: they order work and express dependency,
// they do not say one task PRODUCED another, and a long dependency chain is a
// plan rather than a loop.
//
// WHAT HAPPENS AT THE BOUND IS NOT A FAILURE. The next result becomes a proposal
// to the operator instead of another task (ADR-0029's route, with the operator
// as the only person there is yet). A refusal an agent could read as an error is
// one it will route around by filing the same card another way; a refusal that
// says "this became a proposal, and a person will decide" is one it can report.

/** task id → the task it was spawned FROM, if any. */
export type SpawnedFrom = Readonly<Record<string, string | undefined>>

/**
 * How many hand-offs separate this task from the one that started the chain.
 *
 * An origin is depth 0. A cycle in the data — which the DAG trigger refuses at
 * the write boundary, so this is defence rather than expectation — stops the
 * walk rather than hanging it.
 */
/**
 * How far back this task's provenance goes, or that it goes back to itself
 * (AX-13).
 *
 * TWO ANSWERS, NOT A NUMBER. `spawned` is a PROVENANCE edge and ADR-0053
 * refuses it for topology deliberately — "this child was spawned by that
 * parent" is a true statement about the past and must stay recordable even when
 * the parent blocks the child — so a spawned CYCLE can exist in `task_links`.
 *
 * MEASURED at `d9a38f6`: the walk met a cycle, stopped, and returned the depth
 * it had reached. For A spawned B spawned C spawned A that is 2, comfortably
 * under the bound of 4, so `mayChain` said yes — and kept saying yes. The
 * runaway this module exists to stop was reachable straight through the guard
 * built to stop it.
 *
 * A chain that returns to itself HAS NO LENGTH, and reporting one is the defect.
 */
export interface ChainReach {
  depth: number
  /** The provenance walk returned to a task it had already visited. */
  cyclic: boolean
}

export function chainReach(from: SpawnedFrom, taskId: string): ChainReach {
  const seen = new Set<string>([taskId])
  let depth = 0
  let at = taskId
  for (;;) {
    const parent = from[at]
    if (!parent) return { depth, cyclic: false }
    if (seen.has(parent)) return { depth, cyclic: true }
    seen.add(parent)
    at = parent
    depth++
  }
}

/**
 * The default, and it is a judgement stated as one.
 *
 * M68's own example — developer → validator → developer — is depth two. A
 * legitimate chain goes a little further: a task spawns a fix, the fix spawns a
 * follow-up, that turns up something adjacent. Past four, the case for "this is
 * still one piece of work" has stopped being made by anybody.
 */
export const DEFAULT_BOUND = 4

export interface BoundVerdict {
  /** Whether the result may become another task. */
  ok: boolean
  depth: number
  bound: number
  /** Said to the AGENT, so it reports rather than routes around. */
  reason?: string
}

export function mayChain(
  from: SpawnedFrom,
  parentTaskId: string | null,
  bound: number = DEFAULT_BOUND
): BoundVerdict {
  // Work with no parent starts a chain; there is nothing to bound yet.
  if (!parentTaskId) return { ok: true, depth: 0, bound }
  const reach = chainReach(from, parentTaskId)
  const depth = reach.depth + 1
  // A CYCLE IS NOT A SHORT CHAIN. However few links the walk covered before it
  // came back, a task that descends from itself can hand off for ever, and a
  // number under the bound is exactly what let it (AX-13).
  if (reach.cyclic)
    return {
      ok: false,
      depth,
      bound,
      reason:
        `this task descends from itself — the provenance chain returns to a task already in it, ` +
        `so there is no hand-off count that could ever reach the bound. It has been recorded as a ` +
        `proposal for the operator instead of created as a task. Report what you found and stop.`
    }
  if (depth < bound) return { ok: true, depth, bound }
  return {
    ok: false,
    depth,
    bound,
    reason:
      `this would be hand-off ${depth} in one chain, and the bound is ${bound}. It has been ` +
      `recorded as a proposal for the operator instead of created as a task — that is the ` +
      `bound working, not a failure, so report what you found and stop. Filing it another ` +
      `way would defeat the only thing standing between a hand-off and a runaway.`
  }
}
