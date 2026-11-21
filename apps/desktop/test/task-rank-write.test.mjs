// The owner's acts on the queue's order and the readers that follow it (ADR-0208). No database: the store is a fake.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const at = (f) => path.resolve(import.meta.dirname, f)
const { reorderTask, decideRankProposal, RankRefusal } = await import(at('../src/main/taskRankWrite.ts'))
const { composeQueueOrder, readQueueOrder, ORDER_TASKS } = await import(at('../src/main/taskOrderRead.ts'))
const { backlogBrief } = await import(at('../src/shared/backlogBrief.ts'))
const { composeTaskBoard } = await import(at('../src/shared/taskBoard.ts'))

const world = (tasks) => {
  const events = []
  const rows = new Map(tasks.map((t) => [t.id, { projectId: 'p', status: 'backlog', rank: null, proposal: null, ...t }]))
  return {
    events, rows,
    deps: {
      readTask: async (id) => rows.get(id) ?? null,
      readQueue: async (projectId) => [...rows.values()].filter((t) => t.projectId === projectId && t.status === 'backlog')
        .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)).map((t) => ({ id: t.id, rank: t.rank })),
      append: async (projectId, type, payload) => {
        events.push({ projectId, type, payload })
        const row = rows.get(payload.task_id)
        if (type === 'task.ranked@1') { row.rank = payload.rank; row.proposal = null } else row.proposal = null
      }
    }
  }
}
const refused = async (run, code) => assert.rejects(run, (e) => e instanceof RankRefusal && e.code === code)

test('a move between placed tasks writes one task.ranked@1 for the project', async () => {
  const w = world([{ id: 'a', rank: 1 }, { id: 'b', rank: 2 }, { id: 'c', rank: 3 }])
  assert.deepEqual(await reorderTask(w.deps, 'c', 'a'), { written: 1 })
  assert.deepEqual(w.events, [{ projectId: 'p', type: 'task.ranked@1', payload: { task_id: 'c', rank: 1.5 } }])
})

test('a task in work, a task of another project and a missing task are refused, and nothing is written', async () => {
  const w = world([{ id: 'a' }, { id: 'run', status: 'running' }, { id: 'far', projectId: 'q' }])
  await refused(reorderTask(w.deps, 'run', null), 'not_queued')
  await refused(reorderTask(w.deps, 'a', 'far'), 'other_project')
  await refused(reorderTask(w.deps, 'nope', null), 'no_task')
  await refused(reorderTask(w.deps, 'a', 'run'), 'not_in_queue')
  assert.equal(w.events.length, 0)
})

test('accepting a proposal places the task where the agent proposed and clears the proposal', async () => {
  const w = world([{ id: 'a', rank: 1 }, { id: 'b', rank: 2 }, { id: 'c', proposal: { afterTaskId: null } }])
  assert.deepEqual(await decideRankProposal(w.deps, 'c', true), { accepted: true, written: 1 })
  assert.equal(w.rows.get('c').rank, 0)
  assert.equal(w.rows.get('c').proposal, null)
})

test('accepting a proposal for a task already in that place still clears it', async () => {
  const w = world([{ id: 'a', rank: 1 }, { id: 'b', rank: 2, proposal: { afterTaskId: 'a' } }])
  assert.deepEqual(await decideRankProposal(w.deps, 'b', true), { accepted: true, written: 1 })
  assert.deepEqual(w.events, [{ projectId: 'p', type: 'task.ranked@1', payload: { task_id: 'b', rank: 2 } }])
  assert.equal(w.rows.get('b').proposal, null)
})

test('declining writes task.rank.declined@1 and no rank', async () => {
  const w = world([{ id: 'a', rank: 1 }, { id: 'b', proposal: { afterTaskId: null } }])
  assert.deepEqual(await decideRankProposal(w.deps, 'b', false), { accepted: false, written: 0 })
  assert.deepEqual(w.events.map((e) => e.type), ['task.rank.declined@1'])
  assert.equal(w.rows.get('b').rank, null)
})

test('a proposal whose anchor left the queue is said as stale; a task without one has nothing to decide', async () => {
  const w = world([{ id: 'a', status: 'done' }, { id: 'b', proposal: { afterTaskId: 'a' } }, { id: 'c' }])
  await refused(decideRankProposal(w.deps, 'b', true), 'proposal_stale')
  await refused(decideRankProposal(w.deps, 'c', true), 'no_proposal')
  assert.equal(w.events.length, 0)
})

// ── the order as read ────────────────────────────────────────────────────────────────────────────────────────────
const row = (id, over = {}) => ({ id, project_id: 'p', status: 'backlog', rank: null, seq: Number(id.replace(/\D/g, '')) || 1, ...over })

test('each project has its own places, and a prerequisite in another project still blocks', () => {
  const o = composeQueueOrder(
    [row('t1'), row('t2'), row('t3', { project_id: 'q' }), row('t4', { project_id: 'q', status: 'running' })],
    [{ task_id: 't3', rel: 'blocks', target_kind: 'task', target_id: 't1' }]
  )
  assert.deepEqual(o.byProject.get('p').map((x) => [x.id, x.place]), [['t2', 1], ['t1', 2]])
  assert.deepEqual(o.byProject.get('q').map((x) => [x.id, x.place]), [['t3', 1]])
  assert.equal(o.byTask.get('t1').ready, false)
})

test('a rank the database answers as text still orders as a number', () => {
  const o = composeQueueOrder([row('t1', { rank: '10' }), row('t2', { rank: '9' })], [])
  assert.deepEqual(o.byProject.get('p').map((x) => x.id), ['t2', 't1'])
})

/** A store that answers fixed rows per table; `fail` names a table whose read errors. */
const store = ({ tasks = [], links = [], fail = null, extra = [] } = {}) => {
  const asked = []
  const query = (table, rows) => {
    const q = { eq: () => q, in: () => q, not: () => q, order: () => q, limit: () => q,
      then: (ok, bad) => Promise.resolve(fail === table ? { data: null, error: { message: 'refused' } } : { data: rows, error: null }).then(ok, bad) }
    return q
  }
  return {
    asked,
    select: (table) => { asked.push(table); return query(table, table === 'project_tasks' ? tasks : links) },
    selectIn: async (table, _c, _k, ids) => { asked.push(`in:${ids.join(',')}`); return { rows: extra, failed: null } }
  }
}

test('readQueueOrder throws on a failed read, so no reader shows a guessed order', async () => {
  await assert.rejects(readQueueOrder(store({ fail: 'project_tasks' })), /open tasks could not be read: refused/)
  await assert.rejects(readQueueOrder(store({ fail: 'task_links' })), /task links could not be read: refused/)
})

test('a one-project read asks for a linked task of another project by id, and names a read at its bound', async () => {
  const s = store({
    tasks: [row('t1')], extra: [row('t9', { project_id: 'q' })],
    links: [{ task_id: 't9', rel: 'blocks', target_kind: 'task', target_id: 't1' }]
  })
  const o = await readQueueOrder(s, { projectId: 'p' })
  assert.deepEqual(s.asked, ['project_tasks', 'task_links', 'in:t9'])
  assert.equal(o.byTask.get('t1').ready, false)
  assert.equal(o.byProject.has('q'), false, 'the other project is not answered by a one-project read')
  assert.deepEqual(o.capped, [])
  const full = await readQueueOrder(store({ tasks: Array.from({ length: ORDER_TASKS }, (_, i) => row(`t${i + 1}`)) }))
  assert.deepEqual(full.capped, ['tasks'])
})

// ── the backlog routine's brief ──────────────────────────────────────────────────────────────────────────────────
const item = (id, position = null) => ({ id, title: `Task ${id}`, instruction: id, position, goalId: null })

test("the brief follows the board's order and names a task that waits", () => {
  const places = new Map([['b', { place: 1, waitsFor: [] }], ['a', { place: 2, waitsFor: ['b'] }]])
  const brief = backlogBrief([item('a', 1), item('b', 2), item('c')], places)
  const lines = brief.split('\n').filter((l) => /^\d\./.test(l))
  assert.deepEqual(lines, ['1. Task b', '2. Task a (waits for 1 other open task: not startable yet)', '3. Task c'])
  assert.match(brief, /board's order/)
})

test('a night the order could not be read falls back to the older order and says so; no order at all is the old brief', () => {
  const failed = backlogBrief([item('a', 2), item('b', 1)], null)
  assert.match(failed, /could not be read/)
  assert.deepEqual(failed.split('\n').filter((l) => /^\d\./.test(l)), ['1. Task b', '2. Task a'])
  assert.doesNotMatch(backlogBrief([item('a')]), /could not be read|board's order/)
  assert.equal(backlogBrief([], new Map()), null, 'an empty backlog still starts no session')
})

// ── the kanban's queue ───────────────────────────────────────────────────────────────────────────────────────────
const home = { inWork: [], review: [], done: [], readAt: 'now' }
const queued = (id, over = {}) => ({ id, project_id: 'p', title: id, brief_what: null, status: 'backlog', ...over })
const placed = (place, over = {}) => ({ place, ready: true, waitsFor: [], unblocks: 0, critical: false, rank: null, inherited: false, ...over })

test("the queue column is in the board's order, each card with why and with an agent's proposal", () => {
  const v = composeTaskBoard({
    home, projects: [{ id: 'p', name: 'P' }], queuedLimit: 100,
    queued: [queued('new'), queued('old', { rank_proposal: { after_task_id: null, why: 'it unblocks two' } }), queued('lost')],
    order: { byTask: new Map([['old', placed(1, { rank: 1, critical: true, unblocks: 2 })], ['new', placed(2, { waitsFor: ['old'], ready: false })]]) }
  })
  const cards = v.columns[0].cards
  assert.deepEqual(cards.map((c) => c.taskId), ['old', 'new', 'lost'])
  assert.deepEqual(cards[0].order, { place: 1, ranked: true, inherited: false, waits: 0, unblocks: 2, critical: true })
  assert.deepEqual(cards[0].proposal, { afterTaskId: null, why: 'it unblocks two' })
  assert.equal(cards[1].order.waits, 1)
  assert.equal(cards[2].order, undefined, 'a task the order did not reach says nothing about its place')
  assert.equal(v.orderUnread, undefined)
})

test('an order that could not be read leaves the queue as it was read and says so', () => {
  const v = composeTaskBoard({ home, projects: [{ id: 'p', name: 'P' }], queuedLimit: 100, queued: [queued('b'), queued('a')], order: { unread: 'refused' } })
  assert.deepEqual(v.columns[0].cards.map((c) => c.taskId), ['b', 'a'])
  assert.equal(v.orderUnread, 'refused')
})
