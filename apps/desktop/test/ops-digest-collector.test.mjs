// CO-503 (the contract's DEC-0153 OD-9): Fabric as the collector of the daily digests. No disk: the files are a map.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { createOpsDigestCollector } = await import(path.resolve(import.meta.dirname, '../src/main/opsDigestCollector.ts'))
const { declaredFolders, dirFits, dailyFits, OPS_DIGEST_EXTENSION } = await import(path.resolve(import.meta.dirname, '../src/shared/opsDigestCollect.ts'))

const daily = (day, failed = 0) => JSON.stringify({ schema: 'ops.digest.daily@1', day, hours: 2, ops: [{ op: 'x', ok: 1, failed, unknown: 0 }], total: { ok: 1, failed, unknown: 0 }, risen: [] })
const desc = (over = {}) => ({ id: 'inbox', instance: 'default', placement: 'local', paths: { data: '/data/inbox', logs: [] }, extensions: { [OPS_DIGEST_EXTENSION]: [{ dir: 'digests', source: 'mac-app' }] }, ...over })

function world(files, now = Date.parse('2026-11-06T08:00:00Z')) {
  const sent = []
  const c = createOpsDigestCollector({
    ownDir: '/own', servicesDir: '/svc', now: () => now,
    read: (f) => { if (!files.has(f)) throw new Error('ENOENT'); return files.get(f) },
    list: (d) => [...files.keys()].filter((f) => path.dirname(f) === d).map((f) => path.basename(f)),
    writeWhole: (f, t) => files.set(f, t),
    send: async (r) => { if (r.day === 'fail') throw new Error('x'); sent.push(r) }
  })
  return { c, sent, files }
}

test('Fabric\'s own closed days and a declaring service\'s are sent once each, with service and source; today is not', async () => {
  const files = new Map([
    ['/own/daily-2026-11.jsonl', [daily('2026-11-04'), daily('2026-11-04', 9), daily('2026-11-05')].join('\n') + '\n'],
    ['/own/daily-2026-10.jsonl', daily('2026-10-31') + '\n'],
    ['/svc/fabric-inbox.default.json', JSON.stringify(desc())],
    ['/svc/other.default.json', JSON.stringify({ id: 'other', instance: 'default', paths: { data: '/d' } })],
    ['/data/inbox/digests/daily-2026-11.jsonl', daily('2026-11-05') + '\n' + daily('2026-11-06') + '\n']
  ])
  const w = world(files)
  const p = await w.c.pass()
  assert.equal(p.sent, 4)
  assert.deepEqual(w.sent.map((r) => [r.service.id, r.source, r.day]).sort(), [['fabric', 'app', '2026-10-31'], ['fabric', 'app', '2026-11-04'], ['fabric', 'app', '2026-11-05'], ['inbox', 'mac-app', '2026-11-05']])
  assert.equal(JSON.parse(w.sent.find((r) => r.day === '2026-11-04').line).ops[0].failed, 0, 'the first line of a day, as readers take it')
  assert.equal((await w.c.pass()).sent, 0, 'nothing twice')
})

test('a declaration FAC-SEM-168 refuses is skipped whole, named by service and reason', async () => {
  const files = new Map([
    ['/svc/a.default.json', JSON.stringify(desc({ id: 'a', extensions: { [OPS_DIGEST_EXTENSION]: [{ dir: '../escape', source: 'app' }] } }))],
    ['/svc/b.default.json', JSON.stringify(desc({ id: 'b', placement: 'remote' }))],
    ['/svc/c.default.json', JSON.stringify(desc({ id: 'c', extensions: { [OPS_DIGEST_EXTENSION]: [{ dir: 'd', source: 'app' }, { dir: 'D', source: 'mac' }] } }))]
  ])
  const p = await world(files).c.pass()
  assert.deepEqual(p.skipped.map((s) => s.service).sort(), ['a.default', 'b.default', 'c.default'])
})

test('a send that fails is counted and tried again on the next pass', async () => {
  const files = new Map([['/own/daily-2026-11.jsonl', daily('2026-11-05') + '\n']])
  let fail = true
  const c = createOpsDigestCollector({ ownDir: '/own', servicesDir: '/svc', now: () => Date.parse('2026-11-06T08:00:00Z'),
    read: (f) => { if (!files.has(f)) throw new Error('ENOENT'); return files.get(f) }, list: () => [], writeWhole: (f, t) => files.set(f, t),
    send: async () => { if (fail) throw new Error('down') } })
  assert.deepEqual([(await c.pass()).sent, (await c.pass()).failed], [0, 1])
  fail = false
  assert.equal((await c.pass()).sent, 1)
})

test('OD-9\'s dir grammar: inside paths.data, no home folder, no hidden empty segment', () => {
  for (const ok of ['digests', 'a/b', 'user-digests', 'a/~1/x']) assert.equal(dirFits(ok), true, ok)
  for (const bad of ['/abs', '~/x', 'C:x', 'a\\b', 'a//b', './a', 'a/..', '..⁠', 'a/. ', 'users/digests', 'my_users/digests', 'my-users/digests', '\ud800'])
    assert.equal(dirFits(bad), false, JSON.stringify(bad))
  assert.equal(declaredFolders({ placement: 'local', paths: {}, extensions: { [OPS_DIGEST_EXTENSION]: [{ dir: 'd', source: 'app' }] } }).refused, 'no paths.data')
  assert.equal(declaredFolders({ placement: 'local' }), null)
})

test('a daily line a reader would skip is not sent: shape, names, sums', () => {
  assert.equal(dailyFits(JSON.parse(daily('2026-11-05'))), true)
  const bad = (f) => { const d = JSON.parse(daily('2026-11-05')); f(d); return dailyFits(d) }
  assert.equal(bad((d) => { d.hours = 0 }), false)
  assert.equal(bad((d) => { d.total.ok = 2 }), false)
  assert.equal(bad((d) => { d.ops[0].op = 'api.users/list' }), false)
  assert.equal(bad((d) => { d.extra = 1 }), false)
})
