// How the native probes start Fabric (test/helpers/app-launch.mjs): through the DevTools port, never --inspect, so a
// fused release binary (enableNodeCliInspectArguments: false) is driven the same way as the dev Electron.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { devtoolsEndpoint, isMainWindowUrl, launchApp, launchPlan, probeEnv } from './helpers/app-launch.mjs'

const userData = '/tmp/fabric-probe-profile'

test('a packaged build is the executable itself, with the DevTools port and no --inspect', () => {
  const plan = launchPlan({ packaged: '/x/Fabric.app/Contents/MacOS/Fabric', electron: '/e/electron', appDir: '/repo/apps/desktop', userData })
  assert.equal(plan.command, '/x/Fabric.app/Contents/MacOS/Fabric')
  assert.deepEqual(plan.args, [`--user-data-dir=${userData}`, '--remote-debugging-port=0'])
  assert.ok(!plan.args.some((a) => a.startsWith('--inspect')), 'a fused binary ignores --inspect; nothing may wait for it')
})

test('the dev Electron runs the app folder the same way', () => {
  const plan = launchPlan({ packaged: undefined, electron: '/e/electron', appDir: '/repo/apps/desktop', userData })
  assert.equal(plan.command, '/e/electron')
  assert.equal(plan.cwd, '/repo/apps/desktop')
  assert.deepEqual(plan.args, ['.', `--user-data-dir=${userData}`, '--remote-debugging-port=0'])
  assert.ok(!plan.args.some((a) => a.startsWith('--inspect')))
})

test('the DevTools endpoint is read from DevToolsActivePort, or from the line Chromium prints', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-launch-test-'))
  try {
    assert.equal(devtoolsEndpoint({ userData: dir, output: '' }), null)
    assert.equal(devtoolsEndpoint({ userData: dir, output: 'DevTools listening on ws://127.0.0.1:54143/devtools/browser/1ed3' }), 'http://127.0.0.1:54143')
    writeFileSync(path.join(dir, 'DevToolsActivePort'), '61234\n/devtools/browser/abc\n')
    assert.equal(devtoolsEndpoint({ userData: dir, output: '' }), 'http://127.0.0.1:61234')
    // `0` in the file is Chromium still choosing; it is not a port.
    writeFileSync(path.join(dir, 'DevToolsActivePort'), '0\n')
    assert.equal(devtoolsEndpoint({ userData: dir, output: '' }), null)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('the main window is the bundled page, never the splash or the startup-failure sheet', () => {
  assert.equal(isMainWindowUrl('file:///x/Fabric.app/Contents/Resources/app.asar/out/renderer/index.html'), true)
  assert.equal(isMainWindowUrl('file:///repo/apps/desktop/out/renderer/index.html#/home'), true)
  assert.equal(isMainWindowUrl('data:text/html;charset=utf-8,%3C!doctype'), false)
  assert.equal(isMainWindowUrl('about:blank'), false)
  assert.equal(isMainWindowUrl('devtools://devtools/bundled/inspector.html'), false)
})

test('a cold restart never connects to the port a killed run left behind', async () => {
  // A run that ended by SIGKILL (the quit reaper) leaves DevToolsActivePort in the profile; the restart reuses the
  // profile. Measured 2026-10-11: the restart read the dead port and failed with ECONNREFUSED.
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-launch-test-'))
  try {
    writeFileSync(path.join(dir, 'DevToolsActivePort'), '1\n/devtools/browser/stale\n')
    const chromium = { connectOverCDP: async (url) => { throw new Error(`connected to ${url}`) } }
    // A stand-in app that exits without ever opening a DevTools port.
    const plan = { command: process.execPath, args: ['-e', 'setTimeout(() => {}, 300)'], cwd: undefined }
    await assert.rejects(launchApp({ chromium, plan, env: process.env, userData: dir, timeoutMs: 10_000 }), /exited before its DevTools port opened/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a launch whose connection fails leaves no app running', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-launch-test-'))
  try {
    // A stand-in app that writes a port file and stays up; the connection to it is refused.
    const plan = { command: process.execPath, args: ['-e', `require('fs').writeFileSync(${JSON.stringify(path.join(dir, 'DevToolsActivePort'))}, '9\\n'); setInterval(() => {}, 1000)`], cwd: undefined }
    let child = null
    const chromium = { connectOverCDP: async () => { throw new Error('ECONNREFUSED') } }
    await assert.rejects(launchApp({ chromium, plan, env: process.env, userData: dir, timeoutMs: 10_000, onSpawn: (c) => { child = c } }), /ECONNREFUSED/)
    await new Promise((r) => (child.exitCode !== null || child.signalCode !== null ? r() : child.once('exit', r)))
    assert.ok(child.signalCode === 'SIGKILL' || child.exitCode !== null, 'the app was ended')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a disposable stack reaches the app, and the operator\'s home does not', () => {
  const base = { PATH: '/bin', HOME: '/Users/op', FABRIC_REPO: '/repo', SUPABASE_URL: 'http://127.0.0.1:57001', SUPABASE_SERVICE_ROLE_KEY: 'k' }
  // The live mode (release close on the operator's Mac): the app must find its own stack, as before.
  const live = probeEnv({ env: base, home: '/tmp/h' })
  assert.equal(live.SUPABASE_URL, undefined)
  assert.equal(live.SUPABASE_SERVICE_ROLE_KEY, undefined)
  assert.equal(live.FABRIC_REPO, undefined)
  assert.equal(live.HOME, '/Users/op')
  // The disposable mode: the stack test-stack.mjs started, and a throwaway home so the operator's running Fabric's
  // hub.json is never rewritten or removed by the probe's app.
  const disposable = probeEnv({ env: { ...base, FABRIC_TEST_STACK: 'fabric_test_ab12' }, home: '/tmp/h' })
  assert.equal(disposable.SUPABASE_URL, 'http://127.0.0.1:57001')
  assert.equal(disposable.SUPABASE_SERVICE_ROLE_KEY, 'k')
  assert.equal(disposable.HOME, '/tmp/h')
  assert.equal(disposable.FABRIC_NO_KEYCHAIN, '1')
  assert.equal(disposable.FABRIC_REPO, undefined)
})
