// Manual native probe (first-slice plan C5): the built app in a real Electron run against the local
// stack, driven through its own window. A fresh user-data directory records a new Estate, which the
// app's bootstrap founds for the local operator — never the operator's own Estate. The chat must be
// active, a message sent from the composer must read "saved, no reply yet", its acceptance must be
// in the journal, and after a cold restart of the app the same message must be read back.
//
//   pnpm --dir apps/desktop build
//   FABRIC_PLAYWRIGHT_MODULE=<playwright> node apps/desktop/test/chat-activation-native.test.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), repo = path.resolve(appDir, '../..')
const pw = process.env.FABRIC_PLAYWRIGHT_MODULE
if (!pw || !existsSync(path.join(appDir, 'out/main/index.js'))) { console.error(JSON.stringify({ status: 'NOT_RUN', reason: 'set FABRIC_PLAYWRIGHT_MODULE and build the app first' })); process.exit(2) }
const { _electron } = await import(pathToFileURL(path.join(pw, 'index.mjs')).href)
const electron = createRequire(path.join(appDir, 'package.json'))('electron')
// The local stack's database, read from the CLI; the URL never leaves this process.
const env = Object.fromEntries(execFileSync('supabase', ['status', '-o', 'env'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  .split('\n').map(l => /^([A-Z_]+)="?(.*?)"?$/.exec(l)).filter(Boolean).map(m => [m[1], m[2]]))
const psql = q => execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', [env.DB_URL, '-X', '-t', '-A', '-c', q], { encoding: 'utf8' }).trim()
const strings = key => ['en', 'ru'].map(l => new RegExp(`'${key.replaceAll('.', '\\.')}': "([^"]+)"`).exec(readFileSync(path.join(appDir, `src/renderer/src/i18n/${l}.ts`), 'utf8'))?.[1]).filter(Boolean)
const either = key => new RegExp(strings(key).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'))
const userData = mkdtempSync(path.join(tmpdir(), 'fabric-c5-')), estate = randomUUID(), text = `Проверка C5 ${randomUUID().slice(0, 8)}`
writeFileSync(path.join(userData, 'active-estate.json'), JSON.stringify({ schema: 'ActiveEstate@1', estate_id: estate, recorded_at: new Date().toISOString() }), { mode: 0o600 })
class ProbeFailure extends Error { constructor(code) { super(code); this.code = code } }
// A real quit, as Cmd+Q does it: closing the window alone keeps a Mac app running by design.
// The app's own before-quit shutdown must finish and the process must exit within the bound.
async function quit(a) {
  const exited = new Promise(resolve => a.process().once('exit', resolve))
  void a.evaluate(({ app }) => app.quit()).catch(() => { /* The process may exit before the reply. */ })
  await Promise.race([exited, new Promise((_, reject) => setTimeout(() => reject(new ProbeFailure('quit_did_not_exit')), 30_000))])
}
let stage = 'launch', app
// FABRIC_APP_EXECUTABLE runs a packaged build (…/Fabric.app/Contents/MacOS/Fabric) instead of the source.
const packaged = process.env.FABRIC_APP_EXECUTABLE
const env0 = { ...process.env, ELECTRON_ENABLE_LOGGING: '0' }; delete env0.FABRIC_REPO; delete env0.SUPABASE_URL; delete env0.SUPABASE_SERVICE_ROLE_KEY
const launch = () => _electron.launch(packaged
  ? { executablePath: packaged, args: [`--user-data-dir=${userData}`], env: env0, timeout: 180_000 }
  : { executablePath: electron, args: ['.', `--user-data-dir=${userData}`], cwd: appDir, env: env0, timeout: 120_000 })
async function openChat(page) {
  await page.getByRole('button', { name: either('chat.open') }).click({ timeout: 120_000 })
  await page.getByLabel(either('chat.input.label')).waitFor({ timeout: 30_000 })
}
try {
  app = await launch(); let page = await app.firstWindow()
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
  app = await launch(); page = await app.firstWindow()
  await openChat(page)
  await page.locator('.chat-log .chat-message', { hasText: text }).first().waitFor({ timeout: 30_000 })
  if (await page.getByLabel(either('chat.input.label')).inputValue() !== '') throw new ProbeFailure('draft_not_cleared_after_send')
  const after = await page.evaluate(() => window.fabric.ceo.status())
  if (after?.active !== true) throw new ProbeFailure('chat_not_active_after_restart')
  if (Number(psql(`select count(*) from journal where estate_id='${estate}' and type='ceo.message.accepted@1'`)) !== 1) throw new ProbeFailure('restart_resent_message')
  console.log(JSON.stringify({ status: 'PASS', runtime: 'electron', electronNode: execFileSync(electron, ['--version'], { encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }).trim(),
    testEstate: estate, chatActive: true, sentFromComposer: true, shownAs: 'saved, no reply yet', acceptancesJournalled: 1, textInSharedJournal: false,
    coldRestart: 'message read back, not resent', operatorEstateTouched: false, packaged: Boolean(packaged) }))
} catch (error) {
  try { const w = app && (await app.windows())[0]; if (w) { await w.screenshot({ path: path.join(userData, 'failure.png') }); writeFileSync(path.join(userData, 'failure.txt'), (await w.evaluate(() => document.body.innerText)).slice(0, 4000)) } } catch { /* Diagnostics only. */ }
  console.error(JSON.stringify({ status: 'FAIL', stage, reason: error instanceof ProbeFailure ? error.code : String(error?.message ?? error).split('\n')[0].slice(0, 200) }))
  process.exitCode = 1
} finally {
  try { if (app) await quit(app) } catch { /* Not silence: a process that will not quit is killed and reported. */ try { app.process().kill('SIGKILL') } catch { /* already gone */ }; process.exitCode = 1 }
  if (!process.exitCode) rmSync(userData, { recursive: true, force: true }); else console.error(JSON.stringify({ preserved: userData }))
}
