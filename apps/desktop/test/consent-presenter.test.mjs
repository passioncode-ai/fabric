// How a consent request reaches the operator (ADR-0115 §2.3): a native prompt WITH a parent window when
// one is on screen, otherwise a notification while the request waits in the queue; one prompt at a time;
// an expired or already-answered request is never shown. Electron is replaced by recording stand-ins,
// because the property under test is the ORDER of what is shown and decided, not Electron's drawing.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { ConsentPresenter } = await import(path.resolve(import.meta.dirname, '../src/main/consentPresenter.ts'))

const row = (id, extra = {}) => ({
  id, agent_id: 'example-agent.default', callee: 'fabric-inbox', capabilities: ['read_message'], resources: ['cloudflare:news@example.com'],
  reason: 'summarise the newsletter', registry: { name: 'Example agent', installed_by: 'example-installer', repository: null },
  asked_by_binding: null, requested_at: new Date().toISOString(), expires_at: new Date(Date.now() + 600_000).toISOString(), status: 'pending', ...extra
})

function harness({ visible = true, focused = visible, answers = [1], pending = () => true, connect = { ok: true }, decide = { ok: true }, say } = {}) {
  const log = []
  let win = { visible, focused, destroyed: false, isVisible: () => win.visible, isMinimized: () => false, isFocused: () => win.focused, isDestroyed: () => win.destroyed, show: () => { win.visible = true; log.push('show') }, focus: () => { win.focused = true; log.push('focus') } }
  const replies = [...answers]
  const p = new ConsentPresenter({
    window: () => win,
    showMessageBox: async (parent, o) => { log.push(['box', parent === win, o.buttons.join('|'), o.defaultId, o.cancelId, o.message, o.type]); return { response: replies.shift() ?? 0 } },
    notify: (title, body, onClick) => { log.push(['notify', title]); harness.click = onClick; return true },
    openWindow: () => log.push('open'),
    decide: async (id, d) => { log.push(['decide', id, d]); return decide },
    connect: async (product) => { log.push(['connect', product]); return connect },
    stillPending: async (id) => pending(id),
    ...(say ? { say: () => say } : {})
  })
  return { p, log, get win() { return win } }
}
const settle = () => new Promise((r) => setTimeout(r, 20))

test('a visible window: the prompt has a parent, Deny is the default, Allow is decided', async () => {
  const h = harness({ answers: [1] })
  h.p.present({ row: row('r1'), connected: true })
  await settle()
  assert.deepEqual(h.log[0], ['box', true, 'Deny|Allow', 0, 0, 'Example agent asks to use Fabric Inbox through Fabric', 'question'])
  assert.deepEqual(h.log[1], ['decide', 'r1', 'allowed'])
  assert.equal(h.log.length, 2, 'nothing else happened — no connect for a connected product')
})

test('closing the prompt is a Deny', async () => {
  const h = harness({ answers: [0] })
  h.p.present({ row: row('r1'), connected: true })
  await settle()
  assert.deepEqual(h.log[1], ['decide', 'r1', 'denied'])
})

test('Allow for a product not yet connected also starts its connect flow', async () => {
  const h = harness({ answers: [1] })
  h.p.present({ row: row('r1'), connected: false })
  await settle()
  assert.equal(h.log[0][2], 'Deny|Allow and connect Fabric Inbox')
  assert.deepEqual(h.log.slice(1), [['decide', 'r1', 'allowed'], ['connect', 'fabric-inbox']])
})

test('in the background: a notification, no prompt, until it is clicked', async () => {
  const h = harness({ visible: false, answers: [1] })
  h.p.present({ row: row('r1'), connected: true })
  await settle()
  assert.deepEqual(h.log, [['notify', 'Example agent asks to use Fabric Inbox through Fabric']])
  assert.equal(h.p.waiting(), 1)
  harness.click()
  await settle()
  assert.deepEqual(h.log.slice(1), ['show', 'focus', ['box', true, 'Deny|Allow', 0, 0, 'Example agent asks to use Fabric Inbox through Fabric', 'question'], ['decide', 'r1', 'allowed']])
})

test('one prompt at a time, in order; a request answered elsewhere or expired is skipped', async () => {
  const answered = new Set(['r2'])
  const h = harness({ answers: [0, 1], pending: (id) => !answered.has(id) })
  h.p.present({ row: row('r1'), connected: true })
  h.p.present({ row: row('r2'), connected: true })
  h.p.present({ row: row('r3', { expires_at: new Date(Date.now() - 1000).toISOString() }), connected: true })
  h.p.present({ row: row('r4'), connected: true })
  await settle(); await settle()
  assert.deepEqual(h.log.filter((e) => e[0] === 'decide'), [['decide', 'r1', 'denied'], ['decide', 'r4', 'allowed']])
  assert.equal(h.log.filter((e) => e[0] === 'box').length, 2)
})

// ── verification iteration 1 for 0.3.1
const { translator } = await import(path.resolve(import.meta.dirname, '../src/renderer/src/i18n/translate.ts'))

test('UX-3: a window that is open but not focused gets a notification, and the prompt appears when the window comes forward', async () => {
  const h = harness({ visible: true, focused: false, answers: [1] })
  h.p.present({ row: row('r1'), connected: true })
  await settle()
  assert.deepEqual(h.log, [['notify', 'Example agent asks to use Fabric Inbox through Fabric']], 'a sheet opened on a window the operator is not looking at')
  h.win.focused = true
  h.p.bringForward()
  await settle()
  assert.equal(h.log.filter((e) => e[0] === 'box').length, 1)
  assert.deepEqual(h.log.at(-1), ['decide', 'r1', 'allowed'])
})

test('UX-5: an Allow whose product could not be opened is followed by a message saying so — the Allow stands', async () => {
  const h = harness({ answers: [1, 0], connect: { ok: false, problem: { code: 'not-installed', detail: 'no handler' }, reason: 'x' } })
  h.p.present({ row: row('r1'), connected: false })
  await settle(); await settle()
  const follow = h.log.filter((e) => e[0] === 'box')[1]
  assert.ok(follow, 'the operator was told nothing')
  assert.equal(follow[6], 'warning')
  assert.match(follow[5], /^Allowed\. To connect it, open Agent access in settings\. It did not connect: Fabric Inbox could not be opened/)
})

test('UX-11: an answer that was not recorded is a warning, phrased from its code', async () => {
  const h = harness({ answers: [1, 0], decide: { ok: false, code: 'expired', reason: 'that request expired' } })
  h.p.present({ row: row('r1'), connected: true })
  await settle(); await settle()
  const box = h.log.filter((e) => e[0] === 'box')[1]
  assert.equal(box[6], 'warning')
})

test('UX-2: the native prompt speaks the operator\'s language', async () => {
  const h = harness({ answers: [0], say: translator('ru') })
  h.p.present({ row: row('r1'), connected: false })
  await settle()
  const box = h.log.find((e) => e[0] === 'box')
  assert.equal(box[5], 'Example agent просит доступ к Fabric Inbox через Fabric')
  assert.equal(box[2], 'Отказать|Разрешить и подключить Fabric Inbox')
})

test('UX-3: requests queued while Fabric was in the background are shown when its window gets focus again', async () => {
  const h = harness({ visible: false, focused: false, answers: [0] })
  h.p.present({ row: row('r1'), connected: true })
  await settle()
  h.win.visible = true
  h.win.focused = true
  h.p.resume()
  await settle()
  assert.equal(h.log.filter((e) => e[0] === 'box').length, 1)
})
