import nodeTest from 'node:test'
import {existsSync} from 'node:fs'
const sourceURL=new URL(process.env.N031_SOURCE)
const {createResourceWorkerInventory}=await import(sourceURL)
const {createScopedStore}=await import(new URL('./scopedStore.ts',sourceURL))
import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const {createResourceRunAssignmentManager,AGENT_SYNC_IDENTITY_SOURCE_SHA256}=await import(new URL('./resourceRunAssignment.ts',sourceURL))
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
 const state={task:{id:'task',project_id:'project'},project:{id:'project',repo_path:repo},hang:null,calls:[]}
 const store={scope:{kind:'estate',estateId:'estate'},select(table,columns){state.calls.push({table,columns});return {eq(key,value){state.calls.at(-1).filter={key,value};return {async maybeSingle(){if(state.hang) await state.hang;return {data:table==='project_tasks'?state.task:state.project,error:null}}}}}}}
 const make=(deps={},c={})=>createResourceRunAssignmentManager({...config,...c},{store,key:()=> 'fabric000001',...deps})
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

test('retry must establish durable receipt after prior event fsync failure',async t=>{
 const f=await fixture(t),m=f.make();const dummy=await fs.open(path.join(f.root,'dummy'),'w'),proto=Object.getPrototypeOf(dummy);await dummy.close();
 const original=proto.sync;let calls=0,fail=true;
 proto.sync=async function(){calls++;if(fail){fail=false;throw Error('injected sync refusal')}return original.call(this)};
 try {
  const first=await m.register(f.allocated.handle,'managed');assert.equal(first.state,'unknown');assert.equal((await files(f)).length,1);
  const priorCalls=calls;const second=await m.register(f.allocated.handle,'managed');assert.equal(second.state,'recorded');
  assert.ok(calls>=priorCalls+2,'retry success must sync retained event and directory after failed first durability barrier');
 } finally{proto.sync=original}
})
