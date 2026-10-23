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
