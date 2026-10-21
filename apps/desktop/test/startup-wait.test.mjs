// #region startup-wait — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
// ST-3, ST-2, ST-4 of the 0.3.9 stability audit, the wiring in index.ts. Fabric's main cannot start without Electron
// and its stack, so the wiring is pinned by source, as background-launch.test.mjs does; the behaviour it wires is
// driven for real in stack-watch.test.mjs, hub-standby.test.mjs, ops-retention.test.mjs and src/shared/stackWatch.test.ts.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const src = readFileSync(path.join(import.meta.dirname, '../src/main/index.ts'), 'utf8')
const between = (from, to) => {
  const a = src.indexOf(from)
  const b = src.indexOf(to, a + from.length)
  assert.ok(a >= 0 && b > a, `${from} … ${to} not found`)
  return src.slice(a, b)
}

test('ST-3: a start that waiting heals waits and tries again; only the rest reaches the dialog that quits', () => {
  const caught = between('async function startOrExplain', 'async function explainAndQuit')
  const heal = caught.indexOf('startupHeals(failure)')
  const wait = caught.indexOf('waitAndRetryStart(failure)')
  const explain = caught.indexOf('explainAndQuit(e)')
  assert.ok(heal > 0 && wait > heal && explain > wait, 'the heal test must come before the dialog')
  assert.match(caught, /if \(!pastRetryPoint && !process\.env\.SMOKE && startupHeals\(failure\)\) \{\s*\n\s*waitAndRetryStart\(failure\)\s*\n\s*return\s*\n\s*\}/)
})

test('ST-3: the wait retries with the backoff and ends on a quit', () => {
  const wait = between('function waitAndRetryStart', 'function startupWaitDone')
  assert.match(wait, /const delay = stackBackoffMs\(attempt\)/)
  assert.match(wait, /if \(quit\.quitting\) return\s*\n\s*void startOrExplain\(\)/)
  assert.match(src, /quit\.onQuit\(\(\) => \{\s*\n\s*if \(startupWait\?\.timer\) clearTimeout\(startupWait\.timer\)/)
})

test('ST-3: the hub standby opens before the stack starts and is taken over by the hub', () => {
  const boot = between('async function bootstrap()', 'async function bootstrapReady()')
  assert.ok(boot.indexOf('openHubStandby(') > 0 && boot.indexOf('openHubStandby(') < boot.indexOf('resolveEnvStartingStackIfNeeded()'), 'the standby must open before the stack starts')
  assert.match(src, /startHub\(\{ surface, env: process\.env, claimedPorts: registry\.claimedPorts\(\), root: dirs\.root, standby: hubStandby\?\.open \? hubStandby : null \}\)/)
})

test('ST-2: the runtime stack watch starts once the app has started, and puts the hub into the refusal mode', () => {
  assert.match(src, /registerIpc\(meta\)\s*\n\s*if \(!process\.env\.SMOKE\) startStackWatch\(\)/)
  const watch = between('function startStackWatch', 'quit.onQuit(() => stackWatch?.stop())')
  assert.match(watch, /surface\?\.setUnavailable\(refusal\)/)
  assert.match(watch, /recover: local \? \(\) => recoverStack\(\) : null/)
  assert.match(watch, /containers: local \? \(\) => stackDatabaseContainer\(\) : null/)
})

test('ST-4: startup-failure.log is appended, bounded, never overwritten', () => {
  const explain = between('async function explainAndQuit', "app.on('before-quit'")
  assert.match(explain, /appendBounded\(logPath,/)
  assert.doesNotMatch(explain, /writeFileSync\(\s*\n?\s*logPath/)
})
test('ER-1: the wait window and the splash are scaffolding: their going never quits a start on Windows or Linux', () => {
  // The coordinator ignores window-all-closed until the main window is up (quit.test.mjs drives the rule itself).
  assert.match(src, /createQuitCoordinator\(\{[\s\S]*?starting: \(\) => !windowReady,/)
  // The main window exists before the wait window goes; the failure dialog's window exists before it goes too.
  const run = between('async function startOrExplain', 'async function explainAndQuit')
  assert.ok(run.indexOf('createWindow()') > 0 && run.indexOf("startupWaitDone('started')") > run.indexOf('createWindow()'), 'the wait window is destroyed before the main window exists')
  assert.ok(run.indexOf('explainAndQuit(e)') > 0 && run.indexOf("startupWaitDone('failed')") > run.indexOf('explainAndQuit(e)'), 'the wait window is destroyed before the failure dialog has its window')
  // A person who closes the wait window or the splash on Windows or Linux quits, as closing Fabric's last window does there.
  assert.match(between('function showStartupWait', 'function waitAndRetryStart'), /quitWhenPersonCloses\(win\)/)
  assert.match(between('async function resolveEnvStartingStackIfNeeded', 'async function bootstrap()'), /if \(splash\) quitWhenPersonCloses\(splash\)/)
  const helper = between('function quitWhenPersonCloses', '\n}\n')
  assert.match(helper, /win\.on\('close', \(\) => \{ if \(process\.platform !== 'darwin' && !quit\.quitting\) app\.quit\(\) \}\)/)
})
test('UX-4, UX-5: the wait window names this OS\'s Docker, and fits its text', () => {
  const text = between('function startupWaitText', 'function showStartupWait')
  assert.match(text, /platformKey\('startup\.wait\.docker', process\.platform\)/)
  const show = between('function showStartupWait', 'function quitWhenPersonCloses')
  assert.doesNotMatch(show, /height: 240, resizable: false/)
  assert.match(show, /useContentSize: true, resizable: true/)
  assert.match(show, /did-finish-load', \(\) => fitStartupWait\(win\)/)
  assert.match(src, /const STARTUP_WAIT_HEIGHT = (\d+)/)
  assert.ok(Number(/const STARTUP_WAIT_HEIGHT = (\d+)/.exec(src)[1]) >= 330, 'the first height cuts the longest measured page (330 px)')
})
// #endregion startup-wait
