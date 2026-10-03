// #region start-paths-main — docs: docs/adr/0100-first-run-and-start-paths.md#decision
/**
 * The main-process half of the start paths (ADR-0100): the last scan, kept so
 * unticked candidates stay importable later (SCN-128), and the folder a new
 * project is created in (SCN-129).
 *
 * The last scan is a preference of this machine, like the persona: a list of
 * paths on this disk means nothing on another one, so it is not journalled.
 *
 * A new project's folder is created only under a parent the operator chose in
 * this window — the caller resolves the parent against the window's granted
 * roots, and a parent outside them is refused here as `outside`, never created.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { localStore } from './localStore.ts'
import { folderNameProblem, type Candidate, type NewFolderInput, type NewFolderResult, type ScanResult } from '../shared/startPaths.ts'

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
    // A kept scan that does not say whether it was cut is read as cut: "nobody recorded it" must never
    // read as "this is the whole folder".
    truncated: typeof r.truncated === 'boolean' ? r.truncated : true,
    cancelled: false
  }
}

const EMPTY: StoredScan = { root: '', scannedAt: '', candidates: [], visited: 0, truncated: false, cancelled: false }
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

/**
 * Create a new project's folder. `resolveParent` is the window's root check:
 * it returns the resolved parent or throws when the parent is outside what the
 * operator opened.
 */
export function createProjectFolder(input: NewFolderInput, resolveParent: (p: string) => string): NewFolderResult {
  const problem = folderNameProblem(input.name)
  if (problem) return { ok: false, reason: 'invalid-name', detail: problem }
  let parent: string
  try {
    parent = resolveParent(input.parent)
  } catch (e) {
    return { ok: false, reason: 'outside', detail: e instanceof Error ? e.message : String(e) }
  }
  const target = path.join(parent, input.name.trim())
  if (existsSync(target)) return { ok: false, reason: 'exists', detail: target }
  try {
    mkdirSync(target)
    if (input.git) execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: target, stdio: 'ignore', timeout: 10000 })
    return { ok: true, path: target }
  } catch (e) {
    return { ok: false, reason: 'failed', detail: e instanceof Error ? e.message : String(e) }
  }
}
// #endregion start-paths-main
