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
  const w = world2()
  // A line an earlier process wrote for the same day is read back.
  w.files.set('/d/hourly-2026-11.jsonl', JSON.stringify({ schema: 'ops.digest.hourly@1', from: '2026-11-04T03:00:00.000Z', to: '2026-11-04T04:00:00.000Z', ops: [{ op: 'y', ok: 2, failed: 0, unknown: 0 }], total: { ok: 2, failed: 0, unknown: 0 }, risen: [] }) + '\n')
  const run = w.make(); run.start()
  run.observe('x', 'failed', T0)
  w.set(Date.parse('2026-11-05T00:00:05Z'))
  const { daily } = run.tick()
  assert.equal(daily.day, '2026-11-04')
  assert.equal(daily.hours, 2, '03:00 from the file and 22:00 from this process; 23:00 was not observed, so not written')
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

test('DEC-0153 OD-1 (CO-509): the hours the Mac slept are not written, and the hour after a sleep compares with none', () => {
  const w = world()
  for (let i = 0; i < 12; i++) w.run.observe('x', 'failed', T0 + i)
  w.set(T0 + 10 * 24 * HOUR)
  w.run.tick()
  assert.deepEqual(w.lines('/d/hourly-2026-11.jsonl').map((h) => h.from), ['2026-11-04T22:00:00.000Z'], 'only the observed hour')
  assert.deepEqual(w.lines('/d/daily-2026-11.jsonl').map((d) => [d.day, d.hours]), [['2026-11-04', 1]], 'the days slept through have no daily line')
  assert.equal(w.run.latest(), null, 'a rise from before the sleep is not told as now')
  for (let i = 0; i < 12; i++) w.run.observe('x', 'failed', T0 + 10 * 24 * HOUR + i)
  w.set(T0 + 10 * 24 * HOUR + HOUR)
  assert.deepEqual(w.run.tick().hourly.risen, [{ op: 'x', failed: 12, previous: 0 }], 'compared with none, not with the hour before the sleep')
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

test('DEC-0153 OD-5 (CO-509): a closed day with hourly lines and no daily line is folded once at the next start', () => {
  const files = new Map()
  const hour = (from, failed) => JSON.stringify({ schema: 'ops.digest.hourly@1', from, to: new Date(Date.parse(from) + HOUR).toISOString(), ops: [{ op: 'x', ok: 0, failed, unknown: 0 }], total: { ok: 0, failed, unknown: 0 }, risen: [] }) + '\n'
  files.set('/d/hourly-2026-11.jsonl', hour('2026-11-03T10:00:00.000Z', 2) + hour('2026-11-03T11:00:00.000Z', 3) + hour('2026-11-04T09:00:00.000Z', 1) + hour('2026-11-05T08:00:00.000Z', 1))
  files.set('/d/daily-2026-11.jsonl', JSON.stringify({ schema: 'ops.digest.daily@1', day: '2026-11-04', hours: 1, ops: [], risen: [] }) + '\n')
  const make = () => createOpsDigestRun({ dir: '/d', now: () => Date.parse('2026-11-05T09:30:00Z'),
    append: (file, line) => { files.set(file, (files.get(file) ?? '') + line) },
    read: (file) => { if (!files.has(file)) throw new Error('ENOENT'); return files.get(file) } })
  make().start()
  const daily = files.get('/d/daily-2026-11.jsonl').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  assert.deepEqual(daily.map((d) => [d.day, d.hours]), [['2026-11-04', 1], ['2026-11-03', 2]], 'only the missing closed day; today is not folded')
  make().start()
  assert.equal(files.get('/d/daily-2026-11.jsonl').split('\n').filter(Boolean).length, 2, 'a second start folds nothing again')
})

// The rest of DEC-0153 for the writer (CO-509). A world with a whole-file write, a folder listing and removal.
function world2(files = new Map(), at = T0) {
  let now = at
  const reads = []
  const said = []
  const make = () => createOpsDigestRun({
    dir: '/d',
    now: () => now,
    append: (file, line) => { files.set(file, (files.get(file) ?? '') + line) },
    read: (file) => { reads.push(file); if (!files.has(file)) throw new Error('ENOENT'); return files.get(file) },
    writeWhole: (file, text) => files.set(file, text),
    remove: (file) => files.delete(file),
    list: () => [...files.keys()].filter((f) => f.startsWith('/d/')).map((f) => f.slice(3)),
    onWriteFailed: (file) => said.push(file)
  })
  const lines = (f) => (files.get(f) ?? '').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  return { files, reads, said, make, lines, set: (t) => { now = t } }
}

test('DEC-0153 OD-1 (CO-509): the hour Fabric quits in is kept and written at the next start, compared with the hour before', () => {
  const w = world2()
  let run = w.make(); run.start()
  for (let i = 0; i < 3; i++) run.observe('x', 'failed', T0 + i)
  w.set(T0 + HOUR); run.tick()
  for (let i = 0; i < 12; i++) run.observe('x', 'failed', T0 + HOUR + i)
  run.stop()
  assert.equal(w.lines('/d/hourly-2026-11.jsonl').length, 1, 'the stop hour is not written at quit')
  w.set(Date.parse('2026-11-05T02:20:00Z'))
  run = w.make()
  assert.equal(w.lines('/d/hourly-2026-11.jsonl').length, 1, 'nothing is written before start')
  run.start()
  const hours = w.lines('/d/hourly-2026-11.jsonl')
  assert.deepEqual(hours.map((h) => h.from), ['2026-11-04T22:00:00.000Z', '2026-11-04T23:00:00.000Z'])
  assert.deepEqual(hours[1].risen, [{ op: 'x', failed: 12, previous: 3 }], 'compared with the last hour written')
  assert.deepEqual(w.lines('/d/daily-2026-11.jsonl').map((d) => [d.day, d.hours]), [['2026-11-04', 2]], 'the day folds with its stop hour')
  assert.equal(w.files.has('/d/open-hour.json'), false, 'the kept hour is gone once written')
  run.start(); w.make().start()
  assert.equal(w.lines('/d/hourly-2026-11.jsonl').length, 2, 'never written twice')
})

test('DEC-0153 OD-1 (CO-509): a restart inside the hour goes on counting it; the hour is written once', () => {
  const w = world2()
  let run = w.make(); run.start()
  run.observe('x', 'ok', T0); run.observe('x', 'ok', T0 + 1)
  run.stop()
  w.set(T0 + 60_000)
  run = w.make(); run.start()
  run.observe('x', 'ok', T0 + 60_001)
  w.set(T0 + HOUR); run.tick()
  assert.deepEqual(w.lines('/d/hourly-2026-11.jsonl').map((h) => h.ops), [[{ op: 'x', ok: 3, failed: 0, unknown: 0 }]])
})

test('DEC-0153 OD-1 (CO-509): `previous` at start comes from the last hourly line, of this month or the one before', () => {
  const w = world2()
  w.files.set('/d/hourly-2026-10.jsonl', JSON.stringify({ schema: 'ops.digest.hourly@1', from: '2026-10-31T23:00:00.000Z', to: '2026-11-01T00:00:00.000Z', ops: [{ op: 'x', ok: 0, failed: 6, unknown: 0 }], total: { ok: 0, failed: 6, unknown: 0 }, risen: [] }) + '\n')
  w.set(Date.parse('2026-11-01T00:05:00Z'))
  const run = w.make(); run.start()
  for (let i = 0; i < 11; i++) run.observe('x', 'failed', Date.parse('2026-11-01T00:05:00Z') + i)
  w.set(Date.parse('2026-11-01T01:00:00Z'))
  assert.deepEqual(run.tick().hourly.risen, [], '11 is less than twice 6')
})

test('DEC-0153 OD-3 (CO-509): past 4095 names a UTC day the rest is counted under the overflow name, counts kept', async () => {
  const { OVERFLOW_OP, DAY_NAMES_MAX } = await import(path.resolve(import.meta.dirname, '../src/shared/opsDigest.ts'))
  const w = world2()
  // An earlier process of the same day named 4000 operations.
  const ops = Array.from({ length: 4000 }, (_, i) => ({ op: `a.n${i}`, ok: 1, failed: 0, unknown: 0 }))
  w.files.set('/d/hourly-2026-11.jsonl', JSON.stringify({ schema: 'ops.digest.hourly@1', from: '2026-11-04T03:00:00.000Z', to: '2026-11-04T04:00:00.000Z', ops, total: { ok: 4000, failed: 0, unknown: 0 }, risen: [] }) + '\n')
  const run = w.make(); run.start()
  for (let i = 0; i < 200; i++) run.observe(`b.n${i}`, 'ok', T0 + i)
  run.observe('a.n1', 'failed', T0 + 500)
  w.set(T0 + HOUR)
  const h = run.tick().hourly
  assert.equal(h.ops.length, DAY_NAMES_MAX - 4000 + 2, '95 new names, the known one, and the overflow name')
  assert.deepEqual(h.ops.find((o) => o.op === OVERFLOW_OP), { op: OVERFLOW_OP, ok: 105, failed: 0, unknown: 0 })
  assert.equal(h.total.ok + h.total.failed, 201, 'no record lost')
  assert.ok(h.ops.some((o) => o.op === 'a.n1' && o.failed === 1), 'a name the day already holds keeps its own')
})

test('CO-509: a record dated before the open hour (the clock set back) is counted, not dropped', () => {
  const w = world2()
  const run = w.make(); run.start()
  run.observe('x', 'ok', T0 - 3 * HOUR)
  w.set(T0 + HOUR)
  assert.deepEqual(run.tick().hourly.ops, [{ op: 'x', ok: 1, failed: 0, unknown: 0 }])
})

test('CO-509: hourly files are kept three months and daily thirteen; nothing else is removed', () => {
  const w = world2()
  for (const f of ['hourly-2026-08.jsonl', 'hourly-2026-09.jsonl', 'hourly-2026-11.jsonl', 'daily-2025-10.jsonl', 'daily-2025-11.jsonl', 'open-hour.json.tmp', 'notes.txt'])
    w.files.set(`/d/${f}`, '')
  w.make().start()
  assert.deepEqual([...w.files.keys()].sort(), ['/d/daily-2025-11.jsonl', '/d/hourly-2026-09.jsonl', '/d/hourly-2026-11.jsonl', '/d/notes.txt', '/d/open-hour.json.tmp'])
})

test('the 0.3.16 review ER-12 (CO-509): the start reads each hourly month file once, however many days it folds', () => {
  const w = world2()
  const hour = (from) => JSON.stringify({ schema: 'ops.digest.hourly@1', from, to: new Date(Date.parse(from) + HOUR).toISOString(), ops: [], total: { ok: 0, failed: 0, unknown: 0 }, risen: [] }) + '\n'
  w.files.set('/d/hourly-2026-11.jsonl', ['01', '02', '03'].map((d) => hour(`2026-11-${d}T10:00:00.000Z`)).join(''))
  w.make().start()
  assert.equal(w.reads.filter((f) => f === '/d/hourly-2026-11.jsonl').length, 1)
  assert.equal(w.lines('/d/daily-2026-11.jsonl').length, 3)
})

test('the 0.3.16 review DA-3 (CO-509): nothing is written before start, so a failure is said once the ops log exists', () => {
  const said = []
  let appended = 0
  const run = createOpsDigestRun({ dir: '/d', now: () => T0, read: (f) => { if (f.endsWith('hourly-2026-11.jsonl')) return JSON.stringify({ schema: 'ops.digest.hourly@1', from: '2026-11-03T10:00:00.000Z', to: '2026-11-03T11:00:00.000Z', ops: [], total: { ok: 0, failed: 0, unknown: 0 }, risen: [] }) + '\n'; throw new Error('ENOENT') },
    append: () => { appended++; throw new Error('read-only') }, remove: () => {}, list: () => [], onWriteFailed: (f) => said.push(f) })
  assert.equal(appended, 0, 'creating it writes nothing')
  run.start()
  assert.deepEqual(said, ['/d/daily-2026-11.jsonl'])
})
