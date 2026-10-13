import assert from 'node:assert/strict'
import {mkdtemp,rm,writeFile,rename,mkdir,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
const {createResourceInputSnapshotReader}=await import(pathToFileURL(process.env.N026_SOURCE).href)
const root=await realpath(await mkdtemp(path.join(tmpdir(),'n026-metadata-probe-')))
function git(...args){return execFileSync('git',['-c','user.name=fixture','-c','user.email=fixture@example.invalid',...args],{cwd:root,encoding:'utf8'})}
const identity={estateId:'estate',projectId:'project',taskId:'task',sessionId:'session',attemptId:'attempt'}
try{
 git('init','--quiet');await writeFile(path.join(root,'selected.txt'),'selected');git('add','.');git('commit','-qm','fixture')
 const fixed={...identity,selectionRevision:'v1',repository:{approvedRoot:root,approvedRemoteDigest:'a'.repeat(64),expectedHead:git('rev-parse','HEAD').trim()},selectedInputs:[{path:'selected.txt'}],mutableScope:[],bounds:{maxPaths:8,maxDepth:8,maxPathBytes:512,maxFileBytes:1024,maxTotalBytes:4096,maxMetadataBytes:65536,timeoutMs:5000,maxAgeMs:60000}}
 const reader=createResourceInputSnapshotReader(fixed,{identity:()=>({...identity})});const before=await reader.capture();git('update-index','--assume-unchanged','selected.txt');const after=await reader.current(before);console.log(JSON.stringify({probe:'assume-unchanged-index-flag',before:before.state,after:after.state}));git('update-index','--no-assume-unchanged','selected.txt')
 assert.equal(before.state,'observed'); assert.equal(after.state,'changed','index flag mutation must invalidate the prior snapshot');
}finally{await rm(root,{recursive:true,force:true})}
