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
  control_estate_id: string; person_id: string; dir: string; name: string; archive_digest: string | null; stage: 'restore' | 'import' | 'done'; target_revision: number | null
  /** Why private history was NOT imported although the archive carried one: `not_your_history` (another Person's
   *  companion, never sent to import), or the import's definitive refusal. Absent on operations written before it. */
  private_history_skipped?: string | null }
/** Not one of the shared archive codes (`archiveJson.ts`): main decides it alone, before any database call. */
export const NOT_YOUR_HISTORY = 'not_your_history'

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

  type ArchiveRead = { ok: true; files: { manifest: Buffer; journal: Buffer; companion: Buffer | null }
    m: ReturnType<typeof preflightOrdinaryArchive>['manifest']; companion: CeoPrivateArchive | null }
  /** The archive's bytes, read ONCE and checked as read: what is verified is what is kept and sent. */
  function readArchive(dir: string): ArchiveRead | PrivateHistoryRefusal {
    try {
      const manifest = readFileSync(path.join(dir, MANIFEST)), journal = readFileSync(path.join(dir, JOURNAL))
      const m = preflightOrdinaryArchive(manifest, journal).manifest
      let companion: CeoPrivateArchive | null = null, companionRaw: Buffer | null = null
      if (existsSync(path.join(dir, COMPANION))) {
        companionRaw = readFileSync(path.join(dir, COMPANION))
        companion = decodePrivateArchive(companionRaw).archive
        if (companion.estate_archive.digest !== m.digest) return refuse('invalid_archive')
      }
      return { ok: true, files: { manifest, journal, companion: companionRaw }, m, companion }
    } catch (e) {
      // Not silence: an unreadable or refused file is its reason code, never a quoted path or byte.
      return refuse(existsSync(dir) ? codeOf(e) : 'not_found')
    }
  }

  /** Read an archive directory without touching the database: what it would restore, or why not. */
  function inspect(dir: string): { ok: true; source_estate_id: string; taken_at: string; events: number; companion: { owner: string; conversations: number; messages: number } | null } | PrivateHistoryRefusal {
    const r = readArchive(dir); if (!r.ok) return r
    const { m, companion } = r
    return { ok: true, source_estate_id: m.sourceEstateId, taken_at: m.takenAtUtc, events: m.eventCount,
      companion: companion && { owner: companion.owner_person_id, conversations: companion.conversations.length, messages: companion.messages.length } }
  }

  const opFile = (id: string) => path.join(operationsDir(), `${id}.json`)
  /** The operation's own copy of the archive (A5-013): "the file is kept until the result is known" holds even
   *  when the operator moves the original or its disk goes away between the restore and its check. */
  const copyDir = (id: string) => path.join(operationsDir(), `${id}.archive`)
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
    const read = readArchive(dir); if (!read.ok) return read
    // #region private-history-restore-skip — docs: docs/ux/scenarios.md#scn-097-export-and-import-my-private-conversation-history
    // Another Person's companion is never imported (ADR-0079 §1, §4): the ordinary archive is the control Estate
    // owner's to restore, and that Person imports their own file into the restored Estate independently. So the
    // restore goes ahead and says why private history did not come with it (audit 2026-10-05 A5-011).
    const companion = read.companion !== null && read.companion.owner_person_id === who.personId ? read.companion : null
    const skipped = read.companion !== null && companion === null ? NOT_YOUR_HISTORY : null
    const operation_id = newId(), copy = copyDir(operation_id)
    try {
      privateDir(copy)
      writePrivate(path.join(copy, MANIFEST), read.files.manifest)
      writePrivate(path.join(copy, JOURNAL), read.files.journal)
      if (companion && read.files.companion) writePrivate(path.join(copy, COMPANION), read.files.companion)
    } catch {
      // Not silence: nothing was sent and no operation was recorded, so there is nothing to check.
      try { if (lstatSync(copy).isDirectory()) rmSync(copy, { recursive: true, force: true }) } catch { /* no copy was made */ }
      return refuse('unavailable')
    }
    // #endregion private-history-restore-skip
    const op: RestoreOperation = { schema: 'PrivateRestoreOperation@1', operation_id, import_operation_id: newId(), target_estate_id: newId(),
      control_estate_id: who.estateId, person_id: who.personId, dir: copy, name: name.trim(), archive_digest: companion?.archive_digest ?? null,
      stage: 'restore', target_revision: null, private_history_skipped: skipped }
    saveOp(op)
    return advance(op)
  }

  /** A file of the operation's archive, or the refusal naming why it cannot be read (A3-004, A5-013): a read that
   *  threw left the panel on "Restoring…" with no control. The operation stays at its stage, so Check again
   *  repeats it once the file is back. */
  const readOpFile = (op: RestoreOperation, file: string): { ok: true; text: string } | PrivateHistoryRefusal => {
    try { return { ok: true, text: readFileSync(path.join(op.dir, file), 'utf8') } }
    catch (e) {
      // Not silence: the refusal names the reason by code (never the path) and keeps the operation checkable.
      return refuse((e as { code?: string }).code === 'ENOENT' ? 'not_found' : 'unavailable', 'refused', op.operation_id)
    }
  }
  const parsed = (op: RestoreOperation, text: string): { ok: true; value: Record<string, unknown> } | PrivateHistoryRefusal => {
    try { return { ok: true, value: JSON.parse(text) as Record<string, unknown> } }
    catch { /* Not silence: the file no longer parses; refused with its operation, nothing sent. */ return refuse('invalid_json', 'refused', op.operation_id) }
  }

  async function advance(op: RestoreOperation) {
    const who = held(); if (!who || who.personId !== op.person_id || who.estateId !== op.control_estate_id) return refuse('unavailable', 'refused', op.operation_id)
    if (op.stage === 'restore') {
      const manifestText = readOpFile(op, MANIFEST); if (!manifestText.ok) return manifestText
      const manifest = parsed(op, manifestText.text); if (!manifest.ok) return manifest
      const journal = readOpFile(op, JOURNAL); if (!journal.ok) return journal
      const r = await call('restore_estate_verified', { p_control_estate: op.control_estate_id, p_person_id: op.person_id, p_revision: who.revision, p_actor: who.actor,
        p_operation_id: op.operation_id, p_target_estate: op.target_estate_id, p_estate_manifest: manifest.value, p_journal_ndjson: journal.text, p_name: op.name })
      if (!r.ok) return refuse(r.lost ? 'result_unknown' : r.reason, r.lost ? 'result_unknown' : 'refused', op.operation_id)
      op.target_revision = Number(r.value.target_revision)
      op.stage = op.archive_digest ? 'import' : 'done'
      saveOp(op)
    }
    if (op.stage === 'import') {
      const text = readOpFile(op, COMPANION); if (!text.ok) return text
      const archive = parsed(op, text.text); if (!archive.ok) return archive
      if (archive.value.archive_digest !== op.archive_digest) return refuse('integrity_mismatch', 'refused', op.operation_id)
      const r = await call('ceo_import_private_archive', { p_target_estate: op.target_estate_id, p_person_id: op.person_id, p_revision: op.target_revision,
        p_actor: who.actor, p_operation_id: op.import_operation_id, p_restore_operation_id: op.operation_id, p_archive: archive.value })
      // A lost reply stays unknown: the import may have committed. A definitive refusal ends the operation with the
      // Estate restored and private history not imported (A5-012; SCN-097: "a failed import leaves the restored
      // Estate usable with private history unavailable") — it used to stay at `import`, never openable.
      if (!r.ok && r.lost) return refuse('result_unknown', 'result_unknown', op.operation_id)
      if (!r.ok) op.private_history_skipped = r.reason
      op.stage = 'done'; saveOp(op)
    }
    // The result is known: the operation's copy has done its job (the original is the operator's, never touched).
    try { rmSync(copyDir(op.operation_id), { recursive: true, force: true }) } catch { /* Not silence: a copy left behind is private (0700); the result stands. */ }
    return resultOf(op)
  }
  const imported = (op: RestoreOperation): boolean => op.archive_digest !== null && !op.private_history_skipped
  const resultOf = (op: RestoreOperation) => ({ ok: true as const, operation_id: op.operation_id, target_estate_id: op.target_estate_id,
    history_restored: true as const, access_verified: true as const, private_history: imported(op),
    private_history_skipped: op.private_history_skipped ?? null, opened: false as const })

  /** A lost reply: repeat the SAME operation. Never a new target, never a new operation ID. */
  async function check(operationId: string) {
    const op = loadOp(operationId); if (!op) return refuse('not_found')
    return advance(op)
  }

  /** Estates this machine restored to completion for the held Person: the only ones "Open this
   * Estate" may record. Read from the operation files, so the choice survives a restart. */
  function restored(): string[] {
    const who = held(); if (!who) return []
    return ownOps(who).filter(op => op.stage === 'done').map(op => op.target_estate_id)
  }
  const ownOps = (who: PrivateHistoryIdentity): RestoreOperation[] =>
    readdirSync(operationsDir()).filter(n => /^[0-9a-f-]{36}\.json$/.test(n)).sort().map(n => loadOp(n.slice(0, -5)))
      .filter((op): op is RestoreOperation => !!op && op.person_id === who.personId)

  // #region private-history-operations — docs: docs/ux/scenarios.md#scn-065-restore-an-archive-into-a-fresh-estate-and-open-it
  /** Restores this Person started whose result is not known yet (A5-014): read from the operation files, so closing
   *  the panel or restarting no longer loses the operation id that Check again needs. */
  function pending(): { operation_id: string; name: string }[] {
    const who = held(); if (!who) return []
    return ownOps(who).filter(op => op.stage !== 'done').map(op => ({ operation_id: op.operation_id, name: op.name }))
  }
  /** Estates this machine restored for the held Person that it may still open (A3-005: "open the restored one
   *  later"). The Estate already open is not one to open. */
  function restoredEstates(): { target_estate_id: string; name: string; private_history: boolean }[] {
    const who = held(); if (!who) return []
    return ownOps(who).filter(op => op.stage === 'done' && op.target_estate_id !== who.estateId)
      .map(op => ({ target_estate_id: op.target_estate_id, name: op.name, private_history: imported(op) }))
  }
  // #endregion private-history-operations

  return { exports, exportHistory, inspect, restore, check, restored, pending, restoredEstates }
}
export type PrivateHistory = ReturnType<typeof createPrivateHistory>
export type { ArchiveReasonCode }
