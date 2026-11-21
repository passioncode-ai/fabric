// #region pty-settle — docs: docs/evidence/plans/2026-11-21-release-0328-verification.md#co-625-a-signalled-stop-with-live-consoles
/**
 * CO-625 (the 0.3.27 install of 2026-11-21 aborted on it): Fabric ended by a signal with live consoles crashed with
 * SIGABRT on the main thread in pty.node. node-pty delivers a child's exit through a thread-safe function; when that
 * exit arrives while Node is tearing its environment down (`node::FreeEnvironment` → `CleanupHandles` → `uv_run`), the
 * call into JavaScript cannot run, node-addon-api throws a C++ exception, and `std::terminate` aborts the process. The
 * board's launch agent then starts Fabric again six seconds later, so a signalled stop was never a stop.
 *
 * The cure is order: before the quit's last `app.quit()`, every console's exit has been delivered to JavaScript while
 * the event loop still runs. `settleExits` waits, bounded, for the consoles whose exit has not arrived yet; the ones
 * still running after the grace are sent SIGKILL and waited for once more, so nothing is left to arrive at teardown.
 * Both bounds stay well inside the quit's ten-second deadline.
 */
export const SETTLE_GRACE_MS = 1_500
export const SETTLE_KILL_MS = 700

export interface SettlingConsole {
  sessionId: string
  /** Sends the signal to the console's process; may throw when it is already gone (its exit is then on its way). */
  kill(signal: 'SIGKILL'): void
}

export interface SettleResult { waited: number; killed: number; left: number }

export async function settleExits(
  pending: () => readonly SettlingConsole[],
  o: { graceMs?: number; killMs?: number; now?: () => number; sleep?: (ms: number) => Promise<void>; stepMs?: number } = {}
): Promise<SettleResult> {
  const now = o.now ?? Date.now
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => { setTimeout(r, ms) }))
  const step = o.stepMs ?? 25
  const started = now()
  const waitFor = async (ms: number): Promise<void> => {
    const end = now() + ms
    while (pending().length > 0 && now() < end) await sleep(step)
  }
  if (pending().length === 0) return { waited: 0, killed: 0, left: 0 }
  await waitFor(o.graceMs ?? SETTLE_GRACE_MS)
  let killed = 0
  for (const c of pending()) {
    try { c.kill('SIGKILL'); killed++ } catch {
      // Already gone: its exit is on its way and the wait below receives it.
    }
  }
  if (killed > 0) await waitFor(o.killMs ?? SETTLE_KILL_MS)
  return { waited: now() - started, killed, left: pending().length }
}
// #endregion pty-settle
