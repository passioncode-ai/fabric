// #region launch-origin — docs: docs/evidence/specs/2026-11-19-session-launch-journal.md#3-who-started-it
/**
 * Who asked for a console, carried from the caller to the spawn without a new parameter on every path between them
 * (the person's screen, the CEO's tools, a task's launch, a restart): the caller runs its launch inside
 * `withLaunchOrigin`, and `PtyManager.open` reads `currentLaunchOrigin()` when it writes the launch journal. A launch
 * no caller annotated is `fabric`'s own, never guessed as the person's.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import type { LaunchOrigin } from '../shared/sessionLaunches.ts'

const store = new AsyncLocalStorage<LaunchOrigin>()

export function withLaunchOrigin<T>(origin: LaunchOrigin, run: () => Promise<T>): Promise<T> {
  return store.run(origin, run)
}

export function currentLaunchOrigin(): LaunchOrigin {
  return store.getStore() ?? { by: 'fabric' }
}
// #endregion launch-origin
