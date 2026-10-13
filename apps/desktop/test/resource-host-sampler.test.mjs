import assert from 'node:assert/strict'
import { test } from 'node:test'
import { realpath, stat } from 'node:fs/promises'
import { readResourceHostPolicy } from '../src/main/resourceHostPolicy.ts'
import { createResourceHostSampler, readResourceHostSystem, readResourceHostDisk } from '../src/main/resourceHostSampler.ts'
const vector = (workerSlots = 10) => ({ workerSlots, memoryBytes: 5000, diskBytes: 9000, cpuMilliCores: 8000 })
const config = () => ({ hostId: 'installation', poolId: 'explicit-pool', localPolicyRevision: 'policy-1', capacity: vector(),
  demandProfiles: { builder: vector(1), reviewer: vector(1), test: vector(1) }, diskPath: '/owned', diskDeviceId: '123', maxAgeMs: 100, sampleWindowMs: 5, timeoutMs: 40 })
function fixture() {
 const f={time:1000,mono:0,reads:0,identityReads:0,diskReads:0,workerReads:0,pauseReads:0}
 const deps={
  identity:()=>{f.identityReads++;return {hostId:'installation',bootId:'invocation'}},
  now:()=>f.time,monotonic:()=>f.mono,
  system:()=>{const n=f.reads++;return {totalMemory:1000,freeMemory:400,cpus:[{model:'core',times:{user:100+n*100,nice:0,sys:0,idle:300+n*300,irq:0}}]}},
  disk:()=>{f.diskReads++;return {path:'/owned',deviceId:'123',blockSize:10n,blocks:100n,availableBlocks:40n}},
  workers:()=>{f.workerReads++;return {hostId:'installation',bootId:'invocation',poolId:'explicit-pool',localPolicyRevision:'policy-1',atMs:f.time,complete:true,workers:['worker-a','worker-b']}},
  pause:async ms=>{f.pauseReads++;f.time+=ms;f.mono+=ms}
 }
 return {f,deps}
}
test('explicit policy binds independent host and freezes detached profiles without defaults',()=>{
 const raw=config(),p=readResourceHostPolicy(raw,'installation')
 raw.capacity.workerSlots=99;assert.equal(p.capacity.workerSlots,10);assert.ok(Object.isFrozen(p.demandProfiles.builder))
 assert.throws(()=>readResourceHostPolicy(config(),'foreign'))
 for(const key of Object.keys(config())) {const c=config();delete c[key];assert.throws(()=>readResourceHostPolicy(c,'installation'),key)}
 for(const bad of [NaN,Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1]) {const c=config();c.capacity.workerSlots=bad;assert.throws(()=>readResourceHostPolicy(c,'installation'))}
 const oversized=config();oversized.demandProfiles.builder.workerSlots=11;assert.throws(()=>readResourceHostPolicy(oversized,'installation'))
 const getter=config();Object.defineProperty(getter,'hostId',{get(){throw Error('getter invoked')}});assert.throws(()=>readResourceHostPolicy(getter,'installation'),/invalid resource data/)
})
test('actual counter delta, disk bytes and used memory remain distinct from configured ceilings',async()=>{
 const {deps}=fixture(),sample=await createResourceHostSampler(config(),'installation',deps).sample()
 assert.equal(sample.state,'observed');assert.deepEqual(sample.observed,{workerSlots:2,memoryBytes:600,diskBytes:600,cpuMilliCores:250})
 assert.deepEqual(sample.physical,{memoryTotalBytes:1000,diskTotalBytes:1000,cpuMilliCores:1000})
 assert.equal(sample.atMs,1000);assert.equal(sample.completedAtMs,1005);assert.equal(sample.durationMs,5)
 assert.match(sample.policyDigest,/^[a-f0-9]{64}$/);assert.match(sample.snapshotId,/^[a-f0-9]{64}$/)
 assert.equal('reserved' in sample,false);assert.equal('reservedObserved' in sample,false)
})
for(const kind of ['absent','incomplete','wrong-host','wrong-boot','wrong-pool','wrong-policy','future','stale','duplicate','getter'])test(`unknown worker coverage never becomes zero: ${kind}`,async()=>{
 const {deps}=fixture(),read=deps.workers
 if(kind==='absent') delete deps.workers
 else deps.workers=()=>{const w=read();if(kind==='incomplete')w.complete=false;if(kind==='wrong-host')w.hostId='other';if(kind==='wrong-boot')w.bootId='other';if(kind==='wrong-pool')w.poolId='other';if(kind==='wrong-policy')w.localPolicyRevision='other';if(kind==='future')w.atMs+=50;if(kind==='stale')w.atMs-=101;if(kind==='duplicate')w.workers=['same','same'];if(kind==='getter')Object.defineProperty(w.workers,'0',{get(){throw Error('getter invoked')}});return w}
 const r=await createResourceHostSampler(config(),'installation',deps).sample()
 assert.equal(r.state,'unknown');assert.equal(r.observed,null);assert.equal(r.axes.workerSlots,null);assert.equal(r.axes.memoryBytes,600)
})
for(const kind of ['foreign-host','restarted','disk-device','disk-path','disk-negative','disk-overflow','cpu-reset','cpu-empty','cpu-topology','memory-change','clock-back','clock-stale','mono-stale'])test(`source or freshness mismatch refuses observation: ${kind}`,async()=>{
 const {f,deps}=fixture(),readSystem=deps.system,readDisk=deps.disk,readIdentity=deps.identity,pause=deps.pause
 deps.identity=()=>{const i=readIdentity();if(kind==='foreign-host')i.hostId='other';if(kind==='restarted'&&f.identityReads>1)i.bootId='new';return i}
 deps.disk=()=>{const d=readDisk();if(kind==='disk-device')d.deviceId='124';if(kind==='disk-path')d.path='/foreign';if(kind==='disk-negative')d.availableBlocks=-1n;if(kind==='disk-overflow')d.blocks=BigInt(Number.MAX_SAFE_INTEGER);return d}
 deps.system=()=>{const s=readSystem();if(kind==='cpu-empty')s.cpus=[];if(kind==='cpu-reset'&&f.reads>1)s.cpus[0].times.user=0;if(kind==='cpu-topology'&&f.reads>1)s.cpus[0].model='other';if(kind==='memory-change'&&f.reads>1)s.totalMemory=1001;return s}
 deps.pause=async ms=>{await pause(ms);if(kind==='clock-back')f.time=999;if(kind==='clock-stale')f.time=1200;if(kind==='mono-stale')f.mono=200}
 const r=await createResourceHostSampler(config(),'installation',deps).sample();assert.equal(r.state,'unknown');assert.equal(r.observed,null);assert.equal(r.reason,'unavailable')
})
test('a timed-out read retains one slot across ten retries, ignores late success and resumes only after settlement',async()=>{
 const {f,deps}=fixture(),disk=deps.disk;let finish,count=0
 deps.disk=()=>{count++;return new Promise(resolve=>finish=resolve)}
 const sampler=createResourceHostSampler({...config(),timeoutMs:10},'installation',deps)
 assert.equal((await sampler.sample()).state,'unknown')
 for(let n=0;n<10;n++)assert.equal((await sampler.sample()).reason,'busy')
 assert.equal(count,1);assert.equal(f.pauseReads,0);assert.equal(f.workerReads,0)
 finish(disk());await new Promise(resolve=>setImmediate(resolve))
 assert.equal(f.pauseReads,0,'late disk result cannot initiate later worker/pause/CPU reads')
 // This instance captured the dependency; later invocations may complete normally.
 const later=sampler.sample();await new Promise(resolve=>setImmediate(resolve));finish(disk());assert.equal((await later).state,'observed')
})
test('late rejected sampling I/O frees the slot without an unhandled rejection',async()=>{
 const {deps}=fixture();let reject
 deps.disk=()=>new Promise((_,r)=>reject=r)
 const sampler=createResourceHostSampler({...config(),timeoutMs:10},'installation',deps)
 assert.equal((await sampler.sample()).state,'unknown');reject(Error('private path/token'));await new Promise(resolve=>setImmediate(resolve))
 const later=sampler.sample();await new Promise(resolve=>setImmediate(resolve));reject(Error('private'));assert.equal((await later).reason,'unavailable')
})
test('accidental rejected async clock is unknown and consumed',async()=>{
 const {deps}=fixture();deps.now=()=>Promise.reject(Error('synthetic clock'))
 assert.equal((await createResourceHostSampler(config(),'installation',deps).sample()).state,'unknown')
 await new Promise(resolve=>setImmediate(resolve))
})
test('real OS reader and canonical statfs smoke uses no worker zero or inferred policy',async()=>{
 const folder=await realpath(process.cwd()),device=(await stat(folder,{bigint:true})).dev.toString()
 const system=readResourceHostSystem(),disk=await readResourceHostDisk(folder)
 assert.ok(system.totalMemory>0);assert.ok(system.cpus.length>0);assert.equal(disk.path,folder);assert.equal(disk.deviceId,device)
 const p={...config(),diskPath:folder,diskDeviceId:device,sampleWindowMs:50,maxAgeMs:1000,timeoutMs:1000}
 const sampler=createResourceHostSampler(p,'installation',{identity:()=>({hostId:'installation',bootId:'owned-smoke'})})
 const result=await sampler.sample()
 assert.equal(result.state,'unknown');assert.equal(result.reason,'worker-inventory-unavailable');assert.equal(result.axes.workerSlots,null)
 for(const key of ['memoryBytes','diskBytes','cpuMilliCores'])assert.ok(Number.isSafeInteger(result.axes[key])&&result.axes[key]>=0,key)
 assert.ok(result.durationMs>=50);assert.ok(result.physical.memoryTotalBytes>0)
})

test('early timer wake waits for the monotonic sample window before reading CPU again',async()=>{
 const {f,deps}=fixture();let pauses=0
 deps.pause=async ms=>{pauses++;f.time+=Math.ceil(ms);f.mono+=pauses===1?ms-0.5:ms}
 const r=await createResourceHostSampler(config(),'installation',deps).sample()
 assert.equal(r.state,'observed');assert.equal(r.observed.cpuMilliCores,250)
 assert.equal(pauses,2);assert.ok(r.durationMs>=5);assert.equal(f.reads,2)
})
test('nonprogressing injected timer cannot create an unbounded resampling loop',async()=>{
 const {f,deps}=fixture();deps.pause=async()=>{f.pauseReads++}
 const r=await createResourceHostSampler(config(),'installation',deps).sample()
 assert.equal(r.state,'unknown');assert.ok(f.pauseReads<=3);assert.equal(f.reads,1)
})
