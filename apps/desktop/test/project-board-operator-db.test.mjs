// Migration 89 (suffix 108) — the operator's reads of the project board, wave 4 (COM-07, COM-05; ADR-0156 §8,
// SCN-143's wave-4 amendment, SCN-147, SCN-156, SCN-157), on the fully migrated chain. Every row goes in through the
// board's own functions, as a project and its responders would write it; only the redaction and the restore-without-
// history cases write a row directly, because no door makes them yet.
// To WATCH this suite fail, run the runner with FABRIC_SKIP_MIGRATION=20261013000108_project_board_operator_reads.sql.
// #region project-board-operator-reads — docs: docs/adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md#8-what-comms-shows-besides
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { transitionFindings, transitionRecordOf } from '../src/main/commsTransition.ts'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-project-board-operator-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const psqlArgs = [url, '-X', '-q', '-t', '-A', '-F', '|', '-v', 'ON_ERROR_STOP=1']
const sql = input => execFileSync('psql', psqlArgs, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
let count = 0; const failed = []
const test = async (name, fn) => {
  try { await fn(); console.log('PASS ' + name); count++ } catch (e) { failed.push(name); console.log(`FAIL ${name}\n  ${String(e.message).split('\n')[0]}${e.stderr ? '\n  ' + String(e.stderr).trim().split('\n').slice(0, 3).join(' | ') : ''}`) }
}

const id = n => `89000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = id(1), OTHER = id(2), PE = id(3)
const A = id(11), B = id(12), C = id(13), F = id(21), PA = id(31), PB = id(32), PC = id(33)
const CAP = 'analytics.retention', CAP2 = 'analytics.cohorts'
const lit = v => `'${String(v).replace(/'/g, "''")}'`
const j = v => `${lit(JSON.stringify(v))}::jsonb`
const q = v => (v === null ? 'null' : `'${v}'`)
const system = { kind: 'system', id: 'board-probe' }
const operator = { kind: 'person', id: 'operator' }
let dN = 0
const digest = () => 'sha256:' + (++dN).toString(16).padStart(64, '0')
let keyN = 0
const idem = () => ({ epoch: 1, key: `key-${String(++keyN).padStart(6, '0')}` })
const later = minutes => new Date(Date.now() + minutes * 60_000).toISOString()
const append = (estate, type, payload, project = null, actor = system) =>
  sql(`set role service_role; select seq from append_event('${estate}','${type}',${j(actor)},${j(payload)},'1',${project ? `'${project}'` : 'null'})`)
const call = (fn, ...a) => JSON.parse(sql(`set role service_role; select ${fn}(${a.join(',')})`))
const agent = { kind: 'agent', id: 'requester-session', label: 'Requester', provenance: 'trusted' }

const submitArgs = (estate, sender, body) => `set role service_role; select board_submit('${estate}','${sender}',${j(agent)},${j(body)},${lit(digest())});`
const submit = (estate, sender, body) => {
  const r = JSON.parse(sql(submitArgs(estate, sender, body)))
  assert.equal(r.ok, true, JSON.stringify(r))
  return r
}
const newThread = (estate, sender, participants, text, extra = {}) =>
  submit(estate, sender, { idempotency: idem(), thread: { new: { participants, subject: extra.subject ?? text.slice(0, 40) } }, kind: extra.kind ?? 'message', body: { text }, ...(extra.request ? { request: extra.request } : {}), ...(extra.artifacts ? { artifacts: extra.artifacts } : {}) })
const into = (estate, sender, thread, text, extra = {}) =>
  submit(estate, sender, { idempotency: idem(), thread: { id: thread }, kind: extra.kind ?? 'message', body: { text }, ...(extra.request ? { request: extra.request } : {}), ...(extra.artifacts ? { artifacts: extra.artifacts } : {}) })
const ack = (estate, reader, message) => call('board_read_ack', q(estate), q(reader), j(agent), q(message))

// Sessions (the responders suite's shapes): A launched Claude Code session, an enrolled Codex session.
const SA = id(301), SB = id(302), SA2 = id(303)
const HA = { session_id: SA, came_in: 'launched', agent: 'claude-code', binding_id: null, label: 'Claude Code' }
const HB = { session_id: SB, came_in: 'enrolled', agent: 'codex', binding_id: id(402), label: 'Codex' }
const HA2 = { ...HA, session_id: SA2 }
const cmd = (fn, holder, args, project = B, estate = E) => call(fn, q(estate), j(holder), q(project), j(args), lit(digest()))
const fence = (claim, extra = {}) => ({ request: claim.request.id, generation: claim.attempt.generation, attempt: claim.attempt.id, digest: claim.attempt.digest, idempotency: idem(), ...extra })
const lapse = (cap = CAP) => sql(`update board_responder_slots set lease_until = clock_timestamp() - interval '1 second' where estate_id='${E}' and project_id='${B}' and capability='${cap}'`)
let grantN = 0
const grant = (estate, binding, agentId, resources) => {
  const rq = id(500 + ++grantN), gs = resources.map((r, i) => ({ id: id(600 + grantN * 10 + i), capability: 'board.respond', resource: r, expires_at: later(525600) }))
  append(estate, 'access.requested@1', { id: rq, agent_id: agentId, callee: 'fabric', capabilities: ['board.respond'], resources, reason: 'answer analytics requests',
    registry: { key: agentId, name: agentId, installed_by: 'a coding agent on this computer', repository: null }, binding_id: null, expires_at: later(10) },
    null, { kind: 'system', id: 'fabric-hub' })
  append(estate, 'access.decided@1', { request_id: rq, decision: 'allowed', binding_id: binding, new_binding: true, grants: gs }, null, operator)
  return gs.map(g => g.id)
}
const responders = estate => {
  const r = call('board_responders_operator', q(estate))
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.responders
}
const slotOf = (cap, project = B) => responders(E).find(s => s.project === project && s.capability === cap)
const page = (estate, filter = {}, before = null, limit = 50) => {
  const r = call('board_thread_page_operator', q(estate), j(filter), before === null ? 'null' : j(before), String(limit))
  assert.equal(r.ok, true, JSON.stringify(r))
  return r
}
// The current holder renews its own slot before each sequence (no event; the lease is 60 s and a loaded machine is slow).
const hold = () => assert.equal(cmd('board_enroll', HA2, { idempotency: idem(), capability: CAP }).ok, true)
const sortedDesc = threads => threads.every((t, i) => i === 0 || threads[i - 1].lastSeq > t.lastSeq || (threads[i - 1].lastSeq === t.lastSeq && threads[i - 1].id > t.id))

append(E, 'estate.created@1', { name: 'operator reads estate', owner_person_id: id(91) })
append(OTHER, 'estate.created@1', { name: 'other estate', owner_person_id: id(92) })
append(PE, 'estate.created@1', { name: 'pending estate', owner_person_id: id(93) })
for (const [estate, project, name] of [[E, A, 'growth'], [E, B, 'analytics'], [E, C, 'finance'], [OTHER, F, 'elsewhere'],
  [PE, PA, 'requester'], [PE, PB, 'responder'], [PE, PC, 'bystander']])
  append(estate, 'project.created@1', { id: project, name }, project)
const [GA] = grant(E, id(401), 'claude-code', [`board:${B}/${CAP}`])
const [GB] = grant(E, HB.binding_id, 'codex', [`board:${B}/${CAP2}`])
void GA

// ── who answers (COM07-02) ───────────────────────────────────────────────────────────────────────────────────
await test('responders: active names the agent and since when; a lapsed lease is stale, never absent; absent names the last cause and time (SCN-147 step 1)', () => {
  assert.equal(cmd('board_enroll', HA, { idempotency: idem(), capability: CAP }).ok, true)
  const active = slotOf(CAP)
  assert.equal(active.state, 'active'); assert.equal(active.agent, 'claude-code'); assert.equal(active.generation, 1)
  assert.match(active.since, /Z$/); assert.match(active.leaseExpiresAt, /Z$/)
  assert.equal(active.releasedCause, undefined, 'a held slot has no release to explain')
  lapse()
  const stale = slotOf(CAP)
  assert.equal(stale.state, 'stale', 'a lapsed lease is not absent: it says nothing about success or failure')
  assert.match(stale.leaseExpiresAt, /Z$/, 'stale says when the lease lapsed')
  assert.equal(stale.releasedCause, undefined)
  assert.equal(call('board_release_session', q(E), lit(SA)).released, 1)
  const ended = slotOf(CAP)
  assert.equal(ended.state, 'absent'); assert.equal(ended.releasedCause, 'session-ended'); assert.match(ended.releasedAt, /Z$/)
  assert.equal(ended.agent, undefined, 'an absent slot names no holder')
  // A later release is the one the slot explains: CAP2's holder is revoked.
  assert.equal(cmd('board_enroll', HB, { idempotency: idem(), capability: CAP2 }).ok, true)
  append(E, 'access.grant.revoked@1', { grant_id: GB }, null, operator)
  assert.equal(call('board_release_grant', q(E), q(GB)).released, 1)
  assert.equal(slotOf(CAP2).releasedCause, 'revoked')
  // A fresh holder on CAP: active again, the release no longer said.
  assert.equal(cmd('board_enroll', HA2, { idempotency: idem(), capability: CAP }).ok, true)
  const again = slotOf(CAP)
  assert.equal(again.state, 'active'); assert.equal(again.generation, 2); assert.equal(again.releasedCause, undefined)
  // The estate is the boundary, and a null estate is refused.
  assert.deepEqual(responders(OTHER), [])
  assert.equal(call('board_responders_operator', 'null').error?.code, 'invalid_arguments')
})

// ── the thread list: a bounded page, newest first (COM07-03) ─────────────────────────────────────────────────
const threads = []
await test('thread page: newest activity first by (lastSeq, id); no thread twice and none lost across three pages while messages arrive between them', () => {
  // Nine threads in ONE transaction: their last messages share a time, so only (lastSeq, id) orders them.
  const created = sql(`begin;\n${Array.from({ length: 9 }, (_, i) => submitArgs(E, A, { idempotency: idem(), thread: { new: { participants: [B], subject: `page ${i}` } }, kind: 'message', body: { text: `page thread ${i}` } }).replace('set role service_role; ', '')).join('\n')}\ncommit;`)
  for (const line of created.split('\n').filter(Boolean)) threads.push(JSON.parse(line).thread)
  assert.equal(threads.length, 9)
  const foreign = submit(OTHER, F, { idempotency: idem(), thread: { new: { participants: [F], subject: 'elsewhere' } }, kind: 'message', body: { text: 'not this estate' } })
  const scope = new Set(threads)
  const p1 = page(E, {}, null, 3)
  assert.equal(p1.threads.length, 3); assert.equal(p1.more, true); assert.ok(p1.before, 'a page with more names where to continue')
  assert.ok(sortedDesc(p1.threads), 'page 1 is not ordered by (lastSeq, id) descending')
  into(E, A, threads[0], 'the oldest thread moves to the top')        // a thread not yet read
  into(E, A, p1.threads[0].id, 'a thread already read moves again')   // a thread already read
  const p2 = page(E, {}, p1.before, 3)
  assert.ok(sortedDesc(p2.threads), 'page 2 is not ordered')
  into(E, A, threads[1], 'another thread not yet read moves to the top')
  assert.equal(p2.more, true, 'page 2 leaves older threads')
  const p3 = page(E, {}, p2.before, 3)
  assert.ok(sortedDesc(p3.threads), 'page 3 is not ordered')
  assert.equal(p3.more, false); assert.equal(p3.before, null, 'the last page names no next one')
  const read = [...p1.threads, ...p2.threads, ...p3.threads].map(t => t.id).filter(t => scope.has(t))
  assert.equal(new Set(read).size, read.length, `a thread appeared twice across the pages: ${read}`)
  // Every thread is either on a page or, having moved above the cursor, on page 1 read again — none falls between.
  const fresh = page(E, {}, null, 50).threads.map(t => t.id)
  for (const t of threads) assert.ok(read.includes(t) || fresh.slice(0, 3).includes(t), `thread ${t} fell between the pages`)
  assert.ok(!fresh.includes(foreign.thread), 'another estate\'s thread was listed')
  assert.ok(sortedDesc(page(E).threads), 'the full page is not ordered')
  const last = page(E, {}, null, 100)
  assert.equal(last.more, false); assert.equal(last.before, null)
  const row = last.threads.find(t => t.id === threads[2])
  for (const k of ['subject', 'participants', 'createdBy', 'createdSeq', 'messageCount', 'lastSeq', 'lastAt', 'kinds', 'openRequests', 'providers']) assert.ok(k in row, k)
})

let requestThread, completed, completedClaim, cancelled, unknownReq, financeThread
await test('thread page filters are the board\'s: project, kind held, open request, active since and the coding agent — another estate never answers', () => {
  const finance = newThread(E, A, [C], 'a finding for finance', { kind: 'finding', subject: 'finance finding' })
  financeThread = finance.thread
  // A request B's claude-code responder answers: claimed → accepted → completed with evidence.
  const req = newThread(E, A, [B], 'Please compute 7-day retention.', { kind: 'request', request: { target: B, capability: CAP }, subject: 'retention' })
  requestThread = req.thread
  hold()
  const claim = cmd('board_claim', HA2, { idempotency: idem(), capability: CAP })
  assert.equal(claim.request.id, req.message, JSON.stringify(claim))
  assert.equal(cmd('board_accept', HA2, { fence: fence(claim) }).request.state, 'accepted')
  completed = { message: req.message, thread: req.thread }; completedClaim = claim
  const all = page(E).threads.map(t => t.id)
  assert.deepEqual(page(E, { project: C }).threads.map(t => t.id), [finance.thread])
  assert.deepEqual(page(E, { kind: 'finding' }).threads.map(t => t.id), [finance.thread])
  assert.deepEqual(page(E, { openOnly: true }).threads.map(t => t.id), [req.thread], 'an accepted request is open')
  assert.deepEqual(page(E, { provider: 'claude-code' }).threads.map(t => t.id), [req.thread])
  assert.deepEqual(page(E, { provider: 'codex' }).threads, [], 'an agent that took no part')
  assert.deepEqual(page(E, { project: F }).threads, [], 'a project of another estate')
  assert.deepEqual(page(E, { kind: 'request', project: B, openOnly: true, provider: 'claude-code' }).threads.map(t => t.id), [req.thread], 'filters combine as AND')
  // Active since: a window holds what was written inside it, inclusive at its edge; a future edge holds nothing.
  const edge = sql(`select board_at(max(at)) from board_messages where estate_id='${E}' and thread_id='${req.thread}'`)
  assert.ok(page(E, { activeSince: edge }).threads.some(t => t.id === req.thread), 'the edge is inside the window')
  assert.ok(page(E, { activeSince: edge }).threads.length < all.length, 'older threads are outside the window')
  assert.deepEqual(page(E, { activeSince: later(60).replace(/\.\d+Z$/, '.000Z') }).threads, [])
  // A filter the board cannot read is refused, never answered as an empty list.
  for (const bad of [{ other: 1 }, { project: 'not-a-uuid' }, { kind: 'memo' }, { openOnly: 'yes' }, { activeSince: 'yesterday' }, { provider: '' }])
    assert.equal(call('board_thread_page_operator', q(E), j(bad), 'null', '50').error?.code, 'invalid_arguments', JSON.stringify(bad))
  assert.equal(call('board_thread_page_operator', q(E), j({}), j({ lastSeq: -1, id: E }), '50').error?.code, 'invalid_arguments')
  assert.equal(call('board_thread_page_operator', 'null', j({}), 'null', '50').error?.code, 'invalid_arguments')
  assert.equal(page(E, {}, null, 1000).threads.length <= 100, true, 'the page is capped at 100')
})

await test('heads: each thread\'s id and last seq, newest first; the cap says it cut the list (the rail\'s count, "5000+")', () => {
  const all = call('board_thread_heads_operator', q(E), '5000')
  assert.equal(all.ok, true); assert.equal(all.truncated, false)
  assert.deepEqual(all.heads.map(h => h.id), page(E, {}, null, 100).threads.map(t => t.id), 'heads and the page disagree on order')
  const two = call('board_thread_heads_operator', q(E), '2')
  assert.equal(two.heads.length, 2); assert.equal(two.truncated, true)
  assert.deepEqual(Object.keys(two.heads[0]).sort(), ['id', 'lastSeq'])
  assert.equal(call('board_thread_heads_operator', q(OTHER), '5000').heads.length, 1, 'another estate\'s heads are its own')
  assert.equal(call('board_thread_heads_operator', q(E), '999999').truncated, false, 'the cap is at most 10,000 and still answers')
  assert.equal(call('board_thread_heads_operator', 'null', '5000').error?.code, 'invalid_arguments')
})

// ── facts, the timeline and related threads (COM07-07…-11) ───────────────────────────────────────────────────
await test('facts: an outcome is told from a cancel reason by the journal\'s op; read marks never name the sender; another estate is absent', () => {
  // Complete the accepted request with a summary and evidence.
  const evidence = [{ id: 'https://example.org/retention.csv', contentHash: 'sha256:' + 'a'.repeat(64), label: 'retention.csv' }]
  hold()
  const done = cmd('board_complete', HA2, { fence: fence(completedClaim),
    outcome: { state: 'completed', observed: true, summary: '7-day retention is 41%.', evidence } })
  assert.equal(done.request.state, 'completed', JSON.stringify(done))
  // A request the requester cancels with a reason.
  const second = into(E, A, completed.thread, 'And the cohorts?', { kind: 'request', request: { target: B, capability: CAP } })
  const c = call('board_cancel', q(E), q(A), j(agent), j({ idempotency: idem(), request: second.message, reason: 'Not needed any more.' }), lit(digest()))
  assert.equal(c.request.state, 'cancelled', JSON.stringify(c))
  cancelled = second.message
  // Read marks: B reads A's request; A acknowledging its own message is never "read by" it.
  assert.equal(ack(E, B, completed.message).ok, true)
  ack(E, A, completed.message)
  // A foreign outcome row under the same request id (only a superuser can plant one): the facts never read it.
  sql(`insert into board_outcomes (estate_id, request_id, summary, seq) values ('${OTHER}', '${completed.message}', 'a foreign outcome', 1)`)
  const foreign = submit(OTHER, F, { idempotency: idem(), thread: { new: { participants: [F] } }, kind: 'request', body: { text: 'x' }, request: { target: F, capability: CAP } })
  const facts = call('board_message_facts_operator', q(E), `array['${completed.message}','${cancelled}','${foreign.message}']::uuid[]`)
  assert.equal(facts.ok, true, JSON.stringify(facts))
  assert.deepEqual(facts.messages[completed.message].readBy, [B], 'read by B, never by its sender A')
  assert.deepEqual(facts.messages[cancelled].readBy, [])
  const out = facts.requests[completed.message]
  assert.deepEqual(out.outcomes.map(o => [o.kind, o.summary, o.settledBy]), [['outcome', '7-day retention is 41%.', 'responder']])
  assert.deepEqual(out.outcomes[0].evidence, evidence)
  assert.equal(out.lastOp, 'complete'); assert.equal(out.attemptLive, false); assert.equal(out.generation, 2); assert.match(out.lastAt, /Z$/)
  assert.deepEqual(facts.requests[cancelled].outcomes.map(o => [o.kind, o.summary]), [['cancel_reason', 'Not needed any more.']])
  assert.equal(facts.requests[cancelled].lastCause, 'requester')
  assert.equal(facts.messages[foreign.message], undefined, 'another estate\'s message')
  assert.equal(facts.requests[foreign.message], undefined, 'another estate\'s request')
  const many = `array[${Array.from({ length: 101 }, (_, i) => `'${id(9000 + i)}'`).join(',')}]::uuid[]`
  assert.equal(call('board_message_facts_operator', q(E), many).error?.code, 'invalid_arguments', 'more than 100 ids')
  assert.equal(call('board_message_facts_operator', 'null', `array[]::uuid[]`).error?.code, 'invalid_arguments')
})

await test('settledBy (DEC-0081, FAC-SEM-109): complete and reconcile transitions name the responder; every transition in the journal is a record the contract accepts', () => {
  // An effect that began and was cancelled is outcome_unknown; the holder reconciles it with what it observed.
  const r = into(E, A, requestThread, 'Recompute it, please.', { kind: 'request', request: { target: B, capability: CAP } })
  hold()
  const claim = cmd('board_claim', HA2, { idempotency: idem(), capability: CAP, request: r.message })
  cmd('board_accept', HA2, { fence: fence(claim) })
  assert.equal(cmd('board_effect_begin', HA2, { fence: fence(claim) }).request.state, 'in_progress')
  assert.equal(call('board_cancel', q(E), q(A), j(agent), j({ idempotency: idem(), request: r.message }), lit(digest())).request.state, 'outcome_unknown')
  const reqDigest = sql(`select digest from board_messages where estate_id='${E}' and id='${r.message}'`)
  assert.equal(cmd('board_reconcile', HA2, { idempotency: idem(), request: r.message, digest: reqDigest, outcome: { state: 'completed', observed: true } }).request.state, 'completed')
  unknownReq = r.message
  const rows = sql(`select payload::text from journal where estate_id='${E}' and type='comms.request_transitioned@1' order by seq`).split('\n').map(x => JSON.parse(x))
  const settling = rows.filter(p => p.op === 'complete' || p.op === 'reconcile')
  assert.deepEqual(settling.map(p => [p.op, p.settled_by]), [['complete', 'responder'], ['reconcile', 'responder']])
  for (const p of rows) assert.deepEqual(transitionFindings(transitionRecordOf(p)), [], `${p.op} ${p.from}→${p.to}: ${JSON.stringify(transitionRecordOf(p))}`)
  assert.ok(rows.some(p => p.op === 'cancel') && rows.every(p => p.op === 'complete' || p.op === 'reconcile' || p.settled_by === undefined), 'only a settlement names who settled it')
})

await test('timeline: a request\'s transitions oldest first, with cause, generation and who settled it; another estate\'s request is not found', () => {
  const t = call('board_request_timeline_operator', q(E), q(unknownReq))
  assert.equal(t.ok, true, JSON.stringify(t)); assert.equal(t.more, false)
  assert.deepEqual(t.steps.map(s => `${s.op}:${s.from}>${s.to}`), ['claim:queued>claimed', 'accept:claimed>accepted', 'effect_begin:accepted>in_progress', 'cancel:in_progress>outcome_unknown', 'reconcile:outcome_unknown>completed'])
  assert.deepEqual(t.steps.map(s => s.cause), ['responder', 'responder', 'responder', 'requester', 'responder'])
  assert.equal(t.steps[0].generation, 2); assert.equal(t.steps.at(-1).settledBy, 'responder'); assert.equal(t.steps[0].settledBy, undefined)
  assert.equal(t.steps[2].effectTo, 'started'); assert.match(t.steps[0].at, /Z$/)
  const foreignReq = sql(`select message_id from board_requests where estate_id='${OTHER}' limit 1`)
  assert.equal(call('board_request_timeline_operator', q(E), q(foreignReq)).error?.code, 'not_found')
  assert.equal(call('board_request_timeline_operator', q(E), q(id(9999))).error?.code, 'not_found')
  assert.equal(call('board_request_timeline_operator', 'null', q(unknownReq)).error?.code, 'invalid_arguments')
})

await test('related threads: the same projects, or the same file by its stated hash; never the thread itself or another estate\'s', () => {
  const H = 'sha256:' + 'b'.repeat(64)
  const art = label => [{ id: `https://example.org/${label}`, contentHash: H, label }]
  const origin = newThread(E, A, [C], 'the report', { artifacts: art('report.pdf'), subject: 'report' })
  const sameFile = newThread(E, B, [A], 'the same report, again', { artifacts: art('copy.pdf'), subject: 'copy' })
  const sameProjects = newThread(E, C, [A], 'finance and growth again', { subject: 'again' })
  submit(OTHER, F, { idempotency: idem(), thread: { new: { participants: [F] } }, kind: 'message', body: { text: 'the same file elsewhere' }, artifacts: art('elsewhere.pdf') })
  const rel = call('board_related_threads_operator', q(E), q(origin.thread))
  assert.equal(rel.ok, true, JSON.stringify(rel))
  const why = Object.fromEntries(rel.threads.map(t => [t.id, t.why]))
  assert.equal(why[sameFile.thread], 'shared-artifact'); assert.equal(why[sameProjects.thread], 'same-projects')
  const row = rel.threads.find(t => t.id === sameFile.thread)
  assert.deepEqual([...row.participants].sort(), [A, B].sort()); assert.ok(row.createdSeq > 0); assert.ok(row.lastSeq >= row.createdSeq, 'what opens it')
  assert.equal(why[financeThread], 'same-projects', 'the finding thread is between growth and finance too')
  assert.equal(why[origin.thread], undefined, 'a thread is not related to itself')
  assert.equal(Object.keys(why).length, 3, `only those three: ${JSON.stringify(rel.threads)}`)
  assert.ok(rel.threads.length <= 20)
  assert.equal(call('board_related_threads_operator', q(E), q(id(9998))).error?.code, 'not_found')
  assert.equal(call('board_related_threads_operator', q(OTHER), q(origin.thread)).error?.code, 'not_found', 'another estate cannot reach this thread')
})

// ── history search (COM06-05) ───────────────────────────────────────────────────────────────────────────────
const search = (estate, query, before = null, limit = 50) => call('board_search_operator', q(estate), lit(query), before === null ? 'null' : String(before), String(limit))
await test('search: the words as themselves — %, _ and \\ escaped; newest first; a removed body never matches; the estate is the boundary', () => {
  const s = newThread(E, A, [B], '100% done with the export', { subject: 'search' }).thread
  into(E, A, s, 'a decoy draft with no percent sign')
  into(E, A, s, 'under_score in a name')
  into(E, A, s, 'this is a decoy too')
  into(E, A, s, 'back\\slash path')
  into(E, A, s, 'books ks')
  into(E, A, s, 'a rose garden')
  const gone = into(E, A, s, 'a secret phrase removed later')
  sql(`delete from board_bodies where estate_id='${E}' and message_id='${gone.message}'`)   // the redaction path removes a body row
  submit(OTHER, F, { idempotency: idem(), thread: { new: { participants: [F] } }, kind: 'message', body: { text: '100% done elsewhere' } })
  const texts = r => r.hits.map(h => h.snippet)
  assert.deepEqual(texts(search(E, '% d')), ['100% done with the export'], '% is a percent sign, not "anything"')
  assert.deepEqual(texts(search(E, 'r_s')), ['under_score in a name'], '_ is an underscore, not "any character"')
  assert.deepEqual(texts(search(E, 'k\\s')), ['back\\slash path'], '\\ is a backslash, not an escape')
  assert.deepEqual(texts(search(E, 'secret phrase')), [], 'a removed body has no words to match')
  assert.deepEqual(texts(search(E, 'DECOY')), ['this is a decoy too', 'a decoy draft with no percent sign'], 'newest first, any case')
  const hit = search(E, 'under_score').hits[0]
  assert.equal(hit.thread, s); assert.equal(hit.sender, A); assert.match(hit.at, /Z$/); assert.ok(hit.seq > 0)
  assert.equal(hit.subject, 'search'); assert.deepEqual([...hit.participants].sort(), [A, B].sort()); assert.ok(hit.createdSeq > 0 && hit.createdSeq <= hit.seq, 'its thread, to open it there')
  assert.equal(search(E, 'elsewhere').hits.length, 0, 'another estate\'s message')
  for (const bad of ['x', 'y'.repeat(201)]) assert.equal(search(E, bad).error?.code, 'invalid_arguments', bad)
  assert.equal(search(E, 'x'.repeat(200)).ok, true, '200 characters is a search')
})

await test('search: bounded pages by the same order, and a search over its time budget stops and says so', () => {
  const t = newThread(E, A, [B], 'needle 0', { subject: 'needles' }).thread
  sql(`begin;\n${Array.from({ length: 54 }, (_, i) => submitArgs(E, A, { idempotency: idem(), thread: { id: t }, kind: 'message', body: { text: `needle ${i + 1}` } }).replace('set role service_role; ', '')).join('\n')}\ncommit;`)
  const first = search(E, 'needle')
  assert.equal(first.hits.length, 50); assert.equal(first.more, true); assert.equal(first.stoppedEarly, false)
  assert.ok(first.hits.every((h, i) => i === 0 || first.hits[i - 1].seq > h.seq), 'newest first')
  const next = search(E, 'needle', first.before)
  assert.equal(next.hits.length, 5); assert.equal(next.more, false)
  assert.equal(new Set([...first.hits, ...next.hits].map(h => h.message)).size, 55, 'no hit twice, none lost')
  assert.ok(next.hits.every(h => h.seq < first.before))
  // A planted zero budget: the search stops at once and says so — never "no message contains these words".
  sql(`create or replace function board_search_budget() returns interval language sql stable set search_path = public as $$ select interval '0' $$`)
  try {
    const stopped = search(E, 'needle')
    assert.equal(stopped.ok, true); assert.equal(stopped.stoppedEarly, true); assert.equal(stopped.more, false)
  } finally {
    sql(`create or replace function board_search_budget() returns interval language sql stable set search_path = public as $$ select interval '2 seconds' $$`)
    sql(`revoke execute on function board_search_budget() from public, anon, authenticated, service_role`)
  }
})

// ── what waits for a project (COM05-01) ──────────────────────────────────────────────────────────────────────
await test('pending: per project, what was delivered, held and not marked read — findings, requests and requests nobody answers; a delivery whose text did not come back is not counted', () => {
  const t1 = submit(PE, PA, { idempotency: idem(), thread: { new: { participants: [PB, PC], subject: 'for both' } }, kind: 'message', body: { text: 'hello both' } })
  submit(PE, PA, { idempotency: idem(), thread: { id: t1.thread }, kind: 'finding', body: { text: 'a finding' } })
  const r = submit(PE, PA, { idempotency: idem(), thread: { new: { participants: [PB] } }, kind: 'request', body: { text: 'please' }, request: { target: PB, capability: 'reports.weekly' } })
  // PC reads what it was sent; PB reads nothing.
  for (const m of sql(`select message_id from board_deliveries where estate_id='${PE}' and recipient_project='${PC}'`).split('\n')) ack(PE, PC, m)
  // A restore whose board history did not come back: a delivery with no message row (only a superuser can plant one).
  sql(`insert into board_deliveries (estate_id, message_id, recipient_project, seq, is_request, capability) values ('${PE}', '${id(8888)}', '${PB}', 999, true, 'reports.weekly')`)
  const p = call('board_pending_operator', q(PE), '100')
  assert.equal(p.ok, true, JSON.stringify(p)); assert.equal(p.more, false)
  assert.deepEqual(p.projects.map(x => x.project), [PB], 'PC read everything; PA sent everything')
  const pb = p.projects[0]
  assert.equal(pb.unread, 3, 'two messages in the shared thread and the request — not the planted delivery')
  assert.equal(pb.findings, 1); assert.equal(pb.requests, 1); assert.equal(pb.requestsWithAbsentResponder, 1, 'no agent answers reports.weekly')
  assert.match(pb.oldestAt, /Z$/)
  void r
  assert.deepEqual(call('board_pending_operator', q(OTHER), '100').projects, [], 'a thread whose only participant is its sender delivers nothing')
  assert.ok(!call('board_pending_operator', q(E), '100').projects.some(x => [PA, PB, PC].includes(x.project)), 'the estate is the boundary')
  assert.equal(call('board_pending_operator', 'null', '100').error?.code, 'invalid_arguments')
})

// ── the doors (R-003) ──────────────────────────────────────────────────────────────────────────────────────
await test('every new read is the service role\'s door alone; the budget helper is nobody\'s', () => {
  const doors = ['board_thread_page_operator(uuid,jsonb,jsonb,integer)', 'board_thread_heads_operator(uuid,integer)', 'board_message_facts_operator(uuid,uuid[])',
    'board_request_timeline_operator(uuid,uuid)', 'board_related_threads_operator(uuid,uuid)', 'board_search_operator(uuid,text,bigint,integer)',
    'board_pending_operator(uuid,integer)', 'board_responders_operator(uuid)']
  for (const f of doors) {
    assert.equal(sql(`select has_function_privilege('service_role', '${f}', 'execute')`), 't', `${f}: the service role`)
    for (const role of ['anon', 'authenticated']) assert.equal(sql(`select has_function_privilege('${role}', '${f}', 'execute')`), 'f', `${f}: ${role}`)
    assert.equal(sql(`select prosecdef from pg_proc where oid = '${f}'::regprocedure`), 't', `${f} is a security-definer door`)
  }
  for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(sql(`select has_function_privilege('${role}', 'board_search_budget()', 'execute')`), 'f', role)
})

console.log(`${count} passed, ${failed.length} failed`)
if (failed.length) { console.log('FAILED: ' + failed.join('; ')); process.exit(1) }
// #endregion project-board-operator-reads
