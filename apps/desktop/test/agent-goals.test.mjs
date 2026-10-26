// An agent's goal (the operator's second review, 2026-10-26, docs/ux/2026-10-26-simple-fabric-v2.md §4.2, R-3): the root
// of its current task's decomposition, walked up `task_links` `spawned` (bounded at 10 hops, cycle-safe); a goal the root
// was spawned from leads; the current task itself when it has no parent. A failed read leaves the goal unknown.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { withGoals } = await import(path.resolve(import.meta.dirname, '../src/main/agentGoals.ts'))

const live = (sessionId, taskId) => ({ sessionId, projectId: 'p1', projectName: 'Fabric', agent: 'claude-code', console: true, startedAt: 'a', lastSignAt: null, stale: false, doing: null,
  task: taskId ? { id: taskId, projectId: 'p1', summary: `task ${taskId}` } : null })
const view = (agents) => ({ live: agents, inWork: [], review: [], done: [], projects: [], readAt: 'r' })

function fake({ links = [], tasks = [], goals = [], fail = {} } = {}) {
  const calls = []
  return {
    calls,
    selectIn: async (table, columns, key, values) => {
      calls.push({ table, key, values: [...values] })
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
