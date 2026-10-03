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
   * Windows holding work a quit would lose (an editor with unsaved changes). The FIRST quit request
   * while any exists stops nothing: it hands them to `onBlocked` so the person sees the editor's own
   * "unsaved changes" choice. A further request is "quit anyway". Before this, the quit began, the
   * editor cancelled its unload, and the hard deadline then ended the process — losing the work
   * (lifecycle review 2026-10-03, finding 7).
   */
  blockers?: () => number[]
  onBlocked?: (ids: number[]) => void
  /** A second request within this window after the question is "quit anyway"; later, it asks again. */
  confirmWindowMs?: number
  now?: () => number
}

export const QUIT_DEADLINE_MS = 10_000
/**
 * A quit that needed the deadline did NOT end cleanly, and says so: exit 0 here let a stalled drain pass
 * a walk as graceful (lifecycle review 2026-10-03, finding 9). Supervisors and walks read this code.
 */
export const QUIT_DEADLINE_EXIT_CODE = 3

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
  let askedAt = -Infinity
  const confirmWindowMs = o.confirmWindowMs ?? 60_000
  const now = o.now ?? Date.now
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
    for (const stop of stops.splice(0)) runStop(stop)
    // The deadline is the promise LC-01 makes: whatever stalls — a drain, a renderer that
    // cancels unload, Electron's teardown — the process ends. Unref'd so it never keeps an
    // otherwise finished process alive.
    const timer = setTimer(() => { o.onDeadline?.(); o.app.exit(QUIT_DEADLINE_EXIT_CODE) }, hardDeadlineMs)
    timer.unref?.()
  }

  return {
    get quitting() { return quitting },
    onQuit(stop) {
      if (quitting) runStop(stop)
      else stops.push(stop)
    },
    beforeQuit(e) {
      if (drained) return
      const held = quitting ? [] : (o.blockers?.() ?? [])
      if (held.length && now() - askedAt > confirmWindowMs) {
        e.preventDefault()
        askedAt = now()
        o.onBlocked?.(held)
        return
      }
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
