// The views «Who is working on what» (SCR-31) and «Where work is» (SCR-78) read: whether Fabric holds a console for a
// session and for a claim's session (0.3.5 review UX-3). «Open session» is offered only where there is one — a coding
// agent enrolled from its own terminal has none, and opening it showed "This session is gone". Pure: no store is read.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { claimView, consolesOf, sessionView } = await import(path.resolve(import.meta.dirname, '../src/main/workRead.ts'))

const held = (over = {}) => ({ sessionId: 's1', projectId: 'p1', agent: 'claude-code', cameIn: 'launched', startedAt: 0, lastSignAt: null, ...over })
const claimRow = (over = {}) => ({
  id: 'c1', project_id: 'p1', work_id: 't1', owner_session: 's1', agent: 'claude-code', came_in: 'enrolled', touches: [], claimed_at: 'a', expires_at: 'b',
  renewed_at: null, task: { id: 't1', title: 'Login form', status: 'running' }, source: null, life: 'live', last_sign_at: 'a', related: [], ...over
})

test('a session has a console only when Fabric runs a terminal for it', () => {
  assert.equal(sessionView(held({ console: true }), 0).console, true)
  assert.equal(sessionView(held({ cameIn: 'enrolled', console: false }), 0).console, false)
  assert.equal(sessionView(held({ cameIn: 'enrolled' }), 0).console, false, 'an older caller without the field is no console')
})

test("a claim's console is its session's: an enrolled agent's claim offers no «Open session»", () => {
  const consoles = consolesOf([held({ sessionId: 's1', console: true }), held({ sessionId: 's2', cameIn: 'enrolled', console: false })])
  assert.equal(claimView(claimRow({ owner_session: 's1' }), new Map(), consoles).console, true)
  assert.equal(claimView(claimRow({ owner_session: 's2' }), new Map(), consoles).console, false)
  assert.equal(claimView(claimRow({ owner_session: 's9' }), new Map(), consoles).console, false, 'a session Fabric does not hold has no console')
})

test('readWork names the reads that stopped at their limit (CO-310)', async () => {
  const { readWork } = await import(path.resolve(import.meta.dirname, '../src/main/workRead.ts'))
  const claim = (i) => ({ id: 'c' + i, project_id: 'p1', work_id: 't' + i, owner_session: 's' + i, agent: 'claude-code', came_in: 'launched', touches: [], claimed_at: '2026-10-23T00:00:00Z', expires_at: '2099-01-01T00:00:00Z', renewed_at: null })
  const fake = (tables) => ({
    select: (table) => {
      const chain = { is: () => chain, eq: () => chain, in: () => chain, order: () => chain, limit: () => chain, not: () => chain,
        then: (ok) => ok({ data: tables[table] ?? [], error: null }) }
      return chain
    },
    selectIn: async () => ({ rows: [], failed: null })
  })
  const at = { now: Date.parse('2026-10-23T12:00:00Z'), session: () => null }
  const full = await readWork(fake({ work_claims: [claim(1), claim(2)], leases: [] }), { ...at, limit: 2 })
  assert.deepEqual(full.capped, ['claims'])
  const whole = await readWork(fake({ work_claims: [claim(1)], leases: [] }), { ...at, limit: 2 })
  assert.equal(whole.capped, undefined)
})

test('the board\'s reads in main: one project filters in every query, the queue is newest first, a failed «Закончили» is said (CO-405)', async () => {
  const { readTaskBoard } = await import(path.resolve(import.meta.dirname, '../src/main/workRead.ts'))
  const calls = []
  const fake = (fail = {}) => ({
    select: (table, columns) => {
      const call = { table, columns, eq: [], order: null, orders: [] }
      calls.push(call)
      const chain = {
        is: () => chain, in: () => chain, not: () => chain, limit: () => chain,
        eq: (k, v) => { call.eq.push([k, v]); return chain },
        order: (k, o) => { call.order ??= [k, o?.ascending]; call.orders.push([k, o?.ascending, o?.nullsFirst]); return chain },
        then: (ok) => ok(fail[table] && call.eq.some(([k, v]) => k === 'status' && v === fail[table]) ? { data: null, error: { message: 'database away' } } : { data: [], error: null })
      }
      return chain
    },
    selectIn: async () => ({ rows: [], failed: null })
  })
  const at = { now: Date.parse('2026-10-23T12:00:00Z'), session: () => null, sessions: [] }
  await readTaskBoard(fake(), { ...at, projectId: 'p1' })
  const tasks = calls.filter((c) => c.table === 'project_tasks' && c.eq.some(([k]) => k === 'status'))
  for (const c of tasks) assert.ok(c.eq.some(([k, v]) => k === 'project_id' && v === 'p1'), `${c.eq.find(([k]) => k === 'status')[1]} is read for the project only`)
  for (const t of ['work_claims', 'leases']) assert.ok(calls.filter((c) => c.table === t).every((c) => c.eq.some(([k, v]) => k === 'project_id' && v === 'p1')), `${t} is read for the project only`)
  const queue = calls.find((c) => c.table === 'project_tasks' && c.eq.some(([k, v]) => k === 'status' && v === 'backlog'))
  assert.deepEqual(queue.order, ['seq', false], 'the queue is the newest filed first')
  // 0.3.12 review DA-6: «Отменено» is the newest CANCELLED, by `moved_at` (task.closed@1 sets it), filing order only breaking ties.
  const cancelledCall = calls.find((c) => c.table === 'project_tasks' && c.eq.some(([k, v]) => k === 'status' && v === 'cancelled'))
  assert.deepEqual(cancelledCall.orders, [['moved_at', false, false], ['seq', false, undefined]], 'the cancelled column is the most recently cancelled first')
  calls.length = 0
  const board = await readTaskBoard(fake({ project_tasks: 'done' }), at)
  assert.match(board.columns.find((c) => c.stage === 'done').unread ?? '', /database away/)
  assert.ok(calls.filter((c) => c.table === 'work_claims').every((c) => !c.eq.some(([k]) => k === 'project_id')), 'the estate board reads every project')
})

test("an agent's tasks in main (0.3.14): its claims and launched tasks by its session, newest first; a failed read throws, never «no task»", async () => {
  const { readSessionTasks } = await import(path.resolve(import.meta.dirname, '../src/main/workRead.ts'))
  const S = '11111111-2222-4333-8444-555555555555'
  const calls = []
  const fake = (tables, fail = {}) => ({
    select: (table, columns) => {
      const call = { table, columns, eq: [], orders: [] }
      calls.push(call)
      const chain = {
        is: () => chain, in: () => chain, not: () => chain, limit: () => chain,
        eq: (k, v) => { call.eq.push([k, v]); return chain },
        order: (k, o) => { call.orders.push([k, o?.ascending]); return chain },
        then: (ok) => ok(fail[table] ? { data: null, error: { message: fail[table] } } : { data: tables[table] ?? [], error: null })
      }
      return chain
    },
    selectIn: async (table, _columns, key, values) => fail[`in:${table}`]
      ? { rows: [], failed: fail[`in:${table}`] }
      : { rows: (tables[`in:${table}`] ?? []).filter((r) => values.includes(r[key])), failed: null }
  })
  const tables = {
    work_claims: [
      { work_id: 't1', project_id: 'p1', claimed_at: '2026-10-26T08:00:00Z', released_at: '2026-10-26T09:00:00Z', released_how: 'done' },
      { work_id: 't2', project_id: 'p1', claimed_at: '2026-10-26T10:00:00Z', released_at: null, released_how: null }
    ],
    project_tasks: [{ id: 't3', project_id: 'p1', title: 'Launched', brief_what: null, brief_why: null, brief_expected: null, status: 'running', started_at: '2026-10-26T11:00:00Z' }],
    'in:project_tasks': [
      { id: 't1', project_id: 'p1', title: 'One', brief_what: null, brief_why: null, brief_expected: null, status: 'done', started_at: null },
      { id: 't2', project_id: 'p1', title: null, brief_what: 'Two', brief_why: null, brief_expected: null, status: 'running', started_at: null }
    ],
    'in:projects': [{ id: 'p1', name: 'Fabric' }]
  }
  const view = await readSessionTasks(fake(tables), S)
  assert.deepEqual(view.tasks.map((t) => [t.taskId, t.summary, t.status, t.releasedHow, t.projectName]), [
    ['t3', 'Launched', 'running', null, 'Fabric'], ['t2', 'Two', 'running', null, 'Fabric'], ['t1', 'One', 'done', 'done', 'Fabric']
  ])
  const claims = calls.find((c) => c.table === 'work_claims')
  assert.deepEqual(claims.eq, [['owner_session', S]], 'released claims are read too: no released_at filter')
  assert.deepEqual(claims.orders, [['claimed_at', false]], 'the newest claims first')
  assert.deepEqual(calls.find((c) => c.table === 'project_tasks').eq, [['session_id', S]])
  await assert.rejects(readSessionTasks(fake(tables, { work_claims: 'database away' }), S), /claims could not be read: database away/)
  await assert.rejects(readSessionTasks(fake(tables, { 'in:project_tasks': 'refused' }), S), /tasks could not be read: refused/)
  await assert.rejects(readSessionTasks(fake(tables), 'not-a-session'), /Invalid session identity/)
  assert.deepEqual(await readSessionTasks(fake({}), S), { tasks: [], capped: false }, 'a session with no task reads as an empty list')
})

test('the board pages «Готово» (0.3.14): the finished tasks are read up to the limit asked, 20 by default, and capped there', async () => {
  const { readTaskBoard } = await import(path.resolve(import.meta.dirname, '../src/main/workRead.ts'))
  const calls = []
  const done = (n) => Array.from({ length: n }, (_, i) => ({ id: 'd' + i, project_id: 'p1', title: 'D', brief_what: null, status: 'done', moved_at: `2026-10-${String(10 + (i % 15)).padStart(2, '0')}T00:00:00Z` }))
  const fake = (doneRows) => ({
    select: (table) => {
      const call = { table, eq: [], limit: null }
      calls.push(call)
      const chain = {
        is: () => chain, in: () => chain, not: () => chain, order: () => chain,
        eq: (k, v) => { call.eq.push([k, v]); return chain },
        limit: (n) => { call.limit = n; return chain },
        then: (ok) => ok({ data: table === 'projects' ? [{ id: 'p1', name: 'Fabric' }] : table === 'project_tasks' && call.eq.some(([k, v]) => k === 'status' && v === 'done') ? doneRows.slice(0, call.limit ?? undefined) : [], error: null })
      }
      return chain
    },
    selectIn: async () => ({ rows: [], failed: null })
  })
  const at = { now: Date.parse('2026-10-26T12:00:00Z'), session: () => null, sessions: [] }
  const doneCall = () => calls.find((c) => c.table === 'project_tasks' && c.eq.some(([k, v]) => k === 'status' && v === 'done'))
  const first = await readTaskBoard(fake(done(30)), at)
  assert.equal(doneCall().limit, 20)
  assert.equal(first.columns.find((c) => c.stage === 'done').cards.length, 20)
  assert.equal(first.columns.find((c) => c.stage === 'done').capped, true)
  calls.length = 0
  const more = await readTaskBoard(fake(done(30)), { ...at, doneLimit: 40 })
  assert.equal(doneCall().limit, 40)
  assert.equal(more.columns.find((c) => c.stage === 'done').cards.length, 30)
  assert.equal(more.columns.find((c) => c.stage === 'done').capped, false)
})
