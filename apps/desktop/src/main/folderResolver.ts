// #region folder-resolver — docs: docs/adr/0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md#decision
// Which Project a folder belongs to (ADR-0136 §1): exact real path, longest admitted ancestor, the main repository of
// a worktree, then normalized remote identity. A tie is ambiguity, never a guess. Paths are compared after the
// caller's realpath; repository reads are bounded and credentials in remote userinfo never become identity.
import { createHash } from 'node:crypto'
import path from 'node:path'
import { execFile } from 'node:child_process'

export interface AdmittedFolder {
  projectId: string
  /** The admitted folder's real path, as `project_repos.path` holds it. */
  path: string
  /** `host/owner/name`, normalized by `normalizeRemoteKey`; null for a local-only repository or legacy row. */
  remoteKey?: string | null
  kind?: 'primary' | 'checkout' | 'worktree'
}

export interface DetachedFolder {
  id?: string
  projectId?: string
  path: string | null
  remoteKey?: string | null
  kind?: 'primary' | 'checkout' | 'worktree' | null
}

export type FolderMatch =
  | { projectId: string; how: 'exact' | 'ancestor' | 'worktree' | 'remote'; root: string; remoteKey?: string }
  | { projectId: null; how: 'none'; root: null }
  | { projectId: null; how: 'ambiguous'; root: null; candidates: string[]; remoteKey?: string }

/** How long the worktree and remote probes may take before their answers are "no match". */
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

function keyPath(host: string, rawPath: string): string | null {
  let name = rawPath.replace(/^\/+/, '').replace(/\/+$/, '')
  if (name.toLowerCase().endsWith('.git')) name = name.slice(0, -4)
  return name ? `${host.toLowerCase()}/${name}` : null
}

/** `host/owner/name` for a remote that can name a repository across clones. scp form folds into the URL form;
 *  userinfo (including tokens), query and fragment never survive. Local paths and unsupported schemes return null. */
export function normalizeRemoteKey(raw: string | null): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const value = raw.trim()
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    let url: URL
    try { url = new URL(value) } catch { return null }
    if (!['http', 'https', 'ssh', 'git', 'git+ssh', 'git+https'].includes(url.protocol.slice(0, -1).toLowerCase())) return null
    return url.host ? keyPath(url.host, url.pathname) : null
  }
  // scp syntax: [user@]host:owner/name. A Windows drive or POSIX path is not a remote.
  if (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)) return null
  const scp = /^(?:[^@/\s]+@)?([^:/\s]+):(.+)$/.exec(value)
  return scp ? keyPath(scp[1], scp[2]) : null
}

/** A stable id for a proposed Project, before it exists. Version 8 marks a custom name-based id; the folder itself
 *  is never exposed by this derivation. The estate id keeps equal paths in different estates distinct. */
export function folderProjectId(estateId: string, root: string): string {
  const bytes = createHash('sha256').update(`fabric-project-folder-v1\0${estateId}\0${root}`, 'utf8').digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x80
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
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

/** The longest admitted folder match and every Project tied at that length. */
function longestAncestor(folder: string, rows: readonly AdmittedFolder[]): { row: AdmittedFolder | null; candidates: string[] } {
  let best: AdmittedFolder | null = null
  let candidates = new Set<string>()
  for (const raw of rows) {
    const row = { ...raw, path: bare(raw.path) }
    if (!within(folder, row.path)) continue
    if (!best || row.path.length > best.path.length) {
      best = row
      candidates = new Set([row.projectId])
    } else if (row.path.length === best.path.length) candidates.add(row.projectId)
  }
  return { row: best, candidates: [...candidates].sort() }
}

const ambiguous = (candidates: string[], remoteKey?: string): FolderMatch => ({ projectId: null, how: 'ambiguous', root: null, candidates, ...(remoteKey ? { remoteKey } : {}) })

async function withRemoteKeys(rows: readonly AdmittedFolder[], remoteOf: (folder: string) => Promise<string | null>): Promise<AdmittedFolder[]> {
  const out = new Array<AdmittedFolder>(rows.length)
  let next = 0
  const workers = Array.from({ length: Math.min(4, rows.length) }, async () => {
    while (next < rows.length) {
      const index = next++
      const row = rows[index]
      out[index] = { ...row, remoteKey: row.remoteKey ?? normalizeRemoteKey(await remoteOf(row.path)) }
    }
  })
  await Promise.all(workers)
  return out
}

export async function resolveProjectForFolder(
  folder: string,
  rows: readonly AdmittedFolder[],
  commonDir: (folder: string) => Promise<string | null> | string | null = gitCommonDir,
  remoteOf: (folder: string) => Promise<string | null> = async () => null
): Promise<FolderMatch> {
  if (!folder || !path.isAbsolute(folder)) throw new Error(`a folder to resolve must be absolute, not ${JSON.stringify(folder)}`)
  const own = longestAncestor(folder, rows)
  if (own.candidates.length > 1) return ambiguous(own.candidates)
  if (own.row) return { projectId: own.row.projectId, how: own.row.path === bare(folder) ? 'exact' : 'ancestor', root: own.row.path }
  // A worktree lives outside its repository: its common .git directory names the repository it belongs to.
  const common = await commonDir(folder)
  if (common && path.basename(common) === '.git') {
    const repo = longestAncestor(path.dirname(common), rows)
    if (repo.candidates.length > 1) return ambiguous(repo.candidates)
    if (repo.row) return { projectId: repo.row.projectId, how: 'worktree', root: repo.row.path }
  }
  const remoteKey = normalizeRemoteKey(await remoteOf(folder))
  if (!remoteKey) return { projectId: null, how: 'none', root: null }
  const candidates = new Set<string>()
  const matched: AdmittedFolder[] = []
  for (const row of await withRemoteKeys(rows, remoteOf)) {
    if (row.remoteKey !== remoteKey) continue
    matched.push(row)
    candidates.add(row.projectId)
  }
  const projects = [...candidates].sort()
  if (projects.length > 1) return ambiguous(projects, remoteKey)
  if (projects.length === 1) return { projectId: projects[0], how: 'remote', root: matched[0].path, remoteKey }
  return { projectId: null, how: 'none', root: null }
}
// #endregion folder-resolver
