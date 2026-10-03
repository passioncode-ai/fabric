// #region start-paths-main — docs: docs/adr/0100-first-run-and-start-paths.md#decision
/**
 * The main-process half of the start paths (ADR-0100): the last scan, kept so
 * unticked candidates stay visible later (SCN-128). The new project's folder is
 * `projectFolder.ts`.
 *
 * The last scan is a preference of this machine, like the persona: a list of
 * paths on this disk means nothing on another one, so it is not journalled.
 *
 * A new project's folder is created only under a parent the operator chose in
 * this window — the caller resolves the parent against the window's granted
 * roots, and a parent outside them is refused here as `outside`, never created.
 */

import { localStore } from './localStore.ts'
import type { Candidate, ScanResult } from '../shared/startPaths.ts'

export interface StoredScan extends ScanResult { scannedAt: string }

function validateScan(v: unknown): StoredScan | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const r = v as Record<string, unknown>
  if (typeof r.root !== 'string' || typeof r.scannedAt !== 'string' || !Array.isArray(r.candidates)) return null
  const candidates = r.candidates.filter(
    (c): c is Candidate => !!c && typeof c === 'object' && typeof (c as Candidate).path === 'string' && typeof (c as Candidate).group === 'string' && typeof (c as Candidate).name === 'string'
  )
  return {
    root: r.root,
    scannedAt: r.scannedAt,
    candidates,
    visited: typeof r.visited === 'number' ? r.visited : 0,
    unreadable: typeof r.unreadable === 'number' ? r.unreadable : 0,
    deep: typeof r.deep === 'number' ? r.deep : 0,
    // A kept scan that does not say whether it was cut is read as cut: "nobody recorded it" must never
    // read as "this is the whole folder".
    truncated: typeof r.truncated === 'boolean' ? r.truncated : true,
    cancelled: false
  }
}

const EMPTY: StoredScan = { root: '', scannedAt: '', candidates: [], visited: 0, unreadable: 0, deep: 0, truncated: false, cancelled: false }
const scans = localStore<StoredScan>('last-scan.json', EMPTY, validateScan)

/** The last completed scan, or null when none was kept. */
export function lastScan(): StoredScan | null {
  const v = scans.read().value
  return v.root ? v : null
}

/** Keep a completed scan; a cancelled one is never kept, because it is not the folder's contents. */
export function keepScan(result: ScanResult, now: Date = new Date()): StoredScan | null {
  if (result.cancelled) return null
  const stored: StoredScan = { ...result, scannedAt: now.toISOString() }
  const current = scans.read()
  const w = scans.write(stored, current.revision)
  return w.status === 'committed' ? stored : null
}

// #endregion start-paths-main
