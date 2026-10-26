// Fabric 0.3.13's one schema step (migration 124, schema 97) on the fully migrated chain: each carry-over row it closes,
// written through the doors the app uses (append_event, the board's functions, answer_question), then read back, and the
// rebuild from the journal compared where a row was about a replay.
// To WATCH this suite fail, run the runner with FABRIC_SKIP_MIGRATION=20261026000124_one_schema_step.sql.
// #region one-schema-step-test — docs: docs/evidence/plans/2026-10-26-release-0313-plan.md#composition
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-schema-0313-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const psqlArgs = [url, '-X', '-q', '-t', '-A', '-F', '|', '-v', 'ON_ERROR_STOP=1']
const sql = input => execFileSync('psql', psqlArgs, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
let count = 0; const failed = []
const test = async (name, fn) => {
  try { await fn(); console.log('PASS ' + name); count++ } catch (e) { failed.push(name); console.log(`FAIL ${name}\n  ${String(e.message).split('\n').slice(0, 8).join(' ')}${e.stderr ? '\n  ' + String(e.stderr).trim().split('\n').slice(0, 2).join(' | ') : ''}`) }
}
const id = n => `97000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = id(1), P = id(11), Q = id(12), R = id(13), S = id(14)
let n = 100
const next = () => id(n++)
const lit = v => `'${String(v).replace(/'/g, "''")}'`
const j = v => `${lit(JSON.stringify(v))}::jsonb`
const q = v => (v === null ? 'null' : `'${v}'`)
const system = { kind: 'system', id: 'schema-0313-probe' }
const person = { kind: 'person', id: 'operator' }
const agent = { kind: 'agent', id: 'probe-session', label: 'Probe', provenance: 'trusted' }
const append = (type, payload, project = null, actor = system) =>
  sql(`set role service_role; select seq from append_event('${E}','${type}',${j(actor)},${j(payload)},'1',${project ? `'${project}'` : 'null'})`)
const call = (fn, ...a) => JSON.parse(sql(`set role service_role; select ${fn}(${a.join(',')})`))
const rebuild = () => sql(`select rebuild_estate_projections('${E}')`)

// The owner exists before the estate, as on a fresh install (a projector never invents a person).
sql(`insert into persons (id, display_name) values ('${id(91)}', 'owner')`)
append('estate.created@1', { name: 'schema step estate', owner_person_id: id(91) })
for (const [project, name] of [[P, 'one'], [Q, 'two'], [R, 'three'], [S, 'four']]) append('project.created@1', { id: project, name }, project)

const repos = project => sql(`select id||':'||path||':'||is_primary||':'||kind from project_repos where project_id='${project}' order by attached_at, id`).split('\n').filter(Boolean)
const attach = (project, repo, path, extra = {}) => append('project.repo.attached@1', { id: repo, path, label: path, ...extra }, project)
const detach = (project, repo, path) => append('project.repo.detached@1', { id: repo, path }, project)

await test('CO-340: a folder detached and attached again under a new id rebuilds', () => {
  const first = next(), second = next()
  attach(P, first, '/w/again')
  detach(P, first, '/w/again')
  attach(P, second, '/w/again')
  assert.deepEqual(repos(P), [`${second}:/w/again:true:primary`])
  rebuild()
  assert.deepEqual(repos(P), [`${second}:/w/again:true:primary`], 'the rebuild replays the first attach without raising and ends where the live append did')
})

await test('CO-340: a folder moved from one project to another rebuilds', () => {
  const a = next(), b = next()
  attach(Q, a, '/w/moved')
  detach(Q, a, '/w/moved')
  attach(R, b, '/w/moved')
  rebuild()
  assert.deepEqual(repos(R), [`${b}:/w/moved:true:primary`])
  assert.ok(!repos(Q).some(r => r.includes('/w/moved')))
})

await test('CO-358: a folder two projects held (an older build) replays into an empty estate; a live attach of a held folder is refused at the door', () => {
  const held = next(), again = next()
  attach(Q, held, '/w/shared')
  assert.throws(() => attach(R, again, '/w/shared'), e => /already attached in this estate/.test(String(e.stderr ?? e.message)), 'the door refuses it')
  // What a build before 0.3.7 could journal: the second attach, written past every door.
  sql(`insert into journal (estate_id, seq, type, schema_rev, actor, project_id, payload)
       select '${E}', max(seq) + 1, 'project.repo.attached@1', '1', ${j(system)}, '${R}', ${j({ id: again, path: '/w/shared', label: 'again' })}
         from journal where estate_id = '${E}'`)
  const before = JSON.stringify([repos(P), repos(Q), repos(R)])
  sql(`delete from project_repos where estate_id='${E}'`)
  rebuild()
  assert.equal(JSON.stringify([repos(P), repos(Q), repos(R)]), before, 'a replay into empty projections gives the same rows')
  assert.ok(repos(Q).some(r => r.startsWith(`${held}:/w/shared`)), 'the first attach keeps it')
  assert.ok(!repos(R).some(r => r.includes('/w/shared')), 'the second one holds nothing')
})

await test('CO-341: kind follows is_primary after the primary folder is detached; the estate-path index exists', () => {
  const a = next(), b = next()
  attach(S, a, '/w/s-primary')
  attach(S, b, '/w/s-second', { kind: 'worktree' })
  assert.deepEqual(repos(S), [`${a}:/w/s-primary:true:primary`, `${b}:/w/s-second:false:worktree`])
  detach(S, a, '/w/s-primary')
  assert.deepEqual(repos(S), [`${b}:/w/s-second:true:primary`], 'the promoted folder reads as primary')
  assert.equal(sql(`select count(*) from pg_indexes where indexname='project_repos_unique_estate_path'`), '1')
  assert.equal(sql(`select count(*) from project_repos where is_primary <> (kind = 'primary')`), '0')
})

// ── the questions ──────────────────────────────────────────────────────────────────────────────────────────────
const ask = () => {
  const qid = next()
  sql(`select append_event('${E}','question.asked@1',${j(agent)},${j({ id: qid, project_id: P, text: 'Which store?', kind: 'decision', options: [], blocks: [] })},'1','${P}')`)
  return qid
}
const answer = (qid, revision, text) => JSON.parse(sql(`select answer_question('${E}','${P}','${qid}','${next()}',${revision},${lit(text)},null,null,${j(person)})`))
const reopen = qid => JSON.parse(sql(`select reopen_answered_question('${E}','${P}','${qid}','${next()}',${j(person)})`))
const correct = (fact, claim) => {
  const fid = next()
  append('memory.project.recorded@1', { id: fid, claim, source_ref: 'memory:correction', kind: 'decision', supersedes: fact }, P, person)
  return fid
}
const current = ids => sql(`select string_agg(claim, ',' order by seq) from memory_facts where valid_to is null and id in (${ids.map(x => `'${x}'`).join(',')})`)

await test('CO-355: a decision corrected in Memory and then taken back leaves no current decision, and a rebuild agrees', () => {
  const qid = ask()
  const first = answer(qid, 1, 'Postgres')
  const fixed = correct(first.decision_id, 'Postgres 17')
  assert.equal(current([first.decision_id, fixed]), 'Postgres 17', 'the correction is the current decision')
  const r = reopen(qid)
  assert.equal(current([first.decision_id, fixed]), '', 'the withdrawal closes the correction too')
  assert.equal(sql(`select withdrawn_seq from memory_facts where id='${fixed}'`), String(r.reopened_seq))
  rebuild()
  assert.equal(current([first.decision_id, fixed]), '', 'a rebuild agrees')
})

await test('CO-357: a rebuild after a withdrawal and a second answer keeps the question\'s resolution', () => {
  const qid = ask()
  answer(qid, 1, 'one')
  reopen(qid)
  const second = answer(qid, 2, 'two')
  const kept = sql(`select resolution_id from questions where id='${qid}'`)
  assert.ok(kept, 'answered with a resolution')
  assert.equal(kept, sql(`select resolution_id from question_resolutions where decision_id='${second.decision_id}'`))
  rebuild()
  assert.equal(sql(`select coalesce(resolution_id::text, 'null') from questions where id='${qid}'`), kept)
})

// ── a project's business, its relations, the projections' times ────────────────────────────────────────────────
const business = project => sql(`select coalesce(business, '-')||'|'||coalesce(business_set_by, '-') from projects where id='${project}'`)
const profile = (project, payload, actor) => append('project.profiled@1', payload, project, actor)

await test('CO-418 (W2-4): an agent names a business only while none is recorded and no person wrote one; a rebuild agrees', () => {
  profile(Q, { business: 'Appvillis' }, agent)
  assert.equal(business(Q), 'Appvillis|agent')
  profile(Q, { business: 'Someone else' }, agent)
  assert.equal(business(Q), 'Appvillis|agent', 'an agent does not replace a recorded business')
  profile(Q, { business: '' }, agent)
  assert.equal(business(Q), 'Appvillis|agent', 'nor clears it')
  profile(Q, { business: 'PassionCode' }, person)
  assert.equal(business(Q), 'PassionCode|person')
  profile(Q, { business: '' }, person)
  assert.equal(business(Q), '-|person', 'the person cleared it on purpose')
  profile(Q, { business: 'Agent guess' }, agent)
  assert.equal(business(Q), '-|person', 'and an agent does not fill it again')
  sql(`update projects set business = 'drift', business_set_by = 'agent' where id='${Q}'`)
  rebuild()
  assert.equal(business(Q), '-|person', 'a rebuild gives the person\'s word, not the last writer\'s')
})

await test('CO-418 (DA-7): project_relations is written by its projector only', () => {
  for (const right of ['insert', 'update', 'delete'])
    assert.equal(sql(`select has_table_privilege('service_role', 'project_relations', '${right}')`), 'f', right)
  assert.equal(sql(`select has_table_privilege('service_role', 'project_relations', 'select')`), 't')
})

await test('CO-418 (i3 DA-2): the owner\'s membership, a delivery and a run carry their event\'s time', () => {
  assert.equal(sql(`select (m.created_at = j.occurred_at and m.changed_at = j.occurred_at)::text from memberships m
    join journal j on j.estate_id = m.estate_id and j.type = 'estate.created@1' where m.estate_id='${E}'`), 'true')
  const t = next(), d = next(), run = next()
  append('task.created@1', { id: t, title: 'Run me' }, P)
  append('delivery.queued@1', { delivery_id: d, task_id: t, session_id: next(), input_digest: 'sha256:' + '1'.repeat(64) }, P)
  append('run.started@1', { task_run_id: run, task_id: t, session_id: next() }, P)
  assert.equal(sql(`select (d.created_at = j.occurred_at)::text from deliveries d join journal j on j.estate_id=d.estate_id and j.seq=d.queued_seq where d.delivery_id='${d}'`), 'true')
  assert.equal(sql(`select (r.created_at = j.occurred_at)::text from task_runs r join journal j on j.estate_id=r.estate_id and j.seq=r.admitted_seq where r.task_run_id='${run}'`), 'true')
  sql(`update deliveries set created_at = now() + interval '1 day' where delivery_id='${d}'`)
  rebuild()
  assert.equal(sql(`select (d.created_at = j.occurred_at)::text from deliveries d join journal j on j.estate_id=d.estate_id and j.seq=d.queued_seq where d.delivery_id='${d}'`), 'true', 'a rebuild sets it back')
})

// ── the reads ──────────────────────────────────────────────────────────────────────────────────────────────────
await test('CO-307: project_activity gives each project its newest journal event, through the caller\'s rights', () => {
  const t = next()
  append('task.created@1', { id: t, title: 'Latest in three' }, R)
  const newest = sql(`select seq||'|'||occurred_at from journal where estate_id='${E}' and project_id='${R}' order by seq desc limit 1`)
  // Read as the owner role: the owned cluster's service_role does not bypass RLS as Supabase's does.
  assert.equal(sql(`select last_seq||'|'||last_occurred_at from project_activity where estate_id='${E}' and project_id='${R}'`), newest)
  assert.equal(sql(`select has_table_privilege('service_role', 'project_activity', 'select')`), 't')
  assert.equal(sql(`select reloptions::text from pg_class where relname='project_activity'`), '{security_invoker=true}')
  assert.equal(sql(`select has_table_privilege('anon', 'project_activity', 'select')`), 'f')
  assert.equal(sql(`select has_table_privilege('service_role', 'project_activity', 'insert')`), 'f')
})

await test('CO-398 and CO-418 (DA-4): the finished tasks and a project\'s journal are read through an index', () => {
  assert.equal(sql(`select string_agg(indexname, ',' order by indexname) from pg_indexes where indexname in ('project_tasks_done_moved','journal_by_project')`),
    'journal_by_project,project_tasks_done_moved')
  const plan = sql(`set enable_seqscan = off; explain select id from project_tasks where estate_id='${E}' and status='done' order by moved_at desc nulls last limit 20`)
  assert.match(plan, /project_tasks_done_moved/)
})

// ── the board ──────────────────────────────────────────────────────────────────────────────────────────────────
let dN = 0, keyN = 0
const digest = () => 'sha256:' + (++dN).toString(16).padStart(64, '0')
const idem = () => ({ epoch: 1, key: `key-${String(++keyN).padStart(6, '0')}` })
const submit = (sender, body) => {
  const r = call('board_submit', q(E), q(sender), j(agent), j(body), lit(digest()))
  assert.equal(r.ok, true, JSON.stringify(r))
  return r
}
const recipients = message => sql(`select string_agg(recipient_project::text, ',' order by recipient_project) from board_deliveries where estate_id='${E}' and message_id='${message}'`)
const CAP = 'analytics.retention'

await test('CO-370: a reply is delivered to the sender of the message it answers, live and on a restore\'s backfill', () => {
  const opened = submit(P, { idempotency: idem(), thread: { new: { participants: [Q, R], subject: 'status' } }, kind: 'announcement', body: { text: 'shipped' } })
  assert.equal(recipients(opened.message), [Q, R].sort().join(','), 'an announcement still reaches every participant')
  const answered = call('board_reply', q(E), q(Q), j(agent), j({ idempotency: idem(), replyTo: opened.message, body: { text: 'thanks' } }), lit(digest()))
  assert.equal(answered.ok, true, JSON.stringify(answered))
  assert.equal(recipients(answered.message), P, 'the reply goes to the announcer only')
  const page = call('board_list_reader', q(E), q(R), q(opened.thread), '0', '50', 'true', 'null')
  assert.deepEqual(page.messages.map(m => m.id), [opened.message], 'the reply addressed to the announcer is not unread to another participant')
  assert.equal(call('board_status', q(E), q(R)).unread, call('board_list_reader', q(E), q(R), 'null', '0', '100', 'true', 'null').messages.length, 'com.status and com.list agree')
  sql(`delete from board_deliveries where estate_id='${E}' and message_id='${answered.message}'`)
  sql(`select board_backfill_deliveries('${E}')`)
  assert.equal(recipients(answered.message), P, 'a restore backfills the same')
})

await test('CO-370: board_list and board_get test participation with the indexable containment', () => {
  for (const f of ['board_list(uuid,uuid,uuid,bigint,integer)', 'board_get(uuid,uuid,uuid)']) {
    const body = sql(`select pg_get_functiondef('${f}'::regprocedure)`)
    assert.match(body, /participants @> ARRAY\[p_reader\]|participants @> array\[p_reader\]/i, f)
    assert.doesNotMatch(body, /= any \(t\.participants\)/i, f)
  }
  const page = call('board_list', q(E), q(Q), 'null', '0', '50')
  assert.equal(page.ok, true)
  assert.ok(page.messages.length >= 1)
})

await test('CO-370: an epoch\'s age limit is 30 to 40 days and differs between Projects', () => {
  const limits = [P, Q, R, id(201), id(202), id(203)].map(p => Number(sql(`select extract(epoch from board_epoch_age_limit('${p}'))`)))
  for (const s of limits) assert.ok(s >= 30 * 86400 && s <= 40 * 86400, `${s}`)
  assert.ok(new Set(limits).size > 1, 'staggered')
  assert.equal(sql(`select (board_epoch_age_limit('${P}') = board_epoch_age_limit('${P}'))::text`), 'true', 'fixed per Project')
})

await test('CO-373: a responder whose lease lapsed is not able to answer, in the receipt\'s test and in both waiting reads', () => {
  const asked = submit(P, { idempotency: idem(), thread: { new: { participants: [R], subject: 'ask' } }, kind: 'request', body: { text: 'compute it' }, request: { target: R, capability: CAP } })
  sql(`insert into board_responder_slots (estate_id, project_id, capability, generation, holder_enrollment, lease_until, updated_seq)
       values ('${E}', '${R}', '${CAP}', 1, '${next()}', now() - interval '5 minutes', 1)`)
  assert.deepEqual(call('board_responder_possible', q(E), q(R), lit(CAP)), { ok: true, possible: false })
  const waiting = call('board_waiting_operator', q(E))
  assert.ok(waiting.requests >= 1, JSON.stringify(waiting))
  const pending = call('board_pending_operator', q(E), '100')
  assert.ok(pending.projects.some(p => p.project === R && p.requestsWithAbsentResponder >= 1), JSON.stringify(pending))
  sql(`update board_responder_slots set lease_until = now() + interval '5 minutes' where estate_id='${E}' and project_id='${R}' and capability='${CAP}'`)
  assert.deepEqual(call('board_responder_possible', q(E), q(R), lit(CAP)), { ok: true, possible: true })
  assert.equal(call('board_waiting_operator', q(E)).requests ?? 0, waiting.requests - 1, 'a live holder takes it out of the count')
  void asked
})

await test('CO-418 (DO-18): no board refusal tells an agent a request stays queued', () => {
  for (const f of ['board_holder_enrollment(uuid,jsonb,uuid,text)', 'board_enroll(uuid,jsonb,uuid,jsonb,text)', 'board_responder_replace(uuid,jsonb,uuid,jsonb,text)']) {
    const body = sql(`select pg_get_functiondef('${f}'::regprocedure)`)
    assert.doesNotMatch(body, /stays queued/, f)
    assert.match(body, /a reply from the request''s target answers it/, f)
  }
})

// ── SW-7, the helpers, the schema ──────────────────────────────────────────────────────────────────────────────
await test('SW-7: work.swept@1 is a journal-only receipt the sweep may append', () => {
  assert.equal(sql(`select projects::text from event_types where type='work.swept@1'`), 'false')
  const seq = append('work.swept@1', { found: { 'claim-lapsed': 1 }, told: 1, queued: 1, released: 0 }, null, { kind: 'system', id: 'abandoned-sweep' })
  assert.ok(Number(seq) > 0)
})

await test('every new projector and helper is no door; schema 97 is admitted as an archive source', () => {
  for (const f of ['apply_project_repo_kind(journal)', 'apply_withdrawn_answer_chain(journal)', 'apply_question_resolution(journal)', 'apply_comms_reply_delivery(journal)',
    'apply_projection_times(journal)', 'board_epoch_age_limit(uuid)', 'board_reply_recipient(uuid,uuid,uuid)', 'board_responder_live(uuid,uuid,text)'])
    for (const role of ['anon', 'authenticated', 'service_role'])
      assert.equal(sql(`select has_function_privilege('${role}', '${f}', 'execute')`), 'f', `${role} ${f}`)
  assert.match(sql(`select pg_get_functiondef('ceo_private_archive_canonical(jsonb)'::regprocedure)`), /'97'::jsonb/)
  assert.ok(Number(sql('select schema_version()')) >= 97)
})

console.log(`${count} passed, ${failed.length} failed`)
if (failed.length) { console.log('FAILED: ' + failed.join('; ')); process.exit(1) }
// #endregion one-schema-step-test
