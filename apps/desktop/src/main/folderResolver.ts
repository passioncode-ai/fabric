// #region folder-resolver — docs: docs/adr/0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md#decision
// Which Project a folder belongs to (ADR-0136 §1). Wave 1's core: the exact admitted path, the longest admitted
// ancestor, the main repository of a worktree. A folder none of them holds is attributed by `decideAttribution`
// (ADR-0164): by the normalized remote, the owner, a sibling of the asking agent's project, or as a new project — the
// remote is read when it is needed, never stored. Paths are compared after the caller's realpath; this module never
// touches the filesystem except through the injected git probes.
import path from 'node:path'
import { execFile } from 'node:child_process'
import { remoteKey } from '../shared/workClaims.ts'

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

/** One bounded `git rev-parse` in a folder: its trimmed answer, or null when git refuses, is absent or is too slow. */
function revParse(folder: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('git', ['-C', folder, 'rev-parse', ...args], {
      encoding: 'utf8',
      timeout: GIT_PROBE_MS,
      windowsHide: true
    }, (error, stdout) => {
      // Not a git folder, git absent or the probe timed out: that is the answer (none), not a failure to report.
      if (error) return resolve(null)
      const out = String(stdout).trim()
      resolve(out ? out : null)
    })
  })
}

/** The `.git` directory a worktree belongs to, or null. Asynchronous: it runs in Fabric's main process, which must
 *  not stall on a slow disk or a hung git (bounded at GIT_PROBE_MS). Never rejects. */
export function gitCommonDir(folder: string): Promise<string | null> {
  return revParse(folder, ['--path-format=absolute', '--git-common-dir'])
}

/** The top level of the git checkout a folder is in, or null outside one (ADR-0164). Bounded and never rejects, as
 *  `gitCommonDir`. */
export function gitTopLevel(folder: string): Promise<string | null> {
  return revParse(folder, ['--show-toplevel'])
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

// #region folder-attribution — docs: docs/adr/0164-a-folder-with-no-project-is-attributed-by-fabric-never-handed-to-the-person.md#decision
export type AttributionCause = 'same-remote' | 'owner' | 'sibling' | 'new-project'
export type AttributionRefusal = 'too-broad' | 'not-a-repository' | 'contains-projects'
export type AttributionDecision =
  | { act: 'attach'; projectId: string; root: string; cause: Exclude<AttributionCause, 'new-project'>; remoteKey: string | null }
  | { act: 'create'; root: string; name: string; cause: 'new-project'; remoteKey: string | null }
  | { act: 'refuse'; reason: AttributionRefusal; message: string }

/** What attribution reads of the disk, injected so the decision is testable without one. */
export interface AttributionProbes {
  /** The top level of the checkout a folder is in (`gitTopLevel`), or null. */
  topLevel(folder: string): Promise<string | null> | string | null
  /** The common `.git` directory (`gitCommonDir`), or null. */
  commonDir(folder: string): Promise<string | null> | string | null
  /** A repository's `origin` URL, or null when it has none or it could not be read. */
  origin(repoPath: string): Promise<string | null> | string | null
  /** A filesystem root, the home folder or a folder above it (`files.ts#isTooBroad`). */
  tooBroad(folder: string): boolean
  /** A path git answered, as its real path (symlinks resolved); absent, as answered. */
  realpath?(p: string): string | null
}

/** Said to the agent when Fabric will not attribute a folder. The next step is the agent's, never the person's. */
export const ATTRIBUTION_REFUSED: Record<AttributionRefusal, string> = {
  'too-broad': 'Fabric does not attribute this folder to a project: it is too broad (a filesystem root, the home folder or a folder above it, or a checkout rooted there). Work inside one repository and call fabric_whoami again.',
  'not-a-repository': 'Fabric does not attribute this folder to a project: it is not inside a git repository, and Fabric makes a project only of a repository. Run git init here, or work inside a repository, and call fabric_whoami again.',
  'contains-projects': 'Fabric does not attribute this folder to a project: it holds folders of projects Fabric already has, and a project is never made around other projects. Work inside one of those folders, or inside one repository, and call fabric_whoami again.'
}

/** `host/owner` of a remote key (`host/owner/name`). */
function ownerOf(key: string): string {
  return key.slice(0, key.lastIndexOf('/'))
}

/** The one element of a set, or null when it holds none or several (a tie is no answer, never a guess). */
function only<T>(set: ReadonlySet<T>): T | null {
  return set.size === 1 ? [...set][0] : null
}

/** A project's name read from its folder: the folder's own name, without control or direction characters. */
function nameFor(root: string): string {
  const raw = path.basename(root).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim()
  return raw || 'project'
}

/**
 * Where a folder that no project holds goes (ADR-0164 §1–§3), in order, the first single answer winning:
 * 1. refused when it is too broad, outside every git repository, or holds other projects' folders;
 * 2. `same-remote` — the one project holding a repository with the same normalized origin;
 * 3. for an agent already working in projects (`askerProjects`): `sibling` — its project is the only one with folders
 *    in this checkout's parent folder; `owner` — its only project with a repository of the same remote owner;
 * 4. `owner` — the only project in the estate with a repository of that owner;
 * 5. `new-project` — a new project rooted at the checkout's top level (a worktree's main checkout), named after it.
 * Two projects matching at one step is a tie, which that step leaves unanswered. Called only for a folder
 * `resolveProjectForFolder` matched to no project. `joinable` says which projects may take a folder (an archived one
 * may not); every admitted folder still counts for "holds other projects' folders".
 */
export async function decideAttribution(
  folder: string,
  rows: readonly AdmittedFolder[],
  askerProjects: readonly string[],
  probes: AttributionProbes,
  joinable: (projectId: string) => boolean = () => true
): Promise<AttributionDecision> {
  if (!folder || !path.isAbsolute(folder)) throw new Error(`a folder to attribute must be absolute, not ${JSON.stringify(folder)}`)
  const refuse = (reason: AttributionRefusal): AttributionDecision => ({ act: 'refuse', reason, message: ATTRIBUTION_REFUSED[reason] })
  const real = (p: string): string => bare(probes.realpath?.(p) ?? p)
  if (probes.tooBroad(folder)) return refuse('too-broad')
  const top = await probes.topLevel(folder)
  if (!top) return refuse('not-a-repository')
  let root = real(top)
  // A worktree's project is its main checkout's: the worktree itself then resolves to it through its common .git.
  const common = await probes.commonDir(folder)
  if (common && path.basename(common) === '.git' && real(path.dirname(common)) !== root) root = real(path.dirname(common))
  if (probes.tooBroad(root)) return refuse('too-broad')
  const held = rows.map((r) => ({ projectId: r.projectId, path: bare(r.path) }))
  if (held.some((r) => r.path !== root && within(r.path, root))) return refuse('contains-projects')

  const keyOf = async (p: string): Promise<string | null> => {
    const url = await probes.origin(p)
    return url ? remoteKey(url) : null
  }
  const key = await keyOf(root)
  const open = held.filter((r) => joinable(r.projectId))
  const keyed = key ? await Promise.all(open.map(async (r) => ({ ...r, key: await keyOf(r.path) }))) : []

  if (key) {
    const same = only(new Set(keyed.filter((r) => r.key === key).map((r) => r.projectId)))
    if (same) return { act: 'attach', projectId: same, root, cause: 'same-remote', remoteKey: key }
  }
  const asker = new Set(askerProjects)
  if (asker.size > 0) {
    const parent = path.dirname(root)
    if (parent !== root && !probes.tooBroad(parent)) {
      const sibling = only(new Set(open.filter((r) => path.dirname(r.path) === parent).map((r) => r.projectId)))
      if (sibling && asker.has(sibling)) return { act: 'attach', projectId: sibling, root, cause: 'sibling', remoteKey: key }
    }
    if (key) {
      const mine = only(new Set(keyed.filter((r) => asker.has(r.projectId) && r.key && ownerOf(r.key) === ownerOf(key)).map((r) => r.projectId)))
      if (mine) return { act: 'attach', projectId: mine, root, cause: 'owner', remoteKey: key }
    }
  }
  if (key) {
    const owner = only(new Set(keyed.filter((r) => r.key && ownerOf(r.key) === ownerOf(key)).map((r) => r.projectId)))
    if (owner) return { act: 'attach', projectId: owner, root, cause: 'owner', remoteKey: key }
  }
  return { act: 'create', root, name: nameFor(root), cause: 'new-project', remoteKey: key }
}
// #endregion folder-attribution
