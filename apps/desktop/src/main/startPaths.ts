// #region start-paths-main — docs: docs/ux/scenarios.md#scn-128-scan-a-projects-folder-and-tick-what-becomes-a-project
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
import { parseStoredScan, type ScanResult } from '../shared/startPaths.ts'

export interface StoredScan extends ScanResult { scannedAt: string }

/**
 * A kept scan as read back: every count (`visited`, `unreadable`, `deep`, `symlinks`) validated, a missing
 * `truncated` read as cut. The rule lives in `shared/startPaths.ts#parseStoredScan`, where it is tested
 * without Electron.
 */
function validateScan(v: unknown): StoredScan | null {
  return parseStoredScan(v)
}

const EMPTY: StoredScan = { root: '', scannedAt: '', candidates: [], visited: 0, unreadable: 0, deep: 0, symlinks: 0, truncated: false, cancelled: false }
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
