// Fabric 0.3.9 "the core holds", the board part (docs/evidence/plans/2026-10-21-core-reliability/2026-10-21-board.md BD-1 to BD-4),
// on the fully migrated chain. Every row goes in through the board's own functions, as the projects would write it;
// only the legacy cases (a request stored before this release, with no deadline and a reply that did not answer it)
// set a projection row directly, because no door writes the old shape any more.
// To WATCH this suite fail, run the runner with FABRIC_SKIP_MIGRATION=20261021000120_board_core_holds.sql.
// #region board-core-holds — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#board
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { transitionFindings, transitionRecordOf } from '../src/main/commsTransition.ts'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-project-board-core-holds-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const psqlArgs = [url, '-X', '-q', '-t', '-A', '-F', '|', '-v', 'ON_ERROR_STOP=1']
const sql = input => execFileSync('psql', psqlArgs, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
let count = 0; const failed = []
const test = async (name, fn) => {
  try { await fn(); console.log('PASS ' + name); count++ } catch (e) { failed.push(name); console.log(`FAIL ${name}\n  ${String(e.message).split('\n')[0]}${e.stderr ? '\n  ' + String(e.stderr).trim().split('\n').slice(0, 3).join(' | ') : ''}`) }
}

const id = n => `95000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = id(1), OTHER = id(2)
const A = id(11), B = id(12), C = id(13), F = id(21)
const CAP = 'analytics.retention'
const lit = v => `'${String(v).replace(/'/g, "''")}'`
const j = v => `${lit(JSON.stringify(v))}::jsonb`
const q = v => (v === null ? 'null' : `'${v}'`)
const uuids = list => `array[${list.map(x => `'${x}'`).join(',')}]::uuid[]`
const system = { kind: 'system', id: 'board-probe' }
const operator = { kind: 'person', id: 'operator' }
const agent = { kind: 'agent', id: 'probe-session', label: 'Probe', provenance: 'trusted' }
let dN = 0
const digest = () => 'sha256:' + (++dN).toString(16).padStart(64, '0')
let keyN = 0
const idem = () => ({ epoch: 1, key: `key-${String(++keyN).padStart(6, '0')}` })
const later = minutes => new Date(Date.now() + minutes * 60_000).toISOString()
const append = (estate, type, payload, project = null, actor = system) =>
  sql(`set role service_role; select seq from append_event('${estate}','${type}',${j(actor)},${j(payload)},'1',${project ? `'${project}'` : 'null'})`)
const call = (fn, ...a) => JSON.parse(sql(`set role service_role; select ${fn}(${a.join(',')})`))
const submit = (sender, body, estate = E) => {
  const r = call('board_submit', q(estate), q(sender), j(agent), j(body), lit(digest()))
  assert.equal(r.ok, true, JSON.stringify(r))
  return r
}
const reply = (sender, replyTo, text = 'here is the answer', estate = E) =>
  call('board_reply', q(estate), q(sender), j(agent), j({ idempotency: idem(), replyTo, body: { text } }), lit(digest()))
const ask = (sender, target, participants, extra = {}) => submit(sender, { idempotency: idem(), thread: { new: { participants, subject: 'ask' } }, kind: 'request',
  body: { text: 'please compute it' }, request: { target, capability: CAP, ...(extra.deadline ? { deadline: extra.deadline } : {}) } })
const say = (sender, thread, text = 'noted', kind = 'message') => submit(sender, { idempotency: idem(), thread: { id: thread }, kind, body: { text } })
const open = (sender, participants, text = 'hello') => submit(sender, { idempotency: idem(), thread: { new: { participants } }, kind: 'message', body: { text } })
const get = (reader, message) => call('board_get', q(E), q(reader), q(message))
const status = reader => call('board_status', q(E), q(reader))
const ack = (reader, message) => call('board_read_ack', q(E), q(reader), j(agent), q(message))
const ackMany = (reader, { messages = null, thread = null, upTo = null } = {}, estate = E) =>
  call('board_read_ack_many', q(estate), q(reader), j(agent), messages === null ? 'null' : uuids(messages), q(thread), q(upTo))
const listReader = (reader, { thread = null, after = 0, limit = 50, unread = false, since = null } = {}) =>
  call('board_list_reader', q(E), q(reader), q(thread), String(after), String(limit), unread ? 'true' : 'false', since === null ? 'null' : `${lit(since)}::timestamptz`)
const events = type => Number(sql(`select count(*) from journal where estate_id='${E}' and type='${type}'`))
const state = m => sql(`select state||':'||revision from board_requests where estate_id='${E}' and message_id='${m}'`)
const tick = () => call('board_tick', q(E))
let grantN = 0
const grant = (binding, agentId, resources) => {
  const rq = id(500 + ++grantN), gs = resources.map((r, i) => ({ id: id(600 + grantN * 10 + i), capability: 'board.respond', resource: r, expires_at: later(525600) }))
  append(E, 'access.requested@1', { id: rq, agent_id: agentId, callee: 'fabric', capabilities: ['board.respond'], resources, reason: 'answer analytics requests',
    registry: { key: agentId, name: agentId, installed_by: 'a coding agent on this computer', repository: null }, binding_id: null, expires_at: later(10) },
    null, { kind: 'system', id: 'fabric-hub' })
  append(E, 'access.decided@1', { request_id: rq, decision: 'allowed', binding_id: binding, new_binding: true, grants: gs }, null, operator)
  return gs.map(g => g.id)
}

append(E, 'estate.created@1', { name: 'core holds estate', owner_person_id: id(91) })
append(OTHER, 'estate.created@1', { name: 'other estate', owner_person_id: id(92) })
for (const [estate, project, name] of [[E, A, 'asker'], [E, B, 'target'], [E, C, 'bystander'], [OTHER, F, 'elsewhere']])
  append(estate, 'project.created@1', { id: project, name }, project)

// ── BD-1: a reply from the asked project answers the request ─────────────────────────────────────────────────
await test('BD-1: the target\'s reply answers a queued request, as a journalled transition the asker reads', () => {
  const r = ask(A, B, [B, C])
  assert.equal(state(r.message), 'queued:1')
  const bystander = reply(C, r.message, 'not mine to answer')
  assert.equal(bystander.ok, true, JSON.stringify(bystander))
  assert.equal(state(r.message), 'queued:1', 'a participant that is not the target does not answer it')
  const transitions = events('comms.request_transitioned@1')
  const answer = reply(B, r.message, 'the numbers are attached')
  assert.equal(answer.ok, true, JSON.stringify(answer))
  assert.equal(state(r.message), 'answered:2')
  assert.equal(events('comms.request_transitioned@1'), transitions + 1)
  const ev = JSON.parse(sql(`select payload from journal where estate_id='${E}' and type='comms.request_transitioned@1' and payload->>'request_id'='${r.message}'`))
  assert.equal(ev.op, 'answer'); assert.equal(ev.from, 'queued'); assert.equal(ev.to, 'answered'); assert.equal(ev.cause, 'target-reply')
  assert.equal(get(A, r.message).message.request.state, 'answered', 'the asker reads it answered')
  // A second reply changes nothing more: the request is no longer queued.
  assert.equal(reply(B, r.message, 'and one more thing').ok, true)
  assert.equal(state(r.message), 'answered:2')
  // The asker may still close it.
  const closed = call('board_cancel', q(E), q(A), j(agent), j({ idempotency: idem(), request: r.message }), lit(digest()))
  assert.equal(closed.ok, true, JSON.stringify(closed)); assert.equal(state(r.message), 'cancelled:3')
})

await test('BD-1: com.submit of kind reply (or a message naming the request) from the target answers it too; a request naming one does not', () => {
  const r = ask(A, B, [B])
  const asRequest = submit(B, { idempotency: idem(), thread: { id: r.thread }, kind: 'request', body: { text: 'counter-ask' }, replyTo: r.message, request: { target: A, capability: 'analytics.inputs' } })
  assert.equal(asRequest.ok, true)
  assert.equal(state(r.message), 'queued:1', 'a counter-request is not an answer')
  submit(B, { idempotency: idem(), thread: { id: r.thread }, kind: 'reply', body: { text: 'answered by submit' }, replyTo: r.message })
  assert.equal(state(r.message), 'answered:2')
})

await test('BD-1: a request without a deadline gets one seven days out; one with a deadline keeps it', () => {
  const r = ask(A, B, [B])
  const d = sql(`select extract(epoch from deadline - clock_timestamp())::integer from board_requests where estate_id='${E}' and message_id='${r.message}'`)
  assert.ok(Math.abs(Number(d) - 7 * 86400) < 120, `deadline in ${d} s`)
  assert.match(get(B, r.message).message.request.deadline, /Z$/)
  const payload = JSON.parse(sql(`select payload from journal where estate_id='${E}' and payload->>'message_id'='${r.message}' and type='comms.message_submitted@1'`))
  assert.ok(payload.request.deadline, 'the default deadline is in the event, so a rebuild keeps it')
  const kept = ask(A, B, [B], { deadline: '2099-01-01T00:00:00Z' })
  assert.equal(sql(`select to_char(deadline at time zone 'UTC', 'YYYY-MM-DD') from board_requests where estate_id='${E}' and message_id='${kept.message}'`), '2099-01-01')
})

await test('BD-1: the tick settles legacy requests: answers one the target already replied to, expires one with no deadline past the default age', () => {
  const answered = ask(A, B, [B])
  reply(B, answered.message, 'answered before this release')
  // Before this release a reply did not answer: put the projection back to what such a database holds.
  sql(`update board_requests set state='queued', revision=1 where estate_id='${E}' and message_id='${answered.message}'`)
  const stale = ask(A, B, [B])
  sql(`update board_requests set deadline=null where estate_id='${E}' and message_id='${stale.message}'`)
  execFileSync('sleep', ['3'])
  const fresh = ask(A, B, [B])
  sql(`update board_requests set deadline=null where estate_id='${E}' and message_id='${fresh.message}'`)
  // The default age, shortened for the probe to 1.5 s: the stale request is 3 s old, the fresh one a fraction of that.
  sql(`create or replace function board_request_default_ttl() returns interval language sql immutable set search_path = public as $$ select interval '1.5 seconds' $$`)
  try {
    const t = tick()
    assert.equal(t.ok, true, JSON.stringify(t))
    assert.ok(t.answered >= 1, JSON.stringify(t)); assert.ok(t.expired >= 1, JSON.stringify(t))
    assert.equal(state(answered.message).split(':')[0], 'answered')
    assert.equal(state(stale.message).split(':')[0], 'expired')
    assert.equal(state(fresh.message).split(':')[0], 'queued', 'a legacy request younger than the default age stays')
    const again = tick()
    assert.equal(again.answered, 0); assert.equal(again.expired, 0)
  } finally {
    sql(`create or replace function board_request_default_ttl() returns interval language sql immutable set search_path = public as $$ select interval '168 hours' $$`)
  }
})

await test('BD-1: whether anyone can answer a (project, capability): no grant, no holder: no; a live board.respond grant: yes', () => {
  const none = call('board_responder_possible', q(E), q(B), lit('invented.capability'))
  assert.deepEqual(none, { ok: true, possible: false })
  grant(id(401), 'claude-code', [`board:${B}/${CAP}`])
  assert.deepEqual(call('board_responder_possible', q(E), q(B), lit(CAP)), { ok: true, possible: true })
  assert.deepEqual(call('board_responder_possible', q(E), q(C), lit(CAP)), { ok: true, possible: false }, 'the grant is for B, not C')
  assert.equal(call('board_responder_possible', 'null', q(B), lit(CAP)).error?.code, 'invalid_arguments')
})

await test('BD-1: an answered request is not open: it leaves the thread\'s open count and the target\'s responder list', () => {
  const r = ask(A, C, [C])
  const opened = call('board_thread_page_operator', q(E), j({ project: C, openOnly: true }), 'null', '100')
  assert.ok(opened.threads.some(t => t.id === r.thread))
  assert.ok(call('board_status', q(E), q(C)).responders.some(x => x.capability === CAP))
  reply(C, r.message)
  const after = call('board_thread_page_operator', q(E), j({ project: C, openOnly: true }), 'null', '100')
  assert.equal(after.threads.some(t => t.id === r.thread), false, 'an answered request still counts as open')
  assert.equal(call('board_status', q(E), q(C)).responders.some(x => x.capability === CAP), false)
})

// ── BD-3: what is new to a reader ─────────────────────────────────────────────────────────────────────────────
await test('BD-3: unread only: messages delivered to the reader without its read mark, oldest first, each saying it is unread', () => {
  const t = open(A, [C], 'first for C')
  const second = say(A, t.thread, 'second for C')
  const own = say(C, t.thread, 'C writes too')
  const page = listReader(C, { thread: t.thread, unread: true })
  assert.equal(page.ok, true, JSON.stringify(page))
  assert.deepEqual(page.messages.map(m => m.id), [t.message, second.message], 'own messages are never unread')
  assert.ok(page.messages.every(m => m.read === false))
  ack(C, t.message)
  assert.deepEqual(listReader(C, { thread: t.thread, unread: true }).messages.map(m => m.id), [second.message])
  const all = listReader(C, { thread: t.thread })
  assert.deepEqual(all.messages.map(m => [m.id, m.read]), [[t.message, true], [second.message, false], [own.message, true]])
  // The unread count com.status reports and the unread page agree.
  const everything = listReader(C, { unread: true, limit: 100 })
  assert.equal(everything.messages.length, status(C).unread)
})

await test('BD-3: unread pages by seq like board_list; since filters by time; the default board_list is unchanged (no read field)', () => {
  const t = open(A, [B], 'page 1')
  for (let i = 2; i <= 5; i++) say(A, t.thread, `page ${i}`)
  const first = listReader(B, { thread: t.thread, unread: true, limit: 2 })
  assert.equal(first.messages.length, 2); assert.equal(first.more, true)
  const second = listReader(B, { thread: t.thread, unread: true, limit: 2, after: first.last_seq })
  assert.deepEqual(second.messages.map(m => m.body.text), ['page 3', 'page 4'])
  const cut = sql(`select to_char(at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from board_messages where id='${second.messages[1].id}'`)
  assert.deepEqual(listReader(B, { thread: t.thread, since: cut }).messages.map(m => m.body.text), ['page 4', 'page 5'])
  const plain = call('board_list', q(E), q(B), q(t.thread), '0', '50')
  assert.equal(plain.messages.some(m => 'read' in m), false, 'the contract page carries no read field')
  assert.equal(listReader(F, { thread: t.thread }).error?.code, 'not_authorized')
  assert.equal(call('board_list_reader', q(OTHER), q(B), 'null', '0', '50', 'true', 'null').error?.code, 'not_authorized', 'the estate is the boundary')
})

await test('BD-3: the cursor key is per estate, stable across calls (so a cursor survives a restart) and readable by nobody but its door', () => {
  const k1 = call('board_cursor_key', q(E)), k2 = call('board_cursor_key', q(E)), other = call('board_cursor_key', q(OTHER))
  assert.equal(k1.ok, true); assert.match(k1.key, /^[0-9a-f]{64}$/)
  assert.equal(k2.key, k1.key); assert.notEqual(other.key, k1.key)
  for (const role of ['anon', 'authenticated', 'service_role'])
    assert.equal(sql(`select has_table_privilege('${role}', 'board_cursor_keys', 'select')`), 'f', role)
  assert.equal(call('board_cursor_key', 'null').error?.code, 'invalid_arguments')
})

// ── BD-4: many read marks in one call ─────────────────────────────────────────────────────────────────────────
await test('BD-4: a list of messages is marked in one call and one journal event; repeating it changes nothing', () => {
  const t = open(A, [B, C], 'bulk 1')
  const m2 = say(A, t.thread, 'bulk 2'), m3 = say(C, t.thread, 'bulk 3')
  const before = events('comms.read_acked_many@1'), singles = events('comms.read_acked@1')
  const unreadBefore = status(B).unread
  const r = ackMany(B, { messages: [t.message, m2.message, m3.message] })
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.repeated, false); assert.equal(r.marked, 3); assert.equal(r.alreadyRead, 0)
  assert.match(r.at, /Z$/)
  assert.equal(events('comms.read_acked_many@1'), before + 1); assert.equal(events('comms.read_acked@1'), singles)
  assert.equal(status(B).unread, unreadBefore - 3)
  assert.equal(ack(B, m2.message).repeated, true, 'a single mark sees the bulk one')
  const again = ackMany(B, { messages: [t.message, m2.message] })
  assert.equal(again.repeated, true); assert.equal(again.marked, 0); assert.equal(again.alreadyRead, 2)
  assert.equal(events('comms.read_acked_many@1'), before + 1, 'a repeat appended')
})

await test('BD-4: a foreign or absent message refuses the whole call and marks nothing; more than 100 is refused', () => {
  const t = open(A, [B], 'mixed')
  const foreign = open(A, [C], 'not for B')
  const before = events('comms.read_acked_many@1')
  const r = ackMany(B, { messages: [t.message, foreign.message] })
  assert.equal(r.error?.code, 'not_authorized', JSON.stringify(r))
  assert.equal(ackMany(B, { messages: [t.message, id(9999)] }).error?.code, 'not_authorized')
  assert.equal(events('comms.read_acked_many@1'), before)
  assert.equal(listReader(B, { thread: t.thread, unread: true }).messages.length, 1)
  assert.equal(ackMany(B, { messages: Array.from({ length: 101 }, (_, i) => id(7000 + i)) }).error?.code, 'invalid_arguments')
  assert.equal(ackMany(B, {}).error?.code, 'invalid_arguments', 'name messages, or a thread and a message')
})

await test('BD-4: a thread up to a message marks every message delivered to the reader in it, at or before that one', () => {
  const t = open(A, [B], 'u1')
  const u2 = say(A, t.thread, 'u2'), mine = say(B, t.thread, 'B speaks'), u4 = say(A, t.thread, 'u4'), u5 = say(A, t.thread, 'u5')
  void mine
  const r = ackMany(B, { thread: t.thread, upTo: u4.message })
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.marked, 3, 'u1, u2 and u4: never B\'s own')
  assert.deepEqual(listReader(B, { thread: t.thread, unread: true }).messages.map(m => m.id), [u5.message])
  void u2
  assert.equal(ackMany(B, { thread: t.thread, upTo: id(9998) }).error?.code, 'not_authorized')
  const other = open(A, [B], 'elsewhere')
  assert.equal(ackMany(B, { thread: t.thread, upTo: other.message }).error?.code, 'not_authorized', 'upTo must be a message of that thread')
})

await test('BD-4: the bulk marks are a projection: a rebuild replays them unchanged', () => {
  const snap = () => sql(`select string_agg(reader_project||':'||message_id||':'||seq, ',' order by reader_project, message_id) from board_read_marks where estate_id='${E}'`)
  const before = snap()
  sql(`select rebuild_estate_projections('${E}')`)
  assert.equal(snap(), before)
})

// ── BD-2: what waits reaches the operator ─────────────────────────────────────────────────────────────────────
await test('BD-2: requests waiting with nobody to answer them: counted whether or not the target marked them read; answered ones are not', () => {
  const W = id(14), X = id(15)
  append(E, 'project.created@1', { id: W, name: 'waiting target' }, W)
  append(E, 'project.created@1', { id: X, name: 'quiet asker' }, X)
  const before = call('board_waiting_operator', q(E))
  assert.equal(before.ok, true, JSON.stringify(before))
  const read = submit(X, { idempotency: idem(), thread: { new: { participants: [W] } }, kind: 'request', body: { text: 'one' }, request: { target: W, capability: 'reports.weekly' } })
  const unreadOne = submit(X, { idempotency: idem(), thread: { new: { participants: [W] } }, kind: 'request', body: { text: 'two' }, request: { target: W, capability: 'reports.weekly' } })
  const answered = submit(X, { idempotency: idem(), thread: { new: { participants: [W] } }, kind: 'request', body: { text: 'three' }, request: { target: W, capability: 'reports.weekly' } })
  ack(W, read.message)
  reply(W, answered.message)
  const w = call('board_waiting_operator', q(E))
  assert.equal(w.requests - before.requests, 2, JSON.stringify(w))
  assert.match(w.oldestRequestAt, /Z$/)
  assert.ok(Number.isInteger(w.unread) && w.unread > 0); assert.match(w.oldestUnreadAt, /Z$/)
  const pending = call('board_pending_operator', q(E), '100')
  const pw = pending.projects.find(p => p.project === W)
  assert.equal(pw.requestsWithAbsentResponder, 2, 'the request W read but did not answer still waits')
  void unreadOne
  assert.equal(call('board_waiting_operator', 'null').error?.code, 'invalid_arguments')
})

await test('every transition this suite journalled is lawful by the lifecycle table, the answer and the answered cancel included', () => {
  const rows = JSON.parse(sql(`select coalesce(jsonb_agg(payload order by seq), '[]') from journal where estate_id='${E}' and type='comms.request_transitioned@1'`))
  assert.ok(rows.some(p => p.op === 'answer') && rows.some(p => p.op === 'cancel' && p.from === 'answered'))
  for (const p of rows) assert.deepEqual(transitionFindings(transitionRecordOf(p)), [], `${p.op} ${p.from} to ${p.to}`)
})

// ── the doors (R-003) ─────────────────────────────────────────────────────────────────────────────────────────
await test('every new door is the service role\'s alone and a security definer; helpers are nobody\'s', () => {
  const doors = ['board_list_reader(uuid,uuid,uuid,bigint,integer,boolean,timestamptz)', 'board_cursor_key(uuid)',
    'board_read_ack_many(uuid,uuid,jsonb,uuid[],uuid,uuid)', 'board_responder_possible(uuid,uuid,text)', 'board_waiting_operator(uuid)']
  for (const f of doors) {
    assert.equal(sql(`select has_function_privilege('service_role', '${f}', 'execute')`), 't', `${f}: the service role`)
    for (const role of ['anon', 'authenticated']) assert.equal(sql(`select has_function_privilege('${role}', '${f}', 'execute')`), 'f', `${f}: ${role}`)
    assert.equal(sql(`select prosecdef from pg_proc where oid = '${f}'::regprocedure`), 't', `${f} is a security-definer door`)
  }
  for (const f of ['board_request_open(text)', 'board_request_default_ttl()', 'apply_comms_reads_many(journal)'])
    for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(sql(`select has_function_privilege('${role}', '${f}', 'execute')`), 'f', `${f}: ${role}`)
  assert.equal(sql(`select count(*) from event_types where type = 'comms.read_acked_many@1'`), '1')
})

console.log(`${count} passed, ${failed.length} failed`)
if (failed.length) { console.log('FAILED: ' + failed.join('; ')); process.exit(1) }
// #endregion board-core-holds
