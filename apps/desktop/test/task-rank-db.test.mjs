// Migration 131 (schema 104, ADR-0208): the owner's rank and an agent's proposed place, on an owned cluster.
// The projector takes a rank and a decline from a person only, a proposal from anyone else, and never raises on a
// payload the journal accepted; a rebuild reproduces the same columns from the journal.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-task-rank-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql = input => execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
assert.equal(sql("select count(*) from supabase_migrations.schema_migrations where version='20261121000131'"), '1')
const uuid = n => `a3000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = uuid(1), P = uuid(2); let n = 10
const person = `'{"kind":"person","id":"operator"}'`, agent = `'{"kind":"agent","id":"session-1"}'`, system = `'{"kind":"system","id":"fixture"}'`
const append = (type, by, payload) => sql(`select append_event('${E}','${type}',${by},'${JSON.stringify(payload)}','1','${P}')`)
append('project.created@1', system, { id: P, name: 'Atlas' })
const task = () => { const t = uuid(n++); append('task.created@1', system, { id: t, title: 'Work' }); return t }
const state = t => sql(`select coalesce(rank::text,'-')||'|'||coalesce(rank_proposal->>'why','-')||'|'||coalesce(rank_proposal->>'after_task_id','-')||'|'||coalesce(rank_proposal->>'by_kind','-') from project_tasks where id='${t}'`)
let count = 0; const test = (name, fn) => { fn(); console.log('PASS ' + name); count++ }

test('the three event types are registered as projecting', () => {
  assert.equal(sql(`select string_agg(type||':'||projects, ',' order by type) from event_types where type like 'task.rank%'`),
    'task.rank.declined@1:true,task.rank.proposed@1:true,task.ranked@1:true')
})

test("a person's task.ranked@1 sets the rank, fractions included; an agent's changes nothing", () => {
  const t = task()
  assert.equal(state(t), '-|-|-|-')
  append('task.ranked@1', person, { task_id: t, rank: 1.5 })
  assert.equal(state(t), '1.5|-|-|-')
  append('task.ranked@1', agent, { task_id: t, rank: 99 })
  append('task.ranked@1', system, { task_id: t, rank: 98 })
  assert.equal(state(t), '1.5|-|-|-', 'only the owner orders his queue')
  append('task.ranked@1', person, { task_id: t, rank: -3 })
  assert.equal(state(t), '-3|-|-|-')
})

test("an agent's proposal is kept with its why and anchor, and a person never proposes", () => {
  const t = task(), a = task()
  append('task.rank.proposed@1', agent, { task_id: t, after_task_id: a, why: 'the release waits for it' })
  assert.equal(state(t), `-|the release waits for it|${a}|agent`)
  append('task.rank.proposed@1', agent, { task_id: t, after_task_id: null, why: 'first, in fact' })
  assert.equal(state(t), '-|first, in fact|-|agent', 'a new proposal replaces the old one')
  const u = task()
  append('task.rank.proposed@1', person, { task_id: u, after_task_id: null, why: 'not a proposal' })
  assert.equal(state(u), '-|-|-|-')
})

test('a rank from the person clears the proposal; so does a decline, which leaves the rank alone', () => {
  const t = task()
  append('task.rank.proposed@1', agent, { task_id: t, after_task_id: null, why: 'put it first' })
  append('task.ranked@1', person, { task_id: t, rank: 0 })
  assert.equal(state(t), '0|-|-|-')
  append('task.rank.proposed@1', agent, { task_id: t, after_task_id: null, why: 'again' })
  append('task.rank.declined@1', agent, { task_id: t })
  assert.equal(state(t), '0|again|-|agent', 'an agent cannot decline for the owner')
  append('task.rank.declined@1', person, { task_id: t })
  assert.equal(state(t), '0|-|-|-')
})

test('a payload the journal accepted never makes the projector raise', () => {
  const t = task()
  append('task.ranked@1', person, { task_id: t, rank: 'high' })
  append('task.ranked@1', person, { task_id: 'not-a-uuid', rank: 1 })
  append('task.ranked@1', person, { rank: 1 })
  append('task.rank.proposed@1', agent, { task_id: t, after_task_id: 'nope', why: 'x' })
  append('task.ranked@1', person, { task_id: uuid(999999), rank: 1 })
  assert.equal(state(t), '-|-|-|-')
})

test('order inside a goal is untouched: task.prioritised@1 and rank do not write each other', () => {
  const t = task(), g = uuid(n++)
  append('goal.defined@1', person, { id: g, title: 'Ship' })
  append('task.ranked@1', person, { task_id: t, rank: 4 })
  append('task.prioritised@1', person, { task_id: t, goal_id: g, position: 2 })
  assert.equal(sql(`select rank::text||'|'||position||'|'||goal_id from project_tasks where id='${t}'`), `4|2|${g}`)
})

test('a rebuild of the projections reproduces the ranks and the open proposals from the journal', () => {
  const before = sql(`select string_agg(id||':'||coalesce(rank::text,'-')||':'||coalesce(rank_proposal->>'why','-'), ',' order by id) from project_tasks where estate_id='${E}'`)
  sql(`select rebuild_estate_projections('${E}')`)
  const after = sql(`select string_agg(id||':'||coalesce(rank::text,'-')||':'||coalesce(rank_proposal->>'why','-'), ',' order by id) from project_tasks where estate_id='${E}'`)
  assert.equal(after, before)
  assert.match(after, /:0:-/)
})

test('schema 104', () => {
  assert.equal(sql('select schema_version()'), '104')
})
console.log(`${count} task-rank database checks passed`)
