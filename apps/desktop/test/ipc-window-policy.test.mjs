// CO-091 — the IPC bridge authorises per window kind (REQ-31).
//
// Before this, every Fabric window received the whole bridge: a detached
// session window could replay the journal of every project (`feed.replay`),
// write any file a root admitted and decide hub access. The main process is
// the authority: each window is registered with its kind when it is created,
// each channel declares which kinds may call it, and a call from any other
// kind is refused with a typed error and an ops record. The preload narrows
// what it exposes to the same map, as a second wall and never the first.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { IPC } from '../src/shared/types.ts'
import {
  CHANNEL_RULES,
  WINDOW_KINDS,
  WINDOW_KIND_ARG,
  authorise,
  channelsFor,
  isWindowRefusal,
  mayReceive,
  windowKindFromArgv
} from '../src/shared/ipcWindowPolicy.ts'
import { IpcWindowRefused, createWindowRegistry, sendIfReceives } from '../src/main/windowRegistry.ts'
import { createApi, exposedApi } from '../src/preload/api.ts'

const HERE = path.dirname(new URL(import.meta.url).pathname)

/** What a session window and an editor window call TODAY, measured 2026-10-11 by reading
 *  `SessionWindow.tsx`, `SessionStop.tsx`, `TerminalView.tsx`, `EditorWindow.tsx` and the
 *  boot of `App.tsx` / `launch/persona.tsx` / `CrashBoundary.tsx` that every window runs. */
const EVERY_WINDOW = ['settingsRead', 'personaRead', 'metaInfo', 'opsRendererError',
  // 0.3.12 (CO-374): the lost-stack notice shows in every window (`StackHealthNotice.tsx`).
  'stackHealth', 'stackHealthChanged']
const SESSION_USES = [...EVERY_WINDOW, 'terminalGet', 'terminalScrollback', 'terminalWrite', 'terminalResize', 'terminalEnd', 'terminalAttestOver', 'terminalDismiss', 'terminalData', 'terminalExit']
const EDITOR_USES = [...EVERY_WINDOW, 'filesRead', 'filesWrite', 'filesRequestOverwrite', 'filesOpenExternally', 'filesRecoveryKeep', 'filesRecoveryFlush', 'filesRecoveryRead']

test('every channel declares at least one window kind, and only known kinds', () => {
  for (const key of Object.keys(IPC)) {
    const rule = CHANNEL_RULES[key]
    assert.ok(rule, `IPC.${key} declares no window kinds`)
    const kinds = Object.keys(rule)
    assert.ok(kinds.length > 0, `IPC.${key} declares an empty rule`)
    for (const k of kinds) assert.ok(WINDOW_KINDS.includes(k), `IPC.${key} names an unknown kind ${k}`)
  }
  for (const key of Object.keys(CHANNEL_RULES)) assert.ok(key in IPC, `a rule for ${key}, which is no channel`)
})

test('the main window keeps the whole bridge; detached windows get exactly what they use', () => {
  assert.deepEqual(channelsFor('main').sort(), Object.keys(IPC).sort())
  assert.deepEqual(channelsFor('session').sort(), [...SESSION_USES].sort())
  assert.deepEqual(channelsFor('editor').sort(), [...EDITOR_USES].sort())
})

test('feed.replay across projects is the main window\'s alone', () => {
  assert.equal(authorise({ kind: 'main' }, IPC.feedReplay, [0]).ok, true)
  for (const kind of ['session', 'editor']) {
    const r = authorise({ kind, subject: 's-1' }, IPC.feedReplay, [0])
    assert.equal(r.ok, false)
    assert.equal(r.reason, 'kind')
  }
})

test('a detached window reaches only its own session or its own file', () => {
  const session = { kind: 'session', subject: 'sess-a' }
  assert.equal(authorise(session, IPC.terminalWrite, ['sess-a', 'ls\r']).ok, true)
  const other = authorise(session, IPC.terminalWrite, ['sess-b', 'rm -rf ~\r'])
  assert.equal(other.ok, false)
  assert.equal(other.reason, 'subject')
  const editor = { kind: 'editor', subject: '/repo/a.ts' }
  assert.equal(authorise(editor, IPC.filesWrite, ['/repo/a.ts', 'x', 'h', null]).ok, true)
  assert.equal(authorise(editor, IPC.filesWrite, ['/repo/b.ts', 'x', 'h', null]).reason, 'subject')
  assert.equal(authorise(editor, IPC.terminalWrite, ['sess-a', 'x']).reason, 'kind')
  // The main window is not bound to a subject.
  assert.equal(authorise({ kind: 'main' }, IPC.terminalWrite, ['sess-b', 'x']).ok, true)
})

test('default deny: an unregistered sender and an undeclared channel are refused', () => {
  assert.equal(authorise(undefined, IPC.settingsRead, []).reason, 'unregistered')
  assert.equal(authorise({ kind: 'main' }, 'brand:new-channel', []).reason, 'undeclared')
})

test('a broadcast reaches only the windows its channel names', () => {
  assert.equal(mayReceive({ kind: 'main' }, IPC.terminalData, ['sess-a', 'x', 1]), true)
  assert.equal(mayReceive({ kind: 'session', subject: 'sess-a' }, IPC.terminalData, ['sess-a', 'x', 1]), true)
  assert.equal(mayReceive({ kind: 'session', subject: 'sess-a' }, IPC.terminalData, ['sess-b', 'secret', 1]), false)
  assert.equal(mayReceive({ kind: 'editor', subject: '/a' }, IPC.terminalData, ['sess-a', 'x', 1]), false)
  assert.equal(mayReceive({ kind: 'session', subject: 'sess-a' }, IPC.projectsRepoChanged, ['/repo']), false)
  assert.equal(mayReceive(undefined, IPC.projectsRepoChanged, ['/repo']), false)
})

test('the registry knows a window from creation to close, and refuses with a typed, secret-free error', () => {
  const windows = createWindowRegistry()
  windows.register(7, { kind: 'session', subject: 'sess-a' })
  assert.deepEqual(windows.entry(7), { kind: 'session', subject: 'sess-a' })
  assert.equal(windows.check(7, IPC.terminalGet, ['sess-a']), null)
  const refused = windows.check(7, IPC.feedReplay, [0])
  assert.ok(refused instanceof IpcWindowRefused)
  assert.equal(refused.code, 'ipc_window_refused')
  assert.equal(refused.channel, IPC.feedReplay)
  assert.equal(refused.kind, 'session')
  assert.equal(refused.reason, 'kind')
  assert.equal(isWindowRefusal(`Error invoking remote method 'feed:replay': Error: ${refused.message}`), true)
  const bound = windows.check(7, IPC.terminalWrite, ['sess-b', 'my password'])
  assert.equal(bound.reason, 'subject')
  assert.doesNotMatch(bound.message, /sess-b|sess-a|password/, 'a refusal never carries the call\'s arguments or the window\'s subject')
  assert.deepEqual(bound.detail(), { channel: IPC.terminalWrite, kind: 'session', reason: 'subject' })
  windows.forget(7)
  assert.equal(windows.entry(7), undefined)
  assert.equal(windows.check(7, IPC.settingsRead, []).reason, 'unregistered')
  assert.equal(windows.check(7, IPC.settingsRead, []).kind, 'unregistered')
})

test('re-registering an id replaces its entry rather than widening it', () => {
  const windows = createWindowRegistry()
  windows.register(3, { kind: 'main' })
  windows.register(3, { kind: 'editor', subject: '/a' })
  assert.equal(windows.check(3, IPC.feedReplay, [0]).reason, 'kind')
})

test('the window kind travels to the preload as one argument, and an unknown one is no kind', () => {
  assert.equal(windowKindFromArgv(['electron', `${WINDOW_KIND_ARG}session`]), 'session')
  assert.equal(windowKindFromArgv(['electron', `${WINDOW_KIND_ARG}root`]), null)
  assert.equal(windowKindFromArgv(['electron']), null)
})

/** A recording stand-in for ipcRenderer. */
function recorder() {
  const calls = []
  return {
    calls,
    invoke: (channel, ...args) => { calls.push(['invoke', channel, args]); return Promise.resolve(undefined) },
    send: (channel, ...args) => { calls.push(['send', channel, args]) },
    on: (channel) => { calls.push(['on', channel]) },
    removeListener: () => {}
  }
}

test('every bridge method speaks exactly one declared channel', () => {
  const values = new Set(Object.values(IPC))
  const api = createApi(recorder())
  for (const [ns, methods] of Object.entries(api)) {
    for (const [name, fn] of Object.entries(methods)) {
      const rec = recorder()
      createApi(rec)[ns][name](() => {})
      assert.equal(rec.calls.length, 1, `${ns}.${name} made ${rec.calls.length} bridge calls`)
      assert.ok(values.has(rec.calls[0][1]), `${ns}.${name} speaks ${rec.calls[0][1]}, which IPC does not declare`)
      void fn
    }
  }
})

test('an agent\'s tasks (0.3.14): work.session asks the main window\'s work:session with the session id, and no detached window may', () => {
  const rec = recorder()
  createApi(rec).work.session('s-1')
  assert.deepEqual(rec.calls, [['invoke', IPC.workSession, ['s-1']]])
  const aliased = recorder()
  createApi(aliased).work.session('s-1', ['s-0'])
  assert.deepEqual(aliased.calls, [['invoke', IPC.workSession, ['s-1', ['s-0']]]], 'CO-475: the agent\'s earlier session ids ride with the live one')
  const board = recorder()
  createApi(board).work.board('p1', 40)
  assert.deepEqual(board.calls, [['invoke', IPC.workBoard, ['p1', 40]]], 'the board asks for more finished tasks by its limit')
  assert.equal(authorise({ kind: 'main' }, IPC.workSession, ['s-1']).ok, true)
  for (const kind of ['session', 'editor']) assert.equal(authorise({ kind, subject: 's-1' }, IPC.workSession, ['s-1']).ok, false)
})

test('the preload exposes only the subset of the window\'s kind', () => {
  const session = exposedApi('session', recorder())
  assert.equal(typeof session.terminal.get, 'function')
  assert.equal(typeof session.terminal.onData, 'function')
  assert.equal(session.feed, undefined, 'a session window has no feed')
  assert.equal(session.files, undefined, 'a session window has no files')
  assert.equal(session.terminal.open, undefined, 'a session window cannot open another session')
  const editor = exposedApi('editor', recorder())
  assert.equal(typeof editor.files.write, 'function')
  assert.equal(editor.files.list, undefined, 'an editor cannot list directories')
  assert.equal(editor.terminal, undefined)
  const main = exposedApi('main', recorder())
  assert.deepEqual(Object.keys(main).sort(), Object.keys(createApi(recorder())).sort())
  assert.deepEqual(exposedApi(null, recorder()), {}, 'a window of no known kind gets no bridge')
})

test('the menu\'s Cmd+W reaches the focused window only through the registry: the main window, never a session, an editor or an unknown one', () => {
  const windows = createWindowRegistry()
  windows.register(1, { kind: 'main' })
  windows.register(2, { kind: 'session', subject: 'sess-a' })
  windows.register(3, { kind: 'editor', subject: '/a' })
  const win = (id, destroyed = false) => ({ sent: [], isDestroyed: () => destroyed, webContents: { id, send(ch, ...a) { win.log.push([id, ch, ...a]) } } })
  win.log = []
  assert.equal(sendIfReceives(windows, win(1), IPC.tabsCloseActive), true)
  for (const w of [win(2), win(3), win(9), win(1, true), null, undefined]) assert.equal(sendIfReceives(windows, w, IPC.tabsCloseActive), false)
  assert.deepEqual(win.log, [[1, IPC.tabsCloseActive]])
  const menu = readFileSync(path.join(HERE, '..', 'src', 'main', 'menu.ts'), 'utf8')
  assert.match(menu, /sendIfReceives\(windows, BrowserWindow\.getFocusedWindow\(\), IPC\.tabsCloseActive\)/)
  assert.doesNotMatch(menu, /getFocusedWindow\(\)\?\.webContents\.send/, 'no send straight to the focused window')
})

test('every window Fabric gives the preload is created with its kind', () => {
  const main = readFileSync(path.join(HERE, '..', 'src', 'main', 'index.ts'), 'utf8')
  const preloads = [...main.matchAll(/preload:\s*path\.join/g)].length
  const kinded = [...main.matchAll(/additionalArguments:\s*\[windowKindArg\('(main|session|editor)'\)\]/g)].length
  assert.ok(preloads > 0)
  assert.equal(kinded, preloads, 'a window with the preload but no kind argument')
  const registered = [...main.matchAll(/windowKinds\.register\(/g)].length
  assert.equal(registered, preloads, 'a window with the preload that the registry never learns of')
})

// Wave 4's Comms reads (W4-2): the operator's screen lives in the main window, and nothing a session or editor window
// shows needs to read the board's facts, search it or open its links.
test('the Comms wave-4 reads and comms:open-artifact are the main window\'s alone', () => {
  const channels = ['commsThreadPage', 'commsHeads', 'commsResponders', 'commsFacts', 'commsTimeline', 'commsRelated', 'commsSearch', 'commsPending', 'commsWaiting', 'commsOpenArtifact']
  for (const key of channels) {
    assert.ok(key in IPC, `IPC.${key} is missing`)
    assert.deepEqual(Object.keys(CHANNEL_RULES[key]), ['main'], `IPC.${key}`)
    for (const kind of ['session', 'editor']) assert.equal(authorise({ kind, subject: 's-1' }, IPC[key], []).ok, false, `${kind} reached IPC.${key}`)
  }
  assert.equal(IPC.commsOpenArtifact, 'comms:open-artifact')
})
