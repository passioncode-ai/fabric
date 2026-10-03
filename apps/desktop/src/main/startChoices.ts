// #region start-choices — docs: docs/adr/0100-first-run-and-start-paths.md#boundary
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
import { lstatSync, realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
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

// #region scan-candidates — docs: docs/adr/0100-first-run-and-start-paths.md#boundary
/**
 * The repositories main itself listed for a window: the candidates of its most recent scan, and of the
 * kept scan it was shown (ADR-0100 §3: "adding from it later goes through the checked create"). Each
 * slot is REPLACED by the next listing of its kind, and both end with the window, like its roots and its
 * parent choices.
 *
 * A candidate is held as the WALK wrote it — the walk's canonical path, never re-resolved — together with
 * the root it was found under (iteration 3, errors finding 2, blocking). Re-running `realpath` on a stored
 * string at record time followed whatever the folder had since become: a kept candidate replaced by a
 * symlink to `/` was recorded as `/`, and `/` was then admitted into every window's roots. A string that
 * is not absolute and normal, not under its root, or names a filesystem root or the home folder is not
 * recorded at all.
 */
export type CandidateSlot = 'scan' | 'kept'
interface CandidateList { root: string; paths: Set<string> }
export class ScanCandidates {
  private readonly byScope = new Map<string, Partial<Record<CandidateSlot, CandidateList>>>()
  private readonly home: string

  /** `home` is injectable for tests; by default the operator's real home folder. */
  constructor(opts: { home?: string } = {}) {
    this.home = opts.home ?? realHome()
  }

  record(scope: string, slot: CandidateSlot, root: string, paths: readonly string[]): void {
    const slots = this.byScope.get(scope) ?? {}
    const list: CandidateList = { root, paths: new Set<string>() }
    if (typeof root === 'string' && isNormalAbsolute(root)) {
      for (const p of paths) {
        if (typeof p === 'string' && isNormalAbsolute(p) && within(p, root) && !tooBroad(p, this.home)) list.paths.add(p)
      }
    }
    slots[slot] = list
    this.byScope.set(scope, slots)
  }

  /**
   * Whether `real` — a path already taken by its real path — is a candidate this window may add NOW: the
   * very string the walk recorded (so the folder still resolves to itself: no component became a link
   * since), not itself a symlink, still a repository (`.git` present), under the root it was found in, and
   * not a filesystem root or the home folder.
   */
  admits(scope: string, real: string): boolean {
    const slots = this.byScope.get(scope)
    if (!slots || tooBroad(real, this.home)) return false
    const listed = [slots.scan, slots.kept].some((l) => !!l && l.paths.has(real) && within(real, l.root))
    if (!listed) return false
    try {
      if (realpathSync(real) !== real) return false
      if (lstatSync(real).isSymbolicLink()) return false
      lstatSync(path.join(real, '.git'))
      return true
    } catch {
      // Gone, or no longer a repository: not a candidate any more.
      return false
    }
  }

  revoke(scope: string): void {
    this.byScope.delete(scope)
  }
}

/** The operator's home folder by its real path (or as given when it cannot be resolved). */
function realHome(): string {
  const h = homedir()
  try {
    return realpathSync(h)
  } catch {
    // An unresolvable home is still the home: compared as given.
    return path.resolve(h)
  }
}

/** Absolute and already normal: no `.`/`..` segment, no doubled or trailing separator. */
function isNormalAbsolute(p: string): boolean {
  return path.isAbsolute(p) && path.normalize(p) === p && (p === path.parse(p).root || !p.endsWith(path.sep))
}

/** `p` is `root` itself or lies below it. */
function within(p: string, root: string): boolean {
  return p === root || p.startsWith(root.endsWith(path.sep) ? root : root + path.sep)
}

/** A filesystem root (`/`) or the home folder: never a repository path a window may add. */
export function tooBroad(real: string, home: string = realHome()): boolean {
  return real === path.parse(real).root || real === home
}

/**
 * Why a repository path was refused: a code, so each window can say it in its own language.
 * `too-broad`: a filesystem root or the home folder (iteration 3, errors finding 2); `held-by-other`: a
 * repository another project already holds (REQ-04; iteration 3, docs finding 10).
 */
export type RepoPathRefusal = 'not-a-path' | 'missing' | 'not-a-folder' | 'not-chosen' | 'too-broad' | 'held-by-other'
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
 * repositories — or when main itself listed it as a candidate of that window's scan or kept scan
 * (`ScanCandidates#admits`). A filesystem root or the home folder is refused whatever reaches it.
 * Checked before anything is journalled; the caller does nothing with a refused call.
 */
export function admitRepoPaths(
  paths: unknown,
  scope: string,
  reach: { granted: (p: string, scope: string) => string; candidates: ScanCandidates; home?: string }
): string[] {
  if (paths === undefined || paths === null) return []
  if (!Array.isArray(paths)) throw new RepoPathRefused('not-a-path', String(paths))
  const home = reach.home ?? realHome()
  return paths.map((p) => {
    if (typeof p !== 'string' || !path.isAbsolute(p)) throw new RepoPathRefused('not-a-path', String(p))
    let real: string
    try {
      real = realpathSync(p)
    } catch {
      throw new RepoPathRefused('missing', p)
    }
    if (tooBroad(real, home)) throw new RepoPathRefused('too-broad', p)
    let folder = false
    try {
      folder = statSync(real).isDirectory()
    } catch {
      // Vanished between the two calls: the same answer as never there.
      throw new RepoPathRefused('missing', p)
    }
    if (!folder) throw new RepoPathRefused('not-a-folder', p)
    if (reach.candidates.admits(scope, real)) return real
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
