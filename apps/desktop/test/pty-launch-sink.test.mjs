// The launch journal's sink sees every console the real manager opens, with the origin its caller set, and its end
// (board request eef5abeb). Only native spawn is replaced; no real program runs.
import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { PtyManager, setLaunchSink } from '../src/main/pty.ts'
import { withLaunchOrigin } from '../src/main/launchOrigin.ts'

const FAKE_PID = 4_194_305 // no process can hold it (pty-launch-failure.test.mjs says why)

function fakePty() {
  const p = { pid: FAKE_PID, exit: null, onData() { return { dispose() {} } }, onExit(cb) { p.exit = cb; return { dispose() {} } }, write() {}, resize() {}, kill() {} }
  return p
}

test('a console opened inside an origin is written with it, and its end with the outcome Fabric saw', async () => {
  const opened = [], ended = []
  setLaunchSink({ opened: async (o) => { opened.push(o) }, ended: async (id, e) => { ended.push([id, e]) } })
  try {
    const pty = fakePty()
    const manager = new PtyManager({ append: async () => ({ seq: 1 }) }, randomUUID(), { onData() {}, onExit() {} }, undefined, () => pty,
      undefined, () => ({ kind: 'person', id: 'operator' }))
    const project = randomUUID()
    const s = await withLaunchOrigin({ by: 'ceo', via: 'voice', reason: 'r', parentSessionId: 'ceo-1' },
      () => manager.open(project, process.cwd(), 'shell'))
    assert.equal(opened.length, 1)
    assert.equal(opened[0].sessionId, s.sessionId)
    assert.equal(opened[0].projectId, project)
    assert.equal(opened[0].runner, 'shell')
    assert.equal(opened[0].pid, FAKE_PID)
    assert.deepEqual(opened[0].origin, { by: 'ceo', via: 'voice', reason: 'r', parentSessionId: 'ceo-1' })
    await pty.exit({ exitCode: 0, signal: 9 })
    assert.deepEqual(ended, [[s.sessionId, { exitCode: 0, signal: 9, stopRequested: false }]])
    const plain = await manager.open(project, process.cwd(), 'shell')
    assert.deepEqual(opened.find((o) => o.sessionId === plain.sessionId).origin, { by: 'fabric' }, 'no origin set: Fabric\'s own')
  } finally { setLaunchSink(null) }
})

test('a sink that throws never stops a console', async () => {
  setLaunchSink({ opened: async () => { throw new Error('disk full') }, ended: async () => { throw new Error('disk full') } })
  try {
    const pty = fakePty()
    const manager = new PtyManager({ append: async () => ({ seq: 1 }) }, randomUUID(), { onData() {}, onExit() {} }, undefined, () => pty,
      undefined, () => ({ kind: 'person', id: 'operator' }))
    const s = await manager.open(randomUUID(), process.cwd(), 'shell')
    assert.equal(s.running, true)
  } finally { setLaunchSink(null) }
})
