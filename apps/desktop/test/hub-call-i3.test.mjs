// I3 author regressions: synthetic fixtures; no live product, vault or credentials.
import assert from 'node:assert/strict'
import http from 'node:http'
import { test } from 'node:test'
const { createAgentCall } = await import(process.env.HUB_CALL_MODULE ?? '../src/main/hubCall.ts')
const { useOps } = await import('../src/main/opsSink.ts')
const { forwardToProduct } = await import(process.env.FORWARDER_MODULE ?? '../src/main/productForwarder.ts')
const binding={id:'22222222-2222-4222-8222-222222222222',agent_id:'example-agent',revoked_at:null}
const grant={id:'33333333-3333-4333-8333-333333333333',callee:'fabric-inbox',capability:'send_email',resource:'cloudflare:news@example.com',expires_at:'2099-01-01T00:00:00Z',revoked_at:null}
const conn={id:'44444444-4444-4444-8444-444444444444',product:'fabric-inbox',mcp_url:'https://example.invalid/mcp',client_id:'synthetic-client',secret_ref:{project:'fabric',env:'local',name:'SYNTHETIC'}}
const args=key=>({agentId:'fabric-inbox',capability:'send_email',input:{accountId:'cloudflare:news@example.com',to:'test@example.com',text:'synthetic'},idempotencyKey:key})
const code=a=>a.structuredContent?.error?.code
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
function fixture(forward,overrides={}) {return createAgentCall({estateId:'11111111-1111-4111-8111-111111111111',access:{liveGrantsOf:async()=>[structuredClone(grant)]},store:{liveConnection:async()=>structuredClone(conn),append:async()=>1},vault:{read:async()=>({ok:true,value:'synthetic-secret'})},forward,...overrides})}
const good=()=>({ok:true,result:{structuredContent:{sent:true}},wallMs:1})
for(const state of ['unknown','answered','ran']) test(`I3 capacity preserves ${state} key and refuses fresh effect`,async()=>{
 let sends=0
 const call=fixture(async()=>{sends++;return state==='unknown'?{ok:false,code:'product-unreachable',message:'lost',reached:true,wallMs:1}:state==='ran'?{ok:true,result:{structuredContent:{text:'x'.repeat(150_000)}},wallMs:1}:good()})
 await call(binding,args('original'))
 for(let n=0;n<255;n++) await call(binding,args('new-'+n))
 assert.equal(code(await call(binding,args('overflow'))),'idempotency-capacity')
 await call(binding,args('original'));assert.equal(sends,256);assert.equal(call.memory().keys,256)
})
test('I3 all inflight keys occupy admission slots',async()=>{
 const held=gate();let sends=0;const call=fixture(async()=>{sends++;await held.promise;return good()})
 const running=Array.from({length:256},(_,n)=>call(binding,args('inflight-'+n)))
 try {const overflow=call(binding,args('overflow'));const result=await Promise.race([overflow,new Promise((_,reject)=>setTimeout(()=>reject(Error('fresh work blocked inside forward rather than admission')),500))]);assert.equal(code(result),'idempotency-capacity');assert.equal(call.memory().keys,256)} finally {held.resolve();await Promise.all(running)}
 assert.equal(sends,256)
})
test('I3 unproven thrown forward retains unknown and hides raw error',async()=>{
 let sends=0;const call=fixture(async()=>{sends++;throw Error('synthetic-secret synthetic-client /private/path')})
 const first=await call(binding,args('throw'));const retry=await call(binding,args('throw'))
 assert.equal(code(first),'outcome-unknown');assert.equal(code(retry),'outcome-unknown');assert.equal(sends,1)
 assert.doesNotMatch(JSON.stringify(first),/synthetic-secret|synthetic-client|Nothing was sent|private\/path/)
})
for(const change of ['revoked','expired','disconnected','reconnected']) test(`I3 ${change} during vault await prevents dispatch`,async()=>{
 const entered=gate(),held=gate();let changed=false,sends=0,time=Date.parse('2026-10-04T00:00:00Z')
 const call=fixture(async()=>{sends++;return good()},{now:()=>time,access:{liveGrantsOf:async()=>changed&&change==='revoked'?[]:[{...grant,expires_at:changed&&change==='expired'?'2026-10-03T00:00:00Z':grant.expires_at}]},store:{liveConnection:async()=>changed&&change==='disconnected'?null:{...conn,id:changed&&change==='reconnected'?'55555555-5555-4555-8555-555555555555':conn.id},append:async()=>1},vault:{read:async()=>{entered.resolve();await held.promise;return {ok:true,value:'synthetic-secret'}}}})
 const running=call(binding,args(change));await entered.promise;changed=true;held.resolve();const answer=await running
 assert.equal(sends,0);assert.equal(answer.isError,true)
 changed=false;await call(binding,args(change));assert.equal(sends,1,'proven no-write refusal may retry after authority returns')
})
test('I3 errors before dispatch remain retryable',async()=>{
 let failed=true,sends=0;const call=fixture(async()=>{sends++;return good()},{access:{liveGrantsOf:async()=>{if(failed)throw Error('database unavailable');return [grant]}}})
 assert.equal(code(await call(binding,args('read-fails'))),'hub-unavailable');failed=false;await call(binding,args('read-fails'));assert.equal(sends,1)
})
test('I3 expired remembered keys release capacity only after 24 hours',async()=>{
 let time=Date.now(),sends=0;const call=fixture(async()=>{sends++;return good()},{now:()=>time})
 for(let n=0;n<256;n++)await call(binding,args('old-'+n));time+=24*60*60*1000+1
 await call(binding,args('fresh'));assert.equal(sends,257);assert.equal(call.memory().keys,1)
})
async function mcp(result) {
 let calls=0
 const server=http.createServer((req,res)=>{if(req.method==='GET'){res.writeHead(405).end();return}let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{const b=JSON.parse(raw);if(b.method==='notifications/initialized'){res.writeHead(202).end();return}res.writeHead(200,{'content-type':'application/json'});if(b.method==='initialize')res.end(JSON.stringify({jsonrpc:'2.0',id:b.id,result:{protocolVersion:b.params.protocolVersion,serverInfo:{name:'fabric-inbox',version:'0.9.0'},capabilities:{tools:{}}}}));else {calls++;res.end('{"jsonrpc":"2.0","id":'+JSON.stringify(b.id)+',"result":'+result(req)+'}')}})})
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const call=fixture(forwardToProduct,{store:{liveConnection:async()=>({...conn,mcp_url:`http://127.0.0.1:${server.address().port}`}),append:async()=>1}})
 return {call,url:`http://127.0.0.1:${server.address().port}`,calls:()=>calls,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))}}
}
test('I3 actual MCP 6500-deep result retains unknown without second tools/call',async()=>{
 const f=await mcp(()=>'{"content":[],"structuredContent":{"deep":'+'{"x":'.repeat(6500)+'0'+'}'.repeat(6500)+'}}')
 try {const first=await f.call(binding,args('deep'));const retry=await f.call(binding,args('deep'));assert.equal(code(first),'outcome-unknown');assert.equal(code(retry),'outcome-unknown');assert.equal(f.calls(),1)} finally {await f.close()}
})
test('I3 actual MCP tool error is fixed text without echoed credentials',async()=>{
 const f=await mcp(req=>JSON.stringify({isError:true,content:[{type:'text',text:'debug '+req.headers['cf-access-client-secret']+' '+req.headers['cf-access-client-id']+' /private/product'}],structuredContent:{reason:'synthetic-secret synthetic-client'}}))
 try {const first=await f.call(binding,args('error'));assert.equal(first.structuredContent.outcome,'failed');assert.equal(first.isError,true);assert.doesNotMatch(JSON.stringify(first),/synthetic-secret|synthetic-client|private\/product/);await f.call(binding,args('error'));assert.equal(f.calls(),1)} finally {await f.close()}
})
test('I3 successful product output strips credential echoes and stays replayable',async()=>{
 let sends=0;const call=fixture(async()=>{sends++;return {ok:true,result:{structuredContent:{mail:{text:'synthetic-secret synthetic-client',ok:true}}},wallMs:1}})
 const first=await call(binding,args('success'));assert.equal(first.structuredContent.outcome,'succeeded');assert.equal(first.structuredContent.output.mail.ok,true);assert.doesNotMatch(JSON.stringify(first),/synthetic-secret|synthetic-client/);await call(binding,args('success'));assert.equal(sends,1)
})
test('I3 cyclic/unserializable/oversize result retains unknown',async()=>{
 const cyclic={};cyclic.x=cyclic
 for(const value of [cyclic,{big:1n},{huge:'x'.repeat(4*1024*1024+1)}]) {let sends=0;const call=fixture(async()=>{sends++;return {ok:true,result:{structuredContent:value},wallMs:1}});assert.equal(code(await call(binding,args('bad'))),'outcome-unknown');await call(binding,args('bad'));assert.equal(sends,1)}
})

test('I3 unknown key never expires in the current process',async()=>{
 let time=Date.now(),sends=0;const call=fixture(async()=>{sends++;return {ok:false,code:'product-unreachable',message:'lost',reached:true,wallMs:1}},{now:()=>time})
 await call(binding,args('unknown-old'));time+=48*60*60*1000
 await call(binding,args('trigger-sweep'));assert.equal(code(await call(binding,args('unknown-old'))),'outcome-unknown');assert.equal(sends,2);assert.equal(call.memory().keys,2)
})
test('I3 thrown and returned product diagnostics never expose credential in operations',async()=>{
 const records=[];useOps({correlate:()=> 'synthetic',record:r=>records.push({...r,error:r.error instanceof Error?String(r.error):r.error})})
 try {
  const thrown=fixture(async()=>{throw Error('synthetic-secret synthetic-client')});await thrown(binding,args('throw-log'))
  const returned=fixture(async()=>({ok:false,code:'product-error',message:'synthetic-secret synthetic-client',reached:true,wallMs:1}));await returned(binding,args('returned-log'))
  assert.ok(records.length>0);assert.doesNotMatch(JSON.stringify(records),/synthetic-secret|synthetic-client/)
 } finally {useOps(null)}
})
test('I3 product depth and node limits refuse before serializing a usable answer',async()=>{
 const nest=n=>{let v=0;while(n--)v={x:v};return v}
 for(const value of [{deep:nest(65)},{many:Array(100_001).fill(0)}]) {let sends=0;const call=fixture(async()=>{sends++;return {ok:true,result:{structuredContent:value},wallMs:1}});assert.equal(code(await call(binding,args('bound'))),'outcome-unknown');await call(binding,args('bound'));assert.equal(sends,1)}
 const call=fixture(async()=>({ok:true,result:{structuredContent:{deep:nest(62)}},wallMs:1}));assert.equal((await call(binding,args('within'))).structuredContent.outcome,'succeeded')
})
test('I3 forwarder bounds actual MCP response bytes before SDK decode',async()=>{
 for(const bytes of [7*1024*1024,8*1024*1024+1]) {
  const f=await mcp(()=>JSON.stringify({content:[],structuredContent:{huge:'x'.repeat(bytes)}}))
  try {const result=await forwardToProduct({mcpUrl:f.url,clientId:'synthetic-client',clientSecret:'synthetic-secret',narrowing:null,capability:'send_email',input:{},traceparent:'00-11111111111111111111111111111111-1111111111111111-01',timeoutMs:1000});assert.equal(result.ok,bytes<8*1024*1024);if(!result.ok)assert.equal(result.reached,true);assert.equal(f.calls(),1)} finally {await f.close()}
 }
})
test('I3 binding retirement discards cached output and retains effect facts',async()=>{
 for(const uncertain of [false,true]) {
  let sends=0;const call=fixture(async()=>{sends++;return uncertain?{ok:false,code:'product-error',message:'lost',reached:true,wallMs:1}:good()})
  await call(binding,args('retired'));assert.equal(call.memory().keys,1);call.forgetBinding(binding.id)
  assert.equal(call.memory().keys,1);assert.equal(call.memory().bytes,0)
  assert.equal(code(await call(binding,args('retired'))),'binding-revoked');assert.equal(code(await call(binding,args('fresh-retired'))),'binding-revoked');assert.equal(sends,1)
 }
})
test('I3 inflight completion cannot recache a retired binding answer',async()=>{
 const held=gate(),entered=gate();let sends=0;const call=fixture(async()=>{sends++;entered.resolve();await held.promise;return good()})
 const running=call(binding,args('retire-inflight'));await entered.promise;call.forgetBinding(binding.id);held.resolve();await running
 assert.equal(call.memory().keys,1);assert.equal(call.memory().bytes,0);assert.equal(code(await call(binding,args('retire-inflight'))),'binding-revoked');assert.equal(sends,1)
})
test('I3 retiring a binding during vault await refuses even a stale grant snapshot',async()=>{
 const entered=gate(),held=gate();let sends=0;const call=fixture(async()=>{sends++;return good()},{vault:{read:async()=>{entered.resolve();await held.promise;return {ok:true,value:'synthetic-secret'}}}})
 const running=call(binding,args('retire-vault'));await entered.promise;call.forgetBinding(binding.id);held.resolve();const result=await running
 assert.equal(code(result),'binding-revoked');assert.equal(sends,0)
})
