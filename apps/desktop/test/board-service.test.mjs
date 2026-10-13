// COM-02.2 — the participant half of the project board (ADR-0117), without a database: the SQL door is a fake
// that records every call, so "refused before anything is stored" is observable as "the door was never called".
// #region project-board-service — docs: docs/adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md#3-who-may-take-part-is-a-separate-grant-from-who-may-call-a-product
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createBoard, commsCanonical, commsDigest, commsSubmitSchema, CommsCanonicalError } from '../src/main/boardService.ts'
import { compileCommsValidators, loadPinnedFixtures } from './contract-consumer-fixtures.mjs'

const fixtures = loadPinnedFixtures()
const validators = compileCommsValidators(fixtures)
const catalogue = fixtures.document('current/catalogue.json')
const caller = { estateId: '79000000-0000-4000-8000-000000000001', projectId: '79000000-0000-4000-8000-000000000011', principal: { kind: 'agent', id: 'session-1', label: 'Claude Code', provenance: 'trusted' } }
const fake = (answers = {}) => {
  const calls = []
  const rpc = async (fn, args) => { calls.push({ fn, args }); const a = answers[fn]; if (a instanceof Error) throw a; return typeof a === 'function' ? a(args) : (a ?? { data: null, error: { message: 'no answer' } }) }
  return { rpc, calls }
}
const submitRequest = fixtures.document('current/positive/comms-submit-request.json')

test('canonical JSON: sorted keys, integers only, no lone surrogate, no undefined', () => {
  assert.equal(commsCanonical({ b: 1, a: [true, null, 'x'], c: { z: 0, y: -2 } }), '{"a":[true,null,"x"],"b":1,"c":{"y":-2,"z":0}}')
  assert.equal(commsCanonical(Number.MAX_SAFE_INTEGER), '9007199254740991')
  for (const bad of [1.5, 2 ** 53, NaN, Infinity, '\ud800', 'a\udc00b', { a: undefined }, () => 1, 10n])
    assert.throws(() => commsCanonical(bad), CommsCanonicalError, String(bad))
  assert.equal(commsCanonical('é😀'), '"é😀"', 'a paired surrogate and non-ASCII pass unnormalised')
})

test('the digest is the contract\'s framing over canonical JSON, one value however it was spelled', () => {
  const d = commsDigest('com.submit', submitRequest)
  assert.match(d, /^sha256:[0-9a-f]{64}$/)
  const reverse = v => Array.isArray(v) ? v.map(reverse) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map(k => [k, reverse(v[k])])) : v
  const respelled = reverse(submitRequest)
  assert.notEqual(JSON.stringify(respelled), JSON.stringify(submitRequest), 'the respelling changed the key order')
  assert.equal(commsDigest('com.submit', respelled), d)
  assert.notEqual(commsDigest('com.reply', submitRequest), d, 'the operation is part of the digest')
  // Fabric's vector for the contract's own fixture (the contract publishes none yet): a change to the framing
  // or the canonical form changes this line, and every stored receipt's digest with it.
  assert.equal(d, 'sha256:cf57a8690f85fc937374907953d49e670246d771dded6c31a54972eb64a05561')
  assert.equal(commsDigest('com.submit', { a: 1 }), 'sha256:' + createHash('sha256').update('fabric-project-comms/0.1\u0000com.submit\u0000{"a":1}').digest('hex'))
})

test('Fabric\'s commsDigest reproduces every digest vector the contract publishes and refuses every call it refuses (DEC-0043, DEC-0073)', () => {
  const vectors = fixtures.document('current/vectors/canonical.json').commsDigest
  assert.ok(vectors.vectors.length >= 4 && vectors.refuses.length >= 4)
  for (const v of vectors.vectors) {
    assert.equal(commsCanonical(v.args), v.canonical, `${v.name}: canonical form`)
    assert.equal(commsDigest(v.operation, v.args), v.digest, `${v.name}: digest`)
  }
  for (const r of vectors.refuses) assert.throws(() => commsDigest(r.operation, JSON.parse(r.argsJson)), CommsCanonicalError, r.name)
})

test('the input schema reaches the contract\'s verdict on every comms-submit fixture it grades', () => {
  const graded = catalogue.filter(e => e.schema === 'comms-submit.schema.json')
  assert.equal(graded.length, 8)
  for (const e of graded) {
    const doc = fixtures.document('current/' + e.path)
    assert.equal(commsSubmitSchema.safeParse(doc).success, e.valid, `${e.name}: Fabric's schema and the contract disagree`)
    assert.equal(validators['comms-submit.schema.json'](doc), e.valid, `${e.name}: the pinned schema disagrees with its own catalogue`)
  }
})

test('a forged estate or sender, an over-long body and a malformed call are refused before the door is called', async () => {
  const { rpc, calls } = fake()
  const board = createBoard({ rpc })
  for (const name of ['comms-submit-forged-estate', 'comms-submit-forged-sender']) {
    const r = await board.submit(caller, fixtures.document(`current/negative/${name}.json`))
    assert.equal(r.error.code, 'invalid_arguments', name)
  }
  const bytes = await board.submit(caller, { ...submitRequest, body: { text: 'é'.repeat(32768) + 'x' } })
  assert.equal(bytes.error.code, 'body_too_large', 'bytes count, not characters')
  assert.equal((await board.submit(caller, { ...submitRequest, body: { text: 'x'.repeat(65537) } })).error.code, 'body_too_large')
  assert.equal((await board.submit(caller, { ...submitRequest, idempotency: { epoch: 1.5, key: 'key-0000001' } })).error.code, 'invalid_arguments')
  assert.equal(calls.length, 0, 'nothing reached the board')
})

test('the caller\'s identity comes from the scope and the digest from the board, never from the input', async () => {
  const { rpc, calls } = fake({ board_submit: { data: { ok: true, repeated: false, message: '79000000-0000-4000-8000-0000000000a1', thread: '79000000-0000-4000-8000-0000000000d1', at: '2026-10-12T07:00:00.000Z' }, error: null } })
  const board = createBoard({ rpc })
  const r = await board.submit(caller, submitRequest)
  assert.equal(r.ok, true)
  assert.equal(calls.length, 1)
  const a = calls[0].args
  assert.equal(a.p_estate_id, caller.estateId); assert.equal(a.p_sender, caller.projectId); assert.deepEqual(a.p_principal, caller.principal)
  assert.equal(a.p_digest, commsDigest('com.submit', submitRequest))
  assert.deepEqual(a.p_submit, submitRequest)
})

test('a board that cannot be read answers not_available — never an empty page, never a ready status', async () => {
  for (const answer of [new Error('socket hang up'), { data: null, error: { message: 'timeout' } }, { data: 'garbage', error: null }]) {
    const board = createBoard({ rpc: fake({ board_list: answer, board_submit: answer, board_get: answer, board_status: answer }).rpc })
    const page = await board.list(caller, {})
    assert.equal(page.error?.code, 'not_available'); assert.equal(page.error.retryable, true); assert.equal(page.messages, undefined)
    assert.equal((await board.submit(caller, submitRequest)).error.code, 'not_available')
    assert.equal((await board.get(caller, { message: '79000000-0000-4000-8000-0000000000c1' })).error.code, 'not_available')
    const status = await board.status(caller)
    assert.equal(status.board.state, 'unavailable'); assert.equal(status.unread, undefined)
    assert.equal(validators['comms-status.schema.json'](status), true, JSON.stringify(validators['comms-status.schema.json'].errors))
  }
})

test('a page is the contract\'s comms-page; its cursor continues for this reader and filter only', async () => {
  const message = fixtures.document('current/positive/comms-page.json').messages[0]
  const { rpc, calls } = fake({ board_list: args => ({ data: { ok: true, messages: [message], last_seq: args.p_after_seq + 7, more: true }, error: null }) })
  const board = createBoard({ rpc, now: () => new Date('2026-10-05T07:00:00Z') })
  const first = await board.list(caller, { thread: '79000000-0000-4000-8000-0000000000d1', limit: 1 })
  assert.equal(validators['comms-page.schema.json'](first), true, JSON.stringify(validators['comms-page.schema.json'].errors))
  assert.equal(first.audience.project, caller.projectId); assert.equal(first.audience.grant, 'participant')
  assert.match(first.cursor, /^[A-Za-z0-9_-]{8,128}$/)
  const second = await board.list(caller, { thread: '79000000-0000-4000-8000-0000000000d1', cursor: first.cursor, limit: 1 })
  assert.equal(calls.at(-1).args.p_after_seq, 7); assert.equal(second.messages.length, 1)
  const n = calls.length
  const otherReader = { ...caller, projectId: '79000000-0000-4000-8000-000000000012' }
  assert.equal((await board.list(otherReader, { thread: '79000000-0000-4000-8000-0000000000d1', cursor: first.cursor })).error.code, 'cursor_reset_required')
  assert.equal((await board.list(caller, { thread: '79000000-0000-4000-8000-0000000000d2', cursor: first.cursor })).error.code, 'cursor_reset_required')
  assert.equal((await board.list(caller, { cursor: first.cursor })).error.code, 'cursor_reset_required', 'dropping the filter is a different audience')
  assert.equal((await createBoard({ rpc }).list(caller, { thread: '79000000-0000-4000-8000-0000000000d1', cursor: first.cursor })).error.code, 'cursor_reset_required', 'another run\'s key')
  assert.equal((await board.list(caller, { thread: '79000000-0000-4000-8000-0000000000d1', cursor: first.cursor.slice(0, -1) + (first.cursor.endsWith('A') ? 'B' : 'A') })).error.code, 'cursor_reset_required', 'a tampered MAC')
  assert.equal(calls.length, n, 'a reset cursor never reaches the board')
  const last = await createBoard({ rpc: fake({ board_list: { data: { ok: true, messages: [], last_seq: 3, more: false }, error: null } }).rpc }).list(caller, {})
  assert.equal(last.cursor, null, 'an exhausted snapshot has no cursor')
})

test('status reports health without reading a message', async () => {
  const { rpc, calls } = fake({ board_status: { data: { ok: true, unread: 2, epoch: 3, responders: [] }, error: null } })
  const status = await createBoard({ rpc }).status(caller)
  assert.equal(validators['comms-status.schema.json'](status), true, JSON.stringify(validators['comms-status.schema.json'].errors))
  assert.equal(status.board.state, 'ready'); assert.equal(status.unread, 2); assert.equal(status.transport.telegram, 'off')
  assert.deepEqual(calls.map(c => c.fn), ['board_status'])
})
// #endregion project-board-service

// 0.3.2 verification DA-9: the contract admits any opaque id, this board's ids are uuids. An id no message
// here can have is answered as an unknown id, before the door — not as a cast failure read "unavailable".
test('an id that is not a uuid is refused as unknown before the door; a uuid of any case reaches it', async () => {
  const { rpc, calls } = fake({ board_get: { data: { ok: true, message: { id: 'm' } }, error: null } })
  const board = createBoard({ rpc })
  for (const op of [() => board.get(caller, { message: 'abcdefgh' }), () => board.readAck(caller, { message: 'abcdefgh' }), () => board.list(caller, { thread: 'abcdefgh' })]) {
    const r = await op()
    assert.equal(r.error.code, 'not_authorized')
    assert.equal(r.error.retryable, false)
  }
  assert.equal(calls.length, 0, 'nothing reached the door')
  await board.get(caller, { message: '79000000-0000-4000-8000-0000000000AB' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].args.p_message, '79000000-0000-4000-8000-0000000000ab')
})

// 0.3.2 verification DA-4, DA-5: an epoch past PostgreSQL's integer is the caller's error, not "unavailable";
// submit takes thread and reply ids by the same rule as list, get and read_ack.
test('submit refuses an epoch past int32 and a non-uuid thread or reply before the door, and lower-cases ids', async () => {
  const { rpc, calls } = fake({ board_submit: { data: { ok: true }, error: null } })
  const board = createBoard({ rpc })
  const base = { ...submitRequest, thread: { id: '79000000-0000-4000-8000-0000000000D1' } }
  assert.equal((await board.submit(caller, { ...base, idempotency: { ...base.idempotency, epoch: 2 ** 31 } })).error.code, 'invalid_arguments')
  assert.equal((await board.submit(caller, { ...base, thread: { id: 'thr_8Hc2kQ9xA1' } })).error.code, 'not_authorized')
  assert.equal(calls.length, 0)
  await board.submit(caller, base)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].args.p_submit.thread, { id: '79000000-0000-4000-8000-0000000000d1' })
})

// 0.3.2 verification i3 DA-1: participants of a new thread and a request's target are compared as lower-case uuids.
test('submit lower-cases the participants of a new thread and a request target', async () => {
  const { rpc, calls } = fake({ board_submit: { data: { ok: true }, error: null } })
  const board = createBoard({ rpc })
  const upper = '79000000-0000-4000-8000-0000000000EE'
  await board.submit(caller, { ...submitRequest, thread: { new: { participants: [upper] } }, kind: 'request', request: { target: upper, capability: 'review.code' } })
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].args.p_submit.thread.new.participants, [upper.toLowerCase()])
  assert.equal(calls[0].args.p_submit.request.target, upper.toLowerCase())
})


// ── COM-02.3 (migration 86, ADR-0149): honest write outcomes, the receipt guard, the pinned-operation gate,
// reply and cancel, and status from board_status. ─────────────────────────────────────────────────────────
// #region project-board-service-lifecycle — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#decision
const { useOps } = await import('../src/main/opsSink.ts')
const { registerBoardTools } = await import('../src/main/boardTools.ts')
const { COMMS_OPERATIONS, PINNED_COMMS_OPERATIONS, STATUS_CARRIES_EPOCH, commsReplySchema, commsCancelSchema, commsReceiptSchema } = await import('../src/main/boardService.ts')
const logged = []
useOps({ correlate: () => 'test', record: (r) => logged.push(r), begin: () => () => {}, read: () => [], file: () => null, lost: () => 0 })
const M1 = '79000000-0000-4000-8000-0000000000a1', T1 = '79000000-0000-4000-8000-0000000000d1'
const replyArgs = { idempotency: { epoch: 1, key: 'reply-0000001' }, replyTo: M1, body: { text: 'done' } }
const cancelArgs = { idempotency: { epoch: 1, key: 'cancel-000001' }, request: M1, expectedRevision: 1, reason: 'not needed' }
const goodReceipt = { ok: true, repeated: false, message: M1, thread: T1, at: '2026-10-12T07:00:00.000Z' }

test('A7-035: a write whose answer was lost says it may have been stored; a read says nothing changed; both are logged', async () => {
  for (const answer of [new Error('fetch failed'), { data: null, error: { message: 'TypeError: fetch failed', code: '' } }, { data: 'garbage', error: null }]) {
    logged.length = 0
    const board = createBoard({ rpc: fake({ board_submit: answer, board_reply: answer, board_cancel: answer, board_read_ack: answer, board_list: answer, board_get: answer }).rpc })
    for (const w of [await board.submit(caller, submitRequest), await board.reply(caller, replyArgs), await board.cancel(caller, cancelArgs), await board.readAck(caller, { message: M1 })]) {
      assert.equal(w.error.code, 'not_available'); assert.equal(w.error.retryable, true)
      assert.match(w.error.message, /may have been stored/); assert.doesNotMatch(w.error.message, /nothing was changed/)
    }
    for (const r of [await board.list(caller, {}), await board.get(caller, { message: M1 })])
      assert.equal(r.error.message, 'The board cannot be read right now; nothing was changed.')
    assert.equal(logged.length, 6, 'every failed call is in the operations log')
    assert.ok(logged.every(x => x.outcome === 'failed'))
  }
})

test('A7-017 residual: SQLSTATE class 22 is the caller\'s value; another SQLSTATE rolled back, so nothing changed', async () => {
  for (const code of ['22P02', '22003']) {
    const board = createBoard({ rpc: fake({ board_submit: { data: null, error: { code, message: 'invalid input' } } }).rpc })
    const r = await board.submit(caller, submitRequest)
    assert.equal(r.error.code, 'invalid_arguments', code); assert.equal(r.error.retryable, false)
  }
  const rolledBack = await createBoard({ rpc: fake({ board_cancel: { data: null, error: { code: '55P03', message: 'lock timeout' } } }).rpc }).cancel(caller, cancelArgs)
  assert.equal(rolledBack.error.code, 'not_available'); assert.match(rolledBack.error.message, /nothing was changed/)
  const noState = await createBoard({ rpc: fake({ board_cancel: { data: null, error: { code: 'PGRST301', message: 'gateway' } } }).rpc }).cancel(caller, cancelArgs)
  assert.match(noState.error.message, /may have been stored/, 'a code that is not a SQLSTATE proves nothing about the write')
})

test('C3: a receipt carrying seq, or any key the contract does not name, never reaches an agent', async () => {
  for (const bad of [{ ...goodReceipt, seq: 42 }, { ...goodReceipt, request: M1 }, { ...goodReceipt, estate: caller.estateId }]) {
    logged.length = 0
    const r = await createBoard({ rpc: fake({ board_submit: { data: bad, error: null } }).rpc }).submit(caller, submitRequest)
    assert.equal(r.error?.code, 'not_available', JSON.stringify(bad)); assert.equal(JSON.stringify(r).includes('42'), false)
    assert.equal(logged.at(-1)?.op, 'board.receipt-shape')
  }
  const ok = await createBoard({ rpc: fake({ board_submit: { data: { ...goodReceipt, request: { id: M1, state: 'queued', effect: 'not_started', revision: 1 } }, error: null } }).rpc }).submit(caller, submitRequest)
  assert.equal(ok.ok, true); assert.equal(ok.request.state, 'queued')
  assert.equal(commsReceiptSchema.safeParse({ ok: true, repeated: true, message: M1 }).success, true, 'a read mark\'s receipt')
})

test('com.reply and com.cancel: the digest is the contract\'s, ids are board ids, a forged field and a fenced reply are refused before the door', async () => {
  const { rpc, calls } = fake({ board_reply: { data: goodReceipt, error: null }, board_cancel: { data: { ok: true, repeated: false, request: { id: M1, state: 'cancelled', effect: 'not_started', revision: 2 }, at: '2026-10-12T07:00:00.000Z' }, error: null } })
  const board = createBoard({ rpc })
  assert.equal((await board.reply(caller, { ...replyArgs, replyTo: M1.toUpperCase() })).ok, true)
  assert.equal(calls[0].args.p_reply.replyTo, M1)
  assert.equal(calls[0].args.p_digest, commsDigest('com.reply', { ...replyArgs, replyTo: M1 }))
  assert.equal(calls[0].args.p_sender, caller.projectId)
  const c = await board.cancel(caller, cancelArgs)
  assert.equal(c.request.state, 'cancelled'); assert.equal(calls[1].args.p_digest, commsDigest('com.cancel', cancelArgs)); assert.equal(calls[1].args.p_caller, caller.projectId)
  const n = calls.length
  for (const forged of ['estate_id', 'project', 'principal', 'sender']) {
    assert.equal((await board.reply(caller, { ...replyArgs, [forged]: 'x' })).error.code, 'invalid_arguments', `reply ${forged}`)
    assert.equal((await board.cancel(caller, { ...cancelArgs, [forged]: 'x' })).error.code, 'invalid_arguments', `cancel ${forged}`)
    assert.equal((await board.list(caller, { [forged]: 'x' })).error.code, 'invalid_arguments', `list ${forged}`)
    assert.equal((await board.get(caller, { message: M1, [forged]: 'x' })).error.code, 'invalid_arguments', `get ${forged}`)
    assert.equal((await board.readAck(caller, { message: M1, [forged]: 'x' })).error.code, 'invalid_arguments', `read_ack ${forged}`)
    // DEC-0073: `project` is com.status's one argument — another Project's id is not_authorized (below), not malformed.
    if (forged !== 'project') assert.equal((await board.status(caller, { [forged]: 'x' })).error.code, 'invalid_arguments', `status ${forged}`)
  }
  // DEC-0073: com.read_ack takes no idempotency key — it is naturally idempotent, and a key is a field it does not name.
  assert.equal((await board.readAck(caller, { message: M1, idempotency: { epoch: 1, key: 'ack-key-0001' } })).error.code, 'invalid_arguments', 'read_ack took a key')
  assert.equal((await board.reply(caller, { fence: {}, body: { text: 'x' } })).error.code, 'unsupported_capability')
  assert.equal((await board.reply(caller, { ...replyArgs, replyTo: 'abcdefgh' })).error.code, 'not_authorized')
  assert.equal((await board.cancel(caller, { ...cancelArgs, request: 'abcdefgh' })).error.code, 'not_authorized')
  assert.equal((await board.cancel(caller, { ...cancelArgs, reason: 'x'.repeat(301) })).error.code, 'invalid_arguments')
  assert.equal((await board.reply(caller, { ...replyArgs, body: { text: 'é'.repeat(32768) + 'x' } })).error.code, 'body_too_large')
  assert.equal(calls.length, n, 'a refused call reached the board')
  assert.equal(commsReplySchema.safeParse({ ...replyArgs, fence: {} }).success, false); assert.equal(commsCancelSchema.safeParse({ ...cancelArgs, expectedRevision: 0 }).success, false)
})

test('status comes from board_status: ready with unread and responders, an archived Project refused, an unreachable board unavailable', async () => {
  const ready = await createBoard({ rpc: fake({ board_status: { data: { ok: true, unread: 0, epoch: 2, responders: [] }, error: null } }).rpc }).status(caller)
  assert.equal(validators['comms-status.schema.json'](ready), true, JSON.stringify(validators['comms-status.schema.json'].errors))
  assert.equal('idempotency' in ready, STATUS_CARRIES_EPOCH)
  const refused = await createBoard({ rpc: fake({ board_status: { data: { error: { code: 'not_authorized', message: 'This Project may not read the board.', retryable: false } }, error: null } }).rpc }).status(caller)
  assert.equal(refused.error.code, 'not_authorized')
  for (const answer of [new Error('down'), { data: { ok: true, unread: -1, epoch: 1, responders: [] }, error: null }, { data: { ok: true, unread: 1, responders: [] }, error: null }]) {
    const down = await createBoard({ rpc: fake({ board_status: answer }).rpc }).status(caller)
    assert.equal(down.board.state, 'unavailable'); assert.equal(validators['comms-status.schema.json'](down), true)
  }
})

test('DEC-0073 com.status: a session omits its Project or names its own; another Project answers exactly as an unknown one', async () => {
  const unknown = { data: { error: { code: 'not_authorized', message: 'This Project may not read the board.', retryable: false } }, error: null }
  const { rpc, calls } = fake({ board_status: (args) => args.p_reader === caller.projectId ? { data: { ok: true, unread: 1, epoch: 1, responders: [] }, error: null } : unknown })
  const board = createBoard({ rpc })
  assert.equal((await board.status(caller, {})).board.state, 'ready')
  assert.equal((await board.status(caller, { project: caller.projectId })).board.state, 'ready', 'its own Project')
  assert.equal((await board.status(caller, { project: caller.projectId.toUpperCase() })).board.state, 'ready', 'its own Project in another case')
  const n = calls.length
  const other = await board.status(caller, { project: '79000000-0000-4000-8000-000000000099' })
  const notAProject = await board.status(caller, { project: 'no-such-project' })
  assert.equal(calls.length, n, 'another Project reached the board')
  const unknownAnswer = await createBoard({ rpc: fake({ board_status: unknown }).rpc }).status({ ...caller, projectId: '79000000-0000-4000-8000-000000000098' })
  assert.deepEqual(other, unknownAnswer, 'another Project and an unknown one answer differently')
  assert.deepEqual(notAProject, unknownAnswer)
  assert.equal((await board.status(caller, { project: '' })).error.code, 'invalid_arguments', 'not a Project id at all')
  assert.equal((await board.status(caller, 'x')).error.code, 'invalid_arguments')
})

test('DEC-0073 com.submit of kind reply: its thread must be replyTo\'s own — a replyTo no message of the thread can have is invalid_arguments, the board\'s answer', async () => {
  const wrongThread = { data: { error: { code: 'invalid_arguments', message: 'A reply names a message of the same thread.', retryable: false } }, error: null }
  const { rpc, calls } = fake({ board_submit: wrongThread })
  const board = createBoard({ rpc })
  const { request: _r, ...plain } = submitRequest
  const reply = { ...plain, thread: { id: T1 }, kind: 'reply', replyTo: 'abcdefgh' }
  const r = await board.submit(caller, reply)
  // Not "not_authorized": that is the answer for a thread this Project does not take part in, which the board decides first.
  assert.equal(r.error?.code, 'invalid_arguments', JSON.stringify(r))
  assert.equal(calls.length, 1, 'the board decides the thread before the reply')
  assert.equal(calls[0].args.p_submit.replyTo, 'abcdefgh', 'an id that is no board id is passed as given; the board refuses it without a cast')
  assert.equal(calls[0].args.p_digest, commsDigest('com.submit', reply))
  await board.submit(caller, { ...reply, replyTo: M1.toUpperCase() })
  assert.equal(calls[1].args.p_submit.replyTo, M1, 'a board id of any case is sent lower-cased')
})

test('DEC-0073 com.status: the idempotency epoch is a session\'s — a viewer principal never reads it', async () => {
  const rpc = fake({ board_status: { data: { ok: true, unread: 0, epoch: 4, responders: [] }, error: null } }).rpc
  // Once the pin's comms-status carries `idempotency` (the repin flips STATUS_CARRIES_EPOCH): a session reads its epoch.
  const session = await createBoard({ rpc, statusCarriesEpoch: true }).status(caller)
  assert.deepEqual(session.idempotency, { epoch: 4 })
  const viewer = await createBoard({ rpc, statusCarriesEpoch: true }).status({ ...caller, surface: 'viewer' })
  assert.equal('idempotency' in viewer, false, 'a viewer principal was told an epoch to submit under')
  assert.equal(viewer.board.state, 'ready'); assert.equal(viewer.unread, 0)
  assert.equal('idempotency' in await createBoard({ rpc }).status(caller), STATUS_CARRIES_EPOCH, 'the default follows the pin')
})

test('the gate: all seventeen tools registered; an operation outside the pin answers unsupported_capability before the door', async () => {
  const tools = new Map()
  const server = { registerTool: (name, _meta, handler) => tools.set(name, handler) }
  const { rpc, calls } = fake({ board_submit: { data: goodReceipt, error: null }, board_reply: { data: goodReceipt, error: null } })
  registerBoardTools(server, createBoard({ rpc }), () => caller)
  assert.deepEqual([...tools.keys()].sort(), [...COMMS_OPERATIONS].sort())
  assert.equal(tools.size, 17)
  for (const op of COMMS_OPERATIONS.filter(o => !PINNED_COMMS_OPERATIONS.has(o))) {
    const out = await tools.get(op)(replyArgs)
    assert.equal(out.isError, true, op)
    assert.deepEqual(JSON.parse(out.content[0].text), { error: { code: 'unsupported_capability', message: `This board does not serve ${op} yet.`, retryable: false } })
  }
  assert.equal(calls.length, 0, 'an unserved operation reached the board')
  assert.equal(JSON.parse((await tools.get('com.submit')(submitRequest)).content[0].text).ok, true)
  // R-006's plant 9, as a case: one operation removed from the pinned set is refused by the same gate.
  const narrowed = new Map()
  registerBoardTools({ registerTool: (name, _m, h) => narrowed.set(name, h) }, createBoard({ rpc }), () => caller, new Set([...PINNED_COMMS_OPERATIONS].filter(o => o !== 'com.submit')))
  assert.equal(JSON.parse((await narrowed.get('com.submit')(submitRequest)).content[0].text).error.code, 'unsupported_capability')
  // And a served reply reaches the board once the pin names it (the repin adds 'com.reply').
  const widened = new Map()
  registerBoardTools({ registerTool: (name, _m, h) => widened.set(name, h) }, createBoard({ rpc }), () => caller, new Set([...PINNED_COMMS_OPERATIONS, 'com.reply']))
  assert.equal(JSON.parse((await widened.get('com.reply')(replyArgs)).content[0].text).ok, true)
})

test('the pinned set follows the vendored pin: an unserved operation has no argument schema there, and status refuses an epoch', () => {
  const schemaOf = { 'com.reply': 'comms-reply', 'com.cancel': 'comms-cancel', 'com.enroll': 'comms-enroll', 'com.claim': 'comms-claim',
    'com.renew': 'comms-fenced', 'com.accept': 'comms-fenced', 'com.progress': 'comms-progress', 'com.effect_begin': 'comms-effect-begin',
    'com.reconcile': 'comms-reconcile', 'com.responder_replace': 'comms-responder-replace', 'com.directory': 'comms-directory-args' }
  for (const [op, name] of Object.entries(schemaOf)) {
    let present = true
    try { fixtures.document(`current/schemas/${name}.schema.json`) } catch { present = false }
    assert.equal(present, PINNED_COMMS_OPERATIONS.has(op), `${op}: the pin ${present ? 'carries' : 'lacks'} ${name}; update PINNED_COMMS_OPERATIONS with the repin`)
  }
  const withEpoch = { protocol: 'fabric-project-comms/0.1', board: { state: 'ready' }, responders: [], idempotency: { epoch: 1 } }
  assert.equal(validators['comms-status.schema.json'](withEpoch), STATUS_CARRIES_EPOCH, 'the pinned comms-status and STATUS_CARRIES_EPOCH disagree')
})
test('the cycle\'s board upkeep never throws: a pass that fails is logged and answers null', async () => {
  const { tickBoard } = await import('../src/main/boardService.ts')
  const { rpc, calls } = fake({ board_tick: { data: { ok: true, expired: 1, rotated: 0, retired: 0, receipts_compacted: 0, outbox_compacted: 2 }, error: null } })
  assert.deepEqual(await tickBoard(rpc, caller.estateId), { expired: 1, rotated: 0, retired: 0, receipts_compacted: 0, outbox_compacted: 2 })
  assert.deepEqual(calls[0], { fn: 'board_tick', args: { p_estate_id: caller.estateId } })
  for (const answer of [new Error('down'), { data: null, error: { code: '55P03', message: 'lock timeout' } }, { data: { error: { code: 'invalid_arguments' } }, error: null }]) {
    logged.length = 0
    assert.equal(await tickBoard(fake({ board_tick: answer }).rpc, caller.estateId), null)
    assert.equal(logged.at(-1).op, 'board.tick')
  }
})
// #endregion project-board-service-lifecycle
