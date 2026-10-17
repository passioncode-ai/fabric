// Which Project a coding agent's folder belongs to (ADR-0136 §1, wave 1 core): the exact real path, the longest
// admitted ancestor, or the main repository of a worktree. Pure — the git probe is injected, except where the
// default probe itself is the subject.
import path from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import test from 'node:test'

const { resolveProjectForFolder, gitCommonDir, normalizeRemoteKey } = await import(path.resolve(import.meta.dirname, '../src/main/folderResolver.ts'))

const rows = [
  { projectId: 'p-fabric', path: '/Users/me/DATA/fabric' },
  { projectId: 'p-site', path: '/Users/me/DATA/site' },
  { projectId: 'p-theme', path: '/Users/me/DATA/site/packages/theme' }
]
const noGit = () => null

test('the exact admitted folder', async () => {
  assert.deepEqual(await resolveProjectForFolder('/Users/me/DATA/fabric', rows, noGit), { projectId: 'p-fabric', how: 'exact', root: '/Users/me/DATA/fabric' })
})

test('a subfolder resolves to the longest admitted ancestor, never a shorter one', async () => {
  assert.deepEqual(await resolveProjectForFolder('/Users/me/DATA/fabric/.claude/worktrees/x', rows, noGit),
    { projectId: 'p-fabric', how: 'ancestor', root: '/Users/me/DATA/fabric' })
  assert.equal((await resolveProjectForFolder('/Users/me/DATA/site/packages/theme/src', rows, noGit)).projectId, 'p-theme')
})

test('a child whose name starts with two dots is inside the root, not a step out of it', async () => {
  assert.deepEqual(await resolveProjectForFolder('/Users/me/DATA/fabric/..cache', rows, noGit),
    { projectId: 'p-fabric', how: 'ancestor', root: '/Users/me/DATA/fabric' })
  assert.deepEqual(await resolveProjectForFolder('/Users/me/DATA/fabric/..', rows, noGit).then((m) => m.projectId), null)
})

test('an admitted path written with a trailing separator still matches, exactly and as an ancestor', async () => {
  const slashed = [{ projectId: 'p-fabric', path: '/Users/me/DATA/fabric/' }]
  assert.deepEqual(await resolveProjectForFolder('/Users/me/DATA/fabric', slashed, noGit), { projectId: 'p-fabric', how: 'exact', root: '/Users/me/DATA/fabric' })
  assert.equal((await resolveProjectForFolder('/Users/me/DATA/fabric/src', slashed, noGit)).how, 'ancestor')
})

test('a sibling that only shares a prefix is not an ancestor', async () => {
  assert.equal((await resolveProjectForFolder('/Users/me/DATA/fabric-dashboards', rows, noGit)).projectId, null)
})

test('a worktree outside every admitted folder resolves through its main repository', async () => {
  const git = async (p) => (p === '/tmp/wt/fix-1' ? '/Users/me/DATA/fabric/.git' : null)
  assert.deepEqual(await resolveProjectForFolder('/tmp/wt/fix-1', rows, git), { projectId: 'p-fabric', how: 'worktree', root: '/Users/me/DATA/fabric' })
})

test('nothing matches: no project, and the folder is said back', async () => {
  assert.deepEqual(await resolveProjectForFolder('/Users/me/elsewhere', rows, noGit), { projectId: null, how: 'none', root: null })
})

test('a relative or empty folder is refused, not resolved against the process cwd', async () => {
  await assert.rejects(() => resolveProjectForFolder('relative/path', rows, noGit), /absolute/)
  await assert.rejects(() => resolveProjectForFolder('', rows, noGit), /absolute/)
})

test('the default worktree probe is asynchronous (the main process never blocks on git) and never rejects', async () => {
  const here = gitCommonDir(import.meta.dirname)
  assert.ok(here instanceof Promise, 'gitCommonDir returns a promise, not a synchronous answer')
  assert.equal(path.basename(await here), '.git', 'this checkout is a git folder: its common directory is a .git')
  assert.equal(await gitCommonDir(mkdtempSync(path.join(tmpdir(), 'fabric-nogit-'))), null)
  assert.equal(await gitCommonDir('/no/such/folder/anywhere'), null)
})

test('remote identity folds scp and URL forms, strips credentials, and refuses local paths', () => {
  const expected = 'github.com/passioncode-ai/fabric'
  assert.equal(normalizeRemoteKey('git@github.com:passioncode-ai/fabric.git'), expected)
  assert.equal(normalizeRemoteKey('ssh://git@github.com/passioncode-ai/fabric.git'), expected)
  assert.equal(normalizeRemoteKey('https://token:secret@github.com/passioncode-ai/fabric.git'), expected)
  assert.equal(normalizeRemoteKey('git+https://token@github.com/passioncode-ai/fabric.git'), expected)
  assert.equal(normalizeRemoteKey('https://github.com:8443/passioncode-ai/fabric/'), 'github.com:8443/passioncode-ai/fabric')
  assert.equal(normalizeRemoteKey('file:///tmp/fabric'), null)
  assert.equal(normalizeRemoteKey('/tmp/fabric'), null)
  assert.equal(normalizeRemoteKey('https://token:secret@github.com/passioncode-ai/fabric.git').includes('secret'), false)
})

test('a second clone resolves by its normalized remote after exact, ancestor and worktree identity', async () => {
  const admitted = [{ projectId: 'p-fabric', path: '/Users/me/DATA/fabric', remoteKey: 'github.com/passioncode-ai/fabric' }]
  const remoteOf = async (folder) => folder === '/tmp/clone' ? 'git@github.com:passioncode-ai/fabric.git' : null
  assert.deepEqual(await resolveProjectForFolder('/tmp/clone', admitted, noGit, remoteOf), {
    projectId: 'p-fabric', how: 'remote', root: '/Users/me/DATA/fabric', remoteKey: 'github.com/passioncode-ai/fabric'
  })
})

test('a remote stored on an admitted row is used without another git read; a missing one is filled lazily', async () => {
  const admitted = [
    { projectId: 'p-fabric', path: '/Users/me/DATA/fabric', remoteKey: 'github.com/passioncode-ai/fabric' },
    { projectId: 'p-other', path: '/Users/me/DATA/other' }
  ]
  const reads = []
  const remoteOf = async (folder) => {
    reads.push(folder)
    return folder === '/tmp/clone' || folder === '/Users/me/DATA/other' ? 'https://github.com/passioncode-ai/other.git' : null
  }
  const match = await resolveProjectForFolder('/tmp/clone', admitted, noGit, remoteOf)
  assert.equal(match.projectId, 'p-other')
  assert.deepEqual(reads.sort(), ['/Users/me/DATA/other', '/tmp/clone'].sort())
})

test('two projects claiming one longest folder or one remote are ambiguity, never a guess', async () => {
  const duplicatePaths = [
    { projectId: 'p-one', path: '/Users/me/DATA/shared' },
    { projectId: 'p-two', path: '/Users/me/DATA/shared' }
  ]
  const pathMatch = await resolveProjectForFolder('/Users/me/DATA/shared/src', duplicatePaths, noGit)
  assert.deepEqual([pathMatch.projectId, pathMatch.how, pathMatch.candidates], [null, 'ambiguous', ['p-one', 'p-two']])

  const duplicateRemotes = [
    { projectId: 'p-one', path: '/Users/me/DATA/one', remoteKey: 'github.com/acme/shared' },
    { projectId: 'p-two', path: '/Users/me/DATA/two', remoteKey: 'github.com/acme/shared' }
  ]
  const remoteMatch = await resolveProjectForFolder('/tmp/clone', duplicateRemotes, noGit, async () => 'git@github.com:acme/shared.git')
  assert.deepEqual([remoteMatch.projectId, remoteMatch.how, remoteMatch.candidates], [null, 'ambiguous', ['p-one', 'p-two']])
})
