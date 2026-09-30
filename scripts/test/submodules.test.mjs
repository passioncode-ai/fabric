// A submodule that is declared but not checked out is named, so gates can count what they cannot resolve.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { declaredSubmodules, uncheckedSubmodules, insideUnchecked } from '../lib/submodules.mjs'

test('declared, unchecked and containing submodules', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-submodules-'))
  try {
    assert.deepEqual(declaredSubmodules(root), [])
    writeFileSync(path.join(root, '.gitmodules'), '[submodule "workspace"]\n\tpath = workspace\n\turl = git@example.invalid:w.git\n[submodule "vendor/x"]\n\tpath = vendor/x\n')
    mkdirSync(path.join(root, 'workspace'))
    mkdirSync(path.join(root, 'vendor/x/.git'), { recursive: true })
    assert.deepEqual(declaredSubmodules(root), ['workspace', 'vendor/x'])
    assert.deepEqual(uncheckedSubmodules(root), ['workspace'], 'an empty directory is not a checkout')
    assert.equal(insideUnchecked('workspace/lib/shell.mjs', ['workspace']), 'workspace')
    assert.equal(insideUnchecked('workspace', ['workspace']), 'workspace')
    assert.equal(insideUnchecked('workspace-notes/a.md', ['workspace']), null, 'a sibling that shares the prefix is not inside')
    assert.equal(insideUnchecked('docs/workspace/a.md', ['workspace']), null)
    writeFileSync(path.join(root, 'workspace/.git'), 'gitdir: ../.git/modules/workspace\n')
    assert.deepEqual(uncheckedSubmodules(root), [], 'a gitfile marks a checked-out submodule')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
