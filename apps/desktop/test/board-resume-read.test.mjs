// §3.11 of the on-demand spec (2026-11-16): the board supervisor's reads, over a stand-in of the scoped store.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { readResumeCandidates, readResumeState, RELEASES_READ, resumeSince } = await import(path.resolve(import.meta.dirname, '../src/main/boardResumeRead.ts'))

const NOW = Date.parse('2026-11-16T18:00:00Z')
const MIN = 60_000
const ago = (ms) => new Date(NOW - ms).toISOString()

/** A query builder over rows: every filter the reader uses, applied in memory; `fail` names a table that refuses. */
function store(tables, fail = null) {
  const select = (table) => {
    let rows = [...(tables[table] ?? [])]
    const q = {
      eq(c, v) { rows = rows.filter((r) => r[c] === v); return q },
      in(c, vs) { rows = rows.filter((r) => vs.includes(r[c])); return q },
      gte(c, v) { rows = rows.filter((r) => r[c] !== null && r[c] >= v); return q },
      lte(c, v) { rows = rows.filter((r) => r[c] !== null && r[c] <= v); return q },
      order(c, o) { rows.sort((a, b) => (o?.ascending === false ? -1 : 1) * String(a[c]).localeCompare(String(b[c]))); return q },
      limit(n) { rows = rows.slice(0, n); return q },
      then(ok, ko) { return Promise.resolve(table === fail ? { data: null, error: { message: 'refused' } } : { data: rows, error: null }).then(ok, ko) }
    }
    return q
  }
  return {
    select: (table) => select(table),
    async selectIn(table, _cols, column, values, _chunk, _signal, eq = []) {
      if (table === fail) return { rows: [], failed: 'refused' }
      return { rows: (tables[table] ?? []).filter((r) => values.includes(r[column]) && eq.every(([c, v]) => r[c] === v)), failed: null }
    }
  }
}

const claim = (work_id, claimed, released, how) => ({ work_id, claimed_at: claimed, released_at: released, released_how: how })
const task = (id, over = {}) => ({ id, project_id: 'p-1', title: `task ${id}`, instruction: null, status: 'backlog', moved_at: ago(30 * MIN), started_at: ago(2 * 60 * MIN), moved_by_kind: 'system', ...over })

test('§3.11: releases of the week that left work are read with each task\'s newest claim, column and open questions', async () => {
  const s = store({
    work_claims: [
      claim('a', ago(90 * MIN), ago(30 * MIN), 'session-ended'),
      claim('b', ago(90 * MIN), ago(40 * MIN), 'let-go'), claim('b', ago(20 * MIN), null, null), // taken again since
      claim('c', ago(90 * MIN), ago(5 * MIN), 'lapsed'), // inside the grace: not read
      claim('d', ago(90 * MIN), ago(30 * MIN), 'done'), // finished: not read
      claim('e', ago(9 * 24 * 60 * MIN), ago(8 * 24 * 60 * MIN), 'let-go') // past the week: not read
    ],
    project_tasks: [task('a'), task('b'), task('c'), task('d'), task('e')],
    questions: [{ task_id: 'a', status: 'answered' }]
  })
  const r = await readResumeCandidates(s, NOW)
  assert.equal(r.capped, false)
  assert.deepEqual(r.candidates.map((c) => c.taskId).sort(), ['a', 'b'])
  const a = r.candidates.find((c) => c.taskId === 'a')
  assert.deepEqual(a.lastClaim, { claimedAt: ago(90 * MIN), releasedAt: ago(30 * MIN), how: 'session-ended', runtimeSessionId: null, workflowId: null })
  assert.equal(a.openQuestion, false, 'an answered question does not hold the task')
  assert.equal(r.candidates.find((c) => c.taskId === 'b').lastClaim.releasedAt, null, 'the newest claim is the live one')
})

test('§3.11: an open question names the task; a refused read throws, never «nothing to continue»; a full read is capped', async () => {
  const base = { work_claims: [claim('a', ago(90 * MIN), ago(30 * MIN), 'let-go')], project_tasks: [task('a')], questions: [{ task_id: 'a', status: 'open' }] }
  assert.equal((await readResumeCandidates(store(base), NOW)).candidates[0].openQuestion, true)
  for (const table of ['work_claims', 'project_tasks', 'questions']) await assert.rejects(readResumeCandidates(store(base, table), NOW), table)
  const many = Array.from({ length: RELEASES_READ }, (_, i) => claim(`t${i}`, ago(90 * MIN), ago(30 * MIN), 'lapsed'))
  assert.equal((await readResumeCandidates(store({ work_claims: many, project_tasks: [], questions: [] }), NOW)).capped, true)
})

test('§3.11: a resume run\'s task reads answered once taken since the release, queued while not, null when unread', async () => {
  const released = ago(30 * MIN)
  assert.equal(await readResumeState(store({ project_tasks: [task('a')], work_claims: [claim('a', ago(90 * MIN), released, 'let-go')] }), 'a', released), 'queued')
  assert.equal(await readResumeState(store({ project_tasks: [task('a')], work_claims: [claim('a', ago(10 * MIN), null, null)] }), 'a', released), 'answered')
  assert.equal(await readResumeState(store({ project_tasks: [task('a', { status: 'review' })], work_claims: [] }), 'a', released), 'answered')
  assert.equal(await readResumeState(store({ project_tasks: [], work_claims: [] }), 'a', released), null)
  assert.equal(await readResumeState(store({ project_tasks: [task('a')], work_claims: [] }, 'project_tasks'), 'a', released), null)
})

test('§3.12: the newest claim names the runtime session that left it (its end wins over its enrolment) and the workflow it was linked to', async () => {
  const ev = (type, payload) => ({ type, payload, ...Object.fromEntries(Object.entries(payload).map(([k, v]) => [`payload->>${k}`, v])) })
  const s = store({
    work_claims: [{ id: 'c-a', owner_session: 's-a', ...claim('a', ago(90 * MIN), ago(30 * MIN), 'session-ended') },
      { id: 'c-b', owner_session: 's-b', ...claim('b', ago(90 * MIN), ago(30 * MIN), 'let-go') }],
    project_tasks: [task('a'), task('b')],
    questions: [],
    journal: [
      ev('session.enrolled@1', { session_id: 's-a', runtime_session_id: 'rt-before-clear' }),
      ev('session.ended@1', { session_id: 's-a', runtime_session_id: 'rt-a' }),
      ev('work.claimed@1', { owner: 's-a', claim_id: 'c-a', workflow_id: 'wf_0123456789abcdef' }),
      ev('session.enrolled@1', { session_id: 's-b', runtime_session_id: 'rt-b' })
    ]
  })
  const r = await readResumeCandidates(s, NOW)
  const a = r.candidates.find((c) => c.taskId === 'a').lastClaim
  assert.equal(a.runtimeSessionId, 'rt-a')
  assert.equal(a.workflowId, 'wf_0123456789abcdef')
  const b = r.candidates.find((c) => c.taskId === 'b').lastClaim
  assert.equal(b.runtimeSessionId, 'rt-b')
  assert.equal(b.workflowId, null)
  await assert.rejects(readResumeCandidates(store({ work_claims: [{ id: 'c-a', owner_session: 's-a', ...claim('a', ago(90 * MIN), ago(30 * MIN), 'lapsed') }], project_tasks: [task('a')], questions: [] }, 'journal'), NOW), /journal|session/)
})

test('turn-end §3: the newest release\'s wait is read from its event, with whether its question or grant has settled', async () => {
  const Q = '0a0a0a0a-0b0b-4c0c-8d0d-0e0e0e0e0e0e'
  const G = '1a1a1a1a-1b1b-4c1c-8d1d-1e1e1e1e1e1e'
  const R = '2a2a2a2a-2b2b-4c2c-8d2d-2e2e2e2e2e2e'
  const claims = [
    { id: 'c-a', ...claim('a', ago(90 * MIN), ago(30 * MIN), 'let-go') },
    { id: 'c-b', ...claim('b', ago(90 * MIN), ago(30 * MIN), 'let-go') },
    { id: 'c-c', ...claim('c', ago(90 * MIN), ago(30 * MIN), 'let-go') },
    { id: 'c-d', ...claim('d', ago(90 * MIN), ago(30 * MIN), 'handed-over') }
  ]
  const journal = [
    { type: 'work.released@1', 'payload->>claim_id': 'c-a', payload: { claim_id: 'c-a', wait: { kind: 'question', ref: Q } } },
    { type: 'work.released@1', 'payload->>claim_id': 'c-b', payload: { claim_id: 'c-b', wait: { kind: 'grant', ref: G } } },
    { type: 'work.released@1', 'payload->>claim_id': 'c-c', payload: { claim_id: 'c-c', wait: { kind: 'request', ref: R } } },
    { type: 'work.released@1', 'payload->>claim_id': 'c-d', payload: { claim_id: 'c-d', wait: { kind: 'time' } } }
  ]
  const s = store({ work_claims: claims, project_tasks: [task('a'), task('b'), task('c'), task('d')], questions: [{ id: Q, status: 'answered', task_id: null }],
    access_requests: [{ id: G, status: 'pending' }], journal })
  const r = await readResumeCandidates(s, NOW, async (id) => (id === R ? 'completed' : null))
  const by = Object.fromEntries(r.candidates.map((c) => [c.taskId, c]))
  assert.deepEqual([by.a.wait.kind, by.a.waitSettled], ['question', true])
  assert.deepEqual([by.b.wait.kind, by.b.waitSettled], ['grant', false])
  assert.deepEqual([by.c.wait.kind, by.c.waitSettled], ['request', true])
  assert.equal(by.d.wait, undefined, 'a time without until names nothing checkable: no wait')
})

// 0.3.22 review, iteration 2, DA-1: a release made before the supervisor began here was made by a Fabric whose let-go
// meant «back to the queue»; continuing it would start every task left in the week before the upgrade at once.
test('DA-1: only work left since the supervisor began on this machine is continued; the start is kept across reads', async () => {
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-resume-since-'))
  try {
    const file = path.join(dir, 'resume-since.json')
    const begun = resumeSince(file, NOW - 60 * MIN)
    assert.equal(begun, ago(60 * MIN))
    assert.equal(resumeSince(file, NOW), begun, 'a later read keeps the first start')
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { since: begun })
    const s = store({
      work_claims: [claim('before', ago(3 * 60 * MIN), ago(2 * 60 * MIN), 'let-go'), claim('after', ago(50 * MIN), ago(30 * MIN), 'let-go')],
      project_tasks: [task('before'), task('after')], questions: []
    })
    const r = await readResumeCandidates(s, NOW, undefined, begun)
    assert.deepEqual(r.candidates.map((c) => c.taskId), ['after'])
    // A file that cannot be written begins now, once: later passes keep that start (iteration 3, ER-1: a fresh now on
    // every pass read an empty window and continued nothing), and the failure is said once.
    const unwritable = path.join(dir, 'no', 'such', '\0bad')
    const failures = []
    assert.equal(resumeSince(unwritable, NOW, (e) => failures.push(e)), new Date(NOW).toISOString())
    assert.equal(resumeSince(unwritable, NOW + 30 * MIN, (e) => failures.push(e)), new Date(NOW).toISOString())
    assert.equal(failures.length, 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

