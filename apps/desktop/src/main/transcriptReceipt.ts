import { createHash } from 'node:crypto'
import type { Journal } from '@fabric/journal'
import type { TranscriptFinalization } from './transcripts.ts'

interface CaptureSession {
  sessionId: string; projectId: string; optionId: string
  startedAt: string; lastActivityAt: string; exitCode: number | null
}
interface Receipt { committed: boolean; evidenceRef?: string }

/** A failed append retains the sealed capture; a retry must not confuse it with
 * an empty session. Only the acknowledged journal receipt permits settlement. */
export function createTranscriptReceipt(deps: {
  estateId: string
  journal: Pick<Journal, 'append'>
  get(sessionId: string): CaptureSession | null
  task(sessionId: string): string | null
  finalize(sessionId: string): TranscriptFinalization
  settle(sessionId: string): void
}) {
  const receipts = new Map<string, Receipt>()
  const pending = new Map<string, Promise<Receipt>>()
  return (sessionId: string): Promise<Receipt> => {
    const done = receipts.get(sessionId)
    if (done) return Promise.resolve(done)
    const active = pending.get(sessionId)
    if (active) return active
    const attempt = Promise.resolve().then(async (): Promise<Receipt> => {
      const session = deps.get(sessionId)
      if (!session) return { committed: false }
      const final = deps.finalize(sessionId)
      if (final.state === 'unavailable') return { committed: false }
      const record = final.state === 'captured' ? final.record : {
        sha256: createHash('sha256').update('').digest('hex'), bytes: 0, lines: 0,
        truncated: false, annotation: '', excerpt: '', body: ''
      }
      const event = await deps.journal.append({ estateId: deps.estateId,
        type: 'transcript.captured@1', actor: { kind: 'system', id: 'session-capture' },
        projectId: session.projectId, payload: {
          session_id: sessionId, task_id: deps.task(sessionId), option_id: session.optionId,
          ...record, capture_state: final.state, started_at: session.startedAt,
          ended_at: session.lastActivityAt, exit_code: session.exitCode
        } })
      if (event.estate_id !== deps.estateId || event.type !== 'transcript.captured@1' ||
          event.payload.session_id !== sessionId || event.payload.sha256 !== record.sha256 ||
          !Number.isSafeInteger(event.seq) || event.seq < 1) return { committed: false }
      const receipt = { committed: true, evidenceRef: `journal:${event.estate_id}:${event.seq}` }
      receipts.set(sessionId, receipt)
      // Cleanup failure cannot erase an acknowledged durable receipt. Retaining
      // the spool is safe; recovery may see a duplicate with the same digest.
      try { deps.settle(sessionId) } catch { /* retain the durable journal receipt */ }
      return receipt
    }).catch((): Receipt => ({ committed: false })).finally(() => pending.delete(sessionId))
    pending.set(sessionId, attempt)
    return attempt
  }
}
