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
    hardDeadlineMs: 10_000,
    setTimer: (fn, ms) => { assert.equal(ms, 10_000); fire = fn; return { unref() {} } }
  })
  q.beforeQuit({ preventDefault() {} })
  assert.deepEqual(exits, [])
  fire()
  assert.deepEqual(exits, [3], 'a deadline exit must not look like a clean one')
})

test('quitting arms the outside guard once, past the in-process deadline', () => {
  const armed = []
  const q = createQuitCoordinator({ app: { quit() {}, exit() {} }, ready: () => true, shutdown: () => new Promise(() => {}), setTimer: () => ({}), armReaper: (ms) => armed.push(ms) })
  q.beforeQuit({ preventDefault() {} })
  q.beforeQuit({ preventDefault() {} })
  assert.deepEqual(armed, [15_000])
})

test('the deadline and the outside guard are armed before any stop runs (I3 E-1)', () => {
  // A stop that blocks the main thread (a FIFO read, say) must already be covered by the outside guard:
  // arming it after the stops left a blocking stop with nothing to end it.
  const order = []
  const q = createQuitCoordinator({ app: { quit() {}, exit() {} }, ready: () => true, shutdown: () => new Promise(() => {}),
    setTimer: () => { order.push('deadline'); return {} }, armReaper: () => order.push('reaper') })
  q.onQuit(() => order.push('stop'))
  q.beforeQuit({ preventDefault() {} })
  assert.deepEqual(order, ['deadline', 'reaper', 'stop'])
})

test('the outside guard ends a process whose event loop no longer runs', { skip: process.platform === 'win32' }, async () => {
  // A child arms the real reaper with a short delay, then blocks its own event loop forever — the shape of
  // a teardown that stalls after the last window is gone. Only something outside it can end it.
  const quitTs = path.join(import.meta.dirname, '../src/main/quit.ts')
  const child = spawn(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', `const { spawnQuitReaper } = await import(${JSON.stringify(quitTs)}); await spawnQuitReaper(1000); for (;;) {}`], { stdio: 'ignore' })
  const ended = await new Promise((resolve) => { const t = setTimeout(() => resolve('alive'), 8000); child.on('exit', (code, signal) => { clearTimeout(t); resolve(signal) }) })
  if (ended === 'alive') child.kill('SIGKILL')
  assert.equal(ended, 'SIGKILL', 'a stalled process outlived the outside guard')
})

test('a stop that blocks the main thread is still ended by the outside guard armed through the coordinator (I3 E-10)', { skip: process.platform === 'win32' }, async () => {
  // The reaper used to be spawned after an awaited dynamic import, so a synchronous stop that never returned
  // kept it from ever starting. Wired exactly as index.ts wires it: armReaper → spawnQuitReaper, then a stop
  // that blocks forever.
  const quitTs = path.join(import.meta.dirname, '../src/main/quit.ts')
  const script = 'const { createQuitCoordinator, spawnQuitReaper } = await import(' + JSON.stringify(quitTs) + ');' +
    'const q = createQuitCoordinator({ app: { quit() {}, exit() {} }, ready: () => true, shutdown: () => new Promise(() => {}), armReaper: () => spawnQuitReaper(1000) });' +
    'q.onQuit(() => { for (;;) {} }); q.beforeQuit({ preventDefault() {} })'
  const child = spawn(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { stdio: 'ignore' })
  const ended = await new Promise((resolve) => { const t = setTimeout(() => resolve('alive'), 8000); child.on('exit', (code, signal) => { clearTimeout(t); resolve(signal) }) })
  if (ended === 'alive') child.kill('SIGKILL')
  assert.equal(ended, 'SIGKILL', 'a stop blocking the main thread outlived the outside guard')
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

// A real window needs a display: the hosted Linux runner has none ("fixture exited before ready",
// runs 37118117108 and 37119372339). macOS always has one; Linux runs it only with DISPLAY set.
const noDisplay = process.platform !== 'darwin' && !process.env.DISPLAY

/**
 * How long a GRACEFUL exit may take. The defect these tests exist for (CO-191) is a process that never
 * exits; a loaded machine only makes a correct one slow. 45 s was measured enough at load 55–138, and was
 * not at 70–285 with the disk full (2026-10-07/08: a fixture that became ready in seconds took over 45 s
 * to tear down, on main and on a branch alike, the code under test unchanged) — so the time to become
 * ready does not predict the time to exit, and the bound is a ceiling a hang still runs out: 180 s. A
 * passing run is as fast as before; only a hung one waits this long. The product's own bound under load
 * is the outside reaper (15 s), tested above.
 */
const GRACEFUL_BOUND_MS = 180_000
function gracefulBoundMs() {
  return GRACEFUL_BOUND_MS
}

/** Spawn the fixture and wait for `quit-app: ready`. */
function startFixture(child, outRef) {
  const startedAt = Date.now()
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('the fixture never became ready:\n' + outRef.out)), 90_000)
    child.stdout.on('data', () => { if (outRef.out.includes('quit-app: ready')) { clearTimeout(t); resolve(Date.now() - startedAt) } })
    child.on('exit', () => { clearTimeout(t); reject(new Error('the fixture exited before ready:\n' + outRef.out)) })
  })
}

/** SIGTERM, then the exit — or `alive` once the bound for this machine has passed. */
function terminate(child, boundMs) {
  const sentAt = Date.now()
  child.kill('SIGTERM')
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ alive: true, boundMs }), boundMs)
    child.on('exit', (code, signal) => { clearTimeout(t); resolve({ code, signal, ms: Date.now() - sentAt, boundMs }) })
  })
}
async function runFixture(mode) {
  const electron = createRequire(import.meta.url)('electron')
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-quit-'))
  const main = path.join(import.meta.dirname, 'fixtures/quit-app/main.mjs')
  const child = spawn(electron, ['--use-mock-keychain', main, dir, ...(mode ? [mode] : [])], { stdio: ['ignore', 'pipe', 'pipe'] })
  const ref = { out: '' }
  child.stdout.on('data', (b) => { ref.out += b })
  child.stderr.on('data', () => {})
  try {
    await startFixture(child, ref)
    await new Promise((r) => setTimeout(r, 500))
    // A GRACEFUL exit, bounded by what this machine can do now; the product's own bound under load is
    // the outside reaper (15 s), tested above.
    const result = await terminate(child, gracefulBoundMs())
    return { result, out: ref.out }
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    rmSync(dir, { recursive: true, force: true })
  }
}

test('a real Electron main process with a startup-failure dialog open still quits on SIGTERM', { timeout: 300_000, skip: noDisplay ? 'NOT_RUN: a real Electron window needs macOS or a DISPLAY' : false }, async () => {
  const { result, out } = await runFixture('dialog')
  assert.equal(result.alive, undefined, `still alive ${result.boundMs / 1000} s after SIGTERM with the dialog open:\n` + out)
  assert.equal(result.signal, null, out)
  assert.equal(result.code, 0, out)
  assert.match(out, /quit-app: will-quit/)
})

test('a real Electron main process exits gracefully on SIGTERM', { timeout: 300_000, skip: noDisplay ? 'NOT_RUN: a real Electron window needs macOS or a DISPLAY' : false }, async () => {
  const electron = createRequire(import.meta.url)('electron')
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-quit-'))
  const main = path.join(import.meta.dirname, 'fixtures/quit-app/main.mjs')
  // Spawned as the Electron binary itself, never a forwarding wrapper: the signal goes to the
  // process under test and nowhere else (lifecycle LC-02).
  const child = spawn(electron, ['--use-mock-keychain', main, dir], { stdio: ['ignore', 'pipe', 'pipe'] })
  const ref = { out: '' }
  child.stdout.on('data', (b) => { ref.out += b })
  child.stderr.on('data', () => {})
  try {
    await startFixture(child, ref)
    const result = await terminate(child, gracefulBoundMs())
    const out = ref.out
    assert.equal(result.alive, undefined, `still alive ${result.boundMs / 1000} s after SIGTERM (CO-191; a loaded machine makes the teardown slow, never endless):\n` + out)
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
