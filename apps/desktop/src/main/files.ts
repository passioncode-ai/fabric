// Filesystem reads and writes live in main, never in the renderer: the
// renderer's whole surface is the typed IPC bridge (ADR-0031 §2). Lazy listing,
// one directory level per call, capped, blind to what nobody browses.
//
// And bounded (SEC-REQ-016). Until now these three functions took any absolute
// path and served it: every window held, through the bridge, a read and write
// primitive over the operator's whole home directory — `~/.ssh/id_rsa` included.
// Nothing in the product asked for that. The reach is now the set of roots the
// operator actually opened: the repositories attached to a project, plus
// anything picked through the native folder dialog, because a dialog pick IS the
// operator saying yes. Paths are resolved through symlinks before the check, so
// a link inside a repository cannot be used to step outside one.
//
// Writes carry a conflict check. Agents work in these same repositories, so a
// file open in the editor can change under it. `read` returns the content hash
// it saw; `write` refuses when the hash on disk no longer matches, and hands
// back the current content so the caller can show a diff and decide. Nothing is
// overwritten silently, and nothing is locked either — locking would mean the
// editor is read-only nearly always.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { FileNode, FilePayload, WriteResult } from '../shared/types'
import { ops } from './opsSink.ts'

/** Refused because the path is not under anything the operator opened. */
export class OutsideRoots extends Error {
  readonly attempted: string

  constructor(attempted: string) {
    super(`that file is outside every folder open in Fabric: ${attempted}`)
    this.name = 'OutsideRoots'
    this.attempted = attempted
  }
}

/**
 * The set of directories the filesystem API may reach. Held in the main process
 * and rebuilt from the journal's own projection whenever repositories change —
 * never accumulated from whatever a caller happened to ask for.
 */
export class FileRoots {
  /** The estate's own repositories. Rebuilt from the journal's projection on
   *  every attach or detach — the app's working set, and reachable from any of
   *  its windows because every one of them is the same estate. */
  private repos = new Set<string>()

  /**
   * Folders the operator chose in a native dialog, KEYED BY THE WINDOW THAT
   * CHOSE (S02.roots).
   *
   * MEASURED BEFORE THIS SPLIT: a dialog grant went into the one shared set, so
   * a folder opened once for one project stayed reachable from every other
   * window and every agent session for the life of the process — and outlived
   * the window that asked for it. A choice made in one place is not a decision
   * about everywhere.
   */
  private granted = new Map<string, Set<string>>()

  /** Replace the repository set. Called after any repo attach or detach. */
  reset(paths: string[]): void {
    this.repos = new Set()
    for (const p of paths) this.addRepo(p)
  }

  private addRepo(p: string): void {
    try {
      this.repos.add(realpathSync(p))
    } catch {
      // A configured repository that no longer exists is not a reason to fail
      // the whole set; it simply grants nothing.
    }
  }

  /**
   * A folder the operator just chose, for ONE scope.
   *
   * `scope` is the window that asked. Passing none is refused rather than
   * defaulted to "everywhere": an unscoped grant is exactly the thing this
   * method used to be.
   */
  allow(p: string, scope: string): void {
    if (!scope) throw new Error('a folder grant belongs to the window that chose it; no scope was given')
    try {
      const real = realpathSync(p)
      const set = this.granted.get(scope) ?? new Set<string>()
      set.add(real)
      this.granted.set(scope, set)
    } catch {
      // Same as a repository that is gone: it grants nothing.
    }
  }

  /** The window closed, so what it was allowed to reach closes with it. */
  revoke(scope: string): void {
    this.granted.delete(scope)
  }

  /** Everything one scope may reach: the estate's repositories plus its own
   *  grants. Without a scope, only the repositories. */
  list(scope?: string): string[] {
    return [...this.repos, ...(scope ? (this.granted.get(scope) ?? []) : [])]
  }

  /**
   * The real path of `target` if it sits inside a root this SCOPE may reach, or
   * a refusal. A path that does not exist yet is checked through its parent, so
   * creating a file in an open repository still works.
   *
   * WHAT THIS DOES NOT DEFEND AGAINST, stated rather than implied: `realpath`
   * resolves the path as it is NOW, and an attacker able to replace a component
   * between this check and the open would defeat it. The trusted-local profile
   * accepts that limit knowingly; an untrusted-repository profile needs
   * handle-relative no-follow opens and stays unadmitted until a race fixture
   * passes (S02, CO-090).
   */
  resolve(target: string, scope?: string): string {
    const absolute = path.resolve(target)
    let real: string
    try {
      real = existsSync(absolute)
        ? realpathSync(absolute)
        : path.join(realpathSync(path.dirname(absolute)), path.basename(absolute))
    } catch {
      throw new OutsideRoots(absolute)
    }
    for (const root of this.list(scope)) {
      const rel = path.relative(root, real)
      // '' is the root itself. A leading '..' means it climbed out, and an
      // absolute result means a different volume. String prefixes are NOT
      // enough here: '/repo-backup' starts with '/repo'.
      if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) return real
    }
    throw new OutsideRoots(absolute)
  }
}

const SKIP = new Set(['.git', 'node_modules', '.DS_Store', 'dist', 'out', '.next', '__pycache__'])
const MAX_ENTRIES = 300
const MAX_BYTES = 2_000_000

export function listDirectory(dir: string, roots: FileRoots, scope?: string): { entries: FileNode[]; truncated: number } {
  dir = roots.resolve(dir, scope)
  const raw = readdirSync(dir, { withFileTypes: true })
    .filter((e) => !SKIP.has(e.name))
    .sort((a, b) => {
      const dirDelta = Number(b.isDirectory()) - Number(a.isDirectory())
      return dirDelta !== 0 ? dirDelta : a.name.localeCompare(b.name)
    })

  const kept = raw.slice(0, MAX_ENTRIES)
  const entries: FileNode[] = kept.map((e) => {
    const full = path.join(dir, e.name)
    let size: number | null = null
    if (e.isFile()) {
      try {
        size = statSync(full).size
      } catch (e) {
      ops.failed('files.stat', e)
        size = null
      }
    }
    return { name: e.name, path: full, isDirectory: e.isDirectory(), size }
  })

  return { entries, truncated: raw.length - kept.length }
}

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

const LANGUAGES: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.mjs': 'javascript', '.cjs': 'javascript', '.json': 'json', '.css': 'css',
  '.html': 'html', '.md': 'markdown', '.sql': 'sql', '.py': 'python', '.sh': 'shell',
  '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'ini', '.rs': 'rust', '.go': 'go'
}

/**
 * May this path be handed to the OPERATING SYSTEM to open (AX-15)?
 *
 * MEASURED at `1dab3a6`: `files.read`, `files.write` and `files.list` were
 * bounded by SEC-REQ-016 and `files.openExternally` was not — it passed the
 * renderer's string straight to `shell.openPath`. That is strictly worse than
 * reading: `openPath` asks the OS to open the file with whatever handler is
 * registered for it, so the door that this module's own header describes —
 * "every window held, through the bridge, a read and write primitive over the
 * operator's whole home directory, `~/.ssh/id_rsa` included" — was still open,
 * and this one RUNS the file rather than showing it.
 *
 * A refusal rather than a throw, because the caller is an IPC handler whose
 * contract already answers with a reason: the renderer shows the sentence
 * beside the file instead of a bridge error.
 */
export function resolveForOpen(
  file: string,
  roots: FileRoots,
  scope?: string
): { ok: true; path: string } | { ok: false; reason: string } {
  try {
    // The SAME resolve the other three use, which is the point: symlinks are
    // walked first, so a link inside a root pointing out of it is refused, and
    // `..` cannot climb out.
    return { ok: true, path: roots.resolve(file, scope) }
  } catch (e) {
    return { ok: false, reason: e instanceof OutsideRoots ? e.message : String(e) }
  }
}

export function readFile(file: string, roots: FileRoots, scope?: string): FilePayload {
  file = roots.resolve(file, scope)
  const size = statSync(file).size
  if (size > MAX_BYTES) throw new Error(`file is too large to open (${size} bytes)`)
  const content = readFileSync(file, 'utf8')
  return {
    path: file,
    name: path.basename(file),
    content,
    hash: hash(content),
    language: LANGUAGES[path.extname(file).toLowerCase()] ?? 'plaintext'
  }
}

/**
 * `expectedHash` is what the caller saw when it opened the file. When the disk
 * has moved on, nothing is written and the current content comes back for the
 * caller to diff. `force` is the operator's decision after seeing that diff.
 */
export function writeFile(
  file: string,
  content: string,
  expectedHash: string,
  roots: FileRoots,
  force = false,
  scope?: string
): WriteResult {
  file = roots.resolve(file, scope)
  if (!force) {
    const onDisk = readFileSync(file, 'utf8')
    if (hash(onDisk) !== expectedHash) {
      return { ok: false, reason: 'changed-on-disk', current: onDisk, currentHash: hash(onDisk) }
    }
  }
  writeFileSync(file, content, 'utf8')
  return { ok: true, hash: hash(content) }
}
