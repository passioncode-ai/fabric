// `--background` (lifecycle LC-07/LC-09; agreed with the lifecycle broker 2026-10-03): a launch with the flag
// opens no splash and no main window and takes no focus until the person activates the app. Fabric's main
// cannot start without its stack, so the wiring is pinned here by source; the Electron behaviour it relies on
// — a launch without activation (`open -g`) delivers no `activate` — was measured on Electron 44 the same day.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const src = readFileSync(path.join(import.meta.dirname, '../src/main/index.ts'), 'utf8')

test('the flag is read once from argv', () => {
  assert.match(src, /const BACKGROUND_LAUNCH = process\.argv\.includes\('--background'\)/)
})
test('a background launch shows no splash', () => {
  assert.match(src, /const splash = process\.env\.SMOKE \|\| BACKGROUND_LAUNCH \? null : splashWindow\(/)
})
test('a background launch opens no main window until activated, and an early activation is honoured after startup', () => {
  assert.match(src, /windowReady = true\s*\n\s*if \(!BACKGROUND_LAUNCH \|\| activatedDuringStartup\) createWindow\(\)/)
  assert.match(src, /if \(!windowReady\) \{ activatedDuringStartup = true; return \}\s*\n\s*if \(mainWindow === null\) createWindow\(\)/)
})
