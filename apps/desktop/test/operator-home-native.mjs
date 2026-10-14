// The operator's home, project page and settings in the REAL app (operator request 2026-10-14, wave 4): a disposable
// stack seeded through the journal, the built app on a throwaway profile and HOME, a shell session opened in it, and
// the three screens read and photographed. Run:
//   FABRIC_PLAYWRIGHT_MODULE=<playwright> node scripts/test-stack.mjs run -- \
//     node --experimental-strip-types apps/desktop/test/operator-home-native.mjs <out-dir>
// It never runs against the operator's live stack: without FABRIC_TEST_STACK it says NOT_RUN and exits 2.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { createJournal } from '../../../packages/journal/src/index.ts'
import { launchApp, launchPlan, probeEnv } from './helpers/app-launch.mjs'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.resolve(process.argv[2] ?? path.join(tmpdir(), 'fabric-operator-home'))
const pw = process.env.FABRIC_PLAYWRIGHT_MODULE
if (!process.env.FABRIC_TEST_STACK || !pw || !existsSync(path.join(appDir, 'out/main/index.js'))) {
  console.error(JSON.stringify({ status: 'NOT_RUN', reason: 'needs a disposable stack (scripts/test-stack.mjs), FABRIC_PLAYWRIGHT_MODULE and a built app' }))
  process.exit(2)
}
mkdirSync(out, { recursive: true })
const { chromium } = await import(pathToFileURL(path.join(pw, 'index.mjs')).href)
const electron = createRequire(path.join(appDir, 'package.json'))('electron')
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const raw = createJournal(db)

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const check = (cond, m, detail) => { if (cond) ok(m); else { failures++; console.log('  FAIL ' + m + (detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 400))) } }

// ── seed: three projects, tasks along the ladder, briefs in plain words
const estate = randomUUID(), person = { kind: 'person', id: 'operator' }, system = { kind: 'system', id: 'operator-home-probe' }
const repo = mkdtempSync(path.join(tmpdir(), 'fabric-home-repo-'))
const P = { fabric: randomUUID(), site: randomUUID(), ideas: randomUUID() }
// The app bootstraps the estate and the operator's membership itself (an estate seeded before it is one the operator
// is not a member of), so the seed goes in once its window is up.
async function seed() {
  await raw.append({ estateId: estate, type: 'project.created@1', actor: system, projectId: P.fabric, payload: { id: P.fabric, name: 'Fabric', purpose: 'Один экран, чтобы вести проекты с агентами', repo_path: repo } })
  await raw.append({ estateId: estate, type: 'project.created@1', actor: system, projectId: P.site, payload: { id: P.site, name: 'Сайт', purpose: 'Публичная страница продукта', repo_path: repo } })
  await raw.append({ estateId: estate, type: 'project.created@1', actor: system, projectId: P.ideas, payload: { id: P.ideas, name: 'Идеи', purpose: 'Заметки на потом', repo_path: repo } })
  const task = async (projectId, title, brief, moves = [], close = false) => {
    const id = randomUUID()
    await raw.append({ estateId: estate, type: 'task.created@1', actor: person, projectId, payload: { id, title, instruction: `Implement: ${title}. Context, files and constraints follow…`, origin: { kind: 'person', ref: 'probe' }, section: null, task_type: 'development' } })
    if (brief) await raw.append({ estateId: estate, type: 'task.brief.edited@1', actor: person, projectId, payload: { task_id: id, section: 'what', body_md: brief } })
    let from = 'backlog'
    for (const to of moves) { await raw.append({ estateId: estate, type: 'task.moved@1', actor: person, projectId, payload: { task_id: id, from, to } }); from = to }
    if (close) await raw.append({ estateId: estate, type: 'task.closed@1', actor: person, projectId, payload: { task_id: id, outcome: 'done', reason: null } })
    return id
  }
  await task(P.fabric, 'Email sign-in', 'Вход по почте для новых пользователей', ['running', 'review'], true)
  const awake = await task(P.fabric, 'keep-awake setting', 'Компьютер не засыпает, пока работает агент', ['running'])
  await task(P.fabric, 'board import', 'Импорт задач из старой доски', ['running', 'review'])
  await task(P.fabric, 'team roles', 'Роли в команде')
  await task(P.site, 'pricing page', 'Новая страница тарифов', ['running'])
  await task(P.site, 'hero copy', null)
  return awake
}

// ── the app, on a throwaway profile and HOME
const userData = mkdtempSync(path.join(tmpdir(), 'fabric-home-profile-')), home = mkdtempSync(path.join(tmpdir(), 'fabric-home-home-'))
writeFileSync(path.join(userData, 'active-estate.json'), JSON.stringify({ schema: 'ActiveEstate@1', estate_id: estate, recorded_at: new Date().toISOString() }), { mode: 0o600 })
const app = await launchApp({ chromium, plan: launchPlan({ packaged: undefined, electron, appDir, userData }), env: probeEnv({ env: process.env, home }), userData })
try {
  const page = await app.mainWindow().catch((e) => {
    console.log('pages: ' + JSON.stringify(app.browser.contexts().flatMap((c) => c.pages().map((pg) => pg.url()))))
    console.log('output: ' + String(app.output()).slice(-4000))
    for (const f of readdirSync(userData, { recursive: true })) if (/\.(log|jsonl)$/i.test(String(f))) console.log('file: ' + f + '\n' + readFileSync(path.join(userData, String(f)), 'utf8').slice(-2500))
    throw e
  })
  await page.setViewportSize({ width: 1440, height: 1000 }).catch(() => {})
  const awake = await seed()
  await page.reload()
  await page.waitForLoadState('load')
  // A shell session in Fabric, and the stage it reports in its own words.
  const projects = await page.evaluate(() => window.fabric.projects.list())
  check(projects.some((p) => p.name === 'Fabric'), 'the app reads the seeded estate', projects.map((p) => p.name))
  const session = await page.evaluate((pid) => window.fabric.terminal.open(pid, 'shell'), P.fabric)
  await raw.append({ estateId: estate, type: 'agent.stage.reported@1', actor: { kind: 'agent', id: session.sessionId }, projectId: P.fabric,
    payload: { session_id: session.sessionId, task_id: awake, stage: 'Делаем версию, в которой компьютер не засыпает, и выкатываем', step: 3, of_steps: 4, note: null } })
  await page.waitForTimeout(1500)

  // Home
  const view = await page.evaluate(() => window.fabric.work.home())
  check(view.live.some((l) => l.sessionId === session.sessionId && l.doing?.text.startsWith('Делаем версию')), 'work.home: the session in its own words', view.live)
  check(view.inWork.some((w) => w.summary === 'Новая страница тарифов') && view.review.some((r) => r.summary === 'Импорт задач из старой доски'),
    'work.home: in work and to review read in plain words', { inWork: view.inWork.map((w) => w.summary), review: view.review.map((r) => r.summary) })
  await page.getByText(/Делаем версию, в которой компьютер не засыпает/).first().waitFor({ timeout: 30_000 })
  await page.screenshot({ path: path.join(out, 'home.png'), fullPage: true })
  ok('home photographed')

  // Project
  await page.locator('.lp-project-name', { hasText: /^Fabric$/ }).first().click()
  await page.locator('.lp-way .lp-way-step').first().waitFor({ timeout: 30_000 })
  const way = await page.locator('.lp-way').first().innerText()
  check(/Вход по почте/.test(way) && /Компьютер не засыпает/.test(way) && /Роли в команде/.test(way), 'project: came from, now and next in plain words', way)
  check(!/Implement:/.test(await page.locator('.lp').first().innerText()), 'project: no task shows its instruction (the prompt)')
  await page.screenshot({ path: path.join(out, 'project.png'), fullPage: true })
  ok('project photographed')

  // Settings
  // «App settings» lives in the navigation's Manage group.
  await page.getByText(/^(Manage|Управление)$/).first().click()
  await page.getByRole('link', { name: /App settings|Настройки приложения/ }).first().click()
  await page.locator('.lp-settings-agents').waitFor({ timeout: 30_000 })
  await page.locator('.lp-settings-agents [role="status"]').filter({ hasNotText: /Читаю|Reading/ }).waitFor({ timeout: 30_000 })
  await page.locator('.lp-settings-list li').first().waitFor({ timeout: 90_000 })
  check((await page.locator('.lp-settings-list li').count()) > 0, 'settings: the agents on this computer are listed')
  await page.screenshot({ path: path.join(out, 'settings.png'), fullPage: true })
  ok('settings photographed')
} finally {
  await app.quit(30_000).catch((e) => console.log('  note quit: ' + (e?.message ?? e)))
}
console.log(failures ? `FAIL operator home: ${failures} check(s)` : `PASS operator home — screenshots in ${out}`)
process.exit(failures ? 1 : 0)
