// Which Project a coding agent's folder belongs to (ADR-0136 §1, wave 1 core): the exact real path, the longest
// admitted ancestor, or the main repository of a worktree. Pure — the git probe is injected.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { resolveProjectForFolder } = await import(path.resolve(import.meta.dirname, '../src/main/folderResolver.ts'))

const rows = [
  { projectId: 'p-fabric', path: '/Users/me/DATA/fabric' },
  { projectId: 'p-site', path: '/Users/me/DATA/site' },
  { projectId: 'p-theme', path: '/Users/me/DATA/site/packages/theme' }
]
const noGit = () => null

test('the exact admitted folder', () => {
  assert.deepEqual(resolveProjectForFolder('/Users/me/DATA/fabric', rows, noGit), { projectId: 'p-fabric', how: 'exact', root: '/Users/me/DATA/fabric' })
})

test('a subfolder resolves to the longest admitted ancestor, never a shorter one', () => {
  assert.deepEqual(resolveProjectForFolder('/Users/me/DATA/fabric/.claude/worktrees/x', rows, noGit),
    { projectId: 'p-fabric', how: 'ancestor', root: '/Users/me/DATA/fabric' })
  assert.equal(resolveProjectForFolder('/Users/me/DATA/site/packages/theme/src', rows, noGit).projectId, 'p-theme')
})

test('a sibling that only shares a prefix is not an ancestor', () => {
  assert.equal(resolveProjectForFolder('/Users/me/DATA/fabric-dashboards', rows, noGit).projectId, null)
})

test('a worktree outside every admitted folder resolves through its main repository', () => {
  const git = (p) => (p === '/tmp/wt/fix-1' ? '/Users/me/DATA/fabric/.git' : null)
  assert.deepEqual(resolveProjectForFolder('/tmp/wt/fix-1', rows, git), { projectId: 'p-fabric', how: 'worktree', root: '/Users/me/DATA/fabric' })
})

test('nothing matches: no project, and the folder is said back', () => {
  assert.deepEqual(resolveProjectForFolder('/Users/me/elsewhere', rows, noGit), { projectId: null, how: 'none', root: null })
})

test('a relative or empty folder is refused, not resolved against the process cwd', () => {
  assert.throws(() => resolveProjectForFolder('relative/path', rows, noGit), /absolute/)
  assert.throws(() => resolveProjectForFolder('', rows, noGit), /absolute/)
})
