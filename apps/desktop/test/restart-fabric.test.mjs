// The 0.3.18 review, iteration 1, UX-3: «Перезапустить Fabric» through launchd starts the service's copy, which launchd
// starts in the background; a note in the data folder tells that start the person asked for its window. The note is
// read once (taken), and a note that cannot be read is no request.
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { RESTART_OUTCOME_FILE, RESTART_WINDOW_FILE, askRestartWindow, takeRestartOutcome, takeRestartWindow } from '../src/main/restartFabric.ts'
import { APP_BUNDLE_ID, restartPlan } from '../src/shared/loginItem.ts'

test('UX-3: the restart note is read once and then gone', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-restart-'))
  try {
    assert.equal(takeRestartWindow(dir), null)
    assert.equal(askRestartWindow(dir, 1234), true)
    assert.equal(takeRestartWindow(dir), 1234)
    assert.equal(existsSync(path.join(dir, RESTART_WINDOW_FILE)), false)
    assert.equal(takeRestartWindow(dir), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('UX-3: a note that is not a time is no request, and is removed', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-restart-'))
  try {
    writeFileSync(path.join(dir, RESTART_WINDOW_FILE), 'garbage')
    assert.equal(takeRestartWindow(dir), null)
    assert.equal(existsSync(path.join(dir, RESTART_WINDOW_FILE)), false)
    assert.equal(askRestartWindow(path.join(dir, 'missing', 'folder'), 1), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// The 0.3.18 review, iteration 2, ER-15: the helper that outlives Fabric is run for real, with stand-ins for `launchctl`
// and `open` first on its PATH. A refused kickstart falls back to opening the app by its id and leaves a note the next
// start records; a kickstart that works leaves nothing.
function runHelper({ kickstartExit, openExit }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-restart-helper-'))
  const bin = path.join(dir, 'bin')
  mkdirSync(bin)
  const calls = path.join(dir, 'calls')
  for (const [name, code] of [['launchctl', kickstartExit], ['open', openExit]]) {
    writeFileSync(path.join(bin, name), `#!/bin/sh\necho "${name} $*" >> "${calls}"\nexit ${code}\n`)
    chmodSync(path.join(bin, name), 0o755)
  }
  const gone = spawnSync('/usr/bin/true').pid
  const plan = restartPlan({ platform: 'darwin', packaged: true, ownsService: true, serviceOn: true, systemOn: true, pid: gone, outcomeFile: path.join(dir, RESTART_OUTCOME_FILE) })
  assert.equal(plan.kind, 'launchd')
  const run = spawnSync(plan.command, plan.args, { env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` }, encoding: 'utf8' })
  const read = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : '')
  return { dir, status: run.status, calls: read(calls), outcome: takeRestartOutcome(dir), uid: String(process.getuid()) }
}

test('ER-15: a kickstart that works starts the board\'s job and leaves no note', { skip: process.platform === 'win32' }, () => {
  const r = runHelper({ kickstartExit: 0, openExit: 0 })
  try {
    assert.equal(r.calls, `launchctl kickstart gui/${r.uid}/ai.passioncode.desktop.board\n`)
    assert.equal(r.outcome, null)
  } finally { rmSync(r.dir, { recursive: true, force: true }) }
})

test('ER-15: a refused kickstart opens the app by its id, and the next start reads why', { skip: process.platform === 'win32' }, () => {
  const r = runHelper({ kickstartExit: 113, openExit: 0 })
  try {
    assert.equal(r.calls, `launchctl kickstart gui/${r.uid}/ai.passioncode.desktop.board\nopen -b ${APP_BUNDLE_ID}\n`)
    assert.deepEqual(r.outcome, ['kickstart 113'])
    assert.equal(takeRestartOutcome(r.dir), null, 'the note is read once')
  } finally { rmSync(r.dir, { recursive: true, force: true }) }
})

test('ER-15: when the open fails too, both refusals are in the note', { skip: process.platform === 'win32' }, () => {
  const r = runHelper({ kickstartExit: 5, openExit: 1 })
  try {
    assert.deepEqual(r.outcome, ['kickstart 5', 'open 1'])
  } finally { rmSync(r.dir, { recursive: true, force: true }) }
})

test('ER-15: the id the restart opens is the app\'s own', () => {
  const yml = readFileSync(path.join(import.meta.dirname, '../electron-builder.yml'), 'utf8')
  assert.match(yml, new RegExp(`^appId: ${APP_BUNDLE_ID.replaceAll('.', '\\.')}$`, 'm'))
})

// The 0.3.18 review, iteration 2, UX-15: «Перезапустить Fabric» ends every terminal Fabric hosts, so with live consoles
// it asks once, naming how many end, and Cancel is the default; with none it restarts at once.
test('UX-15: with live consoles the restart asks first, Cancel the default; with none it does not ask', async () => {
  const { restartConfirmation } = await import('../src/main/restartFabric.ts')
  const { translator } = await import('../src/renderer/src/i18n/translate.ts')
  assert.equal(restartConfirmation(0, translator('ru'), 'ru'), null)
  const ru = restartConfirmation(3, translator('ru'), 'ru')
  assert.ok(ru)
  assert.equal(ru.buttons.length, 2)
  assert.equal(ru.defaultId, ru.cancelId, 'Cancel is the default answer')
  assert.notEqual(ru.restartId, ru.cancelId)
  assert.match(ru.detail, /3 консоли агентов/)
  assert.match(restartConfirmation(1, translator('ru'), 'ru').detail, /1 консоль агента/)
  assert.match(restartConfirmation(5, translator('ru'), 'ru').detail, /5 консолей агентов/)
  const en = restartConfirmation(1, translator('en'), 'en')
  assert.match(en.detail, /1 agent console /)
  assert.match(restartConfirmation(2, translator('en'), 'en').detail, /2 agent consoles /)
  assert.ok(!/\{count\}|restart\.confirm/.test(JSON.stringify([ru, en])), 'every text is filled in')
})
