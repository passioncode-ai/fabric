// The owner, 2026-11-20 22:50: «вообще это все должно быть автоматически, не надо никакой подключать». Fabric connects
// itself to Fabric Inbox; each reason not to start is checked, a denial is never overridden, a failure waits 30 minutes.
import assert from 'node:assert/strict'
import test from 'node:test'
import { createInboxAutoConnect, INBOX_RETRY_MS } from '../src/main/inboxAutoConnect.ts'

function rig(over = {}) {
  const w = { trust: 'mine', present: true, connected: false, last: null, begins: 0, ok: true, t: 1_000_000, log: [], ...over }
  const check = createInboxAutoConnect({
    trust: () => w.trust, inRegistry: () => w.present, connected: async () => w.connected, last: () => w.last,
    begin: async () => { w.begins++; return { ok: w.ok } }, record: (op, d) => w.log.push([op, d]), now: () => w.t
  })
  return { w, check }
}

test('on the owner\'s machine, with Inbox installed and no connection, Fabric starts the connect by itself, once', async () => {
  const { w, check } = rig()
  assert.equal(await check(), 'started')
  assert.equal(w.begins, 1)
  w.last = { product: 'fabric-inbox', outcome: 'waiting', since: 'x', reconnect: false }
  assert.equal(await check(), 'waiting')
  w.connected = true
  assert.equal(await check(), 'connected')
  assert.equal(w.begins, 1)
  assert.deepEqual(w.log, [['hub.inbox.auto-connect', { started: true }]])
})

test('never on another machine, never without Inbox, never over the person\'s no; a failure waits its 30 minutes', async () => {
  assert.equal(await rig({ trust: 'organization' }).check(), 'not-mine')
  assert.equal(await rig({ trust: null }).check(), 'not-mine')
  assert.equal(await rig({ present: false }).check(), 'absent')
  const denied = rig({ last: { product: 'fabric-inbox', outcome: 'denied', at: 'x' } })
  assert.equal(await denied.check(), 'denied')
  assert.equal(denied.w.begins, 0)
  const failing = rig({ ok: false })
  assert.equal(await failing.check(), 'failed')
  failing.w.last = { product: 'fabric-inbox', outcome: 'failed', at: 'x', problem: { code: 'x' } }
  failing.w.t += INBOX_RETRY_MS - 1
  assert.equal(await failing.check(), 'too-soon')
  failing.w.t += 2
  assert.equal(await failing.check(), 'failed')
  assert.equal(failing.w.begins, 2)
})
