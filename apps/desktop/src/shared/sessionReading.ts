// What a window onto one session may say about it (UXA-C04).
//
// MEASURED at `29f084d`. `SessionWindow` held `session` and `error` side by
// side, and the render checked `error` FIRST and returned only it. Nothing ever
// cleared that error, so a single failed read on mount killed the window for
// the life of the process while the five-second poll went on succeeding
// underneath. The operator's remedy was to close a window onto a session that
// was running perfectly and open another.
//
// AND THE POLL COULD NOT REPORT THE ONE THING IT EXISTS FOR. It was written
// `then((s) => s && setSession(s))`, and `terminal.get` answers null for a
// session the main process no longer has — so the answer that means "it is
// gone" was the one answer discarded. The exit handler's own comment says it is
// there so the header does not say "running" over a dead shell; the null case
// defeated exactly that.
//
// So: the last ANSWER and the freshness of it are different facts, and both are
// read. A refused refresh no longer takes away a terminal somebody is reading —
// the cheaper mistake, chosen and said (AX-07, AX-16, UXA-C03).

import type { TerminalSession } from './types.ts'

export interface SessionReading {
  /**
   * The last thing the main process said: the session, `null` for "this estate
   * does not have it", or `undefined` for "nobody has answered yet". Three
   * answers, because a window that cannot tell them apart shows a dead session
   * as a live one.
   */
  answer: TerminalSession | null | undefined
  /** Why the LATEST read did not land, or null because it did. */
  problem: string | null
}

export const UNREAD: SessionReading = { answer: undefined, problem: null }

/** A read that answered. It CLEARS the problem — that is the half that was
 *  missing, and the reason one hiccup was permanent. */
export function afterRead(result: TerminalSession | null): SessionReading {
  return { answer: result, problem: null }
}

/** A read that refused. It keeps the last answer: a failed refresh is not a
 *  reason to take away what the operator is looking at. */
export function afterRefusal(prev: SessionReading, why: string): SessionReading {
  return { answer: prev.answer, problem: why }
}

/**
 * Which of four screens this reading is.
 *
 * `blocked` is only for a window that has NEVER had an answer — with one in
 * hand the terminal stays and the problem is a caveat over it rather than a
 * wall in front of it.
 */
export function sessionSays(r: SessionReading): 'booting' | 'blocked' | 'gone' | 'session' {
  if (r.answer === undefined) return r.problem === null ? 'booting' : 'blocked'
  return r.answer === null ? 'gone' : 'session'
}
