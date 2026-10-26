// #region launch-folder-lock — docs: docs/evidence/plans/2026-10-11-release-040-agents-first.md#c1--harness-one-session-surface-three-ways-in
// No second coding agent in a project's folder while an earlier launch there has an unknown outcome (CO-236, REQ-33).
//
// A managed launch whose process started and whose setup then failed (bind or liveness not confirmed) answers
// `launch_outcome_unknown`: Fabric asked the process to stop, and a signal is not proof of exit. Before this, the
// window could not tell that case from "nothing started" and offered «Use another coding agent», which cancelled the
// first task and started a second agent in the same folder while the first might still be writing there.
//
// The lock is held by the session whose outcome is unknown, and only while Fabric still sees that process running:
// the moment it has ended (observed by the terminal manager) the outcome is known and the folder is free. The operator
// clears it by stopping that session in its console. A lock never expires by time — an agent that is still running is
// exactly the case it exists for.
export interface FolderLocks {
  /** The session holding this project's folder, or null; a holder whose process has ended is dropped here. */
  holder(projectId: string): string | null
  /** Hold the folder for this session, whose launch outcome is unknown. */
  lock(projectId: string, sessionId: string): void
  /** Whether any folder may be held, so a launch reads its task's project only then. */
  any(): boolean
}

export function createFolderLocks(deps: { running(sessionId: string): boolean }): FolderLocks {
  const held = new Map<string, Set<string>>()
  return {
    holder(projectId) {
      const sessions = held.get(projectId)
      if (!sessions) return null
      for (const s of [...sessions]) if (!deps.running(s)) sessions.delete(s)
      if (sessions.size === 0) { held.delete(projectId); return null }
      return [...sessions][0]
    },
    any: () => held.size > 0,
    lock(projectId, sessionId) {
      if (!deps.running(sessionId)) return
      const sessions = held.get(projectId) ?? new Set<string>()
      sessions.add(sessionId)
      held.set(projectId, sessions)
    }
  }
}

/** What the person is told when a launch is refused for a held folder. */
export const FOLDER_HELD_SAYS =
  'An earlier coding agent in this project folder may still be running: its launch did not finish setting up, and Fabric has not seen it end. ' +
  'No second agent starts here until it has. Open its console and stop it, then start again.'
/** A held folder could not be checked because the task's project did not read (0.3.13 review ER-7): said as that, not
 *  as an agent that may still be running, which may not exist. */
export const FOLDER_UNREAD_SAYS =
  'Fabric could not read which project this task belongs to, so it cannot tell whether an earlier agent still works in its folder. ' +
  'Nothing was started. Try again in a moment.'
// #endregion launch-folder-lock
