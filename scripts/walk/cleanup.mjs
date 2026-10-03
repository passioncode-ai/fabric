// #region walk-cleanup — docs: README.md#the-disposable-test-stack
// How a walk ends (release review 2026-10-03, iteration 2, finding 8): the app it started has EXITED —
// gracefully, or the walk fails (CO-191) — and the temporary folders it made are gone.
//
// `start-paths.mjs` sent SIGTERM and exited in the same tick, so the Electron app could still be
// running — holding its user-data folder and the debugging port — when the next walk started, and
// every run left a `fabric-walk-fx-*` fixture tree and a `fabric-walk-ud-*` user-data folder in the
// temp directory, forever.
import { rmSync } from 'node:fs'

/**
 * The signal goes to the app's process ONLY (lifecycle LC-02). Signalling the whole group — the walk's
 * fix of the morning of 2026-10-03 — delivered SIGTERM twice whenever a wrapper forwarded it, and
 * Chromium handles only the first gracefully: the second hard-killed the app in about 100 ms, so
 * "app terminated" meant "killed without shutdown" and hid CO-191 (an app that never quits). The walk
 * now spawns the Electron binary itself, so its pid IS the app.
 */
function signalApp(child, sig) {
  try { child.kill(sig) } catch { /* gone between the check and the kill */ }
}

/** After the app has exited, nothing it started may outlive it: its group (spawned `detached`) is killed. */
function reapGroup(child) {
  try { process.kill(-child.pid, 'SIGKILL') } catch { /* not a group leader, or the group is already empty */ }
}

/**
 * Resolve once the app has ended, and say HOW:
 *  - 'terminated': it exited by itself, code 0, after SIGTERM — the only graceful outcome;
 *  - 'signalled': the signal's default action ended it, or it exited non-zero — no clean shutdown;
 *  - 'killed': it was still alive after `graceMs` and was SIGKILLed;
 *  - 'already-exited': it had ended before the walk asked.
 * A walk passes only on 'terminated'.
 */
// The grace outlasts the app's own 10 s quit deadline, so a stalled shutdown ends by the app's deadline
// exit (code 3 → 'signalled') rather than racing the walk's SIGKILL to a verdict.
export function endApp(child, { graceMs = 15_000 } = {}) {
  if (!child) return Promise.resolve('already-exited')
  if (child.exitCode !== null || child.signalCode !== null) {
    reapGroup(child)
    return Promise.resolve('already-exited')
  }
  return new Promise((resolve) => {
    let killed = false
    const timer = setTimeout(() => {
      killed = true
      signalApp(child, 'SIGKILL')
    }, graceMs)
    child.once('exit', (code, sig) => {
      clearTimeout(timer)
      reapGroup(child)
      resolve(killed ? 'killed' : code === 0 && sig === null ? 'terminated' : 'signalled')
    })
    signalApp(child, 'SIGTERM')
  })
}

/** Remove the walk's temporary folders; a folder that will not go is reported, never silently kept. */
export function removeTemp(dirs, { log = (m) => console.log(m) } = {}) {
  const left = []
  for (const dir of dirs) {
    if (!dir) continue
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
    } catch (e) {
      left.push(dir)
      log(`WARN could not remove ${dir}: ${e.message}`)
    }
  }
  return left
}
// #endregion walk-cleanup
