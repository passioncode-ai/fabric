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

export interface ResolveDeps {
  admitted(): Promise<Array<{ projectId: string; path: string }>>
  detached(): Promise<Array<{ path: string | null }>>
  /** The folder's real path, or null when it does not exist on this computer. */
  realpath(folder: string): string | null
  /** `git rev-parse --show-toplevel`, `--git-common-dir` (absolute) and `remote.origin.url`; null outside Git. */
  git(folder: string): Promise<GitFacts | null>
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

const gitOf = async (folder: string, d: ResolveDeps, platform: string) => {
  const g = await d.git(folder)
  if (!g) return null
  const commonDir = contractPath(g.commonDir, platform)
  return { toplevel: contractPath(g.toplevel, platform), commonDir, mainCheckout: mainCheckoutOf(commonDir), origin: g.origin }
}

/** The snapshot of folder-attribution.schema.json `$defs/snapshot` for one folder, from Fabric's state. */
export async function folderSnapshot(folder: string, d: ResolveDeps): Promise<Record<string, unknown>> {
  const platform = d.platform ?? 'darwin'
  const byProject = new Map<string, Array<Record<string, unknown>>>()
  for (const row of await d.admitted()) {
    const p = contractPath(row.path, platform)
    const g = await gitOf(p, d, platform)
    const list = byProject.get(row.projectId) ?? []
    list.push({ path: p, commonDir: g?.commonDir ?? null, origin: g?.origin ?? null, toplevel: g?.toplevel ?? null })
    byProject.set(row.projectId, list)
  }
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

/** The answer for one path, in folder-attribution.schema.json `$defs/answer`. */
export async function resolveProject(folder: unknown, d: ResolveDeps): Promise<Attribution> {
  if (typeof folder !== 'string' || !folder) return { fault: 'input-invalid' } as Attribution
  const real = d.realpath(folder)
  if (!real) return { fault: 'input-invalid' } as Attribution
  return attributeFolder(await folderSnapshot(contractPath(real, d.platform ?? 'darwin'), d))
}
// #endregion project-resolve
