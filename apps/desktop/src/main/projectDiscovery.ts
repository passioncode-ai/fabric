// #region project-discovery — docs: docs/adr/0100-first-run-and-start-paths.md#decision
/**
 * Finding projects on disk: one folder inspected, or a parent folder scanned
 * (ADR-0100, SCN-127 add an existing project, SCN-128 scan a projects folder).
 *
 * READ-ONLY. Nothing here creates a Project, attaches a repository or writes a
 * byte: the operator ticks what becomes a Project, and the create path is the
 * existing `projects.create`. A scan that wrote would be the "scanning creates
 * projects behind your back" the decision refuses.
 *
 * Every fact comes from the filesystem and from git itself — never from a
 * guess about a name. A folder is a repository only if `.git` is there; a
 * worktree is one only if its `.git` file says so; a nested repository is one
 * found inside another found repository.
 *
 * Bounded and cancellable by construction. A walk stopped by its folder limit
 * or its deadline says `truncated: true`; a cancelled one says `cancelled`. A
 * partial list is never returned as if it were the whole folder.
 *
 * THE BOUNDARY. The caller resolves `root` against the window's granted roots
 * before calling (main/index.ts `IPC.reposScan`), and the walk never follows a
 * symlink: a link out of the chosen folder is not entered, so the scan cannot
 * read what the operator did not open.
 */

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { lstat, readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import type { Candidate, FolderFacts, FolderKind, ScanResult } from '../shared/startPaths.ts'
export type { Candidate, FolderFacts, ScanResult } from '../shared/startPaths.ts'

export interface ScanOptions {
  /** How deep below the scanned folder the walk looks for repositories. */
  maxDepth?: number
  /** How deep below a FOUND repository it keeps looking, for nested repositories (monorepo packages). */
  nestedDepth?: number
  maxDirs?: number
  timeLimitMs?: number
  /** A single folder read that takes longer than this is abandoned and counted as unreadable (a hung mount). */
  dirTimeoutMs?: number
  signal?: AbortSignal
  /** Injected clock for the deadline; tests only. */
  now?: () => number
}

/** Folders a scan never enters: dependency trees, build output, caches, VCS internals. */
const SKIP = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'target', 'vendor', 'Pods', 'DerivedData',
  '.venv', 'venv', '__pycache__', '.next', '.turbo', '.cache', 'coverage', 'Library'
])

/** Marker file → stack label. The first match per label wins; order is the display order. */
const STACK_MARKERS: ReadonlyArray<[string, string]> = [
  ['package.json', 'Node.js'],
  ['pyproject.toml', 'Python'],
  ['requirements.txt', 'Python'],
  ['Cargo.toml', 'Rust'],
  ['go.mod', 'Go'],
  ['Package.swift', 'Swift'],
  ['Gemfile', 'Ruby'],
  ['pom.xml', 'JVM'],
  ['build.gradle', 'JVM'],
  ['build.gradle.kts', 'JVM'],
  ['pubspec.yaml', 'Dart'],
  ['composer.json', 'PHP']
]

const GIT_TIMEOUT_MS = 3000

/**
 * Configuration a repository's OWN `.git/config` could use to make a read run a program — a signature
 * verifier, a filesystem monitor, a pager, an external diff, an ssh command. Each is switched off on the
 * command line, which outranks the repository's config, so scanning a repository someone else prepared
 * never executes what it names (iteration 1, errors finding 1: `log.showSignature` + `gpg.program` ran a
 * planted script). The environment closes the same doors for config git reads from elsewhere.
 */
const SAFE_GIT = [
  '-c', 'log.showSignature=false', '-c', 'gpg.program=false', '-c', 'gpg.ssh.program=false', '-c', 'gpg.x509.program=false',
  '-c', 'core.fsmonitor=false', '-c', 'core.pager=cat', '-c', 'core.sshCommand=false', '-c', 'diff.external=',
  '-c', 'core.hooksPath=/dev/null'
]
const SAFE_ENV: Record<string, string> = { GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat', GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_NOSYSTEM: '1' }

/** Asynchronous on purpose: the caller is Electron's main process, and a scan of a hundred repositories must not freeze every window. */
function gitOut(dir: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('git', [...SAFE_GIT, '-C', dir, ...args], { timeout: GIT_TIMEOUT_MS, encoding: 'utf8', env: { ...process.env, ...SAFE_ENV } }, (err, stdout) => resolve(err ? null : stdout.trim()))
  })
}

/** A remote as it may be shown and kept: an http(s) URL loses its user and password (a token lives there). */
export function shownRemote(url: string | null): string | null {
  if (!url) return null
  const m = /^(https?:\/\/)[^/@]*@(.*)$/i.exec(url)
  return m ? m[1] + m[2] : url
}

function stackOf(dir: string, entries: string[]): string[] {
  const out: string[] = []
  for (const [file, label] of STACK_MARKERS) if (entries.includes(file) && !out.includes(label)) out.push(label)
  if (entries.some((e) => e.endsWith('.xcodeproj') || e.endsWith('.xcworkspace')) && !out.includes('Xcode')) out.push('Xcode')
  return out
}

/** The repository a worktree's `.git` file points back to, or null when the file is not a worktree link. */
async function worktreeParent(gitFile: string): Promise<string | null> {
  let text: string
  try {
    text = await readFile(gitFile, 'utf8')
  } catch {
    // An unreadable `.git` file means "not a worktree we can name" — the folder is still reported, as a repository.
    return null
  }
  const m = /^gitdir:\s*(.+)$/m.exec(text)
  if (!m) return null
  const gitdir = m[1].trim()
  const marker = `${path.sep}.git${path.sep}worktrees${path.sep}`
  const at = gitdir.lastIndexOf(marker)
  // A submodule's `.git` file points into `.git/modules/…`; that is not a worktree.
  return at >= 0 ? gitdir.slice(0, at) : null
}

/** Facts about one folder. Throws when the folder does not exist or is not a directory. */
export async function inspectFolder(dir: string): Promise<FolderFacts> {
  const abs = path.resolve(dir)
  if (!existsSync(abs)) throw new Error(`folder does not exist: ${abs}`)
  if (!(await stat(abs)).isDirectory()) throw new Error(`not a folder: ${abs}`)
  const entries = await readdir(abs)
  const dotGit = path.join(abs, '.git')
  let kind: FolderKind = 'folder'
  let parent: string | null = null
  if (existsSync(dotGit)) {
    const st = await lstat(dotGit)
    if (st.isDirectory()) kind = 'repository'
    else if (st.isFile()) {
      parent = await worktreeParent(dotGit)
      kind = parent ? 'worktree' : 'repository'
    }
  }
  const git = kind !== 'folder'
  let lastCommit: FolderFacts['lastCommit'] = null
  let branch: string | null = null
  let remote: string | null = null
  if (git) {
    const [log, head, origin] = await Promise.all([
      gitOut(abs, ['log', '-1', '--no-show-signature', '--format=%cI%x00%s']),
      gitOut(abs, ['symbolic-ref', '--short', '-q', 'HEAD']), // the chosen folder's branch; empty when detached
      gitOut(abs, ['config', '--get', 'remote.origin.url'])
    ])
    if (log) {
      const [at, subject] = log.split('\u0000')
      lastCommit = { at, subject: subject ?? '' }
    }
    branch = head || null
    remote = shownRemote(origin || null)
  }
  return { path: abs, name: path.basename(abs), git, kind, parent, branch, remote, lastCommit, stack: stackOf(abs, entries) }
}

/** One folder's entries, or null when it cannot be read in time (permission, a hung mount, gone). */
async function readEntries(dir: string, timeoutMs: number): Promise<string[] | null> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      readdir(dir),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs) })
    ])
  } catch {
    // Unreadable is an answer, not an error: the caller counts it so the result can say so.
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Every repository under `root` (the root included), grouped by product.
 *
 * BREADTH FIRST (iteration 1, errors finding 2): a depth-first walk spent its folder budget inside the
 * first repositories it met and returned 34 of the operator's 130; level by level, every repository at
 * one depth is found before anything deeper is entered. Inside a found repository the walk looks only
 * `nestedDepth` levels further, for nested repositories. A folder named like noise (node_modules, build,
 * vendor, …) is not ENTERED, but if it is itself a repository it is still reported; a hidden folder is
 * skipped entirely. What the
 * walk could not cover is counted — `unreadable`, `deep` (below the depth limit) — and a stop by the
 * bound or the deadline is `truncated`, so a partial list never reads as the whole folder.
 * Throws when `root` does not exist; returns `cancelled` when the signal aborts.
 */
export async function scanFolder(root: string, opts: ScanOptions = {}): Promise<ScanResult> {
  const abs = path.resolve(root)
  if (!existsSync(abs) || !(await stat(abs)).isDirectory()) throw new Error(`folder does not exist: ${abs}`)
  const maxDepth = opts.maxDepth ?? 4
  const nestedDepth = opts.nestedDepth ?? 2
  const maxDirs = opts.maxDirs ?? 20000
  const timeLimitMs = opts.timeLimitMs ?? 30000
  const dirTimeoutMs = opts.dirTimeoutMs ?? 3000
  const now = opts.now ?? Date.now
  const started = now()
  const found: FolderFacts[] = []
  let visited = 0
  let unreadable = 0
  let deep = 0
  let truncated = false
  let cancelled = false
  const inspectInto = async (dir: string): Promise<void> => {
    try {
      found.push(await inspectFolder(dir))
    } catch {
      // Vanished between the listing and the read: it is not a candidate, and the walk goes on.
    }
  }

  // Each entry: a folder, its depth below the root, and how deep below the nearest found repository it is (null: none).
  let level: { dir: string; depth: number; inRepo: number | null }[] = [{ dir: abs, depth: 0, inRepo: null }]
  while (level.length && !truncated && !cancelled) {
    const next: typeof level = []
    for (const { dir, depth, inRepo } of level) {
      if (opts.signal?.aborted) { cancelled = true; break }
      if (visited >= maxDirs || now() - started > timeLimitMs) { truncated = true; break }
      visited++
      const entries = await readEntries(dir, dirTimeoutMs)
      if (opts.signal?.aborted) { cancelled = true; break }
      if (!entries) { unreadable++; continue }
      const isRepo = entries.includes('.git')
      if (isRepo) await inspectInto(dir)
      const below = isRepo ? 0 : inRepo === null ? null : inRepo + 1
      for (const name of entries.sort()) {
        const child = path.join(dir, name)
        let st
        try {
          st = await lstat(child) // lstat: a symlink is never followed out of the root
        } catch {
          // Vanished or unreadable mid-walk: a folder the scan could not stat is not a candidate.
          continue
        }
        if (!st.isDirectory() || name === '.git') continue
        // A hidden folder is the operator's own "not this" and is never reported. A folder named like noise
        // (node_modules, build, vendor, …) is not entered — but if it is itself a repository it is reported.
        if (name.startsWith('.')) continue
        if (SKIP.has(name)) {
          if (existsSync(path.join(child, '.git'))) await inspectInto(child)
          continue
        }
        const childBelow = below === null ? null : below + 1
        if (depth + 1 > maxDepth || (childBelow !== null && childBelow > nestedDepth)) { deep++; continue }
        next.push({ dir: child, depth: depth + 1, inRepo: below })
      }
    }
    level = next
  }
  if (opts.signal?.aborted) cancelled = true

  const repoPaths = found.filter((f) => f.kind === 'repository').map((f) => f.path)
  const enclosing = (p: string): string | null => {
    let best: string | null = null
    for (const r of repoPaths) if (r !== p && p.startsWith(r + path.sep) && (!best || r.length > best.length)) best = r
    return best
  }
  const unique = [...new Map(found.map((f) => [f.path, f])).values()].sort((a, b) => a.path.localeCompare(b.path))
  const candidates: Candidate[] = (cancelled ? [] : unique).map((f) => ({
    ...f,
    group: f.kind === 'worktree' && f.parent ? f.parent : enclosing(f.path) ?? f.path
  }))
  return { root: abs, candidates, visited, unreadable, deep, truncated, cancelled }
}
// #endregion project-discovery
