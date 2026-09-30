// A launch owns one durable generation and one native session identity. Only
// the caller that observed begin.granted may spawn or compensate that attempt.
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdmissionReceipt, AdmitOutcome } from '../shared/admission.ts'
import type { ContinuationResult } from './continuationDelivery.ts'
import { continuationDeliveryId } from './continuationDelivery.ts'
import { LaunchRefusedBeforeSpawn, ProcessLaunchFailure } from './launchFailure.ts'
import { ops } from './opsSink.ts'

export type LaunchResult =
  | { started: true; taskId: string; runId: string; sessionId: string; deliveryId: string; deliveryState: ContinuationResult['state']; says: string }
  | { started: false; taskId: string; runId?: string; sessionId?: string; admissionRecorded: boolean; reasonCode: string; says: string; retryable: false }
export interface LaunchInput {
  taskId: string
  trigger: 'operator' | 'chain' | 'routine' | 'answer'
  /** Internal admitted chain receipt; never accepted from renderer IPC. */
  admission?: { receipt: AdmissionReceipt; sessionId: string }
  /** A resolved chain brief, persisted in chain.dispatch before this call. */
  instruction?: string
  permissionMode?: string | null
}
export interface ManagedLaunchDeps {
  db: Pick<SupabaseClient, 'rpc'>
  estateId: string
  actor: { kind: string; id: string }
  authority(): { personId: string; revision: number } | null
  admit(taskId: string, sessionId: string, trigger: LaunchInput['trigger']): Promise<AdmitOutcome>
  prepare(receipt: AdmissionReceipt, input: LaunchInput): Promise<(sessionId: string, beforeSpawn: () => Promise<boolean>) => Promise<{ sessionId: string }>>
  track(sessionId: string, taskId: string): void
  untrack(sessionId: string, taskId: string): void
  get(sessionId: string): { running: boolean } | null
  stop(sessionId: string): Promise<void>
  dispatch(taskId: string, runId: string, sessionId: string, deliveryId: string, text: string): Promise<ContinuationResult>
}
export function createManagedLaunch(deps: ManagedLaunchDeps) {
  return async function launch(input: LaunchInput): Promise<LaunchResult> {
    const sessionId = input.admission?.sessionId ?? randomUUID()
    let receipt: AdmissionReceipt | undefined
    let runId: string | undefined
    let ownsBegin = false
    let processStarted = false
    const failure = (reasonCode: string, says: string): LaunchResult => ({
      started: false, taskId: input.taskId, runId,
      ...(processStarted ? { sessionId } : {}), admissionRecorded: Boolean(receipt), reasonCode, says, retryable: false
    })
    const command = async (name: string, extra: Record<string, unknown> = {}) => {
      const { data, error } = await deps.db.rpc(name, {
        p_estate_id: deps.estateId, p_run_id: runId, p_session_id: sessionId,
        p_actor: deps.actor, ...extra
      })
      if (error || !data || typeof data !== 'object') throw Error('launch receipt unavailable')
      return data as Record<string, unknown>
    }
    try {
      const admitted = input.admission ? { admitted: true as const, receipt: input.admission.receipt }
        : await deps.admit(input.taskId, sessionId, input.trigger)
      if (!admitted.admitted) return failure(admitted.reasonCode, admitted.says)
      receipt = admitted.receipt
      runId = receipt.task_run_id
      if (!runId || receipt.task_id !== input.taskId || receipt.session_id !== sessionId || !receipt.project_id || typeof receipt.instruction !== 'string')
        return failure('invalid_receipt', 'The admission receipt is incomplete. Inspect the task before starting again.')
      const authority = deps.authority()
      const begun = await command('begin_task_run_launch', {
        p_person_id: authority?.personId ?? null, p_revision: authority?.revision ?? null
      })
      if (begun.granted !== true) return failure(String(begun.reason_code ?? 'launch_already_begun'),
        'This launch was not granted. Refresh the task; another caller may already be starting it.')
      if (begun.task_run_id !== runId || begun.session_id !== sessionId) return failure('invalid_receipt',
        'The launch receipt identifies another session. Nothing will be started automatically.')
      ownsBegin = true
      const open = await deps.prepare(receipt, input)
      deps.track(sessionId, input.taskId)
      const session = await open(sessionId, async () => {
        const valid = await command('validate_task_run_launch', {
          p_person_id: authority?.personId ?? null, p_revision: authority?.revision ?? null
        })
        return valid.valid === true && valid.task_run_id === runId && valid.session_id === sessionId
      })
      processStarted = true
      if (session.sessionId !== sessionId) throw Error('native session identity mismatch')
      const bound = await command('bind_task_run')
      if (bound.bound !== true || bound.task_run_id !== runId || bound.session_id !== sessionId || !deps.get(sessionId)?.running) throw Error('binding or liveness not confirmed')
    } catch (error) {
      // The launch RESULT classifies, never a snapshot: a clean refusal before any child is "not
      // started" even though the backend registry's own snapshot reads outcome_unknown (B1).
      processStarted ||= error instanceof ProcessLaunchFailure || (!(error instanceof LaunchRefusedBeforeSpawn) && Boolean(deps.get(sessionId)))
      if (!ownsBegin) return failure('launch_receipt_unknown',
        'The launch receipt could not be confirmed. Nothing will be started or retried automatically.')
      // Request cancellation independently of the durable failure command. A
      // signal is not proof of exit; the generation stays owned until observed.
      if (processStarted) { try { await deps.stop(sessionId) } catch { /* still unknown */ } }
      let compensated = false
      try {
        const result = await command('fail_task_launch', { p_process_started: processStarted })
        compensated = result.compensated === true
      } catch { /* a lost response never authorises another spawn */ }
      if (!processStarted) deps.untrack(sessionId, input.taskId)
      return failure(processStarted || !compensated ? 'launch_outcome_unknown' : 'launch_failed_before_spawn',
        processStarted ? 'The session started, but launch setup failed. Check its termination before continuing.'
          : compensated ? 'The session did not start. The failed attempt was recorded; review its configuration.'
          : 'The session did not start, but its failure receipt is unavailable. Refresh the task before retrying.')
    }
    // After binding, delivery has its own durable boundary. A lost write
    // receipt never compensates the process as a failed launch or replays text.
    const deliveryId = continuationDeliveryId('launch', runId!)
    try {
      const sent = await deps.dispatch(input.taskId, runId!, sessionId, deliveryId, input.instruction ?? receipt!.instruction!)
      return { started: true, taskId: input.taskId, runId: runId!, sessionId, deliveryId, deliveryState: sent.state, says: sent.says }
    } catch {
      ops.failed('launch.delivery-receipt', new Error('Instruction delivery remains unconfirmed'), { sessionId })
      return { started: true, taskId: input.taskId, runId: runId!, sessionId, deliveryId, deliveryState: 'outcome_unknown',
        says: 'The session started. Instruction delivery is uncertain; nothing will be resent automatically.' }
    }
  }
}
