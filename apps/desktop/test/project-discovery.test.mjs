// Finding projects on disk (ADR-0100, SCN-127/SCN-128): one folder inspected, a parent
// folder scanned. Driven against a REAL tree of git repositories built here — a plain
// repository, a worktree of it living elsewhere, a repository nested inside another,
// a folder that is not a repository, a symlink that leaves the root, and the noise a
// scan must not descend into. No model of git is used: every fact comes from git.

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const SRC = path.resolve(import.meta.dirname, '../src/main/projectDiscovery.ts')
const { inspectFolder, scanFolder } = await import(SRC)

const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@e', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@e' } }).toString()
const repo = (dir, file, subject) => {
  mkdirSync(dir, { recursive: true })
  git(dir, 'init', '-q', '-b', 'main')
  writeFileSync(path.join(dir, file), '{}\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', subject)
}

const outside = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-outside-')))
repo(path.join(outside, 'secret'), 'README.md', 'outside the root')

const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-scan-')))
repo(path.join(root, 'alpha'), 'package.json', 'alpha first')
git(path.join(root, 'alpha'), 'remote', 'add', 'origin', 'git@github.com:example/alpha.git')
repo(path.join(root, 'beta'), 'pyproject.toml', 'beta first')
repo(path.join(root, 'beta', 'vendor-lib'), 'Cargo.toml', 'nested')           // nested repository
mkdirSync(path.join(root, '_worktrees'))
git(path.join(root, 'alpha'), 'worktree', 'add', '-q', path.join(root, '_worktrees', 'alpha-fix'), '-b', 'fix')
mkdirSync(path.join(root, 'notes'))                                           // a folder, not a repository
writeFileSync(path.join(root, 'notes', 'todo.md'), '- x\n')
repo(path.join(root, 'node_modules', 'pkg'), 'package.json', 'never scanned') // noise
repo(path.join(root, '.hidden'), 'package.json', 'never scanned')             // hidden
symlinkSync(path.join(outside, 'secret'), path.join(root, 'escape'))          // leaves the root

// ── inspect one folder
const alpha = await inspectFolder(path.join(root, 'alpha'))
assert.equal(alpha.git, true)
assert.equal(alpha.kind, 'repository')
assert.equal(alpha.name, 'alpha')
assert.equal(alpha.branch, 'main')
assert.equal(alpha.remote, 'git@github.com:example/alpha.git')
assert.equal(alpha.lastCommit?.subject, 'alpha first')
assert.match(alpha.lastCommit?.at ?? '', /^\d{4}-\d{2}-\d{2}T/)
assert.deepEqual(alpha.stack, ['Node.js'])

const notes = await inspectFolder(path.join(root, 'notes'))
assert.equal(notes.git, false, 'a plain folder is not reported as a repository')
assert.equal(notes.kind, 'folder')
assert.equal(notes.lastCommit, null)

const worktree = await inspectFolder(path.join(root, '_worktrees', 'alpha-fix'))
assert.equal(worktree.kind, 'worktree')
assert.equal(worktree.parent, path.join(root, 'alpha'), 'a worktree names the repository it belongs to')
assert.equal(worktree.branch, 'fix')

await assert.rejects(() => inspectFolder(path.join(root, 'missing')), /does not exist/)

// ── scan the parent folder
const scan = await scanFolder(root)
const byName = Object.fromEntries(scan.candidates.map((c) => [path.relative(root, c.path), c]))
assert.deepEqual(Object.keys(byName).sort(), ['_worktrees/alpha-fix', 'alpha', 'beta', 'beta/vendor-lib'].sort(),
  'repositories and the worktree are found; node_modules, hidden folders, plain folders and the symlink out of the root are not')
assert.equal(byName['alpha'].group, path.join(root, 'alpha'))
assert.equal(byName['_worktrees/alpha-fix'].group, path.join(root, 'alpha'), 'a worktree is grouped under its repository')
assert.equal(byName['beta/vendor-lib'].group, path.join(root, 'beta'), 'a nested repository is grouped under its parent')
assert.equal(byName['beta'].group, path.join(root, 'beta'))
assert.equal(scan.truncated, false)
assert.ok(!scan.candidates.some((c) => c.path.startsWith(outside)), 'nothing outside the scanned root is reported')

// Bounds: a limit on visited folders stops the walk and SAYS so instead of returning a partial list as complete.
const bounded = await scanFolder(root, { maxDirs: 2 })
assert.equal(bounded.truncated, true, 'a walk stopped by its bound reports truncation')

// Cancellation: an aborted signal stops before the walk and says it was cancelled.
const ctl = new AbortController(); ctl.abort()
const cancelled = await scanFolder(root, { signal: ctl.signal })
assert.equal(cancelled.cancelled, true)
assert.equal(cancelled.candidates.length, 0)

await assert.rejects(() => scanFolder(path.join(root, 'missing')), /does not exist/)

console.log('PASS project discovery: inspect (repository, folder, worktree, missing) and scan (grouping, noise, symlink boundary, bound, cancel)')
