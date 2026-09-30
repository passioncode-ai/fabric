// L3b (SCR-41): a question set aside for next time, and a topic the owner writes.
// Trusted-host SQL contract on an owned cluster: the commands, their idempotency and their
// refusals, and what the projector leaves behind — not the screen, which has its own tests.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-board-deferral-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql = input => execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const call = q => JSON.parse(sql(q))
const refused = (q, pattern) => assert.throws(() => sql(q), e => pattern.test(String(e.stderr ?? e.message)), 'expected a refusal matching ' + pattern)
assert.equal(sql("select count(*) from supabase_migrations.schema_migrations where version='20260929000068'"), '1')
const uuid = n => `68000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = uuid(1), P = uuid(2), OTHER = uuid(3); let n = 10
const person = `'{"kind":"person","id":"operator"}'`, agent = `'{"kind":"agent","id":"session-1"}'`, system = `'{"kind":"system","id":"fixture"}'`
sql(`select append_event('${E}','project.created@1',${system},'{"id":"${P}","name":"Atlas"}','1','${P}')`)
const ask = (by = agent) => {
  const q = uuid(n++)
  sql(`select append_event('${E}','question.asked@1',${by},'{"id":"${q}","project_id":"${P}","text":"Which context?","kind":"decision","options":[]}','1','${P}')`)
  return q
}
const defer = (q, command, reason = 'after the pilot', by = person) => call(`select defer_question('${E}','${P}','${q}','${command}',${reason === null ? 'null' : `'${reason}'`},${by})`)
const reopen = (q, command, by = person) => call(`select reopen_question('${E}','${P}','${q}','${command}',${by})`)
const topic = (q, command, text = 'Agree the pilot scope', note = 'before Friday', by = person) =>
  call(`select ask_topic('${E}','${P}','${q}','${command}','${text}',${note === null ? 'null' : `'${note}'`},${by})`)
let count = 0; const test = (name, fn) => { fn(); console.log('PASS ' + name); count++ }

test('a question set aside keeps its reason, stays open and keeps blocking', () => {
  const q = ask(), c = uuid(n++)
  const r = defer(q, c)
  assert.equal(r.repeated, false); assert.ok(r.deferred_seq > 0)
  assert.equal(sql(`select status from questions where id='${q}'`), 'open', 'deferral changed the question state')
  assert.equal(sql(`select reason from question_deferrals where question_id='${q}'`), 'after the pilot')
  assert.equal(sql(`select deferred_by_kind||':'||deferred_by_id from question_deferrals where question_id='${q}'`), 'person:operator')
})

test('the same command twice is one deferral, and a command id cannot be reused for another question', () => {
  const q = ask(), c = uuid(n++)
  const first = defer(q, c), again = defer(q, c)
  assert.equal(again.repeated, true); assert.equal(again.deferred_seq, first.deferred_seq)
  assert.equal(sql(`select count(*) from journal where estate_id='${E}' and type='question.deferred@1' and payload->>'id'='${q}'`), '1')
  refused(`select defer_question('${E}','${P}','${ask()}','${c}','x',${person})`, /different question/)
})

test('no reason, a blank reason, an agent, or a question already set aside is refused', () => {
  const q = ask()
  refused(`select defer_question('${E}','${P}','${q}','${uuid(n++)}',null,${person})`, /reason/)
  refused(`select defer_question('${E}','${P}','${q}','${uuid(n++)}','   ',${person})`, /reason/)
  refused(`select defer_question('${E}','${P}','${q}','${uuid(n++)}','later',${agent})`, /person/)
  defer(q, uuid(n++))
  refused(`select defer_question('${E}','${P}','${q}','${uuid(n++)}','again',${person})`, /already set aside/)
})

test('a question of another project, or one already answered, cannot be set aside', () => {
  const q = ask()
  refused(`select defer_question('${E}','${OTHER}','${q}','${uuid(n++)}','later',${person})`, /no such question/)
  sql(`select append_event('${E}','question.answered@1',${person},'{"id":"${q}","answer":"yes"}','1','${P}')`)
  refused(`select defer_question('${E}','${P}','${q}','${uuid(n++)}','later',${person})`, /answered/)
})

test('returning it to the board removes the deferral; returning one that is not set aside is refused', () => {
  const q = ask(); defer(q, uuid(n++))
  const r = reopen(q, uuid(n++))
  assert.equal(r.repeated, false)
  assert.equal(sql(`select count(*) from question_deferrals where question_id='${q}'`), '0')
  refused(`select reopen_question('${E}','${P}','${q}','${uuid(n++)}',${person})`, /not set aside/)
})

test('answering a question that was set aside settles it and clears the deferral', () => {
  const q = ask(); defer(q, uuid(n++))
  const a = call(`select answer_question('${E}','${P}','${q}','${uuid(n++)}',null,'decided after all',null,null,${person})`)
  assert.ok(a.decision_id)
  assert.equal(sql(`select status from questions where id='${q}'`), 'answered')
  assert.equal(sql(`select count(*) from question_deferrals where question_id='${q}'`), '0', 'a settled question stayed set aside')
})

test('a topic the owner writes is an open question on the board, asked by that person', () => {
  const q = uuid(n++), c = uuid(n++)
  const r = topic(q, c)
  assert.equal(r.repeated, false); assert.equal(r.question_id, q)
  assert.equal(sql(`select status||'|'||asked_by_kind||'|'||text||'|'||coalesce(why_blocked,'') from questions where id='${q}'`), 'open|person|Agree the pilot scope|before Friday')
})

test('the same topic command twice asks once', () => {
  const q = uuid(n++), c = uuid(n++)
  topic(q, c); const again = topic(uuid(n++), c)
  assert.equal(again.repeated, true); assert.equal(again.question_id, q)
  assert.equal(sql(`select count(*) from questions where asked_command_id='${c}'`), '1')
})

test('a topic needs a person, words, and a project of this estate', () => {
  refused(`select ask_topic('${E}','${P}','${uuid(n++)}','${uuid(n++)}','x',null,${agent})`, /person/)
  refused(`select ask_topic('${E}','${P}','${uuid(n++)}','${uuid(n++)}','  ',null,${person})`, /text/)
  refused(`select ask_topic('${E}','${OTHER}','${uuid(n++)}','${uuid(n++)}','x',null,${person})`, /no such project/)
})

test('the commands are the only door: nobody but the service role may call them or write the table', () => {
  for (const f of ['defer_question(uuid,uuid,uuid,uuid,text,jsonb)', 'reopen_question(uuid,uuid,uuid,uuid,jsonb)', 'ask_topic(uuid,uuid,uuid,uuid,text,text,jsonb)']) {
    assert.equal(sql(`select has_function_privilege('authenticated','${f}','execute')`), 'f', f + ' is callable by authenticated')
    assert.equal(sql(`select has_function_privilege('service_role','${f}','execute')`), 't', f + ' is not callable by the service role')
  }
  assert.equal(sql(`select has_table_privilege('service_role','question_deferrals','insert')`), 'f', 'the table can be written around the command')
  assert.equal(sql(`select has_table_privilege('authenticated','question_deferrals','select')`), 't', 'members cannot read what they set aside')
  assert.equal(sql(`select relrowsecurity from pg_class where relname='question_deferrals'`), 't')
})
test('the database itself refuses a deferral that names another estate\'s question', () => {
  // The other estate has a project of its own, so only the question's composite key can refuse.
  const q = ask(), foreign = uuid(n++), theirs = uuid(n++)
  sql(`select append_event('${foreign}','project.created@1',${system},'{"id":"${theirs}","name":"Theirs"}','1','${theirs}')`)
  refused(`insert into question_deferrals (question_id, estate_id, project_id, reason, deferred_at, deferred_by_kind, deferred_by_id, deferred_seq)
    values ('${q}','${foreign}','${theirs}','x',now(),'person','operator',1)`, /question_deferrals_estate_id_question_id_fkey|questions/)
})
console.log(JSON.stringify({ status: 'PASS', cases: count }))
