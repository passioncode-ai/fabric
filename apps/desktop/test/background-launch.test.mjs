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
  assert.match(src, /if \(!windowReady\) \{ activatedDuringStartup = true; if \(startupWait\) showStartupWait\(\); return \}\s*\n\s*if \(mainWindow === null\) createWindow\(\)/)
})
test('a second launch during a background start is remembered as an activation (0.3.7 i2 UX-2)', () => {
  assert.match(src, /app\.on\('second-instance'[\s\S]{0,400}if \(!windowReady\) \{ activatedDuringStartup = true; if \(startupWait\) showStartupWait\(\); return \}/)
})
