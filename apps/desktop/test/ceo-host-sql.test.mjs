// Real imported host -> bounded four-RPC HTTP bridge -> actual owned SQL.
// The bridge is a fixture, not PostgREST, authentication or production wiring.
import assert from 'node:assert/strict'
import http from 'node:http'
import {execFileSync} from 'node:child_process'
import {readFileSync,readdirSync,realpathSync,mkdirSync} from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {createIdentity} from '../src/main/identity.ts'
import {createCeoConversationHost} from '../src/main/ceoConversationHost.ts'
import {canonicalCeoSend} from '../src/shared/ceoConversation.ts'
const dir=process.env.FABRIC_CEO_HTTP_SQL_DIR,nonce=process.env.FABRIC_CEO_HTTP_SQL_NONCE,bin=process.env.FABRIC_CEO_HTTP_SQL_BIN
if(!dir||!nonce||!bin){console.error('NOT_RUN: use run-ceo-host-sql.mjs');process.exit(2)}
assert.match(path.basename(dir),/^fabric-ceo-http-sql-[a-zA-Z0-9]+$/);assert.equal(readFileSync(path.join(dir,'owner'),'utf8'),nonce)
const args=['-h',dir,'-p','58466','-U','postgres','-d','fabric_ceo_http_sql_owned','-w','-X','-q','-t','-A','-v','ON_ERROR_STOP=1']
const sql=input=>execFileSync(path.join(bin,'psql'),args,{input,timeout:8000,maxBuffer:8*1024*1024,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
assert.equal(realpathSync(sql('show data_directory')),realpathSync(path.join(dir,'data')));assert.equal(sql('show listen_addresses'),'')
assert.equal(sql("select count(*) from pg_tables where schemaname='public'"),'0')
const lit=v=>`convert_from(decode('${Buffer.from(String(v)).toString('hex')}','hex'),'UTF8')`,uuid=v=>`${lit(v)}::uuid`,json=v=>`${lit(JSON.stringify(v))}::jsonb`
const integer=v=>{assert(Number.isSafeInteger(v)&&v>=0);return String(v)}
sql(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.auth_uid',true),'')::uuid$$;
create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text);`)
const migrations=readdirSync(new URL('../../../supabase/migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()
const admitted=JSON.parse(readFileSync(new URL('../src/shared/schemaContract.json',import.meta.url),'utf8')).maximum // the admitted schema, not a literal that goes stale
assert.equal(migrations.length,admitted,'this acceptance qualifies the exact full admitted schema')
for(const file of migrations){sql(readFileSync(new URL('../../../supabase/migrations/'+file,import.meta.url),'utf8'));sql(`insert into supabase_migrations.schema_migrations values(${lit(file.split('_')[0])})`)}
assert.equal(sql('set role service_role;select schema_version()'),String(admitted))
console.log(`PASS full${admitted} migration chain and actual schema_version; owned Unix socket only`)
const id=n=>`00000000-0000-4000-a000-${String(n).padStart(12,'0')}`
const E=id(1),U=id(2),V=id(3),P=id(4),C=id(5),E2=id(6),P2=id(7)
sql(`insert into estates(id,name) values(${uuid(E)},'HTTP fixture'),(${uuid(E2)},'foreign scope');
insert into persons(id,display_name) values(${uuid(U)},'first owner'),(${uuid(V)},'retained owner');
insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(E)},'owner'),(${uuid(V)},${uuid(E)},'owner'),(${uuid(U)},${uuid(E2)},'owner');
insert into projects(id,estate_id,name) values(${uuid(P)},${uuid(E)},'main'),(${uuid(P2)},${uuid(E2)},'other');`)
const query=q=>JSON.parse(sql('set role service_role;select '+q)),prefix=a=>`${uuid(a.p_estate_id)},${uuid(a.p_person_id)},${integer(a.p_revision)}`
const routes={
 '/rest/v1/rpc/ceo_open_conversation':{keys:['p_estate_id','p_person_id','p_revision','p_actor','p_operation_id','p_conversation_id','p_subject_kind','p_subject_id'],build:a=>`ceo_open_conversation(${prefix(a)},${json(a.p_actor)},${uuid(a.p_operation_id)},${uuid(a.p_conversation_id)},${lit(a.p_subject_kind)},${uuid(a.p_subject_id)})`},
 '/rest/v1/rpc/ceo_send_message':{keys:['p_estate_id','p_person_id','p_revision','p_actor','p_envelope'],build:a=>`ceo_send_message(${prefix(a)},${json(a.p_actor)},${json(a.p_envelope)})`},
 '/rest/v1/rpc/ceo_read_conversation':{keys:['p_estate_id','p_person_id','p_revision','p_conversation_id','p_after_ordinal','p_limit'],build:a=>`ceo_read_conversation(${prefix(a)},${uuid(a.p_conversation_id)},${integer(a.p_after_ordinal)},${integer(a.p_limit)})`},
 '/rest/v1/rpc/ceo_send_receipt':{keys:['p_estate_id','p_person_id','p_revision','p_conversation_id','p_operation_id'],build:a=>`ceo_send_receipt(${prefix(a)},${uuid(a.p_conversation_id)},${uuid(a.p_operation_id)})`}
}
const key='synthetic-http-sql-key',calls=[],sockets=new Set();let mode='normal',beforeRPC=null,sqlRPCs=0
const server=http.createServer(async(req,res)=>{
 try{
  const route=Object.hasOwn(routes,req.url)?routes[req.url]:null
  if(req.method!=='POST'||!route||req.headers.apikey!==key||req.headers.authorization!=='Bearer '+key){res.writeHead(403);res.end();return}
  const chunks=[];let size=0;for await(const b of req){if((size+=b.length)>131072)throw Error('fixture request too large');chunks.push(b)}
  const raw=Buffer.concat(chunks,size).toString('utf8'),a=JSON.parse(raw)
  assert.deepEqual(Object.keys(a).sort(),[...route.keys].sort());calls.push({url:req.url,args:a,raw})
  if(mode==='drop_before'&&req.url.endsWith('ceo_send_message')){mode='normal';res.destroy();return}
  if(beforeRPC){const run=beforeRPC;beforeRPC=null;run()}
  const result=query(route.build(a));sqlRPCs++
  if(mode==='drop_after'&&req.url.endsWith('ceo_send_message')){mode='normal';res.destroy();return}
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result))
 }catch{if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'fixture_unavailable'}))}
})
server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));s.on('error',()=>{})})
let online=true,groups=0
const test=async(name,fn)=>{await fn();groups++;console.log('PASS '+name)}
const count=()=>Number(sql(`select count(*) from ceo_messages where estate_id=${uuid(E)}`))
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`
 async function makeHost(estate=E,person=U){
  const identity=createIdentity({estateId:estate,personId:person,source:'authenticated',db:{rpc:async(name,a)=>{assert.equal(name,'resolve_subject');return {data:query(`resolve_subject(${uuid(a.p_estate_id)},${uuid(a.p_person_id)})`),error:null}}}})
  assert.equal((await identity.establish()).ok,true)
  const rootDir=path.join(dir,'host-files');mkdirSync(rootDir,{recursive:true,mode:0o700})
  return createCeoConversationHost({rootDir,estateId:estate,identity,connection:{url,serviceKey:key,allowLoopbackHttp:true},online:()=>online,timeoutMs:2000})
 }
 let host=await makeHost()
 const context={schema:'CeoContext@1',mode:'none',selection_revision:0,project_id:null,project_revision:null,estate_seq:0}
 async function freeze(n,text,target=host,cid=C){const read=await target.readDraft(cid);assert.equal(read.ok,true);const saved=await target.saveDraft(cid,read.value.revision,{text,context,expected_revision:n,subject_revision:1});assert.equal(saved.ok,true,JSON.stringify(saved));const operation=id(20+n),message=id(30+n);assert.equal((await target.freezeSend(cid,saved.value.revision,{operationId:operation,messageId:message})).ok,true);return operation}
 await test('actual host HTTP open derives identity; stable project conversation reply survives SQL jsonb',async()=>{
  const result=await host.open({operationId:id(10),conversationId:C,subjectKind:'project',subjectId:P});assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.conversation_id,C)
  assert.equal((await host.open({operationId:id(11),conversationId:id(12),subjectKind:'project',subjectId:P})).conversation_id,C)
  assert.equal(calls[0].args.p_estate_id,E);assert.equal(calls[0].args.p_person_id,U);assert.deepEqual(calls[0].args.p_actor,{kind:'person',id:U})
 })
 await test('prepared send is durable; real SQL digest/history/private body agree and journal stays opaque',async()=>{
  const op=await freeze(0,'SERVICE_TOKEN=syntheticBridgeCanary\nPrivate plan discussion'),result=await host.send(C,op)
  assert.equal(result.state,'accepted_pending',JSON.stringify(result));assert.equal(count(),1)
  const row=(await host.read(C)).value.messages[0],payload=calls.find(x=>x.url.endsWith('ceo_send_message')).args.p_envelope
  assert.equal(row.envelope.text.includes('syntheticBridgeCanary'),false);assert.deepEqual(row.envelope,payload)
  assert.equal(row.canonical_digest,createHash('sha256').update(canonicalCeoSend(E,U,payload)).digest('hex'))
  assert.equal((await host.readDraft(C)).value.draft,null)
  assert.equal(sql(`select jsonb_agg(payload)::text from journal where estate_id=${uuid(E)}`).includes('Private plan discussion'),false)
  assert.equal(sql(`select count(*) from ceo_pending_requests where estate_id=${uuid(E)} and state='pending_unavailable'`),'1')
  const ns=path.join(dir,'host-files','ceo-conversations',E,U);for(const name of readdirSync(ns)){const body=readFileSync(path.join(ns,name),'utf8');assert(!body.includes('syntheticBridgeCanary'));assert(!body.includes(key))}
 })
 await test('lost real commit response recovers by receipt after host restart without a second send',async()=>{
  const op=await freeze(1,'Lost response after durable SQL commit');mode='drop_after';const sends=calls.filter(x=>x.url.endsWith('ceo_send_message')).length
  assert.equal((await host.send(C,op)).state,'commit_unknown');assert.equal(count(),2)
  host=await makeHost();assert.equal((await host.reconcile(C,op)).state,'accepted_pending')
  assert.equal(calls.filter(x=>x.url.endsWith('ceo_send_message')).length,sends+1);assert.equal(count(),2)
  assert.equal((await host.read(C,0,1)).value.next_ordinal,1);assert.equal((await host.read(C,1,1)).value.messages[0].ordinal,2)
 })
 await test('not-found receipt permits explicit identical-input retry after network loss before SQL',async()=>{
  const op=await freeze(2,'Explicit same-intent retry');mode='drop_before';assert.equal((await host.send(C,op)).state,'commit_unknown');assert.equal(count(),2)
  host=await makeHost();assert.equal((await host.reconcile(C,op)).reason_code,'receipt_not_found')
  assert.equal((await host.retrySavedInput(C,op)).state,'accepted_pending');assert.equal(count(),3)
  const sent=calls.filter(x=>x.url.endsWith('ceo_send_message')&&x.args.p_envelope.operation_id===op);assert.equal(sent.length,2);assert.equal(sent[0].raw,sent[1].raw)
 })
 await test('foreign Estate, private owner and project scope are refused by real SQL without message leakage',async()=>{
  const otherEstate=await makeHost(E2,U),otherPerson=await makeHost(E,V)
  const a=await otherEstate.read(C),b=await otherPerson.read(C);assert.equal(a.ok,false);assert.equal(b.ok,false);assert(!JSON.stringify([a,b]).includes('Private plan discussion'))
  assert.equal((await host.open({operationId:id(50),conversationId:id(51),subjectKind:'project',subjectId:P2})).ok,false)
  const op=await freeze(0,'Foreign scope must not write',otherEstate);assert.equal((await otherEstate.send(C,op)).ok,false);assert.equal(count(),3)
 })
 await test('revocation between HTTP arrival and SQL commit refuses stale held authority; fresh guard prevents later requests',async()=>{
  const op=await freeze(3,'Must not commit after revocation'),prior=count()
  beforeRPC=()=>sql(`delete from memberships where estate_id=${uuid(E)} and person_id=${uuid(U)}`)
  assert.equal((await host.send(C,op)).ok,false);assert.equal(count(),prior)
  const before=calls.length;assert.equal((await host.read(C)).ok,false);assert.equal((await host.readDraft(C)).ok,false);assert.equal((await host.reconcile(C,op)).ok,false);assert.equal(calls.length,before)
 })
 await test('fixture rejects unknown routes and credentials before any SQL command',async()=>{
  const before=sqlRPCs
  for(const [endpoint,headers] of [['/rest/v1/rpc/append_event',{apikey:key,authorization:'Bearer '+key}],['/rest/v1/rpc/ceo_read_conversation',{}]]){
   const r=await fetch(url+endpoint,{method:'POST',headers,body:'{}'});assert.equal(r.status,403);await r.arrayBuffer()
  }
  assert.equal(sqlRPCs,before)
 })
 console.log(`PASS ${groups} actual host→owned HTTP bridge→PostgreSQL${admitted} groups; not PostgREST or production activation`)
}finally{
 const closed=[...sockets].map(s=>new Promise(r=>s.once('close',r)));for(const s of sockets)s.destroy();await Promise.all([...closed,new Promise(r=>server.close(r))]);assert.equal(sockets.size,0)
 console.log('PASS cleanup: owned HTTP server and sockets closed')
}
