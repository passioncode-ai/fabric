// Usage analytics (passioncode-ai/fabric#12): a synthetic Aptabase server, temporary directories, nothing real.
// #region usage-analytics — docs: docs/ANALYTICS.md#what-is-sent
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import {
  createAnalytics, readOrCreateInstallation, writeAnalyticsSwitch, installationPath, cleanProps,
  BATCH_MAX, QUEUE_MAX, RETRY_DELAYS_MS, environmentFor
} from '../src/main/analytics.ts'

const dir = () => mkdtempSync(path.join(tmpdir(), 'fabric-analytics-'))
const KEY = 'A-SH-0000000000'
const server = (statuses = []) => {
  const calls = []
  const fetch = async (url, init) => { calls.push({ url, init, events: JSON.parse(init.body) }); const s = statuses.shift() ?? 200; if (s === 'throw') throw new Error('offline'); return { status: s } }
  return { fetch, calls }
}
const timers = () => {
  const pending = []
  return { pending, setTimer: (fn, ms) => { const t = { fn, ms }; pending.push(t); return t }, clearTimer: (t) => { const i = pending.indexOf(t); if (i >= 0) pending.splice(i, 1) },
    run: async () => { const t = pending.shift(); t.fn(); await new Promise(r => setImmediate(r)) } }
}
const make = (d, over = {}) => {
  const s = over.server ?? server(), t = over.timers ?? timers(), logs = []
  const a = createAnalytics({ appKey: KEY, appVersion: '0.3.2', osName: 'macOS', installationFile: path.join(d, 'PassionCode', 'installation.json'),
    stateFile: path.join(d, 'fabric', 'analytics-state.json'), fetch: s.fetch, setTimer: t.setTimer, clearTimer: t.clearTimer, log: l => logs.push(l), ...over.deps })
  return { a, s, t, logs }
}

test('the installation file lives where every PassionCode app looks for it', () => {
  assert.equal(installationPath('darwin', {}, '/Users/x'), '/Users/x/Library/Application Support/PassionCode/installation.json')
  assert.equal(installationPath('win32', { APPDATA: 'C:\\Users\\x\\AppData\\Roaming' }, 'C:\\Users\\x'), path.join('C:\\Users\\x\\AppData\\Roaming', 'PassionCode', 'installation.json'))
})

test('the shared id is created once and never overwritten; unknown fields survive the switch', () => {
  const d = dir(), file = path.join(d, 'PassionCode', 'installation.json')
  const first = readOrCreateInstallation(file)
  assert.equal(first.ok, true); assert.equal(first.createdNow, true); assert.match(first.installation.id, /^[0-9a-f-]{36}$/)
  const second = readOrCreateInstallation(file)
  assert.equal(second.createdNow, false); assert.equal(second.installation.id, first.installation.id)
  writeFileSync(file, JSON.stringify({ ...first.installation, inbox_seen: 3 }))
  assert.equal(writeAnalyticsSwitch(file, false), true)
  const after = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(after.analytics, false); assert.equal(after.inbox_seen, 3, 'another app\'s field was kept'); assert.equal(after.id, first.installation.id)
  rmSync(d, { recursive: true, force: true })
})

test('two processes racing to create it end with one id between them', async () => {
  const d = dir(), file = path.join(d, 'PassionCode', 'installation.json'), lib = path.resolve(import.meta.dirname, '../src/main/analytics.ts')
  const racer = `import { readOrCreateInstallation } from ${JSON.stringify(lib)}; const r = readOrCreateInstallation(${JSON.stringify(file)}); process.stdout.write(r.ok ? r.installation.id : 'FAIL')`
  const ids = await Promise.all(Array.from({ length: 6 }, () => new Promise((resolve) => {
    const c = spawn(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', racer]); let out = ''
    c.stdout.on('data', b => { out += b }); c.on('exit', () => resolve(out))
  })))
  assert.equal(new Set(ids).size, 1, ids.join(' ')); assert.ok(!ids.includes('FAIL'))
  rmSync(d, { recursive: true, force: true })
})

test('a file that does not parse, or whose id is not a UUID v4, is never repaired and keeps analytics off', () => {
  for (const body of ['{not json', JSON.stringify({ version: 1, id: 'abc', analytics: true }), JSON.stringify({ version: 2, id: '6f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', analytics: true })]) {
    const d = dir(), file = path.join(d, 'PassionCode', 'installation.json')
    readOrCreateInstallation(file); writeFileSync(file, body)
    const { a, s } = make(d)
    assert.equal(a.availability(), 'unavailable-file')
    a.started('ordinary', { projects: 1 }); a.track('app_active')
    assert.equal(a.pending(), 0); assert.equal(s.calls.length, 0)
    assert.equal(readFileSync(file, 'utf8'), body, 'the file was left exactly as it was')
    rmSync(d, { recursive: true, force: true })
  }
})

test('a build without an App Key sends nothing and creates no state', async () => {
  const d = dir()
  const { a, s } = make(d, { deps: { appKey: null } })
  assert.equal(a.availability(), 'unavailable-no-key')
  a.started('ordinary', {}); await a.flush()
  assert.equal(s.calls.length, 0); assert.equal(existsSync(path.join(d, 'fabric', 'analytics-state.json')), false)
  rmSync(d, { recursive: true, force: true })
})

test('events carry counts and the installation id, never a planted name, path, e-mail or id', async () => {
  const d = dir()
  const { a, s, t } = make(d)
  a.track('project_added', { projects: 3, kind: 'folder', name: 'Secret Project', path: '/Users/x/secret', email: 'person@example.com', project_id: '00000000-0000-4000-8000-000000000123' })
  await t.run()
  const sent = JSON.stringify(s.calls.map(c => c.events))
  for (const planted of ['Secret Project', '/Users/x/secret', 'person@example.com', '00000000-0000-4000-8000-000000000123'])
    assert.ok(!sent.includes(planted), `${planted} left the machine`)
  const e = s.calls[0].events[0]
  assert.equal(s.calls[0].init.headers['App-Key'], KEY); assert.match(s.calls[0].url, /\/api\/v0\/events$/)
  assert.equal(e.eventName, 'project_added'); assert.equal(e.props.projects, 3); assert.equal(e.props.kind, 'folder')
  assert.equal(e.props.install_id, a.installId()); assert.equal(e.systemProps.isDebug, false); assert.equal(e.systemProps.sdkVersion, 'fabric-analytics@1')
  assert.match(e.sessionId, /^\d{18}$/)
  assert.equal(e.props.iid, a.installId(), 'sshlg-growth counts installs by props.iid')
  assert.equal(e.props.environment, 'production', 'a packaged release version is production')
  rmSync(d, { recursive: true, force: true })
})

test('environment: production only for an installed release version, sandbox otherwise (sshlg-growth decision 3)', () => {
  assert.equal(environmentFor('0.3.2', true), 'production')
  assert.equal(environmentFor('0.3.2-rc.1', true), 'sandbox')
  assert.equal(environmentFor('0.3.2-beta.2', true), 'sandbox')
  assert.equal(environmentFor('0.3.2', false), 'sandbox', 'a development run is sandbox')
})

test('cleanProps keeps numbers, booleans and known kinds only — a short lower-case name is still a name', () => {
  assert.deepEqual(cleanProps({ n: 2, b: true, kind: 'fabric-inbox', Bad: 1, text: 'Hello World', slug: 'secret-project', nan: NaN, obj: {}, long: 'x'.repeat(41) }), { n: 2, b: true, kind: 'fabric-inbox' })
})

test('turning the switch off drops what waits and stops sending; another app\'s switch is honoured on refresh', async () => {
  const d = dir()
  const { a, s, t } = make(d)
  a.track('app_started', { launch: 'ordinary' })
  assert.equal(a.pending(), 1)
  assert.equal(a.setEnabled(false), 'off'); assert.equal(a.pending(), 0)
  a.track('app_active'); while (t.pending.length) await t.run()
  assert.equal(s.calls.length, 0)
  assert.equal(a.setEnabled(true), 'on')
  const file = path.join(d, 'PassionCode', 'installation.json')
  writeAnalyticsSwitch(file, false)   // as another PassionCode app would
  assert.equal(a.refresh(), 'off')
  rmSync(file); assert.equal(a.refresh(), 'unavailable-file', 'a removed file is not recreated behind the person\'s back')
  assert.equal(existsSync(file), false)
  rmSync(d, { recursive: true, force: true })
})

test('delivery: batches of 25; transport, 429 and 5xx keep the batch and back off; 400 and 404 drop it', async () => {
  const d = dir()
  const s = server(['throw', 429, 503, 200, 200, 404])
  const { a, t, logs } = make(d, { server: s })
  for (let i = 0; i < 30; i++) a.track('app_active', { i })
  await t.run()                                   // transport error
  assert.equal(s.calls[0].events.length, BATCH_MAX); assert.equal(a.pending(), 30); assert.equal(t.pending[0].ms, RETRY_DELAYS_MS[0])
  await t.run()                                   // 429
  assert.equal(t.pending[0].ms, RETRY_DELAYS_MS[1])
  await t.run()                                   // 503 → still 10 min
  assert.equal(t.pending[0].ms, RETRY_DELAYS_MS[1])
  await t.run()                                   // 200 + 200: both batches go
  assert.equal(a.pending(), 0); assert.equal(s.calls.at(-1).events.length, 5)
  a.track('app_active'); await t.run()            // 404: dropped, not retried
  assert.equal(a.pending(), 0); assert.equal(t.pending.length, 0)
  assert.deepEqual(logs.map(l => l.outcome), ['kept', 'kept', 'kept', 'sent', 'sent', 'dropped'])
  rmSync(d, { recursive: true, force: true })
})

test('at most 200 wait, and an event older than 23 hours is dropped before sending', async () => {
  const d = dir()
  let clock = new Date('2026-10-05T10:00:00Z')
  const s = server(['throw'])
  const { a, t } = make(d, { server: s, deps: { now: () => clock } })
  for (let i = 0; i < QUEUE_MAX + 10; i++) a.track('app_active', { i })
  assert.equal(a.pending(), QUEUE_MAX)
  await t.run()                                   // offline: kept
  clock = new Date('2026-10-06T09:30:00Z')        // 23.5 h later
  await t.run()
  assert.equal(a.pending(), 0); assert.equal(s.calls.length, 1, 'the stale events were never sent')
  rmSync(d, { recursive: true, force: true })
})

test('app_installed once per app (first PassionCode app said), app_started each start, app_active once per UTC day', async () => {
  const d = dir()
  let clock = new Date('2026-10-05T10:00:00Z')
  const s = server()
  const { a, t } = make(d, { server: s, deps: { now: () => clock } })
  a.started('background', { projects: 2 }); a.activeTick({ projects: 2 }); a.activeTick({ projects: 2 })
  await t.run()
  assert.deepEqual(s.calls[0].events.map(e => e.eventName), ['app_installed', 'app_started', 'app_active'])
  assert.equal(s.calls[0].events[0].props.first_passioncode_app, true); assert.equal(s.calls[0].events[1].props.launch, 'background')
  const again = make(d, { server: s, deps: { now: () => clock } })
  again.a.started('ordinary', { projects: 2 }); again.a.activeTick({ projects: 2 })
  clock = new Date('2026-10-06T00:05:00Z'); again.a.activeTick({ projects: 3 })
  await again.t.run()
  assert.deepEqual(s.calls[1].events.map(e => e.eventName), ['app_started', 'app_active'])
  assert.equal(s.calls[1].events[1].props.projects, 3)
  rmSync(d, { recursive: true, force: true })
})
// #endregion usage-analytics
