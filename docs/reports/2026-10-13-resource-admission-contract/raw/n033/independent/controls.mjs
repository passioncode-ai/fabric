import {pathToFileURL} from 'node:url'
const repository=process.env.FABRIC_REPO;if(!repository)throw Error('FABRIC_REPO required')
const repoImport=p=>pathToFileURL(repository+'/'+p).href
import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import {existsSync} from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {execFileSync} from 'node:child_process'
import {createHash,randomUUID} from 'node:crypto'
const {preparedFixture}=await import(repoImport('apps/desktop/test/prepared-launch-fixture.mjs'))
const {createResourceRunAssignmentManager,AGENT_SYNC_IDENTITY_SOURCE_SHA256}=await import(repoImport('apps/desktop/src/main/resourceRunAssignment.ts'))
const {createResourceWorkerInventory}=await import(repoImport('apps/desktop/src/main/resourceWorkerInventory.ts'))
const {createResourceManagedUnit}=await import(repoImport('apps/desktop/src/main/resourceManagedUnit.ts'))
const {createResourceLaunchAdapter}=await import(repoImport('apps/desktop/src/main/resourceLaunchAdapter.ts'))
const {createManagedLaunch}=await import(repoImport('apps/desktop/src/main/managedLaunch.ts'))
const {createAdmitExisting}=await import(repoImport('apps/desktop/src/main/admitExisting.ts'))
const {PtyManager}=await import(repoImport('apps/desktop/src/main/pty.ts'))
const {AGENTS}=await import(repoImport('apps/desktop/src/shared/agents.ts'))
const {readResourceHostPolicy,resourceDigest}=await import(repoImport('apps/desktop/src/main/resourceHostPolicy.ts'))
const {createProcessBoundary}=await import(repoImport('apps/desktop/src/main/processBoundary.ts'))
const script=process.env.N028_AGENT_SYNC_SCRIPT??path.join(os.homedir(),'.codex/plugins/cache/agent-sync/agent-sync/1.22.2/skills/agent-sync/scripts/agent_sync.py')
const test=(name,fn)=>nodeTest(name,{skip:existsSync(script)?false:'NOT_RUN pinned installed agent-sync source unavailable'},fn)
const hash=b=>createHash('sha256').update(b).digest('hex'),wait=ms=>new Promise(r=>setTimeout(r,ms))
const vector=(slots=1)=>({workerSlots:slots,memoryBytes:10,diskBytes:10,cpuMilliCores:10}),zero={workerSlots:0,memoryBytes:0,diskBytes:0,cpuMilliCores:0}
async function fixture(t,options={}){
 assert.equal(hash(await fs.readFile(script)),AGENT_SYNC_IDENTITY_SOURCE_SHA256)
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'fabric-owned-unit-')));t.after(()=>fs.rm(root,{recursive:true,force:true}))
 const repo=path.join(root,'repo'),records=path.join(root,'records'),inventory=path.join(root,'inventory'),bin=path.join(root,'bin')
 for(const dir of [repo,records,inventory,bin])await fs.mkdir(dir,{mode:0o700})
 await fs.writeFile(path.join(bin,'claude'),'#!/bin/sh\nexit 0\n',{mode:0o755});const envPath=process.env.PATH;process.env.PATH=bin+path.delimiter+envPath;t.after(()=>{process.env.PATH=envPath})
 execFileSync('git',['init','-q',repo]);execFileSync('git',['-C',repo,'-c','user.name=fixture','-c','user.email=fixture@invalid','commit','--allow-empty','-qm','fixture'])
 const f=preparedFixture();f.project.repo_path=repo;f.root=root;f.inventory=inventory;f.calls=[];f.snapshots=0;f.spawned=0
 const manifest={selectionRevision:'s1',scopeMappingRevision:'m1',configuredKey:'lane',expectedHead:execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),selectedInputs:[{path:'README.md'}],mutableScope:[{path:'out.txt',state:'absent'}],bounds:{maxPaths:8,maxDepth:8,maxPathBytes:512,maxFileBytes:1024,maxTotalBytes:4096,maxMetadataBytes:65536,timeoutMs:1000,maxAgeMs:60000}}
 const manifestPath=path.join(root,'lane.json');await fs.writeFile(manifestPath,JSON.stringify(manifest))
 const host={hostInstanceId:'host',bootId:'boot'},policy={hostId:'host',poolId:'pool',localPolicyRevision:'human-policy',capacity:vector(10),demandProfiles:{builder:vector(),reviewer:vector(),test:vector()},diskPath:repo,diskDeviceId:'1',maxAgeMs:1000,sampleWindowMs:10,timeoutMs:100}
 const bindingRevision=`policy-sha256-v1:${resourceDigest(readResourceHostPolicy(policy,'host'))}`
 const assignments=createResourceRunAssignmentManager({estateId:f.id.estate,projectId:f.id.project,installationId:'host',invocationId:'boot',repositoryRoot:repo,approvedRemote:'https://fixture.invalid/repo.git',repositoryName:'repo',manifestPath,manifestSha256:hash(JSON.stringify(manifest)),storageRoot:records,agentSyncScript:script,timeoutMs:1000,maxRecords:16,maxRecordBytes:32768,maxManifestBytes:32768},{store:f.store,key:()=>randomUUID().replaceAll('-','').slice(0,12)})
 const actualEnvironment=assignments.childEnvironment
 assignments.childEnvironment=async handle=>{f.calls.push('child-environment');if(f.environmentHook)return f.environmentHook(handle,()=>actualEnvironment.call(assignments,handle));return actualEnvironment.call(assignments,handle)}
 const coverage={schema:1,hostId:'host',poolId:'pool',localPolicyRevision:'human-policy',adapters:[{id:'managed',sourceSha256:hash(await fs.readFile(new URL(repoImport('apps/desktop/src/main/resourceManagedUnit.ts'))))}]},coveragePath=path.join(root,'coverage.json');await fs.writeFile(coveragePath,JSON.stringify(coverage))
 const intents=createResourceWorkerInventory({estateId:f.id.estate,hostId:'host',poolId:'pool',localPolicyRevision:'human-policy',invocationId:'boot',storageRoot:inventory,coveragePath,coverageSha256:hash(JSON.stringify(coverage)),timeoutMs:500,maxRecords:48,maxRecordBytes:8192,maxCoverageBytes:8192,maxRegistryBytes:131072},{assignments,host})
 if(options.loseAttachment){const original=intents.attachAdmission;intents.attachAdmission=async(...args)=>{const r=await original(...args);assert.equal(r.state,'recorded');return {state:'unknown',complete:false,executionAuthorized:false,reason:'lost_reply'}}}
 const row=(pid,parent,group,start)=>({pid,parent,group,start,status:'S'})
 f.rows=[row(999,1,999,'host-start'),row(200,999,200,'owned-start')]
 const boundary=createProcessBoundary({ownPid:999,snapshot:async()=>{f.snapshots++;if(f.snapshotWait)await f.snapshotWait;if(f.captureUnknown)throw Error('synthetic unavailable');return f.rows},signal:()=>{throw Error('no native signal allowed')}})
 const ptys=new PtyManager({append:async event=>{f.calls.push(event.type);if(f.journalFailure&&event.type==='terminal.opened@1')throw Error('synthetic journal');return {seq:1}}},f.id.estate,{onData(){},onExit(){}},{compile:async()=>({args:[],env:f.bundleEnv??{}}),discard(){}},(_program,_args,spawnOptions)=>{
  f.spawnEnvironment=spawnOptions.env
  f.calls.push('native-spawn');f.spawned++;if(f.spawnFailure)throw Error('synthetic spawn failure')
  return {pid:200,write(){},resize(){},kill(){f.calls.push('signal-request')},onData(){return {dispose(){}}},onExit(fn){f.exit=fn;if(f.immediateExit)queueMicrotask(()=>{f.rows=f.rows.slice(0,1);void fn({exitCode:0,signal:0})});return {dispose(){}}}}
 },undefined,()=>({kind:'person',id:'fixture'}),{},boundary)
 if(options.delayNativeAllocation){
  const reserve=ptys.reserveOwnedUnit.bind(ptys);f.nativeAllocations=[]
  ptys.reserveOwnedUnit=(...args)=>{const token=reserve(...args);f.nativeAllocations.push(token)
   // A synchronous boundary can finish after the caller's operation deadline.
   if(f.delayNative){const until=performance.now()+1100;while(performance.now()<until){};f.delayNative=false}
   return token
  }
 }
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
 let units
 const resourceDeps={db,inputs:f.inputs,timeoutMs:1000,maxEntries:16,current:async()=>{f.calls.push('resource-current');if(f.currentHook)await f.currentHook();return true},prepare:async(input,packet)=>{
  const handle=units.assignmentFor(packet);assert.ok(handle,'actual N028 handle is available to trusted preflight');const identity=await assignments.readIdentity(handle);assert.equal(identity.state,'observed')
  const binding={hostId:'host',poolId:'pool',localPolicyRevision:bindingRevision,reservationId:'reservation-'+input.sessionId,attemptId:f.wrongAttempt??identity.value.attemptId,fence:1,ownerId:'fixture',role:'builder',inputDigest:'b'.repeat(64),scopeDigest:'c'.repeat(64)}
  // Synthetic R1 ownership/capacity only; no native or DB authority is claimed by this fixture.
  return {request:{...binding,demand:vector(f.ownSlots??1)},ownDemand:vector(f.ownSlots??1),context:{nowMs:100,policy:{hostId:'host',poolId:'pool',localPolicyRevision:bindingRevision,capacity:vector(10),maxAgeMs:10},snapshot:{id:'snapshot',hostId:'host',poolId:'pool',localPolicyRevision:bindingRevision,atMs:100,reserved:zero,observed:zero,reservedObserved:zero}},checks:{ownership:()=>({state:'held',identity:binding,snapshotId:'snapshot',atMs:100})}}
 }}
 const resources=createResourceLaunchAdapter(resourceDeps),unitDeps={assignments,intents,resources,ptys,host}
 units=createResourceManagedUnit({estateId:f.id.estate,rawPolicy:policy,adapterId:'managed',timeoutMs:options.timeoutMs??1000,maxEntries:16},unitDeps)
 const admit=createAdmitExisting(db,resources)
 const deps={db,estateId:f.id.estate,actor:{kind:'system',id:'fixture'},authority:()=>null,resources,units,
  admit:(taskId,sessionId,trigger,packet)=>admit({estateId:f.id.estate,taskId,sessionId,trigger,actor:{kind:'system',id:'fixture'}},packet),
  prepare:async(receipt,input,packet,native)=>{f.packet=packet;f.native=native;return (sessionId,guard)=>ptys.open(f.id.project,repo,'claude-code',f.id.task,null,null,sessionId,guard,null,packet,native)},
  track(){},untrack(){},get:id=>ptys.get(id),stop:async()=>{f.calls.push('stop-request')},dispatch:async()=>{f.calls.push('dispatch');return {state:'delivering',says:'fixture'}}}
 return Object.assign(f,{assignments,intents,ptys,resources,units,unitDeps,deps,host,coveragePath,manifestPath,records,policy,launch:createManagedLaunch(deps),
  async direct(){const packet=(await f.inputs.prepare(f.request)).packet;assert.ok(packet);const unit=await units.prepare(packet);assert.equal(unit.state,'observed',JSON.stringify(unit));const admitted=await deps.admit(f.id.task,f.id.session,'operator',packet);assert.equal(admitted.admitted,true);assert.equal(await units.attachAdmission(unit.value,admitted.receipt),true);return {packet,unit:unit.value,receipt:admitted.receipt,native:units.native(unit.value)}},
  async events(){return Promise.all((await fs.readdir(inventory)).filter(x=>x.endsWith('.json')).map(async x=>JSON.parse(await fs.readFile(path.join(inventory,x),'utf8'))))}})
}


test('independent: required child override preserves inherited spine-credential exclusion',async t=>{
 const f=await fixture(t),keys=['SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ANON_KEY','SUPABASE_DB_URL','DATABASE_URL','POSTGRES_PASSWORD','PGPASSWORD','FABRIC_LAUNCHED_SESSION']
 const saved=new Map(keys.map(key=>[key,process.env[key]]));for(const key of keys)process.env[key]='synthetic-never-a-secret'
 t.after(()=>{for(const [key,value]of saved){if(value===undefined)delete process.env[key];else process.env[key]=value}})
 const r=await f.launch({taskId:f.id.task,trigger:'operator'});assert.equal(r.started,true,JSON.stringify(r))
 for(const key of keys)assert.equal(f.spawnEnvironment[key],undefined,key)
 const record=JSON.parse(await fs.readFile(path.join(f.records,(await fs.readdir(f.records)).find(x=>x.endsWith('.json'))),'utf8'))
 assert.equal(f.spawnEnvironment.AGENT_SYNC_RUN_ID,record.key);assert.equal(f.calls[f.calls.indexOf('native-spawn')-1],'validate_task_run_launch')
})
test('independent: environment producer replacement during awaited read refuses before begin',async t=>{
 const f=await fixture(t)
 f.environmentHook=async(_handle,actual)=>{const result=await actual();f.assignments.childEnvironment=async()=>result;return result}
 const r=await f.launch({taskId:f.id.task,trigger:'operator'});assert.equal(r.started,false);assert.equal(f.spawned,0);assert.ok(!f.calls.includes('begin_task_run_launch'))
})
test('independent: hidden environment extra key cannot pass the one-key projection',async t=>{
 const f=await fixture(t)
 f.environmentHook=async(_handle,actual)=>{const result=await actual();return {...result,value:Object.defineProperty({...result.value},'HIDDEN',{value:'synthetic',enumerable:false})}}
 const r=await f.launch({taskId:f.id.task,trigger:'operator'});assert.equal(r.started,false);assert.equal(f.spawned,0);assert.ok(!f.calls.includes('begin_task_run_launch'))
})
