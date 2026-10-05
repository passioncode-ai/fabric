import assert from 'node:assert/strict'
import { mkdtempSync,readFileSync,writeFileSync,rmSync,statSync,chmodSync,readdirSync,symlinkSync,mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createCeoConversationService } from '../src/main/ceoConversationService.ts'
import { canonicalCeoSend } from '../src/shared/ceoConversation.ts'
import { CEO_DRAFT_LIMITS } from '../src/shared/ceoConversationDraft.ts'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const C=id(3),OP=id(4),MSG=id(5),ctx={schema:'CeoContext@1',mode:'none',selection_revision:0,project_id:null,project_revision:null,estate_seq:0}
const draft=(text='A useful question')=>({text,context:structuredClone(ctx),expected_revision:0,subject_revision:1})
const pending=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
const roots=[]
// A test that is not about the deadline runs with a generous one. The product's own default
// (ceoConversationService.ts: `deps.timeoutMs ?? 10000`) still made `freeze` report local_save_unknown
// at load 135 during the scheduled sync (2026-10-03) — true behaviour for a slow save, a false failure
// for this test. Tests about the deadline set their own (5–150 ms) explicitly.
const CEO_TEST_DEFAULT_TIMEOUT_MS=60000
function fixture(options={}){
 const dir=mkdtempSync(path.join(tmpdir(),'fabric-ceo-service-'));roots.push(dir)
 const initial={estateId:id(1),personId:id(2),revision:1,actor:{kind:'person',id:id(2)}}
 const state={held:initial,valid:true,online:true,guard:null,send:null,read:null,receipt:null,open:null}
 const calls=[],accepted=new Map()
 const receiptFor=p=>({ok:true,conversation_id:p.conversation_id,operation_id:p.operation_id,message_id:p.message_id,request_id:id(90),revision:p.expected_revision+1,receipt_seq:10,canonical_digest:createHash('sha256').update(canonicalCeoSend(initial.estateId,initial.personId,p)).digest('hex'),state:'accepted_pending',dispatch:'unavailable',repeated:false})
 const commit=p=>{let row=accepted.get(p.operation_id);if(!row){row={envelope:structuredClone(p),receipt:receiptFor(p)};accepted.set(p.operation_id,row)}else assert.equal(JSON.stringify(row.envelope),JSON.stringify(p));return structuredClone(row.receipt)}
 const rpc={
  open:async(a,f)=>{assert.equal(f(),true);calls.push({name:'open',a:structuredClone(a)});return state.open?state.open(a):{data:{ok:true,conversation_id:a.p_conversation_id,revision:0,receipt_seq:1,repeated:false}}},
  send:async(a,f)=>{assert.equal(f(),true);calls.push({name:'send',a:structuredClone(a)});return state.send?state.send(a,f):{data:commit(a.p_envelope)}},
  receipt:async(a,f)=>{assert.equal(f(),true);calls.push({name:'receipt',a:structuredClone(a)});if(state.receipt)return state.receipt(a);const row=accepted.get(a.p_operation_id);return {data:row?{...row.receipt,repeated:true}:{ok:false,reason_code:'not_found'}}},
  read:async(a,f)=>{assert.equal(f(),true);calls.push({name:'read',a:structuredClone(a)});if(state.read)return state.read(a);const rows=[...accepted.values()].filter(x=>x.envelope.conversation_id===a.p_conversation_id)
   return {data:{ok:true,conversation_id:a.p_conversation_id,revision:rows.length,subject:{kind:'project',id:id(7),owner_project_id:id(7),current:{revision:1,project_id:id(7),active:true,status:'active'}},messages:rows.map(row=>({message_id:row.envelope.message_id,ordinal:row.receipt.revision,request_id:row.receipt.request_id,receipt_seq:10,content_state:'available',envelope:Object.fromEntries(Object.entries(row.envelope).reverse()),canonical_digest:row.receipt.canonical_digest,dispatch:'unavailable'})),next_ordinal:null}}
  }
 }
 const deps={rootDir:dir,identity:{held:()=>state.held,guard:async()=>state.guard?state.guard():state.valid?state.held:null},rpc,online:()=>state.online,timeoutMs:options.timeoutMs??CEO_TEST_DEFAULT_TIMEOUT_MS}
 const service=createCeoConversationService(deps)
 const ns=()=>path.join(dir,'ceo-conversations',initial.estateId,initial.personId)
 const file=()=>path.join(ns(),'drafts.json')
 return {dir,state,calls,accepted,commit,receiptFor,deps,service,ns,file,initial}
}
async function freeze(f,text='A useful question',cid=C,op=OP,msg=MSG){
 const read=await f.service.readDraft(cid);assert.equal(read.ok,true,JSON.stringify(read))
 const saved=await f.service.saveDraft(cid,read.value.revision,draft(text));assert.equal(saved.ok,true,JSON.stringify(saved))
 const frozen=await f.service.freezeSend(cid,saved.value.revision,{operationId:op,messageId:msg});assert.equal(frozen.ok,true,JSON.stringify(frozen));return frozen
}
let groups=0;async function test(name,fn){await fn();groups++;console.log('PASS '+name)}
try{
await test('prepared private draft uses real CAS files, permissions and namespace; original input untouched',async()=>{
 const f=fixture(),input=draft('SERVICE_TOKEN=syntheticPrivateCanary')
 const r=await f.service.saveDraft(C,null,input);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(input.text,'SERVICE_TOKEN=syntheticPrivateCanary')
 assert.ok(!readFileSync(f.file(),'utf8').includes('syntheticPrivateCanary'))
 assert.equal(statSync(f.ns()).mode&0o777,0o700);for(const name of readdirSync(f.ns()))assert.equal(statSync(path.join(f.ns(),name)).mode&0o777,0o600)
 assert.equal((await f.service.saveDraft(C,null,draft('replacement'))).reason_code,'draft_conflict')
 const other=createCeoConversationService(f.deps),a=await f.service.readDraft(C),b=await other.readDraft(C)
 const [x,y]=await Promise.all([f.service.saveDraft(C,a.value.revision,draft('first')),other.saveDraft(C,b.value.revision,draft('second'))])
 assert.deepEqual([x.ok,y.ok],[true,false]);assert.equal(y.reason_code,'draft_conflict')
})
await test('input is captured before async guard and getter never executes',async()=>{
 const f=fixture(),wait=pending();f.state.guard=()=>wait.promise
 const input=draft('Original'),task=f.service.saveDraft(C,null,input);input.text='Changed';wait.resolve(f.initial)
 const result=await task;assert.equal(result.value.draft.text,'Original')
 let invoked=false;const bad={...draft()};Object.defineProperty(bad,'text',{enumerable:true,get(){invoked=true;return 'bad'}})
 assert.equal((await f.service.saveDraft(C,result.value.revision,bad)).ok,false);assert.equal(invoked,false)
})
await test('offline frozen input survives cold restart, remains distinct from SQL acceptance, and returns real history',async()=>{
 const f=fixture();await freeze(f);f.state.online=false
 assert.equal((await f.service.send(C,OP)).state,'saved_locally');assert.equal(f.calls.length,0)
 const reopened=createCeoConversationService(f.deps);f.state.online=true
 const result=await reopened.send(C,OP);assert.equal(result.state,'accepted_pending',JSON.stringify(result));assert.equal(f.accepted.size,1)
 assert.equal((await reopened.readDraft(C)).value.draft,null)
 const history=await reopened.read(C);assert.equal(history.ok,true,JSON.stringify(history));assert.equal(history.value.messages[0].envelope.text,'A useful question')
 assert.equal((await reopened.send(C,OP)).state,'accepted_pending');assert.equal(f.calls.filter(x=>x.name==='send').length,1)
 assert.equal(f.calls[0].a.p_person_id,f.initial.personId);assert.equal(f.calls[0].a.p_revision,1)
})
await test('lost SQL reply stays unknown; restart reconciles original IDs without a second send',async()=>{
 const f=fixture();await freeze(f);f.state.send=a=>{f.commit(a.p_envelope);throw new Error('synthetic secret diagnostic')}
 const failed=await f.service.send(C,OP);assert.equal(failed.state,'commit_unknown');assert.ok(!JSON.stringify(failed).includes('synthetic secret'))
 const again=createCeoConversationService(f.deps),result=await again.reconcile(C,OP);assert.equal(result.state,'accepted_pending',JSON.stringify(result))
 assert.equal(f.calls.filter(x=>x.name==='send').length,1);assert.equal(f.accepted.size,1)
})
await test('not-found while first request is late permits only explicit same-input retry; late commit yields one message',async()=>{
 // The short budget is for the SEND (its RPC never answers until released below), so the deadline still ends it;
 // the local saves before and inside it are fsync'd, and a busy disk measured over 150 ms per save on 2026-10-05.
 const f=fixture();await freeze(f);f.deps.timeoutMs=1500;const wait=pending();let first
 f.state.send=a=>{first=structuredClone(a.p_envelope);return wait.promise}
 const result=await f.service.send(C,OP);assert.equal(result.state,'commit_unknown')
 f.deps.timeoutMs=CEO_TEST_DEFAULT_TIMEOUT_MS
 const lookup=await f.service.reconcile(C,OP);assert.equal(lookup.reason_code,'receipt_not_found');assert.equal(f.calls.filter(x=>x.name==='send').length,1)
 f.state.send=a=>{const receipt=f.commit(first);assert.deepEqual(a.p_envelope,first);wait.resolve({data:receipt});return {data:f.commit(a.p_envelope)}}
 const retry=await f.service.retrySavedInput(C,OP);assert.equal(retry.state,'accepted_pending',JSON.stringify(retry));assert.equal(f.accepted.size,1)
 const sends=f.calls.filter(x=>x.name==='send');assert.deepEqual(sends[0].a.p_envelope,sends[1].a.p_envelope)
})
await test('coalesced send and later reply preserve newer draft/context and exact originating conversation',async()=>{
 const f=fixture();await freeze(f);const wait=pending();f.state.send=()=>wait.promise
 const a=f.service.send(C,OP),b=f.service.send(C,OP)
 while(!f.calls.length)await new Promise(r=>setTimeout(r,1))
 const old=await f.service.readDraft(C),newer=await f.service.saveDraft(C,old.value.revision,{...draft('New typing'),context:{...ctx,selection_revision:7}});assert.equal(newer.ok,true)
 assert.equal((await f.service.freezeSend(C,newer.value.revision,{operationId:OP,messageId:MSG})).reason_code,'idempotency_conflict')
 const other=await f.service.readDraft(id(20));assert.equal(other.value.draft,null)
 wait.resolve({data:f.commit(f.calls[0].a.p_envelope)})
 const [x,y]=await Promise.all([a,b]);assert.equal(x.state,'accepted_pending');assert.deepEqual(x,y);assert.equal(x.conversation_id,C)
 const retained=(await f.service.readDraft(C)).value.draft;assert.equal(retained.text,'New typing');assert.equal(retained.context.selection_revision,7)
 assert.equal(f.calls.filter(x=>x.name==='send').length,1)
})
await test('late acceptance from another service cannot clear a new draft after old draft removal (ABA)',async()=>{
 const f=fixture();await freeze(f);const second=createCeoConversationService(f.deps),wait1=pending(),wait2=pending();let n=0
 f.state.send=()=>++n===1?wait1.promise:wait2.promise
 const first=f.service.send(C,OP);while(n<1)await new Promise(r=>setTimeout(r,1))
 // Explicit retry permits a second service to reconcile an in-flight same operation.
 const later=second.retrySavedInput(C,OP);while(n<2)await new Promise(r=>setTimeout(r,1))
 const receipt=f.commit(f.calls.find(c=>c.name==='send').a.p_envelope);wait1.resolve({data:receipt});assert.equal((await first).state,'accepted_pending')
 const empty=await f.service.readDraft(C);assert.equal(empty.value.draft,null)
 const newer=await f.service.saveDraft(C,empty.value.revision,draft('New after acceptance'));assert.equal(newer.ok,true)
 wait2.resolve({data:receipt});assert.equal((await later).state,'accepted_pending')
 assert.equal((await f.service.readDraft(C)).value.draft.text,'New after acceptance')
})
await test('late first refusal cannot settle a newer unknown attempt or permit destructive cleanup',async()=>{
 const f=fixture();await freeze(f);const b=createCeoConversationService(f.deps),w1=pending(),w2=pending();let n=0
 f.state.send=a=>{if(++n===1)return w1.promise;f.commit(a.p_envelope);return w2.promise}
 const first=f.service.send(C,OP);while(n<1)await new Promise(r=>setTimeout(r,1))
 const second=b.retrySavedInput(C,OP);while(n<2)await new Promise(r=>setTimeout(r,1))
 w1.resolve({data:{ok:false,reason_code:'invalid_boundary'}});assert.equal((await first).state,'commit_unknown')
 w2.resolve({error:{message:'lost private response'},data:null});assert.equal((await second).state,'commit_unknown')
 const local=await f.service.readDraft(C);assert.equal(local.value.intents[0].status,'commit_unknown');assert.equal(local.value.intents[0].attempts,2)
 assert.equal((await f.service.forgetSettled(C,OP,local.value.revision)).reason_code,'unresolved_send')
 assert.equal((await f.service.discardDraft(C,local.value.revision)).reason_code,'unresolved_send')
 assert.equal((await f.service.reconcile(C,OP)).state,'accepted_pending');assert.equal(f.accepted.size,1)
 const g=fixture();await freeze(g);const other=createCeoConversationService(g.deps),late=pending();let count=0
 g.state.send=a=>++count===1?late.promise:{data:g.commit(a.p_envelope)}
 const old=g.service.send(C,OP);while(count<1)await new Promise(r=>setTimeout(r,1))
 assert.equal((await other.retrySavedInput(C,OP)).state,'accepted_pending')
 late.resolve({data:{ok:false,reason_code:'invalid_boundary'}});assert.equal((await old).state,'commit_unknown')
 const accepted=(await g.service.readDraft(C)).value.intents[0];assert.equal(accepted.status,'accepted_pending');assert.equal(accepted.attempts,2)
})
await test('blank draft clears persisted composer without becoming sendable; invalid IDs never become diagnostic text',async()=>{
 const f=fixture();let r=await f.service.saveDraft(C,null,draft('Previous'))
 r=await f.service.saveDraft(C,r.value.revision,draft(''));assert.equal(r.ok,true)
 const again=createCeoConversationService(f.deps);assert.equal((await again.readDraft(C)).value.draft.text,'')
 assert.equal((await again.freezeSend(C,r.value.revision,{operationId:OP,messageId:MSG})).ok,false)
 for(const result of [await again.readDraft('PRIVATE42'),await again.saveDraft('PRIVATE42',null,{}),await again.forgetSettled('PRIVATE42','PRIVATE43',r.value.revision)])assert.ok(!JSON.stringify(result).includes('PRIVATE'))
})
await test('explicit cleanup frees bounded cache slots, preserves unresolved records and never recreates forgotten send',async()=>{
 const f=fixture()
 for(let n=0;n<CEO_DRAFT_LIMITS.intents;n++){await freeze(f,'Confirmed '+n,id(1000+n),id(2000+n),id(3000+n));assert.equal((await f.service.send(id(1000+n),id(2000+n))).state,'accepted_pending')}
 const latest=await f.service.readDraft(C);assert.equal(latest.value.intents.length,0)
 const loaded=JSON.parse(readFileSync(f.file(),'utf8'));assert.equal(loaded.intents.length,32)
 assert.equal((await f.service.forgetSettled(id(1000),id(2000),latest.value.revision)).ok,true)
 const calls=f.calls.length;assert.equal((await f.service.retrySavedInput(id(1000),id(2000))).reason_code,'missing_intent');assert.equal(f.calls.length,calls)
 await freeze(f);const pendingLocal=await f.service.readDraft(C);assert.equal((await f.service.forgetSettled(C,OP,pendingLocal.value.revision)).reason_code,'unresolved_send')
 const g=fixture();let revision=null
 for(let n=0;n<CEO_DRAFT_LIMITS.records;n++){const saved=await g.service.saveDraft(id(4000+n),revision,draft());assert.equal(saved.ok,true);revision=saved.value.revision}
 assert.equal((await g.service.saveDraft(C,revision,draft())).ok,false)
 const cleaned=await g.service.discardDraft(id(4000),revision);assert.equal(cleaned.ok,true)
 assert.equal((await g.service.saveDraft(C,cleaned.value.revision,draft())).ok,true)
})
await test('identity switch/revocation suppresses late private payload and cannot clear old namespace',async()=>{
 const f=fixture();await freeze(f);const wait=pending();f.state.send=()=>wait.promise
 const sending=f.service.send(C,OP);while(!f.calls.length)await new Promise(r=>setTimeout(r,1))
 f.state.held={...f.initial,personId:id(22),actor:{kind:'person',id:id(22)}}
 wait.resolve({data:f.commit(f.calls[0].a.p_envelope)})
 const result=await sending;assert.equal(result.ok,false);assert.equal(result.state,'commit_unknown');assert.ok(!JSON.stringify(result).includes('A useful question'))
 f.state.held=f.initial;const r=await f.service.readDraft(C);assert.equal(r.value.draft.text,'A useful question');assert.equal(r.value.intents[0].status,'commit_unknown')
 f.state.valid=false;assert.equal((await f.service.readDraft(C)).ok,false);assert.equal((await f.service.read(C)).ok,false);assert.equal((await f.service.reconcile(C,OP)).ok,false)
 f.state.valid=true;assert.equal((await f.service.reconcile(C,OP)).state,'accepted_pending')
})
await test('malformed/foreign receipt never marks accepted; refusal preserves draft; read decoder bounds fail closed',async()=>{
 const f=fixture();await freeze(f);f.state.send=a=>({data:{...f.receiptFor(a.p_envelope),message_id:id(99)}})
 assert.equal((await f.service.send(C,OP)).reason_code,'invalid_receipt');assert.equal((await f.service.readDraft(C)).value.draft.text,'A useful question')
 f.state.read=()=>({data:{ok:true,conversation_id:C,revision:0,subject:{},messages:[],next_ordinal:null}})
 assert.equal((await f.service.read(C)).reason_code,'invalid_response')
 const g=fixture();await freeze(g);g.state.send=()=>({data:{ok:false,reason_code:'stale_revision'}})
 assert.equal((await g.service.send(C,OP)).reason_code,'stale_revision');assert.equal((await g.service.readDraft(C)).value.intents[0].status,'refused')
 const r=await g.service.readDraft(C);assert.equal((await g.service.forgetSettled(C,OP,r.value.revision)).ok,true)
})
await test('corrupt/missing recovery remains unreadable across restart; valid fallback is labeled recovered',async()=>{
 const f=fixture();await freeze(f);writeFileSync(f.file(),'{broken synthetic draft',{mode:0o600});rmSync(f.file()+'.last-good')
 const bad=await f.service.readDraft(C);assert.equal(bad.reason_code,'local_recovery_required')
 const again=createCeoConversationService(f.deps);assert.equal((await again.readDraft(C)).reason_code,'local_recovery_required')
 assert.equal((await again.saveDraft(C,null,draft('Overwrite'))).ok,false)
 assert.ok(readdirSync(f.ns()).some(x=>x.includes('quarantined')))
 const g=fixture();await freeze(g);writeFileSync(g.file(),'{broken',{mode:0o600})
 const restored=await g.service.readDraft(C);assert.equal(restored.ok,true);assert.equal(restored.value.local_status,'recovered');assert.equal(restored.value.draft.text,'A useful question')
})
await test('unsafe filesystem modes, symlinks, oversized bytes and failed writes do not overwrite',async()=>{
 const f=fixture();await freeze(f);chmodSync(f.file(),0o644);assert.equal((await f.service.readDraft(C)).reason_code,'unsafe_local_permissions');chmodSync(f.file(),0o600)
 const g=fixture();await freeze(g);rmSync(g.file());symlinkSync(f.file(),g.file());assert.equal((await g.service.readDraft(C)).reason_code,'unsafe_local_permissions')
 const h=fixture();await freeze(h);writeFileSync(h.file(),'x'.repeat(CEO_DRAFT_LIMITS.bytes+1),{mode:0o600});assert.equal((await h.service.readDraft(C)).reason_code,'local_capacity')
 const i=fixture();await freeze(i);mkdirSync(i.file()+'.tmp',{mode:0o700});assert.equal((await i.service.saveDraft(C,(await i.service.readDraft(C)).value?.revision??null,draft('new'))).ok,false)
})
await test('projected atomic-save namespace capacity refuses before changing acknowledged bytes',async()=>{
 const f=fixture();const original=await f.service.saveDraft(C,null,draft('Small'))
 const current=readdirSync(f.ns()).reduce((n,name)=>n+statSync(path.join(f.ns(),name)).size,0)
 let remaining=CEO_DRAFT_LIMITS.namespaceBytes-current-100
 for(let n=0;remaining>0;n++){const size=Math.min(CEO_DRAFT_LIMITS.bytes,remaining);writeFileSync(path.join(f.ns(),`drafts.json.quarantined-limit${n}`),'q'.repeat(size),{mode:0o600});remaining-=size}
 const before=Object.fromEntries(readdirSync(f.ns()).map(name=>[name,readFileSync(path.join(f.ns(),name))]))
 const result=await f.service.saveDraft(C,original.value.revision,draft('x'.repeat(32768)));assert.equal(result.reason_code,'local_capacity')
 for(const [name,bytes] of Object.entries(before))assert.deepEqual(readFileSync(path.join(f.ns(),name)),bytes)
 assert.equal((await f.service.readDraft(C)).value.draft.text,'Small')
 const g=fixture();const saved=await g.service.saveDraft(C,null,draft('Count'));rmSync(g.file()+'.last-good')
 for(let n=0;n<7;n++)writeFileSync(path.join(g.ns(),`drafts.json.quarantined-count${n}`),'q',{mode:0o600})
 const live=readFileSync(g.file());assert.equal(readdirSync(g.ns()).length,8)
 assert.equal((await g.service.saveDraft(C,saved.value.revision,draft('Replacement'))).reason_code,'local_capacity')
 assert.deepEqual(readFileSync(g.file()),live);assert.equal(readdirSync(g.ns()).length,8)
})
await test('history rejects gaps, empty/short pages and missing continuation instead of hiding messages',async()=>{
 const f=fixture();const base={ok:true,conversation_id:C,revision:2,subject:{kind:'global',id:C,owner_project_id:null,current:null},messages:[],next_ordinal:null}
 const unavailable=ordinal=>({message_id:id(500+ordinal),ordinal,request_id:id(600+ordinal),receipt_seq:10,content_state:'unavailable',envelope:null,canonical_digest:null,dispatch:'unavailable'})
 for(const response of [base,{...base,messages:[unavailable(2)]},{...base,messages:[unavailable(1)]},{...base,messages:[unavailable(1)],next_ordinal:1}]){
  f.state.read=()=>({data:response});assert.equal((await f.service.read(C)).reason_code,'invalid_response')
 }
 f.state.read=()=>({data:{...base,messages:[unavailable(1)],next_ordinal:1}});assert.equal((await f.service.read(C,0,1)).ok,true)
 f.state.read=()=>({data:base});assert.equal((await f.service.read(C,2)).ok,true)
})
await test('in-flight cap bounds hanging identity guards across read/open/send and recovers after timeout',async()=>{
 const f=fixture({timeoutMs:50});f.state.guard=()=>new Promise(()=>{})
 const calls=Array.from({length:CEO_DRAFT_LIMITS.inFlight},(_,n)=>f.service.readDraft(id(700+n)))
 assert.equal((await f.service.read(C)).reason_code,'busy')
 assert.equal((await f.service.open({operationId:OP,conversationId:C,subjectKind:'global',subjectId:C})).reason_code,'busy')
 assert.equal((await f.service.send(C,OP)).reason_code,'busy')
 const results=await Promise.all(calls);assert.ok(results.every(r=>r.reason_code==='timeout'));assert.equal(f.calls.length,0)
 f.state.guard=null;f.deps.timeoutMs=CEO_TEST_DEFAULT_TIMEOUT_MS;assert.equal((await f.service.readDraft(C)).ok,true)
})
await test('deadline handles blocked guard and synchronous starvation before RPC or filesystem write',async()=>{
 const f=fixture({timeoutMs:5});f.state.guard=async()=>{const until=Date.now()+20;while(Date.now()<until){}return f.initial}
 assert.equal((await f.service.saveDraft(C,null,draft())).reason_code,'timeout');assert.equal(f.calls.length,0);assert.deepEqual(readdirSync(f.dir),[])
 const g=fixture({timeoutMs:10});g.state.guard=()=>new Promise(()=>{})
 assert.equal((await g.service.open({operationId:OP,conversationId:C,subjectKind:'global',subjectId:C})).reason_code,'timeout');assert.equal(g.calls.length,0)
})
await test('retry attempts are durable/bounded and never rotate operation identity',async()=>{
 const f=fixture();await freeze(f);f.state.send=()=>{throw new Error('lost')}
 for(let i=0;i<CEO_DRAFT_LIMITS.attempts;i++)assert.equal((await f.service.retrySavedInput(C,OP)).state,'commit_unknown')
 const limited=await f.service.retrySavedInput(C,OP);assert.equal(limited.reason_code,'retry_limit');assert.equal(limited.state,'commit_unknown')
 assert.equal(f.calls.filter(x=>x.name==='send').length,CEO_DRAFT_LIMITS.attempts)
 const r=await f.service.readDraft(C);assert.equal((await f.service.forgetSettled(C,OP,r.value.revision)).reason_code,'unresolved_send')
})
await test('SQL unavailable is unknown, malformed synchronous host ports grant no request, and open loss keeps IDs',async()=>{
 const f=fixture();await freeze(f);f.state.send=()=>({data:{ok:false,reason_code:'unavailable'}})
 const result=await f.service.send(C,OP);assert.equal(result.state,'commit_unknown');assert.equal((await f.service.readDraft(C)).value.intents[0].status,'commit_unknown')
 const g=fixture();await freeze(g);g.state.online=Promise.reject(new Error('private invalid port'))
 assert.equal((await g.service.send(C,OP)).state,'saved_locally');assert.equal(g.calls.length,0)
 const h=fixture();h.state.open=()=>{throw new Error('transport lost')}
 const opened=await h.service.open({operationId:OP,conversationId:C,subjectKind:'global',subjectId:C});assert.equal(opened.state,'commit_unknown');assert.equal(opened.operation_id,OP);assert.equal(opened.conversation_id,C)
})
await test('cached acceptance still requires current membership; corrupt saved digest is quarantined',async()=>{
 const f=fixture();await freeze(f);assert.equal((await f.service.send(C,OP)).state,'accepted_pending')
 f.state.valid=false;assert.equal((await f.service.send(C,OP)).ok,false);assert.equal(f.calls.filter(x=>x.name==='send').length,1)
 f.state.valid=true;const stored=JSON.parse(readFileSync(f.file(),'utf8'));stored.intents[0].receipt.canonical_digest='0'.repeat(64)
 writeFileSync(f.file(),JSON.stringify(stored),{mode:0o600});rmSync(f.file()+'.last-good')
 assert.equal((await f.service.readDraft(C)).reason_code,'local_recovery_required')
})
await test('typed RPC response accessors and excessive messages are rejected without evaluation',async()=>{
 const f=fixture();let called=false;f.state.read=()=>{const reply={};Object.defineProperty(reply,'data',{enumerable:true,get(){called=true;return {}}});return reply}
 assert.equal((await f.service.read(C)).reason_code,'invalid_response');assert.equal(called,false)
 f.state.read=()=>({data:{ok:true,conversation_id:C,revision:100,subject:{kind:'global',id:C,owner_project_id:null,current:null},messages:Array(51).fill({}),next_ordinal:null}})
 assert.equal((await f.service.read(C)).reason_code,'invalid_response')
})
await test('an imported historical message reads verbatim even when today\'s sanitizer would change it (CO-172)',async()=>{
 // Migration 66 imports envelopes exactly as they were written (ADR-0079 §5). Reading one must
 // check it by migration 64's historical rules and its canonical digest, never re-prepare it.
 const f=fixture(),G=id(40),text='SERVICE_TOKEN=syntheticImportedCanary and the rest'
 const env={schema:'CeoSend@1',operation_id:id(41),conversation_id:G,message_id:id(42),expected_revision:0,subject_revision:0,input_channel:'text',text,preparation_version:'har06-ceo-v1',context:structuredClone(ctx)}
 const frame=v=>v===null?'-1:':`${Buffer.byteLength(String(v))}:${v}`
 const canonical=['CeoSend@1',f.initial.estateId,f.initial.personId,env.operation_id,G,env.message_id,0,0,'text',text,'har06-ceo-v1','CeoContext@1','none',0,null,null,0].map(frame).join('')
 const message=(digest)=>({message_id:env.message_id,ordinal:1,request_id:id(43),receipt_seq:5,content_state:'available',envelope:env,canonical_digest:digest,dispatch:'unavailable'})
 const reply=digest=>({data:{ok:true,conversation_id:G,revision:1,subject:{kind:'global',id:G,owner_project_id:null,current:{revision:0,project_id:null,active:true}},messages:[message(digest)],next_ordinal:null}})
 f.state.read=()=>reply(createHash('sha256').update(canonical).digest('hex'))
 const r=await f.service.read(G);assert.equal(r.ok,true,JSON.stringify(r))
 assert.equal(r.value.messages[0].envelope.text,text,'historical text arrives unchanged')
 f.state.read=()=>reply('0'.repeat(64))
 assert.equal((await f.service.read(G)).reason_code,'invalid_response','a wrong digest is still refused')
 f.state.read=()=>{const x=reply(createHash('sha256').update(canonical).digest('hex'));x.data.messages[0].envelope={...env,text:'   '};return x}
 assert.equal((await f.service.read(G)).reason_code,'invalid_response','historical rules still refuse a blank body')
})
console.log(`PASS ${groups} actual filesystem/native-service groups; no Electron/provider/database calls`)
}finally{for(const dir of roots)rmSync(dir,{recursive:true,force:true});console.log('PASS cleanup: owned local-service directories removed')}
