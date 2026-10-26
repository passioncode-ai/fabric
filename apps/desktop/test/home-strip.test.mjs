// The home's statistics strip (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §2a): «Сдано сегодня» is
// the tasks handed in since the local midnight, a task moved to review or closed as done, each task once; a read that
// fails is said as unread, never as zero.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { countHandedIn, localMidnight, readHandedInToday, withStrip } = await import(path.resolve(import.meta.dirname, '../src/main/homeStrip.ts'))

const moved = (task, to, at = '2026-10-26T10:00:00Z') => ({ type: 'task.moved@1', occurred_at: at, payload: { task_id: task, from: 'running', to } })
const closed = (task, outcome, at = '2026-10-26T11:00:00Z') => ({ type: 'task.closed@1', occurred_at: at, payload: { task_id: task, outcome } })

test('a task handed in today is one moved to review or closed as done, each task counted once', () => {
  assert.equal(countHandedIn([moved('t1', 'review'), moved('t1', 'review'), moved('t2', 'running'), closed('t1', 'done'), closed('t3', 'done'), closed('t4', 'cancelled'), moved('t5', 'review')]), 3)
  assert.equal(countHandedIn([]), 0)
})

test('the local midnight of the moment asked, in this machine\'s own zone', () => {
  const now = new Date(2026, 9, 26, 18, 42).getTime()
  assert.equal(localMidnight(now), new Date(2026, 9, 26, 0, 0, 0, 0).getTime())
})

test('readHandedInToday reads the journal since the local midnight, bounded, and throws on a failed read', async () => {
  const calls = []
  const fake = (rows, error = null) => ({
    select: (table, columns) => {
      const call = { table, columns, in: [], gte: [], limit: null }
      calls.push(call)
      const chain = {
        in: (k, v) => { call.in.push([k, v]); return chain },
        gte: (k, v) => { call.gte.push([k, v]); return chain },
        order: () => chain,
        limit: (n) => { call.limit = n; return chain },
        then: (ok) => ok(error ? { data: null, error: { message: error } } : { data: rows, error: null })
      }
      return chain
    }
  })
  const now = new Date(2026, 9, 26, 18, 42).getTime()
  const got = await readHandedInToday(fake([moved('t1', 'review'), closed('t2', 'done')]), { now, limit: 2 })
  assert.deepEqual(got, { today: 2, capped: true })
  assert.equal(calls[0].table, 'journal')
  assert.deepEqual(calls[0].in, [['type', ['task.moved@1', 'task.closed@1']]])
  assert.deepEqual(calls[0].gte, [['occurred_at', new Date(localMidnight(now)).toISOString()]])
  await assert.rejects(readHandedInToday(fake([], 'database away'), { now }), /handed in today could not be read: database away/)
  // DA-3: never more than the gateway answers, and a full answer is a floor (1 500 handed in read as «1000+», not 1000).
  calls.length = 0
  const full = Array.from({ length: 1000 }, (_, i) => moved(`t${i}`, 'review'))
  const floor = await readHandedInToday(fake(full), { now })
  assert.equal(calls[0].limit, 1000)
  assert.deepEqual(floor, { today: 1000, capped: true })
  calls.length = 0
  await readHandedInToday(fake([]), { now, limit: 5000 })
  assert.equal(calls[0].limit, 1000, 'a caller cannot ask past the gateway')
})

test('withStrip puts the strip\'s own reads on the home\'s reading: a failed one as its reason, the sweep\'s count or null', async () => {
  const view = { live: [], inWork: [], review: [], done: [], projects: [], readAt: 'r' }
  const ok = await withStrip(view, { handedIn: async () => ({ today: 4, capped: false }), sweep: () => ({ at: 1, findings: [], unclaimed: 1 }) })
  assert.deepEqual([ok.handedIn, ok.unclaimed], [{ today: 4, capped: false }, 1])
  const failed = await withStrip(view, { handedIn: async () => { throw new Error('database away') }, sweep: () => null })
  assert.deepEqual([failed.handedIn, failed.unclaimed], [{ unread: 'database away' }, null])
})
