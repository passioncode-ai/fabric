// Migration 79 (suffix 81) — the project board's durable core, COM-02.1 (ADR-0117), on the fully migrated
// chain. The acceptance of COM-02 drives the order: two estates cannot reach each other's board first, then a
// retry after a lost response returns the same message, then the rest.
// To WATCH this suite fail, run the runner with FABRIC_SKIP_MIGRATION=20261005000081_project_board.sql.
// #region project-board-core — docs: docs/adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md#5-names-so-that-later-work-does-not-collide
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { runPsqlAsync } from './bounded-psql.mjs'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-project-board-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const psqlArgs = [url, '-X', '-q', '-t', '-A', '-F', '|', '-v', 'ON_ERROR_STOP=1']
const sql = input => execFileSync('psql', psqlArgs, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const refuses = (input, pattern) => {
  try { sql(input) } catch (e) { assert.match(String(e.stderr ?? e.message), pattern); return }
  assert.fail(`expected a refusal matching ${pattern}`)
}
let count = 0; const failed = []
const test = async (name, fn) => {
  try { await fn(); console.log('PASS ' + name); count++ } catch (e) { failed.push(name); console.log(`FAIL ${name}\n  ${String(e.message).split('\n')[0]}${e.stderr ? '\n  ' + String(e.stderr).trim().split('\n').slice(0, 3).join(' | ') : ''}`) }
}

const id = n => `79000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const A = id(1), B = id(2)
const PA1 = id(11), PA2 = id(12), PA3 = id(13), PB1 = id(21)
const lit = v => `'${String(v).replace(/'/g, "''")}'`
const j = v => `${lit(JSON.stringify(v))}::jsonb`
const system = { kind: 'system', id: 'board-probe' }
const agent = (label = 'Example agent') => ({ kind: 'agent', id: 'example-agent', label, provenance: 'trusted' })
const digest = n => 'sha256:' + n.toString(16).padStart(64, '0')
const append = (estate, type, payload, project = null) =>
  sql(`set role service_role; select seq from append_event('${estate}','${type}',${j(system)},${j(payload)},'1',${project ? `'${project}'` : 'null'})`)
const submit = (estate, sender, body, d, principal = agent()) =>
  JSON.parse(sql(`set role service_role; select board_submit('${estate}','${sender}',${j(principal)},${j(body)},${lit(d)})`))
const list = (estate, reader, after = 0, limit = 50, thread = null) =>
  JSON.parse(sql(`set role service_role; select board_list('${estate}','${reader}',${thread ? `'${thread}'` : 'null'},${after},${limit})`))
const get = (estate, reader, message) => JSON.parse(sql(`set role service_role; select board_get('${estate}','${reader}','${message}')`))
const ack = (estate, reader, message) => JSON.parse(sql(`set role service_role; select board_read_ack('${estate}','${reader}',${j(agent())},'${message}')`))
const status = (estate, reader) => JSON.parse(sql(`set role service_role; select board_status('${estate}','${reader}')`))
const unread = (estate, reader) => status(estate, reader).unread
const events = (estate, type) => Number(sql(`select count(*) from journal where estate_id='${estate}' and type='${type}'`))
let keyN = 0
const key = () => `key-${String(++keyN).padStart(6, '0')}`
const request = (target, participants, extra = {}) => ({
  idempotency: { epoch: 1, key: key() }, thread: { new: { participants, subject: 'Weekly retention' } }, kind: 'request',
  body: { text: 'Please compute 7-day retention and attach the query.' }, request: { target, capability: 'analytics.retention' }, ...extra
})
const message = (thread, extra = {}) => ({ idempotency: { epoch: 1, key: key() }, thread: { id: thread }, kind: 'message', body: { text: 'noted' }, ...extra })

append(A, 'estate.created@1', { name: 'board estate A', owner_person_id: id(91) })
append(B, 'estate.created@1', { name: 'board estate B', owner_person_id: id(92) })
for (const [estate, project, name] of [[A, PA1, 'growth'], [A, PA2, 'analytics'], [A, PA3, 'finance'], [B, PB1, 'other estate']])
  append(estate, 'project.created@1', { id: project, name }, project)

let threadA, requestA
await test('two estates cannot reach each other: estate B is refused before estate A submits anything (COM-02 resume)', () => {
  const foreign = submit(A, PB1, request(PA2, [PA2]), digest(1))
  assert.equal(foreign.error?.code, 'not_authorized', JSON.stringify(foreign))
  const foreignParticipant = submit(B, PB1, request(PA2, [PA2]), digest(2))
  assert.equal(foreignParticipant.error?.code, 'not_authorized', JSON.stringify(foreignParticipant))
  assert.equal(foreignParticipant.error.message, 'A participant is not a Project this board can address.')
  assert.equal(events(A, 'comms.message_submitted@1') + events(B, 'comms.message_submitted@1'), 0)
})

await test('a request opens a thread; the target reads it queued; the journal carries the digest and never the body', () => {
  const r = submit(A, PA1, request(PA2, [PA2]), digest(10))
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.repeated, false)
  // C3 (migration 86): a receipt names the request as an object and never the estate seq.
  assert.deepEqual(r.request, { id: r.message, state: 'queued', effect: 'not_started', revision: 1 })
  assert.equal('seq' in r, false, 'the receipt carries the estate seq')
  assert.match(r.at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
  threadA = r.thread; requestA = r.message
  const page = list(A, PA2)
  assert.equal(page.messages.length, 1)
  const m = page.messages[0]
  assert.equal(m.kind, 'request'); assert.equal(m.sender.project, PA1); assert.equal(m.sender.principal.provenance, 'trusted')
  assert.equal(m.request.state, 'queued'); assert.equal(m.request.effect, 'not_started'); assert.equal(m.request.target, PA2)
  assert.equal(m.body.text, 'Please compute 7-day retention and attach the query.')
  assert.equal(m.digest, digest(10))
  const payload = sql(`select payload::text from journal where estate_id='${A}' and type='comms.message_submitted@1'`)
  assert.ok(!payload.includes('retention and attach'), 'the body reached the journal')
  assert.match(payload, /"digest": "sha256:0+a"/)
})

await test('the other estate and a non-participant see nothing of it, in one sentence each', () => {
  assert.equal(list(B, PB1).messages.length, 0)
  assert.equal(get(B, PB1, requestA).error.code, 'not_authorized')
  assert.equal(list(A, PA3).messages.length, 0, 'finance is not a participant')
  assert.deepEqual(get(A, PA3, requestA).error, get(A, PA3, id(999)).error, 'absent and not-yours answer alike')
  assert.equal(list(A, PA3, 0, 50, threadA).error.code, 'not_authorized')
  const intrude = submit(A, PA3, message(threadA), digest(11))
  assert.equal(intrude.error.code, 'not_authorized')
})

await test('a retry after a lost response returns the same receipt and appends nothing; another digest under the key conflicts', () => {
  const body = request(PA2, [PA2])
  const first = submit(A, PA1, body, digest(20))
  const before = events(A, 'comms.message_submitted@1')
  const again = submit(A, PA1, body, digest(20))
  assert.equal(again.message, first.message); assert.equal(again.repeated, true)
  assert.equal(events(A, 'comms.message_submitted@1'), before)
  const conflict = submit(A, PA1, { ...body, body: { text: 'something else' } }, digest(21))
  assert.equal(conflict.error.code, 'idempotency_conflict')
  assert.equal(events(A, 'comms.message_submitted@1'), before)
})

await test('two concurrent submits with one key store one message, and both callers get its receipt', async () => {
  const body = request(PA2, [PA2])
  const call = `set role service_role; select board_submit('${A}','${PA1}',${j(agent())},${j(body)},${lit(digest(30))});`
  const before = events(A, 'comms.message_submitted@1')
  const [x, y] = await Promise.all([1, 2].map(() => runPsqlAsync('psql', psqlArgs, call, { label: 'concurrent board submit' })))
  assert.equal(x.code, 0, x.stderr); assert.equal(y.code, 0, y.stderr)
  const rx = JSON.parse(x.stdout.trim()), ry = JSON.parse(y.stdout.trim())
  assert.equal(rx.message, ry.message); assert.notEqual(rx.repeated, ry.repeated)
  assert.equal(events(A, 'comms.message_submitted@1'), before + 1)
})

await test('FAC-SEM-026: a request targets a participant, only a request carries request details, a reply names its message', () => {
  assert.equal(submit(A, PA1, request(PA3, [PA2]), digest(40)).error.code, 'invalid_arguments')
  // The contract's capabilityName (common.schema.json): lower-case start, then letters, digits, '.', '_' or '-'.
  assert.equal(submit(A, PA1, request(PA2, [PA2], { request: { target: PA2, capability: 'analytics-retention' } }), digest(46)).ok, true)
  assert.equal(submit(A, PA1, request(PA2, [PA2], { request: { target: PA2, capability: 'Analytics.retention' } }), digest(47)).error.code, 'invalid_arguments')
  assert.equal(submit(A, PA1, message(threadA, { request: { target: PA2, capability: 'analytics.retention' } }), digest(41)).error.code, 'invalid_arguments')
  assert.equal(submit(A, PA2, message(threadA, { kind: 'reply' }), digest(42)).error.code, 'invalid_arguments')
  const other = submit(A, PA1, request(PA2, [PA2]), digest(43))
  assert.equal(submit(A, PA2, message(threadA, { kind: 'reply', replyTo: other.message }), digest(44)).error.code, 'invalid_arguments', 'a reply into another thread')
  const reply = submit(A, PA2, message(threadA, { kind: 'reply', replyTo: requestA }), digest(45))
  assert.equal(submit(A, PA2, message(threadA, { replyTo: requestA }), digest(48)).ok, true, 'a plain message may name what it answers')
  assert.equal(reply.ok, true, JSON.stringify(reply))
  assert.equal(get(A, PA1, reply.message).message.replyTo, requestA)
  // A reply is not a completion: the request stays queued.
  assert.equal(get(A, PA1, requestA).message.request.state, 'queued')
})

await test('limits: 65,536 bytes of body pass and one more byte is refused before storage; 8 artifacts, 16 participants', () => {
  const at = text => message(threadA, { body: { text } })
  assert.equal(submit(A, PA1, at('é'.repeat(32768)), digest(50)).ok, true, 'exactly 65,536 bytes')
  const big = submit(A, PA1, at('é'.repeat(32768) + 'x'), digest(51))
  assert.equal(big.error.code, 'body_too_large'); assert.equal(big.error.retryable, false)
  const art = n => Array.from({ length: n }, (_, i) => ({ id: `https://example.com/a/${i}`, contentHash: 'sha256:' + 'b'.repeat(64) }))
  assert.equal(submit(A, PA1, message(threadA, { artifacts: art(8) }), digest(52)).ok, true)
  assert.equal(submit(A, PA1, message(threadA, { artifacts: art(9) }), digest(53)).error.code, 'invalid_arguments')
  for (let n = 30; n < 46; n++) append(A, 'project.created@1', { id: id(n), name: `p${n}` }, id(n))
  const sixteen = Array.from({ length: 16 }, (_, i) => id(30 + i))
  assert.equal(submit(A, PA1, request(id(30), sixteen), digest(54)).error.code, 'invalid_arguments', 'sender + 16 = 17')
  assert.equal(submit(A, PA1, request(id(30), sixteen.slice(0, 15)), digest(55)).ok, true, 'sender + 15 = 16')
  assert.equal(submit(A, PA1, { ...message(threadA), sender: PA2 }, digest(56)).error.code, 'invalid_arguments', 'an undeclared field')
})

await test('an epoch the board has not issued, or has retired, is refused before any effect', () => {
  const before = events(A, 'comms.message_submitted@1')
  assert.equal(submit(A, PA1, message(threadA, { idempotency: { epoch: 2, key: key() } }), digest(60)).error.code, 'invalid_arguments')
  assert.equal(submit(A, PA1, message(threadA, { idempotency: { epoch: 0, key: key() } }), digest(61)).error.code, 'idempotency_window_expired')
  assert.equal(events(A, 'comms.message_submitted@1'), before)
})

await test('pages follow seq: nothing is lost or repeated across a write between two pages', () => {
  const t = submit(A, PA1, { idempotency: { epoch: 1, key: key() }, thread: { new: { participants: [PA3] } }, kind: 'announcement', body: { text: 'p0' } }, digest(70)).thread
  for (let i = 1; i <= 4; i++) submit(A, PA1, message(t, { body: { text: 'p' + i } }), digest(70 + i))
  const seen = []
  let page = list(A, PA3, 0, 2, t); seen.push(...page.messages.map(m => m.body.text))
  submit(A, PA1, message(t, { body: { text: 'p5' } }), digest(76))   // written between two pages
  while (page.more || seen.length < 6) {
    page = list(A, PA3, page.last_seq, 2, t); seen.push(...page.messages.map(m => m.body.text))
    if (!page.messages.length) break
  }
  assert.deepEqual(seen, ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'])
  assert.equal(list(A, PA3, 0, 1000, t).messages.length, 6, 'a page holds at most 100; this one fits')
})

await test('reading marks nothing; an explicit read mark counts once, and a non-participant cannot make one', () => {
  const n = unread(A, PA2)
  assert.ok(n >= 1)
  list(A, PA2); get(A, PA2, requestA)
  assert.equal(unread(A, PA2), n, 'reading changed the unread count')
  const first = ack(A, PA2, requestA), again = ack(A, PA2, requestA)
  assert.equal(first.repeated, false); assert.equal(again.repeated, true); assert.equal(again.message, first.message)
  assert.equal('seq' in first || 'seq' in again, false, 'a read receipt carries the estate seq')
  assert.equal(unread(A, PA2), n - 1)
  assert.equal(events(A, 'comms.read_acked@1'), 1)
  assert.equal(ack(A, PA3, requestA).error.code, 'not_authorized')
})

await test('only the board commands append board events; no API role reads a board table', () => {
  refuses(`set role service_role; select append_event('${A}','comms.message_submitted@1',${j(system)},${j({ message_id: id(500) })})`, /Use the board commands/)
  refuses(`set role service_role; select count(*) from board_messages`, /permission denied/)
  refuses(`set role service_role; select count(*) from board_bodies`, /permission denied/)
  refuses(`set role authenticated; select board_list('${A}','${PA2}',null,0,10)`, /permission denied/)
  refuses(`set role anon; select board_submit('${A}','${PA1}',${j(agent())},${j(message(threadA))},${lit(digest(80))})`, /permission denied/)
})

await test('primary rows are immutable; a rebuild replays the projections unchanged and the queued request survives', () => {
  refuses(`update board_messages set kind='finding' where id='${requestA}'`, /immutable/)
  refuses(`delete from board_threads where id='${threadA}'`, /immutable/)
  const snapshot = () => sql(`select string_agg(message_id||':'||state||':'||effect||':'||revision||':'||submitted_seq, ',' order by message_id) from board_requests where estate_id='${A}';
                              select string_agg(reader_project||':'||message_id||':'||seq, ',' order by message_id) from board_read_marks where estate_id='${A}'`)
  const before = snapshot()
  sql(`select rebuild_estate_projections('${A}')`)
  assert.equal(snapshot(), before)
  assert.equal(get(A, PA2, requestA).message.request.state, 'queued')
})

// Migration 83 (suffix 94) — the operator's read path (COM-06/COM-07; ADR-0117 D3 sanctions the LOCAL
// operator's read): thread summaries and the same paging contract as board_list, without a reader
// Project, writing nothing. To WATCH these fail, run the runner with
// FABRIC_SKIP_MIGRATION=20261011000094_project_board_operator_read.sql.
const threadsOp = (estate) => JSON.parse(sql(`set role service_role; select board_threads_operator('${estate}')`))
const listOp = (estate, after = 0, limit = 50, thread = null) =>
  JSON.parse(sql(`set role service_role; select board_list_operator('${estate}',${thread ? `'${thread}'` : 'null'},${after},${limit})`))

await test('operator threads: the estate’s threads with participants, subject, count and cursor; never another estate’s', () => {
  const a = threadsOp(A)
  assert.equal(a.ok, true, JSON.stringify(a))
  const t = a.threads.find((x) => x.id === threadA)
  assert.ok(t, 'threadA missing from the operator’s thread list')
  assert.deepEqual([...t.participants].sort(), [PA1, PA2].sort())
  assert.equal(t.subject, 'Weekly retention')
  assert.ok(t.messageCount >= 2 && t.lastSeq > 0, JSON.stringify(t))
  const b = threadsOp(B)
  assert.equal(b.ok, true)
  assert.equal(b.threads.some((x) => x.id === threadA), false, 'estate B sees estate A’s thread')
  assert.equal(threadsOp('00000000-0000-0000-0000-000000000000')?.threads?.length ?? 0, 0)
})

await test('operator pages equal the participant’s pages message for message, and an estate-wide page spans threads', () => {
  const mine = listOp(A, 0, 100, threadA)
  const theirs = list(A, PA2, 0, 100, threadA)
  assert.equal(mine.ok, true, JSON.stringify(mine))
  assert.deepEqual(mine.messages, theirs.messages, 'the operator reads a different truth than the participant')
  assert.equal(mine.messages.some((m) => m.body?.text?.includes('retention')), true)
  const wide = listOp(A, 0, 100)
  assert.ok(wide.messages.length >= mine.messages.length)
  assert.equal(wide.messages.every((m) => typeof m.digest === 'string'), true)
  const paged = listOp(A, wide.last_seq, 100)
  assert.equal(paged.messages.length, 0, 'a page after the last seq is empty, not an error')
  assert.equal(paged.last_seq, wide.last_seq)
})

await test('operator read refuses what is not there and never writes: no marks, no events, no rows', () => {
  const foreign = listOp(B, 0, 50, threadA)
  assert.equal(foreign.error?.code, 'not_found', JSON.stringify(foreign))
  const bad = JSON.parse(sql(`set role service_role; select board_list_operator(null,null,0,10)`))
  assert.equal(bad.error?.code, 'invalid_arguments')
  const marksBefore = Number(sql(`select count(*) from board_read_marks where estate_id='${A}'`))
  const eventsBefore = events(A, 'comms.read_acked@1') + events(A, 'comms.message_submitted@1')
  const rowsBefore = sql(`select (select count(*) from board_messages where estate_id='${A}') || '|' || (select count(*) from board_threads where estate_id='${A}')`)
  listOp(A, 0, 100); threadsOp(A)
  assert.equal(Number(sql(`select count(*) from board_read_marks where estate_id='${A}'`)), marksBefore, 'the operator’s read created a read mark')
  assert.equal(events(A, 'comms.read_acked@1') + events(A, 'comms.message_submitted@1'), eventsBefore, 'the operator’s read journaled an event')
  assert.equal(sql(`select (select count(*) from board_messages where estate_id='${A}') || '|' || (select count(*) from board_threads where estate_id='${A}')`), rowsBefore)
  refuses(`set role authenticated; select board_list_operator('${A}',null,0,10)`, /permission denied/)
})

// Migration 85 (suffix 100) — the thread aggregates the filter slice reads (SCN-143, amended 2026-10-11;
// COM-07): `kinds` (what a thread HOLDS, sorted and distinct) and `openRequests` (requests outside the
// contract's terminal set — completed/failed_known/cancelled/expired — with outcome_unknown open, because
// only reconciliation leaves it). The filters narrow the already-answered list and never re-query the
// board, so the aggregate has to come from here. To WATCH these fail, run the runner with
// FABRIC_SKIP_MIGRATION=20261011000100_project_board_thread_aggregates.sql.
await test('thread aggregates: kinds are what the thread holds, sorted and distinct; a queued request is open', () => {
  const t = threadsOp(A).threads.find((x) => x.id === threadA)
  assert.ok(t, 'threadA missing')
  assert.deepEqual(t.kinds, ['message', 'reply', 'request'], JSON.stringify(t.kinds))
  assert.ok(t.openRequests >= 1, JSON.stringify(t))
  const fresh = submit(A, PA1, { idempotency: { epoch: 1, key: key() }, thread: { new: { participants: [PA2], subject: 'Plain notes' } }, kind: 'finding', body: { text: 'f' } }, digest(90))
  assert.equal(fresh.ok, true, JSON.stringify(fresh))
  const f = threadsOp(A).threads.find((x) => x.id === fresh.thread)
  assert.deepEqual(f.kinds, ['finding'])
  assert.equal(f.openRequests, 0, 'no request in the thread → none open')
})

await test('openRequests follows the terminal set: completed and cancelled close; outcome_unknown stays open', () => {
  // No transition command exists yet (COM-07's later slices), so the state is set directly — the same
  // direct-row access this suite already uses to prove the operator's read writes nothing. The field's
  // semantics are what is under test, not the (absent) command.
  const r = submit(A, PA1, request(PA2, [PA2]), digest(91))
  assert.equal(r.ok, true)
  const op = () => threadsOp(A).threads.find((x) => x.id === r.thread).openRequests
  assert.equal(op(), 1, 'queued is open')
  for (const terminal of ['completed', 'failed_known', 'cancelled', 'expired']) {
    sql(`update board_requests set state='${terminal}' where message_id='${r.message}'`)
    assert.equal(op(), 0, `${terminal} is terminal`)
    sql(`update board_requests set state='queued' where message_id='${r.message}'`)
    assert.equal(op(), 1, 'back to open')
  }
  sql(`update board_requests set state='outcome_unknown' where message_id='${r.message}'`)
  assert.equal(op(), 1, 'outcome_unknown is open — only reconciliation leaves it')
})

await test('replace kept the door: service_role reads, authenticated is refused, a retry is still the same act', () => {
  const ok = threadsOp(A)
  assert.equal(ok.ok, true)
  refuses(`set role authenticated; select board_threads_operator('${A}')`, /permission denied/)
  refuses(`set role anon; select board_threads_operator('${A}')`, /permission denied/)
  const body = request(PA2, [PA2])
  const first = submit(A, PA1, body, digest(92))
  const again = submit(A, PA1, body, digest(92))
  assert.equal(again.message, first.message)
  assert.equal(again.repeated, true, 'idempotency survived the function replace')
})

// #endregion project-board-core

await import('./project-board-lifecycle-cases.mjs').then(m => m.run({ sql, refuses, test, url, psqlArgs, id, A, B, PA1, PA2, PA3, PB1, j, lit, agent, digest, append, submit, list, get, ack, status, events, key, request, message, threadsOp }))

console.log(`${count} passed, ${failed.length} failed`)
if (failed.length) process.exit(1)