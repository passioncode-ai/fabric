// Fixture setup adapted from builder suite; review cases are independently authored.
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const {createResourcePoolPublisher}=await import(pathToFileURL(process.env.N025_SOURCE))
const v=(workerSlots=10)=>({workerSlots,memoryBytes:1000,diskBytes:1000,cpuMilliCores:1000})
const config=()=>({hostId:'host',poolId:'pool',localPolicyRevision:'revision-A',capacity:v(),demandProfiles:{builder:v(1),reviewer:v(1),test:v(1)},diskPath:'/owned',diskDeviceId:'1',maxAgeMs:100,sampleWindowMs:5,timeoutMs:40})
function fixture({existing=false,timeoutMs=100,policy=config()}={}) {
 const f={row:null,reads:0,writes:[],systemReads:0,wall:1000,mono:0,identity:{hostId:'host',bootId:'boot'},columns:null,filters:null}
 const pool=(generation=1)=>({host_id:'host',pool_id:'pool',policy_revision:policy.localPolicyRevision,configuration_generation:generation,capacity:structuredClone(policy.capacity),max_age_ms:policy.maxAgeMs,observed:null,observed_at:null})
 if(existing)f.row=pool()
 const db={from(table){assert.equal(table,'resource_pools');let filters=[];return {select(columns){f.columns=columns;return this},eq(key,value){filters.push([key,value]);return this},async maybeSingle(){f.reads++;f.filters=filters;assert.deepEqual(filters,[['host_id','host'],['pool_id','pool']]);if(f.readHook){const r=await f.readHook();if(r!==undefined)return r}return {data:structuredClone(f.row),error:null}}}},
  async rpc(name,args){f.writes.push({name,args:structuredClone(args)});if(f.rpcHook){const r=await f.rpcHook(name,args);if(r!==undefined)return r}
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

export {fixture,config};
