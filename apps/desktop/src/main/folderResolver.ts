// #region folder-resolver — docs: docs/adr/0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md#decision
// Which Project a folder belongs to (ADR-0136 §1). Wave 1's core: the exact admitted path, the longest admitted
// ancestor, the main repository of a worktree. The normalized remote and Observatory's suggestion join in wave 2,
// with the migration that stores the remote. Paths are compared after the caller's realpath; this module never
// touches the filesystem except through the injected git probe.
import path from 'node:path'
import { execFileSync } from 'node:child_process'

export interface AdmittedFolder {
  projectId: string
  /** The admitted folder's real path, as `project_repos.path` holds it. */
  path: string
}

export type FolderMatch =
  | { projectId: string; how: 'exact' | 'ancestor' | 'worktree'; root: string }
  | { projectId: null; how: 'none'; root: null }

/** The `.git` directory a worktree belongs to, or null. Bounded; never throws. */
export function gitCommonDir(folder: string): string | null {
  try {
    const out = execFileSync('git', ['-C', folder, 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    }).trim()
    return out ? out : null
  } catch {
    return null
  }
}

function within(folder: string, root: string): boolean {
  const rel = path.relative(root, folder)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/** The longest admitted folder that is `folder` or contains it. */
function longestAncestor(folder: string, rows: readonly AdmittedFolder[]): AdmittedFolder | null {
  let best: AdmittedFolder | null = null
  for (const row of rows) if (within(folder, row.path) && (!best || row.path.length > best.path.length)) best = row
  return best
}

export function resolveProjectForFolder(
  folder: string,
  rows: readonly AdmittedFolder[],
  commonDir: (folder: string) => string | null = gitCommonDir
): FolderMatch {
  if (!folder || !path.isAbsolute(folder)) throw new Error(`a folder to resolve must be absolute, not ${JSON.stringify(folder)}`)
  const own = longestAncestor(folder, rows)
  if (own) return { projectId: own.projectId, how: own.path === folder ? 'exact' : 'ancestor', root: own.path }
  // A worktree lives outside its repository: its common .git directory names the repository it belongs to.
  const common = commonDir(folder)
  if (common && path.basename(common) === '.git') {
    const repo = longestAncestor(path.dirname(common), rows)
    if (repo) return { projectId: repo.projectId, how: 'worktree', root: repo.path }
  }
  return { projectId: null, how: 'none', root: null }
}
// #endregion folder-resolver
