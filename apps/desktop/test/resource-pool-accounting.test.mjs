import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createResourcePoolAccountingReader} from '../src/main/resourcePoolAccounting.ts'
import {readResourceHostPolicy,resourceDigest} from '../src/main/resourceHostPolicy.ts'
const v=(n=0)=>({workerSlots:n,memoryBytes:n,diskBytes:n,cpuMilliCores:n})
const config=()=>({hostId:'host',poolId:'pool',localPolicyRevision:'human',capacity:v(100),demandProfiles:{builder:v(1),reviewer:v(1),test:v(1)},diskPath:'/disk',diskDeviceId:'1',maxAgeMs:100,sampleWindowMs:5,timeoutMs:20})
function fixture(options={}) {
 const policy=options.rawPolicy??config(), f={calls:[],wall:1000}
 const row={state:'observed',hostId:policy.hostId,poolId:policy.poolId,bindingRevision:`policy-sha256-v1:${resourceDigest(readResourceHostPolicy(policy,'host'))}`,configurationGeneration:1,capacity:structuredClone(policy.capacity),maxAgeMs:policy.maxAgeMs,observed:v(2),observedAtMs:990,reserved:v(3),rootCount:1,snapshotAtMs:995}
 const db={async rpc(name,args){f.calls.push({name,args});return f.hook ? f.hook() : {data:structuredClone(row),error:null}}}
 const deps={db,rawPolicy:policy,trustedHostId:'host',expectedGeneration:1,maxRoots:2,timeoutMs:100,now:()=>f.wall,...options}
 return Object.assign(f,{row,deps,reader:createResourcePoolAccountingReader(deps)})
}
test('actual validated policy binds exact read, immutable coherent observation grants no authority',async()=>{
 const f=fixture(), r=await f.reader.read();assert.equal(r.state,'observed');assert.equal(r.executionAuthorized,false);assert.equal(r.overlapCredit,'none-conservative')
 assert.deepEqual(f.calls,[{name:'read_resource_pool_accounting',args:{p_host:'host',p_pool:'pool',p_revision:f.reader.bindingRevision,p_configuration_generation:1,p_max_roots:2}}])
 assert.notEqual(f.reader.bindingRevision,'human');assert.equal(r.snapshot.observedAtMs,990);assert.equal(r.snapshot.snapshotAtMs,995)
 assert.ok(Object.isFrozen(r.snapshot.reserved));assert.throws(()=>{r.snapshot.reserved.workerSlots=0});assert.match(r.snapshotId,/^[a-f0-9]{64}$/)
 f.deps.rawPolicy.diskPath='/other';assert.equal((await f.reader.read()).snapshotId,r.snapshotId)
})
for(const key of ['hostId','poolId','bindingRevision','configurationGeneration','maxAgeMs','capacity'])test(`changed ${key} refuses exact policy binding`,async()=>{
 const f=fixture();f.row[key]=key==='capacity'?v(101):typeof f.row[key]==='number'?f.row[key]+1:'different'
 assert.equal((await f.reader.read()).state,'refused')
})
for(const [name,change] of [
 ['missing observation',r=>{r.observed=null}],['missing reserved',r=>{delete r.reserved}],['negative axis',r=>{r.reserved.diskBytes=-1}],
 ['fractional axis',r=>{r.reserved.diskBytes=0.5}],['unsafe axis',r=>{r.observed.memoryBytes=2**53}],['extra field',r=>{r.extra=true}],
 ['null',()=>null],['root bound',r=>{r.rootCount=3}],['noninteger count',r=>{r.rootCount=0.5}],['false zero roots',r=>{r.rootCount=0}],
 ['getter',r=>{Object.defineProperty(r,'observed',{get(){throw Error('secret')},enumerable:true})}],
])test(`malformed ${name} remains unknown`,async()=>{
 const f=fixture();const changed=change(f.row);if(changed===null)f.hook=()=>({data:null,error:null});else f.hook=()=>({data:f.row,error:null})
 const r=await f.reader.read();assert.equal(r.state,'unknown');assert.equal(r.executionAuthorized,false);assert.ok(!JSON.stringify(r).includes('secret'))
})
for(const [name,change] of [['stale',r=>{r.observedAtMs=899}],['future snapshot',r=>{r.snapshotAtMs=1001}],['future observation',r=>{r.observedAtMs=996}],['fractional time',r=>{r.observedAtMs=990.1}]])test(`${name} cannot refresh observation age`,async()=>{
 const f=fixture();change(f.row);assert.equal((await f.reader.read()).state,'unknown')
})
test('complete zero-root reading has legitimate zero reservation',async()=>{
 const f=fixture();f.row.rootCount=0;f.row.reserved=v();assert.equal((await f.reader.read()).state,'observed')
})
test('conservative observed plus reserved refuses capacity and catches safe-axis sum overflow',async()=>{
 const f=fixture();f.row.reserved.workerSlots=99;assert.equal((await f.reader.read()).reason,'capacity_exceeded')
 const rawPolicy=config();rawPolicy.capacity=v(Number.MAX_SAFE_INTEGER);const g=fixture({rawPolicy});g.row.reserved=v(Number.MAX_SAFE_INTEGER)
 assert.equal((await g.reader.read()).reason,'reserved_overflow')
})
test('server unknown/refusal remains explicit, unrecognized reasons never escape',async()=>{
 const f=fixture();for(const [state,reason] of [['unknown','root_bound_exceeded'],['refused','policy_changed']]){
 f.hook=()=>({data:{state,reason},error:null});assert.equal((await f.reader.read()).reason,reason)}
 f.hook=()=>({data:{state:'unknown',reason:'private transport'},error:null});assert.equal((await f.reader.read()).reason,'unavailable')
})
test('timeout retains one outstanding request across 30 retries; late response ignored, fresh read works',async()=>{
 const f=fixture({timeoutMs:5});let resolve;f.hook=()=>new Promise(r=>{resolve=r})
 assert.equal((await f.reader.read()).state,'unknown');for(let i=0;i<30;i++)assert.equal((await f.reader.read()).reason,'io_outstanding');assert.equal(f.calls.length,1)
 resolve({data:f.row,error:null});await new Promise(r=>setImmediate(r));delete f.hook
 assert.equal((await f.reader.read()).state,'observed');assert.equal(f.calls.length,2)
})
test('concurrent reads serialize and an ambiguous rejection releases only after settlement',async()=>{
 const f=fixture();let reject;f.hook=()=>new Promise((_,r)=>{reject=r});const first=f.reader.read();await new Promise(r=>setImmediate(r))
 assert.equal((await f.reader.read()).reason,'io_outstanding');reject(Error('secret'));assert.equal((await first).state,'unknown');delete f.hook
 assert.equal((await f.reader.read()).state,'observed')
})
test('ordinary rejected async clock refuses without unhandled rejection or I/O',async()=>{
 const errors=[],onError=e=>errors.push(e);process.on('unhandledRejection',onError)
 try{const f=fixture({now:()=>Promise.reject(Error('private clock'))});assert.equal((await f.reader.read()).state,'unknown');await new Promise(r=>setImmediate(r));assert.equal(errors.length,0);assert.equal(f.calls.length,0)}finally{process.off('unhandledRejection',onError)}
})
test('clock failure after RPC and transport error both remain bounded unknown',async()=>{
 let n=0;const f=fixture({now:()=>++n===1?1000:Promise.reject(Error('clock'))});assert.equal((await f.reader.read()).state,'unknown');await new Promise(r=>setImmediate(r))
 const g=fixture();g.hook=()=>({data:g.row,error:{message:'credential'}});assert.equal((await g.reader.read()).reason,'unavailable')
})
test('full policy differences produce different binding, no independently supplied digest',()=>{
 const a=fixture(), policy=config();policy.diskPath='/another';const b=fixture({rawPolicy:policy});assert.notEqual(a.reader.bindingRevision,b.reader.bindingRevision)
 for(const opts of [{expectedGeneration:0},{expectedGeneration:2**53},{maxRoots:1025},{maxRoots:null},{timeoutMs:0},{trustedHostId:'foreign'}])assert.throws(()=>fixture(opts))
})

test('wall clock rollback cannot revive an observation stale at operation start',async()=>{
 let reads=0;const f=fixture({now:()=>++reads===1?1000:950});f.row.observedAtMs=880;f.row.snapshotAtMs=940
 assert.equal((await f.reader.read()).state,'unknown')
})
