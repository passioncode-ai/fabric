/**
 * AD02 manual native acceptance harness. Never imports the production main.
 *
 * Build product renderer/preload first: pnpm --filter @fabric/desktop build
 * Prepare (Node only; launches nothing):
 *   node apps/desktop/test/adoption-native-harness.mjs --prepare restored
 * Modes: restored | corrupt | empty. Printed fixture is safe to reuse on restart.
 * Launch with the package's Electron binary, not `electron .`:
 *   pnpm --filter @fabric/desktop exec electron test/adoption-native-harness.mjs --fixture <printed-dir>
 * Optional --delay-drafts-ms 20000 delays the first read (snapshot at request).
 * Close the window or Cmd+Q, then launch the same command for the restart probe.
 *
 * Actual App/build, actual preload IPC, actual createDrafts + localStore +
 * localState, actual draft/settings validators. Only unrelated reads are seeded.
 * Every other channel rejects; no DB, providers, repo chooser, subprocesses,
 * credentials, live project writes, or production main boot. All browser network
 * requests are denied. The window title explicitly identifies the harness.
 *
 * This is a manual test host, NOT an automated acceptance pass and NOT evidence
 * for production main handler registration, DB, multiple windows or project create.
 * UI driving belongs to CUA. audit.jsonl records disk/IPC boundaries for receipts.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(desktop, 'src')
const arg = key => { const index = process.argv.indexOf(key); return index < 0 ? undefined : process.argv[index + 1] }
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 })
const markerName = 'AD02-HARNESS.json'

if (arg('--prepare')) {
  if (process.versions.electron) throw new Error('Prepare with Node, not Electron')
  const mode = arg('--prepare')
  if (!['restored', 'corrupt', 'empty'].includes(mode)) throw new Error('Expected restored, corrupt or empty')
  const built = ['out/preload/index.cjs', ...fs.readdirSync(path.join(desktop, 'out/renderer'), { recursive: true }).filter(relative => fs.statSync(path.join(desktop, 'out/renderer', relative)).isFile()).map(relative => `out/renderer/${relative}`)]
  for (const relative of built) if (!fs.existsSync(path.join(desktop, relative))) throw new Error(`Build desktop first: missing ${relative}`)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fabric-ad02-native-'))
  fs.chmodSync(dir, 0o700)
  const ts = require('typescript')
  const pins = {}
  // Transpile only the small product dependency graph; no copied implementation.
  // CJS allows Electron's sandbox-independent main to load the actual modules.
  function compile(source) {
    source = fs.realpathSync(source)
    if (!source.startsWith(sourceRoot + path.sep)) throw new Error(`Source outside desktop: ${source}`)
    const relative = path.relative(sourceRoot, source)
    const target = path.join(dir, 'modules', relative.replace(/\.ts$/, '.cjs'))
    if (pins[relative]) return target
    pins[relative] = digest(source)
    let output = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
      fileName: source,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true }
    }).outputText
    output = output.replace(/require\(["'](\.[^"']+)["']\)/g, (_whole, specifier) => {
      const dependency = path.resolve(path.dirname(source), specifier.endsWith('.ts') ? specifier : `${specifier}.ts`)
      const compiled = compile(dependency)
      let request = path.relative(path.dirname(target), compiled)
      if (!request.startsWith('.')) request = './' + request
      return `require(${JSON.stringify(request)})`
    })
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, output, { mode: 0o600 })
    return target
  }
  for (const relative of ['main/onboardingDrafts.ts', 'main/localStore.ts', 'main/localState.ts', 'shared/onboardingDraft.ts', 'shared/types.ts', 'shared/appSettings.ts', 'shared/readEnvelope.ts']) compile(path.join(sourceRoot, relative))
  const { writeLocal } = require(path.join(dir, 'modules/main/localState.cjs'))
  const { validateDraftFile } = require(path.join(dir, 'modules/shared/onboardingDraft.cjs'))
  const { validateSettings } = require(path.join(dir, 'modules/shared/appSettings.cjs'))
  const { APP_SETTINGS_DEFAULTS } = require(path.join(dir, 'modules/shared/types.cjs'))
  const userData = path.join(dir, 'userData')
  fs.mkdirSync(userData, { mode: 0o700 })
  const draft = (projectId, name) => ({ projectId, name, purpose: `Preserve ${name}`, repoPaths: [], memory: 'local', agent: 'claude-code' })
  const seeded = { 'draft-1': draft('ad02-project-1', 'Original one'), 'draft-2': draft('ad02-project-2', 'Original two') }
  if (mode !== 'empty') {
    const result = writeLocal({ dir: userData, file: 'onboarding-drafts.json', empty: {}, validate: validateDraftFile }, seeded)
    if (result.status !== 'committed') throw new Error('Could not seed draft fixture')
    if (mode === 'corrupt') for (const file of ['onboarding-drafts.json', 'onboarding-drafts.json.last-good']) fs.writeFileSync(path.join(userData, file), '{broken AD02 fixture', { mode: 0o600 })
  }
  const tabs = mode === 'empty' ? { tabs: [], active: null } : { tabs: [{ kind: 'draft', id: 'draft-1' }, { kind: 'draft', id: 'draft-2' }], active: { kind: 'draft', id: 'draft-1' } }
  const settings = { ...APP_SETTINGS_DEFAULTS, theme: 'dark', locale: 'en', keepAwake: 'never', workspace: { path: null, git: 'declined' }, tabs }
  const saved = writeLocal({ dir: userData, file: 'settings.json', empty: APP_SETTINGS_DEFAULTS, validate: validateSettings }, settings)
  if (saved.status !== 'committed') throw new Error('Could not seed settings fixture')
  const marker = { kind: 'fabric-ad02-native-only', id: randomUUID(), mode, desktop, createdAt: new Date().toISOString(), sourcePins: pins, buildPins: Object.fromEntries(built.map(relative => [relative, digest(path.join(desktop, relative))])) }
  write(path.join(dir, markerName), marker)
  console.log(JSON.stringify({ fixture: dir, mode, userData, sourceModules: Object.keys(pins), instruction: 'No app launched. Launch Electron with --fixture, then drive manually through CUA.' }, null, 2))
} else {
  if (!process.versions.electron) throw new Error('Use --prepare with Node, or launch this file through Electron with --fixture')
  const candidate = arg('--fixture')
  if (!candidate) throw new Error('Missing --fixture; refusing default userData')
  const dir = fs.realpathSync(candidate)
  const tempRoot = fs.realpathSync(os.tmpdir())
  if (path.dirname(dir) !== tempRoot || !path.basename(dir).startsWith('fabric-ad02-native-')) throw new Error('Fixture must be a harness-owned direct child of system temp')
  const marker = JSON.parse(fs.readFileSync(path.join(dir, markerName), 'utf8'))
  if (marker.kind !== 'fabric-ad02-native-only' || marker.desktop !== desktop) throw new Error('Wrong fixture marker')
  for (const [relative, hash] of Object.entries(marker.sourcePins)) if (digest(path.join(sourceRoot, relative)) !== hash) throw new Error(`Product source changed: prepare a new fixture for ${relative}`)
  for (const [relative, hash] of Object.entries(marker.buildPins)) if (digest(path.join(desktop, relative)) !== hash) throw new Error(`Product build changed: prepare a new fixture for ${relative}`)
  const { app, BrowserWindow, ipcMain, Menu, session } = require('electron')
  app.setName('Fabric AD02 Acceptance')
  for (const key of ['userData', 'sessionData', 'logs', 'crashDumps']) {
    const isolatedPath = path.join(dir, key)
    fs.mkdirSync(isolatedPath, { recursive: true, mode: 0o700 })
    if (fs.realpathSync(isolatedPath) !== isolatedPath) throw new Error('Fixture storage must not redirect through a symlink')
    app.setPath(key, isolatedPath)
  }
  app.commandLine.appendSwitch('disable-background-networking')
  const audit = (kind, detail = {}) => fs.appendFileSync(path.join(dir, 'audit.jsonl'), JSON.stringify({ at: new Date().toISOString(), pid: process.pid, kind, ...detail }) + '\n', { mode: 0o600 })
  audit('start', { mode: marker.mode, userData: app.getPath('userData'), electron: process.versions.electron })
  const { IPC, APP_SETTINGS_DEFAULTS } = require(path.join(dir, 'modules/shared/types.cjs'))
  const { localStore } = require(path.join(dir, 'modules/main/localStore.cjs'))
  const { createDrafts } = require(path.join(dir, 'modules/main/onboardingDrafts.cjs'))
  const { validateDraftFile } = require(path.join(dir, 'modules/shared/onboardingDraft.cjs'))
  const { validateSettings } = require(path.join(dir, 'modules/shared/appSettings.cjs'))
  const { envelope } = require(path.join(dir, 'modules/shared/readEnvelope.cjs'))
  const drafts = createDrafts(localStore('onboarding-drafts.json', {}, validateDraftFile))
  const settings = localStore('settings.json', APP_SETTINGS_DEFAULTS, validateSettings)
  const delay = Number(arg('--delay-drafts-ms') ?? 0)
  if (!Number.isFinite(delay) || delay < 0 || delay > 120000) throw new Error('delay must be 0..120000 milliseconds')
  let firstRead = true
  const handlers = new Map()
  const add = (channel, handler) => handlers.set(channel, handler)
  add(IPC.draftsRead, async () => {
    const result = drafts.read()
    audit('draft-read', { status: result.status, ids: Object.keys(result.drafts), delayedMs: firstRead ? delay : 0 })
    if (firstRead && delay) { firstRead = false; await new Promise(resolve => setTimeout(resolve, delay)) }
    firstRead = false
    return result
  })
  add(IPC.draftsSave, next => {
    const result = drafts.save(next)
    audit('draft-save', { status: result.status, ids: Object.keys(next), names: Object.values(next).map(d => d.name) })
    return result.status === 'committed' ? { saved: true, reason: null } : { saved: false, reason: result.status === 'conflict' ? 'another window changed the drafts while this one was typing' : result.reason }
  })
  add(IPC.tabsRead, () => settings.read().value.tabs)
  add(IPC.tabsWrite, tabs => { const result = settings.update(current => ({ ...current, tabs })); audit('tabs-save', { status: result.status, tabs }); if (result.status !== 'committed') throw new Error('Fixture tabs write failed') })
  add(IPC.settingsRead, () => settings.read().value)
  add(IPC.metaInfo, () => ({ estateName: 'AD02 isolated fixture', filePath: null, sessionId: null }))
  for (const key of ['projectsList', 'terminalList', 'terminalOptions', 'terminalMemoryBackends', 'feedReplay', 'favouritesList']) add(IPC[key], () => [])
  for (const key of ['estateSummary', 'memoryOverview', 'quotaRead']) add(IPC[key], () => null)
  add(IPC.gatewayOffer, () => ({ reachable: false, servers: [] }))
  add(IPC.workspaceState, () => ({ path: null, git: 'declined' }))
  add(IPC.boardQuery, () => ({ rows: [], total: 0 }))
  add(IPC.attentionList, () => { const stamp = new Date().toISOString(); return envelope({ data: [], sources: [{ name: 'isolated-native-fixture', status: 'ok', asOf: stamp }], asOf: stamp, freshness: 'fresh' }) })
  for (const channel of Object.values(IPC)) ipcMain.handle(channel, async (_event, ...args) => {
    const handler = handlers.get(channel)
    if (!handler) { audit('blocked-ipc', { channel }); throw new Error(`AD02 harness disables ${channel}; no production operation was attempted`) }
    return handler(...args)
  })
  await app.whenReady()
  // In-memory browser partition; never the user's default Electron session.
  const isolated = session.fromPartition(`ad02-${marker.id}`)
  isolated.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  isolated.setPermissionCheckHandler(() => false)
  isolated.webRequest.onBeforeRequest((details, callback) => {
    const allowed = details.url.startsWith('file:') || details.url.startsWith('data:')
    if (!allowed) audit('blocked-network', { scheme: details.url.split(':')[0] })
    callback({ cancel: !allowed })
  })
  const win = new BrowserWindow({ width: 1280, height: 900, title: 'Fabric · AD02 isolated acceptance', webPreferences: { preload: path.join(desktop, 'out/preload/index.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, session: isolated } })
  win.on('page-title-updated', event => event.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', event => event.preventDefault())
  win.webContents.on('preload-error', (_event, _preload, error) => audit('preload-error', { error: String(error) }))
  win.webContents.on('render-process-gone', (_event, details) => audit('renderer-gone', { reason: details.reason }))
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'AD02 fixture', submenu: [{ role: 'quit' }] }, { role: 'editMenu' }]))
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => audit('quit', { draftStatus: drafts.read().status, draftIds: Object.keys(drafts.read().drafts) }))
  await win.loadFile(path.join(desktop, 'out/renderer/index.html'))
  audit('renderer-loaded')
  console.log(JSON.stringify({ pid: process.pid, fixture: dir, userData: app.getPath('userData'), title: win.getTitle() }))
}
