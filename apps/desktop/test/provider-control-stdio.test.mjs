import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createProviderJsonlTransport } from '../src/main/providerJsonlTransport.ts'
import { createCodexProviderControl } from '../src/main/codexProviderControl.ts'

// Real pipes to an owned deterministic protocol peer, not a vendor canary.
// Tests controller + transport composition, including a revocation delivered
// between an inventory request and its reply. No credentials or network.
const binding={schema:'ProviderExecution@1',fabric:{estateId:'estate',taskId:'task',runId:'run',sessionId:'session'},
 provider:{id:'codex-cli',build:'0.157.1',runtimeProfile:'owned-stdio'},
 native:{status:'observed',connectionId:'connection',sessionId:null,threadId:'thread',turnId:'turn'},
 execution:{kind:'native-turn',id:'turn'},manifestDigest:'a'.repeat(64),policyDigest:'b'.repeat(64)}
const scope={binding,sourceSequence:0,observationCursor:0}
for(const mode of ['success','revoked','missing-reply','foreign-writer']) {
 const child=spawn(process.execPath,['-e',`
 const mode=${JSON.stringify(mode)};
 const emit=v=>process.stdout.write(JSON.stringify(v)+'\\n');
 let buffer='';
 process.stdin.on('data',chunk=>{buffer+=chunk;let n;
 while((n=buffer.indexOf('\\n'))>=0){const request=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);
 emit({method:'fixture/call',params:{method:request.method}});
 if(mode==='missing-reply')continue;
 let result={};
 if(request.method==='thread/backgroundTerminals/list'){
  if(mode==='revoked')emit({method:'fixture/revoke',params:{}});
  result={data:[{itemId:mode==='foreign-writer'?'other-item':'item',processId:'process',command:'secret-canary',cwd:'/private-canary'}],nextCursor:null};
 }
 if(request.method==='thread/backgroundTerminals/terminate')result={terminated:true};
 emit({id:request.id,result});
 }});
 process.stdin.on('end',()=>process.exit(0));
 emit({method:'fixture/ready',params:{}});
 `],{stdio:['pipe','pipe','ignore']})
 const exit=once(child,'exit'),calls=[];let authority=true,ready
 // CO-174. The peer is a fresh Node process, and under load it took longer to start than the
 // 100 ms missing-reply deadline: the request timed out before the peer could even read it, and
 // the assertion about what reached the peer read nothing. The peer now says it is listening,
 // and what reached it is awaited (bounded) rather than raced against its notification.
 const listening=new Promise(r=>{ready=r})
 const transport=createProviderJsonlTransport({input:child.stdout,output:child.stdin,timeoutMs:1000,
  onNotification:(method,params)=>{if(method==='fixture/ready')ready();if(method==='fixture/call')calls.push(params.method);if(method==='fixture/revoke')authority=false}})
 const created=createCodexProviderControl({binding,ownership:{...scope,handles:[{itemId:'item',processId:'process'}]},
  currentScope:()=>scope,transport,timeoutMs:mode==='missing-reply'?100:2000})
 assert(created.ok)
 const control=created.value,command={commandId:'stop-command',issuedCursor:0,reason:'operator_stop'}
 try {
  await Promise.race([listening,exit.then(()=>{throw new Error('protocol peer exited before it listened')})])
  const a=control.requestStop(command,()=>authority),b=control.requestStop(command,()=>authority)
  assert.equal(a,b,'same command shares one effect sequence')
  const result=await a
  assert.equal(result.status,mode==='success'?'request_ack':'outcome_unknown',mode)
  assert.equal('quiescent' in result,false);assert.equal('stopped' in result,false)
  assert(!JSON.stringify(result).includes('secret-canary'));assert(!JSON.stringify(result).includes('/private-canary'))
  const expected=mode==='missing-reply'?['turn/interrupt']:mode==='success'
   ?['turn/interrupt','thread/backgroundTerminals/list','thread/backgroundTerminals/terminate']
   :['turn/interrupt','thread/backgroundTerminals/list']
  for(const deadline=Date.now()+2000;calls.length<expected.length&&Date.now()<deadline;)await new Promise(r=>setTimeout(r,10))
  assert.deepEqual(calls,expected)
  const count=calls.length;await control.requestStop(command,()=>authority)
  await new Promise(r=>setTimeout(r,20));assert.equal(calls.length,count,'cached/unknown command never blindly repeats')
 }finally{
  transport.close();child.stdin.end()
  const cleanup=setTimeout(()=>child.kill('SIGKILL'),1000)
  await exit;clearTimeout(cleanup)
 }
}
console.log('PASS real owned stdio composition: canonical control, interleaved revocation, missing reply, foreign writer, no secret-bearing receipt')
