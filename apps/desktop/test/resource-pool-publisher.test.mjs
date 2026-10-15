import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createResourcePoolPublisher} from '../src/main/resourcePoolPublisher.ts'
import {resourceDigest,readResourceHostPolicy} from '../src/main/resourceHostPolicy.ts'
const v=(workerSlots=10)=>({workerSlots,memoryBytes:1000,diskBytes:1000,cpuMilliCores:1000})
const config=()=>({hostId:'host',poolId:'pool',localPolicyRevision:'revision-A',capacity:v(),demandProfiles:{builder:v(1),reviewer:v(1),test:v(1)},diskPath:'/owned',diskDeviceId:'1',maxAgeMs:100,sampleWindowMs:5,timeoutMs:40})
function fixture({existing=false,timeoutMs=100,policy=config()}={}) {
 const f={row:null,reads:0,writes:[],systemReads:0,wall:1000,mono:0,identity:{hostId:'host',bootId:'boot'}}
 const pool=(generation=1)=>({host_id:'host',pool_id:'pool',policy_revision:`policy-sha256-v1:${resourceDigest(readResourceHostPolicy(policy,'host'))}`,configuration_generation:generation,capacity:structuredClone(policy.capacity),max_age_ms:policy.maxAgeMs,observed:null,observed_at:null})
 if(existing)f.row=pool()
 const db={async rpc(name,args){
   if(name==='read_resource_pool'){
    assert.deepEqual(args,{p_host:'host',p_pool:'pool'});f.reads++
    if(f.readHook){const r=await f.readHook();if(r!==undefined)return r}
    return {data:structuredClone(f.row),error:null}
   }
   f.writes.push({name,args:structuredClone(args)});if(f.rpcHook){const r=await f.rpcHook(name,args);if(r!==undefined)return r}
   if(name==='configure_resource_pool'){f.row=pool(args.p_expected_generation===null?1:args.p_expected_generation+1);return {data:true,error:null}}
   assert.equal(name,'observe_resource_pool');f.row.observed=structuredClone(args.p_observed);f.row.observed_at=args.p_at;return {data:true,error:null}
  }}
 const samplerDeps={identity:()=>({...f.identity}),now:()=>f.wall,monotonic:()=>f.mono,
  system:()=>{const n=f.systemReads++;return {totalMemory:1000,freeMemory:700,cpus:[{model:'cpu',times:{user:100+n*100,nice:0,sys:0,idle:300+n*300,irq:0}}]}},
  disk:()=>({path:'/owned',deviceId:'1',blockSize:10n,blocks:100n,availableBlocks:80n}),
  workers:()=>({hostId:'host',bootId:'boot',poolId:'pool',localPolicyRevision:policy.localPolicyRevision,atMs:f.wall,complete:true,workers:['owned-worker']}),
  pause:async ms=>{f.mono+=ms;f.wall+=ms;await f.sampleHook?.()}}
 const deps={db,rawPolicy:policy,trustedHostId:'host',samplerDeps,timeoutMs,now:()=>f.wall}
 const publisher=createResourcePoolPublisher(deps)
 return Object.assign(f,{publisher,deps,pool})
}
test('configure is policy confirmation, publish uses real sampler and exact scoped generation readback',async()=>{
 const f=fixture();const configured=await f.publisher.configure();assert.equal(configured.state,'configured');assert.equal(configured.executionAuthorized,false);assert.equal(f.row.observed,null);assert.equal(f.systemReads,0)
 const published=await f.publisher.publish();assert.equal(published.state,'published');assert.equal(published.executionAuthorized,false);assert.equal(published.generation,1)
 assert.deepEqual(f.row.observed,{workerSlots:1,memoryBytes:300,diskBytes:200,cpuMilliCores:250});assert.equal(f.row.observed_at,new Date(1000).toISOString())
 assert.equal(f.writes[1].args.p_configuration_generation,1);assert.equal(f.writes.length,2)
 assert.ok(f.reads>=4,'scoped server readback occurs before and after writes')
})
test('existing exact config needs no write and stale old observation does not imply published',async()=>{
 const f=fixture({existing:true});f.row.observed=v(0);f.row.observed_at=new Date(0).toISOString()
 assert.equal((await f.publisher.configure()).state,'configured');assert.equal(f.writes.length,0);assert.equal(f.systemReads,0)
 assert.equal((await f.publisher.publish()).state,'published');assert.equal(f.writes.length,1)
})
test('changed config needs exact explicit CAS revision/generation, never a refreshed expectation',async()=>{
 const f=fixture({existing:true});f.row.policy_revision='revision-old';f.row.configuration_generation=4
 for(const expectation of [undefined,{revision:'revision-old',generation:3},{revision:'foreign',generation:4}])assert.equal((await f.publisher.configure(expectation)).state,'refused')
 assert.equal(f.writes.length,0)
 const r=await f.publisher.configure({revision:'revision-old',generation:4});assert.equal(r.state,'configured');assert.equal(r.generation,5)
 assert.equal(f.writes[0].args.p_expected_revision,'revision-old');assert.equal(f.writes[0].args.p_expected_generation,4)
})
for(const method of ['configure','publish'])test(`lost ${method} reply after actual fixture commit reconciles by read without repeat write`,async()=>{
 const f=fixture({existing:method==='publish'});if(method==='publish')await f.publisher.configure()
 f.rpcHook=(name,args)=>{if(method==='configure')f.row=f.pool();else {f.row.observed={...args.p_observed};f.row.observed_at=args.p_at}throw Error('private transport/token')}
 const r=await f.publisher[method]();assert.equal(r.state,'unknown');assert.equal(f.writes.length,1)
 assert.equal((await f.publisher[method]()).reason,'reconcile_required');assert.equal(f.writes.length,1)
 const reconciled=await f.publisher.reconcile();assert.equal(reconciled.state,method==='configure'?'configured':'published');assert.equal(f.writes.length,1);assert.ok(!JSON.stringify(r).includes('private'))
})
for(const field of ['generation','revision','capacity','max-age','observed-vector','observed-time','sub-millisecond','extra-field'])test(`mismatched ${field} readback cannot certify publication`,async()=>{
 const f=fixture({existing:true});await f.publisher.configure()
 f.rpcHook=(_name,args)=>{f.row.observed={...args.p_observed};f.row.observed_at=args.p_at
  if(field==='generation')f.row.configuration_generation=3;if(field==='revision')f.row.policy_revision='other';if(field==='capacity')f.row.capacity.memoryBytes++
  if(field==='max-age')f.row.max_age_ms++;if(field==='observed-vector')f.row.observed.diskBytes++;if(field==='observed-time')f.row.observed_at=new Date(999).toISOString()
  if(field==='sub-millisecond')f.row.observed_at='1970-01-01T00:00:01.000001+00:00';if(field==='extra-field')f.row.extra='not selected';return {data:true,error:null}}
 assert.equal((await f.publisher.publish()).state,'unknown');assert.equal((await f.publisher.publish()).reason,'reconcile_required');assert.equal(f.writes.length,1)
 assert.equal((await f.publisher.reconcile()).state,'unknown');assert.equal(f.writes.length,1)
})
test('ABA after sampling cannot relabel the sample with the newer generation',async()=>{
 const f=fixture({existing:true});await f.publisher.configure();f.sampleHook=()=>{f.row.configuration_generation=3}
 assert.equal((await f.publisher.publish()).state,'refused');assert.equal(f.writes.length,0)
 assert.equal((await f.publisher.configure()).reason,'generation_changed')
})
test('uncertain generation1 observation cannot reconcile against ABA generation3 even with same vector/time',async()=>{
 const f=fixture({existing:true});await f.publisher.configure()
 f.rpcHook=(_name,args)=>{f.row.observed={...args.p_observed};f.row.observed_at=args.p_at;f.row.configuration_generation=3;throw Error('lost')}
 assert.equal((await f.publisher.publish()).state,'unknown');assert.equal((await f.publisher.reconcile()).state,'unknown');assert.equal(f.writes.length,1)
})
test('unknown worker inventory causes no observation RPC or fabricated zero',async()=>{
 const f=fixture({existing:true});f.deps.samplerDeps.workers=undefined
 const publisher=createResourcePoolPublisher(f.deps);await publisher.configure()
 assert.equal((await publisher.publish()).state,'unknown');assert.equal(f.writes.length,0)
})
for(const axis of ['memoryBytes','diskBytes','cpuMilliCores'])test(`impossible configured ${axis} ceiling is refused without overcommit`,async()=>{
 const policy=config();policy.capacity[axis]++
 const f=fixture({policy,existing:true});await f.publisher.configure()
 assert.equal((await f.publisher.publish()).state,'unknown');assert.equal(f.writes.length,0)
})
test('identity changed after sample cannot publish into old host invocation',async()=>{
 const f=fixture({existing:true});await f.publisher.configure()
 let calls=0;f.readHook=()=>{if(++calls===2)f.identity.bootId='new'}
 assert.equal((await f.publisher.publish()).state,'refused');assert.equal(f.writes.length,0)
})
test('matching but stale lost observation is reconciled as committed and unusable, permitting a fresh explicit sample',async()=>{
 const f=fixture({existing:true});await f.publisher.configure()
 f.rpcHook=(_name,args)=>{f.row.observed={...args.p_observed};f.row.observed_at=args.p_at;throw Error('lost')}
 assert.equal((await f.publisher.publish()).state,'unknown');f.wall+=200
 assert.equal((await f.publisher.reconcile()).reason,'observation_stale');f.rpcHook=undefined
 assert.equal((await f.publisher.publish()).state,'published')
})
test('timed-out committed write retains one slot across methods; late reply issues no readback until explicit reconcile',async()=>{
 const f=fixture({timeoutMs:10});let finish
 f.rpcHook=()=>{f.row=f.pool();return new Promise(resolve=>finish=resolve)}
 assert.equal((await f.publisher.configure()).state,'unknown');const reads=f.reads
 for(let i=0;i<10;i++)for(const method of ['configure','publish','reconcile'])assert.equal((await f.publisher[method]()).reason,'io_outstanding')
 assert.equal(f.writes.length,1);assert.equal(f.reads,reads)
 finish({data:true,error:null});await new Promise(resolve=>setImmediate(resolve));assert.equal(f.reads,reads)
 assert.equal((await f.publisher.publish()).reason,'reconcile_required');assert.equal((await f.publisher.reconcile()).state,'configured');assert.equal(f.writes.length,1)
})
test('pending read is bounded and synchronous reentry cannot enter another operation',async()=>{
 // 250 ms, not 10: at 10 the deadline could pass before the read began, so the hook never ran and `reentry` stayed
 // undefined (2 of 5 runs, 0.3.6 release gate 2026-10-15). The read hangs until finish(), so it still times out.
 const f=fixture({existing:true,timeoutMs:250});let finish,reentry
 f.readHook=()=>{reentry=f.publisher.publish();return new Promise(resolve=>finish=resolve)}
 assert.equal((await f.publisher.configure()).state,'unknown');assert.equal((await reentry).reason,'io_outstanding')
 for(let i=0;i<10;i++)assert.equal((await f.publisher.configure()).reason,'io_outstanding')
 assert.equal(f.reads,1);finish({data:f.row,error:null});await new Promise(resolve=>setImmediate(resolve));f.readHook=undefined
 assert.equal((await f.publisher.configure()).state,'configured');assert.equal(f.writes.length,0)
})
for(const mode of ['false','malformed','error'])test(`RPC ${mode} never becomes configured`,async()=>{
 const f=fixture();f.rpcHook=()=>mode==='false'?{data:false}:mode==='malformed'?{data:'true'}:{data:true,error:{private:'token'}}
 assert.notEqual((await f.publisher.configure()).state,'configured');assert.equal(f.systemReads,0)
})

for(const outcome of ['reject','resolve'])test(`ordinary native Promise ${outcome} from synchronous publisher clock is refused without escaping rejection`,async()=>{
 const f=fixture({existing:true});f.deps.now=()=>outcome==='reject'?Promise.reject(Error('synthetic private clock')):Promise.resolve(f.wall)
 const publisher=createResourcePoolPublisher(f.deps);assert.equal((await publisher.configure()).state,'configured')
 assert.equal((await publisher.publish()).state,'unknown');assert.equal(f.writes.length,0)
 await new Promise(resolve=>setImmediate(resolve))
})
test('clock thenable getter is not invoked or adopted',async()=>{
 const f=fixture({existing:true});let accessed=0
 f.deps.now=()=>Object.defineProperty({},'then',{get(){accessed++;throw Error('must not invoke')}})
 const publisher=createResourcePoolPublisher(f.deps);await publisher.configure()
 assert.equal((await publisher.publish()).state,'unknown');assert.equal(f.writes.length,0);assert.equal(accessed,0)
})
for(const changed of ['diskPath','diskDeviceId','demandProfile','sampleWindowMs','timeoutMs'])test(`same human revision cannot reuse another publisher's ${changed} policy binding`,async()=>{
 const f=fixture({existing:true});assert.equal((await f.publisher.configure()).state,'configured')
 const policy=config()
 if(changed==='diskPath')policy.diskPath='/other-disk'
 if(changed==='diskDeviceId')policy.diskDeviceId='2'
 if(changed==='demandProfile')policy.demandProfiles.builder.memoryBytes--
 if(changed==='sampleWindowMs')policy.sampleWindowMs++
 if(changed==='timeoutMs')policy.timeoutMs++
 const other=createResourcePoolPublisher({...f.deps,rawPolicy:policy})
 assert.equal(other.policy.localPolicyRevision,f.publisher.policy.localPolicyRevision)
 assert.equal((await other.configure()).state,'refused');assert.equal(f.writes.length,0)
})
test('explicit previous stored binding CAS changes generation and old publisher cannot publish or reconfigure it',async()=>{
 const f=fixture({existing:true});await f.publisher.configure()
 const policy=config();policy.diskDeviceId='2'
 const other=createResourcePoolPublisher({...f.deps,rawPolicy:policy})
 assert.match(other.bindingRevision,/^policy-sha256-v1:[a-f0-9]{64}$/)
 assert.notEqual(other.bindingRevision,f.publisher.bindingRevision)
 assert.equal((await other.configure({revision:policy.localPolicyRevision,generation:1})).state,'refused')
 assert.equal(f.writes.length,0)
 f.rpcHook=(name,args)=>{assert.equal(name,'configure_resource_pool');assert.equal(args.p_expected_revision,f.publisher.bindingRevision);f.row={...f.row,policy_revision:args.p_revision,configuration_generation:2};return {data:true,error:null}}
 assert.equal((await other.configure({revision:f.publisher.bindingRevision,generation:1})).state,'configured')
 assert.equal(f.writes.length,1);assert.equal(f.row.policy_revision,other.bindingRevision)
 assert.equal((await f.publisher.publish()).reason,'generation_changed')
 assert.equal((await f.publisher.configure()).reason,'generation_changed');assert.equal(f.writes.length,1)
 assert.equal((await other.configure()).state,'configured');assert.equal(f.writes.length,1)
})
test('validated canonical field order gives deterministic binding while preserving human revision',()=>{
 const f=fixture(),p=config()
 const reordered=Object.fromEntries(Object.entries(p).reverse());reordered.capacity=Object.fromEntries(Object.entries(p.capacity).reverse());reordered.demandProfiles=Object.fromEntries(Object.entries(p.demandProfiles).reverse())
 const other=createResourcePoolPublisher({...f.deps,rawPolicy:reordered})
 assert.equal(other.bindingRevision,f.publisher.bindingRevision);assert.equal(other.policy.localPolicyRevision,'revision-A')
 p.localPolicyRevision='revision-B'
 assert.notEqual(createResourcePoolPublisher({...f.deps,rawPolicy:p}).bindingRevision,f.publisher.bindingRevision)
})
for(const stamp of ['1970-01-01T02:00:01.000+02:00','1969-12-31T20:30:01.000-03:30','1970-01-01T14:00:01+14:00','1969-12-31T10:00:01.000000-14:00','1970-01-01T00:00:01.000+00:00'])test(`exact observation epoch readback accepts supported numeric offset ${stamp}`,async()=>{
 const f=fixture({existing:true});await f.publisher.configure()
 f.rpcHook=(_name,args)=>{f.row.observed={...args.p_observed};f.row.observed_at=stamp;return {data:true,error:null}}
 assert.equal((await f.publisher.publish()).state,'published');assert.equal(f.writes.length,1)
})
for(const stamp of ['1970-01-01T24:00:01+02:00','1970-02-30T02:00:01+02:00','1970-01-01T02:60:01+02:00','1970-01-01T02:00:01+02:60','1970-01-01T02:00:01+14:01','1970-01-01T02:00:01+15:00','1970-01-01T00:00:01-00:00','1970-01-01T02:00:01.000001+02:00','1970-01-01T02:00:01','1970-01-01T02:00:01.001+02:00'])test(`invalid or nonmatching numeric-offset readback stays unconfirmed ${stamp}`,async()=>{
 const f=fixture({existing:true});await f.publisher.configure()
 f.rpcHook=(_name,args)=>{f.row.observed={...args.p_observed};f.row.observed_at=stamp;return {data:true,error:null}}
 assert.equal((await f.publisher.publish()).state,'unknown');assert.equal((await f.publisher.publish()).reason,'reconcile_required');assert.equal(f.writes.length,1)
})
test('missing or denied scoped read RPC refuses before any write, without generic table fallback',async()=>{
 const f=fixture();f.readHook=()=>({data:null,error:{code:'rpc_missing_or_denied'}})
 assert.equal((await f.publisher.configure()).state,'unknown');assert.equal(f.reads,1);assert.equal(f.writes.length,0)
})
for(const key of ['host_id','pool_id'])test(`scoped read RPC returning foreign ${key} refuses before any write`,async()=>{
 const f=fixture({existing:true});f.row[key]='foreign'
 assert.equal((await f.publisher.configure()).state,'unknown');assert.equal(f.reads,1);assert.equal(f.writes.length,0)
})
