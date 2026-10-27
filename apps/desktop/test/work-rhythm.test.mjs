// «Ритм работы» read in main (the mockup parity, 2026-10-27, home gaps D1, D2): one count per local day over 28 days,
// machine ticks left out, a finished day kept, a failed day unknown (never zero), results and decisions by one definition.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { createRhythmReader, CONCURRENCY, MIN_INTERVAL_MS } = await import(path.resolve(import.meta.dirname, '../src/main/workRhythm.ts'))

/** A fake store: `journal` count requests answer from `perDay`, the start-seq read and the marks read from their rows. */
function fakeStore({ perDay = () => 5, marks = [], failDay = null, startSeq = 100 } = {}) {
  const calls = { counts: [], marks: 0, start: 0, inFlight: 0, maxInFlight: 0 }
  const store = {
    select(table, columns, options) {
      const call = { table, columns, options, filters: [] }
      const chain = {
        eq: (...a) => { call.filters.push(['eq', ...a]); return chain },
        in: (...a) => { call.filters.push(['in', ...a]); return chain },
        not: (...a) => { call.filters.push(['not', ...a]); return chain },
        gte: (...a) => { call.filters.push(['gte', ...a]); return chain },
        lt: (...a) => { call.filters.push(['lt', ...a]); return chain },
        order: () => chain,
        limit: (n) => { call.limit = n; return chain },
        then: (ok, bad) => {
          if (options?.head) {
            calls.counts.push(call)
            calls.inFlight++
            calls.maxInFlight = Math.max(calls.maxInFlight, calls.inFlight)
            const from = call.filters.find((f) => f[0] === 'gte' && f[1] === 'occurred_at')[2]
            return new Promise((r) => setTimeout(r, 2)).then(() => {
              calls.inFlight--
              const day = from.slice(0, 10)
              return failDay && failDay(from) ? { data: null, error: { message: 'database away' }, count: null } : { data: null, error: null, count: perDay(day) }
            }).then(ok, bad)
          }
          if (columns === 'seq') { calls.start++; return Promise.resolve({ data: startSeq === null ? [] : [{ seq: startSeq }], error: null }).then(ok, bad) }
          calls.marks++
          calls.markFilters = [...(calls.markFilters ?? []), call.filters]
          const at = (row, col) => { const [c, k] = col.split('->>'); return k ? row[c]?.[k] : row[c] }
          const rows = marks.filter((row) => call.filters.every(([op, col, v]) => op === 'eq' ? at(row, col) === v : op === 'in' ? v.includes(at(row, col)) : true))
          return Promise.resolve({ data: rows, error: null }).then(ok, bad)
        }
      }
      return chain
    }
  }
  return { store, calls }
}

test('one count per day of 28, machine ticks left out, from the window\'s first seq, at most CONCURRENCY at once', async () => {
  const { store, calls } = fakeStore()
  const now = new Date(2026, 9, 27, 15, 0).getTime()
  const r = await createRhythmReader(store).read(now)
  assert.equal(r.days.length, 28)
  assert.ok(r.days.every((d) => d.events === 5), 'every day read')
  assert.equal(calls.counts.length, 28)
  assert.ok(calls.maxInFlight <= CONCURRENCY, `at most ${CONCURRENCY} counts in flight, saw ${calls.maxInFlight}`)
  const c = calls.counts[0]
  assert.deepEqual(c.options, { head: true, count: 'exact' }, 'a count, no rows on the wire')
  const not = c.filters.find((f) => f[0] === 'not')
  assert.equal(not[1], 'type')
  assert.match(not[3], /"cycle\.ran@1"/)
  assert.match(not[3], /"work\.swept@1"/)
  assert.deepEqual(c.filters.find((f) => f[0] === 'gte' && f[1] === 'seq'), ['gte', 'seq', 100])
})

test('a finished day is kept; only today is counted again', async () => {
  const { store, calls } = fakeStore()
  const reader = createRhythmReader(store)
  const now = new Date(2026, 9, 27, 15, 0).getTime()
  await reader.read(now)
  assert.equal(reader.settledDays(), 27)
  calls.counts.length = 0
  await reader.read(now + 60_000)
  assert.equal(calls.counts.length, 1, 'only today is asked again')
})

test('a day whose count fails is unknown, never zero, and says why; the rest still read', async () => {
  const { store } = fakeStore({ failDay: (from) => new Date(from).getDate() === 26 })
  const now = new Date(2026, 9, 27, 15, 0).getTime()
  const r = await createRhythmReader(store).read(now)
  assert.equal(r.days.at(-2).events, null)
  assert.equal(r.days.at(-1).events, 5)
  assert.ok(r.unread.some((u) => /database away/.test(u)))
})

test('no event since the window opened: every day read and empty', async () => {
  const { store, calls } = fakeStore({ startSeq: null })
  const r = await createRhythmReader(store).read(new Date(2026, 9, 27, 15, 0).getTime())
  assert.ok(r.days.every((d) => d.events === 0))
  assert.equal(calls.counts.length, 0)
})

test('results and decisions come from three reads of the window filtered by the database, by the shared definition', async () => {
  const now = new Date(2026, 9, 27, 15, 0).getTime()
  const today = new Date(2026, 9, 27, 10).toISOString()
  const marks = [
    { type: 'task.moved@1', occurred_at: today, actor: { kind: 'agent' }, payload: { task_id: 't1', to: 'review' } },
    { type: 'access.decided@1', occurred_at: today, actor: { kind: 'person' }, payload: {} },
    { type: 'access.decided@1', occurred_at: today, actor: { kind: 'agent' }, payload: {} }
  ]
  const { store, calls } = fakeStore({ marks })
  const r = await createRhythmReader(store).read(now)
  assert.equal(calls.marks, 3, 'ER-3: a move into review, a close as done and the person\'s decisions, each filtered by the database')
  assert.ok(calls.markFilters.some((f) => f.some(([op, col, v]) => op === 'eq' && col === 'payload->>to' && v === 'review')))
  // DA-14 (iteration 2): the person alone, as `packages/journal`'s ActorKind names it.
  assert.ok(calls.markFilters.some((f) => f.some(([op, col, v]) => op === 'eq' && col === 'actor->>kind' && v === 'person')))
  assert.deepEqual(r.today, { results: 1, decisions: 1, events: 5 })
})

test('ER-2: readings within MIN_INTERVAL_MS are answered again, and concurrent callers share one reading', async () => {
  const { store, calls } = fakeStore()
  const reader = createRhythmReader(store)
  const now = new Date(2026, 9, 27, 15, 0).getTime()
  const [a, b] = await Promise.all([reader.read(now), reader.read(now)])
  assert.equal(a, b)
  const first = calls.counts.length
  await reader.read(now + 5_000)
  assert.equal(calls.counts.length, first, 'no new counts within the interval')
  await reader.read(now + MIN_INTERVAL_MS + 1)
  assert.ok(calls.counts.length > first, 'read again after the interval')
})

test('ER-9: one capped read cuts the days before its oldest row for every family, never shown as zero', async () => {
  const now = new Date(2026, 9, 27, 15, 0).getTime()
  const yesterday = new Date(2026, 9, 26, 10).toISOString()
  const old = new Date(2026, 9, 10, 10).toISOString()
  const moved = Array.from({ length: 1000 }, (_, i) => ({ type: 'task.moved@1', occurred_at: yesterday, actor: { kind: 'agent' }, payload: { task_id: `t${i}`, to: 'review' } }))
  const marks = [...moved, { type: 'access.decided@1', occurred_at: old, actor: { kind: 'person' }, payload: {} }]
  const { store } = fakeStore({ marks })
  const r = await createRhythmReader(store).read(now)
  assert.equal(r.marksCapped, true)
  assert.deepEqual([r.today.results, r.today.decisions], [0, 0], 'today is after the cut: whole')
  const before = r.days.filter((d) => !d.today)
  assert.ok(before.every((d) => d.results === null && d.decisions === null), 'every day before the cut is unknown')
})

test('ER-11: a reading that fails rejects every caller sharing it, and the next call reads again', async () => {
  let fail = true
  const { store } = fakeStore()
  const flaky = { select: (...a) => { if (fail) throw new Error('database away'); return store.select(...a) } }
  const reader = createRhythmReader(flaky, { minIntervalMs: 0 })
  const now = new Date(2026, 9, 27, 15, 0).getTime()
  const r = await reader.read(now)
  assert.ok(r.unread.length > 0, 'a failed read is said, not thrown as zeros')
  fail = false
  const again = await reader.read(now + 1)
  assert.ok(again.days.every((d) => d.events === 5), 'read again after the failure')
})
