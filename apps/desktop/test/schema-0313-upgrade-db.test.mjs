// 0.3.13's one schema step as an UPGRADE (96 to 97): rows an older build could leave are planted at schema 96, then
// migration 124 is applied as `supabase migration up` applies it, and what it corrects is read back (CO-341, CO-355,
// CO-357, CO-418). The fresh-chain behaviour is schema-0313-db.test.mjs's.
// #region one-schema-step-upgrade-test — docs: docs/launch/release-mac.md#upgrading-an-existing-database
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-schema-0313-upgrade-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const psqlArgs = [url, '-X', '-q', '-t', '-A', '-F', '|', '-v', 'ON_ERROR_STOP=1']
const sql = input => execFileSync('psql', psqlArgs, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const MIGRATION = fileURLToPath(new URL('../../../supabase/migrations/20261026000124_one_schema_step.sql', import.meta.url))
const HELD = fileURLToPath(new URL('../../../supabase/migrations/20261026000125_board_reader_count_held.sql', import.meta.url))
const id = n => `97100000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = id(1), P = id(11), Q = id(12)
const lit = v => `'${String(v).replace(/'/g, "''")}'`
const j = v => `${lit(JSON.stringify(v))}::jsonb`
const append = (type, payload, project = null, actor = { kind: 'system', id: 'upgrade-probe' }) =>
  sql(`set role service_role; select seq from append_event('${E}','${type}',${j(actor)},${j(payload)},'1',${project ? `'${project}'` : 'null'})`)
let n = 100
const next = () => id(n++)

assert.equal(sql('select schema_version()'), '96', 'the chain stops before migration 124')
sql(`insert into persons (id, display_name) values ('${id(91)}', 'owner')`)
append('estate.created@1', { name: 'upgrade estate', owner_person_id: id(91) })
append('project.created@1', { id: P, name: 'first' }, P)
append('project.created@1', { id: Q, name: 'second' }, Q)

// CO-341: a database where migration 113 skipped the index, holding one folder twice.
const kept = next(), dup = next(), other = next()
append('project.repo.attached@1', { id: kept, path: '/w/twice', label: 'twice' }, P)
append('project.repo.attached@1', { id: other, path: '/w/other', label: 'other' }, Q)
sql(`drop index project_repos_unique_estate_path`)
// The second holder became its project's primary (one primary per project), the project's own folder demoted.
sql(`update project_repos set is_primary = false where id = '${other}'`)
sql(`insert into project_repos (id, estate_id, project_id, path, label, is_primary, attached_at, kind)
     values ('${dup}', '${E}', '${Q}', '/w/twice', 'twice again', true, now() + interval '1 minute', 'checkout')`)
// A promoted folder whose kind did not follow (0.3.7 review DA-4 b).
sql(`update project_repos set kind = 'checkout' where id = '${kept}'`)

// CO-418 (W2-4): an agent's business written after the person's, as the projector of 0.3.12 kept it.
append('project.profiled@1', { business: 'PassionCode' }, P, { kind: 'person', id: 'operator' })
append('project.profiled@1', { business: 'Agent guess' }, P, { kind: 'agent', id: 'onboarding' })
assert.equal(sql(`select business from projects where id='${P}'`), 'Agent guess')

// CO-418 (i3 DA-2): a delivery written at another moment than its event.
const t = next(), d = next()
append('task.created@1', { id: t, title: 'Deliver' }, P)
append('delivery.queued@1', { delivery_id: d, task_id: t, session_id: next(), input_digest: 'sha256:' + '2'.repeat(64) }, P)
sql(`update deliveries set created_at = created_at + interval '3 hours' where delivery_id='${d}'`)

// CO-357: an answered question whose resolution a rebuild lost.
const qid = next()
sql(`select append_event('${E}','question.asked@1','{"kind":"agent","id":"s"}',${j({ id: qid, project_id: P, text: 'Which?', kind: 'decision', options: [], blocks: [] })},'1','${P}')`)
const first = JSON.parse(sql(`select answer_question('${E}','${P}','${qid}','${next()}',1,'one',null,null,'{"kind":"person","id":"operator"}')`))
sql(`select reopen_answered_question('${E}','${P}','${qid}','${next()}','{"kind":"person","id":"operator"}')`)
JSON.parse(sql(`select answer_question('${E}','${P}','${qid}','${next()}',2,'two',null,null,'{"kind":"person","id":"operator"}')`))
sql(`select rebuild_estate_projections('${E}')`)
assert.equal(sql(`select coalesce(resolution_id::text,'null') from questions where id='${qid}'`), 'null', 'the defect is planted: a rebuild lost it')

// CO-355: a decision corrected in Memory, then its answer taken back, at schema 96.
const q2 = next()
sql(`select append_event('${E}','question.asked@1','{"kind":"agent","id":"s"}',${j({ id: q2, project_id: P, text: 'Store?', kind: 'decision', options: [], blocks: [] })},'1','${P}')`)
const a2 = JSON.parse(sql(`select answer_question('${E}','${P}','${q2}','${next()}',1,'Postgres',null,null,'{"kind":"person","id":"operator"}')`))
const fix = next()
append('memory.project.recorded@1', { id: fix, claim: 'Postgres 17', source_ref: 'memory:correction', kind: 'decision', supersedes: a2.decision_id }, P, { kind: 'person', id: 'operator' })
sql(`select reopen_answered_question('${E}','${P}','${q2}','${next()}','{"kind":"person","id":"operator"}')`)
assert.equal(sql(`select (valid_to is null)::text from memory_facts where id='${fix}'`), 'true', 'the defect is planted: the correction stayed current')
void first

// ── the upgrade ──
execFileSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', MIGRATION], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
sql(`insert into supabase_migrations.schema_migrations values ('20261026000124')`)
assert.equal(sql('select schema_version()'), '97')

const repos = sql(`select id||':'||project_id||':'||is_primary||':'||kind from project_repos where estate_id='${E}' order by path, id`).split('\n')
assert.deepEqual(repos, [`${other}:${Q}:true:primary`, `${kept}:${P}:true:primary`], 'the folder stays with its first attach; the project that lost one promotes its other; kinds follow')
assert.equal(sql(`select count(*) from pg_indexes where indexname='project_repos_unique_estate_path'`), '1', 'the index exists after the merge')
assert.equal(sql(`select repo_path from projects where id='${Q}'`), '/w/other')
assert.equal(sql(`select business||'|'||business_set_by from projects where id='${P}'`), 'PassionCode|person', 'the business is replayed under the person\'s rule')
assert.equal(sql(`select (d.created_at = j.occurred_at)::text from deliveries d join journal j on j.estate_id=d.estate_id and j.seq=d.queued_seq where d.delivery_id='${d}'`), 'true')
assert.notEqual(sql(`select coalesce(resolution_id::text,'null') from questions where id='${qid}'`), 'null', 'the resolution is filled again')
assert.equal(sql(`select (valid_to is not null and withdrawn_seq is not null)::text from memory_facts where id='${fix}'`), 'true', 'the correction is closed by the withdrawal')
// Migration 125 (DEC-0135 DR-4, CO-437) after 124, as `supabase migration up` applies both: schema 98, and the board's
// readers count every message their Project did not send again.
execFileSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', HELD], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
sql(`insert into supabase_migrations.schema_migrations values ('20261026000125')`)
assert.equal(sql('select schema_version()'), '98')
assert.doesNotMatch(sql(`select pg_get_functiondef('board_status(uuid,uuid)'::regprocedure)`), /board_deliveries/, 'com.status counts messages, not deliveries')
sql(`select rebuild_estate_projections('${E}')`)
console.log('PASS 10 upgrade checks: duplicates merged and indexed, kinds, business, times, resolution, withdrawn chain')
// #endregion one-schema-step-upgrade-test
