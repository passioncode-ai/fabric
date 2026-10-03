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
import { execFileSync, spawn } from 'node:child_process'

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
const append = (estate, type, payload, project = null, actor = system) =>
  `select append_event('${estate}','${type}',${actor},'${JSON.stringify(payload)}','1',${project ? `'${project}'` : 'null'})`

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

// ── migration 72: hand-offs, heartbeats, and every other create (release review iteration 2, data finding 1 and 6) ──
//
// Migration 70's header said it covered every overwrite keyed on a global id and that `apply_heartbeats`
// already carried the predicate. Neither was true: the review appended B's `task.handoff@1` naming A's task
// and A's row came back "WRITTEN BY B"; B's `agent.heartbeat@1` naming A's session moved the row to estate B.
// To WATCH these fail, run the runner with FABRIC_SKIP_MIGRATION=20261003000072_handoff_heartbeat_estate.sql.
const HB_SESSION = uuid(17), TASK_SESSION = uuid(18)
sql(append(A, 'task.handoff@1', { task_id: TASK, name: 'report', value: 'written by A' }, P))
sql(append(A, 'agent.heartbeat@1', { session_id: HB_SESSION, beat_seq: 1, phase: 'working' }, P))
const handoffOfA = () => sql(`select value||'|'||estate_id from task_handoffs where task_id='${TASK}' and name='report'`)
const heartbeatOfA = () => sql(`select beat_seq||'|'||phase||'|'||estate_id from session_heartbeats where session_id='${HB_SESSION}'`)

test('estate B cannot overwrite A\'s hand-off: refused at the door, A\'s value stands', () => {
  const said = refusal(append(B, 'task.handoff@1', { task_id: TASK, name: 'report', value: 'WRITTEN BY B' }, Q))
  assert.ok(said, 'B\'s hand-off naming A\'s task was ACCEPTED — the finding itself')
  assert.match(said, /project_tasks id that belongs to another estate/)
  assert.doesNotMatch(said, new RegExp(A), 'the refusal names the estate that owns the id')
  assert.equal(handoffOfA(), `written by A|${A}`)
})

test('estate B cannot move A\'s heartbeat into B: refused at the door, the row stays A\'s', () => {
  const said = refusal(append(B, 'agent.heartbeat@1', { session_id: HB_SESSION, beat_seq: 9, phase: 'blocked' }, Q))
  assert.ok(said, 'B\'s heartbeat naming A\'s session was ACCEPTED — the finding itself')
  assert.match(said, /session_heartbeats id that belongs to another estate/)
  assert.equal(heartbeatOfA(), `1|working|${A}`)
})

test('a session A\'s task holds cannot be claimed by B\'s first heartbeat (it would starve A\'s beats)', () => {
  sql(`update project_tasks set session_id='${TASK_SESSION}' where id='${TASK}'`)
  const said = refusal(append(B, 'agent.heartbeat@1', { session_id: TASK_SESSION, beat_seq: 1, phase: 'working' }, Q))
  assert.ok(said, 'B created the heartbeat row for a session A\'s task holds')
  assert.match(said, /session that belongs to another estate/)
  assert.equal(sql(`select count(*) from session_heartbeats where session_id='${TASK_SESSION}'`), '0')
})

test('a hand-off or heartbeat ALREADY in B\'s journal replays without touching A (the upserts carry the estate)', () => {
  let seq = Number(sql(`select coalesce(max(seq),0) from journal where estate_id='${B}'`))
  for (const [type, payload] of [
    ['task.handoff@1', { task_id: TASK, name: 'report', value: 'WRITTEN BY B ON REPLAY' }],
    ['agent.heartbeat@1', { session_id: HB_SESSION, beat_seq: 99, phase: 'blocked' }]
  ])
    sql(`insert into journal (estate_id, seq, type, schema_rev, actor, project_id, payload)
         values ('${B}', ${++seq}, '${type}', '1', ${system}, '${Q}', '${JSON.stringify(payload)}')`)
  sql(`select rebuild_estate_projections('${B}')`)
  assert.equal(handoffOfA(), `written by A|${A}`, 'a replay of B rewrote A\'s hand-off')
  assert.equal(heartbeatOfA(), `1|working|${A}`, 'a replay of B moved A\'s heartbeat')
})

test('A\'s own hand-off and heartbeat still update (the predicate is not a freeze)', () => {
  sql(append(A, 'task.handoff@1', { task_id: TASK, name: 'report', value: 'corrected by A' }, P))
  sql(append(A, 'agent.heartbeat@1', { session_id: HB_SESSION, beat_seq: 2, phase: 'verifying' }, P))
  assert.equal(handoffOfA(), `corrected by A|${A}`)
  assert.equal(heartbeatOfA(), `2|verifying|${A}`)
  // and restore the observed values for the checks after this one
  sql(append(A, 'task.handoff@1', { task_id: TASK, name: 'report', value: 'written by A' }, P))
})

test('EVERY create keyed on a global id refuses another estate\'s id, not only the seven upserts (finding 6)', () => {
  // The `on conflict (id) do nothing` arms never overwrote A — they journalled a fact in B that no
  // projection of B will ever show. Each is now refused at the door, the way migration 70 refuses a project.
  const G = uuid(40), AG = uuid(41), RT = uuid(42), PR = uuid(43), QU = uuid(44), RL = uuid(45),
        TC = uuid(46), NOTE = uuid(47), RUN = uuid(48), DL = uuid(49), RET = uuid(50)
  const creates = [
    ['goal.defined@1', { id: G, title: 'a goal of A' }, 'goals'],
    ['agent.registered@1', { id: AG, project_id: P, name: 'scribe', runner_id: 'claude-code', instructions: 'write' }, 'agent_bindings'],
    ['routine.defined@1', { id: RT, project_id: P, instruction: 'tick', option_id: 'shell', every_minutes: 60 }, 'routines'],
    ['proposal.filed@1', { id: PR, project_id: P, title: 'a proposal', depth: 0, bound: 3 }, 'proposals'],
    ['question.asked@1', { id: QU, project_id: P, text: 'which?', why_blocked: 'because' }, 'questions'],
    ['release.recorded@1', { id: RL, name: 'v1', environment: 'production', task_ids: [], decision_ids: [] }, 'releases'],
    ['task.created@1', { id: TC, title: 'a task of A', instruction: 'do it' }, 'project_tasks'],
    ['task.note.added@1', { note_id: NOTE, task_id: TASK, body_md: 'a note' }, 'task_notes'],
    ['run.started@1', { task_run_id: RUN, task_id: TASK, run_ordinal: 1 }, 'task_runs'],
    ['delivery.queued@1', { delivery_id: DL, task_id: TASK, input_digest: 'd' }, 'deliveries'],
    ['memory.retrieved@1', { id: RET, store: 'facts', query: 'q', hits: 0 }, 'memory_retrievals']
  ]
  // A question is asked, and a release recorded, by a person or an agent (their `*_by_kind` checks), never the system.
  const actorOf = (type) => (['question.asked@1', 'release.recorded@1'].includes(type)
    ? `'{"kind":"person","id":"estate-identity-probe"}'` : system)
  for (const [type, payload, table] of creates) {
    sql(append(A, type, payload, P, actorOf(type)))
    const owned = sql(`select count(*) from ${table} where estate_id='${A}'`)
    assert.notEqual(owned, '0', `the fixture did not create A's ${table} row`)
  }
  const seqB = journalOf(B)
  for (const [type, payload, table] of creates) {
    const forB = { ...payload, ...(payload.project_id ? { project_id: Q } : {}) }
    const said = refusal(append(B, type, forB, Q, actorOf(type)))
    assert.ok(said, `${type} carrying A's ${table} id was journalled in B`)
    assert.match(said, new RegExp(`${table} id that belongs to another estate`), type)
  }
  assert.equal(journalOf(B), seqB, 'a refused create reached B\'s journal')
})

test('a malformed id still reaches the projector\'s own refusal, unchanged by the door', () => {
  const said = refusal(append(B, 'goal.defined@1', { id: 'not-a-uuid', title: 'x' }, Q))
  assert.ok(said)
  assert.match(said, /invalid input syntax for type uuid/)
})

// ── one agent per name, decided under the estate's append lock (finding 8) ──
const agentPayload = (id, name) => ({ id, project_id: P, name, runner_id: 'claude-code', instructions: 'help' })
const agentsCalled = (name) => sql(`select count(*) from agent_bindings where estate_id='${A}' and project_id='${P}' and lower(btrim(role))=lower('${name}')`)

test('a second created agent of the same name (trimmed, any case) is refused, and nothing is journalled', () => {
  sql(append(A, 'agent.registered@1', agentPayload(uuid(60), 'Scout'), P))
  const seqA = journalOf(A)
  const said = refusal(append(A, 'agent.registered@1', agentPayload(uuid(61), ' scout '), P))
  assert.ok(said, 'a second agent called scout was created')
  assert.match(said, /this project already has an agent called scout/)
  assert.equal(journalOf(A), seqA, 'the refused create reached the journal')
  assert.equal(agentsCalled('scout'), '1')
})

test('a pair recorded before the rule still replays (the guard is at the door, never in the projector)', () => {
  let seq = Number(sql(`select coalesce(max(seq),0) from journal where estate_id='${A}'`))
  sql(`insert into journal (estate_id, seq, type, schema_rev, actor, project_id, payload)
       values ('${A}', ${++seq}, 'agent.registered@1', '1', ${system}, '${P}', '${JSON.stringify(agentPayload(uuid(62), 'SCOUT'))}')`)
  sql(`select rebuild_estate_projections('${A}')`)
  assert.equal(agentsCalled('scout'), '2', 'the legacy pair did not replay')
})

const psqlAsync = (input) => new Promise((resolve) => {
  const child = spawn('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'] })
  let err = ''
  child.stderr.on('data', (d) => { err += d })
  child.on('close', (code) => resolve({ code, err }))
  child.stdin.end(input)
})

const agentRace = await (async () => {
  // Two creates of one name, in two sessions, overlapping: the first holds its transaction open after the
  // append. Read-then-append let both through; under the lock the second waits, then reads the first's row.
  const hold = (id, name) => `begin; ${append(A, 'agent.registered@1', agentPayload(id, name), P)}; select pg_sleep(1.5); commit;`
  const first = psqlAsync(hold(uuid(63), 'Twin'))
  await new Promise((r) => setTimeout(r, 300))
  const second = psqlAsync(hold(uuid(64), 'twin'))
  return Promise.all([first, second])
})()
test('two overlapping creates of one name produce ONE agent: the second waits for the lock and is refused', () => {
  const [first, second] = agentRace
  assert.equal(first.code, 0, first.err)
  assert.notEqual(second.code, 0, 'both overlapping creates committed — the read-then-append race')
  assert.match(second.err, /already has an agent called twin/)
  assert.equal(agentsCalled('twin'), '1')
})

test('the hot journal lookups can use their partial indexes (finding 5)', () => {
  const plan = (q) => sql(`set enable_seqscan = off; explain ${q}`)
  const cases = [
    ['chain_dispatch_by_follower', `select count(*) from journal where estate_id='${A}' and type='chain.dispatch@1' and payload->>'id'='${TASK}' and payload->>'phase'='failed'`],
    ['routine_paused_by_subject', `select count(*) from journal where estate_id='${A}' and type='routine.paused@1' and payload->>'id'='${TASK}' and payload->>'reason_code'='launch-retries-exhausted'`],
    ['task_admitted_session', `select * from journal where type='task.admitted@1' and payload->>'session_id'='${SESSION}' order by seq limit 1`],
    ['task_runs_by_session', `select 1 from task_runs where session_id='${SESSION}'`]
  ]
  for (const [index, q] of cases) {
    const p = plan(q)
    const line = p.split('\n').find((l) => l.includes(index))
    assert.ok(line, `${index} is not used:\n${p}`)
    console.log(`     plan: ${line.trim()}`)
  }
})

test('the door is not an API: no role may call the guard directly', () => {
  for (const role of ['anon', 'authenticated', 'service_role'])
    for (const fn of ['refuse_foreign_identity(uuid,text,jsonb,uuid)', 'refuse_taken_agent_name(uuid,text,jsonb)', 'identity_uuid(text)'])
      assert.equal(sql(`select has_function_privilege('${role}','${fn}','execute')`), 'f', `${role} ${fn}`)
})

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall green: an id names one estate\'s row, at the door and on replay')
