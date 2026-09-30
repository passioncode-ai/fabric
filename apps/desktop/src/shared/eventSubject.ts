// What a journal row is ABOUT, when that can be said at all (UXA-C06).
//
// SCN-026 promises a receipt link on every feed row and `Feed.tsx` rendered a
// sentence, a sequence number and a project name — no row opened anything. The
// card's own acceptance names the trap in the same breath: an unknown subject
// must state that it is unverified and MUST NOT invent a task id.
//
// SO THE MAP IS DECLARED, ONE VERIFIED WRITER AT A TIME, and everything else is
// refused. The tempting version is a prefix rule — "a `task.*` event carries a
// task id in `payload.id`" — and it is wrong in this very family: `task.created`
// and `task.finished` write `id`, while `task.closed` and `task.note.added`
// write `task_id`. A prefix rule would have opened a task page for the id that
// was not there, which is exactly the invention the acceptance forbids.
//
// COVERAGE, MEASURED 2026-09-11 by reading the code that APPENDS each one: 10 of
// the 72 event types the feed can describe. That is a tenth, and it is the tenth
// whose payload key was read rather than assumed. The list grows by verifying a
// writer, never by pattern — and a declared type whose key is absent from a
// given row is refused too, so a row cannot be opened on a key that is not
// there.
//
// A known subject is still not a destination: `destinationOf` decides whether
// any screen can focus that ref, and it has four answers of which one is an
// address. This module answers what the row is about; that one answers where it
// opens.

import type { EntityKind, EntityRef } from './entityRef.ts'

/** What the row is about, or why nobody can say. */
export type EventSubject =
  | { known: true; ref: EntityRef }
  | { known: false; why: string }

interface Declared {
  kind: EntityKind
  /** Payload keys that hold the subject's id, in the order they are tried.
   *  Every one of them was read off the code that writes that event. */
  keys: readonly string[]
}

/** The event's own sequence is the subject's id — there is no payload key,
 *  because the thing being addressed IS this journal row. */
const BY_SEQ = 'seq'

const DECLARED: Record<string, Declared> = {
  'task.created@1': { kind: 'task', keys: ['id'] },
  'task.finished@1': { kind: 'task', keys: ['id'] },
  'task.moved@1': { kind: 'task', keys: ['id'] },
  'task.closed@1': { kind: 'task', keys: ['task_id'] },
  'task.note.added@1': { kind: 'task', keys: ['task_id'] },
  'question.asked@1': { kind: 'question', keys: ['id'] },
  'proposal.filed@1': { kind: 'proposal', keys: ['id'] },
  'work.claimed@1': { kind: 'work', keys: ['work'] },
  'transcript.captured@2': { kind: 'transcript', keys: ['session_id'] },
  'transcript.captured@1': { kind: 'transcript', keys: ['session_id'] },
  // A refusal is addressed by the sequence of the row that recorded it, which
  // is how `attention.ts` builds the same ref for the same event.
  'policy.decided@1': { kind: 'refusal', keys: [BY_SEQ] }
}

/** How many event types this module can answer for, for anything that wants to
 *  state the coverage rather than imply it. */
export const DECLARED_EVENT_TYPES = Object.keys(DECLARED).length

export function subjectOfEvent(event: {
  type: string
  seq: number
  payload: Record<string, unknown>
}): EventSubject {
  const declared = DECLARED[event.type]
  if (!declared)
    return {
      known: false,
      why: `nothing has been verified about what a ${event.type} row is about`
    }
  for (const key of declared.keys) {
    const raw = key === BY_SEQ ? String(event.seq) : event.payload[key]
    if (typeof raw === 'string' && raw.length > 0)
      return { known: true, ref: { kind: declared.kind, id: raw } }
  }
  // DECLARED AND ABSENT. The writer names this key, and this row does not carry
  // it — an older row, a different path, a bug. Refusing is the only answer
  // that does not make one up.
  return {
    known: false,
    why: `this ${event.type} row does not carry ${declared.keys.join(' or ')}`
  }
}
