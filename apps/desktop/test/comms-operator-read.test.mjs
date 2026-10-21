// SCR-81 / SCN-143 — the operator's read path onto the project board, without a database: the SQL door is
// a fake that records every call, so "refused before anything is asked" is observable as "the door was
// never called" (the same seam as board-service.test.mjs).
//
// The two rules under test, both from the scenario's Alt paths: a board that cannot be read answers
// `unavailable` and NEVER an empty list; the board's own refusals (not_found, invalid_arguments) travel
// with their codes, because "a thread the estate does not hold" is said as not found, not as empty.
// #region comms-screen — docs: docs/ux/screens.md#scr-81-project-comms
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
  lastAt: '2026-10-11T08:00:00.000Z',
  kinds: ['message', 'request'],
  openRequests: 1
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

test('a thread row without the aggregates is unavailable — never read as zero open requests (SCN-143, filter slice)', async () => {
  const withoutAggregates = { ...threadRow }
  delete withoutAggregates.kinds
  delete withoutAggregates.openRequests
  const read = createCommsOperatorRead(fake({
    board_threads_operator: { data: { ok: true, threads: [withoutAggregates] }, error: null }
  }))
  const reply = await read.threads(ESTATE)
  assert.equal(reply.ok, false)
  assert.equal(reply.error.code, 'unavailable')
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

// SCN-146 alt path (wave-2 product finding 17): a restored estate whose board history did not come back holds the
// journal's messages but none of their texts. An empty thread list is then not "nothing was said".
test('an empty board over a journal that records messages answers textsMissing with their count; a journal with none, or unreadable, adds nothing', async () => {
  const empty = { board_threads_operator: { data: { ok: true, threads: [] }, error: null } }
  const counted = []
  const missing = await createCommsOperatorRead({ ...fake(empty), journalMessages: async (estate) => { counted.push(estate); return 7 } }).threads(ESTATE)
  assert.deepEqual(missing, { ok: true, threads: [], textsMissing: 7 })
  assert.deepEqual(counted, [ESTATE])
  assert.deepEqual(await createCommsOperatorRead({ ...fake(empty), journalMessages: async () => 0 }).threads(ESTATE), { ok: true, threads: [] })
  assert.deepEqual(await createCommsOperatorRead({ ...fake(empty), journalMessages: async () => null }).threads(ESTATE), { ok: true, threads: [] })
  assert.deepEqual(await createCommsOperatorRead({ ...fake(empty), journalMessages: async () => { throw new Error('down') } }).threads(ESTATE), { ok: true, threads: [] })
  // A board with threads is never second-guessed: the journal is not read at all.
  let asked = false
  await createCommsOperatorRead({ ...fake({ board_threads_operator: { data: { ok: true, threads: [threadRow] }, error: null } }), journalMessages: async () => { asked = true; return 9 } }).threads(ESTATE)
  assert.equal(asked, false)
})

// #region comms-operator-reads-w4 — docs: docs/adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md#8-what-comms-shows-besides
// Wave 4's reads (W4-2; migration 89): each method maps the door's answer field by field. A payload this build cannot
// read is `unavailable`, never an empty answer; the board's refusals travel with their codes; an argument the door
// would refuse is refused here first, so a malformed call never reaches it.
const PROJECT_A = '79000000-0000-4000-8000-000000000011'
const PROJECT_B = '79000000-0000-4000-8000-000000000012'
const REQUEST = '79000000-0000-4000-8000-0000000000c1'
const HASH = 'sha256:' + 'a'.repeat(64)
const pageRow = { ...threadRow, providers: ['claude-code'] }
const answers = {
  board_thread_page_operator: { data: { ok: true, threads: [pageRow], more: true, before: { lastSeq: 9, id: THREAD } }, error: null },
  board_thread_heads_operator: { data: { ok: true, heads: [{ id: THREAD, lastSeq: 9 }], truncated: true }, error: null },
  board_responders_operator: { data: { ok: true, responders: [
    { project: PROJECT_B, capability: 'review', state: 'active', generation: 2, leaseExpiresAt: '2026-10-13T10:00:00.000Z', agent: 'claude-code', cameIn: 'launched', label: 'Claude Code', since: '2026-10-13T09:00:00.000Z' },
    { project: PROJECT_B, capability: 'audit', state: 'absent', generation: 1, releasedCause: 'revoked', releasedAt: '2026-10-13T08:00:00.000Z' }] }, error: null },
  board_message_facts_operator: { data: { ok: true, messages: { [REQUEST]: { readBy: [PROJECT_B] } }, requests: { [REQUEST]: {
    generation: 2, attemptLive: false, lastOp: 'complete', lastCause: 'responder', lastAt: '2026-10-13T09:30:00.000Z',
    outcomes: [{ kind: 'outcome', summary: 'Done.', evidence: [{ id: 'https://example.org/a.csv', contentHash: HASH, label: 'a.csv' }], at: '2026-10-13T09:30:00.000Z', settledBy: 'responder' }] } } }, error: null },
  board_request_timeline_operator: { data: { ok: true, more: false, steps: [{ op: 'claim', from: 'queued', to: 'claimed', effectFrom: 'not_started', effectTo: 'not_started', cause: 'responder', generation: 2, at: '2026-10-13T09:00:00.000Z' }] }, error: null },
  board_related_threads_operator: { data: { ok: true, more: false, threads: [{ id: THREAD, subject: null, why: 'shared-artifact', lastAt: '2026-10-13T09:00:00.000Z' }] }, error: null },
  board_search_operator: { data: { ok: true, hits: [{ message: REQUEST, thread: THREAD, seq: 7, at: '2026-10-13T09:00:00.000Z', sender: PROJECT_A, snippet: 'please review' }], more: true, stoppedEarly: false, before: 7 }, error: null },
  board_pending_operator: { data: { ok: true, more: false, projects: [{ project: PROJECT_B, unread: 3, oldestAt: '2026-10-13T08:00:00.000Z', findings: 1, requests: 1, requestsWithAbsentResponder: 1 }] }, error: null }
}
const reads = read => ({
  threadPage: () => read.threadPage(ESTATE, {}, null, 50),
  heads: () => read.heads(ESTATE),
  responders: () => read.responders(ESTATE),
  facts: () => read.facts(ESTATE, [REQUEST]),
  timeline: () => read.timeline(ESTATE, REQUEST),
  related: () => read.related(ESTATE, THREAD),
  search: () => read.search(ESTATE, 'review', null),
  pending: () => read.pending(ESTATE)
})
const doorOf = { threadPage: 'board_thread_page_operator', heads: 'board_thread_heads_operator', responders: 'board_responders_operator', facts: 'board_message_facts_operator',
  timeline: 'board_request_timeline_operator', related: 'board_related_threads_operator', search: 'board_search_operator', pending: 'board_pending_operator' }

test('W4-2: every new read maps the door\'s answer as the board shaped it', async () => {
  const read = createCommsOperatorRead(fake(answers))
  const r = reads(read)
  assert.deepEqual(await r.threadPage(), { ok: true, threads: [pageRow], more: true, before: { lastSeq: 9, id: THREAD } })
  assert.deepEqual(await r.heads(), { ok: true, heads: [{ id: THREAD, lastSeq: 9 }], truncated: true })
  assert.deepEqual(await r.responders(), { ok: true, responders: answers.board_responders_operator.data.responders })
  assert.deepEqual(await r.facts(), { ok: true, messages: answers.board_message_facts_operator.data.messages, requests: answers.board_message_facts_operator.data.requests })
  assert.deepEqual(await r.timeline(), { ok: true, steps: answers.board_request_timeline_operator.data.steps, more: false })
  assert.deepEqual(await r.related(), { ok: true, threads: answers.board_related_threads_operator.data.threads, more: false })
  assert.deepEqual(await r.search(), { ok: true, hits: answers.board_search_operator.data.hits, more: true, stoppedEarly: false, before: 7 })
  assert.deepEqual(await r.pending(), { ok: true, projects: answers.board_pending_operator.data.projects, more: false })
})

test('W4-2: a door that does not answer, or answers a shape this build cannot read, is unavailable — never an empty answer', async () => {
  const malformed = {
    board_thread_page_operator: { ok: true, threads: [{ ...pageRow, providers: 'claude-code' }], more: false, before: null },
    board_thread_heads_operator: { ok: true, heads: [{ id: THREAD }], truncated: false },
    board_responders_operator: { ok: true, responders: [{ project: PROJECT_B, capability: 'review' }] },
    board_message_facts_operator: { ok: true, messages: {}, requests: { [REQUEST]: { attemptLive: false, outcomes: [{ kind: 'mystery', evidence: [], at: 'x' }] } } },
    board_request_timeline_operator: { ok: true, steps: [{ op: 'claim' }], more: false },
    board_related_threads_operator: { ok: true, threads: [{ id: THREAD, subject: null, why: 'similar', lastAt: null }], more: false },
    board_search_operator: { ok: true, hits: [{ message: REQUEST }], more: false, stoppedEarly: false },
    board_pending_operator: { ok: true, projects: [{ project: PROJECT_B, unread: '3' }], more: false }
  }
  for (const [name, door] of Object.entries(doorOf)) {
    for (const answer of [new Error('socket hang up'), { data: null, error: { message: 'Could not find the function' } }, { data: 'garbage', error: null }, { data: malformed[door], error: null }, { data: { ok: true }, error: null }]) {
      const reply = await reads(createCommsOperatorRead(fake({ [door]: answer })))[name]()
      assert.equal(reply.ok, false, `${name}: ${JSON.stringify(answer)}`)
      assert.equal(reply.error.code, 'unavailable', `${name}: ${JSON.stringify(reply)}`)
    }
  }
})

test('W4-2: the board\'s refusals travel with their codes and messages', async () => {
  for (const [name, door] of Object.entries(doorOf)) {
    for (const code of ['not_found', 'invalid_arguments']) {
      const reply = await reads(createCommsOperatorRead(fake({ [door]: { data: { error: { code, message: `the board said ${code}` } }, error: null } })))[name]()
      assert.deepEqual(reply, { ok: false, error: { code, message: `the board said ${code}` } }, name)
    }
  }
})

test('W4-2: a call the door would refuse is refused here, and the door is never asked', async () => {
  const { rpc, calls } = fake(answers)
  const read = createCommsOperatorRead({ rpc })
  const refused = async (p) => { const r = await p; assert.equal(r.ok, false); assert.equal(r.error.code, 'invalid_arguments', JSON.stringify(r)) }
  await refused(read.threadPage(ESTATE, { other: true }, null, 50))
  await refused(read.threadPage(ESTATE, { project: 'not-a-uuid' }, null, 50))
  await refused(read.threadPage(ESTATE, { openOnly: 'yes' }, null, 50))
  await refused(read.threadPage(ESTATE, {}, { lastSeq: -1, id: THREAD }, 50))
  await refused(read.threadPage(ESTATE, {}, { lastSeq: 1, id: 'x' }, 50))
  await refused(read.threadPage(ESTATE, null, null, 50))
  await refused(read.facts(ESTATE, Array.from({ length: 101 }, () => REQUEST)))
  await refused(read.facts(ESTATE, ['not-a-uuid']))
  await refused(read.timeline(ESTATE, 'x'))
  await refused(read.related(ESTATE, ''))
  await refused(read.search(ESTATE, 'x', null))
  await refused(read.search(ESTATE, 'y'.repeat(201), null))
  await refused(read.search(ESTATE, 'review', 0))
  assert.equal(calls.length, 0, 'nothing reached the board')
  // The page limit is the board's own cap; the filter goes through as given.
  await read.threadPage(ESTATE, { kind: 'request', openOnly: true }, { lastSeq: 9, id: THREAD }, 500)
  assert.deepEqual(calls.at(-1), { fn: 'board_thread_page_operator', args: { p_estate: ESTATE, p_filter: { kind: 'request', openOnly: true }, p_before: { lastSeq: 9, id: THREAD }, p_limit: 100 } })
  await read.facts(ESTATE, [])
  assert.equal(calls.at(-1).fn, 'board_message_facts_operator', 'an empty list is asked as it is')
})

test('W4-2: the first unfiltered page of an empty board over a journal that records messages answers textsMissing (SCN-146)', async () => {
  const empty = { board_thread_page_operator: { data: { ok: true, threads: [], more: false, before: null }, error: null } }
  const read = createCommsOperatorRead({ ...fake(empty), journalMessages: async () => 4 })
  assert.deepEqual(await read.threadPage(ESTATE, {}, null, 50), { ok: true, threads: [], more: false, before: null, textsMissing: 4 })
  // A filtered or later page that is empty is the filter's answer, never "the texts did not come back".
  assert.deepEqual(await read.threadPage(ESTATE, { kind: 'finding' }, null, 50), { ok: true, threads: [], more: false, before: null })
  assert.deepEqual(await read.threadPage(ESTATE, {}, { lastSeq: 3, id: THREAD }, 50), { ok: true, threads: [], more: false, before: null })
})

test('W4-2 (comms:open-artifact): only an https link opens; javascript:, file:, data:, http: and garbage are refused and never opened', async () => {
  const opened = []
  const read = createCommsOperatorRead({ ...fake(), openExternal: async (url) => { opened.push(url) } })
  assert.deepEqual(await read.openArtifact('https://example.org/report.pdf'), { ok: true })
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,<b>x</b>', 'http://example.org/a', 'not a url', '', 'HTTPS', 42, null]) {
    assert.deepEqual(await read.openArtifact(url), { ok: false, reason: 'refused' }, String(url))
  }
  assert.deepEqual(opened, ['https://example.org/report.pdf'])
  const failing = createCommsOperatorRead({ ...fake(), openExternal: async () => { throw new Error('no browser') } })
  assert.deepEqual(await failing.openArtifact('https://example.org/x'), { ok: false, reason: 'failed' })
  assert.deepEqual(await createCommsOperatorRead(fake()).openArtifact('https://example.org/x'), { ok: false, reason: 'failed' }, 'no opener wired is a failure, not a success')
})
// #endregion comms-operator-reads-w4

// ── 0.3.9 "the core holds" (docs/evidence/plans/2026-10-21-core-reliability/board.md BD-2, BD-5) ─────────────────
// #region board-core-holds — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#board
const { useOps } = await import('../src/main/opsSink.ts')
const logged = []
useOps({ correlate: () => 'test', record: (r) => logged.push(r), begin: () => () => {}, read: () => [], file: () => null, lost: () => 0 })

test('BD-2: waiting reads requests nobody answers and unread board messages, each with its oldest; a bad shape is unavailable', async () => {
  const good = { ok: true, requests: 6, oldestRequestAt: '2026-10-16T12:48:00.000Z', unread: 3084, oldestUnreadAt: '2026-10-16T12:48:00.000Z' }
  const { rpc, calls } = fake({ board_waiting_operator: { data: good, error: null } })
  assert.deepEqual(await createCommsOperatorRead({ rpc }).waiting(ESTATE), good)
  assert.deepEqual(calls, [{ fn: 'board_waiting_operator', args: { p_estate: ESTATE } }])
  const none = { ok: true, requests: 0, unread: 0 }
  assert.deepEqual(await createCommsOperatorRead(fake({ board_waiting_operator: { data: none, error: null } })).waiting(ESTATE), none)
  for (const bad of [{ ok: true, requests: '6', unread: 0 }, { ok: true, requests: 1, unread: 0 }, { ok: true, requests: -1, unread: 0 }, { ok: true, unread: 0 }])
    assert.equal((await createCommsOperatorRead(fake({ board_waiting_operator: { data: bad, error: null } })).waiting(ESTATE)).ok, false, JSON.stringify(bad))
})

test('BD-5: a read that fails is recorded with its door and why: once per change on a poll, and again after it recovered', async () => {
  let answer = { data: null, error: { message: 'Could not find the function board_thread_heads_operator' } }
  const read = createCommsOperatorRead({ rpc: async () => answer })
  logged.length = 0
  for (let i = 0; i < 5; i++) assert.equal((await read.heads(ESTATE)).ok, false)
  const failures = () => logged.filter(r => r.outcome === 'failed')
  assert.equal(failures().length, 1, 'a 5 s poll failing the same way is one record, not one per tick')
  assert.match(JSON.stringify(failures()[0]), /board_thread_heads_operator/)
  answer = { data: 'garbage', error: null }
  await read.heads(ESTATE)
  assert.equal(failures().length, 2, 'a different failure is a new record')
  answer = { data: { ok: true, heads: [], truncated: false }, error: null }
  assert.equal((await read.heads(ESTATE)).ok, true)
  assert.equal(failures().length, 2, 'success is not a failure')
  assert.ok(logged.some(r => r.outcome === 'ok' && /recovered/.test(JSON.stringify(r))), 'the recovery is said once')
  answer = { data: null, error: { message: 'Could not find the function board_thread_heads_operator' } }
  await read.heads(ESTATE)
  assert.equal(failures().length, 3, 'a failure after a recovery is recorded again')
  // The older reads too: the thread list and the page.
  logged.length = 0
  const old = createCommsOperatorRead(fake({ board_threads_operator: { data: { ok: true, threads: 'x' }, error: null }, board_list_operator: { data: null, error: { message: 'timeout' } } }))
  assert.equal((await old.threads(ESTATE)).ok, false); assert.equal((await old.list(ESTATE, null, 0)).ok, false)
  assert.equal(failures().length, 2, JSON.stringify(logged))
  // The board's own refusal is an answer, not a failure of the read path.
  logged.length = 0
  await createCommsOperatorRead(fake({ board_pending_operator: { data: { error: { code: 'invalid_arguments', message: 'no' } }, error: null } })).pending(ESTATE)
  assert.equal(failures().length, 0)
})
// #endregion board-core-holds
