// The Board's three reads as their own module (the screens waves, S2, 2026-11-16; `src/main/boardReads.ts`): what
// waits on the person, answered and set aside. Each source answers its own receipt: a failed read is said in the
// envelope, never shown as an empty board; set-aside questions do not wait; personOnly keeps what a person resolves.
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

const { createBoardReads } = await import(path.resolve(import.meta.dirname, '../src/main/boardReads.ts'))
const NOW = new Date('2026-11-16T12:00:00Z')

/** A store that answers each table from `tables` (rows, or an error message), whatever the filters. */
function fakeStore(tables) {
  const answer = (t) => (typeof tables[t] === 'string' ? { data: null, error: { message: tables[t] } } : { data: tables[t] ?? [], error: null })
  const builder = (t) => {
    const b = { eq: () => b, order: () => b, limit: () => b, in: () => b, then: (ok, ko) => Promise.resolve(answer(t)).then(ok, ko) }
    return b
  }
  return {
    select: (t) => builder(t),
    selectIn: async (t, _c, _k, ids) => (typeof tables[t] === 'string' ? { rows: [], failed: tables[t] } : { rows: (tables[t] ?? []).filter((r) => ids.includes(r.id ?? r.owner_session)), failed: null })
  }
}
const q = (id, over = {}) => ({ id, project_id: 'p1', text: `question ${id}`, why_blocked: null, kind: 'decision', asked_at: '2026-11-16T10:00:00Z', status: 'open', revision: 1, options: [], asked_by_kind: 'person', asked_by_id: 'op', ...over })
const attention = async () => ({ items: [], sources: [{ name: 'reviews', status: 'ok', asOf: NOW.toISOString() }] })

test('open questions wait on the person, set-aside ones do not, each named by its project', async () => {
  const reads = createBoardReads({ estateId: 'e1', attention, now: () => NOW,
    store: fakeStore({ questions: [q('q1'), q('q2')], question_blocks: [{ question_id: 'q1' }], projects: [{ id: 'p1', name: 'Atlas', priority_tier: 'normal' }], question_deferrals: [{ question_id: 'q2' }] }) })
  const read = await reads.board(null, 10)
  assert.equal(read.data.items.length, 1)
  assert.match(JSON.stringify(read.data.items[0]), /question q1/)
  assert.match(JSON.stringify(read.data.items[0]), /Atlas/)
  assert.deepEqual(read.sources.map((s) => [s.name, s.status]), [['reviews', 'ok'], ['questions', 'ok'], ['blocks', 'ok'], ['projects', 'ok'], ['deferrals', 'ok']])
})

test('a source that fails is an error receipt, and the rows that did answer stay', async () => {
  const reads = createBoardReads({ estateId: 'e1', attention, now: () => NOW,
    store: fakeStore({ questions: [q('q1')], question_blocks: [], projects: 'permission denied', question_deferrals: [] }) })
  const read = await reads.board(null, 10)
  assert.equal(read.data.items.length, 1)
  const projects = read.sources.find((s) => s.name === 'projects')
  assert.equal(projects.status, 'error')
  assert.equal(projects.errorCode, 'permission denied')
})

test('answered and set-aside lists read with their own receipts', async () => {
  const reads = createBoardReads({ estateId: 'e1', attention, now: () => NOW,
    store: fakeStore({ questions: [{ ...q('q3'), status: 'answered', answered_at: '2026-11-16T11:00:00Z', answer: 'yes', chosen_option: null, answered_by_kind: 'person' }],
      projects: [{ id: 'p1', name: 'Atlas' }], question_deferrals: [{ question_id: 'q3', reason: 'later', deferred_at: '2026-11-16T09:00:00Z' }] }) })
  const resolved = await reads.resolved('p1', 50)
  assert.deepEqual(resolved.sources.map((s) => [s.name, s.status]), [['questions', 'ok'], ['projects', 'ok']])
  const deferred = await reads.deferred(null, 50)
  assert.deepEqual(deferred.sources.map((s) => [s.name, s.status]), [['deferrals', 'ok'], ['questions', 'ok'], ['projects', 'ok']])
})

// 0.3.22 review, iteration 1, DA-1: a remote run's question is asked by `dispatch-run:<launch>`, not a session uuid.
// `work_claims.owner_session` is a uuid, so the database refuses a read whose list holds such an id: the other agent
// questions lost their askers' names, unsaid. The store here refuses as PostgREST does (invalid input for type uuid).
test('a remote run\'s asker id never reaches the uuid read: the other askers keep their names, nothing fails', async () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const session = '6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b'
  const store = fakeStore({ questions: [q('q1', { asked_by_kind: 'agent', asked_by_id: session }), q('q2', { asked_by_kind: 'agent', asked_by_id: 'dispatch-run:launch-7' })],
    question_blocks: [], projects: [{ id: 'p1', name: 'Atlas', priority_tier: 'normal' }], question_deferrals: [], work_claims: [{ owner_session: session, agent: 'claude-code' }] })
  const selectIn = store.selectIn
  store.selectIn = async (t, c, k, ids) => (t === 'work_claims' && ids.some((id) => !UUID.test(id)) ? { rows: [], failed: 'invalid input syntax for type uuid' } : selectIn(t, c, k, ids))
  const failures = []
  const reads = createBoardReads({ estateId: 'e1', attention, now: () => NOW, store, failed: (op, e) => failures.push([op, e.message]) })
  const read = await reads.board(null, 10)
  const named = Object.fromEntries(read.data.items.filter((i) => i.askedBy).map((i) => [i.title.replace('question ', ''), i.askedBy.agent]))
  assert.equal(named.q1, 'claude-code', 'the session\'s question lost its asker\'s name')
  assert.equal(named.q2, null)
  assert.deepEqual(failures, [])
})

test('a failed read of the askers leaves them unnamed and is said in the operations log', async () => {
  const session = '6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b'
  const failures = []
  const reads = createBoardReads({ estateId: 'e1', attention, now: () => NOW, failed: (op, e) => failures.push([op, e.message]),
    store: fakeStore({ questions: [q('q1', { asked_by_kind: 'agent', asked_by_id: session })], question_blocks: [], projects: [], question_deferrals: [], work_claims: 'permission denied' }) })
  const read = await reads.board(null, 10)
  assert.equal(read.data.items.length, 1)
  assert.deepEqual(failures, [['board.read-askers', 'permission denied']])
})
