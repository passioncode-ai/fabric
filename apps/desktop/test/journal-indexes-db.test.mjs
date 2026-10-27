// CO-469 and CO-477 (the 0.3.15 release review, DA-4 and ER-10): the home's journal reads filter by type, time and a
// payload key, and before migration 126 each was a scan linear in the journal. On a journal of 200 000 events in two
// estates, each read is planned on an index and none reads the journal sequentially; the timings are printed.
// To WATCH this suite fail, run the runner with FABRIC_SKIP_MIGRATION=20261027000126_home_journal_indexes.sql.
// #region journal-indexes-test — docs: docs/evidence/plans/2026-10-27-release-1105-plan.md#landed-on-main
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-journal-indexes-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql = input => execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 << 20 }).trim()
let count = 0; const failed = []
const test = (name, fn) => {
  try { fn(); console.log('PASS ' + name); count++ } catch (e) { failed.push(name); console.log(`FAIL ${name}\n  ${String(e.message).split('\n').slice(0, 12).join('\n  ')}`) }
}
const E = '99000000-0000-4000-8000-000000000001', F = '99000000-0000-4000-8000-000000000002'

// Two estates, 200 000 events spread over 30 days; the families the home reads are a small share, as live.
sql(`
alter table journal disable trigger user;
insert into journal (estate_id, seq, type, actor, payload, occurred_at, schema_rev)
select case when g % 4 = 0 then '${F}'::uuid else '${E}'::uuid end, g,
  (array['session.heartbeat@1','session.turn.observed@1','task.moved@1','task.closed@1','session.enrolled@1',
         'comms.message_submitted@1','comms.request_transitioned@1','tool.called@1','tool.called@1','tool.called@1'])[1 + g % 10],
  jsonb_build_object('kind', case when g % 7 = 0 then 'person' else 'agent' end, 'id', 'a' || (g % 50)),
  jsonb_build_object('session_id', 's' || (g % 300), 'runtime_session_id', 'r' || g, 'to', case when g % 3 = 0 then 'review' else 'running' end,
    'outcome', 'done', 'kind', case when g % 2 = 0 then 'request' else 'message' end, 'request_id', 'q' || g, 'message_id', 'm' || g),
  now() - make_interval(secs => (200000 - g) * 13), '1'
from generate_series(1, 200000) g;
alter table journal enable trigger user;
analyze journal;`)

const plan = q => sql(`set enable_seqscan = off; explain (format text) ${q}`) // seqscan off only to SHOW an index exists
const planOn = q => sql(`explain (format text) ${q}`)
const ms = q => { const t = Date.now(); sql(q); return Date.now() - t }
const since = `now() - interval '28 days'`
const reads = {
  'the rhythm window start (workRhythm.ts#windowStartSeq)': `select seq from journal where estate_id = '${E}' and occurred_at >= ${since} order by seq asc limit 1`,
  'the rhythm marks (workRhythm.ts#marks)': `select type, occurred_at, actor, payload from journal where estate_id = '${E}' and type = 'task.moved@1' and payload->>'to' = 'review' and occurred_at >= ${since} order by seq desc limit 1000`,
  'the turns (agentWork.ts)': `select occurred_at, payload from journal where estate_id = '${E}' and type = 'session.turn.observed@1' and occurred_at >= now() - interval '1 hour' order by seq desc limit 1000`,
  'the enrolments by runtime id (agentIdentity.ts)': `select payload from journal where estate_id = '${E}' and type = 'session.enrolled@1' and payload->>'runtime_session_id' in ('r5','r15','r25','r199995') order by seq desc limit 500`,
  'the requests waiting (commsWaitingList.ts)': `select occurred_at, payload from journal where estate_id = '${E}' and type = 'comms.message_submitted@1' and payload->>'kind' = 'request' and occurred_at >= now() - interval '14 days' order by seq desc limit 1000`
}

for (const [name, q] of Object.entries(reads)) {
  test(`${name} reads on an index, never a sequential scan of the journal`, () => {
    const p = planOn(q)
    assert.doesNotMatch(p, /Seq Scan on journal/, p)
    assert.match(plan(q), /Index (Only )?Scan|Bitmap Index Scan/, 'no index answers this read')
    console.log(`  ${ms(q)} ms`)
  })
}

test('the indexes migration 126 adds exist with their names', () => {
  const names = sql(`select indexname from pg_indexes where tablename = 'journal' and indexname in ('journal_by_type','journal_enrolments_by_runtime') order by 1`).split('\n')
  assert.deepEqual(names, ['journal_by_type', 'journal_enrolments_by_runtime'])
})

console.log(`${count} passed, ${failed.length} failed`)
if (failed.length) process.exit(1)
// #endregion journal-indexes-test
