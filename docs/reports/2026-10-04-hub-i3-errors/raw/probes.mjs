// Independent reviewer probes. Synthetic fixtures only; no author receipts are inputs.
import assert from 'node:assert/strict'
import http from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { createAgentCall } from '../../../../apps/desktop/src/main/hubCall.ts'
import { ProductConnector, FABRIC_INBOX } from '../../../../apps/desktop/src/main/productConnect.ts'
import { AgentSurface } from '../../../../apps/desktop/src/main/agentSurface.ts'
import { hubServerFor } from '../../../../apps/desktop/src/main/hubTools.ts'
import { forwardToProduct } from '../../../../apps/desktop/src/main/productForwarder.ts'
import { verifiedCandidateProblem } from '../../../../scripts/lib/release-mac.mjs'

const estate = '11111111-1111-4111-8111-111111111111'
const binding = { id: '22222222-2222-4222-8222-222222222222', agent_id: 'example-agent', revoked_at: null }
const grant = { id: '33333333-3333-4333-8333-333333333333', callee: 'fabric-inbox', capability: 'send_email', resource: 'cloudflare:news@example.com', expires_at: '2099-01-01T00:00:00Z', revoked_at: null }
const args = key => ({agentId: 'fabric-inbox', capability: 'send_email', input: {accountId: 'cloudflare:news@example.com', to: 'test@example.com', text: 'synthetic'}, idempotencyKey:key})
const conn = {id:'44444444-4444-4444-8444-444444444444', product:'fabric-inbox', mcp_url:'https://example.invalid/mcp', client_id:'synthetic-client', secret_ref:{project:'fabric',env:'local',name:'SYNTHETIC'}}
const deferred = () => { let resolve; const promise = new Promise(r=>resolve=r); return {promise,resolve} }
const errorCode = a => a?.structuredContent?.error?.code ?? null
const results=[]
async function check(name, expected, fn) {
  try { const observed=await fn(); const pass=expected(observed); results.push({name,pass,observed}); console.log(JSON.stringify(results.at(-1))) }
  catch(e) { results.push({name,pass:false,probeError:String(e.stack)}); console.log(JSON.stringify(results.at(-1))) }
}
function caller(forward, overrides={}) {
  return createAgentCall({ estateId:estate, access:{liveGrantsOf:async()=>[structuredClone(grant)]}, store:{liveConnection:async()=>structuredClone(conn),append:async()=>1}, vault:{read:async()=>({ok:true,value:'synthetic-secret'})}, forward, ...overrides })
}

await check('unknown replay within capacity sends once', o=>o.count===1&&o.code==='outcome-unknown', async()=>{
  let count=0; const call=caller(async()=>{count++;return {ok:false,code:'product-unreachable',message:'synthetic loss',reached:true,wallMs:1}})
  await call(binding,args('unknown'),undefined); const retry=await call(binding,args('unknown'),undefined); return {count,code:errorCode(retry)}
})
await check('unknown replay after 256 newer calls must not send twice', o=>o.count===1, async()=>{
  let count=0; const call=caller(async()=>{count++;return {ok:false,code:'product-unreachable',message:'synthetic loss',reached:true,wallMs:1}})
  await call(binding,args('original-unknown'),undefined)
  for(let n=0;n<256;n++) await call(binding,args('newer-'+n),undefined)
  const before=count; const retry=await call(binding,args('original-unknown'),undefined); return {count:count-before+1,totalCalls:count,code:errorCode(retry),memory:call.memory()}
})
await check('throw after dispatch must preserve unknown key', o=>o.count===1&&o.code==='outcome-unknown', async()=>{
  let count=0; const call=caller(async()=>{count++;throw new Error('synthetic thrown after dispatch')})
  await call(binding,args('thrown'),undefined);const retry=await call(binding,args('thrown'),undefined);return {count,code:errorCode(retry),message:retry.structuredContent?.error?.message}
})
await check('revocation during vault await prevents dispatch', o=>o.dispatched===0, async()=>{
  const gate=deferred(), readStarted=deferred();let live=true,dispatched=0
  const call=caller(async()=>{dispatched++;return {ok:true,result:{structuredContent:{ok:true}},wallMs:1}}, {access:{liveGrantsOf:async()=>live?[structuredClone(grant)]:[]},vault:{read:async()=>{readStarted.resolve();await gate.promise;return {ok:true,value:'synthetic-secret'}}}})
  const running=call(binding,args('revoked'),undefined);await readStarted.promise;live=false;gate.resolve();const answer=await running;return {dispatched,code:errorCode(answer),outcome:answer.structuredContent?.outcome}
})
await check('caller cancellation before vault resolves prevents dispatch',o=>o.dispatched===0&&o.code==='cancelled',async()=>{
  const gate=deferred(),readStarted=deferred(),abort=new AbortController();let dispatched=0
  const call=caller(async()=>{dispatched++;return {ok:true,result:{},wallMs:1}}, {vault:{read:async()=>{readStarted.resolve();await gate.promise;return {ok:true,value:'synthetic-secret'}}}})
  const running=call(binding,args('cancelled'),undefined,abort.signal);await readStarted.promise;abort.abort();gate.resolve();const answer=await running;return {dispatched,code:errorCode(answer)}
})
await check('parallel matching key dispatches once',o=>o.dispatched===1,async()=>{
  const gate=deferred();let dispatched=0;const call=caller(async()=>{dispatched++;await gate.promise;return {ok:true,result:{structuredContent:{ok:true}},wallMs:1}})
  const a=call(binding,args('parallel'),undefined),b=call(binding,args('parallel'),undefined);await delay(10);gate.resolve();await Promise.all([a,b]);return {dispatched}
})

const fakeAccess={primeCredentialVerifiers:async()=>{},knownCredential:()=>true,authenticate:async()=>binding,request:async()=>({ok:true}),status:async()=>({ok:true}),liveGrantsOf:async()=>[]}
const surface=new AgentSurface({db:{},journal:{},ptys:()=>undefined,estateId:estate, limits:{budgetCalls:2},hub:{doorToken:()=> 'synthetic-door',access:fakeAccess,tools:p=>hubServerFor(p,{access:fakeAccess})}})
await surface.start()
const endpoint=new URL(surface.endpoint)
function raw(body,{host=endpoint.host,origin,auth='synthetic-door'}={}) {
  return new Promise((resolve,reject)=>{const req=http.request(endpoint,{method:'POST',headers:{host,authorization:'Bearer '+auth,'content-type':'application/json',accept:'application/json, text/event-stream',...(origin===undefined?{}:{origin})}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,body:text}))});req.on('error',reject);req.end(typeof body==='string'?body:JSON.stringify(body))})
}
await check('host mismatch refused before auth',o=>o.status===421,()=>raw({}, {host:'evil.invalid'}))
await check('browser origin refused before auth',o=>o.status===403,()=>raw({}, {origin:'http://127.0.0.1'}))
await check('batch refused',o=>o.status===400,()=>raw([{jsonrpc:'2.0',id:1,method:'tools/list'}]))
await check('oversized envelope gives explicit 413',o=>o.status===413,()=>raw(' '.repeat(1_000_001)))
await check('stalled bodies do not bypass admission budget',o=>o.pending<=2,async()=>{
  const reqs=[];let pending=0
  for(let n=0;n<6;n++) {const req=http.request(endpoint,{method:'POST',headers:{authorization:'Bearer synthetic-door','content-type':'application/json','content-length':1000,accept:'application/json, text/event-stream'}},res=>{res.resume();pending--});req.on('error',()=>{});req.flushHeaders();req.write('{');reqs.push(req);pending++}
  await delay(250);const out={pending,budgetCalls:2,heldMs:250};reqs.forEach(r=>r.destroy());return out
})
await surface.stop()

async function connectFixture({appendDelay=false,vaultDelay=false}={}) {
  const appendGate=deferred(),vaultGate=deferred(),entered=deferred();let live=null,link='',events=[]
  const store={liveConnection:async()=>live,append:async(type,actor,p)=>{if(type==='product.connected@1'){entered.resolve();if(appendDelay)await appendGate.promise;live={...p,removed_at:null}}else if(type==='product.disconnected@1'){if(live?.id===p.id)live=null}events.push(type);return events.length}}
  const connector=new ProductConnector({estateId:estate,store,vault:{put:async()=>{if(vaultDelay){entered.resolve();await vaultGate.promise}return {ok:true}}},origin:()=>origin,openExternal:async u=>{link=u},actor:()=>({kind:'operator',id:'synthetic'}),callbackDeadlineMs:30})
  const server=http.createServer((req,res)=>connector.callback('fabric-inbox',req,res).catch(e=>{res.writeHead(500).end(String(e))}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`
  await connector.begin(FABRIC_INBOX);const state=new URL(link).searchParams.get('state');const body={state,outcome:'connected',server:'https://example.invalid',mcpUrl:'https://example.invalid/mcp',key:{id:'synthetic',clientId:'synthetic',level:'admin',send:'drafts'},clientSecret:'synthetic-secret'}
  return {connector,server,origin,body,appendGate,vaultGate,entered,events,live:()=>live,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))}}
}
await check('late vault completion leaves no live connection',o=>o.status===504&&o.live===null,async()=>{const f=await connectFixture({vaultDelay:true});const answer=await fetch(f.origin,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(f.body)});f.vaultGate.resolve();await delay(15);const out={status:answer.status,live:f.live(),events:f.events};await f.close();return out})
await check('late append is withdrawn',o=>o.status===504&&o.live===null&&o.events.includes('product.disconnected@1'),async()=>{const f=await connectFixture({appendDelay:true});const answer=await fetch(f.origin,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(f.body)});f.appendGate.resolve();await delay(15);const out={status:answer.status,live:f.live(),events:f.events};await f.close();return out})
await check('second consent during callback refused busy',o=>o.code==='busy',async()=>{const f=await connectFixture({vaultDelay:true});const answer=fetch(f.origin,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(f.body)});await f.entered.promise;const second=await f.connector.begin(FABRIC_INBOX);f.vaultGate.resolve();await answer;await f.close();return {code:second.problem?.code}})

await check('forward deadline before initialization says unreached',o=>!o.ok&&o.reached===false&&o.wallMs<300,async()=>{const server=http.createServer((req,res)=>{req.resume()});await new Promise(r=>server.listen(0,'127.0.0.1',r));const result=await forwardToProduct({mcpUrl:`http://127.0.0.1:${server.address().port}`,clientId:'synthetic',clientSecret:'synthetic',narrowing:['cloudflare:news@example.com'],narrowingSince:{server:'fabric-inbox',version:'0.9.0'},capability:'read_message',input:{},traceparent:'00-11111111111111111111111111111111-1111111111111111-01',timeoutMs:30});server.closeAllConnections();await new Promise(r=>server.close(r));return result})

await check('actual deep product answer does not cause duplicate write',o=>o.toolCalls===1,async()=>{
  let toolCalls=0
  const server=http.createServer((req,res)=>{
    if(req.method==='GET'){res.writeHead(405).end();return}
    let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{
      const b=JSON.parse(raw);if(b.method==='notifications/initialized'){res.writeHead(202).end();return}
      res.writeHead(200,{'content-type':'application/json'})
      if(b.method==='initialize')res.end(JSON.stringify({jsonrpc:'2.0',id:b.id,result:{protocolVersion:b.params.protocolVersion,serverInfo:{name:'fabric-inbox',version:'0.9.0'},capabilities:{tools:{}}}}))
      else if(b.method==='tools/call'){toolCalls++;res.end('{"jsonrpc":"2.0","id":'+JSON.stringify(b.id)+',"result":{"content":[],"structuredContent":{"deep":'+'{"x":'.repeat(6500)+'0'+'}'.repeat(6500)+'}}}')}
      else res.end(JSON.stringify({jsonrpc:'2.0',id:b.id,result:{}}))
    })
  });await new Promise(r=>server.listen(0,'127.0.0.1',r))
  const call=caller(forwardToProduct,{store:{liveConnection:async()=>({...conn,mcp_url:`http://127.0.0.1:${server.address().port}`}),append:async()=>1}})
  const first=await call(binding,args('deep-real'),undefined);const second=await call(binding,args('deep-real'),undefined)
  server.closeAllConnections();await new Promise(r=>server.close(r));return {toolCalls,first:errorCode(first),second:errorCode(second),message:first.structuredContent?.error?.message}
})

await check('product tool error cannot disclose callee secret',o=>o.disclosed===false,async()=>{
  const secret='synthetic-secret',client='synthetic-client';let toolCalls=0
  const server=http.createServer((req,res)=>{if(req.method==='GET'){res.writeHead(405).end();return}let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{const b=JSON.parse(raw);if(b.method==='notifications/initialized'){res.writeHead(202).end();return}res.writeHead(200,{'content-type':'application/json'});if(b.method==='initialize')res.end(JSON.stringify({jsonrpc:'2.0',id:b.id,result:{protocolVersion:b.params.protocolVersion,serverInfo:{name:'fabric-inbox',version:'0.9.0'},capabilities:{tools:{}}}}));else {toolCalls++;res.end(JSON.stringify({jsonrpc:'2.0',id:b.id,result:{isError:true,content:[{type:'text',text:'upstream header debug '+req.headers['cf-access-client-secret']+' '+req.headers['cf-access-client-id']}]}}))}})})
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  const call=caller(forwardToProduct,{store:{liveConnection:async()=>({...conn,mcp_url:`http://127.0.0.1:${server.address().port}`}),append:async()=>1}})
  const answer=await call(binding,args('echo-error'),undefined);const serialized=JSON.stringify(answer);const out={toolCalls,disclosed:serialized.includes(secret),clientIdDisclosed:serialized.includes(client),outcome:answer.structuredContent?.outcome};server.closeAllConnections();await new Promise(r=>server.close(r));return out
})
await check('changed connection predecessor refuses callback without replacing',o=>o.status===409&&o.sameLive,async()=>{
  const entered=deferred(),gate=deferred();let live=structuredClone(conn),link='',writes=0
  const server=http.createServer((req,res)=>connector.callback('fabric-inbox',req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`
  const connector=new ProductConnector({estateId:estate,store:{liveConnection:async()=>live,append:async()=>{writes++}},vault:{put:async()=>{entered.resolve();await gate.promise;return {ok:true}}},origin:()=>origin,openExternal:async u=>{link=u},actor:()=>({kind:'person',id:'synthetic'})})
  await connector.begin(FABRIC_INBOX,{reconnect:true});const state=new URL(link).searchParams.get('state');const body={state,outcome:'connected',server:'https://example.invalid',mcpUrl:'https://example.invalid/mcp',key:{id:'synthetic',clientId:'synthetic',level:'admin',send:'drafts'},clientSecret:'synthetic-secret'};const answer=fetch(origin,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});await entered.promise;live={...conn,id:'55555555-5555-4555-8555-555555555555'};gate.resolve();const res=await answer;const out={status:res.status,sameLive:live.id==='55555555-5555-4555-8555-555555555555',writes};server.closeAllConnections();await new Promise(r=>server.close(r));return out
})
await check('release pin accepts metadata-only and refuses runtime change',o=>o.metadata===null&&/unverified changes/.test(o.runtime),async()=>{
  const gateText=JSON.stringify({version:'0.3.1',verifiedCommit:'1'.repeat(40),ledger:'docs/evidence/test.md'});const git=paths=>a=>a[0]==='diff'?paths.join('\n'):''
  return {metadata:verifiedCandidateProblem({version:'0.3.1',gateText},git(['CHANGELOG.md'])),runtime:verifiedCandidateProblem({version:'0.3.1',gateText},git(['apps/desktop/src/main/hubCall.ts']))}
})

console.log(JSON.stringify({summary:{total:results.length,failed:results.filter(r=>!r.pass).length,passed:results.filter(r=>r.pass).length}}))
process.exitCode=results.some(r=>!r.pass)?1:0
