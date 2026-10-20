// 0.3.7 review PL-4 (DEC-0092): `fabric.project.resolve` needs to tell "this folder is not in Git" from "Git could
// not be read". Real git against real folders for the first; a fake git on PATH for a probe that hangs or fails.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'

const { readGitFacts } = await import(path.resolve(import.meta.dirname, '../src/main/gitFacts.ts'))

const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-git-facts-')))
const git = (...args) => execFileSync('git', args, { stdio: 'ignore' })

test('a folder outside Git, a bare repository and a removed folder are "none"', async () => {
  const plain = path.join(root, 'plain'); mkdirSync(plain)
  assert.deepEqual(await readGitFacts(plain), { kind: 'none' })
  git('init', '-q', '--bare', path.join(root, 'bare.git'))
  assert.deepEqual(await readGitFacts(path.join(root, 'bare.git')), { kind: 'none' })
  assert.deepEqual(await readGitFacts(path.join(root, 'gone')), { kind: 'none' })
})

test('a repository answers its top level, common dir and origin; a subfolder answers its repository', async () => {
  const repo = path.join(root, 'repo'); mkdirSync(path.join(repo, 'sub'), { recursive: true })
  git('init', '-q', repo)
  assert.deepEqual(await readGitFacts(path.join(repo, 'sub')), { kind: 'git', toplevel: repo, commonDir: path.join(repo, '.git'), origin: null })
  git('-C', repo, 'remote', 'add', 'origin', 'git@github.com:example-org/repo.git')
  assert.deepEqual(await readGitFacts(repo), { kind: 'git', toplevel: repo, commonDir: path.join(repo, '.git'), origin: 'git@github.com:example-org/repo.git' })
})

test('a probe that hangs past its deadline, fails otherwise, or finds no git is "unreadable", never "none"', { timeout: 20_000 }, async () => {
  const bin = path.join(root, 'bin'); mkdirSync(bin)
  const fake = (body) => { writeFileSync(path.join(bin, 'git'), `#!/bin/sh\n${body}\n`); chmodSync(path.join(bin, 'git'), 0o755) }
  const saved = process.env.PATH
  try {
    process.env.PATH = `${bin}:/usr/bin:/bin`
    fake('sleep 20')
    const t0 = Date.now()
    const hung = await readGitFacts(root, { deadlineMs: 300 })
    assert.equal(hung.kind, 'unreadable')
    assert.ok(Date.now() - t0 < 2000, 'the deadline held')
    fake('echo "fatal: detected dubious ownership in repository" >&2; exit 128')
    assert.equal((await readGitFacts(root)).kind, 'unreadable')
    fake('echo "/r"; echo "/r/.git"; [ "$3" = config ] && sleep 20; exit 0')
    assert.equal((await readGitFacts(root, { deadlineMs: 300 })).kind, 'unreadable', 'an origin that cannot be read is not "no origin"')
    process.env.PATH = path.join(root, 'empty-bin')
    assert.equal((await readGitFacts(root)).kind, 'unreadable', 'without git nothing is known')
  } finally {
    process.env.PATH = saved
  }
})

test('git speaks the C locale: a localized "not a git repository" is still "none"', async () => {
  const plain = path.join(root, 'plain-locale'); mkdirSync(plain)
  const saved = { LANG: process.env.LANG, LC_ALL: process.env.LC_ALL, LANGUAGE: process.env.LANGUAGE }
  try {
    Object.assign(process.env, { LANG: 'ru_RU.UTF-8', LC_ALL: 'ru_RU.UTF-8', LANGUAGE: 'ru' })
    assert.deepEqual(await readGitFacts(plain), { kind: 'none' })
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  }
})

test('a GIT_DIR in Fabric\'s environment does not answer for every folder', async () => {
  const plain = path.join(root, 'plain-gitdir'); mkdirSync(plain)
  const saved = process.env.GIT_DIR
  try {
    process.env.GIT_DIR = path.join(root, 'repo', '.git')
    assert.deepEqual(await readGitFacts(plain), { kind: 'none' })
  } finally {
    if (saved === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = saved
  }
})

writeFileSync(path.join(root, '.keep'), '')

test('a repository under a folder Git may not enter is "unreadable", never "none" (0.3.7 i2 ER-2)', async () => {
  const locked = path.join(root, 'locked'); const repo = path.join(locked, 'repo'); mkdirSync(repo, { recursive: true })
  git('init', '-q', repo)
  chmodSync(locked, 0o000)
  try {
    const read = await readGitFacts(repo)
    assert.equal(read.kind, 'unreadable')
  } finally {
    chmodSync(locked, 0o755)
  }
})
