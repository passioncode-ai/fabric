// A project's profile (Fabric 0.3.12 wave 2, slice S1; docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md,
// W2-1 to W2-4) on the fully migrated chain: `project.profiled@1` goes in through append_event, as the hub's
// fabric_project_profile writes it, and the projection is read back.
// To WATCH this suite fail, run the runner with FABRIC_SKIP_MIGRATION=20261023000123_project_profile.sql.
// #region project-profile — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-project-profile-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const psqlArgs = [url, '-X', '-q', '-t', '-A', '-F', '|', '-v', 'ON_ERROR_STOP=1']
const sql = input => execFileSync('psql', psqlArgs, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
let count = 0; const failed = []
const test = async (name, fn) => {
  try { await fn(); console.log('PASS ' + name); count++ } catch (e) { failed.push(name); console.log(`FAIL ${name}\n  ${String(e.message).split('\n')[0]}${e.stderr ? '\n  ' + String(e.stderr).trim().split('\n')[0] : ''}`) }
}
const id = n => `96000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = id(1), P = id(11), Q = id(12)
const lit = v => `'${String(v).replace(/'/g, "''")}'`
const j = v => `${lit(JSON.stringify(v))}::jsonb`
const agent = { kind: 'agent', id: 'onboarding-session' }
const append = (type, payload, project = null, actor = { kind: 'system', id: 'profile-probe' }) =>
  sql(`set role service_role; select seq from append_event('${E}','${type}',${j(actor)},${j(payload)},'1',${project ? `'${project}'` : 'null'})`)
const profile = (payload, project = P) => append('project.profiled@1', payload, project, agent)
const row = (project = P) => JSON.parse(sql(`select row_to_json(x) from (select goal, summary, business, plan, profiled_by from projects where id='${project}') x`))
const relations = (project = P) => sql(`select kind||':'||target||':'||coalesce(note,'') from project_relations where project_id='${project}' order by kind, target`).split('\n').filter(Boolean)

append('estate.created@1', { name: 'profile estate', owner_person_id: id(91) })
append('project.created@1', { id: P, name: 'onboarded' }, P)
append('project.created@1', { id: Q, name: 'untouched' }, Q)

await test('a profile fills the project\'s goal, summary, business and plan, and names who recorded it', () => {
  profile({ goal: 'Help the operator steer projects', summary: 'The CEO agent', business: 'PassionCode', plan: { done: ['0.3.11'], next: ['0.3.12'] } })
  assert.deepEqual(row(), { goal: 'Help the operator steer projects', summary: 'The CEO agent', business: 'PassionCode', plan: { done: ['0.3.11'], next: ['0.3.12'] }, profiled_by: 'onboarding-session' })
  assert.deepEqual(row(Q), { goal: null, summary: null, business: null, plan: null, profiled_by: null })
})

await test('a field the event does not name is left as it was; an empty one clears it', () => {
  profile({ summary: 'The CEO agent and its desktop app' })
  assert.equal(row().goal, 'Help the operator steer projects')
  assert.equal(row().summary, 'The CEO agent and its desktop app')
  profile({ business: '  ' })
  assert.equal(row().business, null)
  assert.equal(row().goal, 'Help the operator steer projects')
})

await test('relations replace the whole list; a malformed relation is skipped, never stored', () => {
  profile({ relations: [{ kind: 'depends-on', target: 'fabric-agent-contract', note: 'the contract it adopts' }, { kind: 'talks-to', target: 'fabric-workspace' }] })
  assert.deepEqual(relations(), ['depends-on:fabric-agent-contract:the contract it adopts', 'talks-to:fabric-workspace:'])
  profile({ relations: [{ kind: 'used-by', target: 'switchboard' }, { kind: 'friend-of', target: 'x' }, { kind: 'other', target: '' }, 'nonsense'] })
  assert.deepEqual(relations(), ['used-by:switchboard:'])
  profile({ goal: 'kept' })
  assert.deepEqual(relations(), ['used-by:switchboard:'], 'a profile that names no relations leaves them')
})

await test('a rebuild from the journal gives the same profile', () => {
  const before = JSON.stringify([row(), relations()])
  sql(`delete from project_relations; update projects set goal=null, summary=null, business=null, plan=null, profiled_at=null, profiled_by=null; select rebuild_estate_projections('${E}')`)
  assert.equal(JSON.stringify([row(), relations()]), before)
})

await test('the event type is declared, the projector is no door, and the relations are read by members only', () => {
  assert.equal(sql(`select count(*) from event_types where type = 'project.profiled@1'`), '1')
  for (const role of ['anon', 'authenticated', 'service_role'])
    assert.equal(sql(`select has_function_privilege('${role}', 'apply_project_profile(journal)', 'execute')`), 'f', role)
  assert.equal(sql(`select relrowsecurity from pg_class where relname = 'project_relations'`), 't', 'rls')
  assert.equal(sql(`select has_table_privilege('authenticated', 'project_relations', 'select')`), 't')
  assert.equal(sql(`select has_table_privilege('authenticated', 'project_relations', 'insert')`), 'f', 'insert')
  assert.equal(sql(`select schema_version()`), '96', 'schema')
})

console.log(`${count} passed, ${failed.length} failed`)
if (failed.length) { console.log('FAILED: ' + failed.join('; ')); process.exit(1) }
// #endregion project-profile
