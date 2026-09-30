import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomBytes } from 'node:crypto'
import { request } from 'node:http'
import { connect as tcpConnect } from 'node:net'
import { createNativeProbeGateway,WebSocket } from './helpers/codex-tui-native-probe-gateway.mjs'
const require=createRequire(new URL('./fixtures/codex-tui-probe/package.json',import.meta.url))
const {WebSocketServer}=require('ws')
const delay=ms=>new Promise(r=>setTimeout(r,ms)),token=()=>randomBytes(32).toString('hex')
const init={id:'initialize',method:'initialize',params:{clientInfo:{name:'codex-tui',version:'0.157.1'},capabilities:{experimentalApi:true}}}
let passed=0
async function run(name,test){await test();passed++;console.log('PASS '+name)}
async function fixture(fn,timeoutMs=1000){
 const front=token(),back=token(),seen=[],peers=[]
 const server=new WebSocketServer({host:'127.0.0.1',port:0,maxPayload:65_536,perMessageDeflate:false})
 await new Promise(r=>server.once('listening',r))
 server.on('connection',(ws,req)=>{assert.equal(req.headers.authorization,'Bearer '+back);peers.push(ws)
  ws.on('error',()=>{});ws.on('message',data=>{const v=JSON.parse(data);seen.push(v)
   if(v.method==='initialize')ws.send(JSON.stringify({id:v.id,result:{codexHome:'/tmp/fixture-profile',platformFamily:'unix',platformOs:'macos',userAgent:'codex/0.157.1'}}))})})
 const gate=await createNativeProbeGateway({upstreamPort:server.address().port,upstreamToken:back,frontendToken:front,profile:'/tmp/fixture-profile',cwd:'/tmp/fixture-cwd',timeoutMs})
 const clients=[]
 const connect=async(auth=front)=>{
  const ws=new WebSocket(`ws://127.0.0.1:${gate.port}/`,{headers:{Authorization:'Bearer '+auth}});clients.push(ws);ws.on('error',()=>{})
  const closed=new Promise(r=>ws.once('close',r));const replies=[];ws.on('message',data=>replies.push(JSON.parse(data)))
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject)})
  return {ws,replies,closed}
 }
 const wait=async pred=>{for(let i=0;i<100;i++){if(pred())return;await delay(5)}throw new Error('fixture_wait_timeout')}
 try{await fn({gate,seen,connect,peers,wait,front,back})}finally{gate.close();for(const ws of [...clients,...peers])ws.terminate();assert.deepEqual(await gate.finished,{status:'closed'});await new Promise(r=>server.close(r))}
}
await run('actual authenticated transport reassembles fragmented initialize exactly once',()=>fixture(async({seen,connect,wait})=>{
 const {ws,replies}=await connect();const wire=JSON.stringify(init)
 ws.send(wire.slice(0,20),{fin:false});ws.send(wire.slice(20),{fin:true})
 await wait(()=>replies.length===1);assert.equal(seen.length,1);assert.deepEqual(seen[0],init)
}))
await run('missing/wrong frontend token returns 401 and opens no upstream connection',()=>fixture(async({gate,seen,peers})=>{
 for(const auth of [null,token()]){
  const status=await new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port:gate.port,headers:{Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':randomBytes(16).toString('base64'),...(auth?{Authorization:'Bearer '+auth}:{})}},res=>{res.resume();resolve(res.statusCode)})
   req.on('error',reject);req.end()});assert.equal(status,401)
 }assert.equal(seen.length,0);assert.equal(peers.length,0)
}))
await run('all mutating/unreviewed methods have zero upstream writes before initialize',async()=>{
 for(const method of ['turn/start','turn/steer','thread/resume','thread/fork','command/exec','account/login/start','config/value/write','unexpected/private-value'])await fixture(async({gate,seen,connect,wait})=>{
  const {ws}=await connect();ws.send(JSON.stringify({id:1,method,params:{secret:'never-forward'}}));await wait(()=>gate.snapshot().reason);assert.equal(seen.length,0);assert(!JSON.stringify(gate.snapshot()).includes('private-value'));assert(!JSON.stringify(gate.snapshot()).includes('secret'))
 })
})
await run('forbidden request after initialization remains blocked at actual upstream write',()=>fixture(async({gate,seen,connect,wait})=>{
 const {ws,replies}=await connect();ws.send(JSON.stringify(init));await wait(()=>replies.length===1)
 ws.send(JSON.stringify({method:'initialized'}));await wait(()=>seen.length===2)
 ws.send(JSON.stringify({id:1,method:'turn/start',params:{}}));await wait(()=>gate.snapshot().reason);assert.equal(seen.length,2)
}))
await run('binary, malformed JSON, duplicate fields, invalid UTF8 and oversize frames fail closed',async()=>{
 for(const [wire,options] of [['{',{}],['{"id":"initialize","id":"initialize","method":"initialize","params":{}}',{}],['[]',{}],[Buffer.from([0xc0,0xaf]),{binary:false}],['x'.repeat(65_537),{}],[JSON.stringify(init),{binary:true}]])await fixture(async({gate,seen,connect,wait})=>{
  const {ws}=await connect();ws.send(wire,options);await wait(()=>gate.snapshot().reason);assert.equal(seen.length,0)
 })
})
await run('privilege-bearing initialize and malformed JSON-RPC version fail before upstream',async()=>{
 for(const v of [{...init,jsonrpc:false},{...init,params:{...init.params,capabilities:{experimentalApi:true,explicitGatewayOauth:true}}}])await fixture(async({gate,seen,connect,wait})=>{
  const {ws}=await connect();ws.send(JSON.stringify(v));await wait(()=>gate.snapshot().reason);assert.equal(seen.length,0)
 })
})
await run('provider server request is never approved or forwarded',()=>fixture(async({gate,seen,connect,peers,wait})=>{
 const {ws,replies}=await connect();ws.send(JSON.stringify(init));await wait(()=>replies.length===1)
 peers[0].send(JSON.stringify({id:'approval',method:'item/commandExecution/requestApproval',params:{command:'do-not-retain'}}))
 await wait(()=>gate.snapshot().reason);assert.equal(seen.length,1);assert.equal(replies.length,1);assert(!JSON.stringify(gate.snapshot()).includes('do-not-retain'))
}))
await run('deadline is sticky and sockets close rather than reconnect',()=>fixture(async({gate,seen,connect,wait})=>{
 const {ws,closed}=await connect();await wait(()=>gate.snapshot().reason);await closed;assert.deepEqual(await gate.finished,{status:'closed'});assert.equal(gate.snapshot().reason,'deadline');assert.equal(seen.length,0);assert.equal(ws.readyState,WebSocket.CLOSED)
},50))
await run('only one frontend connection can claim the immutable upstream epoch',()=>fixture(async({connect,peers,wait})=>{
 await connect();await wait(()=>peers.length===1);await assert.rejects(connect());assert.equal(peers.length,1)
}))
await run('account refresh cannot mutate even after init',()=>fixture(async({gate,seen,connect,wait})=>{
 const {ws,replies}=await connect();ws.send(JSON.stringify(init));await wait(()=>replies.length===1);ws.send(JSON.stringify({method:'initialized'}));await wait(()=>seen.length===2)
 ws.send(JSON.stringify({id:1,method:'account/read',params:{refreshToken:true}}));await wait(()=>gate.snapshot().reason);assert.equal(seen.length,2)
}))
await run('raw slow HTTP connection cap closes owned sockets before finished resolves',()=>fixture(async({gate,seen})=>{
 const sockets=[]
 try {
  for(let i=0;i<5;i++){
   const socket=tcpConnect({host:'127.0.0.1',port:gate.port});sockets.push(socket);socket.on('error',()=>{})
   await new Promise(r=>{socket.once('connect',r);socket.once('error',r)})
  }
  assert.deepEqual(await gate.finished,{status:'closed'});assert.equal(gate.snapshot().reason,'connection_bound');assert.equal(seen.length,0)
 }finally{for(const s of sockets)s.destroy()}
}))
await run('exact fresh read-only thread metadata allowed once; unsafe overrides never forwarded',async()=>{
 const p={model:'gpt-5.4',approvalPolicy:'never',sandbox:'read-only',ephemeral:false,historyMode:'paginated',threadSource:'user'}
 for(const change of [null,{sandbox:'danger-full-access'},{config:{features:{anything:true}}},{cwd:'/foreign'},{dynamicTools:'invalid'},{baseInstructions:'input text'}])await fixture(async({gate,seen,connect,wait})=>{
  const {ws,replies}=await connect();ws.send(JSON.stringify(init));await wait(()=>replies.length===1);ws.send(JSON.stringify({method:'initialized'}));await wait(()=>seen.length===2)
  ws.send(JSON.stringify({id:'startup-thread-start-1',method:'thread/start',params:{...p,...change}}))
  if(change){await wait(()=>gate.snapshot().reason);assert.equal(seen.length,2)}
  else{await wait(()=>seen.length===3);ws.send(JSON.stringify({id:'startup-thread-start-2',method:'thread/start',params:p}));await wait(()=>gate.snapshot().reason);assert.equal(seen.length,3)}
 })
})
await run('disabled remote status is display metadata only, with exact schema and bounded identity',async()=>{
 const event={method:'remoteControl/status/changed',emittedAtMs:1750000000000,params:{status:'disabled',environmentId:null,installationId:'owned-fixture-id',serverName:'owned-probe'}}
 for(const change of [null,{params:{...event.params,status:'connected'}},{params:{...event.params,status:'connecting'}},{params:{...event.params,environmentId:'foreign'}},{params:{...event.params,extra:true}},{params:{...event.params,installationId:'x'.repeat(129)}},{params:{...event.params,serverName:'x'.repeat(129)}},{jsonrpc:false},{id:1},{emittedAtMs:null},{emittedAtMs:'123'},{emittedAtMs:-1},{emittedAtMs:1.5},{emittedAtMs:Number.MAX_SAFE_INTEGER+1}])await fixture(async({gate,seen,connect,peers,wait})=>{
  const {ws,replies}=await connect();ws.send(JSON.stringify(init));await wait(()=>replies.length===1)
  peers[0].send(JSON.stringify({...event,...change}))
  if(change){await wait(()=>gate.snapshot().reason);assert.equal(replies.length,1)}
  else{await wait(()=>replies.length===2);assert.deepEqual(replies[1],event);assert.equal(gate.snapshot().reason,null)}
  assert.equal(seen.length,1);assert(!JSON.stringify(gate.snapshot()).includes('owned-fixture-id'));assert(!JSON.stringify(gate.snapshot()).includes('owned-probe'))
 })
})
await run('account/read absent refresh flag is pinned false; only empty or literal false is admitted',async()=>{
 for(const params of [{},{refreshToken:false},{refreshToken:true},{refreshToken:null},{refreshToken:0},{refreshToken:false,extra:true},null])await fixture(async({gate,seen,connect,wait})=>{
  const {ws,replies}=await connect();ws.send(JSON.stringify(init));await wait(()=>replies.length===1);ws.send(JSON.stringify({method:'initialized'}));await wait(()=>seen.length===2)
  ws.send(JSON.stringify({id:1,method:'account/read',params}))
  if(params&&(!Object.keys(params).length||Object.keys(params).length===1&&params.refreshToken===false)){await wait(()=>seen.length===3);assert.equal(gate.snapshot().reason,null)}
  else{await wait(()=>gate.snapshot().reason);assert.equal(seen.length,2)}
 })
})
await run('config/read is exactly one owned-directory no-layers read; foreign scope and write remain denied',async()=>{
 for(const params of [{cwd:'.'},{cwd:'/tmp/fixture-cwd',includeLayers:false},{cwd:'/foreign'},{cwd:'.',includeLayers:true},{cwd:'.',includeLayers:null},{cwd:'.',extra:true},{}])await fixture(async({gate,seen,connect,wait})=>{
  const {ws,replies}=await connect();ws.send(JSON.stringify(init));await wait(()=>replies.length===1);ws.send(JSON.stringify({method:'initialized'}));await wait(()=>seen.length===2)
  ws.send(JSON.stringify({id:1,method:'config/read',params}))
  if(params.cwd==='.'&&Object.keys(params).length===1||params.cwd==='/tmp/fixture-cwd'&&params.includeLayers===false){
   await wait(()=>seen.length===3);ws.send(JSON.stringify({id:2,method:'config/read',params}));await wait(()=>gate.snapshot().reason);assert.equal(seen.length,3)
  }else{await wait(()=>gate.snapshot().reason);assert.equal(seen.length,2)}
 })
})
const ownedId='019a0000-0000-7000-8000-000000000001'
const threadResult={approvalPolicy:'never',approvalsReviewer:'user',cwd:'/tmp/fixture-cwd',model:'gpt-5.4',modelProvider:'probe-local',sandbox:{type:'readOnly',networkAccess:false},
 thread:{cliVersion:'0.157.1',createdAt:1,updatedAt:1,cwd:'/tmp/fixture-cwd',ephemeral:false,id:ownedId,modelProvider:'probe-local',preview:'',projectId:null,sessionId:ownedId,source:'vscode',status:{type:'idle'},turns:[]}}
async function readyThread({gate,seen,connect,peers,wait}){
 assert.equal(gate.armExit(ownedId),false)
 const {ws,replies}=await connect();ws.send(JSON.stringify(init));await wait(()=>replies.length===1);ws.send(JSON.stringify({method:'initialized'}));await wait(()=>seen.length===2)
 ws.send(JSON.stringify({id:'start',method:'thread/start',params:{model:'gpt-5.4',approvalPolicy:'never',sandbox:'read-only',ephemeral:false,historyMode:'paginated',threadSource:'user'}}));await wait(()=>seen.length===3)
 peers[0].send(JSON.stringify({id:'start',result:threadResult}));await wait(()=>gate.snapshot().threadStartReply);return {ws,replies}
}
await run('unsubscribe requires host arm after owned thread reply and exact returned ID',async()=>{
 for(const mode of ['before_arm','wrong_id','extra','valid'])await fixture(async ctx=>{
  const {gate,seen,peers,wait}=ctx,{ws,replies}=await readyThread(ctx)
  if(mode!=='before_arm'){assert.equal(gate.armExit('foreign'),false);assert.equal(gate.armExit(ownedId),true);assert.equal(gate.armExit(ownedId),false)}
  const params={threadId:mode==='wrong_id'?'019a0000-0000-7000-8000-000000000002':ownedId,...mode==='extra'?{extra:true}:{}}
  ws.send(JSON.stringify({id:'exit',method:'thread/unsubscribe',params}))
  if(mode!=='valid'){await wait(()=>gate.snapshot().reason);assert.equal(seen.length,3)}
  else{await wait(()=>seen.length===4);peers[0].send(JSON.stringify({id:'exit',result:{status:'unsubscribed'}}));await wait(()=>replies.length===3);assert.equal(gate.snapshot().unsubscribeReply,true)
   ws.send(JSON.stringify({id:'repeat-exit',method:'thread/unsubscribe',params}));await wait(()=>gate.snapshot().reason);assert.equal(seen.length,4)}
 })
})
await run('malformed unsubscribe result cannot become detach receipt',async()=>{
 for(const result of [{status:'stopped'},{status:['unsubscribed']},{status:'unsubscribed',extra:true},{}])await fixture(async ctx=>{
  const {gate,seen,peers,wait}=ctx,{ws}=await readyThread(ctx);assert(gate.armExit(ownedId));ws.send(JSON.stringify({id:'exit',method:'thread/unsubscribe',params:{threadId:ownedId}}));await wait(()=>seen.length===4)
  peers[0].send(JSON.stringify({id:'exit',result}));await wait(()=>gate.snapshot().reason);assert.equal(gate.snapshot().unsubscribeReply,false)
 })
})

await run('dynamic tools receive one local unsupported reply; only exact fresh-ID tool-free retry reaches backend',async()=>{
 const original='startup-thread-start-019a0000-0000-7000-8000-000000000010',retry='legacy-thread-start-019a0000-0000-7000-8000-000000000011'
 const p={model:'gpt-5.4',approvalPolicy:'never',sandbox:'read-only',ephemeral:false,historyMode:'paginated',threadSource:'user',dynamicTools:[]}
 for(const mode of ['success','original-id','tools-again','changed-model','wrong-id','wrong-original','unrelated-mismatch'])await fixture(async({gate,seen,connect,wait})=>{
  const {ws,replies}=await connect();ws.send(JSON.stringify(init));await wait(()=>replies.length===1);ws.send(JSON.stringify({method:'initialized'}));await wait(()=>seen.length===2)
  ws.send(JSON.stringify({id:mode==='wrong-original'?'foreign':original,method:'thread/start',params:{...p,...(mode==='unrelated-mismatch'?{sandbox:'danger-full-access'}:{})}}))
  if(['wrong-original','unrelated-mismatch'].includes(mode)){await wait(()=>gate.snapshot().reason);assert.equal(gate.snapshot().dynamicToolsRejected,false);assert.equal(seen.length,2);return}
  await wait(()=>replies.length===2);assert.deepEqual(replies[1],{id:original,error:{code:-32602,message:'dynamicTools unsupported by this probe'}});assert.equal(seen.length,2);assert.equal(gate.snapshot().threadStartRequests,0)
  ws.send(JSON.stringify({id:mode==='original-id'?original:mode==='wrong-id'?'foreign':retry,method:'thread/start',params:{...p,dynamicTools:mode==='tools-again'?[]:null,...(mode==='changed-model'?{model:'other'}:{})}}))
  if(mode==='success'){await wait(()=>seen.length===3);assert.equal(seen[2].params.dynamicTools,null);assert.equal(gate.snapshot().threadStartRequests,1)
   ws.send(JSON.stringify({id:'legacy-thread-start-019a0000-0000-7000-8000-000000000012',method:'thread/start',params:{...p,dynamicTools:null}}));await wait(()=>gate.snapshot().reason);assert.equal(seen.length,3)
  }else{await wait(()=>gate.snapshot().reason);assert.equal(seen.length,2)}
 })
})

await run('one loaded-thread read is bounded to exact known owned identity without pagination',async()=>{
 for(const mode of ['empty','owned','foreign','extra','two','cursor','param-cursor','param-limit','param-extra','repeat'])await fixture(async f=>{
  const {ws,replies}=await readyThread(f);const before=f.seen.length
  const params=mode==='param-cursor'?{cursor:'next'}:mode==='param-limit'?{limit:1}:mode==='param-extra'?{extra:true}:{cursor:null,limit:null}
  ws.send(JSON.stringify({id:'loaded',method:'thread/loaded/list',params}))
  if(mode.startsWith('param-')){await f.wait(()=>f.gate.snapshot().reason);assert.equal(f.seen.length,before);return}
  await f.wait(()=>f.seen.length===before+1)
  if(mode==='repeat'){ws.send(JSON.stringify({id:'loaded2',method:'thread/loaded/list',params:{}}));await f.wait(()=>f.gate.snapshot().reason);assert.equal(f.seen.length,before+1);return}
  const result={data:mode==='empty'?[]:mode==='two'?[ownedId,ownedId]:[mode==='foreign'?'019a0000-0000-7000-8000-000000000099':ownedId],nextCursor:mode==='cursor'?'next':null,...(mode==='extra'?{extra:true}:{})}
  const count=replies.length;f.peers[0].send(JSON.stringify({id:'loaded',result}))
  if(['empty','owned'].includes(mode)){await f.wait(()=>replies.length>count);assert.deepEqual(replies.at(-1).result,result)}else{await f.wait(()=>f.gate.snapshot().reason);assert.equal(replies.length,count)}
 })
})

await run('overview fixed variants each once; foreign nested IDs, extra turns and pagination fail closed',async()=>{
 const listParams={limit:10,sortKey:'recency_at',modelProviders:[],sourceKinds:[],archived:false,useStateDbOnly:true}
 for(const mode of ['variants','duplicate-list','bad-limit','bad-sort','bad-filter','foreign-thread','foreign-session','parent','turns','cursor','backwards','duplicate-read','bad-read','duplicate-turns','nonempty-turns','turn-cursor'])await fixture(async f=>{
  const {ws,replies}=await readyThread(f);const before=f.seen.length;const isRead=['foreign-thread','foreign-session','parent','turns','duplicate-read','bad-read'].includes(mode),isTurns=['duplicate-turns','nonempty-turns','turn-cursor'].includes(mode)
  const method=isRead?'thread/read':isTurns?'thread/turns/list':'thread/list'
  const params=isRead?{threadId:ownedId,includeTurns:mode==='bad-read'}:isTurns?{threadId:ownedId,limit:1}:{...listParams,...(mode==='bad-limit'?{limit:20}:mode==='bad-sort'?{sortKey:'updated_at'}:mode==='bad-filter'?{cwd:'/foreign'}:{})}
  ws.send(JSON.stringify({id:'overview1',method,params}))
  if(mode.startsWith('bad-')){await f.wait(()=>f.gate.snapshot().reason);assert.equal(f.seen.length,before);return}
  await f.wait(()=>f.seen.length===before+1)
  if(mode.startsWith('duplicate-')){ws.send(JSON.stringify({id:'overview2',method,params}));await f.wait(()=>f.gate.snapshot().reason);assert.equal(f.seen.length,before+1);return}
  if(mode==='variants'){
   ws.send(JSON.stringify({id:'overview2',method,params:{...params,sourceKinds:['exec','appServer']}}));await f.wait(()=>f.seen.length===before+2)
   f.peers[0].send(JSON.stringify({id:'overview1',result:{data:[],nextCursor:null,backwardsCursor:null}}));f.peers[0].send(JSON.stringify({id:'overview2',result:{data:[threadResult.thread],nextCursor:null}}));await f.wait(()=>replies.some(x=>x.id==='overview2'));assert.equal(f.gate.snapshot().reason,null);return
  }
  const thread={...threadResult.thread,...(mode==='foreign-thread'?{id:'019a0000-0000-7000-8000-000000000099'}:mode==='foreign-session'?{sessionId:'019a0000-0000-7000-8000-000000000099'}:mode==='parent'?{parentThreadId:ownedId}:mode==='turns'?{turns:[{}]}:{})}
  const result=isRead?{thread}:isTurns?{data:mode==='nonempty-turns'?[{}]:[],nextCursor:mode==='turn-cursor'?'next':null}:{data:[],nextCursor:mode==='backwards'?null:'next',backwardsCursor:mode==='backwards'?'previous':null}
  const count=replies.length;f.peers[0].send(JSON.stringify({id:'overview1',result}));await f.wait(()=>f.gate.snapshot().reason);assert.equal(replies.length,count)
 })
})

await run('owned metadata/empty turn reads return exact receipts; unknown identity is never forwarded',async()=>{
 await fixture(async f=>{
  const {ws,replies}=await readyThread(f);const before=f.seen.length
  ws.send(JSON.stringify({id:'read',method:'thread/read',params:{threadId:ownedId,includeTurns:false}}));await f.wait(()=>f.seen.length===before+1)
  f.peers[0].send(JSON.stringify({id:'read',result:{thread:threadResult.thread}}));await f.wait(()=>replies.some(x=>x.id==='read'));assert.equal(f.gate.snapshot().reason,null)
  ws.send(JSON.stringify({id:'turns',method:'thread/turns/list',params:{threadId:ownedId,limit:1,cursor:null,sortDirection:null,itemsView:null}}));await f.wait(()=>f.seen.length===before+2)
  f.peers[0].send(JSON.stringify({id:'turns',result:{data:[],nextCursor:null,backwardsCursor:null}}));await f.wait(()=>replies.some(x=>x.id==='turns'));assert.equal(f.gate.snapshot().reason,null)
 })
 await fixture(async f=>{
  const {ws,replies}=await f.connect();ws.send(JSON.stringify(init));await f.wait(()=>replies.length===1);ws.send(JSON.stringify({method:'initialized'}));await f.wait(()=>f.seen.length===2)
  ws.send(JSON.stringify({id:'unbound',method:'thread/read',params:{threadId:ownedId,includeTurns:false}}));await f.wait(()=>f.gate.snapshot().reason);assert.equal(f.seen.length,2)
 })
})

await run('optional plugin inventory is explicitly refused locally once without catalog access',async()=>{
 for(const mode of ['valid','absent','null','repeat','foreign','refresh','extra','marketplace'])await fixture(async f=>{
  const {ws,replies}=await f.connect();ws.send(JSON.stringify(init));await f.wait(()=>replies.length===1);ws.send(JSON.stringify({method:'initialized'}));await f.wait(()=>f.seen.length===2)
  const params={cwds:[mode==='foreign'?'/foreign':'/tmp/fixture-cwd'],marketplaceKinds:mode==='marketplace'?[]:null,...(mode==='absent'?{}:{forceRefetch:mode==='null'?null:mode==='refresh'}),...(mode==='extra'?{extra:true}:{})}
  ws.send(JSON.stringify({id:'plugins',method:'plugin/list',params}))
  if(['valid','absent','repeat'].includes(mode)){await f.wait(()=>replies.length===2);assert.deepEqual(replies[1],{id:'plugins',error:{code:-32601,message:'plugin inventory unavailable in this probe'}})
   if(mode==='repeat'){ws.send(JSON.stringify({id:'plugins2',method:'plugin/list',params}));await f.wait(()=>f.gate.snapshot().reason);assert.equal(replies.length,2)}
  }else{await f.wait(()=>f.gate.snapshot().reason);assert.equal(replies.length,1)}
  assert.equal(f.seen.length,2)
 })
})

await run('plugin refusal allows only one fresh ID per actual before/after thread-reply phase',async()=>{
 for(const reused of [false,true])await fixture(async f=>{
  const {ws,replies}=await f.connect();ws.send(JSON.stringify(init));await f.wait(()=>replies.length===1);ws.send(JSON.stringify({method:'initialized'}));await f.wait(()=>f.seen.length===2)
  const params={cwds:['/tmp/fixture-cwd'],forceRefetch:false}
  ws.send(JSON.stringify({id:'plugin-before',method:'plugin/list',params}));await f.wait(()=>replies.length===2);assert.equal(f.seen.length,2)
  ws.send(JSON.stringify({id:'fresh',method:'thread/start',params:{model:'gpt-5.4',approvalPolicy:'never',sandbox:'read-only',ephemeral:false,historyMode:'paginated',threadSource:'user'}}));await f.wait(()=>f.seen.length===3)
  f.peers[0].send(JSON.stringify({id:'fresh',result:threadResult}));await f.wait(()=>f.gate.snapshot().threadStartReply)
  ws.send(JSON.stringify({id:reused?'plugin-before':'plugin-after',method:'plugin/list',params}))
  if(reused){await f.wait(()=>f.gate.snapshot().reason);assert.equal(f.gate.snapshot().methodCounts.pluginInventoryRefused,1)}else{
   await f.wait(()=>replies.some(v=>v.id==='plugin-after'));assert.equal(f.gate.snapshot().methodCounts.pluginInventoryRefused,2)
   ws.send(JSON.stringify({id:'plugin-third',method:'plugin/list',params}));await f.wait(()=>f.gate.snapshot().reason)
  }assert.equal(f.seen.length,3)
 })
})

await run('effective fixture configuration must prove plugins disabled alongside authority settings',async()=>{
 for(const mode of ['disabled','missing','enabled','null'])await fixture(async f=>{
  const {ws,replies}=await f.connect();ws.send(JSON.stringify(init));await f.wait(()=>replies.length===1);ws.send(JSON.stringify({method:'initialized'}));await f.wait(()=>f.seen.length===2)
  ws.send(JSON.stringify({id:'config',method:'config/read',params:{cwd:'.'}}));await f.wait(()=>f.seen.length===3)
  const config={model_provider:'probe-local',sandbox_mode:'read-only',approval_policy:'never',web_search:'disabled',...(mode==='missing'?{}:{features:{plugins:mode==='disabled'?false:mode==='enabled'?true:null}})}
  f.peers[0].send(JSON.stringify({id:'config',result:{config,origins:{},layers:null}}))
  if(mode==='disabled'){await f.wait(()=>replies.length===2);assert.equal(f.gate.snapshot().reason,null)}else{await f.wait(()=>f.gate.snapshot().reason);assert.equal(replies.length,1)}
 })
})

await run('compound method and IDs cannot coerce or crash host; owned sockets close with denial',async()=>{
 const invalid=[{toString:null,valueOf:null},['initialize'],null,true,{},'x'.repeat(129)]
 for(const value of invalid)for(const field of ['method','id'])await fixture(async f=>{
  const {ws,closed}=await f.connect();ws.send(JSON.stringify({...init,[field]:value}));await f.wait(()=>f.gate.snapshot().reason);await closed;assert.deepEqual(await f.gate.finished,{status:'closed'});assert.equal(f.seen.length,0)
 })
 for(const value of invalid)for(const field of ['method','id'])await fixture(async f=>{
  const {ws,replies,closed}=await f.connect();ws.send(JSON.stringify(init));await f.wait(()=>replies.length===1)
  f.peers[0].send(JSON.stringify(field==='method'?{method:value,params:{}}:{id:value,result:{}}));await f.wait(()=>f.gate.snapshot().reason);await closed;assert.deepEqual(await f.gate.finished,{status:'closed'});assert.equal(f.seen.length,1);assert.equal(replies.length,1)
 })
})

await run('unsubscribe receipt preserves exact outcome rather than promoting notLoaded/notSubscribed',async()=>{
 for(const status of ['unsubscribed','notLoaded','notSubscribed'])await fixture(async f=>{
  const {ws,replies}=await readyThread(f);assert(f.gate.armExit(ownedId));const before=f.seen.length
  ws.send(JSON.stringify({id:'exit-status',method:'thread/unsubscribe',params:{threadId:ownedId}}));await f.wait(()=>f.seen.length===before+1)
  f.peers[0].send(JSON.stringify({id:'exit-status',result:{status}}));await f.wait(()=>replies.some(v=>v.id==='exit-status'))
  assert.equal(f.gate.snapshot().unsubscribeStatus,status);assert.equal(f.gate.snapshot().unsubscribeStatus==='unsubscribed',status==='unsubscribed')
 })
})
console.log(`PASS ${passed} real WebSocket fixture groups; native provider/TUI NOT_RUN`)
