// The screens as a person meets them (the screens wave, 2026-11-16). scripts/stand/build-stand.mjs builds the renderer's
// real screens (the home, Агенты with an agent's page, a task, a project, the Board by stage and «Нужны вы», Переписка, Пульс,
// История, План, the graph, Agent access, Settings, the task form) in the
// launch shell's real stylesheets, fed one busy estate (apps/desktop/stand/fixtures.ts). Each screen, in both themes,
// both languages and three widths: no page error, no call the stand does not feed, nothing past the window, no visible
// text under 11 px, and none of the leaks a screen shows when it renders a value it did not mean to: `undefined`,
// `[object Object]`, `NaN`, raw Markdown marks or a registry key. Watched failing on 2026-11-16 before the wave's fixes
// (a note's `**`, a long path past the project page's column). The second wave adds a pill cut at its edge (watched
// failing on «Нужны вы» at 1024 px before its fix). The console wave (the operator, 2026-11-17) adds the console under its
// tab at 1780, 1100 and 820 px: one header (no second «← …» row), the terminal edge to edge with its last line on screen,
// one bar under it inside the window, and two tabs of one project and one coding agent that read apart.
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
  // Board task a832e3ad: Chrome (unlike the headless shell) asks for /favicon.ico, and its 404 reached the page errors on
  // the Linux runner (run 44097689294); the stand has no icon, so it answers with nothing.
  if (rel === '/favicon.ico') { r.writeHead(204); return r.end() }
  const file = path.join(dir, rel === '/' ? 'index.html' : rel)
  if (!file.startsWith(dir) || !existsSync(file)) { r.writeHead(404); return r.end() }
  r.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' })
  r.end(readFileSync(file))
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const port = server.address().port
const SCREENS = ['home', 'agent', 'task', 'project', 'board', 'review', 'comms', 'pulse', 'history', 'plan', 'graph', 'access', 'settings', 'launch', 'console', 'console-ended']
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
        // The screens wave 2: a pill's words fit its box («Ждёт разрешения» ran past a 90 px row end, «Спецификация не
        // собрана» past a kanban card's edge).
        cut: shown.filter((e) => e.classList.contains('lp-pill') && e.scrollWidth > e.clientWidth + 1).slice(0, 3).map((e) => e.textContent.trim().slice(0, 40)),
        text: page.innerText,
        wide: document.documentElement.scrollWidth > innerWidth
      }
    })
    assert.deepEqual(errors, [], `${where}: page errors`)
    assert.deepEqual(r.unknown, [], `${where}: calls the stand does not feed`)
    assert.deepEqual(r.past, [], `${where}: text past the page's edge`)
    assert.deepEqual(r.small, [], `${where}: text under 11px`)
    assert.deepEqual(r.cut, [], `${where}: a pill's words cut at its edge`)
    assert.equal(r.wide, false, `${where}: the document is wider than the window`)
    for (const leak of [/\bundefined\b/, /\[object Object\]/, /\bNaN\b/, /\*\*\S/, /(^|\s)(launch|agentPage|agentScreen|board|task|comms)\.[a-z][a-zA-Z.]+(\s|$)/m])
      assert.ok(!leak.test(r.text), `${where}: the screen shows ${leak}: ${(r.text.match(leak) ?? [''])[0]}`)
    checks += 11
    await p.close()
  }
  // The console wave (2026-11-17), at the operator's window width and the two narrow ones.
  for (const screen of ['console', 'console-ended']) for (const locale of ['ru', 'en']) for (const width of [1780, 1100, 820]) {
    const where = `${screen} ${locale} ${width}`
    const p = await browser.newPage({ viewport: { width, height: 900 } })
    await p.goto(`http://127.0.0.1:${port}/index.html#screen=${screen}&locale=${locale}&theme=dark`)
    await p.waitForSelector(`body[data-mounted="${screen}"]`, { timeout: 15000 })
    await p.waitForSelector('.session-bar', { timeout: 15000 })
    await p.waitForTimeout(900)
    const c = await p.evaluate(() => {
      const page = document.getElementById('page')
      const pr = page.getBoundingClientRect()
      const hostEl = document.querySelector('.session-embedded > .terminal-host')
      if (!hostEl) return { missing: 'the terminal is not a direct child of the console (a box or a header wraps it)' }
      const host = hostEl.getBoundingClientRect()
      const fit = document.querySelector('.terminal-fit').getBoundingClientRect()
      const bar = document.querySelector('.session-bar')
      const br = bar.getBoundingClientRect()
      const rows = [...document.querySelectorAll('.xterm-rows > div')]
      const last = rows.filter((r) => r.textContent.includes('ПОСЛЕДНЯЯ СТРОКА')).pop()
      const lr = last?.getBoundingClientRect()
      return {
        seconds: document.querySelectorAll('.session-head, .session-back').length + [...page.querySelectorAll('*')].filter((e) => /^←/.test(e.textContent.trim()) && e.children.length === 0).length,
        scrolls: page.scrollHeight > page.clientHeight + 1,
        margin: Math.max(Math.abs(host.left - pr.left), Math.abs(pr.right - host.right)),
        lastSeen: !!lr && lr.top >= fit.top - 1 && lr.bottom <= fit.bottom + 1 && lr.bottom <= br.top + 1,
        barInWindow: br.top >= 0 && br.bottom <= innerHeight + 1 && br.top >= host.bottom - 1,
        barCut: [...bar.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); return r.right > br.right + 1 || r.left < br.left - 1 || b.scrollWidth > b.clientWidth + 1 }).map((b) => b.textContent.trim()),
        tabs: [...document.querySelectorAll('.fab-console-name')].map((e) => e.textContent),
        ended: !!document.querySelector('.session-new button'),
        wide: document.documentElement.scrollWidth > innerWidth
      }
    })
    assert.equal(c.missing, undefined, `${where}: ${c.missing}`)
    assert.equal(c.seconds, 0, `${where}: a second header or «← …» row over the console`)
    assert.equal(c.scrolls, false, `${where}: the page around the console scrolls`)
    assert.ok(c.margin <= 1, `${where}: the terminal does not reach the page's edges (${c.margin}px)`)
    assert.ok(c.lastSeen, `${where}: the terminal's last line is cut or off screen`)
    assert.ok(c.barInWindow, `${where}: the bar under the terminal is not inside the window`)
    assert.deepEqual(c.barCut, [], `${where}: a control of the bar is cut`)
    assert.equal(c.tabs.length, 2, `${where}: two console tabs`)
    assert.equal(new Set(c.tabs).size, 2, `${where}: two tabs read the same: ${c.tabs.join(' | ')}`)
    assert.equal(c.ended, screen === 'console-ended', `${where}: «New session» is offered exactly when the session ended`)
    assert.equal(c.wide, false, `${where}: the document is wider than the window`)
    checks += 10
    await p.close()
  }
} finally { await browser.close(); server.close() }
console.log(`screens stand: ${checks} checks pass`)
