// The one hardened way to run git (gitRun.ts), driven against REAL repositories a hostile
// collaborator could have prepared. Each plant is a repository whose own configuration names a
// program; a read through gitRun must never run it (iteration 2, errors finding 1). The plants
// write a mark file when executed, so "not executed" is observed, not assumed.

import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const { gitRun } = await import(path.resolve(import.meta.dirname, '../src/main/gitRun.ts'))

const base = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-gitrun-')))
const mark = path.join(base, 'EXECUTED')
const evil = path.join(base, 'evil.sh')
// Echoes stdin through so a filter that DID run would still produce output; the mark is the evidence.
writeFileSync(evil, `#!/bin/sh\necho ran >> ${mark}\ncat\nexit 1\n`)
chmodSync(evil, 0o755)
const runs = () => {
  const n = existsSync(mark) ? readFileSync(mark, 'utf8').split('\n').filter(Boolean).length : 0
  rmSync(mark, { force: true })
  return n
}
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@e', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@e' }
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe', env }).toString()

/**
 * A partial clone whose promisor remote names a program as its upload-pack, with HEAD at a commit
 * that is not in the object store. Any read that needs that commit asks the promisor for it — a
 * "lazy fetch" — and git runs `remote.origin.uploadpack` to do so. The reviewer saw `git log -1`
 * run the script five times and `git status` three.
 */
function plantPartialClone(dir, uploadpack) {
  mkdirSync(dir, { recursive: true })
  git(dir, 'init', '-q', '-b', 'main')
  git(dir, 'config', 'core.repositoryformatversion', '1')
  git(dir, 'config', 'extensions.partialClone', 'origin')
  git(dir, 'config', 'remote.origin.url', path.join(base, 'no-such-remote'))
  git(dir, 'config', 'remote.origin.promisor', 'true')
  git(dir, 'config', 'remote.origin.uploadpack', uploadpack)
  writeFileSync(path.join(dir, '.git', 'refs', 'heads', 'main'), '1234567890123456789012345678901234567890\n')
}

// ── 1. partial clone: lazy fetch would run the repository's upload-pack
{
  const d = path.join(base, 'partial')
  plantPartialClone(d, evil)
  await assert.rejects(() => gitRun(d, ['log', '-1', '--format=%H%x00%s%x00%cI']), 'the missing commit is an error, not a fetch')
  assert.equal(runs(), 0, 'reading a partial clone must never run its remote.origin.uploadpack')
  await gitRun(d, ['status', '--porcelain=v1']).catch(() => undefined)
  assert.equal(runs(), 0, 'git status on a partial clone must never lazy-fetch through the repository config')
}

// ── 2. a filter driver defined by the repository itself: `git status` re-hashes a stat-dirty file through
// its clean filter. `.git/info/attributes` assigns it without a tracked file, so `--attr-source` alone does
// not close it.
{
  const d = path.join(base, 'filter')
  mkdirSync(d)
  git(d, 'init', '-q', '-b', 'main')
  writeFileSync(path.join(d, 'a.txt'), 'one\n')
  git(d, 'add', '.')
  git(d, 'commit', '-q', '-m', 'c')
  writeFileSync(path.join(d, '.git', 'info', 'attributes'), '* filter=evil\n')
  git(d, 'config', 'filter.evil.clean', evil)
  git(d, 'config', 'filter.evil.process', evil)
  // Same size, different content: git must read the file to know it changed.
  writeFileSync(path.join(d, 'a.txt'), 'two\n')
  const out = await gitRun(d, ['status', '--porcelain=v1'])
  assert.equal(runs(), 0, "a repository's own filter driver must never run on a read")
  assert.match(out, /a\.txt/, 'the change is still reported')

  // The operator's OWN filter (global config, e.g. git-lfs) is not the repository's to name and keeps working.
  const globalCfg = path.join(base, 'global.gitconfig')
  writeFileSync(globalCfg, `[filter "mine"]\n\tclean = ${evil}\n`)
  writeFileSync(path.join(d, '.git', 'info', 'attributes'), '* filter=mine\n')
  writeFileSync(path.join(d, 'a.txt'), 'six\n')
  const before = process.env.GIT_CONFIG_GLOBAL
  process.env.GIT_CONFIG_GLOBAL = globalCfg
  try {
    await gitRun(d, ['status', '--porcelain=v1'])
  } finally {
    if (before === undefined) delete process.env.GIT_CONFIG_GLOBAL
    else process.env.GIT_CONFIG_GLOBAL = before
  }
  assert.ok(runs() > 0, "the operator's global filter is left alone")
}

// ── 3. the original exploit (2026-09-01): core.fsmonitor in .git/config
{
  const d = path.join(base, 'fsmonitor')
  mkdirSync(d)
  git(d, 'init', '-q', '-b', 'main')
  writeFileSync(path.join(d, 'a.txt'), 'one\n')
  git(d, 'add', '.')
  git(d, 'commit', '-q', '-m', 'c')
  git(d, 'config', 'core.fsmonitor', evil)
  await gitRun(d, ['status', '--porcelain=v1'])
  assert.equal(runs(), 0, 'core.fsmonitor from the repository must never run')
}

// ── 4. an inherited GIT_DIR does not point the read at a different repository
{
  const a = path.join(base, 'env-a')
  const b = path.join(base, 'env-b')
  for (const [d, s] of [[a, 'from a'], [b, 'from b']]) {
    mkdirSync(d)
    git(d, 'init', '-q', '-b', 'main')
    writeFileSync(path.join(d, 'f'), s)
    git(d, 'add', '.')
    git(d, 'commit', '-q', '-m', s)
  }
  const before = process.env.GIT_DIR
  process.env.GIT_DIR = path.join(b, '.git')
  try {
    assert.equal((await gitRun(a, ['log', '-1', '--format=%s'])).trim(), 'from a', 'the repository read is the one asked for')
  } finally {
    if (before === undefined) delete process.env.GIT_DIR
    else process.env.GIT_DIR = before
  }
}

// ── 5. a SUBMODULE's own config (iteration 3, errors finding 1): `git status` in the superproject spawns a
// child status per submodule, and that child reads `.git/modules/<sub>/config` — where the superproject's
// driver neutralisation never looked. A filter defined there, assigned by the submodule's own
// info/attributes, with a stat-dirty file in the submodule, ran under a plain superproject status.
{
  const subSrc = path.join(base, 'sub-src')
  mkdirSync(subSrc)
  git(subSrc, 'init', '-q', '-b', 'main')
  writeFileSync(path.join(subSrc, 'f.txt'), 'one\n')
  git(subSrc, 'add', '.')
  git(subSrc, 'commit', '-q', '-m', 'sub')
  const sup = path.join(base, 'super')
  mkdirSync(sup)
  git(sup, 'init', '-q', '-b', 'main')
  git(sup, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', subSrc, 'sub')
  git(sup, 'commit', '-q', '-m', 'add sub')
  const modDir = path.join(sup, '.git', 'modules', 'sub')
  assert.ok(existsSync(path.join(modDir, 'config')), 'the plant has an absorbed submodule git dir')
  git(path.join(sup, 'sub'), 'config', 'filter.evil.clean', evil)
  git(path.join(sup, 'sub'), 'config', 'filter.evil.process', evil)
  // The submodule's own fsmonitor too: the child status must not run it either.
  git(path.join(sup, 'sub'), 'config', 'core.fsmonitor', evil)
  mkdirSync(path.join(modDir, 'info'), { recursive: true })
  writeFileSync(path.join(modDir, 'info', 'attributes'), '* filter=evil\n')
  writeFileSync(path.join(sup, 'sub', 'f.txt'), 'two\n')
  await gitRun(sup, ['status', '--porcelain=v1'])
  assert.equal(runs(), 0, "a submodule's own filter driver or fsmonitor must never run on a superproject read")
  await gitRun(sup, ['diff', '--stat']).catch(() => undefined)
  assert.equal(runs(), 0, "a superproject diff must never recurse into a submodule's drivers")

  // `-c diff.ignoreSubmodules=all` alone is only a DEFAULT: `submodule.<name>.ignore` — in the repository's
  // config or its tracked .gitmodules — outranks it (probed 2026-10-03: one run each for status and diff).
  // Only the command-line `--ignore-submodules=all` outranks the repository.
  git(sup, 'config', 'submodule.sub.ignore', 'none')
  await gitRun(sup, ['status', '--porcelain=v1'])
  assert.equal(runs(), 0, 'submodule.<name>.ignore=none in .git/config must not re-open the submodule')
  await gitRun(sup, ['diff', '--stat']).catch(() => undefined)
  assert.equal(runs(), 0, 'nor for a diff')
  git(sup, 'config', '--unset', 'submodule.sub.ignore')
  writeFileSync(path.join(sup, '.gitmodules'), `${readFileSync(path.join(sup, '.gitmodules'), 'utf8')}\tignore = none\n`)
  await gitRun(sup, ['status', '--porcelain=v1'])
  assert.equal(runs(), 0, 'ignore=none in the tracked .gitmodules must not re-open the submodule')
}

// ── 6. the caller's timeout bounds the WHOLE read, the driver probe included (iteration 3, errors finding
// 5): an `include.path` at a FIFO hung the probe for a hard-coded 5 s whatever the caller allowed.
{
  const d = path.join(base, 'fifo')
  mkdirSync(d)
  git(d, 'init', '-q', '-b', 'main')
  const fifo = path.join(base, 'fifo-config')
  execFileSync('mkfifo', [fifo])
  git(d, 'config', 'include.path', fifo)
  const t0 = Date.now()
  await assert.rejects(() => gitRun(d, ['log', '-1', '--format=%H'], { timeoutMs: 300 }))
  const ms = Date.now() - t0
  assert.ok(ms < 2000, `a 300 ms read of a repository whose config includes a FIFO took ${ms} ms`)
}

console.log('PASS gitRun: partial-clone lazy fetch, repository filter drivers (global kept), core.fsmonitor, inherited GIT_DIR, submodule config, one timeout for the whole read — no program from a repository config runs')
