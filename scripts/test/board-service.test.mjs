// scripts/lib/board-service.mjs (ADR-0192, the 0.3.18 review, iteration 1, PL-2 and ER-1): afterPack refuses a packed
// Mac app without the board's launch agent, or with one that names another job or a program the app lacks, and the
// file name it checks is the one the app registers.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { BOARD_SERVICE, boardServiceProblems } from '../lib/board-service.mjs'

const repo = path.resolve(import.meta.dirname, '../..')
const shipped = path.join(repo, 'apps/desktop/build/launchd', BOARD_SERVICE)

function packedApp(withPlist, plistText) {
  const app = path.join(mkdtempSync(path.join(tmpdir(), 'fabric-pack-')), 'Fabric.app')
  mkdirSync(path.join(app, 'Contents/MacOS'), { recursive: true })
  writeFileSync(path.join(app, 'Contents/MacOS/Fabric'), '')
  if (withPlist) {
    mkdirSync(path.join(app, 'Contents/Library/LaunchAgents'), { recursive: true })
    const to = path.join(app, 'Contents/Library/LaunchAgents', BOARD_SERVICE)
    if (plistText === undefined) copyFileSync(shipped, to)
    else writeFileSync(to, plistText)
  }
  return app
}

test('the file the pack checks is the one the app registers', async () => {
  const { BOARD_SERVICE: registered } = await import(path.join(repo, 'apps/desktop/src/shared/loginItem.ts'))
  assert.equal(BOARD_SERVICE, registered)
})

test('an app with the shipped property list passes', () => {
  const app = packedApp(true)
  try { assert.deepEqual(boardServiceProblems(app), []) } finally { rmSync(path.dirname(app), { recursive: true, force: true }) }
})

test('an app without it is refused, as electron-builder would have shipped it silently', () => {
  const app = packedApp(false)
  try { assert.deepEqual(boardServiceProblems(app), [`no Contents/Library/LaunchAgents/${BOARD_SERVICE}`]) } finally { rmSync(path.dirname(app), { recursive: true, force: true }) }
})

test('a property list naming another job, or a program the app lacks, is refused', () => {
  const text = readFileSync(shipped, 'utf8').replace('<string>ai.passioncode.desktop.board</string>', '<string>other</string>').replace('Contents/MacOS/Fabric', 'Contents/MacOS/Missing')
  const app = packedApp(true, text)
  try {
    const problems = boardServiceProblems(app)
    assert.equal(problems.length, 2, problems.join('; '))
    assert.match(problems[0], /Label is "other"/)
    assert.match(problems[1], /BundleProgram Contents\/MacOS\/Missing is not in the app/)
  } finally { rmSync(path.dirname(app), { recursive: true, force: true }) }
})
