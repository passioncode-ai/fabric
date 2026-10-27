// #region stack-half-up — docs: docs/evidence/plans/2026-10-26-release-0313-plan.md#co-428-a-half-up-stack-heals-itself
/**
 * CO-428 (0.3.13). After the container engine restarts (OrbStack updating itself, 2026-10-26), only the containers with
 * a restart policy come back: the database and kong. rest and auth are gone, so `supabase status` names no keys and
 * `supabase start` answers that the stack is already running. Fabric used to stop there with «stack-up-but-silent».
 * It now heals that once, the way a person did by hand at 04:20Z that day: `supabase stop` (which keeps the volumes,
 * so the data stays), a start with Fabric's own exclusions, then the status read again.
 */

import { STACK_HEAL_FAILED } from '../shared/startupFailure.ts'

/** Fabric's own splash note while the heal stops and starts the stack (0.3.13 review, iteration 3, UX-5): written in
 *  English here and said in the person's language by `shared/splashProgress.ts`. */
export const HEAL_LINE = 'Restarting the local stack, keeping its data'

/** The answer of a half-up stack: `supabase status` without the keys Fabric needs (`main/env.ts#resolveSupabaseEnv`). */
export function isHalfUp(e: unknown): boolean {
  return e instanceof Error && /did not yield API_URL/i.test(e.message)
}

export interface HalfUpDeps<T> {
  /** The status read; throws the missing-keys error on a half-up stack. */
  resolve: () => Promise<T>
  /** `supabase stop` WITHOUT `--no-backup`: the containers go, the volumes and the data stay. */
  stop: () => Promise<void>
  /** The ordinary start with Fabric's exclusions. */
  start: () => Promise<void>
  /** One line about the heal, ok or failed. */
  record: (r: { outcome: 'ok' | 'failed'; why?: string }) => void
  /** Whether Fabric is quitting: a heal that stopped the stack starts nothing once it is (0.3.13 review, iteration 2,
   *  ER-1: the quitting app spawned a `supabase start` that outlived it). */
  stopped?: () => boolean
  /** Whether Docker still shows the stack partial (the database up without rest or kong) after a status that named its
   *  keys: rest alone gone leaves the keys in place, so only the containers tell (0.3.13 review, iteration 3, ER-4). */
  partial?: () => Promise<boolean>
  /** A line for the splash before the stop, so a heal of minutes is not a silent wait (iteration 3, UX-5). */
  say?: (line: string) => void
}

/** Read the stack's details, healing a half-up stack once. Any other failure is thrown as it came. */
export async function resolveHealingHalfUp<T>(deps: HalfUpDeps<T>): Promise<T> {
  let read: T
  try {
    read = await deps.resolve()
  } catch (first) {
    if (!isHalfUp(first)) throw first
    return heal(deps, first)
  }
  if (!deps.partial || deps.stopped?.() || !(await deps.partial().catch(() => false))) return read
  return heal(deps, new Error('Docker shows the database running without rest or kong, though supabase status named the keys'))
}

async function heal<T>(deps: HalfUpDeps<T>, first: unknown): Promise<T> {
  // A quit that came during the status read starts no stop: a stop spawned now would outlive Fabric (iteration 3, ER-1).
  if (deps.stopped?.()) {
    deps.record({ outcome: 'failed', why: 'Fabric is quitting, so the half-up stack is left as it is' })
    throw first
  }
  deps.say?.(HEAL_LINE)
  try {
    await deps.stop()
  } catch (e) {
    deps.record({ outcome: 'failed', why: `the heal could not stop the stack: ${String(e).slice(0, 200)}` })
    // The startup window says the stop itself failed, with its words (UX-8; Docker's words wait, iteration 3, UX-4).
    throw Object.assign(new Error(e instanceof Error ? e.message : String(e)), { code: STACK_HEAL_FAILED })
  }
  if (deps.stopped?.()) {
    deps.record({ outcome: 'failed', why: 'Fabric is quitting, so the stack it stopped is not started again' })
    throw first
  }
  try {
    await deps.start()
  } catch (e) {
    // The stack is down now and the start's own failure is what the person needs: it is thrown as it came, so the
    // window says it in its own terms (Docker not answering waits and retries; iteration 2, UX-1), never «running».
    deps.record({ outcome: 'failed', why: `the heal stopped the stack and could not start it: ${String(e).slice(0, 200)}` })
    throw e
  }
  let healed: T
  try {
    healed = await deps.resolve()
  } catch (again) {
    deps.record({ outcome: 'failed', why: `still no keys after the heal: ${String(again).slice(0, 200)}` })
    throw again
  }
  // CO-454: the status names the keys while rest alone is gone, so the containers are read again; a heal that left the
  // stack partial is a failed heal, thrown, and the watch tries again on its own backoff instead of recording it done
  // and stopping and starting the stack at every try. A `docker ps` that fails says nothing, as before the heal.
  if (deps.partial && !deps.stopped?.() && await deps.partial().catch(() => false)) {
    const why = 'Docker still shows the database running without rest or kong after the heal'
    deps.record({ outcome: 'failed', why })
    throw Object.assign(new Error(why), { code: STACK_HEAL_FAILED })
  }
  deps.record({ outcome: 'ok' })
  return healed
}

/**
 * One recovery try, then the heal (0.3.13 review, iteration 1, ER-1): the heal runs whatever the start answered, since
 * Supabase CLI 2.114 exits 0 against a stack that is already up, so a «started» try says nothing about rest and auth.
 * Nothing is healed once Fabric is quitting.
 */
export async function recoverThenHeal<T>(start: () => Promise<T>, heal: () => Promise<unknown>, quitting: () => boolean): Promise<T> {
  const result = await start()
  if (!quitting()) await heal()
  return result
}
// #endregion stack-half-up
