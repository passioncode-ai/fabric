// #region start-choices — docs: docs/adr/0100-first-run-and-start-paths.md#decision
/**
 * What a window chose in the start paths' folder picker (ADR-0100), kept apart from `index.ts` so it
 * is tested without Electron.
 *
 * A folder chosen as the PARENT of a new project is not opened: the window may create new project
 * folders directly in it, and nothing else — not read it, not list it, not write into anything already
 * there (iteration 1 found the parent's whole tree had become readable and writable). The choice is
 * REUSABLE while the window lives: the operator may make a folder, remove it from the form, and make
 * another without picking the parent again; each folder made is granted to the window on its own. The
 * choice belongs to the window that made it and is revoked with that window, like its granted roots
 * (S02.roots); iteration 2 found the revocation was claimed in a comment and never done.
 */
import { realpathSync, statSync } from 'node:fs'
import path from 'node:path'
import { OutsideRoots } from './files.ts'

export type PickPurpose = 'project' | 'scan' | 'parent'

export class ParentChoices {
  private readonly byScope = new Map<string, Set<string>>()

  /** Records a picked parent by its real path; a folder that vanished since the picker is not recorded. */
  record(scope: string, picked: string): string | null {
    let real: string
    try {
      real = realpathSync(path.resolve(picked))
    } catch {
      // Not silence: the caller treats null as "not offered as a parent" and the picker simply returns.
      return null
    }
    const set = this.byScope.get(scope) ?? new Set<string>()
    set.add(real)
    this.byScope.set(scope, set)
    return real
  }

  /** The parent as this window may use it: its own recorded choice, else whatever its roots allow. */
  resolve(scope: string, p: string, roots: (p: string) => string): string {
    let real: string
    try {
      real = realpathSync(path.resolve(p))
    } catch {
      throw new OutsideRoots(p)
    }
    if (this.byScope.get(scope)?.has(real)) return real
    return roots(p)
  }

  revoke(scope: string): void {
    this.byScope.delete(scope)
  }
}

// #region scan-candidates — docs: docs/ux/scenarios.md#scn-128-scan-a-projects-folder-and-tick-what-becomes-a-project
/**
 * The repositories main itself listed for a window: the candidates of its most recent scan, and of the
 * kept scan it was shown (ADR-0100 §3: "adding from it later goes through the checked create"). Each
 * slot is REPLACED by the next listing of its kind, and both end with the window, like its roots and its
 * parent choices. Paths are held by their real path.
 */
export type CandidateSlot = 'scan' | 'kept'
export class ScanCandidates {
  private readonly byScope = new Map<string, Record<CandidateSlot, Set<string>>>()

  record(scope: string, slot: CandidateSlot, paths: readonly string[]): void {
    const set = new Set<string>()
    for (const p of paths) {
      try {
        set.add(realpathSync(path.resolve(p)))
      } catch {
        // A candidate that vanished since the scan cannot be added anyway; it is simply not admitted.
      }
    }
    const slots = this.byScope.get(scope) ?? { scan: new Set<string>(), kept: new Set<string>() }
    slots[slot] = set
    this.byScope.set(scope, slots)
  }

  has(scope: string, real: string): boolean {
    const slots = this.byScope.get(scope)
    return !!slots && (slots.scan.has(real) || slots.kept.has(real))
  }

  revoke(scope: string): void {
    this.byScope.delete(scope)
  }
}

/** Why a repository path was refused: a code, so each window can say it in its own language. */
export type RepoPathRefusal = 'not-a-path' | 'missing' | 'not-a-folder' | 'not-chosen'
export class RepoPathRefused extends Error {
  readonly code: RepoPathRefusal
  readonly attempted: string
  constructor(code: RepoPathRefusal, attempted: string) {
    // The code leads the message: IPC carries only the message across, and a renderer can match it.
    super(`repo-path-refused:${code}: ${attempted}`)
    this.name = 'RepoPathRefused'
    this.code = code
    this.attempted = attempted
  }
}

/**
 * The repository paths a window may hand to `projects.create` or `repos.attach`, by their real paths, or a
 * refusal of the WHOLE call (iteration 2, errors finding 2: any existing folder was accepted, and the
 * attach then exposed it to every window — `repoPaths: ['/']` opened the disk).
 *
 * A path is admitted when the calling window can already reach it — `granted` is that window's
 * `fileRoots.resolve`: its picker, a folder it made (`createProjectFolder` grants it), the estate's own
 * repositories — or when main itself listed it as a candidate of that window's scan or kept scan.
 * Checked before anything is journalled; the caller does nothing with a refused call.
 */
export function admitRepoPaths(
  paths: unknown,
  scope: string,
  reach: { granted: (p: string, scope: string) => string; candidates: ScanCandidates }
): string[] {
  if (paths === undefined || paths === null) return []
  if (!Array.isArray(paths)) throw new RepoPathRefused('not-a-path', String(paths))
  return paths.map((p) => {
    if (typeof p !== 'string' || !path.isAbsolute(p)) throw new RepoPathRefused('not-a-path', String(p))
    let real: string
    try {
      real = realpathSync(p)
    } catch {
      throw new RepoPathRefused('missing', p)
    }
    let folder = false
    try {
      folder = statSync(real).isDirectory()
    } catch {
      // Vanished between the two calls: the same answer as never there.
      throw new RepoPathRefused('missing', p)
    }
    if (!folder) throw new RepoPathRefused('not-a-folder', p)
    if (reach.candidates.has(scope, real)) return real
    try {
      reach.granted(real, scope)
      return real
    } catch {
      // Outside every root this window may reach, and not a candidate main listed for it.
      throw new RepoPathRefused('not-chosen', p)
    }
  })
}

// #endregion scan-candidates

/**
 * The walk harness (scripts/walk/start-paths.mjs) cannot click a native dialog. In an UNPACKAGED run
 * only, `FABRIC_WALK_PICK` (`project<delimiter>scan<delimiter>parent`, or one folder for all three)
 * answers the picker; a packaged app ignores it, so no installed build grants a folder nobody chose.
 */
export function walkPickFor(purpose: PickPurpose, env: NodeJS.ProcessEnv, packaged: boolean): string | null {
  const raw = packaged ? undefined : env.FABRIC_WALK_PICK
  if (!raw) return null
  const parts = raw.split(path.delimiter)
  return parts[purpose === 'scan' ? 1 : purpose === 'parent' ? 2 : 0] || parts[0] || null
}
/**
 * Which projects hold each folder, keyed by the folder's REAL path, so a folder attached through a symlink
 * or with a trailing slash is recognised when the same folder is scanned again (iteration 1 compared the
 * stored string exactly). A project whose name cannot be read is still named by its id.
 */
export function indexImported(
  repos: readonly Record<string, unknown>[],
  projects: readonly Record<string, unknown>[],
  real: (p: string) => string = realOrResolved
): Map<string, { id: string; name: string }[]> {
  const names = new Map(projects.map((r) => [String(r.id), String(r.name)]))
  const out = new Map<string, { id: string; name: string }[]>()
  for (const r of repos) {
    const key = real(String(r.path))
    const id = String(r.project_id)
    const held = out.get(key) ?? []
    if (!held.some((h) => h.id === id)) out.set(key, [...held, { id, name: names.get(id) ?? id }])
  }
  return out
}

/** A path by its real location, or resolved when it no longer exists (a removed folder still names its project). */
export function realOrResolved(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    // A folder that no longer exists still names its project; its resolved path is the honest key.
    return path.resolve(p)
  }
}
// #endregion start-choices
