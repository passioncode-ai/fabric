// #region project-discovery — docs: docs/ux/scenarios.md#scn-128-scan-a-projects-folder-and-tick-what-becomes-a-project
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
 * NEVER BLOCKED BY THE DISK (iteration 2, errors finding 4). Every filesystem
 * call is asynchronous and carries the per-folder timeout — the folder read,
 * each entry's lstat, the `.git` probe — and the whole walk is RACED against
 * Stop and the deadline, so a call stuck on a hung mount cannot hold the answer
 * (the stuck call itself keeps a libuv thread until the kernel lets go; nothing
 * waits for it). A synchronous existence check here froze Electron's main process.
 *
 * THE BOUNDARY. The caller resolves `root` against the window's granted roots
 * before calling (main/index.ts `IPC.reposScan`), and the walk never follows a
 * symlink: a link out of the chosen folder is not entered, so the scan cannot
 * read what the operator did not open.
 */

import type { Stats } from 'node:fs'
import { lstat, readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { gitRun } from './gitRun.ts'

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
  /** Injected filesystem calls; tests only (a call that never answers stands in for a hung mount). */
  fs?: DiscoveryFs
}

/** The filesystem calls discovery makes — all asynchronous, so a hung one can be abandoned. */
export interface DiscoveryFs {
  readdir(p: string): Promise<string[]>
  lstat(p: string): Promise<Stats>
  stat(p: string): Promise<Stats>
  readFile(p: string, encoding: 'utf8'): Promise<string>
}
const REAL_FS: DiscoveryFs = { readdir: (p) => readdir(p), lstat, stat, readFile: (p, e) => readFile(p, e) }

/** One folder inspected: how long each filesystem call may take, and which calls to make. */
export interface InspectOptions {
  timeoutMs?: number
  fs?: DiscoveryFs
}

const TIMED_OUT = Symbol('timed out')
/** The call's answer, or TIMED_OUT once `ms` passes; a rejection passes through to the caller. */
async function timed<T>(call: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([call, new Promise<typeof TIMED_OUT>((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), ms) })])
  } finally {
    clearTimeout(timer)
  }
}
/** A filesystem answer that cannot fail: the value, `null` (not there / unreadable), or TIMED_OUT. */
async function probe<T>(call: () => Promise<T>, ms: number): Promise<T | null | typeof TIMED_OUT> {
  try {
    return await timed(call(), ms)
  } catch {
    // Not there, or not readable: an answer ("no"), unlike a timeout ("could not tell").
    return null
  }
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
 * Git through the ONE hardened runner (`gitRun.ts`): a repository's own config cannot make a read run a
 * program — a signature verifier, a filesystem monitor, a filter, a lazy fetch through a partial clone's
 * upload-pack (iteration 1 errors finding 1; iteration 2 errors finding 1, where this file's private copy
 * of the hardening had drifted from the runner's). Null when git fails or times out: the fact is unknown,
 * not invented. Asynchronous on purpose: the caller is Electron's main process.
 */
function gitOut(dir: string, args: string[]): Promise<string | null> {
  return gitRun(dir, args, { timeoutMs: GIT_TIMEOUT_MS }).then(
    (out) => out.trim(),
    () => null
  )
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
async function worktreeParent(gitFile: string, fs: DiscoveryFs, ms: number): Promise<string | null> {
  // An unreadable or silent `.git` file means "not a worktree we can name" — the folder is still reported, as a repository.
  const text = await probe(() => fs.readFile(gitFile, 'utf8'), ms)
  if (text === null || text === TIMED_OUT) return null
  const m = /^gitdir:\s*(.+)$/m.exec(text)
  if (!m) return null
  const gitdir = m[1].trim()
  const marker = `${path.sep}.git${path.sep}worktrees${path.sep}`
  const at = gitdir.lastIndexOf(marker)
  // A submodule's `.git` file points into `.git/modules/…`; that is not a worktree.
  return at >= 0 ? gitdir.slice(0, at) : null
}

/**
 * What a `.git` entry makes its folder: a directory → a repository; a file → a worktree (or a submodule's
 * repository); a SYMLINK to a git directory → a repository (iteration 2, errors finding 11: it was listed
 * as a plain folder) — git itself treats the folder as that repository, so naming it anything else would
 * be a guess. A dangling link, or one to something without a `HEAD`, is not a repository. TIMED_OUT when
 * the probe could not tell in time.
 */
async function dotGitKind(dotGit: string, fs: DiscoveryFs, ms: number): Promise<{ kind: FolderKind; parent: string | null } | typeof TIMED_OUT> {
  const st = await probe(() => fs.lstat(dotGit), ms)
  if (st === TIMED_OUT) return TIMED_OUT
  if (st === null) return { kind: 'folder', parent: null }
  if (st.isDirectory()) return { kind: 'repository', parent: null }
  if (st.isFile()) {
    const parent = await worktreeParent(dotGit, fs, ms)
    return { kind: parent ? 'worktree' : 'repository', parent }
  }
  if (st.isSymbolicLink()) {
    const target = await probe(() => fs.stat(dotGit), ms)
    if (target === TIMED_OUT) return TIMED_OUT
    if (!target?.isDirectory()) return { kind: 'folder', parent: null }
    const head = await probe(() => fs.stat(path.join(dotGit, 'HEAD')), ms)
    if (head === TIMED_OUT) return TIMED_OUT
    return { kind: head?.isFile() ? 'repository' : 'folder', parent: null }
  }
  return { kind: 'folder', parent: null }
}

/** Facts about one folder. Throws when the folder does not exist, is not a directory, or does not answer in time. */
export async function inspectFolder(dir: string, opts: InspectOptions = {}): Promise<FolderFacts> {
  const fs = opts.fs ?? REAL_FS
  const ms = opts.timeoutMs ?? 3000
  const abs = path.resolve(dir)
  const st = await probe(() => fs.stat(abs), ms)
  if (st === TIMED_OUT) throw new Error(`folder did not answer in time: ${abs}`)
  if (st === null) throw new Error(`folder does not exist: ${abs}`)
  if (!st.isDirectory()) throw new Error(`not a folder: ${abs}`)
  const entries = await probe(() => fs.readdir(abs), ms)
  if (entries === TIMED_OUT) throw new Error(`folder did not answer in time: ${abs}`)
  if (entries === null) throw new Error(`folder cannot be read: ${abs}`)
  let kind: FolderKind = 'folder'
  let parent: string | null = null
  if (entries.includes('.git')) {
    const k = await dotGitKind(path.join(abs, '.git'), fs, ms)
    if (k === TIMED_OUT) throw new Error(`folder did not answer in time: ${abs}`)
    ;({ kind, parent } = k)
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

/**
 * Every repository under `root` (the root included), grouped by product.
 *
 * BREADTH FIRST (iteration 1, errors finding 2): a depth-first walk spent its folder budget inside the
 * first repositories it met and returned 34 of the operator's 130; level by level, every repository at
 * one depth is found before anything deeper is entered. Inside a found repository the walk looks only
 * `nestedDepth` levels further, for nested repositories. A folder named like noise (node_modules, build,
 * vendor, …) is not ENTERED, but if it is itself a repository it is still reported; a hidden folder is
 * skipped entirely. What the
 * walk could not cover is counted — `unreadable` (a folder or entry that could not be read, or did not
 * answer in time), `deep` (below the depth limit), `symlinks` (symlinked folders, never followed) — and a
 * stop by the bound or the deadline is `truncated`, so a partial list never reads as the whole folder.
 * Throws when `root` does not exist; returns `cancelled` when the signal aborts — at once, even while a
 * filesystem call is stuck.
 */
export async function scanFolder(root: string, opts: ScanOptions = {}): Promise<ScanResult> {
  const fs = opts.fs ?? REAL_FS
  const abs = path.resolve(root)
  const maxDepth = opts.maxDepth ?? 4
  const nestedDepth = opts.nestedDepth ?? 2
  const maxDirs = opts.maxDirs ?? 20000
  const timeLimitMs = opts.timeLimitMs ?? 30000
  const dirTimeoutMs = opts.dirTimeoutMs ?? 3000
  const now = opts.now ?? Date.now
  const rootStat = await probe(() => fs.stat(abs), dirTimeoutMs)
  if (rootStat === TIMED_OUT) throw new Error(`folder did not answer in time: ${abs}`)
  if (!rootStat?.isDirectory()) throw new Error(`folder does not exist: ${abs}`)
  const started = now()
  const found: FolderFacts[] = []
  let visited = 0
  let unreadable = 0
  let deep = 0
  let symlinks = 0
  let truncated = false
  let cancelled = false
  // Set when the race below is decided: a walk still awaiting a stuck call must not touch the answer.
  let settled = false
  const over = (): boolean => settled || truncated || cancelled
  const inspectInto = async (dir: string): Promise<void> => {
    try {
      const facts = await inspectFolder(dir, { fs, timeoutMs: dirTimeoutMs })
      if (!settled) found.push(facts)
    } catch {
      // Vanished between the listing and the read, or stopped answering: not a candidate, and the walk goes on.
    }
  }

  const walk = async (): Promise<void> => {
    // Each entry: a folder, its depth below the root, and how deep below the nearest found repository it is (null: none).
    let level: { dir: string; depth: number; inRepo: number | null }[] = [{ dir: abs, depth: 0, inRepo: null }]
    while (level.length && !over()) {
      const next: typeof level = []
      for (const { dir, depth, inRepo } of level) {
        if (opts.signal?.aborted) { cancelled = true; break }
        if (visited >= maxDirs || now() - started > timeLimitMs) { truncated = true; break }
        visited++
        const entries = await probe(() => fs.readdir(dir), dirTimeoutMs)
        if (settled) return
        if (opts.signal?.aborted) { cancelled = true; break }
        // Unreadable is an answer, not an error: counted so the result can say so.
        if (entries === null || entries === TIMED_OUT) { unreadable++; continue }
        const isRepo = entries.includes('.git')
        if (isRepo) await inspectInto(dir)
        const below = isRepo ? 0 : inRepo === null ? null : inRepo + 1
        for (const name of entries.sort()) {
          if (over()) return
          // A hidden folder is the operator's own "not this" and is never reported or counted.
          if (name === '.git' || name.startsWith('.')) continue
          const child = path.join(dir, name)
          const st = await probe(() => fs.lstat(child), dirTimeoutMs) // lstat: a symlink is never followed out of the root
          if (settled) return
          if (st === TIMED_OUT) { unreadable++; continue }
          // Vanished or unreadable mid-walk: an entry the scan could not stat is not a candidate.
          if (st === null) continue
          if (st.isSymbolicLink()) {
            // Never entered. A link to a FOLDER is counted, so "nothing found" never hides where the
            // repositories really live; a link to a file, a dangling link, or noise is not a folder skipped.
            if (SKIP.has(name)) continue
            const target = await probe(() => fs.stat(child), dirTimeoutMs)
            if (settled) return
            if (target !== null && target !== TIMED_OUT && target.isDirectory()) symlinks++
            continue
          }
          if (!st.isDirectory()) continue
          // A folder named like noise (node_modules, build, vendor, …) is not entered — but if it is itself a
          // repository it is reported. A probe that cannot tell is counted, not read as "no".
          if (SKIP.has(name)) {
            const git = await probe(() => fs.lstat(path.join(child, '.git')), dirTimeoutMs)
            if (settled) return
            if (git === TIMED_OUT) unreadable++
            else if (git !== null) await inspectInto(child)
            continue
          }
          const childBelow = below === null ? null : below + 1
          if (depth + 1 > maxDepth || (childBelow !== null && childBelow > nestedDepth)) { deep++; continue }
          next.push({ dir: child, depth: depth + 1, inRepo: below })
        }
      }
      level = next
    }
  }

  // The walk RACED against Stop and the deadline: either decides the answer at once, whatever call the walk
  // is waiting on. The injected clock still bounds the walk between folders (tests drive it).
  let timer: NodeJS.Timeout | undefined
  let onAbort: (() => void) | undefined
  const outcome = await Promise.race([
    walk().then(() => 'done' as const),
    new Promise<'deadline'>((resolve) => { timer = setTimeout(() => resolve('deadline'), timeLimitMs) }),
    new Promise<'aborted'>((resolve) => {
      if (opts.signal?.aborted) return resolve('aborted')
      onAbort = () => resolve('aborted')
      opts.signal?.addEventListener('abort', onAbort, { once: true })
    })
  ])
  settled = true
  clearTimeout(timer)
  if (onAbort) opts.signal?.removeEventListener('abort', onAbort)
  if (outcome === 'aborted' || opts.signal?.aborted) cancelled = true
  else if (outcome === 'deadline') truncated = true

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
  return { root: abs, candidates, visited, unreadable, deep, symlinks, truncated, cancelled }
}
// #endregion project-discovery
