import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import {existsSync} from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {execFileSync} from 'node:child_process'
import {createHash,randomUUID} from 'node:crypto'
import {preparedFixture} from './prepared-launch-fixture.mjs'
import {createControlledManagedPool,controlledPoolOrigin,issueControlledSpawnTicket,bindControlledSpawnTicket,consumeControlledSpawnTicket} from '../src/main/resourceControlledPool.ts'
import {createResourcePoolRegistry} from '../src/main/resourcePoolRegistry.ts'
import {PtyManager} from '../src/main/pty.ts'
import {createProcessBoundary} from '../src/main/processBoundary.ts'
import {readResourceHostPolicy,resourceDigest} from '../src/main/resourceHostPolicy.ts'
import {AGENT_SYNC_IDENTITY_SOURCE_SHA256} from '../src/main/resourceRunAssignment.ts'
const script=process.env.N028_AGENT_SYNC_SCRIPT??path.join(os.homedir(),'.codex/plugins/cache/agent-sync/agent-sync/1.22.2/skills/agent-sync/scripts/agent_sync.py')
const test=(name,fn)=>nodeTest(name,{skip:existsSync(script)?false:'NOT_RUN: pinned installed agent-sync source unavailable; no installation attempted'},fn)
const hash=b=>createHash('sha256').update(b).digest('hex'),wait=ms=>new Promise(r=>setTimeout(r,ms))
const vector=(slots=1)=>({workerSlots:slots,memoryBytes:10,diskBytes:10,cpuMilliCores:10}),zero={workerSlots:0,memoryBytes:0,diskBytes:0,cpuMilliCores:0}
async function fixture(t,options={}){
 assert.equal(hash(await fs.readFile(script)),AGENT_SYNC_IDENTITY_SOURCE_SHA256)
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'fabric-controlled-pool-')));t.after(()=>fs.rm(root,{recursive:true,force:true}))
 const repo=path.join(root,'repo'),bin=path.join(root,'bin')
 for(const dir of [repo,bin,path.join(root,'stop-host')])await fs.mkdir(dir,{mode:0o700})
 const host={hostInstanceId:randomUUID(),bootId:randomUUID()};await fs.writeFile(path.join(root,'stop-host/installation-id'),host.hostInstanceId+'\n')
 await fs.writeFile(path.join(bin,'claude'),'#!/bin/sh\nexit 0\n',{mode:0o755});const envPath=process.env.PATH;process.env.PATH=bin+path.delimiter+envPath;t.after(()=>{process.env.PATH=envPath})
 execFileSync('git',['init','-q',repo]);execFileSync('git',['-C',repo,'-c','user.name=fixture','-c','user.email=fixture@invalid','commit','--allow-empty','-qm','fixture'])
 const f=preparedFixture();f.project.repo_path=repo;f.root=root;f.calls=[];f.snapshots=0;f.spawned=0
 const manifest={selectionRevision:'s1',scopeMappingRevision:'m1',configuredKey:'lane',expectedHead:execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),selectedInputs:[{path:'README.md'}],mutableScope:[{path:'out.txt',state:'absent'}],bounds:{maxPaths:8,maxDepth:8,maxPathBytes:512,maxFileBytes:1024,maxTotalBytes:4096,maxMetadataBytes:65536,timeoutMs:5000,maxAgeMs:60000}}
 const manifestPath=path.join(root,'lane.json');await fs.writeFile(manifestPath,JSON.stringify(manifest))
 const policy={hostId:host.hostInstanceId,poolId:'controlled',localPolicyRevision:'human-policy',capacity:vector(10),demandProfiles:{builder:vector(),reviewer:vector(),test:vector()},diskPath:repo,diskDeviceId:String((await fs.stat(repo)).dev),maxAgeMs:10000,sampleWindowMs:100,timeoutMs:5000}
 const bindingRevision=`policy-sha256-v1:${resourceDigest(readResourceHostPolicy(policy,host.hostInstanceId))}`
 const coverage={schema:1,hostId:host.hostInstanceId,poolId:policy.poolId,localPolicyRevision:policy.localPolicyRevision,adapters:[{id:'managed',sourceSha256:hash(await fs.readFile(new URL('../src/main/resourceManagedUnit.ts',import.meta.url)))}]},coveragePath=path.join(root,'coverage.json');await fs.writeFile(coveragePath,JSON.stringify(coverage))
 const row=(pid,parent,group,start)=>({pid,parent,group,start,status:'S'})
 f.rows=[row(999,1,999,'host-start'),row(200,999,200,'owned-start')]
 const boundary=createProcessBoundary({ownPid:999,snapshot:async()=>{f.snapshots++;if(f.snapshotWait)await f.snapshotWait;if(f.captureUnknown)throw Error('synthetic unavailable');return f.rows},signal:()=>{throw Error('no native signal allowed')}})
 const ptys=new PtyManager({append:async event=>{f.calls.push(event.type);if(f.journalFailure&&event.type==='terminal.opened@1')throw Error('synthetic journal');return {seq:1}}},f.id.estate,{onData(){},onExit(){}},{compile:async()=>({args:[],env:f.bundleEnv??{}}),discard(){}},(_program,_args,spawnOptions)=>{
  f.spawnEnvironment=spawnOptions.env
  f.calls.push('native-spawn');f.spawned++;if(f.spawnFailure)throw Error('synthetic spawn failure')
  return {pid:200,write(){},resize(){},kill(){f.calls.push('signal-request')},onData(){return {dispose(){}}},onExit(fn){f.exit=fn;if(f.immediateExit)queueMicrotask(()=>{f.rows=f.rows.slice(0,1);void fn({exitCode:0,signal:0})});return {dispose(){}}}}
 },undefined,()=>({kind:'person',id:'fixture'}),{},boundary)
 const run='55555555-5555-4555-8555-555555555555'
 const db={rpc:async(name,args)=>{f.calls.push(name);f.lastArgs={name,args};if(f.rpcHook){const value=await f.rpcHook(name,args);if(value!==undefined)return value}
  if(name==='admit_resource_task_launch')return {data:{admitted:true,task_id:args.p_task_id,session_id:args.p_session_id,project_id:f.id.project,task_run_id:run,run_ordinal:1,receipt_seq:2,instruction:f.task.instruction,option_id:f.task.option_id,resource_reservation:{reservation_id:args.p_binding.reservationId,state:'held',run_ordinal:1}}}
  if(name==='begin_task_run_launch')return {data:{granted:true,task_run_id:run,session_id:args.p_session_id}}
  if(name==='validate_task_run_launch')return {data:{valid:f.valid!==false,task_run_id:run,session_id:args.p_session_id}}
  if(name==='bind_task_run')return {data:{bound:true,task_run_id:run,session_id:args.p_session_id}}
  if(name==='fail_task_launch'){f.failedStarted=args.p_process_started;return {data:{compensated:args.p_process_started===false}}}
  if(name==='cancel_resource_admission'||name==='release_resource_reservation')return {data:{released:true,receipt_seq:3}}
  throw Error('unexpected rpc')
 }}
 const config={lifecycle:'provision',rawPolicy:policy,estateId:f.id.estate,adapterId:'managed',timeoutMs:15000,maxEpochs:8,
  assignment:{projectId:f.id.project,repositoryRoot:repo,approvedRemote:'https://fixture.invalid/repo.git',repositoryName:'repo',manifestPath,manifestSha256:hash(JSON.stringify(manifest)),agentSyncScript:script,timeoutMs:5000,maxRecords:16,maxRecordBytes:32768,maxManifestBytes:32768},
  registry:{maxUnits:16,maxRecordBytes:8192,maxRegistryBytes:131072,timeoutMs:5000},inventory:{coveragePath,coverageSha256:hash(JSON.stringify(coverage)),timeoutMs:5000,maxRecords:48,maxRecordBytes:8192,maxCoverageBytes:8192,maxRegistryBytes:131072},inputs:{maxEntries:16,maxInstructionBytes:8192,contextBudget:8192,timeoutMs:5000},units:{maxEntries:16,timeoutMs:5000},resource:{maxEntries:16,timeoutMs:5000}}
 const deps={app:{getPath:()=>root},host,store:f.store,db,ptys,actor:{kind:'system',id:'fixture'},authority:()=>null,guard:async()=>true,track(){},untrack(){},stop:async()=>{f.calls.push('stop-request')},dispatch:async()=>({state:f.delivery??'delivering',says:'fixture'}),preflight:{
  current:async()=>{if(f.currentHook)await f.currentHook();return true},
  prepare:async(input,packet,evidence)=>{
   f.evidence=evidence
   if(f.prepareHook)await f.prepareHook()
   const binding={hostId:host.hostInstanceId,poolId:policy.poolId,localPolicyRevision:bindingRevision,reservationId:'reservation-'+input.sessionId,attemptId:evidence.assignment.attemptId,fence:1,ownerId:'fixture',role:'builder',inputDigest:'b'.repeat(64),scopeDigest:'c'.repeat(64)}
   // Synthetic R1/SQL transport only. Actual N028/N031/registry/managed/PTY modules run.
   const observed={...zero,workerSlots:evidence.inventory.workers.length}
   return {request:{...binding,demand:vector()},ownDemand:vector(),context:{nowMs:100,policy:{hostId:host.hostInstanceId,poolId:policy.poolId,localPolicyRevision:bindingRevision,capacity:vector(options.capacity??10),maxAgeMs:10},snapshot:{id:'snapshot',hostId:host.hostInstanceId,poolId:policy.poolId,localPolicyRevision:bindingRevision,atMs:100,reserved:zero,observed,reservedObserved:zero}},checks:{ownership:()=>({state:'held',identity:binding,snapshotId:'snapshot',atMs:100})}}
  }}}
 const ledger=async()=>path.join(root,'resource-pools',(await fs.readdir(path.join(root,'resource-pools')))[0])
 return Object.assign(f,{config,deps,host,policy,ptys,coveragePath,ledger,
  async open(){const r=await createControlledManagedPool(config,deps);assert.equal(r.state,'observed',JSON.stringify(r));return r.value},
  async records(){const dir=await ledger();return Promise.all((await fs.readdir(dir)).filter(x=>/^unit\./.test(x)).map(async x=>JSON.parse(await fs.readFile(path.join(dir,x),'utf8'))))}})
}
test('concrete factory declares before resource admission and consumes ticket immediately after final SQL',async t=>{
 const f=await fixture(t),pool=await f.open(),r=await pool.launch({taskId:f.id.task,trigger:'operator'})
 assert.equal(r.started,true,JSON.stringify(r));assert.equal(f.spawned,1);assert.deepEqual(f.evidence.inventory.workers,[f.evidence.assignment.attemptId]);assert.equal(f.calls[f.calls.indexOf('native-spawn')-1],'validate_task_run_launch')
 const records=await f.records();assert.equal(records.length,1);assert.equal(records[0].unit.unitId,f.evidence.assignment.attemptId)
 assert.equal((await pool.close()).state,'sealed')
})
test('actual N022 sampler consumes complete closed-domain registry reading, not zero from empty process map',async t=>{
 const f=await fixture(t),pool=await f.open();assert.equal((await pool.launch({taskId:f.id.task,trigger:'operator'})).started,true)
 const s=await pool.snapshot();assert.equal(s.state,'observed',JSON.stringify(s));assert.equal(s.observed.workerSlots,1);assert.equal(s.executionAuthorized,false);assert.equal((await pool.close()).state,'sealed')
})
test('clean restart retains historical units across invocation change',async t=>{
 const f=await fixture(t),pool=await f.open();assert.equal((await pool.launch({taskId:f.id.task,trigger:'operator'})).started,true);assert.equal((await pool.close()).state,'sealed')
 f.config.lifecycle='reopen';f.deps.host={...f.host,bootId:randomUUID()};const next=await f.open();const s=await next.snapshot();assert.equal(s.state,'observed');assert.equal(s.observed.workerSlots,1);assert.equal((await next.close()).state,'sealed')
})
test('capacity one counts own pending intent conservatively and permanently prevents clean handoff',async t=>{
 const f=await fixture(t,{capacity:1}),pool=await f.open(),r=await pool.launch({taskId:f.id.task,trigger:'operator'});assert.equal(r.started,false);assert.equal(f.spawned,0);assert.equal((await f.records()).length,1);assert.equal((await pool.close()).state,'unknown');assert.equal((await pool.snapshot()).state,'unknown')
 assert.ok((await fs.readdir(await f.ledger())).includes('writer.lock'))
})
test('uncertain delivery after actual spawn poisons creation domain without retiring declaration',async t=>{
 const f=await fixture(t),pool=await f.open();f.delivery='outcome_unknown';const result=await pool.launch({taskId:f.id.task,trigger:'operator'});assert.equal(result.started,true);assert.equal(result.deliveryState,'outcome_unknown');assert.equal(f.spawned,1);assert.equal((await f.records()).length,1);assert.equal((await pool.close()).state,'unknown')
})
test('late unresolved preflight remains charged; repeated calls start no more work',async t=>{
 const f=await fixture(t);f.config.resource.timeoutMs=1000;const pool=await f.open();let release,calls=0;f.prepareHook=()=>{calls++;return new Promise(r=>release=r)}
 assert.equal((await pool.launch({taskId:f.id.task,trigger:'operator'})).started,false);for(let i=0;i<12;i++)assert.equal((await pool.launch({taskId:f.id.task,trigger:'operator'})).state,'unknown');assert.equal(calls,1);assert.equal((await pool.close()).state,'unknown');release();await wait(30);assert.equal(f.spawned,0);assert.ok((await fs.readdir(await f.ledger())).includes('writer.lock'))
})
test('close during final SQL revokes exact native ticket synchronously before spawn',async t=>{
 const f=await fixture(t),pool=await f.open();let close
 f.rpcHook=async name=>{if(name==='validate_task_run_launch')close=pool.close()}
 const result=await pool.launch({taskId:f.id.task,trigger:'operator'});assert.ok(f.calls.includes('validate_task_run_launch'),'actual final SQL boundary reached');assert.ok(result.state==='unknown'||result.started===false);assert.equal(f.spawned,0);assert.equal((await close).state,'unknown')
})
test('forged capability and tickets never create a controlled origin or native permission',async t=>{
 const f=await fixture(t);assert.equal(controlledPoolOrigin({}),null);assert.throws(()=>issueControlledSpawnTicket({}, {}, {}, {}));assert.equal(bindControlledSpawnTicket({},f.ptys,{},{}),false);assert.equal(consumeControlledSpawnTicket({},f.ptys,{},{}),false)
 assert.throws(()=>createResourcePoolRegistry({...f.config.registry,installationRoot:f.root,hostId:f.host.hostInstanceId,poolId:f.policy.poolId,estateId:f.id.estate},{host:f.host,controlled:{maxEpochs:8}}))
})
test('generic provisioned registry cannot be promoted to controlled historical coverage',async t=>{
 const f=await fixture(t),r=createResourcePoolRegistry({...f.config.registry,installationRoot:f.root,hostId:f.host.hostInstanceId,poolId:f.policy.poolId,estateId:f.id.estate},{host:f.host});assert.equal((await r.provision()).state,'observed');f.config.lifecycle='reopen';assert.equal((await createControlledManagedPool(f.config,f.deps)).state,'unknown')
})
test('missing controlled ledger preserves external anchor and never resets history',async t=>{
 const f=await fixture(t),pool=await f.open();assert.equal((await pool.close()).state,'sealed');await fs.rm(await f.ledger(),{recursive:true});assert.equal((await createControlledManagedPool(f.config,f.deps)).state,'unknown');f.config.lifecycle='reopen';assert.equal((await createControlledManagedPool(f.config,f.deps)).state,'unknown')
})
test('snapshot corruption permanently poisons even after disk bytes are restored',async t=>{
 const f=await fixture(t),pool=await f.open(),file=path.join(await f.ledger(),'head.json'),before=await fs.readFile(file);await fs.writeFile(file,'{}');assert.equal((await pool.snapshot()).state,'unknown');await fs.writeFile(file,before);assert.equal((await pool.close()).state,'unknown')
})
test('actual collaborator replacement refuses before any admission or spawn',async t=>{
 const f=await fixture(t),pool=await f.open();f.deps.ptys={...f.ptys};assert.equal((await pool.launch({taskId:f.id.task,trigger:'operator'})).state,'unknown');assert.equal(f.spawned,0);assert.ok(!f.calls.includes('admit_resource_task_launch'))
})

for(const state of ['retryable','rejected','queued','malformed'])test(`actual managed delivery ${state} permanently poisons without losing started result`,async t=>{
 const f=await fixture(t),pool=await f.open();f.delivery=state;const result=await pool.launch({taskId:f.id.task,trigger:'operator'});assert.equal(result.started,true);assert.equal(result.deliveryState,state);assert.equal(f.spawned,1);assert.equal((await pool.close()).state,'unknown');assert.equal((await f.records()).length,1)
})

test('actual captured native ticket refuses copied token, wrong manager and second consumption',async t=>{
 const f=await fixture(t),reserve=f.ptys.reserveOwnedUnit.bind(f.ptys);let held
 f.ptys.reserveOwnedUnit=(packet,env,ticket)=>{const native=reserve(packet,env,ticket);held={packet,native,ticket};return native}
 const pool=await f.open();assert.equal((await pool.launch({taskId:f.id.task,trigger:'operator'})).started,true);assert.ok(held.ticket)
 assert.equal(bindControlledSpawnTicket({...held.ticket},f.ptys,held.packet,held.native),false)
 assert.equal(consumeControlledSpawnTicket(held.ticket,{},held.packet,held.native),false)
 assert.equal(consumeControlledSpawnTicket(held.ticket,f.ptys,{...held.packet},held.native),false)
 assert.equal(consumeControlledSpawnTicket(held.ticket,f.ptys,held.packet,held.native),false)
 assert.equal((await pool.close()).state,'sealed')
})
test('intent currentness failure after declaration retains orphan as charged storage',async t=>{
 const f=await fixture(t),pool=await f.open();let declared=false
 f.readHook=async(table)=>{if(table==='project_tasks'&&(await f.records()).length){declared=true;return {data:{...f.task,project_id:randomUUID()},error:null}}}
 const result=await pool.launch({taskId:f.id.task,trigger:'operator'});assert.equal(declared,true);assert.equal(result.started,false);assert.equal(f.spawned,0);assert.equal((await f.records()).length,1);assert.equal((await pool.close()).state,'unknown')
})
