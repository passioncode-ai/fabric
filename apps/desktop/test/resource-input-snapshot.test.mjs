import assert from 'node:assert/strict'
import {test} from 'node:test'
import * as fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createResourceInputSnapshotReader} from '../src/main/resourceInputSnapshot.ts'
const exec=promisify(execFile)
const identity={estateId:'estate',projectId:'project',taskId:'task',sessionId:'session',attemptId:'attempt'}
async function repo(t){
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'fabric-input-test-')))
 t.after(()=>fs.rm(root,{recursive:true,force:true}))
 const git=async args=>(await exec('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false',...args],{cwd:root,env:{...process.env,GIT_CONFIG_NOSYSTEM:'1'}})).stdout
 await git(['init','-q']);await fs.mkdir(path.join(root,'src'));await fs.writeFile(path.join(root,'src/a.txt'),Buffer.from([0,255,128,65]));await fs.writeFile(path.join(root,'src/b.txt'),'second');await fs.writeFile(path.join(root,'.gitignore'),'ignored\n')
 await git(['add','.']);await git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture'])
 const assignment={...identity,selectionRevision:'selection-v1',repository:{approvedRoot:root,approvedRemoteDigest:'a'.repeat(64),expectedHead:(await git(['rev-parse','HEAD'])).trim()},selectedInputs:[{path:'src/a.txt'}],mutableScope:[{path:'src/a.txt',state:'file'},{path:'future/new.txt',state:'absent'}],bounds:{maxPaths:10,maxDepth:8,maxPathBytes:256,maxFileBytes:1024,maxTotalBytes:2048,maxMetadataBytes:16384,timeoutMs:3000,maxAgeMs:10000}}
 const deps={identity:()=>({...identity}),now:()=>1000}
 return {root,git,assignment,deps,reader:(change={})=>createResourceInputSnapshotReader(assignment,{...deps,...change})}
}
test('actual binary bytes, explicit absence, immutable assignment and same-instance currentness',async t=>{
 const f=await repo(t),reader=f.reader();const first=await reader.capture();assert.equal(first.state,'observed');assert.equal(first.executionAuthorized,false);assert.equal(first.selectionComplete,false);assert.equal(first.lease.state,'not_requested');assert.ok(Object.isFrozen(first)&&Object.isFrozen(first.identity))
 assert.equal((await reader.current(first)).state,'same');assert.equal((await reader.current({...first})).reason,'foreign_receipt')
 f.assignment.taskId='other';f.assignment.selectedInputs[0].path='src/b.txt'
 assert.equal((await reader.current(first)).state,'same')
 await fs.writeFile(path.join(f.root,'src/a.txt'),Buffer.from([0,254,128,65]));assert.equal((await reader.current(first)).state,'changed')
})
test('unrelated untracked bytes do not widen selected closure',async t=>{
 const f=await repo(t),r=f.reader(),first=await r.capture();await fs.writeFile(path.join(f.root,'unrelated'),'not selected');assert.equal((await r.current(first)).state,'same')
})
test('selected absent path creation and missing parent creation invalidate capture',async t=>{
 const f=await repo(t),r=f.reader(),first=await r.capture();await fs.mkdir(path.join(f.root,'future'));await fs.writeFile(path.join(f.root,'future/new.txt'),'new');assert.equal((await r.current(first)).state,'changed')
})
for(const allow of [false,true])test(`selected untracked is explicitly ${allow?'allowed and hashed':'refused'}`,async t=>{
 const f=await repo(t);await fs.writeFile(path.join(f.root,'untracked'),'bytes');f.assignment.selectedInputs=[{path:'untracked',...(allow?{allowUntracked:true}:{})}];f.assignment.mutableScope=[]
 const r=f.reader(),first=await r.capture();assert.equal(first.state,allow?'observed':'refused')
 if(allow){await fs.writeFile(path.join(f.root,'untracked'),'other');assert.equal((await r.current(first)).state,'changed')}
})
test('ignored input cannot be allowed through untracked override',async t=>{
 const f=await repo(t);await fs.writeFile(path.join(f.root,'ignored'),'secret-like synthetic');f.assignment.selectedInputs=[{path:'ignored',allowUntracked:true}];f.assignment.mutableScope=[]
 assert.equal((await f.reader().capture()).reason,'ignored_input')
})
for(const name of ['/escape','../escape','src/../a.txt','src//a.txt','src/./a.txt','.git/config','src/.GIT/config','src\\a.txt'])test(`unsafe selection path refused ${name}`,async t=>{
 const f=await repo(t);f.assignment.selectedInputs=[{path:name}];assert.throws(()=>f.reader())
})
test('hardlink aliases and duplicate selections refuse',async t=>{
 const f=await repo(t);f.assignment.selectedInputs.push({path:'src/a.txt'});assert.throws(()=>f.reader());f.assignment.selectedInputs.pop()
 await fs.link(path.join(f.root,'src/a.txt'),path.join(f.root,'alias'));f.assignment.selectedInputs.push({path:'alias',allowUntracked:true});assert.equal((await f.reader().capture()).reason,'file_alias')
})
test('symlink final or parent cannot escape selected root including absent path',async t=>{
 const f=await repo(t);await fs.unlink(path.join(f.root,'src/a.txt'));await fs.symlink('/etc/passwd',path.join(f.root,'src/a.txt'));assert.equal((await f.reader().capture()).reason,'symlink')
 await fs.unlink(path.join(f.root,'src/a.txt'));await fs.writeFile(path.join(f.root,'src/a.txt'),'again');await fs.symlink('/tmp',path.join(f.root,'future'));assert.equal((await f.reader().capture()).reason,'symlink')
})
test('FIFO is refused before open and submodule entries refuse',async t=>{
 const f=await repo(t);await fs.unlink(path.join(f.root,'src/a.txt'));await exec('mkfifo',[path.join(f.root,'src/a.txt')]);let opened=0
 assert.equal((await f.reader({fs:{...fs,open:async(...args)=>{opened++;return fs.open(...args)}}}).capture()).reason,'special_file');assert.equal(opened,0)
 await fs.unlink(path.join(f.root,'src/a.txt'));await fs.writeFile(path.join(f.root,'src/a.txt'),'file')
 await f.git(['update-index','--add','--cacheinfo',`160000,${f.assignment.repository.expectedHead},module`]);f.assignment.mutableScope.push({path:'module/new',state:'absent'});assert.equal((await f.reader().capture()).reason,'submodule')
})
for(const kind of ['HEAD','index'])test(`${kind} change invalidates previous selected snapshot`,async t=>{
 const f=await repo(t),r=f.reader(),first=await r.capture()
 if(kind==='HEAD')await f.git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-qm','new'])
 else{await fs.writeFile(path.join(f.root,'src/b.txt'),'other');await f.git(['add','src/b.txt'])}
 assert.equal((await r.current(first)).state,'changed')
})
test('actual byte limits include multibyte data and growth after stat is capped',async t=>{
 const f=await repo(t);await fs.writeFile(path.join(f.root,'src/a.txt'),'€€');f.assignment.bounds.maxFileBytes=5;assert.equal((await f.reader().capture()).reason,'byte_budget')
 await fs.writeFile(path.join(f.root,'src/a.txt'),'a');f.assignment.bounds.maxFileBytes=4
 let reads=0,maxBuffer=0
 const injected={...fs,open:async(...args)=>{const h=await fs.open(...args);let grew=false;return {stat:(...a)=>h.stat(...a),close:()=>h.close(),read:async(buffer,...a)=>{reads++;maxBuffer=Math.max(maxBuffer,buffer.length);if(!grew){grew=true;await fs.appendFile(path.join(f.root,'src/a.txt'),'123456789')}return h.read(buffer,...a)}}}}
 assert.equal((await f.reader({fs:injected}).capture()).reason,'byte_budget');assert.equal(reads,1);assert.ok(maxBuffer<=5)
})
test('same-size modification after an earlier file was read invalidates whole snapshot',async t=>{
 const f=await repo(t);f.assignment.selectedInputs.push({path:'src/b.txt'});let changed=false
 const injected={...fs,open:async(...args)=>{if(args[0].endsWith('/b.txt')&&!changed){changed=true;await fs.writeFile(path.join(f.root,'src/a.txt'),Buffer.from([1,2,3,4]))}return fs.open(...args)}}
 assert.equal((await f.reader({fs:injected}).capture()).reason,'file_changed')
})
test('root/parent replacement after read is refused',async t=>{
 const f=await repo(t);let moved=false
 const injected={...fs,open:async(...args)=>{const h=await fs.open(...args);return {stat:(...a)=>h.stat(...a),read:(...a)=>h.read(...a),close:async()=>{await h.close();if(!moved){moved=true;await fs.rename(path.join(f.root,'src'),path.join(f.root,'old'));await fs.mkdir(path.join(f.root,'src'));await fs.copyFile(path.join(f.root,'old/a.txt'),path.join(f.root,'src/a.txt'))}}}}}
 assert.notEqual((await f.reader({fs:injected}).capture()).state,'observed')
})
test('independent identity is read before and after, changed identity refuses',async t=>{
 const f=await repo(t);let calls=0
 const result=await f.reader({identity:()=>{calls++;return {...identity,...(calls>1?{sessionId:'other'}:{})}}}).capture()
 assert.equal(result.reason,'identity_changed');assert.equal(calls,2)
})
test('ordinary async clock rejection is consumed and clock rollback unknown',async t=>{
 const f=await repo(t);assert.equal((await f.reader({now:()=>Promise.reject(Error('synthetic'))}).capture()).state,'unknown');await new Promise(r=>setImmediate(r))
 let n=1000;assert.equal((await f.reader({now:()=>n--}).capture()).reason,'clock_changed')
})
test('timeout retains actual unresolved I/O through repeated calls and ignores late progress',async t=>{
 const f=await repo(t);f.assignment.bounds.timeoutMs=15;let finish,calls=0
 const reader=f.reader({identity:()=>{calls++;return new Promise(r=>finish=r)}})
 assert.equal((await reader.capture()).state,'unknown');for(let i=0;i<20;i++)assert.equal((await reader.capture()).reason,'io_outstanding');assert.equal(calls,1)
 finish({...identity});await new Promise(r=>setTimeout(r,5));assert.equal(calls,1)
 const again=reader.capture();await new Promise(r=>setImmediate(r));assert.equal(calls,2);finish({...identity});await again
})
test('configured lease refreshes twice, exact binding and expiry checked without ownership grant',async t=>{
 const f=await repo(t);f.assignment.lease={configuredKey:'scope:key',expectedRunId:'run',expectedTip:'b'.repeat(40),repositoryName:'repo',scopeMappingRevision:'mapping-v1'}
 const proof={status:'observed',remoteDigest:'a'.repeat(64),key:'scope:key',runId:'run',repositoryName:'repo',tip:'b'.repeat(40),observedAt:999,leaseUpdatedAt:900,expiresAt:2000,executionAuthorized:false};let calls=0
 const first=await f.reader({lease:()=>{calls++;return {...proof}}}).capture();assert.equal(first.state,'observed');assert.equal(first.lease.state,'observed');assert.equal(calls,2);assert.equal(first.executionAuthorized,false)
 for(const key of ['remoteDigest','key','runId','repositoryName','tip'])assert.notEqual((await f.reader({lease:()=>({...proof,[key]:'foreign'})}).capture()).state,'observed')
 let checks=0;assert.equal((await f.reader({lease:()=>({...proof,...(++checks===2?{expiresAt:1000}:{})})}).capture()).reason,'lease_stale')
 const absent=await f.reader().capture();assert.equal(absent.state,'unknown');assert.equal(absent.lease.state,'unavailable')
})
for(const flag of ['--assume-unchanged','--skip-worktree'])test(`index flag ${flag} invalidates selected snapshot`,async t=>{
 const f=await repo(t),r=f.reader(),first=await r.capture();assert.equal(first.state,'observed')
 await f.git(['update-index',flag,'src/a.txt']);assert.equal((await r.current(first)).state,'changed')
})
test('approved root must be actual Git worktree root, not a nested directory',async t=>{
 const f=await repo(t);f.assignment.repository.approvedRoot=path.join(f.root,'src');f.assignment.selectedInputs=[{path:'a.txt'}];f.assignment.mutableScope=[]
 assert.equal((await f.reader().capture()).state,'refused')
})
test('creation of formerly missing intermediate parent during snapshot is unknown',async t=>{
 const f=await repo(t);f.assignment.selectedInputs.push({path:'src/b.txt'});let changed=false
 const injected={...fs,open:async(...args)=>{if(args[0].endsWith('/b.txt')&&!changed){changed=true;await fs.mkdir(path.join(f.root,'future'))}return fs.open(...args)}}
 assert.equal((await f.reader({fs:injected}).capture()).reason,'absent_parent_changed')
})
test('metadata output replacement character or over-budget output cannot produce a snapshot',async t=>{
 const f=await repo(t)
 for(const stdout of ['\uFFFD','x'.repeat(f.assignment.bounds.maxMetadataBytes+1)])assert.notEqual((await f.reader({git:async()=>({code:0,stdout})}).capture()).state,'observed')
})
