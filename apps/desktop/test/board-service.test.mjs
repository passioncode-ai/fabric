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
  const { rpc, calls } = fake({ board_submit: { data: { ok: true, message: 'm', thread: 't', seq: 1, repeated: false }, error: null } })
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
    const board = createBoard({ rpc: fake({ board_list: answer, board_submit: answer, board_get: answer, board_unread: answer }).rpc })
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
  const { rpc, calls } = fake({ board_unread: { data: 2, error: null } })
  const status = await createBoard({ rpc }).status(caller)
  assert.equal(validators['comms-status.schema.json'](status), true, JSON.stringify(validators['comms-status.schema.json'].errors))
  assert.equal(status.board.state, 'ready'); assert.equal(status.unread, 2); assert.equal(status.transport.telegram, 'off')
  assert.deepEqual(calls.map(c => c.fn), ['board_unread'])
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
