// An agent's goal (the operator's second review, 2026-10-26, docs/ux/2026-10-26-simple-fabric-v2.md §4.2, R-3): the root
// of its current task's decomposition, walked up `task_links` `spawned` (bounded at 10 hops, cycle-safe); a goal the root
// was spawned from leads; the current task itself when it has no parent. A failed read leaves the goal unknown.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const { withGoals } = await import(path.resolve(import.meta.dirname, '../src/main/agentGoals.ts'))

const live = (sessionId, taskId) => ({ sessionId, projectId: 'p1', projectName: 'Fabric', agent: 'claude-code', console: true, startedAt: 'a', lastSignAt: null, stale: false, doing: null,
  task: taskId ? { id: taskId, projectId: 'p1', summary: `task ${taskId}` } : null })
const view = (agents) => ({ live: agents, inWork: [], review: [], done: [], projects: [], readAt: 'r' })

function fake({ links = [], tasks = [], goals = [], fail = {} } = {}) {
  const calls = []
  return {
    calls,
    selectIn: async (table, columns, key, values, _chunk, _signal, eq = []) => {
      calls.push({ table, key, values: [...values], eq })
      if (fail[table]) return { rows: [], failed: fail[table] }
      const rows = table === 'task_links' ? links : table === 'project_tasks' ? tasks : table === 'goals' ? goals : []
      return { rows: rows.filter((r) => values.includes(r[key])), failed: null }
    }
  }
}

test('the goal is the root of the spawned links, with its brief and whether the person set it', async () => {
  const store = fake({
    links: [
      { task_id: 't3', rel: 'spawned', target_kind: 'task', target_id: 't2' },
      { task_id: 't2', rel: 'spawned', target_kind: 'task', target_id: 't1' },
      { task_id: 't3', rel: 'follows', target_kind: 'task', target_id: 't9' }
    ],
    tasks: [{ id: 't1', project_id: 'p1', title: 'Ship 0.3.14', brief_what: 'The release the operator asked for', goal_id: null, origin_kind: 'person' }]
  })
  const out = await withGoals(view([live('s1', 't3')]), store)
  assert.deepEqual(out.live[0].goal, { taskId: 't1', projectId: 'p1', text: 'Ship 0.3.14', what: 'The release the operator asked for', byPerson: true, isTask: false })
})

test('a task with no parent is its own goal; an agent with no task has none named', async () => {
  const store = fake({ tasks: [{ id: 't5', project_id: 'p1', title: null, brief_what: 'Fix the board', goal_id: null, origin_kind: 'observation' }] })
  const out = await withGoals(view([live('s1', 't5'), live('s2', null)]), store)
  assert.deepEqual(out.live[0].goal, { taskId: 't5', projectId: 'p1', text: 'Fix the board', what: 'Fix the board', byPerson: false, isTask: true })
  assert.equal(out.live[1].goal, null)
})

test('a goal the root was spawned from, or the root\'s goal_id, leads with the goal\'s title', async () => {
  const store = fake({
    links: [{ task_id: 't2', rel: 'spawned', target_kind: 'goal', target_id: 'g1' }],
    tasks: [{ id: 't2', project_id: 'p1', title: 'Write the plan', brief_what: null, goal_id: null, origin_kind: 'task' }],
    goals: [{ id: 'g1', title: 'Fabric is usable every day' }]
  })
  const out = await withGoals(view([live('s1', 't2')]), store)
  assert.equal(out.live[0].goal.text, 'Fabric is usable every day')
  assert.equal(out.live[0].goal.taskId, 't2')
})

// UX-22 (the 0.3.14 review, iteration 3): a goal the person defined in Plan (the goals table) stays the agent's goal
// when the agent works a task filed under it, by a `spawned` link to the goal or by the task's goal_id: the task is the
// step, never its own goal, so the screens show «Цель: <goal title>».
test('UX-22: a task an agent filed under a Plan goal is the step, the goal is named (not its own root)', async () => {
  const byLink = fake({
    links: [{ task_id: 't9', rel: 'spawned', target_kind: 'goal', target_id: 'g1' }],
    tasks: [{ id: 't9', project_id: 'p1', title: 'Fix the counter', brief_what: null, goal_id: 'g1', origin_kind: 'agent' }],
    goals: [{ id: 'g1', title: 'Ship 0.3.14 by Friday' }]
  })
  const a = await withGoals(view([live('s1', 't9')]), byLink)
  assert.deepEqual(a.live[0].goal, { taskId: 't9', projectId: 'p1', text: 'Ship 0.3.14 by Friday', what: null, byPerson: false, isTask: false })
  const byGoalId = fake({
    tasks: [{ id: 't9', project_id: 'p1', title: 'Fix the counter', brief_what: null, goal_id: 'g1', origin_kind: 'agent' }],
    goals: [{ id: 'g1', title: 'Ship 0.3.14 by Friday' }]
  })
  const b = await withGoals(view([live('s1', 't9')]), byGoalId)
  assert.equal(b.live[0].goal.text, 'Ship 0.3.14 by Friday')
  assert.equal(b.live[0].goal.isTask, false)
})

test('the walk stops at ten hops and at a cycle, never looping', async () => {
  const links = Array.from({ length: 15 }, (_, i) => ({ task_id: `t${i}`, rel: 'spawned', target_kind: 'task', target_id: `t${i + 1}` }))
  links.push({ task_id: 'c1', rel: 'spawned', target_kind: 'task', target_id: 'c2' }, { task_id: 'c2', rel: 'spawned', target_kind: 'task', target_id: 'c1' })
  const tasks = [...Array.from({ length: 16 }, (_, i) => ({ id: `t${i}`, project_id: 'p1', title: `T${i}`, brief_what: null, goal_id: null, origin_kind: null })),
    { id: 'c1', project_id: 'p1', title: 'C1', brief_what: null, goal_id: null, origin_kind: null }, { id: 'c2', project_id: 'p1', title: 'C2', brief_what: null, goal_id: null, origin_kind: null }]
  const store = fake({ links, tasks })
  const out = await withGoals(view([live('s1', 't0'), live('s2', 'c1')]), store)
  assert.equal(out.live[0].goal.text, 'T10')
  assert.ok(['C1', 'C2'].includes(out.live[1].goal.text))
  assert.ok(store.calls.filter((c) => c.table === 'task_links').length <= 10)
})

test('a failed read leaves every goal unknown (absent), never «no goal»', async () => {
  const out = await withGoals(view([live('s1', 't1')]), fake({ fail: { task_links: 'database away' } }))
  assert.equal('goal' in out.live[0], false)
  assert.match(out.goalsUnread, /database away/)
})

test('DA-3: the walk asks only for spawned links, so other kinds never fill the read', async () => {
  const store = fake({ links: [{ task_id: 't2', rel: 'spawned', target_kind: 'task', target_id: 't1' }], tasks: [{ id: 't1', project_id: 'p1', title: 'Root' }] })
  await withGoals(view([live('s1', 't2')]), store)
  const linkReads = store.calls.filter((c) => c.table === 'task_links')
  assert.ok(linkReads.length >= 1)
  for (const c of linkReads) assert.deepEqual(c.eq, [['rel', 'spawned']])
})

// ER-18: every screen judges an agent's status from the same inputs: its newest heartbeat rides on the home's reading.
test('withHeartbeats puts each live agent\'s newest heartbeat on the reading; a failed read leaves them absent', async () => {
  const { withHeartbeats } = await import(path.resolve(import.meta.dirname, '../src/main/agentHeartbeats.ts'))
  const asked = []
  const store = { selectIn: async (table, columns, key, values) => { asked.push([table, key, values]); return { rows: [{ session_id: 's1', phase: 'waiting', last_received_at: '2026-10-26T12:00:00Z', waiting_kind: 'question' }], failed: null } } }
  const out = await withHeartbeats(view([live('s1', 't1'), live('s2', null)]), store)
  assert.deepEqual(asked, [['session_heartbeats', 'session_id', ['s1', 's2']]])
  assert.deepEqual(out.live[0].heartbeat, { phase: 'waiting', at: '2026-10-26T12:00:00Z', waitingOn: 'question' })
  assert.equal(out.live[1].heartbeat, undefined)
  const failed = await withHeartbeats(view([live('s1', 't1')]), { selectIn: async () => ({ rows: [], failed: 'refused' }) })
  assert.equal(failed.live[0].heartbeat, undefined, 'the status falls back to what Fabric observes')
})

// The link this walk follows is written by `fabric_task_create` (main/agentSurface.ts). Through the real surface and
// an MCP client, over a database held in memory (no stack):
//   PL-13  (0.3.14 review, iteration 3): an enrolled session (no launch task) holding exactly one live claim files a
//          piece spawned from the claimed task: the answer says `spawned_from` and `chained`, and `link_tasks` is asked
//          for the piece spawned from that task; with a second claim nothing is linked and `spawned_from_why` says why.
//   DA-7   the chain bound's proposal answer carries `spawned_from: null` and `spawned_from_why` like every other answer.
//   ER-24, DA-8  a chain read that fails files the task without the spawned link and says why, never judging the
//          depth from a read that did not happen.
const { AgentSurface } = await import(path.resolve(import.meta.dirname, '../src/main/agentSurface.ts'))

/** A database held in memory: rows per table, filtered by the `eq` and `is` the code asks for. */
function memoryDb(tables, { fail = {} } = {}) {
  const rpcs = []
  const from = (table) => {
    const filters = []
    const run = () => {
      if (fail[table]) return { data: null, error: { message: fail[table] } }
      const rows = (tables[table] ?? []).filter((r) => filters.every(([col, v]) => !(col in r) || r[col] === v))
      return { data: rows, error: null }
    }
    const chain = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (resolve) => resolve(run())
        if (prop === 'eq' || prop === 'is') return (col, v) => { filters.push([col, v]); return chain }
        if (prop === 'maybeSingle' || prop === 'single') return async () => { const r = run(); return { data: r.data?.[0] ?? null, error: r.error } }
        return () => chain
      }
    })
    return chain
  }
  return {
    rpcs,
    from,
    rpc: async (name, args) => { rpcs.push({ name, args }); return name === 'link_tasks' ? { data: { linked: true }, error: null } : { data: null, error: null } }
  }
}

async function surfaceWith(db) {
  const events = []
  const journal = { append: async (e) => { events.push(e); return { seq: events.length, id: String(events.length) } } }
  const surface = new AgentSurface({
    db, journal, estateId: 'e',
    ptys: () => ({ list: () => [], get: () => null }),
    work: { resolveSource: async () => ({ ok: false, part: 'repository', reason: 'none' }), leaseRefs: async () => null, endSession: () => {} }
  })
  await surface.start()
  return { surface, events }
}
async function enrolled(t, db) {
  const { surface, events } = await surfaceWith(db)
  t.after(() => surface.stop())
  const scope = surface.mint('p', 's-enrolled', null, { cameIn: 'enrolled', agent: 'claude-code', runtimeSessionId: 'rt-1' })
  const client = new Client({ name: 'probe', version: '0.0.0' })
  await client.connect(new StreamableHTTPClientTransport(new URL(surface.endpoint), { requestInit: { headers: { Authorization: 'Bearer ' + scope.token } } }))
  t.after(() => client.close())
  const create = async (title) => JSON.parse((await client.callTool({ name: 'fabric_task_create', arguments: { title, origin: { kind: 'observation', ref: 'probe' } } })).content[0].text)
  return { create, events }
}
const claim = (work) => ({ estate_id: 'e', project_id: 'p', owner_session: 's-enrolled', work_id: work, released_at: null })
const spawned = (task, target) => ({ estate_id: 'e', project_id: 'p', rel: 'spawned', target_kind: 'task', task_id: task, target_id: target })

test('PL-13: an enrolled session with one live claim files a piece spawned from the claimed task', async (t) => {
  const db = memoryDb({ work_claims: [claim('t-request')], task_links: [] })
  const { create } = await enrolled(t, db)
  const made = await create('the counter is off by one')
  assert.equal(made.created, true)
  assert.equal(made.spawned_from, 't-request')
  assert.equal(made.chained_to, 't-request')
  assert.equal(made.chained, true)
  const link = db.rpcs.find((r) => r.name === 'link_tasks')
  assert.deepEqual([link.args.p_task_id, link.args.p_rel, link.args.p_target_id], [made.id, 'spawned', 't-request'])
})

test('PL-13: with a second live claim nothing is linked and spawned_from_why says why', async (t) => {
  const db = memoryDb({ work_claims: [claim('t-a'), claim('t-b')], task_links: [] })
  const { create } = await enrolled(t, db)
  const made = await create('found while on two tasks')
  assert.equal(made.created, true)
  assert.equal(made.spawned_from, null)
  assert.match(made.spawned_from_why, /2 live claims/)
  assert.equal(db.rpcs.some((r) => r.name === 'link_tasks'), false)
})

test('DA-7: the fourth hand-off in one chain is a proposal, and its answer names spawned_from and why', async (t) => {
  const db = memoryDb({ work_claims: [claim('c3')], task_links: [spawned('c3', 'c2'), spawned('c2', 'c1'), spawned('c1', 'req')] })
  const { create, events } = await enrolled(t, db)
  const made = await create('one more hand-off')
  assert.equal(made.created, false)
  assert.equal(made.proposed, true)
  assert.equal(made.depth, 4)
  assert.equal(made.spawned_from, null)
  assert.match(made.spawned_from_why, /hand-off 4 in one chain/)
  assert.equal(events.some((e) => e.type === 'task.created@1'), false)
})

test('ER-24, DA-8: a chain read that fails files the task without the spawned link and says why', async (t) => {
  const db = memoryDb({ work_claims: [claim('c3')] }, { fail: { task_links: 'deadline' } })
  const { create, events } = await enrolled(t, db)
  const made = await create('filed while the links cannot be read')
  assert.equal(made.created, true)
  assert.equal(made.spawned_from, null)
  assert.match(made.spawned_from_why, /could not be read \(deadline\).*without its spawned link/)
  assert.equal(made.chained_to, undefined)
  assert.equal(db.rpcs.some((r) => r.name === 'link_tasks'), false)
  assert.equal(events.some((e) => e.type === 'task.created@1'), true)
})

