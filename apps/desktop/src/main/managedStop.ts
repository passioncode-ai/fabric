// Stop is a durable command for an exact generation. A signal, root exit or
// successful RPC transport alone is never a receipt for complete termination.
import { randomUUID } from 'node:crypto'

import type { StopReason, StopOutcome, StopTarget, StopResult } from '../shared/stop.ts'
export type { StopReason, StopOutcome, StopTarget, StopResult } from '../shared/stop.ts'

export interface StopObservation {
  rootExited: boolean
  processTreeQuiescent: boolean
  providerQuiescent: boolean
  hostInstanceId: string
  bootId: string
  processIdentityRef?: string
  providerObservationRef?: string
  /** A known signal exit counts as failed_known; absence of an exit is not 0. */
  outcome?: StopOutcome
}
export interface ManagedStopDeps {
  db: { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error?: unknown }> }
  estateId: string
  actor: { kind: string; id: string }
  guard(): Promise<boolean>
  authority(): { personId: string; revision: number } | null
  /** Resolve exact local ownership; must reject a foreign/recycled session. */
  owns(target: StopTarget): boolean
  /** Synchronously block manual input AND close automatic delivery. */
  halt(target: StopTarget): void
  revoke(target: StopTarget): Promise<{ revoked: boolean; evidenceRef?: string }>
  /** Typed cancellation while the provider control transport is still alive.
   * Request acceptance is not quiescence. Implementations must check the late
   * effect fence immediately before writing to the provider connection. */
  requestProviderStop?(target: StopTarget, command: { commandId: string; reason: StopReason }, stillAllowed: () => boolean): Promise<void>
  signal(target: StopTarget, signal: 'SIGTERM' | 'SIGKILL', stillAllowed: () => boolean): Promise<void>
  observe(target: StopTarget): Promise<StopObservation>
  /** Resolves only after the transcript receipt is durable. Called after exit. */
  commitTranscript(target: StopTarget): Promise<{ committed: boolean; evidenceRef?: string }>
  wait(ms: number): Promise<void>
  /** Bounded native sampling, independent of wall-clock adjustments. */
  /** Whole-command deadline, including hung RPCs and native ports. */
  timeoutMs?: number
  samples?: number
  sampleIntervalMs?: number
  escalateAfterSample?: number
}

export function createManagedStop(deps: ManagedStopDeps) {
  const inflight = new Map<string, Promise<StopResult>>()
  // Retain an uncertain identity so a retry queries the SAME durable command.
  const commands = new Map<string, string>()
  const number = (value: number | undefined, fallback: number, min: number, max: number) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback
  const samples = number(deps.samples, 16, 1, 100)
  const interval = number(deps.sampleIntervalMs, 100, 0, 1000)
  const escalateAt = number(deps.escalateAfterSample, Math.min(samples - 1, 8), 0, samples - 1)
  const keyOf = (target: StopTarget) => `${target.runId}/${target.sessionId}/${target.taskId}`
  async function execute(target: StopTarget, reason: StopReason, options: { force?: boolean }): Promise<StopResult> {
    const deadline = performance.now() + number(deps.timeoutMs, 8000, 10, 30_000)
    let expired = false
    const allowed = () => !expired && performance.now() < deadline && deps.owns(target)
    const limited = async <T>(operation: () => T | PromiseLike<T>): Promise<T> => {
      const remaining = deadline - performance.now()
      if (expired || remaining <= 0) { expired = true; throw Error('stop deadline') }
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const value = await Promise.race([
          Promise.resolve().then(operation),
          new Promise<never>((_, reject) => { timer = setTimeout(() => { expired = true; reject(Error('stop deadline')) }, remaining) })
        ])
        if (expired || performance.now() >= deadline) { expired = true; throw Error('stop deadline') }
        return value
      } finally { if (timer) clearTimeout(timer) }
    }
    let commandId = commands.get(keyOf(target)) ?? randomUUID()
    commands.set(keyOf(target), commandId)
    let basis: StopResult['basis']
    const result = (state: StopResult['state'], reasonCode: string, receiptSeq?: number): StopResult =>
      ({ ...target, state, reasonCode, commandId, ...(receiptSeq === undefined ? {} : { receiptSeq }), ...(basis ? { basis } : {}) })
    const rpc = async (name: string, extras: Record<string, unknown>) => {
      const { data, error } = await limited(() => deps.db.rpc(name, {
        p_estate_id: deps.estateId, p_run_id: target.runId, p_session_id: target.sessionId,
        p_command_id: commandId, ...extras
      }))
      if (error || !data || typeof data !== 'object') throw Error('stop receipt unavailable')
      return data as Record<string, unknown>
    }
    const identityMatches = (receipt: Record<string, unknown>) =>
      receipt.task_run_id === target.runId && receipt.session_id === target.sessionId && receipt.task_id === target.taskId
    try {
      if (!deps.owns(target)) return result('refused', 'not_local_owner')
      if (reason === 'operator_stop' && !await limited(() => deps.guard())) return result('refused', 'authority_changed')
      // Close input before awaiting a command, otherwise another queued write
      // may cross the stop click while the database is slow or unreachable.
      deps.halt(target)
      const authority = reason === 'operator_stop' ? deps.authority() : null
      const requested = await rpc('request_task_run_stop', {
        p_actor: reason === 'operator_stop' ? deps.actor : { kind: 'system', id: 'managed-stop' },
        p_person_id: authority?.personId ?? null, p_revision: authority?.revision ?? null, p_reason: reason
      })
      if (requested.requested !== true) return result('refused', 'stop_request_refused')
      if (!identityMatches(requested) || typeof requested.command_id !== 'string' || !requested.command_id ||
          !Number.isSafeInteger(requested.receipt_seq) || typeof requested.state !== 'string' || !['requested', 'outcome_unknown', 'stopped'].includes(requested.state))
        return result('outcome_unknown', 'stop_receipt_mismatch')
      // Another caller may have requested Stop first. Its identity remains the
      // single command; this caller never creates a second observation stream.
      commandId = requested.command_id
      commands.set(keyOf(target), commandId)
      if (typeof requested.reason !== 'string' || !['operator_stop', 'app_shutdown', 'natural_exit', 'launch_failure'].includes(requested.reason))
        return result('outcome_unknown', 'stop_reason_unavailable')
      const canonicalReason = requested.reason as StopReason
      if (requested.state === 'stopped') {
        if (requested.basis !== 'observed' && requested.basis !== 'never_spawned') return result('outcome_unknown', 'stop_basis_unavailable')
        basis = requested.basis
        return result('stopped', 'already_observed', requested.receipt_seq as number)
      }
      if (!deps.owns(target)) return result('outcome_unknown', 'local_ownership_changed')

      let revoked = false, authorityRef: string | undefined
      try { const r = await limited(() => deps.revoke(target)); revoked = r.revoked; authorityRef = r.evidenceRef } catch { /* still try termination */ }
      if (!deps.owns(target)) return result('outcome_unknown', 'local_ownership_changed')
      if (deps.requestProviderStop) {
        try { await limited(() => deps.requestProviderStop!(target, { commandId, reason: canonicalReason }, allowed)) }
        catch { /* A cancellation failure is not completion; still attempt physical cleanup within the same deadline. */ }
        if (!deps.owns(target)) return result('outcome_unknown', 'local_ownership_changed')
      }
      // Natural exit may leave descendants alive, so it uses this exact path.
      try { await limited(() => deps.signal(target, 'SIGTERM', allowed)) } catch { /* observe, do not infer */ }
      let observed: StopObservation | undefined
      for (let sample = 0; sample < samples; sample++) {
        if (!deps.owns(target)) { observed = undefined; break }
        try { observed = await limited(() => deps.observe(target)) } catch { observed = undefined /* Missing observation is persisted as uncertainty below, never as a clean exit. */ }
        if (observed?.rootExited && observed.processTreeQuiescent && observed.providerQuiescent) break
        if (options.force === true && sample === escalateAt && deps.owns(target)) {
          try { await limited(() => deps.signal(target, 'SIGKILL', allowed)) } catch { /* refusal is not quiescence */ }
        }
        if (sample + 1 < samples) await limited(() => deps.wait(interval))
      }
      let committed = false, transcriptRef: string | undefined
      if (observed?.rootExited) {
        try { const r = await limited(() => deps.commitTranscript(target)); committed = r.committed; transcriptRef = r.evidenceRef } catch { /* keep owned */ }
      }
      if (canonicalReason === 'natural_exit' && !observed?.outcome)
        return result('outcome_unknown', 'exit_outcome_unavailable')
      const observation = {
        rootExited: observed?.rootExited === true,
        processTreeQuiescent: observed?.processTreeQuiescent === true,
        providerQuiescent: observed?.providerQuiescent === true,
        authorityRevoked: revoked, transcriptCommitted: committed,
        ...(observed?.hostInstanceId ? { hostInstanceId: observed.hostInstanceId } : {}),
        ...(observed?.bootId ? { bootId: observed.bootId } : {}),
        ...(observed?.processIdentityRef ? { processIdentityRef: observed.processIdentityRef } : {}),
        ...(observed?.providerObservationRef ? { providerObservationRef: observed.providerObservationRef } : {}),
        ...(authorityRef ? { authorityRevocationRef: authorityRef } : {}),
        ...(transcriptRef ? { transcriptRef } : {}),
        outcome: canonicalReason === 'operator_stop' || canonicalReason === 'app_shutdown' ? 'cancelled'
          : canonicalReason === 'launch_failure' ? 'failed_known' : observed?.outcome ?? 'failed_known'
      }
      const recorded = await rpc('record_task_run_stop_observation', { p_observation: observation })
      if (recorded.recorded !== true || !identityMatches(recorded) || recorded.command_id !== commandId ||
          !Number.isSafeInteger(recorded.receipt_seq) || typeof recorded.state !== 'string' || !['stopped', 'outcome_unknown'].includes(recorded.state))
        return result('outcome_unknown', 'stop_observation_unconfirmed')
      if (recorded.state === 'stopped') {
        if (recorded.basis !== 'observed' && recorded.basis !== 'never_spawned') return result('outcome_unknown', 'stop_basis_unavailable')
        basis = recorded.basis
      }
      return result(recorded.state as 'stopped' | 'outcome_unknown',
        recorded.state === 'stopped' ? 'termination_observed' : 'termination_unproved', recorded.receipt_seq as number)
    } catch {
      // In particular: a lost request reply permits no signal, and a lost
      // observation reply permits no success claim. Retry preserves identity.
      return result('outcome_unknown', expired ? 'stop_deadline' : 'stop_receipt_unavailable')
    }
  }
  return (target: StopTarget, reason: StopReason = 'operator_stop', options: { force?: boolean } = {}): Promise<StopResult> => {
    const key = keyOf(target)
    const prior = inflight.get(key)
    if (prior) return prior
    const pending = execute(target, reason, options).finally(() => inflight.delete(key))
    inflight.set(key, pending)
    return pending
  }
}
