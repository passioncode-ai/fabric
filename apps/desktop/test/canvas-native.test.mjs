// Manual native probe (ADR-0201, CV-REQ-02 and CV-REQ-05): the canvas window in the built app, in a real Electron
// run against a disposable stack, through the real preload bridge. A fresh user-data directory records a new Estate,
// never the operator's own. The window must open from the app's own door (`window.fabric.canvas.open`), the editor
// must load in its own document, a rectangle drawn with the mouse must be written to
// `<userData>/canvases/main.excalidraw` readable by the owner alone, the page must ask no other origin for anything,
// and after a cold restart of the app the same drawing must be read back.
//
//   pnpm --dir apps/desktop build
//   FABRIC_PLAYWRIGHT_MODULE=<playwright-core> node scripts/test-stack.mjs run -- node apps/desktop/test/canvas-native.test.mjs
//
// Not covered here: the call's voice tools drawing on the canvas (they need a live call).
// The app is driven through its DevTools port, not `_electron.launch` (test/helpers/app-launch.mjs says why).
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { launchApp, launchPlan, probeEnv } from './helpers/app-launch.mjs'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pw = process.env.FABRIC_PLAYWRIGHT_MODULE
if (!pw || !existsSync(path.join(appDir, 'out/main/index.js'))) { console.error(JSON.stringify({ status: 'NOT_RUN', reason: 'set FABRIC_PLAYWRIGHT_MODULE and build the app first' })); process.exit(2) }
if (!process.env.FABRIC_TEST_STACK) { console.error(JSON.stringify({ status: 'NOT_RUN', reason: 'run under scripts/test-stack.mjs: this probe never uses the operator\'s stack' })); process.exit(2) }
const { chromium } = await import(pathToFileURL(path.join(pw, 'index.mjs')).href)
const electron = createRequire(path.join(appDir, 'package.json'))('electron')
const userData = mkdtempSync(path.join(tmpdir(), 'fabric-cv-')), home = mkdtempSync(path.join(tmpdir(), 'fabric-cv-home-')), estate = randomUUID()
writeFileSync(path.join(userData, 'active-estate.json'), JSON.stringify({ schema: 'ActiveEstate@1', estate_id: estate, recorded_at: new Date().toISOString() }), { mode: 0o600 })
const file = path.join(userData, 'canvases', 'main.excalidraw')
class ProbeFailure extends Error { constructor(code) { super(code); this.code = code } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const packaged = process.env.FABRIC_APP_EXECUTABLE
const launch = () => launchApp({ chromium, plan: launchPlan({ packaged, electron, appDir, userData }), env: probeEnv({ env: process.env, home }), userData, timeoutMs: packaged ? 180_000 : 120_000 })
async function quit(a) {
  const { code, signal } = await a.quit(30_000).catch((e) => { throw new ProbeFailure(e.code ?? 'quit_did_not_exit') })
  if (code !== 0) throw new ProbeFailure(`quit_exit_${code ?? signal}`)
}
/** The canvas's window: opened through the app's own door from the main window, found by its document. */
async function openCanvas(a) {
  const main = await a.mainWindow()
  await main.waitForFunction(() => typeof window.fabric?.canvas?.open === 'function', null, { timeout: 120_000 })
  await main.evaluate(() => window.fabric.canvas.open('main'))
  for (const until = Date.now() + 30_000; Date.now() < until; await sleep(250))
    for (const context of a.browser.contexts()) for (const page of context.pages()) if (/\/out\/renderer\/canvas\.html\?canvas=main$/.test(page.url())) return page
  throw new ProbeFailure('canvas_window_did_not_open')
}
const shapes = () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).elements.filter((e) => !e.isDeleted).map((e) => e.type) : [])
let stage = 'launch', app
try {
  app = await launch()
  stage = 'open'
  let page = await openCanvas(app)
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)))
  await page.waitForSelector('.excalidraw canvas', { timeout: 60_000 })
  stage = 'draw'
  const size = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const x = Math.round(size.w * 0.35), y = Math.round(size.h * 0.4)
  await sleep(1500)
  await page.mouse.click(Math.round(size.w * 0.6), Math.round(size.h * 0.75))
  await page.keyboard.press('r')
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 220, y + 130, { steps: 8 }); await page.mouse.up()
  stage = 'saved'
  for (const until = Date.now() + 20_000; Date.now() < until && !shapes().includes('rectangle'); await sleep(250));
  if (!shapes().includes('rectangle')) throw new ProbeFailure('drawing_not_written:' + JSON.stringify(shapes()))
  const mode = (statSync(file).mode & 0o777).toString(8)
  if (mode !== '600') throw new ProbeFailure('canvas_file_mode_' + mode)
  stage = 'origins'
  // Every resource the page asked for, as the page itself timed it: only the app's own files.
  const foreign = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => !n.startsWith('file:') && !n.startsWith('data:') && !n.startsWith('blob:')))
  const fonts = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => /excalidraw-assets\/fonts\//.test(n)).length)
  if (foreign.length) throw new ProbeFailure('foreign_requests:' + foreign.slice(0, 3).join(','))
  if (errors.length) throw new ProbeFailure('console_errors:' + errors.slice(0, 2).join(' | '))
  stage = 'cold_restart'
  await quit(app); app = null
  app = await launch(); page = await openCanvas(app)
  await page.waitForSelector('.excalidraw canvas', { timeout: 60_000 })
  const back = await page.evaluate(() => window.fabric.canvas.load('main'))
  const read = back?.ok && back.scene ? JSON.parse(back.scene).elements.filter((e) => !e.isDeleted).map((e) => e.type) : null
  if (!read?.includes('rectangle')) throw new ProbeFailure('drawing_not_read_back:' + JSON.stringify(back).slice(0, 120))
  await sleep(2500)
  if (!shapes().includes('rectangle')) throw new ProbeFailure('drawing_lost_after_reopen')
  console.log(JSON.stringify({ status: 'PASS', runtime: 'electron', testEstate: estate, canvasWindow: 'opened by window.fabric.canvas.open', drawn: 'rectangle',
    file: 'canvases/main.excalidraw', mode, foreignRequests: 0, fontsFromApp: fonts, consoleErrors: 0, coldRestart: 'drawing read back', packaged: Boolean(packaged), stack: 'disposable' }))
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', stage, reason: error instanceof ProbeFailure ? error.code : String(error?.message ?? error).split('\n')[0].slice(0, 300) }))
  process.exitCode = 1
} finally {
  try { if (app) await quit(app) } catch (e) {
    // Not silence: a process that will not quit is killed and reported.
    try { app.child.kill('SIGKILL') } catch { /* already gone */ }
    console.error(JSON.stringify({ status: 'FAIL', stage: 'quit', reason: e?.code ?? String(e) }))
    process.exitCode = 1
  }
  rmSync(home, { recursive: true, force: true })
  if (!process.exitCode) rmSync(userData, { recursive: true, force: true }); else console.error(JSON.stringify({ preserved: userData }))
}
