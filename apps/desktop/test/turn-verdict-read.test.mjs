// The turn-end spec §4.2 (T2): the facts a turn's verdict reads, over a stand-in of the scoped store.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { readTurnVerdict } = await import(path.resolve(import.meta.dirname, '../src/main/turnVerdictRead.ts'))

const NOW = Date.parse('2026-11-16T22:00:00Z')
const S = 'session-1'

/** A query builder over rows; a `payload->>key` filter reads the row's payload, as PostgREST does. */
function store(tables, fail = null) {
  return {
    async selectIn(table, _cols, column, values) {
      if (table === fail) return { rows: [], failed: 'refused' }
      return { rows: (tables[table] ?? []).filter((r) => values.includes(r[column])), failed: null }
    },
    select(table) {
      let rows = [...(tables[table] ?? [])]
      const get = (r, c) => (c.startsWith('payload->>') ? r.payload?.[c.slice(10)] : r[c])
      const q = {
        eq(c, v) { rows = rows.filter((r) => get(r, c) === v); return q },
        is(c, v) { rows = rows.filter((r) => (r[c] ?? null) === v); return q },
        in(c, vs) { rows = rows.filter((r) => vs.includes(r[c])); return q },
        order(c, o) { rows.sort((a, b) => (o?.ascending === false ? b[c] - a[c] : a[c] - b[c])); return q },
        limit(n) { rows = rows.slice(0, n); return q },
        then(ok, ko) { return Promise.resolve(table === fail ? { data: null, error: { message: 'refused' } } : { data: rows, error: null }).then(ok, ko) }
      }
      return q
    }
  }
}

const turn = (seq, files, session = S) => ({ seq, type: 'session.turn.observed@1', payload: { session_id: session, head: 'a'.repeat(40), files_changed: files, lines_added: files, lines_removed: 0 } })
const tables = (over = {}) => ({
  work_claims: [{ work_id: 't1', owner_session: S, released_at: null, expires_at: '2026-11-16T22:30:00Z' }],
  project_tasks: [{ id: 't1', title: 'Ship the verdict', status: 'running' }],
  session_heartbeats: [{ session_id: S, phase: 'working' }],
  journal: [turn(1, 0), turn(2, 1), turn(3, 2), turn(4, 9, 'other-session')],
  ...over
})

test('T2: a held open task, no wait and changing turns read as continue', async () => {
  const v = await readTurnVerdict(store(tables()), S, NOW)
  assert.equal(v?.next, 'continue')
  assert.equal(v?.task_id, 't1')
})

test('T2: a waiting heartbeat, a released claim or two quiet turns give no verdict', async () => {
  assert.equal(await readTurnVerdict(store(tables({ session_heartbeats: [{ session_id: S, phase: 'waiting' }] })), S, NOW), null)
  assert.equal(await readTurnVerdict(store(tables({ work_claims: [{ work_id: 't1', owner_session: S, released_at: '2026-11-16T21:00:00Z', expires_at: '2026-11-16T22:30:00Z' }] })), S, NOW), null)
  assert.equal(await readTurnVerdict(store(tables({ journal: [turn(1, 2), turn(2, 2), turn(3, 2)] })), S, NOW), null)
})

test('T2: another session\'s turns are not this one\'s, and a refused read is no verdict, never a throw', async () => {
  // Only the other session changed: this one's three turns are quiet.
  assert.equal(await readTurnVerdict(store(tables({ journal: [turn(1, 2), turn(2, 2), turn(3, 2), turn(4, 7, 'other-session')] })), S, NOW), null)
  for (const t of ['work_claims', 'session_heartbeats', 'journal', 'project_tasks'])
    assert.equal(await readTurnVerdict(store(tables(), t), S, NOW), null, `${t} refused`)
})
