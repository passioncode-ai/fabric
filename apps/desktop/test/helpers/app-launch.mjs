// #region packaged-launch — docs: docs/launch/release-mac.md#how-a-release-is-made
// How a native probe starts Fabric and drives its window: the packaged build (FABRIC_APP_EXECUTABLE) or the dev
// Electron, both through Chromium's DevTools port.
//
// Not Playwright's `_electron.launch`: it adds `--inspect=0` and waits for the main process to print "Debugger
// listening on", and a release binary carries the fuse `enableNodeCliInspectArguments: false`
// (apps/desktop/electron-builder.yml), so it never prints it and the launch times out (measured 2026-10-11 on the
// fused 0.4.0 build: `--inspect=0` printed nothing, `--remote-debugging-port=0` printed "DevTools listening on").
// `--remote-debugging-port` is a Chromium switch no Electron fuse covers, and `chromium.connectOverCDP` drives the
// renderer through it. The main process is never evaluated: a quit is SIGTERM, which Fabric answers by its own
// before-quit shutdown (src/main/quit.ts), as Cmd+Q does.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

/** The command a probe runs: the packaged executable as it is, or the dev Electron on the app folder. */
export function launchPlan({ packaged, electron, appDir, userData }) {
  const common = [`--user-data-dir=${userData}`, '--remote-debugging-port=0']
  return packaged ? { command: packaged, args: common, cwd: undefined } : { command: electron, args: ['.', ...common], cwd: appDir }
}

/**
 * The environment the probe's app gets. Without a disposable stack (FABRIC_TEST_STACK, set by
 * scripts/test-stack.mjs) the app finds its stack itself, as a person's install does: FABRIC_REPO and the stack's
 * URL and key are removed. With one, the app is pointed at it, and runs with a throwaway HOME and no Keychain
 * reads, so a Fabric the operator has running keeps its hub.json (the probe's app would rewrite it on start and
 * remove it on quit).
 */
export function probeEnv({ env, home }) {
  const out = { ...env, ELECTRON_ENABLE_LOGGING: '0' }
  delete out.FABRIC_REPO
  if (env.FABRIC_TEST_STACK) return { ...out, HOME: home, FABRIC_NO_KEYCHAIN: '1' }
  delete out.SUPABASE_URL
  delete out.SUPABASE_SERVICE_ROLE_KEY
  return out
}

/** The DevTools HTTP endpoint: from `<userData>/DevToolsActivePort` (Chromium writes it), else from its stderr line. */
export function devtoolsEndpoint({ userData, output }) {
  const file = path.join(userData, 'DevToolsActivePort')
  if (existsSync(file)) {
    const port = Number(readFileSync(file, 'utf8').split('\n')[0])
    if (Number.isInteger(port) && port > 0) return `http://127.0.0.1:${port}`
  }
  const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(output)
  return m && Number(m[1]) > 0 ? `http://127.0.0.1:${m[1]}` : null
}

/** Fabric's main window loads its bundled page from file://; the splash and the startup-failure sheet are data: URLs. */
export function isMainWindowUrl(url) {
  return /^file:\/\/.*\/out\/renderer\/index\.html(?:[?#].*)?$/.test(url)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Starts the app and connects to it. Returns `{ child, browser, mainWindow(timeoutMs), quit(timeoutMs) }`;
 * `quit` resolves with the exit `{ code, signal }` and rejects when the process outlives the bound.
 */
export async function launchApp({ chromium, plan, env, userData, timeoutMs = 120_000, onSpawn }) {
  // A run that ended by SIGKILL leaves its DevToolsActivePort in the profile, and a cold restart reuses the profile:
  // the file is removed first, so only the port this process opens is ever read.
  rmSync(path.join(userData, 'DevToolsActivePort'), { force: true })
  const child = spawn(plan.command, plan.args, { cwd: plan.cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
  onSpawn?.(child)
  let output = '', exited = null
  child.stdout.on('data', (d) => { output += d })
  child.stderr.on('data', (d) => { output += d })
  const exit = new Promise((resolve) => child.once('exit', (code, signal) => { exited = { code, signal }; resolve(exited) }))
  const deadline = Date.now() + timeoutMs
  let endpoint = null
  while (!endpoint) {
    if (exited) throw new Error(`the app exited before its DevTools port opened (exit ${exited.code}${exited.signal ? `, ${exited.signal}` : ''}): ${output.slice(-400)}`)
    if (Date.now() > deadline) { child.kill('SIGKILL'); throw new Error(`no DevTools port within ${timeoutMs} ms`) }
    endpoint = devtoolsEndpoint({ userData, output })
    if (!endpoint) await sleep(200)
  }
  let browser
  try {
    browser = await chromium.connectOverCDP(endpoint, { timeout: Math.max(1_000, deadline - Date.now()) })
  } catch (error) {
    // No caller holds a handle yet, so nothing else would end the app: a failed connection kills it.
    if (!exited) child.kill('SIGKILL')
    throw error
  }
  async function mainWindow(waitMs = 120_000) {
    const until = Date.now() + waitMs
    for (;;) {
      for (const context of browser.contexts()) for (const page of context.pages()) if (isMainWindowUrl(page.url())) return page
      if (exited) throw new Error(`the app exited before its window opened (exit ${exited.code})`)
      if (Date.now() > until) throw new Error(`no main window within ${waitMs} ms`)
      await sleep(250)
    }
  }
  async function quit(waitMs = 30_000) {
    // Disconnect first: closing a CDP connection leaves the browser running, and a quit with a client attached
    // is not the quit a person makes.
    await browser.close().catch(() => { /* already disconnected */ })
    if (!exited) child.kill('SIGTERM')
    const result = await Promise.race([exit, sleep(waitMs).then(() => null)])
    if (!result) { child.kill('SIGKILL'); throw Object.assign(new Error('quit_did_not_exit'), { code: 'quit_did_not_exit' }) }
    return result
  }
  return { child, browser, mainWindow, quit, output: () => output }
}
// #endregion packaged-launch
