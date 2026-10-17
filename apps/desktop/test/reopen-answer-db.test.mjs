// 0.3.7 wave 2 (migration 90, suffix 112): an answered question taken back — the SQL contract on an owned cluster.
// The command, its idempotency and refusals, the projector, and the acts' own journal record. The executor that
// calls it, and the undo through it, are probed in acts-db.test.mjs against a disposable stack.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-reopen-answer-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql = input => execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const call = q => JSON.parse(sql(q))
const refused = (q, pattern) => assert.throws(() => sql(q), e => pattern.test(String(e.stderr ?? e.message)), 'expected a refusal matching ' + pattern)
assert.equal(sql("select count(*) from supabase_migrations.schema_migrations where version='20261017000112'"), '1')
const uuid = n => `90000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = uuid(1), P = uuid(2); let n = 10
const person = `'{"kind":"person","id":"operator"}'`, agent = `'{"kind":"agent","id":"session-1"}'`, system = `'{"kind":"system","id":"fixture"}'`
sql(`select append_event('${E}','project.created@1',${system},'{"id":"${P}","name":"Atlas"}','1','${P}')`)
const task = () => { const t = uuid(n++); sql(`select append_event('${E}','task.created@1',${system},'{"id":"${t}","title":"Work"}','1','${P}')`); return t }
const ask = blocks => {
  const q = uuid(n++)
  sql(`select append_event('${E}','question.asked@1',${agent},'{"id":"${q}","project_id":"${P}","text":"Which context?","kind":"decision","options":[],"blocks":${JSON.stringify(blocks ?? [])}}','1','${P}')`)
  return q
}
const answer = (q, revision, text = 'The first', by = person) =>
  call(`select answer_question('${E}','${P}','${q}','${uuid(n++)}',${revision},'${text}',null,null,${by})`)
const reopen = (q, command, by = person) => call(`select reopen_answered_question('${E}','${P}','${q}','${command}',${by})`)
let count = 0; const test = (name, fn) => { fn(); console.log('PASS ' + name); count++ }

test('taking an answer back opens the question under a new revision and blocks its work again', () => {
  const t = task(), q = ask([t])
  answer(q, 1)
  assert.equal(sql(`select q.status||'|'||coalesce(t.blocked_by::text,'') from questions q join project_tasks t on t.id='${t}' where q.id='${q}'`), 'answered|')
  const c = uuid(n++), r = reopen(q, c)
  assert.equal(r.repeated, false); assert.equal(r.revision, 2); assert.ok(r.reopened_seq > 0)
  assert.equal(sql(`select status||'|'||coalesce(answer,'-')||'|'||coalesce(answered_by,'-')||'|'||coalesce(decision_id::text,'-')||'|'||revision from questions where id='${q}'`), 'open|-|-|-|2')
  assert.equal(sql(`select blocked_by from project_tasks where id='${t}'`), q, 'the work it blocks is blocked again')
})

test('the same command twice reopens once; a command id used for another question is refused', () => {
  const q = ask(), c = uuid(n++)
  answer(q, 1)
  reopen(q, c)
  const again = reopen(q, c)
  assert.equal(again.repeated, true)
  assert.equal(sql(`select count(*) from journal where estate_id='${E}' and type='question.answer_withdrawn@1' and payload->>'id'='${q}'`), '1')
  const other = ask(); answer(other, 1)
  refused(`select reopen_answered_question('${E}','${P}','${other}','${c}',${person})`, /different question/)
})

test('a reopened question is answered again: a second resolution, a new decision, the old revision refused', () => {
  const q = ask()
  const first = answer(q, 1, 'one')
  reopen(q, uuid(n++))
  refused(`select answer_question('${E}','${P}','${q}','${uuid(n++)}',1,'late',null,null,${person})`, /revision/)
  const second = answer(q, 2, 'two')
  assert.notEqual(second.decision_id, first.decision_id)
  assert.equal(sql(`select answer||'|'||status from questions where id='${q}'`), 'two|answered')
  assert.equal(sql(`select count(*) from question_resolutions where question_id='${q}'`), '2')
})

test('only a person, only an answered question, only one of this project', () => {
  const q = ask()
  refused(`select reopen_answered_question('${E}','${P}','${q}','${uuid(n++)}',${person})`, /not answered/)
  answer(q, 1)
  refused(`select reopen_answered_question('${E}','${P}','${q}','${uuid(n++)}',${agent})`, /only a person/)
  refused(`select reopen_answered_question('${E}','${uuid(n++)}','${q}','${uuid(n++)}',${person})`, /no such question/)
  refused(`select reopen_answered_question('${E}','${P}','${uuid(n++)}','${uuid(n++)}',${person})`, /no such question/)
})

test('a rebuild of the projections reproduces the reopened state from the journal', () => {
  const t = task(), q = ask([t])
  answer(q, 1); reopen(q, uuid(n++))
  sql(`select rebuild_estate_projections('${E}')`)
  assert.equal(sql(`select status||'|'||revision from questions where id='${q}'`), 'open|2')
  assert.equal(sql(`select blocked_by from project_tasks where id='${t}'`), q)
})

test('act.recorded@1 and question.answer_withdrawn@1 are registered; the command is the service role\'s alone', () => {
  assert.equal(sql(`select string_agg(type||':'||projects, ',' order by type) from event_types where type in ('act.recorded@1','question.answer_withdrawn@1')`), 'act.recorded@1:false,question.answer_withdrawn@1:true')
  sql(`select append_event('${E}','act.recorded@1',${person},'{"v":1,"kind":"task.move"}','1','${P}')`)
  const f = 'reopen_answered_question(uuid,uuid,uuid,uuid,jsonb)'
  assert.equal(sql(`select has_function_privilege('authenticated','${f}','execute')`), 'f')
  assert.equal(sql(`select has_function_privilege('anon','${f}','execute')`), 'f')
  assert.equal(sql(`select has_function_privilege('service_role','${f}','execute')`), 't')
  assert.equal(sql(`select has_function_privilege('service_role','apply_question_answer_reopen(journal)','execute')`), 'f', 'the projector is callable')
  assert.equal(sql(`select count(*) from pg_indexes where indexname in ('journal_acts_newest','journal_acts_reversals','journal_answer_withdrawn_command')`), '3')
})

test('an act record is projected nowhere and rebuilds to the same state', () => {
  const before = sql(`select count(*) from questions where estate_id='${E}'`)
  sql(`select rebuild_estate_projections('${E}')`)
  assert.equal(sql(`select count(*) from questions where estate_id='${E}'`), before)
})
console.log(`PASS ${count} reopen-answer checks`)
