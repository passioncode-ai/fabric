// Capturing what a session actually did (M45, ADR-0032).
//
// The live scrollback in `PtyManager` is a VIEW: capped at 400 000 characters,
// held in memory, gone when the app quits. This is the record. It streams to a
// file as the session runs — so a six-hour session costs a file handle rather
// than six hours of heap — and on exit becomes one `transcript.captured@1`
// event.
//
// WHAT "VERBATIM" MEANS HERE, because the word does real work in ADR-0032.
// A PTY stream is not text; it is text interleaved with control sequences that
// move the cursor and repaint. Stored raw it is unreadable and unsearchable.
// This module removes ANSI/OSC control sequences and resolves carriage returns
// to what remained on the line — a deterministic decode of the transport, the
// same operation a terminal performs to show it to a person. Nothing is
// summarised, extracted, shortened or judged, and no model sees it. The stored
// body is what the operator saw, and `sha256` addresses exactly that.
//
// The raw byte stream is NOT retained. It carries nothing about what the agent
// did that the decoded text does not, and keeping both would mean keeping two
// representations with one hash between them.

import { createHash, randomUUID } from 'node:crypto'
import { decodePty } from '../shared/pty-decode.ts'
import { describeRedactions, redact } from '../shared/redact.ts'
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  linkSync,
  openSync,
  readdirSync,
  readFileSync,
  statSync,
  rmSync,
  writeFileSync,
  writeSync
} from 'node:fs'
import path from 'node:path'
import { ops } from './opsSink.ts'

export interface CapturedTranscript {
  sha256: string
  bytes: number
  lines: number
  /** True when capture is incomplete: a size cap, transport or storage gap. */
  truncated: boolean
  /** L0 — one line, composed from facts. No model, no judgement. */
  annotation: string
  /** L1 — a bounded head and tail of the real text. An excerpt, never a summary. */
  excerpt: string
  /** L2 — the whole decoded session. */
  body: string
}

export interface TranscriptMeta {
  /** What the redactor removed, in one line, or null when it removed nothing.
   *  Carried into the annotation so an operator can SEE that it acted — a
   *  record that says nothing is not a promise there was nothing to act on. */
  redactions?: string | null
  optionId: string
  startedAt: string
  endedAt: string
  exitCode: number | null
}

export type TranscriptFinalization =
  | { state: 'captured'; record: CapturedTranscript }
  | { state: 'empty'; truncated: false }
  | { state: 'unavailable'; reason: 'missing-capture' | 'capture-open-failed' | 'spool-unreadable' | 'capture-gap' | 'finalization-unavailable' }

export interface RecoveredTranscriptFinalization {
  sessionId: string
  context: SpoolContext | null
  /** Original observed exit facts; null when no readable descriptor exists. */
  meta: TranscriptMeta | null
  result: TranscriptFinalization
}

export type TranscriptRecovery =
  | { state: 'listed'; items: RecoveredTranscriptFinalization[]; nextCursor?: string | null; remaining?: number }
  | { state: 'unavailable'; reason: 'directory-unreadable'; items: [] }

interface SealedCapture {
  schema: 'TranscriptFinalization@1'
  sessionId: string
  truncated: boolean
  meta: TranscriptMeta
  result?: { state: 'captured'; sha256: string } | { state: 'empty' }
}

export interface TranscriptStore {
  /** `context` is written beside the spool so a crashed session can still be
   *  recovered: the log alone cannot say which project or agent it belonged to. */
  open(sessionId: string, context?: SpoolContext): void
  write(sessionId: string, chunk: string): void
  /**
   * Finish the capture and hand back the record. THE SPOOL IS LEFT ON DISK
   * (IMP-12): it is removed by `settle`, after the caller has made the record
   * durable. Deleting it here meant a failed append — or a crash in the
   * milliseconds between — destroyed the only copy, and the caller's own
   * comment admitted the loss while swallowing it.
   */
  close(sessionId: string, meta: TranscriptMeta): CapturedTranscript | null
  /** Close once, retain the same metadata until settlement, and distinguish a
   * proved empty capture from missing or unreadable evidence. Safe to retry
   * after a failed/lost journal append. */
  finalize(sessionId: string, meta: TranscriptMeta): TranscriptFinalization
  /** Remove the spool. Called only once the record is safely in the journal. */
  settle(sessionId: string): void
  /** Drop a capture without producing a record — used when nothing should be kept. */
  discard(sessionId: string): void
  /**
   * Spools left by sessions that never settled — a crash, a failed append, a
   * kill. Each comes back with the context written when it opened, so the
   * caller can journal it exactly as it would have at the time.
   */
  recover(): { sessionId: string; context: SpoolContext | null; record: CapturedTranscript }[]
  /** Detailed recovery preserves original exit evidence and does not settle
   * even a proved empty capture. The caller first owes a durable receipt. */
  recoverFinalizations(page?: { after: string | null; limit: number; exclude?: ReadonlySet<string> }): TranscriptRecovery
}

/** What the log cannot say about itself. */
export interface SpoolContext {
  projectId: string
  optionId: string
  startedAt: string
  taskId: string | null
}

export interface TranscriptStoreDeps {
  root: string
  /**
   * The ceiling on one session's record. Above it the HEAD is kept and the flag
   * is set, because the beginning of a runaway session is what explains it —
   * the end is the same line ten thousand times.
   */
  maxBytes?: number
  excerptHead?: number
  excerptTail?: number
}

/** Oversized unfinished lines terminate capture rather than flushing partial
 *  credentials or their markers. Nothing after that uncertain boundary is kept. */
const PENDING_CAP = 64 * 1024

const DEFAULT_MAX = 8_000_000
const DEFAULT_HEAD = 1_500
const DEFAULT_TAIL = 1_500

/** Exact body-derived excerpt; recovery can verify provenance without rewriting
 * a sealed record when a shortened canonical redaction marker looks incomplete. */
export function transcriptExcerpt(body: string, head = DEFAULT_HEAD, tail = DEFAULT_TAIL): string {
  return body.length <= head + tail ? body
    : `${body.slice(0, head)}\n\n…[${body.length - head - tail} characters]…\n\n${body.slice(-tail)}`
}

/** ANSI CSI, OSC and single-character escapes. */
// eslint-disable-next-line no-control-regex

type ControlState = 'text' | 'escape' | 'csi' | 'osc' | 'osc-escape' | 'string' | 'string-escape' | 'intermediate'

/** Strip terminal controls before secret detection and before disk, with O(1)
 * state across arbitrary chunks. Carriage returns remain for final line decode. */
function plainChunk(capture: OpenCapture, chunk: string): string {
  let text = ''
  for (const char of chunk) {
    const code = char.charCodeAt(0)
    switch (capture.controlState) {
      case 'text':
        if (code === 27) capture.controlState = 'escape'
        else if (code === 0x9b) capture.controlState = 'csi'
        else if (code === 0x9d) capture.controlState = 'osc'
        else if (code >= 32 && code !== 127 && !(code >= 0x80 && code <= 0x9f) || char === '\n' || char === '\r' || char === '\t') text += char
        break
      case 'escape':
        if (char === '[') capture.controlState = 'csi'
        else if (char === ']') capture.controlState = 'osc'
        else if (char === 'P' || char === '^' || char === '_') capture.controlState = 'string'
        else if (code >= 0x20 && code <= 0x2f) capture.controlState = 'intermediate'
        else capture.controlState = 'text'
        break
      case 'intermediate':
        if (code >= 0x30 && code <= 0x7e) capture.controlState = 'text'
        break
      case 'csi':
        if (code >= 0x40 && code <= 0x7e) capture.controlState = 'text'
        break
      case 'osc':
      case 'string':
        if (code === 0x9c || (code === 7 && capture.controlState === 'osc')) capture.controlState = 'text'
        else if (code === 27) capture.controlState = capture.controlState === 'osc' ? 'osc-escape' : 'string-escape'
        break
      case 'osc-escape':
      case 'string-escape':
        if (char === '\\') capture.controlState = 'text'
        else capture.controlState = capture.controlState === 'osc-escape' ? 'osc' : 'string'
        break
    }
  }
  return text
}

interface OpenCapture {
  fd: number
  file: string
  bytes: number
  truncated: boolean
  /** Output past the last newline, held back until the line is complete.
   *  A PTY delivers arbitrary byte boundaries, and a secret cut across two
   *  chunks would be matched by no pattern in either half. */
  pending: string
  /** Matching PEM footer while its body is discarded between writes. */
  privateKeyFooter: string | null
  controlState: ControlState
  redactions: Map<string, number>
}

export function createTranscriptStore(deps: TranscriptStoreDeps): TranscriptStore {
  const maxBytes = deps.maxBytes ?? DEFAULT_MAX
  const head = deps.excerptHead ?? DEFAULT_HEAD
  const tail = deps.excerptTail ?? DEFAULT_TAIL
  const dir = path.join(deps.root, 'transcripts')
  const open = new Map<string, OpenCapture>()

  const fileFor = (sessionId: string): string => path.join(dir, `${sessionId}.log`)
  const metaFor = (sessionId: string): string => path.join(dir, `${sessionId}.meta.json`)
  const finalFor = (sessionId: string): string => path.join(dir, `${sessionId}.final.json`)
  const pendingFor = (sessionId: string): string => path.join(dir, `${sessionId}.pending.json`)
  type Retained = { snapshot: SealedCapture; pendingPersisted: boolean; persisted: boolean } | { failed: true }
  // Bodies remain in the spool. Only entries with a durable descriptor may be
  // evicted; losing a failed first attempt would lose its observed exit facts.
  const sealed = new Map<string, Retained>()
  const unpersisted = (): number => [...sealed.values()].filter((v) => !('failed' in v) && !v.pendingPersisted).length
  const retain = (sessionId: string, value: Retained): void => {
    sealed.delete(sessionId)
    if (sealed.size >= 256) {
      const evict = [...sealed].find(([, v]) => 'failed' in v || v.pendingPersisted)
      if (evict) sealed.delete(evict[0])
      else return // Admission bounds open + unpersisted attempts; never evict them.
    }
    sealed.set(sessionId, value)
  }
  const readSeal = (sessionId: string, pending = false): SealedCapture => {
    const file = pending ? pendingFor(sessionId) : finalFor(sessionId)
    if (statSync(file).size > 64 * 1024) throw new Error('transcript metadata exceeds its bound')
    const value = JSON.parse(readFileSync(file, 'utf8')) as SealedCapture
    if (value.schema !== 'TranscriptFinalization@1' || value.sessionId !== sessionId || typeof value.truncated !== 'boolean'
      || !value.meta || typeof value.meta.optionId !== 'string' || typeof value.meta.startedAt !== 'string'
      || typeof value.meta.endedAt !== 'string' || !(value.meta.exitCode === null || typeof value.meta.exitCode === 'number')
      || !pending && (!value.result || !['captured', 'empty'].includes(value.result.state)
        || value.result.state === 'captured' && !/^[a-f0-9]{64}$/.test(value.result.sha256)))
      throw new Error('transcript finalization metadata is invalid')
    return value
  }
  const persistSeal = (snapshot: SealedCapture, pending = false): SealedCapture => {
    const file = pending ? pendingFor(snapshot.sessionId) : finalFor(snapshot.sessionId)
    const temporary = `${file}.tmp.${randomUUID()}`
    try {
      const fd = openSync(temporary, 'wx', 0o600)
      try { writeFileSync(fd, JSON.stringify(snapshot)); fsyncSync(fd) } finally { closeSync(fd) }
      // Each writer owns its temporary inode. A concurrent writer cannot modify
      // bytes already linked into the winning immutable descriptor.
      try { linkSync(temporary, file) }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
      return readSeal(snapshot.sessionId, pending)
    } finally {
      try { rmSync(temporary, { force: true }) } catch { /* only this writer's temporary */ }
    }
  }

  /**
   * Write output through the redactor, a whole line at a time (M95).
   *
   * SECRETS ARE REMOVED ON THE WAY IN, not on the way out — because the spool
   * file lands on disk and an agent session runs as the operator, so a record
   * cleaned only at read time is a record the very actor being defended against
   * can read in the raw.
   *
   * Buffered to the last newline: a PTY hands over arbitrary byte boundaries,
   * and a token split across two chunks matches no pattern in either half.
   * `force` flushes the remainder at close. An unfinished line beyond the cap
   * terminates capture with `truncated`: flushing it could cut a credential in
   * two and persist an unmatched tail on the next write.
   */
  const flush = (
    capture: OpenCapture,
    sessionId: string,
    chunk: string,
    force: boolean
  ): void => {
    capture.pending += plainChunk(capture, chunk)
    if (force && capture.controlState !== 'text') capture.truncated = true
    const cut = capture.pending.lastIndexOf('\n')
    let ready: string
    if (force) {
      ready = capture.pending
      capture.pending = ''
    } else if (cut >= 0) {
      ready = capture.pending.slice(0, cut + 1)
      capture.pending = capture.pending.slice(cut + 1)
    } else if (capture.pending.length > PENDING_CAP) {
      capture.pending = ''
      capture.truncated = true
      // A capture with no earlier line still needs a visible gap receipt.
      ready = '[transcript truncated: unfinished line exceeds capture limit]\n'
      capture.privateKeyFooter = null
    } else {
      return
    }
    if (ready === '') return

    // A private key spans lines and writes. The regex for complete text cannot
    // protect its earlier lines: discard the body immediately, remembering only
    // the expected footer. No raw body is spooled while waiting for that footer.
    let safe = ''
    while (ready) {
      if (capture.privateKeyFooter) {
        const end = ready.indexOf(capture.privateKeyFooter)
        if (end < 0) break
        ready = ready.slice(end + capture.privateKeyFooter.length)
        capture.privateKeyFooter = null
      } else {
        const begin = /-----BEGIN ([A-Z ]*PRIVATE KEY)-----/.exec(ready)
        if (!begin) { safe += ready; break }
        safe += ready.slice(0, begin.index) + '[redacted: private-key]'
        capture.redactions.set('private-key', (capture.redactions.get('private-key') ?? 0) + 1)
        capture.privateKeyFooter = `-----END ${begin[1]}-----`
        ready = ready.slice(begin.index + begin[0].length)
      }
    }
    const { text, redactions } = redact(safe)
    for (const { rule, count } of redactions)
      capture.redactions.set(rule, (capture.redactions.get(rule) ?? 0) + count)

    const buffer = Buffer.from(text, 'utf8')
    if (capture.bytes + buffer.byteLength > maxBytes) {
      capture.truncated = true
      return
    }
    try {
      const written = writeSync(capture.fd, buffer)
      capture.bytes += written
      if (written !== buffer.byteLength) capture.truncated = true
    } catch (e) {
      ops.failed('transcripts.failure', e, { note: `transcript capture failed for ${sessionId}:` })
      capture.truncated = true
    }
  }

  const release = (sessionId: string): OpenCapture | undefined => {
    const capture = open.get(sessionId)
    open.delete(sessionId)
    if (capture) {
      try {
        closeSync(capture.fd)
      } catch {
        /* already closed */
      }
    }
    return capture
  }

  /**
   * Build the record from a spool that is already on disk.
   *
   * Shared by `close` and `recover`, and that sharing is the point: recovery
   * first went through `close`, which needs an OPEN capture — a store that has
   * just started has none, so recovery silently found nothing while the file
   * sat there. The probe caught it; reading the code would not have.
   */
  const recordFrom = (
    file: string,
    truncated: boolean,
    meta: TranscriptMeta,
    endObserved = true
  ): TranscriptFinalization => {
    let raw: string
    try {
      if (statSync(file).size > maxBytes) return { state: 'unavailable', reason: 'capture-gap' }
      raw = readFileSync(file, 'utf8')
    } catch (e) {
      ops.failed('transcripts.failure', e, { note: `transcript could not be read back from ${file}:` })
      return { state: 'unavailable', reason: 'spool-unreadable' }
    }
    const body = decodePty(raw)
    // A session that produced nothing gets no record. An empty transcript is
    // not evidence of anything and would only dilute a search.
    if (body.trim() === '') return truncated
      ? { state: 'unavailable', reason: 'capture-gap' }
      : { state: 'empty', truncated: false }

    const lines = body.split('\n').length
    const minutes = Math.max(
      0,
      Math.round((Date.parse(meta.endedAt) - Date.parse(meta.startedAt)) / 60000)
    )
    const size =
      body.length < 1000 ? `${body.length} chars` : `${Math.round(body.length / 1000)}k chars`
    const annotation =
      `${meta.optionId} · ${endObserved ? `${minutes} min` : 'duration unknown'} · ${lines} lines · ${size} · ` +
      (!endObserved ? 'exit unknown' : meta.exitCode === null ? 'exit unknown' : `exit ${meta.exitCode}`) +
      (truncated ? ' · truncated' : '') +
      (meta.redactions ? ` · ${meta.redactions}` : '')

    const excerpt = transcriptExcerpt(body, head, tail)

    return { state: 'captured', record: {
      sha256: createHash('sha256').update(body).digest('hex'),
      bytes: Buffer.byteLength(body, 'utf8'),
      lines,
      truncated,
      annotation,
      excerpt,
      body
    } }
  }

  const finalize = (sessionId: string, meta: TranscriptMeta): TranscriptFinalization => {
    let retained = sealed.get(sessionId)
    if (!retained) {
      const held = open.get(sessionId)
      if (held) {
        if (!held.truncated) flush(held, sessionId, '', true)
        const capture = release(sessionId)!
        retained = { pendingPersisted: false, persisted: false, snapshot: {
          schema: 'TranscriptFinalization@1', sessionId, truncated: capture.truncated,
          meta: { ...meta, redactions: meta.redactions ?? describeRedactions(
            [...capture.redactions].map(([rule, count]) => ({ rule, count }))) }
        } }
        retain(sessionId, retained)
      } else if (existsSync(finalFor(sessionId))) {
        try { retained = { snapshot: readSeal(sessionId), pendingPersisted: true, persisted: true }; retain(sessionId, retained) }
        catch { return { state: 'unavailable', reason: 'finalization-unavailable' } }
      } else if (existsSync(pendingFor(sessionId))) {
        try { retained = { snapshot: readSeal(sessionId, true), pendingPersisted: true, persisted: false }; retain(sessionId, retained) }
        catch { return { state: 'unavailable', reason: 'finalization-unavailable' } }
      } else return { state: 'unavailable', reason: 'missing-capture' }
    }
    if ('failed' in retained) return { state: 'unavailable', reason: 'capture-open-failed' }
    if (!retained.pendingPersisted) {
      try { retained.snapshot = persistSeal(retained.snapshot, true); retained.pendingPersisted = true }
      catch { return { state: 'unavailable', reason: 'finalization-unavailable' } }
    }
    if (!retained.persisted) {
      try {
        if (existsSync(finalFor(sessionId))) retained.snapshot = readSeal(sessionId)
        else {
          const result = recordFrom(fileFor(sessionId), retained.snapshot.truncated, retained.snapshot.meta)
          if (result.state === 'unavailable') return result
          const expected = retained.snapshot.result
          if (expected && (expected.state !== result.state || expected.state === 'captured'
            && result.state === 'captured' && expected.sha256 !== result.record.sha256))
            return { state: 'unavailable', reason: 'finalization-unavailable' }
          retained.snapshot.result = result.state === 'captured'
            ? { state: 'captured', sha256: result.record.sha256 } : { state: 'empty' }
          retained.snapshot = persistSeal(retained.snapshot)
        }
        retained.persisted = true
      } catch {
        return { state: 'unavailable', reason: 'finalization-unavailable' }
      }
    }
    const result = recordFrom(fileFor(sessionId), retained.snapshot.truncated, retained.snapshot.meta)
    const expected = retained.snapshot.result!
    if (result.state !== 'unavailable' && (result.state !== expected.state || result.state === 'captured'
      && expected.state === 'captured' && result.record.sha256 !== expected.sha256))
      return { state: 'unavailable', reason: 'finalization-unavailable' }
    return result
  }

  const recoverFinalizations = (page?: { after: string | null; limit: number; exclude?: ReadonlySet<string> }): TranscriptRecovery => {
    let names: string[]
    try { names = readdirSync(dir) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') names = []
      else {
        ops.failed('transcripts.transcript-spools-could-not-be-listed', error, { note: 'transcript spools could not be listed:' })
        return { state: 'unavailable', reason: 'directory-unreadable', items: [] }
      }
    }
    // Descriptor-only cases matter: a missing spool is unavailable evidence,
    // not a session that silently disappeared from the recovery queue.
    const ids = new Set<string>(sealed.keys())
    for (const name of names) {
      const match = /^(.*)\.(?:log|meta\.json|pending\.json|final\.json)$/.exec(name)
      if (match) ids.add(match[1])
    }
    const items: RecoveredTranscriptFinalization[] = []
    const candidates = [...ids].filter(id => !open.has(id) && !page?.exclude?.has(id)).sort()
    const eligible = page?.after ? candidates.filter(id => id > page.after!) : candidates
    const limit = page ? Math.max(1, Math.min(8, Number.isSafeInteger(page.limit) ? page.limit : 8)) : eligible.length
    const selected = eligible.slice(0, limit)
    for (const sessionId of selected) {
      let context: SpoolContext | null = null
      try {
        if (existsSync(metaFor(sessionId))) {
          if (statSync(metaFor(sessionId)).size > 64 * 1024) throw new Error('transcript context exceeds its bound')
          const value = JSON.parse(readFileSync(metaFor(sessionId), 'utf8')) as SpoolContext
          if (typeof value.projectId !== 'string' || typeof value.optionId !== 'string' || typeof value.startedAt !== 'string'
            || !(value.taskId === null || typeof value.taskId === 'string')) throw new Error('transcript context is invalid')
          context = value
        }
      } catch (error) {
        ops.failed('transcripts.failure', error, { note: `transcript context unreadable for ${sessionId}:` })
      }
      let snapshot: SealedCapture | null = null
      const retained = sealed.get(sessionId)
      if (existsSync(finalFor(sessionId)) || existsSync(pendingFor(sessionId))) {
        try { snapshot = readSeal(sessionId, !existsSync(finalFor(sessionId))) }
        catch {
          // Expose an unavailable recovery item; retain the corrupt evidence for repair.
          items.push({ sessionId, context, meta: null, result: { state: 'unavailable', reason: 'finalization-unavailable' } })
          continue
        }
      } else if (retained && !('failed' in retained)) snapshot = retained.snapshot
      const unknownExit: TranscriptMeta = {
        optionId: context?.optionId ?? 'unknown', startedAt: context?.startedAt ?? '', endedAt: '', exitCode: null
      }
      const result = snapshot ? finalize(sessionId, snapshot.meta)
        : retained && 'failed' in retained ? { state: 'unavailable' as const, reason: 'capture-open-failed' as const }
          : recordFrom(fileFor(sessionId), true, unknownExit, false)
      items.push({ sessionId, context, meta: snapshot ? { ...snapshot.meta } : null, result })
    }
    return { state: 'listed', items, ...(page ? { nextCursor: eligible.length > selected.length ? selected.at(-1) ?? null : null, remaining: Math.max(0, eligible.length - selected.length) } : {}) }
  }

  return {
    open(sessionId: string, context?: SpoolContext): void {
      const file = fileFor(sessionId)
      // Session ids are generations. Reopening one must not truncate retained
      // evidence or replace a finalized attempt with a new empty capture.
      if (open.has(sessionId) || sealed.has(sessionId) || existsSync(file) || existsSync(finalFor(sessionId)) || existsSync(pendingFor(sessionId))) return
      // When storage cannot retain exit metadata, preserve those attempts and
      // refuse new captures instead of growing memory or evicting their facts.
      if (open.size + unpersisted() >= 256) return
      try {
        mkdirSync(dir, { recursive: true, mode: 0o700 })
        open.set(sessionId, {
          fd: openSync(file, 'w'),
          file,
          bytes: 0,
          truncated: false,
          pending: '',
          privateKeyFooter: null,
          controlState: 'text',
          redactions: new Map()
        })
        // Written BEFORE any output, because a crash one second in is exactly
        // the case recovery exists for and a sidecar written at close would not
        // be there.
        if (context) writeFileSync(metaFor(sessionId), JSON.stringify(context), { mode: 0o600 })
      } catch (e) {
        // A session must still run when its record cannot be opened. It will
        // simply have no transcript, and the failure is said out loud rather
        // than discovered later as an absence.
        release(sessionId)
        retain(sessionId, { failed: true })
        ops.failed('transcripts.failure', e, { note: `transcript capture could not start for ${sessionId}:` })
      }
    },

    write(sessionId: string, chunk: string): void {
      const capture = open.get(sessionId)
      if (!capture || capture.truncated) return
      flush(capture, sessionId, chunk, false)
    },

    close(sessionId: string, meta: TranscriptMeta): CapturedTranscript | null {
      const result = finalize(sessionId, meta)
      return result.state === 'captured' ? result.record : null
    },

    finalize,

    settle(sessionId: string): void {
      sealed.delete(sessionId)
      // Called after the record is durable. Both files go: the sidecar exists
      // only so an UNSETTLED spool can be recovered, and one that outlived its
      // log would make the next recovery report a session with no output.
      for (const file of [fileFor(sessionId), metaFor(sessionId), finalFor(sessionId), pendingFor(sessionId)]) {
        try {
          rmSync(file, { force: true })
        } catch {
          /* the record is already in the journal */
        }
      }
    },

    discard(sessionId: string): void {
      sealed.delete(sessionId)
      const capture = release(sessionId)
      for (const file of [capture?.file ?? fileFor(sessionId), metaFor(sessionId), finalFor(sessionId), pendingFor(sessionId)]) {
        try {
          rmSync(file, { force: true })
        } catch {
          /* nothing to clean */
        }
      }
    },

    recoverFinalizations,

    recover(): { sessionId: string; context: SpoolContext | null; record: CapturedTranscript }[] {
      const found: { sessionId: string; context: SpoolContext | null; record: CapturedTranscript }[] = []
      for (const item of recoverFinalizations().items) {
        if (item.result.state === 'captured') found.push({ sessionId: item.sessionId, context: item.context, record: item.result.record })
        else if (item.result.state === 'empty') this.settle(item.sessionId)
      }
      return found
    }
  }
}
