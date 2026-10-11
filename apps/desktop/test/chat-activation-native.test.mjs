// Manual native probe (first-slice plan C5): the built app in a real Electron run against the local
// stack, driven through its own window. A fresh user-data directory records a new Estate, which the
// app's bootstrap founds for the local operator — never the operator's own Estate. The chat must be
// active, a message sent from the composer must read "saved, no reply yet", its acceptance must be
// in the journal, and after a cold restart of the app the same message must be read back.
//
//   pnpm --dir apps/desktop build
//   FABRIC_PLAYWRIGHT_MODULE=<playwright> node apps/desktop/test/chat-activation-native.test.mjs
//
// A packaged build: FABRIC_APP_EXECUTABLE=<…/Fabric.app/Contents/MacOS/Fabric>. On a disposable stack
// (`node scripts/test-stack.mjs run -- <this command>`) the app is pointed at that stack with a throwaway HOME;
// without one it finds its own stack, as an install does — the live one on the operator's Mac (release close).
// The app is driven through its DevTools port, not `_electron.launch` (test/helpers/app-launch.mjs says why).
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { launchApp, launchPlan, probeEnv } from './helpers/app-launch.mjs'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), repo = path.resolve(appDir, '../..')
const pw = process.env.FABRIC_PLAYWRIGHT_MODULE
if (!pw || !existsSync(path.join(appDir, 'out/main/index.js'))) { console.error(JSON.stringify({ status: 'NOT_RUN', reason: 'set FABRIC_PLAYWRIGHT_MODULE and build the app first' })); process.exit(2) }
const { chromium } = await import(pathToFileURL(path.join(pw, 'index.mjs')).href)
const electron = createRequire(path.join(appDir, 'package.json'))('electron')
// A disposable stack (scripts/test-stack.mjs) when one is named, else the local stack's database read from the
// CLI. The URL never leaves this process.
const disposable = Boolean(process.env.FABRIC_TEST_STACK)
const dbUrl = disposable ? process.env.DATABASE_URL : Object.fromEntries(execFileSync('supabase', ['status', '-o', 'env'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  .split('\n').map(l => /^([A-Z_]+)="?(.*?)"?$/.exec(l)).filter(Boolean).map(m => [m[1], m[2]])).DB_URL
const psql = q => execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', [dbUrl, '-X', '-t', '-A', '-c', q], { encoding: 'utf8' }).trim()
const strings = key => ['en', 'ru'].map(l => new RegExp(`'${key.replaceAll('.', '\\.')}': "([^"]+)"`).exec(readFileSync(path.join(appDir, `src/renderer/src/i18n/${l}.ts`), 'utf8'))?.[1]).filter(Boolean)
const either = key => new RegExp(strings(key).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'))
const userData = mkdtempSync(path.join(tmpdir(), 'fabric-c5-')), estate = randomUUID(), text = `Проверка C5 ${randomUUID().slice(0, 8)}`
writeFileSync(path.join(userData, 'active-estate.json'), JSON.stringify({ schema: 'ActiveEstate@1', estate_id: estate, recorded_at: new Date().toISOString() }), { mode: 0o600 })
class ProbeFailure extends Error { constructor(code) { super(code); this.code = code } }
// A real quit, as Cmd+Q does it: closing the window alone keeps a Mac app running by design. SIGTERM reaches the
// app's own before-quit shutdown (src/main/quit.ts); it must finish and the process exit 0 within the bound —
// exit 3 is the hard deadline having had to end it.
async function quit(a) {
  const { code, signal } = await a.quit(30_000).catch((e) => { throw new ProbeFailure(e.code ?? 'quit_did_not_exit') })
  if (code !== 0) throw new ProbeFailure(`quit_exit_${code ?? signal}`)
}
let stage = 'launch', app
// FABRIC_APP_EXECUTABLE runs a packaged build (…/Fabric.app/Contents/MacOS/Fabric) instead of the source.
const packaged = process.env.FABRIC_APP_EXECUTABLE
const home = mkdtempSync(path.join(tmpdir(), 'fabric-c5-home-'))
const env0 = probeEnv({ env: process.env, home })
const launch = () => launchApp({ chromium, plan: launchPlan({ packaged, electron, appDir, userData }), env: env0, userData, timeoutMs: packaged ? 180_000 : 120_000 })
async function openChat(page) {
  await page.getByRole('button', { name: either('chat.open') }).click({ timeout: 120_000 })
  await page.getByLabel(either('chat.input.label')).waitFor({ timeout: 30_000 })
}
try {
  app = await launch(); let page = await app.mainWindow()
  stage = 'status'
  await page.getByRole('button', { name: either('chat.open') }).waitFor({ timeout: 120_000 })
  const status = await page.evaluate(() => window.fabric.ceo.status())
  if (packaged) {
    // The packaged app ran the stack project it ships, from its own data folder, with no checkout.
    if (!existsSync(path.join(userData, 'stack', 'supabase', 'config.toml'))) throw new ProbeFailure('bundled_stack_not_materialized')
    if (await page.title() !== 'Fabric') throw new ProbeFailure('window_not_named_fabric')
  }
  if (status?.active !== true) throw new ProbeFailure('chat_not_active:' + status?.reason)
  stage = 'send'
  await openChat(page)
  await page.getByLabel(either('chat.input.label')).fill(text)
  await page.getByRole('button', { name: either('chat.send') }).click()
  await page.getByText(either('chat.pending')).first().waitFor({ timeout: 30_000 })
  // The message itself, in the conversation log — not the composer's text.
  await page.locator('.chat-log .chat-message', { hasText: text }).first().waitFor({ timeout: 30_000 })
  stage = 'journal'
  let accepted = 0
  for (let i = 0; i < 30 && accepted === 0; i++) { accepted = Number(psql(`select count(*) from journal where estate_id='${estate}' and type='ceo.message.accepted@1'`)); if (!accepted) await new Promise(r => setTimeout(r, 500)) }
  if (accepted !== 1) throw new ProbeFailure('acceptance_not_journalled:' + accepted)
  if (psql(`select count(*) from journal where estate_id='${estate}' and payload::text like '%${text.split(' ')[2]}%'`) !== '0') throw new ProbeFailure('message_text_in_shared_journal')
  stage = 'cold_restart'
  await quit(app); app = null
  app = await launch(); page = await app.mainWindow()
  await openChat(page)
  await page.locator('.chat-log .chat-message', { hasText: text }).first().waitFor({ timeout: 30_000 })
  if (await page.getByLabel(either('chat.input.label')).inputValue() !== '') throw new ProbeFailure('draft_not_cleared_after_send')
  const after = await page.evaluate(() => window.fabric.ceo.status())
  if (after?.active !== true) throw new ProbeFailure('chat_not_active_after_restart')
  if (Number(psql(`select count(*) from journal where estate_id='${estate}' and type='ceo.message.accepted@1'`)) !== 1) throw new ProbeFailure('restart_resent_message')
  console.log(JSON.stringify({ status: 'PASS', runtime: 'electron', electronNode: execFileSync(packaged ?? electron, ['--version'], { encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }).trim(),
    testEstate: estate, chatActive: true, sentFromComposer: true, shownAs: 'saved, no reply yet', acceptancesJournalled: 1, textInSharedJournal: false,
    coldRestart: 'message read back, not resent', operatorEstateTouched: false, packaged: Boolean(packaged),
    stack: disposable ? 'disposable' : "the app's own", launch: 'remote-debugging-port' }))
} catch (error) {
  try { const w = app && await app.mainWindow(1_000).catch(() => null); if (w) { await w.screenshot({ path: path.join(userData, 'failure.png') }); writeFileSync(path.join(userData, 'failure.txt'), (await w.evaluate(() => document.body.innerText)).slice(0, 4000)) } } catch { /* Diagnostics only. */ }
  console.error(JSON.stringify({ status: 'FAIL', stage, reason: error instanceof ProbeFailure ? error.code : String(error?.message ?? error).split('\n')[0].slice(0, 200) }))
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
