import {resolve} from "node:path";import {pathToFileURL} from "node:url";
import test from 'node:test'
import assert from 'node:assert/strict'
const { createResourceWaitQueue } = await import(pathToFileURL(resolve(process.cwd(),"apps/desktop/src/main/resourceWaitQueue.ts")).href)

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



const gate=latch();let inspections=0,reads=0,permitOutcome
const f=fixture({timeoutMs:20,inspect:async()=>{inspections++;if(inspections===2)await gate.promise;return{state:'ready'}},dispatch:async(_i,permit)=>{void permit().then(x=>permitOutcome=x);return'refused_before_start'}})
await f.add();const originalRead=f.store.read;f.store.read=async(...args)=>{reads++;return originalRead(...args)}
const q=f.queue();assert.equal((await q.pass(scope)).state,'refused_before_start');assert.equal((await q.pass(scope)).state,'busy')
gate.release();await pause(0);assert.equal(permitOutcome,false);assert.equal(reads,0);assert.equal((await q.pass(scope)).state,'empty')
console.log(JSON.stringify({case:'dispatcher-returns-before-nested-permit-settles',permitOutcome,reads,inspections,passed:true}))
