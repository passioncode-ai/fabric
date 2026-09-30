#!/usr/bin/env node
// The launch design beside the app, at the same size (SCR-30…SCR-41).
//
//   psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/fixtures/launch-estate.sql   # once
//   pnpm --dir apps/desktop exec electron-vite build
//   FABRIC_PLAYWRIGHT_MODULE=<playwright> FABRIC_CHROME=<chrome> \
//     node scripts/launch/compare-shots.mjs --out <dir> [--view launch-home] [--estate <uuid>] [--locale ru]
//
// Writes <view>.mock.png (the prototype, docs/reports/product.html#view-<view>) and
// <view>.app.png (the built app on the launch demo estate), both 1440×900, plus the app's
// page and console errors. The app runs with a throwaway user-data folder, so nothing of the
// operator's is read or written; the estate is the demo one unless --estate names another.
// It compares nothing by itself — pixels differ by content — it puts the two side by side.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback }
const root = path.resolve(import.meta.dirname, '..', '..'), appDir = path.join(root, 'apps', 'desktop')
const pw = process.env.FABRIC_PLAYWRIGHT_MODULE, chrome = process.env.FABRIC_CHROME
if (!pw || !chrome) { console.error('set FABRIC_PLAYWRIGHT_MODULE and FABRIC_CHROME'); process.exit(2) }
if (!existsSync(path.join(appDir, 'out', 'main', 'index.js'))) { console.error('build the app first: pnpm --dir apps/desktop exec electron-vite build'); process.exit(2) }
const out = path.resolve(arg('out', path.join(tmpdir(), 'fabric-launch-shots'))), view = arg('view', 'launch-home')
const estate = arg('estate', '00000000-0000-0000-0000-00000000de30'), locale = arg('locale', 'ru')
mkdirSync(out, { recursive: true })
const { chromium, _electron } = await import(pathToFileURL(path.join(pw, 'index.mjs')).href)

// The prototype, served over http because its router reads location.hash.
const html = readFileSync(path.join(root, 'docs', 'reports', 'product.html'))
const server = http.createServer((_q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(html) }).listen(0, '127.0.0.1')
await new Promise((r) => server.once('listening', r))
const browser = await chromium.launch({ executablePath: chrome })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`http://127.0.0.1:${server.address().port}/product.html#view-${view}`, { waitUntil: 'load' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(out, `${view}.mock.png`) })
} finally { await browser.close(); server.close() }

// The app, on a throwaway profile that names the estate and the language.
const userData = mkdtempSync(path.join(tmpdir(), 'fabric-launch-'))
writeFileSync(path.join(userData, 'active-estate.json'), JSON.stringify({ schema: 'ActiveEstate@1', estate_id: estate, recorded_at: new Date().toISOString() }), { mode: 0o600 })
writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ locale }), { mode: 0o600 })
const electron = createRequire(path.join(appDir, 'package.json'))('electron')
const app = await _electron.launch({ executablePath: electron, args: ['.', `--user-data-dir=${userData}`], cwd: appDir, timeout: 180_000 })
const errors = []
try {
  const win = await app.firstWindow()
  await win.setViewportSize({ width: 1440, height: 900 }).catch(() => {})
  win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
  win.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)))
  await win.locator('.fabric-launcher').waitFor({ timeout: 120_000 })
  // The workspace question is a real state of a fresh profile; the design shows the settled home.
  await win.getByRole('button', { name: /^(Not now|Не сейчас)$/ }).click({ timeout: 3000 }).catch(() => {})
  await win.waitForTimeout(1500)
  await win.screenshot({ path: path.join(out, `${view}.app.png`) })
} finally {
  const exited = new Promise((r) => app.process().once('exit', r))
  void app.evaluate(({ app }) => app.quit()).catch(() => {})
  await Promise.race([exited, new Promise((r) => setTimeout(r, 30_000))])
}
console.log(JSON.stringify({ out, view, estate, locale, errors }, null, 1))
if (errors.length) process.exitCode = 1
