#!/usr/bin/env node
// #region walk-ceo-acceptance — docs: docs/evidence/plans/2026-11-18-ceo-agent/acceptance.md#how-the-walk-runs
// The CEO agent's acceptance walk (ADR-0197): a BUILT development app with a data folder of its own, against a
// disposable stack (`scripts/test-stack.mjs`), never the operator's installed Fabric or its stack. Two commands:
//
//   node scripts/test-stack.mjs with <stack-dir> -- node scripts/walk/ceo-acceptance.mjs launch <work-dir> [--port N] [--no-claude]
//       start the app (its user-data folder under <work-dir>, a new estate, the first run marked done) and leave it
//       running; `--no-claude` points CLAUDE_CONFIG_DIR at an empty folder, so Claude Code reads as signed out (SCN-185);
//       `--fake-voice <wav>` gives Chromium a fake microphone that plays the file (SCN-184), no system prompt.
//   node scripts/walk/ceo-acceptance.mjs eval <port> <page: main|ceo|session> <js>       evaluate in a page, print JSON
//   node scripts/walk/ceo-acceptance.mjs shot <port> <page> <file.png>                   screenshot a page
//   node scripts/walk/ceo-acceptance.mjs files <port> <page> <selector> <file…>          set an <input type=file>'s files
//   node scripts/walk/ceo-acceptance.mjs stop <work-dir>                                 quit the app it started
//
// The hub's port is the installed Fabric's, so this app's hub stays closed (no hub.json is written); its consoles
// keep their own surface on an ephemeral port, the CEO's tools included.
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const APP = path.join(ROOT, 'apps/desktop')
const [, , cmd, ...rest] = process.argv
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function targets(port) {
  return (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((t) => t.type === 'page')
}
async function page(port, which) {
  for (let i = 0; i < 120; i++) {
    const list = await targets(port).catch(() => [])
    const t = list.find((x) => which === 'ceo' ? x.url.includes('ceo.html') : which === 'session' ? x.url.includes('session=') : !x.url.includes('ceo.html') && !x.url.includes('session=') && !x.url.startsWith('devtools') && !x.url.startsWith('data:'))
    if (t) return t.webSocketDebuggerUrl
    await sleep(500)
  }
  throw new Error(`no ${which} page on port ${port}`)
}
async function cdp(port, which, fn) {
  const ws = new WebSocket(await page(port, which))
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (m) => { const d = JSON.parse(m.data); const p = pending.get(d.id); if (p) { pending.delete(d.id); d.error ? p.reject(new Error(d.error.message)) : p.resolve(d.result) } }
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })
  try { return await fn(send) } finally { ws.close() }
}

if (cmd === 'launch') {
  const { probeEnv } = await import('../lib/test-stack.mjs')
  const stackEnv = probeEnv()
  const work = path.resolve(rest[0])
  const port = rest.includes('--port') ? Number(rest[rest.indexOf('--port') + 1]) : 9411
  const noClaude = rest.includes('--no-claude')
  const voice = rest.includes('--fake-voice') ? path.resolve(rest[rest.indexOf('--fake-voice') + 1]) : null
  const userData = path.join(work, noClaude ? 'user-data-no-claude' : 'user-data')
  mkdirSync(userData, { recursive: true })
  if (!existsSync(path.join(userData, 'active-estate.json')))
    writeFileSync(path.join(userData, 'active-estate.json'), JSON.stringify({ schema: 'ActiveEstate@1', estate_id: randomUUID(), recorded_at: new Date().toISOString() }), { mode: 0o600 })
  const settingsFile = path.join(userData, 'settings.json')
  const settings = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) : {}
  writeFileSync(settingsFile, JSON.stringify({ ...settings, theme: 'dark', locale: 'ru', firstRun: { completedAt: new Date().toISOString() }, dispatchBoardRequests: false, resumeLeftWork: false, peopleAsk: false }, null, 2))
  const electron = createRequire(path.join(APP, 'package.json'))('electron')
  const env = { ...stackEnv, FABRIC_NO_KEYCHAIN: '1' }
  if (noClaude) { mkdirSync(path.join(work, 'no-claude-config'), { recursive: true }); env.CLAUDE_CONFIG_DIR = path.join(work, 'no-claude-config') }
  const args = [APP, `--user-data-dir=${userData}`, `--remote-debugging-port=${port}`]
  if (voice) args.unshift('--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${voice}`)
  const child = spawn(electron, args, { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  const log = path.join(work, noClaude ? 'app-no-claude.log' : 'app.log')
  child.stdout.on('data', (d) => writeFileSync(log, d, { flag: 'a' }))
  child.stderr.on('data', (d) => writeFileSync(log, d, { flag: 'a' }))
  writeFileSync(path.join(work, noClaude ? 'app-no-claude.pid' : 'app.pid'), String(child.pid))
  await page(port, 'main')
  console.log(JSON.stringify({ pid: child.pid, port, userData, log }))
  child.unref()
  process.exit(0)
} else if (cmd === 'eval') {
  const [port, which, js] = rest
  const r = await cdp(Number(port), which, (send) => send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true }))
  if (r.exceptionDetails) { console.error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); process.exit(1) }
  console.log(JSON.stringify(r.result.value, null, 1))
} else if (cmd === 'shot') {
  const [port, which, file] = rest
  const r = await cdp(Number(port), which, (send) => send('Page.captureScreenshot', { format: 'png' }))
  writeFileSync(file, Buffer.from(r.data, 'base64'))
  console.log(file)
} else if (cmd === 'files') {
  const [port, which, selector, ...files] = rest
  await cdp(Number(port), which, async (send) => {
    const { root } = await send('DOM.getDocument')
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector })
    if (!nodeId) throw new Error(`no ${selector}`)
    await send('DOM.setFileInputFiles', { nodeId, files: files.map((f) => path.resolve(f)) })
  })
  console.log('set')
} else if (cmd === 'stop') {
  const work = path.resolve(rest[0])
  for (const f of ['app.pid', 'app-no-claude.pid']) {
    if (!existsSync(path.join(work, f))) continue
    const pid = Number(readFileSync(path.join(work, f), 'utf8'))
    try { process.kill(pid, 'SIGTERM'); console.log(`SIGTERM ${pid}`) } catch { console.log(`${pid} already gone`) }
  }
} else {
  console.error('usage: launch | eval | shot | files | stop (see the head of this file)')
  process.exit(2)
}
// #endregion walk-ceo-acceptance
