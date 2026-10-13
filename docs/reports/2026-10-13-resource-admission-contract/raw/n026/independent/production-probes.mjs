import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,realpath,writeFile,rm,mkdir,symlink,rename} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
const {createResourceInputSnapshotReader}=await import(pathToFileURL(process.env.N026_SOURCE).href)
const identity={estateId:'estate',projectId:'project',taskId:'task',sessionId:'session',attemptId:'attempt'}
async function fixture(t){
 const root=await realpath(await mkdtemp(path.join(tmpdir(),'n026-independent-')));t.after(()=>rm(root,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',['-c','user.name=fixture','-c','user.email=fixture@example.invalid',...args],{cwd:root,encoding:'utf8'}).trim();
 git('init','--quiet');await mkdir(path.join(root,'src'));await writeFile(path.join(root,'src/input.bin'),Buffer.from([0,255,254,13,10]));git('add','.');git('commit','-qm','fixture');
 const assignment={...identity,selectionRevision:'v1',repository:{approvedRoot:root,approvedRemoteDigest:'a'.repeat(64),expectedHead:git('rev-parse','HEAD')},selectedInputs:[{path:'src/input.bin'}],mutableScope:[{path:'new/absent.txt',state:'absent'}],bounds:{maxPaths:8,maxDepth:8,maxPathBytes:512,maxFileBytes:1024,maxTotalBytes:4096,maxMetadataBytes:65536,timeoutMs:3000,maxAgeMs:60000}};
 return {root,git,assignment,reader:(a=assignment,d={})=>createResourceInputSnapshotReader(a,{identity:()=>({...identity}),...d})}
}
test('actual raw binary mutation invalidates snapshot',async t=>{const f=await fixture(t),r=f.reader(),old=await r.capture();assert.equal(old.state,'observed');await writeFile(path.join(f.root,'src/input.bin'),Buffer.from([0,255,253,13,10]));assert.equal((await r.current(old)).state,'changed')})
test('selected absent path appearing cannot remain current',async t=>{const f=await fixture(t),r=f.reader(),old=await r.capture();assert.equal(old.state,'observed');await mkdir(path.join(f.root,'new'));await writeFile(path.join(f.root,'new/absent.txt'),'appeared');assert.equal((await r.current(old)).state,'changed')})
test('parent symlink outside refuses without approving leaked contents',async t=>{const f=await fixture(t);await rename(path.join(f.root,'src'),path.join(f.root,'outside'));await symlink(path.join(f.root,'outside'),path.join(f.root,'src'));assert.equal((await f.reader().capture()).state,'refused')})
test('explicit untracked selection is measured, unapproved refused',async t=>{const f=await fixture(t);await writeFile(path.join(f.root,'extra.txt'),'first');f.assignment.selectedInputs=[{path:'extra.txt'}];assert.equal((await f.reader().capture()).state,'refused');f.assignment.selectedInputs[0].allowUntracked=true;const r=f.reader(),old=await r.capture();assert.equal(old.state,'observed');await writeFile(path.join(f.root,'extra.txt'),'second');assert.equal((await r.current(old)).state,'changed')})
test('constructor assignment mutation and foreign receipt do not alter proof',async t=>{const f=await fixture(t),r=f.reader();f.assignment.sessionId='foreign';f.assignment.selectedInputs[0].path='not-real';const old=await r.capture();assert.equal(old.state,'observed');assert.equal(old.identity.sessionId,'session');assert.equal((await r.current({...old})).state,'unknown');assert.equal(old.executionAuthorized,false);assert.equal(old.selectionComplete,false)})
test('changed HEAD invalidates otherwise identical selected bytes',async t=>{const f=await fixture(t),r=f.reader(),old=await r.capture();assert.equal(old.state,'observed');f.git('commit','--allow-empty','-qm','head-change');assert.equal((await r.current(old)).state,'changed')})
test('repeated timeout retains one unsettled identity operation',async t=>{const f=await fixture(t);f.assignment.bounds.timeoutMs=150;let calls=0,release;const pending=new Promise(resolve=>release=resolve);const r=f.reader(f.assignment,{identity:()=>{calls++;return pending}});assert.equal((await r.capture()).state,'unknown');for(let i=0;i<30;i++)assert.equal((await r.capture()).reason,'io_outstanding');assert.equal(calls,1);release({...identity});await new Promise(resolve=>setTimeout(resolve,40));assert.equal((await r.capture()).state,'observed');assert.equal(calls,3)})
test('ordinary async rejected clock cannot crash process',async t=>{const f=await fixture(t),r=f.reader(f.assignment,{now:()=>Promise.reject(Error('fixture-secret'))});assert.equal((await r.capture()).state,'unknown');await new Promise(resolve=>setTimeout(resolve,20))})
