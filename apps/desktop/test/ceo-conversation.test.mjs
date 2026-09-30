import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { prepareCeoSend,canonicalCeoSend,CEO_LIMITS } from '../src/shared/ceoConversation.ts'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
export const golden={schema:'CeoSend@1',operation_id:id(3),conversation_id:id(4),message_id:id(5),expected_revision:0,subject_revision:0,input_channel:'text',text:'Привет\n雪: | 😀',preparation_version:'har06-ceo-v1',context:{schema:'CeoContext@1',mode:'none',selection_revision:0,project_id:null,project_revision:null,estate_seq:0}}
const p=prepareCeoSend(golden);assert.equal(p.ok,true)
const bytes=canonicalCeoSend(id(1),id(2),golden)
assert.ok(bytes.includes('24:Привет\n雪: | 😀'))
assert.ok(bytes.endsWith('4:none1:0-1:-1:1:0'))
assert.deepEqual(prepareCeoSend(p.value),p)
for(const field of ['schema','operation_id','text','input_channel','expected_revision','preparation_version']) {
  assert.equal(prepareCeoSend({...golden,[field]:null}).ok,false)
  assert.equal(prepareCeoSend({...golden,[field]:[golden[field]]}).ok,false)
}
for(const text of ['\ud800','\udc00','\0','   ','x'.repeat(CEO_LIMITS.bodyBytes+1)]) assert.equal(prepareCeoSend({...golden,text}).ok,false)
assert.equal(prepareCeoSend({...golden,text:'x'.repeat(CEO_LIMITS.bodyBytes)}).ok,true)
assert.equal(prepareCeoSend({...golden,text:'雪'.repeat(Math.floor(CEO_LIMITS.bodyBytes/3)+1)}).ok,false)
assert.equal(prepareCeoSend({...golden,context:{...golden.context,mode:'all'}}).ok,false)
assert.equal(prepareCeoSend({...golden,context:{...golden.context,project_id:id(7)}}).ok,false)
assert.equal(prepareCeoSend({...golden,context:{...golden.context,estate_seq:2**53}}).ok,false)
let called=false; const getter={...golden};Object.defineProperty(getter,'text',{enumerable:true,get(){called=true;return 'unsafe'}})
assert.equal(prepareCeoSend(getter).ok,false);assert.equal(called,false)
assert.equal(prepareCeoSend({...golden,toJSON(){called=true;return golden}}).ok,false);assert.equal(called,false)
const raw={...golden,text:'SERVICE_TOKEN=syntheticSecretCanary'}
const clean=prepareCeoSend(raw);assert.equal(clean.ok,true);assert.ok(!clean.value.text.includes('syntheticSecretCanary'))
assert.throws(()=>canonicalCeoSend(id(1),id(2),raw),/unprepared_input/)
assert.equal(raw.text,'SERVICE_TOKEN=syntheticSecretCanary')
console.log('PASS CEO preparation: strict fields, Unicode, bounds, canonical framing, redaction, no getters')
assert.equal(createHash('sha256').update(bytes).digest('hex'),'dffdd4f0c485a4e9fa2bc459e63fb501f7ad37017d4a61d5fb6ea7a1ce864b9d')
