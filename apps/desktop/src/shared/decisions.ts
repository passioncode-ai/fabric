// What has been decided here, and what it replaced (M144).
//
// MEASURED BEFORE BUILT: this estate holds 44 current decisions and ZERO
// superseded ones. The intake asked for a "graph of decisions taken", and the
// only edge the data can carry is `supersedes` — so today the graph has no
// edges and is a list. A node-and-edge renderer for zero edges is a picture of
// nothing, and the diet forbids building it against a case that does not occur.
//
// The lineage code below is not speculative generality, and the distinction
// matters: superseding a decision is something the system can do TODAY — an
// agent or the operator can record a correction with `supersedes` set — and
// nobody has. When the first one lands this reads correctly instead of showing
// a chain of one and calling it history.
//
// RETURN TRIGGER for an actual diagram: an estate where decisions supersede
// each other more than one deep, often enough that reading the chains as text
// stops being easier than looking at a picture.

export interface DecisionFact {
  id: string
  claim: string
  source_ref: string | null
  actor_kind: string | null
  recorded_at: string
  /**
   * Set when a LATER fact replaced this one, and it is the ONLY direction the
   * store keeps. There is no `supersedes` column — checked against the schema
   * rather than assumed symmetric, after the first version of this file
   * selected one that does not exist and would have failed at runtime with the
   * typechecker perfectly happy, because a column list is a string.
   *
   * So walking BACK means inverting: the fact this one replaced is the fact
   * whose `superseded_by` points at it.
   */
  superseded_by?: string | null
}

export interface Lineage {
  /** What is believed now. */
  current: DecisionFact
  /** What it replaced, newest first. Empty for a decision made once.
   *
   *  A LIST, and it can hold siblings: one decision may replace several
   *  earlier ones at once. */
  replaced: DecisionFact[]
  /** Whether this chain is the whole chain (M173). */
  completeness: LineageCompleteness
}

/**
 * Facts whose CURRENT version the read did not return (AX-06).
 *
 * A batch-level fact, and it has to be: a missing PREDECESSOR is undetectable
 * from the rows that arrived — you cannot see a row you did not get. What IS
 * detectable is the other direction: a fact naming a `superseded_by` that is
 * not in the batch belongs to a history whose head is absent, so it forms no
 * lineage here and vanishes from the screen entirely.
 *
 * MEASURED at `cb92c89`: this was computed INSIDE every lineage, by scanning
 * ALL facts, so each root reported the same global list — a decision whose
 * history was whole was labelled "part of this history was not in the batch
 * that was read" because some unrelated chain had a hole. A false hole is the
 * mirror of a false completeness, and it teaches an operator to distrust a
 * record that is in fact intact. It was also named for the wrong direction:
 * `missingPredecessors` held missing SUCCESSORS.
 */
export function orphansOf(facts: readonly DecisionFact[]): { ids: string[]; says: string } {
  const known = new Set(facts.map((f) => f.id))
  const ids = [
    ...new Set(
      facts
        .filter((f) => f.superseded_by && !known.has(f.superseded_by))
        .map((f) => f.superseded_by as string)
    )
  ]
  return {
    ids,
    says: ids.length
      ? `${ids.length} decision(s) in this batch were replaced by a decision the read did not return, ` +
        `so those histories are not shown at all`
      : 'every decision read here belongs to a history whose current version was read too'
  }
}

export interface LineageCompleteness {
  /** True when the walk stopped at `MAX_DEPTH` rather than at the beginning. */
  truncatedByDepth: boolean
  says: string
}

/**
 * How far back a chain is followed.
 *
 * THE OLD REASONING HERE WAS WRONG, and it is worth saying exactly how because
 * the conclusion it supported lost data. It argued the walk needs no cycle
 * guard because "each id maps to at most one fact, since a fact has exactly one
 * `superseded_by`". That guarantees the FORWARD map is functional. The map
 * built here is the REVERSE one — keyed by the successor's id — and reverse
 * maps are many-to-one: two decisions can both name the same successor, which
 * is one decision replacing two earlier ones at once.
 *
 * With a `Map<string, DecisionFact>` the second `set` overwrote the first, and
 * a predecessor vanished from the screen entirely. It is a list now, the walk
 * carries a visited set, and the bound below is what it always said it was —
 * a limit on the absurd rather than a guard against the impossible.
 */
export const MAX_DEPTH = 50

export function lineagesOf(facts: readonly DecisionFact[]): Lineage[] {
  // The reverse index: which facts each one REPLACED. Built rather than read,
  // because the store keeps only the forward pointer — and a LIST per key,
  // because one decision may replace several at once.
  const replacedBy = new Map<string, DecisionFact[]>()
  const known = new Set(facts.map((f) => f.id))
  for (const f of facts)
    if (f.superseded_by) {
      const at = replacedBy.get(f.superseded_by)
      if (at) at.push(f)
      else replacedBy.set(f.superseded_by, [f])
    }

  // Only what is believed NOW is a root. A superseded decision appears inside
  // the lineage of the one that replaced it, never beside it as an equal.
  const roots = facts.filter((f) => !f.superseded_by)
  return roots.map((current) => {
    const replaced: DecisionFact[] = []
    const visited = new Set<string>([current.id])
    // Breadth-first, so siblings appear together and a branch is not buried
    // under the depth of another.
    let frontier = [current]
    let truncatedByDepth = false
    while (frontier.length > 0) {
      if (replaced.length >= MAX_DEPTH) {
        truncatedByDepth = true
        break
      }
      const next: DecisionFact[] = []
      for (const node of frontier) {
        for (const prior of replacedBy.get(node.id) ?? []) {
          if (visited.has(prior.id)) continue
          visited.add(prior.id)
          replaced.push(prior)
          next.push(prior)
        }
      }
      frontier = next
    }

    return {
      current,
      replaced,
      completeness: {
        truncatedByDepth,
        // ABOUT THIS CHAIN ONLY. Whether the BATCH was capped is a different
        // question with its own answer on the panel, and whether some other
        // history has a hole is none of this lineage's business (AX-06).
        says: truncatedByDepth
          ? `this history is longer than ${MAX_DEPTH} corrections; the rest is not shown`
          : 'this is the whole history'
      }
    }
  })
}
