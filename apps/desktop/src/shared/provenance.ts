// What a column MEANS depends on who put the card in it (M124).
//
// The board rendered a position and said nothing about the hand that moved it.
// For `review` that is not cosmetic: an AGENT moving work there is saying "I
// believe this is done", and an OPERATOR moving it there is saying "come back
// and look at this". Same cell, opposite meanings, and this product's thesis is
// that an agent's account of its work is a CLAIM rather than an outcome. A
// status with no provenance is a claim with no owner.
//
// THIS FUNCTION IS DELIBERATELY QUIET. It speaks in two situations and stays
// silent everywhere else, because a line under every card is a line nobody
// reads:
//
//   * `review`, where the mover decides what the column is saying.
//   * a terminal state reached by an agent, which `ladder.ts` forbids in two
//     places. If the journal says it happened anyway, the surface SAYS SO. A
//     projection may not quietly disagree with the journal (operating-surfaces
//     §4.1), and the display is the last place that rule can be broken.
//
// It says nothing for `backlog` or `running`: an agent holding work is already
// visible as its lease, and a second sentence saying the same thing is how two
// statements of one fact begin to disagree. And nothing when the task has never
// moved — null is "never moved", not "moved by nobody".

import { TERMINAL, type TaskState } from './ladder.ts'

export type MoveActorKind = 'person' | 'agent' | null | undefined

export interface MoveNote {
  /** A key in the string registry. */
  key: 'move.reviewByAgent' | 'move.reviewByPerson' | 'move.terminalByAgent'
  tone: 'info' | 'quiet' | 'warn'
  /** The journal asserts something the ladder forbids. Not an error to swallow:
   *  it is the most important thing on the card when it is true. */
  contradiction: boolean
}

export function describeMove(status: TaskState, kind: MoveActorKind): MoveNote | null {
  if (kind !== 'person' && kind !== 'agent') return null

  if (TERMINAL.includes(status))
    return kind === 'agent'
      ? { key: 'move.terminalByAgent', tone: 'warn', contradiction: true }
      : // A person is the ONLY way to reach a terminal state, so saying so adds
        // nothing. The silence here is what makes the warning above loud.
        null

  if (status === 'review')
    return kind === 'agent'
      ? { key: 'move.reviewByAgent', tone: 'info', contradiction: false }
      : { key: 'move.reviewByPerson', tone: 'quiet', contradiction: false }

  return null
}
