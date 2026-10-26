// 0.3.14 wave 2: a new session sees what waits. In the live audit of 2026-10-26 the sweep found 44 unread board answers
// and 16 to 18 unmoved requests, and `fabric_whoami`, the first call of every session, said nothing of them. Pure: the
// board's reader page and the questions read are stand-ins with the shapes `agentSurface.ts` gives them.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { readWaiting, WAITING_ITEMS } = await import(path.resolve(import.meta.dirname, '../src/main/sessionWaiting.ts'))

const NOW = Date.parse('2026-10-26T12:00:00Z')
const ME = 'p-me'
const msg = (id, over = {}) => ({ id, thread: 'th', kind: 'message', sender: { project: 'p-other', principal: null }, at: '2026-10-26T11:00:00Z', digest: 'd', body: { text: `text of ${id}` }, read: true, ...over })
const request = (id, over = {}) => msg(id, { kind: 'request', request: { id, target: ME, capability: 'review.code', state: 'queued', effect: 'none', revision: 1 }, ...over })

function pages(...lists) {
  const asked = []
  return {
    asked,
    listPage: async (args) => {
      asked.push(args)
      const i = args.cursor ? Number(args.cursor) : 0
      return { messages: lists[i] ?? [], cursor: i + 1 < lists.length ? String(i + 1) : null }
    }
  }
}

test('waiting: the queued requests addressed to this project, up to five lines each with its id, and the count of all', async () => {
  const many = Array.from({ length: 7 }, (_, i) => request(`r${i}`))
  const answered = request('r-done', { request: { id: 'r-done', target: ME, capability: 'x', state: 'answered', effect: 'none', revision: 2 } })
  const toOther = request('r-other', { request: { id: 'r-other', target: 'p-third', capability: 'x', state: 'queued', effect: 'none', revision: 1 } })
  const b = pages([...many, answered, toOther])
  const w = await readWaiting({ projectId: ME, now: NOW, listPage: b.listPage, openQuestions: async () => [] })
  assert.equal(w.board_requests.read, true)
  assert.equal(w.board_requests.queued, 7)
  assert.equal(w.board_requests.items.length, WAITING_ITEMS)
  assert.equal(w.board_requests.items[0], 'r0: from p-other (review.code): text of r0')
  assert.deepEqual(b.asked[0], { since: '2026-10-19T12:00:00.000Z', limit: 100 }, 'the last seven days, when a request with no deadline expires')
})

test('waiting: the unread answers to requests this project sent are counted; read ones and others\' are not', async () => {
  const mine = request('q1', { sender: { project: ME, principal: null }, request: { id: 'q1', target: 'p-other', capability: 'x', state: 'answered', effect: 'none', revision: 2 } })
  const mine2 = request('q2', { sender: { project: ME, principal: null }, request: { id: 'q2', target: 'p-other', capability: 'x', state: 'answered', effect: 'none', revision: 2 } })
  const b = pages([mine, mine2], [msg('a1', { kind: 'reply', replyTo: 'q1', read: false }), msg('a2', { kind: 'reply', replyTo: 'q2', read: true }),
    msg('a3', { kind: 'reply', replyTo: 'elsewhere', read: false }), msg('a4', { kind: 'reply', replyTo: 'q2', read: false, sender: { project: ME, principal: null } })])
  const w = await readWaiting({ projectId: ME, now: NOW, listPage: b.listPage, openQuestions: async () => [] })
  assert.deepEqual(w.board_answers, { read: true, unread: 1 })
  assert.equal(b.asked.length, 2, 'paged with the cursor')
})

test('waiting: the open questions, up to five lines each with its id, and the count', async () => {
  const qs = Array.from({ length: 6 }, (_, i) => ({ id: `qq${i}`, text: `Which database\n  version ${i}?` }))
  const w = await readWaiting({ projectId: ME, now: NOW, listPage: pages([]).listPage, openQuestions: async () => qs })
  assert.equal(w.questions.read, true)
  assert.equal(w.questions.open, 6)
  assert.deepEqual(w.questions.items, ['qq0: Which database version 0?', 'qq1: Which database version 1?', 'qq2: Which database version 2?', 'qq3: Which database version 3?', 'qq4: Which database version 4?'])
})

test('waiting: a read that fails says unread with its reason, never zero; the other parts still answer', async () => {
  const refused = async () => ({ error: { code: 'not_available', message: 'The board could not be read.' } })
  const w = await readWaiting({ projectId: ME, now: NOW, listPage: refused, openQuestions: async () => { throw new Error('the questions could not be read: refused') } })
  assert.deepEqual(w.board_requests, { read: false, reason: 'The board could not be read.' })
  assert.deepEqual(w.board_answers, { read: false, reason: 'The board could not be read.' })
  assert.deepEqual(w.questions, { read: false, reason: 'the questions could not be read: refused' })
  const thrown = await readWaiting({ projectId: ME, now: NOW, listPage: async () => { throw new Error('rpc down') }, openQuestions: async () => [] })
  assert.equal(thrown.board_requests.read, false)
  assert.equal(thrown.questions.open, 0)
})

test('waiting: a board longer than the bound says its counts are at least, never all', async () => {
  const b = pages([request('r1')], [request('r2')], [request('r3')], [request('r4')])
  const w = await readWaiting({ projectId: ME, now: NOW, listPage: b.listPage, openQuestions: async () => [] })
  assert.equal(b.asked.length, 9, 'bounded to three pages a window: the week, the newest day, the newest hour')
  assert.equal(w.board_requests.queued, 3)
  assert.equal(w.board_requests.more, true)
  assert.equal(w.board_answers.more, true)
  assert.match(w.note, /com\.reply/)
  assert.doesNotMatch(JSON.stringify(w), /\u2014/)
})

// The 0.3.14 review, iteration 1: DA-4 and ER-10, the newest requests are the ones counted; DA-3, the window is named;
// ER-9, a read past its deadline says so and whoami still answers.
/** A reader door that honours `since` and pages oldest first by `at`, a hundred to a page, like `board_list_reader`. */
function board(messages) {
  const asked = []
  const sorted = [...messages].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return {
    asked,
    listPage: async (args) => {
      asked.push(args)
      const inWindow = sorted.filter((m) => Date.parse(m.at) >= Date.parse(args.since))
      const from = args.cursor ? Number(args.cursor) : 0
      const page = inWindow.slice(from, from + args.limit)
      return { messages: page, cursor: from + args.limit < inWindow.length ? String(from + args.limit) : null }
    }
  }
}

test('DA-4, ER-10: on a board longer than the bound, the newest queued request is counted and named first', async () => {
  const old = Array.from({ length: 350 }, (_, i) => msg(`m${i}`, { at: new Date(NOW - 5 * 24 * 3600_000 + i * 60_000).toISOString() }))
  const mine = request('q-old', { sender: { project: ME, principal: null }, at: new Date(NOW - 6 * 24 * 3600_000).toISOString(),
    request: { id: 'q-old', target: 'p-other', capability: 'x', state: 'answered', effect: 'none', revision: 2 } })
  const fresh = request('r-new', { at: new Date(NOW - 30 * 60_000).toISOString() })
  const answer = msg('a-new', { kind: 'reply', replyTo: 'q-old', read: false, at: new Date(NOW - 20 * 60_000).toISOString() })
  const b = board([...old, mine, fresh, answer])
  const w = await readWaiting({ projectId: ME, now: NOW, listPage: b.listPage, openQuestions: async () => [] })
  assert.equal(w.board_requests.queued, 1)
  assert.match(w.board_requests.items[0], /^r-new:/)
  assert.equal(w.board_requests.more, true, 'some of the week was not read')
  assert.equal(w.board_answers.unread, 1, 'the answer read in the newest day names its request read in the week')
  assert.equal(w.window_days, 7)
  assert.match(w.note, /last 7 days/)
})

test('ER-9: a part past its deadline says timeout and whoami answers; the others still answer', async () => {
  const hang = () => new Promise(() => {})
  const started = Date.now()
  const w = await readWaiting({ projectId: ME, now: NOW, listPage: hang, openQuestions: async () => [{ id: 'q1', text: 'Which?' }], deadlineMs: 50 })
  assert.ok(Date.now() - started < 2000)
  assert.deepEqual(w.board_requests, { read: false, reason: 'timeout' })
  assert.deepEqual(w.board_answers, { read: false, reason: 'timeout' })
  assert.equal(w.questions.open, 1)
  const q = await readWaiting({ projectId: ME, now: NOW, listPage: pages([]).listPage, openQuestions: hang, deadlineMs: 50 })
  assert.deepEqual(q.questions, { read: false, reason: 'timeout' })
  assert.equal(q.board_requests.queued, 0)
})
