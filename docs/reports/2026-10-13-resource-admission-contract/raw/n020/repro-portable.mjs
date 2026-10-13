import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { test } from 'node:test'
const { createResourceLaunchAdapter } = await import(pathToFileURL(resolve(process.cwd(), 'apps/desktop/src/main/resourceLaunchAdapter.ts')).href)
const { createAdmitExisting } = await import(pathToFileURL(resolve(process.cwd(), 'apps/desktop/src/main/admitExisting.ts')).href)
const { createManagedLaunch } = await import(pathToFileURL(resolve(process.cwd(), 'apps/desktop/src/main/managedLaunch.ts')).href)
const { LaunchRefusedBeforeSpawn, ProcessLaunchFailure } = await import(pathToFileURL(resolve(process.cwd(), 'apps/desktop/src/main/launchFailure.ts')).href)

const ids = { estate: '11111111-1111-4111-8111-111111111111', task: '22222222-2222-4222-8222-222222222222',
  session: '33333333-3333-4333-8333-333333333333', project: '44444444-4444-4444-8444-444444444444', run: '55555555-5555-4555-8555-555555555555' }
const vector = (workerSlots = 1) => ({ workerSlots, memoryBytes: 100, diskBytes: 10, cpuMilliCores: 1000 })
const zero = { workerSlots: 0, memoryBytes: 0, diskBytes: 0, cpuMilliCores: 0 }
const input = () => ({ estateId: ids.estate, taskId: ids.task, sessionId: ids.session, actor: { kind: 'system', id: 'chain' }, trigger: 'chain' })
function fixture() {
  const calls = [], sessions = new Map(), f = { calls, sessions, spawned: 0, released: false, current: true, timeoutMs: 50, prepares: 0 }
  const db = { rpc: async (name, args) => {
    calls.push({ name, args: structuredClone(args) })
    if (f.rpc) { const result = f.rpc(name, args); if (result !== undefined) return await result }
    if (name === 'admit_resource_task_launch' || name === 'admit_task_launch') {
      const data = { admitted: true, task_id: args.p_task_id, session_id: args.p_session_id, project_id: ids.project,
        task_run_id: ids.run, run_ordinal: 2, receipt_seq: 12, instruction: 'bounded work', option_id: 'shell' }
      if (name === 'admit_resource_task_launch') data.resource_reservation = { reservation_id: args.p_binding.reservationId, state: 'held', run_ordinal: 2 }
      f.changeReceipt?.(data)
      return { data }
    }
    if (name === 'begin_task_run_launch') return { data: { granted: true, task_run_id: ids.run, session_id: args.p_session_id } }
    if (name === 'validate_task_run_launch') return { data: { valid: true, task_run_id: ids.run, session_id: args.p_session_id } }
    if (name === 'bind_task_run') return { data: { bound: true, task_run_id: ids.run, session_id: args.p_session_id } }
    if (name === 'fail_task_launch') return { data: { compensated: true } }
    if (name === 'release_resource_reservation' || name === 'cancel_resource_admission') { f.released = true; return { data: { released: true, receipt_seq: 20 } } }
    throw Error(`unexpected ${name}`)
  } }
  const deps = { db, timeoutMs: f.timeoutMs, maxEntries: 16,
    prepare: async supplied => {
      f.prepares++; assert.ok(Object.isFrozen(supplied)); assert.ok(Object.isFrozen(supplied.actor))
      const identity = { hostId: 'host', poolId: 'shared', localPolicyRevision: 'policy-1', reservationId: `r-${supplied.sessionId}`,
        attemptId: `a-${supplied.sessionId}`, fence: 2, ownerId: 'agent', role: 'builder', inputDigest: 'a'.repeat(64), scopeDigest: 'b'.repeat(64) }
      const result = { request: { ...identity, demand: vector() }, ownDemand: vector(),
        context: { nowMs: 100, policy: { hostId: 'host', poolId: 'shared', localPolicyRevision: 'policy-1', capacity: vector(4), maxAgeMs: 10 },
          snapshot: { id: 'snapshot', hostId: 'host', poolId: 'shared', localPolicyRevision: 'policy-1', atMs: 100,
            reserved: { ...zero }, observed: { ...zero }, reservedObserved: { ...zero } } },
        checks: { ownership: () => ({ state: 'held', identity, snapshotId: 'snapshot', atMs: 100 }) } }
      f.changePreparation?.(result)
      return result
    },
    current: async (binding, receipt) => {
      calls.push({ name: 'current' }); assert.ok(Object.isFrozen(binding)); assert.ok(Object.isFrozen(binding.identity)); assert.ok(Object.isFrozen(receipt))
      if (f.currentHook) return await f.currentHook(binding, receipt)
      return f.current
    } }
  const adapter = createResourceLaunchAdapter(deps)
  const admit = createAdmitExisting(db, adapter)
  const managed = {
    db, estateId: ids.estate, actor: { kind: 'system', id: 'test' }, authority: () => null, resources: adapter,
    admit: (taskId, sessionId, trigger) => admit({ estateId: ids.estate, taskId, sessionId, trigger, actor: { kind: 'system', id: 'test' } }),
    prepare: async () => {
      if (f.prepareFailure) throw Error('preparation failed')
      return async (sessionId, guard) => {
        if (!await guard()) throw new LaunchRefusedBeforeSpawn(sessionId, 'resource_currentness')
        f.spawned++; sessions.set(sessionId, { running: true })
        if (f.spawnUnknown) throw new ProcessLaunchFailure(sessionId, 'unknown', 'unknown')
        return { sessionId }
      }
    }, track() {}, untrack() {}, get: sessionId => sessions.get(sessionId) ?? null, stop: async () => {},
    dispatch: async () => ({ state: 'delivering', says: 'queued' }),
  }
  return Object.assign(f, { db, deps, adapter, admit, managed })
}
const names = f => f.calls.map(call => call.name)
function noLegacy(f) { assert.equal(names(f).includes('admit_task_launch'), false) }


const results=[]
for(const method of ['current','cancelUnbegun','releaseCompensated']) {
 const f=fixture();f.deps.timeoutMs=5;f.deps.maxEntries=1
 const adapter=createResourceLaunchAdapter(f.deps),admitted=await adapter.admit(input());assert.equal(admitted.admitted,true)
 let outstanding=0,calls=0;const resolvers=[]
 const pending=()=>{calls++;outstanding++;return new Promise(resolve=>resolvers.push(resolve)).finally(()=>outstanding--)}
 if(method==='current')f.deps.current=pending
 else f.rpc=name=>name===(method==='cancelUnbegun'?'cancel_resource_admission':'release_resource_reservation')?pending():undefined
 const responses=[]
 for(let n=0;n<6;n++)responses.push(await adapter[method](admitted.receipt))
 results.push({method,cachedEntriesBound:1,requests:calls,outstandingBeforeSettlement:outstanding,responses})
 for(const resolve of resolvers)resolve(method==='current'?true:{data:{released:true,receipt_seq:20}})
 await new Promise(resolve=>setImmediate(resolve));assert.equal(outstanding,0)
}
console.log(JSON.stringify({candidate:'repository adapter; source binding is in paired receipt',results},null,2))
