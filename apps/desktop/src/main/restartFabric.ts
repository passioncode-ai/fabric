// #region restart-fabric — docs: docs/adr/0192-the-board-is-a-service-launchd-keeps.md#decision
/**
 * «Перезапустить Fabric» (the 0.3.18 review, iteration 1, UX-3). With the board's service on, a person's Quit only hides
 * Fabric, so the advice «quit and reopen» no longer restarts the hub or the stack; this is the restart that does. The
 * decision is `shared/loginItem.ts#restartPlan`; this module carries out its launchd half and keeps the one-line note
 * that tells the next start the person asked for a window.
 */
import { spawn } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** The note's file in the data folder: the time the restart was asked, in ms. */
export const RESTART_WINDOW_FILE = 'restart-window'

/** Records that the next start is a restart's and shows its window. A note that cannot be written only means that start
 *  may begin without a window, as any launchd start does; the restart itself still happens. */
export function askRestartWindow(userData: string, now: number): boolean {
  try {
    writeFileSync(path.join(userData, RESTART_WINDOW_FILE), String(now), { mode: 0o600 })
    return true
  } catch {
    // Said by the doc comment above: the restart still happens, only its window may not open; false lets the caller know.
    return false
  }
}

/** Reads and removes the note: the time a restart was asked, or null when there is none or it cannot be read. */
export function takeRestartWindow(userData: string): number | null {
  const file = path.join(userData, RESTART_WINDOW_FILE)
  let at: number | null = null
  try {
    const n = Number(readFileSync(file, 'utf8').trim())
    at = Number.isFinite(n) ? n : null
  } catch {
    // No note, or one that cannot be read: this start was not asked to show its window, which is the default.
    return null
  }
  try { rmSync(file, { force: true }) } catch { /* a note that stays is read as too old by the next start */ }
  return at
}

/** Starts the helper that waits for this process to end and asks launchd for the job; detached, so it outlives Fabric. */
export function spawnRestartHelper(command: string, args: string[], onError: (e: unknown) => void): boolean {
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' })
    child.on('error', onError)
    child.unref()
    return true
  } catch (e) {
    // The caller's onError records it (index.ts: ops.failed 'app.restart-helper'); the false tells it to relaunch instead.
    onError(e)
    return false
  }
}
// #endregion restart-fabric
