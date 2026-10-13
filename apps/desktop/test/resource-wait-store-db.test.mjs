// #region resource-wait-store-test — docs: docs/execution/harness-waves/resource-wait-store.md#verification
// Real PostgreSQL RPCs and the production client+kernel; no native process/provider.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { runPsqlAsync } from './bounded-psql.mjs'
import { createResourceWaitStore } from '../src/main/resourceWaitStore.ts'
import { createResourceWaitQueue } from '../src/main/resourceWaitQueue.ts'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: owned resource DB runner required'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
assert.ok(new URL(url).searchParams.get('host')?.startsWith('/'), 'Unix socket fixture only')
const sql = input => execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const call = input => JSON.parse(sql(input))
const q = value => `'${String(value).replaceAll("'", "''")}'`
const j = value => `${q(JSON.stringify(value))}::jsonb`
const uuid = n => `84000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = uuid(1), P = uuid(2), E2 = uuid(3), P2 = uuid(4), actor = { kind: 'system', id: 'wait-fixture' }
for (const [e, p] of [[E, P], [E2, P2]]) sql(`select append_event('${e}','project.created@1',${j(actor)},${j({ id: p, name: 'Wait fixture' })},'1','${p}')`)
let counter = 10
function make(scope, overrides = {}) {
  const taskId = uuid(counter++), sessionId = uuid(counter++)
  sql(`select append_event('${scope.estateId}','task.created@1',${j(actor)},${j({ id: taskId, title: 'Wait task', instruction: 'Instruction', option_id: 'claude-code', preset: 'guided', preset_edited: true, origin: { kind: 'operator', ref: 'wait-fixture' } })},'1','${scope.estateId === E ? P : P2}')`)
  return { scope, id: `wait-${counter}`, taskId, sessionId, attemptId: `wait-store-attempt-${counter}`, ownerId: 'host-owner', fence: 1,
    inputDigest: 'a'.repeat(64), scopeDigest: 'b'.repeat(64), conditionKey: 'resources', resumePoint: 'managed-admission', action: 'managed_task_launch',
    demand: { workerSlots: 1, memoryBytes: 1, diskBytes: 0, cpuMilliCores: 1 }, createdAt: Date.now() - 1000, deadlineAt: Date.now() + 300000, ...overrides }
}
function configure(pool, max = 20, estateId = E) {
  const scope = { estateId, hostId: 'wait-host', poolId: pool }
  assert.equal(sql(`select configure_resource_pool('wait-host',${q(pool)},'rev',${j({ workerSlots: 100, memoryBytes: 1000, diskBytes: 1000, cpuMilliCores: 1000 })},60000)`), 't')
  assert.equal(sql(`set role service_role; select configure_resource_wait_queue(${j(scope)},${max})`), 't')
  return scope
}
const insertStatement = i => `set role service_role; select resource_wait_insert(${j(i)})`
const insert = i => call(insertStatement(i))
const read = i => call(`set role service_role; select resource_wait_read(${j(i.scope)},${q(i.id)})`).record
const page = (scope, limit = 2) => call(`set role service_role; select resource_wait_page(${j(scope)},${limit})`)
const casStatement = (r, patch = {}) => `set role service_role; select resource_wait_cas(${j(r.input.scope)},${q(r.input.id)},${r.revision},${j({ ...r, ...patch, revision: r.revision + 1, updatedAt: Date.now() })})`
const cas = (r, patch = {}) => sql(casStatement(r, patch)) === 't'
const claimPatch = workerId => ({ state: 'claimed', claim: { workerId, until: Date.now() + 30000 } })
const claim = i => { const r = read(i); assert.equal(cas(r, claimPatch('worker')), true); return read(i) }
const begin = i => { const r = claim(i); assert.equal(cas(r, { state: 'dispatch_started' }), true); return read(i) }
const parallel = input => runPsqlAsync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], input).then(r => { assert.equal(r.code, 0, r.stderr); return r.stdout.trim() })
const legacyAdmit = i => call(`select admit_task_launch('${i.scope.estateId}','${i.taskId}',${j(actor)},'${i.sessionId}')`)

// Real configured capacity includes tombstones and atomic retries.
const limited = configure('limited', 1), a = make(limited), b = make(limited)
const races = await Promise.all([a, b].map(i => parallel(insertStatement(i)).then(JSON.parse)))
assert.equal(races.filter(r => r.ok).length, 1)
const winner = races[0].ok ? a : b, loser = races[0].ok ? b : a
const first = read(winner)
assert.deepEqual(insert(winner).record, first)
assert.equal(insert({ ...winner, fence: 2 }).ok, false)
assert.equal(cas(first, { state: 'cancelled', claim: null }), true)
assert.equal(insert(loser).ok, false, 'terminal tombstone still consumes configured bound')
assert.equal(insert(winner).record.state, 'cancelled')
assert.equal(cas(read(winner), { state: 'waiting' }), false, 'terminal cannot resurrect')

// Session and attempt conflicts across scopes cannot silently create new bindings.
const s = configure('identities'), s2 = configure('identities-other', 20, E2)
// The shared cluster deliberately contains earlier R2/R4 reservations. Their
// attempts must remain excluded; new fixture attempts have a distinct namespace.
const reservedAttempt = call("select to_json(binding->>'attemptId') from resource_reservations order by reservation_id limit 1")
assert.equal(typeof reservedAttempt, 'string')
assert.equal(insert(make(s, { attemptId: reservedAttempt })).ok, false, 'an existing resource-ledger attempt cannot queue')
const original = make(s); assert.equal(insert(original).ok, true)
for (const identity of [{ sessionId: original.sessionId }, { attemptId: original.attemptId }])
  assert.equal(insert(make(s2, identity)).ok, false)
const foreign = make(s2, { taskId: original.taskId }); assert.equal(insert(foreign).ok, false)
assert.equal(insert({ ...original, id: 'duplicate-active-task', sessionId: uuid(counter++), attemptId: `new-${counter}` }).ok, false)
for (const event of ['terminal.opened@1', 'terminal.closed@1', 'session.enrolled@1']) {
  const i = make(s)
  sql(`select append_event('${E}',${q(event)},${j(actor)},${j({ session_id: i.sessionId })},'1','${P}')`)
  assert.equal(insert(i).ok, false, `prior native identity: ${event}`)
}
const prior = make(s); assert.equal(legacyAdmit(prior).admitted, true)
assert.equal(insert({ ...prior, sessionId: uuid(counter++), attemptId: `changed-${counter}` }).ok, false, 'task history is not a new never-started task')

// Every mutable/immutable field is checked on the server, not just by the client.
const shapeScope = configure('shapes'), shaped = make(shapeScope), shapedRow = insert(shaped).record
for (const patch of [
  { ordinal: shapedRow.ordinal + 1 }, { input: { ...shaped, fence: 2 } }, { input: { ...shaped, inputDigest: 'c'.repeat(64) } },
  { state: 'dispatched' }, { state: 'expired' }, { state: 'dispatch_started' }, { state: 'waiting', extra: true },
  { state: 'claimed', claim: { workerId: 'worker', until: Date.now() + 600000 } },
  { state: 'claimed', claim: { workerId: 'worker', until: Date.now() - 1 } }
]) assert.equal(cas(shapedRow, patch), false)
for (const mutation of [i => ({ ...i, fence: 1.5 }), i => ({ ...i, fence: null }), i => ({ ...i, extra: 1 }),
  i => ({ ...i, createdAt: Date.now() + 99999 }), i => ({ ...i, deadlineAt: 0 }), i => ({ ...i, sessionId: 'invalid' }),
  i => ({ ...i, demand: { ...i.demand, diskBytes: -1 } })]) assert.equal(insert(mutation(make(shapeScope))).ok, false)

// FIFO is a server invariant: no younger CAS can skip a blocked/unknown head.
const fifo = configure('fifo'), old = make(fifo), young = make(fifo)
insert(old); insert(young)
assert.equal(cas(read(young), claimPatch('young')), false)
const head = read(old)
const winners = await Promise.all(['w1', 'w2'].map(w => parallel(casStatement(head, claimPatch(w)))))
assert.equal(winners.filter(v => v === 't').length, 1)
assert.equal(cas(read(old), claimPatch('takeover')), false, 'active claim cannot be stolen')
// Fixture changes operational expiry, then drives production reclaim; no real sleep.
sql(`update resource_wait_rows set claim=jsonb_set(claim,'{until}',to_jsonb((extract(epoch from clock_timestamp())*1000)::bigint-1)) where id=${q(old.id)}`)
assert.equal(cas(read(old), claimPatch('recovered')), true)
assert.equal(cas(read(old), { state: 'dispatch_started' }), true)
assert.equal(cas(read(old), { state: 'dispatched' }), false, 'caller state is not dispatch evidence')
assert.equal(cas(read(old), { state: 'cancelled', claim: null }), false)
assert.equal(cas(read(old), { state: 'outcome_unknown' }), true)
assert.equal(page(fifo, 1).rows[0].state, 'outcome_unknown'); assert.equal(page(fifo, 1).more, true)
assert.equal(cas(read(old), { state: 'waiting', claim: null }), false)
assert.equal(cas(read(young), claimPatch('young')), false)

// A competing admission after enqueue invalidates the never-started begin.
const competed = make(configure('competed')); insert(competed); claim(competed)
assert.equal(legacyAdmit(competed).admitted, true)
assert.equal(cas(read(competed), { state: 'dispatch_started' }), false)

// Forged journal compensation is not operational permission. Genuine compensation is.
for (const genuine of [false, true]) {
  const i = make(configure(genuine ? 'compensated' : 'forged')); insert(i); begin(i)
  const admitted = legacyAdmit(i); assert.equal(admitted.admitted, true)
  // Queue dispatch ownership is not managed launch permission. The actual
  // compensation command requires the exact run to have entered launching.
  const unbegun = call(`select fail_task_launch('${E}','${admitted.task_run_id}','${i.sessionId}',${j(actor)},false)`)
  assert.equal(unbegun.compensated, false); assert.equal(unbegun.reason_code, 'process_evidence')
  assert.equal(call(`select begin_task_run_launch('${E}','${admitted.task_run_id}','${i.sessionId}',${j(actor)})`).granted, true)
  if (genuine) assert.equal(call(`select fail_task_launch('${E}','${admitted.task_run_id}','${i.sessionId}',${j(actor)},false)`).compensated, true)
  else sql(`select append_event('${E}','run.ended@1',${j(actor)},${j({ task_run_id: admitted.task_run_id, task_id: i.taskId, outcome: 'failed_known', launch_failure: true })},'1','${P}','${admitted.task_run_id}')`)
  assert.equal(cas(read(i), { state: 'refused_before_start' }), genuine)
}

// Production client and kernel dispatch via actual managed commands, not a shadow rule.
const rpc = { async rpc(name, args) {
  const names = new Set(['resource_wait_insert','resource_wait_read','resource_wait_page','resource_wait_cas'])
  assert.ok(names.has(name))
  const values = Object.entries(args).map(([k,v]) => `${k}=>${typeof v === 'number' ? v : typeof v === 'string' ? q(v) : j(v)}`).join(',')
  return { data: call(`set role service_role; select to_json(${name}(${values}))`) }
} }
assert.deepEqual(await createResourceWaitStore(rpc, fifo).read(fifo, old.id), read(old), 'new client reconnects to durable unknown row')
const runScope = configure('client'), work = make(runScope), client = createResourceWaitStore(rpc, runScope)
let dispatches = 0
const deps = { store: client, now: () => Date.now(), workerId: 'kernel', pageSize: 1, claimMs: 30000, timeoutMs: 5000,
  neverStarted: async () => true, inspect: async () => ({ state: 'ready' }),
  dispatch: async (i, permit) => {
    if (!await permit()) return 'refused_before_start'
    dispatches++
    const admitted = legacyAdmit(i); assert.equal(admitted.admitted, true)
    assert.equal(call(`select begin_task_run_launch('${E}','${admitted.task_run_id}','${i.sessionId}',${j(actor)})`).granted, true)
    assert.equal(call(`select bind_task_run('${E}','${admitted.task_run_id}','${i.sessionId}',${j(actor)})`).bound, true)
    return 'started'
  } }
assert.equal((await createResourceWaitQueue(deps).enqueue(work)).state, 'waiting')
assert.equal((await createResourceWaitQueue(deps).pass(runScope)).state, 'dispatched')
assert.equal((await createResourceWaitQueue(deps).pass(runScope)).state, 'empty'); assert.equal(dispatches, 1)
await assert.rejects(client.read({ ...runScope, estateId: E2 }, work.id), /scope/)
await assert.rejects(createResourceWaitStore({ rpc: async () => ({ data: true, error: { secret: 'private' } }) }, runScope).read(runScope, work.id), /unavailable/)
await assert.rejects(createResourceWaitStore({ rpc: async () => ({ data: { ok: true } }) }, runScope).page(runScope, 1), /unavailable/)

// Commit begin in PostgreSQL, then lose its reply. A new client cannot replay it.
const lostScope = configure('lost-cas'), lostWork = make(lostScope)
let lostDispatches = 0
const lostRpc = { async rpc(name, args) {
  const response = await rpc.rpc(name, args)
  if (name === 'resource_wait_cas' && args.p_next.state === 'dispatch_started') throw Error('synthetic lost CAS reply')
  return response
} }
const lostDeps = { ...deps, store: createResourceWaitStore(lostRpc, lostScope),
  dispatch: async () => { lostDispatches++; return 'unknown' } }
assert.equal((await createResourceWaitQueue(lostDeps).enqueue(lostWork)).state, 'waiting')
assert.equal((await createResourceWaitQueue(lostDeps).pass(lostScope)).state, 'unknown')
assert.equal(read(lostWork).state, 'dispatch_started')
const restarted = createResourceWaitQueue({ ...lostDeps, store: createResourceWaitStore(rpc, lostScope) })
assert.equal((await restarted.pass(lostScope)).state, 'outcome_unknown'); assert.equal(lostDispatches, 0)

// Role denials are attempted, not inferred from source grants.
for (const role of ['anon','authenticated']) {
  for (const stmt of [
    'select * from resource_wait_rows', 'select * from resource_wait_scopes',
    `select configure_resource_wait_queue(${j(runScope)},1)`, `select resource_wait_insert(${j(work)})`,
    `select resource_wait_read(${j(runScope)},${q(work.id)})`, `select resource_wait_page(${j(runScope)},1)`,
    `select resource_wait_cas(${j(runScope)},${q(work.id)},1,${j(read(work))})`
  ]) assert.throws(() => sql(`set role ${role}; ${stmt}`), /permission denied/)
}
assert.throws(() => sql('set role service_role; delete from resource_wait_rows'), /permission denied/)
console.log('PASS pending108 real SQL: bounded FIFO/CAS, immutable identities, native-session exclusion, races, unknown fences, compensation proof, client+kernel restart, role denials')
// #endregion resource-wait-store-test
