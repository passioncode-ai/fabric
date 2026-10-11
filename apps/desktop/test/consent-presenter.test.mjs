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

function harness({ visible = true, focused = visible, answers = [1], pending = () => true, connect = { ok: true }, decide = { ok: true }, say, connected } = {}) {
  const log = []
  const details = []
  let win = { visible, focused, destroyed: false, isVisible: () => win.visible, isMinimized: () => false, isFocused: () => win.focused, isDestroyed: () => win.destroyed, show: () => { win.visible = true; log.push('show') }, focus: () => { win.focused = true; log.push('focus') } }
  const replies = [...answers]
  const p = new ConsentPresenter({
    window: () => win,
    showMessageBox: async (parent, o) => { log.push(['box', parent === win, o.buttons.join('|'), o.defaultId, o.cancelId, o.message, o.type]); details.push(o.detail); return { response: replies.shift() ?? 0 } },
    notify: (title, body, onClick) => { log.push(['notify', title]); harness.click = onClick; return true },
    openWindow: () => log.push('open'),
    decide: async (id, d) => { log.push(['decide', id, d]); return decide },
    connect: async (product) => { log.push(['connect', product]); return connect },
    stillPending: async (id) => pending(id),
    ...(say ? { say: () => say } : {}),
    ...(connected ? { connected } : {})
  })
  return { p, log, details, get win() { return win } }
}
const settle = () => new Promise((r) => setTimeout(r, 20))

test('a visible window: the prompt has a parent, Deny is the default, Allow is decided', async () => {
  const h = harness({ answers: [1] })
  h.p.present({ row: row('r1'), connected: true })
  await settle()
  assert.deepEqual(h.log[0], ['box', true, 'Deny|Allow', 0, 0, 'Allow Example agent to use Fabric Inbox?', 'question'])
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
  assert.deepEqual(h.log.slice(1), ['show', 'focus', ['box', true, 'Deny|Allow', 0, 0, 'Allow Example agent to use Fabric Inbox?', 'question'], ['decide', 'r1', 'allowed']])
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
  // Iteration 2, UX-5: the machine's words are the box's detail, never inside the sentence.
  assert.doesNotMatch(follow[5], /no handler/)
  assert.equal(h.details[1], 'What Fabric saw: no handler')
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
  // Iteration 2, UX-11: macOS draws no title, so the bold line is the question.
  assert.equal(box[5], 'Разрешить Example agent доступ к Fabric Inbox?')
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

test('I3: pending reads are single-flight before any sheet is opened', async (t) => {
  let release
  const gate = new Promise(resolve => {release=resolve})
  const reads=[]
  const h=harness({pending:id=>{reads.push(id);return gate}})
  t.after(()=>release(true))
  h.p.present({row:row('r1'),connected:true})
  h.p.present({row:row('r2'),connected:true})
  h.p.resume()
  assert.deepEqual(reads,['r1'])
  release(true)
  await settle();await settle()
  assert.equal(h.log.filter(e=>e[0]==='box').length,2, 'both queued requests are shown sequentially')
})

test('I3: focus lost while pending read waits keeps the request queued until resume', async (t) => {
  let release
  const gate=new Promise(resolve=>{release=resolve})
  const h=harness({pending:()=>gate})
  t.after(()=>release(true))
  h.p.present({row:row('r1'),connected:true})
  h.win.focused=false
  release(true)
  await settle()
  assert.equal(h.log.filter(e=>e[0]==='box').length,0)
  assert.equal(h.p.waiting(),1)
  h.win.focused=true;h.p.resume()
  await settle()
  assert.equal(h.log.filter(e=>e[0]==='box').length,1)
})

test('I3: a request expiring during a pending read never opens a sheet', async (t) => {
  let release
  const gate=new Promise(resolve=>{release=resolve})
  const h=harness({pending:()=>gate})
  const request=row('r1')
  t.after(()=>release(true))
  h.p.present({row:request,connected:true})
  request.expires_at=new Date(Date.now()-1000).toISOString()
  release(true)
  await settle()
  assert.equal(h.log.filter(e=>e[0]==='box').length,0)
  assert.equal(h.p.waiting(),0)
})

// A6-036 (0.3.2 audit, W1): a request can wait in the queue for up to ten minutes, and the prompt used the
// product's connected state read when the request ARRIVED. It is read again when the prompt is made, and
// again before an Allow starts the connect flow.
// #region hub-consent-live-connection — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#2-an-agent-is-admitted-by-device-style-consent-not-by-a-pasted-key
function liveHarness(states, opts = {}) {
  const reads = []
  const h = harness({ answers: [1], ...opts, connected: async (product) => { reads.push(product); const s = states.shift(); if (s instanceof Error) throw s; return s } })
  return { ...h, reads }
}

test('A6-036: a product connected since the request arrived is prompted as connected, and Allow starts no connect', async () => {
  const h = liveHarness([true, true])
  h.p.present({ row: row('r1'), connected: false })
  await settle()
  assert.equal(h.log[0][2], 'Deny|Allow', 'the prompt offered to connect a product that is connected now')
  assert.deepEqual(h.log.slice(1), [['decide', 'r1', 'allowed']], 'a connect flow was started for a connected product')
  assert.deepEqual(h.reads, ['fabric-inbox', 'fabric-inbox'])
})

test('A6-036: a product disconnected since the request arrived is prompted as Allow and connect, and connects', async () => {
  const h = liveHarness([false, false])
  h.p.present({ row: row('r1'), connected: true })
  await settle()
  assert.equal(h.log[0][2], 'Deny|Allow and connect Fabric Inbox')
  assert.deepEqual(h.log.slice(1), [['decide', 'r1', 'allowed'], ['connect', 'fabric-inbox']])
})

test('A6-036: a product connected while the prompt was open is not connected again after Allow', async () => {
  const h = liveHarness([false, true])
  h.p.present({ row: row('r1'), connected: false })
  await settle()
  assert.equal(h.log[0][2], 'Deny|Allow and connect Fabric Inbox')
  assert.deepEqual(h.log.slice(1), [['decide', 'r1', 'allowed']])
})

test('A6-036: a connection read that fails keeps the request\'s own reading; an enrollment is never read as a product', async () => {
  const h = liveHarness([new Error('database unavailable'), new Error('database unavailable')])
  h.p.present({ row: row('r1'), connected: false })
  await settle()
  assert.deepEqual(h.log.slice(1), [['decide', 'r1', 'allowed'], ['connect', 'fabric-inbox']])
  const e = liveHarness([])
  e.p.present({ row: row('r2', { callee: 'fabric', capabilities: ['session.enroll'], resources: ['project:00000000-0000-4000-8000-0000000000a1'], registry: { name: 'Claude Code', project: { id: '00000000-0000-4000-8000-0000000000a1', name: 'Atlas' } } }), connected: true })
  await settle()
  assert.deepEqual(e.reads, [], 'Fabric itself was read as a product connection')
  assert.deepEqual(e.log.slice(1), [['decide', 'r2', 'allowed']])
})
// #endregion hub-consent-live-connection
