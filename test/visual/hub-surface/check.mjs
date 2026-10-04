// #region hub-surface-visual — docs: docs/handoffs/surface-resume.md#browser-validation
// Run after starting the Vite harness. Optional browser provider is supplied by the environment.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const { chromium } = await import(process.env.FABRIC_PLAYWRIGHT_MODULE ?? 'playwright-core')
const out = process.env.FABRIC_SURFACE_SHOTS ?? 'docs/handoffs/surface-shots'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ ...(process.env.FABRIC_CHROMIUM ? { executablePath: process.env.FABRIC_CHROMIUM } : {}), args: ['--use-mock-keychain'] })
const results = []
const captures = []
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const sourceFiles = ['apps/desktop/src/renderer/src/AgentAccessPanel.tsx', 'apps/desktop/src/renderer/src/launch/BoardScreen.tsx', 'apps/desktop/src/renderer/src/launch/ObligationActs.tsx', 'apps/desktop/src/renderer/src/styles.css', 'apps/desktop/src/renderer/src/launch/launch.css', 'apps/desktop/src/renderer/src/i18n/en.ts', 'apps/desktop/src/renderer/src/i18n/ru.ts', 'apps/desktop/src/shared/accessWords.ts']
const sourceFingerprints = Object.fromEntries(await Promise.all(sourceFiles.map(async f => [f, createHash('sha256').update(await fs.readFile(f)).digest('hex')])))
try {
  for (const locale of ['en', 'ru']) for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 760, height: 1000 }, reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    const visit = async (scenario, view = 'panel') => {
      await page.goto(`http://127.0.0.1:5297/?s=${scenario}&l=${locale}&t=${theme}&v=${view}`)
      await page.locator(view === 'panel' ? '.access-card' : '.lp-access-facts').first().waitFor()
      await page.evaluate(() => document.fonts.ready)
    }
    const capture = async (file, state, scenario) => {
      await page.screenshot({ path: path.join(out, file) })
      captures.push({ file, revision, sourceFingerprints, route: page.url(), scenario, state, viewport: { width: 760, height: 1000, devicePixelRatio: await page.evaluate(() => devicePixelRatio) }, locale, theme, motion: 'reduced', capturedAt: new Date().toISOString(), source: 'Playwright Chromium harness' })
    }
    await visit('long')
    const panelOverflow = await page.locator('.access-asks li, .access-acts .toolbar').evaluateAll(xs => xs.filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.className))
    assert.deepEqual(panelOverflow, [], 'long consent facts or actions overflow')
    await page.locator('.access-asks').scrollIntoViewIfNeeded()
    await capture(`after-long-panel-${locale}-${theme}.png`, 'pending-long-resource', 'SCN-132')
    await visit('reconnectWaiting')
    const reconnect = page.getByRole('button', { name: locale === 'en' ? 'Reconnect' : 'Переподключить', exact: true })
    assert.equal(await reconnect.isDisabled(), true)
    assert.match(await page.locator('.access-card').innerText(), locale === 'en' ? /keeps using the current one/ : /пользуется текущим/)
    await capture(`after-reconnect-waiting-${locale}-${theme}.png`, 'reconnect-waiting', 'SCN-133')
    await visit('full')
    const allow = page.getByRole('button', { name: locale === 'en' ? 'Allow Research desk' : 'Разрешить: Research desk', exact: true })
    await allow.focus()
    await allow.click()
    await page.waitForFunction(() => document.activeElement?.tagName === 'H3')
    assert.match(await page.evaluate(() => document.activeElement?.textContent), locale === 'en' ? /Waiting/ : /Ждут/)
    await visit('long', 'board')
    const boardOverflow = await page.locator('.lp-facts-asks li').evaluateAll(xs => xs.filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.className))
    assert.deepEqual(boardOverflow, [], 'queue facts overflow')
    const grid = await page.locator('dl.lp-facts').first().evaluate(x => getComputedStyle(x).display)
    assert.equal(grid, 'grid')
    await page.locator('.lp-access-facts').scrollIntoViewIfNeeded()
    await capture(`after-long-board-${locale}-${theme}.png`, 'pending-long-resource', 'SCN-132')
    await visit('full', 'board')
    await page.getByRole('button', { name: locale === 'en' ? 'Allow Research desk' : 'Разрешить: Research desk', exact: true }).click()
    await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'status')
    const focus = await page.evaluate(() => document.activeElement?.textContent)
    assert.match(focus, /Research desk/)
    assert.deepEqual(errors, [], 'renderer page errors')
    results.push({ locale, theme, viewport: 760, longPanel: 'PASS', longBoard: 'PASS', factGrid: grid, waiting: 'PASS', panelFocus: 'PASS', boardFocus: 'PASS' })
    await page.close()
  }
} finally { await browser.close() }
await fs.writeFile(path.join(out, 'captures.json'), JSON.stringify({ revision, captures }, null, 2) + '\n')
console.log(JSON.stringify({ status: 'PASS', cases: results }, null, 2))
// #endregion hub-surface-visual
