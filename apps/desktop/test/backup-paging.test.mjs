// 0.3.2 verification DA-2: the private-history archive reads the WHOLE journal, past PostgREST's
// 1000-row cap, in seq order — an archive of the first 1000 failed its own check on every larger estate.
import assert from 'node:assert/strict'
import test from 'node:test'
import { journalBySeq, JOURNAL_PAGE } from '../src/main/backup.ts'

const journal = Array.from({ length: 2500 }, (_, i) => ({ seq: i + 1 }))
const pager = (rows, fail = null) => async (after) => {
  if (fail !== null && after >= fail) return { data: null, error: { message: 'timeout' } }
  return { data: rows.filter((r) => r.seq > after).slice(0, JOURNAL_PAGE), error: null }
}

test('every event of a 2500-event estate, in order, once', async () => {
  const r = await journalBySeq(pager(journal))
  assert.equal(r.ok, true)
  assert.equal(r.rows.length, 2500)
  assert.deepEqual(r.rows.map((x) => x.seq), journal.map((x) => x.seq))
})

test('exactly one full page, and an empty journal, end cleanly', async () => {
  assert.equal((await journalBySeq(pager(journal.slice(0, JOURNAL_PAGE)))).rows.length, JOURNAL_PAGE)
  assert.deepEqual(await journalBySeq(pager([])), { ok: true, rows: [] })
})

test('a page that fails fails the read; nothing partial is returned as whole', async () => {
  assert.deepEqual(await journalBySeq(pager(journal, 1000)), { ok: false, message: 'timeout' })
})
