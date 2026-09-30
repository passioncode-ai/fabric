import test from 'node:test'
import assert from 'node:assert/strict'
import {publicationHazards,publicationPointerDirty} from '../workspace-release.mjs'
import {receiptPath} from '../workspace-snapshot.mjs'

// `git status --porcelain` rows are `XY path`: X is the index, Y is the working tree.
const rows = lines => lines.join('\n')

test('an unstaged parent change is not a publication hazard', () => {
  // The snapshot is exported from a committed ref and the pin commit stages two paths by
  // name, so nothing in the working tree can reach the publication.
  assert.deepEqual(publicationHazards(rows([' M docs/vision.md',' M apps/desktop/src/main.ts'])), [])
  assert.deepEqual(publicationHazards(rows(['?? scratch.md','?? docs/evidence/plans/draft.md'])), [])
  assert.deepEqual(publicationHazards(rows([' D docs/gone.md'])), [])
})

test('a staged parent change IS a hazard, because the pin commit commits the whole index', () => {
  assert.deepEqual(publicationHazards(rows(['M  docs/vision.md'])), ['docs/vision.md'])
  assert.deepEqual(publicationHazards(rows(['A  secrets.txt'])), ['secrets.txt'])
  assert.deepEqual(publicationHazards(rows(['MM docs/vision.md'])), ['docs/vision.md'])
  assert.deepEqual(publicationHazards(rows(['R  old.md -> new.md'])), ['old.md -> new.md'])
})

test('the two paths the publication owns are never hazards on their own terms', () => {
  assert.deepEqual(publicationHazards(rows(['M  workspace'])), [])
  assert.deepEqual(publicationHazards(rows([`M  ${receiptPath}`])), [receiptPath])
  assert.deepEqual(publicationHazards(rows([`M  ${receiptPath}`]), {resume: true}), [])
})

test('a mixed tree reports only what can actually reach the publication', () => {
  const hazards = publicationHazards(rows([
    ' M docs/evidence/retro.md',
    '?? notes.txt',
    'M  package.json',
    'M  workspace',
    ' M CONTEXT.md'
  ]))
  assert.deepEqual(hazards, ['package.json'])
})

test('an empty tree is empty, and trailing newlines are not rows', () => {
  assert.deepEqual(publicationHazards(''), [])
  assert.deepEqual(publicationHazards('\n'), [])
  assert.deepEqual(publicationHazards(' M a.md\n'), [])
})

test('a publication is complete or not by its own two paths, not by the rest of the tree', () => {
  assert.equal(publicationPointerDirty(rows([' M docs/vision.md','?? notes.txt'])), false)
  assert.equal(publicationPointerDirty(rows(['M  workspace'])), true)
  assert.equal(publicationPointerDirty(rows([' M workspace'])), true)
  assert.equal(publicationPointerDirty(rows([`M  ${receiptPath}`])), true)
  assert.equal(publicationPointerDirty(''), false)
})

// R-007: the tests above drive a hand-written porcelain string, which proves the rule and
// not the format. This one reads the format from git itself, in a real repository.
test('the verdict holds against porcelain that git actually produced', async () => {
  const {mkdtempSync, writeFileSync, mkdirSync} = await import('node:fs')
  const {execFileSync} = await import('node:child_process')
  const {tmpdir} = await import('node:os')
  const {join} = await import('node:path')
  const repo = mkdtempSync(join(tmpdir(), 'fabric-guard-'))
  const git = (...args) => execFileSync('git', args, {cwd: repo, encoding: 'utf8',
    env: {...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@e', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@e'}})
  git('init', '-q', '-b', 'main')
  mkdirSync(join(repo, 'docs/evidence/specs'), {recursive: true})
  for (const file of ['docs/vision.md', 'package.json', 'docs/evidence/specs/keep.md'])
    writeFileSync(join(repo, file), 'seed\n')
  git('add', '.'); git('commit', '-qm', 'seed')

  writeFileSync(join(repo, 'docs/vision.md'), 'edited in flight\n')   // unstaged
  writeFileSync(join(repo, 'scratch.txt'), 'untracked\n')             // untracked
  assert.deepEqual(publicationHazards(git('status', '--porcelain')), [],
    'work in flight must not block a publication it cannot reach')

  writeFileSync(join(repo, 'package.json'), 'staged\n')
  git('add', 'package.json')                                          // staged
  assert.deepEqual(publicationHazards(git('status', '--porcelain')), ['package.json'],
    'a staged change would ride along inside the pin commit')

  // And the reason the staged case is a hazard, proven rather than asserted: a commit
  // that stages two paths by name still writes everything already in the index.
  writeFileSync(join(repo, 'docs/evidence/specs/keep.md'), 'receipt\n')
  git('add', 'docs/evidence/specs/keep.md')
  git('commit', '-qm', 'pin')
  const landed = git('show', '--name-only', '--format=', 'HEAD').split('\n').filter(Boolean)
  assert.deepEqual(landed.sort(), ['docs/evidence/specs/keep.md', 'package.json'],
    'the unrelated staged file landed in the pin commit — which is why it is refused')
})
