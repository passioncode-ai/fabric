import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
const source=path.join(process.argv[2],'apps/desktop/src/shared/resourceAdmission.ts')
const hash=createHash('sha256').update(readFileSync(source)).digest('hex');assert.equal(hash,'d620be510115f963f3637bcb1c9badbb810a1d9464c785ba39ac5e591da9440a')
const {assessResourceAdmission:assess}=await import(pathToFileURL(source).href)
const v={workerSlots:1,memoryBytes:1,diskBytes:1,cpuMilliCores:1}
const identity={hostId:'h',poolId:'p',localPolicyRevision:'r',reservationId:'child',attemptId:'child-attempt',fence:2,ownerId:'o',role:'test',inputDigest:'a'.repeat(64),scopeDigest:'b'.repeat(64)}
const parent={reservationId:'parent',attemptId:'parent-attempt',fence:1,rootReservationId:'root'}
const request={...identity,demand:v,parent}
const context={nowMs:1,policy:{hostId:'h',poolId:'p',localPolicyRevision:'r',maxAgeMs:1,capacity:v},snapshot:{id:'s',hostId:'h',poolId:'p',localPolicyRevision:'r',atMs:1,reserved:v,observed:v,reservedObserved:v}}
const owned={state:'held',identity,snapshotId:'s',atMs:1},parentProof={...owned,parent,rootCharged:v,parentCapacity:v,remaining:v}
let invoked=0,unhandled=0,cases=0;const observer=()=>{unhandled++};process.on('unhandledRejection',observer)
for(const checker of ['ownership','parent'])for(const kind of ['rejected-native','native-own-then-getter','foreign-thenable-getter','prototype-spoof']){
 const checks={ownership:()=>owned,parent:()=>parentProof}
 let raw
 if(kind==='rejected-native'||kind==='native-own-then-getter')raw=Promise.reject(Error('synthetic'))
 else raw=kind==='prototype-spoof'?Object.create(Promise.prototype):{}
 if(kind!=='rejected-native')Object.defineProperty(raw,'then',{get(){invoked++;throw Error('must not read')}})
 checks[checker]=()=>raw
 const result=assess(request,context,checks);assert.notEqual(result.state,'eligible');assert.equal(result.executionAuthorized,false)
 await new Promise(resolve=>setImmediate(resolve));cases++
}
process.off('unhandledRejection',observer);assert.equal(invoked,0);assert.equal(unhandled,0)
console.log(JSON.stringify({verdict:'PASS',sourceHash:hash,cases,getterInvocations:invoked,unhandledRejections:unhandled,limit:'Exotic Promise subclass or own constructor override remains outside trusted synchronous dependency contract.'}))
