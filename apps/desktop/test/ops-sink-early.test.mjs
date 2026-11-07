// CO-508 (CO-365's start record): what is recorded before the operations log is installed is held, bounded, and
// written when it is, in order; past the bound the rest are counted and said once.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { ops, useOps, PRE_BOOTSTRAP_MAX } = await import(path.resolve(import.meta.dirname, '../src/main/opsSink.ts'))

test('records made before the log is installed reach it when it is, in order; the overflow is counted once', () => {
  ops.record({ op: 'app.started', outcome: 'ok', level: 'info', detail: { atLogin: true }, ctx: { correlationId: ops.correlate() } })
  ops.failed('link.register', new Error('refused'))
  for (let i = 0; i < PRE_BOOTSTRAP_MAX + 3; i++) ops.record({ op: 'early.noise', outcome: 'ok', ctx: { correlationId: 'pre-bootstrap' } })
  const written = []
  useOps({ record: (r) => written.push(r), correlate: () => 'c1', begin: () => () => {}, read: () => [], file: () => null, lost: () => 0 })
  assert.equal(written[0].op, 'app.started')
  assert.equal(written[1].op, 'link.register')
  assert.equal(written.filter((r) => r.op === 'early.noise').length, PRE_BOOTSTRAP_MAX - 2)
  const dropped = written.at(-1)
  assert.equal(dropped.op, 'ops.pre-bootstrap-dropped')
  assert.equal(dropped.detail.dropped, 5)
  // After installation records go straight through, and nothing is held twice.
  ops.record({ op: 'after', outcome: 'ok', ctx: { correlationId: 'c1' } })
  assert.equal(written.at(-1).op, 'after')
  assert.equal(written.filter((r) => r.op === 'app.started').length, 1)
})

test('taking the log away again (a test\'s useOps(null)) flushes nothing and holds what comes after', () => {
  useOps(null)
  ops.record({ op: 'while-away', outcome: 'ok', ctx: { correlationId: 'pre-bootstrap' } })
  const written = []
  useOps({ record: (r) => written.push(r), correlate: () => 'c2', begin: () => () => {}, read: () => [], file: () => null, lost: () => 0 })
  assert.deepEqual(written.map((r) => r.op), ['while-away'])
})
