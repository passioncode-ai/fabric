#!/usr/bin/env node
// #region walk-start-paths — docs: README.md#the-disposable-test-stack
// Walk the first run and the start paths in the REAL built app (ADR-0100), screenshot every state.
//
//   pnpm --filter @fabric/desktop exec electron-vite build   # the app this walks
//   node scripts/test-stack.mjs run -- node scripts/walk/start-paths.mjs <out-dir> [--theme dark|light] [--locale en|ru]
//
// The app runs with a throwaway user-data folder whose active Estate is a NEW random Estate, so the
// first run is honestly due — and against a DISPOSABLE stack, never the operator's: the app reads
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from the environment `test-stack.mjs run` sets, and this
// script refuses the live ports through the same guard as every database probe (CO-181: walks run on
// the live stack left an estate behind each time). The native folder picker cannot be clicked from CDP, so the unpackaged app
// honours FABRIC_WALK_PICK=<project>:<scanRoot>:<parent> (index.ts `IPC.startChooseFolder`); a
// packaged app ignores it. Fixture repositories are built here with git. Writes only under <out-dir>
// and temp folders; creates Projects only in the throwaway Estate.
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { probeEnv } from '../lib/test-stack.mjs'

const stackEnv = probeEnv() // exits 1 unless this runs against a disposable stack
const ROOT = path.resolve(import.meta.dirname, '../..')
const APP = path.join(ROOT, 'apps/desktop')
const OUT = path.resolve(process.argv[2] ?? path.join(tmpdir(), 'fabric-walk'))
const THEME = process.argv.includes('--theme') ? process.argv[process.argv.indexOf('--theme') + 1] : 'dark'
const LOCALE = process.argv.includes('--locale') ? process.argv[process.argv.indexOf('--locale') + 1] : 'en'
const PORT = 9300 + Math.floor(Math.random() * 500)
mkdirSync(OUT, { recursive: true })
const log = (m) => console.log(m)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── fixtures: a projects folder with repositories, a worktree, a nested repo, noise
const env = { ...process.env, GIT_AUTHOR_NAME: 'walk', GIT_AUTHOR_EMAIL: 'w@e', GIT_COMMITTER_NAME: 'walk', GIT_COMMITTER_EMAIL: 'w@e' }
const git = (cwd, ...a) => execFileSync('git', a, { cwd, env, stdio: 'ignore' })
const repo = (dir, file, msg, remote) => { mkdirSync(dir, { recursive: true }); git(dir, 'init', '-q', '-b', 'main'); writeFileSync(path.join(dir, file), '{}\n'); git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', msg); if (remote) git(dir, 'remote', 'add', 'origin', remote) }
const fx = mkdtempSync(path.join(tmpdir(), 'fabric-walk-fx-'))
const projects = path.join(fx, 'projects')
repo(path.join(projects, 'billing-service'), 'package.json', 'fix: retry webhooks', 'git@github.com:example/billing.git')
repo(path.join(projects, 'site'), 'package.json', 'feat: pricing page')
repo(path.join(projects, 'ml-pipeline'), 'pyproject.toml', 'chore: pin torch')
repo(path.join(projects, 'site', 'packages', 'theme'), 'package.json', 'theme')
mkdirSync(path.join(projects, '_worktrees'))
git(path.join(projects, 'billing-service'), 'worktree', 'add', '-q', path.join(projects, '_worktrees', 'billing-hotfix'), '-b', 'hotfix')
repo(path.join(projects, 'node_modules', 'noise'), 'package.json', 'noise')
const parent = path.join(fx, 'new'); mkdirSync(parent)
const fresh = path.join(fx, 'fresh-service'); repo(fresh, 'go.mod', 'feat: first handler', 'https://x-access-token:ghp_FAKEFAKE@github.com/example/fresh.git')

// ── a throwaway user-data folder on a new Estate
const userData = mkdtempSync(path.join(tmpdir(), 'fabric-walk-ud-'))
writeFileSync(path.join(userData, 'active-estate.json'), JSON.stringify({ schema: 'ActiveEstate@1', estate_id: randomUUID(), recorded_at: new Date().toISOString() }), { mode: 0o600 })
writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ theme: THEME, locale: LOCALE }))

const electron = path.join(APP, 'node_modules/.bin/electron')
const child = spawn(electron, [APP, `--user-data-dir=${userData}`, `--remote-debugging-port=${PORT}`], {
  env: { ...stackEnv, FABRIC_WALK_PICK: [fresh, projects, parent].join(path.delimiter) },
  stdio: ['ignore', 'pipe', 'pipe']
})
let appLog = ''
child.stdout.on('data', (d) => { appLog += d })
child.stderr.on('data', (d) => { appLog += d })

async function page() {
  for (let i = 0; i < 120; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      const p = list.find((x) => x.type === 'page' && !x.url.startsWith('devtools'))
      if (p) return p.webSocketDebuggerUrl
    } catch { /* not up yet */ }
    // A failed start shows a modal dialog and opens no page; its reason is in the user-data folder.
    if (existsSync(path.join(userData, 'startup-failure.log'))) break
    await sleep(500)
  }
  const failure = existsSync(path.join(userData, 'startup-failure.log')) ? readFileSync(path.join(userData, 'startup-failure.log'), 'utf8') : ''
  throw new Error('the app never opened a page on the debugging port\n' + (failure ? `startup failure: ${failure}\n` : '') + appLog.slice(-2000))
}

let ws, seq = 0
const pending = new Map()
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq
  pending.set(id, { resolve, reject })
  ws.send(JSON.stringify({ id, method, params }))
})
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result.value
}
const waitFor = async (js, what, ms = 20000) => {
  for (let t = 0; t < ms; t += 250) { if (await evaluate(`!!(${js})`)) return; await sleep(250) }
  throw new Error('timed out waiting for ' + what)
}
let shot = 0
const capture = async (name) => {
  await sleep(350)
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  const file = path.join(OUT, `${String(++shot).padStart(2, '0')}-${name}.png`)
  writeFileSync(file, Buffer.from(data, 'base64'))
  log('  shot ' + path.basename(file))
}
const byText = (sel, text) => `[...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim().includes(${JSON.stringify(text)}))`
const click = async (sel, text) => { await waitFor(byText(sel, text), `${sel} "${text}"`); await evaluate(`${byText(sel, text)}.click()`) }
const type = async (sel, value) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const set = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set; set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)

const steps = []
let ticked = []
// A step that "passes" with an error on screen has not passed (iteration 1: the first project page
// carried a digest error while the walk reported PASS).
const visibleError = () => evaluate(`(() => { const e = [...document.querySelectorAll('.banner, [role=alert]')].find(x => x.offsetParent !== null && x.textContent.trim()); return e ? e.textContent.trim().slice(0, 300) : null })()`)
const step = async (name, fn) => {
  try {
    await fn()
    const err = await visibleError()
    if (err) throw new Error('an error is on screen: ' + err)
    steps.push({ name, ok: true }); log('PASS ' + name)
  } catch (e) { steps.push({ name, ok: false, error: String(e.message ?? e) }); log('FAIL ' + name + ': ' + (e.message ?? e)); await capture('failure-' + name.replace(/\W+/g, '-')).catch(() => {}) }
}

try {
  ws = new WebSocket(await page())
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  ws.onmessage = (m) => { const d = JSON.parse(m.data); const p = pending.get(d.id); if (p) { pending.delete(d.id); d.error ? p.reject(new Error(d.error.message)) : p.resolve(d.result) } }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 900, deviceScaleFactor: 1, mobile: false })

  await step('first run appears for an empty estate', async () => { await waitFor(`document.querySelector('[data-launch-view="first-run"]')`, 'the first run', 60000); await capture('first-run-1-persona') })
  await step('step 1 keeps a name', async () => { await type('[data-launch-view="first-run"] input', 'Atlas'); await capture('first-run-1-named'); await click('button', LOCALE === 'ru' ? 'Дальше' : 'Continue') })
  await step('step 2 lists coding agents', async () => { await waitFor(`document.querySelector('.st-exec-row')`, 'executor rows'); await capture('first-run-2-executors'); await click('button.primary', '') })
  await step('step 3 shows the five paths', async () => { await waitFor(`document.querySelectorAll('.st-card').length === 5`, 'five cards'); await capture('first-run-3-start') })
  await step('scan: checklist grouped by product', async () => {
    await click('.st-card', LOCALE === 'ru' ? 'Сканировать' : 'Scan a projects folder')
    await waitFor(`document.querySelector('[data-launch-view="start-scan"]')`, 'scan screen')
    await capture('scan-1-idle')
    await click('button.primary', '')
    await waitFor(`document.querySelectorAll('.st-candidate').length >= 4`, 'candidates', 30000)
    await capture('scan-2-results')
  })
  await step('scan: tick all shown ticks one per product, never the worktree, and adds them', async () => {
    await click('.st-toolbar button', LOCALE === 'ru' ? 'Отметить все' : 'Tick all shown')
    ticked = await evaluate(`[...document.querySelectorAll('.st-candidate input[type=checkbox]:checked:not(:disabled)')].map(c => c.closest('label').querySelector('b').textContent)`)
    if (ticked.includes('billing-hotfix')) throw new Error('the worktree was ticked by Tick all shown')
    if (!ticked.includes('billing-service')) throw new Error('the repository was not ticked')
    await capture('scan-3-ticked')
    await click('.st-foot button.primary', '')
    await waitFor(`[...document.querySelectorAll('[data-launch-view="start-scan"] [role=status]')].some(e => e.textContent.includes(${JSON.stringify(String(ticked.length))}))`, 'import summary', 30000)
    await capture('scan-4-imported')
  })
  await step('add: a fresh folder becomes a project, its remote shown without the credential', async () => {
    await click('button', LOCALE === 'ru' ? 'Назад' : 'Back')
    await click('.st-card', LOCALE === 'ru' ? 'Добавить проект' : 'Add a project')
    await click('button.primary', '')
    await waitFor(`document.querySelector('.st-facts')`, 'facts')
    const facts = await evaluate(`document.querySelector('.st-facts').textContent`)
    if (facts.includes('ghp_')) throw new Error('a credential from the remote URL is on screen')
    await capture('add-1-facts')
    await click('[data-launch-view="start-add"] button.primary', '')
    await waitFor(`!document.querySelector('[data-launch-view="start-add"]')`, 'the new project page', 30000)
    await capture('add-2-project-page')
  })
  const toMenu = async () => {
    await evaluate(`[...document.querySelectorAll('nav.app-nav a, nav.app-nav button')].find(e => e.textContent.trim() === ${JSON.stringify(LOCALE === 'ru' ? '+ Проект' : '+ Project')})?.click()`)
    await waitFor(`document.querySelector('[data-launch-view="start-menu"]')`, 'the start menu')
  }
  await step('the sidebar lists the projects the scan created', async () => {
    for (const name of ticked) await waitFor(`[...document.querySelectorAll('nav.app-nav *')].some(e => e.textContent.trim().endsWith(${JSON.stringify(name)}))`, name + ' in the sidebar')
  })
  await step('new project: the draft form makes a new folder', async () => {
    await toMenu()
    await capture('menu')
    await click('.st-card', LOCALE === 'ru' ? 'Новый проект' : 'New project')
    await waitFor(`document.querySelector('.onboarding input')`, 'the new-project form')
    await type('.onboarding input', 'walk-new-project')
    await click('.onboarding button', LOCALE === 'ru' ? 'Создать для него новую папку' : 'Create a new folder for it')
    await waitFor(`[...document.querySelectorAll('.onboarding .mono')].some(e => e.textContent.endsWith('/walk-new-project'))`, 'the new folder in the list')
    await capture('new-1-form')
    await click('.onboarding button[type=submit]', '')
    await waitFor(`!document.querySelector('.onboarding')`, 'the project page', 30000)
    await capture('new-2-project-page')
  })
  await step('agent and convert screens', async () => {
    await toMenu()
    await click('.st-card', LOCALE === 'ru' ? 'Новый агент' : 'New agent')
    await waitFor(`document.querySelector('[data-launch-view="start-agent"] .st-pick')`, 'project choice')
    await capture('agent-1-pick')
    await click('button', LOCALE === 'ru' ? 'Назад' : 'Back')
    await click('.st-card', LOCALE === 'ru' ? 'Конвертировать' : 'Convert an agent')
    await capture('convert-1-planned')
  })
} catch (e) {
  steps.push({ name: 'harness', ok: false, error: String(e.message ?? e) })
  log('FAIL harness: ' + (e.message ?? e))
} finally {
  writeFileSync(path.join(OUT, 'walk.json'), JSON.stringify({ theme: THEME, locale: LOCALE, steps, fixtures: fx, userData }, null, 2))
  writeFileSync(path.join(OUT, 'app.log'), appLog)
  child.kill('SIGTERM')
  const failed = steps.filter((s) => !s.ok).length
  log(`${steps.length - failed}/${steps.length} walk steps passed → ${OUT}`)
  process.exit(failed ? 1 : 0)
}
// #endregion walk-start-paths
