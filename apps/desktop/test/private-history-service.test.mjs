// The private history service in main without a database (audit 2026-10-05 A5-011…A5-014, A3-004,
// A3-005): the files, the order of calls and the operation record, over a fake RPC. The real SQL is
// held by private-history-native-db.test.mjs on an owned cluster; this pins what main decides alone.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createPrivateHistory } from '../src/main/privateHistory.ts'
import { A, OWNER, OTHER_PERSON, archive, bytes, id, line, ordinary } from './fixtures/ceo-private-archive/vectors.mjs'

const CB = id(20)
const actor = p => ({ kind: 'person', id: p })
const roots = []
let groups = 0
const pass = name => { groups++; console.log('PASS ' + name) }
const tmp = prefix => { const d = mkdtempSync(path.join(tmpdir(), prefix)); roots.push(d); return d }

/** An archive directory as an export writes it: the ordinary pair, and a companion owned by `owner`. */
function archiveDir(owner = OWNER) {
  const dir = tmp('fabric-ph-archive-')
  const o = ordinary(A, Array.from({ length: 20 }, (_, i) => line(i + 1)))
  writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(o.manifest))
  writeFileSync(path.join(dir, 'journal.ndjson'), o.journal)
  if (owner) writeFileSync(path.join(dir, 'ceo-private.json'), bytes(archive({ owner })))
  return dir
}

/** A fake of the four commands. `answers[name]` is a list consumed one per call: 'lost' throws after
 *  the call, an object is the reply's data; when the list is empty the call succeeds. */
function service({ who = { estateId: CB, personId: OWNER, revision: 1, actor: actor(OWNER) }, answers = {}, root = tmp('fabric-ph-root-') } = {}) {
  const calls = []
  let ids = 0
  const rpc = async (name, args) => {
    calls.push(name)
    const next = (answers[name] ?? []).shift()
    if (next === 'lost') throw new Error('reply lost')
    if (next) return { data: next }
    if (name === 'restore_estate_verified') return { data: { ok: true, target_revision: 1, target_estate_id: args.p_target_estate } }
    return { data: { ok: true } }
  }
  const held = { current: who }
  const history = createPrivateHistory({ rootDir: root, identity: { held: () => held.current }, take: async () => ({ ok: false }), rpc,
    newId: () => id(70000 + ++ids) })
  return { history, calls, root, held }
}

try {
  // ── A5-011: another Person's companion — the archive is restored, the companion is not imported ──────
  {
    const s = service()
    const r = await s.history.restore(archiveDir(OTHER_PERSON), 'Restored Atlas')
    assert.equal(r.ok, true, JSON.stringify(r))
    assert.equal(r.private_history, false)
    assert.equal(r.private_history_skipped, 'not_your_history')
    assert.deepEqual(s.calls, ['restore_estate_verified'], "another Person's history is never sent to import")
    assert.deepEqual(s.history.restored(), [r.target_estate_id], 'the restored Estate can be opened')
  }
  pass("an archive carrying someone else's private history restores; the companion is skipped and said so")

  // ── A5-012: a definitive import refusal finishes the restore with private history not imported ──────
  {
    const s = service({ answers: { ceo_import_private_archive: [{ ok: false, reason_code: 'idempotency_conflict' }] } })
    const r = await s.history.restore(archiveDir(), 'Restored Atlas')
    assert.equal(r.ok, true, JSON.stringify(r))
    assert.deepEqual([r.private_history, r.private_history_skipped], [false, 'idempotency_conflict'])
    assert.deepEqual(s.history.restored(), [r.target_estate_id], 'a restored Estate whose import was refused can still be opened')
    assert.deepEqual(s.history.pending(), [], 'nothing is left waiting')
    const again = await s.history.check(r.operation_id)
    assert.deepEqual(again, r, 'a later check returns the same result')
    assert.deepEqual(s.calls, ['restore_estate_verified', 'ceo_import_private_archive'], 'the check repeats nothing')
  }
  {
    const s = service({ answers: { ceo_import_private_archive: ['lost'] } })
    const r = await s.history.restore(archiveDir(), 'Restored Atlas')
    assert.deepEqual([r.ok, r.state], [false, 'result_unknown'], 'a lost import reply stays unknown, never "not imported"')
    assert.deepEqual(s.history.restored(), [])
  }
  pass('a refused import leaves a usable restored Estate with the reason; a lost one stays unknown')

  // ── A5-013: the archive is kept by the operation, and an unreadable file is a refusal, not a throw ──
  {
    const s = service({ answers: { restore_estate_verified: ['lost'] } })
    const dir = archiveDir()
    const first = await s.history.restore(dir, 'Restored Atlas')
    assert.equal(first.state, 'result_unknown')
    rmSync(dir, { recursive: true, force: true }) // the operator moved the archive, or its disk went away
    const again = await s.history.check(first.operation_id)
    assert.equal(again.ok, true, JSON.stringify(again))
    assert.equal(again.private_history, true)
    assert.deepEqual(s.calls, ['restore_estate_verified', 'restore_estate_verified', 'ceo_import_private_archive'])
    const ops = readdirSync(path.join(s.root, 'private-history', 'operations'))
    assert.deepEqual(ops, [`${first.operation_id}.json`], 'the copy is removed once the result is known')
  }
  {
    const s = service({ answers: { restore_estate_verified: ['lost'] } })
    const first = await s.history.restore(archiveDir(), 'Restored Atlas')
    const copy = path.join(s.root, 'private-history', 'operations', `${first.operation_id}.archive`)
    assert.ok(existsSync(path.join(copy, 'journal.ndjson')), 'the archive is copied into the operation before the first call')
    unlinkSync(path.join(copy, 'journal.ndjson'))
    const r = await s.history.check(first.operation_id)
    assert.deepEqual([r.ok, r.state, r.reason_code, r.operation_id], [false, 'refused', 'not_found', first.operation_id], 'an unreadable file refuses with the operation id')
    assert.equal(s.calls.length, 1, 'nothing is sent from a file that cannot be read')
    assert.deepEqual(s.history.pending().map(p => p.operation_id), [first.operation_id], 'the operation is still there to check')
  }
  {
    // A copy that cannot be made sends nothing and records nothing.
    const root = tmp('fabric-ph-root-')
    mkdirSync(path.join(root, 'private-history', 'operations'), { recursive: true, mode: 0o700 })
    const s = service({ root })
    const dir = archiveDir()
    const blocked = path.join(root, 'private-history', 'operations', `${id(70001)}.archive`)
    writeFileSync(blocked, 'not a directory')
    const r = await s.history.restore(dir, 'x')
    assert.deepEqual([r.ok, r.state], [false, 'refused'])
    assert.deepEqual(s.calls, [], 'no call before the archive is kept')
    assert.deepEqual(s.history.pending(), [])
  }
  pass('the archive is copied before the first call; a moved original still completes; an unreadable copy is refused with its operation')

  // ── A5-014 / A3-005: what waits for a result, and what was restored, survive the panel ─────────────
  {
    const root = tmp('fabric-ph-root-')
    const s = service({ root, answers: { restore_estate_verified: ['lost'] } })
    const unknown = await s.history.restore(archiveDir(), 'Waiting')
    const done = await s.history.restore(archiveDir(), 'Finished')
    assert.equal(done.ok, true)
    // A restart: a new service over the same files.
    const later = service({ root })
    assert.deepEqual(later.history.pending(), [{ operation_id: unknown.operation_id, name: 'Waiting' }])
    assert.deepEqual(later.history.restoredEstates(), [{ target_estate_id: done.target_estate_id, name: 'Finished', private_history: true }])
    const other = service({ root, who: { estateId: CB, personId: OTHER_PERSON, revision: 1, actor: actor(OTHER_PERSON) } })
    assert.deepEqual([other.history.pending(), other.history.restoredEstates()], [[], []], "another Person's operations are not theirs to see")
    // Once opened, the Estate one is in is not offered as one to open.
    later.held.current = { estateId: done.target_estate_id, personId: OWNER, revision: 1, actor: actor(OWNER) }
    assert.deepEqual(later.history.restoredEstates(), [])
    const none = service({ root, who: null })
    assert.deepEqual([none.history.pending(), none.history.restoredEstates()], [[], []])
  }
  pass('pending and restored Estates are read from the operation files, for the held Person only')

  console.log(`PASS private history service: ${groups} groups, no database`)
} finally { for (const r of roots) rmSync(r, { recursive: true, force: true }) }
