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
import { lstat, open, readdir, readFile, stat } from 'node:fs/promises'
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
  /** How long each git read of a found repository may take, its driver probe included. */
  gitTimeoutMs?: number
  /** How many found repositories are inspected at once, after the walk. */
  inspectConcurrency?: number
  /** One repository's whole inspection; past it the repository is counted as unreadable. */
  inspectTimeoutMs?: number
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
  /** At most `max` bytes from the start of a file, as UTF-8. Absent in a fake: falls back to readFile, cut. */
  readHead?(p: string, max: number): Promise<string>
}
/** Read the first `max` bytes only: a 400 MB README must not be loaded whole to keep 64 KiB of it (0.3.3 verification ER-6). */
async function readHead(p: string, max: number): Promise<string> {
  const handle = await open(p, 'r')
  try {
    const buf = Buffer.alloc(max)
    const { bytesRead } = await handle.read(buf, 0, max, 0)
    return buf.subarray(0, bytesRead).toString('utf8')
  } finally { await handle.close() }
}
const REAL_FS: DiscoveryFs = { readdir: (p) => readdir(p), lstat, stat, readFile: (p, e) => readFile(p, e), readHead }

/** One folder inspected: how long each filesystem call may take, and which calls to make. */
export interface InspectOptions {
  timeoutMs?: number
  /** How long each git read may take, the hardened runner's driver probe included. */
  gitTimeoutMs?: number
  fs?: DiscoveryFs
}

/**
 * Why a folder could not be inspected or scanned: a CODE, so each window says it in its own language
 * (iteration 3, errors finding 9: these reached a Russian window as English sentences). The code leads the
 * message — IPC carries only the message across — as `folder-refused:<code>: <path>`:
 * `missing`, `not-a-folder`, `unreadable`, `timeout`, and `outside` (not one of the window's folders;
 * mapped by `asFolderRefusal`).
 */
export type FolderRefusal = 'missing' | 'not-a-folder' | 'unreadable' | 'timeout' | 'outside'
export class FolderRefused extends Error {
  readonly code: FolderRefusal
  readonly attempted: string
  constructor(code: FolderRefusal, attempted: string) {
    super(`folder-refused:${code}: ${attempted}`)
    this.name = 'FolderRefused'
    this.code = code
    this.attempted = attempted
  }
}

/** The boundary's refusal (`files.ts#OutsideRoots`) as a coded one; any other error passes through. */
export function asFolderRefusal(e: unknown, attempted: string): unknown {
  return e instanceof Error && e.name === 'OutsideRoots' ? new FolderRefused('outside', attempted) : e
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
function gitOut(dir: string, args: string[], timeoutMs: number = GIT_TIMEOUT_MS): Promise<string | null> {
  return gitRun(dir, args, { timeoutMs }).then(
    (out) => out.trim(),
    () => null
  )
}

/**
 * A remote as it may be shown and kept: ANY URL with a scheme loses its userinfo — `ssh://user:token@`,
 * `git+https://u:p@`, `https://x-access-token:…@` — because a token lives there (iteration 2, docs finding
 * 10: only http(s) was stripped). The userinfo is everything before the LAST `@` of the authority, so a
 * password holding a raw `@` goes too; an `@` later in the path is not userinfo. The scp form
 * `git@host:path` has no scheme and no secret, and is kept as written.
 */
export function shownRemote(url: string | null): string | null {
  if (!url) return null
  const m = /^([a-z][a-z0-9+.-]*:\/\/)([^/?#]*)(.*)$/is.exec(url)
  if (!m) return url
  const at = m[2].lastIndexOf('@')
  return at < 0 ? url : m[1] + m[2].slice(at + 1) + m[3]
}

function stackOf(dir: string, entries: string[]): string[] {
  const out: string[] = []
  for (const [file, label] of STACK_MARKERS) if (entries.includes(file) && !out.includes(label)) out.push(label)
  if (entries.some((e) => e.endsWith('.xcodeproj') || e.endsWith('.xcworkspace')) && !out.includes('Xcode')) out.push('Xcode')
  return out
}

// #region repo-summary — docs: docs/ux/scenarios.md#scn-128-scan-a-projects-folder-and-tick-what-becomes-a-project
// What the repository says it is, in its own words, so a scanned project arrives with a purpose instead of
// an empty field (0.3.3 onboarding, plan R2). The manifest's `description` wins — the author wrote it as
// one line — then the README's first paragraph of prose. Nothing is invented: no file, or no prose in it,
// is null, and the operator edits the purpose like any other. Read without following a link, at most
// SUMMARY_READ bytes of each file, within the folder's own timeout.
const SUMMARY_MAX = 240
const SUMMARY_READ = 64 * 1024
const README = /^readme(\.(md|markdown|txt|rst))?$/i

/** One line from a manifest's `description`, or the first prose paragraph of a README. Pure, for tests. */
export function summaryFrom(files: { packageJson?: string | null; pyproject?: string | null; cargo?: string | null; readme?: string | null }): string | null {
  const fromManifest = (() => {
    if (files.packageJson) {
      try {
        const d = (JSON.parse(files.packageJson) as { description?: unknown }).description
        if (typeof d === 'string' && d.trim()) return d
      } catch { /* a package.json that does not parse says nothing about the project */ }
    }
    for (const [text, tables] of [[files.pyproject, ['project', 'tool.poetry']], [files.cargo, ['package']]] as const) {
      const d = text ? tomlDescription(text, tables) : null
      if (d) return d
    }
    return null
  })()
  const raw = fromManifest ?? (files.readme ? readmeParagraph(files.readme) : null)
  return raw === null ? null : clip(plain(raw))
}

/** `description = "…"` inside one of the named TOML tables; a basic or literal one-line string only. */
function tomlDescription(text: string, tables: readonly string[]): string | null {
  let table: string | null = null
  for (const line of text.split(/\r?\n/)) {
    const head = /^\s*\[([^\]]+)\]\s*$/.exec(line)
    if (head) { table = head[1].trim(); continue }
    if (table === null || !tables.includes(table)) continue
    const m = /^\s*description\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)')\s*$/.exec(line)
    if (m) return (m[1] !== undefined ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : m[2]).trim() || null
  }
  return null
}

/** The first paragraph that is prose: not front matter, a heading, a badge or image line, code, HTML, a table or a rule. */
function readmeParagraph(text: string): string | null {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  let i = 0
  if (/^---\s*$/.test(lines[0] ?? '')) { i = 1; while (i < lines.length && !/^---\s*$/.test(lines[i])) i++; i++ }
  let fence = false
  let para: string[] = []
  for (; i < lines.length; i++) {
    const line = lines[i].trim()
    if (/^(```|~~~)/.test(line)) { fence = !fence; if (para.length) break; continue }
    if (fence) continue
    const skip = line === '' || /^#{1,6}\s/.test(line) || /^(=+|-+|\*{3,}|_{3,})$/.test(line) || /^<[^>]+>/.test(line) ||
      /^!?\[!\[/.test(line) || /^!\[/.test(line) || /^\[[^\]]+\]:\s/.test(line) || line.startsWith('|') || /^\.\. /.test(line)
    if (skip) { if (para.length) break; continue }
    para.push(line.replace(/^>\s?/, '').replace(/^[-*+]\s+/, ''))
  }
  const joined = para.join(' ').trim()
  return /[\p{L}]{3}/u.test(joined) ? joined : null
}

/** Markdown and markup reduced to the words a person reads; control characters removed. */
// The work is bounded as well as the read (0.3.3 verification, iteration 2, ER-1): this runs synchronously in the
// main process on third-party text, so the input is cut to PLAIN_INPUT before any pattern runs, and the patterns stop
// at the next opening bracket instead of scanning to the end of the text for every unclosed `<` or `[`.
const PLAIN_INPUT = 4 * 1024
function plain(text: string): string {
  return text.slice(0, PLAIN_INPUT)
    .replace(/!\[[^[\]]*\]\([^()]*\)/g, '')
    .replace(/\[([^[\]]+)\]\([^()]*\)/g, '$1')
    .replace(/<[^<>]*>/g, '')
    .replace(/(\*\*|__|`)/g, '')
    .replace(/(^|\s)[*_]([^*_\s][^*_]*)[*_](?=\s|[.,;:!?]|$)/g, '$1$2')
    .replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** At most SUMMARY_MAX characters, cut at a word, with an ellipsis when cut. */
function clip(text: string): string | null {
  if (!text) return null
  if (text.length <= SUMMARY_MAX) return text
  // Cut by code point, never inside a surrogate pair: half an emoji is not valid UTF-8 and the database refuses the
  // purpose, so that folder could never become a Project (0.3.3 verification, iteration 3, ER-5).
  const cut = Array.from(text.slice(0, SUMMARY_MAX)).slice(0, -1).join('').replace(/[\uD800-\uDBFF]$/, '')
  const at = cut.lastIndexOf(' ')
  return (at > SUMMARY_MAX / 2 ? cut.slice(0, at) : cut).replace(/[\s,;:.-]+$/, '') + '…'
}

async function summaryOf(dir: string, entries: string[], fs: DiscoveryFs, ms: number): Promise<{ text: string; file: string } | null> {
  const read = async (name: string | undefined): Promise<string | null> => {
    if (!name) return null
    const file = path.join(dir, name)
    const st = await probe(() => fs.lstat(file), ms)
    if (st === null || st === TIMED_OUT || !st.isFile()) return null // a link is never followed out of the folder
    const text = await probe(() => (fs.readHead ? fs.readHead(file, SUMMARY_READ) : fs.readFile(file, 'utf8')), ms)
    return text === null || text === TIMED_OUT ? null : text.slice(0, SUMMARY_READ)
  }
  const has = (n: string) => (entries.includes(n) ? n : undefined)
  const [packageJson, pyproject, cargo] = await Promise.all([read(has('package.json')), read(has('pyproject.toml')), read(has('Cargo.toml'))])
  // The same order summaryFrom applies, one file at a time, so the source can be named.
  for (const [file, one] of [['package.json', { packageJson }], ['pyproject.toml', { pyproject }], ['Cargo.toml', { cargo }]] as const) {
    const text = summaryFrom(one)
    if (text) return { text, file }
  }
  const readme = entries.filter((e) => README.test(e)).sort((a, b) => (/\.md$/i.test(b) ? 1 : 0) - (/\.md$/i.test(a) ? 1 : 0))[0]
  const text = summaryFrom({ readme: await read(readme) })
  return text && readme ? { text, file: readme } : null
}
// #endregion repo-summary

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
  if (st === TIMED_OUT) throw new FolderRefused('timeout', abs)
  if (st === null) throw new FolderRefused('missing', abs)
  if (!st.isDirectory()) throw new FolderRefused('not-a-folder', abs)
  const entries = await probe(() => fs.readdir(abs), ms)
  if (entries === TIMED_OUT) throw new FolderRefused('timeout', abs)
  if (entries === null) throw new FolderRefused('unreadable', abs)
  let kind: FolderKind = 'folder'
  let parent: string | null = null
  if (entries.includes('.git')) {
    const k = await dotGitKind(path.join(abs, '.git'), fs, ms)
    if (k === TIMED_OUT) throw new FolderRefused('timeout', abs)
    ;({ kind, parent } = k)
  }
  const git = kind !== 'folder'
  let lastCommit: FolderFacts['lastCommit'] = null
  let branch: string | null = null
  let remote: string | null = null
  if (git) {
    const gms = opts.gitTimeoutMs ?? GIT_TIMEOUT_MS
    const [log, head, origin] = await Promise.all([
      gitOut(abs, ['log', '-1', '--no-show-signature', '--format=%cI%x00%s'], gms),
      gitOut(abs, ['symbolic-ref', '--short', '-q', 'HEAD'], gms), // the chosen folder's branch; empty when detached
      gitOut(abs, ['config', '--get', 'remote.origin.url'], gms)
    ])
    if (log) {
      const [at, subject] = log.split('\u0000')
      lastCommit = { at, subject: subject ?? '' }
    }
    branch = head || null
    remote = shownRemote(origin || null)
  }
  const said = await summaryOf(abs, entries, fs, ms)
  return { path: abs, name: path.basename(abs), git, kind, parent, branch, remote, lastCommit, stack: stackOf(abs, entries), summary: said?.text ?? null, summaryFile: said?.file ?? null }
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
 * The walk only FINDS repositories; they are inspected after it, a few at a time, on the budget left, and
 * one whose inspection fails or times out is counted in `unreadable` (iteration 3).
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
  const gitTimeoutMs = opts.gitTimeoutMs ?? GIT_TIMEOUT_MS
  const inspectConcurrency = Math.max(1, opts.inspectConcurrency ?? 4)
  // Three filesystem probes in a row, then three git reads at once (each a driver probe plus the command
  // sharing one budget), with a little slack.
  const inspectTimeoutMs = opts.inspectTimeoutMs ?? 3 * dirTimeoutMs + gitTimeoutMs + 1000
  const now = opts.now ?? Date.now
  const rootStat = await probe(() => fs.stat(abs), dirTimeoutMs)
  if (rootStat === TIMED_OUT) throw new FolderRefused('timeout', abs)
  if (rootStat === null) throw new FolderRefused('missing', abs)
  if (!rootStat.isDirectory()) throw new FolderRefused('not-a-folder', abs)
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
  // Repositories the walk found, inspected only once the walk is done (iteration 3, errors finding 5): an
  // inspection inside the walk, one at a time, let a few slow repositories spend the whole budget before
  // a healthy one was ever reached.
  const toInspect: string[] = []
  const inspectInto = (dir: string): void => {
    if (!toInspect.includes(dir)) toInspect.push(dir)
  }

  /**
   * Inspect what the walk found, `inspectConcurrency` at a time, on the budget the walk left. A repository
   * whose inspection throws or does not answer in time is COUNTED in `unreadable` — never silently dropped
   * (iteration 3, docs finding 1). Running out of budget is `truncated`, like the walk's own bound.
   */
  const inspectAll = async (): Promise<void> => {
    let next = 0
    const worker = async (): Promise<void> => {
      while (next < toInspect.length && !settled && !cancelled) {
        if (opts.signal?.aborted) { cancelled = true; return }
        const left = timeLimitMs - (now() - started)
        if (left <= 0) { truncated = true; return }
        const dir = toInspect[next++]
        let facts: FolderFacts | typeof TIMED_OUT | null
        try {
          facts = await timed(inspectFolder(dir, { fs, timeoutMs: dirTimeoutMs, gitTimeoutMs }), Math.min(inspectTimeoutMs, left))
        } catch {
          // Vanished between the listing and the read, or not readable: counted below, and the rest go on.
          facts = null
        }
        if (settled) return
        if (facts === null || facts === TIMED_OUT) unreadable++
        else found.push(facts)
      }
    }
    await Promise.all(Array.from({ length: Math.min(inspectConcurrency, toInspect.length) }, worker))
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
        if (isRepo) inspectInto(dir)
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
            else if (git !== null) inspectInto(child)
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
  const work = async (): Promise<void> => {
    await walk()
    // A walk stopped by its folder bound still has its finds inspected; a stopped or settled one does not.
    if (!settled && !cancelled) await inspectAll()
  }
  const outcome = await Promise.race([
    work().then(() => 'done' as const),
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
