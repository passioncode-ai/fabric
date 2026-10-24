// CO-407: Claude Code's crossSessionInbound, set and removed by the person's switch in Settings; other keys are kept.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, readFileSync, statSync, existsSync, symlinkSync, lstatSync, mkdirSync, chmodSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'

const { readInbound, setInbound, claudeSettingsFile } = await import(path.resolve(import.meta.dirname, '../src/main/claudeInbound.ts'))

test('the file is Claude Code\'s user settings, or the one CLAUDE_CONFIG_DIR names', () => {
  assert.equal(claudeSettingsFile({}, '/home/x'), '/home/x/.claude/settings.json')
  assert.equal(claudeSettingsFile({ CLAUDE_CONFIG_DIR: '/cfg' }, '/home/x'), '/cfg/settings.json')
})

test('on writes accept and keeps every other key and the mode; off removes it; a missing file stays missing when off', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'inbound-'))
  const file = path.join(dir, 'settings.json')
  writeFileSync(file, JSON.stringify({ model: 'opus', permissions: { allow: ['x'] } }), { mode: 0o640 })
  assert.deepEqual(readInbound(file), { accepting: false, value: null, file })
  assert.deepEqual(await setInbound(true, file), { accepting: true, value: 'accept', file })
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { model: 'opus', permissions: { allow: ['x'] }, crossSessionInbound: 'accept' })
  assert.equal(statSync(file).mode & 0o777, 0o640)
  assert.deepEqual(await setInbound(false, file), { accepting: false, value: null, file })
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { model: 'opus', permissions: { allow: ['x'] } })
  const none = path.join(dir, 'none', 'settings.json')
  assert.deepEqual(await setInbound(false, none), { accepting: false, value: null, file: none })
  assert.equal(existsSync(none), false, 'turning off creates nothing')
  assert.deepEqual(await setInbound(true, none), { accepting: true, value: 'accept', file: none })
})

test('a file that is not a JSON object is never written over', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'inbound-'))
  const file = path.join(dir, 'settings.json')
  writeFileSync(file, '{ broken')
  assert.deepEqual(await setInbound(true, file), { unreadable: true, file })
  assert.equal(readFileSync(file, 'utf8'), '{ broken')
})

// 0.3.12 review ER-7: the write follows claudeTrust.ts, Claude's lock, a symlink kept, no temporary file left.
test('a symlinked settings file stays a link: its target is written', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'inbound-'))
  const real = path.join(dir, 'dotfiles', 'claude-settings.json')
  mkdirSync(path.dirname(real))
  writeFileSync(real, JSON.stringify({ model: 'opus' }), { mode: 0o640 })
  const file = path.join(dir, 'settings.json')
  symlinkSync(real, file)
  assert.deepEqual(await setInbound(true, file), { accepting: true, value: 'accept', file })
  assert.equal(lstatSync(file).isSymbolicLink(), true, 'the link is kept')
  assert.deepEqual(JSON.parse(readFileSync(real, 'utf8')), { model: 'opus', crossSessionInbound: 'accept' })
  assert.equal(statSync(real).mode & 0o777, 0o640)
  assert.deepEqual(readdirSync(dir).sort(), ['dotfiles', 'settings.json'])
  assert.deepEqual(readdirSync(path.dirname(real)), ['claude-settings.json'], 'no temporary file left')
})

// 0.3.12 review i3 ER-8: a link whose target does not exist (a dotfiles checkout not there yet) is never written over.
test('a dangling symlinked settings file stays a link: nothing is written, and the answer says why', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'inbound-'))
  const real = path.join(dir, 'dotfiles', 'claude-settings.json')
  const file = path.join(dir, 'settings.json')
  symlinkSync(real, file)
  const answer = await setInbound(true, file)
  assert.deepEqual(answer, { accepting: false, value: null, file, notSaved: { reason: 'write-failed', code: 'ENOENT-link' } })
  assert.equal(lstatSync(file).isSymbolicLink(), true, 'the link is kept')
  assert.equal(existsSync(real), false, 'its target is not created')
  assert.deepEqual(readdirSync(dir).sort(), ['settings.json'], 'no temporary file and no lock left')
})

test('Claude holding its lock: nothing is written, and the answer says so beside what the file holds', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'inbound-'))
  const file = path.join(dir, 'settings.json')
  writeFileSync(file, JSON.stringify({ model: 'opus' }))
  mkdirSync(`${file}.lock`)
  assert.deepEqual(await setInbound(true, file, { lockWaitMs: 50 }), { accepting: false, value: null, file, notSaved: { reason: 'locked' } })
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { model: 'opus' })
  assert.equal(existsSync(`${file}.lock`), true, 'Claude\'s lock is not taken from it')
})

test('a write that fails is not-saved with its code, not unreadable, and leaves no temporary file', { skip: process.getuid?.() === 0 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'inbound-'))
  const file = path.join(dir, 'settings.json')
  writeFileSync(file, JSON.stringify({ model: 'opus' }))
  // The folder takes no new file: the lock and the temporary file cannot be made beside the settings file.
  chmodSync(dir, 0o500)
  try {
    const r = await setInbound(true, file, { lockWaitMs: 50 })
    assert.equal(r.unreadable, undefined)
    assert.equal(r.accepting, false)
    // 0.3.12 review i2 ER-1: a lock folder Fabric cannot make is not Claude holding its lock.
    assert.deepEqual(r.notSaved, { reason: 'write-failed', code: 'EACCES' }, 'a refused lock is write-failed with its code, never locked')
  } finally {
    chmodSync(dir, 0o700)
  }
  assert.deepEqual(readdirSync(dir), ['settings.json'])
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { model: 'opus' })
})

test('a failed write under the lock is write-failed with the system\'s code, the lock released and no temporary file left', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'inbound-'))
  // The real file's name leaves room for Claude's lock (`<name>.lock`) but not for the temporary file beside it, so
  // the lock is taken and the write under it is refused by the system (ENAMETOOLONG).
  const real = path.join(dir, 'dotfiles', `${'s'.repeat(220)}.json`)
  mkdirSync(path.dirname(real))
  writeFileSync(real, JSON.stringify({ model: 'opus' }))
  const file = path.join(dir, 'settings.json')
  symlinkSync(real, file)
  assert.deepEqual(await setInbound(true, file, { lockWaitMs: 50 }), { accepting: false, value: null, file, notSaved: { reason: 'write-failed', code: 'ENAMETOOLONG' } })
  assert.deepEqual(readdirSync(path.dirname(real)), [path.basename(real)], 'no temporary file and no lock left')
  assert.deepEqual(JSON.parse(readFileSync(real, 'utf8')), { model: 'opus' })
})

// 0.3.12 review i2 ER-10: Claude Code locks through proper-lockfile, which resolves the real path first.
test('a symlinked settings file is locked at its real path, where Claude Code locks it', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'inbound-'))
  const real = path.join(dir, 'dotfiles', 'claude-settings.json')
  mkdirSync(path.dirname(real))
  writeFileSync(real, JSON.stringify({ model: 'opus' }))
  const file = path.join(dir, 'settings.json')
  symlinkSync(real, file)
  // Claude holds its lock on the real path: Fabric waits and answers locked, writing nothing.
  mkdirSync(`${real}.lock`)
  assert.deepEqual(await setInbound(true, file, { lockWaitMs: 50 }), { accepting: false, value: null, file, notSaved: { reason: 'locked' } })
  assert.deepEqual(JSON.parse(readFileSync(real, 'utf8')), { model: 'opus' })
  assert.equal(existsSync(`${file}.lock`), false, 'no lock is made beside the link')
})
