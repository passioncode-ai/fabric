// CO-492: a Mac whose Docker is Colima is told about Colima, never «open OrbStack or Docker Desktop»; every other Mac,
// Windows and Linux keep their words. The keys exist in both locales.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const src = (p) => path.resolve(import.meta.dirname, '../src', p)
const { platformKey, startupWaitLines, stackHealthView } = await import(src('shared/stackWatch.ts'))
const { classifyStartupFailure, diskLowLine, startupDialog } = await import(src('shared/startupFailure.ts'))
const { en } = await import(src('renderer/src/i18n/en.ts'))
const { ru } = await import(src('renderer/src/i18n/ru.ts'))

const KEYS = ['startup.wait.docker', 'stack.health.docker', 'startup.diskLow', 'startup.stack-start-timed-out.remedy', 'startup.stack-would-not-start.remedy']

test('the key follows the runtime on macOS only', () => {
  assert.equal(platformKey('stack.health.docker', 'darwin', 'Colima'), 'stack.health.docker.colima')
  assert.equal(platformKey('stack.health.docker', 'darwin', 'OrbStack'), 'stack.health.docker')
  assert.equal(platformKey('stack.health.docker', 'darwin'), 'stack.health.docker')
  assert.equal(platformKey('stack.health.docker', 'win32', 'Colima'), 'stack.health.docker.win32')
  assert.equal(platformKey('stack.health.docker', 'linux', 'Colima'), 'stack.health.docker.linux')
})

test('every Colima key is in both locales, names Colima and never OrbStack or Docker Desktop', () => {
  for (const k of KEYS) for (const [name, table] of [['en', en], ['ru', ru]]) {
    const text = table[`${k}.colima`]
    assert.equal(typeof text, 'string', `${name} ${k}.colima`)
    assert.match(text, /Colima/, `${name} ${k}.colima`)
    assert.doesNotMatch(text, /OrbStack|Docker Desktop|—/, `${name} ${k}.colima`)
  }
})

test('the startup failure, its dialog and the disk line say Colima on a Colima Mac', () => {
  const timedOut = Object.assign(new Error('spawnSync supabase ETIMEDOUT'), { code: 'ETIMEDOUT' })
  const f = classifyStartupFailure(timedOut, 'darwin', 'Colima')
  assert.equal(f.cause, 'stack-start-timed-out')
  assert.equal(f.remedyKey, 'startup.stack-start-timed-out.remedy.colima')
  assert.match(f.remedy, /Colima/)
  assert.doesNotMatch(classifyStartupFailure(timedOut, 'darwin', null).remedy, /Colima/)
  assert.equal(classifyStartupFailure(timedOut, 'win32', 'Colima').remedyKey, 'startup.stack-start-timed-out.remedy.win32')
  assert.equal(diskLowLine(f, { freeDiskBytes: 1e9, platform: 'darwin', runtime: 'Colima', locale: 'en' })?.key, 'startup.diskLow.colima')
  assert.equal(diskLowLine(f, { freeDiskBytes: 1e9, platform: 'darwin', locale: 'en' })?.key, 'startup.diskLow')
  const say = (key) => ru[key] ?? key
  const plan = startupDialog(f, { retryable: true, logPath: '/l', say, platform: 'darwin', runtime: 'Colima', freeDiskBytes: 1e9, locale: 'ru' })
  assert.match(plan.detail + plan.message, /Colima/)
  assert.doesNotMatch(plan.detail + plan.message, /OrbStack/)
})

test('the startup wait and the stack health say Colima on a Colima Mac', () => {
  const lines = startupWaitLines({
    say: (key) => en[key] ?? key, failure: { cause: 'docker-not-running' }, waitsForDocker: true, freeDiskBytes: null,
    locale: 'en', platform: 'darwin', runtime: 'Colima', nextInS: 10, attempt: 1, standby: null, logPath: '/l'
  })
  assert.equal(lines.find((l) => l.id === 'cause').text, en['startup.wait.docker.colima'])
  const view = stackHealthView({ stack: 'down', why: 'docker', since: 0, trying: false, recoveries: 0, hold: null, nextRecoveryAt: null, disk: 'ok', freeDiskBytes: null }, 0, 'darwin', 'Colima')
  assert.equal(view.runtime, 'Colima')
  assert.equal(platformKey('stack.health.docker', view.platform, view.runtime), 'stack.health.docker.colima')
})
