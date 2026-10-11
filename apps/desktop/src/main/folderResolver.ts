// #region folder-resolver — docs: docs/adr/0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md#decision
// Which Project a folder belongs to (ADR-0136 §1). Wave 1's core: the exact admitted path, the longest admitted
// ancestor, the main repository of a worktree. The normalized remote and Observatory's suggestion join in wave 2,
// with the migration that stores the remote. Paths are compared after the caller's realpath; this module never
// touches the filesystem except through the injected git probe.
import path from 'node:path'
import { execFile } from 'node:child_process'

export interface AdmittedFolder {
  projectId: string
  /** The admitted folder's real path, as `project_repos.path` holds it. */
  path: string
}

export type FolderMatch =
  | { projectId: string; how: 'exact' | 'ancestor' | 'worktree'; root: string }
  | { projectId: null; how: 'none'; root: null }

/** How long the worktree probe may take before its answer is "no worktree". */
export const GIT_PROBE_MS = 3000

/** The `.git` directory a worktree belongs to, or null. Asynchronous: it runs in Fabric's main process, which must
 *  not stall on a slow disk or a hung git (bounded at GIT_PROBE_MS). Never rejects. */
export function gitCommonDir(folder: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('git', ['-C', folder, 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8',
      timeout: GIT_PROBE_MS,
      windowsHide: true
    }, (error, stdout) => {
      // Not a git folder, git absent or the probe timed out: that is the answer (no worktree), not a failure to report.
      if (error) return resolve(null)
      const out = String(stdout).trim()
      resolve(out ? out : null)
    })
  })
}

/** A path without trailing separators (a filesystem root keeps its own). */
function bare(p: string): string {
  const root = path.parse(p).root
  let s = p
  while (s.length > root.length && (s.endsWith('/') || s.endsWith(path.sep))) s = s.slice(0, -1)
  return s
}

/** Whether `folder` is `root` or inside it. `..cache` is a name inside the root, not a step out of it: only `..`
 *  itself, or `..` followed by a separator, leaves. */
function within(folder: string, root: string): boolean {
  const rel = path.relative(root, folder)
  if (rel === '') return true
  if (path.isAbsolute(rel)) return false
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !rel.startsWith('../')
}

/** The longest admitted folder that is `folder` or contains it. */
function longestAncestor(folder: string, rows: readonly AdmittedFolder[]): AdmittedFolder | null {
  let best: AdmittedFolder | null = null
  for (const raw of rows) {
    const row = { projectId: raw.projectId, path: bare(raw.path) }
    if (within(folder, row.path) && (!best || row.path.length > best.path.length)) best = row
  }
  return best
}

export async function resolveProjectForFolder(
  folder: string,
  rows: readonly AdmittedFolder[],
  commonDir: (folder: string) => Promise<string | null> | string | null = gitCommonDir
): Promise<FolderMatch> {
  if (!folder || !path.isAbsolute(folder)) throw new Error(`a folder to resolve must be absolute, not ${JSON.stringify(folder)}`)
  const own = longestAncestor(folder, rows)
  if (own) return { projectId: own.projectId, how: own.path === bare(folder) ? 'exact' : 'ancestor', root: own.path }
  // A worktree lives outside its repository: its common .git directory names the repository it belongs to.
  const common = await commonDir(folder)
  if (common && path.basename(common) === '.git') {
    const repo = longestAncestor(path.dirname(common), rows)
    if (repo) return { projectId: repo.projectId, how: 'worktree', root: repo.path }
  }
  return { projectId: null, how: 'none', root: null }
}
// #endregion folder-resolver
