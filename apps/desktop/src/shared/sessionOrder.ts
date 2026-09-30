/**
 * What is waiting for a person comes first (UX28-13).
 *
 * SCR-39's list rendered `sessions.map` in whatever order the listing arrived,
 * which is `started_at` — so an agent that has been idle for an hour sits below
 * three that are working and one that ended yesterday. The card asks for
 * actionable sessions first, and the ordering doctrine is already written down
 * in `shared/attention.ts`: group by what the row means, and inside a group put
 * the thing that has been waiting longest at the top.
 *
 *   IDLE is the actionable one. It is the state `sessionTone` paints `warn`,
 *   and it means the agent has stopped producing and nobody has answered it.
 *   RUNNING is working, and needs nothing.
 *   ENDED is an absence rather than a failure — `sessionTone`'s own words — so
 *   it goes last whatever its exit code.
 *
 * WHAT THIS IS NOT, said out loud because the card's phrase is wider than the
 * data. "Observed obligation state" in its full sense — an agent blocked on a
 * question, a claim whose holder is gone, a heartbeat that stopped (M178) —
 * lives in the attention register and in `runs.status`, NOT in a session
 * listing. This orders what a listing carries. An agent idle because it asked
 * something and an agent idle because it finished thinking look identical here,
 * and reading the obligation per session would be one query per row.
 *
 * Pure, so the order is tested without rendering anything.
 */

import type { SessionState, TerminalSession } from './types.ts'

/** Lower sorts first. Declared as data so a fourth state cannot be added to
 *  `SessionState` and silently land in the middle. */
const RANK: Record<SessionState, number> = { idle: 0, running: 1, ended: 2 }

/** What a row is for, for a reader deciding where to look. */
export function sessionRank(state: SessionState): number {
  return RANK[state]
}

/**
 * The list in reading order.
 *
 * A COPY, never in place: the array belongs to the caller's props, and sorting
 * it where it lies mutates React state that something else is still rendering.
 */
export function inAttentionOrder(sessions: readonly TerminalSession[]): TerminalSession[] {
  return [...sessions].sort((a, b) => {
    const byState = sessionRank(a.state) - sessionRank(b.state)
    if (byState !== 0) return byState
    // Oldest activity first inside a group — the one that has been waiting
    // longest, which is `attention.ts`'s rule and the same reason.
    const byWaiting = a.lastActivityAt.localeCompare(b.lastActivityAt)
    if (byWaiting !== 0) return byWaiting
    // A total order, so two sessions with the same timestamp do not swap
    // between renders and move the row under the pointer.
    return a.sessionId.localeCompare(b.sessionId)
  })
}
