// Pure controller + real Claude transport/normalizer with an owned Node peer.
// No Claude process, credentials, config, network, provider turn or model call.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createClaudeProviderControl, CLAUDE_STOP_LIMITS } from '../src/main/claudeProviderControl.ts'
import { createClaudeControlTransport } from '../src/main/claudeControlTransport.ts'
import { createClaudeProviderState, normalizeClaudeEvent } from '../src/main/claudeProviderEvents.ts'
import { assessProviderQuiescence } from '../src/shared/providerExecution.ts'

const binding = { schema:'ProviderExecution@1',fabric:{estateId:'estate',taskId:'task',runId:'run',sessionId:'fabric-session'},
  provider:{id:'claude-code',build:'2.1.283',runtimeProfile:'owned-stdio'},
  native:{status:'observed',connectionId:'connection',sessionId:'native-session',threadId:null,turnId:null},
  execution:{kind:'host-request',id:'request-epoch'},manifestDigest:'a'.repeat(64),policyDigest:'b'.repeat(64) }
const secret = 'SERVICE_TOKEN=synthetic-private-fixture'
const source = sequence => ({connectionId:'connection',requestEpoch:'request-epoch',sequence,eventId:`source-${sequence}`})
const start = id => ({type:'system',subtype:'task_started',session_id:'native-session',task_id:id,task_type:'local_agent',uuid:`start-${id}`,description:secret})
const patch = (id,status='killed') => ({type:'system',subtype:'task_updated',task_id:id,patch:{status,result:secret}})
function fixture(taskIds=['child']) {
  let state = createClaudeProviderState(binding).value
  function feed(raw) {
    const seq=state.sourceSequence+1
    const kind=raw.type==='result'?'root-result':raw.subtype==='task_started'?'task-start':null
    const receipt=kind?{binding,source:source(seq),kind,messageUuid:raw.uuid??null,taskId:kind==='task-start'?raw.task_id:null,evidenceRef:`sha256:${'c'.repeat(64)}`}:undefined
    const result=normalizeClaudeEvent(state,source(seq),raw,receipt)
    assert.equal(result.accepted,true,result.reasonCode);state=result.state
  }
  feed({type:'system',subtype:'init',session_id:'native-session',cwd:'/synthetic/private'})
  for(const id of taskIds)feed(start(id))
  return {get state(){return state},set state(value){state=value},feed}
}
const command = cursor => ({commandId:'canonical-stop',issuedCursor:cursor,reason:'operator_stop'})
const ack = n => ({status:'ack',requestId:`owned:${n}`})
function harness(options={}) {
  const f=options.fixture??fixture(),calls=[]
  let authority=true
  const ports={binding,ownership:f.state,currentState:()=>f.state,timeoutMs:200,...options,
    transport:options.transport??{requestControl:async(request,fence)=>{if(!fence())return {status:'not_sent',reason:'effect_fenced'};calls.push(request);return ack(calls.length)}}}
  delete ports.fixture
  const parsed=createClaudeProviderControl(ports);assert.equal(parsed.ok,true,parsed.reasonCode)
  return {f,calls,ports,control:parsed.value,cmd:command(f.state.observation.cursor),allowed:()=>authority,revoke:()=>{authority=false}}
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
let passed=0
async function test(name,fn){await fn();passed++;console.log('ok   '+name)}

await test('interrupt then only owned active tasks; ACK never changes observation or proves quiescence',async()=>{
  const f=fixture(['child','done']);f.feed(patch('done'))
  const before=f.state,h=harness({fixture:f}),r=await h.control.requestStop(h.cmd,h.allowed)
  assert.equal(r.status,'request_ack');assert.equal(r.interruptAcknowledged,true)
  assert.deepEqual(h.calls,[{subtype:'interrupt'},{subtype:'stop_task',task_id:'child'}])
  assert.deepEqual(r.taskRequests,[{taskId:'child',acknowledged:true}]);assert.equal(r.inventoryComplete,false);assert.equal(r.unknownWriters,true)
  assert.equal(f.state,before);assert.equal(assessProviderQuiescence(f.state.observation,f.state.observation.cursor).quiescent,false)
  assert.ok(!JSON.stringify(r).includes(secret));assert.ok(Object.isFrozen(r.taskRequests))
})
await test('observed initialization, exact profile, request epoch and bounded owned roster are required',async()=>{
  const f=fixture(),base={binding,ownership:f.state,currentState:()=>f.state,transport:{requestControl:async()=>ack(1)}}
  for(const mutate of [b=>{b.provider.build='other'},b=>{b.provider.id='codex-cli'},b=>{b.provider.runtimeProfile='owned-pty'},
    b=>{b.native={status:'unknown',reason:'not_observed'}},b=>{b.execution.id='other'},b=>{b.native.connectionId='other'}]){
    const b=structuredClone(binding);mutate(b);assert.equal(createClaudeProviderControl({...base,binding:b}).ok,false)
  }
  for(const change of [{initialized:false},{fault:'gap'},{tasks:[...f.state.tasks,...f.state.tasks]},
    {tasks:Array(CLAUDE_STOP_LIMITS.tasks+1).fill(f.state.tasks[0])}])assert.equal(createClaudeProviderControl({...base,ownership:{...f.state,...change}}).ok,false)
  for(const timeoutMs of [0,Infinity,NaN,60001])assert.equal(createClaudeProviderControl({...base,timeoutMs}).ok,false)
})
await test('malformed/accessor commands refuse without reads, effects or private exception prose',async()=>{
  const h=harness();let getterCalls=0
  const input={...h.cmd};Object.defineProperty(input,'reason',{get(){getterCalls++;throw new Error(secret)},enumerable:true})
  assert.equal((await h.control.requestStop(input,h.allowed)).status,'refused');assert.equal(getterCalls,0)
  assert.equal((await h.control.requestStop({...h.cmd,issuedCursor:-1},h.allowed)).status,'refused')
  assert.equal((await h.control.requestStop({...h.cmd,extra:secret},h.allowed)).status,'refused');assert.equal(h.calls.length,0)
})
await test('async, throwing and revoked authority cannot send',async()=>{
  for(const authority of [()=>false,()=>{throw new Error(secret)},async()=>true,()=>Promise.reject(new Error('synthetic'))]){
    const h=harness();const r=await h.control.requestStop(h.cmd,authority)
    assert.equal(r.status,'refused');assert.equal(h.calls.length,0);assert.ok(!JSON.stringify(r).includes(secret))
  }
})
await test('future cursor and async current state cannot grant authority',async()=>{
  const h=harness();assert.equal((await h.control.requestStop({...h.cmd,issuedCursor:999},h.allowed)).status,'refused')
  for(const currentState of [async()=>fixture().state,()=>Promise.reject(new Error('synthetic'))]){
    const other=harness({currentState});assert.equal((await other.control.requestStop(other.cmd,other.allowed)).status,'refused');assert.equal(other.calls.length,0)
  }
})
await test('connection, host epoch, digest or stream fault changed after interrupt prevents task writes',async()=>{
  for(const mutate of [s=>{s.observation.binding.native.connectionId='other'},s=>{s.observation.binding.execution.id='other'},
    s=>{s.observation.binding.manifestDigest='d'.repeat(64)},s=>{s.fault='source_gap'},s=>{s.observation.fault='cursor_gap'}]){
    const f=fixture(),calls=[],h=harness({fixture:f,transport:{requestControl:async request=>{calls.push(request);const state=structuredClone(f.state);mutate(state);f.state=state;return ack(1)}}})
    const r=await h.control.requestStop(h.cmd,h.allowed);assert.equal(r.status,'outcome_unknown');assert.equal(calls.length,1)
  }
})
await test('missing, rebound, reopened or regressing owned state fences cancellation permanently',async()=>{
  for(const mutate of [s=>{s.tasks=[]},s=>{s.tasks[0].messageUuid='other'},s=>{s.sourceSequence--},s=>{s.observation.cursor--}]){
    const f=fixture(),original=f.state,calls=[],h=harness({fixture:f,transport:{requestControl:async request=>{calls.push(request);const next=structuredClone(f.state);mutate(next);f.state=next;return ack(1)}}})
    assert.equal((await h.control.requestStop(h.cmd,h.allowed)).status,'outcome_unknown');f.state=original
    assert.equal((await h.control.requestStop(h.cmd,h.allowed)).status,'refused');assert.equal(calls.length,1)
  }
  const f=fixture();f.feed(patch('child'));const h=harness({fixture:f});const next=structuredClone(f.state);next.tasks[0].terminal=null;f.state=next
  assert.equal((await h.control.requestStop(h.cmd,h.allowed)).status,'refused');assert.equal(h.calls.length,0)
})
await test('task completes during interrupt: skip it; new owned task remains unaddressed',async()=>{
  for(const action of ['complete','new']){
    const f=fixture(),calls=[],h=harness({fixture:f,transport:{requestControl:async(request,fence)=>{
      assert.equal(fence(),true);calls.push(request);if(request.subtype==='interrupt'){if(action==='complete')f.feed(patch('child'));else f.feed(start('new-child'))}return ack(calls.length)
    }}})
    const r=await h.control.requestStop(h.cmd,h.allowed)
    assert.equal(r.status,action==='complete'?'request_ack':'outcome_unknown')
    assert.deepEqual(r.unaddressedTaskIds,action==='new'?['new-child']:[])
    assert.ok(!calls.some(c=>c.task_id==='new-child'));assert.equal(calls.length,action==='complete'?1:2)
  }
})
await test('canonical duplicates join and cache; changed command cannot resend even after unknown reply',async()=>{
  let resolve;const calls=[];const h=harness({transport:{requestControl:request=>{calls.push(request);return new Promise(r=>{resolve=r})}}})
  const first=h.control.requestStop(h.cmd,h.allowed),second=h.control.requestStop({...h.cmd},h.allowed)
  assert.equal(first,second);resolve({status:'outcome_unknown',reason:secret,requestId:'owned:1'})
  const result=await first;assert.equal(result.status,'outcome_unknown');assert.ok(!JSON.stringify(result).includes(secret))
  assert.equal(await h.control.requestStop(h.cmd,h.allowed),result)
  assert.equal((await h.control.requestStop({...h.cmd,reason:'app_shutdown'},h.allowed)).reasonCode,'canonical_command_conflict')
  assert.equal((await h.control.requestStop({...h.cmd,commandId:'different'},h.allowed)).reasonCode,'canonical_command_conflict');assert.equal(calls.length,1)
})
await test('reentrant transport shares installed pending command without duplicate writes',async()=>{
  let h,reentered;const calls=[]
  h=harness({transport:{requestControl:async request=>{calls.push(request);if(!reentered)reentered=h.control.requestStop(h.cmd,h.allowed);return {status:'error',code:'provider_control_error',requestId:'owned:1'}}}})
  const initial=h.control.requestStop(h.cmd,h.allowed);assert.equal(initial,reentered);assert.equal((await initial).reasonCode,'provider_error');assert.equal(calls.length,1)
})
await test('unsupported transport/error payloads stay fixed unknown; no provider prose leaks',async()=>{
  for(const reply of [null,{status:'ack',requestId:'owned:1',body:secret},{status:'ack'},
    {status:'error',requestId:'owned:1',code:secret},{status:'reply',result:secret},{status:'outcome_unknown',reason:secret}]){
    const h=harness({transport:{requestControl:async()=>reply}}),r=await h.control.requestStop(h.cmd,h.allowed)
    assert.equal(r.status,'outcome_unknown');assert.ok(!JSON.stringify(r).includes(secret))
  }
  const h=harness({transport:{requestControl:async()=>{throw new Error(secret)}}});assert.equal((await h.control.requestStop(h.cmd,h.allowed)).reasonCode,'transport_failure')
})
await test('total monotonic deadline fences slow synchronous authority and deferred writes',async()=>{
  const busy=ms=>{const until=performance.now()+ms;while(performance.now()<until){}}
  const h=harness({timeoutMs:10});assert.equal((await h.control.requestStop(h.cmd,()=>{busy(20);return true})).reasonCode,'deadline');assert.equal(h.calls.length,0)
  let writes=0,lateFence
  const delayed=harness({timeoutMs:15,transport:{requestControl:(_request,fence)=>{lateFence=fence;return new Promise(()=>{})}}})
  const result=await delayed.control.requestStop(delayed.cmd,delayed.allowed)
  assert.equal(result.status,'outcome_unknown');assert.equal(result.reasonCode,'deadline')
  if(lateFence())writes++;assert.equal(writes,0)
  assert.equal(await delayed.control.requestStop(delayed.cmd,delayed.allowed),result)
})
await test('deadline covers interrupt plus all tasks rather than resetting per request',async()=>{
  let calls=0
  const h=harness({timeoutMs:35,transport:{requestControl:async(_request,fence)=>{
    await sleep(22);if(!fence())return {status:'not_sent',reason:'effect_fenced'};calls++;return ack(calls)
  }}})
  const r=await h.control.requestStop(h.cmd,h.allowed);assert.equal(r.status,'outcome_unknown');assert.equal(calls,1)
  await sleep(25);assert.equal(calls,1)
})

async function withPeer(mode,run) {
  const script=`
    const readline=require('node:readline');
    const send=value=>process.stdout.write(JSON.stringify(value)+'\\n');
    let count=0;
    send({type:'system',subtype:'init',session_id:'native-session'});
    send(${JSON.stringify(start('child'))});
    readline.createInterface({input:process.stdin}).on('line',line=>{
      const msg=JSON.parse(line);count++;
      if(msg.type!=='control_request')throw new Error('unexpected host frame');
      if(${JSON.stringify(mode)}==='dropped')return;
      if(msg.request.subtype==='interrupt'){
        send({type:'result',subtype:'success',session_id:'native-session',uuid:'root-result',is_error:false,duration_ms:1,duration_api_ms:1,num_turns:1,terminal_reason:'aborted_tools',result:${JSON.stringify(secret)}});
        if(${JSON.stringify(mode)}==='new')send(${JSON.stringify(start('new-child'))});
      }else if(msg.request.subtype==='stop_task'){
        if(msg.request.task_id!=='child')throw new Error('foreign task cancellation');
        send(${JSON.stringify(patch('child'))});
      }else throw new Error('unexpected control subtype');
      send({type:'control_response',response:{subtype:'success',request_id:msg.request_id,response:{private:${JSON.stringify(secret)}}}});
    }).on('close',()=>process.exit(0));
  `
  const child=spawn(process.execPath,['-e',script],{env:{PATH:process.env.PATH},stdio:['pipe','pipe','pipe']})
  let exited=false,stderrBytes=0,transport
  const exit=new Promise(resolve=>child.once('exit',(code,signal)=>{exited=true;resolve({code,signal})}))
  child.stderr.on('data',bytes=>{stderrBytes+=bytes.length})
  child.on('error',()=>{})
  let state=createClaudeProviderState(binding).value,readyResolve
  const ready=new Promise(resolve=>{readyResolve=resolve})
  let revoked=false,events=0
  transport=createClaudeControlTransport({input:child.stdout,output:child.stdin,timeoutMs:150,onEvent:raw=>{
    const seq=++events,kind=raw.type==='result'?'root-result':raw.subtype==='task_started'?'task-start':null
    // Explicit ownership receipts from this deterministic peer fixture. This
    // does not manufacture a native-production origin attestation.
    const receipt=kind?{binding,source:source(seq),kind,messageUuid:raw.uuid??null,taskId:kind==='task-start'?raw.task_id:null,evidenceRef:`sha256:${'c'.repeat(64)}`}:undefined
    const normalized=normalizeClaudeEvent(state,source(seq),raw,receipt)
    assert.equal(normalized.accepted,true,normalized.reasonCode);state=normalized.state
    if(raw.type==='result'&&mode==='revoked')revoked=true
    if(events===2)readyResolve()
  }})
  let timer
  try {
    await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('peer readiness timeout')),3000)})]);clearTimeout(timer)
    await run({transport,get state(){return state},allowed:()=>!revoked})
    child.stdin.end()
    const ending=await Promise.race([exit,sleep(1000).then(()=>null)])
    assert.ok(ending);assert.equal(ending.code,0);assert.equal(stderrBytes,0)
  } finally {
    clearTimeout(timer);transport.close()
    if(!exited){child.kill('SIGTERM');await Promise.race([exit,sleep(500)])}
    if(!exited){child.kill('SIGKILL');await exit}
  }
}
for(const mode of ['success','dropped','revoked','new'])await test(`real owned pipes + transport + normalizer: ${mode}`,async()=>{
  await withPeer(mode,async peer=>{
    const control=createClaudeProviderControl({binding,ownership:peer.state,currentState:()=>peer.state,transport:peer.transport,timeoutMs:300}).value
    const cmd=command(peer.state.observation.cursor),r=await control.requestStop(cmd,peer.allowed)
    assert.equal(r.status,mode==='success'?'request_ack':'outcome_unknown')
    assert.equal(r.inventoryComplete,false);assert.equal(r.unknownWriters,true)
    assert.equal(assessProviderQuiescence(peer.state.observation,peer.state.observation.cursor).quiescent,false)
    assert.ok(!JSON.stringify(r).includes(secret));assert.ok(!JSON.stringify(peer.state).includes(secret))
    if(mode==='success'){
      assert.equal(peer.state.tasks[0].terminal,'interrupted');assert.equal(r.taskRequests[0].acknowledged,true)
      assert.equal(peer.state.observation.terminal.outcome,'interrupted')
    }
    if(mode==='new'){assert.deepEqual(r.unaddressedTaskIds,['new-child']);assert.equal(peer.state.tasks.find(t=>t.id==='new-child').terminal,null)}
    if(mode!=='revoked')assert.equal(await control.requestStop(cmd,peer.allowed),r)
  })
})
console.log(`${passed} Claude cancellation controller scenarios passed`)
