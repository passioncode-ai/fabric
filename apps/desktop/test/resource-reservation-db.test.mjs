// #region resource-reservation-db — docs: docs/execution/harness-waves/resource-reservation.md#verification
// Drives real PostgreSQL functions, including simultaneous connections and role denials.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { runPsqlAsync } from './bounded-psql.mjs'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-resource-reservation-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql = input => execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const call = input => JSON.parse(sql(input))
const quote = value => `'${String(value).replaceAll("'", "''")}'`
const json = value => quote(JSON.stringify(value)) + '::jsonb'
const uuid = n => `71000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = uuid(1), E2 = uuid(2), P = uuid(3), P2 = uuid(4)
const actor = '{"kind":"system","id":"resource-fixture"}'
let cursor = 20
const v = (slots = 1, memory = 10, disk = 10, cpu = 10) => ({ workerSlots: slots, memoryBytes: memory, diskBytes: disk, cpuMilliCores: cpu })
const zero = v(0, 0, 0, 0)
for (const [e, p] of [[E, P], [E2, P2]]) sql(`select append_event('${e}','project.created@1','${actor}','{"id":"${p}","name":"Resource fixture"}','1','${p}')`)
function task(estate = E) {
  const taskId = uuid(cursor++), session = uuid(cursor++)
  sql(`select append_event('${estate}','task.created@1','${actor}',${json({ id: taskId, title: 'Work', instruction: 'Instruction', option_id: 'claude-code', preset: 'guided', preset_edited: true, origin: { kind: 'operator', ref: 'fixture' } })},'1','${estate === E ? P : P2}')`)
  return { estate, taskId, session, binding: { reservationId: `reserve-${cursor}`, attemptId: `attempt-${cursor}`, fence: 1, ownerId: 'host-owned', role: 'builder', inputDigest: 'a'.repeat(64), scopeDigest: 'b'.repeat(64), localPolicyRevision: 'revision-1' } }
}
function configure(pool, capacity = v(2, 100, 100, 100)) {
  assert.equal(sql(`select configure_resource_pool('host-a',${quote(pool)},'revision-1',${json(capacity)},60000)`), 't')
  observe(pool)
}
function observe(pool, observed = zero, timestamp = 'clock_timestamp()') {
  assert.equal(sql(`select observe_resource_pool('host-a',${quote(pool)},'revision-1',${json(observed)},${timestamp})`), 't')
}
function statement(t, pool, demand = v(), own = demand, parent = null) {
  return `select admit_resource_task_launch('${t.estate}','${t.taskId}','${actor}','${t.session}','host-a',${quote(pool)},${json(t.binding)},${json(demand)},${json(own)},${parent ? quote(parent) : 'null'})`
}
const admit = (...args) => call(statement(...args))
const begin = (t, r) => call(`select begin_task_run_launch('${t.estate}','${r.task_run_id}','${t.session}','${actor}')`)
const release = (t, r, overrides = {}) => call(`select release_resource_reservation(${quote(overrides.estate ?? t.estate)},${quote(t.binding.reservationId)},${quote(overrides.run ?? r.task_run_id)},${overrides.nullSession ? 'null' : quote(t.session)},${quote(overrides.fence ?? String(t.binding.fence))})`)
const compensate = (t, r) => call(`select fail_task_launch('${t.estate}','${r.task_run_id}','${t.session}','${actor}',false)`)
const cancel = (t, r) => call(`select cancel_resource_admission('${t.estate}',${quote(t.binding.reservationId)},'${r.task_run_id}','${t.session}',${quote(String(t.binding.fence))})`)
const parallel = input => runPsqlAsync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], input).then(r => { if (r.code) throw Error(r.stderr); return JSON.parse(r.stdout) })

// Input/readings are never blanket-zero. No configured pool means no task admission.
const missing = task()
assert.equal(admit(missing, 'missing').reason_code, 'resource_pool_unknown')
assert.equal(sql(`select count(*) from task_runs where task_id='${missing.taskId}'`), '0')
assert.equal(sql(`select configure_resource_pool('host-a','unread','revision-1',${json(v(2))},60000)`), 't')
assert.equal(admit(missing, 'unread').reason_code, 'resource_reading_unknown')
configure('stale')
// Stale observation is accepted as data, never as fresh evidence.
sql("update resource_pools set observed_at=clock_timestamp()-interval '2 minutes' where pool_id='stale'")
assert.equal(admit(missing, 'stale').reason_code, 'resource_reading_unknown')
assert.equal(sql(`select observe_resource_pool('host-a','stale','revision-1',${json(zero)},clock_timestamp()+interval '1 day')`), 'f')
// Configuration acknowledgement is not a new reading. Same-policy retries
// preserve the original (even stale) row; omitted expected revision cannot rewind it.
const policyCapacity = v(2, 100, 100, 100)
const poolRow = pool => call(`set role service_role; select to_jsonb(p) from resource_pools p where host_id='host-a' and pool_id=${quote(pool)}`)
const staleBeforeRetry = poolRow('stale')
assert.equal(sql(`set role service_role; select configure_resource_pool('host-a','stale','revision-1',${json(policyCapacity)},60000)`), 't')
assert.deepEqual(poolRow('stale'), staleBeforeRetry)
assert.equal(admit(missing, 'stale').reason_code, 'resource_reading_unknown')
// This assertion fails on the original five-argument production function: it
// accepts the stale writer and silently replaces revision-1 with revision-old.
assert.equal(sql(`select configure_resource_pool('host-a','stale','revision-old',${json(policyCapacity)},60000)`), 'f')
assert.deepEqual(poolRow('stale'), staleBeforeRetry)
assert.equal(sql("select to_regprocedure('configure_resource_pool(text,text,text,jsonb,bigint)') is null"), 't', 'no legacy unconditional overload remains callable')
assert.equal(sql(`select configure_resource_pool('host-a','cas-absent','revision-2',${json(policyCapacity)},60000,'revision-1',1)`), 'f')
assert.equal(sql("select count(*) from resource_pools where pool_id='cas-absent'"), '0')
assert.equal(sql(`select configure_resource_pool('host-a','stale','revision-2',${json(policyCapacity)},60000,'',1)`), 'f')
assert.equal(sql(`select configure_resource_pool('host-a','stale','revision-1',${json(v(3, 100, 100, 100))},60000,'revision-1',1)`), 'f')

// Two creators cannot replace each other's revision; the same expectation cannot
// authorize two successive updates even when both calls use distinct connections.
const configRace = (pool, revision, expected) => `select to_jsonb(configure_resource_pool('host-a',${quote(pool)},${quote(revision)},${json(policyCapacity)},60000,${expected === null ? 'null' : quote(expected)},${expected === null ? 'null' : '1'}))`
const creationResults = await Promise.all(['create-a', 'create-b'].map(revision => parallel(configRace('cas-create', revision, null))))
assert.equal(creationResults.filter(Boolean).length, 1)
assert.equal(poolRow('cas-create').configuration_generation, 1)
const createdRevision = poolRow('cas-create').policy_revision
assert.equal(createdRevision, creationResults[0] ? 'create-a' : 'create-b')
const updateResults = await Promise.all(['update-a', 'update-b'].map(revision => parallel(configRace('cas-create', revision, createdRevision))))
assert.equal(updateResults.filter(Boolean).length, 1)
const updatedRevision = updateResults[0] ? 'update-a' : 'update-b', updated = poolRow('cas-create')
assert.equal(updated.policy_revision, updatedRevision); assert.equal(updated.configuration_generation, 2)
assert.equal(updated.observed, null); assert.equal(updated.observed_at, null)
assert.equal(sql(`select observe_resource_pool('host-a','cas-create',${quote(updatedRevision)},${json(zero)},clock_timestamp(),2)`), 't')
const observedUpdated = poolRow('cas-create')
assert.equal(sql(`select configure_resource_pool('host-a','cas-create',${quote(updatedRevision)},${json(policyCapacity)},60000,${quote(createdRevision)},1)`), 't', 'lost successful CAS reply retries the same policy without changing its reading')
assert.deepEqual(poolRow('cas-create'), observedUpdated)
assert.equal(sql(`select configure_resource_pool('host-a','cas-create',${quote(createdRevision)},${json(policyCapacity)},60000)`), 'f', 'delayed creator cannot roll back the winning update')
assert.equal(sql(`select configure_resource_pool('host-a','cas-create','late-update',${json(policyCapacity)},60000,${quote(createdRevision)},1)`), 'f', 'stale expected revision cannot overwrite a newer policy')
assert.equal(sql(`select observe_resource_pool('host-a','cas-create',${quote(createdRevision)},${json(zero)},clock_timestamp())`), 'f')
assert.deepEqual(poolRow('cas-create'), observedUpdated)

// Revision text may repeat, but its generation cannot. An A1 sampler/writer
// cannot act after A1 -> B2 -> A3, even when all policy bytes match the first A.
assert.equal(sql(`select configure_resource_pool('host-a','cas-aba','A',${json(policyCapacity)},60000)`), 't')
assert.equal(sql(`select configure_resource_pool('host-a','cas-aba','B',${json(policyCapacity)},60000,'A',1)`), 't')
assert.equal(sql(`set role service_role; select configure_resource_pool('host-a','cas-aba','A',${json(policyCapacity)},60000,'B',2)`), 't')
assert.equal(poolRow('cas-aba').configuration_generation, 3)
assert.equal(sql(`select configure_resource_pool('host-a','cas-aba','C',${json(policyCapacity)},60000,'A',1)`), 'f')
assert.equal(sql(`select configure_resource_pool('host-a','cas-aba','C',${json(policyCapacity)},60000,'A')`), 'f', 'revision-only expectation cannot update')
assert.equal(sql(`select observe_resource_pool('host-a','cas-aba','A',${json(zero)},clock_timestamp())`), 'f', 'legacy sampler remains bound to generation 1')
assert.equal(sql(`select observe_resource_pool('host-a','cas-aba','A',${json(zero)},clock_timestamp(),1)`), 'f')
assert.equal(sql(`select observe_resource_pool('host-a','cas-aba','A',${json(zero)},clock_timestamp(),null)`), 'f')
assert.equal(sql(`set role service_role; select observe_resource_pool('host-a','cas-aba','A',${json(zero)},clock_timestamp(),3)`), 't')
const abaObserved = poolRow('cas-aba')
assert.equal(sql(`select configure_resource_pool('host-a','cas-aba','A',${json(policyCapacity)},60000,'B',2)`), 't')
assert.deepEqual(poolRow('cas-aba'), abaObserved, 'exact policy replay neither increments generation nor refreshes observedAt')
assert.equal(sql(`select observe_resource_pool('host-a','cas-aba','A',${json(zero)},${quote(abaObserved.observed_at)},3)`), 't')
assert.deepEqual(poolRow('cas-aba'), abaObserved, 'exact observation replay never refreshes time')
assert.equal(sql(`select configure_resource_pool('host-a','cas-max','A',${json(policyCapacity)},60000)`), 't')
sql("update resource_pools set configuration_generation=9007199254740991 where host_id='host-a' and pool_id='cas-max'")
assert.equal(sql(`select configure_resource_pool('host-a','cas-max','B',${json(policyCapacity)},60000,'A',9007199254740991)`), 'f')
assert.equal(poolRow('cas-max').configuration_generation, 9007199254740991)

for (const bad of [{ ...v(), workerSlots: null }, { ...v(), memoryBytes: -1 }, { ...v(), diskBytes: 1.5 }, { ...v(), cpuMilliCores: 9007199254740992 }, { ...v(), surprise: 0 }]) {
  assert.equal(sql(`select configure_resource_pool('host-a','bad','revision-1',${json(bad)},60000)`), 'f')
  assert.equal(admit(missing, 'stale', bad).reason_code, 'resource_input_invalid')
}
configure('disk', v(10, 100, 9, 100))
assert.equal(admit(missing, 'disk').reason_code, 'resource_capacity')
configure('observed', v(1, 100, 100, 100)); observe('observed', v(1, 0, 0, 0))
assert.equal(admit(missing, 'observed').reason_code, 'resource_capacity')

// Cross-estate concurrency shares one configured host pool; only one slot exists.
configure('race', v(1, 100, 100, 100))
const racers = [task(), task(E2)]
const race = await Promise.all(racers.map(t => parallel(statement(t, 'race'))))
assert.equal(race.filter(r => r.admitted).length, 1)
assert.equal(race.find(r => !r.admitted).reason_code, 'resource_capacity')
const winner = racers[race.findIndex(r => r.admitted)], won = race.find(r => r.admitted)
assert.equal(sql("select count(*) from resource_reservations where pool_id='race'"), '1')
assert.equal(admit(winner, 'race').task_run_id, won.task_run_id, 'lost response recovers original attempt')
assert.equal(admit(winner, 'race').repeated, true)
assert.equal(admit({ ...winner, binding: { ...winner.binding, inputDigest: 'c'.repeat(64) } }, 'race').reason_code, 'resource_identity_conflict')
assert.equal(admit(winner, 'race', v(1, 11)).reason_code, 'resource_identity_conflict')
assert.equal(sql(`select configure_resource_pool('host-a','race','revision-2',${json(v(9))},60000)`), 'f')
const heldPool = poolRow('race')
assert.equal(sql(`select configure_resource_pool('host-a','race','revision-2',${json(v(9))},60000,'revision-1',1)`), 'f', 'valid CAS cannot change a policy beneath held work')
assert.equal(sql(`select configure_resource_pool('host-a','race','revision-1',${json(v(1, 100, 100, 100))},60000,'revision-1',1)`), 't')
assert.deepEqual(poolRow('race'), heldPool)
assert.equal(release(winner, won).reason_code, 'resource_execution_unresolved')
assert.equal(release(winner, won, { estate: winner.estate === E ? E2 : E }).released, false)
assert.equal(begin(winner, won).granted, true)
assert.equal(cancel(winner, won).reason_code, 'resource_execution_unresolved', 'consumed spawn permission cannot use never-begun cancellation')
assert.equal(compensate(winner, won).compensated, true)
assert.equal(release(winner, won, { nullSession: true }).released, false)
assert.equal(release(winner, won, { fence: '2' }).released, false)
assert.equal(release(winner, won).released, true)
assert.equal(release(winner, won).repeated, true)
assert.equal(admit(winner, 'race').resource_reservation.state, 'released', 'retry cannot recreate released capacity')

// JSON numeric scale is not identity: 1.0/1.00/1e0 all name fence 1.
// Keep raw numeric spelling here; JSON.stringify(1.0) would erase the regression.
configure('fence-scale', v(2, 100, 100, 100))
const scaledStatement = (t, spelling) => statement(t, 'fence-scale').replace(json(t.binding),
  quote(JSON.stringify(t.binding).replace('\"fence\":1,', `\"fence\":${spelling},`)) + '::jsonb')
for (const path of ['cancel', 'compensated-release']) {
  const scaled = task(), sr = call(scaledStatement(scaled, '1.0'))
  assert.equal(sr.admitted, true)
  assert.equal(sql(`select binding->>'fence' from resource_reservations where reservation_id=${quote(scaled.binding.reservationId)}`), '1')
  for (const spelling of ['1', '1.00', '1e0']) {
    const repeated = call(scaledStatement(scaled, spelling))
    assert.equal(repeated.repeated, true); assert.equal(repeated.task_run_id, sr.task_run_id)
  }
  if (path === 'cancel') assert.equal(cancel(scaled, sr).released, true)
  else {
    assert.equal(begin(scaled, sr).granted, true)
    assert.equal(compensate(scaled, sr).compensated, true)
    assert.equal(release(scaled, sr).released, true)
  }
  assert.equal(release(scaled, sr).repeated, true)
  for (const malformed of ['null', '\"1\"', '0', '-1', '1.5', '9007199254740992'])
    assert.equal(call(scaledStatement(scaled, malformed)).reason_code, 'resource_input_invalid')
}

// Parent envelope includes its own worker. Two child contenders cannot spend one remainder twice.
configure('children', v(2, 100, 100, 100))
const parent = task(), pr = admit(parent, 'children', v(2, 50, 50, 50), v())
assert.equal(pr.admitted, true)
const children = [task(), task()]
const cr = await Promise.all(children.map(t => parallel(statement(t, 'children', v(), v(), parent.binding.reservationId))))
assert.equal(cr.filter(r => r.admitted).length, 1)
assert.equal(cr.find(r => !r.admitted).reason_code, 'resource_parent_capacity')
const child = children[cr.findIndex(r => r.admitted)], childReceipt = cr.find(r => r.admitted)
assert.equal(admit(task(E2), 'children', v(), v(), parent.binding.reservationId).reason_code, 'resource_parent_invalid')
assert.equal(admit(task(), 'children', v(), v(), child.binding.reservationId).reason_code, 'resource_parent_capacity', 'no unmetered grandchild')
assert.equal(begin(parent, pr).granted, true); assert.equal(compensate(parent, pr).compensated, true)
assert.equal(release(parent, pr).reason_code, 'resource_children_held')
assert.equal(begin(child, childReceipt).granted, true); assert.equal(compensate(child, childReceipt).compensated, true)
assert.equal(release(child, childReceipt).released, true)
assert.equal(release(parent, pr).released, true)

// Resource gates refuse changed/future/stale readings even after admission, before spawning.
configure('launch')
const launch = task(), lr = admit(launch, 'launch')
sql("update resource_pools set observed_at=clock_timestamp()-interval '2 minutes' where pool_id='launch'")
assert.equal(begin(launch, lr).reason_code, 'resource_reading_unknown')
observe('launch'); assert.equal(begin(launch, lr).granted, true)
observe('launch', v(2, 0, 0, 0))
assert.equal(call(`select validate_task_run_launch('${E}','${lr.task_run_id}','${launch.session}','${actor}')`).reason_code, 'resource_capacity')
assert.equal(compensate(launch, lr).compensated, true)
assert.equal(release(launch, lr).released, true)
const unbegun = task(), ur = admit(unbegun, 'race')
assert.equal(ur.admitted, true)
assert.equal(cancel(unbegun, ur).released, true, 'an explicit locked never-begun proof avoids stranding capacity')
assert.equal(cancel(unbegun, ur).repeated, true)

// Raw journal claims grant no release; expiration is not proof of death.
configure('forged')
const forged = task(), fr = admit(forged, 'forged'); assert.equal(begin(forged, fr).granted, true)
sql(`update leases set expires_at=clock_timestamp()-interval '1 day' where work_id='${forged.taskId}'; select append_event('${E}','run.ended@1','${actor}',${json({ task_run_id: fr.task_run_id, task_id: forged.taskId, outcome: 'failed_known', launch_failure: true })},'1','${P}','${fr.task_run_id}')`)
assert.equal(release(forged, fr).reason_code, 'resource_execution_unresolved')
const snapshot = sql(`select row_to_json(r) from resource_reservations r where reservation_id=${quote(forged.binding.reservationId)}`)
sql(`select rebuild_estate_projections('${E}')`)
assert.equal(sql(`select row_to_json(r) from resource_reservations r where reservation_id=${quote(forged.binding.reservationId)}`), snapshot, 'replay preserves operational ledger')
assert.equal(release(forged, fr).released, false)

// A copied/restored marker without local operational authority refuses even a legacy launch.
const restored = task()
const rr = call(`select admit_task_launch('${E}','${restored.taskId}','${actor}','${restored.session}')`)
sql(`select append_event('${E}','resource.reserved@1','${actor}',${json({ task_run_id: rr.task_run_id, task_id: restored.taskId, reservation_id: 'restored-marker' })},'1','${P}','${rr.task_run_id}')`)
assert.equal(begin(restored, rr).reason_code, 'resource_reservation_unknown')

// Real restore projector on a synthetic archive with remapped fixture entity IDs, not
// a second live DB. No operational pool/reservation/stop rows are copied by journal restore.
const archive = JSON.parse(sql(`select jsonb_agg(to_jsonb(j) order by seq) from journal j where estate_id='${E}'`))
const ids = new Map()
const remapped = JSON.parse(JSON.stringify(archive).replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, id => {
  if (!ids.has(id)) ids.set(id, uuid(cursor++))
  return ids.get(id)
}))
const targetEstate = uuid(cursor++)
const restoreResult = call(`select restore_estate_events('${targetEstate}',${json(remapped)})`)
assert.equal(restoreResult.events, archive.length)
assert.equal(sql(`select count(*) from resource_reservations where estate_id='${targetEstate}'`), '0')
const restoredRun = ids.get(rr.task_run_id), restoredSession = ids.get(restored.session)
assert.equal(call(`select begin_task_run_launch('${targetEstate}','${restoredRun}','${restoredSession}','${actor}')`).reason_code, 'resource_reservation_unknown')
assert.equal(release(forged, fr, { estate: targetEstate }).released, false)

// Negative controls mutate actual DB functions, never a reimplementation; restore via transaction rollback.
const planted = task(); assert.equal(admit(planted, 'observed').reason_code, 'resource_capacity')
assert.equal(call(`begin; create or replace function resource_pool_problem(p_host text,p_pool text,p_revision text,p_extra jsonb) returns text language sql as 'select null::text'; ${statement(planted, 'observed')}; rollback;`).admitted, true)
// Explicit client-role attempts, not only catalog grant inspection.
for (const role of ['anon', 'authenticated']) {
  for (const command of ["select configure_resource_pool('x','x','x','{}',1)", "select configure_resource_pool('x','x','x','{}',1,'previous',1)", "select observe_resource_pool('x','x','x','{}',clock_timestamp(),1)", statement(task(), 'race'), `select release_resource_reservation('${E}','id','${rr.task_run_id}','${restored.session}','1')`, `select cancel_resource_admission('${E}','id','${rr.task_run_id}','${restored.session}','1')`, "update resource_reservations set state='released',released_seq=1"]) {
    assert.throws(() => sql(`set role ${role}; ${command}`), /permission denied/)
  }
}
assert.throws(() => sql(`set role service_role; update resource_reservations set state='released',released_seq=1`), /permission denied/)
assert.throws(() => sql(`set role service_role; select begin_task_run_launch_before_resources('${E}','${rr.task_run_id}','${restored.session}','${actor}')`), /permission denied/)
console.log('PASS R2 resource SQL: configured pool, safe integers, unknown readings, concurrent shared/child capacity, frozen retry, exact proof release, replay, marker restore refusal, client privileges')
// #endregion resource-reservation-db
