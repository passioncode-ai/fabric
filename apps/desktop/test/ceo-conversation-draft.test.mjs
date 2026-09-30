import assert from 'node:assert/strict'
import { prepareCeoDraft,validateCeoDraftFile,emptyCeoDrafts,ceoJson,parseCeoAccepted,CEO_DRAFT_LIMITS } from '../src/shared/ceoConversationDraft.ts'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const context={schema:'CeoContext@1',mode:'none',selection_revision:0,project_id:null,project_revision:null,estate_seq:0}
const draft=n=>prepareCeoDraft({conversation_id:id(n),version:id(n+1000),text:'Draft text',context,expected_revision:0,subject_revision:1})
const intent=n=>({conversation_id:id(n),operation_id:id(n+100),draft_version:id(n+1000),envelope:{schema:'CeoSend@1',operation_id:id(n+100),conversation_id:id(n),message_id:id(n+200),expected_revision:0,subject_revision:1,input_channel:'text',text:'Draft text',preparation_version:'har06-ceo-v1',context},status:'saved_locally',attempts:0,receipt:null,reason_code:null})
const empty=emptyCeoDrafts(id(1),id(2))
assert.deepEqual(validateCeoDraftFile(empty),empty)
const full={...empty,drafts:Array.from({length:CEO_DRAFT_LIMITS.records},(_,i)=>draft(i+1))}
assert.ok(validateCeoDraftFile(full));assert.equal(validateCeoDraftFile({...full,drafts:[...full.drafts,draft(99)]}),null)
assert.equal(validateCeoDraftFile({...empty,drafts:[draft(1),draft(1)]}),null)
const waiting={...empty,intents:Array.from({length:CEO_DRAFT_LIMITS.unresolved},(_,i)=>intent(i+1))}
assert.ok(validateCeoDraftFile(waiting));assert.equal(validateCeoDraftFile({...waiting,intents:[...waiting.intents,intent(99)]}),null)
assert.equal(validateCeoDraftFile({...empty,intents:[intent(1),{...intent(2),conversation_id:id(1),envelope:{...intent(2).envelope,conversation_id:id(1)}}]}),null)
const unknown={...intent(1),status:'commit_unknown',attempts:1}
assert.ok(validateCeoDraftFile({...empty,intents:[unknown]}))
for(const bad of [{...unknown,attempts:0},{...unknown,attempts:4},{...unknown,status:['commit_unknown']},{...unknown,receipt:{}},{...unknown,reason_code:'raw sensitive diagnostic'},{...unknown,draft_version:1}])assert.equal(validateCeoDraftFile({...empty,intents:[bad]}),null)
const unprepared={...draft(1),text:'SERVICE_TOKEN=syntheticDraftToken'}
assert.equal(validateCeoDraftFile({...empty,drafts:[unprepared]}),null)
assert.ok(!prepareCeoDraft(unprepared).text.includes('syntheticDraftToken'))
assert.equal(validateCeoDraftFile({...empty,intents:[{...intent(1),envelope:{...intent(1).envelope,text:'SERVICE_TOKEN=syntheticDraftToken'}}]}),null)
for(const value of ['','\t\n  ','\u00a0'])assert.ok(prepareCeoDraft({...draft(1),text:value}))
for(const value of ['\0','\ud800','x'.repeat(32769)])assert.equal(prepareCeoDraft({...draft(1),text:value}),null)
assert.equal(prepareCeoDraft({...draft(1),context:{...context,mode:'all'}}),null)
let called=false;const hostile={...draft(1)};Object.defineProperty(hostile,'text',{enumerable:true,get(){called=true;return 'getter'}})
assert.equal(validateCeoDraftFile({...empty,drafts:[hostile]}),null);assert.equal(called,false)
const cyc={};cyc.x=cyc;assert.throws(()=>ceoJson(cyc))
let deep='x';for(let i=0;i<10;i++)deep={deep};assert.throws(()=>ceoJson(deep))
assert.throws(()=>ceoJson({toJSON(){called=true}}));assert.equal(called,false)
assert.throws(()=>ceoJson({body:'x'.repeat(65537)}));assert.throws(()=>ceoJson(Array(65).fill(null)))
assert.equal(parseCeoAccepted({ok:true,state:'accepted_pending'}),null)
console.log('PASS draft contract: record/pending caps, immutable prepared intent, UUID edit identity, strict receipt/schema, descriptor/depth/byte bounds')
