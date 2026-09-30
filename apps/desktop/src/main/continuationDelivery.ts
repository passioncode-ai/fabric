// One durable identity and fenced write boundary per answer/task. This is not
// exactly-once transport: a crash after the write boundary remains unknown.
import { createHash, randomUUID } from 'node:crypto'
import type { Actor } from '@fabric/journal'
import type { SupabaseClient } from '@supabase/supabase-js'
import { continuationText, routeContinuation, type ContinuationState } from '../shared/continuation.ts'
import type { ScopedStore } from './scopedStore.ts'

export function continuationDeliveryId(decisionId: string, taskId: string): string {
  const hex = createHash('sha256').update(`fabric.continuation\0${decisionId}\0${taskId}`).digest('hex')
  const b = hex.slice(0, 32).split('')
  b[12] = '5'
  b[16] = '89ab'[parseInt(b[16], 16) % 4]
  const u = b.join('')
  return `${u.slice(0, 8)}-${u.slice(8, 12)}-${u.slice(12, 16)}-${u.slice(16, 20)}-${u.slice(20, 32)}`
}

export interface ContinuationResult {
  taskId: string
  state: ContinuationState
  says: string
  deliveryId?: string
  alreadyDelivered?: boolean
  deliveryState?: string
}

type WriteResult = { state: 'written' | 'failed_before_write' | 'outcome_unknown'; reason?: string }
export interface ContinuationDeps {
  store: ScopedStore
  db: Pick<SupabaseClient, 'rpc'>
  ptys: {
    list(): { sessionId: string; running: boolean }[]
    deliverWhenReady(sessionId: string, instruction: string,
      options?: { beforeWrite?: () => Promise<boolean> }): Promise<WriteResult>
  }
  /** Revalidate the held operator authority before reserving or beginning a write. */
  guard(): Promise<boolean>
  authority(): { personId: string; revision: number } | null
  estateId: string
  actor: Actor
  withDeliveryHeader(text: string, deliveryId: string, digest: string): string
}

export function createContinuationDelivery(deps: ContinuationDeps) {
  const read = async <T>(q: unknown): Promise<T[]> => {
    const { data, error } = (await q) as { data: T[] | null; error?: unknown }
    if (error || !Array.isArray(data)) throw new Error('Continuation target is unavailable; nothing was sent.')
    return data
  }
  const command = async (args: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const authority = deps.authority()
    const { data, error } = await deps.db.rpc('continuation_dispatch', {
      p_estate_id: deps.estateId, p_actor: deps.actor,
      p_person_id: authority?.personId ?? null, p_revision: authority?.revision ?? null, ...args
    })
    // Do not echo database errors: they can contain instruction values.
    if (error || !data || typeof data !== 'object' || typeof data.state !== 'string')
      throw new Error('Continuation receipt is unavailable; do not infer delivery.')
    return data as Record<string, unknown>
  }
  const result = (taskId: string, deliveryId: string, receipt: Record<string, unknown>): ContinuationResult => {
    const state = receipt.state
    if (state === 'accepted') return { taskId, deliveryId, state: 'acked', deliveryState: state,
      alreadyDelivered: true, says: 'The agent acknowledged the instruction.' }
    if (state === 'written') return { taskId, deliveryId, state: 'delivering', deliveryState: state,
      alreadyDelivered: true, says: 'The terminal accepted the instruction; agent acknowledgement is pending.' }
    if (state === 'reserved') return { taskId, deliveryId, state: 'queued', deliveryState: state,
      says: 'The instruction is queued; it has not been confirmed written.' }
    if (state === 'failed_before_write') return { taskId, deliveryId, state: 'retryable', deliveryState: state,
      says: 'No bytes were written. The same instruction can be retried.' }
    return { taskId, deliveryId, state: state === 'outcome_unknown' ? 'outcome_unknown' : 'rejected', deliveryState: String(state),
      says: state === 'outcome_unknown'
        ? 'Delivery is uncertain. Nothing will be resent automatically; inspect the session before continuing.'
        : 'The delivery identity or target changed. Nothing was sent; refresh the task.' }
  }
  async function dispatch(taskId: string, runId: string, sessionId: string, deliveryId: string, text: string): Promise<ContinuationResult> {
      if (!await deps.guard()) return result(taskId, deliveryId, {state:'authority_changed'})
      const digest = createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 32)
      const base = { p_delivery_id: deliveryId, p_task_id: taskId, p_run_id: runId,
        p_session_id: sessionId, p_digest: digest, p_claim_id: randomUUID() }
      const claimed = await command({ ...base, p_action: 'claim' })
      if (claimed.granted !== true) return result(taskId, deliveryId, claimed)
      let boundaryEntered = false
      let write: WriteResult
      try {
        write = await deps.ptys.deliverWhenReady(sessionId as string,
          deps.withDeliveryHeader(text, deliveryId, digest), {
            beforeWrite: async () => {
              if (!await deps.guard()) return false
              const begun = await command({ ...base, p_action: 'begin' })
              boundaryEntered = begun.granted === true
              return boundaryEntered
            }
          })
      } catch {
        // A thrown transport implementation provides no proof of no effect.
        write = { state: 'outcome_unknown' }
      }
      // Reject adapters that report a write without consuming the fence.
      if (write.state === 'written' && !boundaryEntered) write = { state: 'outcome_unknown' }
      try {
        const completed = await command({ ...base, p_action: write.state })
        const response = result(taskId, deliveryId, completed)
        if (write.state === 'written') response.alreadyDelivered = false
        return response
      } catch {
        // Completion may have committed despite a lost reply. The durable fence
        // prevents replay; the caller must not present an unrecorded success.
        return result(taskId, deliveryId, { state: 'outcome_unknown' })
      }
  }

  return {
    dispatch,
    async deliver(taskId: string, decisionId: string, answer: string): Promise<ContinuationResult> {
      const runs = await read<{ task_run_id: string; session_id: string | null; state: string }>(
        deps.store.select('task_runs', 'task_run_id,session_id,state').eq('task_id', taskId)
          .order('run_ordinal', { ascending: false }).limit(1)
      )
      const latest = runs[0]
      const sessionId = latest?.session_id ?? null
      const decision = routeContinuation({ target: {
        taskId, taskRunId: latest?.task_run_id ?? null, sessionId,
        sessionLive: sessionId ? deps.ptys.list().some(s => s.sessionId === sessionId && s.running) : false,
        runEnded: latest?.state === 'ended'
      }, superseded: false, otherBlockers: 0 })
      if (!decision.deliver) return { taskId, state: decision.state, says: decision.says }
      const deliveryId = continuationDeliveryId(decisionId, taskId)
      const text = continuationText(answer, decisionId)
      return dispatch(taskId, latest.task_run_id, sessionId as string, deliveryId, text)
    }
  }
}
