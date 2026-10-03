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

function harness({ visible = true, answers = [1], pending = () => true } = {}) {
  const log = []
  let win = { visible, destroyed: false, isVisible: () => win.visible, isMinimized: () => false, isDestroyed: () => win.destroyed, show: () => { win.visible = true; log.push('show') }, focus: () => log.push('focus') }
  const replies = [...answers]
  const p = new ConsentPresenter({
    window: () => win,
    showMessageBox: async (parent, o) => { log.push(['box', parent === win, o.buttons.join('|'), o.defaultId, o.cancelId, o.message]); return { response: replies.shift() ?? 0 } },
    notify: (title, body, onClick) => { log.push(['notify', title]); harness.click = onClick; return true },
    openWindow: () => log.push('open'),
    decide: async (id, d) => { log.push(['decide', id, d]); return { ok: true } },
    connect: async (product) => { log.push(['connect', product]); return { ok: true } },
    stillPending: async (id) => pending(id)
  })
  return { p, log, win }
}
const settle = () => new Promise((r) => setTimeout(r, 20))

test('a visible window: the prompt has a parent, Deny is the default, Allow is decided', async () => {
  const h = harness({ answers: [1] })
  h.p.present({ row: row('r1'), connected: true })
  await settle()
  assert.deepEqual(h.log[0], ['box', true, 'Deny|Allow', 0, 0, 'Example agent asks to use Fabric Inbox through Fabric'])
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
  assert.deepEqual(h.log.slice(1), ['show', 'focus', ['box', true, 'Deny|Allow', 0, 0, 'Example agent asks to use Fabric Inbox through Fabric'], ['decide', 'r1', 'allowed']])
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
