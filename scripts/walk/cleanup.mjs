// #region walk-cleanup — docs: README.md#the-disposable-test-stack
// How a walk ends (release review 2026-10-03, iteration 2, finding 8): the app it started has EXITED,
// and the temporary folders it made are gone.
//
// `start-paths.mjs` sent SIGTERM and exited in the same tick, so the Electron app could still be
// running — holding its user-data folder and the debugging port — when the next walk started, and
// every run left a `fabric-walk-fx-*` fixture tree and a `fabric-walk-ud-*` user-data folder in the
// temp directory, forever.
import { rmSync } from 'node:fs'

/** Resolve once `child` has exited: SIGTERM, then SIGKILL after `graceMs`. Resolves with how it ended. */
export function endApp(child, { graceMs = 10_000 } = {}) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve('already-exited')
  return new Promise((resolve) => {
    let killed = false
    const timer = setTimeout(() => {
      killed = true
      try { child.kill('SIGKILL') } catch { /* gone between the check and the kill */ }
    }, graceMs)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve(killed ? 'killed' : 'terminated')
    })
    try { child.kill('SIGTERM') } catch { clearTimeout(timer); resolve('already-exited') }
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
