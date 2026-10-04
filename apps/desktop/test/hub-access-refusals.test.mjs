// #region hub-access-refusals — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#2-an-agent-is-admitted-by-device-style-consent-not-by-a-pasted-key
import assert from 'node:assert/strict'
import test from 'node:test'
import { AccessService } from '../src/main/accessService.ts'
import { ops } from '../src/main/opsSink.ts'
const ask = { agentId:'example-agent',callee:'fabric-inbox',capabilities:['read_message'],resources:['news@example.com'],reason:'read news' }
const entry={key:'example-agent.default',name:'Example',kind:'service',installedBy:'example-installer',repository:null}
test('DA-5 every queue/standing-denial duplicate refusal leaves a bounded operation receipt', async()=>{
 const recorded=[]; const saved=ops.record; ops.record=x=>recorded.push(x)
 try {
  for (const code of ['per-agent-cap','queue-full','denied-standing','already-pending']) {
   const row={id:'request',agent_id:entry.key,callee:ask.callee,capabilities:ask.capabilities,resources:['cloudflare:news@example.com'],denial_cleared_at:null,asked_by_binding:null,expires_at:new Date(Date.now()+600000).toISOString()}
   const store={ requests: async filter=> filter.status==='denied'&&code==='denied-standing'||filter.status==='pending'&&code==='already-pending'?[row]:[],countRequests: async filter=>code==='per-agent-cap'?3:code==='queue-full'&&!filter.agentId?20:0 }
   const service=new AccessService({store,registry:{refresh(){},resolve(){return {ok:true,entry}}},present(){throw Error('should not prompt')},connected:async()=>true})
   await service.request({kind:'door'},ask)
   assert.equal(recorded.at(-1)?.detail?.code,code)
   assert.equal(recorded.at(-1)?.op,'hub.access.refused')
  }
 } finally { ops.record=saved }
})

test('ER-3 restarting the hub recognizes a valid credential before any successful authentication',async()=>{
 const { createHash }=await import('node:crypto')
 const credential='c'.repeat(43),hash=createHash('sha256').update(credential).digest('hex')
 const b={id:'binding',verifier:hash,revoked_at:null}
 const store={liveBindings:async()=>[b],binding:async()=>b,append:async()=>1,bindingByVerifier:async h=>h===hash?b:null}
 const service=new AccessService({store,registry:{},present(){},connected:async()=>true})
 await service.primeCredentialVerifiers()
 assert.equal(service.knownCredential(credential),true)
 assert.equal(service.knownCredential('x'.repeat(43)),false)
 await service.revokeBinding(b.id,{kind:'person',id:'operator'})
 assert.equal(service.knownCredential(credential),false)
})
// #endregion hub-access-refusals
