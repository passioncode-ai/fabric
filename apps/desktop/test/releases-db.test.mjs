// L8 · ADR-0084: a release is a record with its basis, verified by a second record, rolled back by
// a third. Trusted-host SQL contract on an owned cluster: the commands, their idempotency and
// refusals, what the projector leaves, and the door — not the screen, which has its own tests.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-releases-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql = input => execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const call = q => JSON.parse(sql(q))
const refused = (q, pattern) => assert.throws(() => sql(q), e => pattern.test(String(e.stderr ?? e.message)), 'expected a refusal matching ' + pattern)
assert.equal(sql("select count(*) from supabase_migrations.schema_migrations where version='20260929000069'"), '1')
const uuid = n => `69000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = uuid(1), P = uuid(2), Q = uuid(3), OTHER = uuid(4); let n = 10
const person = `'{"kind":"person","id":"operator"}'`, agent = `'{"kind":"agent","id":"session-1"}'`, system = `'{"kind":"system","id":"fixture"}'`
sql(`select append_event('${E}','project.created@1',${system},'{"id":"${P}","name":"Atlas"}','1','${P}')`)
sql(`select append_event('${E}','project.created@1',${system},'{"id":"${Q}","name":"Studio"}','1','${Q}')`)
const task = (project = P) => { const t = uuid(n++); sql(`select append_event('${E}','task.created@1',${system},'{"id":"${t}","title":"Work"}','1','${project}')`); return t }
const decision = (project = P) => { const d = uuid(n++); sql(`select append_event('${E}','memory.project.recorded@1',${person},'{"id":"${d}","claim":"History belongs to the project","kind":"decision"}','1','${project}')`); return d }
const arr = ids => `array[${ids.map(i => `'${i}'`).join(',')}]::uuid[]`
const record = ({ id = uuid(n++), command = uuid(n++), name = 'Atlas 0.4.2', env = 'Demo / local', summary = 'History survives a change of session', tasks = [], decisions = [], rollsBack = null, project = P, by = person } = {}) =>
  ({ id, r: call(`select record_release('${E}','${project}','${id}','${command}','${name}','${env}','${summary}',${arr(tasks)},${arr(decisions)},${rollsBack ? `'${rollsBack}'` : 'null'},${by})`) })
const verify = (id, outcome = 'accepted', receipt = 'Return checked in the demo environment', command = uuid(n++), by = person) =>
  call(`select verify_release('${E}','${P}','${id}','${command}','${outcome}','${receipt}',${by})`)
let count = 0; const test = (name, fn) => { fn(); console.log('PASS ' + name); count++ }

test('a release records its name, environment, the tasks that went in and the decisions behind it', () => {
  const t1 = task(), t2 = task(), d = decision()
  const { id, r } = record({ tasks: [t1, t2], decisions: [d] })
  assert.equal(r.repeated, false); assert.ok(r.recorded_seq > 0)
  assert.equal(sql(`select name||'|'||environment||'|'||array_length(task_ids,1)||'|'||array_length(decision_ids,1)||'|'||recorded_by_kind from releases where id='${id}'`), 'Atlas 0.4.2|Demo / local|2|1|person')
  assert.equal(sql(`select coalesce(verified_outcome,'none') from releases where id='${id}'`), 'none', 'a release was born verified')
})

test('the same command twice is one release; a command id cannot name a different release', () => {
  const command = uuid(n++), id = uuid(n++)
  record({ id, command }); const again = record({ id, command })
  assert.equal(again.r.repeated, true)
  assert.equal(sql(`select count(*) from journal where estate_id='${E}' and type='release.recorded@1' and payload->>'id'='${id}'`), '1')
  refused(`select record_release('${E}','${P}','${uuid(n++)}','${command}','x','y','z',array[]::uuid[],array[]::uuid[],null,${person})`, /different release/)
})

test('an agent, an empty name, or a task or decision of another project is refused', () => {
  refused(`select record_release('${E}','${P}','${uuid(n++)}','${uuid(n++)}','x','y','z',array[]::uuid[],array[]::uuid[],null,${agent})`, /person/)
  refused(`select record_release('${E}','${P}','${uuid(n++)}','${uuid(n++)}','  ','y','z',array[]::uuid[],array[]::uuid[],null,${person})`, /name/)
  refused(`select record_release('${E}','${P}','${uuid(n++)}','${uuid(n++)}','x','y','z',${arr([task(Q)])},array[]::uuid[],null,${person})`, /task/)
  refused(`select record_release('${E}','${P}','${uuid(n++)}','${uuid(n++)}','x','y','z',array[]::uuid[],${arr([decision(Q)])},null,${person})`, /decision/)
  refused(`select record_release('${E}','${OTHER}','${uuid(n++)}','${uuid(n++)}','x','y','z',array[]::uuid[],array[]::uuid[],null,${person})`, /no such project/)
})

test('verification is its own record, with an outcome and a receipt; the latest one stands', () => {
  const { id } = record()
  const v = verify(id, 'failed', 'Returned the pack of another run')
  assert.equal(v.repeated, false)
  assert.equal(sql(`select verified_outcome||'|'||verification_receipt from releases where id='${id}'`), 'failed|Returned the pack of another run')
  verify(id, 'accepted', 'Return checked after the fix')
  assert.equal(sql(`select verified_outcome from releases where id='${id}'`), 'accepted')
  refused(`select verify_release('${E}','${P}','${id}','${uuid(n++)}','maybe','x',${person})`, /outcome/)
  refused(`select verify_release('${E}','${P}','${id}','${uuid(n++)}','accepted','  ',${person})`, /receipt/)
  refused(`select verify_release('${E}','${P}','${uuid(n++)}','${uuid(n++)}','accepted','x',${person})`, /no such release/)
})

test('a rollback is a NEW release naming the one it replaces; the old record is kept as it was', () => {
  const { id: old } = record({ name: 'Atlas 0.4.1' })
  verify(old, 'accepted', 'demo check')
  const { id: back } = record({ name: 'Atlas 0.4.0 again', rollsBack: old })
  assert.equal(sql(`select rolls_back from releases where id='${back}'`), old)
  assert.equal(sql(`select name||'|'||verified_outcome from releases where id='${old}'`), 'Atlas 0.4.1|accepted', 'the rolled-back record was edited')
  refused(`select record_release('${E}','${P}','${uuid(n++)}','${uuid(n++)}','x','y','z',array[]::uuid[],array[]::uuid[],'${uuid(n++)}',${person})`, /rolls back/)
  const { id: studio } = record({ project: Q, name: 'Studio 0.2.1' })
  refused(`select record_release('${E}','${P}','${uuid(n++)}','${uuid(n++)}','x','y','z',array[]::uuid[],array[]::uuid[],'${studio}',${person})`, /rolls back/)
})

test('the commands are the only door, and a release names rows of its own estate', () => {
  for (const f of ['record_release(uuid,uuid,uuid,uuid,text,text,text,uuid[],uuid[],uuid,jsonb)', 'verify_release(uuid,uuid,uuid,uuid,text,text,jsonb)']) {
    assert.equal(sql(`select has_function_privilege('authenticated','${f}','execute')`), 'f', f)
    assert.equal(sql(`select has_function_privilege('service_role','${f}','execute')`), 't', f)
  }
  assert.equal(sql(`select has_table_privilege('service_role','releases','insert')`), 'f', 'releases can be written around the command')
  assert.equal(sql(`select has_table_privilege('authenticated','releases','select')`), 't')
  assert.equal(sql(`select relrowsecurity from pg_class where relname='releases'`), 't')
  const foreign = uuid(n++), theirs = uuid(n++)
  sql(`select append_event('${foreign}','project.created@1',${system},'{"id":"${theirs}","name":"Theirs"}','1','${theirs}')`)
  refused(`insert into releases (id, estate_id, project_id, name, environment, summary, task_ids, decision_ids, recorded_at, recorded_by_kind, recorded_by_id, recorded_seq)
    values ('${uuid(n++)}','${E}','${theirs}','x','y','z','{}','{}',now(),'person','op',1)`, /foreign key|violates/)
})

// Migration 75. The test above checked the commands and never the projector behind them: `apply_releases`
// was SECURITY DEFINER with a NULL ACL (EXECUTE to PUBLIC), and the independent verifier rewrote a
// verified release as anon with a hand-built journal row and no journal entry. This is that probe.
// To WATCH it fail: FABRIC_SKIP_MIGRATION=20261003000075_projectors_are_not_public.sql node test/run-releases-db.mjs
// #region projectors-are-not-public — docs: docs/adr/0103-an-id-belongs-to-one-estate-at-the-write-boundary.md#decision
test('the projector is not a door: no API role, the service role included, can rewrite a release with a forged journal row', () => {
  const { id } = record({ name: 'Atlas 0.5.0' })
  verify(id, 'accepted', 'checked in the demo environment')
  const state = () => sql(`select verified_outcome||'|'||verification_receipt||'|'||verified_seq from releases where id='${id}'`)
  const before = state(), journalBefore = sql(`select count(*) from journal where estate_id='${E}'`)
  const forged = `jsonb_populate_record(null::journal, jsonb_build_object('estate_id','${E}','seq',999999,'type','release.verified@1',
    'schema_rev','1','actor','{"kind":"person","id":"forger"}'::jsonb,'payload',jsonb_build_object('id','${id}','outcome','failed','receipt','FORGED'),'occurred_at',now()))`
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.throws(() => sql(`set role ${role}; select apply_releases(${forged})`),
      e => /permission denied for function apply_releases/.test(String(e.stderr ?? e.message)),
      `${role} called apply_releases directly — the finding itself`)
    assert.equal(state(), before, `${role} rewrote the release around the journal`)
  }
  assert.equal(sql(`select count(*) from journal where estate_id='${E}'`), journalBefore)
  for (const role of ['public', 'anon', 'authenticated', 'service_role'])
    assert.equal(sql(`select has_function_privilege('${role}','apply_releases(journal)','execute')`), 'f', role)
})
// #endregion projectors-are-not-public
console.log(JSON.stringify({ status: 'PASS', cases: count }))
