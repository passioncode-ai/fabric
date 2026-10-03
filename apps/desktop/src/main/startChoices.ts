// #region start-choices — docs: docs/adr/0100-first-run-and-start-paths.md#decision
/**
 * What a window chose in the start paths' folder picker (ADR-0100), kept apart from `index.ts` so it
 * is tested without Electron.
 *
 * A folder chosen as the PARENT of a new project is not opened: the window may create one folder in it
 * and nothing more (iteration 1 found the parent's whole tree had become readable and writable). The
 * choice belongs to the window that made it and is revoked with that window, like its granted roots
 * (S02.roots); iteration 2 found the revocation was claimed in a comment and never done.
 */
import { realpathSync } from 'node:fs'
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
