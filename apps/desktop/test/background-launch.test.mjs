// `--background` (lifecycle LC-07/LC-09; agreed with the lifecycle broker 2026-10-03): a launch with the flag
// opens no splash and no main window and takes no focus until the person activates the app. Fabric's main
// cannot start without its stack, so the wiring is pinned here by source; the Electron behaviour it relies on
// — a launch without activation (`open -g`) delivers no `activate` — was measured on Electron 44 the same day.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const src = readFileSync(path.join(import.meta.dirname, '../src/main/index.ts'), 'utf8')

test('the flag is read from argv, and a start at login counts as a background start (CO-322)', () => {
  assert.match(src, /let BACKGROUND_LAUNCH = process\.argv\.includes\('--background'\)/)
  assert.match(src, /const openedAtLogin = process\.platform === 'darwin' && app\.isPackaged \? app\.getLoginItemSettings\(\)\.wasOpenedAtLogin : null/)
  assert.match(src, /if \(openedAtLogin !== null\) BACKGROUND_LAUNCH = startsInBackground\(process\.argv, openedAtLogin\)/)
  // CO-365: every start records how it began, so a reboot is checked in the operations log.
  assert.match(src, /op: 'app\.started', outcome: 'ok', level: 'info', detail: startRecord\(process\.argv, openedAtLogin, app\.getVersion\(\)\)/)
})
test('a background launch shows no splash', () => {
  // 0.3.9 ST-3: nor while the start-wait window already says what Fabric waits for.
  assert.match(src, /const splash = process\.env\.SMOKE \|\| BACKGROUND_LAUNCH \|\| startupWaitWindow \? null : splashWindow\(/)
})
test('a background launch opens no main window until activated, and an early activation is honoured after startup', () => {
  // A fabric:// link that arrived during the background startup is a person's act too (0.3.5 review ER-2).
  assert.match(src, /windowReady = true\s*\n\s*linksStartupDone\(\)\s*\n\s*\/\/[^\n]*\n\s*if \(!BACKGROUND_LAUNCH \|\| activatedDuringStartup \|\| pendingLinks\.size > 0\) createWindow\(\)/)
  // 0.3.9 ST-3: an activation while the start waits for Docker or the database shows what it waits for.
  // ADR-0192: after a quit the board's service held, an activation brings the Dock icon back before the window.
  assert.match(src, /if \(!windowReady\) \{ activatedDuringStartup = true; if \(startupWait\) showStartupWait\(\); return \}\s*\n\s*showForService\(\)\s*\n\s*if \(mainWindow === null\) createWindow\(\)/)
})
test('a second launch during a background start is remembered as an activation (0.3.7 i2 UX-2)', () => {
  assert.match(src, /app\.on\('second-instance'[\s\S]{0,800}if \(!windowReady\) \{ activatedDuringStartup = true; if \(startupWait\) showStartupWait\(\); return \}/)
  // ER-6 (0.3.18): a background second start (launchd's retry, the broker) is no activation; it returns before the flag.
  assert.match(src, /app\.on\('second-instance'[\s\S]{0,400}if \(!secondInstanceShows\(argv\)\) return[\s\S]{0,400}activatedDuringStartup = true/)
})

// The 0.3.18 review, iteration 2, PL-21 and ER-16: launchd's job label is read once, before anything starts a child, and
// removed, so no terminal, agent or relaunch inherits it (`shared/loginItem.ts#takeLaunchdStart`, tested there).
test('launchd\'s job label is taken from the environment before the quit wiring and any child', () => {
  const taken = src.indexOf('const LAUNCHD_STARTED = takeLaunchdStart(process.env)')
  assert.ok(taken > 0, 'index.ts reads the label once, at start')
  assert.ok(taken < src.indexOf('const quit = createQuitCoordinator('), 'before the quit wiring')
  assert.ok(taken < src.indexOf('let ACTIVE_ESTATE'), 'before the first statement of the main module, so before any child it starts')
  assert.doesNotMatch(src, /launchdStarted\(process\.env\)/, 'never read again from the environment')
  assert.match(src, /secondInstanceExitCode\(LAUNCHD_STARTED\)/)
})

// The 0.3.18 review, iteration 2, DA-11 and ER-14: a copy that loses the single-instance lock (launchd's retry, once a
// minute while another Fabric runs) sweeps nothing the primary may be writing: the editor recovery sweep runs only once
// the lock is won.
test('the editor recovery sweep runs only in the process that won the single-instance lock', () => {
  const sweeps = [...src.matchAll(/editorRecovery\.sweep\(\)/g)].map((m) => m.index)
  assert.equal(sweeps.length, 1)
  const lock = src.indexOf('const isPrimary = app.requestSingleInstanceLock()')
  const primary = src.indexOf('} else {', src.indexOf('if (!isPrimary) {', lock))
  assert.ok(lock > 0 && primary > lock)
  assert.ok(sweeps[0] > primary && sweeps[0] < src.indexOf("app.on('second-instance'", primary), 'in the winner\'s branch, before anything else')
})
