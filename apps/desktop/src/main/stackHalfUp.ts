// #region stack-half-up — docs: docs/evidence/plans/2026-10-26-release-0313-plan.md#co-428-a-half-up-stack-heals-itself
/**
 * CO-428 (0.3.13). After the container engine restarts (OrbStack updating itself, 2026-10-26), only the containers with
 * a restart policy come back: the database and kong. rest and auth are gone, so `supabase status` names no keys and
 * `supabase start` answers that the stack is already running. Fabric used to stop there with «stack-up-but-silent».
 * It now heals that once, the way a person did by hand at 04:20Z that day: `supabase stop` (which keeps the volumes,
 * so the data stays), a start with Fabric's own exclusions, then the status read again.
 */

import { STACK_HEAL_FAILED } from '../shared/startupFailure.ts'

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
}

/** Read the stack's details, healing a half-up stack once. Any other failure is thrown as it came. */
export async function resolveHealingHalfUp<T>(deps: HalfUpDeps<T>): Promise<T> {
  try {
    return await deps.resolve()
  } catch (first) {
    if (!isHalfUp(first)) throw first
    try {
      await deps.stop()
    } catch (e) {
      deps.record({ outcome: 'failed', why: `the heal could not stop the stack: ${String(e).slice(0, 200)}` })
      // The startup window says the restart itself failed, with its words (0.3.13 review UX-8).
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
    try {
      const healed = await deps.resolve()
      deps.record({ outcome: 'ok' })
      return healed
    } catch (again) {
      deps.record({ outcome: 'failed', why: `still no keys after the heal: ${String(again).slice(0, 200)}` })
      throw again
    }
  }
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
