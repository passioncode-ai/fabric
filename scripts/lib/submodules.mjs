// Which submodules of this repository are declared but not checked out.
//
// WHY. `workspace` (.gitmodules) is the private report workspace. The repository became
// public on 2026-09-30 and the submodule did not: a fresh clone — every CI runner among
// them — cannot initialise it, so a citation or a link into it cannot be resolved there.
// Failing on that would make every public clone red for a reason no contributor can fix;
// passing in silence would report a resolution nobody made. A gate therefore counts what
// it did NOT check, names the submodule, and checks the same paths in full wherever the
// submodule is checked out (the operator's machine).
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** Paths declared in .gitmodules, in the order they are declared. */
export function declaredSubmodules(root) {
  const file = path.join(root, '.gitmodules')
  if (!existsSync(file)) return []
  return [...readFileSync(file, 'utf8').matchAll(/^\s*path\s*=\s*(.+?)\s*$/gm)].map((m) => m[1])
}

/** The declared submodules whose working tree is absent (no `.git` inside). */
export function uncheckedSubmodules(root) {
  return declaredSubmodules(root).filter((p) => !existsSync(path.join(root, p, '.git')))
}

/** The unchecked submodule a repository-relative path falls inside, or null. */
export function insideUnchecked(rel, unchecked) {
  const norm = path.posix.normalize(rel.replaceAll('\\', '/'))
  return unchecked.find((p) => norm === p || norm.startsWith(p + '/')) ?? null
}
