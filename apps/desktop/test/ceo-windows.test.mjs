// Board requests 26989d91, 07db5c30, 374f27bf (the owner, 2026-11-19): the CEO closes console windows without stopping
// their sessions, arranges windows by voice and text, and opens dashboards in Fabric Dashboards.
import assert from 'node:assert/strict'
import test from 'node:test'
import { areaRect, autoAreas, displayOf, layoutName, nearestArea, orderedDisplays, parseLayouts, pickDisplay, WINDOW_AREAS } from '../src/shared/windowLayout.ts'
import { createCeoOperations, ceoVoiceTools, CEO_TOOLS } from '../src/main/ceoTools.ts'
import { createDashboardsPort, createWindowsPort, dashboardsScript, parseBounds } from '../src/main/ceoWindows.ts'
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
  assert.deepEqual(parseLayouts('not json'), {})
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
  const dashboards = createDashboardsPort({
    services: () => [
      { key: 'nika-agent.default', name: 'Ника', summary: 'Организационный агент команды', placement: 'local' },
      { key: 'studio-showcase.nika-agent', name: 'Ника, PM-агент (витрина)', summary: 'Снимок дашборда Ники', placement: 'remote' },
      { key: 'sshlg-growth.default', name: 'Growth', summary: 'Experiments, analytics and remote config', placement: 'remote' },
      { key: 'sshlg-growth.reader', name: 'Growth (read-only)', summary: 'Growth, read-only', placement: 'remote' }
    ],
    openExternal: async (link) => { if (over.openFails) throw new Error('no handler'); linked.push(link) },
    trusted: () => over.trusted ?? true,
    osascript: async (script) => { placedDash.push(script); return script.includes('return') ? '10,20,800,600' : '' },
    platform: 'darwin'
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
  return { ops, main, sessions, consoles, records, opened, linked, placedDash, get ceo() { return ceo }, get saved() { return saved } }
}

test('windows: Fabric\'s own windows with their screens, the consoles with their projects, the screens counted', async () => {
  const o = setup()
  const r = await o.ops.run('windows', {})
  assert.equal(r.ok, true)
  assert.deepEqual(r.windows.map((w) => w.kind), ['main', 'session', 'session'])
  assert.equal(r.windows[1].project, 'App')
  assert.equal(r.windows[0].screen, 2, 'main stands on the built-in screen, the second from the left')
  assert.deepEqual(r.screens.map((s) => s.screen), [1, 2])
  assert.equal(r.dashboards_window.open, true)
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
  const r = await o.ops.run('window_layout', { place: [{ window: 's1' }, { window: 's3' }, { window: 'main' }], display: 1, reason: 'the owner asked for three windows on the big screen' })
  assert.equal(r.ok, true)
  assert.deepEqual(o.sessions.get('s1').bounds, areaRect(LEFT.workArea, 'left-third'))
  assert.deepEqual(o.main.bounds, areaRect(LEFT.workArea, 'right-third'))
  await o.ops.run('window_layout', { place: [{ window: 'ceo', area: 'fullscreen' }], reason: 'the owner asked for the CEO full screen' })
  assert.equal(o.ceo.full, true, 'the CEO window was opened and put in full screen')
  const missing = await o.ops.run('window_layout', { place: [{ window: 'main', display: 5 }], reason: 'a fifth screen' })
  assert.equal(missing.ok, false)
  assert.equal(missing.placed[0].reason, 'no such screen on this computer')
  assert.equal((await o.ops.run('window_layout', { place: [{ window: 'nothing-like-it' }], reason: 'a word that names nothing' })).ok, false)
})

test('layout: saved by name and put back; a console that ended gives its place to its project\'s running one', async () => {
  const o = setup()
  await o.ops.run('window_layout', { place: [{ window: 's1', area: 'left' }, { window: 'main', area: 'right' }], display: 'primary', save_as: 'Рабочая', reason: 'the owner keeps this arrangement' })
  assert.deepEqual(Object.keys(o.saved), ['рабочая'])
  assert.equal(o.saved['рабочая'].placements[0].project_id, 'p1')
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
})

test('dashboards: a link the app would not take, and a move macOS has not allowed, are said, never a success', async () => {
  const o = setup({ openFails: true })
  assert.match((await o.ops.run('dashboard_open', { dashboard: 'growth', reason: 'the owner asked for Growth' })).reason, /did not take the link/)
  const t = setup({ trusted: false })
  const r = await t.ops.run('dashboard_open', { dashboard: 'growth', area: 'left', reason: 'the owner asked for Growth on the left' })
  assert.equal(r.ok, true, 'the dashboard opened')
  assert.equal(r.placed.ok, false)
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
  assert.equal(await off.bounds(), null)
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
