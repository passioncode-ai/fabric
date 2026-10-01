import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {mkdtempSync,realpathSync,readFileSync,writeFileSync,existsSync,rmSync,fstatSync,writeSync,readdirSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {createOwnedBackendProcessRegistry} from '../src/main/ownedBackendProcessRegistry.ts'
import {createProcessBoundary} from '../src/main/processBoundary.ts'
import {createProviderJsonlTransport} from '../src/main/providerJsonlTransport.ts'
import {isMeasuredRuntime,runtimeTuple} from '../src/main/runtimeAdmission.ts'
if(!isMeasuredRuntime()){console.error('NOT_RUN: unmeasured runtime for the private pipe adapter: '+JSON.stringify(runtimeTuple()));process.exit(2)}
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const estate=id(1),actor={personId:id(2),revision:1},dir=mkdtempSync(path.join(tmpdir(),'fabric-owned-backend-'))
// Under Electron main process.execPath is Electron; the backend fixture needs a real Node.
const executable=realpathSync(process.env.FABRIC_BACKEND_NODE??process.execPath),hash=createHash('sha256').update(readFileSync(executable)).digest('hex')
const script=path.join(dir,'backend.mjs'),tree=path.join(dir,'tree.mjs'),ready=path.join(dir,'tree-ready')
writeFileSync(script,`import readline from 'node:readline';\nif(process.argv[2]==='paused'){setInterval(()=>{},1000)}else{readline.createInterface({input:process.stdin}).on('line',line=>{const v=JSON.parse(line);if(v.method==='exit'){process.exit(0)}else if(v.id)process.stdout.write(JSON.stringify({id:v.id,result:{method:v.method}})+'\\n')})}\n`,{mode:0o600})
writeFileSync(tree,`import {spawn}from'node:child_process';import{writeFileSync}from'node:fs';const c=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});process.stdout.write('ready');setInterval(()=>{},1000)"],{env:{},stdio:['ignore','pipe','ignore']});c.stdout.once('data',()=>writeFileSync(process.argv[2],'ready'));setInterval(()=>{},1000)`,{mode:0o600})
const boundary=createProcessBoundary(),tracked=[],registries=[],transports=[]
const delay=ms=>new Promise(r=>setTimeout(r,ms))
const until=async(fn,label)=>{const deadline=performance.now()+4000;while(performance.now()<deadline){if(await fn())return;await delay(10)}throw Error(label)}
const stamp=fd=>{const s=fstatSync(fd,{bigint:true});return `${s.dev}/${s.ino}/${s.rdev}/${s.mode}`}
let serial=10
const admission=()=>{const n=serial++;return{admitted:true,project_id:id(3),task_id:id(n),task_run_id:id(n+1000),session_id:id(n+2000),run_ordinal:1}}
const recipe=()=>({executable,executableSha256:hash,argv:[script],cwd:dir,env:{HOME:dir}})
function fixture({launchRecipe=recipe(),root=path.join(dir,'root-'+serial++),timeoutMs=1200,overrides={},current}={}){
 mkdirSync(root,{recursive:true,mode:0o700});const state={authority:{...actor}},calls={spawn:0,write:0}
 const native={spawn:(...args)=>{calls.spawn++;const child=spawn(...args),t={child,owned:null,exited:false};tracked.push(t);child.once('exit',()=>t.exited=true);child.on('error',()=>{});return child},boundary:{...boundary,capture:async pid=>{const owned=await boundary.capture(pid);tracked.find(t=>t.child.pid===pid).owned=owned;return owned}},fdIdentity:stamp,write:(fd,bytes)=>{calls.write++;return writeSync(fd,bytes)},...overrides}
 const options={rootDir:root,estateId:estate,recipe:launchRecipe,timeoutMs,authority:()=>current?current(state):state.authority}
 const registry=createOwnedBackendProcessRegistry(options,native);registries.push(registry)
 return{registry,state,native,calls,options,root}
}
async function start(f,a=admission(),guard=async()=>true){const result=await f.registry.start(a,a.session_id,guard);assert.equal(result.state,'owned',JSON.stringify(result));return{...result,a}}
function join(f,h){const pipes=f.registry.claimStdio(h),rpc=createProviderJsonlTransport({...pipes,onNotification(){},onClosed(){f.registry.connectionLost(h)},timeoutMs:1000});transports.push(rpc);return{pipes,rpc}}
let count=0;const test=async(name,fn)=>{await fn();console.log('PASS '+name);count++}
try{
 await test('actual child stdio joins existing JSONL transport with private exact owner capability',async()=>{
  const f=fixture(),{handle}=await start(f),{rpc,pipes}=join(f,handle)
  assert.deepEqual(await rpc.request('fixture/read',{},pipes.stillOwned),{status:'reply',result:{method:'fixture/read'}})
  const s=f.registry.snapshot(handle);assert.equal(s.provider,'NOT_BOUND');assert.equal(s.physicalState,'owned');assert.equal(s.admissionFenced,false);assert.match(s.processIdentityRef,/^process:[a-f0-9]{64}$/);assert.equal(s.allDescendants,'unknown')
  assert.equal(f.calls.write,1);assert.throws(()=>f.registry.claimStdio(handle),/backend_ownership/);assert.throws(()=>f.registry.snapshot({...handle}),/backend_ownership/)
  assert(!JSON.stringify(s).includes(dir));assert(!JSON.stringify(s).includes(executable))
  rpc.close();assert.equal(f.registry.snapshot(handle).channelState,'lost')
 })
 await test('concurrent exact admission coalesces one actual spawn; consumed or changed scope cannot restart',async()=>{
  const f=fixture(),a=admission();let release,seen;const gate=new Promise(r=>release=r),entered=new Promise(r=>seen=r)
  const first=f.registry.start(a,a.session_id,async()=>{seen();return gate}),second=f.registry.start(a,a.session_id,async()=>{throw Error('duplicate guard')});assert.equal(first,second);await entered;release(true)
  const r=await first;assert.equal(r.state,'owned');assert.equal(f.calls.spawn,1)
  assert.equal((await f.registry.start(a,a.session_id,async()=>true)).reasonCode,'run_already_consumed')
  assert.equal((await f.registry.start({...a,run_ordinal:2},a.session_id,async()=>true)).reasonCode,'run_identity_conflict')
 })
 await test('beforeSpawn refusal, malformed verdict, deadline and authority changes never spawn',async()=>{
  for(const verdict of [false,{},1]){const f=fixture(),a=admission();assert.equal((await f.registry.start(a,a.session_id,async()=>verdict)).state,'refused');assert.equal(f.calls.spawn,0)}
  const f=fixture({timeoutMs:150}),a=admission();let release
  const r=await f.registry.start(a,a.session_id,()=>new Promise(resolve=>release=resolve));assert.equal(r.state,'refused');release(true);await delay(0);assert.equal(f.calls.spawn,0)
  const g=fixture(),b=admission();assert.equal((await g.registry.start(b,b.session_id,async()=>{g.state.authority.revision++;return true})).state,'refused');assert.equal(g.calls.spawn,0)
 })
 await test('reentrant authority retirement at final spawn fence cannot materialize a process',async()=>{
  let reads=0,f;f=fixture({current:state=>{if(++reads===4)f.registry.retire();return state.authority}})
  const a=admission();assert.equal((await f.registry.start(a,a.session_id,async()=>true)).state,'refused');assert.equal(f.calls.spawn,0)
  let nested,g;const b=admission();g=fixture({current:state=>{if(!nested)nested=g.registry.start(b,b.session_id,async()=>true);return state.authority}})
  const r=await start(g,b);assert.equal((await nested).state,'refused');assert.equal(g.calls.spawn,1);assert.equal(g.registry.canWrite(r.handle),true)
 })
 await test('restart markers consume old Run/session but never restore live handle or ownership',async()=>{
  const f=fixture(),{handle,a}=await start(f),g=fixture({root:f.root})
  assert.equal((await g.registry.start(a,a.session_id,async()=>true)).state,'refused');assert.equal(g.calls.spawn,0);assert.equal(g.registry.canWrite(handle),false)
  const b=admission();b.session_id=a.session_id;assert.equal((await g.registry.start(b,b.session_id,async()=>true)).state,'refused');assert.equal(g.calls.spawn,0)
  const files=readdirSync(path.join(f.root,'backend-processes',estate));assert.equal(files.length,1);const text=readFileSync(path.join(f.root,'backend-processes',estate,files[0]),'utf8');assert(!text.includes(dir));assert(!text.includes('HOME'));assert(!text.includes('physical_process_owned'))
 })
 await test('owner loss before pipe write is sticky across restored authority and sibling claims',async()=>{
  const f=fixture(),{handle}=await start(f),{pipes,rpc}=join(f,handle);f.state.authority.revision++
  assert.equal((await rpc.request('forbidden',{},pipes.stillOwned)).status,'not_sent');assert.equal(f.calls.write,0);f.state.authority={...actor};assert.equal(f.registry.canWrite(handle),false)
  const s=f.registry.snapshot(handle);assert.equal(s.channelState,'lost');assert.equal(s.physicalState,'outcome_unknown');assert.equal(s.admissionFenced,true)
 })
 await test('reentrant fd observer cannot revoke after input authority was checked',async()=>{
  let armed=false;const f=fixture({overrides:{fdIdentity:fd=>{const result=stamp(fd);if(armed){armed=false;f.state.authority.revision++}return result}}}),{handle}=await start(f),{pipes,rpc}=join(f,handle);armed=true
  assert.notEqual((await rpc.request('forbidden',{},pipes.stillOwned)).status,'reply');assert.equal(f.calls.write,0);assert(f.registry.snapshot(handle).admissionFenced)
 })
 await test('private handle getter runs before final owner check; descriptor closure after check is caught by builtin fstat',async()=>{
  let armed=false,f
  f=fixture({overrides:{spawn:(...args)=>{
   const child=spawn(...args),t={child,owned:null,exited:false};tracked.push(t);child.on('error',()=>{});child.once('exit',()=>t.exited=true)
   const original=child.stdin._handle
   Object.defineProperty(child.stdin,'_handle',{configurable:true,get(){if(armed){armed=false;f.state.authority.revision++}return original},set(){}})
   return child
  }}})
  const {handle}=await start(f),{rpc,pipes}=join(f,handle);armed=true
  assert.notEqual((await rpc.request('forbidden',{},pipes.stillOwned)).status,'reply');assert.equal(f.calls.write,0)
  // Native Node handle close is synchronous. Last authority callback closes it;
  // final builtin fstat must refuse without invoking a handle accessor again.
  let g,closeAt=0,reads=0,child
  g=fixture({current:state=>{if(closeAt&&++reads===closeAt)child.stdin._handle.close();return state.authority}})
  const b=await start(g);child=tracked.at(-1).child;const out=g.registry.claimStdio(b.handle).output;closeAt=3
  await new Promise(resolve=>out.write('x',error=>{assert(error);resolve()}));assert.equal(g.calls.write,0)
 })
 await test('backpressure is one actual pipe syscall, never a queued libuv replay after revocation',async()=>{
  const f=fixture({launchRecipe:{...recipe(),argv:[script,'paused']}}),{handle}=await start(f),pipes=f.registry.claimStdio(handle)
  await new Promise(resolve=>pipes.output.write(Buffer.alloc(1048576,65),error=>{assert(error);resolve()}))
  assert.equal(f.calls.write,1);assert.equal(pipes.output.writableLength,0);assert.equal(f.registry.snapshot(handle).physicalState,'outcome_unknown')
  f.state.authority.revision++;assert.throws(()=>pipes.output.write('never queued'),/backend_ownership/);await delay(30);assert.equal(f.calls.write,1)
 })
 await test('EAGAIN and short synchronous writes never retry or regain admission',async()=>{
  for(const kind of ['again','partial']){let writes=0;const f=fixture({overrides:{write:(fd,b)=>{writes++;if(kind==='again')throw Object.assign(Error('private secret'),{code:'EAGAIN'});return writeSync(fd,b.subarray(0,1))}}}),{handle}=await start(f),pipes=f.registry.claimStdio(handle)
   await new Promise(resolve=>pipes.output.write('abc',e=>{assert.equal(e?.message,'backend_ownership_unavailable');resolve()}));assert.equal(writes,1);assert.equal(f.registry.canWrite(handle),false);assert.throws(()=>pipes.output.write('retry'));assert.equal(writes,1)
  }
 })
 await test('cork/end and oversized writes are refused before queueing or native write',async()=>{
  for(const action of [out=>out.cork(),out=>out.end('x'),out=>out.write(Buffer.alloc(1048577))]){const f=fixture(),{handle}=await start(f),pipes=f.registry.claimStdio(handle);assert.throws(()=>action(pipes.output),/backend_ownership/);assert.equal(f.calls.write,0);assert.equal(pipes.output.writableLength,0);assert(f.registry.snapshot(handle).admissionFenced)}
 })
 await test('view process exit has no owner effect; backend exit fences and observes only its group',async()=>{
  const f=fixture(),{handle}=await start(f),{pipes,rpc}=join(f,handle)
  const view=spawn(executable,['-e','process.exit(0)'],{env:{},stdio:'ignore'});await new Promise((resolve,reject)=>{view.once('exit',resolve);view.once('error',reject)})
  assert.equal(f.registry.canWrite(handle),true);assert.equal('viewExited'in f.registry,false)
  await rpc.request('exit',{},pipes.stillOwned);await until(async()=>(await f.registry.inspect(handle)).physicalState==='exited','backend group closure')
  const s=f.registry.snapshot(handle);assert.equal(s.rootExitObserved,true);assert.equal(s.processGroup,'quiescent');assert.equal(s.provider,'NOT_BOUND');assert.equal(s.admissionFenced,true)
 })
 await test('root exit during delayed capture retains exact known child group for cleanup only',async()=>{
  const f=fixture({launchRecipe:{...recipe(),argv:[tree,ready]}}),capture=f.native.boundary.capture
  f.native.boundary.capture=async pid=>{await until(()=>existsSync(ready),'child ready');const owned=await capture(pid);process.kill(pid,'SIGTERM');await until(()=>tracked.find(t=>t.child.pid===pid).exited,'root exit');return owned}
  const a=admission(),r=await f.registry.start(a,a.session_id,async()=>true);assert.equal(r.state,'outcome_unknown');const s=await f.registry.inspect(r.handle)
  assert.equal(s.rootExitObserved,true);assert.equal(s.processGroup,'active');assert.match(s.processIdentityRef,/^process:/);assert.equal(s.admissionFenced,true)
  assert.equal((await f.registry.signalOwned(r.handle,'SIGKILL',()=>true)).sent,true)
  await until(async()=>(await f.registry.inspect(r.handle)).processGroup==='quiescent','retained exact child group cleaned')
 })
 await test('late capture after timeout never restores write but remains available for explicit cleanup',async()=>{
  const f=fixture({timeoutMs:150}),capture=f.native.boundary.capture;let release
  f.native.boundary.capture=async pid=>{const owned=await capture(pid);await new Promise(r=>release=r);return owned}
  const a=admission(),r=await f.registry.start(a,a.session_id,async()=>true);assert.equal(r.state,'outcome_unknown')
  // Under load the 150 ms timeout can fire before the native capture itself returns, so the hold
  // is not set yet when start() answers; wait for the capture to reach it instead of assuming it.
  await until(()=>typeof release==='function','late capture reached its hold');release()
  // The late capture settles on a later turn; under load one turn is not enough, so wait for it rather than assume it.
  await until(()=>/^process:/.test(f.registry.snapshot(r.handle).processIdentityRef??''),'late capture recorded its identity')
  assert.match(f.registry.snapshot(r.handle).processIdentityRef,/^process:/);assert.equal(f.registry.canWrite(r.handle),false);assert.equal((await f.registry.signalOwned(r.handle,'SIGTERM',()=>true)).sent,true)
 })
 await test('frozen recipe and authority shape validation refuse mutable or async grants',async()=>{
  const r=recipe(),f=fixture({launchRecipe:r});r.argv[0]='/not-owned';r.env.HOME='/not-owned';const {handle}=await start(f);assert.equal(f.registry.canWrite(handle),true)
  assert.throws(()=>fixture({launchRecipe:{...recipe(),executableSha256:'a'.repeat(64)}}),/backend_ownership/)
  const g=fixture({current:()=>Promise.reject(Error('private'))}),a=admission();assert.equal((await g.registry.start(a,a.session_id,async()=>true)).state,'refused');assert.equal(g.calls.spawn,0)
  const b=admission();b.session_id={toLowerCase(){throw Error('must not call')}};assert.equal((await f.registry.start(b,id(2),async()=>true)).state,'refused')
 })
 await test('connection loss/retirement deny all writes; signal requires exact private handle and literal current grant',async()=>{
  const f=fixture(),{handle}=await start(f);f.registry.connectionLost(handle);assert.equal(f.registry.canWrite(handle),false)
  assert.equal((await f.registry.signalOwned(handle,'SIGTERM',()=>Promise.resolve(true))).sent,false)
  await assert.rejects(f.registry.signalOwned({...handle},'SIGTERM',()=>true),/backend_ownership/)
  f.registry.retire();assert.equal((await f.registry.signalOwned(handle,'SIGTERM',()=>true)).sent,true);const a=admission();assert.equal((await f.registry.start(a,a.session_id,async()=>true)).state,'refused')
 })
 await test('lifetime tombstone capacity refuses safely across host restart without pruning history',async()=>{
  const f=fixture(),folder=path.join(f.root,'backend-processes',estate)
  for(let i=0;i<128;i++){const a=admission(),run={estateId:estate,projectId:a.project_id,taskId:a.task_id,runId:a.task_run_id,runOrdinal:1,sessionId:a.session_id};writeFileSync(path.join(folder,run.runId+'.json'),JSON.stringify({schema:'BackendSpawnIntent@1',run,ownerId:id(7000+i),channelEpoch:id(8000+i)}),{mode:0o600})}
  const g=fixture({root:f.root}),a=admission();assert.equal((await g.registry.start(a,a.session_id,async()=>true)).state,'refused');assert.equal(g.calls.spawn,0);assert.equal(readdirSync(folder).length,128)
 })
 console.log(`PASS ${count} actual owned native process registry groups; ${runtimeTuple().runtime} ${process.versions.electron??''} Node ${process.versions.node}; provider NOT_BOUND`)
}finally{
 for(const rpc of transports)rpc.close();for(const registry of registries)registry.retire()
 let clean=true
 for(const t of tracked){try{if(!t.owned&&!t.exited)t.owned=await boundary.capture(t.child.pid);if(t.owned){await boundary.signal(t.owned,'SIGKILL');await until(async()=>(await boundary.observe(t.owned,t.exited)).state==='quiescent','own process cleanup')}else if(!t.exited)clean=false;t.child.stdout.destroy();t.child.stdin.destroy();t.child.stderr.destroy()}catch{clean=false}}
 if(clean){rmSync(dir,{recursive:true,force:true});console.log('PASS cleanup: owned groups empty; fixture removed')}else{console.error('FAIL cleanup uncertain; fixture retained');process.exitCode=1}
}
