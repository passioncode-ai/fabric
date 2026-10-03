// The Board's order (M150, ADR-0035 §4.2).
//
// No model, so the ranking is deterministic, explainable and stable — every item
// carries the reason it sits where it does, because a ranked list whose order
// cannot be explained is one the operator re-sorts by hand and then stops
// trusting. This is a SCRIPT (ADR-0039 §4): every output is a number a
// comparison checks.
//
// The asker never sets the priority (ADR-0036): an agent supplies evidence —
// what it blocks, its age, its kind — and the CEO assigns the number through
// this function. A queue where the shouting is done by whoever asks rewards
// shouting.

export type QuestionKind = 'access' | 'approval' | 'decision' | 'priority' | 'fact'

/** An access or approval question is one only the operator can settle; a `fact`
 *  one the CEO can often settle itself, so it starts at zero. */
export const KIND_WEIGHT: Record<QuestionKind, number> = {
  access: 15,
  approval: 15,
  decision: 10,
  priority: 5,
  fact: 0
}

export interface RankInput {
  blocks: number
  ageDays: number
  kind: QuestionKind
  servesActiveGoal: boolean
  /** From `projectWeight` (M156) — a hobby blocker must not outrank a paying review. */
  projectWeight: number
}

export interface Priority {
  priority: number
  components: {
    blocking: number
    breadth: number
    age: number
    kind: number
    goal: number
    project: number
  }
}

export function questionPriority(i: RankInput): Priority {
  const components = {
    // A question that STOPS work costs money every hour it waits; nothing else
    // on this list does, which is why it is the largest single term.
    blocking: i.blocks > 0 ? 40 : 0,
    breadth: Math.min(10 * Math.max(0, i.blocks), 30),
    // Slow rise, capped: age must matter or old questions are never reached, and
    // must not dominate or the board becomes a queue by date.
    age: Math.min(3 * Math.max(0, i.ageDays), 30),
    kind: KIND_WEIGHT[i.kind],
    goal: i.servesActiveGoal ? 20 : 0,
    project: i.projectWeight
  }
  const priority =
    components.blocking + components.breadth + components.age + components.kind + components.goal + components.project
  return { priority, components }
}

// ── derived obligations enter the same scale (ADR-0035 §4.2) ──────────────────

export type ObligationKind = 'access' | 'refused' | 'proposal' | 'review' | 'abandoned'

const OBLIGATION_BASE: Record<ObligationKind, number> = {
  // ADR-0115: an external agent waiting on consent is blocked right now and its request expires in ten
  // minutes — the same weight as a refusal, which is the same shape of thing.
  access: 40 + KIND_WEIGHT.access,
  refused: 40 + KIND_WEIGHT.access, // by construction blocking, and access-shaped
  proposal: 35,
  review: 25,
  abandoned: 20
}

export function obligationPriority(kind: ObligationKind, projectWeight: number): Priority {
  const base = OBLIGATION_BASE[kind]
  return {
    priority: base + projectWeight,
    components: { blocking: base, breadth: 0, age: 0, kind: 0, goal: 0, project: projectWeight }
  }
}

// ── the board is one ranked list ─────────────────────────────────────────────

export interface BoardItem {
  id: string
  priority: number
  ageDays: number
  kind: 'question' | 'access' | 'refused' | 'proposal' | 'review' | 'abandoned'
}

/**
 * Sorts by priority, then breaks ties DETERMINISTICALLY — older first, then by
 * id. Stable order under the pointer is not a nicety: a board that reshuffles
 * between reading and clicking gets the wrong thing answered.
 *
 * Returns a new array; the input is not mutated, so the same list always gives
 * the same order.
 */
export function rankBoard<T extends BoardItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    if (b.ageDays !== a.ageDays) return b.ageDays - a.ageDays // older first
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}
