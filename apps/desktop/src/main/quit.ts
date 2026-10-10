// #region quit-coordinator — docs: docs/adr/0106-fabric-adopts-the-product-lifecycle-contract.md#1-quit-ends-the-process
/**
 * One owner for quitting (CO-191, lifecycle LC-01).
 *
 * The defect this replaces: `before-quit` cancelled the quit, ran shutdown, and called
 * `app.quit()` again from the shutdown promise's `finally`. With nothing running, that
 * promise settles on the microtask queue — still inside Electron's own `Browser::Quit()`,
 * which is not re-entrant: the outer call writes `is_quitting_ = false` back after the
 * inner one. The window then closed, `window-all-closed` fired instead of `will-quit`, the
 * macOS branch ignored it, and the process stayed alive with no window — and kept running
 * its schedulers. Twenty such copies sat in the Dock on 2026-10-03.
 *
 * The rules the coordinator enforces:
 *  - the re-quit after shutdown runs on a macrotask (`schedule`), never inside the quit
 *    that triggered it;
 *  - once quitting, `window-all-closed` quits on every platform;
 *  - quitting stops every registered scheduler first, so nothing starts after quit begins;
 *  - a hard deadline ends the process if shutdown or Electron's own teardown stalls.
 */
import { spawn } from 'node:child_process'
import { quitReaperInvocation } from './platform.ts'

export interface QuitApp {
  quit(): void
  exit(code: number): void
}

export interface QuitEvent {
  preventDefault(): void
}

export interface QuitOptions {
  app: QuitApp
  /** Runs once, when the first quit request arrives while the runtime is up. */
  shutdown: () => Promise<unknown>
  /** False until the runtime that needs a drain exists; before that a quit proceeds at once. */
  ready: () => boolean
  /** Upper bound from the first quit request to process exit. */
  hardDeadlineMs?: number
  schedule?: (fn: () => void) => void
  setTimer?: (fn: () => void, ms: number) => { unref?: () => void }
  onDeadline?: () => void
  onSchedulerError?: (e: unknown) => void
  /**
   * A guard OUTSIDE this process, armed when quitting begins: it ends the pid `reaperMs` later whatever this
   * process is doing. The in-process deadline is a timer, and a timer does not run once Electron's own
   * teardown stalls after the last window and helper are gone — measured at load 55–138, an app exited
   * after 12–27 s or was still alive after 60 s (third lifecycle review, 2026-10-03).
   */
  armReaper?: (afterMs: number) => void
}

export const QUIT_DEADLINE_MS = 10_000
/**
 * A quit that needed the deadline did NOT end cleanly, and says so: exit 0 here let a stalled drain pass
 * a walk as graceful (lifecycle review 2026-10-03, finding 9). Supervisors and walks read this code.
 */
export const QUIT_DEADLINE_EXIT_CODE = 3
/** The outside guard fires this long after quitting begins: past the in-process deadline, with a margin. */
export const QUIT_REAPER_MS = 15_000

/** The default outside guard: a detached shell that kills this pid unless it has already exited. */
// Synchronous on purpose (I3 E-10): an awaited import here let a stop that blocks the main thread run before
// the reaper existed, so nothing outside the process could end it.
export function spawnQuitReaper(afterMs: number): void {
  const seconds = Math.ceil(afterMs / 1000)
  const how = quitReaperInvocation(process.platform, process.pid, seconds)
  spawn(how.file, how.args, { detached: true, stdio: 'ignore', windowsHide: true }).unref()
}

export interface QuitCoordinator {
  /** True from the first quit request on. Schedulers read it before starting work. */
  readonly quitting: boolean
  /** Registers a stop function; it runs once when quitting begins (or at once if it has). */
  onQuit(stop: () => void): void
  beforeQuit(e: QuitEvent): void
  windowAllClosed(platform: NodeJS.Platform): void
}

export function createQuitCoordinator(o: QuitOptions): QuitCoordinator {
  const schedule = o.schedule ?? ((fn: () => void) => { setImmediate(fn) })
  const setTimer = o.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const hardDeadlineMs = o.hardDeadlineMs ?? QUIT_DEADLINE_MS
  let quitting = false
  let drained = false
  const stops: Array<() => void> = []

  const runStop = (stop: () => void): void => {
    try { stop() } catch (e) {
      // Recorded by the caller's `onSchedulerError` (index.ts → ops.failed); one broken stop must not keep
      // the other schedulers running or the quit from proceeding.
      o.onSchedulerError?.(e)
    }
  }

  const begin = (): void => {
    if (quitting) return
    quitting = true
    // The deadline is the promise LC-01 makes: whatever stalls — a drain, a renderer that
    // cancels unload, Electron's teardown — the process ends. Unref'd so it never keeps an
    // otherwise finished process alive. Both guards are armed BEFORE the stops run: a stop that
    // blocks the main thread can only be ended by the outside guard (I3 E-1).
    const timer = setTimer(() => { o.onDeadline?.(); o.app.exit(QUIT_DEADLINE_EXIT_CODE) }, hardDeadlineMs)
    timer.unref?.()
    try { o.armReaper?.(QUIT_REAPER_MS) } catch (e) {
      // The outside guard is a second line; the in-process deadline above still stands.
      o.onSchedulerError?.(e)
    }
    for (const stop of stops.splice(0)) runStop(stop)
  }

  return {
    get quitting() { return quitting },
    onQuit(stop) {
      if (quitting) runStop(stop)
      else stops.push(stop)
    },
    beforeQuit(e) {
      if (drained) return
      if (!o.ready()) { begin(); return }
      e.preventDefault()
      if (quitting) return
      begin()
      void Promise.resolve()
        .then(() => o.shutdown())
        .catch(() => { /* The shutdown records its own outcome; a failure must not keep the process alive. */ })
        .finally(() => {
          drained = true
          schedule(() => o.app.quit())
        })
    },
    windowAllClosed(platform) {
      if (quitting || platform !== 'darwin') o.app.quit()
    }
  }
}
// #endregion quit-coordinator
