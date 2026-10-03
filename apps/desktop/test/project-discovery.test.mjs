// Finding projects on disk (ADR-0100, SCN-127/SCN-128): one folder inspected, a parent
// folder scanned. Driven against a REAL tree of git repositories built here — a plain
// repository, a worktree of it living elsewhere, a repository nested inside another,
// a folder that is not a repository, a symlink that leaves the root, and the noise a
// scan must not descend into. No model of git is used: every fact comes from git.

import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync, realpathSync } from 'node:fs'
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

// ── V1 (iteration 1, errors-2/data-9/errors-4/errors-10): the scan only READS and says what it skipped
// A repository's own config cannot make the scan run a program: a signed commit with
// log.showSignature and gpg.program set would run that program under a plain `git log`.
{
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-sig-')))
  const mark = d + '.EXECUTED'
  repo(d, 'a', 'c')
  const tree = git(d, 'rev-parse', 'HEAD^{tree}').trim()
  writeFileSync(d + '.commit', `tree ${tree}\nauthor t <t@e> 1700000000 +0000\ncommitter t <t@e> 1700000000 +0000\ngpgsig -----BEGIN PGP SIGNATURE-----\n \n AAAA\n -----END PGP SIGNATURE-----\n\nsigned\n`)
  const sha = git(d, 'hash-object', '-t', 'commit', '-w', d + '.commit').trim()
  git(d, 'update-ref', 'HEAD', sha)
  const evil = path.join(d, 'evil.sh'); writeFileSync(evil, `#!/bin/sh\ntouch ${mark}\nexit 1\n`); chmodSync(evil, 0o755)
  git(d, 'config', 'log.showSignature', 'true'); git(d, 'config', 'gpg.program', evil)
  const f = await inspectFolder(d)
  assert.equal(f.lastCommit?.subject, 'signed')
  assert.equal(existsSync(mark), false, 'a repository config must never make the scan execute a program')
}
// Iteration 2, errors finding 1: a PARTIAL CLONE whose promisor remote names a program as its upload-pack,
// HEAD at a commit missing from the object store. `git log -1` lazy-fetched the commit and ran the program
// five times — while scanning and while adding. Inspecting it, and scanning a folder holding it, run nothing.
{
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-partial-')))
  const mark = d + '.EXECUTED'
  const evil = d + '.uploadpack.sh'
  writeFileSync(evil, `#!/bin/sh\ntouch ${mark}\nexit 1\n`); chmodSync(evil, 0o755)
  const r = path.join(d, 'clone')
  mkdirSync(r)
  git(r, 'init', '-q', '-b', 'main')
  git(r, 'config', 'core.repositoryformatversion', '1')
  git(r, 'config', 'extensions.partialClone', 'origin')
  git(r, 'config', 'remote.origin.url', path.join(d, 'no-such-remote'))
  git(r, 'config', 'remote.origin.promisor', 'true')
  git(r, 'config', 'remote.origin.uploadpack', evil)
  writeFileSync(path.join(r, '.git', 'refs', 'heads', 'main'), '1234567890123456789012345678901234567890\n')
  const f = await inspectFolder(r)
  assert.equal(f.kind, 'repository')
  assert.equal(f.lastCommit, null, 'a commit that is not on disk is not fetched to answer')
  const s = await scanFolder(d)
  assert.deepEqual(s.candidates.map((c) => c.name), ['clone'])
  assert.equal(existsSync(mark), false, "a partial clone's remote.origin.uploadpack must never run on a scan or an inspect")
}
// A remote URL carrying a credential is never shown or kept with it.
{
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-cred-')))
  repo(d, 'a', 'c')
  git(d, 'remote', 'add', 'origin', 'https://x-access-token:ghp_FAKEFAKEFAKE@github.com/example/x.git')
  const f = await inspectFolder(d)
  assert.equal(f.remote, 'https://github.com/example/x.git', 'userinfo is stripped from an http(s) remote')
}
// A repository living in a folder whose NAME is usually noise (build, vendor, …) is still found;
// a folder the scan cannot read is COUNTED, so a partial list never reads as the whole folder.
{
  const r = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-names-')))
  repo(path.join(r, 'build'), 'package.json', 'a repo called build')
  repo(path.join(r, 'locked', 'inner'), 'package.json', 'behind a locked folder')
  chmodSync(path.join(r, 'locked'), 0o000)
  try {
    const s = await scanFolder(r)
    assert.deepEqual(s.candidates.map((c) => path.relative(r, c.path)), ['build'], 'a repository named like noise is still a repository')
    assert.equal(s.unreadable, 1, 'an unreadable folder is counted, not silently skipped')
  } finally { chmodSync(path.join(r, 'locked'), 0o755) }
}
// Breadth first: a bound stops DEEP exploration, never the top-level repositories next to each other.
{
  const r = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-bfs-')))
  for (const n of ['a', 'b', 'c']) {
    repo(path.join(r, n), 'package.json', n)
    for (let i = 0; i < 30; i++) mkdirSync(path.join(r, n, 'src', 'deep' + i), { recursive: true })
  }
  const s = await scanFolder(r, { maxDirs: 12 })
  assert.deepEqual(s.candidates.map((c) => c.name).sort(), ['a', 'b', 'c'], 'every top-level repository is found before any deep folder is walked')
  assert.equal(s.truncated, true)
}

console.log('PASS project discovery: inspect (repository, folder, worktree, missing, no exec from repo config, no credential), scan (grouping, noise, symlink boundary, bound, cancel, noise-named repo, unreadable counted, breadth first)')
