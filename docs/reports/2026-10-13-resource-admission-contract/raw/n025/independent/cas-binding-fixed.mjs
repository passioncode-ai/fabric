import assert from 'node:assert/strict';import {fixture} from './fixture-fixed.mjs';import {pathToFileURL} from 'node:url';
const {createResourcePoolPublisher}=await import(pathToFileURL(process.env.N025_SOURCE));const checks=[];
{
 const f=fixture({existing:true});await f.publisher.configure();await f.publisher.publish();const original=structuredClone(f.row);
 const changed={...f.deps.rawPolicy,diskPath:'/other-owned-device',diskDeviceId:'2'};
 const b=createResourcePoolPublisher({...f.deps,rawPolicy:changed,samplerDeps:{...f.deps.samplerDeps,disk:()=>({path:'/other-owned-device',deviceId:'2',blockSize:10n,blocks:100n,availableBlocks:10n})}});
 assert.notEqual(b.bindingRevision,f.publisher.bindingRevision);assert.equal((await b.configure()).state,'refused');assert.deepEqual(f.row,original);
 const migrated=await b.configure({revision:f.publisher.bindingRevision,generation:1});assert.equal(migrated.state,'configured');assert.equal(migrated.generation,2);assert.equal(f.row.observed,null);
 assert.equal((await f.publisher.publish()).reason,'generation_changed');assert.equal((await b.publish()).state,'published');assert.equal(f.row.observed.diskBytes,900);assert.equal(f.row.configuration_generation,2);checks.push('different-disk-explicit-CAS-only-old-publisher-rejected');
}
{
 const f=fixture({existing:true});f.row.policy_revision='revision-A';assert.equal((await f.publisher.configure()).state,'refused');assert.equal(f.writes.length,0);
 const r=await f.publisher.configure({revision:'revision-A',generation:1});assert.equal(r.state,'configured');assert.equal(r.generation,2);assert.equal(f.row.policy_revision,f.publisher.bindingRevision);checks.push('legacy-human-revision-needs-explicit-CAS');
}
for(const change of ['profile','sampleWindow','timeout']){
 const f=fixture({existing:true});await f.publisher.configure();const policy=structuredClone(f.deps.rawPolicy);
 if(change==='profile')policy.demandProfiles.reviewer.workerSlots=2;else if(change==='sampleWindow')policy.sampleWindowMs=6;else policy.timeoutMs=41;
 const b=createResourcePoolPublisher({...f.deps,rawPolicy:policy});assert.notEqual(b.bindingRevision,f.publisher.bindingRevision);assert.equal((await b.configure()).state,'refused');assert.equal(f.writes.length,0);checks.push('full-policy-bound-'+change);
}
console.log(JSON.stringify({checks,pass:checks.length}));
