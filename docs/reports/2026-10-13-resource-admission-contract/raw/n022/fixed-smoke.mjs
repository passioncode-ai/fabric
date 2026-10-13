import {realpath,stat} from 'node:fs/promises'
import {createResourceHostSampler} from './apps/desktop/src/main/resourceHostSampler.ts'
const folder=await realpath(process.cwd()),device=(await stat(folder,{bigint:true})).dev.toString()
const v={workerSlots:10,memoryBytes:5000,diskBytes:9000,cpuMilliCores:8000},d={...v,workerSlots:1}
const p={hostId:'installation',poolId:'explicit-pool',localPolicyRevision:'policy-1',capacity:v,demandProfiles:{builder:d,reviewer:d,test:d},diskPath:folder,diskDeviceId:device,maxAgeMs:1000,sampleWindowMs:50,timeoutMs:1000}
for(let n=0;n<160;n++) {const s=createResourceHostSampler(p,'installation',{identity:()=>({hostId:'installation',bootId:'owned-smoke'})});const r=await s.sample(); console.log(JSON.stringify({n,reason:r.reason,durationMs:r.durationMs,knownPhysical:r.physical!==null,workerSlots:r.axes.workerSlots}))}
