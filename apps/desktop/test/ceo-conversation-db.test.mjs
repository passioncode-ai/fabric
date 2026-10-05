// Real owned PostgreSQL, full migration chain. No Supabase/user DB/provider.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { runPsqlAsync } from './bounded-psql.mjs'
import { readFileSync,readdirSync,realpathSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { prepareCeoSend,canonicalCeoSend } from '../src/shared/ceoConversation.ts'
const dir=process.env.FABRIC_CEO_DB_DIR,nonce=process.env.FABRIC_CEO_DB_NONCE,bin=process.env.FABRIC_CEO_PG_BIN
if(!dir||!nonce||!bin){console.error('NOT_RUN: use run-ceo-conversation-db.mjs');process.exit(2)}
assert.match(path.basename(dir),/^fabric-ceo-[a-zA-Z0-9]+$/)
assert.equal(readFileSync(path.join(dir,'owner'),'utf8'),nonce)
const args=['-h',dir,'-p','58464','-U','postgres','-d','fabric_ceo_test_owned','-X','-q','-t','-A','-v','ON_ERROR_STOP=1']
const sql=input=>execFileSync(path.join(bin,'psql'),args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
const parallel=input=>runPsqlAsync(path.join(bin,'psql'),args,input,{label:'owned concurrent SQL'}).then(r=>{if(r.code)throw new Error('owned concurrent SQL failed');return JSON.parse(r.stdout.trim())})
assert.equal(realpathSync(sql('show data_directory')),realpathSync(path.join(dir,'data')))
assert.equal(sql('show listen_addresses'),'')
assert.equal(sql("select count(*) from pg_tables where schemaname='public'"),'0')
sql(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.auth_uid',true),'')::uuid$$;
 create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text);`)
const lit=v=>`convert_from(decode('${Buffer.from(String(v)).toString('hex')}','hex'),'UTF8')`
const uuid=v=>`${lit(v)}::uuid`,json=v=>`${lit(JSON.stringify(v))}::jsonb`
const files=readdirSync(new URL('../../../supabase/migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()
for(const f of files){sql(readFileSync(new URL('../../../supabase/migrations/'+f,import.meta.url),'utf8'));sql(`insert into supabase_migrations.schema_migrations values(${lit(f.split('_')[0])})`)}
const admitted=JSON.parse(readFileSync(new URL('../src/shared/schemaContract.json',import.meta.url),'utf8')).maximum // the admitted schema, not a literal that goes stale
assert.equal(files.length,admitted,'qualify exact full chain; no silent pinned older chain')
assert.equal(sql('set role service_role;select schema_version()'),String(admitted),'actual installer ledger is visible through the real schema RPC')
console.log(`PASS schema_version RPC: ${admitted} (exact applied installer ledger)`)
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const E=id(1),P=id(2),U=id(3),V=id(4),E2=id(5),P2=id(6),Q=id(7),C=id(8),Ulocal='00000000-0000-0000-0000-00000000000a'
const actor=u=>({kind:'person',id:u})
const rpc=query=>JSON.parse(sql('set role service_role;select '+query))
const openSQL=({e=E,u=U,r=1,a=actor(u),op=id(10),c=C,kind='project',subject=P}={})=>`ceo_open_conversation(${uuid(e)},${uuid(u)},${r},${json(a)},${uuid(op)},${uuid(c)},${lit(kind)},${uuid(subject)})`
const open=o=>rpc(openSQL(o))
const rawEnvelope=(over={})=>({schema:'CeoSend@1',operation_id:id(20),conversation_id:C,message_id:id(21),expected_revision:0,subject_revision:1,input_channel:'text',text:'Private text: SERVICE_TOKEN=syntheticCeoCanary',preparation_version:'har06-ceo-v1',context:{schema:'CeoContext@1',mode:'none',selection_revision:0,project_id:null,project_revision:null,estate_seq:0},...over})
const prepared=p=>{const r=prepareCeoSend(p);assert.equal(r.ok,true);return r.value}
const sendSQL=(p,{e=E,u=U,r=1,a=actor(u)}={})=>`ceo_send_message(${uuid(e)},${uuid(u)},${r},${json(a)},${json(p)})`
const send=(p,o)=>rpc(sendSQL(p,o))
const read=(c=C,u=U,r=1,e=E,after=0,limit=50)=>rpc(`ceo_read_conversation(${uuid(e)},${uuid(u)},${r},${uuid(c)},${after},${limit})`)
const receipt=(op=id(20),c=C,u=U,r=1,e=E)=>rpc(`ceo_send_receipt(${uuid(e)},${uuid(u)},${r},${uuid(c)},${uuid(op)})`)
const count=t=>Number(sql(`select count(*) from ${t}`))
const rows=q=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (${q})q`))
const denied=q=>assert.throws(()=>sql(q),undefined,'SQL privilege/boundary must refuse')
let groups=0;const test=async(name,fn)=>{await fn();groups++;console.log('PASS '+name)}
sql(`insert into estates(id,name) values(${uuid(E)},'owned CEO'),(${uuid(E2)},'foreign estate');
 insert into persons(id,display_name) values(${uuid(U)},'operator fixture'),(${uuid(V)},'other operator fixture');
 insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(E)},'owner'),(${uuid(V)},${uuid(E)},'member'),(${uuid(U)},${uuid(E2)},'owner'),(${uuid(Ulocal)},${uuid(E)},'member');
 insert into projects(id,estate_id,name) values(${uuid(P)},${uuid(E)},'subject'),(${uuid(P2)},${uuid(E2)},'foreign');
 select append_event(${uuid(E)},'question.asked@1',${json(actor(U))},${json({id:Q,project_id:P,text:'Question',options:[],blocks:[]})},'1',${uuid(P)});`)
await test('privileges deny generic tables/internal RPC and agent/system/operator impersonation',()=>{
 for(const table of ['ceo_conversations','ceo_private_contents','ceo_messages','ceo_operations','ceo_pending_requests','ceo_receipt_refs','ceo_write_authorizations']){
  for(const role of ['anon','authenticated','service_role']) denied(`set role ${role};select * from ${table}`)
  assert.equal(sql(`select has_table_privilege('service_role','${table}','INSERT,UPDATE,DELETE,TRUNCATE')`),'f')
  denied(`set role service_role;insert into ${table} default values`)
 }
 for(const role of ['anon','authenticated'])denied(`set role ${role};select ${openSQL()}`)
 denied(`set role service_role;select ceo_authorized(${uuid(E)},${uuid(U)},1)`)
 for(const a of [{kind:'system',id:'system'},{kind:'agent',id:U},{kind:'person',id:'operator'},null,{kind:'person',id:V}])assert.equal(open({a}).reason_code,'unavailable')
 assert.equal(open({u:Ulocal,a:{kind:'person',id:'operator'},op:id(100),c:id(101)}).ok,true)
})
await test('concurrent subject open returns stable owner identity and exact operation receipt',async()=>{
 const [a,b]=await Promise.all([parallel('set role service_role;select '+openSQL()),parallel('set role service_role;select '+openSQL({op:id(11),c:id(9)}))])
 assert.equal(a.ok,true);assert.equal(b.conversation_id,a.conversation_id)
 // Whichever transaction wins owns the canonical ID. All later fixtures use it.
 assert.equal(open().conversation_id,a.conversation_id)
 assert.equal(open().repeated,true)
 assert.equal(open({subject:Q,kind:'question'}).reason_code,'idempotency_conflict')
 const other=open({u:V,op:id(12),c:id(13)});assert.equal(other.ok,true);assert.notEqual(other.conversation_id,a.conversation_id)
 assert.equal(read(other.conversation_id).ok,false)
 assert.equal(open({op:id(14),c:id(15),subject:P2}).ok,false)
 // The physical FK binds both audience and Estate, even for a privileged
 // accidental insertion that bypasses the purpose-built service functions.
 for (const [estate, person] of [[E2,U],[E,V]]) {
  assert.throws(() => sql(`insert into ceo_messages(id,estate_id,person_id,conversation_id,ordinal,content_id,request_id,accepted_seq)
   values(${uuid(id(900))},${uuid(estate)},${uuid(person)},${uuid(a.conversation_id)},1,${uuid(id(901))},${uuid(id(902))},1)`),
   error => String(error.stderr).includes('foreign key constraint'))
 }

})
// Canonical target may be the alternate ID after concurrent open.
const canonical=open().conversation_id
const base=prepared(rawEnvelope({conversation_id:canonical}))
await test('JS/SQL golden canonical bytes match Unicode and null framing, strict JSON rejects',()=>{
 const g={...rawEnvelope(),operation_id:id(3),conversation_id:id(4),message_id:id(5),subject_revision:0,text:'Привет\n雪: | 😀'}
 const js=canonicalCeoSend(id(1),id(2),g)
 assert.equal(sql(`select ceo_send_canonical(${uuid(id(1))},${uuid(id(2))},${json(g)})`),js)
 assert.equal(createHash('sha256').update(js).digest('hex'),'dffdd4f0c485a4e9fa2bc459e63fb501f7ad37017d4a61d5fb6ea7a1ce864b9d')
 const one={...g,context:{...g.context,mode:'one',project_id:P,project_revision:1,selection_revision:2,estate_seq:3}}
 assert.equal(sql(`select ceo_send_canonical(${uuid(E)},${uuid(U)},${json(one)})`),canonicalCeoSend(E,U,one))
 for(const k of Object.keys(base)) for(const bad of [null,[],{},true]){
  const result=send({...base,[k]:bad});assert.equal(result.ok,false,k)
 }
 for(const k of Object.keys(base.context)) for(const bad of [[],{},true])assert.equal(send({...base,context:{...base.context,[k]:bad}}).ok,false,k)
 let deep='invalid';for(let i=0;i<256;i++)deep={nested:deep}
 assert.equal(send({...base,text:deep}).reason_code,'invalid_input')
 assert.equal(send({...base,context:{...base.context,project_id:deep}}).reason_code,'invalid_input')
 assert.equal(send({...base,unexpected:1}).ok,false)
 assert.equal(send({...base,text:'x'.repeat(32769)}).reason_code,'too_large')
 assert.equal(send({...base,context:{...base.context,mode:'all'}}).reason_code,'unsupported_context')
})
await test('exact compact wire/body limits and whitespace semantics agree in SQL and JS',()=>{
 for(const body of ['\u00a0','\ufeff','\u1680','\u2007','\u2028','\u0085','x'.repeat(32768),'x'.repeat(32769)]){
  const p={...base,text:body};const ts=prepareCeoSend(p);const reason=sql(`select coalesce(ceo_send_error(${json(p)}),'')`)
  assert.equal(reason==='',ts.ok,`body parity ${body.length}`)
 }
 // U+0001 consumes six JSON bytes and one body byte. Fill remaining bytes
 // using plain text so both exact wire boundaries occur below body cap.
 const emptyBytes=Buffer.byteLength(JSON.stringify({...base,text:''}))
 for(const size of [65536,65537]){
  const room=size-emptyBytes,body='\u0001'.repeat(Math.floor(room/6))+'x'.repeat(room%6)
  const p={...base,text:body};assert.equal(Buffer.byteLength(JSON.stringify(p)),size)
  assert.equal(Number(sql(`select ceo_json_bytes(${json(p)})`)),size)
  assert.equal(prepareCeoSend(p).ok,size===65536)
  assert.equal(sql(`select coalesce(ceo_send_error(${json(p)}),'')`),size===65536?'':'too_large')
 }
})
let accepted
await test('atomic send concurrent repeat and lost response produce one pending request; content stays private',async()=>{
 const before=count('ceo_messages'),events=count('journal')
 const [a,b]=await Promise.all([parallel('set role service_role;select '+sendSQL(base)),parallel('set role service_role;select '+sendSQL(base))])
 assert.equal(a.ok,true);assert.equal(b.ok,true);assert.equal(a.message_id,b.message_id);assert.notEqual(a.repeated,b.repeated)
 accepted=receipt(base.operation_id,canonical)
 assert.equal(accepted.receipt_seq,a.receipt_seq);assert.equal(accepted.dispatch,'unavailable');assert.equal(count('ceo_messages'),before+1);assert.equal(count('journal'),events+1)
 assert.equal(count('ceo_pending_requests'),1);assert.equal(sql('select state from ceo_pending_requests'),'pending_unavailable')
 const r=read(canonical);assert.equal(r.messages[0].envelope.text,base.text);assert.equal(r.messages[0].canonical_digest,createHash('sha256').update(canonicalCeoSend(E,U,base)).digest('hex'))
 assert.ok(!JSON.stringify(r).includes('syntheticCeoCanary'))
 const publicRows=rows("select * from journal where type like 'ceo.%'")
 for(const j of publicRows){assert.equal(j.project_id,null);assert.equal(j.run_id,null);assert.equal(j.node_id,null)
  assert.deepEqual(Object.keys(j.payload).sort(),(j.type==='ceo.conversation.opened@1'?['conversation_id','operation_id']:['conversation_id','operation_id','message_id','request_id','content_id']).sort())
 }
 const shared=JSON.stringify(publicRows.map(j=>j.payload));for(const hidden of [base.text,accepted.canonical_digest,P,U,'subject_kind','owner'])assert.ok(!shared.includes(hidden))
 assert.equal(send({...base,text:'changed'}).reason_code,'idempotency_conflict')
 assert.equal(read(canonical,V).ok,false);assert.equal(receipt(base.operation_id,canonical,V).ok,false)
})
await test('new sends enforce current revisions, selected source scope and Estate boundary; repeats precede stale checks',()=>{
 const next={...base,operation_id:id(30),message_id:id(31),expected_revision:1}
 assert.equal(send({...next,subject_revision:999}).reason_code,'stale_revision')
 assert.equal(send({...next,context:{...base.context,estate_seq:999999}}).reason_code,'invalid_boundary')
 assert.equal(send({...next,context:{...base.context,mode:'one',project_id:P2,project_revision:1}}).reason_code,'unavailable')
 assert.equal(send({...next,context:{...base.context,mode:'one',project_id:P,project_revision:999}}).reason_code,'stale_revision')
 sql(`update projects set status='archived' where id=${uuid(P)}`)
 assert.equal(send(next).reason_code,'unavailable');assert.equal(send(base).repeated,true);assert.equal(read(canonical).ok,true)
 sql(`update projects set status='active',config_revision=2 where id=${uuid(P)}`)
 assert.equal(send(next).reason_code,'stale_revision');assert.equal(send(base).repeated,true)
})
await test('membership movement/revocation denies read/send/repeat even when original receipt exists',()=>{
 sql(`update memberships set role='member' where estate_id=${uuid(E)} and person_id=${uuid(V)}`)
 const other=open({u:V,r:2,op:id(32),c:id(33)});assert.equal(other.ok,true)
 assert.equal(open({u:V}).ok,false)
 sql(`delete from memberships where estate_id=${uuid(E)} and person_id=${uuid(V)}`)
 assert.equal(read(other.conversation_id,V,2).ok,false)
 sql(`update memberships set changed_by='fixture' where estate_id=${uuid(E)} and person_id=${uuid(U)}`)
 assert.equal(send(base).ok,false);assert.equal(receipt(base.operation_id,canonical).ok,false);assert.equal(read(canonical).ok,false)
 assert.equal(send(base,{r:2}).repeated,true)
})
await test('rollback after journal append leaves no partial content, event, receipt or pending request',()=>{
 const before=['journal','ceo_messages','ceo_private_contents','ceo_operations','ceo_pending_requests'].map(count)
 sql(`create function test_ceo_abort() returns trigger language plpgsql as $$begin raise exception 'fixture rollback';end$$;
 create trigger test_ceo_abort before insert on ceo_pending_requests for each row execute function test_ceo_abort();`)
 denied('set role service_role;select '+sendSQL({...base,operation_id:id(40),message_id:id(41),expected_revision:1,subject_revision:2},{r:2}))
 sql('drop trigger test_ceo_abort on ceo_pending_requests;drop function test_ceo_abort()')
 assert.deepEqual(['journal','ceo_messages','ceo_private_contents','ceo_operations','ceo_pending_requests'].map(count),before)
 assert.equal(receipt(id(40),canonical,U,2).reason_code,'not_found')
})
await test('raw append cannot manufacture accepted/private rows; projection replay carries references only',()=>{
 const payload=rows("select payload from journal where type='ceo.message.accepted@1'")[0].payload
 denied(`set role service_role;select append_event(${uuid(E)},'ceo.message.accepted@1',${json(actor(U))},${json(payload)})`)
 denied(`set role service_role;select ceo_append(${uuid(E)},'ceo.message.accepted@1',${json(actor(U))},${json(payload)})`)
 denied(`set role service_role;select import_declared_snapshot(${uuid(E)},${uuid(id(60))},'fixture',${json(actor(U))},${json([{type:'ceo.message.accepted@1',payload}])})`)
 denied(`update ceo_private_contents set canonical_digest='changed'`)
 const before=['ceo_conversations','ceo_messages','ceo_private_contents','ceo_operations','ceo_pending_requests'].map(count)
 sql(`delete from ceo_receipt_refs;select rebuild_estate_projections(${uuid(E)})`)
 assert.deepEqual(['ceo_conversations','ceo_messages','ceo_private_contents','ceo_operations','ceo_pending_requests'].map(count),before)
 assert.equal(count('ceo_receipt_refs'),count("journal where type like 'ceo.%'"))
 for(const patch of [{schema_rev:'2'},{payload:{...payload,message_id:null}},{payload:{...payload,body:'private injection'}},{actor:{kind:'person',unknown:'x'}}])
  denied(`select apply_ceo_receipt(jsonb_populate_record(null::journal,to_jsonb(j)||${json(patch)})) from journal j where type='ceo.message.accepted@1' limit 1`)
})
await test('safe integer saturation refuses before any primary/journal effects',()=>{
 const before=['journal','ceo_messages','ceo_private_contents','ceo_operations','ceo_pending_requests'].map(count)
 sql(`update ceo_conversations set revision=9007199254740991 where id=${uuid(canonical)}`)
 const p={...base,operation_id:id(64),message_id:id(65),expected_revision:Number.MAX_SAFE_INTEGER,subject_revision:2}
 assert.equal(send(p,{r:2}).reason_code,'capacity_exceeded')
 assert.equal(read(canonical,U,2).revision,Number.MAX_SAFE_INTEGER)
 denied(`update ceo_conversations set revision=9007199254740992 where id=${uuid(canonical)}`)
 sql(`update ceo_conversations set revision=1 where id=${uuid(canonical)}`)
 const saturated=JSON.parse(sql(`begin;insert into journal(estate_id,seq,type,schema_rev,actor,payload) values(${uuid(E)},9007199254740991,'ceo.conversation.opened@1','1',${json(actor(U))},${json({conversation_id:id(66),operation_id:id(67)})});
 set local role service_role;select ${sendSQL({...p,expected_revision:1},{r:2})};rollback;`))
 assert.equal(saturated.reason_code,'capacity_exceeded')
 assert.deepEqual(['journal','ceo_messages','ceo_private_contents','ceo_operations','ceo_pending_requests'].map(count),before)
})
await test('question subject/current revision, selected Project snapshot and bounded pagination',()=>{
 const q=open({r:2,op:id(50),c:id(51),kind:'question',subject:Q});assert.equal(q.ok,true)
 const a=prepared(rawEnvelope({conversation_id:q.conversation_id,operation_id:id(52),message_id:id(53),text:'Question discussion',
  context:{...base.context,mode:'one',project_id:P,project_revision:2,estate_seq:Number(sql(`select max(seq) from journal where estate_id=${uuid(E)}`))}}))
 assert.equal(send(a,{r:2}).ok,true)
 sql(`update questions set revision=revision+1,status='answered' where id=${uuid(Q)}`)
 const b={...a,operation_id:id(54),message_id:id(55),expected_revision:1}
 assert.equal(send(b,{r:2}).reason_code,'stale_revision')
 assert.equal(send({...b,subject_revision:2},{r:2}).ok,true)
 assert.equal(send(a,{r:2}).repeated,true)
 const first=read(q.conversation_id,U,2,E,0,1);assert.equal(first.messages.length,1);assert.equal(first.next_ordinal,1)
 const second=read(q.conversation_id,U,2,E,first.next_ordinal,1);assert.equal(second.messages[0].ordinal,2);assert.equal(second.next_ordinal,null)
 assert.equal(read(q.conversation_id,U,2,E,-1).ok,false);assert.equal(read(q.conversation_id,U,2,E,0,51).ok,false)
 assert.equal(open({r:2,op:id(56),c:id(57),kind:'global',subject:id(58)}).reason_code,'invalid_input')
})
await test('metadata-only restore cannot fabricate ownership/content/dispatch; existing private content not reconstructed',()=>{
 const global=id(80);assert.equal(open({e:E2,op:id(81),c:global,kind:'global',subject:global}).ok,true)
 const g=prepared(rawEnvelope({conversation_id:global,operation_id:id(82),message_id:id(83),subject_revision:0}));assert.equal(send(g,{e:E2}).ok,true)
 const archive=rows("select seq,type,schema_rev,actor,project_id,run_id,node_id,payload,occurred_at from journal where estate_id='"+E2+"' order by seq")
 const before=['ceo_conversations','ceo_messages','ceo_private_contents','ceo_operations','ceo_pending_requests'].map(count)
 const dest=id(90)
 const restored=rpc(`restore_estate(${uuid(dest)},${uuid(E2)},'metadata only',${json(archive)})`);assert.equal(restored.restored,true)
 sql(`insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(dest)},'owner')`)
 assert.equal(read(canonical,U,1,dest).content_state,'unavailable')
 assert.deepEqual(['ceo_conversations','ceo_messages','ceo_private_contents','ceo_operations','ceo_pending_requests'].map(count),before)
 // Owner-only fault injection models unavailable primary bytes, not a deletion API.
 sql('alter table ceo_private_contents disable trigger ceo_content_immutable;delete from ceo_private_contents;alter table ceo_private_contents enable trigger ceo_content_immutable')
 sql(`select rebuild_estate_projections(${uuid(E)})`)
 assert.equal(count('ceo_private_contents'),0);assert.equal(read(canonical,U,2).messages[0].content_state,'unavailable')
 assert.equal(count('ceo_pending_requests'),4);assert.equal(sql('select distinct state from ceo_pending_requests'),'pending_unavailable')
})
console.log(`PASS ${groups} CEO database groups across ${files.length} migrations; no worker/native/provider calls`)
