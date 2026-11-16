// §3.11 of the on-demand spec (2026-11-16): the board supervisor's reads, over a stand-in of the scoped store.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { readResumeCandidates, readResumeState, RELEASES_READ } = await import(path.resolve(import.meta.dirname, '../src/main/boardResumeRead.ts'))

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
  assert.deepEqual(a.lastClaim, { claimedAt: ago(90 * MIN), releasedAt: ago(30 * MIN), how: 'session-ended' })
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
