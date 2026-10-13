import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const {createGitLeaseSnapshotReader,exactLeaseRef}=await import(pathToFileURL(process.env.N023_SOURCE));
const at=Date.parse('2026-10-13T12:00:00Z');
const cfg={approvedRemote:'https://lease.invalid/fixture.git',key:'scope',runId:'run',repositoryName:'fixture',expectedTip:null,maxAgeMs:60000,timeoutMs:1000};
const payload={key:'scope',run:'run',repo:'fixture',ts:'2026-10-13T11:59:50Z',since:'2026-10-13T11:59:00Z',ttl:60};
const rawFor=p=>'tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904\nauthor fixture <fixture@example.invalid> 1791889190 +0000\ncommitter fixture <fixture@example.invalid> 1791889190 +0000\n\n'+JSON.stringify(p)+'\n';
const raw=rawFor(payload), tip=createHash('sha1').update(`commit ${Buffer.byteLength(raw)}\0`).update(raw).digest('hex');
const gitFor=p=>{const raw=rawFor(p),tip=createHash('sha1').update(`commit ${Buffer.byteLength(raw)}\0`).update(raw).digest('hex');return async args=>args[0]==='ls-remote'?tip+'\t'+exactLeaseRef(cfg.key)+'\n':args[0]==='cat-file'?raw:''};
if(process.argv[2]==='clock'){
 let reads=0;const rejectAt=Number(process.argv[3]);
 const r=createGitLeaseSnapshotReader(cfg,{git:gitFor(payload),now:()=>++reads===rejectAt?Promise.reject(Error('synthetic-diagnostic-clock')):at});
 const result=await r.read();assert.equal(result.reason,'clock_invalid');console.log(JSON.stringify({rejectAt,result}));
 await new Promise(r=>setTimeout(r,20));
}else{
 const results=[];
 for(const n of [1,2,3]){const child=spawnSync(process.execPath,[process.argv[1],'clock',String(n)],{encoding:'utf8',env:process.env});results.push({case:'native-rejected-clock-'+n,exit:child.status,stdout:child.stdout,stderr:child.stderr});}
 let getterCalls=0;const thenable=Object.defineProperty({},'then',{get(){getterCalls++;throw Error('do_not_read_then')}});
 const invalid=await createGitLeaseSnapshotReader(cfg,{git:gitFor(payload),now:()=>thenable}).read();assert.equal(invalid.reason,'clock_invalid');assert.equal(getterCalls,0);results.push({case:'hostile-thenable-getter',pass:true});
 for(const [name,p,expected] of [['valid',payload,'observed'],['extra-private-field',{...payload,secret:'do-not-return'},'observed'],['foreign-run',{...payload,run:'other'},'refused'],['expired',{...payload,ttl:10},'refused'],['installed-cross-second',{...payload,since:'2026-10-13T11:59:51Z'},'observed']]){const r=await createGitLeaseSnapshotReader(cfg,{git:gitFor(p),now:()=>at}).read();assert.equal(r.status,expected);assert.equal(r.executionAuthorized,false);assert.equal(JSON.stringify(r).includes('do-not-return'),false);results.push({case:name,result:r});}
 let release, calls=0,scratch;const reader=createGitLeaseSnapshotReader({...cfg,timeoutMs:10},{now:()=>at,git:async(args,opts)=>{calls++;scratch=opts.cwd;if(calls===1)await new Promise(r=>release=r);return gitFor(payload)(args)}});
 assert.equal((await reader.read()).reason,'timeout');for(let i=0;i<100;i++)assert.equal((await reader.read()).reason,'prior_io_unresolved');assert.equal(calls,1);release();await new Promise(r=>setTimeout(r,30));await assert.rejects(access(scratch));results.push({case:'timeout-100-retries-retain-one-and-clean-scratch',pass:true,calls});
 console.log(JSON.stringify(results,null,2));if(results.some(r=>'exit'in r&&r.exit!==0))process.exitCode=1;
}
