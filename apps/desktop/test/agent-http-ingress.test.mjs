// Owned loopback HTTP/MCP server with an inert storage port. No Supabase client,
// configured database URL, provider process, model request or historical data.
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { AgentSurface } from '../src/main/agentSurface.ts'
import { createDesktopJournal } from '../src/main/desktopIngress.ts'
import { redact } from '../src/shared/redact.ts'
import { createOps } from '../src/main/ops.ts'
import { useOps } from '../src/main/opsSink.ts'
import { mkdtempSync,readFileSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const estate=randomUUID(),project=randomUUID(),session=randomUUID(),task=randomUUID()
const opsDir=mkdtempSync(join(tmpdir(),'fabric-http-ingress-')),log=createOps({dir:opsDir});useOps(log)
const events=[],reads=[],rpcs=[],questions=new Map(),leases=new Map(),policyCalls=[]
const base={append:async input=>{
 const event={...structuredClone(input),seq:events.length+1};events.push(event)
 if(event.type==='question.asked@1')questions.set(event.payload.command_id,{id:event.payload.id,status:'open',seq:event.seq})
 if(event.type==='work.claimed@1')leases.set(event.payload.work,{owner_session:session,expires_at:event.payload.expires_at,write_scopes:event.payload.write_scopes})
 return event
}}
const db={from(table){const filters=[];let single=false
 const q={select(){return q},eq(k,v){filters.push([k,v]);return q},is(){return q},gt(){return q},order(){return q},limit(){return q},in(){return q},textSearch(k,v){reads.push({table,search:v});return q},maybeSingle(){single=true;return q},
 then(resolve,reject){reads.push({table,filters});let data=[]
  if(table==='project_tasks')data=[{id:task,status:'backlog',title:'ordinary',instruction:'ordinary'}]
  if(table==='questions')data=[questions.get(filters.find(([k])=>k==='asked_command_id')?.[1])].filter(Boolean)
  if(table==='leases')data=[leases.get(filters.find(([k])=>k==='work_id')?.[1])].filter(Boolean)
  return Promise.resolve({data:single?data[0]??null:data,error:null}).then(resolve,reject)
 }};return q
},rpc:async(name,args)=>{rpcs.push({name,args:structuredClone(args)});return {data:{accepted:false,reason_code:'unknown_delivery'},error:null}}}
const surface=new AgentSurface({db,journal:createDesktopJournal(base),estateId:estate,ptys:()=>null,
 policy:{findGrantFor:async arg=>{policyCalls.push(arg);return null},decide:async()=>({verdict:'refuse',reason:'fixture refusal'})}})
let sid,id=0,count=0
async function post(body,token){const r=await fetch(surface.endpoint,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream',authorization:'Bearer '+token,...(sid?{'mcp-session-id':sid}:{})},body:JSON.stringify(body)});return {status:r.status,sid:r.headers.get('mcp-session-id'),body:await r.json()}}
let token
async function call(name,args){const r=await post({jsonrpc:'2.0',id:++id,method:'tools/call',params:{name,arguments:args}},token);assert.equal(r.status,200);return r.body.result}
async function test(name,run){await run();count++;console.log('PASS '+name)}
const secret='sk-ant-'+ 'Q'.repeat(40),fragment='sk-ant-'+ 'Q'.repeat(8)
try{
 await surface.start();token=surface.mint(project,session,task).token
 const init=await post({jsonrpc:'2.0',id:++id,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'owned-ingress-fixture',version:'1.0.0'}}},token)
 assert.equal(init.status,200);sid=init.sid;assert.ok(sid)
 await test('unminted bearer cannot reach a tool or storage',async()=>{
  const before=events.length;const bad=await post({jsonrpc:'2.0',id:++id,method:'tools/call',params:{name:'fabric_stage_report',arguments:{stage:secret}}},'unminted-synthetic')
  assert.equal(bad.status,401);assert.equal(events.length,before)
 })
 await test('complete option text is cleaned before normalizer caps',async()=>{
  const label='x'.repeat(181)+' '+secret, consequence='y'.repeat(3981)+' '+secret
  const result=await call('fabric_question_ask',{commandId:randomUUID(),text:'Choose safely',options:[{id:'keep-this-id',label,consequence}]})
  assert.ok(!result.isError,JSON.stringify(result))
  const e=events.at(-1);assert.equal(e.type,'question.asked@1');assert.equal(e.payload.options[0].id,'keep-this-id')
  assert.ok(!JSON.stringify(e).includes(fragment),'clipped credential prefix reached storage')
  assert.equal(e.payload.options[0].label,redact(label).text.slice(0,200))
  assert.equal(e.payload.options[0].consequence,redact(consequence).text.slice(0,4000))
 })
 await test('secret-bearing authority input is refused before storage/query and never rewritten',async()=>{
  for(const [name,args] of [
   ['fabric_question_ask',{commandId:randomUUID(),text:'Question',options:[{id:secret,label:'Ordinary'}]}],
   ['fabric_question_ask',{commandId:randomUUID(),text:'Question',about:secret}],
   ['fabric_memory_remember',{claim:'Ordinary claim',about:{namespace:'project',key:'SERVICE_TOKEN=synthetic-private-value'}}],
   ['fabric_memory_remember',{claim:'Ordinary claim',sourceRef:secret}],
   ...['system','sourceId','episodeKey'].map(field=>['fabric_memory_remember',{claim:'Ordinary claim',occurrence:{system:'system-A',sourceId:'source-A',episodeKey:'episode-A',[field]:secret}}]),
   ['fabric_task_handoff',{taskId:task,name:secret,value:'Ordinary result'}],
   ['fabric_task_claim',{taskId:task,writeScopes:['/Synthetic/'+secret]}],
   ['fabric_task_create',{title:'Ordinary task',origin:{kind:'document',ref:secret}}],
   ['fabric_task_accept',{deliveryId:randomUUID(),inputDigest:secret}],
   ['fabric_effect_request',{actionClass:secret,floorClass:'publication',target:'https://example.invalid',why:'Ordinary reason'}],
   ['fabric_effect_request',{actionClass:'publish',floorClass:'publication',target:'https://example.invalid/'+secret,why:'Ordinary reason'}]
  ]){
   const before=[events.length,reads.length,rpcs.length,policyCalls.length]
   const result=await call(name,args);assert.equal(result.isError,true,name)
   assert.ok(!JSON.stringify(result).includes(secret));assert.deepEqual([events.length,reads.length,rpcs.length,policyCalls.length],before,name)
  }
 })
 await test('covered memory provenance identifiers retain their exact bytes',async()=>{
  const sourceRef='docs/Дизайн.md:12',occurrence={system:'Synthetic System',sourceId:'CaseSensitive::A-09',episodeKey:'épisode-7'}
  const out=await call('fabric_memory_remember',{claim:'Ordinary provenance',sourceRef,occurrence})
  assert.ok(!out.isError,JSON.stringify(out));const p=events.at(-1).payload
  assert.equal(p.source_ref,sourceRef);assert.deepEqual(p.occurrence,{system:occurrence.system,source_id:occurrence.sourceId,episode_key:occurrence.episodeKey})
 })
 await test('question optional blanks and ordinary identifiers preserve existing domain semantics',async()=>{
  const result=await call('fabric_question_ask',{commandId:randomUUID(),text:'Question',topic:' ',whyBlocked:'',about:'db.version',options:[{id:'café-option',label:'Ordinary label',consequence:''}]})
  assert.ok(!result.isError);const e=events.at(-1);assert.equal(e.payload.options[0].id,'café-option')
  assert.equal(e.payload.topic,null);assert.equal(e.payload.why_blocked,null);assert.ok(!Object.hasOwn(e.payload.options[0],'consequence'))
  const before=events.length,out=await call('fabric_question_ask',{commandId:randomUUID(),text:' ',options:[]})
  assert.equal(JSON.parse(out.content[0].text).asked,false);assert.equal(events.length,before)
 })
 await test('multiline PEM and full sensitive text never reach question storage',async()=>{
  const pem='-----BEGIN PRIVATE KEY-----\nSYNTHETIC_PRIVATE_BODY_CANARY\n-----END PRIVATE KEY-----'
  await call('fabric_question_ask',{commandId:randomUUID(),text:'Question '+pem,whyBlocked:'SERVICE_TOKEN=synthetic-opaque-canary',options:[{id:'keep',label:'Ordinary',consequence:'Detail '+pem}]})
  const stored=JSON.stringify(events.at(-1));assert.ok(!stored.includes('SYNTHETIC_PRIVATE_BODY_CANARY'));assert.ok(!stored.includes('synthetic-opaque-canary'))
 })
 await test('ordinary question receipt identity and repeated command stay exact',async()=>{
  const commandId=randomUUID(),args={commandId,text:'Ordinary question',about:'db.version',options:[{id:'opt-1',label:'Retain Unicode café',consequence:'Keep existing work'}]}
  const first=JSON.parse((await call('fabric_question_ask',args)).content[0].text),before=events.length
  const again=JSON.parse((await call('fabric_question_ask',args)).content[0].text)
  assert.equal(first.question_id,again.question_id);assert.equal(again.repeated,true);assert.equal(events.length,before)
  assert.equal(events.at(-1).payload.command_id,commandId)
 })
 await test('covered text and retrieval still use canonical desktop preparation',async()=>{
  for(const [name,args,type,field] of [
   ['fabric_task_note',{taskId:task,body:'Note '+secret},'task.note.added@1','body_md'],
   ['fabric_task_brief',{taskId:task,section:'what',body:'Brief '+secret},'task.brief.edited@1','body_md'],
   ['fabric_memory_remember',{claim:'Claim '+secret},'memory.project.recorded@1','claim'],
   ['fabric_stage_report',{stage:'Stage '+secret},'agent.stage.reported@1','stage']
  ]){const out=await call(name,args);assert.ok(!out.isError,JSON.stringify(out));const e=events.at(-1);assert.equal(e.type,type);assert.ok(!e.payload[field].includes(secret));assert.equal(e.actor.id,session);assert.equal(e.projectId,project)}
  const query='Find '+secret;await call('fabric_memory_search',{query})
  assert.equal(reads.findLast(r=>r.search)?.search,redact(query).text)
  assert.equal(events.at(-1).payload.query,redact(query).text)
 })
 await test('delivery acknowledgement preserves supplied canonical digest and bound IDs',async()=>{
  const digest=createHash('sha256').update('canonical cleaned instruction').digest('hex').slice(0,32),deliveryId=randomUUID()
  await call('fabric_task_accept',{deliveryId,inputDigest:digest})
  assert.deepEqual(rpcs.at(-1),{name:'acknowledge_delivery',args:{p_estate_id:estate,p_session_id:session,p_delivery_id:deliveryId,p_digest:digest}})
 })
 await test('actual local ops sink keeps receipt identities but not input secrets or fragments',async()=>{
  const bytes=readFileSync(log.file(),'utf8');assert.ok(bytes.includes('tool.fabric_question_ask'));
  for(const canary of [secret,fragment,'synthetic-opaque-canary','SYNTHETIC_PRIVATE_BODY_CANARY'])assert.ok(!bytes.includes(canary));assert.ok(bytes.includes(session))
 })
 console.log(`${count} owned HTTP/MCP ingress scenarios PASS`)
}finally{await surface.stop();rmSync(opsDir,{recursive:true,force:true})}
