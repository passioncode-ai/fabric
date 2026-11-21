const http = require('http'), fs = require('fs'), path = require('path')
const root = process.argv[2], pw = require(process.argv[3]), engine = process.argv[4]
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res)
})
server.listen(0, '127.0.0.1', async () => {
  const origin = `http://127.0.0.1:${server.address().port}`
  const browser = await pw[engine].launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const requests = [], errors = []
  page.on('request', (r) => requests.push(r.url())); const bad=[]; const esm={sent:0,failed:0,answered:0,reasons:{}}; page.on('requestfailed',(r)=>{ if(/esm\.sh/.test(r.url())){esm.failed++; const k=(r.failure()||{}).errorText||'?'; esm.reasons[k]=(esm.reasons[k]||0)+1} }); page.on('response',(r)=>{ if(/esm\.sh/.test(r.url())) esm.answered++ }); page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status()+' '+r.url()) })
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)) })
  await page.addInitScript(() => {
    const saves = []; let onCommand = null; const answers = []
    const noop = () => new Proxy(function () {}, { get: (_t, k) => (k === 'then' ? undefined : noop()), apply: () => Promise.resolve(undefined) })
    const fabric = {
      settings: { read: () => Promise.resolve({ theme: 'light', locale: 'ru' }) },
      canvas: {
        load: () => Promise.resolve({ ok: true, scene: null }),
        save: (id, text) => { saves.push({ id, text }); return Promise.resolve({ ok: true }) },
        ready: () => Promise.resolve({ ok: true }),
        answer: (id, requestId, answer) => { answers.push({ requestId, answer }); return Promise.resolve({ ok: true }) },
        onCommand: (cb) => { onCommand = cb; return () => { onCommand = null } },
        open: () => Promise.resolve({ ok: true })
      }
    }
    window.fabric = new Proxy(fabric, { get: (t, k) => (k in t ? t[k] : noop()) })
    window.__cv = { saves, answers, send: (c) => onCommand && onCommand('main', 'req-1', c), hasListener: () => !!onCommand }
  })
  const out = { engine }
  try {
    await page.goto(origin + '/canvas.html', { waitUntil: 'load' })
    await page.waitForSelector('.excalidraw canvas', { timeout: 30000 })
    await page.waitForTimeout(1500)
    out.editor = true
    out.topbar = (await page.locator('body').innerText()).split('\n').filter((l) => /Сохран|Канвас/.test(l)).slice(0, 4)
    // CV-REQ-02: draw a rectangle and an arrow with the mouse (the editor's own tools, keys r and a).
    await page.mouse.click(700, 600); await page.keyboard.press('r'); await page.mouse.move(400, 300); await page.mouse.down(); await page.mouse.move(640, 440, { steps: 8 }); await page.mouse.up()
    await page.keyboard.press('a'); await page.mouse.move(660, 370); await page.mouse.down(); await page.mouse.move(900, 370, { steps: 8 }); await page.mouse.up()
    await page.keyboard.press('t'); await page.mouse.click(500, 600); await page.keyboard.type('Hello Привет'); await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
    await page.waitForFunction(() => window.__cv.saves.length > 0, null, { timeout: 15000 })
    await page.waitForTimeout(2500)
    const last = await page.evaluate(() => window.__cv.saves[window.__cv.saves.length - 1])
    const scene = JSON.parse(last.text)
    out.saved = { canvasId: last.id, type: scene.type, elements: scene.elements.filter((e) => !e.isDeleted).map((e) => e.type) }
    out.stateAfterSave = (await page.locator('body').innerText()).split('\n').filter((l) => /Сохран/.test(l)).slice(0, 2)
    out.commandListener = await page.evaluate(() => window.__cv.hasListener())
    await page.screenshot({ path: `/tmp/cv-check/canvas-${engine}.png` })
  } catch (e) { out.failed = String(e).slice(0, 400) }
  out.esm = esm; out.localFonts = requests.filter((u)=>/excalidraw-assets/.test(u)).length; out.requests = requests.length
  out.foreignRequests = requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')).length
  out.fontRequests = requests.filter((u) => /\.woff2?$/.test(u)).length
  out.errors = errors.filter((e)=>!/esm\.sh/.test(e)).slice(0, 4); out.esmRefusals = errors.filter((e)=>/esm\.sh/.test(e)).length; out.errorCount = errors.length; out.bad = bad.slice(0,12); out.fonts = requests.filter((u) => /\.woff2?$/.test(u)).map((u)=>u.replace(origin,'')).filter((u)=>/excalidraw-assets/.test(u)).slice(0,6)
  console.log(JSON.stringify(out, null, 1))
  await browser.close(); server.close()
})
