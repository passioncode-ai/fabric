// Service + private files + real SQL composition. Only the runner-owned socket.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, realpathSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { createCeoConversationService } from '../src/main/ceoConversationService.ts'
const dir=process.env.FABRIC_CEO_DB_DIR,nonce=process.env.FABRIC_CEO_DB_NONCE,bin=process.env.FABRIC_CEO_PG_BIN
if(!dir||!nonce||!bin){console.error('NOT_RUN: use run-ceo-conversation-db.mjs');process.exit(2)}
assert.match(path.basename(dir),/^fabric-ceo-[a-zA-Z0-9]+$/)
assert.equal(readFileSync(path.join(dir,'owner'),'utf8'),nonce)
const args=['-h',dir,'-p','58464','-U','postgres','-d','fabric_ceo_test_owned','-X','-q','-t','-A','-v','ON_ERROR_STOP=1']
const sql=input=>execFileSync(path.join(bin,'psql'),args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
assert.equal(realpathSync(sql('show data_directory')),realpathSync(path.join(dir,'data')))
assert.equal(sql('show listen_addresses'),'')
const admitted=JSON.parse(readFileSync(new URL('../src/shared/schemaContract.json',import.meta.url),'utf8')).maximum // the admitted schema, not a literal that goes stale
assert.equal(sql('set role service_role;select schema_version()'),String(admitted))
const lit=v=>`convert_from(decode('${Buffer.from(String(v)).toString('hex')}','hex'),'UTF8')`
const uuid=v=>`${lit(v)}::uuid`,json=v=>`${lit(JSON.stringify(v))}::jsonb`
const id=n=>`00000000-0000-4000-9000-${String(n).padStart(12,'0')}`
const E=id(1),U=id(2),P=id(3),C=id(4),OTHER=id(8)
sql(`insert into estates(id,name) values(${uuid(E)},'service composition');
 insert into persons(id,display_name) values(${uuid(U)},'service operator'),(${uuid(OTHER)},'retained owner');
 insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(E)},'owner'),(${uuid(OTHER)},${uuid(E)},'owner');
 insert into projects(id,estate_id,name) values(${uuid(P)},${uuid(E)},'service project');`)
const rootDir=path.join(dir,'private-service');mkdirSync(rootDir,{mode:0o700})
const held={estateId:E,personId:U,revision:1,actor:{kind:'person',id:U}}
let online=true,loseNext=false,calls=0
const guard=async()=>sql(`select count(*) from memberships where estate_id=${uuid(E)} and person_id=${uuid(U)} and revision=1`)==='1'?held:null
const prefix=a=>`${uuid(a.p_estate_id)},${uuid(a.p_person_id)},${a.p_revision}`
const query=q=>JSON.parse(sql('set role service_role;select '+q))
const rpc={
 open:async(a,f)=>{assert.equal(f(),true);return {data:query(`ceo_open_conversation(${prefix(a)},${json(a.p_actor)},${uuid(a.p_operation_id)},${uuid(a.p_conversation_id)},${lit(a.p_subject_kind)},${uuid(a.p_subject_id)})`)}},
 send:async(a,f)=>{assert.equal(f(),true);calls++;const data=query(`ceo_send_message(${prefix(a)},${json(a.p_actor)},${json(a.p_envelope)})`);if(loseNext){loseNext=false;throw new Error('simulated transport loss after actual commit')}return {data}},
 read:async(a,f)=>{assert.equal(f(),true);return {data:query(`ceo_read_conversation(${prefix(a)},${uuid(a.p_conversation_id)},${a.p_after_ordinal},${a.p_limit})`)}},
 receipt:async(a,f)=>{assert.equal(f(),true);return {data:query(`ceo_send_receipt(${prefix(a)},${uuid(a.p_conversation_id)},${uuid(a.p_operation_id)})`)}}
}
const deps={rootDir,identity:{held:()=>held,guard},rpc,online:()=>online}
let service=createCeoConversationService(deps)
const opened=await service.open({operationId:id(5),conversationId:C,subjectKind:'project',subjectId:P})
assert.equal(opened.ok,true,JSON.stringify(opened));assert.equal(opened.conversation_id,C)
assert.equal((await service.open({operationId:id(6),conversationId:id(7),subjectKind:'project',subjectId:P})).conversation_id,C)
console.log('PASS service→SQL stable project conversation, real jsonb reply')
const ctx={schema:'CeoContext@1',mode:'none',selection_revision:0,project_id:null,project_revision:null,estate_seq:0}
async function freeze(n,text){
 const read=await service.readDraft(C);assert.equal(read.ok,true,JSON.stringify(read))
 const saved=await service.saveDraft(C,read.value.revision,{text,context:ctx,expected_revision:n,subject_revision:1})
 assert.equal(saved.ok,true,JSON.stringify(saved))
 const frozen=await service.freezeSend(C,saved.value.revision,{operationId:id(20+n),messageId:id(30+n)})
 assert.equal(frozen.ok,true,JSON.stringify(frozen));return id(20+n)
}
let op=await freeze(0,'SERVICE_TOKEN=privateCompositionCanary\nQuestion about the plan')
const accepted=await service.send(C,op);assert.equal(accepted.state,'accepted_pending',JSON.stringify(accepted))
assert.equal(accepted.value.receipt.dispatch,'unavailable')
const read=await service.read(C);assert.equal(read.ok,true,JSON.stringify(read));assert.equal(read.value.messages.length,1)
assert.equal(read.value.messages[0].envelope.text.includes('privateCompositionCanary'),false)
assert.equal((await service.readDraft(C)).value.draft,null)
assert.equal(sql(`select count(*) from ceo_pending_requests where estate_id=${uuid(E)} and state='pending_unavailable'`),'1')
const privatePath=path.join(rootDir,'ceo-conversations',E,U)
for(const name of readdirSync(privatePath))assert.equal(readFileSync(path.join(privatePath,name),'utf8').includes('privateCompositionCanary'),false)
assert.equal(sql(`select coalesce(jsonb_agg(payload),'[]'::jsonb) from journal where estate_id=${uuid(E)}`).includes('Question about the plan'),false)
console.log('PASS service→SQL prepared private text, digest, history and opaque journal agree; no dispatch')
op=await freeze(1,'Second message, commit response will be lost');loseNext=true
assert.equal((await service.send(C,op)).state,'commit_unknown')
service=createCeoConversationService(deps)
assert.equal((await service.reconcile(C,op)).state,'accepted_pending')
assert.equal(calls,2);assert.equal(sql(`select count(*) from ceo_messages where estate_id=${uuid(E)}`),'2')
assert.equal((await service.read(C,0,1)).value.next_ordinal,1)
assert.equal((await service.read(C,1,1)).value.messages[0].ordinal,2)
console.log('PASS actual SQL commit plus lost response recovered after service restart without resend; pagination')
op=await freeze(2,'Third message saved offline');online=false
assert.equal((await service.send(C,op)).state,'saved_locally');assert.equal(calls,2)
service=createCeoConversationService(deps);online=true
assert.equal((await service.send(C,op)).state,'accepted_pending');assert.equal(calls,3)
assert.equal(sql(`select count(*) from ceo_messages where estate_id=${uuid(E)}`),'3')
console.log('PASS offline intent survives restart and becomes exactly one real SQL message')
sql(`delete from memberships where estate_id=${uuid(E)} and person_id=${uuid(U)}`)
assert.equal((await service.read(C)).ok,false);assert.equal((await service.readDraft(C)).ok,false)
assert.equal((await service.send(C,op)).ok,false);assert.equal(calls,3)
assert.equal(query(`ceo_read_conversation(${uuid(E)},${uuid(U)},1,${uuid(C)},0,50)`).ok,false)
console.log('PASS revoked current membership refuses cached acceptance, local draft and SQL history')
console.log('PASS CEO service/SQL composition: 5 groups; IPC/UI/model dispatch not exercised')
