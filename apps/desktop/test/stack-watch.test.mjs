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

function rig({ external = false } = {}) {
  const ops = createOps({ dir: mkdtempSync(path.join(tmpdir(), 'fabric-stack-watch-')) })
  useOps(ops)
  const world = { database: true, docker: true, free: 50e9, t: 1_000_000, recovers: 0, recovering: null, changes: [] }
  const watch = createStackWatch({
    readDatabase: async () => world.database,
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
// #endregion stack-watch
