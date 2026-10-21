// #region stack-watch — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
// ST-2 and ST-1 of the 0.3.9 stability audit, the main process half: about 11 of 17.5 hours of outage in a week were
// the app alive and the database gone, with no record, no refusal and no try to bring it back. Here, with the stack,
// Docker, the disk and the clock supplied by the test:
//   - a lost stack is recorded ONCE, the hub is put into stack-unavailable, and Fabric tries the same start path as at
//     launch, with backoff (10 s growing to 2 min), never two tries at once;
//   - its return is recorded once and the hub leaves the mode;
//   - a low disk is recorded once per crossing and named with the stack's state;
//   - an external stack (no Docker, SUPABASE_URL given) is watched but never started by Fabric.
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const SRC = path.resolve(import.meta.dirname, '../src/main')
const { createOps } = await import(path.join(SRC, 'ops.ts'))
const { useOps } = await import(path.join(SRC, 'opsSink.ts'))
const { createStackWatch } = await import(path.join(SRC, 'stackWatch.ts'))

function rig({ external = false, containers = null, readDeadlineMs } = {}) {
  const ops = createOps({ dir: mkdtempSync(path.join(tmpdir(), 'fabric-stack-watch-')) })
  useOps(ops)
  const world = { database: true, docker: true, free: 50e9, t: 1_000_000, recovers: 0, recovering: null, changes: [], containers }
  const watch = createStackWatch({
    readDatabase: async () => (world.database === 'hang' ? new Promise(() => {}) : world.database),
    ...(containers ? { containers: async () => world.containers } : {}),
    ...(readDeadlineMs ? { readDeadlineMs } : {}),
    pingDocker: external ? null : async () => world.docker,
    freeDisk: () => world.free,
    recover: external ? null : async () => {
      world.recovers++
      if (world.recovering) await world.recovering
    },
    onChange: (view, refusal) => world.changes.push({ view, refusal }),
    now: () => world.t
  })
  const tick = async (ms = 30_000) => { world.t += ms; await watch.tick() }
  const records = (op) => ops.read().filter((r) => r.op === op)
  return { world, watch, tick, records }
}

test('ST-2: a healthy stack writes nothing, tick after tick', async () => {
  const { tick, records, world } = rig()
  for (let i = 0; i < 40; i++) await tick()
  assert.equal(records('stack.lost').length + records('stack.back').length + records('stack.disk-low').length, 0)
  assert.equal(world.recovers, 0)
  assert.equal(world.changes.length, 0)
})

test('ST-2: a lost stack is recorded once, the hub refuses, and Fabric brings it back with backoff', async () => {
  const { tick, records, world, watch } = rig()
  world.database = false
  world.docker = false
  await tick()
  await tick()
  const lost = records('stack.lost')
  assert.equal(lost.length, 1)
  assert.equal(lost[0].detail.why, 'docker')
  assert.equal(watch.refusal()?.code, 'stack-unavailable')
  assert.equal(world.changes.at(-1).refusal.code, 'stack-unavailable')
  assert.equal(world.changes.at(-1).view.stack, 'down')
  // The first try is due 10 s after the loss; then 20 s, 40 s, 80 s, 120 s, 120 s.
  const triedAt = []
  for (let i = 0; i < 60; i++) {
    const before = world.recovers
    await tick(5_000)
    if (world.recovers > before) triedAt.push(world.t)
  }
  assert.deepEqual(triedAt.slice(1, 5).map((t, i) => t - triedAt[i]), [20_000, 40_000, 80_000, 120_000])
  assert.equal(records('stack.lost').length, 1, 'still one record however long it stays down')
  world.database = true
  world.docker = true
  await tick()
  assert.equal(records('stack.back').length, 1)
  assert.equal(watch.refusal(), null)
  assert.equal(world.changes.at(-1).refusal, null)
  assert.equal(world.changes.at(-1).view.stack, 'up')
  await tick()
  assert.equal(records('stack.back').length, 1)
})

test('ST-2: never two tries at once, and a try that fails is recorded with its attempt', async () => {
  const { tick, world } = rig()
  let release
  world.recovering = new Promise((r) => { release = r })
  world.database = false
  await tick()
  await tick()
  const first = (async () => { await tick(10_000) })()
  await new Promise((r) => setImmediate(r))
  for (let i = 0; i < 10; i++) await tick(60_000)
  assert.equal(world.recovers, 1, 'a second try started while the first was still running')
  release()
  await first
})

test('ST-1: a low disk is recorded once per crossing and named as the likely cause of a lost stack', async () => {
  const { tick, records, world } = rig()
  world.free = 2.5e9
  for (let i = 0; i < 5; i++) await tick()
  assert.equal(records('stack.disk-low').length, 1)
  assert.equal(world.changes.at(-1).view.diskLow, true)
  world.database = false
  world.docker = false
  await tick()
  await tick()
  assert.equal(records('stack.lost')[0].detail.disk_low, true)
  assert.equal(world.changes.at(-1).view.diskLikelyCause, true)
  world.free = 10e9
  world.database = true
  world.docker = true
  await tick()
  assert.equal(records('stack.disk-ok').length, 1)
})

test('ST-2: an external stack is watched, refused while down, and never started by Fabric', async () => {
  const { tick, records, world, watch } = rig({ external: true })
  world.database = false
  for (let i = 0; i < 10; i++) await tick()
  assert.equal(records('stack.lost').length, 1)
  assert.equal(records('stack.lost')[0].detail.why, 'database')
  assert.equal(world.recovers, 0)
  assert.equal(watch.refusal()?.code, 'stack-unavailable')
})
const settle = () => new Promise((r) => setImmediate(r))

// 0.3.9 review UX-2: a try that ran past its due time (Docker hung) left the next try in the past, so every view read
// «next try in 0 s», Retry-After fell to 5 s and the watch read every second until the try ended.
test('UX-2: while a try runs, the view says so (no countdown at 0) and agents wait 30 s; the next is due after it ends', async () => {
  const { tick, world, watch } = rig()
  let release
  world.recovering = new Promise((r) => { release = r })
  world.database = false
  await tick()
  await tick()
  await tick(10_000)
  assert.equal(world.recovers, 1)
  for (let i = 0; i < 20; i++) {
    await tick(15_000)
    const v = watch.view()
    assert.equal(v.trying, true)
    assert.equal(v.attempt, 1)
    assert.equal(v.nextTryInS, null, `the notice counts down to a try that is running (${v.nextTryInS} s)`)
    assert.equal(watch.refusal().retryAfterS, 30)
  }
  assert.ok(world.changes.every((c) => !(c.view.stack === 'down' && c.view.nextTryInS === 0)), 'a view said next try in 0 s')
  release()
  await settle()
  await settle()
  const v = watch.view()
  assert.equal(v.trying, false)
  assert.equal(v.nextTryInS, 20, 'the next try waits the backoff from the end of the last one')
  assert.equal(world.changes.at(-1).view.trying, false, 'the end of the try is published')
})

test('UX-2: an external stack is said as waited for, never as being brought back', async () => {
  const { tick, world, watch } = rig({ external: true })
  world.database = false
  for (let i = 0; i < 4; i++) await tick()
  assert.equal(watch.view().hold, 'external')
  assert.equal(watch.view().nextTryInS, null)
  assert.doesNotMatch(watch.refusal().reason, /bringing it back/)
  assert.equal(watch.refusal().retryAfterS, 30)
})

// 0.3.9 review ER-3: the watch started a stack the operator stopped (`supabase stop`), and ran `supabase start` against
// containers that were running all along; and it recorded no reason for a try.
test('ER-3: containers gone (a deliberate stop) are not started again, and that is recorded once', async () => {
  const { tick, world, watch, records } = rig({ containers: 'absent' })
  world.database = false
  for (let i = 0; i < 20; i++) { await tick(15_000); await settle() }
  assert.equal(world.recovers, 0, 'Fabric started a stack that was stopped on purpose')
  assert.equal(watch.view().hold, 'stopped')
  const held = records('stack.recover.held')
  assert.equal(held.length, 1)
  assert.equal(held[0].detail.hold, 'stopped')
  assert.equal(held[0].detail.containers, 'absent')
  // Started again by the person: the stack is back and the hold is gone.
  world.database = true
  await tick()
  assert.equal(watch.view().stack, 'up')
  assert.equal(watch.view().hold, null)
})

test('ER-3: running containers are waited for, not started; stopped ones are started, with why', async () => {
  const run = rig({ containers: 'running' })
  run.world.database = false
  for (let i = 0; i < 10; i++) { await run.tick(15_000); await settle() }
  assert.equal(run.world.recovers, 0, '`supabase start` ran against containers that were running')
  assert.equal(run.watch.view().hold, 'running')
  // The containers exit: now a start is the remedy.
  run.world.containers = 'stopped'
  for (let i = 0; i < 4 && run.world.recovers === 0; i++) { await run.tick(15_000); await settle() }
  assert.equal(run.world.recovers, 1)
  const tried = run.records('stack.recover')
  assert.equal(tried.length, 1)
  assert.equal(tried[0].detail.containers, 'stopped')
  assert.equal(tried[0].detail.down, 'database')
  assert.match(tried[0].detail.because, /not running/)
})

// 0.3.9 review ER-4: a slow but working database (answers after the read deadline) is not a lost stack at once.
test('ER-4: reads that only run out of time take three in a row to count as lost; the hub keeps answering until then', async () => {
  const { tick, world, watch, records } = rig({ readDeadlineMs: 20 })
  world.database = 'hang'
  await tick()
  await tick()
  assert.equal(records('stack.lost').length, 0, 'two slow reads put the hub into refusal')
  assert.equal(watch.refusal(), null)
  await tick()
  assert.equal(records('stack.lost').length, 1)
})

// 0.3.9 review iteration 2, ER-1: a try that ended while a timer's read was still in flight scheduled a second chain of
// reads (its `clearTimeout` hit the timer that had already fired, and the read then scheduled its own next). Driven
// through `start()` with the watch's timers held by the test, so every pending read is counted.
test('ER-1 (i2): one chain of reads, however many tries end while a read is in flight', async () => {
  const ops = createOps({ dir: mkdtempSync(path.join(tmpdir(), 'fabric-stack-watch-')) })
  useOps(ops)
  const pending = new Map()
  let seq = 0
  const timers = {
    set: (fn, ms) => { const id = ++seq; pending.set(id, { fn, ms }); return id },
    clear: (id) => { pending.delete(id) }
  }
  const fire = async () => {
    const [id, t] = [...pending.entries()].sort((a, b) => a[1].ms - b[1].ms)[0]
    pending.delete(id)
    t.fn()
    await settle()
  }
  let t = 1_000_000
  let read = null
  let release = null
  const watch = createStackWatch({
    readDatabase: () => new Promise((resolve) => { read = resolve }),
    pingDocker: async () => true,
    freeDisk: () => 50e9,
    recover: async () => { await new Promise((r) => { release = r }) },
    onChange: () => {},
    now: () => t,
    timers
  })
  // The stack is lost and a try begins: three failed reads, 10 s apart.
  for (let i = 0; i < 3; i++) {
    t += 10_000
    const reading = watch.tick()
    await settle()
    read(false)
    await reading
  }
  await settle()
  assert.equal(typeof release, 'function', 'a try is running')
  watch.start()
  assert.equal(pending.size, 1)
  for (let round = 0; round < 4; round++) {
    // The chain's timer fires and its read is in flight when the try ends.
    t += 30_000
    await fire()
    assert.equal(pending.size, 0, 'a read is in flight, nothing else pending')
    const ending = release
    release = null
    ending()
    await settle()
    await settle()
    read(false)
    await settle()
    await settle()
    assert.equal(pending.size, 1, `round ${round}: ${pending.size} chains of reads are pending, one expected`)
    // Let the next due try begin, so the next round ends one again during a read.
    for (let i = 0; i < 10 && !release; i++) {
      t += 120_000
      await fire()
      read(false)
      await settle()
      await settle()
    }
    assert.equal(typeof release, 'function', `round ${round}: the next try began`)
    assert.equal(pending.size, 1)
  }
  watch.stop()
  assert.equal(pending.size, 0, 'stop leaves nothing pending')
})

// 0.3.9 review iteration 2, UX-1: while Fabric holds off a start (a stack stopped by `supabase stop`, containers
// running with a silent database), its re-check every 30 s showed «Trying now (try 1)» beside the hold.
test('UX-1 (i2): a re-check while a hold stands is never said as a try; a start after it is', async () => {
  const { tick, world, watch } = rig({ containers: 'running' })
  world.database = false
  for (let i = 0; i < 6; i++) { await tick(15_000); await settle() }
  assert.equal(watch.view().hold, 'running')
  // The next re-check: Docker takes its time to answer.
  let answer
  world.containers = new Promise((r) => { answer = r })
  for (let i = 0; i < 4 && !answer.called; i++) { await tick(15_000); await settle() }
  const during = watch.view()
  assert.equal(during.hold, 'running')
  assert.equal(during.trying, false, 'the notice says «Trying now» while Fabric holds off a start')
  assert.equal(during.attempt, null)
  assert.ok(world.changes.every((c) => !(c.view.trying && c.view.hold)), 'a published view said a try and a hold at once')
  // The containers have exited meanwhile: this re-check starts the stack, and that IS said as a try.
  let release
  world.recovering = new Promise((r) => { release = r })
  answer('stopped')
  await settle()
  await settle()
  assert.equal(world.recovers, 1)
  const starting = watch.view()
  assert.deepEqual([starting.trying, starting.hold, starting.attempt], [true, null, 1])
  release()
  await settle()
})
// 0.3.9 review iteration 3, ER-1: `stop()` (a quit) only stopped the scheduling; a read already in flight went on to
// the try, and the try launched `supabase start` after the quit had begun. After stop no try may begin, and a try whose
// Docker question was in flight when stop came launches nothing.
test('ER-1 (i3): after stop, a read in flight starts no try', async () => {
  const ops = createOps({ dir: mkdtempSync(path.join(tmpdir(), 'fabric-stack-watch-')) })
  useOps(ops)
  const pending = new Map()
  let seq = 0
  const timers = {
    set: (fn, ms) => { const id = ++seq; pending.set(id, { fn, ms }); return id },
    clear: (id) => { pending.delete(id) }
  }
  let t = 1_000_000
  let read = null
  let recovers = 0
  const watch = createStackWatch({
    readDatabase: () => new Promise((resolve) => { read = resolve }),
    pingDocker: async () => false,
    freeDisk: () => 50e9,
    recover: async () => { recovers++ },
    onChange: () => {},
    now: () => t,
    timers
  })
  watch.start()
  // Two failed reads through the chain: the stack is lost, a try is due at the next.
  for (let i = 0; i < 2; i++) {
    const [id, timer] = [...pending.entries()][0]
    pending.delete(id)
    t += 30_000
    timer.fn()
    await settle()
    read(false)
    await settle()
    await settle()
  }
  assert.equal(watch.view().stack, 'down')
  assert.equal(recovers, 0)
  // The next read is in flight, a try is due when it ends, and the quit stops the watch now.
  const [id, timer] = [...pending.entries()][0]
  pending.delete(id)
  t += 30_000
  timer.fn()
  await settle()
  watch.stop()
  read(false)
  for (let i = 0; i < 5; i++) await settle()
  assert.equal(recovers, 0, 'the watch started the stack after stop')
  assert.equal(pending.size, 0, 'stop leaves nothing pending')
})

test('ER-1 (i3): a try whose Docker question is in flight when stop comes launches nothing', async () => {
  const { tick, world, watch } = rig({ containers: 'stopped' })
  world.database = false
  let answer
  world.containers = new Promise((r) => { answer = r })
  for (let i = 0; i < 6 && !answer.started; i++) { await tick(15_000); await settle() }
  assert.equal(watch.view().trying, true, 'a try is asking Docker')
  watch.stop()
  answer('stopped')
  for (let i = 0; i < 5; i++) await settle()
  assert.equal(world.recovers, 0, 'the try launched supabase start after stop')
  assert.equal(watch.view().trying, false, 'the try ended')
})
// #endregion stack-watch
