// CO-500, ADR-0188 §1: the hourly and daily reading of Fabric's own operations log. No disk: the append and the read
// are stand-ins; the clock is the test's.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { createOpsDigestRun } = await import(path.resolve(import.meta.dirname, '../src/main/opsDigestRun.ts'))

const HOUR = 60 * 60_000
const T0 = Date.parse('2026-11-04T22:10:00Z')

function world() {
  let now = T0
  const files = new Map()
  const failed = []
  const run = createOpsDigestRun({
    dir: '/d',
    now: () => now,
    append: (file, line) => { files.set(file, (files.get(file) ?? '') + line) },
    read: (file) => { if (!files.has(file)) throw new Error('ENOENT'); return files.get(file) },
    onWriteFailed: (file, e) => failed.push([file, String(e)])
  })
  return { run, files, failed, set: (t) => { now = t }, lines: (f) => (files.get(f) ?? '').split('\n').filter(Boolean).map((l) => JSON.parse(l)) }
}

test('an hour closes when the clock passes it: one hourly line, counted by operation and outcome', () => {
  const w = world()
  for (let i = 0; i < 12; i++) w.run.observe('board.tick', 'failed', T0 + i)
  w.run.observe('ipc.work:home', 'ok', T0 + 100)
  assert.equal(w.run.tick().hourly, null, 'the hour is still open')
  w.set(Date.parse('2026-11-04T23:00:01Z'))
  const { hourly } = w.run.tick()
  assert.equal(hourly.from, '2026-11-04T22:00:00.000Z')
  assert.deepEqual(hourly.ops.find((o) => o.op === 'board.tick'), { op: 'board.tick', ok: 0, failed: 12, unknown: 0 })
  assert.deepEqual(hourly.risen, [{ op: 'board.tick', failed: 12, previous: 0 }])
  assert.equal(w.lines('/d/hourly-2026-11.jsonl').length, 1)
  assert.equal(w.run.latest().from, '2026-11-04T22:00:00.000Z')
})

test('a record of a later hour closes the open one first and counts in its own', () => {
  const w = world()
  w.run.observe('x', 'failed', T0)
  w.run.observe('x', 'ok', T0 + HOUR)
  assert.equal(w.lines('/d/hourly-2026-11.jsonl').length, 1)
  w.set(T0 + 2 * HOUR)
  const { hourly } = w.run.tick()
  assert.deepEqual(hourly.ops, [{ op: 'x', ok: 1, failed: 0, unknown: 0 }])
})

test('the UTC day closes into one daily line, from this process and from the file', () => {
  const w = world()
  // A line an earlier process wrote for the same day is read back.
  w.files.set('/d/hourly-2026-11.jsonl', JSON.stringify({ schema: 'ops.digest.hourly@1', from: '2026-11-04T03:00:00.000Z', to: '2026-11-04T04:00:00.000Z', ops: [{ op: 'y', ok: 2, failed: 0, unknown: 0 }], total: { ok: 2, failed: 0, unknown: 0 }, risen: [] }) + '\n')
  w.run.observe('x', 'failed', T0)
  w.set(Date.parse('2026-11-05T00:00:05Z'))
  const { daily } = w.run.tick()
  assert.equal(daily.day, '2026-11-04')
  assert.equal(daily.hours, 3, '03:00 from the file, 22:00 and 23:00 from this process')
  assert.deepEqual(daily.ops.map((o) => o.op), ['x', 'y'])
  assert.equal(w.lines('/d/daily-2026-11.jsonl').length, 1)
})

test('a write that fails is said once and the counting goes on', () => {
  let now = T0
  const said = []
  const run = createOpsDigestRun({ dir: '/d', now: () => now, append: () => { throw new Error('disk full') }, read: () => '', onWriteFailed: (f) => said.push(f) })
  run.observe('x', 'ok', T0)
  now = T0 + HOUR
  run.tick()
  now = T0 + 2 * HOUR
  run.tick()
  assert.deepEqual(said, ['/d/hourly-2026-11.jsonl'])
  assert.ok(run.latest(), 'the digest is still kept in memory')
})

test('a long sleep does not close hundreds of empty hours one by one', () => {
  const w = world()
  w.run.observe('x', 'ok', T0)
  w.set(T0 + 10 * 24 * HOUR)
  w.run.tick()
  assert.ok(w.lines('/d/hourly-2026-11.jsonl').length <= 26)
})

test('saying a failed write is itself a record: it neither recurses nor is lost', () => {
  let now = T0
  let run = null
  const said = []
  run = createOpsDigestRun({ dir: '/d', now: () => now, append: () => { throw new Error('disk full') }, read: () => '',
    // The real sink records the failure, and that record is observed again at the same clock.
    onWriteFailed: (f) => { said.push(f); run.observe('ops.digest-write', 'failed', now) } })
  run.observe('x', 'ok', T0)
  now = T0 + HOUR + 1
  run.observe('y', 'ok', now)
  assert.deepEqual(said, ['/d/hourly-2026-11.jsonl'])
  now = T0 + 2 * HOUR + 1
  run.tick()
  assert.deepEqual(run.latest().ops.map((o) => o.op).sort(), ['ops.digest-write', 'y'])
})
