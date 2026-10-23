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

// What the pin (a59d04b) grades valid and Fabric does not serve yet, each named with the node that serves it and the
// contract decision behind it. Fabric refuses these today on purpose; the list is exact both ways — a new disagreement
// fails the mirror tests, and so does a member Fabric starts serving without leaving this list.
const OWED = new Map([
  ['comms-submit-finding', 'W4-12: the structured finding on com.submit (DEC-0080)'],
  ['comms-directory-held', 'W4-7: a paused capability in the directory (DEC-0079)'],
  ['comms-receipt-reconcile-owner', 'W4-13: the owner\'s settlement receipt, settledBy "owner" (DEC-0081)']
])
const verdict = (e, accepted, mirror) => {
  if (OWED.has(e.name)) assert.equal(accepted, false, `${e.name}: Fabric now serves it — take it out of OWED (${OWED.get(e.name)})`)
  else assert.equal(accepted, e.valid, `${e.name}: Fabric's ${mirror} and the contract disagree`)
}

test('the input schema reaches the contract\'s verdict on every comms-submit fixture it grades', () => {
  const graded = catalogue.filter(e => e.schema === 'comms-submit.schema.json')
  // DEC-0022's eight, and DEC-0080's structured finding (one positive, thirty-three negatives) at a59d04b.
  assert.equal(graded.length, 42)
  for (const e of graded) {
    const doc = fixtures.document('current/' + e.path)
    verdict(e, commsSubmitSchema.safeParse(doc).success, 'schema')
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
  // One write; a request's receipt is followed by one read of whether anyone can answer it (0.3.9 BD-1).
  assert.deepEqual(calls.map(c => c.fn), ['board_submit', 'board_responder_possible'])
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
  // The cursor key is read from the board (0.3.9 BD-3); what must not happen is a PAGE read on a reset cursor.
  const pages = () => calls.filter(c => c.fn === 'board_list' || c.fn === 'board_list_reader').length
  const n = pages()
  const otherReader = { ...caller, projectId: '79000000-0000-4000-8000-000000000012' }
  assert.equal((await board.list(otherReader, { thread: '79000000-0000-4000-8000-0000000000d1', cursor: first.cursor })).error.code, 'cursor_reset_required')
  assert.equal((await board.list(caller, { thread: '79000000-0000-4000-8000-0000000000d2', cursor: first.cursor })).error.code, 'cursor_reset_required')
  assert.equal((await board.list(caller, { cursor: first.cursor })).error.code, 'cursor_reset_required', 'dropping the filter is a different audience')
  assert.equal((await createBoard({ rpc }).list(caller, { thread: '79000000-0000-4000-8000-0000000000d1', cursor: first.cursor })).error.code, 'cursor_reset_required', 'another run\'s key')
  assert.equal((await board.list(caller, { thread: '79000000-0000-4000-8000-0000000000d1', cursor: first.cursor.slice(0, -1) + (first.cursor.endsWith('A') ? 'B' : 'A') })).error.code, 'cursor_reset_required', 'a tampered MAC')
  assert.equal(pages(), n, 'a reset cursor never reaches the board')
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
    for (const w of [await board.submit(caller, submitRequest), await board.reply(caller, replyArgs), await board.cancel(caller, cancelArgs)]) {
      assert.equal(w.error.code, 'not_available'); assert.equal(w.error.retryable, true)
      assert.match(w.error.message, /may have been stored/); assert.doesNotMatch(w.error.message, /nothing was changed/)
    }
    // read_ack takes no key: it may have taken effect, and repeating it is safe (wave-2 fix 7).
    const ack = await board.readAck(caller, { message: M1 })
    assert.equal(ack.error.code, 'not_available'); assert.match(ack.error.message, /may have taken effect/); assert.doesNotMatch(ack.error.message, /nothing was changed/)
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
  // A responder's fenced reply needs responder facts from the scope; a caller without them cannot respond (COM-03).
  assert.equal((await board.reply(caller, { fence: {}, body: { text: 'x' } })).error.code, 'not_authorized')
  assert.equal((await board.reply(caller, { ...replyArgs, fence: {} })).error.code, 'invalid_arguments', 'both reply forms')
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
  assert.deepEqual(await tickBoard(rpc, caller.estateId), { answered: 0, expired: 1, rotated: 0, retired: 0, receipts_compacted: 0, outbox_compacted: 2 }, 'a board before 0.3.9 answers no count of answered requests: 0')
  assert.deepEqual(calls[0], { fn: 'board_tick', args: { p_estate_id: caller.estateId } })
  for (const answer of [new Error('down'), { data: null, error: { code: '55P03', message: 'lock timeout' } }, { data: { error: { code: 'invalid_arguments' } }, error: null }]) {
    logged.length = 0
    assert.equal(await tickBoard(fake({ board_tick: answer }).rpc, caller.estateId), null)
    assert.equal(logged.at(-1).op, 'board.tick')
  }
})

// ── COM-03: the responder tools and the directory (migration 87, contract DEC-0073 pinned at edc88a6) ──────
const { commsEnrollSchema, commsClaimSchema, commsFencedSchema, commsProgressSchema, commsEffectBeginSchema, commsCompleteSchema, commsReconcileSchema,
  commsResponderReplaceSchema, commsDirectoryArgsSchema, commsDirectorySchema, commsReplyAnySchema, commsFenceSchema, commsListSchema, commsMessageRefSchema, commsStatusArgsSchema } = await import('../src/main/boardService.ts')
const responder = { ...caller, responder: { sessionId: 'session-1', cameIn: 'enrolled', agent: 'codex', bindingId: '79000000-0000-4000-8000-0000000000b1' } }
const ATT = '79000000-0000-4000-8000-0000000000e1'
const fenceArgs = (extra = {}) => ({ request: M1, generation: 2, attempt: ATT, digest: 'sha256:' + 'a'.repeat(64), idempotency: { epoch: 1, key: 'fence-000001' }, ...extra })

test('every zod mirror reaches the contract\'s verdict on every fixture the pin grades for its schema (DEC-0073)', () => {
  const mirrors = { 'comms-enroll.schema.json': commsEnrollSchema, 'comms-claim.schema.json': commsClaimSchema, 'comms-fenced.schema.json': commsFencedSchema,
    'comms-progress.schema.json': commsProgressSchema, 'comms-effect-begin.schema.json': commsEffectBeginSchema, 'comms-complete.schema.json': commsCompleteSchema,
    'comms-reconcile.schema.json': commsReconcileSchema, 'comms-responder-replace.schema.json': commsResponderReplaceSchema, 'comms-directory-args.schema.json': commsDirectoryArgsSchema,
    'comms-directory.schema.json': commsDirectorySchema, 'comms-reply.schema.json': commsReplyAnySchema, 'comms-fence.schema.json': commsFenceSchema,
    'comms-list.schema.json': commsListSchema, 'comms-message-ref.schema.json': commsMessageRefSchema, 'comms-status-args.schema.json': commsStatusArgsSchema,
    'comms-receipt.schema.json': commsReceiptSchema, 'comms-cancel.schema.json': commsCancelSchema }
  let n = 0
  for (const [schema, mirror] of Object.entries(mirrors)) {
    const graded = catalogue.filter(e => e.schema === schema)
    assert.ok(graded.length >= 1, `${schema}: the pin grades no fixture`)
    for (const e of graded) {
      const doc = fixtures.document('current/' + e.path)
      verdict(e, mirror.safeParse(doc).success, 'mirror')
      n++
    }
  }
  assert.ok(n >= 50, `only ${n} fixtures graded`)
})

test('a responder command: the holder from the scope, the project from the endpoint, the digest over the arguments sent, ids lower-cased', async () => {
  const claimed = { ok: true, repeated: false, message: M1, request: { id: M1, state: 'claimed', effect: 'not_started', revision: 2 },
    attempt: { id: ATT, generation: 2, digest: 'sha256:' + 'a'.repeat(64), leaseExpiresAt: '2026-10-13T07:00:00.000Z' } }
  const { rpc, calls } = fake({ board_claim: { data: claimed, error: null }, board_accept: { data: { ok: true, repeated: false, request: { id: M1, state: 'accepted', effect: 'not_started', revision: 3 } }, error: null } })
  const board = createBoard({ rpc })
  const args = { idempotency: { epoch: 1, key: 'claim-000001' }, capability: 'analytics.retention', request: M1.toUpperCase() }
  const c = await board.claim(responder, args)
  assert.deepEqual(c, claimed)
  assert.deepEqual(calls[0].args.p_holder, { session_id: 'session-1', came_in: 'enrolled', agent: 'codex', binding_id: '79000000-0000-4000-8000-0000000000b1', label: 'Claude Code' })
  assert.equal(calls[0].args.p_project, caller.projectId); assert.equal(calls[0].args.p_estate, caller.estateId)
  assert.equal(calls[0].args.p_args.request, M1)
  assert.equal(calls[0].args.p_digest, commsDigest('com.claim', { ...args, request: M1 }))
  await board.accept(responder, { fence: fenceArgs({ request: M1.toUpperCase(), attempt: ATT.toUpperCase() }) })
  assert.deepEqual(calls[1].args.p_args.fence, fenceArgs())
  const n = calls.length
  for (const forged of ['estate_id', 'project', 'principal', 'session', 'leaseUntil'])
    for (const [op, a] of [['enroll', { idempotency: { epoch: 1, key: 'enroll-00001' }, capability: 'x.y' }], ['accept', { fence: fenceArgs() }], ['claim', args]])
      assert.equal((await board[op](responder, { ...a, [forged]: 'x' })).error.code, 'invalid_arguments', `${op} ${forged}`)
  assert.equal((await board.accept(responder, { fence: fenceArgs({ request: 'abcdefgh' }) })).error.code, 'not_authorized')
  assert.equal((await board.accept(responder, { fence: fenceArgs({ attempt: 'abcdefgh' }) })).error.code, 'fenced')
  assert.equal((await board.reconcile(responder, { idempotency: { epoch: 1, key: 'recon-000001' }, request: M1, digest: 'sha256:' + 'a'.repeat(64), outcome: { state: 'completed', observed: false } })).error.code, 'invalid_arguments', 'an unobserved reconcile')
  assert.equal((await board.enroll(caller, { idempotency: { epoch: 1, key: 'enroll-00001' }, capability: 'x.y' })).error.code, 'not_authorized', 'a caller without responder facts')
  assert.equal((await board.enroll({ ...responder, surface: 'viewer' }, { idempotency: { epoch: 1, key: 'enroll-00001' }, capability: 'x.y' })).error.code, 'not_authorized', 'a viewer')
  assert.equal((await board.enroll({ ...responder, principal: { ...responder.principal, provenance: 'asserted' } }, { idempotency: { epoch: 1, key: 'enroll-00001' }, capability: 'x.y' })).error.code, 'not_authorized', 'an asserted principal')
  assert.equal(calls.length, n, 'a refused responder call reached the board')
})

test('a fenced reply goes to board_reply_fenced; a receipt with a holder or a seq never reaches the agent', async () => {
  const { rpc, calls } = fake({ board_reply_fenced: { data: goodReceipt, error: null }, board_enroll: { data: { ok: true, repeated: false, slot: { project: caller.projectId, capability: 'x.y', generation: 1, leaseExpiresAt: '2026-10-13T07:00:00.000Z', holder: 'session-1' } }, error: null } })
  const board = createBoard({ rpc })
  assert.equal((await board.reply(responder, { fence: fenceArgs(), body: { text: 'on it' } })).ok, true)
  assert.equal(calls[0].fn, 'board_reply_fenced'); assert.equal(calls[0].args.p_digest, commsDigest('com.reply', { fence: fenceArgs(), body: { text: 'on it' } }))
  logged.length = 0
  const leaked = await board.enroll(responder, { idempotency: { epoch: 1, key: 'enroll-00001' }, capability: 'x.y' })
  assert.equal(leaked.error.code, 'not_available'); assert.equal(logged.at(-1).op, 'board.receipt-shape')
})

test('com.directory: sessions only; the cursor is bound to the reader, its grant and the filter; nothing but ids, names, capabilities and responder state leaves', async () => {
  const P2 = '79000000-0000-4000-8000-000000000012'
  const page = { ok: true, projects: [{ id: P2, name: 'analytics', capabilities: [{ capability: 'analytics.retention', responder: 'active' }] }], more: true, last: P2 }
  const { rpc, calls } = fake({ board_directory: { data: page, error: null } })
  const board = createBoard({ rpc })
  const first = await board.directory(caller, { capability: 'analytics.retention', limit: 1 })
  assert.equal(validators['comms-directory.schema.json'](first), true, JSON.stringify(validators['comms-directory.schema.json'].errors))
  assert.match(first.cursor, /^d[0-9a-f]{32}_[A-Za-z0-9_-]{22}$/)
  assert.deepEqual(calls[0].args, { p_estate: caller.estateId, p_reader: caller.projectId, p_capability: 'analytics.retention', p_after: null, p_limit: 1 })
  await board.directory(caller, { capability: 'analytics.retention', cursor: first.cursor })
  assert.equal(calls[1].args.p_after, P2)
  const n = calls.length
  assert.equal((await board.directory(caller, { cursor: first.cursor })).error.code, 'cursor_reset_required', 'another filter')
  assert.equal((await board.directory({ ...caller, projectId: P2 }, { capability: 'analytics.retention', cursor: first.cursor })).error.code, 'cursor_reset_required', 'another reader')
  assert.equal((await board.directory({ ...caller, participationGrant: 'other' }, { capability: 'analytics.retention', cursor: first.cursor })).error.code, 'cursor_reset_required', 'another grant')
  assert.equal((await board.directory({ ...caller, surface: 'viewer' }, {})).error.code, 'not_authorized', 'a viewer read the estate\'s Project list')
  assert.equal((await board.directory({ ...caller, principal: { ...caller.principal, provenance: 'asserted' } }, {})).error.code, 'not_authorized')
  assert.equal((await board.directory(caller, { estate_id: 'x' })).error.code, 'invalid_arguments')
  assert.equal(calls.length, n)
  logged.length = 0
  const leaky = await createBoard({ rpc: fake({ board_directory: { data: { ...page, projects: [{ ...page.projects[0], unread: 3 }] }, error: null } }).rpc }).directory(caller, {})
  assert.equal(leaky.error.code, 'not_available'); assert.equal(logged.at(-1).op, 'board.directory-shape')
})

test('every board tool is served now that the pin carries its schema; one removed from the set is refused before the door (R-006 plant 9)', async () => {
  const tools = new Map()
  const { rpc, calls } = fake({ board_enroll: { data: { ok: true, repeated: false, slot: { project: caller.projectId, capability: 'x.y', generation: 1, leaseExpiresAt: '2026-10-13T07:00:00.000Z' } }, error: null } })
  registerBoardTools({ registerTool: (name, _m, h) => tools.set(name, h) }, createBoard({ rpc }), () => responder)
  const enrolled = JSON.parse((await tools.get('com.enroll')({ idempotency: { epoch: 1, key: 'enroll-00001' }, capability: 'x.y' })).content[0].text)
  assert.equal(enrolled.slot.generation, 1)
  const narrowed = new Map()
  registerBoardTools({ registerTool: (name, _m, h) => narrowed.set(name, h) }, createBoard({ rpc }), () => responder, new Set([...PINNED_COMMS_OPERATIONS].filter(o => o !== 'com.enroll')))
  const n = calls.length
  assert.equal(JSON.parse((await narrowed.get('com.enroll')({ idempotency: { epoch: 1, key: 'enroll-00001' }, capability: 'x.y' })).content[0].text).error.code, 'unsupported_capability')
  assert.equal(calls.length, n)
  assert.equal(PINNED_COMMS_OPERATIONS.size, 17)
})
// #endregion project-board-service-lifecycle

// #region project-board-service-w2-fixes — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#amendments
// The wave-2 fix round (COM-03): what the three blind readings found in the service, each seen red first.
test('a board session reads its idempotency epoch like any Project session; only a viewer is never told one (fix 1)', async () => {
  const rpc = fake({ board_status: { data: { ok: true, unread: 0, epoch: 3, responders: [] }, error: null } }).rpc
  const board = createBoard({ rpc, statusCarriesEpoch: true })
  assert.deepEqual((await board.status({ ...caller, surface: 'board' })).idempotency, { epoch: 3 }, 'a board session cannot learn the epoch every responder command needs')
  assert.deepEqual((await board.status({ ...caller, surface: 'session' })).idempotency, { epoch: 3 })
  assert.equal('idempotency' in await board.status({ ...caller, surface: 'viewer' }), false)
})

test('a call that takes no idempotency key and whose answer was lost says it is safe to send again — never "the same idempotency key" (fix 7)', async () => {
  const lost = new Error('fetch failed')
  const board = createBoard({ rpc: fake({ board_read_ack: lost, board_renew: lost, board_progress: lost, board_accept: lost }).rpc })
  for (const [name, answer] of [['read_ack', await board.readAck(caller, { message: M1 })], ['renew', await board.renew(responder, { fence: fenceArgs() })], ['progress', await board.progress(responder, { fence: fenceArgs(), note: { text: 'halfway' } })]]) {
    assert.equal(answer.error.code, 'not_available', name); assert.equal(answer.error.retryable, true, name)
    assert.doesNotMatch(answer.error.message, /idempotency key/, `${name} told to resend with a key it does not take`)
    assert.match(answer.error.message, /safe to send again/, name)
  }
  assert.match((await board.accept(responder, { fence: fenceArgs() })).error.message, /same idempotency key/, 'a stored write still says the key tells which')
})

test('a board session is respond-only (ADR-0149 Amendment 2): submit, cancel, read_ack, directory and a participant reply are refused before the door', async () => {
  const { rpc, calls } = fake({ board_reply_fenced: { data: goodReceipt, error: null }, board_list: { data: { ok: true, messages: [], last_seq: 0, more: false }, error: null } })
  const board = createBoard({ rpc })
  const service = { ...responder, surface: 'board', responder: { ...responder.responder, cameIn: 'hub' } }
  for (const [name, answer] of [
    ['submit', await board.submit(service, submitRequest)],
    ['cancel', await board.cancel(service, cancelArgs)],
    ['read_ack', await board.readAck(service, { message: M1 })],
    ['directory', await board.directory(service, {})],
    ['participant reply', await board.reply(service, replyArgs)]
  ]) assert.equal(answer.error.code, 'not_authorized', `a board session's ${name} was served`)
  assert.equal(calls.length, 0, 'a refused board-session call reached the board')
  assert.equal((await board.reply(service, { fence: fenceArgs(), body: { text: 'on it' } })).ok, true, 'the responder\'s fenced reply')
  assert.equal((await board.list(service, {})).protocol, 'fabric-project-comms/0.1', 'reading its requests')
  const { BOARD_SESSION_OPERATIONS } = await import('../src/main/boardService.ts')
  assert.deepEqual([...BOARD_SESSION_OPERATIONS].sort(), ['com.accept', 'com.claim', 'com.complete', 'com.effect_begin', 'com.enroll', 'com.get', 'com.list',
    'com.progress', 'com.reconcile', 'com.renew', 'com.reply', 'com.responder_replace', 'com.status'])
})
test('com.enroll\'s description names only routes a session has: no fabric.access.request, the operator\'s Settings → Agent access instead (wave-2 fix 16)', () => {
  const described = new Map()
  registerBoardTools({ registerTool: (name, meta) => described.set(name, meta.description) }, createBoard({ rpc: fake().rpc }), () => responder)
  assert.doesNotMatch(described.get('com.enroll'), /fabric\.access\.request/, 'a tool no project or board session has')
  assert.match(described.get('com.enroll'), /Settings → Agent access/)
  // CO-397 (DEC-0098, DEC-0102): a reply from the request's target answers it; it no longer "stays queued".
  assert.match(described.get('com.enroll'), /com\.reply on the request is still your answer/)
  assert.doesNotMatch(described.get('com.enroll'), /stays queued/)
})
test('DEC-0078: a replace receipt carrying `transferred` reaches the agent, each request once with its revision and attempt; a duplicate or a holder never does', async () => {
  const att = (n) => ({ id: `79000000-0000-4000-8000-0000000000f${n}`, generation: 3, digest: 'sha256:' + 'b'.repeat(64), leaseExpiresAt: '2026-10-13T10:02:00.000Z' })
  const slotOf = { project: caller.projectId, capability: 'x.y', generation: 3, leaseExpiresAt: '2026-10-13T10:02:00.000Z' }
  const transferred = [{ request: M1, revision: 4, attempt: att(1) }, { request: T1, revision: 2, attempt: att(2) }]
  const replaceArgs = { idempotency: { epoch: 1, key: 'replace-00001' }, capability: 'x.y', expectedGeneration: 2, transfer: { requests: [M1, T1], checkpoint: { summary: 'half done' } } }
  const ok = await createBoard({ rpc: fake({ board_responder_replace: { data: { ok: true, repeated: false, slot: slotOf, transferred }, error: null } }).rpc }).responderReplace(responder, replaceArgs)
  assert.deepEqual(ok.transferred, transferred)
  assert.equal(validators['comms-receipt.schema.json'](ok), true, JSON.stringify(validators['comms-receipt.schema.json'].errors))
  for (const bad of [[transferred[0], transferred[0]], [{ ...transferred[0], holder: 'session-1' }], [{ request: M1, attempt: att(1) }], []]) {
    logged.length = 0
    const r = await createBoard({ rpc: fake({ board_responder_replace: { data: { ok: true, repeated: false, slot: slotOf, transferred: bad }, error: null } }).rpc }).responderReplace(responder, replaceArgs)
    assert.equal(r.error?.code, 'not_available', JSON.stringify(bad)); assert.equal(logged.at(-1).op, 'board.receipt-shape')
  }
})

test('DEC-0077: a directory page lists each Project once and each capability once per Project; a page that repeats either never leaves', async () => {
  const P2 = '79000000-0000-4000-8000-000000000012'
  const entry = { id: P2, name: 'analytics', capabilities: [{ capability: 'analytics.retention', responder: 'active' }] }
  for (const projects of [[entry, entry], [{ ...entry, capabilities: [entry.capabilities[0], { ...entry.capabilities[0], responder: 'stale' }] }]]) {
    logged.length = 0
    const r = await createBoard({ rpc: fake({ board_directory: { data: { ok: true, projects, more: false, last: null }, error: null } }).rpc }).directory(caller, {})
    assert.equal(r.error?.code, 'not_available', JSON.stringify(projects)); assert.equal(logged.at(-1).op, 'board.directory-shape')
  }
})
// #endregion project-board-service-w2-fixes

// ── 0.3.9 "the core holds", the board part (docs/evidence/plans/2026-10-21-core-reliability/2026-10-21-board.md BD-1, BD-3, BD-4) ──
// #region board-core-holds — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#board
const KEY = 'ab'.repeat(32)
const reader = (extra = {}) => ({ data: { ok: true, messages: [{ ...fixtures.document('current/positive/comms-page.json').messages[0], read: false }], last_seq: 9, more: true, ...extra }, error: null })

test('BD-3: com.list {unread: true} reads board_list_reader, each message says whether it is read; the plain call keeps the contract page', async () => {
  const { rpc, calls } = fake({ board_cursor_key: { data: { ok: true, key: KEY }, error: null }, board_list_reader: () => reader(),
    board_list: { data: { ok: true, messages: [fixtures.document('current/positive/comms-page.json').messages[0]], last_seq: 3, more: false }, error: null } })
  const board = createBoard({ rpc })
  const page = await board.list(caller, { unread: true, limit: 10 })
  assert.equal(page.messages[0].read, false)
  const asked = calls.find(c => c.fn === 'board_list_reader')
  assert.ok(asked, 'the unread read never reached the board')
  assert.equal(asked.args.p_unread, true); assert.equal(asked.args.p_since, null); assert.equal(asked.args.p_limit, 10)
  const plain = await board.list(caller, {})
  assert.equal(validators['comms-page.schema.json'](plain), true, 'the plain page stays the contract page')
  assert.equal(calls.filter(c => c.fn === 'board_list').length, 1)
  const since = await board.list(caller, { since: '2026-10-20T00:00:00Z' })
  assert.equal(calls.at(-1).args.p_since, '2026-10-20T00:00:00Z'); assert.equal(calls.at(-1).args.p_unread, false)
  assert.ok(Array.isArray(since.messages))
  for (const bad of [{ unread: 'yes' }, { since: 'yesterday' }, { unread: true, estate_id: caller.estateId }])
    assert.equal((await board.list(caller, bad)).error?.code, 'invalid_arguments', JSON.stringify(bad))
})

test('BD-3: a cursor survives a restart: the key is the estate\'s, kept by the board, and stays bound to the reader and the filter', async () => {
  const { rpc } = fake({ board_cursor_key: { data: { ok: true, key: KEY }, error: null }, board_list_reader: () => reader() })
  const first = await createBoard({ rpc }).list(caller, { unread: true })
  assert.match(first.cursor, /^[A-Za-z0-9_-]{8,128}$/)
  const restarted = createBoard({ rpc })
  const next = await restarted.list(caller, { unread: true, cursor: first.cursor })
  assert.equal(next.error, undefined, JSON.stringify(next))
  assert.equal((await restarted.list(caller, { cursor: first.cursor })).error?.code, 'cursor_reset_required', 'the unread filter is part of the audience')
  assert.equal((await restarted.list({ ...caller, projectId: '79000000-0000-4000-8000-000000000012' }, { unread: true, cursor: first.cursor })).error?.code, 'cursor_reset_required')
})

test('BD-3: a key the board cannot give is logged and the run uses its own: cursors still work within the run', async () => {
  logged.length = 0
  const { rpc } = fake({ board_cursor_key: new Error('socket hang up'), board_list_reader: () => reader() })
  const board = createBoard({ rpc })
  const first = await board.list(caller, { unread: true })
  assert.ok(first.cursor)
  assert.equal((await board.list(caller, { unread: true, cursor: first.cursor })).error, undefined)
  assert.ok(logged.some(x => x.outcome === 'failed' && /cursor/.test(JSON.stringify(x))), JSON.stringify(logged))
})

test('BD-4: com.read_ack marks a list of messages or a thread up to a message in one call; one message keeps the contract call', async () => {
  const many = { ok: true, repeated: false, marked: 2, alreadyRead: 1, at: '2026-10-21T07:00:00.000Z' }
  const { rpc, calls } = fake({ board_read_ack_many: { data: many, error: null }, board_read_ack: { data: { ok: true, repeated: false, message: M1, at: '2026-10-21T07:00:00.000Z' }, error: null } })
  const board = createBoard({ rpc })
  const r = await board.readAck(caller, { messages: [M1.toUpperCase(), T1] })
  assert.deepEqual(r, many)
  const call = calls.at(-1)
  assert.equal(call.fn, 'board_read_ack_many'); assert.deepEqual(call.args.p_messages, [M1, T1]); assert.equal(call.args.p_thread, null); assert.equal(call.args.p_up_to, null)
  await board.readAck(caller, { thread: T1, upTo: M1 })
  assert.deepEqual([calls.at(-1).args.p_thread, calls.at(-1).args.p_up_to, calls.at(-1).args.p_messages], [T1, M1, null])
  await board.readAck(caller, { message: M1 })
  assert.equal(calls.at(-1).fn, 'board_read_ack')
  const n = calls.length
  for (const bad of [{}, { messages: [] }, { messages: Array.from({ length: 101 }, () => M1) }, { message: M1, messages: [M1] }, { thread: T1 }, { messages: ['abcdefgh'] }])
    assert.ok(['invalid_arguments', 'not_authorized'].includes((await board.readAck(caller, bad)).error?.code), JSON.stringify(bad))
  assert.equal(calls.length, n, 'a malformed bulk mark reached the board')
  const service = { ...caller, surface: 'board' }
  assert.equal((await board.readAck(service, { messages: [M1] })).error.code, 'not_authorized', 'a board session never clears its Project\'s marks')
})

test('BD-1: a request nobody can answer is accepted with noResponder in its receipt; one somebody can answer is not', async () => {
  const receipt = { ...goodReceipt, request: { id: M1, state: 'queued', effect: 'not_started', revision: 1 } }
  const nobody = await createBoard({ rpc: fake({ board_submit: { data: receipt, error: null }, board_responder_possible: { data: { ok: true, possible: false }, error: null } }).rpc }).submit(caller, submitRequest)
  assert.equal(nobody.ok, true)
  assert.equal(nobody.noResponder.capability, submitRequest.request.capability)
  assert.match(nobody.noResponder.message, /reply/)
  // Review i1 UX-7 / DA-4: nothing can be granted until an agent of the target asks for board.respond; the message says
  // that order instead of "the operator grants".
  assert.match(nobody.noResponder.message, /asks/); assert.doesNotMatch(nobody.noResponder.message, /operator grants/)
  assert.ok(nobody.noResponder.message.length <= 300)
  const somebody = await createBoard({ rpc: fake({ board_submit: { data: receipt, error: null }, board_responder_possible: { data: { ok: true, possible: true }, error: null } }).rpc }).submit(caller, submitRequest)
  assert.equal(somebody.noResponder, undefined)
  logged.length = 0
  const unknown = await createBoard({ rpc: fake({ board_submit: { data: receipt, error: null }, board_responder_possible: new Error('timeout') }).rpc }).submit(caller, submitRequest)
  assert.equal(unknown.ok, true, 'the request was stored; an unreadable check does not undo it'); assert.equal(unknown.noResponder, undefined)
  assert.ok(logged.some(x => x.outcome === 'failed'), 'the unreadable check is logged')
  assert.equal(commsReceiptSchema.safeParse({ ...receipt, request: { ...receipt.request, state: 'answered', revision: 2 } }).success, true, 'answered is a request state')
})

test('BD-1: the tool descriptions say what changed: a target\'s reply answers, unread and since, the bulk mark, noResponder', () => {
  const described = new Map()
  registerBoardTools({ registerTool: (name, meta) => described.set(name, meta.description) }, createBoard({ rpc: fake().rpc }), () => caller)
  assert.match(described.get('com.list'), /unread/); assert.match(described.get('com.list'), /since/); assert.match(described.get('com.list'), /survives/)
  assert.match(described.get('com.read_ack'), /messages/); assert.match(described.get('com.read_ack'), /upTo/)
  assert.match(described.get('com.reply'), /answered/); assert.doesNotMatch(described.get('com.reply'), /no request changes state/)
  assert.match(described.get('com.submit'), /noResponder/); assert.match(described.get('com.submit'), /7 days/)
  // Review i1 DA-4: noResponder and answered reach a caller that never asked for them; the descriptions say they are
  // Fabric's own additions outside the pinned contract, and who receives each.
  assert.match(described.get('com.submit'), /outside the pinned contract/); assert.match(described.get('com.submit'), /without asking/)
  assert.match(described.get('com.get'), /answered/); assert.match(described.get('com.get'), /outside the pinned contract/)
  for (const op of ['com.list', 'com.read_ack', 'com.reply', 'com.submit', 'com.get']) assert.doesNotMatch(described.get(op), /\u2014/, `${op}'s description carries an em dash`)
})
// #endregion board-core-holds
