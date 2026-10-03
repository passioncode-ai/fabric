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
// A hex letter in every fixture id, so a spelling in upper case differs from the canonical one (migration 74).
const uuid = (n) => `7000000a-0000-4000-8000-${String(n).padStart(12, '0')}`
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

// ── migration 73: a session belongs to the estate that holds it ANYWHERE (release review iteration 3) ──
//
// Migration 72 refused a heartbeat only when another estate's task held the session in
// `project_tasks.session_id`. A managed launch records its session in `task_runs.session_id`
// (migration 62), so after `admit_task_launch(A, …, S)` estate B's first heartbeat for S was ACCEPTED,
// the row became B's, and A's next beat was refused. The stage, transcript and context-pack arms each
// looked only at their own table. To WATCH these fail, run the runner with
// FABRIC_SKIP_MIGRATION=20261003000073_session_owner_at_the_door.sql.
// #region session-owner-at-the-door — docs: docs/adr/0103-an-id-belongs-to-one-estate-at-the-write-boundary.md#decision
const MANAGED_TASK = uuid(80), MANAGED_SESSION = uuid(81), CAPTURED_SESSION = uuid(82)
sql(append(A, 'task.created@1', { id: MANAGED_TASK, title: 'a managed launch', instruction: 'run me' }, P))
const admitted = JSON.parse(sql(`select admit_task_launch('${A}','${MANAGED_TASK}',${system},'${MANAGED_SESSION}','operator')`))
const sessionRefusals = (session) => [
  ['agent.heartbeat@1', { session_id: session, beat_seq: 1, phase: 'working' }],
  ['agent.stage.reported@1', { session_id: session, stage: 'hijacked' }],
  ['transcript.captured@1', { session_id: session, sha256: 'd'.repeat(64), bytes: 1, lines: 1 }],
  ['context.compiled@1', { session_id: session, sha256: 'e'.repeat(64), chars: 1 }]
]

test('admit_task_launch: a session A launched is A\'s — B\'s heartbeat, stage, transcript and context pack are refused', () => {
  assert.equal(admitted.admitted, true, `the fixture launch was not admitted: ${JSON.stringify(admitted)}`)
  assert.equal(sql(`select count(*) from project_tasks where session_id='${MANAGED_SESSION}'`), '0',
    'the fixture must hold the session ONLY in task_runs, as a managed launch does')
  const seqB = journalOf(B)
  for (const [type, payload] of sessionRefusals(MANAGED_SESSION)) {
    const said = refusal(append(B, type, payload, Q))
    assert.ok(said, `${type} from B for a session A's managed launch holds was ACCEPTED — the finding itself`)
    assert.match(said, /session that belongs to another estate/, type)
    assert.doesNotMatch(said, new RegExp(A), 'the refusal names the estate that owns the session')
  }
  assert.equal(journalOf(B), seqB, 'a refused session event reached B\'s journal')
  // and A's own beat still lands, as A's
  sql(append(A, 'agent.heartbeat@1', { session_id: MANAGED_SESSION, beat_seq: 1, phase: 'working' }, P))
  assert.equal(sql(`select estate_id from session_heartbeats where session_id='${MANAGED_SESSION}'`), A)
})

test('a session A holds only in session_transcripts cannot be beaten, staged or packed from B', () => {
  sql(append(A, 'transcript.captured@1', { session_id: CAPTURED_SESSION, sha256: 'f'.repeat(64), bytes: 1, lines: 1 }, P))
  for (const [type, payload] of sessionRefusals(CAPTURED_SESSION).filter(([t]) => t !== 'transcript.captured@1')) {
    const said = refusal(append(B, type, payload, Q))
    assert.ok(said, `${type} from B for a session A holds in session_transcripts was ACCEPTED`)
    assert.match(said, /session that belongs to another estate/, type)
  }
})

const crossEstateRace = await (async () => {
  // Two DIFFERENT estates creating one new global id at once. The estate lock serialises appends of one
  // estate only, and the door read before it: both passed, and the second create committed in its
  // journal a fact no projection of its estate shows. Each session holds its transaction open.
  const NEW_PROJECT = uuid(90), NEW_SESSION = uuid(91)
  const hold = (estate, type, payload, project) => `begin; ${append(estate, type, payload, project)}; select pg_sleep(1.5); commit;`
  // One race at a time: two appends of A would otherwise queue on A's estate lock and reorder the second race.
  const race = async (first, second) => {
    const a = psqlAsync(first)
    await new Promise((r) => setTimeout(r, 300))
    return Promise.all([a, psqlAsync(second)])
  }
  const [fp, sp] = await race(hold(A, 'project.created@1', { id: NEW_PROJECT, name: 'raced by A' }, NEW_PROJECT),
                              hold(B, 'project.created@1', { id: NEW_PROJECT, name: 'raced by B' }, NEW_PROJECT))
  const [fb, sb] = await race(hold(A, 'agent.heartbeat@1', { session_id: NEW_SESSION, beat_seq: 1, phase: 'working' }, P),
                              hold(B, 'agent.heartbeat@1', { session_id: NEW_SESSION, beat_seq: 1, phase: 'working' }, Q))
  return { NEW_PROJECT, NEW_SESSION, results: [fp, fb, sp, sb] }
})()
test('two estates creating one new project id at once: the second waits on the id and is refused (coordinator item A)', () => {
  const { NEW_PROJECT, results: [fp, , sp] } = crossEstateRace
  assert.equal(fp.code, 0, fp.err)
  assert.notEqual(sp.code, 0, 'both estates committed a create of one project id — the door raced')
  assert.match(sp.err, /belongs to another estate/)
  assert.equal(sql(`select count(*) from journal where estate_id='${B}' and payload->>'id'='${NEW_PROJECT}'`), '0', 'a raced create reached B\'s journal')
})

test('two estates beating one new session at once: the second waits on the session and is refused (coordinator item A)', () => {
  const { NEW_SESSION, results: [, fb, , sb] } = crossEstateRace
  assert.equal(fb.code, 0, fb.err)
  assert.notEqual(sb.code, 0, 'both estates committed a first heartbeat of one session — the door raced')
  assert.match(sb.err, /belongs to another estate/)
  assert.equal(sql(`select count(*) from journal where estate_id='${B}' and payload->>'session_id'='${NEW_SESSION}'`), '0', 'a raced beat reached B\'s journal')
})

test('an import of a workspace holding "Reviewer" and "reviewer" lands whole, without losing either (finding 2)', () => {
  const D = uuid(4), PD = uuid(92)
  const events = JSON.stringify([
    { type: 'project.created@1', project_id: PD, payload: { id: PD, name: 'imported' } },
    { type: 'agent.registered@1', project_id: PD, payload: { id: uuid(93), project_id: PD, name: 'Reviewer', runner_id: 'claude-code', instructions: 'review it' } },
    { type: 'agent.registered@1', project_id: PD, payload: { id: uuid(94), project_id: PD, name: 'reviewer', runner_id: 'claude-code', instructions: 'review it too' } }
  ])
  const said = refusal(`select import_declared_snapshot('${D}','${uuid(95)}','digest',${system},'${events}')`)
  assert.equal(said, null, `the import was refused whole: ${said}`)
  assert.equal(sql(`select string_agg(role, ',' order by role) from agent_bindings where estate_id='${D}'`), 'Reviewer,reviewer')
  // The exemption is the import's own transaction: an ordinary create of the same name afterwards is refused.
  const later = refusal(`select append_event('${D}','agent.registered@1',${system},'${JSON.stringify({ id: uuid(96), project_id: PD, name: 'REVIEWER', runner_id: 'claude-code', instructions: 'a third' })}','1','${PD}')`)
  assert.ok(later, 'the import exemption leaked past its transaction')
  assert.match(later, /already has an agent called REVIEWER/)
  assert.equal(sql(`select count(*) from declared_import_authorizations`), '0', 'an import authorisation outlived its transaction')
})

test('a heartbeat row the old projector moved into another estate is repaired from the owner\'s journal (finding 3)', () => {
  const S = MANAGED_SESSION
  // What the projector before migration 72 left behind: B's beat moved A's row into B, and B's journal holds it.
  sql(`update session_heartbeats set estate_id='${B}', project_id='${Q}', beat_seq=50, phase='blocked' where session_id='${S}'`)
  const seq = Number(sql(`select coalesce(max(seq),0) from journal where estate_id='${B}'`)) + 1
  sql(`insert into journal (estate_id, seq, type, schema_rev, actor, project_id, payload)
       values ('${B}', ${seq}, 'agent.heartbeat@1', '1', ${system}, '${Q}', '${JSON.stringify({ session_id: S, beat_seq: 50, phase: 'blocked' })}')`)
  assert.equal(sql(`select repair_foreign_heartbeats()`), '1', 'the moved row was not repaired')
  const row = () => sql(`select estate_id||'|'||project_id||'|'||beat_seq||'|'||phase from session_heartbeats where session_id='${S}'`)
  assert.equal(row(), `${A}|${P}|1|working`, 'the repaired row is not the owner\'s last beat')
  assert.equal(sql(`select repair_foreign_heartbeats()`), '0', 'the repair is not idempotent')
  sql(`select rebuild_estate_projections('${B}')`)
  assert.equal(row(), `${A}|${P}|1|working`, 'a rebuild of B took the managed session\'s heartbeat back')
  sql(append(A, 'agent.heartbeat@1', { session_id: S, beat_seq: 2, phase: 'verifying' }, P))
  assert.equal(row(), `${A}|${P}|2|verifying`, 'A\'s next beat did not land after the repair')
})

test('the name rule folds case beyond ASCII, as the form does: ÄRZT and ärzt, ΟΔΟΣ and οδοσ are one name (finding 7)', () => {
  for (const [first, second, n] of [['ÄRZT', 'ärzt', 97], ['ΟΔΟΣ', 'οδοσ', 99]]) {
    sql(append(A, 'agent.registered@1', agentPayload(uuid(n), first), P))
    const said = refusal(append(A, 'agent.registered@1', agentPayload(uuid(n + 1), second), P))
    assert.ok(said, `a second agent called ${second} was created beside ${first}`)
    assert.match(said, /already has an agent called/)
  }
})
// #endregion session-owner-at-the-door

// ── migration 74: the door compares exactly what the projector stores (confirmation pass after iteration 3) ──
//
// Migration 72's `identity_uuid` matched only the hyphenated pattern, while every projector casts with
// `::uuid`, which also takes 32 bare hex digits, a `{braced}` id and hyphens after any group of four. The
// reviewer, on an owned cluster: B's heartbeat and stage naming A's session WITHOUT HYPHENS or BRACED were
// accepted, the stage row moved to B, and A's own canonical beat and stage were then refused; a braced
// transcript took a new session before A's launch could; `project.created@1` with A's project id without
// hyphens was journalled in B. To WATCH these fail, run the runner with
// FABRIC_SKIP_MIGRATION=20261003000074_canonical_ids_at_the_door.sql.
// #region canonical-ids-at-the-door — docs: docs/adr/0103-an-id-belongs-to-one-estate-at-the-write-boundary.md#decision
const spellings = (id) => {
  const forms = {
    'without hyphens': id.replaceAll('-', ''),
    braced: `{${id}}`,
    'in upper case': id.toUpperCase(),
    'hyphenated every four digits': id.replaceAll('-', '').match(/.{4}/g).join('-')
  }
  for (const [how, spelled] of Object.entries(forms)) assert.notEqual(spelled, id, `the fixture spelled ${how} is the canonical id`)
  return forms
}

test('identity_uuid answers the canonical uuid for every spelling ::uuid accepts, and null for anything else', () => {
  for (const [how, spelled] of Object.entries(spellings(MANAGED_SESSION)))
    assert.equal(sql(`select identity_uuid('${spelled}')`), MANAGED_SESSION, how)
  for (const junk of ['not-a-uuid', ` ${MANAGED_SESSION}`, `{${MANAGED_SESSION}`, ''])
    assert.equal(sql(`select coalesce(identity_uuid('${junk}')::text, 'null')`), 'null', JSON.stringify(junk))
})

test('B cannot take A\'s session by spelling it differently: heartbeat, stage, transcript and context pack are refused', () => {
  const seqB = journalOf(B)
  const stageOfA = () => sql(`select estate_id||'|'||stage from agent_stages where session_id='${STAGE_SESSION}'`)
  const stageBefore = stageOfA()
  for (const [how, spelled] of Object.entries(spellings(MANAGED_SESSION)))
    for (const [type, payload] of sessionRefusals(spelled)) {
      const said = refusal(append(B, type, payload, Q))
      assert.ok(said, `${type} from B naming A's managed session ${how} was ACCEPTED — the finding itself`)
    }
  for (const [how, spelled] of Object.entries(spellings(STAGE_SESSION))) {
    const said = refusal(append(B, 'agent.stage.reported@1', { session_id: spelled, stage: 'hijacked' }, Q))
    assert.ok(said, `B's stage naming A's stage session ${how} was ACCEPTED`)
  }
  assert.equal(journalOf(B), seqB, 'a refused session event reached B\'s journal')
  assert.equal(stageOfA(), stageBefore, 'A\'s stage row moved')
  assert.equal(sql(`select estate_id from session_heartbeats where session_id='${MANAGED_SESSION}'`), A, 'A\'s heartbeat row moved')
  // and A, writing canonically, is still the owner
  const beat = Number(sql(`select beat_seq from session_heartbeats where session_id='${MANAGED_SESSION}'`)) + 1
  sql(append(A, 'agent.heartbeat@1', { session_id: MANAGED_SESSION, beat_seq: beat, phase: 'working' }, P))
  sql(append(A, 'agent.stage.reported@1', { session_id: STAGE_SESSION, stage: 'the original stage' }, P))
})

test('a create carrying A\'s id spelled differently is refused — project, fact, task, hand-off, goal', () => {
  const seqB = journalOf(B)
  for (const [how, spelled] of [...Object.entries(spellings(P))]) {
    const said = refusal(append(B, 'project.created@1', { id: spelled, name: 'HIJACKED' }, null))
    assert.ok(said, `project.created@1 in B with A's project id ${how} was ACCEPTED — the finding itself`)
  }
  for (const [how, spelled] of Object.entries(spellings(FACT)))
    assert.ok(refusal(append(B, 'memory.project.recorded@1', { id: spelled, claim: 'rewritten from B' }, Q)), `fact ${how}`)
  for (const [how, spelled] of Object.entries(spellings(TASK))) {
    assert.ok(refusal(append(B, 'task.started@1', { id: spelled, instruction: 'rewritten from B', option_id: 'shell' }, Q)), `task ${how}`)
    assert.ok(refusal(append(B, 'task.handoff@1', { task_id: spelled, name: 'report', value: 'WRITTEN BY B' }, Q)), `hand-off ${how}`)
  }
  assert.equal(journalOf(B), seqB, 'a refused create reached B\'s journal')
  assert.equal(projectOfA(), atlas)
  assert.equal(factOfA(), fact)
  assert.equal(handoffOfA(), `written by A|${A}`)
})

test('a NEW id in any non-canonical spelling is refused, so the journal never holds one and a later launch is not blocked', () => {
  const S2 = uuid(110), T2 = uuid(111), G2 = uuid(112)
  const seqB = journalOf(B)
  for (const [how, spelled] of Object.entries(spellings(S2))) {
    const said = refusal(append(B, 'transcript.captured@1', { session_id: spelled, sha256: 'a'.repeat(64), bytes: 1, lines: 1 }, Q))
    assert.ok(said, `a transcript for a new session written ${how} was ACCEPTED`)
    assert.match(said, /non-canonical/, how)
  }
  for (const [key, value] of [['id', G2.toUpperCase()], ['project_id', `{${Q}}`], ['task_id', TASK.replaceAll('-', '')]])
    assert.ok(refusal(append(B, 'goal.defined@1', { id: G2, title: 'g', [key]: value }, Q)), `goal.defined@1 with ${key} ${value}`)
  assert.equal(journalOf(B), seqB, 'a non-canonical id reached B\'s journal')
  assert.equal(sql(`select count(*) from session_transcripts where session_id='${S2}'`), '0')
  // A's managed launch of that session is admitted: nothing took it first.
  sql(append(A, 'task.created@1', { id: T2, title: 'launch after a refused capture', instruction: 'run' }, P))
  const got = JSON.parse(sql(`select admit_task_launch('${A}','${T2}',${system},'${S2}','operator')`))
  assert.equal(got.admitted, true, JSON.stringify(got))
})

test('a malformed id that ::uuid refuses is still left to the projector, not to the spelling rule', () => {
  const said = refusal(append(B, 'goal.defined@1', { id: '{not-a-uuid}', title: 'x' }, Q))
  assert.ok(said)
  assert.match(said, /invalid input syntax for type uuid/)
})

test('the name rule trims exactly the whitespace the form trims (JS String#trim), and nothing more', () => {
  // `agentSpec.ts#nameKey` trims with JS `trim`: Unicode White_Space-ish set of ECMAScript (WhiteSpace + LineTerminator).
  // Computed here from the runtime, not copied, so a drift between the two is caught.
  const jsSpace = []
  for (let c = 0; c <= 0xffff; c++) if ((c < 0xd800 || c > 0xdfff) && String.fromCodePoint(c).trim() === '') jsSpace.push(String.fromCodePoint(c))
  assert.equal(jsSpace.length, 25, 'the runtime\'s trim set changed; re-check migration 74\'s list')
  sql(append(A, 'agent.registered@1', agentPayload(uuid(120), 'Warden'), P))
  const seqA = journalOf(A)
  for (const ch of jsSpace) {
    const said = refusal(append(A, 'agent.registered@1', agentPayload(uuid(121), `${ch}warden${ch}`), P))
    assert.ok(said, `"warden" wrapped in U+${ch.codePointAt(0).toString(16).padStart(4, '0')} was a second agent to the database, one to the form`)
    assert.match(said, /already has an agent called/)
  }
  assert.equal(journalOf(A), seqA, 'a refused name reached the journal')
  // A character JS does not trim is part of the name on both sides.
  for (const [ch, n] of [['​', 122], ['\u0085', 123], ['᠎', 124]])
    assert.equal(refusal(append(A, 'agent.registered@1', agentPayload(uuid(n), `${ch}warden`), P)), null,
      `U+${ch.codePointAt(0).toString(16)} is not whitespace to the form, so the database must not trim it either`)
})
// #endregion canonical-ids-at-the-door

test('the door is not an API: no role may call the guard directly', () => {
  for (const role of ['anon', 'authenticated', 'service_role'])
    for (const fn of ['refuse_foreign_identity(uuid,text,jsonb,uuid)', 'refuse_taken_agent_name(uuid,text,jsonb)', 'identity_uuid(text)',
                      'lock_global_identity(uuid)', 'session_held_elsewhere(uuid,uuid)', 'repair_foreign_heartbeats()',
                      'refuse_noncanonical_identity(text,jsonb)', 'agent_name_trim(text)'])
      assert.equal(sql(`select coalesce(has_function_privilege('${role}',to_regprocedure('${fn}'),'execute'),false)`), 'f', `${role} ${fn}`)
  for (const role of ['anon', 'authenticated', 'service_role'])
    assert.equal(sql(`select coalesce(has_table_privilege('${role}',to_regclass('declared_import_authorizations'),'insert'),false)`), 'f', role)
})

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall green: an id names one estate\'s row, at the door and on replay')
