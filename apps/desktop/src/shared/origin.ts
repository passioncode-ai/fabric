// Where a task came from, and how to walk back (M124).
//
// A task has carried `origin_kind` and `origin_ref` since the board shipped, and
// the tool refuses to create one without them: a card with no evidence is not
// actionable. What was missing is the OTHER direction — "what did this document
// produce" — and it was missing for a reason that would not have shown up in a
// demo.
//
// THE REF IS NOT A KEY. `docs/adr/0014.md:22` and `docs/adr/0014.md:40` are two
// tasks from one document, and a reverse lookup on the whole string never puts
// them together. Written that way the feature LOOKS built: every task shows its
// origin, and the sibling list is simply always empty. So the document part is
// separated from the location part, and the index is on the document.
//
// The naive split is the defect this file exists to avoid: `ref.split(':')[0]`
// turns `https://example.com/decisions` into `https`. Only a TRAILING line or
// line-range is a location; every other colon is part of the document's name.

/** What a task can have come out of.
 *
 *  `document` and `memory` are new. Before them an agent filing work from a
 *  recorded decision had to call it an `observation`, which is the word for
 *  something Fabric measured rather than something a person wrote down.
 *
 *  Deliberately NOT enforced by a CHECK on `project_tasks`: §4.1 of
 *  `operating-surfaces.md` says a projection may not refuse what the journal
 *  accepted. The tool is the write boundary and the enum lives there. */
export const ORIGIN_KINDS = ['observation', 'person', 'task', 'document', 'memory'] as const
export type OriginKind = (typeof ORIGIN_KINDS)[number]

/** A trailing `:12` or `:12-40`, and nothing else. Anchored at the end so a
 *  scheme's colon, a Windows drive letter or a timestamp in the middle of a
 *  name survives untouched. */
const LOCATION = /:\d+(?:-\d+)?$/

/** The document a ref points INTO, with any line or range removed. */
export function originDocument(ref: string): string {
  return ref.trim().replace(LOCATION, '')
}

/** The line or range, when the ref names one. Null is "the whole document",
 *  which is a different statement from "line 0". */
export function originLocation(ref: string): string | null {
  const m = ref.trim().match(LOCATION)
  return m ? m[0].slice(1) : null
}

/** Whether two refs point into the same document, whatever they say about
 *  where in it. This is the comparison the sibling list is built on. */
export function sameDocument(a: string, b: string): boolean {
  return originDocument(a) === originDocument(b)
}

/** Whether a kind's ref names something a sibling list makes sense for. A task
 *  whose origin is a PERSON has no siblings worth showing: "three other tasks
 *  also came from the operator" is true and useless. */
export function hasSiblings(kind: string): boolean {
  return kind === 'document' || kind === 'memory' || kind === 'observation'
}
