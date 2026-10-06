// #region renderer-recovery — docs: docs/ux/scenarios.md#scn-073-диагностика
/**
 * Whether a window whose renderer process died is reloaded (verification 0.3.2 iteration 1, DO-6).
 *
 * A dead renderer leaves a blank window: React's error boundary cannot help, because the process that
 * would run it is gone. The window is reloaded so the person gets Fabric back — unless that renderer
 * keeps dying, when a reload loop would only burn CPU and hide the failure; then the window is left
 * for the person to close, and the failure stays in Diagnostics. `clean-exit` is a renderer that ended
 * on purpose (a window closing), and nothing is reloaded while the app is quitting.
 */
export const RELOAD_LIMIT = 3
export const RELOAD_WINDOW_MS = 60_000

export function shouldReload(input: { reason: string; quitting: boolean; recentReloads: number[]; now: number }): boolean {
  if (input.quitting || input.reason === 'clean-exit') return false
  return input.recentReloads.filter((t) => input.now - t < RELOAD_WINDOW_MS).length < RELOAD_LIMIT
}
// #endregion renderer-recovery
