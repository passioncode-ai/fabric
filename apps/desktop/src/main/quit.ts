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
import { quitReaperInvocation, spawnHelper } from './platform.ts'
import { ops } from './opsSink.ts'

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
  /**
   * True while the start is in progress (the splash, the startup wait window, the failure dialog's own window, the
   * handover to the main window). Those windows are Fabric's own scaffolding, not the person's last window: on Windows
   * and Linux destroying the only one fired `window-all-closed` and quit a start that had just succeeded (0.3.9 review
   * ER-1). While this holds, `window-all-closed` quits on no platform unless a quit has already begun; a person who
   * closes such a window is answered by that window's own `close` handler (index.ts).
   */
  starting?: () => boolean
  /**
   * ADR-0192: true while a quit the person asks for should only hide Fabric (the board's service is on, see
   * `loginItem.ts#quitHolds`). Read only once the runtime is up and no quit has begun; then the quit is cancelled,
   * nothing is drained and `onHold` runs instead.
   */
  holds?: () => boolean
  /** Hides Fabric when a quit is held: closes its windows and its Dock icon (index.ts). */
  onHold?: () => void
  /** Upper bound from the first quit request to process exit. */
  hardDeadlineMs?: number
  /** The code the deadline ends the process with, read when it fires (`quitDeadlineExitCode`); 3 when not given. */
  deadlineExitCode?: () => number
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

/**
 * The 0.3.18 review, iteration 2, UX-18: the deadline's exit code. launchd restarts its job after any end that is not a
 * clean exit (the board's plist, `KeepAlive {SuccessfulExit: false}`), so a signal that ends launchd's copy (the
 * lifecycle broker's stop, `kill`) ends 0 even when its drain ran into the deadline; the stall is still recorded
 * (`onDeadline`). Every other quit that needed the deadline ends `QUIT_DEADLINE_EXIT_CODE`. The outside reaper's kill is
 * not an exit at all, so launchd starts a copy it ended again: the system cannot tell it from a crash.
 */
export function quitDeadlineExitCode(o: { signalled: boolean; underLaunchd: boolean }): number {
  return o.signalled && o.underLaunchd ? 0 : QUIT_DEADLINE_EXIT_CODE
}

/** The signals that end Fabric whatever the board's service says (ADR-0192; the 0.3.18 review PL-3, ER-13). */
export const QUIT_SIGNALS = ['SIGTERM', 'SIGHUP', 'SIGINT'] as const
export type QuitSignal = (typeof QUIT_SIGNALS)[number]

/**
 * Listens for `QUIT_SIGNALS`. Call it only once `app.whenReady()` has resolved: Electron 44 installs its own shutdown
 * handler after the main module has been evaluated, which replaces a listener added at load, so a signal then reached
 * Fabric only as a plain `app.quit()` the service held (the 0.3.18 review, iteration 2, ER-13: measured with the
 * repository's Electron 44.0.0, CJS and ESM alike; a listener added after `ready` runs and the process exits 0).
 */
export function listenForQuitSignals(proc: { on(signal: QuitSignal, fn: () => void): unknown }, onSignal: (signal: QuitSignal) => void): void {
  for (const signal of QUIT_SIGNALS) proc.on(signal, () => onSignal(signal))
}

/** The default outside guard: a detached shell that kills this pid unless it has already exited, and only while that pid
 *  is still this executable's process (platform.ts#quitReaperInvocation, 0.3.5 review ER-3). */
// Synchronous on purpose (I3 E-10): an awaited import here let a stop that blocks the main thread run before
// the reaper existed, so nothing outside the process could end it.
export function spawnQuitReaper(afterMs: number): void {
  const seconds = Math.ceil(afterMs / 1000)
  const how = quitReaperInvocation(process.platform, process.pid, seconds, process.execPath)
  // A reaper that cannot start is reported, never an uncaught 'error' (ER-10): the in-process deadline still ends the quit.
  spawnHelper(spawn, how, { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: how.verbatim === true }, (e) =>
    ops.failed('quit.reaper-spawn', e, { note: 'no outside guard for this quit; the in-process deadline still ends it' }))?.unref()
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
    const timer = setTimer(() => { o.onDeadline?.(); o.app.exit(o.deadlineExitCode?.() ?? QUIT_DEADLINE_EXIT_CODE) }, hardDeadlineMs)
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
      if (o.holds?.()) {
        try { o.onHold?.() } catch (err) {
          // Recorded by the caller's `onSchedulerError` (index.ts → ops.failed); a window that would not close must not
          // turn a held quit into an ended one, so the quit stays cancelled.
          o.onSchedulerError?.(err)
        }
        return
      }
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
      if (quitting) { o.app.quit(); return }
      // #region startup-window-scaffolding — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
      if (o.starting?.()) return
      // #endregion startup-window-scaffolding
      if (platform !== 'darwin') o.app.quit()
    }
  }
}
// #endregion quit-coordinator
