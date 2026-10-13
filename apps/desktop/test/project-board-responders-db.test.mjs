// Migration 87 (suffix 104) — the project board's responders, COM-03 (ADR-0149 §2–§6, contract DEC-0073), on the
// fully migrated chain. The plan's acceptance (P:106-107) drives the order: a responder that was replaced cannot
// finish what it held, first; then the fence field by field, revocation, release, replacement and reconciliation, the
// restore that keeps history and switches authority off, the directory, and what no API role may do (R-003).
// To WATCH this suite fail, run the runner with FABRIC_SKIP_MIGRATION=20261012000104_project_board_responders.sql.
// #region project-board-responders — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#decision
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { runPsqlAsync } from './bounded-psql.mjs'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-project-board-responders-db.mjs'); process.exit(2) }
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

const id = n => `87000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = id(1), OTHER = id(2)
const REQUESTER = id(11), RESPONDER = id(12), THIRD = id(13), FOREIGN = id(21)
const CAP = 'analytics.retention', CAP2 = 'analytics.cohorts'
const lit = v => `'${String(v).replace(/'/g, "''")}'`
const j = v => `${lit(JSON.stringify(v))}::jsonb`
const system = { kind: 'system', id: 'board-probe' }
const operator = { kind: 'person', id: 'operator' }
let dN = 0
const digest = () => 'sha256:' + (++dN).toString(16).padStart(64, '0')
let keyN = 0
const key = () => `key-${String(++keyN).padStart(6, '0')}`
const idem = () => ({ epoch: 1, key: key() })
const later = minutes => new Date(Date.now() + minutes * 60_000).toISOString()
const append = (estate, type, payload, project = null, actor = system) =>
  sql(`set role service_role; select seq from append_event('${estate}','${type}',${j(actor)},${j(payload)},'1',${project ? `'${project}'` : 'null'})`)
const events = (estate, type) => Number(sql(`select count(*) from journal where estate_id='${estate}' and type='${type}'`))
const journalCount = estate => Number(sql(`select count(*) from journal where estate_id='${estate}'`))
const call = (fn, ...a) => JSON.parse(sql(`set role service_role; select ${fn}(${a.join(',')})`))
const q = v => (v === null ? 'null' : `'${v}'`)
const agent = { kind: 'agent', id: 'requester-session', label: 'Requester', provenance: 'trusted' }

// Sessions: A is a launched Claude Code session (its runner's binding holds the grant); B is an enrolled Codex session
// (its own binding's grant); C is a launched Kimi session whose runner holds no grant.
const SA = id(301), SB = id(302), SC = id(303), SD = id(304)
const HA = { session_id: SA, came_in: 'launched', agent: 'claude-code', binding_id: null, label: 'Claude Code' }
const BA = id(401), BB = id(402), BD = id(404)
const HB = { session_id: SB, came_in: 'enrolled', agent: 'codex', binding_id: BB, label: 'Codex' }
const HC = { session_id: SC, came_in: 'launched', agent: 'kimi-code', binding_id: null, label: 'Kimi' }
const HD = { session_id: SD, came_in: 'hub', agent: 'example-agent', binding_id: BD, label: 'Example agent' }
const cmd = (fn, holder, args, d = digest(), project = RESPONDER, estate = E) =>
  call(fn, q(estate), j(holder), q(project), j(args), lit(d))
const submitRequest = (extra = {}, capability = CAP, d = digest()) => {
  const r = call('board_submit', q(E), q(REQUESTER), j(agent), j({
    idempotency: idem(), thread: { new: { participants: [RESPONDER], subject: 'retention' } }, kind: 'request',
    body: { text: 'Please compute 7-day retention.' }, request: { target: RESPONDER, capability, ...extra } }), lit(d))
  assert.equal(r.ok, true, JSON.stringify(r))
  return { id: r.message, thread: r.thread, digest: d }
}
const fence = (claim, extra = {}) => ({ request: claim.request.id, generation: claim.attempt.generation, attempt: claim.attempt.id, digest: claim.attempt.digest, idempotency: idem(), ...extra })
const state = rid => sql(`select state || '|' || effect || '|' || revision from board_requests where estate_id='${E}' and message_id='${rid}'`)
const slot = (cap = CAP, project = RESPONDER) => sql(`select generation || '|' || coalesce(holder_enrollment::text, 'none') from board_responder_slots where estate_id='${E}' and project_id='${project}' and capability='${cap}'`)
const lapse = (cap = CAP) => sql(`update board_responder_slots set lease_until = clock_timestamp() - interval '1 second' where estate_id='${E}' and project_id='${RESPONDER}' and capability='${cap}'`)
const lapseAttempt = aid => sql(`update board_attempts set lease_until = clock_timestamp() - interval '1 second' where estate_id='${E}' and id='${aid}'`)

let grantN = 0
const grant = (estate, binding, agentId, resources, newBinding) => {
  const rq = id(500 + ++grantN), gs = resources.map((r, i) => ({ id: id(600 + grantN * 10 + i), capability: 'board.respond', resource: r, expires_at: later(525600) }))
  append(estate, 'access.requested@1', { id: rq, agent_id: agentId, callee: 'fabric', capabilities: ['board.respond'], resources, reason: 'answer analytics requests',
    registry: { key: agentId, name: agentId, installed_by: 'a coding agent on this computer', repository: null }, binding_id: newBinding ? null : binding, expires_at: later(10) },
    null, { kind: 'system', id: 'fabric-hub' })
  append(estate, 'access.decided@1', { request_id: rq, decision: 'allowed', binding_id: binding, new_binding: newBinding, grants: gs }, null, operator)
  return gs.map(g => g.id)
}

append(E, 'estate.created@1', { name: 'responders estate', owner_person_id: id(91) })
append(OTHER, 'estate.created@1', { name: 'other estate', owner_person_id: id(92) })
for (const [estate, project, name] of [[E, REQUESTER, 'growth'], [E, RESPONDER, 'analytics'], [E, THIRD, 'finance'], [OTHER, FOREIGN, 'elsewhere']])
  append(estate, 'project.created@1', { id: project, name }, project)
const [GA] = grant(E, BA, 'claude-code', [`board:${RESPONDER}/${CAP}`], true)
const [GB, GB2] = grant(E, BB, 'codex', [`board:${RESPONDER}/${CAP}`, `board:${RESPONDER}/${CAP2}`], true)
const [GD] = grant(E, BD, 'example-agent', [`board:${THIRD}/finance.close`], true)

// ── P:106-107: whoever holds the slot answers; a replaced responder cannot finish ──────────────────────────
let r1, r2, claimA1, claimA2
await test('no grant: an agent the operator did not let answer is refused before any write (COM03-01)', () => {
  const before = journalCount(E)
  const r = cmd('board_enroll', HC, { idempotency: idem(), capability: CAP })
  assert.equal(r.error?.code, 'not_authorized', JSON.stringify(r))
  // The refusal names a route the agent has (wave-2 product finding 16): the operator's Settings → Agent access.
  assert.equal(r.error.message, `The operator has not let this agent answer ${CAP} requests for this project: the operator grants it in Fabric, Settings → Agent access. Until then, reply on the request's thread and say it stays queued.`)
  assert.equal(journalCount(E), before, 'a refused enroll wrote an event')
  assert.equal(sql(`select count(*) from board_idempotency where estate_id='${E}' and operation='enroll'`), '0', 'a refused enroll stored a receipt')
})

await test('P:106-107: A enrolls, claims and accepts; its lease lapses; B enrolls at generation 2; A\'s claim is queued again, B takes it; A is fenced', () => {
  r1 = submitRequest(); r2 = submitRequest()
  const enA = cmd('board_enroll', HA, { idempotency: idem(), capability: CAP })
  assert.equal(enA.ok, true, JSON.stringify(enA))
  assert.equal(enA.slot.generation, 1); assert.equal(enA.slot.project, RESPONDER); assert.match(enA.slot.leaseExpiresAt, /Z$/)
  claimA1 = cmd('board_claim', HA, { idempotency: idem(), capability: CAP })
  assert.equal(claimA1.request.id, r1.id, 'the oldest queued request first'); assert.equal(claimA1.request.state, 'claimed')
  assert.equal(claimA1.attempt.digest, r1.digest); assert.equal(claimA1.attempt.generation, 1); assert.equal(claimA1.message, r1.id)
  const acc = cmd('board_accept', HA, { fence: fence(claimA1) })
  assert.equal(acc.request.state, 'accepted', JSON.stringify(acc))
  claimA2 = cmd('board_claim', HA, { idempotency: idem(), capability: CAP })
  assert.equal(claimA2.request.id, r2.id)
  // The holder goes quiet: its lease lapses in database time.
  lapse()
  const enB = cmd('board_enroll', HB, { idempotency: idem(), capability: CAP })
  assert.equal(enB.ok, true, JSON.stringify(enB)); assert.equal(enB.slot.generation, 2)
  assert.match(state(r2.id), /^queued\|not_started\|/, 'A\'s claimed request is back in queued')
  assert.match(state(r1.id), /^accepted\|/, 'an accepted request is held, not requeued (C4)')
  const claimB = cmd('board_claim', HB, { idempotency: idem(), capability: CAP })
  assert.equal(claimB.request.id, r2.id); assert.equal(claimB.attempt.generation, 2)
  for (const [fn, args] of [['board_accept', { fence: fence(claimA2) }], ['board_renew', { fence: fence(claimA2) }],
    ['board_reply_fenced', { fence: fence(claimA2), body: { text: 'late from A' } }],
    ['board_complete', { fence: fence(claimA1), outcome: { state: 'completed', observed: false } }]]) {
    const r = cmd(fn, HA, args)
    assert.equal(r.error?.code, 'fenced', `${fn}: ${JSON.stringify(r)}`)
  }
  assert.match(state(r2.id), /^claimed\|/, 'a fenced call moved the request')
  assert.equal(sql(`select released_cause from board_enrollments where estate_id='${E}' and session_id='${SA}'`), 'replaced')
  assert.equal(events(E, 'comms.responder_enrolled@1'), 2)
})

await test('one fenced claim per request: concurrent enrolls on a lapsed slot give one generation; concurrent claims open one attempt (COM03-02, -03)', async () => {
  lapse()
  const enroll = h => `set role service_role; select board_enroll('${E}',${j(h)},'${RESPONDER}',${j({ idempotency: idem(), capability: CAP })},${lit(digest())});`
  const HA2 = { ...HA, session_id: id(311) }
  const outs = await Promise.all([enroll(HA2), enroll(HB)].map(s => runPsqlAsync('psql', psqlArgs, s, { label: 'concurrent enroll' })))
  const answers = outs.map(o => JSON.parse(o.stdout.trim()))
  // B is the holder whose lease lapsed: it renews its own slot (generation 2); A2 then meets a live holder.
  const gens = answers.map(a => a.slot?.generation ?? a.error?.code).sort()
  assert.ok(JSON.stringify(gens) === JSON.stringify([2, 'fenced']) || JSON.stringify(gens) === JSON.stringify([3, 'fenced']), JSON.stringify(answers))
  // Whichever won, exactly one live enrollment holds the slot.
  assert.equal(sql(`select count(*) from board_enrollments where estate_id='${E}' and project_id='${RESPONDER}' and capability='${CAP}' and released_seq is null`), '1')
  const winner = answers.find(a => a.ok) === answers[0] ? HA2 : HB
  submitRequest()
  const claim = () => `set role service_role; select board_claim('${E}',${j(winner)},'${RESPONDER}',${j({ idempotency: idem(), capability: CAP })},${lit(digest())});`
  const claims = (await Promise.all([claim(), claim()].map(s => runPsqlAsync('psql', psqlArgs, s, { label: 'concurrent claim' })))).map(o => JSON.parse(o.stdout.trim()))
  const ids = claims.map(c => c.request?.id).filter(Boolean)
  assert.equal(new Set(ids).size, ids.length, 'two claims took the same request')
  assert.equal(sql(`select count(*) from (select request_id from board_attempts where estate_id='${E}' and ended_seq is null group by request_id having count(*) > 1) x`), '0')
  // The database itself refuses a second live attempt for one request, whatever a command does (the backstop to the slot lock).
  const live = sql(`select request_id || '|' || generation || '|' || enrollment_id from board_attempts where estate_id='${E}' and ended_seq is null limit 1`).split('|')
  refuses(`insert into board_attempts (estate_id, id, request_id, generation, enrollment_id, claimed_seq) values ('${E}', '${id(995)}', '${live[0]}', ${live[1]}, '${live[2]}', 1)`, /board_attempts_one_live|duplicate key/)
  // Leave B as the holder for the cases below.
  if (winner !== HB) { lapse(); assert.equal(cmd('board_enroll', HB, { idempotency: idem(), capability: CAP }).ok, true) }
})

await test('the fence compares the generation itself: a slot that moved on under a live attempt fences the call (C4)', () => {
  const r = submitRequest()
  const c = cmd('board_claim', HB, { idempotency: idem(), capability: CAP, request: r.id })
  assert.equal(c.request?.state, 'claimed', JSON.stringify(c))
  // As if a takeover's projection had not reached the attempt yet: the slot's generation moves, the attempt stays live.
  sql(`update board_responder_slots set generation = generation + 1 where estate_id='${E}' and project_id='${RESPONDER}' and capability='${CAP}'`)
  try {
    assert.equal(cmd('board_accept', HB, { fence: fence(c) }).error?.code, 'fenced')
    assert.match(state(r.id), /^claimed\|/)
  } finally {
    sql(`update board_responder_slots set generation = generation - 1 where estate_id='${E}' and project_id='${RESPONDER}' and capability='${CAP}'`)
  }
})

// ── the fence, field by field ──────────────────────────────────────────────────────────────────────────────
let claimF
await test('every fence field wrong in turn answers its own code, and changes nothing (C4)', () => {
  const r = submitRequest()
  claimF = cmd('board_claim', HB, { idempotency: idem(), capability: CAP, request: r.id })
  assert.equal(claimF.request?.id, r.id, JSON.stringify(claimF))
  const before = state(r.id)
  const cases = [
    [{ request: id(999) }, 'not_authorized'],
    [{ digest: 'sha256:' + 'f'.repeat(64) }, 'digest_conflict'],
    [{ generation: claimF.attempt.generation + 7 }, 'fenced'],
    [{ attempt: id(998) }, 'fenced'],
    [{ expectedRevision: 99 }, 'revision_conflict']
  ]
  for (const [bad, code] of cases) {
    const out = cmd('board_accept', HB, { fence: fence(claimF, bad) })
    assert.equal(out.error?.code, code, `${JSON.stringify(bad)}: ${JSON.stringify(out)}`)
  }
  lapseAttempt(claimF.attempt.id)
  assert.equal(cmd('board_accept', HB, { fence: fence(claimF) }).error?.code, 'lease_expired')
  assert.equal(state(r.id), before, 'a refused fence moved the request')
  assert.equal(cmd('board_accept', HB, { fence: { ...fence(claimF), extra: 1 } }).error?.code, 'invalid_arguments')
  // The lapsed claim is taken again with a new attempt (DEC-0073 §5).
  const again = cmd('board_claim', HB, { idempotency: idem(), capability: CAP, request: r.id })
  assert.equal(again.request.state, 'claimed'); assert.notEqual(again.attempt.id, claimF.attempt.id)
  assert.equal(cmd('board_accept', HB, { fence: fence(claimF) }).error?.code, 'fenced', 'the old attempt still acts')
  claimF = again
})

await test('the clock: a lease never comes from an argument and never exceeds database time + 60 s (ADR-0149 §5)', () => {
  assert.equal(cmd('board_enroll', HB, { idempotency: idem(), capability: CAP, leaseUntil: '2099-01-01T00:00:00Z' }).error?.code, 'invalid_arguments')
  assert.equal(cmd('board_renew', HB, { fence: fence(claimF), leaseUntil: '2099-01-01T00:00:00Z' }).error?.code, 'invalid_arguments')
  const renewed = cmd('board_renew', HB, { fence: fence(claimF) })
  assert.equal(renewed.ok, true, JSON.stringify(renewed)); assert.equal(renewed.repeated, false)
  assert.equal(sql(`select bool_and(lease_until <= clock_timestamp() + interval '60 seconds') from board_responder_slots where estate_id='${E}'`), 't')
  assert.equal(sql(`select bool_and(lease_until <= clock_timestamp() + interval '60 seconds') from board_attempts where estate_id='${E}' and lease_until is not null`), 't')
  assert.equal(sql(`select count(*) from board_idempotency where estate_id='${E}' and operation in ('renew','progress')`), '0', 'renew stored a receipt')
})

await test('accept → effect_begin → complete: an effect that began completes only when observed; the outcome is kept beside the event (COM03-05)', () => {
  const acc = cmd('board_accept', HB, { fence: fence(claimF) })
  assert.equal(acc.request.state, 'accepted')
  const repeatKey = idem()
  const begun = cmd('board_effect_begin', HB, { fence: fence(claimF, { idempotency: repeatKey }), summary: 'Running the retention query.' }, 'sha256:' + 'e'.repeat(64))
  assert.equal(begun.request.state, 'in_progress'); assert.equal(begun.request.effect, 'started')
  const again = cmd('board_effect_begin', HB, { fence: fence(claimF, { idempotency: repeatKey }), summary: 'Running the retention query.' }, 'sha256:' + 'e'.repeat(64))
  assert.equal(again.repeated, true, 'the same key and digest returned another answer'); assert.deepEqual(again.request, begun.request)
  const unobserved = cmd('board_complete', HB, { fence: fence(claimF), outcome: { state: 'completed', observed: false } })
  assert.equal(unobserved.error?.code, 'observation_required', JSON.stringify(unobserved))
  const done = cmd('board_complete', HB, { fence: fence(claimF), outcome: { state: 'completed', observed: true, summary: '7-day retention is 41%.' } })
  assert.equal(done.request.state, 'completed'); assert.equal(done.request.effect, 'succeeded_observed')
  assert.equal(sql(`select summary from board_outcomes where estate_id='${E}' and request_id='${claimF.request.id}'`), '7-day retention is 41%.')
  assert.equal(sql(`select ended_cause from board_attempts where estate_id='${E}' and id='${claimF.attempt.id}'`), 'completed')
  const payload = sql(`select payload::text from journal where estate_id='${E}' and type='comms.request_transitioned@1' order by seq desc limit 1`)
  assert.equal(payload.includes('41%'), false, 'the journal carries the outcome text')
  assert.equal(cmd('board_renew', HB, { fence: fence(claimF) }).error?.code, 'fenced', 'a finished attempt renews')
})

await test('a reply is not a completion; a progress note posts once per attempt and key, and another note under it is idempotency_conflict (COM03-08)', () => {
  const r = submitRequest()
  const c = cmd('board_claim', HB, { idempotency: idem(), capability: CAP, request: r.id })
  const replied = cmd('board_reply_fenced', HB, { fence: fence(c), body: { text: 'On it; first numbers by noon.' } })
  assert.equal(replied.ok, true, JSON.stringify(replied)); assert.equal(replied.thread, r.thread)
  assert.match(state(r.id), /^claimed\|/, 'a reply moved the request')
  const note = { fence: fence(c), note: { text: 'Half the cohorts done.' } }
  const nd = digest()
  const p1 = cmd('board_progress', HB, note, nd)
  assert.equal(p1.repeated, false); assert.match(p1.message, /^[0-9a-f-]{36}$/); assert.equal(p1.attempt.id, c.attempt.id)
  const p2 = cmd('board_progress', HB, note, nd)
  assert.equal(p2.repeated, true); assert.equal(p2.message, p1.message)
  const p3 = cmd('board_progress', HB, { ...note, note: { text: 'Something else.' } }, digest())
  assert.equal(p3.error?.code, 'idempotency_conflict')
  assert.equal(sql(`select count(*) from board_messages where estate_id='${E}' and thread_id='${r.thread}'`), '3', 'request, reply and one note')
  const message = call('board_get', q(E), q(REQUESTER), q(p1.message)).message
  assert.equal(message.body.text, 'Half the cohorts done.'); assert.equal(message.sender.project, RESPONDER); assert.equal(message.sender.principal.label, 'Codex')
  const nothing = cmd('board_claim', HB, { idempotency: idem(), capability: CAP2 })
  assert.equal(nothing.error?.code, 'fenced', 'claiming a slot not held')
})

await test('nothing to claim answers {ok, repeated:false} and stores nothing, so the same key polls again (DEC-0073 §3)', () => {
  const k = idem()
  // Drain: claim until none is queued.
  for (let i = 0; i < 20; i++) { const c = cmd('board_claim', HB, { idempotency: idem(), capability: CAP }); if (!c.request) break }
  const empty = cmd('board_claim', HB, { idempotency: k, capability: CAP }, 'sha256:' + 'c'.repeat(64))
  assert.deepEqual(empty, { ok: true, repeated: false })
  const r = submitRequest()
  const got = cmd('board_claim', HB, { idempotency: k, capability: CAP }, 'sha256:' + 'c'.repeat(64))
  assert.equal(got.request?.id, r.id, 'the same key, polling again, was answered from a stored nothing')
})

await test('revocation between accept and effect_begin: authority_changed and the request does not move (COM03-10, C9)', () => {
  const HE = { session_id: id(320), came_in: 'enrolled', agent: 'codex', binding_id: id(420), label: 'Codex' }
  const [GE] = grant(E, HE.binding_id, 'codex', [`board:${RESPONDER}/${CAP2}`], true)
  const r = submitRequest({}, CAP2)
  assert.equal(cmd('board_enroll', HE, { idempotency: idem(), capability: CAP2 }).ok, true)
  const c = cmd('board_claim', HE, { idempotency: idem(), capability: CAP2 })
  assert.equal(cmd('board_accept', HE, { fence: fence(c) }).request.state, 'accepted')
  append(E, 'access.grant.revoked@1', { grant_id: GE }, null, operator)
  const before = state(r.id)
  const out = cmd('board_effect_begin', HE, { fence: fence(c) })
  assert.equal(out.error?.code, 'authority_changed', JSON.stringify(out))
  assert.equal(state(r.id), before)
  // The host's release after the revocation: the enrollment goes, the request stays accepted (held, C4).
  assert.equal(call('board_release_grant', q(E), q(GE)).released, 1)
  assert.equal(cmd('board_effect_begin', HE, { fence: fence(c) }).error?.code, 'authority_changed', 'the released enrollment still names its revoked grant')
  assert.match(state(r.id), /^accepted\|/)
  void GB2
})

await test('a session\'s end releases its slot; a claimed request stays claimed and is re-claimable; a new holder turns in_progress into outcome_unknown, holds accepted (DEC-0073 §5, R4)', () => {
  // B holds CAP: give it one claimed, one accepted and one in_progress request.
  const rc = submitRequest(), ra = submitRequest(), rp = submitRequest()
  const cc = cmd('board_claim', HB, { idempotency: idem(), capability: CAP, request: rc.id })
  const ca = cmd('board_claim', HB, { idempotency: idem(), capability: CAP, request: ra.id })
  const cp = cmd('board_claim', HB, { idempotency: idem(), capability: CAP, request: rp.id })
  cmd('board_accept', HB, { fence: fence(ca) }); cmd('board_accept', HB, { fence: fence(cp) })
  assert.equal(cmd('board_effect_begin', HB, { fence: fence(cp) }).request.state, 'in_progress')
  const genBefore = Number(slot().split('|')[0])
  const released = call('board_release_session', q(E), lit(SB))
  assert.ok(released.released >= 1, JSON.stringify(released))
  assert.equal(slot().split('|')[1], 'none', 'the slot still has a holder')
  // A release is not an operation: nothing moved.
  assert.match(state(rc.id), /^claimed\|/); assert.match(state(ra.id), /^accepted\|/); assert.match(state(rp.id), /^in_progress\|/)
  assert.equal(cmd('board_renew', HB, { fence: fence(cc) }).error?.code, 'fenced', 'a released responder renews')
  // A fresh enroll on the empty slot (R4): in_progress → outcome_unknown via lost_result; claimed stays claimed; accepted held.
  const HF = { ...HB, session_id: id(330) }
  const en = cmd('board_enroll', HF, { idempotency: idem(), capability: CAP })
  assert.equal(en.slot.generation, genBefore + 1, JSON.stringify(en))
  assert.match(state(rp.id), /^outcome_unknown\|unknown\|/)
  assert.match(state(rc.id), /^claimed\|/, 'a released claim was requeued instead of staying claimed')
  assert.match(state(ra.id), /^accepted\|/)
  assert.equal(sql(`select payload->>'op' || '|' || (payload->>'cause') from journal where estate_id='${E}' and type='comms.request_transitioned@1' and payload->>'request_id'='${rp.id}' order by seq desc limit 1`), 'lost_result|replaced')
  const taken = cmd('board_claim', HF, { idempotency: idem(), capability: CAP, request: rc.id })
  assert.equal(taken.request.state, 'claimed'); assert.equal(taken.attempt.generation, genBefore + 1, 'the lapsed claim got no new attempt')
  // Reconcile the unknown one with an observed result.
  const rec = cmd('board_reconcile', HF, { idempotency: idem(), request: rp.id, digest: rp.digest, outcome: { state: 'failed_known', observed: true, summary: 'The query timed out; nothing was written.' } })
  assert.equal(rec.request.state, 'failed_known'); assert.equal(rec.request.effect, 'failed_observed')
  assert.equal(cmd('board_reconcile', HF, { idempotency: idem(), request: rp.id, digest: rp.digest, outcome: { state: 'completed', observed: false } }).error?.code, 'invalid_arguments', 'an unobserved reconcile')
  // Leave HF as the holder.
  HB.session_id = HF.session_id
})

await test('com.responder_replace: a live holder is replaced at the generation read; a transfer continues accepted work under a new attempt; reconcile settles the unknown (COM03-06, -07)', () => {
  const holder = HB
  const ra = submitRequest(), rp = submitRequest(), rq = submitRequest()
  const ca = cmd('board_claim', holder, { idempotency: idem(), capability: CAP, request: ra.id })
  const cp = cmd('board_claim', holder, { idempotency: idem(), capability: CAP, request: rp.id })
  cmd('board_claim', holder, { idempotency: idem(), capability: CAP, request: rq.id })
  cmd('board_accept', holder, { fence: fence(ca) }); cmd('board_accept', holder, { fence: fence(cp) })
  cmd('board_effect_begin', holder, { fence: fence(cp) })
  const gen = Number(slot().split('|')[0])
  const HG = { session_id: id(340), came_in: 'launched', agent: 'claude-code', binding_id: null, label: 'Claude Code' }
  assert.equal(cmd('board_responder_replace', HG, { idempotency: idem(), capability: CAP, expectedGeneration: gen - 1 }).error?.code, 'revision_conflict')
  assert.equal(cmd('board_responder_replace', HG, { idempotency: idem(), capability: CAP, expectedGeneration: gen,
    transfer: { requests: [rq.id], checkpoint: { summary: 'x' } } }).error?.code, 'invalid_arguments', 'a claimed request transferred')
  assert.equal(slot().split('|')[0], String(gen), 'a refused replace moved the slot')
  const rep = cmd('board_responder_replace', HG, { idempotency: idem(), capability: CAP, expectedGeneration: gen,
    transfer: { requests: [ra.id], checkpoint: { summary: 'Cohorts 1-4 done; 5-8 remain.' } } })
  assert.equal(rep.slot.generation, gen + 1, JSON.stringify(rep))
  assert.match(state(rq.id), /^queued\|/, 'a claimed request of the replaced generation is queued again (op replace)')
  assert.match(state(rp.id), /^outcome_unknown\|unknown\|/)
  assert.match(state(ra.id), /^accepted\|/)
  // Contract DEC-0078: the receipt names each transferred request once, with its revision and the new attempt.
  assert.equal(rep.transferred?.length, 1, JSON.stringify(rep))
  const [moved] = rep.transferred
  assert.equal(moved.request, ra.id); assert.equal(moved.revision, Number(state(ra.id).split('|')[2]))
  assert.equal(moved.attempt.generation, gen + 1); assert.equal(moved.attempt.digest, ra.digest); assert.match(moved.attempt.leaseExpiresAt, /Z$/)
  assert.deepEqual(Object.keys(moved).sort(), ['attempt', 'request', 'revision']); assert.deepEqual(Object.keys(moved.attempt).sort(), ['digest', 'generation', 'id', 'leaseExpiresAt'])
  // com.claim never moves or reads back an accepted request (ADR-0149 Amendment 1 §3 withdrawn): nothing moves.
  const revBefore = state(ra.id)
  assert.equal(cmd('board_claim', HG, { idempotency: idem(), capability: CAP, request: ra.id }).error?.code, 'invalid_transition')
  assert.equal(state(ra.id), revBefore)
  const read = { request: { id: ra.id }, attempt: moved.attempt }
  assert.equal(cmd('board_complete', holder, { fence: fence(ca), outcome: { state: 'completed', observed: true } }).error?.code, 'fenced', 'the replaced holder completed')
  const done = cmd('board_complete', HG, { fence: fence(read), outcome: { state: 'completed', observed: false } })
  assert.equal(done.request.state, 'completed', JSON.stringify(done)); assert.equal(done.request.effect, 'not_started')
  const checkpoint = sql(`select b.text from board_messages m join board_bodies b on b.message_id = m.id where m.estate_id='${E}' and m.reply_to='${ra.id}' order by m.seq desc limit 1`)
  assert.equal(checkpoint, 'Cohorts 1-4 done; 5-8 remain.')
  assert.equal(cmd('board_reconcile', HG, { idempotency: idem(), request: rp.id, digest: ra.digest, outcome: { state: 'completed', observed: true } }).error?.code, 'digest_conflict')
  assert.equal(cmd('board_reconcile', HG, { idempotency: idem(), request: rp.id, digest: rp.digest, outcome: { state: 'completed', observed: true } }).request.state, 'completed')
  HB.session_id = HG.session_id; Object.assign(HB, { came_in: 'launched', agent: 'claude-code', binding_id: null })
})

await test('a request that is not the caller\'s Project is not_authorized; the requester cannot complete its own request (C1)', () => {
  const r = submitRequest()
  const c = cmd('board_claim', HB, { idempotency: idem(), capability: CAP, request: r.id })
  assert.equal(cmd('board_accept', HB, { fence: fence(c) }, digest(), THIRD).error?.code, 'not_authorized', 'another Project acted on the request')
  const asRequester = { ...HA, session_id: id(350) }
  assert.equal(cmd('board_complete', asRequester, { fence: fence(c), outcome: { state: 'completed', observed: true } }, digest(), REQUESTER).error?.code, 'not_authorized')
  assert.equal(cmd('board_claim', HB, { idempotency: idem(), capability: CAP, request: id(997) }).error?.code, 'not_authorized')
  const otherEstate = cmd('board_enroll', HB, { idempotency: idem(), capability: CAP }, digest(), RESPONDER, OTHER)
  assert.equal(otherEstate.error?.code, 'not_authorized', 'another estate enrolled into this Project')
})

await test('com.status responders: active, stale (a lapsed lease, not a failure) and absent, with generation and provenance (COM03-11)', () => {
  let responders = call('board_status', q(E), q(RESPONDER)).responders
  const active = responders.find(x => x.capability === CAP)
  assert.equal(active.state, 'active'); assert.ok(active.generation >= 1); assert.equal(active.provenance, 'trusted'); assert.match(active.leaseExpiresAt, /Z$/)
  const absent = responders.find(x => x.capability === CAP2)
  assert.equal(absent.state, 'absent', JSON.stringify(responders))
  lapse()
  responders = call('board_status', q(E), q(RESPONDER)).responders
  assert.equal(responders.find(x => x.capability === CAP).state, 'stale')
  assert.equal(JSON.stringify(responders).includes(SB), false, 'status named a session')
  const op = call('board_responders_operator', q(E))
  const row = op.responders.find(x => x.project === RESPONDER && x.capability === CAP)
  assert.equal(row.state, 'stale'); assert.equal(row.agent, 'claude-code'); assert.equal(row.cameIn, 'launched'); assert.match(row.since, /Z$/)
  assert.equal(cmd('board_enroll', HB, { idempotency: idem(), capability: CAP }).ok, true, 'the holder renews its own lapsed slot')
})

await test('fabric.board.join: a binding joins only a Project it holds board.respond on, and learns its capabilities (COM03-09)', () => {
  assert.deepEqual(call('board_join_check', q(E), q(BD), q(THIRD)), { ok: true, capabilities: ['finance.close'], grants: [GD] })
  assert.equal(call('board_join_check', q(E), q(BD), q(RESPONDER)).error?.code, 'not_authorized')
  assert.equal(call('board_join_check', q(OTHER), q(BD), q(THIRD)).error?.code, 'not_authorized')
  const en = cmd('board_enroll', HD, { idempotency: idem(), capability: 'finance.close' }, digest(), THIRD)
  assert.equal(en.ok, true, JSON.stringify(en))
  assert.equal(cmd('board_enroll', { ...HD, binding_id: BA }, { idempotency: idem(), capability: 'finance.close' }, digest(), THIRD).error?.code, 'not_authorized', 'another binding answered under this grant')
  void GD; void GA; void GB
})

// ── the directory (DEC-0073 §8) ────────────────────────────────────────────────────────────────────────────
await test('com.directory: the estate\'s other Projects by name then id, listed capabilities and responder state only; unlisting is discovery only', () => {
  const page = call('board_directory', q(E), q(REQUESTER), 'null', 'null', 100)
  assert.equal(page.ok, true)
  assert.deepEqual(page.projects.map(p => p.name), ['analytics', 'finance'], 'own Project or another estate listed')
  const analytics = page.projects.find(p => p.id === RESPONDER)
  assert.deepEqual(analytics.capabilities.map(c => c.capability), [CAP2, CAP])
  assert.equal(analytics.capabilities.find(c => c.capability === CAP).responder, 'active')
  assert.deepEqual(Object.keys(analytics).sort(), ['capabilities', 'id', 'name'])
  assert.deepEqual(Object.keys(analytics.capabilities[0]).sort(), ['capability', 'responder'])
  const filtered = call('board_directory', q(E), q(REQUESTER), lit('finance.close'), 'null', 100)
  assert.deepEqual(filtered.projects.map(p => p.id), [THIRD])
  const first = call('board_directory', q(E), q(REQUESTER), 'null', 'null', 1)
  assert.equal(first.more, true); assert.equal(first.projects.length, 1)
  const second = call('board_directory', q(E), q(REQUESTER), 'null', q(first.last), 1)
  assert.deepEqual(second.projects.map(p => p.name), ['finance']); assert.equal(second.more, false)
  assert.equal(call('board_directory', q(E), q(REQUESTER), 'null', q(id(996)), 1).error?.code, 'cursor_reset_required')
  assert.equal(call('board_directory', q(E), q(FOREIGN), 'null', 'null', 10).error?.code, 'not_authorized', 'another estate\'s Project read this directory')
  // Unlisting: gone from every page and filter; still addressable by id; refuses no message.
  assert.equal(call('board_set_listing', q(E), q(THIRD), 'false', j(operator)).ok, true)
  assert.deepEqual(call('board_directory', q(E), q(REQUESTER), 'null', 'null', 100).projects.map(p => p.id), [RESPONDER])
  assert.deepEqual(call('board_directory', q(E), q(REQUESTER), lit('finance.close'), 'null', 100).projects, [])
  const toUnlisted = call('board_submit', q(E), q(REQUESTER), j(agent), j({ idempotency: idem(), thread: { new: { participants: [THIRD] } }, kind: 'message', body: { text: 'still reachable by id' } }), lit(digest()))
  assert.equal(toUnlisted.ok, true, 'an unlisted Project refused a message')
  assert.equal(call('board_set_listing', q(E), q(THIRD), 'false', j(agent)).error?.code, 'invalid_arguments', 'an agent unlisted a Project')
  refuses(`set role authenticated; select board_set_listing('${E}','${THIRD}',true,${j(operator)})`, /permission denied/)
})

// ── the restore: history, not authority (C7, COM03-12) ────────────────────────────────────────────────────
await test('a restored board: claimed → queued, in_progress → outcome_unknown, accepted held, no holder, the generation kept, epochs closed — and nothing appended', () => {
  // The source lives in a second database of this cluster: an estate restored beside its source collides on global ids.
  const url2 = url.replace(/(\/fabric_dispatch_test_[a-z0-9_]+)\?/, '$1_source?')
  const db = new URL(url2).pathname.slice(1)
  sql(`create database ${db}`)
  const args2 = [url2, ...psqlArgs.slice(1)]
  const sql2 = input => execFileSync('psql', args2, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  try {
    sql2(`do $$ begin create role anon; exception when duplicate_object then null; end $$;
      create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
      create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text);`)
    const dir = new URL('../../../supabase/migrations/', import.meta.url)
    for (const f of readdirSync(dir).filter(x => x.endsWith('.sql')).sort()) sql2(readFileSync(new URL(f, dir), 'utf8'))
    const S = id(700), S1 = id(701), S2 = id(702), T = id(710)
    const call2 = (fn, ...a) => JSON.parse(sql2(`set role service_role; select ${fn}(${a.join(',')})`))
    const app2 = (estate, type, payload, project = null, actor = system) =>
      sql2(`set role service_role; select seq from append_event('${estate}','${type}',${j(actor)},${j(payload)},'1',${project ? `'${project}'` : 'null'})`)
    app2(S, 'estate.created@1', { name: 'source', owner_person_id: id(93) })
    for (const [p, n] of [[S1, 'source requester'], [S2, 'source responder']]) app2(S, 'project.created@1', { id: p, name: n }, p)
    const SB2 = id(431), GS = id(631), RQ = id(531)
    app2(S, 'access.requested@1', { id: RQ, agent_id: 'codex', callee: 'fabric', capabilities: ['board.respond'], resources: [`board:${S2}/${CAP}`], reason: 'answer',
      registry: { key: 'codex', name: 'Codex', installed_by: 'a coding agent on this computer', repository: null }, binding_id: null, expires_at: later(10) }, null, { kind: 'system', id: 'fabric-hub' })
    app2(S, 'access.decided@1', { request_id: RQ, decision: 'allowed', binding_id: SB2, new_binding: true, grants: [{ id: GS, capability: 'board.respond', resource: `board:${S2}/${CAP}`, expires_at: later(525600) }] }, null, operator)
    const H = { session_id: id(360), came_in: 'enrolled', agent: 'codex', binding_id: SB2, label: 'Codex' }
    const sub = d => call2('board_submit', q(S), q(S1), j(agent), j({ idempotency: idem(), thread: { new: { participants: [S2] } }, kind: 'request', body: { text: 'restore me' }, request: { target: S2, capability: CAP } }), lit(d))
    const dc = digest(), da = digest(), dp = digest()
    const rc = sub(dc), ra = sub(da), rp = sub(dp)
    const sc = (fn, args) => call2(fn, q(S), j(H), q(S2), j(args), lit(digest()))
    assert.equal(sc('board_enroll', { idempotency: idem(), capability: CAP }).slot.generation, 1)
    const f = (c) => ({ request: c.request.id, generation: c.attempt.generation, attempt: c.attempt.id, digest: c.attempt.digest, idempotency: idem() })
    const cc = sc('board_claim', { idempotency: idem(), capability: CAP, request: rc.message })
    const ca = sc('board_claim', { idempotency: idem(), capability: CAP, request: ra.message })
    const cp = sc('board_claim', { idempotency: idem(), capability: CAP, request: rp.message })
    sc('board_accept', { fence: f(ca) }); sc('board_accept', { fence: f(cp) }); sc('board_effect_begin', { fence: f(cp) })
    void cc
    // An unlisting survives the restore (DEC-0073 §8).
    call2('board_set_listing', q(S), q(S1), 'false', j(operator))
    const journal = JSON.parse(sql2(`select jsonb_agg(jsonb_build_object('seq',seq,'type',type,'schema_rev',schema_rev,'actor',actor,'project_id',project_id,
      'run_id',run_id,'node_id',node_id,'payload',payload,'occurred_at',occurred_at) order by seq) from journal where estate_id='${S}'`))
    assert.equal(call('restore_estate', q(T), q(S), lit('restored responders'), j(journal)).restored, true)
    assert.equal(journalCount(T), journal.length, 'the restore appended to the archive\'s prefix')
    const st = rid => sql(`select state || '|' || effect from board_requests where estate_id='${T}' and message_id='${rid}'`)
    assert.equal(st(rc.message), 'queued|not_started'); assert.equal(st(ra.message), 'accepted|not_started'); assert.equal(st(rp.message), 'outcome_unknown|unknown')
    assert.equal(sql(`select generation || '|' || coalesce(holder_enrollment::text, 'none') from board_responder_slots where estate_id='${T}'`), '1|none')
    assert.equal(sql(`select count(*) from board_enrollments where estate_id='${T}' and released_seq is null`), '0')
    assert.equal(sql(`select count(*) from board_attempts where estate_id='${T}' and ended_seq is null`), '0')
    assert.equal(call('board_status', q(T), q(S2)).responders.find(x => x.capability === CAP).state, 'absent')
    // The restored Project's epoch is above any its source used (receipts did not travel): epoch 1 is refused.
    assert.ok(call('board_status', q(T), q(S1)).epoch >= 2)
    const old = call('board_submit', q(T), q(S1), j(agent), j({ idempotency: { epoch: 1, key: 'restored-key-1' }, thread: { new: { participants: [S2] } }, kind: 'message', body: { text: 'x' } }), lit(digest()))
    assert.equal(old.error?.code, 'idempotency_window_expired', JSON.stringify(old))
    assert.deepEqual(call('board_directory', q(T), q(S2), 'null', 'null', 10).projects, [], 'an unlisting did not survive the restore')
    // Authority stays off: the restored grant is history (migration 77), so no one enrolls on it.
    assert.equal(call('board_enroll', q(T), j(H), q(S2), j({ idempotency: idem(), capability: CAP }), lit(digest())).error?.code, 'not_authorized')
  } finally {
    sql(`drop database if exists ${db} with (force)`)
  }
})

// ── R-003: what no API role may do ────────────────────────────────────────────────────────────────────────
// ── the wave-2 fix round (ADR-0149 Amendment 2, migration 88): each seen red without migration 88 ───────────────
// Each case takes a fresh holder first: a slot lease is 60 s of database time, and under load the cases before these
// (the restore above all) outlast it — a case must not depend on how long the previous one took.
let freshN = 0
const freshHolder = () => {
  lapse()
  const H = { session_id: id(4000 + ++freshN), came_in: 'launched', agent: 'claude-code', binding_id: null, label: 'Claude Code' }
  const en = cmd('board_enroll', H, { idempotency: idem(), capability: CAP })
  assert.equal(en.ok, true, JSON.stringify(en))
  Object.assign(HB, H)
}
await test('fix 9: a replay of another session\'s key needs a live grant when the caller holds no enrollment', () => {
  freshHolder()
  const r = submitRequest()
  const c = cmd('board_claim', HB, { idempotency: idem(), capability: CAP, request: r.id })
  const args = { fence: fence(c) }, d = digest()
  assert.equal(cmd('board_accept', HB, args, d).request.state, 'accepted')
  assert.equal(cmd('board_accept', HB, args, d).repeated, true, 'the holder\'s own replay')
  const out = cmd('board_accept', HC, args, d)
  assert.equal(out.error?.code, 'not_authorized', `a session with no grant read another\'s stored receipt: ${JSON.stringify(out)}`)
})

await test('fix 8: the current holder on a request whose outcome became unknown meets reconcile_required, not fenced', () => {
  freshHolder()
  const r = submitRequest()
  const c = cmd('board_claim', HB, { idempotency: idem(), capability: CAP, request: r.id })
  cmd('board_accept', HB, { fence: fence(c) })
  assert.equal(cmd('board_effect_begin', HB, { fence: fence(c) }).request.state, 'in_progress')
  const cancelled = call('board_cancel', q(E), q(REQUESTER), j(agent), j({ idempotency: idem(), request: r.id }), lit(digest()))
  assert.equal(cancelled.request?.state, 'outcome_unknown', JSON.stringify(cancelled))
  for (const [fn, args] of [['board_complete', { fence: fence(c), outcome: { state: 'completed', observed: true } }], ['board_accept', { fence: fence(c) }]])
    assert.equal(cmd(fn, HB, args).error?.code, 'reconcile_required', fn)
  assert.equal(cmd('board_reconcile', HB, { idempotency: idem(), request: r.id, digest: r.digest, outcome: { state: 'completed', observed: true } }).request.state, 'completed')
})

await test('fix 5: renew and progress are refused under a CLOSED epoch (DEC-0073), a stored receipt still answers', () => {
  // THIRD's slot, so the rotation below leaves the other cases' epoch 1 alone.
  const rt = call('board_submit', q(E), q(REQUESTER), j(agent), j({ idempotency: idem(), thread: { new: { participants: [THIRD] } }, kind: 'request',
    body: { text: 'Close the books.' }, request: { target: THIRD, capability: 'finance.close' } }), lit(digest()))
  assert.equal(cmd('board_enroll', HD, { idempotency: idem(), capability: 'finance.close' }, digest(), THIRD).ok, true)
  const c = cmd('board_claim', HD, { idempotency: idem(), capability: 'finance.close', request: rt.message }, digest(), THIRD)
  assert.equal(c.request?.state, 'claimed', JSON.stringify(c))
  const accArgs = { fence: fence(c) }, accDigest = digest()
  assert.equal(cmd('board_accept', HD, accArgs, accDigest, THIRD).request.state, 'accepted')
  sql(`select board_rotate_epoch('${E}', '${THIRD}', 1, 'age')`)
  for (const [fn, args] of [['board_renew', { fence: fence(c) }], ['board_progress', { fence: fence(c), note: { text: 'half' } }]])
    assert.equal(cmd(fn, HD, args, digest(), THIRD).error?.code, 'idempotency_window_expired', `${fn} under a closed epoch`)
  assert.equal(cmd('board_accept', HD, accArgs, accDigest, THIRD).repeated, true, 'a stored receipt is still answered under a closed epoch')
  assert.equal(cmd('board_renew', HD, { fence: fence(c, { idempotency: { epoch: 2, key: key() } }) }, digest(), THIRD).ok, true, 'the current epoch renews')
})

await test('fix 6: no deadlock — a stale enroll races a cancel on a claimed request, a release of a two-slot session races a claim, 50 times each (no 40P01)', async () => {
  const deadlocks = []
  for (let i = 0; i < 50; i++) {
    freshHolder()
    const r = submitRequest()
    const c = cmd('board_claim', HB, { idempotency: idem(), capability: CAP, request: r.id })
    assert.equal(c.request?.state, 'claimed', JSON.stringify(c))
    lapse()
    const HN = { session_id: id(2000 + i), came_in: 'launched', agent: 'claude-code', binding_id: null, label: 'Claude Code' }
    const enroll = `set role service_role; select board_enroll('${E}',${j(HN)},'${RESPONDER}',${j({ idempotency: idem(), capability: CAP })},${lit(digest())});`
    const cancel = `set role service_role; select board_cancel('${E}','${REQUESTER}',${j(agent)},${j({ idempotency: idem(), request: r.id })},${lit(digest())});`
    const outs = await Promise.all([enroll, cancel].map(s => runPsqlAsync('psql', psqlArgs, s, { label: 'enroll vs cancel' })))
    for (const o of outs) if (/40P01|deadlock/i.test(o.stderr)) deadlocks.push(`enroll/cancel ${i}: ${o.stderr.trim().slice(0, 200)}`)
    for (const o of outs) assert.equal(o.code, 0, o.stderr)
  }
  for (let i = 0; i < 50; i++) {
    // A session holding two slots (CAP and CAP2, both granted to codex binding BB) is released while another session claims on the second.
    const HS = { session_id: id(3000 + i), came_in: 'enrolled', agent: 'codex', binding_id: BB, label: 'Codex' }
    lapse(CAP); lapse(CAP2)
    assert.equal(cmd('board_enroll', HS, { idempotency: idem(), capability: CAP }).ok, true)
    assert.equal(cmd('board_enroll', HS, { idempotency: idem(), capability: CAP2 }).ok, true)
    submitRequest({}, CAP2)
    const release = `set role service_role; select board_release_session('${E}', ${lit(HS.session_id)});`
    const claim = `set role service_role; select board_claim('${E}',${j(HS)},'${RESPONDER}',${j({ idempotency: idem(), capability: CAP2 })},${lit(digest())});`
    const outs = await Promise.all([release, claim].map(s => runPsqlAsync('psql', psqlArgs, s, { label: 'release vs claim' })))
    for (const o of outs) if (/40P01|deadlock/i.test(o.stderr)) deadlocks.push(`release/claim ${i}: ${o.stderr.trim().slice(0, 200)}`)
    for (const o of outs) assert.equal(o.code, 0, o.stderr)
  }
  assert.deepEqual(deadlocks, [], 'a deadlock was detected')
  // Leave a live holder on CAP for the cases below.
  const HL = { session_id: id(3999), came_in: 'launched', agent: 'claude-code', binding_id: null, label: 'Claude Code' }
  lapse(CAP); assert.equal(cmd('board_enroll', HL, { idempotency: idem(), capability: CAP }).ok, true)
  Object.assign(HB, HL)
})

await test('R-003: no API role touches the responder tables, appends a comms event or runs a helper', () => {
  for (const t of ['board_responder_slots', 'board_enrollments', 'board_attempts', 'board_progress_notes', 'board_directory_listings'])
    for (const role of ['anon', 'authenticated', 'service_role'])
      for (const p of ['select', 'insert', 'update', 'delete'])
        assert.equal(sql(`select has_table_privilege('${role}', '${t}', '${p}')`), 'f', `${role} may ${p} ${t}`)
  refuses(`set role service_role; select append_event('${E}','comms.responder_enrolled@1',${j(system)},${j({ enrollment_id: id(990) })})`, /Use the board commands/)
  refuses(`set role service_role; select append_event('${E}','comms.directory_listing_set@1',${j(system)},${j({ project_id: THIRD, listed: true })})`, /Use the board commands/)
  for (const fn of ['board_fence(uuid, jsonb, uuid, jsonb, text, text)', 'board_grant_for(uuid, jsonb, uuid, text)', 'board_move(uuid, uuid, text, text, text, text, jsonb, jsonb)',
    'board_release(uuid, text, text, text)', 'board_replacement_effects(uuid, uuid, text, bigint, text, jsonb)', 'apply_comms_responders(journal)'])
    assert.equal(sql(`select has_function_privilege('service_role', '${fn}', 'execute')`), 'f', `service_role may run ${fn}`)
  for (const fn of ['board_enroll(uuid, jsonb, uuid, jsonb, text)', 'board_claim(uuid, jsonb, uuid, jsonb, text)', 'board_directory(uuid, uuid, text, uuid, integer)'])
    for (const role of ['anon', 'authenticated'])
      assert.equal(sql(`select has_function_privilege('${role}', '${fn}', 'execute')`), 'f', `${role} may run ${fn}`)
  assert.equal(sql(`select string_agg(relname || '=' || relrowsecurity, ',' order by relname) from pg_class where relname in ('board_responder_slots','board_enrollments','board_attempts','board_progress_notes','board_directory_listings')`),
    'board_attempts=true,board_directory_listings=true,board_enrollments=true,board_progress_notes=true,board_responder_slots=true')
})

await test('a rebuild replays to the same responder projection (replay-safe)', () => {
  const snap = () => sql(`select md5(string_agg(x, ',' order by x)) from (
    select project_id || capability || generation || coalesce(holder_enrollment::text,'') as x from board_responder_slots where estate_id='${E}'
    union all select id || coalesce(released_cause,'') from board_enrollments where estate_id='${E}'
    union all select id || coalesce(ended_cause,'') from board_attempts where estate_id='${E}'
    union all select message_id || state || effect || revision || coalesce(attempt_id::text,'') from board_requests where estate_id='${E}') q`)
  const before = snap()
  sql(`select rebuild_estate_projections('${E}')`)
  assert.equal(snap(), before)
})

// #endregion project-board-responders
console.log(`${count} passed, ${failed.length} failed`)
if (failed.length) process.exit(1)
