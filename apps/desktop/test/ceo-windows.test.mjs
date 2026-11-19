// Board requests 26989d91, 07db5c30, 374f27bf (the owner, 2026-11-19): the CEO closes console windows without stopping
// their sessions, arranges windows by voice and text, and opens dashboards in Fabric Dashboards.
import assert from 'node:assert/strict'
import test from 'node:test'
import { areaRect, autoAreas, displayOf, fitAreas, layoutName, readLayouts, nearestArea, orderedDisplays, parseLayouts, pickDisplay, WINDOW_AREAS } from '../src/shared/windowLayout.ts'
import { createCeoOperations, ceoVoiceTools, CEO_TOOLS } from '../src/main/ceoTools.ts'
import { createDashboardsPort, createWindowsPort, dashboardsScript, parseBounds, OsascriptTimeout } from '../src/main/ceoWindows.ts'
import { pickDashboard } from '../src/shared/dashboardMatch.ts'
import { ceoBrief } from '../src/shared/ceoAgent.ts'

const LEFT = { id: 2, bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, workArea: { x: -1920, y: 25, width: 1920, height: 1055 }, primary: false, label: 'Dell' }
const MAIN = { id: 1, bounds: { x: 0, y: 0, width: 1512, height: 982 }, workArea: { x: 0, y: 38, width: 1512, height: 944 }, primary: true, label: 'Built-in' }

test('areas: halves, thirds and quarters tile the work area exactly, nothing over the menu bar', () => {
  const work = MAIN.workArea
  const l = areaRect(work, 'left'), r = areaRect(work, 'right')
  assert.equal(l.x + l.width, r.x)
  assert.equal(l.width + r.width, work.width)
  assert.equal(l.y, work.y)
  const [a, b, c] = ['left-third', 'center-third', 'right-third'].map((x) => areaRect(work, x))
  assert.equal(a.width + b.width + c.width, work.width)
  assert.equal(c.x + c.width, work.x + work.width)
  const q = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((x) => areaRect(work, x))
  assert.equal(q.reduce((s, x) => s + x.width * x.height, 0), work.width * work.height)
  assert.deepEqual(areaRect(work, 'full'), work)
  for (const area of WINDOW_AREAS) {
    const x = areaRect(work, area)
    assert.ok(x.x >= work.x && x.y >= work.y && x.x + x.width <= work.x + work.width && x.y + x.height <= work.y + work.height, area)
  }
})

test('areas: windows the owner names without one share the screen; past four the grid repeats', () => {
  assert.deepEqual(autoAreas(1), ['full'])
  assert.deepEqual(autoAreas(2), ['left', 'right'])
  assert.deepEqual(autoAreas(3), ['left-third', 'center-third', 'right-third'])
  assert.equal(autoAreas(5)[4], 'top-left')
  assert.deepEqual(autoAreas(0), [])
})

test('screens: counted left to right from 1; other is the one the window is not on; a screen not here is null', () => {
  const ds = [MAIN, LEFT]
  assert.deepEqual(orderedDisplays(ds).map((d) => d.id), [2, 1])
  assert.equal(pickDisplay(ds, 1, MAIN).id, 2)
  assert.equal(pickDisplay(ds, '2', null).id, 1)
  assert.equal(pickDisplay(ds, 'primary', LEFT).id, 1)
  assert.equal(pickDisplay(ds, 'other', MAIN).id, 2)
  assert.equal(pickDisplay(ds, undefined, LEFT).id, 2)
  assert.equal(pickDisplay(ds, undefined, null).id, 1)
  assert.equal(pickDisplay(ds, 3, MAIN), null)
  assert.equal(pickDisplay([MAIN], 'other', MAIN), null)
  assert.equal(displayOf(ds, { x: -800, y: 100, width: 600, height: 400 }).id, 2)
  assert.equal(displayOf(ds, { x: 5000, y: 0, width: 10, height: 10 }).id, 1, 'off every screen: the nearest')
})

test('layouts: a name in any case is one layout; a stored file that is not a layout is dropped', () => {
  assert.equal(layoutName('  Рабочая '), 'рабочая')
  assert.equal(layoutName('a/b'), null)
  assert.equal(nearestArea(MAIN.workArea, areaRect(MAIN.workArea, 'right-third')), 'right-third')
  assert.deepEqual(Object.keys(parseLayouts('not json')), [])
  const kept = parseLayouts(JSON.stringify({ рабочая: { saved_at: 'x', placements: [{ window: 'main', area: 'left' }, { window: 'rm', area: 'left' }, { window: 'ceo', area: 'sideways' }] }, 'a/b': { placements: [] } }))
  assert.deepEqual(Object.keys(kept), ['рабочая'])
  assert.equal(kept['рабочая'].placements.length, 1)
})

// ── the operations over plain windows ────────────────────────────────────────

function win(title, bounds) {
  const w = { title, bounds: { ...bounds }, full: false, min: false, closed: false, shown: 0 }
  return Object.assign(w, {
    isDestroyed: () => w.closed, getBounds: () => ({ ...w.bounds }), setBounds: (b) => { w.bounds = { ...b } }, getTitle: () => w.title,
    isFullScreen: () => w.full, setFullScreen: (v) => { w.full = v }, isMinimized: () => w.min, restore: () => { w.min = false },
    isFocused: () => false, show: () => { w.shown++ }, focus: () => {}, close: () => { w.closed = true }
  })
}

function setup(over = {}) {
  const records = []
  const consoles = new Map([
    ['ceo', { sessionId: 'ceo', projectId: 'p0', cwd: '/ceo', optionId: 'claude-code', state: 'running', running: true, lastActivityAt: '1', tail: '' }],
    ['s1', { sessionId: 's1', projectId: 'p1', cwd: '/d/app', optionId: 'claude-code', state: 'running', running: true, lastActivityAt: '2', tail: '' }],
    ['s2', { sessionId: 's2', projectId: 'p1', cwd: '/d/app', optionId: 'codex', state: 'running', running: true, lastActivityAt: '5', tail: '' }],
    ['s3', { sessionId: 's3', projectId: 'p2', cwd: '/d/site', optionId: 'claude-code', state: 'running', running: true, lastActivityAt: '3', tail: '' }]
  ])
  const main = win('Fabric', { x: 100, y: 100, width: 1200, height: 800 })
  let ceo = null
  const sessions = new Map([['s1', win('s1', { x: 0, y: 0, width: 1000, height: 680 })], ['s3', win('s3', { x: 0, y: 0, width: 1000, height: 680 })]])
  const opened = []
  const windows = createWindowsPort({
    main: () => main, ceo: () => ceo, sessions: () => sessions, files: () => new Map(),
    displays: () => [MAIN, LEFT],
    openMain: () => opened.push('main'),
    openCeo: () => { ceo = win('CEO', { x: 0, y: 0, width: 520, height: 720 }); opened.push('ceo') },
    openSession: (id) => { sessions.set(id, win(id, { x: 0, y: 0, width: 1000, height: 680 })); opened.push(id) }
  })
  const placedDash = []
  const linked = []
  const dash = { rect: over.dashAt === undefined ? { x: 10, y: 40, width: 800, height: 600 } : over.dashAt }
  const dashboards = createDashboardsPort({
    services: () => [
      { key: 'nika-agent.default', name: 'Ника', summary: 'Организационный агент команды', placement: 'local' },
      { key: 'studio-showcase.nika-agent', name: 'Ника, PM-агент (витрина)', summary: 'Снимок дашборда Ники', placement: 'remote' },
      { key: 'sshlg-growth.default', name: 'Growth', summary: 'Experiments, analytics and remote config', placement: 'remote' },
      { key: 'sshlg-growth.reader', name: 'Growth (read-only)', summary: 'Growth, read-only', placement: 'remote' }
    ],
    openExternal: async (link) => { if (over.openFails) throw new Error('no handler'); linked.push(link) },
    trusted: () => over.trusted ?? true,
    osascript: async (script) => {
      placedDash.push(script)
      if (over.osaFails) throw over.osaFails
      const pos = /set position of window 1 to \{(-?\d+), (-?\d+)\}/.exec(script), size = /set size of window 1 to \{(\d+), (\d+)\}/.exec(script)
      if (pos && size) dash.rect = { x: +pos[1], y: +pos[2], width: +size[1], height: +size[2] }
      return script.includes('return') ? (dash.rect ? `${dash.rect.x},${dash.rect.y},${dash.rect.width},${dash.rect.height}` : '') : ''
    },
    platform: 'darwin', sleep: async () => {}
  })
  let saved = {}
  const ops = createCeoOperations({
    ptys: { list: () => [...consoles.values()], get: (id) => consoles.get(id) ?? null, scrollbackOf: () => null, write: () => {} },
    ceoSessionId: () => 'ceo',
    projects: async () => [{ id: 'p1', name: 'App', repo_path: '/d/app' }, { id: 'p2', name: 'Site', repo_path: '/d/site' }],
    admitFolder: async () => { throw new Error('no') },
    openConsole: async () => { throw new Error('no') },
    stop: async () => { throw new Error('a window close must never stop a session') },
    openWindow: () => {},
    switchboard: async () => null,
    signal: () => { throw new Error('never') },
    record: (op, d) => records.push([op, d]),
    note: () => {},
    sleep: async () => {},
    windows,
    dashboards,
    layouts: { read: () => saved, write: (all) => { saved = JSON.parse(JSON.stringify(all)) } },
    now: () => new Date('2026-11-19T20:00:00Z')
  })
  return { ops, main, sessions, consoles, records, opened, linked, placedDash, dash, get ceo() { return ceo }, set ceo(v) { ceo = v }, get saved() { return saved } }
}

test('windows: Fabric\'s own windows with their screens, the consoles with their projects, the screens counted', async () => {
  const o = setup()
  const r = await o.ops.run('windows', {})
  assert.equal(r.ok, true)
  assert.deepEqual(r.windows.map((w) => w.kind), ['main', 'session', 'session'])
  assert.equal(r.windows[1].project, 'App')
  assert.equal(r.windows[0].screen, 2, 'main stands on the built-in screen, the second from the left')
  assert.deepEqual(r.screens.map((s) => s.screen), [1, 2])
  assert.equal(r.dashboards_window.open, null, 'ER-7: a listing never asks macOS; before the first move it cannot tell')
  await o.ops.run('dashboard_open', { dashboard: 'growth', area: 'left', reason: 'move it once' })
  assert.equal((await o.ops.run('windows', {})).dashboards_window.open, true)
})

test('close: a console\'s window goes, its session keeps running; a project\'s, all; exactly one scope', async () => {
  const o = setup()
  const one = await o.ops.run('window_close', { session_id: 's1', reason: 'the owner asked to clear the screen' })
  assert.deepEqual(one.closed, [{ session_id: 's1', still_running: true }])
  assert.equal(o.consoles.get('s1').running, true)
  assert.equal((await o.ops.run('window_close', { session_id: 's1', reason: 'again, nothing left' })).closed.length, 0)
  const all = await o.ops.run('window_close', { all: true, reason: 'the owner asked to close every console window' })
  assert.deepEqual(all.closed.map((c) => c.session_id), ['s3'])
  assert.equal((await o.ops.run('window_close', { reason: 'nothing named here' })).ok, false)
  assert.equal((await o.ops.run('window_close', { all: true, project: 'App', reason: 'two scopes named' })).ok, false)
  assert.ok(o.records.some(([op]) => op === 'ceo.window.close'))
  // PL-7: the closed console is listed running, and opening it again opens that same session.
  const listed = await o.ops.run('sessions', {})
  assert.equal(listed.fabric_consoles.find((c) => c.session_id === 's1').running, true)
  assert.equal((await o.ops.run('open', { session_id: 's1', reason: 'the owner wants it back' })).opened, 's1')
})

test('layout: «console App left, dashboards right» opens the newest App console and puts each on its half', async () => {
  const o = setup()
  const r = await o.ops.run('window_layout', { place: [{ window: 'App', area: 'left' }, { window: 'dashboards', area: 'right' }], display: 'primary', reason: 'the owner asked for the console beside the dashboard' })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.deepEqual(o.opened, ['s2'], 'App\'s newest console (s2) had no window: it was opened')
  assert.deepEqual(o.sessions.get('s2').bounds, areaRect(MAIN.workArea, 'left'))
  const moved = o.placedDash.at(-1)
  const right = areaRect(MAIN.workArea, 'right')
  assert.match(moved, new RegExp(`set position of window 1 to \\{${right.x}, ${right.y}\\}`))
  assert.match(moved, new RegExp(`set size of window 1 to \\{${right.width}, ${right.height}\\}`))
})

test('layout: windows named without an area share their screen; full screen; a screen not here is said', async () => {
  const o = setup()
  const r = await o.ops.run('window_layout', { place: [{ window: 's1' }, { window: 's3' }, { window: 'main' }], display: '1', reason: 'the owner asked for three windows on the big screen' })
  assert.equal(r.ok, true)
  assert.deepEqual(o.sessions.get('s1').bounds, areaRect(LEFT.workArea, 'left-third'))
  assert.deepEqual(o.main.bounds, areaRect(LEFT.workArea, 'right-third'))
  await o.ops.run('window_layout', { place: [{ window: 'ceo', area: 'fullscreen' }], reason: 'the owner asked for the CEO full screen' })
  assert.equal(o.ceo.full, true, 'the CEO window was opened and put in full screen')
  const missing = await o.ops.run('window_layout', { place: [{ window: 'main', display: '5' }], reason: 'a fifth screen' })
  assert.equal(missing.ok, true, 'ER-12: a screen this computer lacks falls back to the primary one')
  assert.equal(missing.placed[0].moved_to, 2)
  assert.equal((await o.ops.run('window_layout', { place: [{ window: 'nothing-like-it' }], reason: 'a word that names nothing' })).ok, false)
  // A project named like the app is its console, never the main window.
  const fabricProject = setup()
  fabricProject.consoles.set('f1', { sessionId: 'f1', projectId: 'p1', cwd: '/d/app', optionId: 'claude-code', state: 'running', running: true, lastActivityAt: '9', tail: '' })
  await fabricProject.ops.run('window_layout', { place: [{ window: 'App', area: 'left' }], display: 'primary', reason: 'the owner named the project' })
  assert.deepEqual(fabricProject.opened, ['f1'])
})

test('layout: saved by name and put back; a console that ended gives its place to its project\'s running one', async () => {
  const o = setup()
  await o.ops.run('window_layout', { place: [{ window: 's1', area: 'left' }, { window: 'main', area: 'right' }], display: 'primary', save_as: 'Рабочая', reason: 'the owner keeps this arrangement' })
  assert.deepEqual(Object.keys(o.saved), ['рабочая'])
  assert.equal(o.saved['рабочая'].placements.find((x) => x.window === 'session').project_id, 'p1')
  assert.equal(o.saved['рабочая'].placements.find((x) => x.window === 'session').display, 2, 'UX-8: the screen it went to is kept')
  o.consoles.get('s1').running = false
  o.main.bounds = { x: 0, y: 0, width: 10, height: 10 }
  const back = await o.ops.run('window_layout', { restore: 'рабочая', reason: 'the owner asked for the working layout' })
  assert.equal(back.ok, true, JSON.stringify(back))
  assert.deepEqual(o.sessions.get('s2').bounds, areaRect(MAIN.workArea, 'left'), 's2 runs in App now and takes s1\'s place')
  assert.deepEqual(o.main.bounds, areaRect(MAIN.workArea, 'right'))
  assert.equal((await o.ops.run('window_layout', { restore: 'звонок', reason: 'not saved' })).ok, false)
  // With no place: the windows as they stand.
  await o.ops.run('window_layout', { save_as: 'сейчас', reason: 'the owner keeps the screen as it is' })
  assert.equal(o.saved['сейчас'].placements.find((p) => p.window === 'main').area, 'right')
})

test('dashboards: «Нику» finds Ника, the agent before its showcase; a key opens exactly; Fabric Dashboards, never a browser', async () => {
  const o = setup()
  const list = await o.ops.run('dashboards', { query: 'growth' })
  assert.deepEqual(list.dashboards.map((d) => d.key), ['sshlg-growth.default', 'sshlg-growth.reader'])
  const r = await o.ops.run('dashboard_open', { dashboard: 'открой Нику', reason: 'the owner asked to see Nika' })
  assert.equal(r.ok, true)
  assert.equal(r.opened.key, 'nika-agent.default')
  assert.equal(o.linked.at(-1), 'fabric-dashboards://service/nika-agent.default?path=%2F')
  const full = await o.ops.run('dashboard_open', { dashboard: 'sshlg-growth.reader', path: '/experiments', area: 'fullscreen', reason: 'the owner asked for Growth full screen' })
  assert.equal(full.opened.key, 'sshlg-growth.reader')
  assert.equal(o.linked.at(-1), 'fabric-dashboards://service/sshlg-growth.reader?path=%2Fexperiments')
  assert.match(o.placedDash.at(-1), /AXFullScreen" of window 1 to true/)
  assert.equal(full.placed.ok, true)
  assert.equal((await o.ops.run('dashboard_open', { dashboard: 'zzzz qqqq', reason: 'nothing like it' })).ok, false)
  assert.equal((await o.ops.run('dashboard_open', { dashboard: 'X', reason: 'one letter' })).ok, false, 'ER-4')
  assert.equal((await o.ops.run('dashboard_open', { dashboard: 'Zebra growth', reason: 'one word of two' })).ok, false, 'ER-4: every word must match')
})

test('dashboards: a link the app would not take, and a move macOS has not allowed, are said, never a success', async () => {
  const o = setup({ openFails: true })
  assert.match((await o.ops.run('dashboard_open', { dashboard: 'growth', reason: 'the owner asked for Growth' })).reason, /did not take the link/)
  const t = setup({ trusted: false })
  const r = await t.ops.run('dashboard_open', { dashboard: 'growth', area: 'left', reason: 'the owner asked for Growth on the left' })
  assert.equal(r.opened.key, 'sshlg-growth.default', 'the dashboard opened')
  assert.equal(r.ok, false, 'ER-5: the move asked for was not made')
  assert.equal(r.partial, true)
  assert.match(r.placed.reason, /Accessibility/)
})

test('an Apple Event macOS held for its own question is said as the Automation step, not as a failure of the move', async () => {
  const port = createDashboardsPort({ services: () => [], openExternal: async () => {}, trusted: () => true, platform: 'darwin',
    osascript: async () => { throw new Error('execution error: System Events got an error: AppleEvent timed out. (-1712)') } })
  const r = await port.place({ fullScreen: true })
  assert.equal(r.ok, false)
  assert.match(r.reason, /Automation/)
  const off = createDashboardsPort({ services: () => [], openExternal: async () => {}, trusted: () => true, platform: 'linux' })
  assert.equal((await off.place({ fullScreen: true })).ok, false)
  assert.equal((await off.window(true)).known, false)
  // DO-1, ER-6: the real runner's kill at its deadline is a timeout, said as the Automation step.
  const slow = createDashboardsPort({ services: () => [], openExternal: async () => {}, trusted: () => true, platform: 'darwin',
    osascript: async () => { throw new OsascriptTimeout('osascript did not answer in time') } })
  const t = await slow.place({ fullScreen: true })
  assert.match(t.reason, /Automation/)
  assert.ok(!/tell application/.test(t.reason))
})

test('DO-1, ER-6: the osascript runner turns a kill at its deadline into a timeout, never the script text', async () => {
  const { runOsascript } = await import('../src/main/ceoWindows.ts')
  await assert.rejects(runOsascript('delay 3', 300), (e) => e instanceof OsascriptTimeout && !/delay/.test(e.message))
})

test('UX-1, UX-2: the owner\'s words name one dashboard or are asked about; a description never chooses one', () => {
  const reg = [
    { key: 'clip-agent.default', name: 'Clip Agent', summary: 'video', placement: 'local' },
    { key: 'clip-agent.cloud', name: 'Org Clip Agent', summary: 'video', placement: 'remote' },
    { key: 'analytics.default', name: 'Analytics agent', summary: 'metrics', placement: 'remote' },
    { key: 'pulse.default', name: 'World Pulse', summary: 'Аналитик мира для агентов', placement: 'local' },
    { key: 'nika-agent.default', name: 'Ника', summary: 'PM', placement: 'local' },
    { key: 'studio-showcase.nika-agent', name: 'Ника (витрина)', summary: 'Снимок дашборда Ники', placement: 'remote' },
    { key: 'bot-a.default', name: 'Shop bot', summary: '', placement: 'local' },
    { key: 'bot-b.default', name: 'Shop helper', summary: '', placement: 'local' }
  ]
  const pick = (q) => { const r = pickDashboard(reg, q); return r.found ? r.found.key : r.ambiguous ? r.ambiguous.map((d) => d.key) : null }
  assert.equal(pick('Clip Agent'), 'clip-agent.default', 'the owner\'s own copy before an organisation\'s')
  assert.equal(pick('Клип агент'), 'clip-agent.default', 'Cyrillic sounds out the Latin name')
  assert.equal(pick('открой аналитику'), 'analytics.default', 'not World Pulse, whose description says «Аналитик»')
  assert.equal(pick('дашборд Ники'), 'nika-agent.default', 'a filler word gives the showcase nothing')
  assert.deepEqual(pick('Shop'), ['bot-a.default', 'bot-b.default'], 'a tie is asked about')
  assert.equal(pick('открой'), null)
})

test('PL-1: «open one window, then the second» puts the second beside the first; a named area is kept by the next call', async () => {
  const o = setup()
  await o.ops.run('window_layout', { place: [{ window: 's1' }], reason: 'the owner asked for the first console' })
  assert.deepEqual(o.sessions.get('s1').bounds, areaRect(MAIN.workArea, 'full'))
  await o.ops.run('window_layout', { place: [{ window: 's3' }], reason: 'and the second' })
  assert.deepEqual(o.sessions.get('s1').bounds, areaRect(MAIN.workArea, 'left'), 'the first moved aside')
  assert.deepEqual(o.sessions.get('s3').bounds, areaRect(MAIN.workArea, 'right'))
  // One with an area, one without: the second takes what the first leaves.
  const p = setup()
  await p.ops.run('window_layout', { place: [{ window: 's1', area: 'left' }, { window: 's3' }], reason: 'left, and the other' })
  assert.deepEqual(p.sessions.get('s3').bounds, areaRect(MAIN.workArea, 'right'))
  await p.ops.run('window_layout', { place: [{ window: 'main' }], reason: 'and Fabric too' })
  assert.deepEqual(p.sessions.get('s1').bounds, areaRect(MAIN.workArea, 'left'), 'a named area stays')
  const shared = [p.sessions.get('s3').bounds, p.main.bounds]
  assert.deepEqual(shared, [areaRect(MAIN.workArea, 'top-right'), areaRect(MAIN.workArea, 'bottom-right')])
  // Past what a screen holds apart, the answer says they overlap.
  const r = await p.ops.run('window_layout', { place: [{ window: 's1', area: 'left' }, { window: 's3', area: 'right' }, { window: 'main' }], reason: 'three on two halves' })
  assert.equal(r.placed.find((x) => x.window === 'main').overlaps, true)
  assert.deepEqual(fitAreas(MAIN.workArea, ['left'], 1).areas, ['right'])
})

test('PL-2: windows named together go to one screen, the first Fabric window\'s, though Fabric Dashboards stands on the other', async () => {
  const o = setup({ dashAt: { x: -1500, y: 100, width: 900, height: 700 } })
  await o.ops.run('dashboard_open', { dashboard: 'growth', reason: 'reach it once' })
  o.sessions.get('s1').bounds = { x: 50, y: 60, width: 600, height: 500 }
  const r = await o.ops.run('window_layout', { place: [{ window: 's1', area: 'left' }, { window: 'dashboards', area: 'right' }], reason: 'console left, dashboard right' })
  assert.equal(r.ok, true, JSON.stringify(r))
  const right = areaRect(MAIN.workArea, 'right')
  assert.deepEqual(o.dash.rect, right, 'the dashboard came to the console\'s screen')
  assert.deepEqual(o.sessions.get('s1').bounds, areaRect(MAIN.workArea, 'left'))
})

test('ER-1: «CEO left, Fabric right»: the CEO window, the main window\'s child, ends where it was asked', async () => {
  const o = setup()
  o.ceo = win('CEO', { x: 600, y: 300, width: 520, height: 720 })
  // macOS moves a child window with its parent: the fake does too.
  const setMain = o.main.setBounds
  o.main.setBounds = (b) => { const dx = b.x - o.main.bounds.x, dy = b.y - o.main.bounds.y; setMain(b); o.ceo.bounds = { ...o.ceo.bounds, x: o.ceo.bounds.x + dx, y: o.ceo.bounds.y + dy } }
  await o.ops.run('window_layout', { place: [{ window: 'ceo', area: 'left' }, { window: 'main', area: 'right' }], display: 'primary', reason: 'CEO left, Fabric right' })
  assert.deepEqual(o.ceo.bounds, areaRect(MAIN.workArea, 'left'))
  assert.deepEqual(o.main.bounds, areaRect(MAIN.workArea, 'right'))
})

test('ER-2, ER-3, PL-3: a bad name moves nothing; a restore that put nothing back is no success; a place opens the dashboard it names', async () => {
  const o = setup()
  const before = { ...o.main.bounds }
  assert.equal((await o.ops.run('window_layout', { place: [{ window: 'main', area: 'left' }], save_as: 'work/1', reason: 'a name with a slash' })).ok, false)
  assert.deepEqual(o.main.bounds, before)
  o.saved['мёртвая'] = { saved_at: '2026-11-19T00:00:00Z', placements: [{ window: 'session', session_id: 'gone', project_id: 'p9', area: 'left' }] }
  const r = await o.ops.run('window_layout', { restore: 'мёртвая', reason: 'its consoles ended' })
  assert.equal(r.ok, false)
  const both = await o.ops.run('window_layout', { place: [{ window: 's1', area: 'left' }, { window: 'dashboards', dashboard: 'Ника', area: 'right' }], display: 'primary', reason: 'console left, Nika right' })
  assert.equal(both.ok, true, JSON.stringify(both))
  assert.equal(o.linked.at(-1), 'fabric-dashboards://service/nika-agent.default?path=%2F')
})

test('the AppleScript carries numbers only, and the bounds it answers read back', () => {
  assert.match(dashboardsScript({ bounds: { x: 1.4, y: 2, width: 3.6, height: 4 } }), /\{1, 2\}[\s\S]*\{4, 4\}/)
  assert.deepEqual(parseBounds('10, 20, 800, 600'), { x: 10, y: 20, width: 800, height: 600 })
  assert.equal(parseBounds('error'), null)
})

test('the new tools are in the brief of both languages and in the voice call', () => {
  for (const name of ['windows', 'window_close', 'window_layout', 'dashboards', 'dashboard_open']) {
    assert.ok(ceoVoiceTools().some((t) => t.name === `session_${name}`), name)
    for (const locale of ['ru', 'en']) assert.ok(ceoBrief({ locale }).includes(CEO_TOOLS[name].mcp), `${locale} ${name}`)
  }
})

test('without a window system every window tool refuses, never answers as if it acted', async () => {
  const records = []
  const ops = createCeoOperations({
    ptys: { list: () => [], get: () => null, scrollbackOf: () => null, write: () => {} }, ceoSessionId: () => null,
    projects: async () => [], admitFolder: async () => ({}), openConsole: async () => ({}), stop: async () => ({}), openWindow: () => {},
    switchboard: async () => null, signal: () => {}, record: (op, d) => records.push([op, d]), note: () => {}, sleep: async () => {}
  })
  for (const [name, args] of [['windows', {}], ['window_close', { all: true, reason: 'x x x' }], ['window_layout', { save_as: 'a', reason: 'x x x' }], ['dashboards', {}], ['dashboard_open', { dashboard: 'a', reason: 'x x x' }]])
    assert.equal((await ops.run(name, args)).ok, false, name)
})

test('DA-2, DA-4: a name an object answers for is no layout; a stored placement is rebuilt from its checked fields; at most 50', async () => {
  assert.equal(layoutName('__proto__'), null)
  assert.equal(layoutName('Constructor'), null)
  const kept = parseLayouts(JSON.stringify({ a: { saved_at: '2026-11-19T00:00:00Z', placements: [{ window: 'session', session_id: { evil: 'x' }, project_id: 42, display: 'zz', extra: 'kept', area: 'left' }, { window: 'session', session_id: 's-1', project_id: 'p-1', display: 2, area: 'right' }] } }))
  assert.deepEqual(kept.a.placements, [{ window: 'session', area: 'right', display: 2, session_id: 's-1', project_id: 'p-1' }])
  const many = {}
  for (let i = 0; i < 60; i++) many[`l${i}`] = { saved_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), placements: [{ window: 'main', area: 'left' }] }
  const bounded = parseLayouts(JSON.stringify(many))
  assert.equal(Object.keys(bounded).length, 50)
  assert.ok(!('l0' in bounded) && 'l59' in bounded, 'the oldest go first')
  assert.deepEqual(Object.keys(parseLayouts('x'.repeat(300 * 1024))), [])
  const o = setup()
  const r = await o.ops.run('window_layout', { restore: 'constructor', reason: 'a name objects answer for' })
  assert.equal(r.ok, false)
  assert.match(r.reason, /no layout/)
})

test('DA-1, DA-5: an editor is named by its file only; a failed save answers its code, the message stays in the record', async () => {
  const records = []
  const mainWin = win('Fabric', { x: 0, y: 40, width: 700, height: 900 })
  const ops = createCeoOperations({
    ptys: { list: () => [], get: () => null, scrollbackOf: () => null, write: () => {} }, ceoSessionId: () => null,
    projects: async () => [], admitFolder: async () => ({}), openConsole: async () => ({}), stop: async () => ({}), openWindow: () => {},
    switchboard: async () => null, signal: () => {}, record: (op, d) => records.push([op, d]), note: () => {}, sleep: async () => {},
    windows: createWindowsPort({ main: () => mainWin, ceo: () => null, sessions: () => new Map(), files: () => new Map([['/srv/u/secret/.env', win('/srv/u/secret/.env', { x: 0, y: 0, width: 10, height: 10 })]]),
      displays: () => [MAIN], openMain() {}, openCeo() {}, openSession() {} }),
    layouts: { read: () => ({}), write: () => { throw Object.assign(new Error('EACCES: permission denied, open \'/srv/u/data/window-layouts.json\''), { code: 'EACCES' }) } }
  })
  const w = await ops.run('windows', {})
  const editor = w.windows.find((x) => x.kind === 'editor')
  assert.equal(editor.file, '.env')
  assert.equal(editor.title, undefined)
  assert.ok(!JSON.stringify(w).includes('/srv/u'))
  const saved = await ops.run('window_layout', { save_as: 'a', reason: 'keep it' })
  assert.equal(saved.ok, false)
  assert.equal(saved.reason, 'the layout could not be kept (EACCES)')
  assert.match(JSON.stringify(records), /permission denied/)
  const port = createDashboardsPort({ services: () => [], openExternal: async () => {}, trusted: () => true, platform: 'darwin',
    osascript: async () => { throw new Error('/srv/someone/x: execution error: Can’t get window 1. (-1719)') } })
  const r = await port.place({ fullScreen: true })
  assert.ok(!r.reason.includes('/srv/'), r.reason)
  assert.match(r.reason, /-1719/)
})

// ── iteration 2 of the review ───────────────────────────────────────────────

test('ER-14, PL-17, PL-16: windows opened one by one keep their order, a save keeps every one, no failure text on a success', async () => {
  const o = setup()
  o.sessions.set('s2', win('s2', { x: 0, y: 0, width: 1000, height: 680 }))
  await o.ops.run('window_layout', { place: [{ window: 's1' }], display: 'primary', reason: 'one' })
  await o.ops.run('window_layout', { place: [{ window: 's3' }], display: 'primary', reason: 'two' })
  const r = await o.ops.run('window_layout', { place: [{ window: 's2' }], display: 'primary', save_as: 'три', reason: 'three' })
  assert.deepEqual([o.sessions.get('s1').bounds, o.sessions.get('s3').bounds, o.sessions.get('s2').bounds],
    ['left-third', 'center-third', 'right-third'].map((a) => areaRect(MAIN.workArea, a)), 'the first stays first')
  assert.ok(r.placed.every((p) => p.ok && p.reason === undefined && p.target === undefined), JSON.stringify(r.placed))
  const kept = readLayouts(JSON.stringify(o.saved)).layouts['три']
  assert.deepEqual(kept.placements.map((p) => p.session_id), ['s1', 's3', 's2'])
  for (const id of ['s1', 's3', 's2']) o.sessions.get(id).bounds = { x: 0, y: 0, width: 5, height: 5 }
  const back = await o.ops.run('window_layout', { restore: 'три', reason: 'put it back' })
  assert.equal(back.placed.length, 3)
  assert.deepEqual(o.sessions.get('s1').bounds, areaRect(MAIN.workArea, 'left-third'))
})

test('PL-14: a console the CEO opens takes its place beside the one it opened before', async () => {
  const o = setup()
  o.sessions.clear()
  await o.ops.run('open', { session_id: 's1', reason: 'the first window' })
  await o.ops.run('open', { session_id: 's3', reason: 'the second window' })
  assert.deepEqual(o.sessions.get('s1').bounds, areaRect(MAIN.workArea, 'left'))
  assert.deepEqual(o.sessions.get('s3').bounds, areaRect(MAIN.workArea, 'right'))
})

test('UX-12, PL-19, PL-20: a screen not here falls back for the whole call; a dashboard stays on its screen; full screen takes no room', async () => {
  const o = setup()
  const r = await o.ops.run('window_layout', { place: [{ window: 's1', area: 'left' }], display: 'other', reason: 'the other screen' })
  assert.equal(r.ok, true)
  const one = setup()
  one.ops.run // single-screen variant through the port
  const solo = await setup().ops.run('window_layout', { place: [{ window: 's1', area: 'left' }], display: '5', reason: 'a fifth screen' })
  assert.equal(solo.ok, true)
  assert.equal(solo.placed[0].moved_to, 2)
  const d = setup({ dashAt: { x: -1500, y: 100, width: 900, height: 700 } })
  await d.ops.run('dashboard_open', { dashboard: 'growth', area: 'left', reason: 'reach it once' })
  await d.ops.run('dashboard_open', { dashboard: 'growth', area: 'full', reason: 'Growth full on its own screen' })
  assert.deepEqual(d.dash.rect, areaRect(LEFT.workArea, 'full'), 'it stayed on the screen it stood on')
  const f = setup()
  await f.ops.run('window_layout', { place: [{ window: 's1', area: 'fullscreen' }], display: 'primary', reason: 'full screen' })
  const next = await f.ops.run('window_layout', { place: [{ window: 's3' }], display: 'primary', reason: 'and another' })
  assert.equal(next.placed[0].overlaps, undefined)
})

test('UX-5, UX-13, ER-19, ER-21: a cold start waits for the window; a pending Automation question is said after one Apple Event', async () => {
  let calls = 0
  let up = false
  const cold = createDashboardsPort({ services: () => [], openExternal: async () => { setTimeout(() => { up = true }, 0) }, trusted: () => true, platform: 'darwin', sleep: async () => { up = true },
    osascript: async (script) => { calls++; if (!up) throw new Error('System Events got an error: Can’t get process "Fabric Dashboards". (-1728)'); return script.includes('return') ? '0,0,10,10' : '' } })
  const w = await cold.waitWindow(2000)
  assert.equal(w.known, true)
  assert.deepEqual(w.rect, { x: 0, y: 0, width: 10, height: 10 })
  calls = 0
  const o = setup({ osaFails: new OsascriptTimeout('osascript did not answer in time') })
  const r = await o.ops.run('dashboard_open', { dashboard: 'growth', area: 'right', reason: 'Growth on the right' })
  assert.match(r.placed.reason, /Automation/)
  assert.equal(o.placedDash.length, 1, 'one Apple Event, not two')
})

test('UX-10, UX-11, UX-14: names across products are asked about; a sound alone is confirmed; Latin finds a Cyrillic name', () => {
  const reg = [
    { key: 'research-agent.main', name: 'Research Agent', summary: '', placement: 'local' },
    { key: 'prowl-research.default', name: 'Prowl Research', summary: '', placement: 'local' },
    { key: 'deal-desk.default', name: 'Deal desk', summary: '', placement: 'local' },
    { key: 'nika-agent.default', name: 'Ника', summary: '', placement: 'local' },
    { key: 'copy-agent.org1', name: 'Org1 Copy', summary: '', placement: 'remote' },
    { key: 'copy-agent.org2', name: 'Org2 Copy', summary: '', placement: 'remote' }
  ]
  const pick = (q) => { const r = pickDashboard(reg, q); return r.found ? r.found.key : r.ambiguous ? r.ambiguous.map((d) => d.key) : null }
  assert.equal(pick('Research Agent'), 'research-agent.main', 'a whole name')
  assert.equal(pick('research-agent'), 'research-agent.main', 'a product id')
  assert.deepEqual(pick('research'), ['prowl-research.default', 'research-agent.main'])
  assert.equal(pick('рост'), null)
  assert.deepEqual(pick('доску'), ['deal-desk.default'], 'by sound only: confirmed, not opened')
  assert.equal(pick('Nika'), 'nika-agent.default')
  assert.deepEqual(pick('copy'), ['copy-agent.org1', 'copy-agent.org2'], 'two organisations\' copies: which')
})

test('ER-17, DA-8: a damaged layouts text says so; a layout keeps and reopens the dashboard it showed', async () => {
  assert.equal(readLayouts('{not json').damaged, true)
  assert.equal(readLayouts('[]').damaged, true)
  assert.equal(readLayouts('{}').damaged, false)
  const o = setup()
  await o.ops.run('window_layout', { place: [{ window: 'dashboards', dashboard: 'Growth (read-only)', area: 'right' }], display: 'primary', save_as: 'рост', reason: 'keep the dashboard' })
  assert.equal(o.saved['рост'].placements[0].dashboard, 'sshlg-growth.reader')
  o.linked.length = 0
  await o.ops.run('window_layout', { restore: 'рост', reason: 'back' })
  assert.equal(o.linked.at(-1), 'fabric-dashboards://service/sshlg-growth.reader?path=%2F')
})
