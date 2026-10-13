import nodeTest from 'node:test'
import {existsSync} from 'node:fs'
import {createResourceWorkerInventory} from '../src/main/resourceWorkerInventory.ts'
import {createScopedStore} from '../src/main/scopedStore.ts'
import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createResourceRunAssignmentManager,AGENT_SYNC_IDENTITY_SOURCE_SHA256} from '../src/main/resourceRunAssignment.ts'
const candidate=process.env.N028_AGENT_SYNC_SCRIPT ?? path.join(os.homedir(),'.codex/plugins/cache/agent-sync/agent-sync/1.22.2/skills/agent-sync/scripts/agent_sync.py')
const installed=existsSync(candidate)?candidate:null
const test=(name,fn)=>nodeTest(name,{skip:installed?false:'NOT_RUN: pinned installed agent-sync source unavailable; no installation attempted'},fn)
const hash=b=>createHash('sha256').update(b).digest('hex')
const pause=ms=>new Promise(r=>setTimeout(r,ms))
async function assignmentFixture(t,extra={}) {
 assert.ok(installed,'N028_AGENT_SYNC_SCRIPT must select exact pinned installed script')
 assert.equal(hash(await fs.readFile(installed)),AGENT_SYNC_IDENTITY_SOURCE_SHA256)
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'n028-test-')))
 t.after(()=>fs.rm(root,{recursive:true,force:true}))
 const repo=path.join(root,'repo'),storeRoot=path.join(root,'records');await fs.mkdir(repo);await fs.mkdir(storeRoot,{mode:0o700})
 execFileSync('git',['init','-q',repo]);execFileSync('git',['-C',repo,'-c','user.name=fixture','-c','user.email=fixture@invalid','commit','--allow-empty','-qm','fixture'])
 const manifest={selectionRevision:'selection-1',scopeMappingRevision:'scope-1',configuredKey:'lane-key',expectedHead:execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),selectedInputs:[{path:'README.md'}],mutableScope:[{path:'output.txt',state:'absent'}],bounds:{maxPaths:8,maxDepth:8,maxPathBytes:512,maxFileBytes:1024,maxTotalBytes:4096,maxMetadataBytes:65536,timeoutMs:1000,maxAgeMs:60000}}
 const manifestPath=path.join(root,'lane.json'),bytes=JSON.stringify(manifest);await fs.writeFile(manifestPath,bytes,{mode:0o600})
 const config={estateId:'estate',projectId:'project',installationId:'install',invocationId:'invocation',repositoryRoot:repo,approvedRemote:'https://fixture.invalid/repo.git',repositoryName:'repo',manifestPath,manifestSha256:hash(bytes),storageRoot:storeRoot,agentSyncScript:installed,timeoutMs:3000,maxRecords:8,maxRecordBytes:32768,maxManifestBytes:32768,...extra}
 const state={task:{id:'task',project_id:'project'},project:{id:'project',repo_path:repo},hang:null,calls:[],key:'fabric000001'}
 const store={scope:{kind:'estate',estateId:'estate'},select(table,columns){state.calls.push({table,columns});return {eq(key,value){state.calls.at(-1).filter={key,value};return {async maybeSingle(){if(state.hang) await state.hang;return {data:table==='project_tasks'?state.task:state.project,error:null}}}}}}}
 const make=(deps={},c={})=>createResourceRunAssignmentManager({...config,...c},{store,key:()=>state.key,...deps})
 return {root,repo,storeRoot,config,manifest,state,store,make,async allocate(manager=make(),sessionId='session'){const r=await manager.allocate({taskId:'task',sessionId});assert.equal(r.state,'observed',JSON.stringify(r));return {manager,...r.value}}}
}

async function fixture(t,overrides={}){
 const f=await assignmentFixture(t),manager=f.make(),allocated=await f.allocate(manager)
 const storage=path.join(f.root,'inventory');await fs.mkdir(storage,{mode:0o700})
 const manifest={schema:1,hostId:'host',poolId:'pool',localPolicyRevision:'policy',adapters:[{id:'managed',sourceSha256:'a'.repeat(64)},{id:'other',sourceSha256:'b'.repeat(64)}]},coveragePath=path.join(f.root,'coverage.json'),bytes=JSON.stringify(manifest)
 await fs.writeFile(coveragePath,bytes)
 const config={estateId:'estate',hostId:'host',poolId:'pool',localPolicyRevision:'policy',invocationId:'invocation',storageRoot:storage,coveragePath,coverageSha256:hash(bytes),timeoutMs:1000,maxRecords:8,maxRecordBytes:8192,maxCoverageBytes:8192,maxRegistryBytes:65536,...overrides}
 const host={hostInstanceId:'host',bootId:'invocation'},deps={assignments:manager,host},make=(c={},d=deps)=>createResourceWorkerInventory({...config,...c},d)
 return {...f,manager,allocated,storage,config,host,deps,manifest,make}
}
async function files(f){return (await fs.readdir(f.storage)).filter(x=>x.endsWith('.json'))}
test('actual N028 identity persists one immutable intent; exact retry preserves bytes and event',async t=>{
 const f=await fixture(t),m=f.make(),r=await m.register(f.allocated.handle,'managed');assert.equal(r.state,'recorded',JSON.stringify(r));assert.equal(r.complete,false);assert.equal(r.executionAuthorized,false)
 const names=await files(f);assert.equal(names.length,1);const before=await fs.readFile(path.join(f.storage,names[0]));const retry=await m.register(f.allocated.handle,'managed');assert.equal(retry.state,'recorded');assert.equal(retry.value.eventId,r.value.eventId);assert.equal(retry.value.recordSha256,r.value.recordSha256);assert.deepEqual(await fs.readFile(path.join(f.storage,names[0])),before)
 const read=await m.readIntent(r.value.handle);assert.equal(read.state,'recorded');assert.equal(read.value.event.assignment.attemptId,f.allocated.assignment.attemptId);assert.equal(read.value.event.runId,f.allocated.handle.runId);assert.equal((await fs.stat(path.join(f.storage,names[0]))).mode&0o777,0o600)
})
test('empty and registered pools never claim complete zero or active workers',async t=>{
 const f=await fixture(t),m=f.make(),empty=await m.snapshot();assert.equal(empty.state,'recorded');assert.equal(empty.complete,false);assert.equal(empty.value.complete,false);assert.deepEqual(empty.value.knownActive,[])
 await m.register(f.allocated.handle,'managed');const result=await m.snapshot();assert.equal(result.value.complete,false);assert.equal(result.value.unresolved[0].classification,'intent_unresolved');assert.deepEqual(result.value.knownActive,[])
})
test('foreign/copied assignment and intent handles cannot manufacture provenance',async t=>{
 const f=await fixture(t),m=f.make();assert.equal((await m.register({...f.allocated.handle},'managed')).state,'unknown');assert.deepEqual(await files(f),[])
 const r=await m.register(f.allocated.handle,'managed');assert.equal((await m.readIntent({...r.value.handle})).state,'unknown')
})
test('unknown and conflicting same-unit adapter refuse without overwriting',async t=>{
 const f=await fixture(t),m=f.make();assert.equal((await m.register(f.allocated.handle,'missing')).state,'unknown');const r=await m.register(f.allocated.handle,'managed');assert.equal((await m.register(f.allocated.handle,'other')).state,'unknown');assert.equal((await m.readIntent(r.value.handle)).state,'recorded');assert.equal((await files(f)).length,1)
})
test('prior invocation remains unresolved and cannot be registered as new or restored handle',async t=>{
 const f=await fixture(t),m=f.make(),r=await m.register(f.allocated.handle,'managed'),newHost={hostInstanceId:'host',bootId:'later'}
 const next=f.make({invocationId:'later'},{assignments:f.manager,host:newHost});const snap=await next.snapshot();assert.equal(snap.value.unresolved[0].classification,'prior_binding_unresolved');assert.equal((await next.register(f.allocated.handle,'managed')).state,'unknown');assert.equal((await next.readIntent(r.value.handle)).state,'unknown')
})
test('partial/corrupt/future events and stale lock refuse without cleanup',async t=>{
 for(const [name,bytes] of [['partial.json','{'],['unknown.json',JSON.stringify({schema:1,kind:'intent.registered'})],['.register.lock','unknown']]){
  const f=await fixture(t),m=f.make();await fs.writeFile(path.join(f.storage,name),bytes,{mode:0o600});assert.equal((await m.register(f.allocated.handle,'managed')).state,'unknown');assert.equal((await m.snapshot()).state,'unknown');assert.equal(await fs.readFile(path.join(f.storage,name),'utf8'),bytes)
 }
})
test('two managers share exclusive registration and can only retain one event',async t=>{
 const f=await fixture(t),a=f.make(),b=f.make(),r=await Promise.all([a.register(f.allocated.handle,'managed'),b.register(f.allocated.handle,'managed')]);assert.ok(r.some(x=>x.state==='recorded'));assert.equal((await files(f)).length,1)
 const again=await b.register(f.allocated.handle,'managed');assert.equal(again.state,'recorded');assert.equal((await files(f)).length,1)
})
test('membership drift after durable registration retains an unresolved intent',async t=>{
 const f=await fixture(t),m=f.make();let count=0;const original=f.store.select
 f.store.select=function(...args){const q=original.apply(this,args),eq=q.eq; q.eq=function(...a){const x=eq.apply(this,a),read=x.maybeSingle;x.maybeSingle=async()=>{const r=await read();if(++count===3){f.state.task={id:'task',project_id:'foreign'};r.data=f.state.task}return r};return x};return q}
 const r=await m.register(f.allocated.handle,'managed');assert.equal(r.state,'unknown');assert.equal((await files(f)).length,1);const snap=await m.snapshot();assert.equal(snap.value.complete,false);assert.equal(snap.value.unresolved.length,1)
})
test('coverage drift after durable write never returns usable intent',async t=>{
 const f=await fixture(t),m=f.make();let count=0;const original=f.store.select
 f.store.select=function(...args){const q=original.apply(this,args),eq=q.eq;q.eq=function(...a){const x=eq.apply(this,a),read=x.maybeSingle;x.maybeSingle=async()=>{const r=await read();if(++count===3)await fs.appendFile(f.config.coveragePath,' ');return r};return x};return q}
 assert.equal((await m.register(f.allocated.handle,'managed')).state,'unknown');assert.equal((await files(f)).length,1);assert.equal((await m.snapshot()).state,'unknown')
})
test('host or actual producer substitution during reads refuses',async t=>{
 const f=await fixture(t),m=f.make();f.host.bootId='foreign';assert.equal((await m.snapshot()).state,'unknown');f.host.bootId='invocation';f.deps.assignments={...f.manager};assert.equal((await m.register(f.allocated.handle,'managed')).state,'unknown');assert.deepEqual(await files(f),[])
})
test('timeout retains actual N028 pending membership until settlement and late outcome cannot register',async t=>{
 const f=await fixture(t,{timeoutMs:25}),m=f.make();let release;f.state.hang=new Promise(r=>release=r);const r=await m.register(f.allocated.handle,'managed');assert.equal(r.reason,'timeout');const calls=f.state.calls.length
 for(let i=0;i<30;i++)assert.equal((await m.register(f.allocated.handle,'managed')).reason,'io_outstanding');assert.equal(f.state.calls.length,calls);release();await pause(30);assert.deepEqual(await files(f),[])
})
test('event bounds and unsafe storage refuse without automatic repair',async t=>{
 const f=await fixture(t,{maxRecordBytes:10});assert.equal((await f.make().register(f.allocated.handle,'managed')).state,'unknown');assert.deepEqual(await files(f),[]);await fs.chmod(f.storage,0o755);assert.equal((await f.make().snapshot()).state,'unknown');assert.equal((await fs.stat(f.storage)).mode&0o777,0o755)
})
test('duplicate event identity and altered stored bytes refuse existing handle',async t=>{
 const f=await fixture(t),m=f.make(),r=await m.register(f.allocated.handle,'managed'),name=(await files(f))[0];await fs.appendFile(path.join(f.storage,name),' ');assert.equal((await m.readIntent(r.value.handle)).state,'unknown')
})

test('retained duplicate run or event IDs make whole registry unknown',async t=>{
 for(const kind of ['run','event']){
  const f=await fixture(t),m=f.make();await m.register(f.allocated.handle,'managed');const name=(await files(f))[0],copy=JSON.parse(await fs.readFile(path.join(f.storage,name),'utf8'))
  copy.unitId='11111111-1111-4111-8111-111111111111';copy.assignment.attemptId=copy.unitId;copy.assignment.sessionId='other'
  if(kind==='run')copy.eventId='22222222-2222-4222-8222-222222222222';else copy.runId='r-another00001'
  await fs.writeFile(path.join(f.storage,`${copy.unitId}.${copy.eventId}.json`),JSON.stringify(copy)+'\n',{mode:0o600})
  assert.equal((await m.snapshot()).state,'unknown',kind+' reuse must poison completeness of the registry read')
 }
})

test('N022 identifier constraints, aggregate bytes and record permissions remain strict',async t=>{
 const f=await fixture(t);for(const poolId of ['é','bad/path','a'.repeat(129)])assert.throws(()=>f.make({poolId}))
 assert.equal((await f.make({maxRegistryBytes:10}).register(f.allocated.handle,'managed')).state,'unknown');assert.deepEqual(await files(f),[])
 const m=f.make();await m.register(f.allocated.handle,'managed');const name=(await files(f))[0];await fs.chmod(path.join(f.storage,name),0o644);assert.equal((await m.snapshot()).state,'unknown')
})
test('host changes while post-write membership settles leave immutable evidence unknown',async t=>{
 const f=await fixture(t),m=f.make();let count=0;const original=f.store.select
 f.store.select=function(...args){const q=original.apply(this,args),eq=q.eq;q.eq=function(...a){const x=eq.apply(this,a),read=x.maybeSingle;x.maybeSingle=async()=>{const r=await read();if(++count===3)f.host.bootId='later';return r};return x};return q}
 assert.equal((await m.register(f.allocated.handle,'managed')).state,'unknown');assert.equal((await files(f)).length,1)
})

for(const failedKind of ['event','directory'])test(`exact retry reestablishes event and directory durability after ${failedKind} fsync refusal`,async t=>{
 const f=await fixture(t),m=f.make(),dummy=await fs.open(path.join(f.root,'dummy'),'w'),proto=Object.getPrototypeOf(dummy);await dummy.close();const original=proto.sync;let fail=true;const counts={event:0,directory:0}
 proto.sync=async function(){const kind=(await this.stat()).isDirectory()?'directory':'event';counts[kind]++;if(fail&&kind===failedKind){fail=false;throw Error('injected sync refusal')}return original.call(this)}
 try{assert.equal((await m.register(f.allocated.handle,'managed')).state,'unknown');const names=await files(f);assert.equal(names.length,1);const bytes=await fs.readFile(path.join(f.storage,names[0])),before={...counts};const retry=await m.register(f.allocated.handle,'managed');assert.equal(retry.state,'recorded');assert.ok(counts.event>before.event);assert.ok(counts.directory>before.directory);assert.deepEqual(await fs.readFile(path.join(f.storage,names[0])),bytes)}finally{proto.sync=original}
})

const admission=()=>({taskRunId:'11111111-1111-4111-8111-111111111111',runOrdinal:1,reservationId:'reservation',fence:1,inputDigest:'1'.repeat(64),scopeDigest:'2'.repeat(64),contentDigest:'3'.repeat(64),bindingRevision:'policy-sha256-v1:'+'4'.repeat(64)})
const processFacts=()=>({pid:123,group:123,start:'fixture-start-1'})
async function registered(t,overrides={}){const f=await fixture(t,overrides),m=f.make(),r=await m.register(f.allocated.handle,'managed');assert.equal(r.state,'recorded');return {...f,m,intent:r.value}}
test('N032 durable ordered attachments preserve exact parent digests and retry bytes without authority',async t=>{
 const f=await registered(t),a=await f.m.attachAdmission(f.intent.handle,admission());assert.equal(a.state,'recorded');assert.equal(a.value.event.parentRecordSha256,f.intent.recordSha256)
 const p=await f.m.attachProcess(f.intent.handle,processFacts());assert.equal(p.state,'recorded');assert.equal(p.value.event.parentRecordSha256,a.value.recordSha256);assert.equal(p.complete,false);assert.equal(p.executionAuthorized,false)
 assert.deepEqual(await f.m.attachAdmission(f.intent.handle,admission()),a);assert.deepEqual(await f.m.attachProcess(f.intent.handle,processFacts()),p);assert.equal((await files(f)).length,3)
 const read=await f.m.readAttachments(f.intent.handle);assert.equal(read.state,'recorded');assert.deepEqual(read.value,{admission:a.value,process:p.value});assert.equal((await f.m.readIntent(f.intent.handle)).state,'recorded')
 const snap=await f.m.snapshot();assert.equal(snap.value.unresolved.length,1);assert.equal(snap.value.complete,false);assert.deepEqual(snap.value.knownActive,[]);assert.equal(snap.value.unresolved[0].process.recordSha256,p.value.recordSha256)
})
test('N032 attachment ordering, copied handles and conflicting tuple refuse without overwrite',async t=>{
 const f=await registered(t);assert.equal((await f.m.attachProcess(f.intent.handle,processFacts())).state,'unknown');assert.equal((await f.m.attachAdmission({...f.intent.handle},admission())).state,'unknown');assert.equal((await files(f)).length,1)
 const a=await f.m.attachAdmission(f.intent.handle,admission());assert.equal(a.state,'recorded');assert.equal((await f.m.attachAdmission(f.intent.handle,{...admission(),fence:2})).state,'unknown');assert.equal((await files(f)).length,2)
 await f.m.attachProcess(f.intent.handle,processFacts());assert.equal((await f.m.attachProcess(f.intent.handle,{...processFacts(),start:'changed'})).state,'unknown');assert.equal((await files(f)).length,3)
})
test('N032 malformed counters, digest labels, process identity and accessors refuse',async t=>{
 const f=await registered(t)
 for(const value of [{...admission(),fence:0},{...admission(),runOrdinal:1.5},{...admission(),fence:Number.MAX_SAFE_INTEGER+1},{...admission(),bindingRevision:'policy'},{...admission(),inputDigest:'unknown'},Object.defineProperty(admission(),'fence',{get(){throw Error('must-not-read')}})])assert.equal((await f.m.attachAdmission(f.intent.handle,value)).state,'unknown')
 assert.equal((await files(f)).length,1);await f.m.attachAdmission(f.intent.handle,admission())
 for(const value of [{...processFacts(),pid:1},{...processFacts(),group:124},{...processFacts(),start:'\nsecret'},{...processFacts(),start:''}])assert.equal((await f.m.attachProcess(f.intent.handle,value)).state,'unknown');assert.equal((await files(f)).length,2)
})
test('N032 retained orphan, changed parent and duplicate attachment make registry unknown',async t=>{
 for(const mutate of ['orphan','parent','duplicate','binding']){
  const f=await registered(t),a=await f.m.attachAdmission(f.intent.handle,admission()),name=`${a.value.event.unitId}.${a.value.event.eventId}.json`,file=path.join(f.storage,name),e=JSON.parse(await fs.readFile(file,'utf8'))
  if(mutate==='orphan'){const base=(await files(f)).find(x=>x!==name);await fs.unlink(path.join(f.storage,base))}
  if(mutate==='parent'){e.parentRecordSha256='f'.repeat(64);await fs.writeFile(file,JSON.stringify(e))}
  if(mutate==='binding'){e.poolId='other';await fs.writeFile(file,JSON.stringify(e))}
  if(mutate==='duplicate'){e.eventId='22222222-2222-4222-8222-222222222222';await fs.writeFile(path.join(f.storage,`${e.unitId}.${e.eventId}.json`),JSON.stringify(e),{mode:0o600})}
  assert.equal((await f.m.snapshot()).state,'unknown');assert.equal((await f.m.readAttachments(f.intent.handle)).state,'unknown')
 }
})
test('N032 total-file capacity includes attachments and exact retry remains allowed at cap',async t=>{
 const f=await registered(t,{maxRecords:2});assert.equal((await f.m.attachAdmission(f.intent.handle,admission())).state,'recorded');assert.equal((await f.m.attachProcess(f.intent.handle,processFacts())).state,'unknown');assert.equal((await f.m.attachAdmission(f.intent.handle,admission())).state,'recorded');assert.equal((await files(f)).length,2)
})
test('N032 failed attachment sync cannot be upgraded by a read without fresh barriers',async t=>{
 const f=await registered(t),probe=await fs.open(path.join(f.root,'probe'),'w'),proto=Object.getPrototypeOf(probe),sync=proto.sync;await probe.close();let calls=0
 proto.sync=async function(){calls++;throw Error('fixture sync failure')}
 try{assert.equal((await f.m.attachAdmission(f.intent.handle,admission())).state,'unknown');assert.equal((await files(f)).length,2);const before=calls;assert.equal((await f.m.readAttachments(f.intent.handle)).state,'unknown');assert.ok(calls>before)}finally{proto.sync=sync}
 const good=await f.m.readAttachments(f.intent.handle);assert.equal(good.state,'recorded');assert.ok(good.value.admission);assert.equal((await files(f)).length,2)
})
test('N032 attachment membership drift after write preserves uncertain event without permission',async t=>{
 const f=await registered(t),select=f.store.select;let reads=0
 f.store.select=function(...args){const q=select.apply(this,args),eq=q.eq;q.eq=function(...a){const out=eq.apply(this,a),read=out.maybeSingle;out.maybeSingle=async()=>{if(++reads>=3)f.state.task={id:'task',project_id:'foreign'};return read()};return out};return q}
 assert.equal((await f.m.attachAdmission(f.intent.handle,admission())).state,'unknown');assert.equal((await files(f)).length,2)
})
test('N032 restart snapshot retains conservative chain but cannot restore attachment authority',async t=>{
 const f=await registered(t);await f.m.attachAdmission(f.intent.handle,admission());await f.m.attachProcess(f.intent.handle,processFacts());const later=f.make({invocationId:'later'},{assignments:f.manager,host:{hostInstanceId:'host',bootId:'later'}})
 const snap=await later.snapshot();assert.equal(snap.state,'recorded');assert.equal(snap.value.unresolved[0].classification,'prior_binding_unresolved');assert.ok(snap.value.unresolved[0].process);assert.equal(snap.complete,false);assert.equal((await later.readAttachments(f.intent.handle)).state,'unknown')
})

test('N032 new unit registration cannot exceed total files or bytes occupied by prior attachments',async t=>{
 for(const bound of ['files','bytes']){
  const f=await registered(t);await f.m.attachAdmission(f.intent.handle,admission());await f.m.attachProcess(f.intent.handle,processFacts());f.state.key='fabric000002';const next=await f.allocate(f.manager,'session-2')
  let size=0;for(const file of await files(f))size+=(await fs.stat(path.join(f.storage,file))).size
  const limited=f.make(bound==='files'?{maxRecords:3}:{maxRegistryBytes:size})
  assert.equal((await limited.register(next.handle,'managed')).state,'unknown');assert.equal((await files(f)).length,3);assert.equal((await limited.snapshot()).state,'recorded')
 }
})

test('N032 rejects cross-unit admission and exact owned-process identity collisions before writing',async t=>{
 const f=await registered(t);await f.m.attachAdmission(f.intent.handle,admission());await f.m.attachProcess(f.intent.handle,processFacts());f.state.key='fabric000002';const next=await f.allocate(f.manager,'session-2'),r=await f.m.register(next.handle,'managed');assert.equal(r.state,'recorded')
 assert.equal((await f.m.attachAdmission(r.value.handle,{...admission(),reservationId:'other'})).state,'unknown');assert.equal((await f.m.attachAdmission(r.value.handle,{...admission(),taskRunId:'22222222-2222-4222-8222-222222222222'})).state,'unknown');assert.equal((await files(f)).length,4)
 const a={...admission(),reservationId:'other',taskRunId:'22222222-2222-4222-8222-222222222222'};assert.equal((await f.m.attachAdmission(r.value.handle,a)).state,'recorded');assert.equal((await f.m.attachProcess(r.value.handle,processFacts())).state,'unknown');assert.equal((await files(f)).length,5)
 assert.equal((await f.m.attachProcess(r.value.handle,{...processFacts(),start:'later'})).state,'recorded');assert.equal((await files(f)).length,6)
})
test('N032 retained cross-unit admission collision refuses full scan despite valid parent chains',async t=>{
 const f=await registered(t);const first=await f.m.attachAdmission(f.intent.handle,admission());f.state.key='fabric000002';const next=await f.allocate(f.manager,'session-2'),r=await f.m.register(next.handle,'managed'),a=await f.m.attachAdmission(r.value.handle,{...admission(),reservationId:'other',taskRunId:'22222222-2222-4222-8222-222222222222'});assert.equal(a.state,'recorded')
 const e={...a.value.event,attachment:{...a.value.event.attachment,taskRunId:first.value.event.attachment.taskRunId}};await fs.writeFile(path.join(f.storage,`${e.unitId}.${e.eventId}.json`),JSON.stringify(e)+'\n');assert.equal((await f.m.snapshot()).state,'unknown')
})
