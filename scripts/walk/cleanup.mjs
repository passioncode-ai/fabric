// #region walk-cleanup — docs: README.md#the-disposable-test-stack
// How a walk ends (release review 2026-10-03, iteration 2, finding 8): the app it started has EXITED,
// and the temporary folders it made are gone.
//
// `start-paths.mjs` sent SIGTERM and exited in the same tick, so the Electron app could still be
// running — holding its user-data folder and the debugging port — when the next walk started, and
// every run left a `fabric-walk-fx-*` fixture tree and a `fabric-walk-ud-*` user-data folder in the
// temp directory, forever.
import { rmSync } from 'node:fs'

/**
 * Signal the app's whole process group when it was spawned `detached` (its own group), else the process.
 * The walk starts the app through `node_modules/.bin/electron`, a wrapper whose CHILD is the real Electron:
 * signalling the wrapper alone orphaned the app (twenty copies in the operator's Dock, 2026-10-03).
 */
function signal(child, sig) {
  try {
    process.kill(-child.pid, sig)
    return
  } catch {
    // Not a group leader (spawned without `detached`), or the group is gone: signal the process itself.
  }
  try { child.kill(sig) } catch { /* gone between the check and the kill */ }
}

/** Resolve once the app — and every process in its group — has been ended: SIGTERM, SIGKILL after `graceMs`. */
export function endApp(child, { graceMs = 10_000 } = {}) {
  if (!child) return Promise.resolve('already-exited')
  if (child.exitCode !== null || child.signalCode !== null) {
    // The wrapper is gone, but what it started may not be.
    signal(child, 'SIGKILL')
    return Promise.resolve('already-exited')
  }
  return new Promise((resolve) => {
    let killed = false
    const timer = setTimeout(() => {
      killed = true
      signal(child, 'SIGKILL')
    }, graceMs)
    child.once('exit', () => {
      clearTimeout(timer)
      // The leader exited; anything left in its group (the real app under a wrapper) goes with it.
      signal(child, 'SIGKILL')
      resolve(killed ? 'killed' : 'terminated')
    })
    signal(child, 'SIGTERM')
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
