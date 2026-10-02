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
  maxDepth?: number
  maxDirs?: number
  timeLimitMs?: number
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

/** Asynchronous on purpose: the caller is Electron's main process, and a scan of a hundred repositories must not freeze every window. */
function gitOut(dir: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('git', ['-C', dir, ...args], { timeout: GIT_TIMEOUT_MS, encoding: 'utf8' }, (err, stdout) => resolve(err ? null : stdout.trim()))
  })
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
      gitOut(abs, ['log', '-1', '--format=%cI%x00%s']),
      gitOut(abs, ['symbolic-ref', '--short', '-q', 'HEAD']), // the chosen folder's branch; empty when detached
      gitOut(abs, ['config', '--get', 'remote.origin.url'])
    ])
    if (log) {
      const [at, subject] = log.split('\u0000')
      lastCommit = { at, subject: subject ?? '' }
    }
    branch = head || null
    remote = origin || null
  }
  return { path: abs, name: path.basename(abs), git, kind, parent, branch, remote, lastCommit, stack: stackOf(abs, entries) }
}

/**
 * Every repository under `root` (the root included), grouped by product.
 * Throws when `root` does not exist; returns `cancelled` when the signal is
 * already aborted or aborts mid-walk.
 */
export async function scanFolder(root: string, opts: ScanOptions = {}): Promise<ScanResult> {
  const abs = path.resolve(root)
  if (!existsSync(abs) || !(await stat(abs)).isDirectory()) throw new Error(`folder does not exist: ${abs}`)
  const maxDepth = opts.maxDepth ?? 4
  const maxDirs = opts.maxDirs ?? 5000
  const timeLimitMs = opts.timeLimitMs ?? 15000
  const now = opts.now ?? Date.now
  const started = now()
  const found: FolderFacts[] = []
  let visited = 0
  let truncated = false
  let cancelled = false

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (truncated || cancelled) return
    if (opts.signal?.aborted) { cancelled = true; return }
    if (visited >= maxDirs || now() - started > timeLimitMs) { truncated = true; return }
    visited++
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      return // unreadable: skipped, not fatal
    }
    if (entries.includes('.git')) {
      try {
        found.push(await inspectFolder(dir))
      } catch {
        /* vanished mid-walk */
      }
    }
    if (depth >= maxDepth) return
    for (const name of entries.sort()) {
      if (name.startsWith('.') || SKIP.has(name)) continue
      const child = path.join(dir, name)
      let st
      try {
        st = await lstat(child) // lstat: a symlink is never followed out of the root
      } catch {
        // Vanished or unreadable mid-walk: a folder the scan could not stat is not a candidate, and the walk goes on.
        continue
      }
      if (!st.isDirectory()) continue
      await walk(child, depth + 1)
      if (truncated || cancelled) return
    }
  }

  if (opts.signal?.aborted) cancelled = true
  else await walk(abs, 0)

  const repoPaths = found.filter((f) => f.kind === 'repository').map((f) => f.path)
  const enclosing = (p: string): string | null => {
    let best: string | null = null
    for (const r of repoPaths) if (r !== p && p.startsWith(r + path.sep) && (!best || r.length > best.length)) best = r
    return best
  }
  const candidates: Candidate[] = (cancelled ? [] : found).map((f) => ({
    ...f,
    group: f.kind === 'worktree' && f.parent ? f.parent : enclosing(f.path) ?? f.path
  }))
  return { root: abs, candidates, visited, truncated, cancelled }
}
// #endregion project-discovery
