// The 0.3.18 review, iteration 1, UX-3: «Перезапустить Fabric» through launchd starts the service's copy, which launchd
// starts in the background; a note in the data folder tells that start the person asked for its window. The note is
// read once (taken), and a note that cannot be read is no request.
import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { RESTART_WINDOW_FILE, askRestartWindow, takeRestartWindow } from '../src/main/restartFabric.ts'

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
