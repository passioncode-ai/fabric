import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
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

test('independent: mapped failed delivery cannot cleanly seal',async t=>{
 for(const state of ['retryable','rejected','queued','malformed']){
  const f=await fixture(t),pool=await f.open();f.delivery=state;
  const result=await pool.launch({taskId:f.id.task,trigger:'operator'});
  assert.equal(result.started,true);assert.equal(result.deliveryState,state);assert.equal(f.spawned,1);
  assert.equal((await pool.close()).state,'unknown',state+' must poison seal');
  assert.ok((await fs.readdir(await f.ledger())).includes('writer.lock'));
  assert.equal((await f.records()).length,1);
 }
});
test('independent: close while successful delivery is still pending stays unknown',async t=>{
 const f=await fixture(t);let release,entered;const ready=new Promise(r=>entered=r);
 f.deps.dispatch=async()=>{entered();await new Promise(r=>release=r);return {state:'acked',says:'fixture'}};
 const pool=await f.open(),running=pool.launch({taskId:f.id.task,trigger:'operator'});
 await ready;assert.equal(f.spawned,1);const closing=pool.close();release();
 assert.equal((await running).state,'unknown');assert.equal((await closing).state,'unknown');
 assert.equal((await pool.snapshot()).state,'unknown');assert.ok((await fs.readdir(await f.ledger())).includes('writer.lock'));
 assert.equal((await f.records()).length,1);
});
test('independent: valid ticket refuses mismatched bindings before actual consumption',async t=>{
 const f=await fixture(t),original=f.ptys.reserveOwnedUnit.bind(f.ptys);let held,checked=false;
 f.ptys.reserveOwnedUnit=(packet,env,ticket)=>{const native=original(packet,env,ticket);held={packet,native,ticket};return native};
 f.rpcHook=async name=>{if(name!=='validate_task_run_launch')return;checked=true;
  assert.equal(consumeControlledSpawnTicket({...held.ticket},f.ptys,held.packet,held.native),false);
  assert.equal(consumeControlledSpawnTicket(held.ticket,{},held.packet,held.native),false);
  assert.equal(consumeControlledSpawnTicket(held.ticket,f.ptys,{...held.packet},held.native),false);
  assert.equal(consumeControlledSpawnTicket(held.ticket,f.ptys,held.packet,{...held.native}),false);
  assert.equal(bindControlledSpawnTicket(held.ticket,f.ptys,held.packet,{...held.native}),false);
 };
 const pool=await f.open(),result=await pool.launch({taskId:f.id.task,trigger:'operator'});
 assert.equal(checked,true);assert.equal(result.started,true);assert.equal(f.spawned,1);
 assert.equal(consumeControlledSpawnTicket(held.ticket,f.ptys,held.packet,held.native),false);
 assert.equal((await pool.close()).state,'sealed');
});
