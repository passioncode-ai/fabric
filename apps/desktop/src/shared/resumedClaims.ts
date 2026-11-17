// #region resumed-claims — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#312-a-resumed-session-takes-its-claims-back
/**
 * A session resumed after a usage limit takes its claims back (board finding from dissy, 2026-11-16, point 4). Switchboard
 * continues a session stopped on a limit with `claude --resume`: a new process under the same runtime session id, whose
 * fabric-mcp enrolls as a new Fabric session (the old one ended with its process, and its claims were released as
 * `session-ended`, or by the sweep as `lapsed`). At that enrollment the claims the earlier Fabric sessions of the same
 * runtime session and binding left that way are claimed again for the new one, when the work is still theirs: the
 * release is the task's newest claim (nobody took it since), within the supervisor's week, the task open, not held by a
 * run, not moved by a person since. A claim the session let go, handed over or finished, or the operator released, is
 * never brought back. Pure: `main/resumedClaims.ts` reads the rows and writes the claims.
 */
import { RESUME_WINDOW_MS } from './boardResume.ts'

/** The ends of a claim that were not the session's own choice: its process ended, or its claim lapsed. */
export const HANDBACK_HOWS: ReadonlySet<string> = new Set(['session-ended', 'lapsed'])
const OPEN: ReadonlySet<string> = new Set(['backlog', 'running'])

export interface LeftClaim {
  claimId: string
  taskId: string
  ownerSession: string
  releasedAt: string | null
  how: string | null
  touches: string[]
  /** The Observatory workflow the claim named, carried to the new claim. */
  workflowId: string | null
}

export interface HandBackTask {
  id: string
  status: string
  movedAt: string | null
  movedByKind: string | null
  /** The task's newest claim, live or released. */
  newestClaimId: string | null
  /** A run Fabric launched for the task holds it until it is proved stopped (`workRead.ts#readRunHolds`). */
  runHeld: boolean
}

export function claimsToHandBack(input: { earlierSessions: ReadonlySet<string>; left: readonly LeftClaim[]; tasks: ReadonlyMap<string, HandBackTask>; now: number }): LeftClaim[] {
  const out = new Map<string, LeftClaim>()
  for (const c of input.left) {
    if (!input.earlierSessions.has(c.ownerSession) || !c.how || !HANDBACK_HOWS.has(c.how) || !c.releasedAt) continue
    const released = Date.parse(c.releasedAt)
    if (!Number.isFinite(released) || input.now - released > RESUME_WINDOW_MS) continue
    const t = input.tasks.get(c.taskId)
    if (!t || !OPEN.has(t.status) || t.runHeld || t.newestClaimId !== c.claimId) continue
    const moved = t.movedAt ? Date.parse(t.movedAt) : NaN
    if (t.movedByKind === 'person' && Number.isFinite(moved) && moved > released) continue
    if (!out.has(c.taskId)) out.set(c.taskId, c)
  }
  return [...out.values()].sort((a, b) => Date.parse(a.releasedAt!) - Date.parse(b.releasedAt!) || a.taskId.localeCompare(b.taskId))
}
// #endregion resumed-claims
