import { pathToFileURL } from 'node:url';
const {createGitLeaseSnapshotReader}=await import(pathToFileURL(process.env.N023_SOURCE));
const reader=createGitLeaseSnapshotReader({approvedRemote:'https://lease.invalid/fixture.git',key:'scope',runId:'run',repositoryName:'fixture',expectedTip:null,maxAgeMs:60000,timeoutMs:100},{now:()=>Promise.reject(new Error('synthetic-clock-rejection')),git:async()=>{throw Error('must_not_run')}});
const result=await reader.read();
console.log(JSON.stringify(result));
await new Promise(resolve=>setTimeout(resolve,20));
