// #region start-paths — docs: docs/adr/0100-first-run-and-start-paths.md#decision
// The shapes of the first run and the start paths (ADR-0100): what the renderer is told about a
// folder, a scan and the coding agents on this machine. ONE definition (R-005): the main-process
// modules `projectDiscovery.ts` and `executorDetect.ts` produce exactly these.

export type FolderKind = 'repository' | 'worktree' | 'folder'

export interface FolderFacts {
  path: string
  name: string
  git: boolean
  kind: FolderKind
  /** The repository a worktree belongs to; null otherwise. */
  parent: string | null
  branch: string | null
  remote: string | null
  lastCommit: { at: string; subject: string } | null
  stack: string[]
}

export interface Candidate extends FolderFacts {
  /** The product this candidate belongs to: itself, its repository (a worktree), or its enclosing repository (nested). */
  group: string
}

/** A folder or candidate as the renderer sees it: with the projects that already hold it. */
export interface FolderView extends FolderFacts {
  importedBy: { id: string; name: string }[]
}
export interface CandidateView extends Candidate {
  importedBy: { id: string; name: string }[]
}

export interface ScanResult {
  root: string
  candidates: Candidate[]
  visited: number
  /** Folders that could not be read (permission, a hung mount): the list may miss what is under them. */
  unreadable: number
  /** Folders below the depth limit that were not entered. */
  deep: number
  /** Symlinked folders the walk did not follow (it never leaves the chosen folder through a link). */
  symlinks: number
  truncated: boolean
  cancelled: boolean
}

/**
 * A scan as the renderer sees it. Main always sends `symlinks` (`scanFolder`, `parseStoredScan`); it is
 * optional on the VIEW only because the renderer's own fixtures predate the field, and a renderer reading
 * it must treat a missing value as unknown rather than as zero.
 */
export interface ScanView extends Omit<ScanResult, 'candidates' | 'symlinks'> {
  candidates: CandidateView[]
  scannedAt: string
  symlinks?: number
}

/**
 * A kept scan read back from disk (`main/startPaths.ts`), or null when it is not one. Counts that are
 * missing read as 0; a missing `truncated` reads as TRUE — "nobody recorded it" must never read as "this
 * is the whole folder"; a kept scan is never `cancelled` (a cancelled one is not kept).
 */
export function parseStoredScan(v: unknown): (ScanResult & { scannedAt: string }) | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const r = v as Record<string, unknown>
  if (typeof r.root !== 'string' || typeof r.scannedAt !== 'string' || !Array.isArray(r.candidates)) return null
  const candidates = r.candidates.filter(
    (c): c is Candidate => !!c && typeof c === 'object' && typeof (c as Candidate).path === 'string' && typeof (c as Candidate).group === 'string' && typeof (c as Candidate).name === 'string'
  )
  const count = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0)
  return {
    root: r.root,
    scannedAt: r.scannedAt,
    candidates,
    visited: count(r.visited),
    unreadable: count(r.unreadable),
    deep: count(r.deep),
    symlinks: count(r.symlinks),
    truncated: typeof r.truncated === 'boolean' ? r.truncated : true,
    cancelled: false
  }
}

export type ExecutorState = 'found' | 'unresponsive' | 'missing'
export interface ExecutorRow {
  id: string
  label: string
  /** Fabric's own tools reach a session of this agent. Found but not connected runs in the folder as itself. */
  connected: boolean
  state: ExecutorState
  version: string | null
  path: string | null
  install: string | null
}

/** A new project's folder: created under a parent the operator chose, optionally as a git repository. */
export interface NewFolderInput {
  parent: string
  name: string
  git: boolean
}
/**
 * `detail` by reason: `invalid-name` → a `FolderNameProblem` code; `outside` → `'parent-not-chosen'` (a code,
 * never English text, so each window says it in its own language); `exists` → the folder's path;
 * `failed` → the system's own message (a git init timeout reads "git init timed out after N s").
 */
export type NewFolderResult =
  | { ok: true; path: string }
  | { ok: false; reason: 'exists' | 'invalid-name' | 'outside' | 'failed'; detail?: string }
/** The one `detail` an `outside` refusal carries. */
export type NewFolderOutsideDetail = 'parent-not-chosen'

/** Why a name cannot be a folder: a code, so each window says it in its own language. */
export type FolderNameProblem = 'not-a-name' | 'empty' | 'too-long' | 'leading-dot' | 'separator' | 'text-direction'

/**
 * A folder name the create path accepts: a string; no separators, no leading dot, ≤ 80 characters; no
 * control characters and no bidirectional overrides (U+202A–U+202E, U+2066–U+2069), which make a name
 * read differently from what it is (`evil\u202Etxt.exe`).
 */
export function folderNameProblem(name: unknown): FolderNameProblem | null {
  if (typeof name !== 'string') return 'not-a-name'
  const s = name.trim()
  if (!s) return 'empty'
  if (s.length > 80) return 'too-long'
  if (s === '.' || s === '..' || s.startsWith('.')) return 'leading-dot'
  if (/[/\\:\u0000-\u001f\u007f]/.test(s)) return 'separator'
  if (/[\u202a-\u202e\u2066-\u2069]/.test(s)) return 'text-direction'
  return null
}

/** Group candidates by product for the checklist, groups ordered by their newest commit. */
export function groupCandidates<T extends Candidate>(candidates: readonly T[]): { group: string; items: T[] }[] {
  const map = new Map<string, T[]>()
  for (const c of candidates) map.set(c.group, [...(map.get(c.group) ?? []), c])
  const newest = (items: T[]): string => items.map((i) => i.lastCommit?.at ?? '').sort().pop() ?? ''
  return [...map.entries()]
    .map(([group, items]) => ({ group, items: items.sort((a, b) => (a.path === group ? -1 : b.path === group ? 1 : a.path.localeCompare(b.path))) }))
    .sort((a, b) => newest(b.items).localeCompare(newest(a.items)) || a.group.localeCompare(b.group))
}
// #endregion start-paths
