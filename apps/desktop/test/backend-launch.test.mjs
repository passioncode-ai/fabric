// First-slice plan B1: the launch receipt seam for an owned backend. The actual managed launch
// runs over the actual owned backend process registry with a fake durable receipt store and
// fault seams; the RESULT of each attempt classifies it, never the registry's snapshot.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createManagedLaunch } from '../src/main/managedLaunch.ts'
import { createBackendLaunch } from '../src/main/backendLaunch.ts'
import { createOwnedBackendProcessRegistry } from '../src/main/ownedBackendProcessRegistry.ts'
import { createProcessBoundary } from '../src/main/processBoundary.ts'
import { isMeasuredRuntime, runtimeTuple } from '../src/main/runtimeAdmission.ts'
if (!isMeasuredRuntime()) { console.error('NOT_RUN: unmeasured runtime for the owned backend: ' + JSON.stringify(runtimeTuple())); process.exit(2) }

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const estate = id(1), person = id(2), dir = mkdtempSync(path.join(tmpdir(), 'fabric-backend-launch-'))
const executable = realpathSync(process.env.FABRIC_BACKEND_NODE ?? process.execPath), hash = createHash('sha256').update(readFileSync(executable)).digest('hex')
const script = path.join(dir, 'backend.mjs')
writeFileSync(script, 'setInterval(()=>{},1000)\n', { mode: 0o600 })
const boundary = createProcessBoundary(), tracked = [], registries = []
const delay = ms => new Promise(r => setTimeout(r, ms))
const until = async (fn, label) => { const deadline = performance.now() + 4000; while (performance.now() < deadline) { if (await fn()) return; await delay(10) } throw Error(label) }
let serial = 10

function world({ root = path.join(dir, 'root-' + serial++), timeoutMs = 1200, native: over = {}, db: faults = {} } = {}) {
  mkdirSync(root, { recursive: true, mode: 0o700 })
  const state = { authority: { personId: person, revision: 1 } }, calls = { spawn: 0, rpc: [], failed: [], stop: 0 }
  const native = {
    spawn: (...args) => { calls.spawn++; const child = spawn(...args), t = { child, owned: null, exited: false }; tracked.push(t); child.once('exit', () => t.exited = true); child.on('error', () => {}); return child },
    boundary: { ...boundary, capture: async pid => { const owned = await boundary.capture(pid); tracked.find(t => t.child.pid === pid).owned = owned; return owned } },
    fdIdentity: () => 'fd', write: () => 0, ...over,
  }
  const registry = createOwnedBackendProcessRegistry({ rootDir: root, estateId: estate, recipe: { executable, executableSha256: hash, argv: [script], cwd: dir, env: { HOME: dir } }, timeoutMs, authority: () => state.authority }, native)
  registries.push(registry)
  const backend = createBackendLaunch(registry)
  const db = { rpc: async (name, args) => {
    calls.rpc.push(name)
    const fault = faults[name]; if (fault) { const r = await fault(args); if (r) return r }
    if (name === 'begin_task_run_launch') return { data: { granted: true, task_run_id: args.p_run_id, session_id: args.p_session_id } }
    if (name === 'validate_task_run_launch') return { data: { valid: true, task_run_id: args.p_run_id, session_id: args.p_session_id } }
    if (name === 'bind_task_run') return { data: { bound: true, task_run_id: args.p_run_id, session_id: args.p_session_id } }
    if (name === 'fail_task_launch') { calls.failed.push(args.p_process_started); return { data: { compensated: true } } }
    throw Error('unexpected RPC ' + name)
  } }
  const launch = createManagedLaunch({
    db, estateId: estate, actor: { kind: 'person', id: person }, authority: () => state.authority,
    admit: async () => { throw Error('admission is given') },
    prepare: async receipt => backend.open(receipt),
    track() {}, untrack() {}, get: sid => backend.get(sid),
    stop: async sid => { calls.stop++; await backend.stop(sid) },
    dispatch: async () => ({ state: 'delivering', says: 'written' }),
  })
  const markers = () => readdirSync(path.join(root, 'backend-processes', estate)).length
  return { registry, backend, launch, state, calls, root, markers }
}
const receipt = () => { const n = serial++; return { admitted: true, project_id: id(3), task_id: id(n), task_run_id: id(n + 1000), session_id: id(n + 2000), run_ordinal: 1, instruction: 'do work' } }
const go = (w, r = receipt()) => w.launch({ taskId: r.task_id, trigger: 'chain', admission: { receipt: r, sessionId: r.session_id } }).then(result => ({ result, r }))
const childOf = () => tracked[tracked.length - 1]
const notStarted = (w, result) => {
  assert.equal(result.started, false); assert.equal(result.reasonCode, 'launch_failed_before_spawn', JSON.stringify(result))
  assert.equal(result.sessionId, undefined, 'a launch that did not start names no session')
  assert.deepEqual(w.calls.failed, [false]); assert.equal(w.calls.stop, 0)
}
const unknown = (w, result) => {
  assert.equal(result.started, false); assert.equal(result.reasonCode, 'launch_outcome_unknown', JSON.stringify(result))
  assert.ok(result.sessionId, 'an unknown launch names the exact session to reconcile')
  assert.deepEqual(w.calls.failed, [true]); assert.equal(w.calls.stop, 1)
}
let count = 0; const test = async (name, fn) => { await fn(); console.log('PASS ' + name); count++ }
try {
  await test('an owned child binds, runs, and is the only thing get() calls running', async () => {
    const w = world(), { result, r } = await go(w)
    assert.equal(result.started, true, JSON.stringify(result)); assert.equal(w.calls.spawn, 1)
    assert.deepEqual(w.backend.get(r.session_id), { running: true })
    assert.equal(w.backend.get(id(9999)), null)
    assert.deepEqual(w.calls.rpc, ['begin_task_run_launch', 'validate_task_run_launch', 'bind_task_run'])
  })

  await test('a refusal before spawn is "not started" although its marker exists and the snapshot reads unknown', async () => {
    const w = world({ db: { validate_task_run_launch: async a => ({ data: { valid: false, task_run_id: a.p_run_id, session_id: a.p_session_id } }) } })
    const { result, r } = await go(w)
    notStarted(w, result); assert.equal(w.calls.spawn, 0)
    assert.equal(w.markers(), 1, 'the attempt reserved its Run on disk')
    assert.equal(w.registry.snapshot(w.backend.handle(r.session_id)).physicalState, 'outcome_unknown', 'the snapshot alone would have said unknown')
    assert.equal(w.backend.get(r.session_id), null)
  })

  await test('a guard hanging past the deadline never spawns late', async () => {
    let release; const w = world({ timeoutMs: 150, db: { validate_task_run_launch: () => new Promise(r => { release = r }) } })
    const { result } = await go(w)
    notStarted(w, result)
    // Under load the 150 ms deadline can pass before the guard is even asked; then there is nothing to release.
    release?.({ data: { valid: true } }); await delay(20); assert.equal(w.calls.spawn, 0)
  })

  await test('authority changing before spawn refuses cleanly', async () => {
    // The durable guard passes; the registry's own fence sees the changed authority tuple.
    const w = world({ db: { validate_task_run_launch: async a => { w.state.authority = { personId: person, revision: 2 }; return { data: { valid: true, task_run_id: a.p_run_id, session_id: a.p_session_id } } } } })
    const { result } = await go(w)
    notStarted(w, result); assert.equal(w.calls.spawn, 0)
  })

  await test('a synchronous spawn throw is unknown, and Stop is asked for', async () => {
    const w = world({ native: { spawn: () => { throw Error('private spawn') } } })
    const { result } = await go(w)
    unknown(w, result)
  })

  await test('a capture failure after spawn is unknown and the child stays retained for Stop and inspection', async () => {
    const w = world({ native: { boundary: { ...boundary, capture: async () => { throw Error('private ps') } } } })
    const { result, r } = await go(w)
    unknown(w, result); assert.equal(w.calls.spawn, 1)
    assert.ok(w.backend.handle(r.session_id), 'the handle is kept')
    assert.equal(w.backend.get(r.session_id), null, 'never reported running')
    assert.equal(w.registry.snapshot(w.backend.handle(r.session_id)).physicalState, 'outcome_unknown')
  })

  await test('a root exit between owned and bind is unknown, never a clean start', async () => {
    const w = world({ db: { bind_task_run: async a => { const t = childOf(); process.kill(t.child.pid, 'SIGKILL'); await until(() => t.exited, 'root exit'); await delay(20); return { data: { bound: true, task_run_id: a.p_run_id, session_id: a.p_session_id } } } } })
    const { result, r } = await go(w)
    unknown(w, result); assert.equal(w.backend.get(r.session_id), null)
  })

  await test('a lost bind reply is unknown; Stop signals the exact owned child', async () => {
    const w = world({ db: { bind_task_run: async () => { throw Error('private bind') } } })
    const { result } = await go(w)
    unknown(w, result)
    const t = childOf(); await until(() => t.exited, 'Stop reached the owned child')
  })

  await test('malformed per-launch arguments refuse before any reservation', async () => {
    const w = world() // the adapter carries the arguments to the registry unchanged
    const launch = createManagedLaunch({ db: { rpc: async (n, a) => n === 'fail_task_launch' ? (w.calls.failed.push(a.p_process_started), { data: { compensated: true } }) : n === 'begin_task_run_launch' ? { data: { granted: true, task_run_id: a.p_run_id, session_id: a.p_session_id } } : { data: { valid: true, task_run_id: a.p_run_id, session_id: a.p_session_id } } },
      estateId: estate, actor: { kind: 'person', id: person }, authority: () => w.state.authority, admit: async () => { throw Error('given') },
      prepare: async receipt => w.backend.open(receipt, { argv: ['ok', 'bad\u0000'] }), track() {}, untrack() {}, get: sid => w.backend.get(sid), stop: async () => { w.calls.stop++ }, dispatch: async () => ({ state: 'delivering', says: '' }) })
    const r = receipt(), result = await launch({ taskId: r.task_id, trigger: 'chain', admission: { receipt: r, sessionId: r.session_id } })
    notStarted(w, result); assert.equal(w.calls.spawn, 0); assert.equal(w.markers(), 0, 'no marker was reserved')
  })

  await test('capacity and a retired owner refuse before spawn', async () => {
    const w = world(); w.registry.retire()
    const { result } = await go(w)
    notStarted(w, result); assert.equal(w.calls.spawn, 0)
  })

  await test('a filesystem fault writing the marker refuses before spawn', async () => {
    const w = world(), folder = path.join(w.root, 'backend-processes', estate)
    chmodSync(folder, 0o500)
    try { const { result } = await go(w); notStarted(w, result); assert.equal(w.calls.spawn, 0) } finally { chmodSync(folder, 0o700) }
  })

  await test('after a crash, a new registry on the same root reads the old Run as unknown and never respawns it', async () => {
    const w = world(), { result: first, r } = await go(w); assert.equal(first.started, true)
    const again = world({ root: w.root })
    const { result } = await go(again, r)
    unknown(again, result); assert.equal(again.calls.spawn, 0)
  })

  await test('a lost fail_task_launch reply never authorises a respawn of the same Run', async () => {
    const w = world({ native: { boundary: { ...boundary, capture: async () => { throw Error('private ps') } } }, db: { fail_task_launch: async a => { w.calls.failed.push(a.p_process_started); throw Error('private fail') } } })
    const { result, r } = await go(w)
    assert.equal(result.reasonCode, 'launch_outcome_unknown'); assert.equal(w.calls.spawn, 1)
    const { result: second } = await go(w, r)
    assert.equal(second.reasonCode, 'launch_outcome_unknown', 'a consumed Run is unknown, never "not started"')
    assert.equal(w.calls.spawn, 1, 'no second child')
  })
  console.log(`PASS ${count} launch receipt seam groups over the actual owned backend; ${runtimeTuple().runtime} Node ${process.versions.node}`)
} finally {
  for (const registry of registries) registry.retire()
  let clean = true
  for (const t of tracked) {
    try {
      if (!t.exited) process.kill(t.child.pid, 'SIGKILL')
      await until(() => t.exited, 'fixture child exit')
      t.child.stdout.destroy(); t.child.stdin.destroy(); t.child.stderr.destroy()
    } catch { clean = false }
  }
  if (clean) rmSync(dir, { recursive: true, force: true }); else { console.error('FAIL cleanup uncertain; fixture retained'); process.exitCode = 1 }
}
