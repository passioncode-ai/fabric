import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createResourceReconciliation } from '../src/main/resourceReconciliation.ts'

const estateId = '11111111-1111-4111-8111-111111111111'
const scope = { estateId, hostId: 'fixture-host', poolId: 'fixture-pool' }
const uuid = n => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`
const makeRow = n => ({ estate_id: estateId, host_id: scope.hostId, pool_id: scope.poolId,
  reservation_id: `r-${n}`, task_run_id: uuid(n), session_id: uuid(n + 100), run_ordinal: n,
  admitted_seq: n * 10, binding: { reservationId: `r-${n}`, fence: n }, state: 'held', released_seq: null })
function fixture(count = 1, config = {}) {
  const rows = Array.from({ length: count }, (_, i) => makeRow(i + 1)), calls = [], reads = []
  const f = { rows, calls, reads, proof: new Set(), effects: new Map() }
  const db = {
    from(table) {
      assert.equal(table, 'resource_reservations')
      const eq = {}, gt = {}, shape = { eq, gt }
      const query = {
        select(columns) { shape.columns = columns; return query },
        eq(key, value) { eq[key] = value; return query },
        gt(key, value) { gt[key] = value; return query },
        order(key, options) { assert.equal(key, 'admitted_seq'); assert.equal(options.ascending, true); return query },
        limit(n) { shape.limit = n; return query },
        maybeSingle() { shape.single = true; return query },
        async then(resolve, reject) {
          try {
            assert.equal(eq.estate_id, scope.estateId); assert.equal(eq.host_id, scope.hostId); assert.equal(eq.pool_id, scope.poolId)
            reads.push(structuredClone(shape))
            if (f.readHook) { const overridden = await f.readHook(shape); if (overridden !== undefined) return resolve(overridden) }
            const selected = rows.filter(r => Object.entries(eq).every(([k, v]) => r[k] === v) && Object.entries(gt).every(([k, v]) => r[k] > v))
              .sort((a, b) => a.admitted_seq - b.admitted_seq).slice(0, shape.limit ?? rows.length)
            resolve({ data: structuredClone(shape.single ? selected[0] ?? null : selected), error: null })
          } catch (error) { reject(error) }
        }
      }
      return query
    },
    async rpc(name, args) {
      calls.push({ name, args: structuredClone(args) })
      assert.equal(name, 'release_resource_reservation', 'recovery never issues cancel/end/stop')
      if (f.rpcHook) { const overridden = await f.rpcHook(args); if (overridden !== undefined) return overridden }
      const r = rows.find(r => r.reservation_id === args.p_reservation)
      assert.equal(args.p_estate, r.estate_id); assert.equal(args.p_run, r.task_run_id)
      assert.equal(args.p_session, r.session_id); assert.equal(args.p_fence, String(r.binding.fence))
      if (r.state === 'released') return { data: { released: true, repeated: true, receipt_seq: r.released_seq } }
      // Injected SQL transport verdict, NOT a reimplementation of operational Stop authority.
      if (!f.proof.has(r.reservation_id)) return { data: { released: false, reason_code: 'resource_execution_unresolved' } }
      r.state = 'released'; r.released_seq = 1000 + r.admitted_seq
      f.effects.set(r.reservation_id, (f.effects.get(r.reservation_id) ?? 0) + 1)
      return { data: { released: true, repeated: false, receipt_seq: r.released_seq } }
    }
  }
  const deps = { ...scope, db, pageSize: 2, maxPages: 1, timeoutMs: 100, ...config }
  return Object.assign(f, { db, deps, make: overrides => createResourceReconciliation({ ...deps, ...overrides }) })
}

test('release requires SQL yes plus exact durable row readback, after a fresh controller restart', async () => {
  const f = fixture(); f.proof.add('r-1')
  const result = await f.make().sweep()
  assert.equal(result.scan, 'complete'); assert.equal(result.next, null)
  assert.deepEqual(result.items.map(x => [x.state, x.receiptSeq]), [['released', 1010]])
  assert.equal(f.reads[1].eq.reservation_id, 'r-1')
  assert.equal((await f.make().sweep()).items.length, 0)
  assert.equal(f.effects.get('r-1'), 1)
})
test('concurrent local sweeps share a single execution and promise', async () => {
  const f = fixture(), recovery = f.make()
  const a = recovery.sweep(), b = recovery.sweep()
  assert.equal(a, b); await a; assert.equal(f.calls.length, 1)
})
test('bounded continuation does not starve behind retained head rows and survives restart', async () => {
  const f = fixture(5); f.proof.add('r-5')
  const first = await f.make().sweep()
  assert.equal(first.scan, 'partial'); assert.equal(first.next.afterSeq, 20)
  const recovery = f.make({ initialCursor: first.next })
  const second = await recovery.sweep()
  assert.deepEqual(second.items.map(i => i.reservationId), ['r-3', 'r-4'])
  const third = await recovery.sweep()
  assert.deepEqual(third.items.map(i => i.state), ['released']); assert.equal(third.next, null)
  assert.equal((await recovery.sweep()).items[0].reservationId, 'r-1', 'completed scan wraps for old retained rows')
})
test('parent retained for children is retried after the sweep wraps', async () => {
  const f = fixture(2); f.proof.add('r-1'); f.proof.add('r-2')
  f.rpcHook = args => args.p_reservation === 'r-1' && f.rows[1].state === 'held'
    ? { data: { released: false, reason_code: 'resource_children_held' } } : undefined
  const recovery = f.make()
  assert.deepEqual((await recovery.sweep()).items.map(i => i.state), ['retained', 'released'])
  assert.deepEqual((await recovery.sweep()).items.map(i => i.state), ['released'])
})
for (const reason of ['resource_execution_unresolved', 'resource_children_held']) test(`SQL ${reason} retains reservation`, async () => {
  const f = fixture(); f.rpcHook = () => ({ data: { released: false, reason_code: reason } })
  const result = await f.make().sweep(); assert.equal(result.items[0].state, 'retained'); assert.equal(f.rows[0].state, 'held')
})
for (const payload of [null, { released: true }, { released: true, repeated: true, receipt_seq: 0 },
  { released: true, repeated: 'yes', receipt_seq: 10 }, { released: false, reason_code: 'resource_identity_conflict' },
  { released: true, repeated: false, receipt_seq: 1010 }]) test(`malformed/unconfirmed release remains unknown: ${JSON.stringify(payload)}`, async () => {
  const f = fixture(); f.rpcHook = () => ({ data: payload })
  const result = await f.make().sweep()
  assert.equal(result.items[0].state, 'unknown'); assert.equal(f.rows[0].state, 'held')
})
for (const field of ['estate_id', 'host_id', 'pool_id', 'task_run_id', 'session_id', 'admitted_seq', 'run_ordinal', 'binding']) test(`malformed ledger ${field} has no release side effects`, async () => {
  const f = fixture(); const bad = makeRow(1); bad[field] = field === 'binding' ? { reservationId: 'r-1', fence: 1.5 } : 'wrong'
  f.readHook = () => ({ data: [bad] })
  const result = await f.make().sweep(); assert.equal(result.scan, 'unavailable'); assert.equal(f.calls.length, 0)
})
for (const badPage of [[makeRow(2), makeRow(1)], [makeRow(1), makeRow(1)], [makeRow(1), makeRow(2), makeRow(3), makeRow(4)]]) test('unordered, duplicate or oversized page refuses before release', async () => {
  const f = fixture(); f.readHook = () => ({ data: badPage })
  assert.equal((await f.make().sweep()).scan, 'unavailable'); assert.equal(f.calls.length, 0)
})
test('page accessor cannot execute as proof', async () => {
  const f = fixture(); let touched = false
  const bad = makeRow(1); Object.defineProperty(bad, 'state', { enumerable: true, get() { touched = true; return 'held' } })
  f.readHook = () => ({ data: [bad] })
  assert.equal((await f.make().sweep()).scan, 'unavailable'); assert.equal(touched, false)
})
for (const mode of ['missing-schema', 'missing-ledger-read', 'throw', 'timeout']) test(`unavailable read ${mode} never claims completion or zero held`, async () => {
  const f = fixture(1, { timeoutMs: 20 })
  f.readHook = () => { if (mode === 'throw') throw Error('private read'); if (mode === 'timeout') return new Promise(() => {}); return { data: null, error: { code: mode } } }
  const result = await f.make().sweep(); assert.equal(result.scan, 'unavailable'); assert.equal(f.calls.length, 0)
})
test('timed-out release stays unknown; late completion never mutates returned result or cursor', async () => {
  const f = fixture(3, { timeoutMs: 20 }); let finish
  f.rpcHook = () => new Promise(resolve => { finish = resolve })
  const recovery = f.make(), result = await recovery.sweep(), snapshot = structuredClone(result)
  assert.equal(result.items[0].state, 'unknown'); assert.equal(result.next.afterSeq, 10)
  finish({ data: { released: true, repeated: false, receipt_seq: 100 } }); await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(result, snapshot)
  f.rpcHook = undefined
  assert.equal((await recovery.sweep()).items[0].reservationId, 'r-2')
})
test('lost RPC response after SQL release never becomes local released proof', async () => {
  const f = fixture()
  f.rpcHook = () => { f.rows[0].state = 'released'; f.rows[0].released_seq = 1010; throw Error('lost response') }
  const result = await f.make().sweep(); assert.equal(result.items[0].state, 'unknown')
  assert.equal(result.scan, 'complete', 'scan completion is not ownership resolution')
})
for (const mismatch of ['task_run_id', 'session_id', 'run_ordinal', 'released_seq']) test(`successful RPC with changed ${mismatch} readback is unknown`, async () => {
  const f = fixture(); f.proof.add('r-1')
  f.readHook = shape => {
    if (!shape.single) return undefined
    const changed = structuredClone(f.rows[0]); changed[mismatch] = typeof changed[mismatch] === 'number' ? changed[mismatch] + 1 : uuid(99)
    return { data: changed }
  }
  assert.equal((await f.make().sweep()).items[0].state, 'unknown')
})
test('foreign restored cursor, unbounded config and implicit defaults refuse', () => {
  const f = fixture()
  for (const overrides of [{ pageSize: 0 }, { pageSize: 101 }, { maxPages: 101 }, { timeoutMs: 30001 }, { timeoutMs: undefined },
    { initialCursor: { ...scope, poolId: 'foreign', afterSeq: 10 } }, { initialCursor: { ...scope, afterSeq: Number.MAX_SAFE_INTEGER + 1 } }])
    assert.throws(() => f.make(overrides))
})
