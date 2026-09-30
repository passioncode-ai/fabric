// The board ladder, and who is allowed to move a task along it (M146 step 3).
//
// THE RULE THIS FILE EXISTS FOR: an agent does not close its own task, in
// either direction. It may move work to `review` and say what it concluded;
// accepting that conclusion — or cancelling the work — is a person's move.
//
// This is not caution about bugs. It is the product's whole thesis in one
// table: an agent's account of its work is a CLAIM, and a claim that can write
// itself into an outcome is indistinguishable from the outcome. The vision says
// we automate explicit loops and not implied authority; an agent marking its
// own work done is implied authority with no receipt. When we do want that
// automated, it goes through a grant like any other floored act — not through a
// quietly widened table here.
//
// Shared rather than living in the tool, because the interface will need the
// same answer when the board becomes draggable (step 4), and two copies of a
// permission table is how a rule stops being one.

export type TaskState = 'backlog' | 'running' | 'review' | 'done' | 'cancelled'

/** Where a task may go from where it is. Terminal states go nowhere. */
export const LADDER: Record<TaskState, readonly TaskState[]> = {
  backlog: ['running', 'done', 'cancelled'],
  running: ['review', 'backlog', 'done', 'cancelled'],
  review: ['running', 'done', 'cancelled'],
  done: [],
  cancelled: []
}

/** A closed task does not reopen. The record of what happened stays whole, and
 *  work that resumes is new work with its own origin. */
export const TERMINAL: readonly TaskState[] = ['done', 'cancelled']

export type MoveActor = 'agent' | 'person'

export type MoveVerdict = { ok: true } | { ok: false; reason: string }

export function mayMove(actor: MoveActor, from: TaskState, to: TaskState): MoveVerdict {
  if (from === to) return { ok: false, reason: `the task is already in ${to}` }
  if (TERMINAL.includes(from))
    return {
      ok: false,
      reason: `${from} is a closed state and does not move; file a new task instead`
    }
  if (!LADDER[from].includes(to))
    return {
      ok: false,
      reason: `${from} does not lead to ${to} — from here a task goes to ${LADDER[from].join(' or ')}`
    }
  if (actor === 'agent' && TERMINAL.includes(to))
    return {
      ok: false,
      reason: `an agent does not close its own task. Move it to review and say what you concluded — accepting or cancelling it is the operator's move`
    }
  return { ok: true }
}
