// A launch owns one durable generation and one native session identity. Only
// the caller that observed begin.granted may spawn or compensate that attempt.
import { preparedLaunchMatches, type PreparedLaunchPacket } from './preparedLaunchInput.ts'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdmissionReceipt, AdmitOutcome } from '../shared/admission.ts'
import type { ContinuationResult } from './continuationDelivery.ts'
import { continuationDeliveryId } from './continuationDelivery.ts'
import { LaunchRefusedBeforeSpawn, ProcessLaunchFailure } from './launchFailure.ts'
import { ops } from './opsSink.ts'
import { FOLDER_HELD_SAYS } from './launchFolderLock.ts'
import { causeOf } from '../shared/opsLog.ts'
import type { ManagedResourceLaunch } from './resourceLaunchAdapter.ts'
import type { ManagedUnits, ManagedUnitHandle } from './resourceManagedUnit.ts'
import type { OwnedPtyUnit } from './pty.ts'

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
  admit(taskId: string, sessionId: string, trigger: LaunchInput['trigger'], prepared?: PreparedLaunchPacket): Promise<AdmitOutcome>
  prepare(receipt: AdmissionReceipt, input: LaunchInput, prepared?: PreparedLaunchPacket, unit?: OwnedPtyUnit): Promise<(sessionId: string, beforeSpawn: () => Promise<boolean>) => Promise<{ sessionId: string }>>
  track(sessionId: string, taskId: string): void
  untrack(sessionId: string, taskId: string): void
  get(sessionId: string): { running: boolean } | null
  stop(sessionId: string): Promise<void>
  /** Optional only at trusted composition. Resource-marked receipts refuse without it. */
  resources?: ManagedResourceLaunch
  /** Paired with the same required adapter; absent on ordinary legacy launches. */
  units?: ManagedUnits
  dispatch(taskId: string, runId: string, sessionId: string, deliveryId: string, text: string): Promise<ContinuationResult>
  /** CO-236: the project folder of a launch whose outcome is unknown stays held while its process runs
   *  (launchFolderLock.ts). `held` is asked before admission, so a refused launch records nothing. */
  folder?: { held(taskId: string): Promise<boolean>; lock(projectId: string, sessionId: string): void }
}
// #region managed-resource-preparation — docs: docs/execution/harness-waves/resource-launch-adapter.md#contract
export function createManagedLaunch(deps: ManagedLaunchDeps) {
  const resources = deps.resources, units = deps.units
  if (resources && resources.mode !== 'required') throw Error('invalid resource launch dependency')
  return async function launch(input: LaunchInput): Promise<LaunchResult> {
    const sessionId = input.admission?.sessionId ?? randomUUID()
    let prepared: PreparedLaunchPacket | undefined
    let unit: ManagedUnitHandle | undefined
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
    try {
      // #region launch-folder-held — docs: docs/evidence/plans/2026-10-11-release-040-agents-first.md#c1--harness-one-session-surface-three-ways-in
      if (deps.folder && await deps.folder.held(input.taskId)) return failure('folder_held', FOLDER_HELD_SAYS)
      // #endregion launch-folder-held
      if (resources) {
        if (!units || units.resources !== resources) return failure('resource_unit_dependency_required', 'The managed resource unit could not be established. Nothing was admitted.')
        if (!resources.inputs || input.admission || input.instruction !== undefined || input.trigger === 'chain')
          return failure('resource_prepared_path_unsupported', 'This resource launch requires a newly prepared ordinary task.')
        const captured = await resources.inputs.prepare({taskId:input.taskId,sessionId,trigger:input.trigger,permissionMode:input.permissionMode??null})
        if (captured.state !== 'observed' || !resources.inputs.owns(captured.packet))
          return failure('resource_prepared_input_unavailable', 'The task input could not be prepared. Nothing was admitted.')
        prepared = captured.packet
        const intent = await units.prepare(prepared)
        if (intent.state !== 'observed') return failure('resource_intent_unconfirmed', 'The start intent remains unconfirmed. Nothing was admitted.')
        unit = intent.value
      }
      const admitted = input.admission ? { admitted: true as const, receipt: input.admission.receipt }
        : await deps.admit(input.taskId, sessionId, input.trigger, prepared)
      if (!admitted.admitted) return failure(admitted.reasonCode, admitted.says)
      receipt = admitted.receipt
      runId = receipt.task_run_id
      if (!runId || receipt.task_id !== input.taskId || receipt.session_id !== sessionId || !receipt.project_id || typeof receipt.instruction !== 'string')
        return failure('invalid_receipt', 'The admission receipt is incomplete. Inspect the task before starting again.')
      // Covers both ordinary admission and the chain's pre-admitted receipt.
      if (resources ? !resources.matches(receipt) : Object.prototype.hasOwnProperty.call(receipt, 'resource_reservation'))
        return failure('resource_receipt_unavailable', 'The resource receipt could not be confirmed. Nothing will be started automatically.')
      if (prepared && (!preparedLaunchMatches(prepared,{sessionId,projectId:receipt.project_id,taskId:input.taskId,optionId:receipt.option_id||'claude-code'}) || receipt.instruction !== prepared.instructionBody || !await resources!.inputs!.current(prepared)))
        throw new LaunchRefusedBeforeSpawn(sessionId,'prepared_input_changed')
      if (unit && !await units!.attachAdmission(unit,receipt)) throw new LaunchRefusedBeforeSpawn(sessionId,'resource_attachment_unconfirmed')
      const authority = deps.authority()
      const begun = await command('begin_task_run_launch', {
        p_person_id: authority?.personId ?? null, p_revision: authority?.revision ?? null
      })
      if (begun.granted !== true) {
        // Only SQL may prove this generation never consumed begin. A racing
        // winner or an ambiguous response cannot be cancelled by a local guess.
        if (resources) { try { await resources.cancelUnbegun(receipt) } catch { /* retain reservation */ } }
        return failure(String(begun.reason_code ?? 'launch_already_begun'),
          'This launch was not granted. Refresh the task; another caller may already be starting it.')
      }
      if (begun.task_run_id !== runId || begun.session_id !== sessionId) return failure('invalid_receipt',
        'The launch receipt identifies another session. Nothing will be started automatically.')
      ownsBegin = true
      const nativeUnit = unit ? units!.native(unit) : undefined
      if (unit && !nativeUnit) throw new LaunchRefusedBeforeSpawn(sessionId,'resource_unit_unavailable')
      const open = await deps.prepare(receipt, input, prepared, nativeUnit ?? undefined)
      deps.track(sessionId, input.taskId)
      const session = await open(sessionId, async () => {
        // The trusted refresh may wait on I/O. Membership, capacity or the run's
        // fence may change while it waits, so SQL must be the last check here.
        if (resources && !await resources.current(receipt!)) return false
        if (unit && !await units!.current(unit)) return false
        if (prepared && !await resources!.inputs!.current(prepared)) return false
        const valid = await command('validate_task_run_launch', {
          p_person_id: authority?.personId ?? null, p_revision: authority?.revision ?? null
        })
        return valid.valid === true && valid.task_run_id === runId && valid.session_id === sessionId
      })
      processStarted = true
      if (session.sessionId !== sessionId) throw Error('native session identity mismatch')
      if (unit && (await units!.observe(unit)).state !== 'observed') throw Error('native unit observation unavailable')
      const bound = await command('bind_task_run')
      if (bound.bound !== true || bound.task_run_id !== runId || bound.session_id !== sessionId || !deps.get(sessionId)?.running) throw Error('binding or liveness not confirmed')
    } catch (error) {
      // The launch RESULT classifies, never a snapshot: a clean refusal before any child is "not
      // started" even though the backend registry's own snapshot reads outcome_unknown (B1).
      processStarted ||= error instanceof ProcessLaunchFailure || (!(error instanceof LaunchRefusedBeforeSpawn) && Boolean(deps.get(sessionId)))
      if (!ownsBegin) {
        if (resources && receipt) { try { await resources.cancelUnbegun(receipt) } catch { /* SQL proof unavailable: retain reservation */ } }
        return failure('launch_receipt_unknown',
          'The launch receipt could not be confirmed. Nothing will be started or retried automatically.')
      }
      // Request cancellation independently of the durable failure command. A
      // signal is not proof of exit; the generation stays owned until observed.
      if (processStarted) { try { await deps.stop(sessionId) } catch { /* still unknown */ } }
      let compensated = false
      try {
        const result = await command('fail_task_launch', { p_process_started: processStarted })
        compensated = result.compensated === true
      } catch { /* a lost response never authorises another spawn */ }
      if (resources && receipt && compensated && !processStarted) {
        try { compensated = await resources.releaseCompensated(receipt) } catch { /* No release receipt means capacity remains uncertain, even after launch compensation. */ compensated = false }
      }
      if (!processStarted) deps.untrack(sessionId, input.taskId)
      // The process may still be running in the project's folder: no second agent starts there until it has ended.
      if (processStarted && receipt?.project_id) deps.folder?.lock(receipt.project_id, sessionId)
      return failure(processStarted || !compensated ? 'launch_outcome_unknown' : 'launch_failed_before_spawn',
        processStarted ? 'The session started, but launch setup failed. Check its termination before continuing.'
          : compensated ? 'The session did not start. The failed attempt was recorded; review its configuration.'
          : 'The session did not start, but its failure receipt is unavailable. Refresh the task before retrying.')
    }
    // After binding, delivery has its own durable boundary. A lost write
    // receipt never compensates the process as a failed launch or replays text.
    const deliveryId = continuationDeliveryId('launch', runId!)
    try {
      const sent = await deps.dispatch(input.taskId, runId!, sessionId, deliveryId, prepared?.instructionBody ?? input.instruction ?? receipt!.instruction!)
      return { started: true, taskId: input.taskId, runId: runId!, sessionId, deliveryId, deliveryState: sent.state, says: sent.says }
    } catch (e) {
      ops.failed('launch.delivery-receipt', new Error('Instruction delivery remains unconfirmed'), { sessionId, cause: causeOf(e) })
      return { started: true, taskId: input.taskId, runId: runId!, sessionId, deliveryId, deliveryState: 'outcome_unknown',
        says: 'The session started. Instruction delivery is uncertain; nothing will be resent automatically.' }
    }
    } finally { if (prepared) resources?.inputs?.release(prepared) }
  }
}
// #endregion managed-resource-preparation
