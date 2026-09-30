// What `link_tasks` answers, declared once (FA-04 · R-005).
//
// The command is the ONLY writer of `task.linked@1`: it takes the estate lock,
// then checks scope, project, idempotency and topology, then appends — all in
// one transaction. Before it, the check lived in the client one round trip
// early, and the two failures that came of that are recorded in migration
// 20260910000053 and in ADR-0053.
//
// Every caller reads this shape. A second copy of it in each caller would drift
// from the SQL that produces it, and the drift would be invisible until a
// refusal arrived under a code nobody handled.

/** Why a link was not recorded. `exists` and `linked` are successes. */
export type LinkReasonCode =
  | 'linked'
  | 'exists'
  /** The link would make a queue that loops back on itself. */
  | 'cycle'
  /** No such task in this estate — the SAME answer as "it belongs to another
   *  estate", so a refusal cannot be used to discover ids across the boundary. */
  | 'not_found'
  | 'cross_project'
  /** The tasks are real, and not in the project the caller is working in. */
  | 'out_of_scope'
  | 'self'
  | 'unknown_rel'
  /** The command could not run. NOT a permission to write anyway: the failure
   *  this replaces was a check whose error was dropped, leaving the append. */
  | 'unavailable'

export interface LinkVerdict {
  linked: boolean
  /** True when the edge was already recorded: one act, recorded once. */
  already?: boolean
  seq?: number
  reason_code?: LinkReasonCode
  says?: string
  remedy?: string
}

/** One sentence a person or an agent can act on, from a verdict. */
export function linkRefusal(verdict: LinkVerdict): string {
  return [verdict.says, verdict.remedy].filter(Boolean).join(' ')
}

/**
 * Turn what the client returned into a verdict, refusing on uncertainty.
 *
 * ONE definition, because this is the exact line the old code got wrong. It read
 *
 *   const { data: closes } = await db.rpc('would_close_cycle', …)
 *   if (closes === true) …refuse
 *
 * — `error` dropped, so a check that could not run produced `data: null`,
 * `null === true` was false, and the write proceeded. The shape repeats
 * wherever a caller reads `data` without reading `error`, so the mapping lives
 * here and both callers use it rather than each writing the two branches again.
 *
 * A missing verdict is `unavailable`, NOT a success. An answer that did not
 * arrive and an answer that said yes are different things, and only one of them
 * may be written on.
 */
export function linkOutcome(data: unknown, error: { message: string } | null): LinkVerdict {
  if (error)
    return { linked: false, reason_code: 'unavailable', says: `the link was not recorded: ${error.message}` }
  const verdict = data as Partial<LinkVerdict> | null
  if (!verdict || typeof verdict.linked !== 'boolean')
    return {
      linked: false,
      reason_code: 'unavailable',
      says: 'the link command returned no verdict, so nothing is recorded'
    }
  return verdict as LinkVerdict
}
