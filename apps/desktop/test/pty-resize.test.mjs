// Audit 2026-10-05 A2-001, 0.3.2 verification UX-10: resizing the window of an ended session is a no-op.
// node-pty's resize on an exited PTY throws `ioctl(2) failed, EBADF`; the native stand-in here throws the
// same once its process has exited, so the test fails if the guard in `PtyManager.resize` is removed.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PtyManager } from '../src/main/pty.ts'

// A pid no process can hold (Linux PID_MAX_LIMIT is 4 194 304, macOS stops at 99 998): a fake terminal's pid
// must never name a live process, or the manager captures THAT process's identity and stops it instead (2026-10-14:
// 4321 was a live WebKit process on the operator's Mac, and end() never reached the fake's kill()).
const FAKE_PID = 4_194_305

let exited = false, resizes = 0, exit
const native = {
  pid: FAKE_PID,
  resize() { if (exited) throw Error('ioctl(2) failed, EBADF'); resizes++ },
  write() {}, onData() {}, onExit(cb) { exit = cb }, kill() {}
}
const manager = new PtyManager({ append: async () => ({ seq: 1 }) }, randomUUID(), { onData() {}, onExit() {} },
  { compile: async () => ({ dir: '/not-used', args: [] }), discard() {} }, () => native,
  { open() {}, write() {} }, () => ({ kind: 'person', id: 'operator' }))

const session = await manager.open(randomUUID(), process.cwd(), 'shell')
const id = session.sessionId ?? manager.list()[0].sessionId
manager.resize(id, 100, 30)
assert.equal(resizes, 1, 'a running session is resized')
exited = true
await exit({ exitCode: 0 })
assert.equal(manager.get(id).running, false)
assert.doesNotThrow(() => manager.resize(id, 120, 40), 'an ended session ignores a resize instead of throwing EBADF')
assert.doesNotThrow(() => manager.resize(randomUUID(), 120, 40), 'an unknown session ignores a resize')
assert.equal(resizes, 1)
console.log('ok   resizing an ended session is a no-op, not an ioctl EBADF throw (A2-001)')
