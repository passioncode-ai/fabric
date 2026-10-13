import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
const {createResourceRunAssignmentManager,AGENT_SYNC_IDENTITY_SOURCE_SHA256}=await import(pathToFileURL(process.env.N028_SOURCE).href)
const agentScript=process.env.N028_AGENT_SYNC_SCRIPT; assert.ok(agentScript, 'Set N028_AGENT_SYNC_SCRIPT to the hash-pinned installed agent_sync.py')
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

const {execFileSync}=await import('node:child_process');
const sourceURL=pathToFileURL(process.env.N028_SOURCE);
const {createResourceInputSnapshotReader}=await import(new URL('./resourceInputSnapshot.ts',sourceURL));
test('actual persisted membership reader feeds actual N026 then manifest drift refuses currentness',async t=>{
 const f=await fixture(t);
 execFileSync('git',['init','-q',f.repo]);await fs.writeFile(path.join(f.repo,'input.txt'),'selected actual bytes');
 execFileSync('git',['-C',f.repo,'add','input.txt']);execFileSync('git',['-C',f.repo,'-c','user.name=fixture','-c','user.email=fixture@invalid','commit','-qm','fixture']);
 f.manifest.expectedHead=execFileSync('git',['-C',f.repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const bytes=JSON.stringify(f.manifest);await fs.writeFile(f.config.manifestPath,bytes);f.config.manifestSha256=createHash('sha256').update(bytes).digest('hex');
 const manager=createResourceRunAssignmentManager(f.config,{store:f.store,key:()=> 'abcdefghijkl'});
 const allocated=await manager.allocate({taskId:'task',sessionId:'session'});assert.equal(allocated.state,'observed',JSON.stringify(allocated));
 const reader=createResourceInputSnapshotReader(allocated.value.assignment,{identity:async()=>{const result=await manager.readIdentity(allocated.value.handle);return result.state==='observed'?result.value:null}});
 const captured=await reader.capture();assert.equal(captured.state,'observed',JSON.stringify(captured));assert.equal(captured.executionAuthorized,false);
 await fs.appendFile(f.config.manifestPath,' ');const changed=await reader.current(captured);assert.notEqual(changed.state,'same');
});
