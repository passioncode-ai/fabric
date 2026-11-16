// The screens as a person meets them (the screens wave, 2026-11-16). scripts/stand/build-stand.mjs builds the renderer's
// real screens (Агенты with an agent's page, a task, a project, the Board by stage and «Нужны вы», Переписка) in the
// launch shell's real stylesheets, fed one busy estate (apps/desktop/stand/fixtures.ts). Each screen, in both themes,
// both languages and three widths: no page error, no call the stand does not feed, nothing past the window, no visible
// text under 11 px, and none of the leaks a screen shows when it renders a value it did not mean to: `undefined`,
// `[object Object]`, `NaN`, raw Markdown marks or a registry key. Watched failing on 2026-11-16 before the wave's fixes
// (a note's `**`, a long path past the project page's column).
import http from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root = path.resolve(import.meta.dirname, '../..')
await import(path.join(root, 'scripts/stand/build-stand.mjs'))
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dir = path.join(root, 'apps/desktop/out/stand')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff' }
const server = http.createServer((q, r) => {
  const rel = decodeURIComponent(q.url.split('?')[0].split('#')[0])
  const file = path.join(dir, rel === '/' ? 'index.html' : rel)
  if (!file.startsWith(dir) || !existsSync(file)) { r.writeHead(404); return r.end() }
  r.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' })
  r.end(readFileSync(file))
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const port = server.address().port
const SCREENS = ['agent', 'task', 'project', 'board', 'review', 'comms']
const browser = await chromium.launch({ headless: true, ...(process.env.FABRIC_CHROME ? { executablePath: process.env.FABRIC_CHROME } : {}) })
let checks = 0
try {
  for (const screen of SCREENS) for (const locale of ['ru', 'en']) for (const theme of ['dark', 'light']) for (const width of [1280, 1024, 820]) {
    if (locale === 'en' && width !== 1280) continue
    const where = `${screen} ${locale} ${theme} ${width}`
    const p = await browser.newPage({ viewport: { width, height: 1200 } })
    const errors = []
    p.on('pageerror', (e) => errors.push(e.message))
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await p.goto(`http://127.0.0.1:${port}/index.html#screen=${screen}&locale=${locale}&theme=${theme}`)
    await p.waitForSelector(`body[data-mounted="${screen}"]`, { timeout: 15000 })
    await p.waitForTimeout(700)
    const r = await p.evaluate(() => {
      const page = document.getElementById('page')
      const edge = page.getBoundingClientRect().right
      const shown = [...page.querySelectorAll('*')].filter((e) => {
        const s = getComputedStyle(e)
        return s.display !== 'none' && s.visibility !== 'hidden' && e.getClientRects().length > 0
      })
      const texts = shown.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      const scroller = (e) => { for (let a = e.parentElement; a && a !== page; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true } return false }
      return {
        unknown: [...(window.__standUnknown ?? [])],
        past: texts.filter((e) => !scroller(e) && e.getBoundingClientRect().right > edge + 1).slice(0, 3).map((e) => `${e.tagName}.${e.className}: ${e.textContent.trim().slice(0, 40)}`),
        small: texts.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 11).slice(0, 3).map((e) => `${e.className} ${getComputedStyle(e).fontSize}`),
        text: page.innerText,
        wide: document.documentElement.scrollWidth > innerWidth
      }
    })
    assert.deepEqual(errors, [], `${where}: page errors`)
    assert.deepEqual(r.unknown, [], `${where}: calls the stand does not feed`)
    assert.deepEqual(r.past, [], `${where}: text past the page's edge`)
    assert.deepEqual(r.small, [], `${where}: text under 11px`)
    assert.equal(r.wide, false, `${where}: the document is wider than the window`)
    for (const leak of [/\bundefined\b/, /\[object Object\]/, /\bNaN\b/, /\*\*\S/, /(^|\s)(launch|agentPage|agentScreen|board|task|comms)\.[a-z][a-zA-Z.]+(\s|$)/m])
      assert.ok(!leak.test(r.text), `${where}: the screen shows ${leak}: ${(r.text.match(leak) ?? [''])[0]}`)
    checks += 10
    await p.close()
  }
} finally { await browser.close(); server.close() }
console.log(`screens stand: ${checks} checks pass`)
