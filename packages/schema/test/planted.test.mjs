// Planted-defect suite for migration 1 (WS-REQ-003).
// Each probe ATTEMPTS a violation and requires the database to refuse it —
// the refusal is the watched failure. A green run whose probes never bit
// would be theater, so every probe also carries a positive control proving
// the harness (role + JWT claims) is actually engaged.
//
// Runs against the local stack: postgresql://postgres:postgres@127.0.0.1:54322/postgres

import pg from 'pg'
import { randomUUID } from 'node:crypto'

const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const client = new pg.Client({ connectionString: DB_URL })
let failures = 0
const ok = (name) => console.log(`  ok   ${name}`)
const fail = (name, detail) => {
  failures++
  console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
}

async function expectError(name, sql, params, wantCode) {
  try {
    await client.query(sql, params)
    fail(name, 'the database ACCEPTED a violation it must refuse')
  } catch (e) {
    if (wantCode && e.code !== wantCode) fail(name, `refused, but with ${e.code}, wanted ${wantCode}`)
    else ok(`${name} (refused: ${e.code})`)
  }
}

// Fixtures: two estates, two persons, one project each — all through the
// single door where the door exists.
const A = randomUUID()
const B = randomUUID()
const authA = randomUUID()
const authB = randomUUID()
const projA = randomUUID()
const projB = randomUUID()
const seedActor = JSON.stringify({ kind: 'system', id: 'planted-test' })

async function setup() {
  const personA = randomUUID()
  const personB = randomUUID()
  await client.query(`insert into persons (id, display_name, auth_user) values ($1,'A',$2), ($3,'B',$4)`,
    [personA, authA, personB, authB])
  await client.query(`select append_event($1,'estate.created@1',$2::jsonb,$3::jsonb)`,
    [A, seedActor, JSON.stringify({ name: 'estate A' })])
  await client.query(`select append_event($1,'estate.created@1',$2::jsonb,$3::jsonb)`,
    [B, seedActor, JSON.stringify({ name: 'estate B' })])
  await client.query(`insert into memberships (person_id, estate_id, role) values ($1,$2,'owner'), ($3,$4,'owner')`,
    [personA, A, personB, B])
  await client.query(`select append_event($1,'project.created@1',$2::jsonb,$3::jsonb)`,
    [A, seedActor, JSON.stringify({ id: projA, name: 'project A' })])
  await client.query(`select append_event($1,'project.created@1',$2::jsonb,$3::jsonb)`,
    [B, seedActor, JSON.stringify({ id: projB, name: 'project B' })])
}

// P0 — gapless per-estate order: three appends are seq 1,2,3 with no holes.
async function p0_gapless() {
  const { rows } = await client.query(
    `select seq from journal where estate_id = $1 order by seq`, [A])
  const seqs = rows.map((r) => Number(r.seq))
  const expected = Array.from({ length: seqs.length }, (_, i) => i + 1)
  if (JSON.stringify(seqs) === JSON.stringify(expected) && seqs.length >= 2)
    ok(`P0 gapless per-estate seq (${seqs.join(',')})`)
  else fail('P0 gapless per-estate seq', `got ${seqs.join(',')}`)
}

// P1 — cross-tenant read: authenticated member of A must see A and never B.
async function p1_crossTenant() {
  await client.query('begin')
  try {
    await client.query(`set local role authenticated`)
    await client.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: authA, role: 'authenticated' })])
    const own = await client.query(`select count(*)::int as n from projects where estate_id = $1`, [A])
    if (own.rows[0].n === 1) ok('P1 positive control: member of A sees A (harness engaged)')
    else fail('P1 positive control', `member of A sees ${own.rows[0].n} own projects — the JWT harness is not engaged, the probe below would pass vacuously`)
    const other = await client.query(`select count(*)::int as n from projects where estate_id = $1`, [B])
    if (other.rows[0].n === 0) ok('P1 cross-tenant read refused (0 rows of B)')
    else fail('P1 cross-tenant read', `A read ${other.rows[0].n} rows of estate B`)
    const otherJournal = await client.query(`select count(*)::int as n from journal where estate_id = $1`, [B])
    if (otherJournal.rows[0].n === 0) ok('P1 cross-tenant journal read refused')
    else fail('P1 cross-tenant journal read', `${otherJournal.rows[0].n} rows leaked`)
  } finally {
    await client.query('rollback')
  }
}

// P2 — the floor: a floored effect intent without a LIVE MATCHING grant must not exist.
//
// REWRITTEN 2026-09-08 (S03.boundary). This probe used to accept its own
// positive control by citing a grant id directly, which is exactly what P27
// proved is not a floor: the constraint asked whether a uuid was present, and an
// expired, consumed, foreign-target, foreign-estate grant satisfied it. The
// refusal below now comes from the trigger rather than the CHECK — a BEFORE
// trigger runs first — so the code moves from 23514 to 42501, and the meaning
// moves from "a column is filled" to "an authorisation exists".
async function p2_floor() {
  await expectError(
    'P2 floored effect without any authority',
    `insert into effect_intents (estate_id, action_class, floor_class, receipt_seq)
     values ($1, 'publish', 'publication', 1)`,
    [A],
    '42501'
  )
  // Positive control: the same intent, reserved through the only door there is.
  const target = 'x.com/test'
  await client.query(
    `insert into grants (estate_id, floor_class, target, expires_at)
     values ($1, 'publication', $2, now() + interval '1 hour')`, [A, target])
  const { rows: [r] } = await client.query(
    `select * from reserve_effect($1, null, 'publish', 'publication', $2, $3)`,
    [A, target, randomUUID()])
  await client.query(
    `insert into effect_intents (estate_id, action_class, floor_class, reservation_id, receipt_seq)
     values ($1, 'publish', 'publication', $2, 2)`, [A, r.reservation_id])
  ok('P2 positive control: an effect reserved against a live grant is accepted')
}

// P3 — exactly one product manager per project.
async function p3_onePm() {
  await client.query(
    `insert into agent_bindings (project_id, estate_id, role) values ($1, $2, 'product-manager')`,
    [projA, A])
  await expectError(
    'P3 second product-manager on one project',
    `insert into agent_bindings (project_id, estate_id, role) values ($1, $2, 'product-manager')`,
    [projA, A],
    '23505'
  )
}

// P4 — the journal is append-only and single-doored, even for service_role.
// One transaction per probe: a refused statement aborts its transaction, so
// stacking probes in one tx would report 25P02 instead of the real verdict.
async function expectErrorAsRole(role, name, sql, params, wantCode) {
  await client.query('begin')
  try {
    await client.query(`set local role ${role}`)
    await expectError(name, sql, params, wantCode)
  } finally {
    await client.query('rollback')
  }
}

async function p4_appendOnly() {
  await expectErrorAsRole('service_role', 'P4 journal UPDATE as service_role',
    `update journal set payload = '{}'::jsonb where estate_id = $1`, [A], '42501')
  await expectErrorAsRole('service_role', 'P4 journal DELETE as service_role',
    `delete from journal where estate_id = $1`, [A], '42501')
  await expectErrorAsRole('service_role',
    'P4 journal direct INSERT as service_role (append_event is the only door)',
    `insert into journal (estate_id, seq, type, actor) values ($1, 999, 'x@1', '{}'::jsonb)`,
    [A], '42501')
}

// P6 — project memory is per project and never leaks across estates (migration 2).
async function p6_memory() {
  const factA = randomUUID()
  const factB = randomUUID()
  await client.query(
    `select append_event($1,'memory.project.recorded@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: factA, claim: 'estate A remembers the append lock' }), projA])
  await client.query(
    `select append_event($1,'memory.project.recorded@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [B, seedActor, JSON.stringify({ id: factB, claim: 'estate B remembers something else' }), projB])

  await client.query('begin')
  try {
    await client.query(`set local role authenticated`)
    await client.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: authA, role: 'authenticated' })])
    const own = await client.query(
      `select count(*)::int as n from memory_facts where project_id = $1`, [projA])
    if (own.rows[0].n === 1) ok('P6 positive control: member of A recalls A\'s fact')
    else fail('P6 positive control', `saw ${own.rows[0].n} own facts`)
    const leak = await client.query(
      `select count(*)::int as n from memory_facts where estate_id = $1`, [B])
    if (leak.rows[0].n === 0) ok('P6 cross-tenant memory read refused')
    else fail('P6 cross-tenant memory', `${leak.rows[0].n} facts of B leaked into A`)
    const fts = await client.query(
      `select count(*)::int as n from memory_facts where search @@ plainto_tsquery('english', 'append lock')`)
    if (fts.rows[0].n === 1) ok('P6 FTS finds the fact by its words')
    else fail('P6 FTS', `matched ${fts.rows[0].n}`)
  } finally {
    await client.query('rollback')
  }
}

// P7 — project.updated@1 is a partial update through the door, and rebuild replays it.
async function p7_projectUpdate() {
  await client.query(
    `select append_event($1,'project.updated@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: projA, repo_path: '/tmp/repo-a' }), projA])
  const { rows } = await client.query(
    `select name, repo_path, config_revision from projects where id = $1`, [projA])
  // The revision is the SEQ of the event that set it (M198), not a count of how
  // many times the row moved. A counter is not replayable: applying the same
  // event again increments again, and a rebuilt estate reports a revision it
  // never had.
  const { rows: last } = await client.query(
    `select max(seq)::int s from journal where estate_id = $1 and type = 'project.updated@1'`, [A])
  if (rows[0].name === 'project A' && rows[0].repo_path === '/tmp/repo-a' && rows[0].config_revision === last[0].s)
    ok('P7 partial update moved only repo_path, and the revision names the event that did it')
  else fail('P7 partial update', JSON.stringify(rows[0]) + ' vs seq ' + last[0].s)
}

// P8 — repositories are a set, primary is derived, and detaching promotes.
async function p8_repos() {
  const r1 = randomUUID()
  const r2 = randomUUID()
  const attach = (id, path) =>
    client.query(`select append_event($1,'project.repo.attached@1',$2::jsonb,$3::jsonb,'1',$4)`,
      [A, seedActor, JSON.stringify({ id, path }), projA])

  await attach(r1, '/tmp/repo-one')
  await attach(r2, '/tmp/repo-two')
  let rows = (await client.query(
    `select path, is_primary from project_repos where project_id=$1 order by attached_at`, [projA])).rows
  const proj = async () =>
    (await client.query(`select repo_path from projects where id=$1`, [projA])).rows[0].repo_path
  if (rows.length === 2 && rows[0].is_primary && !rows[1].is_primary && (await proj()) === '/tmp/repo-one')
    ok('P8 first attached repo is primary and mirrors into projects.repo_path')
  else fail('P8 attach', JSON.stringify(rows) + ' repo_path=' + (await proj()))

  // A duplicate path is refused by the schema, not by the caller remembering.
  await expectError('P8 duplicate repository path on one project',
    `insert into project_repos (id, estate_id, project_id, path) values ($1,$2,$3,'/tmp/repo-one')`,
    [randomUUID(), A, projA], '23505')

  await client.query(`select append_event($1,'project.repo.detached@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: r1 }), projA])
  rows = (await client.query(
    `select path, is_primary from project_repos where project_id=$1`, [projA])).rows
  if (rows.length === 1 && rows[0].is_primary && (await proj()) === '/tmp/repo-two')
    ok('P8 detaching the primary promotes the next and re-mirrors')
  else fail('P8 detach', JSON.stringify(rows) + ' repo_path=' + (await proj()))
}

// P9 — project settings are constrained values, moved only through the door.
async function p9_settings() {
  await client.query(`select append_event($1,'project.settings.updated@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: projA, memory_backend: 'cloud', default_agent: 'shell' }), projA])
  const { rows } = await client.query(
    `select memory_backend, default_agent from projects where id=$1`, [projA])
  if (rows[0].memory_backend === 'cloud' && rows[0].default_agent === 'shell')
    ok('P9 settings moved through the journal')
  else fail('P9 settings', JSON.stringify(rows[0]))
  await expectError('P9 unknown memory backend',
    `update projects set memory_backend = 'telepathy' where id = $1`, [projA], '23514')
}

// P10 — a task records what was asked, what it opened, and how it ended.
async function p10_tasks() {
  const taskId = randomUUID()
  const sessionId = randomUUID()
  // The real order: the task is recorded first, with no session yet, so a start
  // that fails is still a visible attempt.
  await client.query(`select append_event($1,'task.started@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({
      id: taskId, instruction: 'survey the repository', option_id: 'claude-code',
      session_id: null, preset: 'context', preset_edited: false
    }), projA])
  let pre = (await client.query(`select session_id, status from project_tasks where id=$1`, [taskId])).rows[0]
  if (pre.session_id === null && pre.status === 'running')
    ok('P10 a task exists before its session, so a failed start is still an attempt')
  else fail('P10 task-before-session', JSON.stringify(pre))
  await client.query(`select append_event($1,'task.session.attached@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: taskId, session_id: sessionId }), projA])
  let { rows } = await client.query(
    `select instruction, option_id, session_id, status, preset from project_tasks where id=$1`, [taskId])
  if (rows[0]?.status === 'running' && rows[0].session_id === sessionId && rows[0].preset === 'context')
    ok('P10 task records instruction, agent, session and preset')
  else fail('P10 task started', JSON.stringify(rows[0]))

  await client.query(`select append_event($1,'task.finished@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: taskId, exit_code: 0 }), projA])
  ;({ rows } = await client.query(
    `select status, exit_code, finished_at from project_tasks where id=$1`, [taskId]))
  if (rows[0].status === 'done' && rows[0].exit_code === 0 && rows[0].finished_at)
    ok('P10 task closes with its exit code')
  else fail('P10 task finished', JSON.stringify(rows[0]))

  await expectError('P10 unknown task status',
    `update project_tasks set status = 'maybe' where id = $1`, [taskId], '23514')
}

// P11 — an agent's self-report is a claim, stored apart from what we observe.
async function p11_agentStages() {
  const sessionId = randomUUID()
  const report = (stage, step) =>
    client.query(`select append_event($1,'agent.stage.reported@1',$2::jsonb,$3::jsonb,'1',$4)`,
      [A, JSON.stringify({ kind: 'agent', id: 'claude-code' }),
       JSON.stringify({ session_id: sessionId, stage, step, of_steps: 5, note: 'working' }), projA])

  await report('reading the repository', 1)
  await report('running the tests', 3)
  const { rows } = await client.query(
    `select stage, step, of_steps, seq from agent_stages where session_id=$1`, [sessionId])
  if (rows.length === 1 && rows[0].stage === 'running the tests' && rows[0].step === 3)
    ok('P11 the latest claim wins, one row per session')
  else fail('P11 stage projection', JSON.stringify(rows))

  // The history of claims stays in the journal even though the projection keeps one.
  const hist = await client.query(
    `select count(*)::int as n from journal where estate_id=$1 and type='agent.stage.reported@1'`, [A])
  if (hist.rows[0].n === 2) ok('P11 every claim survives in the journal, not just the last')
  else fail('P11 claim history', `journal holds ${hist.rows[0].n}`)

  // A claim never touches what we observe: the session's own state is elsewhere.
  const bleed = await client.query(
    `select count(*)::int as n from information_schema.columns
      where table_name='agent_stages' and column_name in ('running','exit_code','state')`)
  if (bleed.rows[0].n === 0)
    ok('P11 the claim table carries no observed field — the two cannot be confused')
  else fail('P11 separation', 'agent_stages carries an observation-shaped column')

  await client.query(`delete from agent_stages where session_id=$1`, [sessionId])
}

// P20 — the same create, twice, is one project (UX-06).
//
// The duplicate came entirely from the IPC handler minting a fresh id on every
// call, so a double-click made two. The projection layer was already safe, and
// this pins that: it is what makes a caller-chosen id a real guarantee rather
// than a convention two layers apart could quietly drift out of.
async function p20_createIsIdempotent() {
  const id = randomUUID()
  for (const attempt of ['first', 'second']) {
    await client.query(`select append_event($1,'project.created@1',$2::jsonb,$3::jsonb)`, [
      A,
      seedActor,
      JSON.stringify({ id, name: 'a project created ' + attempt })
    ])
  }
  const { rows } = await client.query('select count(*)::int as n, max(name) as name from projects where id = $1', [id])
  if (rows[0].n !== 1) fail('P20 the same create made ' + rows[0].n + ' projects')
  else ok('P20 the same id twice is ONE project — a retry finishes the create rather than making a sibling')
  if (!String(rows[0].name).includes('second'))
    fail('P20 the repeat did not update the row: ' + rows[0].name)
  else ok('P20 and the repeat carries the later values, so a retry after an edit is not lost')
  await client.query('delete from projects where id = $1', [id])
}

// P19 — TRUNCATE is a privilege of its own (IMP-08, audit 2026-09-05).
//
// Revoking UPDATE and DELETE never touched it. Measured live on 2026-09-05:
// TWENTY tables where anon, authenticated or service_role could TRUNCATE, the
// JOURNAL among them — one statement from erasing the estate's whole history,
// with every projection then rebuildable from nothing.
//
// It also falsified a claim made four migrations earlier: `task_notes` shipped
// with `revoke update, delete` and a comment calling itself append-only, while
// anon held TRUNCATE on it by default. Append-only means no UPDATE, no DELETE
// and NO TRUNCATE, or it means nothing.
//
// This probe covers EVERY table rather than a list, because the defect arrived
// by default privilege and the next table would inherit it the same way.
async function p19_noTruncate() {
  const { rows } = await client.query(`
    select c.relname,
           has_table_privilege('anon', c.oid, 'TRUNCATE') as anon,
           has_table_privilege('authenticated', c.oid, 'TRUNCATE') as auth,
           has_table_privilege('service_role', c.oid, 'TRUNCATE') as service
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
     order by c.relname`)
  const holders = rows.filter((r) => r.anon || r.auth || r.service)
  if (holders.length > 0)
    fail(
      'P19 TRUNCATE is held by an API role',
      `${holders.length} table(s), including ${holders.slice(0, 3).map((r) => r.relname).join(', ')}`
    )
  else ok(`P19 no API role can truncate any of the ${rows.length} tables — the journal least of all`)

  // The durable half. The defect arrived because a new table inherits the
  // creator's default privileges, so revoking on today's tables fixes today
  // only. A probe that checks the existing tables and not the default would go
  // green while the next migration reintroduced the hole.
  await client.query('create table _p19_probe(id int)')
  const { rows: fresh } = await client.query(`
    select has_table_privilege('authenticated', '_p19_probe', 'TRUNCATE') as auth,
           has_table_privilege('service_role', '_p19_probe', 'TRUNCATE') as service`)
  await client.query('drop table _p19_probe')
  if (fresh[0].auth || fresh[0].service)
    fail('P19 a NEW table still grants TRUNCATE — the default privileges were not changed')
  else ok('P19 a table created now inherits no TRUNCATE, so the next append-only table is one too')
}

// P12 — the door beside the door. `append_event` is revoked from everyone but the
// app's role; `apply_projections` was not, and being SECURITY DEFINER it let any
// PostgREST caller write a projection with no event behind it. Measured live on
// 2026-08-31 before migration 6. This probe fails if the grant ever returns.
async function p12_projectionDoor() {
  const { rows } = await client.query(`
    select p.proname,
           coalesce(array_to_string(p.proacl, ' '), 'PUBLIC') as acl
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('append_event', 'apply_projections', 'rebuild_estate_projections')`)
  const acl = Object.fromEntries(rows.map((r) => [r.proname, r.acl]))
  if (acl.apply_projections === 'PUBLIC')
    fail('P12 apply_projections is executable by PUBLIC — a projection can be written with no event')
  else if (/anon|authenticated/.test(acl.apply_projections ?? ''))
    fail(`P12 apply_projections is reachable by an API role: ${acl.apply_projections}`)
  else ok('P12 apply_projections is not reachable from any API role')

  for (const fn of ['append_event', 'rebuild_estate_projections']) {
    if (acl[fn] === 'PUBLIC' || /(^|\s)anon=|(^|\s)authenticated=/.test(acl[fn] ?? ''))
      fail(`P12 ${fn} is reachable by an API role: ${acl[fn]}`)
  }
  ok('P12 the journal writer and the rebuilder stay behind the app role')

  // And the writer itself must still work, or the fix broke the product.
  await client.query('begin')
  try {
    await client.query('set local role service_role')
    const r = await client.query(
      `select seq from append_event($1,'project.created@1',$2::jsonb,$3::jsonb)`,
      [A, seedActor, JSON.stringify({ id: randomUUID(), name: 'door check' })])
    if (r.rows[0]?.seq) ok('P12 the app role can still append through the real door')
    else fail('P12 append_event returned no seq for the app role')
  } catch (e) {
    fail(`P12 the fix broke the writer: ${e.message}`)
  } finally {
    await client.query('rollback')
  }
}

// P13 — the write boundary rejects an event type nobody registered.
// Measured before the fix: `totally.unknown@9` was accepted, given a seq, and
// projected nothing — a typo in a type name was durable and invisible. The
// registry makes an unknown type an error at the door instead of a silent hole.
async function p13_eventTypeRegistry() {
  const before = await client.query(`select count(*)::int as n from journal where estate_id = $1`, [A])
  await expectError(
    'P13 an unregistered event type is refused at the write boundary',
    `select append_event($1,'totally.unknown@9',$2::jsonb,'{}'::jsonb)`,
    [A, seedActor]
  )
  const after = await client.query(`select count(*)::int as n from journal where estate_id = $1`, [A])
  if (after.rows[0].n !== before.rows[0].n)
    fail(`P13 the refused event still reached the journal (${before.rows[0].n} -> ${after.rows[0].n})`)
  else ok('P13 nothing was journalled for the refused type')

  // Positive control: every type the code actually emits must be registered,
  // or this probe would pass by making the product unusable.
  const emitted = [
    'estate.created@1', 'project.created@1', 'project.updated@1',
    'project.settings.updated@1', 'project.archived@1', 'project.kickoff@1',
    'project.repo.attached@1', 'project.repo.detached@1',
    'task.started@1', 'task.session.attached@1', 'task.finished@1',
    'terminal.opened@1', 'terminal.closed@1',
    'agent.stage.reported@1', 'memory.project.recorded@1'
  ]
  const { rows } = await client.query(
    `select type from event_types where type = any($1::text[])`, [emitted])
  const known = new Set(rows.map((r) => r.type))
  const missing = emitted.filter((t) => !known.has(t))
  if (missing.length) fail(`P13 the registry does not know types the code emits: ${missing.join(', ')}`)
  else ok(`P13 all ${emitted.length} emitted types are registered`)
}

// P14 — a contended append fails fast instead of hanging forever.
// Measured before the fix: a second writer blocked indefinitely on
// pg_advisory_xact_lock (2 613 ms, killed by an unrelated tripwire, not by
// Postgres). One agent in a report loop could starve the operator.
async function p14_lockTimeout() {
  const holder = new pg.Client({ connectionString: DB_URL })
  await holder.connect()
  await holder.query('begin')
  await holder.query(`select pg_advisory_xact_lock(hashtextextended($1, 4242))`, [A])
  const started = Date.now()
  try {
    await client.query(
      `select append_event($1,'project.created@1',$2::jsonb,$3::jsonb)`,
      [A, seedActor, JSON.stringify({ id: randomUUID(), name: 'contended' })])
    fail('P14 the contended append SUCCEEDED — the holder did not actually hold the lock')
  } catch (e) {
    const ms = Date.now() - started
    if (e.code !== '55P03')
      fail(`P14 the contended append failed with ${e.code} after ${ms} ms, wanted 55P03 lock_not_available`)
    else if (ms > 8000)
      fail(`P14 refused with 55P03 but only after ${ms} ms — the timeout is not bounding anything`)
    else ok(`P14 a contended append fails fast (55P03 after ${ms} ms) instead of hanging`)
  } finally {
    await holder.query('rollback')
    await holder.end()
  }
  // And the same append succeeds once the lock is gone: the timeout must not
  // have turned contention into permanent refusal.
  const r = await client.query(
    `select seq from append_event($1,'project.created@1',$2::jsonb,$3::jsonb)`,
    [A, seedActor, JSON.stringify({ id: randomUUID(), name: 'uncontended' })])
  if (r.rows[0]?.seq) ok('P14 the same append succeeds once the lock is released')
  else fail('P14 append returned no seq after the lock was released')
}

// P15 — the transcript is the OBSERVATION half, and it must survive the sizes a
// real session produces. The projector runs inside the append transaction, so a
// transcript big enough to break the FTS index would roll back the session's own
// exit record too. Measured on this stack before the design was fixed:
// to_tsvector over 2 000 000 high-entropy chars fails 54000.
async function p15_transcripts() {
  const sessionId = randomUUID()
  const body = 'the agent ran a build and it failed on a missing token\n'.repeat(40)
  await client.query(
    `select append_event($1,'transcript.captured@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({
      session_id: sessionId, option_id: 'claude-code', sha256: 'a'.repeat(64),
      bytes: body.length, lines: 40, started_at: new Date(Date.now() - 60000).toISOString(),
      ended_at: new Date().toISOString(), exit_code: 0,
      annotation: 'claude-code · 1m · 40 lines · exit 0',
      excerpt: body.slice(0, 200), body
    }), projA])

  const { rows } = await client.query(
    `select bytes, lines, exit_code, annotation, body from session_transcripts where session_id = $1`,
    [sessionId])
  if (rows.length !== 1) fail('P15 the transcript did not project')
  else if (rows[0].body !== body) fail('P15 the stored body is not byte-identical to what was captured')
  else ok('P15 a transcript projects verbatim — the body is unaltered')

  // Searchable, which is the entire point of storing it verbatim.
  const hit = await client.query(
    `select session_id from session_transcripts
      where project_id = $1 and search @@ plainto_tsquery('english', 'missing token')`, [projA])
  if (hit.rows.length !== 1) fail(`P15 full-text search over the transcript found ${hit.rows.length}`)
  else ok('P15 the transcript is findable by its own words')

  // The size that would have rolled back the append. 2 MB of high-entropy text
  // exceeds the tsvector limit outright; the index is bounded so it cannot.
  const bigSession = randomUUID()
  const big = await client.query(
    `select string_agg(md5(random()::text||g), ' ') as t from generate_series(1, 60000) g`)
  const huge = big.rows[0].t
  try {
    await client.query(
      `select append_event($1,'transcript.captured@1',$2::jsonb,$3::jsonb,'1',$4)`,
      [A, seedActor, JSON.stringify({
        session_id: bigSession, option_id: 'claude-code', sha256: 'b'.repeat(64),
        bytes: huge.length, lines: 60000, started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(), exit_code: 0,
        annotation: 'big', excerpt: huge.slice(0, 200), body: huge
      }), projA])
    const r = await client.query(
      `select length(body) as n from session_transcripts where session_id = $1`, [bigSession])
    if (r.rows[0]?.n !== huge.length)
      fail(`P15 the large transcript was stored truncated (${r.rows[0]?.n} of ${huge.length})`)
    else ok(`P15 a ${Math.round(huge.length / 1000)}k-character transcript journals and stores whole`)
  } catch (e) {
    fail(`P15 a large transcript ROLLED BACK the append (${e.code}: ${e.message.slice(0, 90)}) — ` +
         'this would lose the session exit record too')
  }

  // The claim table and the observation table must stay separable: neither
  // carries the other's shape.
  const cols = await client.query(
    `select column_name from information_schema.columns where table_name = 'session_transcripts'`)
  const names = cols.rows.map((r) => r.column_name)
  if (names.includes('stage') || names.includes('step'))
    fail('P15 the transcript table carries claim-shaped columns — the two can be confused')
  else ok('P15 the observation table carries no claim-shaped column')
}

// P16 — a memory fact knows who said it, and an abandoned task is not a
// finished one. Both were measured missing on 2026-08-31: the journal carried
// the actor on every event and the projection dropped it, so an operator's note
// and an agent's self-report were indistinguishable; and a task whose app
// restarted stayed `open` forever, which is a positive claim that it is running.
async function p16_provenanceAndReconciliation() {
  // --- provenance comes from the ENVELOPE, not from the payload -------------
  const byPerson = randomUUID()
  const byAgent = randomUUID()
  await client.query(
    `select append_event($1,'memory.project.recorded@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, JSON.stringify({ kind: 'person', id: 'operator' }),
     JSON.stringify({ id: byPerson, claim: 'the operator wrote this one down' }), projA])
  await client.query(
    `select append_event($1,'memory.project.recorded@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, JSON.stringify({ kind: 'agent', id: 'session-7' }),
     JSON.stringify({ id: byAgent, claim: 'an agent reported this about itself',
                      // a lying payload: the actor must NOT be taken from here
                      actor_kind: 'person', actor_id: 'operator' }), projA])

  const { rows } = await client.query(
    `select id, actor_kind, actor_id from memory_facts where id = any($1::uuid[]) order by actor_kind`,
    [[byPerson, byAgent]])
  const mine = rows.find((r) => r.id === byPerson)
  const theirs = rows.find((r) => r.id === byAgent)
  if (mine?.actor_kind !== 'person' || mine?.actor_id !== 'operator')
    fail(`P16 the operator's own note lost its provenance: ${JSON.stringify(mine)}`)
  else ok('P16 a fact the operator recorded is attributed to the operator')
  if (theirs?.actor_kind !== 'agent' || theirs?.actor_id !== 'session-7')
    fail(`P16 an agent's fact was attributed as ${JSON.stringify(theirs)}`)
  else ok('P16 a fact an agent recorded is attributed to that agent')
  if (theirs?.actor_kind === 'person')
    fail('P16 the payload was allowed to declare its own actor — a claim wearing an envelope')

  // --- a rebuild must not lose it ------------------------------------------
  await client.query(`update memory_facts set actor_kind = null, actor_id = null where id = $1`, [byAgent])
  await client.query(`select rebuild_estate_projections($1)`, [A])
  const after = await client.query(`select actor_kind from memory_facts where id = $1`, [byAgent])
  if (after.rows[0]?.actor_kind !== 'agent')
    fail('P16 rebuild did not restore provenance — it is not recoverable from the journal')
  else ok('P16 provenance is recoverable from the journal by rebuild')

  // --- abandoned is not finished -------------------------------------------
  const openTask = randomUUID()
  const doneTask = randomUUID()
  for (const [id, instruction] of [[openTask, 'still running'], [doneTask, 'already done']]) {
    await client.query(
      `select append_event($1,'task.started@1',$2::jsonb,$3::jsonb,'1',$4)`,
      [A, seedActor, JSON.stringify({ id, instruction, option_id: 'claude-code' }), projA])
  }
  await client.query(
    `select append_event($1,'task.finished@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: doneTask, exit_code: 0 }), projA])

  await client.query(
    `select append_event($1,'task.abandoned@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: openTask, reason: 'app-restarted' }), projA])
  // and the same sweep reaching a task that DID finish
  await client.query(
    `select append_event($1,'task.abandoned@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: doneTask, reason: 'app-restarted' }), projA])

  const t = await client.query(
    `select id, status, exit_code, abandoned_reason from project_tasks where id = any($1::uuid[])`,
    [[openTask, doneTask]])
  const abandoned = t.rows.find((r) => r.id === openTask)
  const finished = t.rows.find((r) => r.id === doneTask)
  if (abandoned?.status !== 'cancelled' || abandoned?.abandoned_reason !== 'app-restarted')
    fail(`P16 an open task was not abandoned with its reason: ${JSON.stringify(abandoned)}`)
  else ok('P16 an open task closes as abandoned, carrying why')
  if (abandoned?.exit_code !== null)
    fail('P16 an abandoned task invented an exit code')
  else ok('P16 an abandoned task has no exit code — nobody watched it exit')
  if (finished?.status !== 'done' || finished?.exit_code !== 0)
    fail(`P16 reconciliation overwrote a real outcome: ${JSON.stringify(finished)}`)
  else ok('P16 a task that really finished is not overwritten by reconciliation')

  await expectError(
    'P16 an unknown task status is refused',
    `insert into project_tasks (id, estate_id, project_id, instruction, option_id, status, started_at, seq)
     values ($1,$2,$3,'x','claude-code','lost',now(),1)`,
    [randomUUID(), A, projA], '23514')
}

// P17 — a contradiction annotates, it does not delete (ADR-0032 §4).
// The failure this guards against is the one every memory system that "resolves"
// contradictions has: the projection looks tidy, the earlier claim is gone, and
// "what did this project believe in June" is unanswerable.
async function p17_bitemporal() {
  const june = randomUUID()
  const august = randomUUID()
  await client.query(
    `select append_event($1,'memory.project.recorded@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: june, claim: 'the build runs on Node 22' }), projA])

  const before = await client.query(
    `select valid_from, valid_to, superseded_by from memory_facts where id = $1`, [june])
  if (before.rows[0]?.valid_from === null) fail('P17 a new fact has no validity start')
  else if (before.rows[0]?.valid_to !== null) fail('P17 a new fact arrived already closed')
  else ok('P17 a new fact is valid from when it was recorded, and open-ended')

  await client.query(
    `select append_event($1,'memory.project.recorded@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({
      id: august, claim: 'the build runs on Node 24', supersedes: june }), projA])

  const { rows } = await client.query(
    `select id, claim, valid_to, superseded_by from memory_facts where id = any($1::uuid[])`,
    [[june, august]])
  const old = rows.find((r) => r.id === june)
  const now = rows.find((r) => r.id === august)
  if (!old) fail('P17 the superseded fact was DELETED — the correction is not reversible')
  else if (old.valid_to === null) fail('P17 the superseded fact still claims to be true')
  else if (old.superseded_by !== august) fail(`P17 the old fact does not name what replaced it: ${old.superseded_by}`)
  else ok('P17 a contradicted fact keeps its text, closes its window, and names its successor')
  if (now?.valid_to !== null) fail('P17 the replacing fact arrived already closed')
  else ok('P17 the replacing fact is the one that is currently true')

  // The question the whole design exists to answer. The instant is computed IN
  // SQL: a timestamptz round-tripped through a JS Date loses its sub-millisecond
  // part, so `valid_from <= $2` silently excludes the very row it is asking
  // about. That is a real trap for any as-of query written from the client, not
  // an artefact of this probe.
  const asOf = await client.query(
    `with instant as (select valid_to - interval '1 ms' as t from memory_facts where id = $2)
     select claim from memory_facts, instant
      where project_id = $1
        and valid_from <= instant.t
        and (valid_to is null or valid_to > instant.t)`,
    [projA, june])
  const believedThen = asOf.rows.map((r) => r.claim)
  if (!believedThen.includes('the build runs on Node 22'))
    fail(`P17 "what was believed then" is unanswerable: ${JSON.stringify(believedThen)}`)
  else if (believedThen.includes('the build runs on Node 24'))
    fail('P17 the as-of query returned a fact that was not yet true')
  else ok('P17 the store still says what was believed before the correction, and only that')

  // Shape: a closed window without a successor would be an expiry nobody caused.
  await expectError(
    'P17 a window cannot close without naming what closed it',
    `update memory_facts set valid_to = now() where id = $1`, [august], '23514')

  // Replay must not rewrite which fact did the closing.
  await client.query(`select rebuild_estate_projections($1)`, [A])
  const after = await client.query(`select superseded_by, valid_to from memory_facts where id = $1`, [june])
  if (after.rows[0]?.superseded_by !== august)
    fail('P17 rebuild lost or rewrote the supersession')
  else ok('P17 supersession survives a rebuild from the journal')

  // A supersession cannot reach into another project.
  const foreign = randomUUID()
  await client.query(
    `select append_event($1,'memory.project.recorded@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [B, JSON.stringify({ kind: 'system', id: 'planted-test' }),
     JSON.stringify({ id: foreign, claim: 'unrelated', supersedes: august }), projB])
  const untouched = await client.query(`select valid_to from memory_facts where id = $1`, [august])
  if (untouched.rows[0]?.valid_to !== null)
    fail('P17 a fact in ANOTHER estate closed this one — supersession crosses the boundary')
  else ok('P17 a supersession cannot reach a fact outside its own project')
}

// P18 — an agent may not bury what the operator recorded.
// Reproduced against migration 13 by an adversarial pass: an agent superseded an
// operator's `decision`, and the operator's fact left every default view at once
// (searches and the context pack both filter valid_to is null), leaving the
// agent's replacement as the project's current truth.
async function p18_supersedeGuard() {
  const byOperator = randomUUID()
  const byAgent = randomUUID()
  await client.query(
    `select append_event($1,'memory.project.recorded@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, JSON.stringify({ kind: 'person', id: 'operator' }),
     JSON.stringify({ id: byOperator, claim: 'the production host is db.internal', kind: 'decision' }), projA])

  // The attack, exactly as reproduced: an agent supersedes the operator's fact.
  await client.query(
    `select append_event($1,'memory.project.recorded@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, JSON.stringify({ kind: 'agent', id: 'session-hostile' }),
     JSON.stringify({ id: byAgent, claim: 'CORRECTION: the production host is evil.example',
                      supersedes: byOperator }), projA])

  const op = await client.query(`select valid_to, superseded_by from memory_facts where id = $1`, [byOperator])
  if (op.rows[0]?.valid_to !== null)
    fail('P18 an agent buried the OPERATOR\'s fact — it left every default view')
  else ok('P18 an agent cannot supersede a fact the operator recorded')

  const ag = await client.query(`select claim from memory_facts where id = $1`, [byAgent])
  if (!ag.rows.length)
    fail('P18 the refusal also swallowed the agent\'s own claim — it is legitimate on its own')
  else ok('P18 the agent\'s claim is still recorded, so both sit side by side for a human to judge')

  // An agent superseding an AGENT is ordinary corrective work and must still work.
  const first = randomUUID(), second = randomUUID()
  await client.query(
    `select append_event($1,'memory.project.recorded@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, JSON.stringify({ kind: 'agent', id: 'session-1' }),
     JSON.stringify({ id: first, claim: 'the build runs on Node 22' }), projA])
  await client.query(
    `select append_event($1,'memory.project.recorded@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, JSON.stringify({ kind: 'agent', id: 'session-2' }),
     JSON.stringify({ id: second, claim: 'the build runs on Node 24', supersedes: first }), projA])
  const a2a = await client.query(`select valid_to from memory_facts where id = $1`, [first])
  if (a2a.rows[0]?.valid_to === null)
    fail('P18 the guard also blocked an agent correcting an AGENT — ordinary work is now impossible')
  else ok('P18 an agent may still correct another agent')

  // And a person may supersede anyone, including an agent.
  const byPerson = randomUUID()
  await client.query(
    `select append_event($1,'memory.project.recorded@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, JSON.stringify({ kind: 'person', id: 'operator' }),
     JSON.stringify({ id: byPerson, claim: 'actually Node 26', supersedes: second }), projA])
  const p2a = await client.query(`select valid_to from memory_facts where id = $1`, [second])
  if (p2a.rows[0]?.valid_to === null) fail('P18 the operator could not correct an agent')
  else ok('P18 the operator may correct anyone')
}

// P5 — ADR-0027 §3 fixture: rebuild() == current state, and rebuild repairs corruption.
async function p5_rebuild() {
  const before = await client.query(
    `select id, name, status, repo_path from projects where estate_id = $1 order by id`, [A])
  const memBefore = await client.query(
    `select id, claim from memory_facts where estate_id = $1 order by id`, [A])
  await client.query(`update projects set name = 'CORRUPTED' where estate_id = $1`, [A])
  await client.query(`update memory_facts set claim = 'CORRUPTED' where estate_id = $1`, [A])
  await client.query(`select rebuild_estate_projections($1)`, [A])
  const after = await client.query(
    `select id, name, status, repo_path from projects where estate_id = $1 order by id`, [A])
  const memAfter = await client.query(
    `select id, claim from memory_facts where estate_id = $1 order by id`, [A])
  if (JSON.stringify(before.rows) === JSON.stringify(after.rows))
    ok('P5 project rebuild equals replay (corruption repaired)')
  else fail('P5 project rebuild', `before ${JSON.stringify(before.rows)} != after ${JSON.stringify(after.rows)}`)
  if (JSON.stringify(memBefore.rows) === JSON.stringify(memAfter.rows) && memAfter.rows.length > 0)
    ok('P5 memory rebuild equals replay')
  else fail('P5 memory rebuild', `before ${JSON.stringify(memBefore.rows)} != after ${JSON.stringify(memAfter.rows)}`)
}

// Best-effort cleanup: the suite runs against the live local store the app also
// uses, so its throwaway estates are removed afterwards. journal deletion works
// only because the local `postgres` user is a superuser (ACLs still bind every
// role, as P4 proves); on a non-superuser connection the rows simply remain in
// two orphan estates the app never reads (it is scoped to org #1).
async function cleanup() {
  try {
    await client.query(`delete from agent_stages where estate_id in ($1,$2)`, [A, B])
    await client.query(`delete from project_tasks where estate_id in ($1,$2)`, [A, B])
    await client.query(`delete from project_repos where estate_id in ($1,$2)`, [A, B])
    await client.query(`delete from memory_facts where estate_id in ($1,$2)`, [A, B])
    await client.query(`delete from effect_intents where estate_id in ($1,$2)`, [A, B])
    await client.query(`delete from grants where estate_id in ($1,$2)`, [A, B])
    await client.query(`delete from agent_bindings where estate_id in ($1,$2)`, [A, B])
    await client.query(`delete from projects where estate_id in ($1,$2)`, [A, B])
    await client.query(`delete from memberships where estate_id in ($1,$2)`, [A, B])
    await client.query(`delete from estates where id in ($1,$2)`, [A, B])
    await client.query(`delete from persons where auth_user in ($1,$2)`, [authA, authB])
    await client.query(`delete from journal where estate_id in ($1,$2)`, [A, B])
    console.log('  ok   cleanup: test estates removed')
  } catch (e) {
    console.log(`  note cleanup skipped (${e.code ?? e.message}) — orphan test estates are invisible to the app`)
  }
}

/**
 * P21 — every table the app must read, it can read.
 *
 * `routines` and `proposals` shipped unreadable: migration 17's
 * `alter default privileges ... revoke truncate` replaced Supabase's
 * grant-everything default with the built-in one, so every table created after
 * it arrived with no SELECT for `service_role` — the role the desktop app
 * connects as. Nothing caught it. The typecheck is happy with a query that
 * fails at runtime, the supabase client returns `{ data: null, error }` rather
 * than throwing, and the calling code reads `data ?? []` and renders an empty
 * list. **A MISSING GRANT LOOKS EXACTLY LIKE AN EMPTY TABLE.**
 *
 * A static gate was written for this and deleted: the answer is not in the
 * migrations. Eight tables predate 17 and carry no explicit grant because they
 * inherited one, so a rule demanding the line reports them as broken while they
 * work. The question is what the DATABASE says, and only the database knows.
 */
async function p21_grants() {
  // ACL CAPABILITY AND ROW VISIBILITY ARE DIFFERENT CLAIMS, and this probe used
  // to make one of them twice. A grant says whether the role may ask; RLS says
  // what comes back. Green on the first read as proof of the second is how a
  // remote tier can report six tables readable by `anon` while the suite that
  // "covers grants" is green — which is what happened (run 34070268253).

  // ——————————————————————————————————— 1 · capability: the app can read
  const { rows: unreadable } = await client.query(
    `select c.relname as name
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and not has_table_privilege('service_role', c.oid, 'select')
      order by 1`
  )
  if (unreadable.length === 0) ok('P21 every table in the schema is readable by the role the app connects as')
  else
    fail(
      'P21 tables the app cannot read',
      unreadable.map((r) => r.name).join(', ') + ' — a missing grant renders as an empty table'
    )

  const { rows: [{ n: tables }] } = await client.query(
    `select count(*)::int n from pg_class c join pg_namespace nn on nn.oid = c.relnamespace
      where nn.nspname = 'public' and c.relkind = 'r'`
  )
  // Without this the check above passes just as happily against an empty schema.
  if (tables > 20) ok(`P21 positive control: ${tables} tables were actually examined`)
  else fail('P21 control', `only ${tables} tables in the schema — the sweep proves nothing`)

  // ——————————————————————————————————— 2 · capability: anon may not ask
  const { rows: open } = await client.query(
    `select c.relname as name
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and has_table_privilege('anon', c.oid, 'select')
      order by 1`
  )
  if (open.length === 0) ok('P21 and anon holds the SELECT privilege on none of them')
  else fail('P21 tables anon may read', open.map((r) => r.name).join(', '))

  // ——————————————————————————————————— 3 · the DEFAULT, not today's tables
  //
  // The sweep above is about the tables that exist. Six of them were clean only
  // because of a default-privileges entry belonging to whichever role creates
  // objects HERE — a property of the environment, which is why the remote tier
  // disagreed with a green local run. This creates a table and asks the same
  // question of it, so the next migration's table is covered by a check rather
  // than by someone remembering to write a revoke.
  await client.query('begin')
  try {
    // Reproduce the REMOTE condition instead of hoping to observe it there: make
    // the inherited default generous, exactly as the other grantor's entry is,
    // and then create a table under it. Without this line the assertion below
    // passes locally for the wrong reason — the local default already denies —
    // and a green run would say nothing about the environment that went red.
    await client.query('alter default privileges in schema public grant select on tables to anon')
    await client.query('create table public.p21_inherited_grants (id int)')
    const { rows: [inherited] } = await client.query(
      `select has_table_privilege('anon', 'public.p21_inherited_grants', 'select') as anon_select,
              has_table_privilege('service_role', 'public.p21_inherited_grants', 'select') as service_select`
    )
    if (inherited.anon_select)
      fail('P21 inheritance', 'a table created right now inherited SELECT for anon — the default is reachable again')
    else ok('P21 a table created right now does not inherit SELECT for anon')
    // And the control: a revoke that stripped everyone would satisfy the line
    // above while making the schema unusable, which is migration 17's mistake.
    if (inherited.service_select) ok('P21 while the role the app connects as still reads it')
    else fail('P21 inheritance control', 'the new table is unreadable by service_role — too much was revoked')
  } finally {
    await client.query('rollback')
  }

  // ——————————————————————————————————— 4 · visibility, proven on its own
  //
  // Grant anon the privilege it must never have, inside a transaction that is
  // thrown away, and ask as anon. Zero rows now means RLS — not the grant, which
  // has just been handed over. Without this step the suite cannot tell "RLS
  // refuses" from "nobody asked".
  await client.query('begin')
  try {
    const { rows: [{ n: visibleToOwner }] } = await client.query(
      `select count(*)::int n from projects where estate_id = $1`, [A])
    if (visibleToOwner > 0) ok(`P21 positive control: ${visibleToOwner} project rows exist to be hidden`)
    else fail('P21 rls control', 'no rows in projects — a zero below would prove nothing')

    await client.query('grant select on projects to anon')
    await client.query('set local role anon')
    const { rows: [{ n: visibleToAnon }] } = await client.query(
      `select count(*)::int n from projects`)
    if (visibleToAnon === 0)
      ok('P21 and with the privilege deliberately granted, anon still sees no rows — that is RLS, separately')
    else fail('P21 rls', `anon read ${visibleToAnon} rows once the grant was handed over`)
  } finally {
    await client.query('rollback')
  }
}


async function p22_questions() {
  const agentActor = JSON.stringify({ kind: 'agent', id: 's-77' })
  const t1 = randomUUID()
  const t2 = randomUUID()
  const q = randomUUID()
  // two tasks in project A
  for (const [id, ins] of [[t1, 'ship export'], [t2, 'wire billing']]) {
    await client.query(`select append_event($1,'task.started@1',$2::jsonb,$3::jsonb,'1',$4)`,
      [A, seedActor, JSON.stringify({ id, instruction: ins, option_id: 'claude-code' }), projA])
  }
  // a question blocking both
  await client.query(`select append_event($1,'question.asked@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, agentActor, JSON.stringify({
      id: q, project_id: projA, text: 'keep the free export?',
      why_blocked: 'the schema differs by the answer', kind: 'decision',
      about: 'tier.free.export', blocks: [t1, t2]
    }), projA])

  const blocked = await client.query(
    `select count(*)::int n from project_tasks where blocked_by = $1 and blocked_since is not null`, [q])
  if (blocked.rows[0].n !== 2) fail('P22 block', `${blocked.rows[0].n} of 2 tasks blocked`)
  else ok('P22 a question blocks every task it names')

  const qrow = await client.query(`select status, about, asked_by_kind from questions where id = $1`, [q])
  if (qrow.rows[0]?.status !== 'open') fail('P22 open', `question is ${qrow.rows[0]?.status}, not open`)
  else if (qrow.rows[0].about !== 'tier.free.export') fail('P22 about', 'the about key was not stored')
  else if (qrow.rows[0].asked_by_kind !== 'agent') fail('P22 actor', 'asked_by_kind did not come from the actor')
  else ok('P22 the question is open, carries its about key, and knows an agent asked it')

  // prioritise it
  await client.query(`select append_event($1,'question.prioritised@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: q, priority: 70, components: { blocking: 40, breadth: 20, kind: 10 } }), projA])
  const pr = await client.query(`select priority, priority_why from questions where id = $1`, [q])
  if (pr.rows[0].priority !== 70 || !pr.rows[0].priority_why) fail('P22 priority', 'priority or its components did not land')
  else ok('P22 the CEO priority and its components are stored')

  // answer it → answered, both tasks unblocked, answer recorded
  const decision = randomUUID()
  await client.query(`select append_event($1,'question.answered@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, JSON.stringify({ kind: 'person', id: 'operator' }), JSON.stringify({
      id: q, answer: 'yes, keep it', decision_id: decision
    }), projA])

  const after = await client.query(`select status, answer, answered_by_kind, decision_id from questions where id = $1`, [q])
  if (after.rows[0].status !== 'answered') fail('P22 answer', `still ${after.rows[0].status}`)
  else if (after.rows[0].answered_by_kind !== 'person') fail('P22 answerer', 'answered_by_kind defaulted wrong')
  else if (String(after.rows[0].decision_id) !== decision) fail('P22 decision', 'the answer did not record the decision fact it became')
  else ok('P22 an answer closes the question, names its answerer, and records the decision it became')

  const stillBlocked = await client.query(
    `select count(*)::int n from project_tasks where blocked_by = $1`, [q])
  if (stillBlocked.rows[0].n !== 0) fail('P22 unblock', `${stillBlocked.rows[0].n} tasks still blocked after the answer`)
  else ok('P22 answering unblocks every task the question held')

  // a second answer must NOT overwrite the first — status is no longer open
  await client.query(`select append_event($1,'question.answered@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, JSON.stringify({ kind: 'person', id: 'operator' }), JSON.stringify({ id: q, answer: 'changed my mind' }), projA])
  const reanswered = await client.query(`select answer from questions where id = $1`, [q])
  if (reanswered.rows[0].answer !== 'yes, keep it') fail('P22 idempotent-answer', 'a second answer overwrote the first')
  else ok('P22 a question is answered once — the guard is status=open, not last-write-wins')

  // tenant isolation: B cannot read A's question. Wrapped in begin/rollback and
  // with a positive control, so "0 rows" cannot pass vacuously (P1's pattern).
  await client.query('begin')
  try {
    await client.query(`set local role authenticated`)
    await client.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: authB, role: 'authenticated' })])
    const ownB = await client.query(`select count(*)::int n from questions where estate_id = $1`, [B])
    // B has none of its own yet, so the positive control is that B sees A's zero
    // AND its own zero — proven distinct by A seeing its own below.
    const seesA = await client.query(`select count(*)::int n from questions where id = $1`, [q])
    if (seesA.rows[0].n !== 0) fail('P22 isolation', `estate B read estate A's question`)
    else ok('P22 a question is invisible across the tenant boundary')
    // positive control: A, as itself, DOES see it — the RLS is engaged, not just denying everyone
    await client.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: authA, role: 'authenticated' })])
    const seesOwn = await client.query(`select count(*)::int n from questions where id = $1`, [q])
    if (seesOwn.rows[0].n !== 1) fail('P22 positive control', `estate A cannot read its OWN question — RLS denies everyone, the probe above is vacuous`)
    else ok('P22 and estate A reads its own — the boundary denies the other, not everyone')
    void ownB
  } finally {
    await client.query('rollback')
  }
}


// P23 — project priority is declared and never mutated; CEO trust is stored and
// clears cleanly (M156). A projector probe: the reader (`ceoTrustFor`) enforces
// "may not exceed", but the STORAGE must round-trip the operator's declaration
// exactly, and a `project.priority.set@1` must touch nothing but the tier.
async function p23_priorityAndTrust() {
  // declare a tier
  await client.query(`select append_event($1,'project.priority.set@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, JSON.stringify({ kind: 'person', id: 'operator' }),
     JSON.stringify({ project_id: projA, tier: 'critical', because: 'launch week' }), projA])
  const row = await client.query(`select priority_tier, priority_because, name from projects where id = $1`, [projA])
  if (row.rows[0].priority_tier !== 'critical') fail('P23 tier', `tier is ${row.rows[0].priority_tier}`)
  else if (row.rows[0].priority_because !== 'launch week') fail('P23 because', 'the reason was not stored')
  else if (row.rows[0].name !== 'project A') fail('P23 scope', 'setting the tier changed another column')
  else ok('P23 the operator declares a tier, with its reason, touching nothing else')

  // a bad tier is refused by the check constraint
  await expectError('P23 bad tier',
    `update projects set priority_tier = 'urgent' where id = $1`, [projA], '23514')

  // trust override stored, then cleared
  await client.query(`select append_event($1,'project.trust.set@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, JSON.stringify({ kind: 'person', id: 'operator' }),
     JSON.stringify({ project_id: projA, trust: 'ask' }), projA])
  let tr = await client.query(`select ceo_trust from projects where id = $1`, [projA])
  if (tr.rows[0].ceo_trust !== 'ask') fail('P23 trust set', `trust is ${tr.rows[0].ceo_trust}`)
  else ok('P23 a project trust override is stored')

  await client.query(`select append_event($1,'project.trust.set@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, JSON.stringify({ kind: 'person', id: 'operator' }),
     JSON.stringify({ project_id: projA, trust: '' }), projA])
  tr = await client.query(`select ceo_trust from projects where id = $1`, [projA])
  if (tr.rows[0].ceo_trust !== null) fail('P23 trust clear', `clearing left ${tr.rows[0].ceo_trust}, not null`)
  else ok('P23 an empty trust clears the override — back to inheriting the estate')

  // estate settings upsert, and its default is `cited` not `ask`
  await client.query(`select append_event($1,'estate.settings.set@1',$2::jsonb,$3::jsonb,'1')`,
    [A, JSON.stringify({ kind: 'person', id: 'operator' }),
     JSON.stringify({ ceo_trust: 'routine', criticality_threshold: 75 })])
  const es = await client.query(`select ceo_trust, criticality_threshold from estate_settings where estate_id = $1`, [A])
  if (es.rows[0]?.ceo_trust !== 'routine' || es.rows[0]?.criticality_threshold !== 75)
    fail('P23 estate settings', `got ${JSON.stringify(es.rows[0])}`)
  else ok('P23 estate settings upsert carries trust and the criticality threshold')

  // a second set updates rather than duplicates (primary key on estate_id)
  await client.query(`select append_event($1,'estate.settings.set@1',$2::jsonb,$3::jsonb,'1')`,
    [A, JSON.stringify({ kind: 'person', id: 'operator' }), JSON.stringify({ criticality_threshold: 50 })])
  const es2 = await client.query(`select count(*)::int n, max(criticality_threshold) thr from estate_settings where estate_id = $1`, [A])
  if (es2.rows[0].n !== 1) fail('P23 upsert', `${es2.rows[0].n} settings rows for one estate`)
  else if (es2.rows[0].thr !== 50) fail('P23 upsert value', 'the second set did not update the threshold')
  else ok('P23 a second settings event updates the one row, and leaves trust as it was')
}


// P24 — the refactor did not move behaviour (M97).
//
// `apply_projections_legacy` was dissolved into three per-concern functions.
// The arms were copied byte-identical, but "byte-identical" is a claim about a
// diff; this is a claim about the DATABASE. Every projection is snapshotted,
// the estate is rebuilt from its journal through the NEW dispatcher, and the
// snapshots must match exactly — same rows, same values, same order.
//
// It is the acceptance the brief demanded, and it is what a green planted suite
// alone cannot give: those probes assert rules, and a refactor can preserve
// every rule while quietly dropping a column nobody asserts on.
async function p24_rebuildParity() {
  const TABLES = [
    'projects', 'project_repos', 'project_tasks', 'memory_facts', 'memory_retrievals',
    'session_transcripts', 'agent_stages', 'session_context_packs', 'task_notes', 'task_links'
  ]
  // NOTHING IS EXCLUDED ANY MORE (M198 closed). `config_revision` used to be:
  // the projector did `config_revision = config_revision + 1`, so replaying an
  // event incremented it again and a rebuild was not idempotent for that
  // column. The exclusion was recorded as a finding rather than as a
  // convenience, and it is now removed because the finding is fixed — the
  // revision is the seq of the event that set it, which replays to itself.
  //
  // An empty skip list is the assertion: every column of every projection is
  // compared whole, and adding a column back here would need the same argument
  // the original exclusion carried.
  const skip = {}
  const snapshot = async () => {
    const out = {}
    for (const t of TABLES) {
      const drop = (skip[t] ?? []).map((c) => `- '${c}'`).join(' ')
      const { rows } = await client.query(
        `select md5(string_agg(j::text, '|' order by j::text)) h, count(*)::int n
           from (select (row_to_json(x)::jsonb ${drop}) j from ${t} x) y`
      )
      out[t] = rows[0]
    }
    return out
  }

  const before = await snapshot()
  const anyRows = Object.values(before).some((v) => v.n > 0)
  if (!anyRows) {
    fail('P24 positive control: every projection is empty, so a parity check proves nothing')
    return
  }
  ok(`P24 positive control: ${Object.values(before).reduce((a, v) => a + v.n, 0)} projected rows to compare`)

  // Rebuild BOTH estates from their journals through the new dispatcher.
  for (const estate of [A, B]) await client.query(`select rebuild_estate_projections($1)`, [estate])

  const after = await snapshot()
  const moved = TABLES.filter((t) => before[t].h !== after[t].h || before[t].n !== after[t].n)
  if (moved.length)
    fail(`P24 rebuild changed ${moved.length} projection(s): ${moved.map((t) => `${t} ${before[t].n}->${after[t].n}`).join(', ')}`)
  else ok('P24 a rebuild reproduces every projection exactly, every column — nothing excluded (M198 closed)')

  // And the legacy function is gone rather than left callable-but-empty.
  const { rows } = await client.query(
    `select count(*)::int n from pg_proc where proname = 'apply_projections_legacy'`
  )
  if (rows[0].n !== 0) fail('P24 apply_projections_legacy still exists — an empty function with a load-bearing name')
  else ok('P24 the legacy projector is dropped, not emptied — nobody can edit it believing it runs')
}

// P25 — the ownership boundary inside the projector (S02.a).
//
// `question_blocks` is written from an AGENT-SUPPLIED array of task ids, and it
// used to carry no owner at all: the row was (question_id, task_id), and the
// task was blocked by `where id = t` with nothing else. So a question asked in
// one estate could freeze work in another, and the join table could not even be
// asked which estate it belonged to. Both halves are probed here, because the
// columns alone would not have stopped it — the predicate is what stops it, and
// the columns are what make the row answerable afterwards.
async function p25_scopeOwnership() {
  const agentActor = JSON.stringify({ kind: 'agent', id: 's-scope' })
  const mine = randomUUID()
  const theirs = randomUUID()
  const q = randomUUID()

  await client.query(`select append_event($1,'task.started@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: mine, instruction: 'my work', option_id: 'claude-code' }), projA])
  await client.query(`select append_event($1,'task.started@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [B, seedActor, JSON.stringify({ id: theirs, instruction: 'their work', option_id: 'claude-code' }), projB])

  // One question in estate A naming BOTH tasks — the reach an agent has today.
  await client.query(`select append_event($1,'question.asked@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, agentActor, JSON.stringify({
      id: q, project_id: projA, text: 'which database version?',
      why_blocked: 'the migration differs', kind: 'decision', about: 'db.version',
      blocks: [mine, theirs]
    }), projA])

  const theirsRow = await client.query(
    `select blocked_by, blocked_since from project_tasks where id = $1`, [theirs])
  if (theirsRow.rows[0]?.blocked_by !== null || theirsRow.rows[0]?.blocked_since !== null)
    fail('P25 cross-estate block', `estate B's task was blocked by estate A's question`)
  else ok('P25 a question cannot block a task in another estate')

  // The positive control: the same event DID block the task it was entitled to,
  // so the probe above is measuring the boundary rather than a broken arm.
  const mineRow = await client.query(`select blocked_by from project_tasks where id = $1`, [mine])
  if (mineRow.rows[0]?.blocked_by !== q)
    fail('P25 control', 'the question blocked nothing at all, so the refusal above proves nothing')
  else ok('P25 and it still blocks the one it may')

  const owner = await client.query(
    `select estate_id, project_id, task_id from question_blocks where question_id = $1`, [q])
  if (owner.rows.length === 0) fail('P25 rows', 'no block rows were written')
  else if (owner.rows.some((r) => r.estate_id !== A || r.project_id !== projA))
    fail('P25 ownership', 'a block row does not name the estate and project of its question')
  else ok('P25 every block row names the estate and project it belongs to')

  // The subtler half, and it was found by WATCHING the plant above: predicating
  // only the `update` still wrote a block row for the foreign task — labelled
  // with this estate, pointing outside it. A row that blocks nothing, in the
  // table that exists to say what is blocked.
  if (owner.rows.length !== 1 || owner.rows[0].task_id !== mine)
    fail('P25 dangling', `${owner.rows.length} block rows; a row names a task it cannot block`)
  else ok('P25 and no block row is written for a task it could never block')

  // Goals gained an owner in the same migration, and the projector fills it from
  // the event rather than from the payload — a goal cannot claim another estate.
  const g = randomUUID()
  await client.query(`select append_event($1,'goal.defined@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: g, title: 'ship the boundary', autonomy: 'safe' }), projA])
  const goal = await client.query(`select estate_id, project_id from goals where id = $1`, [g])
  if (goal.rows[0]?.estate_id !== A || goal.rows[0]?.project_id !== projA)
    fail('P25 goal owner', `goal owner is ${goal.rows[0]?.estate_id}, wanted ${A}`)
  else ok('P25 a goal is owned by the estate that defined it')

  // And the whole point of an owner column: the scheduler-shaped read now has a
  // predicate to use, and it separates the two estates completely.
  const seen = await client.query(
    `select count(*)::int n from question_blocks where estate_id = $1`, [B])
  if (seen.rows[0].n !== 0) fail('P25 leak', `estate B can see ${seen.rows[0].n} of estate A's block rows`)
  else ok('P25 estate B sees none of it')
}

// P26 — the projector reaches one estate (CO-110, ADR-0049).
//
// This was PROVEN before it was fixed rather than reasoned about: an event in
// estate A carrying estate B's task id in its payload moved B's task from
// running to cancelled, with A's reason on it. 26 mutating statements across
// eight projector functions matched a row by a bare uuid.
//
// The writer having validated the id is not the floor, because under ADR-0014 a
// projection is DERIVED: `rebuild_estate_projections(A)` replays A's journal
// with no writer present. A rebuild has to be a function of one estate's events.
async function p26_projectorScope() {
  const other = randomUUID()
  const mine = randomUUID()

  await client.query(`select append_event($1,'task.started@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [B, seedActor, JSON.stringify({ id: other, instruction: 'theirs', option_id: 'claude-code' }), projB])
  await client.query(`select append_event($1,'task.started@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: mine, instruction: 'mine', option_id: 'claude-code' }), projA])

  // Estate A names estate B's task. Nothing stops the EVENT being written — the
  // journal is append-only and takes what it is given; what must not happen is
  // the projection moving.
  await client.query(`select append_event($1,'task.abandoned@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: other, reason: 'reached across' }), projA])

  const theirs = await client.query(
    `select status, abandoned_reason from project_tasks where id = $1`, [other])
  if (theirs.rows[0]?.status !== 'running' || theirs.rows[0]?.abandoned_reason)
    fail('P26 cross-estate write',
      `estate B's task is ${theirs.rows[0]?.status} carrying "${theirs.rows[0]?.abandoned_reason}"`)
  else ok('P26 an event in one estate cannot move a task in another')

  // The control, without which the line above passes just as happily against an
  // arm that stopped working altogether.
  await client.query(`select append_event($1,'task.abandoned@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: mine, reason: 'its own' }), projA])
  const own = await client.query(
    `select status, abandoned_reason from project_tasks where id = $1`, [mine])
  if (own.rows[0]?.abandoned_reason !== 'its own')
    fail('P26 control', 'the arm did not move the task it was entitled to move')
  else ok('P26 and it still moves the one it may')

  // Replay is where the writer is definitively absent. Rebuilding A must not
  // touch B, and the seq of B's rows is the cheapest thing that would move.
  const beforeB = await client.query(
    `select md5(string_agg(id::text || status || coalesce(abandoned_reason,''), '|' order by id)) h
       from project_tasks where estate_id = $1`, [B])
  await client.query(`select rebuild_estate_projections($1)`, [A])
  const afterB = await client.query(
    `select md5(string_agg(id::text || status || coalesce(abandoned_reason,''), '|' order by id)) h
       from project_tasks where estate_id = $1`, [B])
  if (beforeB.rows[0].h !== afterB.rows[0].h)
    fail('P26 replay', "rebuilding estate A changed estate B's projections")
  else ok('P26 rebuilding one estate leaves the other byte-identical')
}

// P27 — the floor validates a live matching grant, not a non-null column (S03.boundary).
//
// PROVEN BEFORE IT WAS FIXED. `floored_needs_grant` reads
// `check (floor_class is null or grant_id is not null)` under the comment "Code
// that bypasses the policy module still hits this line". It did, and then it
// accepted a floored effect citing a grant that was expired, already consumed,
// issued for a different target, and owned by another estate — all four.
//
// `policy.ts#findGrantFor` checks every one of those. That was the defect: the
// check lived in the caller, and the schema line whose whole purpose is to
// survive a bypass only asked whether a uuid was present.
/**
 * P29 — a binding is not admitted merely because the uuid exists (S02).
 *
 * MEASURED before this: eleven foreign keys, every one single-column and
 * pointing at the target's `id` alone. Not one asked whether the referenced row
 * was in the SAME ESTATE, so a row in estate A could name estate B's grant,
 * goal or task and the database would take it. The paths were closed only by
 * functions that remembered to filter — every one of them a caller being
 * careful.
 */
/**
 * P30 — a reservation is released only with proof it was never dispatched (S03).
 *
 * The rule that is easy to get wrong: the ABSENCE of a receipt is not proof.
 * A reservation with no result recorded may mean nothing was started, or it may
 * mean the process died between the external call and the record of it — the
 * case `outcome_unknown` exists for. Releasing on "we see no attempt" hands back
 * a one-shot permission for something that may already have happened.
 */
/**
 * P31 — an existing task is ADMITTED before it runs (S04).
 *
 * The measured gap: nothing could start a task that already existed. Every
 * launch appended a fresh `task.started@1`, so a task on the board could never
 * be run — and the blocking set S06 computes was consulted nowhere, because a
 * brand-new task has no blockers by construction.
 */
/**
 * P32 — a run is born at admission, and an ended one does not reopen (M188).
 *
 * MEASURED before this: `run_id` had been on the journal since migration one
 * and was set on ZERO of 2 260 events. The column existed, was projected, was
 * on the wire, and had never held a value.
 */
async function p32_taskRuns() {
  const taskId = randomUUID()
  await client.query(`select append_event($1,'task.started@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: taskId, instruction: 'run me', option_id: 'claude-code' }), projA])
  await client.query(`update project_tasks set status = 'backlog' where estate_id = $1 and id = $2`, [A, taskId])

  const { rows: [first] } = await client.query(
    `select admit_task_launch($1,$2,$3::jsonb,$4) as r`, [A, taskId, seedActor, randomUUID()])
  first.r.task_run_id && first.r.run_ordinal === 1
    ? ok('P32 admission creates a run, and it is attempt 1')
    : fail('P32 first admission', JSON.stringify(first.r))

  // The run id reaches the JOURNAL, which is the whole point: "what happened
  // during that run" had no answer because nothing ever set the column.
  const { rows: [stamped] } = await client.query(
    `select count(*)::int as n from journal where estate_id = $1 and run_id = $2`, [A, first.r.task_run_id])
  stamped.n > 0
    ? ok(`P32 and the run id reaches the journal (${stamped.n} event(s) carry it)`)
    : fail('P32 run_id never left the projection')

  // A DENIED admission is NO RUN. Refusing to start is not a run that failed.
  const runsBefore = (await client.query(
    `select count(*)::int as n from task_runs where estate_id = $1 and task_id = $2`, [A, taskId])).rows[0].n
  const { rows: [denied] } = await client.query(
    `select admit_task_launch($1,$2,$3::jsonb,$4) as r`, [A, taskId, seedActor, randomUUID()])
  const runsAfter = (await client.query(
    `select count(*)::int as n from task_runs where estate_id = $1 and task_id = $2`, [A, taskId])).rows[0].n
  denied.r.admitted === false && runsAfter === runsBefore
    ? ok('P32 and a refused admission creates NO run — refusing to start is not a run that failed')
    : fail('P32 denied admission made a run: ' + runsBefore + ' -> ' + runsAfter)

  // AN ENDED RUN DOES NOT REOPEN. A retry is a new run with its own id.
  await client.query(`select append_event($1,'run.ended@1',$2::jsonb,$3::jsonb)`,
    [A, seedActor, JSON.stringify({ task_run_id: first.r.task_run_id, outcome: 'completed' })])
  await expectError(
    'P32 reopening an ended run',
    `update task_runs set state = 'active' where estate_id = $1 and task_run_id = $2`,
    [A, first.r.task_run_id], '23514')

  await expectError(
    'P32 rewriting the runtime receipt of an ended run',
    `update task_runs set outcome = 'failed_known' where estate_id = $1 and task_run_id = $2`,
    [A, first.r.task_run_id], '23514')

  // And a fresh admission is a NEW run with its own ordinal — a retry does not
  // overwrite the first attempt's account of itself.
  await client.query(`delete from leases where estate_id = $1 and work_id = $2`, [A, taskId])
  await client.query(`update project_tasks set status = 'backlog' where estate_id = $1 and id = $2`, [A, taskId])
  const { rows: [second] } = await client.query(
    `select admit_task_launch($1,$2,$3::jsonb,$4) as r`, [A, taskId, seedActor, randomUUID()])
  second.r.admitted === true && second.r.run_ordinal === 2 &&
  second.r.task_run_id !== first.r.task_run_id
    ? ok('P32 and a retry is a NEW run, attempt 2, rather than the first one reopened')
    : fail('P32 second admission: ' + JSON.stringify(second.r))

  // The ordinal is DERIVED, and the index is what makes that true rather than
  // hoped. Named here so a defect that chose the ordinal fails an assertion
  // instead of crashing the suite on an unhandled unique violation.
  await expectError(
    'P32 two runs claiming the same attempt number',
    `insert into task_runs (estate_id, project_id, task_id, run_ordinal, state, admitted_seq)
     values ($1,$2,$3,1,'admitted',1)`,
    [A, projA, taskId], '23505')
}

async function p31_admitTaskLaunch() {
  const taskId = randomUUID()
  await client.query(`select append_event($1,'task.started@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: taskId, instruction: 'wire the outbox', option_id: 'claude-code' }), projA])
  await client.query(`update project_tasks set status = 'backlog' where estate_id = $1 and id = $2`, [A, taskId])

  // ——— a blocked task is refused, and the refusal names the count
  const questionId = randomUUID()
  // A question is asked BY somebody — the constraint allows agent or person,
  // and the suite's own system actor is neither.
  const asker = JSON.stringify({ kind: 'person', id: 'operator' })
  await client.query(`select append_event($1,'question.asked@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, asker, JSON.stringify({ id: questionId, project_id: projA, text: 'which database?',
      kind: 'decision', blocks: [taskId] }), projA])

  const { rows: [blocked] } = await client.query(
    `select admit_task_launch($1,$2,$3::jsonb,$4) as r`, [A, taskId, seedActor, randomUUID()])
  blocked.r.admitted === false && blocked.r.reason_code === 'blocked'
    ? ok(`P31 a task with an unanswered question is NOT admitted (${blocked.r.open_blockers} blocker)`)
    : fail('P31 blocked admission', JSON.stringify(blocked.r))

  // ——— the positive control: answer it, and the same task is admitted
  await client.query(
    `select answer_question($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)`,
    [A, projA, questionId, randomUUID(), 1, 'postgres', null, null, asker])
  const session = randomUUID()
  const { rows: [admitted] } = await client.query(
    `select admit_task_launch($1,$2,$3::jsonb,$4) as r`, [A, taskId, seedActor, session])
  admitted.r.admitted === true && admitted.r.instruction === 'wire the outbox'
    ? ok('P31 and once the question is answered the SAME task is admitted, carrying its instruction')
    : fail('P31 admission', JSON.stringify(admitted.r))

  // ——— one launch at a time: the lease refuses the second
  const { rows: [second] } = await client.query(
    `select admit_task_launch($1,$2,$3::jsonb,$4) as r`, [A, taskId, seedActor, randomUUID()])
  second.r.admitted === false && second.r.reason_code === 'run_unresolved'
    ? ok('P31 and a second launch is refused while the first holds the lease')
    : fail('P31 lease', JSON.stringify(second.r))

  // ——— a closed task does not reopen
  const closed = randomUUID()
  await client.query(`select append_event($1,'task.started@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: closed, instruction: 'done thing', option_id: 'claude-code' }), projA])
  await client.query(`update project_tasks set status = 'done' where estate_id = $1 and id = $2`, [A, closed])
  const { rows: [term] } = await client.query(
    `select admit_task_launch($1,$2,$3::jsonb,$4) as r`, [A, closed, seedActor, randomUUID()])
  term.r.admitted === false && term.r.reason_code === 'terminal'
    ? ok('P31 and a closed task is not reopened by a launch')
    : fail('P31 terminal', JSON.stringify(term.r))

  // ——— another estate's task is not found, rather than refused with detail
  const { rows: [foreign] } = await client.query(
    `select admit_task_launch($1,$2,$3::jsonb,$4) as r`, [B, taskId, seedActor, randomUUID()])
  foreign.r.reason_code === 'not_found'
    ? ok('P31 and another estate task answers not_found, the same as an absent one')
    : fail('P31 cross-estate', JSON.stringify(foreign.r))
}

async function p30_releaseNeedsProof() {
  const target = '/tmp/' + randomUUID()
  const grantId = randomUUID()
  await client.query(
    `insert into grants (id, estate_id, floor_class, target, expires_at)
     values ($1,$2,'deletion',$3, now() + interval '1 hour')`, [grantId, A, target])

  const commandId = randomUUID()
  const { rows: [res] } = await client.query(
    `select * from reserve_effect($1, null, 'project.delete', 'deletion', $2, $3)`,
    [A, target, commandId])

  // Without a proof reference there is no release at all.
  await expectError(
    'P30 a release with no proof reference',
    `select release_grant_reservation($1,$2,$3::jsonb,$4)`,
    [A, res.reservation_id, seedActor, ''], '22023')

  // The positive control: an untouched reservation releases, and the receipt
  // names what proved it.
  const { rows: [rel] } = await client.query(
    `select * from release_grant_reservation($1,$2,$3::jsonb,$4)`,
    [A, res.reservation_id, seedActor, 'the operator cancelled before anything ran'])
  rel && rel.type === 'grant.reservation_released@1'
    ? ok('P30 an untouched reservation releases, and the receipt names its proof')
    : fail('P30 release', `got ${JSON.stringify(rel)}`)

  // Idempotent: a retry after a lost response is not a second release.
  const { rows: [again] } = await client.query(
    `select * from release_grant_reservation($1,$2,$3::jsonb,$4)`,
    [A, res.reservation_id, seedActor, 'retry'])
  again && again.seq === rel.seq
    ? ok('P30 and a retry returns the same receipt rather than releasing twice')
    : fail('P30 release idempotency', `${again?.seq} vs ${rel.seq}`)

  // ——— the one that matters: a DISPATCHED effect cannot be released
  const grant2 = randomUUID()
  const target2 = '/tmp/' + randomUUID()
  await client.query(
    `insert into grants (id, estate_id, floor_class, target, expires_at)
     values ($1,$2,'deletion',$3, now() + interval '1 hour')`, [grant2, A, target2])
  const command2 = randomUUID()
  const { rows: [res2] } = await client.query(
    `select * from reserve_effect($1, null, 'project.delete', 'deletion', $2, $3)`,
    [A, target2, command2])
  await client.query(`select append_event($1,'effect.reserved@1',$2::jsonb,$3::jsonb)`,
    [A, seedActor, JSON.stringify({ command_id: command2, action_class: 'project.delete',
      floor_class: 'deletion', target: target2, reservation_id: res2.reservation_id })])
  await client.query(`select append_event($1,'effect.dispatch_started@1',$2::jsonb,$3::jsonb)`,
    [A, seedActor, JSON.stringify({ command_id: command2, attempt_no: 1, idempotency_key: 'k' })])

  await expectError(
    'P30 releasing a reservation that has a dispatch attempt',
    `select release_grant_reservation($1,$2,$3::jsonb,$4)`,
    [A, res2.reservation_id, seedActor, 'we saw no result so nothing happened'], '23514')
}

async function p29_crossEstateReference() {
  // A goal in estate B, and a task in estate A that reaches for it.
  const theirGoal = randomUUID()
  await client.query(
    `insert into goals (id, estate_id, project_id, title, autonomy) values ($1,$2,$3,'theirs','guarded')`,
    [theirGoal, B, projB]
  )
  await expectError(
    'P29 a task in one estate citing another estate goal',
    `insert into project_tasks (id, estate_id, project_id, instruction, option_id, seq, goal_id)
     values ($1,$2,$3,'reaching','claude-code',1,$4)`,
    [randomUUID(), A, projA, theirGoal],
    '23503'
  )

  // The POSITIVE CONTROL, and it is what makes the refusal mean anything: the
  // same shape inside one estate is accepted. Without it, a constraint that
  // refuses everything would pass the line above.
  const myGoal = randomUUID()
  await client.query(
    `insert into goals (id, estate_id, project_id, title, autonomy) values ($1,$2,$3,'mine','guarded')`,
    [myGoal, A, projA]
  )
  const mine = randomUUID()
  await client.query(
    `insert into project_tasks (id, estate_id, project_id, instruction, option_id, seq, goal_id)
     values ($1,$2,$3,'ordinary','claude-code',2,$4)`,
    [mine, A, projA, myGoal]
  )
  ok('P29 and the same reference INSIDE one estate is accepted (positive control)')

  // A lease reaching across, from the other direction.
  await expectError(
    'P29 a lease in one estate over another estate task',
    `insert into leases (estate_id, project_id, work_id, owner_session, idempotency_key,
                         expires_at, write_scopes, claimed_seq)
     values ($1,$2,$3,$4,$5, now() + interval '1 hour', array['task'], 1)`,
    [B, projB, mine, randomUUID(), randomUUID()],
    '23503'
  )

  // And the reference that must STAY single-column: a person belongs to no
  // estate, so qualifying it would be inventing a boundary the identity plane
  // does not have.
  const { rows: [personFk] } = await client.query(
    `select count(*)::int as n from information_schema.key_column_usage k
      join information_schema.table_constraints t on t.constraint_name = k.constraint_name
     where t.constraint_type = 'FOREIGN KEY' and k.table_name = 'memberships'
       and k.column_name = 'person_id'`
  )
  personFk.n === 1
    ? ok('P29 and a person is still referenced without an estate, because they belong to none')
    : fail('P29 person reference', `expected one column, found ${personFk.n}`)
}

async function p27_authorityFloor() {
  const target = '/tmp/' + randomUUID()
  const liveGrant = randomUUID()
  await client.query(
    `insert into grants (id, estate_id, floor_class, target, expires_at)
     values ($1,$2,'deletion',$3, now() + interval '1 hour')`, [liveGrant, A, target])

  // ——— the attack that used to work
  await expectError(
    'P27 a floored effect citing a grant id directly',
    `insert into effect_intents (estate_id, action_class, floor_class, grant_id, receipt_seq)
     values ($1,'project.delete','deletion',$2, 1)`, [A, liveGrant], '42501')

  // ——— the positive control: through the door, the SAME effect is accepted
  const { rows: [res] } = await client.query(
    `select * from reserve_effect($1, null, 'project.delete', 'deletion', $2, $3)`,
    [A, target, randomUUID()])
  await client.query(
    `insert into effect_intents (estate_id, action_class, floor_class, reservation_id, receipt_seq)
     values ($1,'project.delete','deletion',$2, 2)`, [A, res.reservation_id])
  const { rows: [intent] } = await client.query(
    `select grant_id from effect_intents where reservation_id = $1`, [res.reservation_id])
  if (intent?.grant_id !== liveGrant)
    fail('P27 lineage', 'the intent did not inherit the grant behind its reservation')
  else ok('P27 and the same effect through a reservation is accepted, carrying its grant lineage')

  // ——— single use is an index, not a sequence of statements
  await expectError(
    'P27 a second command reserving the same grant',
    `select * from reserve_effect($1, null, 'project.delete', 'deletion', $2, $3)`,
    [A, target, randomUUID()], '42501')

  // ——— every dead shape, one at a time, so a pass names which rule held
  const dead = [
    ['expired',        `now() - interval '1 day'`, 'null', 'null'],
    ['already consumed', `now() + interval '1 hour'`, `now()`, 'null'],
    ['revoked',        `now() + interval '1 hour'`, 'null', `now()`]
  ]
  for (const [name, expires, consumed, revoked] of dead) {
    const t = '/tmp/' + randomUUID()
    await client.query(
      `insert into grants (id, estate_id, floor_class, target, expires_at, consumed_at, revoked_at)
       values (gen_random_uuid(), $1, 'deletion', $2, ${expires}, ${consumed}, ${revoked})`, [A, t])
    await expectError(`P27 a ${name} grant`,
      `select * from reserve_effect($1, null, 'project.delete', 'deletion', $2, $3)`,
      [A, t, randomUUID()], '42501')
  }

  // ——— scope: another estate, another project, another action
  const scoped = '/tmp/' + randomUUID()
  await client.query(
    `insert into grants (id, estate_id, project_id, action_class, floor_class, target, expires_at)
     values (gen_random_uuid(), $1, $2, 'project.delete', 'deletion', $3, now() + interval '1 hour')`,
    [A, projA, scoped])
  await expectError('P27 the same grant asked for from another estate',
    `select * from reserve_effect($1, null, 'project.delete', 'deletion', $2, $3)`,
    [B, scoped, randomUUID()], '42501')
  await expectError('P27 a project-bound grant asked for from another project',
    `select * from reserve_effect($1, $2, 'project.delete', 'deletion', $3, $4)`,
    [A, projB, scoped, randomUUID()], '42501')
  await expectError('P27 a grant that names one action asked for another',
    `select * from reserve_effect($1, $2, 'file.overwrite', 'deletion', $3, $4)`,
    [A, projA, scoped, randomUUID()], '42501')
  // …and the control: asked for correctly, it reserves.
  const { rows: [good] } = await client.query(
    `select * from reserve_effect($1, $2, 'project.delete', 'deletion', $3, $4)`,
    [A, projA, scoped, randomUUID()])
  if (good?.state !== 'reserved') fail('P27 scope control', 'the correctly-scoped request did not reserve')
  else ok('P27 while the correctly scoped request reserves — the refusals are the scope, not a broken door')

  // ——— the door itself: nobody may write a reservation by hand
  await client.query('begin')
  try {
    await client.query('set local role service_role')
    await expectError('P27 an insert into grant_reservations as the app role',
      `insert into grant_reservations (estate_id, grant_id, command_id, action_class, floor_class, target, state)
       values ($1,$2,$3,'project.delete','deletion','/x','reserved')`,
      [A, liveGrant, randomUUID()], '42501')
  } finally {
    await client.query('rollback')
  }
}

// P28 — the blocking set is canonical, and an answer is one commit (S06).
//
// PROVEN BEFORE THE FIX: two questions blocked one task, answering the first
// left `open_blockers = 1` and `task.blocked_by = NULL`. The task read as free
// while an open question still blocked it, because `blocked_by` was MAINTAINED
// — coalesced on the way in, so the second question never registered, and
// cleared unconditionally on the way out.
async function p28_blockingSet() {
  const agentActor = JSON.stringify({ kind: 'agent', id: 's-block' })
  const operator = JSON.stringify({ kind: 'person', id: 'operator' })
  const task = randomUUID()
  const q1 = randomUUID()
  const q2 = randomUUID()

  await client.query(`select append_event($1,'task.started@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, seedActor, JSON.stringify({ id: task, instruction: 'blocked work', option_id: 'claude-code' }), projA])
  for (const [id, text] of [[q1, 'which database'], [q2, 'which window']]) {
    await client.query(`select append_event($1,'question.asked@1',$2::jsonb,$3::jsonb,'1',$4)`,
      [A, agentActor, JSON.stringify({ id, project_id: projA, text, kind: 'decision', blocks: [task] }), projA])
  }

  const openBlockers = async () => (await client.query(
    `select count(*)::int n from question_blocks qb join questions q on q.id = qb.question_id
      where qb.task_id = $1 and q.status = 'open'`, [task])).rows[0].n
  const blockedBy = async () => (await client.query(
    `select blocked_by from project_tasks where id = $1`, [task])).rows[0].blocked_by

  if (await openBlockers() !== 2) fail('P28 setup', 'two questions did not both block')
  else if (await blockedBy() !== q1) fail('P28 earliest', 'the summary does not name the earliest blocker')
  else ok('P28 two questions block one task, and the summary names the earliest')

  // ——— answer the first
  const first = await client.query(
    `select answer_question($1,$2,$3,$4,1,'postgres',null,null,$5::jsonb) as r`,
    [A, projA, q1, randomUUID(), operator])
  const r1 = first.rows[0].r
  if (await openBlockers() !== 1) fail('P28 first answer', 'the second blocker disappeared')
  else if (await blockedBy() !== q2)
    fail('P28 promotion', 'the summary is ' + (await blockedBy()) + ', not the remaining blocker')
  else ok('P28 answering one of two leaves the task blocked, by the one that remains')

  if (r1.unblocked.length !== 0 || r1.still_blocked[0]?.open_blockers !== 1)
    fail('P28 report', 'the command did not report the task as still blocked: ' + JSON.stringify(r1))
  else ok('P28 and the command says so: nothing unblocked, one blocker left')

  // ——— the answer is a decision the project remembers, in the same commit
  const fact = await client.query(
    `select claim, kind from memory_facts where id = $1`, [r1.decision_id])
  if (fact.rows[0]?.claim !== 'postgres' || fact.rows[0]?.kind !== 'decision')
    fail('P28 decision', 'the answer did not become a decision fact')
  else ok('P28 the answer became a decision the project remembers, atomically')

  // ——— answering again is refused, and the first answer is untouched
  await expectError('P28 a second answer to a settled question',
    `select answer_question($1,$2,$3,$4,1,'mysql',null,null,$5::jsonb)`,
    [A, projA, q1, randomUUID(), operator], '22023')
  const kept = await client.query(`select answer from questions where id = $1`, [q1])
  if (kept.rows[0]?.answer !== 'postgres') fail('P28 overwrite', 'the settled answer changed')
  else ok('P28 and the settled answer is unchanged')

  // ——— a retry of ONE answer is that answer
  const cmd = randomUUID()
  const a = (await client.query(`select answer_question($1,$2,$3,$4,1,'ten',null,null,$5::jsonb) as r`,
    [A, projA, q2, cmd, operator])).rows[0].r
  const b = (await client.query(`select answer_question($1,$2,$3,$4,1,'ten',null,null,$5::jsonb) as r`,
    [A, projA, q2, cmd, operator])).rows[0].r
  if (a.decision_id !== b.decision_id || b.repeated !== true)
    fail('P28 idempotency', 'a retry produced a second decision: ' + JSON.stringify([a, b]))
  else ok('P28 a retry of one answer returns the same resolution, not a second decision')

  // ——— now nothing blocks it, and the command says which task became eligible
  if (await openBlockers() !== 0 || (await blockedBy()) !== null)
    fail('P28 final', 'the task is still blocked after both answers')
  else if (!a.unblocked.includes(task))
    fail('P28 eligibility', 'the command did not name the task that became eligible')
  else ok('P28 answering both frees the task, and the command names it exactly once')

  // ——— scope and staleness
  await expectError('P28 answering a question from another estate',
    `select answer_question($1,$2,$3,$4,1,'x',null,null,$5::jsonb)`,
    // P0002 is plpgsql's NO_DATA_FOUND. Measured rather than assumed: the SQL
    // standard's 02000 is a different code and RAISE does not produce it.
    [B, projB, q2, randomUUID(), operator], 'P0002')
  const q3 = randomUUID()
  await client.query(`select append_event($1,'question.asked@1',$2::jsonb,$3::jsonb,'1',$4)`,
    [A, agentActor, JSON.stringify({ id: q3, project_id: projA, text: 'later', kind: 'decision', blocks: [] }), projA])
  await expectError('P28 answering a revision that has moved',
    `select answer_question($1,$2,$3,$4,7,'x',null,null,$5::jsonb)`,
    [A, projA, q3, randomUUID(), operator], '40001')
}

async function main() {
  await client.connect()
  console.log('planted-defect suite — migration 1')
  try {
    await setup()
    await p0_gapless()
    await p1_crossTenant()
    await p2_floor()
    await p3_onePm()
    await p4_appendOnly()
    await p6_memory()
    await p7_projectUpdate()
    await p8_repos()
    await p9_settings()
    await p10_tasks()
    await p11_agentStages()
    await p12_projectionDoor()
    await p19_noTruncate()
    await p20_createIsIdempotent()
    await p13_eventTypeRegistry()
    await p14_lockTimeout()
    await p15_transcripts()
    await p16_provenanceAndReconciliation()
    await p17_bitemporal()
    await p18_supersedeGuard()
    await p21_grants()
    await p22_questions()
    await p23_priorityAndTrust()
    await p24_rebuildParity()
    await p25_scopeOwnership()
    await p26_projectorScope()
    await p27_authorityFloor()
    await p28_blockingSet()
    await p29_crossEstateReference()
    await p30_releaseNeedsProof()
    await p31_admitTaskLaunch()
    await p32_taskRuns()
    await p5_rebuild()
    await cleanup()
  } finally {
    await client.end()
  }
  if (failures > 0) {
    console.error(`\n${failures} probe(s) FAILED — the schema does not hold its own contract`)
    process.exit(1)
  }
  console.log('\nall probes green: every attempted violation was refused by the database')
}

main().catch((e) => {
  console.error('suite crashed:', e)
  process.exit(1)
})
