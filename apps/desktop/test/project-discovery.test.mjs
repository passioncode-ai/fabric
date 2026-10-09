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
import { lstat, open, readdir, readFile, stat } from 'node:fs/promises'

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
symlinkSync(path.join(root, 'notes', 'todo.md'), path.join(root, 'todo-link'))  // a link to a FILE: not a skipped folder

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

await assert.rejects(() => inspectFolder(path.join(root, 'missing')), /(^|: )folder-refused:missing: /)

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
assert.equal(scan.symlinks, 1, 'the symlinked folder the walk did not follow is counted; a link to a file is not a folder')
assert.ok(!scan.candidates.some((c) => c.path.startsWith(outside)), 'nothing outside the scanned root is reported')

// Bounds: a limit on visited folders stops the walk and SAYS so instead of returning a partial list as complete.
const bounded = await scanFolder(root, { maxDirs: 2 })
assert.equal(bounded.truncated, true, 'a walk stopped by its bound reports truncation')

// Cancellation: an aborted signal stops before the walk and says it was cancelled.
const ctl = new AbortController(); ctl.abort()
const cancelled = await scanFolder(root, { signal: ctl.signal })
assert.equal(cancelled.cancelled, true)
assert.equal(cancelled.candidates.length, 0)

await assert.rejects(() => scanFolder(path.join(root, 'missing')), /(^|: )folder-refused:missing: /)

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
// Iteration 2, docs finding 10: EVERY URL with a scheme loses its userinfo, not only http(s); the scp form
// `git@host:path` carries no secret and is kept as written.
{
  const { shownRemote } = await import(SRC)
  const cases = [
    ['ssh://user:ghp_TOKEN@github.com/example/x.git', 'ssh://github.com/example/x.git'],
    ['ssh://git@github.com:22/example/x.git', 'ssh://github.com:22/example/x.git'],
    ['git+https://u:secret@host.example/r.git', 'git+https://host.example/r.git'],
    ['git+ssh://u:secret@host.example/r.git', 'git+ssh://host.example/r.git'],
    ['HTTPS://u:p@ss@host.example/r.git', 'HTTPS://host.example/r.git'],
    ['ftp://anon:pw@host.example/r', 'ftp://host.example/r'],
    ['git://host.example/r.git', 'git://host.example/r.git'],
    ['https://host.example/path@not-userinfo/r.git', 'https://host.example/path@not-userinfo/r.git'],
    ['git@github.com:example/x.git', 'git@github.com:example/x.git'],
    ['/local/path/repo.git', '/local/path/repo.git']
  ]
  for (const [raw, shown] of cases) assert.equal(shownRemote(raw), shown, raw)
  assert.equal(shownRemote(null), null)
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

// ── iteration 2, errors finding 4 / 11: a hung filesystem cannot hang the scan, and a `.git` symlink is a repository
// No synchronous filesystem call anywhere in the module: one stuck `existsSync` froze Electron's main process.
{
  const { readFileSync: rf } = await import('node:fs')
  const src = rf(path.resolve(import.meta.dirname, '../src/main/projectDiscovery.ts'), 'utf8')
  assert.deepEqual(src.match(/\b\w+Sync\b/g) ?? [], [], 'projectDiscovery.ts makes no synchronous filesystem call')
}
// A repository whose `.git` is a SYMLINK to its git directory (kept elsewhere) is a repository, not a plain folder.
{
  const { renameSync } = await import('node:fs')
  const r = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-gitlink-')))
  repo(path.join(r, 'linked'), 'package.json', 'linked first')
  mkdirSync(path.join(r, '_store'))
  renameSync(path.join(r, 'linked', '.git'), path.join(r, '_store', 'linked.git'))
  symlinkSync(path.join(r, '_store', 'linked.git'), path.join(r, 'linked', '.git'))
  const f = await inspectFolder(path.join(r, 'linked'))
  assert.equal(f.kind, 'repository', 'a .git symlink to a git directory is a repository')
  assert.equal(f.git, true)
  assert.equal(f.lastCommit?.subject, 'linked first')
  const s = await scanFolder(r)
  assert.deepEqual(s.candidates.map((c) => c.name), ['linked'])
  // A dangling `.git` link is not a repository.
  mkdirSync(path.join(r, 'dangling'))
  symlinkSync(path.join(r, 'no-such-gitdir'), path.join(r, 'dangling', '.git'))
  assert.equal((await inspectFolder(path.join(r, 'dangling'))).kind, 'folder', 'a dangling .git link is not a repository')
}
// Injected filesystem calls that never answer (a hung network mount), so the timeouts are observed.
{
  const fsp = await import('node:fs/promises')
  const never = () => new Promise(() => {})
  const fsWith = (hang) => ({
    readdir: (p) => (hang.readdir?.(p) ? never() : fsp.readdir(p)),
    lstat: (p) => (hang.lstat?.(p) ? never() : fsp.lstat(p)),
    stat: (p) => (hang.stat?.(p) ? never() : fsp.stat(p)),
    readFile: (p, enc) => (hang.readFile?.(p) ? never() : fsp.readFile(p, enc))
  })
  const timedRun = async (fn) => { const t0 = Date.now(); const v = await fn(); return [v, Date.now() - t0] }

  // Stop returns at once while a folder read is stuck — not after the per-folder timeout.
  {
    const ctl = new AbortController()
    setTimeout(() => ctl.abort(), 100)
    const [s, ms] = await timedRun(() => scanFolder(root, { signal: ctl.signal, dirTimeoutMs: 60000, fs: fsWith({ readdir: (p) => p === path.join(root, 'alpha') }) }))
    assert.equal(s.cancelled, true, 'Stop during a stuck read is a cancelled scan')
    assert.equal(s.candidates.length, 0, 'a cancelled scan lists nothing')
    assert.ok(ms < 1500, `Stop returned in ${ms} ms while a read was stuck`)
  }
  // The deadline holds while a folder read is stuck: a truncated answer, on time.
  {
    const [s, ms] = await timedRun(() => scanFolder(root, { timeLimitMs: 200, dirTimeoutMs: 60000, fs: fsWith({ readdir: (p) => p === path.join(root, 'alpha') }) }))
    assert.equal(s.truncated, true, 'a scan stopped by its deadline says so')
    assert.equal(s.cancelled, false)
    assert.ok(ms < 1500, `the deadline returned in ${ms} ms while a read was stuck`)
  }
  // A stuck lstat of one entry is abandoned after the per-folder timeout and counted; the rest is found.
  {
    const [s, ms] = await timedRun(() => scanFolder(root, { dirTimeoutMs: 100, fs: fsWith({ lstat: (p) => p === path.join(root, 'beta') }) }))
    assert.ok(s.unreadable >= 1, 'an entry that could not be examined in time is counted')
    assert.ok(s.candidates.some((c) => c.name === 'alpha'), 'the rest of the folder is still scanned')
    assert.ok(!s.candidates.some((c) => c.path === path.join(root, 'beta')), 'the entry that never answered is not invented')
    assert.ok(ms < 5000, `a stuck lstat cost ${ms} ms`)
  }
  // A stuck `.git` probe inside a noise-named folder is abandoned and counted.
  {
    const r = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-probe-')))
    repo(path.join(r, 'build'), 'package.json', 'a repo called build')
    repo(path.join(r, 'ok'), 'package.json', 'ok')
    const s = await scanFolder(r, { dirTimeoutMs: 100, fs: fsWith({ lstat: (p) => p === path.join(r, 'build', '.git') }) })
    assert.deepEqual(s.candidates.map((c) => c.name), ['ok'])
    assert.equal(s.unreadable, 1, 'a .git probe that never answered is counted, not taken as "no repository"')
  }
  // Iteration 3 (docs finding 1, blocking): a repository the walk FOUND whose inspection throws or times
  // out was swallowed — not listed, `unreadable` unchanged — while ADR-0100 §3 promises it is said.
  {
    const r = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-inspect-fail-')))
    repo(path.join(r, 'ok'), 'package.json', 'ok')
    repo(path.join(r, 'stuck'), 'package.json', 'stuck')
    const s = await scanFolder(r, { dirTimeoutMs: 100, fs: fsWith({ stat: (p) => p === path.join(r, 'stuck') }) })
    assert.deepEqual(s.candidates.map((c) => c.name), ['ok'], 'the repository that could not be inspected is not invented')
    assert.equal(s.unreadable, 1, 'a repository whose inspection did not answer is COUNTED, never silently dropped')
  }
  // Iteration 3 (errors finding 5): eight repositories whose config includes a FIFO made each inspection
  // hang for the driver probe's hard-coded 5 s, one at a time inside the walk — 30 s, truncated, and the
  // healthy repository sorted after them never listed. Walk first, then inspect with bounded concurrency
  // under the scan's own git timeout.
  {
    const r = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-slow-')))
    for (let i = 0; i < 8; i++) {
      const d = path.join(r, `slow-${i}`)
      repo(d, 'package.json', `slow ${i}`)
      const fifo = path.join(r, `.fifo-${i}`)
      execFileSync('mkfifo', [fifo])
      git(d, 'config', 'include.path', fifo)
    }
    repo(path.join(r, 'zz-healthy'), 'package.json', 'healthy')
    const [s, ms] = await timedRun(() => scanFolder(r, { timeLimitMs: 8000, gitTimeoutMs: 300 }))
    const healthy = s.candidates.find((c) => c.name === 'zz-healthy')
    assert.ok(healthy, `the healthy repository was not listed (truncated: ${s.truncated}, ${ms} ms)`)
    assert.equal(healthy.lastCommit?.subject, 'healthy', 'and its facts were read')
    assert.equal(s.truncated, false, 'slow repositories did not exhaust the scan')
    assert.equal(s.candidates.filter((c) => c.name.startsWith('slow-')).length + s.unreadable, 8, 'every slow repository is listed or counted')
    assert.ok(ms < 6000, `the scan took ${ms} ms`)
  }
  // inspectFolder on a folder that never answers fails in time, and says why.
  {
    const [err, ms] = await timedRun(() => inspectFolder(root, { timeoutMs: 100, fs: fsWith({ stat: (p) => p === root }) }).then(() => null, (e) => e))
    assert.match(String(err), /folder-refused:timeout: /)
    assert.ok(ms < 1500)
  }
}

// ── iteration 3, errors finding 9: inspect and scan refusals reached a Russian window as English sentences.
// Each is a CODE the renderer can match: `folder-refused:<code>: <path>`.
{
  const { FolderRefused, asFolderRefusal } = await import(SRC)
  const { OutsideRoots } = await import(path.resolve(import.meta.dirname, '../src/main/files.ts'))
  const file = path.join(root, 'notes', 'todo.md')
  const codeOf = async (fn) => { try { await fn(); return 'resolved' } catch (e) { assert.ok(e instanceof FolderRefused, String(e)); return e.message } }
  assert.equal(await codeOf(() => inspectFolder(path.join(root, 'missing'))), `folder-refused:missing: ${path.join(root, 'missing')}`)
  assert.equal(await codeOf(() => inspectFolder(file)), `folder-refused:not-a-folder: ${file}`)
  assert.equal(await codeOf(() => scanFolder(file)), `folder-refused:not-a-folder: ${file}`, 'a scan of a file says not-a-folder, not "does not exist"')
  const out = asFolderRefusal(new OutsideRoots('/elsewhere'), '/elsewhere')
  assert.ok(out instanceof FolderRefused)
  assert.equal(out.message, 'folder-refused:outside: /elsewhere', "a folder outside the window's folders is a code")
  const other = new Error('boom')
  assert.equal(asFolderRefusal(other, '/x'), other, 'any other error passes through unchanged')
}

// ── 0.3.3 onboarding R2: a scanned project arrives with what its repository says it is.
{
  const { summaryFrom } = await import(SRC)
  // The manifest's one line wins over the README; package.json, then pyproject's [project] / [tool.poetry], then Cargo's [package].
  assert.equal(summaryFrom({ packageJson: '{"description":"A ledger for agent teams"}', readme: '# x\n\nThe README says more.' }), 'A ledger for agent teams')
  assert.equal(summaryFrom({ pyproject: '[build-system]\ndescription = "not this"\n[project]\nname = "x"\ndescription = "Reads mail for agents"\n' }), 'Reads mail for agents')
  assert.equal(summaryFrom({ pyproject: '[tool.poetry]\ndescription = \'Literal string\'\n' }), 'Literal string')
  assert.equal(summaryFrom({ cargo: '[package]\nname = "x"\ndescription = "A \\"quoted\\" crate"\n' }), 'A "quoted" crate')
  assert.equal(summaryFrom({ packageJson: '{ not json', readme: 'Falls back to the README.' }), 'Falls back to the README.', 'a broken package.json says nothing, the README still speaks')
  assert.equal(summaryFrom({ packageJson: '{"description":"   "}', readme: 'Blank descriptions do not count.' }), 'Blank descriptions do not count.')
  // The README's first PROSE paragraph: front matter, headings, badges, images, HTML, code and tables are not it.
  const readme = ['---', 'title: x', '---', '# Atlas', '', '[![CI](https://x/badge.svg)](https://x)', '<p align="center"><img src="a.png"></p>', '', '```sh', 'npm i', '```', '',
    'Atlas keeps **command access** without losing [context](https://x/ctx), for `teams`.', 'Second line of the same paragraph.', '', 'Another paragraph.'].join('\n')
  assert.equal(summaryFrom({ readme }), 'Atlas keeps command access without losing context, for teams. Second line of the same paragraph.')
  assert.equal(summaryFrom({ readme: '# Only a heading\n\n![logo](l.png)\n' }), null, 'a README with no prose says nothing; nothing is invented')
  assert.equal(summaryFrom({}), null)
  const long = 'word '.repeat(80).trim()
  const cut = summaryFrom({ readme: long })
  assert.ok(cut.length <= 240 && cut.endsWith('…') && !cut.includes('wo…'), 'a long paragraph is cut at a word, with an ellipsis: ' + cut)
  assert.equal(summaryFrom({ readme: 'Bidi ‮trick‬ and \u0007bell.' }), 'Bidi trick and bell.', 'control and text-direction characters are removed')
  // 0.3.3 verification, iteration 2, ER-1: unclosed markup does not make the stripping quadratic in the main process.
  for (const ch of ['<', '[', '![']) {
    const started = Date.now()
    summaryFrom({ readme: 'Words first ' + ch.repeat(60000) })
    assert.ok(Date.now() - started < 500, `${ch} × 60000 is stripped in bounded time (${Date.now() - started} ms)`)
  }

  // Through the real filesystem: inspect reads the folder's own files, and never follows a README link out of it.
  const r2 = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-summary-')))
  mkdirSync(path.join(r2, 'with-readme')); writeFileSync(path.join(r2, 'with-readme', 'README.md'), '# W\n\nWith a readme of its own.\n')
  mkdirSync(path.join(r2, 'with-manifest')); writeFileSync(path.join(r2, 'with-manifest', 'package.json'), '{"description":"From the manifest"}')
  writeFileSync(path.join(r2, 'with-manifest', 'README.md'), 'Not this one.\n')
  mkdirSync(path.join(r2, 'linked')); writeFileSync(path.join(outside, 'secret', 'NOTES.md'), 'Secret words outside the root.\n')
  symlinkSync(path.join(outside, 'secret', 'NOTES.md'), path.join(r2, 'linked', 'README.md'))
  mkdirSync(path.join(r2, 'silent'))
  assert.equal((await inspectFolder(path.join(r2, 'with-readme'))).summary, 'With a readme of its own.')
  assert.equal((await inspectFolder(path.join(r2, 'with-manifest'))).summary, 'From the manifest')
  assert.deepEqual([(await inspectFolder(path.join(r2, 'with-manifest'))).summaryFile, (await inspectFolder(path.join(r2, 'with-readme'))).summaryFile], ['package.json', 'README.md'], 'the source of the words is named (ER-5)')
  assert.equal((await inspectFolder(path.join(r2, 'silent'))).summaryFile, null)
  assert.equal((await inspectFolder(path.join(r2, 'linked'))).summary, null, 'a README that is a link is not followed')
  assert.equal((await inspectFolder(path.join(r2, 'silent'))).summary, null)
  // 0.3.3 verification ER-6: at most 64 KiB of a file is read, not the whole file cut afterwards.
  mkdirSync(path.join(r2, 'huge')); writeFileSync(path.join(r2, 'huge', 'README.md'), 'A huge readme.\n\n' + 'x'.repeat(8 * 1024 * 1024))
  const asked = []
  const counting = { readdir: (p) => readdir(p), lstat, stat, readFile: async (p, e) => { asked.push(['whole', p]); return readFile(p, e) },
    readHead: async (p, max) => { asked.push(['head', max]); const h = await open(p, 'r'); try { const b = Buffer.alloc(max); const { bytesRead } = await h.read(b, 0, max, 0); return b.subarray(0, bytesRead).toString('utf8') } finally { await h.close() } } }
  assert.equal((await inspectFolder(path.join(r2, 'huge'), { fs: counting })).summary, 'A huge readme.')
  assert.ok(asked.some(([k, m]) => k === 'head' && m === 64 * 1024), 'the summary reads a bounded head')
  assert.ok(!asked.some(([k, p]) => k === 'whole' && String(p).endsWith('README.md')), 'the README is never read whole')
}

console.log('PASS project discovery: summary (manifest, README prose, no link followed), inspect (repository, folder, worktree, missing, no exec from repo config incl. partial clone, no credential, .git symlink), scan (grouping, noise, symlink boundary + count, bound, cancel, noise-named repo, unreadable counted, breadth first, no sync fs, stuck read/lstat/probe vs Stop, deadline, timeout)')
