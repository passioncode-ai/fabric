// OF-12 (the operator, 2026-10-19, after Orca's «Trust the folder when Orca starts an agent»): a Claude Code session
// Fabric starts in a project's folder does not stop at «Do you trust this folder?». Fabric marks the folder trusted in
// Claude Code's own state before the start, the way Orca does: under Claude's lock, through a temporary file with the
// same mode, never touching anything but that folder's flag, and never writing a file it cannot read.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { mkdtempSync, writeFileSync, readFileSync, statSync, mkdirSync, symlinkSync, realpathSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'

const { trustFolderForClaude, claudeStateFile } = await import(path.resolve(import.meta.dirname, '../src/main/claudeTrust.ts'))

function home() {
  const h = mkdtempSync(path.join(tmpdir(), 'fabric-claude-trust-'))
  const folder = path.join(h, 'DATA', 'project')
  mkdirSync(folder, { recursive: true })
  return { h, folder }
}

test('the folder becomes trusted; every other key of the state and of the project stays as it was', async () => {
  const { h, folder } = home()
  const state = path.join(h, '.claude.json')
  writeFileSync(state, JSON.stringify({ numStartups: 7, projects: { [folder]: { allowedTools: ['x'] }, '/other': { hasTrustDialogAccepted: false } } }), { mode: 0o600 })
  assert.equal(await trustFolderForClaude(folder, { env: {}, home: h }), 'granted')
  const after = JSON.parse(readFileSync(state, 'utf8'))
  assert.equal(after.numStartups, 7)
  assert.deepEqual(after.projects[folder], { allowedTools: ['x'], hasTrustDialogAccepted: true })
  assert.deepEqual(after.projects['/other'], { hasTrustDialogAccepted: false })
  assert.equal(statSync(state).mode & 0o777, 0o600, 'the mode is kept')
  assert.equal(existsSync(state + '.lock'), false, 'the lock is released')
  assert.equal(await trustFolderForClaude(folder, { env: {}, home: h }), 'unchanged', 'a trusted folder is not written again')
})

test('the real path is trusted too, so a folder reached through a link is known', async () => {
  const { h, folder } = home()
  const link = path.join(h, 'link')
  symlinkSync(folder, link)
  writeFileSync(path.join(h, '.claude.json'), '{}')
  assert.equal(await trustFolderForClaude(link, { env: {}, home: h }), 'granted')
  const projects = JSON.parse(readFileSync(path.join(h, '.claude.json'), 'utf8')).projects
  assert.equal(projects[link].hasTrustDialogAccepted, true)
  assert.equal(projects[realpathSync.native(folder)].hasTrustDialogAccepted, true)
})

test('CLAUDE_CONFIG_DIR names the state file, and its .config.json wins when it exists', () => {
  const { h } = home()
  const dir = path.join(h, 'cfg')
  mkdirSync(dir)
  assert.equal(claudeStateFile({ env: { CLAUDE_CONFIG_DIR: dir }, home: h }), path.join(dir, '.claude.json'))
  writeFileSync(path.join(dir, '.config.json'), '{}')
  assert.equal(claudeStateFile({ env: { CLAUDE_CONFIG_DIR: dir }, home: h }), path.join(dir, '.config.json'))
  assert.equal(claudeStateFile({ env: {}, home: h }), path.join(h, '.claude.json'))
})

test('a missing, unreadable or held state is left alone and said so', async () => {
  const { h, folder } = home()
  assert.equal(await trustFolderForClaude(folder, { env: {}, home: h }), 'missing-config')
  writeFileSync(path.join(h, '.claude.json'), '{not json')
  assert.equal(await trustFolderForClaude(folder, { env: {}, home: h }), 'unreadable')
  assert.equal(readFileSync(path.join(h, '.claude.json'), 'utf8'), '{not json', 'nothing was written over it')
  writeFileSync(path.join(h, '.claude.json'), '{"projects": []}')
  assert.equal(await trustFolderForClaude(folder, { env: {}, home: h }), 'unreadable', 'projects that is not an object is refused')
  writeFileSync(path.join(h, '.claude.json'), '{}')
  mkdirSync(path.join(h, '.claude.json.lock'))
  assert.equal(await trustFolderForClaude(folder, { env: {}, home: h, lockWaitMs: 50 }), 'locked')
})
