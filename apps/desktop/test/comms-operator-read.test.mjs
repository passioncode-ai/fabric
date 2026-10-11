// SCR-77 / SCN-137 — the operator's read path onto the project board, without a database: the SQL door is
// a fake that records every call, so "refused before anything is asked" is observable as "the door was
// never called" (the same seam as board-service.test.mjs).
//
// The two rules under test, both from the scenario's Alt paths: a board that cannot be read answers
// `unavailable` and NEVER an empty list; the board's own refusals (not_found, invalid_arguments) travel
// with their codes, because "a thread the estate does not hold" is said as not found, not as empty.
// #region comms-screen — docs: docs/ux/screens.md#scr-77-project-comms
import assert from 'node:assert/strict'
import test from 'node:test'
import { createCommsOperatorRead } from '../src/main/commsOperatorRead.ts'

const ESTATE = '79000000-0000-4000-8000-000000000001'
const THREAD = '79000000-0000-4000-8000-0000000000d1'

const fake = (answers = {}) => {
  const calls = []
  const rpc = async (fn, args) => {
    calls.push({ fn, args })
    const a = answers[fn]
    if (a instanceof Error) throw a
    return typeof a === 'function' ? a(args) : (a ?? { data: null, error: { message: 'no answer' } })
  }
  return { rpc, calls }
}

const threadRow = {
  id: THREAD,
  subject: 'Cutover plan',
  participants: ['79000000-0000-4000-8000-000000000011', '79000000-0000-4000-8000-000000000012'],
  createdBy: '79000000-0000-4000-8000-000000000011',
  createdSeq: 3,
  messageCount: 2,
  lastSeq: 9,
  lastAt: '2026-10-11T08:00:00.000Z'
}

const messageRow = {
  id: '79000000-0000-4000-8000-0000000000c1',
  thread: THREAD,
  kind: 'request',
  sender: { project: '79000000-0000-4000-8000-000000000011', principal: { kind: 'agent', id: 'session-1', label: 'Claude Code', provenance: 'trusted' } },
  at: '2026-10-11T08:00:00.000Z',
  digest: 'sha256:' + '0'.repeat(64),
  body: { text: 'Please review the cutover', format: 'text/plain' },
  request: { id: '79000000-0000-4000-8000-0000000000c1', target: '79000000-0000-4000-8000-000000000012', capability: 'review', state: 'queued', effect: 'not_started', revision: 1 }
}

test('a board that cannot be read answers unavailable — never an empty list, never ok', async () => {
  for (const answer of [new Error('socket hang up'), { data: null, error: { message: 'timeout' } }, { data: 'garbage', error: null }]) {
    const read = createCommsOperatorRead(fake({ board_threads_operator: answer, board_list_operator: answer }))
    const threads = await read.threads(ESTATE)
    assert.equal(threads.ok, false)
    assert.equal(threads.error.code, 'unavailable')
    assert.equal(threads.threads, undefined, 'an unread board is not an empty list')
    const page = await read.list(ESTATE, THREAD, 0, 50)
    assert.equal(page.ok, false)
    assert.equal(page.error.code, 'unavailable')
    assert.equal(page.messages, undefined)
  }
})

test('a missing function (the migration not applied) is unavailable, not empty', async () => {
  const read = createCommsOperatorRead(fake({ board_threads_operator: { data: null, error: { message: 'Could not find the function public.board_threads_operator' } } }))
  const reply = await read.threads(ESTATE)
  assert.equal(reply.ok, false)
  assert.equal(reply.error.code, 'unavailable')
})

test('an empty list is a true answer the board gave, and only the board may give it', async () => {
  const read = createCommsOperatorRead(fake({ board_threads_operator: { data: { ok: true, threads: [] }, error: null } }))
  const reply = await read.threads(ESTATE)
  assert.equal(reply.ok, true)
  assert.deepEqual(reply.threads, [])
})

test('the board’s refusals travel with their codes: not_found is not empty, invalid_arguments is not unavailable', async () => {
  const read = createCommsOperatorRead(fake({
    board_list_operator: { data: { error: { code: 'not_found', message: 'That thread is not part of this estate.' } }, error: null }
  }))
  const missing = await read.list(ESTATE, THREAD, 0, 50)
  assert.equal(missing.ok, false)
  assert.equal(missing.error.code, 'not_found')
  assert.equal(missing.error.message, 'That thread is not part of this estate.')
  assert.equal(missing.messages, undefined, 'not found is not an empty page')
})

test('an invalid cursor is refused before the door is called', async () => {
  const { rpc, calls } = fake()
  const read = createCommsOperatorRead({ rpc })
  for (const afterSeq of [-1, 1.5, Number.NaN]) {
    const reply = await read.list(ESTATE, THREAD, afterSeq, 50)
    assert.equal(reply.ok, false)
    assert.equal(reply.error.code, 'invalid_arguments')
  }
  assert.equal(calls.length, 0, 'nothing reached the board')
})

test('a page is the board’s own paging contract: cursor in, cursor out, limit bounded at 100', async () => {
  const { rpc, calls } = fake({
    board_list_operator: (args) => ({ data: { ok: true, messages: [messageRow], last_seq: args.p_after_seq + 7, more: true }, error: null })
  })
  const read = createCommsOperatorRead({ rpc })
  const page = await read.list(ESTATE, THREAD, 12, 500)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].args, { p_estate_id: ESTATE, p_thread: THREAD, p_after_seq: 12, p_limit: 100 }, 'the limit is the board’s own cap')
  assert.equal(page.ok, true)
  assert.equal(page.lastSeq, 19, 'the cursor to continue from, unchanged')
  assert.equal(page.more, true)
  const [m] = page.messages
  assert.equal(m.kind, 'request')
  assert.equal(m.sender.principal.provenance, 'trusted')
  assert.equal(m.request.state, 'queued')
  assert.equal(m.request.effect, 'not_started', 'state and effect stay two facts')
  const next = await read.list(ESTATE, THREAD, page.lastSeq, 50)
  assert.equal(calls.at(-1).args.p_after_seq, 19, 'polling continues from the cursor')
  assert.equal(next.ok, true)
})

test('threads and messages in a shape this build cannot read are unavailable, not rendered by accident', async () => {
  const read = createCommsOperatorRead(fake({
    board_threads_operator: { data: { ok: true, threads: [{ id: THREAD }] }, error: null },
    board_list_operator: { data: { ok: true, messages: [{ id: 'm', thread: THREAD }], last_seq: 1, more: false }, error: null }
  }))
  const threads = await read.threads(ESTATE)
  assert.equal(threads.ok, false)
  assert.equal(threads.error.code, 'unavailable')
  const page = await read.list(ESTATE, THREAD, 0, 50)
  assert.equal(page.ok, false)
  assert.equal(page.error.code, 'unavailable')
})

test('a redacted message keeps its place, id and digest, and says its body was removed', async () => {
  const redacted = { ...messageRow, kind: 'message', request: undefined, body: undefined, redacted: true }
  delete redacted.request
  delete redacted.body
  const read = createCommsOperatorRead(fake({
    board_list_operator: { data: { ok: true, messages: [redacted], last_seq: 9, more: false }, error: null }
  }))
  const page = await read.list(ESTATE, THREAD, 0, 50)
  assert.equal(page.ok, true)
  assert.equal(page.messages[0].redacted, true)
  assert.equal(page.messages[0].body, undefined)
  assert.equal(page.messages[0].digest, messageRow.digest)
})

test('threads come back as the board shaped them', async () => {
  const read = createCommsOperatorRead(fake({ board_threads_operator: { data: { ok: true, threads: [threadRow] }, error: null } }))
  const reply = await read.threads(ESTATE)
  assert.equal(reply.ok, true)
  assert.deepEqual(reply.threads, [threadRow])
})
// #endregion comms-screen
