/**
 * Private history in trusted main (first-slice plan A1-6a, ADR-0079, SCN-097 / SCN-065). No
 * Electron import: the IPC and screens are A1-6c; this owns the files and the order of calls.
 *
 * EXPORT is read-only for the database: the ordinary archive is taken by the real
 * `backup.take`, the companion comes from `ceo_export_private_archive`, the native codec decodes
 * it before anything is kept, and the three files are written into `<dir>.partial` and renamed
 * only when complete — so a half-written export is never offered. The directory is 0700, each
 * file 0600: private to this user, not encrypted, which the screen says.
 *
 * RESTORE writes, so it is idempotent by operation: before the first call an operation file
 * records the target Estate and both operation IDs, minted here. A lost reply is resolved by
 * `check`, which repeats the SAME calls — the database answers an exact repeat with its original
 * receipt — and never mints a second restore. The operator's identity comes from main's held
 * authority only; nothing here takes a Person, Estate or credential from a caller.
 */
import { randomUUID } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeSync } from 'node:fs'
import path from 'node:path'
import { ARCHIVE_REASON_CODES, ArchiveFormatError, type ArchiveReasonCode } from './archiveJson.ts'
import { decodePrivateArchive, preflightOrdinaryArchive, type CeoPrivateArchive } from './ceoPrivateArchive.ts'

export interface PrivateHistoryIdentity { estateId: string; personId: string; revision: number; actor: { kind: 'person'; id: string } }
export type PrivateHistoryRpc = (name: 'ceo_export_private_archive' | 'restore_estate_verified' | 'ceo_import_private_archive' | 'ceo_private_import_receipt',
  args: Record<string, unknown>) => Promise<{ data: unknown; error?: unknown }>
export interface PrivateHistoryPorts {
  rootDir: string
  identity: { held(): PrivateHistoryIdentity | null }
  /** The real ordinary-archive writer (`backup.ts#take`), bound to its database. */
  take(estateId: string, dir: string): Promise<{ ok: boolean; says?: string }>
  rpc: PrivateHistoryRpc
  newId?: () => string
}
export type PrivateHistoryRefusal = { ok: false; state: 'refused' | 'result_unknown'; reason_code: string; operation_id?: string }
export interface RestoreOperation { schema: 'PrivateRestoreOperation@1'; operation_id: string; import_operation_id: string; target_estate_id: string;
  control_estate_id: string; person_id: string; dir: string; name: string; archive_digest: string | null; stage: 'restore' | 'import' | 'done'; target_revision: number | null }

const MANIFEST = 'manifest.json', JOURNAL = 'journal.ndjson', COMPANION = 'ceo-private.json'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const known = new Set<string>(ARCHIVE_REASON_CODES)
const refuse = (reason_code: string, state: PrivateHistoryRefusal['state'] = 'refused', operation_id?: string): PrivateHistoryRefusal =>
  ({ ok: false, state, reason_code, ...(operation_id ? { operation_id } : {}) })
const codeOf = (e: unknown): string => e instanceof ArchiveFormatError ? e.code : 'invalid_archive'

/** A private directory this user owns, mode 0700, never a symlink. */
function privateDir(dir: string): string {
  try { mkdirSync(dir, { recursive: true, mode: 0o700 }) } catch (e) { if ((e as { code?: string }).code !== 'EEXIST') throw e }
  const st = lstatSync(dir)
  if (!st.isDirectory() || st.isSymbolicLink() || (st.mode & 0o777) !== 0o700 || (process.getuid && st.uid !== process.getuid())) throw new Error('unsafe_private_directory')
  return dir
}
/** Written whole and synced; 0600. */
function writePrivate(file: string, bytes: string | Uint8Array): void {
  const fd = openSync(file, 'wx', 0o600)
  try { writeSync(fd, typeof bytes === 'string' ? Buffer.from(bytes) : bytes); fsyncSync(fd) } finally { closeSync(fd) }
}

export function createPrivateHistory(ports: PrivateHistoryPorts) {
  const newId = ports.newId ?? randomUUID
  const root = () => privateDir(path.join(ports.rootDir, 'private-history'))
  const exportsDir = () => privateDir(path.join(root(), 'exports'))
  const operationsDir = () => privateDir(path.join(root(), 'operations'))
  const held = (): PrivateHistoryIdentity | null => {
    try { const i = ports.identity.held(); return i && UUID.test(i.estateId) && UUID.test(i.personId) && Number.isSafeInteger(i.revision) && i.revision >= 1 ? i : null }
    catch { /* Not silence: unreadable authority is no authority; the caller is refused unavailable. */ return null }
  }
  const call = async (name: Parameters<PrivateHistoryRpc>[0], args: Record<string, unknown>): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; lost: boolean; reason: string }> => {
    let reply: { data: unknown; error?: unknown }
    try { reply = await ports.rpc(name, args) }
    catch { /* Not silence: a transport failure is a lost reply, which the caller reports as unknown for a write. */ return { ok: false, lost: true, reason: 'rpc_unavailable' } }
    if (reply.error || !reply.data || typeof reply.data !== 'object') return { ok: false, lost: true, reason: 'rpc_unavailable' }
    const v = reply.data as Record<string, unknown>
    if (v.ok === true) return { ok: true, value: v }
    const reason = typeof v.reason_code === 'string' && known.has(v.reason_code) ? v.reason_code : 'unavailable'
    return { ok: false, lost: false, reason }
  }

  /** Every complete export, newest first; a `.partial` directory is never listed. */
  function exports(): { dir: string; name: string }[] {
    return readdirSync(exportsDir()).filter(n => !n.endsWith('.partial') && existsSync(path.join(exportsDir(), n, COMPANION)))
      .sort().reverse().map(name => ({ dir: path.join(exportsDir(), name), name }))
  }

  async function exportHistory(): Promise<{ ok: true; dir: string; archive_id: string; conversations: number; messages: number } | PrivateHistoryRefusal> {
    const who = held(); if (!who) return refuse('unavailable')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-'), final = path.join(exportsDir(), `${stamp}-${newId()}`), partial = final + '.partial'
    try {
      privateDir(partial)
      const taken = await ports.take(who.estateId, partial)
      if (!taken.ok) { rmSync(partial, { recursive: true, force: true }); return refuse('unavailable') }
      const manifestRaw = readFileSync(path.join(partial, MANIFEST)), journalRaw = readFileSync(path.join(partial, JOURNAL))
      preflightOrdinaryArchive(manifestRaw, journalRaw)
      const r = await call('ceo_export_private_archive', { p_estate_id: who.estateId, p_person_id: who.personId, p_revision: who.revision,
        p_estate_manifest: JSON.parse(manifestRaw.toString('utf8')), p_journal_ndjson: journalRaw.toString('utf8') })
      if (!r.ok) { rmSync(partial, { recursive: true, force: true }); return refuse(r.lost ? 'unavailable' : r.reason) }
      const bytes = Buffer.from(JSON.stringify(r.value.archive, null, 2) + '\n')
      const decoded = decodePrivateArchive(bytes) // nothing is kept that the codec would refuse on import
      writePrivate(path.join(partial, COMPANION), bytes)
      renameSync(partial, final)
      return { ok: true, dir: final, archive_id: decoded.archive.archive_id, conversations: decoded.archive.conversations.length, messages: decoded.archive.messages.length }
    } catch (e) {
      // Not silence: the half-written directory is removed and the refusal carries its code.
      rmSync(partial, { recursive: true, force: true })
      return refuse(e instanceof ArchiveFormatError ? e.code : 'unavailable')
    }
  }

  /** Read an archive directory without touching the database: what it would restore, or why not. */
  function inspect(dir: string): { ok: true; source_estate_id: string; taken_at: string; events: number; companion: { owner: string; conversations: number; messages: number } | null } | PrivateHistoryRefusal {
    try {
      const m = preflightOrdinaryArchive(readFileSync(path.join(dir, MANIFEST)), readFileSync(path.join(dir, JOURNAL))).manifest
      let companion: CeoPrivateArchive | null = null
      if (existsSync(path.join(dir, COMPANION))) {
        companion = decodePrivateArchive(readFileSync(path.join(dir, COMPANION))).archive
        if (companion.estate_archive.digest !== m.digest) return refuse('invalid_archive')
      }
      return { ok: true, source_estate_id: m.sourceEstateId, taken_at: m.takenAtUtc, events: m.eventCount,
        companion: companion && { owner: companion.owner_person_id, conversations: companion.conversations.length, messages: companion.messages.length } }
    } catch (e) {
      // Not silence: an unreadable or refused file is its reason code, never a quoted path or byte.
      return refuse(existsSync(dir) ? codeOf(e) : 'not_found')
    }
  }

  const opFile = (id: string) => path.join(operationsDir(), `${id}.json`)
  const saveOp = (op: RestoreOperation): void => { const tmp = opFile(op.operation_id) + '.tmp'; rmSync(tmp, { force: true }); writePrivate(tmp, JSON.stringify(op)); renameSync(tmp, opFile(op.operation_id)) }
  const loadOp = (id: string): RestoreOperation | null => {
    if (!UUID.test(id) || !existsSync(opFile(id))) return null
    try { const v = JSON.parse(readFileSync(opFile(id), 'utf8')) as RestoreOperation; return v.schema === 'PrivateRestoreOperation@1' && v.operation_id === id ? v : null }
    catch { /* Not silence: an unreadable operation file is reported as not found; nothing is minted in its place. */ return null }
  }

  /** Restore an archive into a fresh Estate the operator will own, then import their private
   * history when the archive carries it. The operation is recorded before the first call. */
  async function restore(dir: string, name: string) {
    const who = held(); if (!who) return refuse('unavailable')
    if (typeof name !== 'string' || name.trim().length < 1 || name.length > 200) return refuse('invalid_archive')
    const seen = inspect(dir); if (!seen.ok) return seen
    if (seen.companion && seen.companion.owner !== who.personId) return refuse('unavailable') // another Person's history is never imported
    const companion = seen.companion ? decodePrivateArchive(readFileSync(path.join(dir, COMPANION))).archive : null
    const op: RestoreOperation = { schema: 'PrivateRestoreOperation@1', operation_id: newId(), import_operation_id: newId(), target_estate_id: newId(),
      control_estate_id: who.estateId, person_id: who.personId, dir, name: name.trim(), archive_digest: companion?.archive_digest ?? null, stage: 'restore', target_revision: null }
    saveOp(op)
    return advance(op)
  }

  async function advance(op: RestoreOperation) {
    const who = held(); if (!who || who.personId !== op.person_id || who.estateId !== op.control_estate_id) return refuse('unavailable', 'refused', op.operation_id)
    if (op.stage === 'restore') {
      const manifest = JSON.parse(readFileSync(path.join(op.dir, MANIFEST), 'utf8')), journal = readFileSync(path.join(op.dir, JOURNAL), 'utf8')
      const r = await call('restore_estate_verified', { p_control_estate: op.control_estate_id, p_person_id: op.person_id, p_revision: who.revision, p_actor: who.actor,
        p_operation_id: op.operation_id, p_target_estate: op.target_estate_id, p_estate_manifest: manifest, p_journal_ndjson: journal, p_name: op.name })
      if (!r.ok) return refuse(r.lost ? 'result_unknown' : r.reason, r.lost ? 'result_unknown' : 'refused', op.operation_id)
      op.target_revision = Number(r.value.target_revision)
      op.stage = op.archive_digest ? 'import' : 'done'
      saveOp(op)
    }
    if (op.stage === 'import') {
      const archive = JSON.parse(readFileSync(path.join(op.dir, COMPANION), 'utf8'))
      if (archive.archive_digest !== op.archive_digest) return refuse('integrity_mismatch', 'refused', op.operation_id)
      const r = await call('ceo_import_private_archive', { p_target_estate: op.target_estate_id, p_person_id: op.person_id, p_revision: op.target_revision,
        p_actor: who.actor, p_operation_id: op.import_operation_id, p_restore_operation_id: op.operation_id, p_archive: archive })
      if (!r.ok) return refuse(r.lost ? 'result_unknown' : r.reason, r.lost ? 'result_unknown' : 'refused', op.operation_id)
      op.stage = 'done'; saveOp(op)
    }
    return { ok: true as const, operation_id: op.operation_id, target_estate_id: op.target_estate_id, history_restored: true, access_verified: true,
      private_history: op.archive_digest !== null, opened: false }
  }

  /** A lost reply: repeat the SAME operation. Never a new target, never a new operation ID. */
  async function check(operationId: string) {
    const op = loadOp(operationId); if (!op) return refuse('not_found')
    return advance(op)
  }

  /** Estates this machine restored to completion for the held Person: the only ones "Open this
   * Estate" may record. Read from the operation files, so the choice survives a restart. */
  function restored(): string[] {
    const who = held(); if (!who) return []
    return readdirSync(operationsDir()).filter(n => /^[0-9a-f-]{36}\.json$/.test(n)).map(n => loadOp(n.slice(0, -5)))
      .filter((op): op is RestoreOperation => !!op && op.stage === 'done' && op.person_id === who.personId).map(op => op.target_estate_id)
  }

  return { exports, exportHistory, inspect, restore, check, restored }
}
export type PrivateHistory = ReturnType<typeof createPrivateHistory>
export type { ArchiveReasonCode }
