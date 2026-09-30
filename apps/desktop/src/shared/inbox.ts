// Two lanes, and only one of them can be marked read (M185, ADR-0041 §5).
//
// MEASURED: there is no inbox. The feed is one reverse-chronological list —
// obligations and history together, no deep link, no detail, no read state
// anywhere in the tree. So "what needs me" and "what happened" are the same
// scroll, and the first is buried in the second exactly when the second is
// busy.
//
// THE ASYMMETRY IS THE DESIGN, and it is enforced by the TYPES rather than by
// discipline. `attention.ts` already carries the rule: the needs-you queue is
// DERIVED, so nothing can be dismissed — an item leaves when the thing it names
// is resolved and not before. A queue you can mark as read is a queue that
// lies, and the lie is worst when the list is long.
//
// So a needs-you item has no `readState` FIELD. Not a field that is ignored: a
// field that does not exist, so a surface cannot render a checkbox beside an
// obligation and a command cannot be written that clears one. ADR-0049's shape
// applied to a data model.
//
// AND THE CURSOR NEVER MOVES BY ITSELF. Not on arrival, not on an error, not
// because a poll returned. It moves when a person says what they saw — and
// only up to what they actually saw, which is why the command carries the seq
// that was visible rather than the newest one.

/** What a needs-you item is: an obligation, with the act that ends it. */
export interface NeedsYouItem {
  /** The Board's own ref — this lane is the Board, not a copy of it. */
  ref: string
  projectId: string | null
  title: string
  /** Where it came from, so the row can be followed to the thing itself. */
  sourceRef: string
  /** Higher is more urgent; the Board's rank, not a second one. */
  priority: number
  // DELIBERATELY NO readState. See the header: the absence is the mechanism.
}

export interface HappenedItem {
  /** `<estate>:<seq>` — the journal's own address, so a row is followable. */
  id: string
  seq: number
  kind: string
  title: string
  occurredAt: string
  projectId: string | null
  /** What it was about, so "happened" leads somewhere. */
  subjectRef: string | null
  severity: 'info' | 'warn'
}

export type InboxLane = 'needs_you' | 'happened'

export interface ReadCursor {
  /** Everything at or below this seq has been seen by this operator. */
  throughSeq: number
}

/** A cursor this build may use, or one it must not. */
export type CursorReading =
  | { usable: true; cursor: ReadCursor }
  | { usable: false; cursor: ReadCursor; says: string }

/**
 * The cursor to read with, given what the estate actually holds (AX-07).
 *
 * `throughSeq` is a position in ONE journal, and a restore mints a new
 * generation whose sequence starts again. A cursor saved at 9000 against an
 * estate whose highest seq is now 12 marks EVERYTHING read: an operator who has
 * never looked at this estate is shown an empty feed and told they are up to
 * date. `unreadCount` returns 0 and is not lying — the cursor is.
 *
 * The reset goes to NOTHING read rather than to everything read, and that
 * direction is the whole decision: showing an item twice costs a glance, and
 * hiding one costs the thing it was about. An estate with no events keeps its
 * zero, because "nothing has happened yet" is not a restore.
 */
export function cursorFor(input: { saved: ReadCursor; highestSeq: number }): CursorReading {
  if (input.saved.throughSeq <= input.highestSeq) return { usable: true, cursor: input.saved }
  return {
    usable: false,
    cursor: { throughSeq: 0 },
    says:
      `this read position is past everything this estate holds, which happens when a generation is ` +
      `restored. Nothing is marked read, so the history is shown again rather than hidden.`
  }
}

export type CursorMove =
  | { moved: true; cursor: ReadCursor }
  | { moved: false; reason: string; cursor: ReadCursor }

/**
 * Move the read cursor, if this is a move a person actually made.
 *
 * REFUSES to go backwards, refuses to jump past what was visible, and — the
 * one that matters — cannot be called by anything that merely received data.
 * A cursor advanced by arrival marks things read that nobody looked at, and
 * then the unread count is a measure of polling rather than of attention.
 */
export function advanceCursor(input: {
  cursor: ReadCursor
  /** The highest seq the operator could actually see when they acted. */
  visibleThroughSeq: number
  /** What the caller believed the cursor was. A mismatch means another window
   *  moved it, and this move is answering a screen that has changed. */
  expectedThroughSeq: number
}): CursorMove {
  if (input.expectedThroughSeq !== input.cursor.throughSeq)
    return {
      moved: false,
      reason: 'the cursor moved somewhere else while this screen was open; refresh and look again',
      cursor: input.cursor
    }
  if (input.visibleThroughSeq < input.cursor.throughSeq)
    return {
      moved: false,
      // Going backwards would be a person un-reading something, which is not a
      // thing this cursor models — and doing it silently would inflate the
      // unread count for reasons nobody could trace.
      reason: 'that is behind where this operator has already read',
      cursor: input.cursor
    }
  return { moved: true, cursor: { throughSeq: input.visibleThroughSeq } }
}

/** How many happened items this operator has not seen. Needs-you is NOT
 *  counted here: an obligation is not unread, it is unmet. */
export function unreadCount(items: readonly HappenedItem[], cursor: ReadCursor): number {
  return items.filter((i) => i.seq > cursor.throughSeq).length
}

export type Emptiness =
  /** Confirmed: the sources answered and there is nothing. */
  | 'verified_empty'
  /** A producer for this lane is not wired at all. Different from nothing
   *  having happened, and an operator reading "all clear" deserves the
   *  difference. */
  | 'uninstrumented'
  /** A source could not be read. */
  | 'source_unavailable'

export function emptiness(input: {
  itemCount: number
  producersWired: boolean
  allSourcesRead: boolean
}): { state: Emptiness | 'has_items'; says: string } {
  if (input.itemCount > 0) return { state: 'has_items', says: '' }
  if (!input.allSourcesRead)
    return { state: 'source_unavailable', says: 'a source could not be read, so this may not be all of it' }
  if (!input.producersWired)
    return {
      state: 'uninstrumented',
      says: 'nothing produces items for this lane yet — this is not the same as nothing having happened'
    }
  return { state: 'verified_empty', says: 'nothing here' }
}

/**
 * One obligation, one row.
 *
 * An occurrence and its resolution are DIFFERENT events and both belong in the
 * happened lane; what must not double is the obligation itself, which the Board
 * already keys by ref.
 */
export function dedupeNeedsYou(items: readonly NeedsYouItem[]): NeedsYouItem[] {
  const seen = new Set<string>()
  const out: NeedsYouItem[] = []
  for (const i of items) {
    if (seen.has(i.ref)) continue
    seen.add(i.ref)
    out.push(i)
  }
  return out
}
