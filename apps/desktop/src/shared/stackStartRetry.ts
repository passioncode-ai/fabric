// #region stack-start-retry — docs: docs/ux/scenarios.md#scn-161-fabric-opens-while-its-stack-is-still-starting
/**
 * Which refusals of `supabase start` are a moment rather than a fault (2026-10-14). Measured on the operator's Mac:
 * after Docker (OrbStack) came back, the next launch failed with «supabase start is already running.» and
 * «supabase_db_fabric container is not ready: starting» — the containers were healthy a minute later, but Fabric had
 * already shown «The local stack refused to start». Those two are waited out and retried; everything else (Docker
 * unreachable, a port taken, a broken config) is the person's to see at once, so it is never retried.
 */
const TRANSIENT = [
  /supabase start is already running/i,
  /container is not ready:\s*(starting|unhealthy)/i
]

/** Whether the stack's own words say it is still coming up. */
export function stackStartIsTransient(message: string): boolean {
  return TRANSIENT.some((r) => r.test(message))
}

export interface RetryPlan {
  /** How many tries in all, the first included. */
  attempts: number
  /** Waited between tries, so a starting container has time to become healthy. */
  waitMs: number
}

export const STACK_START_RETRY: RetryPlan = { attempts: 4, waitMs: 10_000 }

/**
 * Runs `start` until it succeeds, retrying only a transient refusal, at most `plan.attempts` times. The last failure
 * is thrown as it was, so the startup sheet still shows the stack's own words.
 */
export async function startWithRetry(
  start: () => Promise<void>,
  opts: { plan?: RetryPlan; sleep?: (ms: number) => Promise<void>; onRetry?: (attempt: number, message: string) => void } = {}
): Promise<void> {
  const plan = opts.plan ?? STACK_START_RETRY
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  for (let attempt = 1; ; attempt++) {
    try {
      await start()
      return
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (attempt >= plan.attempts || !stackStartIsTransient(message)) throw e
      opts.onRetry?.(attempt, message)
      await sleep(plan.waitMs)
    }
  }
}
// #endregion stack-start-retry
