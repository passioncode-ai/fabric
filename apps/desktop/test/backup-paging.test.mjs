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

// ADR-0149 §6 / CO-212: an estate archive carries the project board's history in board.json, bound to the
// manifest digest; a backup that cannot read it fails; verification refuses a moved or altered file; an archive
// from before board history travelled restores and says the history is missing.
import { createBackups } from '../src/main/backup.ts'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import nodePath from 'node:path'

const E = '79000000-0000-4000-8000-000000000001', T = '79000000-0000-4000-8000-000000000002'
const fakeDb = (answers) => {
  const calls = []
  const chain = { select: () => chain, eq: () => chain, gt: () => chain, order: () => chain, limit: async () => ({ data: [{ seq: 1, type: 'estate.created@1', payload: {} }], error: null }) }
  return { calls, db: { from: () => chain, rpc: async (fn, args) => { calls.push({ fn, args }); return answers[fn] ?? { data: null, error: { message: 'no answer' } } } } }
}
const history = { schema: 'FabricBoardHistory@1', source_estate_id: E, watermark_seq: 1, threads: [], messages: [], outcomes: [] }

test('board.json is written beside the journal, bound to its manifest, and refused when moved or altered', async () => {
  const dir = mkdtempSync(nodePath.join(tmpdir(), 'fabric-board-archive-'))
  try {
    const { db, calls } = fakeDb({ board_history_export: { data: history, error: null } })
    const b = createBackups(db)
    const taken = await b.take(E, dir)
    assert.equal(taken.ok, true, taken.says)
    assert.deepEqual(calls[0], { fn: 'board_history_export', args: { p_estate_id: E, p_watermark: 1 } })
    const file = JSON.parse(readFileSync(nodePath.join(dir, 'board.json'), 'utf8'))
    assert.equal(file.archiveDigest, taken.manifest.digest); assert.deepEqual(file.history, history)
    assert.equal(b.verify(dir).ok, true)
    const original = readFileSync(nodePath.join(dir, 'board.json'), 'utf8')
    writeFileSync(nodePath.join(dir, 'board.json'), original.replace('"messages":[]', '"messages":[{"id":"forged"}]'))
    assert.equal(b.verify(dir).why, 'corrupt')
    const r = await createBackups(fakeDb({}).db).restore({ dir, intoEstateId: T })
    assert.equal(r.ok, false, 'a restore began from an altered board file')
    writeFileSync(nodePath.join(dir, 'board.json'), original.replace(taken.manifest.digest, '0'.repeat(64)))
    assert.equal(b.verify(dir).why, 'corrupt', 'a board file from another archive')
    unlinkSync(nodePath.join(dir, 'board.json'))
    assert.equal(b.verify(dir).ok, true, 'an archive from before board history travelled is still an archive')
    const restored = await createBackups(fakeDb({ restore_estate: { data: { restored: true, events: 1 }, error: null } }).db).restore({ dir, intoEstateId: T })
    assert.deepEqual(restored.board, { history: 'missing' })
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a backup that cannot read the board history fails rather than leave it out; a restore carries it into the new estate', async () => {
  const dir = mkdtempSync(nodePath.join(tmpdir(), 'fabric-board-archive-'))
  try {
    const failing = await createBackups(fakeDb({ board_history_export: { data: null, error: { message: 'down' } } }).db).take(E, dir)
    assert.equal(failing.ok, false); assert.match(failing.says, /project board/)
    await createBackups(fakeDb({ board_history_export: { data: history, error: null } }).db).take(E, dir)
    const { db, calls } = fakeDb({ restore_estate: { data: { restored: true, events: 1 }, error: null },
      restore_board_history: { data: { ok: true, messages: 0, missing: 2, redacted: 0 }, error: null } })
    const r = await createBackups(db).restore({ dir, intoEstateId: T })
    assert.deepEqual(r.board, { history: 'restored', messages: 0, missing: 2, redacted: 0 })
    assert.deepEqual(calls.map(c => c.fn), ['restore_estate', 'restore_board_history'])
    assert.deepEqual(calls[1].args, { p_target: T, p_history: history })
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
