// scripts/walk/cleanup.mjs: a walk waits for the app it started to exit and removes its temp folders
// (release review 2026-10-03, iteration 2, finding 8). Real processes and real folders; no app, no stack.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { endApp, removeTemp } from '../walk/cleanup.mjs'

const alive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
const ready = (child) => new Promise((resolve) => child.stdout.once('data', resolve))

test('endApp resolves only once the app has exited after SIGTERM', async () => {
  const child = spawn(process.execPath, ['-e', 'console.log("up"); setInterval(() => {}, 1000)'], { stdio: ['ignore', 'pipe', 'ignore'] })
  await ready(child)
  assert.equal(await endApp(child, { graceMs: 5000 }), 'terminated')
  assert.equal(alive(child.pid), false, 'the app was still running when the walk moved on')
})

test('an app that ignores SIGTERM is killed after the grace period, and still waited for', async () => {
  const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); console.log("up"); setInterval(() => {}, 1000)'], { stdio: ['ignore', 'pipe', 'ignore'] })
  await ready(child)
  const started = Date.now()
  assert.equal(await endApp(child, { graceMs: 300 }), 'killed')
  assert.ok(Date.now() - started >= 250, 'it did not give the app its grace period')
  assert.equal(alive(child.pid), false)
})

test('the walk\'s fixture and user-data folders are removed, and the walk script uses both helpers', () => {
  const fx = mkdtempSync(path.join(tmpdir(), 'fabric-walk-fx-'))
  const ud = mkdtempSync(path.join(tmpdir(), 'fabric-walk-ud-'))
  writeFileSync(path.join(fx, 'file'), 'x')
  assert.deepEqual(removeTemp([fx, ud], { log: () => {} }), [])
  assert.equal(existsSync(fx) || existsSync(ud), false, 'a temp folder outlived the walk')
  const walk = readFileSync(path.resolve(import.meta.dirname, '../walk/start-paths.mjs'), 'utf8')
  assert.match(walk, /await endApp\(child/, 'start-paths.mjs still exits without waiting for the app')
  assert.match(walk, /removeTemp\(\[fx, userData\]/, 'start-paths.mjs still leaves its temp folders behind')
})
