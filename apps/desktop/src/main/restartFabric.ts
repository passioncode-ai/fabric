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
import { pluralForm, type Locale, type Translate } from '../renderer/src/i18n/translate.ts'

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

/** The helper's note in the data folder: one line per refusal (`shared/loginItem.ts#restartPlan`), absent when none. */
export const RESTART_OUTCOME_FILE = 'restart-outcome'

/** Reads and removes the helper's note: its lines, or null when there is none (the restart went as asked) or it cannot be
 *  read (the 0.3.18 review, iteration 2, ER-15). */
export function takeRestartOutcome(userData: string): string[] | null {
  const file = path.join(userData, RESTART_OUTCOME_FILE)
  let lines: string[]
  try {
    lines = readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
  } catch {
    // No note: the helper wrote nothing, so launchd took the job as asked; this is the ordinary start.
    return null
  }
  try { rmSync(file, { force: true }) } catch { /* a note that stays is said again by the next start, never lost */ }
  return lines.length ? lines : null
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
/** The question «Перезапустить Fabric» asks before it ends live consoles: a native message box's options and which of
 *  its buttons restarts. */
export interface RestartConfirmation {
  type: 'warning'
  message: string
  detail: string
  buttons: string[]
  defaultId: number
  cancelId: number
  restartId: number
  noLink: true
}

/**
 * The 0.3.18 review, iteration 2, UX-15: a restart ends every terminal Fabric hosts, as a quit does, while a held Quit
 * keeps them. With live consoles the restart asks once, naming how many end, and Cancel is the default answer; with none
 * it asks nothing (null) and restarts at once.
 */
export function restartConfirmation(live: number, say: Translate, locale: Locale): RestartConfirmation | null {
  if (!Number.isSafeInteger(live) || live <= 0) return null
  return {
    type: 'warning',
    message: say('restart.confirm.title'),
    detail: say(`restart.confirm.detail.${pluralForm(locale, live)}`, { count: live }),
    buttons: [say('restart.confirm.restart'), say('common.cancel')],
    restartId: 0,
    defaultId: 1,
    cancelId: 1,
    noLink: true
  }
}
// #endregion restart-fabric
