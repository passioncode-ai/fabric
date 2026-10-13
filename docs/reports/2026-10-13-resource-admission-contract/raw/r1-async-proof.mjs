import {pathToFileURL} from 'node:url'
import path from 'node:path'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const source=path.join(process.argv[2],'apps/desktop/src/shared/resourceAdmission.ts')
const {assessResourceAdmission}=await import(pathToFileURL(source).href)
const v={workerSlots:1,memoryBytes:1,diskBytes:1,cpuMilliCores:1},zero={workerSlots:0,memoryBytes:0,diskBytes:0,cpuMilliCores:0}
const request={hostId:'h',poolId:'p',localPolicyRevision:'r',reservationId:'res',attemptId:'a',fence:1,ownerId:'o',role:'builder',inputDigest:'a'.repeat(64),scopeDigest:'b'.repeat(64),demand:v}
const context={nowMs:1,policy:{hostId:'h',poolId:'p',localPolicyRevision:'r',maxAgeMs:1,capacity:v},snapshot:{id:'s',hostId:'h',poolId:'p',localPolicyRevision:'r',atMs:1,reserved:zero,observed:zero,reservedObserved:zero}}
let unhandled=0
process.once('unhandledRejection',()=>{unhandled++})
const result=assessResourceAdmission(request,context,{ownership:async()=>{throw Error('synthetic proof unavailable')}})
await new Promise(resolve=>setImmediate(resolve))
console.log(JSON.stringify({sourceHash:createHash('sha256').update(readFileSync(source)).digest('hex'),result,unhandledRejections:unhandled,negativeControlPassed:unhandled===0}))
