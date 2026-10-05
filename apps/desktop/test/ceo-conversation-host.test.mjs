import assert from 'node:assert/strict'
import http from 'node:http'
import {mkdtempSync,rmSync,readFileSync,readdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {createCeoConversationHost} from '../src/main/ceoConversationHost.ts'
import {createIdentity,LOCAL_OPERATOR_PERSON} from '../src/main/identity.ts'
import {canonicalCeoSend} from '../src/shared/ceoConversation.ts'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const C=id(3),OP=id(4),MSG=id(5),key='synthetic-key-for-owned-http-fixture'
const context={schema:'CeoContext@1',mode:'none',selection_revision:0,project_id:null,project_revision:null,estate_seq:0}
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve}}
const resources=[]
// 3 s by default: on a busy disk one fsync'd local draft save measured over 300 ms (2026-10-05) and answered
// local_save_unknown. Cases ABOUT a deadline pass their own budget explicitly.
async function fixture({timeoutMs=3000,prefix=''}={}){
 const dir=mkdtempSync(path.join(tmpdir(),'fabric-ceo-host-'))
 const state={subject:{personId:id(2),revision:1,source:'authenticated',role:'owner',displayName:'test',authUser:null},valid:true,online:true,guard:null,onHeld:null,onConnection:null,respond:null}
 const calls=[],sockets=new Set(),accepted=new Map()
 const receipt=p=>({ok:true,conversation_id:p.conversation_id,operation_id:p.operation_id,message_id:p.message_id,request_id:id(90),revision:p.expected_revision+1,receipt_seq:10,canonical_digest:createHash('sha256').update(canonicalCeoSend(id(1),id(2),p)).digest('hex'),state:'accepted_pending',dispatch:'unavailable',repeated:false})
 const server=http.createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk
  const a=JSON.parse(body);calls.push({url:req.url,method:req.method,headers:req.headers,args:a,raw:body})
  if(state.respond){state.respond(req,res,a);return}
  let data
  if(req.url.endsWith('/ceo_open_conversation'))data={ok:true,conversation_id:a.p_conversation_id,revision:0,receipt_seq:1,repeated:false}
  else if(req.url.endsWith('/ceo_send_message')){accepted.set(a.p_envelope.operation_id,a.p_envelope);data=receipt(a.p_envelope)}
  else if(req.url.endsWith('/ceo_send_receipt')){const p=accepted.get(a.p_operation_id);data=p?{...receipt(p),repeated:true}:{ok:false,reason_code:'not_found'}}
  else if(req.url.endsWith('/ceo_read_conversation')){const rows=[...accepted.values()];data={ok:true,conversation_id:C,revision:rows.length,subject:{kind:'global',id:C,owner_project_id:null,current:null},messages:rows.map(p=>({message_id:p.message_id,ordinal:1,request_id:id(90),receipt_seq:10,content_state:'available',envelope:p,canonical_digest:receipt(p).canonical_digest,dispatch:'unavailable'})),next_ordinal:null}}
  else throw Error('unexpected route')
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data))
 })
 server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));state.onConnection?.()})
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const identity={held:()=>{state.onHeld?.();return state.subject},actor:()=>({kind:'person',id:state.subject?.personId}),guard:async()=>{if(state.guard)return state.guard();return state.valid?{ok:true,subject:state.subject}:{ok:false,why:'not_a_member',says:'private refusal text'}}}
 const options={rootDir:dir,estateId:id(1),identity,connection:{url:`http://127.0.0.1:${server.address().port}${prefix}`,serviceKey:key,allowLoopbackHttp:true},online:()=>state.online,timeoutMs}
 const host=createCeoConversationHost(options)
 resources.push(async()=>{for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true})})
 return {host,options,state,calls,accepted,receipt,dir,sockets}
}
const open=f=>f.host.open({operationId:OP,conversationId:C,subjectKind:'global',subjectId:C})
async function freeze(f){const saved=await f.host.saveDraft(C,null,{text:'SERVICE_TOKEN=synthetic-secret-canary',context,expected_revision:0,subject_revision:0});assert.equal(saved.ok,true,JSON.stringify(saved));const result=await f.host.freezeSend(C,saved.value.revision,{operationId:OP,messageId:MSG});assert.equal(result.ok,true,JSON.stringify(result))}
let count=0;const test=async(name,fn)=>{await fn();count++;console.log('PASS '+name)}
try{
await test('four actual HTTP routes use trusted identity and fixed RPC paths; prepared body equals canonical receipt',async()=>{
 const f=await fixture({prefix:'/owned-prefix'})
 assert.equal((await open(f)).ok,true);await freeze(f)
 f.state.respond=(req,res,a)=>{assert(req.url.endsWith('/ceo_send_message'));f.accepted.set(a.p_envelope.operation_id,a.p_envelope);res.destroy()}
 const uncertain=await f.host.send(C,OP);assert.equal(uncertain.state,'commit_unknown');f.state.respond=null
 assert.equal((await f.host.reconcile(C,OP)).state,'accepted_pending')
 assert.equal((await f.host.read(C)).ok,true)
 assert.deepEqual(f.calls.map(c=>c.url),['ceo_open_conversation','ceo_send_message','ceo_send_receipt','ceo_read_conversation'].map(n=>'/owned-prefix/rest/v1/rpc/'+n))
 for(const c of f.calls){assert.equal(c.method,'POST');assert.equal(c.args.p_estate_id,id(1));assert.equal(c.args.p_person_id,id(2));assert.equal(c.args.p_revision,1);assert.equal(c.headers.apikey,key);assert.equal(c.headers.authorization,'Bearer '+key);assert(!c.raw.includes('synthetic-secret-canary'))}
 assert.deepEqual(f.calls[0].args.p_actor,{kind:'person',id:id(2)});assert.deepEqual(f.calls[1].args.p_actor,{kind:'person',id:id(2)})
 assert.equal('rpc'in f.host,false);assert.equal('request'in f.host,false)
})
await test('existing Identity producer supplies local operator actor without a new authority source',async()=>{
 const f=await fixture();let resolves=0
 const trusted=createIdentity({estateId:id(1),db:{rpc:async(name,args)=>{assert.equal(name,'resolve_subject');assert.equal(args.p_estate_id,id(1));assert.equal(args.p_person_id,LOCAL_OPERATOR_PERSON);resolves++;return {data:{ok:true,person_id:LOCAL_OPERATOR_PERSON,role:'owner',revision:7},error:null}}}})
 assert.equal((await trusted.establish()).ok,true)
 f.host=createCeoConversationHost({...f.options,identity:trusted})
 assert.equal((await open(f)).ok,true);assert(resolves>=2)
 assert.equal(f.calls[0].args.p_person_id,LOCAL_OPERATOR_PERSON);assert.equal(f.calls[0].args.p_revision,7);assert.deepEqual(f.calls[0].args.p_actor,trusted.actor())
})
await test('async identity refusal and caller supplied authority cannot send a request',async()=>{
 const f=await fixture(),wait=deferred();f.state.guard=()=>wait.promise
 const task=open(f);f.state.valid=false;wait.resolve({ok:false,why:'not_a_member',says:'synthetic-private-refusal'})
 const result=await task;assert.equal(result.ok,false);assert(!JSON.stringify(result).includes('synthetic-private'));assert.equal(f.calls.length,0)
 f.state.guard=null;f.state.valid=true
 assert.equal((await f.host.open({operationId:OP,conversationId:C,subjectKind:'global',subjectId:C,p_person_id:id(88)})).ok,false);assert.equal(f.calls.length,0)
})
await test('actual socket connection authority change is fenced before any HTTP headers or body',async()=>{
 const f=await fixture();let connections=0;const original=http.request
 // Instrument only Node's real socket event ordering in this test. The server's
 // accept event is not proof that the client has not already written bytes.
 http.request=(...args)=>{const req=original(...args);req.prependOnceListener('socket',socket=>socket.prependOnceListener('connect',()=>{connections++;f.state.subject=null}));return req}
 try{const result=await open(f);assert.equal(result.ok,false);assert.equal(connections,1);assert.equal(f.calls.length,0)}finally{http.request=original}
})
await test('a hanging underlying identity guard remains owned across timed-out waves and is never cached as permission',async()=>{
 const f=await fixture({timeoutMs:25}),wait=deferred();let guards=0
 f.state.guard=()=>{guards++;return wait.promise}
 assert.equal((await open(f)).ok,false)
 for(let wave=0;wave<3;wave++){await new Promise(r=>setTimeout(r,30));const results=await Promise.all(Array.from({length:8},()=>open(f)));assert(results.every(r=>!r.ok))}
 assert.equal(guards,1);assert.equal(f.calls.length,0)
 wait.resolve({ok:false,why:'not_a_member',says:'private'});await new Promise(r=>setImmediate(r))
 f.state.subject={...f.state.subject,revision:2};f.state.guard=async()=>{guards++;return {ok:false,why:'not_a_member',says:'private'}}
 assert.equal((await open(f)).ok,false);assert.equal(guards,2);assert.equal(f.calls.length,0)
 f.state.guard=async()=>{guards++;return {ok:true,subject:f.state.subject}}
 assert.equal((await open(f)).ok,true);assert(guards>2);assert.equal(f.calls[0].args.p_revision,2)
})
await test('whole-service deadline survives a slow authority read at the actual socket write edge',async()=>{
 const f=await fixture({timeoutMs:100});let guards=0,armed=false,writes=0;const original=http.request
 f.state.guard=async()=>{if(++guards<=2)await new Promise(r=>setTimeout(r,30));return {ok:true,subject:f.state.subject}}
 f.state.onHeld=()=>{if(armed){armed=false;const until=performance.now()+60;while(performance.now()<until){}}}
 http.request=(...args)=>{const req=original(...args),end=req.end;req.end=function(...a){writes++;return end.apply(this,a)};req.prependOnceListener('socket',s=>s.prependOnceListener('connect',()=>{armed=true}));return req}
 try{assert.equal((await open(f)).ok,false);assert.equal(writes,0);assert.equal(f.calls.length,0)}finally{http.request=original}
})
await test('response timeout closes socket, has no retry and cannot turn late reply into success',async()=>{
 // 1.5 s, not 30 ms: the server holds its answer, so the deadline is still what ends the call, but a loaded host
 // passed 30 ms before the request reached the server and this await never settled (fast gate hung, 2026-10-05).
 const f=await fixture({timeoutMs:1500}),seen=deferred();let response
 f.state.respond=(req,res)=>{response=res;seen.resolve()};const request=open(f)
 await Promise.race([seen.promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('the request never reached the owned server')),10_000))])
 const result=await request;assert.equal(result.state,'commit_unknown');assert.equal(f.calls.length,1)
 response.end(JSON.stringify({ok:true,conversation_id:C,revision:0,receipt_seq:1,repeated:false}))
 await new Promise(r=>setTimeout(r,40));assert.equal(f.calls.length,1);assert.equal(f.sockets.size,0)
})
await test('identity changes while response is pending suppress private response',async()=>{
 const f=await fixture(),seen=deferred();let response
 f.state.respond=(req,res)=>{response=res;seen.resolve()};const task=open(f);await seen.promise;f.state.subject={...f.state.subject,revision:2}
 response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({ok:true,conversation_id:C,revision:0,receipt_seq:1,repeated:false}))
 assert.equal((await task).ok,false);assert.equal(f.calls.length,1)
})
await test('HTTP errors, redirects, malformed JSON/UTF8 and oversized responses yield fixed private-safe failures',async()=>{
 for(const mode of ['error','redirect','invalid-json','invalid-utf8','large-length','large-stream','json-error','encoding','deep']){
  const f=await fixture();f.state.respond=(req,res)=>{
   if(mode==='error'){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'synthetic-private-backend-text'}))}
   else if(mode==='redirect'){res.writeHead(307,{location:'/stolen'});res.end()}
   else if(mode==='invalid-json'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{synthetic-private-parser-text')}
   else if(mode==='invalid-utf8'){res.writeHead(200,{'Content-Type':'application/json'});res.end(Buffer.from([0xff]))}
   else if(mode==='large-length'){res.writeHead(200,{'Content-Type':'application/json','Content-Length':5000000});res.end()}
   else if(mode==='large-stream'){res.writeHead(200,{'Content-Type':'application/json'});res.end(' '.repeat(4*1024*1024+1))}
   else if(mode==='encoding'){res.writeHead(200,{'Content-Type':'application/json','Content-Encoding':'gzip'});res.end('bad')}
   else if(mode==='deep'){res.writeHead(200,{'Content-Type':'application/json'});res.end('['.repeat(20)+'0'+']'.repeat(20))}
   else{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,reason_code:'synthetic-private-backend-text'}))}
  }
  const result=await open(f);assert.equal(result.ok,false,mode);assert(!JSON.stringify(result).includes('synthetic-private'),mode);assert.equal(f.calls.length,1,mode)
 }
})
await test('unsafe URL/key configuration is refused without network or diagnostic echo',async()=>{
 const f=await fixture()
 for(const url of ['http://example.com','https://user:synthetic-password@example.com','https://example.com?q=private','https://example.com#private','https://example.com?','https://example.com#','file:///private'])assert.throws(()=>createCeoConversationHost({...f.options,connection:{url,serviceKey:key,allowLoopbackHttp:true}}),/^Error: invalid_ceo_host_configuration$/)
 assert.throws(()=>createCeoConversationHost({...f.options,connection:{url:f.options.connection.url,serviceKey:key}}),/invalid_ceo_host_configuration/)
 assert.throws(()=>createCeoConversationHost({...f.options,connection:{...f.options.connection,serviceKey:'private\nheader'}}),/^Error: invalid_ceo_host_configuration$/)
 assert.equal(f.calls.length,0)
})
await test('offline draft work remains local and network refusal never persists credentials',async()=>{
 const f=await fixture();await freeze(f);f.state.online=false;assert.equal((await f.host.send(C,OP)).state,'saved_locally');assert.equal(f.calls.length,0)
 const ns=path.join(f.dir,'ceo-conversations',id(1),id(2));for(const name of readdirSync(ns)){const text=readFileSync(path.join(ns,name),'utf8');assert(!text.includes(key));assert(!text.includes('synthetic-secret-canary'))}
})
console.log(`PASS ${count} actual owned HTTP host groups; no SDK patch, database or model calls`)
}finally{for(const close of resources.reverse())await close();console.log('PASS cleanup: owned sockets, servers and private temporary files removed')}
