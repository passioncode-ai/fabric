import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {AccessService} from '../../../../apps/desktop/src/main/accessService.ts'
import {memStore,fakeRegistry} from '../../../../apps/desktop/test/helpers/access-memstore.mjs'
console.log('CANDIDATE '+execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim())
let clock=Date.parse('2026-10-04T10:00:00Z')
const store=memStore({now:()=>clock}),shown=[]
const access=new AccessService({store,registry:fakeRegistry(['example-agent']),present:p=>shown.push(p),connected:async()=>true,now:()=>clock})
const door={kind:'door'},actor={kind:'person',id:'operator'}
const ask=n=>({agentId:'example-agent',callee:'fabric-inbox',capabilities:['read_message'],resources:[`denial${n}@example.com`],reason:'independent standing refusal probe'})
for(let n=0;n<501;n++){
 const result=await access.request(door,ask(n)); assert.equal(result.ok,true)
 assert.deepEqual(await access.decide(result.requestId,'denied',actor),{ok:true});clock+=1000
}
assert.equal(await store.countRequests({status:'denied',standingOnly:true}),501)
assert.equal((await store.requests({status:'denied',standingOnly:true})).length,500)
const before=shown.length,repeated=await access.request(door,ask(0))
console.log('MEASURE standing denials501; denial read500; oldest exact denied request repeated='+repeated.status+'; new prompts='+String(shown.length-before))
const latest=await access.request(door,ask(500))
console.log('CONTROL newest exact denied request repeated='+latest.status+'; new prompts='+String(shown.length-before))
console.log('LIMIT model: actual AccessService plus capped in-memory AccessStore; SQL pagination source independently read; no real UI or gateway')
