// #region resource-reconciliation-db — docs: docs/execution/harness-waves/resource-reconciliation.md#focused-verification
// Runs only inside the existing owned pending-107 fixture. Production kernel,
// real service-role SQL/query projection; no PostgREST server or native process.
import assert from 'node:assert/strict'
import { createResourceReconciliation } from '../src/main/resourceReconciliation.ts'
import { runPsqlAsync } from './bounded-psql.mjs'

const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: owned pending107 runner must supply its fixture database'); process.exit(2) }
const parsed = new URL(url)
assert.match(parsed.pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
assert.ok(parsed.searchParams.get('host')?.startsWith('/'), 'fixture uses an owned Unix socket')
const quote = value => `'${String(value).replaceAll("'", "''")}'`
const json = value => `${quote(JSON.stringify(value))}::jsonb`
async function sql(statement, service = false) {
  const result = await runPsqlAsync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'],
    `${service ? 'set role service_role;' : ''}\n${statement}`, { label: 'resource recovery fixture', timeoutMs: 10000 })
  if (result.code !== 0) throw Error(`resource recovery SQL failed: ${result.stderr}`)
  return result.stdout.trim()
}
const call = async (statement, service = false) => JSON.parse(await sql(statement, service))
const uuid = n => `72000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const estateId = uuid(1), projectId = uuid(2), actor = { kind: 'system', id: 'resource-recovery-fixture' }
const scope = { estateId, hostId: 'recovery-fixture-host', poolId: 'recovery-fixture-pool' }
const vector = workerSlots => ({ workerSlots, memoryBytes: workerSlots * 10, diskBytes: workerSlots * 10, cpuMilliCores: workerSlots * 10 })
let sequence = 10
await sql(`select append_event('${estateId}','project.created@1',${json(actor)},${json({ id: projectId, name: 'Resource recovery fixture' })},'1','${projectId}')`)
assert.equal(await sql(`select configure_resource_pool(${quote(scope.hostId)},${quote(scope.poolId)},'r4-fixture',${json(vector(20))},600000)`), 't')
assert.equal(await sql(`select observe_resource_pool(${quote(scope.hostId)},${quote(scope.poolId)},'r4-fixture',${json(vector(0))},clock_timestamp())`), 't')
async function admit({ parent = null, slots = 1 } = {}) {
  const taskId = uuid(sequence++), sessionId = uuid(sequence++), reservationId = `recovery-${sequence}`
  const binding = { reservationId, attemptId: `attempt-${sequence}`, fence: 1, ownerId: 'recovery-owner', role: 'builder',
    inputDigest: 'a'.repeat(64), scopeDigest: 'b'.repeat(64), localPolicyRevision: 'r4-fixture' }
  await sql(`select append_event('${estateId}','task.created@1',${json(actor)},${json({ id: taskId, title: 'Recovery work', instruction: 'Fixture', option_id: 'claude-code', preset: 'guided', preset_edited: true, origin: { kind: 'operator', ref: 'fixture' } })},'1','${projectId}')`)
  const receipt = await call(`select admit_resource_task_launch('${estateId}','${taskId}',${json(actor)},'${sessionId}',${quote(scope.hostId)},${quote(scope.poolId)},${json(binding)},${json(vector(slots))},${json(vector(1))},${parent ? quote(parent.reservationId) : 'null'})`, true)
  assert.equal(receipt.admitted, true, JSON.stringify(receipt))
  return { taskId, sessionId, reservationId, runId: receipt.task_run_id }
}
async function compensate(target) {
  assert.equal((await call(`select begin_task_run_launch('${estateId}','${target.runId}','${target.sessionId}',${json(actor)})`, true)).granted, true)
  assert.equal((await call(`select fail_task_launch('${estateId}','${target.runId}','${target.sessionId}',${json(actor)},false)`, true)).compensated, true)
}
const state = target => call(`select to_jsonb(r) from resource_reservations r where reservation_id=${quote(target.reservationId)}`)
const rpcCalls = []
let beforeRelease
// A narrow translation of the actual fluent query to SQL. It returns database
// rows verbatim and executes the real RPC; it makes no release decision itself.
const allowedColumns = new Set('reservation_id,estate_id,host_id,pool_id,task_run_id,session_id,run_ordinal,admitted_seq,state,binding,released_seq'.split(','))
const db = {
  from(table) {
    assert.equal(table, 'resource_reservations')
    let columns, limit = null, single = false, ordered = false
    const predicates = []
    const query = {
      select(value) { assert.ok(value.split(',').every(c => allowedColumns.has(c))); columns = value; return query },
      eq(key, value) { assert.ok(['estate_id', 'host_id', 'pool_id', 'state', 'reservation_id'].includes(key)); predicates.push(`${key}=${quote(value)}`); return query },
      gt(key, value) { assert.equal(key, 'admitted_seq'); assert.ok(Number.isSafeInteger(value) && value > 0); predicates.push(`${key}>${value}`); return query },
      order(key, value) { assert.equal(key, 'admitted_seq'); assert.equal(value.ascending, true); ordered = true; return query },
      limit(value) { assert.ok(Number.isSafeInteger(value) && value > 0 && value <= 101); limit = value; return query },
      maybeSingle() { single = true; return query },
      then(resolve, reject) {
        const selection = `select ${columns} from resource_reservations where ${predicates.join(' and ')}${ordered ? ' order by admitted_seq' : ''}${limit ? ` limit ${limit}` : ''}`
        return call(`select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (${selection}) r`, true).then(rows => {
          if (single && rows.length > 1) throw Error('ambiguous readback')
          return { data: single ? rows[0] ?? null : rows, error: null }
        }).then(resolve, reject)
      }
    }
    return query
  },
  async rpc(name, args) {
    assert.equal(name, 'release_resource_reservation')
    rpcCalls.push(structuredClone(args))
    if (beforeRelease) await beforeRelease(args)
    return { data: await call(`select release_resource_reservation(${quote(args.p_estate)},${quote(args.p_reservation)},${quote(args.p_run)},${quote(args.p_session)},${quote(args.p_fence)})`, true), error: null }
  }
}
const make = overrides => createResourceReconciliation({ ...scope, db, pageSize: 2, maxPages: 10, timeoutMs: 30000, ...overrides })

const unresolved = await admit(), ended = await admit()
await compensate(ended)
// The fixture's service role deliberately lacks BYPASSRLS. GRANT SELECT alone
// must not silently turn held operational rows into an empty successful scan.
assert.equal(await sql("select rolbypassrls from pg_roles where rolname='service_role'"), 'f')
assert.equal(await sql(`select count(*) from resource_reservations where estate_id='${estateId}' and host_id=${quote(scope.hostId)} and pool_id=${quote(scope.poolId)} and state='held'`, true), '2',
  'service-role RLS read policy must expose both held rows before the scanner runs')
assert.equal(await sql(`select count(*) from resource_pools where host_id=${quote(scope.hostId)} and pool_id=${quote(scope.poolId)}`, true), '1')
for (const role of ['anon', 'authenticated']) {
  for (const table of ['resource_reservations', 'resource_pools']) {
    assert.equal(await sql(`select has_table_privilege('${role}','${table}','SELECT')`), 'f')
    const denied = await runPsqlAsync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'],
      `set role ${role}; select count(*) from ${table};`, { label: 'resource recovery role denial', timeoutMs: 10000 })
    assert.notEqual(denied.code, 0, `${role} cannot read ${table}`)
  }
}
for (const table of ['resource_reservations', 'resource_pools'])
  for (const privilege of ['INSERT', 'UPDATE', 'DELETE'])
    assert.equal(await sql(`select has_table_privilege('service_role','${table}','${privilege}')`), 'f', 'writes remain RPC-only')
const first = await make().sweep()
assert.equal(first.items.find(i => i.reservationId === unresolved.reservationId)?.state, 'retained')
assert.equal(first.items.find(i => i.reservationId === ended.reservationId)?.state, 'released')
const releasedOnce = await state(ended)
assert.equal(releasedOnce.state, 'released')
const repeated = await make().sweep() // new instance, no remembered admission receipt
assert.equal(repeated.items.some(i => i.reservationId === ended.reservationId), false)
assert.equal((await state(ended)).released_seq, releasedOnce.released_seq)
assert.equal((await state(unresolved)).state, 'held')

const parent = await admit({ slots: 3 }), child = await admit({ parent })
await compensate(parent); await compensate(child)
const nested = await make().sweep()
assert.equal(nested.items.find(i => i.reservationId === parent.reservationId)?.reason, 'resource_children_held')
assert.equal(nested.items.find(i => i.reservationId === child.reservationId)?.state, 'released')
assert.equal((await make().sweep()).items.find(i => i.reservationId === parent.reservationId)?.state, 'released')

const changed = await admit(); await compensate(changed)
beforeRelease = async args => {
  if (args.p_reservation !== changed.reservationId) return
  beforeRelease = undefined
  // Fixture-admin fault injection between the real SELECT and RPC; the runtime
  // service role cannot write this table. The stale caller fence must be refused.
  await sql(`update resource_reservations set binding=jsonb_set(binding,'{fence}','2'::jsonb) where reservation_id=${quote(changed.reservationId)}`)
}
assert.equal((await make().sweep()).items.find(i => i.reservationId === changed.reservationId)?.state, 'unknown')
assert.equal((await state(changed)).state, 'held')
assert.equal(rpcCalls.findLast(c => c.p_reservation === changed.reservationId).p_fence, '1')
assert.equal((await make().sweep()).items.find(i => i.reservationId === changed.reservationId)?.state, 'released')
assert.equal(rpcCalls.findLast(c => c.p_reservation === changed.reservationId).p_fence, '2')
console.log('PASS production resource recovery kernel: service-role SQL release/readback, recreated scanner, held unresolved, parent/child, changed fence refusal')
// #endregion resource-reconciliation-db
