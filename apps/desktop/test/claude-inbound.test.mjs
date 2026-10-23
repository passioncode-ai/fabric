// CO-407: Claude Code's crossSessionInbound, set and removed by the person's switch in Settings; other keys are kept.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, readFileSync, statSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'

const { readInbound, setInbound, claudeSettingsFile } = await import(path.resolve(import.meta.dirname, '../src/main/claudeInbound.ts'))

test('the file is Claude Code\'s user settings, or the one CLAUDE_CONFIG_DIR names', () => {
  assert.equal(claudeSettingsFile({}, '/home/x'), '/home/x/.claude/settings.json')
  assert.equal(claudeSettingsFile({ CLAUDE_CONFIG_DIR: '/cfg' }, '/home/x'), '/cfg/settings.json')
})

test('on writes accept and keeps every other key and the mode; off removes it; a missing file stays missing when off', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'inbound-'))
  const file = path.join(dir, 'settings.json')
  writeFileSync(file, JSON.stringify({ model: 'opus', permissions: { allow: ['x'] } }), { mode: 0o640 })
  assert.deepEqual(readInbound(file), { accepting: false, value: null, file })
  assert.deepEqual(setInbound(true, file), { accepting: true, value: 'accept', file })
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { model: 'opus', permissions: { allow: ['x'] }, crossSessionInbound: 'accept' })
  assert.equal(statSync(file).mode & 0o777, 0o640)
  assert.deepEqual(setInbound(false, file), { accepting: false, value: null, file })
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { model: 'opus', permissions: { allow: ['x'] } })
  const none = path.join(dir, 'none', 'settings.json')
  assert.deepEqual(setInbound(false, none), { accepting: false, value: null, file: none })
  assert.equal(existsSync(none), false, 'turning off creates nothing')
  assert.deepEqual(setInbound(true, none), { accepting: true, value: 'accept', file: none })
})

test('a file that is not a JSON object is never written over', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'inbound-'))
  const file = path.join(dir, 'settings.json')
  writeFileSync(file, '{ broken')
  assert.deepEqual(setInbound(true, file), { unreadable: true, file })
  assert.equal(readFileSync(file, 'utf8'), '{ broken')
})
