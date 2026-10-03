// An admitted run is bound to the session that ran it, and it ends (AX-01).
//
// MEASURED at d28c321: `task_runs` had five states, an outcome vocabulary, two
// constraints and a trigger refusing to reopen an ended run — and ZERO producers
// of `run.ended@1` anywhere in the main process. Every admitted run stayed
// `admitted` for ever, so the estate's account of what it did was a list of
// things that started.
//
// AND THE SESSION ON THE RUN WAS NOT THE SESSION THAT RAN. Admission mints an id
// before the spawn, because admission must happen before anything runs; the pty
// then mints its own. The operator's path re-pointed the LEASE and nothing
// re-pointed the RUN, so every question later asked by session id missed.
//
// EXTRACTED RATHER THAN WRITTEN INTO `index.ts`, and the card says why: a
// runtime lifecycle proved by a SQL probe is not proved. `index.ts` cannot be
// imported (M110), so anything living there is reachable only by launching the
// application. This takes its dependencies, so a probe drives the whole
// admission → bind → exit → reconcile path against the real database with a
// pty that spawns nothing.

import type { SupabaseClient } from '@supabase/supabase-js'
import { outcomeOfExit, type Exit, type RunOutcome } from '../shared/runOutcome.ts'

// #region run-lifecycle-refusals — docs: docs/evidence/backlog.md#work-m188
/**
 * Every refusal `bind_task_run` can return, in the managed-launch contract.
 *
 * Migration 55 refused a second session with `already_bound`; migration 61
 * replaced the command for HAR-R0-03's single coordinator ("exact bind",
 * `docs/launch/harness-r0/checks.md`), and migration 62 is its current
 * definition. Since then a second session on a launching or active run is
 * `session_conflict` — `managed-launch-db.test.mjs` asserts it on an owned
 * cluster. `run-lifecycle-contract.test.mjs` holds this list equal to what the
 * latest SQL returns, so the next replacement of the command cannot leave the
 * module and its probes speaking the old words (release review 2026-10-03).
 */
export const BIND_REFUSALS = [
  'not_found',
  'ended',
  'ending',
  'generation_changed',
  'run_unresolved',
  'lease_changed',
  'launch_not_begun',
  'session_conflict',
  'task_changed'
] as const

/** Every refusal `end_task_run` can return (migration 55, its current definition). */
export const END_REFUSALS = ['unknown_outcome', 'not_found', 'already_ended'] as const
// #endregion run-lifecycle-refusals

export interface RunVerdict {
  ok: boolean
  reasonCode?: string
  says?: string
  /** What the run ACTUALLY ended with, which may not be what this caller asked
   *  for: the first observer of an ending is the one that saw it. */
  outcome?: RunOutcome
  taskRunId?: string
}

export interface RunLifecycleDeps {
  /** The real client. A hand-rolled narrowing of it was tried and removed: the
   *  builder `rpc` returns is a thenable, not a Promise, and a type that says
   *  otherwise compiles against a fake and fails against the thing itself. */
  db: SupabaseClient
  estateId: string
  actor: { kind: string; id: string }
  /** Structured failure reporting. A lifecycle step that cannot run is never
   *  silent: an unrecorded ending is exactly the defect this module exists for. */
  onFailure?: (op: string, says: string) => void
}

const verdictOf = (
  data: unknown,
  error: { message: string } | null,
  okKey: 'bound' | 'ended'
): RunVerdict => {
  // The error is READ. Three cards in this queue have now found the same shape:
  // `const { data } = await …` drops it, an empty answer arrives, and the empty
  // answer is read as a decision somebody made.
  if (error) return { ok: false, reasonCode: 'unavailable', says: error.message }
  const receipt = data as Record<string, unknown> | null
  if (!receipt || typeof receipt[okKey] !== 'boolean')
    return { ok: false, reasonCode: 'unavailable', says: 'the command returned no verdict' }
  return {
    ok: receipt[okKey] === true,
    reasonCode: receipt.reason_code as string | undefined,
    says: receipt.says as string | undefined,
    outcome: receipt.outcome as RunOutcome | undefined,
    taskRunId: receipt.task_run_id as string | undefined
  }
}

export interface RunLifecycle {
  /** Attach an admitted run to the session that actually ran it. */
  bind(runId: string, sessionId: string): Promise<RunVerdict>
  /** End a run. Idempotent: a second ending returns the first outcome. */
  end(runId: string, outcome: RunOutcome, says?: string): Promise<RunVerdict>
  /** End whatever run this session was carrying, from how the process left. */
  endForSession(sessionId: string, exit: Exit): Promise<RunVerdict | null>
  /** Read unresolved generations absent locally. Absence never proves exit. */
  reconcile(live: readonly string[]): Promise<{ ended: number; unobserved: number | null }>
}

export function createRunLifecycle(deps: RunLifecycleDeps): RunLifecycle {
  const report = (op: string, v: RunVerdict): RunVerdict => {
    if (!v.ok && deps.onFailure) deps.onFailure(op, v.says ?? v.reasonCode ?? 'refused')
    return v
  }

  return {
    async bind(runId, sessionId) {
      const { data, error } = await deps.db.rpc('bind_task_run', {
        p_estate_id: deps.estateId,
        p_run_id: runId,
        p_session_id: sessionId,
        p_actor: deps.actor
      })
      return report('run.bind', verdictOf(data, error, 'bound'))
    },

    async end(runId, outcome, says) {
      const { data, error } = await deps.db.rpc('end_task_run', {
        p_estate_id: deps.estateId,
        p_run_id: runId,
        p_outcome: outcome,
        p_actor: deps.actor,
        p_says: says ?? null
      })
      return report('run.end', verdictOf(data, error, 'ended'))
    },

    async endForSession(sessionId, exit) {
      // Looked up rather than remembered. An in-process map of session -> run is
      // exactly what a crash takes with it, and a crash is the case this has to
      // survive; `reconcile` below is the other half of the same answer.
      const { data, error } = await deps.db
        .from('task_runs')
        .select('task_run_id,state')
        .eq('estate_id', deps.estateId)
        .eq('session_id', sessionId)
        .maybeSingle()
      if (error) {
        const v: RunVerdict = { ok: false, reasonCode: 'unavailable', says: error.message }
        return report('run.endForSession', v)
      }
      // No run for this session is not a failure: plain terminals and sessions
      // opened outside a task have none, and they are the common case.
      if (!data?.task_run_id) return null
      return this.end(data.task_run_id as string, outcomeOfExit(exit))
    },

    async reconcile(live) {
      const { data, error } = await deps.db.from('task_runs').select('session_id')
        .eq('estate_id', deps.estateId).neq('state', 'ended')
      if (error || !Array.isArray(data)) {
        deps.onFailure?.('run.reconcile', 'Unresolved runs could not be read.')
        return { ended: 0, unobserved: null }
      }
      const local = new Set(live)
      return { ended: 0, unobserved: data.filter(row => !local.has(row.session_id)).length }
    }
  }
}
