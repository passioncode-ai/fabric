// An id names one estate's row (migration 70 · release review 2026-10-03, data finding 1).
//
// The review measured it on an owned cluster: estate B appended `project.created@1`
// with estate A's project id, the append was ACCEPTED, and A's project came back
// renamed with no folder. `import_declared_snapshot` into an empty estate C said
// COMMITTED while creating nothing in C and renaming A's project. `memory_facts`
// had the same shape. This drives the SQL contract on an owned cluster with the
// whole chain applied: the door refuses, an import is all-or-nothing, a replay of
// an older journal that already holds such an event leaves the owner's row alone,
// and a same-estate repeat keeps the project's folder (data finding 6).
//
// Run through `run-estate-identity-db.mjs`, which owns the cluster. To WATCH it
// fail, run that with FABRIC_SKIP_MIGRATION=20261003000070_estate_owned_identity.sql.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-estate-identity-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)

const sql = (input) =>
  execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const refusal = (q) => {
  try { sql(q); return null } catch (e) { return String(e.stderr ?? e.message) }
}
const uuid = (n) => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const A = uuid(1), B = uuid(2), C = uuid(3)
const P = uuid(10), Q = uuid(11), REPO = uuid(12), FACT = uuid(13), TASK = uuid(14), SESSION = uuid(15), STAGE_SESSION = uuid(16)
const system = `'{"kind":"system","id":"estate-identity-probe"}'`
const append = (estate, type, payload, project = null) =>
  `select append_event('${estate}','${type}',${system},'${JSON.stringify(payload)}','1',${project ? `'${project}'` : 'null'})`

let failures = 0
const test = (name, fn) => {
  try { fn(); console.log('PASS ' + name) } catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + String(e.message).split('\n').join('\n     ')) }
}

// ── estate A owns a project with a folder, a fact, a task and two session rows ──
sql(append(A, 'project.created@1', { id: P, name: 'Atlas', purpose: 'the original' }, P))
sql(append(A, 'project.repo.attached@1', { id: REPO, path: '/w/atlas', label: 'atlas', is_primary: true }, P))
sql(append(A, 'memory.project.recorded@1', { id: FACT, claim: 'History belongs to the project', kind: 'decision' }, P))
sql(append(A, 'task.started@1', { id: TASK, instruction: 'the original task', option_id: 'claude-code', preset: 'manual' }, P))
sql(append(A, 'context.compiled@1', { session_id: SESSION, task_id: TASK, sha256: 'a'.repeat(64), chars: 10, fact_ids: [], fact_seqs: [], transcript_ids: [] }, P))
sql(append(A, 'agent.stage.reported@1', { session_id: STAGE_SESSION, stage: 'build', note: 'the original stage' }, P))
// Estate B has a project of its own, so its events are project-scoped and legal on their own.
sql(append(B, 'project.created@1', { id: Q, name: 'Bystander' }, Q))

const projectOfA = () => sql(`select name||'|'||coalesce(purpose,'∅')||'|'||coalesce(repo_path,'∅')||'|'||estate_id from projects where id='${P}'`)
const atlas = `Atlas|the original|/w/atlas|${A}`
const factOfA = () => sql(`select claim||'|'||kind||'|'||estate_id from memory_facts where id='${FACT}'`)
const fact = `History belongs to the project|decision|${A}`
const ownRows = () => sql(`select md5(string_agg(r, ',' order by r)) from (
  select 'p'||row(p.*)::text r from projects p where estate_id='${A}'
  union all select 'r'||row(x.id,x.path,x.label,x.is_primary)::text from project_repos x where estate_id='${A}'
  union all select 'f'||row(f.id,f.claim,f.kind,f.seq,f.valid_to,f.superseded_by)::text from memory_facts f where estate_id='${A}'
  union all select 't'||row(t.id,t.instruction,t.preset,t.session_id)::text from project_tasks t where estate_id='${A}'
  union all select 'c'||row(c.session_id,c.sha256,c.chars)::text from session_context_packs c where estate_id='${A}'
  union all select 's'||row(s.session_id,s.stage,s.note)::text from agent_stages s where estate_id='${A}') u`)
const before = ownRows()
const journalOf = (estate) => sql(`select count(*) from journal where estate_id='${estate}'`)

test('estate B cannot rename A\'s project: the append is refused at the door and A is untouched', () => {
  const seqB = journalOf(B)
  const said = refusal(append(B, 'project.created@1', { id: P, name: 'HIJACKED' }, P))
  assert.ok(said, 'the append was ACCEPTED — the finding itself')
  assert.match(said, /belongs to another estate/)
  assert.doesNotMatch(said, new RegExp(A), 'the refusal names the estate that owns the id')
  assert.equal(projectOfA(), atlas)
  assert.equal(journalOf(B), seqB, 'a refused event reached the journal')
})

test('an event scoped to A\'s project cannot be appended in B, whatever its type', () => {
  const said = refusal(append(B, 'memory.project.recorded@1', { id: uuid(20), claim: 'planted into A' }, P))
  assert.ok(said, 'B wrote a fact into A\'s project')
  assert.match(said, /project that belongs to another estate/)
  assert.equal(sql(`select count(*) from memory_facts where id='${uuid(20)}'`), '0')
})

test('a fact id A owns cannot be rewritten from B (memory_facts had the same shape)', () => {
  const said = refusal(append(B, 'memory.project.recorded@1', { id: FACT, claim: 'rewritten from B', kind: 'note' }, Q))
  assert.ok(said, 'the append was ACCEPTED and A\'s claim is now B\'s')
  assert.match(said, /memory_facts id that belongs to another estate/)
  assert.equal(factOfA(), fact)
})

test('a task, a repository row and two session rows A owns cannot be rewritten from B', () => {
  for (const [type, payload, table] of [
    ['task.started@1', { id: TASK, instruction: 'rewritten from B', option_id: 'shell' }, 'project_tasks'],
    ['project.repo.attached@1', { id: REPO, path: '/', label: 'everything' }, 'project_repos'],
    ['context.compiled@1', { session_id: SESSION, sha256: 'b'.repeat(64), chars: 1 }, 'session_context_packs'],
    ['agent.stage.reported@1', { session_id: STAGE_SESSION, stage: 'hijacked' }, 'agent_stages']
  ]) {
    const said = refusal(append(B, type, payload, Q))
    assert.ok(said, `${type} with A's id was ACCEPTED in B`)
    assert.match(said, new RegExp(`${table} id that belongs to another estate`))
  }
  assert.equal(ownRows(), before, 'a row of A changed')
})

test('an import into an empty estate C that carries A\'s project id is refused whole, and touches nothing', () => {
  const events = JSON.stringify([{ type: 'project.created@1', project_id: P, payload: { id: P, name: 'from mirror' } }])
  const said = refusal(`select import_declared_snapshot('${C}','${uuid(30)}','digest',${system},'${events}')`)
  assert.ok(said, 'the import COMMITTED — the finding itself')
  assert.match(said, /belongs to another estate/)
  assert.equal(journalOf(C), '0', 'C holds a journal row from an import that did not land')
  assert.equal(sql(`select count(*) from projects where estate_id='${C}'`), '0')
  assert.equal(projectOfA(), atlas)
})

test('a journal that ALREADY holds such an event replays without rewriting A, and without failing', () => {
  // The door did not exist when older journals were written. Insert the hijack
  // the way an old append_event would have left it, then rebuild B by replay.
  let seq = Number(sql(`select coalesce(max(seq),0) from journal where estate_id='${B}'`))
  const legacy = [
    ['project.created@1', P, { id: P, name: 'HIJACKED BY REPLAY', repo_path: null }],
    ['memory.project.recorded@1', Q, { id: FACT, claim: 'rewritten by replay', kind: 'note' }],
    ['task.started@1', Q, { id: TASK, instruction: 'rewritten by replay', option_id: 'shell' }],
    ['project.repo.attached@1', Q, { id: REPO, path: '/', label: 'replayed' }],
    ['context.compiled@1', Q, { session_id: SESSION, sha256: 'c'.repeat(64), chars: 2 }],
    ['agent.stage.reported@1', Q, { session_id: STAGE_SESSION, stage: 'replayed' }]
  ]
  for (const [type, project, payload] of legacy)
    sql(`insert into journal (estate_id, seq, type, schema_rev, actor, project_id, payload)
         values ('${B}', ${++seq}, '${type}', '1', ${system}, '${project}', '${JSON.stringify(payload)}')`)
  sql(`select rebuild_estate_projections('${B}')`)
  assert.equal(projectOfA(), atlas)
  assert.equal(factOfA(), fact)
  assert.equal(ownRows(), before, 'a replay of B rewrote a row A owns')
  assert.equal(sql(`select name from projects where id='${Q}'`), 'Bystander', 'B\'s own project did not survive its own replay')
})

test('a repeated create in the SAME estate keeps the folder, and a rebuild reproduces it (data finding 6)', () => {
  sql(append(A, 'project.created@1', { id: P, name: 'Atlas', purpose: 'the original' }, P))
  assert.equal(projectOfA(), atlas, 'a repeated create cleared repo_path while the primary repository remained')
  sql(`select rebuild_estate_projections('${A}')`)
  assert.equal(projectOfA(), atlas, 'the rebuild reproduced a cleared repo_path')
})

test('the same estate\'s own replay is still idempotent (P24)', () => {
  const now = ownRows()
  sql(`select rebuild_estate_projections('${A}')`)
  assert.equal(ownRows(), now)
})

test('the door is not an API: no role may call the guard directly', () => {
  for (const role of ['anon', 'authenticated', 'service_role'])
    assert.equal(sql(`select has_function_privilege('${role}','refuse_foreign_identity(uuid,text,jsonb,uuid)','execute')`), 'f', role)
})

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall green: an id names one estate\'s row, at the door and on replay')
