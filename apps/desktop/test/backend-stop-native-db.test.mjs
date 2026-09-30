// First-slice plan B3-2: the native Stop runtime over the owned backend port, end to end — the
// actual registry owning a disposable Node backend, the port writing backend.opened@1 and
// backend.exited@1 into the journal, and managed Stop settling in SQL on the owned cluster that
// run-managed-stop-db.mjs starts. No provider, no model; the provider and transcript ports are fixed.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createOwnedBackendProcessRegistry } from '../src/main/ownedBackendProcessRegistry.ts'
import { createProcessBoundary } from '../src/main/processBoundary.ts'
import { createBackendStopPort } from '../src/main/backendStopPort.ts'
import { createNativeStopRuntime } from '../src/main/nativeStopRuntime.ts'
import { isMeasuredRuntime, runtimeTuple } from '../src/main/runtimeAdmission.ts'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-managed-stop-db.mjs'); process.exit(2) }
if (!isMeasuredRuntime()) { console.error('NOT_RUN: unmeasured runtime for the owned backend: ' + JSON.stringify(runtimeTuple())); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql = input => execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8' }).trim()
const q = v => `'${String(v).replaceAll("'", "''")}'`
const arg = v => v === null || v === undefined ? 'null' : typeof v === 'object' ? q(JSON.stringify(v)) : q(v)
const db = { rpc: async (name, args) => {
  try { return { data: JSON.parse(sql(`select ${name}(${Object.entries(args).map(([k, v]) => `${k} => ${arg(v)}`).join(',')})`)), error: null } }
  catch { /* A failed call is a lost reply to the caller, as PostgREST would report it. */ return { data: null, error: { message: 'rpc failed' } } }
} }
const uuid = n => `40000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = uuid(1), P = uuid(2), system = { kind: 'system', id: 'owned-host-fixture' }; let n = 10
const faults = { exited: 0 }
const journal = { async append(e) {
  if (e.type === 'backend.exited@1' && faults.exited > 0) { faults.exited--; throw Error('private journal failure') }
  return JSON.parse(sql(`select row_to_json(j) from append_event(${q(e.estateId)},${q(e.type)},${arg(e.actor)},${arg(e.payload ?? {})},'1',${e.projectId ? q(e.projectId) : 'null'}) j`))
} }
sql(`select append_event('${E}','project.created@1','{"kind":"system","id":"fixture"}','{"id":"${P}","name":"Backend stop fixture"}','1','${P}')`)
const call = s => JSON.parse(sql(s))

const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-backend-stop-')))
const executable = realpathSync(process.env.FABRIC_BACKEND_NODE ?? process.execPath), hash = createHash('sha256').update(readFileSync(executable)).digest('hex')
const backend = path.join(dir, 'backend.mjs')
writeFileSync(backend, `import {spawn} from 'node:child_process';const mode=process.argv[2]
if(mode==='stubborn')process.on('SIGTERM',()=>{});else process.on('SIGTERM',()=>process.exit(0))
if(mode==='finishes')setTimeout(()=>process.exit(0),400)
if(mode==='escape')spawn(process.execPath,['-e','setTimeout(()=>{},1500)'],{detached:true,stdio:'ignore'}).unref()
setInterval(()=>{},1000)\n`, { mode: 0o600 })
const host = { hostInstanceId: randomUUID(), bootId: randomUUID() }
const boundary = createProcessBoundary(), tracked = [], registries = []
const delay = ms => new Promise(r => setTimeout(r, ms))
function world(mode, { registryHost = host } = {}) {
  const root = path.join(dir, 'root-' + n++), hooks = {}; mkdirSync(root, { recursive: true, mode: 0o700 })
  const registry = createOwnedBackendProcessRegistry({ rootDir: root, estateId: E, recipe: { executable, executableSha256: hash, argv: [backend, mode], cwd: dir, env: { HOME: dir } },
    timeoutMs: 3000, host: registryHost, authority: () => ({ personId: uuid(3), revision: 1 }), onExit: h => { const s = hooks.port?.sessionOf(h); if (s) hooks.runtime?.onExit(s) } },
    { spawn: (...a) => { const c = spawn(...a), t = { child: c, exited: false }; tracked.push(t); c.once('exit', () => t.exited = true); c.on('error', () => {}); return c }, boundary, fdIdentity: () => 'fd', write: () => 0 })
  registries.push(registry)
  const port = createBackendStopPort({ registry, journal, estateId: E, actor: () => system, host })
  const targets = new Map()
  const runtime = createNativeStopRuntime({ db, estateId: E, actor: system, guard: async () => true, authority: () => null,
    lookup: async s => targets.get(s) ?? null, localTask: s => targets.get(s)?.taskId ?? null, ptys: port.ptys,
    revoke: async s => ({ revoked: true, evidenceRef: `surface-revoked:${host.bootId}:${s}` }),
    finalizeTranscript: async () => ({ committed: true, evidenceRef: 'sha256:' + 'e'.repeat(64) }),
    provider: { observe: async () => ({ quiescent: true, evidenceRef: 'provider:fixture' }) },
    hostInstanceId: host.hostInstanceId, bootId: host.bootId, timeoutMs: 8000, samples: 30, sampleIntervalMs: 50, escalateAfterSample: 5 })
  hooks.port = port; hooks.runtime = runtime
  return { registry, port, runtime, targets }
}
async function launched(w, mode) {
  const task = uuid(n++), session = uuid(n++)
  sql(`select append_event('${E}','task.created@1','{"kind":"system","id":"fixture"}','{"id":"${task}","title":"Work"}','1','${P}')`)
  const { task_run_id: run } = call(`select admit_task_launch('${E}','${task}','{"kind":"system","id":"fixture"}','${session}')`)
  assert.equal(call(`select begin_task_run_launch('${E}','${run}','${session}','{"kind":"system","id":"fixture"}')`).granted, true)
  const receipt = { admitted: true, project_id: P, task_id: task, task_run_id: run, session_id: session, run_ordinal: 1 }
  const s = await w.registry.start(receipt, session, async () => true); assert.equal(s.state, 'owned', JSON.stringify(s) + mode)
  w.port.register({ sessionId: session, optionId: 'codex-cli', startedAt: new Date().toISOString(), projectId: P, handle: s.handle })
  assert.equal(await w.port.recordOpened(session), true)
  assert.equal(call(`select bind_task_run('${E}','${run}','${session}','{"kind":"system","id":"fixture"}')`).bound, true)
  w.targets.set(session, { taskId: task, runId: run, sessionId: session })
  return { task, run, session, handle: s.handle }
}
const receipts = r => JSON.parse(sql(`select coalesce(jsonb_agg(jsonb_build_object('type',type,'group',payload->>'process_group','signal',payload->'exit_signal','code',payload->'exit_code') order by seq),'[]') from journal where type like 'backend.%' and payload->>'session_id'='${r.session}'`))
const runState = r => sql(`select state from task_runs where task_run_id='${r.run}'`)
let count = 0; const test = async (name, fn) => { await fn(); console.log('PASS ' + name); count++ }
try {
  await test('an operator Stop of an owned backend settles as stopped on its own exit receipt', async () => {
    const w = world('clean'), r = await launched(w, 'clean')
    assert.equal(w.port.inputAllowed(r.session), true)
    const pending = w.runtime.stop(r.session, 'operator_stop'); await delay(0)
    const result = await pending
    assert.equal(result.state, 'stopped', JSON.stringify(result)); assert.equal(result.managed, true)
    assert.equal(w.port.inputAllowed(r.session), false, 'input closed by the first fence level')
    assert.deepEqual(receipts(r).map(x => [x.type, x.group]), [['backend.opened@1', null], ['backend.exited@1', 'quiescent']])
    assert.deepEqual([receipts(r)[1].code, receipts(r)[1].signal], [0, null], 'the backend handled SIGTERM and exited 0')
    assert.equal(runState(r), 'ended')
    const ev = JSON.parse(sql(`select observation from run_stop_commands where task_run_id='${r.run}'`))
    assert.ok(ev.backendExitedSeq && ev.backendOpenedSeq && ev.processIdentityRef === w.registry.snapshot(r.handle).processIdentityRef, 'SQL checked the registry\'s own process reference')
  })

  await test('a descendant that left the backend\'s group keeps the Stop unknown', async () => {
    const w = world('escape'), r = await launched(w, 'escape')
    const result = await w.runtime.stop(r.session, 'operator_stop')
    assert.equal(result.state, 'outcome_unknown', JSON.stringify(result))
    assert.deepEqual(receipts(r).map(x => x.group).filter(Boolean), ['unknown'])
    assert.notEqual(runState(r), 'ended')
  })

  await test('a backend that ignores SIGTERM stays unknown without Force and is stopped with it', async () => {
    const w = world('stubborn'), r = await launched(w, 'stubborn')
    const soft = await w.runtime.stop(r.session, 'operator_stop')
    assert.equal(soft.state, 'outcome_unknown', JSON.stringify(soft)); assert.equal(receipts(r).length, 1, 'no exit receipt without an exit')
    const forced = await w.runtime.stop(r.session, 'operator_stop', { force: true })
    assert.equal(forced.state, 'stopped', JSON.stringify(forced)); assert.deepEqual([receipts(r)[1].code, receipts(r)[1].signal], [null, 9], 'a SIGKILL exit carries the numeric signal')
  })

  await test('a lost exit receipt is retried within the Stop; one still unavailable leaves it unknown until a later Stop', async () => {
    const w = world('clean'), r = await launched(w, 'clean'); faults.exited = 1
    const retried = await w.runtime.stop(r.session, 'operator_stop')
    assert.equal(retried.state, 'stopped', JSON.stringify(retried)); assert.equal(receipts(r).filter(x => x.type === 'backend.exited@1').length, 1, 'written once, after the lost attempt')
    const v = world('clean'), s2 = await launched(v, 'clean'); faults.exited = 1_000_000
    const first = await v.runtime.stop(s2.session, 'operator_stop')
    assert.equal(first.state, 'outcome_unknown', JSON.stringify(first)); assert.equal(receipts(s2).length, 1)
    faults.exited = 0
    const second = await v.runtime.stop(s2.session, 'operator_stop')
    assert.equal(second.state, 'stopped', JSON.stringify(second)); assert.equal(receipts(s2).filter(x => x.type === 'backend.exited@1').length, 1)
  })

  await test('a backend that finishes on its own is settled by the natural-exit hook as completed', async () => {
    const w = world('finishes'), r = await launched(w, 'finishes')
    for (let i = 0; i < 200 && runState(r) !== 'ended'; i++) await delay(25)
    assert.equal(runState(r), 'ended', 'the registry\'s exit hook drove the Stop runtime')
    assert.equal(sql(`select reason||'/'||outcome from run_stop_commands where task_run_id='${r.run}'`), 'natural_exit/completed')
    assert.deepEqual(receipts(r).map(x => x.group).filter(Boolean), ['quiescent'])
  })

  await test('a registry with another host identity cannot be registered with the port', async () => {
    const w = world('clean', { registryHost: { hostInstanceId: randomUUID(), bootId: randomUUID() } })
    const task = uuid(n++), session = uuid(n++)
    sql(`select append_event('${E}','task.created@1','{"kind":"system","id":"fixture"}','{"id":"${task}","title":"Work"}','1','${P}')`)
    const { task_run_id: run } = call(`select admit_task_launch('${E}','${task}','{"kind":"system","id":"fixture"}','${session}')`)
    call(`select begin_task_run_launch('${E}','${run}','${session}','{"kind":"system","id":"fixture"}')`)
    const s = await w.registry.start({ admitted: true, project_id: P, task_id: task, task_run_id: run, session_id: session, run_ordinal: 1 }, session, async () => true)
    assert.throws(() => w.port.register({ sessionId: session, optionId: 'codex-cli', startedAt: 'x', projectId: P, handle: s.handle }), /backend_host_identity_mismatch/)
    for (const registryHost of [{ hostInstanceId: 'x', bootId: randomUUID() }, { hostInstanceId: randomUUID() }, { ...host, extra: 1 }])
      assert.throws(() => world('clean', { registryHost }), /backend_ownership/, 'a malformed host identity is refused')
  })

  await test('Stop commands still pass after input halts, until the owner is gone', async () => {
    const w = world('stubborn'), r = await launched(w, 'stubborn')
    w.port.ptys.haltInput(r.session)
    assert.deepEqual([w.port.inputAllowed(r.session), w.port.commandAllowed(r.session)], [false, true])
    await w.runtime.stop(r.session, 'operator_stop', { force: true })
    assert.equal(w.port.commandAllowed(r.session), false)
  })
  console.log(`PASS ${count} native Stop over the owned backend groups, end to end on the full migration chain`)
} finally {
  for (const r of registries) r.retire()
  let clean = true
  for (const t of tracked) { try { if (!t.exited) process.kill(t.child.pid, 'SIGKILL'); for (let i = 0; i < 100 && !t.exited; i++) await delay(20); if (!t.exited) clean = false; t.child.stdout.destroy(); t.child.stdin.destroy(); t.child.stderr.destroy() } catch { clean = false } }
  await delay(1600) // the escaped fixture child ends on its own timer
  if (clean) rmSync(dir, { recursive: true, force: true }); else { console.error('FAIL cleanup uncertain; fixture retained'); process.exitCode = 1 }
}
