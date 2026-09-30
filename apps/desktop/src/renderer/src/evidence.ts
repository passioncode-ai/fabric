// A figure opens the register it was counted from (M142).
//
// The rule was written in three screens' state tables and applied nowhere: the
// numbers named their register in words and were not pressable. **A figure that
// cites a source it will not open is a claim wearing a citation** — which is the
// same defect this repository spent a day removing from its documents, standing
// in the interface instead.
//
// TWO WAYS TO REINTRODUCE IT, and this module exists to close both.
//
// 1. A pressable figure that goes nowhere. The pattern already in the project
//    header was `document.getElementById(a)?.scrollIntoView(…)`, and the `?.`
//    SWALLOWS a missing target: rename a section and the number stays pressable
//    and does nothing, which is worse than never having been pressable. `reveal`
//    reports instead, and says which anchor it could not find.
// 2. A figure wired to a register that does not exist on the screen it is on.
//    The anchors are a union type, so a typo cannot be written; and
//    `check-design.mjs` holds this list equal to the ids the components actually
//    render, so a name that is spelled right and rendered nowhere fails the
//    build.
//
// What is NOT here is as deliberate: a figure whose register has no surface yet
// is left unpressable and does not name one. Giving it a tooltip that says where
// the rows "would" be is the original defect with extra steps.

/** Every section a figure may open. Kept equal to the rendered ids by the
 *  design gate — this list is a claim about the screens, not a wish. */
export const EVIDENCE_ANCHORS = [
  'sec-agents',
  'sec-board',
  'sec-decisions',
  'sec-digest',
  'sec-estate-journal',
  'sec-estate-projects',
  'sec-files',
  'sec-harness',
  'sec-journal',
  'sec-memory',
  'sec-memory-misses',
  'sec-memory-overview',
  'sec-plan',
  'sec-profile',
  'sec-repos',
  'sec-transcripts'
] as const

export type EvidenceAnchor = (typeof EVIDENCE_ANCHORS)[number]

/**
 * Bring the register into view. Returns whether it was found, because the
 * caller silently doing nothing is the failure this whole module is about.
 */
export function reveal(anchor: EvidenceAnchor): boolean {
  const el = document.getElementById(anchor)
  if (!el) {
    console.error(
      `evidence: no section with id "${anchor}". A figure that opens nothing is ` +
        `the defect M142 names, so this is reported rather than ignored.`
    )
    return false
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  return true
}

/** The handler form, for `onClick`. */
export const go =
  (anchor: EvidenceAnchor): (() => void) =>
  () => {
    reveal(anchor)
  }
