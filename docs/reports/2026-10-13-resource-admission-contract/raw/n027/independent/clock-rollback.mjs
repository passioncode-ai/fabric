import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const {createResourcePoolAccountingReader}=await import(pathToFileURL(process.env.N027_SOURCE).href)
const v=n=>({workerSlots:n,memoryBytes:n,diskBytes:n,cpuMilliCores:n})
const rawPolicy={hostId:'host',poolId:'pool',localPolicyRevision:'human',capacity:v(100),demandProfiles:{builder:v(1),reviewer:v(1),test:v(1)},diskPath:'/disk',diskDeviceId:'1',maxAgeMs:100,sampleWindowMs:5,timeoutMs:20}
let clocks=0,reader
reader=createResourcePoolAccountingReader({rawPolicy,trustedHostId:'host',expectedGeneration:1,maxRoots:2,timeoutMs:100,now:()=>clocks++===0?1000:950,db:{async rpc(){return {data:{state:'observed',hostId:'host',poolId:'pool',bindingRevision:reader.bindingRevision,configurationGeneration:1,capacity:v(100),maxAgeMs:100,observed:v(2),observedAtMs:880,reserved:v(3),rootCount:1,snapshotAtMs:900},error:null}}}})
const result=await reader.read();console.log(JSON.stringify({result:result.state,clocks,start:1000,end:950,observation:880,maxAge:100}));assert.notEqual(result.state,'observed','clock rollback cannot revive evidence already stale at start')
