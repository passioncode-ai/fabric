// Quitting ends the process (CO-191, lifecycle LC-01).
//
// MEASURED 2026-10-03: an idle Fabric given SIGTERM closed its window and stayed alive with
// no window, still running its 60 s cycle. The cause was a re-quit from a promise's `finally`,
// which runs inside Electron's own `Browser::Quit()` — not re-entrant — so the outer call
// reset `is_quitting_` and `window-all-closed` arrived instead of `will-quit`.
//
// Two layers prove the fix. The first drives the coordinator against a model of that native
// rule: any quit() issued in the same macrotask as a running quit poisons it. The second
// launches a REAL Electron main process wired to the production coordinator and signals it:
// the test passes only on a graceful exit — `will-quit` seen, exit code 0, no signal — inside
// the deadline. Run against the old pattern (`main.mjs … old`) the second test fails: the
// process is still alive after the window closed (watched on 2026-10-03).

import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createQuitCoordinator } from '../src/main/quit.ts'

// Electron's quit rule, modelled: a quit() requested while a native quit is still on the
// stack (the same macrotask) is swallowed and leaves the app NOT quitting.
function modelElectron() {
  const listeners = { 'before-quit': [], 'window-all-closed': [] }
  const state = { inNativeQuit: false, poisoned: false, willQuit: false, exited: null, windows: 1 }
  const app = {
    on: (ev, fn) => listeners[ev].push(fn),
    exit: (code) => { state.exited = code },
    quit() {
      if (state.inNativeQuit) { state.poisoned = true; return }
      state.inNativeQuit = true
      setImmediate(() => { state.inNativeQuit = false })
      const e = { prevented: false, preventDefault() { this.prevented = true } }
      for (const fn of listeners['before-quit']) fn(e)
      if (e.prevented) return
      // Windows close; with the quit poisoned, Electron emits window-all-closed instead of will-quit.
      queueMicrotask(() => {
        state.windows = 0
        if (state.poisoned) { state.poisoned = false; for (const fn of listeners['window-all-closed']) fn() }
        else { state.willQuit = true; state.exited = 0 }
      })
    }
  }
  return { app, state }
}

const settle = () => new Promise((r) => setTimeout(r, 20))

test('an idle quit whose shutdown settles at once reaches will-quit (the CO-191 case)', async () => {
  const { app, state } = modelElectron()
  const q = createQuitCoordinator({ app, ready: () => true, shutdown: async () => {}, setTimer: () => ({}) })
  app.on('before-quit', (e) => q.beforeQuit(e))
  app.on('window-all-closed', () => q.windowAllClosed('darwin'))
  app.quit()
  await settle()
  assert.equal(state.willQuit, true)
  assert.equal(state.exited, 0)
})

test('the old pattern is caught by the model: a re-quit from finally never reaches will-quit', async () => {
  const { app, state } = modelElectron()
  let quitting = false
  app.on('before-quit', (e) => {
    if (quitting) return
    e.preventDefault(); quitting = true
    void Promise.resolve().finally(() => app.quit())
  })
  app.on('window-all-closed', () => { /* darwin: ignored */ })
  app.quit()
  await settle()
  assert.equal(state.willQuit, false, 'the model must reproduce the defect, or it proves nothing')
})

test('once quitting, window-all-closed quits on macOS too; before that it does not', () => {
  const calls = []
  const q = createQuitCoordinator({ app: { quit: () => calls.push('quit'), exit: () => {} }, ready: () => false, shutdown: async () => {}, setTimer: () => ({}) })
  q.windowAllClosed('darwin')
  assert.deepEqual(calls, [])
  q.beforeQuit({ preventDefault() {} })
  q.windowAllClosed('darwin')
  assert.deepEqual(calls, ['quit'])
})

test('quitting stops every scheduler first, once, including one registered late', () => {
  const stopped = []
  const q = createQuitCoordinator({ app: { quit() {}, exit() {} }, ready: () => true, shutdown: () => new Promise(() => {}), setTimer: () => ({}) })
  q.onQuit(() => stopped.push('cycle'))
  q.onQuit(() => { throw new Error('a broken stop must not keep the others running') })
  q.onQuit(() => stopped.push('notifier'))
  q.beforeQuit({ preventDefault() {} })
  q.beforeQuit({ preventDefault() {} })
  assert.equal(q.quitting, true)
  assert.deepEqual(stopped, ['cycle', 'notifier'])
  q.onQuit(() => stopped.push('late'))
  assert.deepEqual(stopped, ['cycle', 'notifier', 'late'])
})

test('a shutdown that never settles is ended by the deadline', () => {
  let fire
  const exits = []
  const q = createQuitCoordinator({
    app: { quit() {}, exit: (c) => exits.push(c) },
    ready: () => true,
    shutdown: () => new Promise(() => {}),
    deadlineMs: 10_000,
    setTimer: (fn, ms) => { assert.equal(ms, 10_000); fire = fn; return { unref() {} } }
  })
  q.beforeQuit({ preventDefault() {} })
  assert.deepEqual(exits, [])
  fire()
  assert.deepEqual(exits, [0])
})

test('a failing shutdown still lets the quit through', async () => {
  const calls = []
  const q = createQuitCoordinator({ app: { quit: () => calls.push('quit'), exit() {} }, ready: () => true, shutdown: async () => { throw new Error('drain failed') }, setTimer: () => ({}) })
  const e = { prevented: false, preventDefault() { this.prevented = true } }
  q.beforeQuit(e)
  assert.equal(e.prevented, true)
  await settle()
  assert.deepEqual(calls, ['quit'])
  const again = { prevented: false, preventDefault() { this.prevented = true } }
  q.beforeQuit(again)
  assert.equal(again.prevented, false, 'the drained re-quit must not be cancelled again')
})

test('a real Electron main process exits gracefully on SIGTERM', { timeout: 60_000 }, async () => {
  const electron = createRequire(import.meta.url)('electron')
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-quit-'))
  const main = path.join(import.meta.dirname, 'fixtures/quit-app/main.mjs')
  // Spawned as the Electron binary itself, never a forwarding wrapper: the signal goes to the
  // process under test and nowhere else (lifecycle LC-02).
  const child = spawn(electron, ['--use-mock-keychain', main, dir], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  child.stdout.on('data', (b) => { out += b })
  child.stderr.on('data', () => {})
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('the fixture never became ready:\n' + out)), 30_000)
      child.stdout.on('data', () => { if (out.includes('quit-app: ready')) { clearTimeout(t); resolve() } })
      child.on('exit', () => { clearTimeout(t); reject(new Error('the fixture exited before ready:\n' + out)) })
    })
    const sentAt = Date.now()
    child.kill('SIGTERM')
    const result = await new Promise((resolve) => {
      const t = setTimeout(() => resolve({ alive: true }), 20_000)
      child.on('exit', (code, signal) => { clearTimeout(t); resolve({ code, signal, ms: Date.now() - sentAt }) })
    })
    assert.equal(result.alive, undefined, 'still alive 20 s after SIGTERM (CO-191; the native teardown alone can take seconds on a loaded machine, never this long):\n' + out)
    assert.equal(result.signal, null, 'killed rather than exited:\n' + out)
    assert.equal(result.code, 0, out)
    assert.match(out, /quit-app: schedulers-stopped/)
    assert.match(out, /quit-app: shutdown/)
    assert.match(out, /quit-app: will-quit/)
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    rmSync(dir, { recursive: true, force: true })
  }
})
