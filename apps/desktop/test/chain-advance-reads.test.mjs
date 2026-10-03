// The chain advance reads every link it judges by, fails CLOSED when it cannot,
// and says what one pass did (release review 2026-10-03, data finding 4).
//
// MEASURED by the review: `chainAdvance` read `task_links` with no paging and its
// error destructured away. PostgREST answers at most `max_rows = 1000` rows
// (`supabase/config.toml`), and the probe estate already held 686 `follows`
// rows — so past the cap a follower's unfinished predecessor is simply not in
// the answer, and the follower starts before it. The spawn-link read behind the
// M68 loop bound had the same shape and failed OPEN: a refused read was an empty
// provenance map, and every chain looked short. Three more from the same pass:
// the quota reading was spent before the loop bound could refuse, a failing
// launch rethrew out of the tick (so the next follower in the same pass never
// ran) and was retried every tick for ever, and the cycle receipt said
// `completed` whatever the tick had seen, because the tick returned nothing.
//
// The store under test is the REAL `createScopedStore` (R-007). Only the `db`
// beneath it is a model, and the model keeps PostgREST's one property that
// matters here: no answer is longer than 1000 rows, whatever was asked.
//
// Pure: no database, no network.
import assert from 'node:assert/strict'
import * as chainAdvance from '../src/main/chainAdvance.ts'
import { createScopedStore } from '../src/main/scopedStore.ts'
import { ops } from '../src/main/opsSink.ts'

const { createChainAdvance } = chainAdvance
// Read through the namespace so this file still LOADS against a build without the cap and
// measures the behaviour instead of failing on a missing export (the watched-failure run).
const MAX_CHAIN_LAUNCH_ATTEMPTS = chainAdvance.MAX_CHAIN_LAUNCH_ATTEMPTS ?? 3

const MAX_ROWS = 1000
const ESTATE = 'estate-1'

/** A db shaped like PostgREST's client: eq/in/order/range/limit/count, capped at MAX_ROWS. */
function fakeDb(tables, { failing = {} } = {}) {
  const valueOf = (row, column) => {
    const path = column.split('->>')
    return path.length === 2 ? row[path[0]]?.[path[1]] : row[column]
  }
  return {
    from(table) {
      const filters = []
      let order = []
      let from = 0
      let to = null
      let count = false
      let head = false
      const q = {
        select(_columns, options = {}) { count = options.count === 'exact'; head = !!options.head; return q },
        eq(c, v) { filters.push((r) => valueOf(r, c) === v); return q },
        in(c, vs) { filters.push((r) => vs.includes(valueOf(r, c))); return q },
        order(c) { order.push(c); return q },
        range(a, b) { from = a; to = b; return q },
        limit(n) { to = from + n - 1; return q },
        then(resolve) {
          if (failing[table]) return Promise.resolve({ data: null, error: { message: failing[table], code: 'XX000' }, count: null }).then(resolve)
          let rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))
          const total = rows.length
          if (order.length) rows = [...rows].sort((a, b) => order.map((c) => String(a[c]).localeCompare(String(b[c]))).find((x) => x !== 0) ?? 0)
          rows = rows.slice(from, to === null ? undefined : to + 1).slice(0, MAX_ROWS)
          return Promise.resolve({ data: head ? null : rows, error: null, count: count ? total : null }).then(resolve)
        }
      }
      return q
    }
  }
}

const backlog = (id) => ({ id, estate_id: ESTATE, project_id: 'p', status: 'backlog', option_id: 'shell', instruction: `do ${id}`, brief_what: null })
const done = (id) => ({ id, estate_id: ESTATE, project_id: 'p', status: 'done' })
const follows = (task, target) => ({ estate_id: ESTATE, project_id: 'p', task_id: task, target_id: target, rel: 'follows', target_kind: 'task', needs: [] })
const spawned = (task, target) => ({ estate_id: ESTATE, project_id: 'p', task_id: task, target_id: target, rel: 'spawned', target_kind: 'task' })

function harness(tables, { failing, startFails = () => false, quota = () => ({ readAt: String(Math.random()) }) } = {}) {
  const events = [], started = [], claims = [], admitted = [], reported = []
  const store = createScopedStore(fakeDb(tables, { failing }), { kind: 'estate', estateId: ESTATE })
  const advance = createChainAdvance({
    store,
    estateId: ESTATE,
    journal: { append: async (e) => { events.push(e); (tables.journal ??= []).push({ estate_id: ESTATE, seq: events.length, type: e.type, payload: e.payload }); return { seq: events.length } } },
    quota: async () => quota(),
    admission: { claim: (q) => { claims.push(q); return { ok: true } }, spent: () => null },
    admitExisting: async (taskId, sessionId) => { admitted.push(taskId); return { admitted: true, receipt: { task_run_id: `run-${taskId}`, project_id: 'p', instruction: 'x' } } },
    startTask: async (input) => {
      if (startFails(input.followerId)) throw new Error('binary not found')
      started.push(input.followerId)
      return { task: { id: input.followerId }, session: { sessionId: 's' } }
    }
  })
  return { advance, events, started, claims, admitted, reported }
}

let failures = 0
const test = async (name, fn) => {
  const real = ops.failed
  const reported = []
  ops.failed = (op, e) => reported.push({ op, message: String(e?.message ?? e) })
  try { await fn(reported); console.log('  ok   ' + name) } catch (e) { failures++; console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n').join('\n       ')) } finally { ops.failed = real }
}

await test('a predecessor past the first 1000 links still holds its follower', async () => {
  // 1200 links. The follower F waits on X (done, in the first answer) and on Y
  // (running, link number 1200 — beyond any single answer the gateway gives).
  const links = [follows('F', 'X')], tasks = [backlog('F'), done('X'), { ...done('Y'), status: 'running' }]
  for (let i = 0; i < 1198; i++) { links.push(follows(`a${String(i).padStart(4, '0')}`, 'X')); tasks.push(done(`a${String(i).padStart(4, '0')}`)) }
  links.push(follows('F', 'Y'))
  const h = harness({ task_links: links, project_tasks: tasks })
  const result = await h.advance()
  assert.ok(!h.started.includes('F'), 'F started while its predecessor Y is still running — the finding itself')
  assert.equal(result?.state, 'completed', 'a pass that read every link and held F is complete: ' + JSON.stringify(result))
})

await test('a refused link read starts nothing, is reported by name, and the pass says its outcome is unknown', async (reported) => {
  const h = harness({ project_tasks: [backlog('F'), done('X')], task_links: [follows('F', 'X')] }, { failing: { task_links: 'permission denied' } })
  const result = await h.advance()
  assert.equal(h.started.length, 0)
  assert.ok(reported.some((r) => /links-unreadable/.test(r.op) && /permission denied/.test(r.message)), 'not reported: ' + JSON.stringify(reported))
  assert.equal(result?.state, 'outcome_unknown', 'an unread chain recorded as ' + JSON.stringify(result))
})

await test('a refused spawn-link read fails CLOSED: the loop bound is not skipped, and nothing starts', async (reported) => {
  const tables = { project_tasks: [backlog('F'), done('X')], task_links: [follows('F', 'X')] }
  // Fail only the second task_links read — the follows read must succeed to reach the bound.
  const db = fakeDb(tables)
  let reads = 0
  const wrapped = { from: (t) => { const q = db.from(t); if (t !== 'task_links') return q; const then = q.then; q.then = (res) => (++reads === 2 ? Promise.resolve({ data: null, error: { message: 'spawn links refused', code: 'XX000' } }).then(res) : then(res)); return q } }
  const events = [], started = []
  const advance = createChainAdvance({
    store: createScopedStore(wrapped, { kind: 'estate', estateId: ESTATE }), estateId: ESTATE,
    journal: { append: async (e) => { events.push(e); return { seq: 1 } } }, quota: async () => ({ readAt: 'r' }),
    admission: { claim: () => ({ ok: true }), spent: () => null },
    admitExisting: async () => ({ admitted: true, receipt: { task_run_id: 'run', project_id: 'p', instruction: 'x' } }),
    startTask: async (input) => { started.push(input.followerId); return { task: { id: 'F' } } }
  })
  const result = await advance()
  assert.equal(started.length, 0, 'the follower started with no loop bound — the M68 guard failed open')
  assert.ok(reported.some((r) => /unreadable/.test(r.op) && /spawn links refused/.test(r.message)), 'not reported: ' + JSON.stringify(reported))
  assert.equal(result?.state, 'outcome_unknown')
})

await test('the loop bound refuses BEFORE a quota reading is spent', async () => {
  // X descends from itself (a spawned cycle), so mayChain refuses F.
  const h = harness({ project_tasks: [backlog('F'), done('X'), done('Z')], task_links: [follows('F', 'X'), spawned('X', 'Z'), spawned('Z', 'X')] })
  await h.advance()
  assert.equal(h.started.length, 0)
  assert.equal(h.claims.length, 0, 'the reading was spent on a start the bound then refused')
  assert.ok(h.events.some((e) => e.type === 'routine.paused@1' && /descends from itself/.test(e.payload.reason)), 'the bound refusal was not recorded')
})

await test('a launch that fails does not stop the pass: the next follower starts, and the pass is partial', async () => {
  const h = harness({ project_tasks: [backlog('F1'), backlog('F2'), done('X')], task_links: [follows('F1', 'X'), follows('F2', 'X')] },
    { startFails: (id) => id === 'F1' })
  let threw = null
  const result = await h.advance().catch((e) => { threw = e })
  assert.equal(threw, null)
  assert.deepEqual(h.started, ['F2'], 'one failing launch took the rest of the pass with it')
  assert.ok(h.events.some((e) => e.type === 'chain.dispatch@1' && e.payload.phase === 'failed' && e.payload.id === 'F1'))
  assert.equal(result?.state, 'partial', JSON.stringify(result))
})

await test(`a follower whose launch failed ${MAX_CHAIN_LAUNCH_ATTEMPTS} times is not tried again unattended, and that is said once`, async () => {
  const tables = { project_tasks: [backlog('F'), done('X')], task_links: [follows('F', 'X')] }
  const h = harness(tables, { startFails: () => true })
  for (let i = 0; i < MAX_CHAIN_LAUNCH_ATTEMPTS + 3; i++) await h.advance()
  const failedLaunches = h.events.filter((e) => e.type === 'chain.dispatch@1' && e.payload.phase === 'failed')
  assert.equal(failedLaunches.length, MAX_CHAIN_LAUNCH_ATTEMPTS, `retried ${failedLaunches.length} times`)
  assert.equal(h.admitted.length, MAX_CHAIN_LAUNCH_ATTEMPTS, 'admitted again after the cap')
  const exhausted = h.events.filter((e) => e.type === 'routine.paused@1' && e.payload.reason_code === 'launch-retries-exhausted')
  assert.equal(exhausted.length, 1, `the cap was said ${exhausted.length} times`)
})

await test('a refused hand-off read starts nothing for that follower, and says so', async (reported) => {
  const h = harness({ project_tasks: [backlog('F'), done('X')], task_links: [follows('F', 'X')] }, { failing: { task_handoffs: 'handoffs refused' } })
  const result = await h.advance()
  assert.equal(h.started.length, 0, 'the follower started on hand-offs nobody could read')
  assert.ok(reported.some((r) => /handoffs-unreadable/.test(r.op)), 'not reported: ' + JSON.stringify(reported))
  assert.notEqual(result?.state, 'completed')
})

await test('a pass with nothing waiting says so, and one that started its follower is complete', async () => {
  const idle = await harness({ project_tasks: [], task_links: [] }).advance()
  assert.equal(idle?.state, 'skipped_no_delta')
  const h = harness({ project_tasks: [backlog('F'), done('X')], task_links: [follows('F', 'X')] })
  const result = await h.advance()
  assert.deepEqual(h.started, ['F'])
  assert.equal(result?.state, 'completed')
  assert.equal(result?.started, 1)
})

await test('the paged read reads to the end when the gateway caps lower than the page, and a refused page is a failure', async () => {
  const rows = Array.from({ length: 2345 }, (_, i) => follows(`t${String(i).padStart(5, '0')}`, 'X'))
  const store = createScopedStore(fakeDb({ task_links: rows }), { kind: 'estate', estateId: ESTATE })
  const all = await store.selectAll('task_links', 'task_id,target_id', { orderBy: ['task_id', 'target_id'], pageSize: 5000 })
  assert.equal(all.failed, null)
  assert.equal(all.rows.length, 2345, 'a page the gateway capped at 1000 was taken for the end of the data')
  assert.equal(new Set(all.rows.map((r) => r.task_id)).size, 2345, 'a page boundary repeated or skipped a row')
  let pages = 0
  const db = fakeDb({ task_links: rows })
  const refusing = { from: (t) => { const q = db.from(t); const then = q.then; q.then = (res) => (++pages === 2 ? Promise.resolve({ data: null, error: { message: 'timeout', code: '57014' } }).then(res) : then(res)); return q } }
  const partial = await createScopedStore(refusing, { kind: 'estate', estateId: ESTATE })
    .selectAll('task_links', 'task_id,target_id', { orderBy: ['task_id', 'target_id'] })
  assert.match(partial.failed ?? '', /57014.*timeout/)
  assert.equal(partial.rows.length, 0, 'the first page was handed back as if it were the whole answer')
})

if (failures) { console.log('\n' + failures + ' failure(s)'); process.exit(1) }
console.log('\nall green: every link is read, an unread one starts nothing, and the pass says what it did')
