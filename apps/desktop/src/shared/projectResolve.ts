// #region project-resolve — docs: docs/adr/0166-one-attribution-of-folders-to-projects-across-fabric-switchboard-and-observatory.md#decision
/**
 * `fabric.project.resolve` (F9, ADR-0166 §1, DEC-0089): which Project a folder belongs to, answered with the contract's
 * own rule set (`contract/folder-attribution`, vendored at the pinned commit; `pin.json`). Fabric keeps no rule of its
 * own here: it builds the snapshot the rules read from what it knows (the admitted folders and their Git facts, the
 * detached folders as tombstones, the platform's temporary roots) and returns the contract's answer as it is.
 *
 * Pure: the file system, Git and the store arrive as `ResolveDeps`, so the same function runs in tests and in main.
 */
import { attributeFolder, type Attribution } from './contract/folder-attribution/folder-attribution'

export interface GitFacts {
  toplevel: string
  commonDir: string
  origin: string | null
}

/** DEC-0092: the folder's Git facts could not be read (a probe failed or ran out of time), which is not "no Git". */
export interface GitUnreadable { unreadable: string }

/** `fabric.project.resolve`'s answer when the Git facts cannot be read yet (DEC-0092, `$defs/pending`): no Project is
 *  named, nothing is recorded, the caller asks again later. */
export const PENDING = Object.freeze({ outcome: 'pending', reason: 'git-unreadable', retryable: true } as const)
export type ResolveAnswer = Attribution | typeof PENDING

/** How long one resolve may take in all before it answers `pending` (0.3.7 review ER-6). */
export const RESOLVE_DEADLINE_MS = 8000

export interface ResolveDeps {
  admitted(): Promise<Array<{ projectId: string; path: string }>>
  detached(): Promise<Array<{ path: string | null }>>
  /** The folder's real path, or null when it does not exist on this computer. */
  realpath(folder: string): string | null | Promise<string | null>
  /** `git rev-parse --show-toplevel`, `--git-common-dir` (absolute) and `remote.origin.url`; null outside Git,
   *  `{unreadable}` when a probe failed or timed out. */
  git(folder: string): Promise<GitFacts | null | GitUnreadable>
  home: string
  /** The platform's temporary and cache roots that exist here (the schema's `tempRoots`). */
  tempRoots: string[]
  platform?: string
}

/** A path in the contract's form: absolute, `/`-separated, a Windows drive upper case, no trailing `/`. */
export function contractPath(p: string, platform: string = 'darwin'): string {
  let out = platform === 'win32' ? p.replace(/\\/g, '/') : p
  if (platform === 'win32' && /^[a-z]:\//.test(out)) out = out[0].toUpperCase() + out.slice(1)
  while (out.length > 1 && out.endsWith('/') && !/^[A-Z]:\/$/.test(out)) out = out.slice(0, -1)
  return out
}

/**
 * The main checkout of a repository: the folder above a `.git` common dir (the first entry of `git worktree list`), or
 * the common dir itself for a bare repository. A repository whose `.git` was moved elsewhere (`--separate-git-dir`) is
 * not read this way; its main checkout is then reported as the common dir's parent, which no rule of DEC-0089 compares
 * with a project folder.
 */
const mainCheckoutOf = (commonDir: string): string => (commonDir.endsWith('/.git') ? commonDir.slice(0, -'/.git'.length) : commonDir)

class GitUnreadableError extends Error {}

const gitOf = async (folder: string, d: ResolveDeps, platform: string) => {
  const g = await d.git(folder)
  if (g && 'unreadable' in g) throw new GitUnreadableError(`${folder}: ${g.unreadable}`)
  if (!g) return null
  const commonDir = contractPath(g.commonDir, platform)
  return { toplevel: contractPath(g.toplevel, platform), commonDir, mainCheckout: mainCheckoutOf(commonDir), origin: g.origin }
}

/** The snapshot of folder-attribution.schema.json `$defs/snapshot` for one folder, from Fabric's state. */
export async function folderSnapshot(folder: string, d: ResolveDeps): Promise<Record<string, unknown>> {
  const platform = d.platform ?? 'darwin'
  const byProject = new Map<string, Array<Record<string, unknown>>>()
  // The Projects' folders are probed side by side (0.3.7 review ER-6): one slow folder no longer adds to the next.
  const rows = await d.admitted()
  const facts = await Promise.all(rows.map((row) => gitOf(contractPath(row.path, platform), d, platform)))
  rows.forEach((row, i) => {
    const g = facts[i]
    const list = byProject.get(row.projectId) ?? []
    list.push({ path: contractPath(row.path, platform), commonDir: g?.commonDir ?? null, origin: g?.origin ?? null, toplevel: g?.toplevel ?? null })
    byProject.set(row.projectId, list)
  })
  const tombstones = [...new Set((await d.detached()).map((t) => t.path).filter((p): p is string => !!p).map((p) => contractPath(p, platform)))]
  return {
    folder,
    home: contractPath(d.home, platform),
    tempRoots: d.tempRoots.map((p) => contractPath(p, platform)),
    git: await gitOf(folder, d, platform),
    projects: [...byProject].map(([id, folders]) => ({ id, folders })),
    tombstones
  }
}

/** An absolute path for the platform: `/…` on POSIX; a drive (`C:\\` or `C:/`) or a UNC path on Windows. */
export function isAbsoluteFor(p: string, platform: string): boolean {
  if (platform === 'win32') return /^[A-Za-z]:[\\/]/.test(p) || /^[\\/]{2}[^\\/]/.test(p)
  return p.startsWith('/')
}

/**
 * The answer for one path, in folder-attribution.schema.json `$defs/resolveAnswer` (DEC-0092): the rules' answer, or
 * `pending` when a Git probe the snapshot needs (the folder's, or one of the Projects' folders') failed or timed out,
 * or when the whole resolve ran past `deadlineMs`. A relative path is `input-invalid`: it is never resolved against
 * Fabric's own working directory (0.3.7 review ER-6).
 */
export async function resolveProject(folder: unknown, d: ResolveDeps, opts: { deadlineMs?: number } = {}): Promise<ResolveAnswer> {
  const platform = d.platform ?? 'darwin'
  if (typeof folder !== 'string' || !folder || !isAbsoluteFor(folder, platform)) return { fault: 'input-invalid' } as Attribution
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<typeof PENDING>((resolve) => { timer = setTimeout(() => resolve(PENDING), opts.deadlineMs ?? RESOLVE_DEADLINE_MS) })
  const work = (async (): Promise<ResolveAnswer> => {
    const real = await d.realpath(folder)
    if (!real) return { fault: 'input-invalid' } as Attribution
    try {
      return attributeFolder(await folderSnapshot(contractPath(real, platform), d))
    } catch (e) {
      if (e instanceof GitUnreadableError) return PENDING
      throw e
    }
  })()
  // A probe that fails after the deadline has answered is not an unhandled rejection.
  work.catch(() => undefined)
  try {
    return await Promise.race([work, late])
  } finally {
    clearTimeout(timer)
  }
}
// #endregion project-resolve
