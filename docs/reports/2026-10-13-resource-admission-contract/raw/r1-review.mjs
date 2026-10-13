import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
const root=process.argv[2]; if(!root) throw Error('repository root required')
const file=path.join(root,'apps/desktop/src/shared/resourceAdmission.ts')
const sourceHash=createHash('sha256').update(readFileSync(file)).digest('hex')
assert.equal(sourceHash,'f7d9250f4cb669681889d38d27f6e6fda47f3037261fb48c2fca7c6a174debfd')
const {assessResourceAdmission:assess}=await import(pathToFileURL(file).href)
const keys=['workerSlots','memoryBytes','diskBytes','cpuMilliCores'], M=Number.MAX_SAFE_INTEGER
const v=n=>Object.fromEntries(keys.map(k=>[k,n]))
const copy=x=>structuredClone(x)
const identity={hostId:'host',poolId:'pool',localPolicyRevision:'local-1',reservationId:'child',attemptId:'attempt-child',fence:2,ownerId:'agent',role:'reviewer',inputDigest:'a'.repeat(64),scopeDigest:'b'.repeat(64)}
function f(){const request={...identity,demand:v(1)},context={nowMs:1000,policy:{hostId:'host',poolId:'pool',localPolicyRevision:'local-1',maxAgeMs:100,capacity:v(10)},snapshot:{id:'snapshot',hostId:'host',poolId:'pool',localPolicyRevision:'local-1',atMs:950,reserved:v(1),observed:v(1),reservedObserved:v(1)}},proof={state:'held',identity:copy(identity),snapshotId:'snapshot',atMs:950};return{request,context,proof,checks:{ownership:()=>proof}}}
function run(x){const r=assess(x.request,x.context,x.checks);assert.equal(r.executionAuthorized,false);assert.equal(r.reservationRequired,true);return r}
const counts={arithmetic:0,eligible:0,refused:0,bindings:0,untrusted:0,missing:0,nested:0}
let seed=104729;const initialSeed=seed;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32)
const sample=()=>rand()<0.35?M-Math.floor(rand()*32):Math.floor(rand()*32)
for(let i=0;i<5000;i++){
 const x=f();let fits=true
 for(const k of keys){let a=sample(),b=sample(),over=Math.min(a,b,Math.floor(rand()*32)),d=sample(),cap=sample();if(k==='workerSlots')d=Math.max(1,d)
 x.request.demand[k]=d;x.context.policy.capacity[k]=cap;x.context.snapshot.reserved[k]=a;x.context.snapshot.observed[k]=b;x.context.snapshot.reservedObserved[k]=over
 const effective=BigInt(a)+BigInt(b)-BigInt(over);if(BigInt(d)>BigInt(cap)||effective>BigInt(M)||effective+BigInt(d)>BigInt(cap))fits=false
 }
 const r=run(x);assert.equal(r.state==='eligible',fits,`BigInt case ${i}`);counts.arithmetic++;counts[r.state]++
 if(fits)for(const k of keys)assert.equal(BigInt(r.effectiveUsage[k]),BigInt(x.context.snapshot.reserved[k])+BigInt(x.context.snapshot.observed[k])-BigInt(x.context.snapshot.reservedObserved[k]))
}
// High-value exact-fit/overflow boundaries for each dimension, with otherwise feasible pool.
for(const k of keys)for(const [reserved,observed,overlap,demand,cap,eligible] of [[M-1,1,1,1,M,true],[M-1,1,0,1,M,false],[M,1,0,1,M,false],[M-2,2,2,2,M,true]]){
 const x=f();x.context.snapshot.reserved[k]=reserved;x.context.snapshot.observed[k]=observed;x.context.snapshot.reservedObserved[k]=overlap;x.request.demand[k]=demand;x.context.policy.capacity[k]=cap
 assert.equal(run(x).state==='eligible',eligible,`boundary ${k}`);counts.arithmetic++
}
for(const k of Object.keys(identity)){
 const x=f();x.proof.identity[k]=k==='fence'?3:k==='role'?'builder':k.endsWith('Digest')?'c'.repeat(64):'other';assert.notEqual(run(x).state,'eligible',`binding ${k}`);counts.bindings++
}
for(const k of ['snapshotId','atMs']){const x=f();x.proof[k]=k==='atMs'?899:'other';assert.notEqual(run(x).state,'eligible');counts.bindings++}
for(const getTarget of [x=>x.request,x=>x.request.demand,x=>x.context,x=>x.context.policy,x=>x.context.snapshot,x=>x.proof,x=>x.proof.identity]){
 const x=f(),target=getTarget(x),key=Object.keys(target)[0];let invoked=0;Object.defineProperty(target,key,{get(){invoked++;throw Error('private sentinel')}});const r=run(x);assert.notEqual(r.state,'eligible');assert.equal(invoked,0);assert.ok(!JSON.stringify(r).includes('private sentinel'));counts.untrusted++
}
for(const getTarget of [x=>x.request,x=>x.request.demand,x=>x.context,x=>x.context.snapshot,x=>x.proof.identity]){const x=f();Object.setPrototypeOf(getTarget(x),{foreign:true});assert.notEqual(run(x).state,'eligible');counts.untrusted++}
for(const k of ['reserved','observed','reservedObserved'])for(const value of [null,undefined]){const x=f();x.context.snapshot[k]=value;assert.equal(run(x).state,'unknown');counts.missing++}
for(const k of ['workerSlots','memoryBytes','diskBytes','cpuMilliCores']){const x=f();x.context.snapshot.observed[k]=null;assert.notEqual(run(x).state,'eligible');counts.missing++}
function nested(){const x=f();x.request.parent={reservationId:'parent',attemptId:'attempt-parent',fence:1,rootReservationId:'root'};x.context.snapshot.reserved=v(10);x.context.snapshot.observed=v(10);x.context.snapshot.reservedObserved=v(10);x.parent={...copy(x.proof),parent:copy(x.request.parent),rootCharged:v(10),parentCapacity:v(3),remaining:v(2)};x.checks.parent=()=>x.parent;return x}
const n=nested(),before=copy({request:n.request,context:n.context,parent:n.parent});const nr=run(n);assert.equal(nr.state,'eligible');assert.deepEqual(nr.additionalPoolCharge,v(0));assert.deepEqual(nr.parentAllocation,v(1));assert.deepEqual({request:n.request,context:n.context,parent:n.parent},before);counts.nested++
for(const k of ['reservationId','attemptId','fence','rootReservationId']){const x=nested();x.parent.parent[k]=k==='fence'?2:'wrong';assert.notEqual(run(x).state,'eligible');counts.nested++}
for(const k of keys)for(const mutate of [x=>x.parent.remaining[k]=0,x=>x.parent.remaining[k]=4,x=>x.parent.parentCapacity[k]=11,x=>x.parent.rootCharged[k]=11,x=>x.context.snapshot.reservedObserved[k]=9]){const x=nested();mutate(x);assert.notEqual(run(x).state,'eligible');counts.nested++}
assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),sourceHash)
console.log(JSON.stringify({verdict:'PASS',sourceCommit:'7797d1fb1651ecd01d2a36c95380fffbcb44a359',sourceHash,seed:initialSeed,counts,boundaries:'Pure advisory function with trusted injected proofs; no production dispatcher, atomic reservation, database or native/provider enforcement tested.'},null,2))
