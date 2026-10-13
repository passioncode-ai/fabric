import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
const {createResourceRunAssignmentManager,AGENT_SYNC_IDENTITY_SOURCE_SHA256}=await import(pathToFileURL(process.env.N028_SOURCE).href)
const agentScript=process.env.N028_AGENT_SYNC_SCRIPT; assert.ok(agentScript,'Set N028_AGENT_SYNC_SCRIPT to pinned installed source')
async function fixture(t){
 const root=await fs.realpath(await fs.mkdtemp(path.join(tmpdir(),'n028-independent-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const repo=path.join(root,'repo'),storage=path.join(root,'store');await fs.mkdir(repo,{mode:0o700});await fs.mkdir(storage,{mode:0o700});
 const manifest={bounds:{maxPaths:8,maxDepth:8,maxPathBytes:1024,maxFileBytes:1024,maxTotalBytes:4096,maxMetadataBytes:65536,timeoutMs:2000,maxAgeMs:60000},configuredKey:'scope',expectedHead:'a'.repeat(40),mutableScope:[],scopeMappingRevision:'v1',selectedInputs:[{path:'input.txt'}],selectionRevision:'v1'};
 const bytes=JSON.stringify(manifest),manifestPath=path.join(root,'manifest.json');await fs.writeFile(manifestPath,bytes,{mode:0o600});
 const config={estateId:'estate',projectId:'project',installationId:'installation',invocationId:'invocation',repositoryRoot:repo,approvedRemote:'https://example.invalid/repo.git',repositoryName:'repo',manifestPath,manifestSha256:createHash('sha256').update(bytes).digest('hex'),storageRoot:storage,agentSyncScript:agentScript,timeoutMs:2000,maxRecords:10,maxRecordBytes:8192,maxManifestBytes:8192};
 const store = {
  scope: {kind:'estate',estateId:'estate'},
  select(table) {
   let target;
   return {
    eq(_key,value) { target=value; return this },
    async maybeSingle() { return {data:table==='project_tasks'?{id:target,project_id:'project'}:{id:'project',repo_path:repo},error:null} }
   }
  }
 };
 return {root,repo,storage,config,store,manifest};
}
test('manager retains unsettled lease transport across distinct handles',async t=>{
 const f=await fixture(t);f.config.timeoutMs=500;let n=0,calls=0;const release=[];
 const manager=createResourceRunAssignmentManager(f.config,{store:f.store,key:()=> ['aaaaaaaaaaaa','bbbbbbbbbbbb'][n++],lease:{git:()=>{calls++;return new Promise(resolve=>release.push(()=>resolve('')))}}});
 try {
  const a=await manager.allocate({taskId:'task',sessionId:'session-a'}),b=await manager.allocate({taskId:'task',sessionId:'session-b'});assert.equal(a.state,'observed');assert.equal(b.state,'observed');
  await manager.observeLease(a.value.handle);await new Promise(r=>setTimeout(r,50));await manager.observeLease(b.value.handle);
  console.log(JSON.stringify({probe:'distinct handle pending Git',calls}));assert.equal(calls,1,'one manager cannot start another Git operation while prior transport remains unresolved')
 } finally {for(const done of release)done();await new Promise(r=>setTimeout(r,60))}
})
