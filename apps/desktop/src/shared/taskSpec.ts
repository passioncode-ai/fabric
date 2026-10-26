// #region task-spec — docs: docs/adr/0176-a-task-is-grilled-to-a-full-spec-and-crosses-machines-by-trust.md#decision
// Whether a task's spec is gathered (ADR-0176 §1, SCN-176): the brief's three parts, what, why and expected, each
// written. Out of scope and the constraints are part of «expected» (the intake rule says so), so three parts are
// the whole spec in 0.3.12 without a new column. Derived, never stored: a brief written later clears it at once.

export type SpecPart = 'what' | 'why' | 'expected'

export interface BriefParts {
  brief_what?: string | null
  brief_why?: string | null
  brief_expected?: string | null
}

const PARTS: readonly [SpecPart, keyof BriefParts][] = [
  ['what', 'brief_what'],
  ['why', 'brief_why'],
  ['expected', 'brief_expected']
]

/** The parts of the brief not written yet, in the order the brief shows them; empty when the spec is whole. */
export function specGaps(task: BriefParts): SpecPart[] {
  return PARTS.filter(([, key]) => (task[key] ?? '').trim() === '').map(([part]) => part)
}

/**
 * Whether the task should say its spec is not gathered: a task still to be done or in work with a part missing.
 * A finished or cancelled task is history, and asking for its spec helps nobody.
 */
export function specMissing(task: BriefParts & { status?: string | null }): boolean {
  if (task.status === 'done' || task.status === 'cancelled') return false
  return specGaps(task).length > 0
}
/** What each part of the brief holds, as an agent is told it. */
const PART_SAYS: Record<SpecPart, string> = {
  what: 'what should happen',
  why: 'why it matters',
  expected: 'what is true when it is done'
}

/** What an agent is told about a brief it has not written (0.3.14 wave 2): on its claim, and in the sweep's reminder ten
 *  minutes later. Advisory: nothing is refused for it. */
export function briefNext(gaps: readonly SpecPart[]): string {
  return `Its brief is missing ${gaps.join(', ')}: write each with fabric_task_brief (${PARTS.map(([p]) => `${p}: ${PART_SAYS[p]}`).join('; ')}), so the operator and the next agent can read the task.`
}
// #endregion task-spec
