import { createHash } from 'node:crypto'
import { redact } from '../shared/redact.ts'
import { transcriptExcerpt, type TranscriptRecovery } from './transcripts.ts'

interface RecoveryPorts {
  estateId: string
  recover(page: { after: string | null; limit: number }): TranscriptRecovery
  db: { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> }
  settle(sessionId: string): void
  timeoutMs?: number
  /** Fixed reason codes only; no record bodies or backend prose. */
  report?(sessionId: string | null, reason: string): void
}
export interface RecoveryOutcome {
  recorded: number
  retained: number
  remaining: number
  availability: 'listed' | 'unavailable'
}
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const iso = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === (v.includes('.') ? v : v.replace('Z', '.000Z'))
const hash = (v: string) => createHash('sha256').update(v).digest('hex')
const emptyHash = hash('')
const sameTime = (left: unknown, right: string | null): boolean => right === null ? left === null
  : typeof left === 'string' && Number.isFinite(Date.parse(left)) && Date.parse(left) === Date.parse(right)

/** One repeatable command for the same sealed/recovered input; no wall clock. */
export function transcriptRecoveryCommandId(estate: string, project: string, session: string, capture: Record<string, unknown>): string {
  const fields = Object.keys(capture).sort().map(key => [key, capture[key]])
  const hex = hash(JSON.stringify(['transcript-recovery@1', estate, project, session, fields])).slice(0, 32).split('')
  hex[12] = '5'; hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16)
  const value = hex.join('')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

/** Capture recovery is independent of Stop: it never marks a process ended,
 * releases a lease, dispatches work or supplies a provider-quiescence receipt. */
export function createTranscriptRecovery(ports: RecoveryPorts) {
  let pending: Promise<RecoveryOutcome> | null = null
  let cursor: string | null = null
  const timeout = typeof ports.timeoutMs === 'number' && Number.isFinite(ports.timeoutMs)
    ? Math.max(1, Math.min(30_000, ports.timeoutMs)) : 15_000
  const report = (session: string | null, reason: string) => {
    try { ports.report?.(session, reason) } catch { /* Diagnostics cannot settle or discard recovery evidence. */ }
  }
  async function run(): Promise<RecoveryOutcome> {
    if (!uuid(ports.estateId)) return { recorded: 0, retained: 0, remaining: 0, availability: 'unavailable' }
    let recovered: TranscriptRecovery
    try { recovered = ports.recover({ after: cursor, limit: 8 }) } catch {
      // Report the fixed reason below; filesystem exception text may expose private paths.
      report(null, 'capture_directory_unavailable')
      return { recorded: 0, retained: 0, remaining: 0, availability: 'unavailable' }
    }
    if (recovered.state === 'unavailable') {
      report(null, 'capture_directory_unavailable')
      return { recorded: 0, retained: 0, remaining: 0, availability: 'unavailable' }
    }
    const outcome: RecoveryOutcome = { recorded: 0, retained: 0, remaining: recovered.remaining ?? 0, availability: 'listed' }
    // Advance past retained/corrupt items as well, so one broken page cannot
    // starve later captures. Wrap only once this finite directory pass ends.
    cursor = recovered.nextCursor ?? null
    const deadline = performance.now() + timeout
    // Sequential and bounded: one slow DB cannot fan out a disk's worth of bodies.
    for (const item of recovered.items.slice(0, 8)) {
      const { sessionId, context, meta, result } = item
      const retain = (reason: string) => { outcome.retained++; report(uuid(sessionId) ? sessionId : null, reason) }
      if (!uuid(sessionId) || !context || !uuid(context.projectId) ||
          !(context.taskId === null || uuid(context.taskId)) ||
          typeof context.optionId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(context.optionId) ||
          result.state === 'unavailable') { retain('capture_unavailable'); continue }
      const observed = meta !== null
      const startedAt = observed ? meta.startedAt : context.startedAt || null
      const endedAt = meta?.endedAt ?? null
      const exitCode = meta?.exitCode ?? null
      if ((startedAt !== null && !iso(startedAt)) || (observed && !iso(endedAt)) ||
          (startedAt !== null && endedAt !== null && Date.parse(endedAt) < Date.parse(startedAt)) ||
          (exitCode !== null && (!Number.isSafeInteger(exitCode) || exitCode < -2147483648 || exitCode > 2147483647)) ||
          (meta && meta.optionId !== context.optionId)) { retain('capture_metadata_invalid'); continue }
      const record = result.state === 'captured' ? result.record : {
        sha256: emptyHash, bytes: 0, lines: 0, truncated: false, annotation: '', excerpt: '', body: ''
      }
      if (typeof record.body !== 'string' || Buffer.byteLength(record.body) > 8_000_000 ||
          record.bytes !== Buffer.byteLength(record.body) || record.sha256 !== hash(record.body) ||
          record.lines !== (result.state === 'empty' ? 0 : record.body.split('\n').length) ||
          typeof record.truncated !== 'boolean' || typeof record.annotation !== 'string' ||
          Buffer.byteLength(record.annotation) > 8192 || typeof record.excerpt !== 'string' ||
          Buffer.byteLength(record.excerpt) > 32768 ||
          (!observed && (result.state !== 'captured' || record.truncated !== true))) {
        retain('capture_integrity_invalid'); continue
      }
      // Preserve sealed identity: do not silently rewrite an old spool. A
      // legacy source with recognized credentials needs explicit repair before
      // it can cross the persistence boundary.
      if (redact(record.body).text !== record.body || redact(record.annotation).text !== record.annotation ||
          // A clipped marker may trigger the recognizer again. Only the exact
          // canonical derivative of the already checked body gets this exception;
          // arbitrary or legacy excerpts still require their own privacy check.
          (record.excerpt !== transcriptExcerpt(record.body) && redact(record.excerpt).text !== record.excerpt)) {
        retain('capture_privacy_review_required'); continue
      }
      const capture = { task_id: context.taskId, option_id: context.optionId,
        sha256: record.sha256, bytes: record.bytes, lines: record.lines, truncated: record.truncated,
        annotation: record.annotation, excerpt: record.excerpt, body: record.body,
        capture_state: result.state, started_at: startedAt, ended_at: endedAt, exit_code: exitCode,
        ending_provenance: observed ? 'observed' : 'unknown' }
      const commandId = transcriptRecoveryCommandId(ports.estateId, context.projectId, sessionId, capture)
      if (performance.now() >= deadline) { retain('capture_deadline'); continue }
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const { data, error } = await Promise.race([Promise.resolve(ports.db.rpc('recover_transcript', {
          p_estate_id: ports.estateId, p_project_id: context.projectId,
          p_session_id: sessionId, p_command_id: commandId, p_capture: capture
        })), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('capture_deadline')), Math.max(1, deadline - performance.now()))
        })])
        if (performance.now() >= deadline) { retain('capture_deadline'); continue }
        const receipt = data as Record<string, unknown> | null
        const allowedFields = ['recorded', 'repeated', 'estate_id', 'project_id', 'session_id', 'command_id', 'receipt_seq',
          'event_type', 'payload_digest', 'captured_at', ...Object.keys(capture).filter(key => key !== 'body')]
        if (error || !receipt || Object.keys(receipt).some(key => !allowedFields.includes(key)) || receipt.recorded !== true || typeof receipt.repeated !== 'boolean' ||
            receipt.estate_id !== ports.estateId || receipt.project_id !== context.projectId ||
            receipt.session_id !== sessionId || !uuid(receipt.command_id) ||
            (!receipt.repeated && receipt.command_id !== commandId) ||
            receipt.event_type !== 'transcript.captured@2' || !Number.isSafeInteger(receipt.receipt_seq) || (receipt.receipt_seq as number) < 1 ||
            typeof receipt.payload_digest !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.payload_digest) ||
            typeof receipt.captured_at !== 'string' || !Number.isFinite(Date.parse(receipt.captured_at)) ||
            !sameTime(receipt.started_at, startedAt) || !sameTime(receipt.ended_at, endedAt) ||
            ['sha256', 'bytes', 'lines', 'truncated', 'capture_state', 'ending_provenance', 'exit_code', 'task_id', 'option_id', 'annotation', 'excerpt']
              .some(key => receipt[key] !== capture[key as keyof typeof capture])) {
          retain('capture_receipt_unavailable'); continue
        }
        if (performance.now() >= deadline) { retain('capture_deadline'); continue }
        outcome.recorded++
        try { ports.settle(sessionId) } catch { /* retain reports a fixed diagnostic and preserves retry evidence. */ retain('capture_cleanup_pending') }
      } catch { /* retain reports uncertainty without persisting raw backend text. */ retain('capture_receipt_unavailable') } finally { if (timer) clearTimeout(timer) }
    }
    return outcome
  }
  return (): Promise<RecoveryOutcome> => {
    if (!pending) pending = Promise.resolve().then(run).finally(() => { pending = null })
    return pending
  }
}
