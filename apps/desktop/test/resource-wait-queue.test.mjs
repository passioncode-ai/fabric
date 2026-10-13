import test from 'node:test'
import assert from 'node:assert/strict'
const { createResourceWaitQueue } = await import(process.env.RESOURCE_WAIT_MODULE || '../src/main/resourceWaitQueue.ts')

// The fixture executes the production kernel. Its in-memory CAS models the PORT
// contract only: these tests do not establish SQL atomicity, disk durability,
// permissions, real clocks, managed admission or native/provider execution.
const clone = value => structuredClone(value)
const scope = { estateId: 'estate', hostId: 'host', poolId: 'pool' }
const key = (s, id) => JSON.stringify([s.estateId, s.hostId, s.poolId, id])
const active = new Set(['waiting', 'claimed', 'dispatch_started', 'outcome_unknown'])
const input = (id = 'a', changes = {}) => ({ scope: { ...scope }, id, taskId: `task:${id}`, sessionId: `session:${id}`,
  attemptId: `attempt:${id}`, ownerId: 'owner', fence: 1, inputDigest: 'a'.repeat(64), scopeDigest: 'b'.repeat(64),
  conditionKey: 'capacity', resumePoint: 'managed-admission', action: 'managed_task_launch',
  demand: { workerSlots: 1, memoryBytes: 100, diskBytes: 0, cpuMilliCores: 1000 },
  createdAt: 1000, deadlineAt: 100000, ...changes })
function fixture(options = {}) {
  let time = 1000, ordinal = 0
  const records = new Map(), effects = [], pageLimits = []
  const store = {
    async insert(i) {
      const k = key(i.scope, i.id), old = records.get(k)
      if (old) { assert.deepEqual(old.input, i); return clone(old) }
      const row = { input: clone(i), ordinal: ++ordinal, revision: 1, state: 'waiting', updatedAt: time,
        nextCheckAt: time, claim: null }
      records.set(k, row); return clone(row)
    },
    async read(s, id) { return clone(records.get(key(s, id)) ?? null) },
    async page(s, limit) {
      pageLimits.push(limit)
      const rows = [...records.values()].filter(r => key(r.input.scope, '') === key(s, '') && active.has(r.state))
        .sort((a, b) => a.ordinal - b.ordinal)
      return { rows: clone(rows.slice(0, limit)), more: rows.length > limit }
    },
    async cas(s, id, rev, next) {
      const k = key(s, id), old = records.get(k)
      if (!old || old.revision !== rev) return false
      assert.deepEqual(next.input, old.input); assert.equal(next.ordinal, old.ordinal)
      assert.equal(next.revision, rev + 1)
      records.set(k, clone(next)); return true
    }
  }
  const deps = { store, now: () => time, workerId: 'worker', pageSize: 2, claimMs: 100, timeoutMs: 100,
    neverStarted: async () => true, inspect: async () => ({ state: 'ready' }),
    dispatch: async (i, permit) => { if (!await permit()) return 'refused_before_start'; effects.push(clone(i)); return 'started' },
    ...options }
  const queue = () => createResourceWaitQueue(deps)
  return { store, deps, queue, records, effects, pageLimits, tick: t => { time = t },
    row: id => records.get(key(scope, id)), async add(i = input()) { return queue().enqueue(i) } }
}
function latch() { let release; const promise = new Promise(resolve => { release = resolve }); return { promise, release } }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

test('authorized wake re-enters dispatcher with exact frozen identity and one boundary permit', async () => {
  const f = fixture(), i = input(), original = clone(i)
  assert.deepEqual(await f.add(i), { state: 'waiting', id: 'a' })
  i.demand.memoryBytes = 999
  assert.equal((await f.queue().pass(scope)).state, 'dispatched')
  assert.deepEqual(f.effects, [original])
  assert.equal((await f.queue().pass(scope)).state, 'empty')
  assert.deepEqual(f.pageLimits, [2, 2])
})
test('concurrent workers and restart use stored CAS identity without replay', async () => {
  const f = fixture(); await f.add()
  const results = await Promise.all([f.queue().pass(scope), f.queue().pass(scope)])
  assert.equal(results.filter(r => r.state === 'dispatched').length, 1)
  assert.equal(f.effects.length, 1)
  assert.equal((await f.queue().pass(scope)).state, 'empty')
})
test('idempotent enqueue rejects changed identity without replacing the record', async () => {
  const f = fixture(); await f.add(); const original = clone(f.row('a'))
  assert.equal((await f.add()).state, 'waiting')
  assert.equal((await f.add(input('a', { fence: 2 }))).state, 'unknown')
  assert.deepEqual(f.row('a'), original)
})
test('live work is never enqueued and there is no process-release operation', async () => {
  const f = fixture({ neverStarted: async () => false })
  assert.equal((await f.add()).state, 'unknown')
  assert.equal(f.records.size, 0)
  assert.deepEqual(Object.keys(f.queue()).sort(), ['cancel', 'enqueue', 'pass'])
})
test('strict FIFO holds cheap work behind capacity-blocked expensive head then eventually admits it', async () => {
  let ready = false
  const f = fixture({ pageSize: 2, inspect: async i => i.id === 'expensive' && !ready
    ? { state: 'wait', nextCheckAt: 1100 } : { state: 'ready' } })
  await f.add(input('expensive', { demand: { workerSlots: 4, memoryBytes: 400, diskBytes: 0, cpuMilliCores: 4000 } }))
  for (let n = 0; n < 8; n++) await f.add(input(`cheap${n}`))
  assert.equal((await f.queue().pass(scope)).state, 'deferred')
  assert.equal((await f.queue().pass(scope)).state, 'deferred')
  assert.equal(f.effects.length, 0)
  ready = true; f.tick(1100)
  assert.equal((await f.queue().pass(scope)).id, 'expensive')
  assert.equal(f.effects[0].id, 'expensive')
  assert.equal((await f.queue().pass(scope)).id, 'cheap0')
  assert.ok(f.pageLimits.every(x => x === 2))
})
test('cancellation wins CAS while readiness is in flight; no effect follows', async () => {
  const gate = latch(), entered = latch()
  const f = fixture({ inspect: async () => { entered.release(); await gate.promise; return { state: 'ready' } } })
  await f.add(); const pass = f.queue().pass(scope); await entered.promise
  assert.equal((await f.queue().cancel(input())).state, 'cancelled')
  gate.release(); assert.equal((await pass).state, 'contended'); assert.equal(f.effects.length, 0)
})
test('cancellation after begin is not process termination or retry permission', async () => {
  const entered = latch(), gate = latch()
  const f = fixture({ dispatch: async (_i, permit) => { assert.equal(await permit(), true); entered.release(); await gate.promise; return 'started' } })
  await f.add(); const pass = f.queue().pass(scope); await entered.promise
  assert.equal((await f.queue().cancel(input())).state, 'dispatch_started')
  gate.release(); assert.equal((await pass).state, 'dispatched')
})
test('restart reclaims only expired pre-effect claim and fences the previous worker', async () => {
  const gate = latch(), entered = latch(); let first = true
  const f = fixture({ inspect: async () => { if (first) { first = false; entered.release(); await gate.promise }; return { state: 'ready' } } })
  await f.add(); const old = f.queue().pass(scope); await entered.promise
  f.tick(1100)
  assert.equal((await f.queue().pass(scope)).state, 'dispatched')
  gate.release(); assert.notEqual((await old).state, 'dispatched'); assert.equal(f.effects.length, 1)
})
test('changed inputs/authority at final boundary refuse even after ready selection', async () => {
  let n = 0
  const f = fixture({ inspect: async () => ({ state: ++n === 1 ? 'ready' : 'invalid' }) })
  await f.add(); assert.equal((await f.queue().pass(scope)).state, 'refused_before_start'); assert.equal(f.effects.length, 0)
})
test('invalid ownership is invalidated; unknown conditions do not authorize and back off', async () => {
  for (const verdict of ['invalid', 'unknown']) {
    const f = fixture({ inspect: async () => ({ state: verdict }) }); await f.add()
    assert.equal((await f.queue().pass(scope)).state, verdict === 'invalid' ? 'invalidated' : 'deferred')
    assert.equal(f.effects.length, 0)
    if (verdict === 'unknown') assert.equal(f.row('a').nextCheckAt, 1100)
  }
})
test('deadline and backwards clock never authorize effects', async () => {
  const f = fixture(); await f.add(); f.tick(100000)
  assert.equal((await f.queue().pass(scope)).state, 'expired'); assert.equal(f.effects.length, 0)
  const g = fixture(); await g.add(); g.tick(999)
  assert.equal((await g.queue().pass(scope)).state, 'unknown'); assert.equal(g.effects.length, 0)
})
test('expired permit, duplicate permit and success without permit are not accepted', async () => {
  const f = fixture({ dispatch: async (_i, permit) => { f.tick(1100); assert.equal(await permit(), false); return 'started' } })
  await f.add(); assert.equal((await f.queue().pass(scope)).state, 'outcome_unknown')
  const g = fixture({ dispatch: async (_i, permit) => { assert.equal(await permit(), true); assert.equal(await permit(), false); return 'started' } })
  await g.add(); assert.equal((await g.queue().pass(scope)).state, 'dispatched')
  const h = fixture({ dispatch: async () => 'started' }); await h.add()
  assert.equal((await h.queue().pass(scope)).state, 'outcome_unknown')
})
test('timeout after begin retains unknown and restarted worker never blindly retries', async () => {
  const gate = latch(); let calls = 0
  const f = fixture({ timeoutMs: 10, dispatch: async () => { calls++; await gate.promise; return 'started' } })
  await f.add(); assert.equal((await f.queue().pass(scope)).state, 'unknown')
  f.tick(5000); assert.equal((await f.queue().pass(scope)).state, 'outcome_unknown')
  assert.equal(calls, 1); gate.release(); await pause(0)
  assert.equal(f.row('a').state, 'dispatch_started')
})
test('lost begin reply persists an unreclaimable effect fence, without calling dispatch', async () => {
  const f = fixture(); await f.add(); const cas = f.store.cas
  f.store.cas = async (...args) => { const yes = await cas(...args); if (args[3].state === 'dispatch_started') throw Error('lost reply'); return yes }
  assert.equal((await f.queue().pass(scope)).state, 'unknown')
  assert.equal(f.row('a').state, 'dispatch_started'); f.tick(2000)
  assert.equal((await f.queue().pass(scope)).state, 'outcome_unknown'); assert.equal(f.effects.length, 0)
})
test('lost settlement reply cannot reset dispatched work', async () => {
  const f = fixture(); await f.add(); const cas = f.store.cas
  f.store.cas = async (...args) => { const yes = await cas(...args); if (args[3].state === 'dispatched') throw Error('lost reply'); return yes }
  assert.equal((await f.queue().pass(scope)).state, 'unknown')
  assert.equal(f.row('a').state, 'dispatched')
  assert.equal((await f.queue().pass(scope)).state, 'empty'); assert.equal(f.effects.length, 1)
})
test('refused admission is terminal for this attempt; do not recycle adapter cached identity', async () => {
  let calls = 0
  const f = fixture({ dispatch: async () => { calls++; return 'refused_before_start' } }); await f.add()
  assert.equal((await f.queue().pass(scope)).state, 'refused_before_start')
  assert.equal((await f.queue().pass(scope)).state, 'empty'); assert.equal(calls, 1)
})
test('incomplete, oversized, unsorted, foreign and unknown-state pages fail closed', async () => {
  for (const breakPage of [
    () => ({ rows: [], more: true }),
    p => ({ ...p, rows: [...p.rows, p.rows[0]] }),
    p => ({ ...p, rows: [...p.rows].reverse() }),
    p => { p.rows[0].input.scope.poolId = 'foreign'; return p },
    p => { p.rows[0].state = 'nonsense'; return p }
  ]) {
    const f = fixture(); await f.add(); await f.add(input('b')); const page = f.store.page
    f.store.page = async (...args) => breakPage(await page(...args))
    assert.equal((await f.queue().pass(scope)).state, 'unknown'); assert.equal(f.effects.length, 0)
  }
})
test('hostile inputs and accessor observations are rejected without invoking getters', async () => {
  let hits = 0
  const accessor = input(); Object.defineProperty(accessor, 'ownerId', { get() { hits++; throw Error('getter') } })
  for (const bad of [accessor, input('a', { fence: 1.5 }), input('a', { scopeDigest: 'short' }),
    input('a', { deadlineAt: Infinity }), input('a', { action: 'release' }),
    input('a', { demand: { workerSlots: 1, memoryBytes: -1, diskBytes: 0, cpuMilliCores: 1 } }),
    input('a', { createdAt: 2000 }), { ...input(), extra: true }]) {
    const f = fixture(); assert.equal((await f.add(bad)).state, 'unknown'); assert.equal(f.records.size, 0)
  }
  const f = fixture({ inspect: async () => Object.defineProperty({}, 'state', { get() { hits++; return 'ready' } }) })
  await f.add(); assert.equal((await f.queue().pass(scope)).state, 'unknown'); assert.equal(hits, 0)
})
test('dependency failures and stale CAS receipts refuse without exposing raw errors', async () => {
  const f = fixture({ inspect: async () => { throw Error('private-details') } }); await f.add()
  assert.deepEqual(await f.queue().pass(scope), { state: 'unknown' }); assert.equal(f.effects.length, 0)
  const g = fixture(); await g.add(); g.store.cas = async () => ({ ok: true })
  assert.equal((await g.queue().pass(scope)).state, 'unknown'); assert.equal(g.effects.length, 0)
})
test('explicit safe bounds and queue clock are required', async () => {
  for (const value of [0, -1, 1.2, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => fixture({ pageSize: value }).queue())
    assert.throws(() => fixture({ claimMs: value }).queue())
    assert.throws(() => fixture({ timeoutMs: value }).queue())
  }
  const f = fixture({ now: () => NaN }); assert.equal((await f.add()).state, 'unknown')
})

if (!process.env.RESOURCE_WAIT_MODULE) test('negative controls fail when final authority, unknown fence or FIFO selection is removed', async () => {
  const { mkdtemp, readFile, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { fileURLToPath, pathToFileURL } = await import('node:url')
  const { spawnSync } = await import('node:child_process')
  const source = await readFile(new URL('../src/main/resourceWaitQueue.ts', import.meta.url), 'utf8')
  const root = await mkdtemp(join(tmpdir(), 'fabric-wait-plants-'))
  try {
    for (const [name, before, after, pattern] of [
      ['authority', "if ((await checked(op, boundary.input)).state !== 'ready') return false", '', 'changed inputs/authority'],
      ['unknown', "if (head.state === 'outcome_unknown' || head.state === 'dispatch_started') return result('outcome_unknown')", '', 'timeout after begin'],
      ['fifo', 'const head = rows[0]', 'const head = rows[rows.length - 1]', 'strict FIFO']
    ]) {
      assert.equal(source.split(before).length, 2, `one mutation site: ${name}`)
      const target = join(root, `${name}.ts`)
      await writeFile(target, source.replace(before, after))
      const childEnv = { ...process.env, RESOURCE_WAIT_MODULE: pathToFileURL(target).href }
      delete childEnv.NODE_TEST_CONTEXT
      const run = spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-name-pattern', pattern,
        fileURLToPath(import.meta.url)], { env: childEnv, encoding: 'utf8', timeout: 10000 })
      assert.equal(run.status, 1, `plant ${name} must reach assertions and fail: ${run.stdout} ${run.stderr}`)
      assert.match(run.stdout, /ERR_ASSERTION|AssertionError/)
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('ten repeated timeout calls retain one outstanding dependency until settlement for every entry point', async () => {
  for (const method of ['enqueue', 'pass', 'cancel']) {
    const gate = latch(); let calls = 0
    const f = fixture({ timeoutMs: 5 }); if (method !== 'enqueue') await f.add()
    const q = f.queue()
    if (method === 'enqueue') f.deps.neverStarted = async () => { calls++; if (calls === 1) await gate.promise; return true }
    else {
      const name = method === 'pass' ? 'page' : 'read', original = f.store[name]
      f.store[name] = async (...args) => { calls++; if (calls === 1) await gate.promise; return original(...args) }
    }
    const invoke = () => method === 'pass' ? q.pass(scope) : q[method](input())
    assert.equal((await invoke()).state, 'unknown')
    for (let i = 0; i < 10; i++) assert.equal((await invoke()).state, 'busy', method)
    assert.equal(calls, 1, method)
    gate.release(); await pause(0)
    assert.notEqual((await invoke()).state, 'busy', method)
    assert.ok(calls > 1, `${method}: a fresh operation was allowed after settlement`)
  }
})
test('late nested permit after dispatch timeout cannot initiate new dependency work', async () => {
  const gate = latch(); let inspections = 0, latePermit
  const f = fixture({ timeoutMs: 5,
    inspect: async () => { inspections++; return { state: 'ready' } },
    dispatch: async (_i, permit) => { await gate.promise; latePermit = await permit(); return 'started' } })
  await f.add(); const q = f.queue()
  assert.equal((await q.pass(scope)).state, 'unknown')
  for (let i = 0; i < 10; i++) assert.equal((await q.pass(scope)).state, 'busy')
  gate.release(); await pause(0)
  assert.equal(latePermit, false); assert.equal(inspections, 1)
  assert.equal((await q.pass(scope)).state, 'outcome_unknown')
})
test('nested permit dependency remains owned after timeout and releases busy only after settlement', async () => {
  const gate = latch(); let inspections = 0, reads = 0
  const f = fixture({ timeoutMs: 5, inspect: async () => {
    inspections++; if (inspections === 2) await gate.promise; return { state: 'ready' }
  } })
  await f.add(); const read = f.store.read
  f.store.read = async (...args) => { reads++; return read(...args) }
  const q = f.queue(); await q.pass(scope)
  for (let i = 0; i < 10; i++) assert.equal((await q.pass(scope)).state, 'busy')
  gate.release(); await pause(0)
  assert.equal(reads, 0); assert.equal(inspections, 2)
  assert.equal((await q.pass(scope)).state, 'outcome_unknown')
})
test('retained permit after completed operation is revoked before inspecting anything', async () => {
  let savedPermit, inspections = 0
  const f = fixture({ inspect: async () => { inspections++; return { state: 'ready' } },
    dispatch: async (_i, permit) => { savedPermit = permit; return 'refused_before_start' } })
  await f.add(); assert.equal((await f.queue().pass(scope)).state, 'refused_before_start')
  assert.equal(await savedPermit(), false); assert.equal(inspections, 1)
})

test('ordinary rejected async clock is refused without an unhandled process rejection', async () => {
  const { spawnSync } = await import('node:child_process')
  const module = process.env.RESOURCE_WAIT_MODULE || new URL('../src/main/resourceWaitQueue.ts', import.meta.url).href
  const code = `import {createResourceWaitQueue} from ${JSON.stringify(module)};
    const q=createResourceWaitQueue({store:{},now:()=>Promise.reject(Error('synthetic clock')),
      workerId:'worker',pageSize:1,claimMs:100,timeoutMs:10});
    const result=await q.enqueue(${JSON.stringify(input())});
    await new Promise(r=>setImmediate(r));
    console.log(JSON.stringify(result));`
  const run = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', code], { encoding: 'utf8', timeout: 10000 })
  assert.equal(run.status, 0, 'a refused clock must not crash Node')
  assert.deepEqual(JSON.parse(run.stdout), { state: 'unknown' })
})
