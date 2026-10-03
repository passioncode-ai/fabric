// One name for one thing, and the honest answer about where it opens (S13).
//
// MEASURED BEFORE THIS EXISTED, not argued. Two ref vocabularies had grown a
// fortnight apart and neither knew about the other:
//
//   `attention.ts` emits `refusal:7`, `review:t1`, `proposal:p1`, `lease:w1`
//   `board.ts` then computed `${kind}:${item.id}` over those same items
//
// so every derived obligation on the Board carried `review:review:t1` and
// `refused:refusal:7` — while `board.ts`'s own comment documented
// `review:<task>` and `refused:<ref>`. The comment described a format the code
// had never produced, and the board's test agreed with the comment because its
// fixture hand-wrote `id: 'task-1'`, a shape `attentionOf` cannot emit. A ref
// is the deep link — "one string that addresses exactly one thing" — so the
// board's identity for four of its five row kinds was wrong, and M185's Inbox
// inherited it verbatim.
//
// SO THERE IS ONE DEFINITION AND BOTH SIDES COMPOSE IT (R-005).
//
// AND `destinationOf` HAS MORE THAN TWO ANSWERS. The failure S13 names is a
// click that "lands at the generic project when the exact entity is known" —
// but its mirror is worse and had already shipped: `AttentionPanel.taskIdOf`
// treated a lease's `work_id` as a task id, so an expired lease over work that
// is not a task navigated to a task that does not exist. Both come from a
// resolver with two outcomes. This one has four, and three of them are the
// resolver saying what it cannot do:
//
//   exact          — the operator lands on the thing they clicked
//   here           — the act IS on the row; navigating away would lose it
//   project        — we know where it lives, not how to focus it, and we say so
//   unaddressable  — and the reason, rather than a click that does nothing

/** Every kind of thing a ref can address. Adding one is deliberate: the
 *  resolver below switches exhaustively, so a new kind fails the build until
 *  somebody has decided where it opens. */
export const ENTITY_KINDS = [
  'question',
  'task',
  'refusal',
  'proposal',
  'work',
  'fact',
  'transcript',
  'project',
  // ADR-0115: an external agent's request for access, answered where it is shown.
  'access-request'
] as const

export type EntityKind = (typeof ENTITY_KINDS)[number]

export interface EntityRef {
  kind: EntityKind
  /** The id in that kind's own namespace — a task id, a journal seq, a
   *  `work_id`. Never a display label: a label is not a key. */
  id: string
}

const KINDS = new Set<string>(ENTITY_KINDS)

export function formatRef(ref: EntityRef): string {
  return `${ref.kind}:${ref.id}`
}

/**
 * The inverse, and it REFUSES rather than guessing.
 *
 * Split at the first colon only: a `work_id` may contain one, and an id that
 * loses its tail addresses a different thing — or nothing — while still looking
 * like a ref.
 */
export function parseRef(text: string): EntityRef | null {
  const at = text.indexOf(':')
  if (at <= 0) return null
  const kind = text.slice(0, at)
  const id = text.slice(at + 1)
  if (!KINDS.has(kind) || id === '') return null
  return { kind: kind as EntityKind, id }
}

/**
 * The kinds whose destination is a PLACE, so a wrong project sends the operator
 * to one.
 *
 * `question`, `refusal` and `proposal` resolve to `at: 'here'` — the act is on
 * the row already on screen. There is no navigation to get wrong, and refusing
 * them on an owner mismatch would take away the button, which is worse than
 * the mismatch.
 */
const NAVIGATES = new Set<EntityKind>(['task', 'project', 'work', 'fact', 'transcript'])

export type Destination =
  /** Land on the thing itself, inside this project. */
  | { at: 'exact'; projectId: string; focus: EntityRef }
  /** The act that resolves it is on the row the operator is already looking at
   *  — answering a question, granting a refusal, deciding a proposal. Sending
   *  them elsewhere would take away the button. */
  | { at: 'here'; ref: EntityRef; act: 'answer' | 'grant' | 'decide' | 'consent' }
  /** The project is known and the entity is not focusable by any surface that
   *  exists. Named, so the row can say "this opens the project, not the fact". */
  | { at: 'project'; projectId: string; ref: EntityRef; why: string }
  | { at: 'unaddressable'; ref: EntityRef; why: string }

/**
 * Where does this ref open?
 *
 * `projectId` is the project the ROW claims, which is not always derivable from
 * the ref: a refusal's id is a journal seq and an estate-level refusal has no
 * project at all.
 *
 * `owner` is whose the REF is, when the caller knows — and it exists because
 * the row's project and the ref's project are two different facts that this
 * function used to conflate (UX28-06). Two callers pass the ITEM's own project
 * and are right. `RetroSection` passes THE PAGE'S project beside a ref taken
 * from `item.evidence`, which is a fact that may have been recorded anywhere:
 * a retro item whose evidence named a task in another project resolved to
 * `at: 'exact'` with this page's project and that project's task id, and the
 * caller opened it. A resolver that cannot be TOLD the owner cannot refuse the
 * mismatch, and every call site has to remember instead.
 *
 * `null` means the caller does not know, which is honest and common; it
 * resolves as before. This adds a check, it does not invent knowledge.
 */
export function destinationOf(input: {
  ref: EntityRef
  projectId: string | null
  owner?: string | null
}): Destination {
  const { ref, projectId } = input
  const owner = input.owner ?? null

  // REFUSED, and NOT re-pointed at the owning project. "Without routing to
  // another entity" cuts both ways: silently opening the other project would be
  // a jump out of the one the operator is looking at, which is the same class
  // of surprise as landing on the wrong thing. The refusal names the ref so the
  // row can still say what it was about.
  if (owner !== null && projectId !== null && owner !== projectId && NAVIGATES.has(ref.kind))
    return {
      at: 'unaddressable',
      ref,
      why: 'this belongs to another project, and opening it from here would leave the one you are looking at'
    }

  switch (ref.kind) {
    case 'task':
      return projectId
        ? { at: 'exact', projectId, focus: ref }
        : { at: 'unaddressable', ref, why: 'a task with no project cannot be opened' }
    case 'project':
      return { at: 'exact', projectId: ref.id, focus: ref }
    case 'question':
      return { at: 'here', ref, act: 'answer' }
    case 'refusal':
      return { at: 'here', ref, act: 'grant' }
    case 'proposal':
      return { at: 'here', ref, act: 'decide' }
    case 'access-request':
      return { at: 'here', ref, act: 'consent' }
    case 'work':
      // An expired lease over work that is not a task. It used to be navigated
      // to as though it were one; there is no screen for it, and pretending
      // otherwise puts the operator on an empty task page.
      return projectId
        ? { at: 'project', projectId, ref, why: 'this lease holds work that is not a task' }
        : { at: 'unaddressable', ref, why: 'this lease holds work that is not a task' }
    case 'fact':
      return projectId
        ? { at: 'project', projectId, ref, why: 'memory has no page for a single fact' }
        : { at: 'unaddressable', ref, why: 'memory has no page for a single fact' }
    case 'transcript':
      return projectId
        ? { at: 'project', projectId, ref, why: 'a transcript opens from its session' }
        : { at: 'unaddressable', ref, why: 'a transcript opens from its session' }
  }
}

/**
 * The address of an OBLIGATION, which is not the address of its subject.
 *
 * A task in review whose lease has also expired is two obligations about one
 * task: they end at different moments and each needs its own row key. Keyed by
 * the subject alone they collide, and the surface silently drops one of them.
 *
 * `/` because no `EntityKind` contains one, so the halves cannot be confused.
 */
export function obligationRef(kind: string, subject: EntityRef): string {
  return `${kind}/${formatRef(subject)}`
}

export function parseObligationRef(text: string): { kind: string; subject: EntityRef } | null {
  const at = text.indexOf('/')
  if (at <= 0) return null
  const subject = parseRef(text.slice(at + 1))
  return subject ? { kind: text.slice(0, at), subject } : null
}

/** The task a ref is about, when it is about one. Replaces four hand-written
 *  `startsWith`/`slice` pairs, each of which knew a different subset. */
export function taskOf(ref: EntityRef): string | null {
  return ref.kind === 'task' ? ref.id : null
}
