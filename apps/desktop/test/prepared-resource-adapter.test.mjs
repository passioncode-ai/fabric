import assert from 'node:assert/strict'
import {test} from 'node:test'
import {preparedFixture} from './prepared-launch-fixture.mjs'
import {createResourceLaunchAdapter} from '../src/main/resourceLaunchAdapter.ts'
const v=n=>({workerSlots:n,memoryBytes:n,diskBytes:n,cpuMilliCores:n})
function fixture(){const f=preparedFixture(),calls=[],input={estateId:f.id.estate,taskId:f.id.task,sessionId:f.id.session,trigger:'operator',actor:{kind:'system',id:'fixture'}}
 const identity={hostId:'host',poolId:'pool',localPolicyRevision:'policy',reservationId:'reservation',attemptId:'attempt',fence:1,ownerId:'owner',role:'builder',inputDigest:'a'.repeat(64),scopeDigest:'b'.repeat(64)}
 const deps={inputs:f.inputs,maxEntries:2,timeoutMs:100,current:async()=>true,prepare:async(supplied,packet)=>{f.seen=packet;assert.ok(f.inputs.owns(packet));return {request:{...identity,demand:v(1)},ownDemand:v(1),context:{nowMs:10,policy:{hostId:'host',poolId:'pool',localPolicyRevision:'policy',capacity:v(10),maxAgeMs:100},snapshot:{id:'snapshot',hostId:'host',poolId:'pool',localPolicyRevision:'policy',atMs:10,reserved:v(0),observed:v(0),reservedObserved:v(0)}},checks:{ownership:()=>({state:'held',identity,snapshotId:'snapshot',atMs:10})}}},db:{rpc:async(name,args)=>{calls.push({name,args});return {data:{admitted:true,task_id:input.taskId,project_id:f.id.project,session_id:input.sessionId,task_run_id:f.id.project,run_ordinal:1,receipt_seq:1,instruction:f.task.instruction,resource_reservation:{reservation_id:'reservation',state:'held',run_ordinal:1}}}}}}
 return Object.assign(f,{input,identity,calls,deps,adapter:createResourceLaunchAdapter(deps)})}
test('bound resource adapter sees exact content packet while full inputDigest retains separate producer identity',async()=>{
 const f=fixture(),p=await f.inputs.prepare(f.request);assert.equal(p.state,'observed');const r=await f.adapter.admit(f.input,p.packet);assert.equal(r.admitted,true);assert.equal(f.seen,p.packet)
 assert.equal(f.calls[0].args.p_binding.inputDigest,f.identity.inputDigest);assert.notEqual(f.calls[0].args.p_binding.inputDigest,p.packet.contentDigest)
 assert.deepEqual(await f.adapter.admit(f.input,p.packet),r);assert.equal(f.calls.length,1)
})
test('required prepared adapter refuses missing/foreign packet before preparation/RPC and changed packet on cached session',async()=>{
 const f=fixture();assert.equal((await f.adapter.admit(f.input)).admitted,false);assert.equal(f.seen,undefined);assert.equal(f.calls.length,0)
 const p=await f.inputs.prepare(f.request);assert.equal(p.state,'observed');assert.equal((await f.adapter.admit(f.input,{...p.packet})).admitted,false);assert.equal(f.calls.length,0)
 assert.equal((await f.adapter.admit(f.input,p.packet)).admitted,true);f.inputs.release(p.packet);f.task.instruction='changed'
 const next=await f.inputs.prepare(f.request);assert.equal(next.state,'observed');assert.equal((await f.adapter.admit(f.input,next.packet)).reasonCode,'resource_identity_conflict');assert.equal(f.calls.length,1)
})
