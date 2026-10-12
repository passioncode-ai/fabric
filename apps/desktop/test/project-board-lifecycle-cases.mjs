// Migration 86 (suffix 103) — the project board's lifecycle, COM-02.3 (ADR-0149), on the fully migrated chain.
// Driven by project-board-db.test.mjs, which owns the cluster and hands over its helpers. Each case names the
// requirement it holds (spec §5, project-board-db rows 1–11).
// To WATCH these fail, run run-project-board-db.mjs with FABRIC_SKIP_MIGRATION=20261012000103_project_board_lifecycle.sql.
// #region project-board-lifecycle — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#decision
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { runPsqlAsync } from './bounded-psql.mjs'

export async function run(h) {
  const { sql, refuses, test, url, psqlArgs, id, A, PA1, PA2, PA3, j, lit, agent, digest, append, submit, get, ack, status, events, key, request, message } = h
  const rpc = (fn, ...args) => JSON.parse(sql(`set role service_role; select ${fn}(${args.join(',')})`))
  const q = v => `'${v}'`
  const reply = (estate, sender, body, d) => rpc('board_reply', q(estate), q(sender), j(agent()), j(body), lit(d))
  const cancel = (estate, caller, body, d) => rpc('board_cancel', q(estate), q(caller), j(agent()), j(body), lit(d))
  const tick = estate => rpc('board_tick', q(estate))
  const state = m => sql(`select state||':'||effect||':'||revision from board_requests where estate_id='${A}' and message_id='${m}'`)
  const setState = (m, s, effect = 'not_started') => sql(`update board_requests set state='${s}', effect='${effect}' where estate_id='${A}' and message_id='${m}'`)
  const ep = (project, extra = '') => sql(`select epoch||':'||state||':'||keys from board_epochs where estate_id='${A}' and project_id='${project}' ${extra} order by epoch`)
  const idem = (epoch) => ({ epoch, key: key() })

  // Projects of their own, so these cases never move an epoch the earlier ones write under.
  const PE = id(14), PF = id(15), PG = id(16), PX = id(17)
  for (const [p, name] of [[PE, 'epochs'], [PF, 'aging'], [PG, 'cancels'], [PX, 'archived soon']])
    append(A, 'project.created@1', { id: p, name }, p)

  await test('A7-018: an archived Project cannot get, mark read or read status, and no read mark is appended', () => {
    const t = submit(A, PA1, { idempotency: idem(1), thread: { new: { participants: [PX] } }, kind: 'message', body: { text: 'before archiving' } }, digest(1001))
    assert.equal(t.ok, true, JSON.stringify(t))
    assert.equal(get(A, PX, t.message).ok, true, 'readable while active')
    append(A, 'project.archived@1', { id: PX }, PX)
    const acks = events(A, 'comms.read_acked@1')
    for (const r of [get(A, PX, t.message), ack(A, PX, t.message), status(A, PX)]) {
      assert.equal(r.error?.code, 'not_authorized', JSON.stringify(r))
      assert.equal(r.error.message, 'This Project may not read the board.')
    }
    assert.equal(events(A, 'comms.read_acked@1'), acks, 'an archived Project appended a read mark')
  })

  await test('A7-024: board_requests is keyed by (estate_id, message_id), has no foreign key to messages, and a rebuild is a no-op', () => {
    assert.equal(sql(`select string_agg(a.attname, ',' order by array_position(i.indkey::int2[], a.attnum)) from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey) where i.indrelid = 'board_requests'::regclass and i.indisprimary`), 'estate_id,message_id')
    assert.equal(sql(`select count(*) from pg_constraint where conrelid = 'board_requests'::regclass and contype = 'f'`), '0')
    const snap = () => sql(`select string_agg(message_id||':'||state||':'||revision||':'||updated_seq, ',' order by message_id) from board_requests where estate_id='${A}'`)
    const before = snap()
    sql(`select rebuild_estate_projections('${A}')`)
    assert.equal(snap(), before)
  })

  let rq, rqThread
  await test('C3: no receipt carries the estate seq — submit, reply, cancel, read mark and every stored receipt', () => {
    const s = submit(A, PA1, request(PA2, [PA2]), digest(1010))
    rq = s.message; rqThread = s.thread
    const r = reply(A, PA2, { idempotency: idem(1), replyTo: rq, body: { text: 'on it' } }, digest(1011))
    const c = cancel(A, PA1, { idempotency: idem(1), request: rq }, digest(1012))
    const a = ack(A, PA2, rq)
    for (const x of [s, r, c, a]) {
      assert.equal(x.ok, true, JSON.stringify(x))
      assert.equal(JSON.stringify(x).includes('"seq"'), false, `a receipt carries seq: ${JSON.stringify(x)}`)
    }
    assert.equal(sql(`select count(*) from board_idempotency where receipt ? 'seq'`), '0', 'a stored receipt carries seq')
    assert.equal(sql(`select count(*) from board_idempotency where jsonb_typeof(receipt->'request') = 'string'`), '0', 'a stored request is still an id')
  })

  await test('R2: a receipt stored in migration 81\'s shape (seq, request as an id) is replayed in the new shape, the request read from its current row', () => {
    const K = 'legacy-key-0001', D = digest(1099)
    const old = { ok: true, message: rq, thread: rqThread, seq: 5, at: '2026-10-05T07:00:00.123456+00:00', request: rq, repeated: false }
    sql(`insert into board_idempotency values ('${A}','${PA1}','submit',1,'${K}',${lit(D)},${j(old)})`)
    const replayed = submit(A, PA1, { idempotency: { epoch: 1, key: K }, thread: { id: rqThread }, kind: 'message', body: { text: 'any' } }, D)
    assert.equal(replayed.repeated, true, JSON.stringify(replayed)); assert.equal('seq' in replayed, false)
    const [st, ef, rev] = state(rq).split(':')
    assert.deepEqual(replayed.request, { id: rq, state: st, effect: ef, revision: Number(rev) })
    assert.equal(replayed.at, '2026-10-05T07:00:00.123Z')
    const plain = { ...old, request: null }
    sql(`insert into board_idempotency values ('${A}','${PA1}','submit',1,'legacy-key-0002',${lit(digest(1098))},${j(plain)})`)
    const noRequest = submit(A, PA1, { idempotency: { epoch: 1, key: 'legacy-key-0002' }, thread: { id: rqThread }, kind: 'message', body: { text: 'any' } }, digest(1098))
    assert.equal('request' in noRequest, false, 'a message that is no request carries no request')
  })

  await test('DEC-0073: a read mark answers when it was first made — a second com.read_ack is repeated:true with the first mark\'s at', () => {
    const m = submit(A, PA1, message(rqThread), digest(1090)).message
    const first = ack(A, PA2, m)
    assert.equal(first.repeated, false, JSON.stringify(first)); assert.match(first.at ?? '', /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
    const markedAt = sql(`select to_char(j.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from board_read_marks r join journal j
      on j.estate_id = r.estate_id and j.seq = r.seq where r.estate_id='${A}' and r.reader_project='${PA2}' and r.message_id='${m}'`)
    assert.equal(first.at, markedAt, 'the first receipt is not the mark\'s time')
    sql(`select pg_sleep(0.01)`)
    const again = ack(A, PA2, m)
    assert.deepEqual(again, { ...first, repeated: true }, 'the repeat is not the first mark')
  })

  await test('com.reply: a reply lands in the thread of what it answers; the same key repeats; a foreign or absent message is refused alike', () => {
    const body = { idempotency: idem(1), replyTo: rq, body: { text: 'the numbers are attached', format: 'text/markdown' } }
    const first = reply(A, PA2, body, digest(1020))
    assert.equal(first.ok, true, JSON.stringify(first)); assert.equal(first.thread, rqThread)
    const m = get(A, PA1, first.message).message
    assert.equal(m.kind, 'reply'); assert.equal(m.replyTo, rq); assert.equal(m.body.format, 'text/markdown')
    const payload = JSON.parse(sql(`select payload from journal where estate_id='${A}' and payload->>'message_id'='${first.message}'`))
    assert.equal(payload.operation, 'com.reply')
    const before = events(A, 'comms.message_submitted@1')
    const again = reply(A, PA2, body, digest(1020))
    assert.equal(again.repeated, true); assert.equal(again.message, first.message)
    assert.equal(events(A, 'comms.message_submitted@1'), before, 'a repeat appended')
    assert.equal(reply(A, PA2, body, digest(1021)).error.code, 'idempotency_conflict')
    const foreign = reply(A, PA3, { idempotency: idem(1), replyTo: rq, body: { text: 'x' } }, digest(1022))
    const absent = reply(A, PA3, { idempotency: idem(1), replyTo: id(9999), body: { text: 'x' } }, digest(1023))
    assert.equal(foreign.error.code, 'not_authorized'); assert.deepEqual(foreign.error, absent.error)
    assert.equal(reply(A, PA2, { ...body, idempotency: idem(1), thread: { id: rqThread } }, digest(1024)).error.code, 'invalid_arguments', 'an undeclared field')
    assert.equal(get(A, PA1, rq).message.request.state, 'cancelled', 'a reply changed the request')
  })

  await test('com.cancel: only the requester; each state to its outcome; outcome_unknown needs reconcile; a terminal request is refused', () => {
    const fresh = () => submit(A, PG, request(PA2, [PA2]), digest(1100 + Math.floor(Math.random() * 1e6))).message
    const r1 = fresh()
    const notMine = cancel(A, PA2, { idempotency: idem(1), request: r1 }, digest(1030))
    assert.equal(notMine.error.code, 'not_authorized'); assert.equal(notMine.error.message, 'This Project cannot cancel that request.')
    assert.deepEqual(cancel(A, PA2, { idempotency: idem(1), request: id(8888) }, digest(1031)).error, notMine.error, 'absent and not-yours answer alike')
    assert.equal(cancel(A, PG, { idempotency: idem(1), request: r1, expectedRevision: 7 }, digest(1032)).error.code, 'revision_conflict')
    const body = { idempotency: idem(1), request: r1, expectedRevision: 1, reason: 'no longer needed' }
    const done = cancel(A, PG, body, digest(1033))
    assert.deepEqual(done.request, { id: r1, state: 'cancelled', effect: 'not_started', revision: 2 }, JSON.stringify(done))
    assert.equal(state(r1), 'cancelled:not_started:2')
    assert.equal(cancel(A, PG, body, digest(1033)).repeated, true, 'a retry is the same act')
    assert.equal(sql(`select summary from board_outcomes where estate_id='${A}' and request_id='${r1}'`), 'no longer needed')
    const payload = sql(`select payload::text from journal where estate_id='${A}' and type='comms.request_transitioned@1' and payload->>'request_id'='${r1}'`)
    assert.equal(payload.includes('no longer needed'), false, 'the reason reached the journal')
    assert.equal(cancel(A, PG, { idempotency: idem(1), request: r1 }, digest(1034)).error.code, 'invalid_transition')
    for (const s of ['claimed', 'accepted']) {
      const r = fresh(); setState(r, s)
      assert.equal(cancel(A, PG, { idempotency: idem(1), request: r }, digest(1040 + s.length)).request.state, 'cancelled', s)
    }
    const running = fresh(); setState(running, 'in_progress', 'started')
    const unknown = cancel(A, PG, { idempotency: idem(1), request: running }, digest(1050))
    assert.equal(unknown.request.state, 'outcome_unknown'); assert.equal(unknown.request.effect, 'unknown')
    assert.equal(cancel(A, PG, { idempotency: idem(1), request: running }, digest(1051)).error.code, 'reconcile_required')
    for (const s of ['completed', 'failed_known', 'expired']) {
      const r = fresh(); setState(r, s)
      assert.equal(cancel(A, PG, { idempotency: idem(1), request: r }, digest(1060 + s.length)).error.code, 'invalid_transition', s)
    }
  })

  await test('deadline expiry: the tick expires a queued request past its deadline and holds an accepted one (C4)', () => {
    const past = '2020-01-01T00:00:00Z'
    const late = submit(A, PG, request(PA2, [PA2], { request: { target: PA2, capability: 'analytics.retention', deadline: past } }), digest(1070)).message
    const held = submit(A, PG, request(PA2, [PA2], { request: { target: PA2, capability: 'analytics.retention', deadline: past } }), digest(1071)).message
    const open = submit(A, PG, request(PA2, [PA2]), digest(1072)).message
    setState(held, 'accepted')
    const t = tick(A)
    assert.equal(t.ok, true, JSON.stringify(t)); assert.ok(t.expired >= 1)
    assert.equal(state(late), 'expired:not_started:2')
    assert.equal(state(held).split(':')[0], 'accepted', 'an accepted request was expired')
    assert.equal(state(open).split(':')[0], 'queued')
    const ev = JSON.parse(sql(`select payload from journal where estate_id='${A}' and type='comms.request_transitioned@1' and payload->>'request_id'='${late}'`))
    assert.equal(ev.op, 'expire'); assert.equal(ev.cause, 'deadline'); assert.equal(ev.from, 'queued')
    assert.equal(tick(A).expired, 0, 'a second pass expired something again')
  })

  await test('A7-019/C6: a full epoch rotates and refuses; a closed epoch repeats old keys only; retirement compacts and then refuses', () => {
    const first = { idempotency: idem(1), thread: { new: { participants: [PA2] } }, kind: 'finding', body: { text: 'epoch one' } }
    const kept = submit(A, PE, first, digest(1200))
    assert.equal(kept.ok, true)
    assert.equal(status(A, PE).epoch, 1)
    sql(`update board_epochs set keys = board_epoch_capacity() where estate_id='${A}' and project_id='${PE}' and state='open'`)
    const rotations = events(A, 'comms.epoch_rotated@1')
    const full = submit(A, PE, { ...first, idempotency: idem(1) }, digest(1201))
    assert.equal(full.error?.code, 'capacity_exceeded', JSON.stringify(full)); assert.equal(full.error.retryable, true)
    assert.match(full.error.message, /opened epoch 2/)
    assert.equal(events(A, 'comms.epoch_rotated@1'), rotations + 1)
    assert.equal(status(A, PE).epoch, 2)
    assert.equal(submit(A, PE, { ...first, idempotency: idem(1) }, digest(1202)).error.code, 'idempotency_window_expired', 'a new key in the closed epoch')
    const repeat = submit(A, PE, first, digest(1200))
    assert.equal(repeat.repeated, true, JSON.stringify(repeat)); assert.equal(repeat.message, kept.message)
    assert.equal(submit(A, PE, { ...first, idempotency: idem(2) }, digest(1203)).ok, true, 'the new epoch takes a new key')
    assert.equal(submit(A, PE, { ...first, idempotency: idem(3) }, digest(1204)).error.code, 'invalid_arguments', 'an epoch not issued yet')
    // Thirty days after it closed (the owner moves the clock of this row, nothing else).
    sql(`update board_epochs set closed_at = clock_timestamp() - interval '31 days' where estate_id='${A}' and project_id='${PE}' and epoch = 1`)
    const receipts = Number(sql(`select count(*) from board_idempotency where estate_id='${A}' and sender_project='${PE}' and epoch = 1`))
    assert.ok(receipts >= 1)
    const t = tick(A)
    assert.equal(t.retired, 1, JSON.stringify(t)); assert.equal(t.receipts_compacted, receipts)
    assert.equal(sql(`select count(*) from board_idempotency where estate_id='${A}' and sender_project='${PE}' and epoch = 1`), '0')
    assert.equal(ep(PE, 'and epoch = 1'), '1:retired:' + ep(PE, 'and epoch = 1').split(':')[2])
    const receipt = JSON.parse(sql(`select payload from journal where estate_id='${A}' and type='comms.retention_applied@1' order by seq desc limit 1`))
    assert.deepEqual(receipt.retired, [{ project_id: PE, epoch: 1 }]); assert.equal(receipt.policy.bodies, 'kept-until-redacted')
    assert.equal(submit(A, PE, first, digest(1200)).error.code, 'idempotency_window_expired', 'a retired epoch answered a receipt')
    assert.equal(get(A, PA2, kept.message).message.body.text, 'epoch one', 'retention deleted a body')
    assert.equal(tick(A).retired, 0, 'an idle pass retired again')
  })

  await test('rotation by age and at 90 % capacity happens in the tick, as an event', () => {
    submit(A, PF, { idempotency: idem(1), thread: { new: { participants: [PA2] } }, kind: 'message', body: { text: 'aging' } }, digest(1300))
    sql(`update board_epochs set opened_at = clock_timestamp() - interval '31 days' where estate_id='${A}' and project_id='${PF}' and state='open'`)
    const t = tick(A)
    assert.ok(t.rotated >= 1, JSON.stringify(t))
    assert.equal(status(A, PF).epoch, 2)
    const ev = JSON.parse(sql(`select payload from journal where estate_id='${A}' and type='comms.epoch_rotated@1' and payload->>'project_id'='${PF}'`))
    assert.equal(ev.cause, 'age'); assert.equal(ev.closed_epoch, 1); assert.equal(ev.opened_epoch, 2)
    sql(`update board_epochs set keys = 90000 where estate_id='${A}' and project_id='${PF}' and state='open'`)
    tick(A)
    assert.equal(status(A, PF).epoch, 3)
    assert.equal(JSON.parse(sql(`select payload from journal where estate_id='${A}' and type='comms.epoch_rotated@1' and payload->>'project_id'='${PF}' order by seq desc limit 1`)).cause, 'capacity')
    const snap = () => sql(`select string_agg(project_id||':'||epoch||':'||state, ',' order by project_id, epoch) from board_epochs where estate_id='${A}' and project_id in ('${PE}','${PF}')`)
    const before = snap()
    sql(`select rebuild_estate_projections('${A}')`)
    assert.equal(snap(), before, 'a replay moved the epochs')
  })

  await test('the outbox: one row per comms event in the same transaction; a failure rolls back both; cursors move by compare-and-swap', async () => {
    const count = () => sql(`select (select count(*) from journal where estate_id='${A}' and type like 'comms.%' and seq >= (select min(seq) from board_outbox where estate_id='${A}'))
                             ||'|'|| (select count(*) from board_outbox where estate_id='${A}')`)
    const [ev, ob] = count().split('|').map(Number)
    assert.equal(ev, ob, 'an event without its outbox row, or the reverse')
    assert.equal(sql(`select count(*) from board_outbox o where o.estate_id='${A}' and not exists
      (select 1 from journal e where e.estate_id = o.estate_id and e.seq = o.seq and e.type = o.event_type)`), '0')
    const before = count()
    const r = await runPsqlAsync('psql', psqlArgs, `set role service_role; begin; select board_submit('${A}','${PA1}',${j(agent())},${j(message(rqThread))},${lit(digest(1400))}); select 1/0; commit;`, { label: 'induced failure' })
    assert.notEqual(r.code, 0, 'the induced failure did not fail')
    assert.equal(count(), before, 'a rolled-back submit left an event or an outbox row')
    const page = rpc('board_outbox_read', q(A), lit('mirror-probe'), 0, 5)
    assert.equal(page.ok, true); assert.equal(page.entries.length, 5); assert.equal(page.more, true)
    assert.deepEqual(page.cursor, { last_seq: 0, revision: 0 })
    assert.equal(JSON.stringify(page).includes('epoch one'), false)
    const to = page.entries[2].seq
    assert.equal(rpc('board_outbox_advance', q(A), lit('mirror-probe'), 0, to).revision, 1)
    assert.equal(rpc('board_outbox_advance', q(A), lit('mirror-probe'), 0, to).error.code, 'revision_conflict', 'a stale revision moved the cursor')
    assert.equal(rpc('board_outbox_advance', q(A), lit('mirror-probe'), 1, to - 1).error.code, 'invalid_arguments', 'a cursor moved backwards')
    assert.equal(rpc('board_outbox_advance', q(A), lit('Not A Consumer'), 0, 1).error.code, 'invalid_arguments')
    // Retention: entries older than 7 days go only once every cursor has passed them.
    sql(`update board_outbox set created_at = clock_timestamp() - interval '8 days' where estate_id='${A}'`)
    const passed = Number(sql(`select count(*) from board_outbox where estate_id='${A}' and seq <= ${to}`))
    const t = tick(A)
    assert.equal(t.outbox_compacted, passed, JSON.stringify(t))
    assert.equal(JSON.parse(sql(`select payload from journal where estate_id='${A}' and type='comms.retention_applied@1' order by seq desc limit 1`)).outbox_compacted, passed)
    assert.equal(sql(`select count(*) from board_outbox where estate_id='${A}' and seq <= ${to}`), '0')
    assert.ok(Number(sql(`select count(*) from board_outbox where estate_id='${A}' and seq > ${to}`)) > 0, 'an entry the cursor has not passed was deleted')
  })

  await test('deliveries: every participant but the sender, projected per message and equal to the backfill', () => {
    const m = submit(A, PA1, message(rqThread), digest(1500)).message
    assert.equal(sql(`select string_agg(recipient_project::text, ',') from board_deliveries where estate_id='${A}' and message_id='${m}'`), PA2)
    const snap = () => sql(`select md5(string_agg(message_id||':'||recipient_project||':'||seq||':'||is_request||':'||coalesce(capability,''), ',' order by message_id, recipient_project)) from board_deliveries where estate_id='${A}'`)
    const before = snap()
    sql(`delete from board_deliveries where estate_id='${A}'; select board_backfill_deliveries('${A}')`)
    assert.equal(snap(), before, 'the backfill and the projection disagree')
    const n = status(A, PA2).unread
    ack(A, PA2, m)
    assert.equal(status(A, PA2).unread, n - 1)
  })

  await test('R-003: no API role reaches the new tables; comms events only through the commands; helpers are not executable', () => {
    for (const role of ['anon', 'authenticated', 'service_role'])
      for (const t of ['board_epochs', 'board_outcomes', 'board_deliveries', 'board_outbox', 'board_consumer_cursors']) {
        refuses(`set role ${role}; select count(*) from ${t}`, /permission denied/)
        refuses(`set role ${role}; delete from ${t}`, /permission denied/)
        refuses(`set role ${role}; update ${t} set estate_id = estate_id`, /permission denied/)
      }
    refuses(`set role service_role; insert into board_outbox (estate_id, seq, event_type) values ('${A}', 999999, 'comms.x')`, /permission denied/)
    refuses(`set role service_role; insert into board_consumer_cursors values ('${A}', 'forged', 0, 1)`, /permission denied/)
    for (const type of ['comms.request_transitioned@1', 'comms.epoch_rotated@1', 'comms.retention_applied@1'])
      refuses(`set role service_role; select append_event('${A}','${type}',${j({ kind: 'system', id: 'probe' })},${j({ request_id: id(500) })})`, /Use the board commands/)
    for (const call of [`board_epoch_gate('${A}','${PA1}','submit',1,'key-probe-1',${lit(digest(1))},true)`,
      `board_store_receipt('${A}','${PA1}','submit',1,'key-probe-1',${lit(digest(1))},'{}'::jsonb)`,
      `board_transition('${A}','${rq}','cancel','cancelled','not_started','requester','{}'::jsonb)`,
      `board_rotate_epoch('${A}','${PA1}',1,'capacity')`, `board_current_epoch('${A}','${PA1}')`, `board_backfill_deliveries(null)`,
      `board_responders_json('${A}','${PA1}')`])
      for (const role of ['service_role', 'authenticated', 'anon'])
        refuses(`set role ${role}; select ${call}`, /permission denied/)
    for (const role of ['authenticated', 'anon'])
      for (const call of [`board_status('${A}','${PA1}')`, `board_tick('${A}')`, `board_cancel('${A}','${PA1}',${j(agent())},'{}'::jsonb,${lit(digest(1))})`,
        `board_history_export('${A}', 1)`, `restore_board_history('${A}','{}'::jsonb)`, `board_outbox_read('${A}','x-consumer',0,1)`])
        refuses(`set role ${role}; select ${call}`, /permission denied/)
    refuses(`update board_outcomes set summary = 'x'`, /immutable/)
    refuses(`delete from board_idempotency where estate_id='${A}'`, /immutable/)
  })

  await test('CO-212: history export → restore_estate → restore_board_history round trip; a mismatch and a second call are refused', () => {
    // The source lives in a second database of this cluster: an estate restored beside its source collides on
    // global ids, which restore_estate refuses (and the restore below would refuse with `collides`).
    const url2 = url.replace(/(\/fabric_dispatch_test_[a-z0-9_]+)\?/, '$1_source?')
    const db = new URL(url2).pathname.slice(1)
    sql(`create database ${db}`)
    const args2 = [url2, ...psqlArgs.slice(1)]
    const sql2 = input => execFileSync('psql', args2, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    sql2(`create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
      create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text);`)
    const dir = new URL('../../../supabase/migrations/', import.meta.url)
    const files = readdirSync(dir).filter(x => x.endsWith('.sql')).sort()
    const apply = f => { sql2(readFileSync(new URL(f, dir), 'utf8')); sql2(`insert into supabase_migrations.schema_migrations values ('${f.split('_')[0]}')`) }
    const S = id(700), S1 = id(701), S2 = id(702), T = id(710), NOT_RESTORED = id(711), U0 = id(720), U1 = id(721), U2 = id(722)
    const rpc2 = (fn, ...a) => JSON.parse(sql2(`set role service_role; select ${fn}(${a.join(',')})`))
    // R2 on the upgrade path: a receipt migration 81's board_submit stored before migration 86 is replayed in the new shape.
    for (const f of files.filter(x => x < '20261012000103')) apply(f)
    sql2(`set role service_role; select append_event('${U0}','estate.created@1',${j({ kind: 'system', id: 'probe' })},${j({ name: 'upgrade' })})`)
    for (const p of [U1, U2]) sql2(`set role service_role; select append_event('${U0}','project.created@1',${j({ kind: 'system', id: 'probe' })},${j({ id: p, name: 'p' + p.slice(-2) })},'1','${p}')`)
    const legacyBody = { idempotency: { epoch: 1, key: 'upgrade-key-01' }, thread: { new: { participants: [U2] } }, kind: 'request', body: { text: 'before 86' }, request: { target: U2, capability: 'analytics.retention' } }
    const legacy = rpc2('board_submit', q(U0), q(U1), j(agent()), j(legacyBody), lit(digest(1700)))
    assert.equal(typeof legacy.seq, 'number', 'migration 81 stored seq — the shape under test')
    for (const f of files.filter(x => x >= '20261012000103')) apply(f)
    assert.equal(sql2(`select count(*) from board_idempotency where receipt ? 'seq'`), '0', 'the upgrade left a receipt carrying seq')
    const upgraded = rpc2('board_submit', q(U0), q(U1), j(agent()), j(legacyBody), lit(digest(1700)))
    assert.equal(upgraded.repeated, true); assert.equal('seq' in upgraded, false)
    assert.deepEqual(upgraded.request, { id: legacy.message, state: 'queued', effect: 'not_started', revision: 1 })
    assert.match(upgraded.at, /Z$/)
    sql2(`set role service_role; select append_event('${S}','estate.created@1',${j({ kind: 'system', id: 'probe' })},${j({ name: 'source' })})`)
    for (const [p, n] of [[S1, 'source one'], [S2, 'source two']])
      sql2(`set role service_role; select append_event('${S}','project.created@1',${j({ kind: 'system', id: 'probe' })},${j({ id: p, name: n })},'1','${p}')`)
    const sub = (body, d) => rpc2('board_submit', q(S), q(S1), j(agent()), j(body), lit(d))
    const asked = sub({ idempotency: idem(1), thread: { new: { participants: [S2], subject: 'Restored thread' } }, kind: 'request', body: { text: 'restore me' }, request: { target: S2, capability: 'analytics.retention' } }, digest(1600))
    const answered = rpc2('board_reply', q(S), q(S2), j(agent()), j({ idempotency: idem(1), replyTo: asked.message, body: { text: 'restored answer' } }), lit(digest(1601)))
    const secret = sub({ idempotency: idem(1), thread: { id: asked.thread }, kind: 'message', body: { text: 'redacted before export' } }, digest(1602))
    rpc2('board_cancel', q(S), q(S1), j(agent()), j({ idempotency: idem(1), request: asked.message, reason: 'done elsewhere' }), lit(digest(1603)))
    sql2(`delete from board_bodies where message_id='${secret.message}'`)   // the redaction path: the body row only
    const late = sub({ idempotency: idem(1), thread: { id: asked.thread }, kind: 'message', body: { text: 'after the watermark' } }, digest(1604))
    const lateSeq = Number(sql2(`select seq from board_messages where id='${late.message}'`))
    const history = rpc2('board_history_export', q(S), lateSeq - 1)
    assert.equal(history.schema, 'FabricBoardHistory@1')
    assert.equal(history.messages.length, 3); assert.equal(history.messages.find(m => m.id === secret.message).redacted, true)
    assert.equal(history.messages.some(m => m.id === late.message), false, 'a message past the watermark was exported')
    const journal = JSON.parse(sql2(`select jsonb_agg(jsonb_build_object('seq',seq,'type',type,'schema_rev',schema_rev,'actor',actor,'project_id',project_id,
      'run_id',run_id,'node_id',node_id,'payload',payload,'occurred_at',occurred_at) order by seq) from journal where estate_id='${S}'`))
    assert.equal(rpc('restore_estate', q(T), q(S), lit('restored board'), j(journal)).restored, true)
    assert.equal(rpc('restore_board_history', q(NOT_RESTORED), j(history)).reason_code, 'not_restored')
    const tampered = structuredClone(history); tampered.messages[0].digest = digest(4242)
    const refused = rpc('restore_board_history', q(T), j(tampered))
    assert.equal(refused.reason_code, 'integrity_mismatch', JSON.stringify(refused))
    assert.equal(sql(`select count(*) from board_messages where estate_id='${T}'`), '0', 'a refused restore inserted rows')
    const done = rpc('restore_board_history', q(T), j(history))
    assert.equal(done.ok, true, JSON.stringify(done))
    assert.deepEqual([done.threads, done.messages, done.bodies, done.redacted, done.missing, done.outcomes], [1, 3, 2, 1, 1, 1])
    assert.equal(get(T, S2, asked.message).message.body.text, 'restore me')
    assert.equal(get(T, S2, asked.message).message.request.state, 'cancelled', 'the request state is the journal\'s')
    assert.equal(get(T, S1, answered.message).message.body.text, 'restored answer')
    assert.equal(get(T, S2, secret.message).message.redacted, true, 'a redacted body came back')
    assert.equal(get(T, S2, late.message).error.code, 'not_authorized', 'a message missing from the archive was invented')
    assert.equal(sql(`select summary from board_outcomes where estate_id='${T}'`), 'done elsewhere')
    assert.ok(status(T, S2).unread >= 2, 'the deliveries were not rebuilt')
    assert.equal(sql(`select count(*) from journal where estate_id='${T}'`), String(journal.length), 'the history restore appended to the restored prefix')
    assert.equal(rpc('restore_board_history', q(T), j(history)).reason_code, 'already_restored')
    sql(`drop database ${db}`)
  })
}
// #endregion project-board-lifecycle
