// Operator-local JSON that does not lie about being saved (S14).
//
// ELECTRON-FREE ON PURPOSE, the same split `repoRoot.ts` and `gitRun.ts` already
// made: the directory arrives as an argument, so a probe can point it at a temp
// folder and take away its write permission. `localStore.ts` is the thin binding
// that supplies `app.getPath('userData')`.
//
// WHAT WAS MEASURED, and it is data loss rather than an inconvenience.
// `settings.ts` returned DEFAULTS when the file would not parse, and the next
// `writeSettings` merged its patch onto those defaults and wrote them back — so
// one malformed byte destroyed the operator's workspace path, their open tabs
// and their locale, through a save that reported success. Beside it,
// `localStore.write` returned `void` and logged, and `toggleFavourite` returned
// the value it HOPED had landed.
//
// THREE RULES, and each is the opposite of one of those.
//   1. A file that will not parse is QUARANTINED, never overwritten. The bytes
//      are the operator's; a default is ours.
//   2. A write reports what happened — committed, conflict, or failed with a
//      reason. `void` is the return type of a promise.
//   3. The write is atomic: temp beside the target, fsync, rename. A process
//      killed mid-write leaves the previous file intact, and the temp it left
//      behind is never read as the answer.

import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { ops } from './opsSink.ts'
import type { CasWrite } from '../shared/casWrite.ts'

/** Which file, what an empty one means, and how to tell a valid one. The
 *  validator is not optional: "it parsed" is not "it is what we asked for", and
 *  a hand-edited list turned into an object used to reach the renderer. */
export interface LocalFile<T> {
  dir: string
  file: string
  empty: T
  validate: (parsed: unknown) => T | null
}

export type LocalReadStatus =
  /** The live file parsed and validated. */
  | 'ready'
  /** The live file was unusable and a previous good copy answered instead. */
  | 'recovered'
  /** Nothing has ever been saved. Not an error — the empty value is correct. */
  | 'default_missing'
  /** Unusable, with nothing to fall back to. The empty value is handed over
   *  LABELLED, so a caller can work while knowing it is not the saved state. */
  | 'unreadable'

export interface LocalRead<T> {
  value: T
  /** Opaque equality token over the canonical value. Compared, never ordered. */
  revision: string
  status: LocalReadStatus
  lastGoodAt: string | null
  error?: string
}

/** A local file's CAS result. The concept is declared once in
 *  `shared/casWrite.ts` (UX28-11) — the revision here is a content hash. */
export type LocalWrite<T> = CasWrite<T, string>

/** Hashed from the CANONICAL value rather than the bytes, so a read and the
 *  write that produced it agree regardless of how the file was formatted. */
function revisionOf(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value) ?? 'null').digest('hex').slice(0, 16)
}

const live = <T>(spec: LocalFile<T>): string => path.join(spec.dir, spec.file)
const lastGood = <T>(spec: LocalFile<T>): string => path.join(spec.dir, `${spec.file}.last-good`)
const temp = <T>(spec: LocalFile<T>): string => path.join(spec.dir, `${spec.file}.tmp`)

/** Recovery metadata is advisory: losing its file after reading the value
 * must not leak a filesystem diagnostic or discard that validated value. */
function lastGoodAt<T>(spec: LocalFile<T>): string | null {
  try {
    return statSync(lastGood(spec)).mtime.toISOString()
  } catch {
    ops.failed('localState.read', 'local_state_metadata_unavailable')
    return null
  }
}

function parseValid<T>(spec: LocalFile<T>, file: string): T | null {
  try {
    const value = spec.validate(JSON.parse(readFileSync(file, 'utf8')))
    return value === null || value === undefined ? null : value
  } catch {
    // Parse diagnostics may contain private draft excerpts or local paths.
    ops.failed('localState.parse', 'local_state_recovery_read_failed')
    return null
  }
}

/** Move the unusable bytes aside. NEVER delete: the file is the operator's own
 *  and the only copy of whatever they had. A collision gets a suffix rather than
 *  clobbering an earlier quarantine, because the second corruption is usually
 *  the interesting one and overwriting the first loses the pair. */
function quarantine<T>(spec: LocalFile<T>, stamp: string): void {
  const base = `${live(spec)}.quarantined-${stamp}`
  let target = base
  for (let n = 2; existsSync(target); n++) target = `${base}-${n}`
  try {
    renameSync(live(spec), target)
  } catch {
    // Nothing else to do: the read still reports `unreadable`, and leaving the
    // file in place is safer than any attempt to remove it.
  }
}

export function readLocal<T>(spec: LocalFile<T>): LocalRead<T> {
  const fallback = (status: LocalReadStatus, error?: string): LocalRead<T> => {
    const good = existsSync(lastGood(spec)) ? parseValid(spec, lastGood(spec)) : null
    if (good !== null)
      return {
        value: good,
        revision: revisionOf(good),
        status: 'recovered',
        lastGoodAt: lastGoodAt(spec),
        error
      }
    if (status === 'default_missing') {
      // Quarantining a failed read must not make the next read (or restart)
      // look like a pristine installation. A valid live/recovery file above
      // supersedes old quarantine evidence; only an unresolved absence fails.
      try {
        const damaged = existsSync(lastGood(spec)) ||
          (existsSync(spec.dir) && readdirSync(spec.dir).some(name => name.startsWith(`${spec.file}.quarantined-`)))
        if (damaged) return { value: spec.empty, revision: revisionOf(spec.empty), status: 'unreadable', lastGoodAt: null, error: 'local_state_recovery_required' }
      } catch {
        ops.failed('localState.read', 'local_state_read_failed')
        return { value: spec.empty, revision: revisionOf(spec.empty), status: 'unreadable', lastGoodAt: null, error: 'local_state_read_failed' }
      }
    }
    return { value: spec.empty, revision: revisionOf(spec.empty), status, lastGoodAt: null, error }
  }

  if (!existsSync(live(spec))) return fallback('default_missing')

  let raw: string
  try {
    raw = readFileSync(live(spec), 'utf8')
  } catch {
    // Present and unreadable is not the same as absent, and it must not be
    // quarantined either — we could not read it, so we do not know it is bad.
    ops.failed('localState.read', 'local_state_read_failed')
    return fallback('unreadable', 'local_state_read_failed')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    ops.failed('localState.parse', 'local_state_invalid_json')
    quarantine(spec, `${revisionOf(raw)}`)
    return fallback('unreadable', 'local_state_invalid_json')
  }

  let value: T | null
  try {
    value = spec.validate(parsed)
  } catch {
    ops.failed('localState.validate', 'local_state_validation_failed')
    quarantine(spec, `${revisionOf(raw)}`)
    return fallback('unreadable', 'local_state_validation_failed')
  }
  if (value === null || value === undefined) {
    quarantine(spec, `${revisionOf(raw)}`)
    return fallback('unreadable', 'local_state_invalid_shape')
  }

  return {
    value,
    revision: revisionOf(value),
    status: 'ready',
    lastGoodAt: existsSync(lastGood(spec)) ? lastGoodAt(spec) : null
  }
}

/** Write bytes so that a crash cannot leave a half-file where the answer was:
 *  temp beside the target so the rename is on one filesystem, fsync so the
 *  bytes are on the device before the name points at them, rename, then fsync
 *  the directory so the name itself survives. */
export function atomicWrite(file: string, bytes: string, tmp: string): void {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(tmp, bytes, { mode: 0o600 })
  const fd = openSync(tmp, 'r+')
  try {
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(tmp, file)
  const dir = openSync(path.dirname(file), 'r')
  try {
    fsyncSync(dir)
  } finally {
    closeSync(dir)
  }
}

export function writeLocal<T>(spec: LocalFile<T>, next: T, expectedRevision?: string): LocalWrite<T> {
  const current = readLocal(spec)
  if (current.status === 'unreadable') return { status: 'failed', reason: 'local_state_recovery_required' }

  // Optimistic concurrency, and it is the operator's own state rather than the
  // estate's: two windows both pinning a project is the case, and the loser
  // needs its patch back rather than a silent overwrite. These synchronous
  // operations serialize on the app's single main thread; this is not an
  // operating-system lock for competing processes or hosts.
  if (expectedRevision !== undefined && expectedRevision !== current.revision)
    return { status: 'conflict', currentRevision: current.revision, currentValue: current.value }

  // Validate before serialization and validate the actual JSON representation.
  // Validators may normalize (settings does), so receipt and revision describe
  // the canonical bytes we persist, not the caller's unvalidated proposal.
  let value: T
  let bytes: string
  let revision: string
  try {
    const candidate = spec.validate(next)
    if (candidate === null || candidate === undefined) throw new Error('invalid')
    bytes = JSON.stringify(candidate, null, 2)
    if (typeof bytes !== 'string') throw new Error('invalid')
    const decoded = spec.validate(JSON.parse(bytes))
    if (decoded === null || decoded === undefined || JSON.stringify(decoded, null, 2) !== bytes)
      throw new Error('invalid')
    value = decoded
    revision = revisionOf(value)
  } catch {
    ops.failed('localState.validate', 'local_state_invalid_next')
    return { status: 'failed', reason: 'local_state_invalid_next' }
  }
  try {
    atomicWrite(live(spec), bytes, temp(spec))
  } catch {
    // A failure after rename (e.g. directory fsync) has an uncertain outcome;
    // callers must reread, never infer from failure that the live bytes stayed.
    ops.failed('localState.write', 'local_state_write_failed')
    return { status: 'failed', reason: 'local_state_write_failed' }
  }

  try {
    // The recovery copy, written after the live one so a crash between them
    // leaves a stale last-good rather than a stale live file.
    atomicWrite(lastGood(spec), bytes, `${temp(spec)}.last-good`)
  } catch {
    // The save DID land. A missing recovery copy is worth less than the write,
    // so it is not reported as a failure — the next successful write restores it.
  }

  return { status: 'committed', value, revision }
}

/** Read, transform, write at the revision that was read. The loop a caller
 *  would otherwise write by hand, and get wrong by reading twice. */
export function updateLocal<T>(spec: LocalFile<T>, change: (current: T) => T): LocalWrite<T> {
  const current = readLocal(spec)
  if (current.status === 'unreadable') return { status: 'failed', reason: 'local_state_recovery_required' }
  let next: T
  try {
    next = change(current.value)
  } catch {
    ops.failed('localState.update', 'local_state_update_failed')
    return { status: 'failed', reason: 'local_state_update_failed' }
  }
  return writeLocal(spec, next, current.revision)
}

/** Remove a temp file an interrupted write left behind. Never called on the
 *  read path: a leftover temp is already ignored there, and deleting during a
 *  read would race a write that is still in progress. */
export function sweepTemp<T>(spec: LocalFile<T>): void {
  for (const f of [temp(spec), `${temp(spec)}.last-good`])
    try {
      if (existsSync(f)) unlinkSync(f)
    } catch {
      // A temp file we cannot remove is litter, not a fault.
    }
}
