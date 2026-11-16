// W4 of the quality waves (wave 1): the bug store's wiring, out of index.ts. A helper process that crashes is one
// `crash.<type>` record, never during a quit or for a clean or killed end; a failed record of the log folds into the
// store with its class; the store is flushed once a minute and at quit; native dumps never upload.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const { startBugCapture } = await import(path.resolve(import.meta.dirname, '../src/main/bugCapture.ts'))

function harness() {
  const app = new EventEmitter(), failed = [], quitters = [], started = []
  let quitting = false
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'fabric-capture-')), 'bugs.json')
  const capture = startBugCapture({
    file, version: () => '0.3.22', app, crashReporter: { start: (o) => started.push(o) },
    quitting: () => quitting, onQuit: (f) => quitters.push(f),
    failed: (op, e, detail) => failed.push({ op, reason: e.message, detail })
  })
  return { app, failed, quitters, started, file, capture, quit: () => { quitting = true; for (const f of quitters) f() } }
}

test('a crashed helper is one crash record named by its type; a quit, a clean end or a kill is not', () => {
  const h = harness()
  h.app.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed', exitCode: 11, name: 'GPU Helper' })
  h.app.emit('child-process-gone', {}, { type: 'Utility', reason: 'clean-exit', exitCode: 0 })
  h.app.emit('child-process-gone', {}, { type: 'Utility', reason: 'killed', exitCode: 9 })
  assert.deepEqual(h.failed.map((f) => [f.op, f.reason]), [['crash.gpu', 'crashed']])
  assert.deepEqual(h.failed[0].detail, { exitCode: 11, name: 'GPU Helper' })
  h.quit()
  h.app.emit('child-process-gone', {}, { type: 'Network Service', reason: 'crashed', exitCode: 1 })
  assert.equal(h.failed.length, 1, 'a helper ended by the quit is the quit\'s own work')
})

test('native dumps stay on this machine', () => {
  assert.deepEqual(harness().started, [{ uploadToServer: false, compress: true }])
})

test('a failed log record folds into the store by class, and the quit writes it', () => {
  const h = harness()
  h.capture.observe('crash.gpu', 'failed', { error: new Error('crashed'), correlationId: 'c1' })
  h.capture.observe('board.rpc', 'failed', { error: new Error('timeout'), correlationId: 'c2' })
  h.capture.observe('board.rpc', 'ok')
  h.capture.observe('board.rpc', 'failed')
  h.quit()
  const rows = JSON.parse(readFileSync(h.file, 'utf8')).rows
  assert.deepEqual(rows.map((r) => [r.cls, r.code, r.count]).sort(), [['crash', 'crash.gpu', 1], ['error', 'board.rpc', 1]])
  assert.ok(rows.every((r) => r.versions.includes('0.3.22')))
})
