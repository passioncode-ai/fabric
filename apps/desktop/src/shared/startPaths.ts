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
  truncated: boolean
  cancelled: boolean
}

export interface ScanView extends Omit<ScanResult, 'candidates'> {
  candidates: CandidateView[]
  scannedAt: string
}

export type ExecutorState = 'found' | 'unresponsive' | 'missing'
export interface ExecutorRow {
  id: string
  label: string
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
export type NewFolderResult =
  | { ok: true; path: string }
  | { ok: false; reason: 'exists' | 'invalid-name' | 'outside' | 'failed'; detail?: string }

/** A folder name the create path accepts: no separators, no leading dot, no control characters, ≤ 80. */
export function folderNameProblem(name: string): string | null {
  const s = name.trim()
  if (!s) return 'empty'
  if (s.length > 80) return 'too long'
  if (s === '.' || s === '..' || s.startsWith('.')) return 'starts with a dot'
  if (/[/\\:\u0000-\u001f\u007f]/.test(s)) return 'contains a separator or control character'
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
