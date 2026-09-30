import assert from 'node:assert/strict'
import {createRequire}from'node:module'
import {createHash}from'node:crypto'
import {mkdtempSync,readFileSync,realpathSync,writeFileSync,rmSync,fstatSync,writeSync}from'node:fs'
import {tmpdir}from'node:os'
import path from'node:path'
import {createNativeViewHost}from'../src/main/nativeViewHost.ts'
import {createProcessBoundary}from'../src/main/processBoundary.ts'
const require=createRequire(import.meta.url),pty=require('node-pty'),version=require('node-pty/package.json').version
if(process.platform!=='darwin'){console.error('NOT_RUN: this private-fd adapter currently requires macOS');process.exit(2)}
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const owner=()=>({fabric:{estateId:id(1),projectId:id(2),taskId:id(3),runId:id(4),runOrdinal:1,sessionId:id(5)},authority:{personId:id(6),revision:1},backend:{ownerId:'backend-owned',hostInstanceId:'host-one',bootId:'boot-one',connectionId:'connection-one',processIdentityRef:'process:'+'a'.repeat(64)}})
const dir=mkdtempSync(path.join(tmpdir(),'fabric-view-host-')),python=realpathSync('/usr/bin/python3'),hash=createHash('sha256').update(readFileSync(python)).digest('hex')
const fixtureCode=`import os,sys,tty,signal,time\ntty.setraw(0)\nos.write(1,b'READY\\n')\nwhile True:\n data=os.read(0,1024)\n if data==b'exit\\n': break\n os.write(1,b'SEEN:'+data+b'\\n')\n`
const childCode=`import os,sys,tty,signal,time\ntty.setraw(0)\nchild=os.fork()\nif child==0:\n signal.signal(signal.SIGTERM,signal.SIG_IGN)\n signal.signal(signal.SIGHUP,signal.SIG_IGN)\n os.write(1,b'CHILD_READY\\n')\n while True: time.sleep(1)\nelse:\n os.write(1,b'READY\\n')\n while True: time.sleep(1)\n`
const script=path.join(dir,'view.py'),childScript=path.join(dir,'child.py');writeFileSync(script,fixtureCode,{mode:0o600});writeFileSync(childScript,childCode,{mode:0o600})
const boundary=createProcessBoundary(),tracked=[],hosts=[]
const delay=ms=>new Promise(r=>setTimeout(r,ms))
const until=async(fn,label)=>{const end=performance.now()+4000;while(performance.now()<end){if(await fn())return;await delay(10)}throw Error(label)}
const recipe=()=>({executable:python,executableSha256:hash,argv:[script],cwd:dir,env:{PATH:'/usr/bin:/bin',HOME:dir,PYTHONUNBUFFERED:'1'},cols:80,rows:24})
const stamp=fd=>{const s=fstatSync(fd);return `${s.dev}/${s.ino}/${s.rdev}/${s.mode}`}
function fixture({recipe:provided=recipe(),system:overrides={},current}={}){
 const observed=[],output=[],nativeCalls={spawn:0,write:0},state={owner:owner()}
 const native={load:()=>({version,spawn:(...args)=>{nativeCalls.spawn++;const h=pty.spawn(...args);const t={h,owned:null,exited:false};tracked.push(t);h.onExit(()=>t.exited=true);return h}}),fdIdentity:stamp,write:(fd,b)=>{nativeCalls.write++;return writeSync(fd,b)},boundary:{...boundary,capture:async pid=>{const o=await boundary.capture(pid);tracked.find(x=>x.h.pid===pid).owned=o;return o}},...overrides}
 const host=createNativeViewHost({owner:state.owner,currentOwner:()=>current?current(state,host):state.owner,recipe:provided,timeoutMs:600,onOutput:(t,data,cursor)=>output.push({t,data,cursor}),onObservation:(t,s)=>observed.push(s)},native)
 hosts.push(host);return{host,state,native,nativeCalls,output,observed}
}
let count=0;const test=async(name,fn)=>{await fn();console.log('PASS '+name);count++}
try{
 await test('actual private PTY attach/write/output and natural root+group closure never stops backend',async()=>{
  const f=fixture(),a=await f.host.lifecycle.attach('first');assert.equal(a.state,'attached');await until(()=>f.output.some(x=>x.data.includes('READY')),'native ready')
  assert.equal((await f.host.lifecycle.write(a.ticket,'hello\n')).state,'attached');await until(()=>f.output.some(x=>x.data.includes('SEEN:hello')),'native written bytes')
  assert.equal(f.nativeCalls.write,1);assert.equal((await f.host.lifecycle.write(a.ticket,'exit\n')).state,'attached')
  await until(()=>f.host.snapshot().views[0].processGroup==='quiescent','root exit+group closure');const snapshot=f.host.snapshot();assert.equal(snapshot.views[0].rootExitObserved,true);assert.equal(snapshot.views[0].allDescendants,'unknown');assert.equal(snapshot.owner.state,'connected');assert.equal(snapshot.owner.views[0].state,'exited')
  assert.equal('viewExited'in f.host.lifecycle,false);assert.equal('acceptOutput'in f.host.lifecycle,false);assert(!JSON.stringify(snapshot).includes('hello'));assert(!JSON.stringify(snapshot).includes(python));assert(!JSON.stringify(snapshot).includes(dir))
 })
 await test('observed view closure permits new exact epoch; stale ticket cannot write or close replacement',async()=>{
  const f=fixture(),a=await f.host.lifecycle.attach('window');assert.equal(a.state,'attached');const closed=await f.host.lifecycle.detach(a.ticket);assert.equal(closed.state,'exited')
  const b=await f.host.lifecycle.reconnect(a.ticket);assert.equal(b.state,'attached');assert.notEqual(a.ticket.attachment,b.ticket.attachment)
  const before=f.nativeCalls.write;assert.notEqual((await f.host.lifecycle.write(a.ticket,'stale')).state,'attached');await f.host.lifecycle.detach(a.ticket);assert.equal(f.nativeCalls.write,before);assert.equal(f.host.snapshot().views[1].rootExitObserved,false)
  assert.equal((await f.host.lifecycle.detach(b.ticket)).state,'exited')
 })
 await test('lost owner prevents actual PTY write but exact local compensation still closes view only',async()=>{
  const f=fixture(),a=await f.host.lifecycle.attach('window');assert.equal(a.state,'attached');f.state.owner={...f.state.owner,backend:{...f.state.owner.backend,connectionId:'new-connection'}}
  await f.host.lifecycle.write(a.ticket,'forbidden');assert.equal(f.nativeCalls.write,0);assert(f.host.lifecycle.isAdmissionFenced());const closed=await f.host.lifecycle.detach(a.ticket);assert.equal(closed.state,'exited');assert.equal(f.host.snapshot().owner.state,'outcome_unknown')
 })
 await test('partial actual syscall is unknown owner-wide and never internally retried',async()=>{
  let writes=0;const f=fixture({system:{write:(fd,b)=>{writes++;return writeSync(fd,b.subarray(0,1))}}}),a=await f.host.lifecycle.attach('window');assert.equal(a.state,'attached')
  assert.equal((await f.host.lifecycle.write(a.ticket,'hello')).state,'outcome_unknown');assert(f.host.lifecycle.isAdmissionFenced());await f.host.lifecycle.write(a.ticket,'retry');assert.equal(writes,1);await f.host.lifecycle.detach(a.ticket)
 })
 await test('fd identity is rechecked after reentrant authority fence; recycled descriptor is not written',async()=>{
  let changed=false,writes=0,arm=false
  const f=fixture({current:(state)=>{if(arm){changed=true;arm=false}return state.owner},system:{fdIdentity:fd=>changed?'recycled':stamp(fd),write:()=>{writes++;return 1}}}),a=await f.host.lifecycle.attach('window');assert.equal(a.state,'attached');arm=true
  await f.host.lifecycle.write(a.ticket,'x');assert.equal(writes,0);assert(f.host.lifecycle.isAdmissionFenced());await f.host.lifecycle.detach(a.ticket)
 })
 await test('immutable trusted recipe survives caller mutation; executable hash mismatch blocks spawn',async()=>{
  const r=recipe(),f=fixture({recipe:r});r.argv[0]='/not-owned';r.env.PATH='/not-owned';r.executable='/not-owned'
  const a=await f.host.lifecycle.attach('window');assert.equal(a.state,'attached');await f.host.lifecycle.detach(a.ticket)
  assert.throws(()=>fixture({recipe:{...recipe(),executableSha256:'0'.repeat(64)}}),/^Error: native_view_unavailable$/)
  assert.throws(()=>fixture({system:{load:()=>({version:'0.0.0',spawn:()=>{throw Error('must not spawn')}})}}),/^Error: native_view_unavailable$/)
  let getter=false;const invalid=recipe();Object.defineProperty(invalid.argv,'0',{get(){getter=true;return script}});assert.throws(()=>fixture({recipe:invalid}),/^Error: native_view_unavailable$/);assert.equal(getter,false)
 })
 await test('root exit with TERM-ignoring descendant stays unresolved and never fabricates group closure',async()=>{
  const f=fixture({recipe:{...recipe(),argv:[childScript]}}),a=await f.host.lifecycle.attach('tree');assert.equal(a.state,'attached');await until(()=>f.output.some(x=>x.data.includes('CHILD_READY')),'descendant ready')
  const result=await f.host.lifecycle.detach(a.ticket);assert.equal(result.state,'outcome_unknown');const s=f.host.snapshot();assert.equal(s.views[0].rootExitObserved,true);assert.notEqual(s.views[0].processGroup,'quiescent');assert.equal(s.owner.state,'outcome_unknown');assert.equal(s.views[0].allDescendants,'unknown')
 })
 await test('whole-ticket foreign owner and input limits never reach native write',async()=>{
  const f=fixture(),a=await f.host.lifecycle.attach('window');assert.equal(a.state,'attached');const foreign={...a.ticket,owner:{...a.ticket.owner,fabric:{...a.ticket.owner.fabric,runOrdinal:2}}}
  await assert.rejects(f.host.lifecycle.write(foreign,'x'),/unknown_view/);await f.host.lifecycle.write(a.ticket,'x'.repeat(65537));assert.equal(f.nativeCalls.write,0);await f.host.lifecycle.detach(a.ticket)
 })
 await test('same view attach coalesces actual spawn; authority loss during process capture compensates only its own group',async()=>{
  const f=fixture();let release,started;const paused=new Promise(r=>release=r),seen=new Promise(r=>started=r),capture=f.native.boundary.capture
  f.native.boundary.capture=async pid=>{const owned=await capture(pid);started();await paused;return owned}
  const first=f.host.lifecycle.attach('window'),second=f.host.lifecycle.attach('window');await seen
  assert.equal(f.nativeCalls.spawn,1);f.state.owner={...f.state.owner,authority:{...f.state.owner.authority,revision:2}};release()
  const a=await first,b=await second;assert.deepEqual(a,b);assert.notEqual(a.state,'attached');await until(()=>f.host.snapshot().views[0].processGroup==='quiescent','late capture cleanup');assert(f.host.lifecycle.isAdmissionFenced())
 })
 await test('EAGAIN does not retry or queue bytes, even after the view closes',async()=>{
  let calls=0;const f=fixture({system:{write:()=>{calls++;throw Object.assign(Error('private'),{code:'EAGAIN'})}}}),a=await f.host.lifecycle.attach('window');assert.equal(a.state,'attached')
  await f.host.lifecycle.write(a.ticket,'no replay');assert.equal(calls,1);assert(f.host.lifecycle.isAdmissionFenced());await f.host.lifecycle.detach(a.ticket);assert.equal(calls,1)
 })
 await test('missing private fd ABI fails closed after tracking process and still compensates exact group',async()=>{
  const f=fixture(),load=f.native.load
  f.native.load=()=>{throw Error('load is already frozen')}
  // New factory: privileged fault injection wraps an actual spawned PTY.
  const native={...f.native,load:()=>{const a=load();return{version:a.version,spawn:(...args)=>{const h=a.spawn(...args);return{pid:h.pid,fd:undefined,on:h.on.bind(h),onData:h.onData.bind(h),onExit:h.onExit.bind(h)}}}}}
  const host=createNativeViewHost({owner:owner(),currentOwner:owner,recipe:recipe(),timeoutMs:600},native);hosts.push(host)
  const a=await host.lifecycle.attach('missing-fd');assert.notEqual(a.state,'attached');await until(()=>host.snapshot().views[0].processGroup==='quiescent','missing ABI group cleanup');assert.equal(f.nativeCalls.write,0)
 })
 await test('native spawn throw after materialization fences owner; never invents no-process or retries',async()=>{
  const f=fixture(),load=f.native.load;let calls=0
  const native={...f.native,load:()=>{const a=load();return{version:a.version,spawn:(...args)=>{calls++;a.spawn(...args);throw Error('post-fork private failure')}}}}
  const host=createNativeViewHost({owner:owner(),currentOwner:owner,recipe:recipe(),timeoutMs:600},native);hosts.push(host)
  assert.equal((await host.lifecycle.attach('unconfirmed')).state,'outcome_unknown');assert(host.lifecycle.isAdmissionFenced());await assert.rejects(host.lifecycle.attach('another'),/owner_fenced/);assert.equal(calls,1)
 })
 await test('reentrant fd inspection cannot change authority after the final input fence',async()=>{
  let f,armed=false,writes=0
  f=fixture({system:{fdIdentity:fd=>{const value=stamp(fd);if(armed){armed=false;f.state.owner={...f.state.owner,authority:{...f.state.owner.authority,revision:2}}}return value},write:()=>{writes++;return 1}}})
  const a=await f.host.lifecycle.attach('window');assert.equal(a.state,'attached');armed=true;await f.host.lifecycle.write(a.ticket,'x');assert.equal(writes,0);assert(f.host.lifecycle.isAdmissionFenced());await f.host.lifecycle.detach(a.ticket)
 })
 await test('slow fd inspection cannot authorize input after operation deadline',async()=>{
  let armed=false,writes=0
  const f=fixture({system:{fdIdentity:fd=>{const value=stamp(fd);if(armed){armed=false;const until=performance.now()+650;while(performance.now()<until){}}return value},write:()=>{writes++;return 1}}})
  const a=await f.host.lifecycle.attach('window');assert.equal(a.state,'attached');armed=true;await f.host.lifecycle.write(a.ticket,'x');assert.equal(writes,0);assert(f.host.lifecycle.isAdmissionFenced());await f.host.lifecycle.detach(a.ticket)
 })
 console.log(`PASS ${count} concrete native view host groups; actual node-pty ${version}, disposable no-model local processes only`)
}finally{
 let clean=true
 for(const t of tracked){try{if(!t.owned&&!t.exited)t.owned=await boundary.capture(t.h.pid);if(t.owned){await boundary.signal(t.owned,'SIGKILL');await until(async()=>{const v=await boundary.observe(t.owned,t.exited);return v.state==='quiescent'},'owned test process cleanup')}else if(!t.exited)clean=false}catch{clean=false}}
 if(clean){rmSync(dir,{recursive:true,force:true});console.log('PASS cleanup: owned roots/groups observed empty; temporary fixture removed')}else{console.error('FAIL cleanup uncertain; fixture retained');process.exitCode=1}
}
