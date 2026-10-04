import assert from 'node:assert/strict'
import {createCodexProviderControl,CODEX_CONTROL_LIMITS} from '../src/main/codexProviderControl.ts'
const binding={schema:'ProviderExecution@1',fabric:{estateId:'estate',taskId:'task',runId:'run',sessionId:'session'},
 provider:{id:'codex-cli',build:'0.157.1',runtimeProfile:'owned-stdio'},native:{status:'observed',connectionId:'connection',sessionId:null,threadId:'thread',turnId:'turn'},
 execution:{kind:'native-turn',id:'turn'},manifestDigest:'a'.repeat(64),policyDigest:'b'.repeat(64)}
const command={commandId:'stop-command',issuedCursor:4,reason:'operator_stop'}
const reply=result=>({status:'reply',result})
const row=(processId='process',itemId='item')=>({itemId,processId,command:'SECRET-command',cwd:'/SECRET/cwd'})
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
function fixture({handles=[{itemId:'item',processId:'process'}],request,timeoutMs=1000}={}){
 let current={binding,sourceSequence:4,observationCursor:4};const calls=[]
 const options={binding,ownership:{...current,handles},currentScope:()=>current,timeoutMs,transport:{request(method,params,fence){calls.push({method,params});return request?request(method,params,fence,calls):Promise.resolve(reply(method==='turn/interrupt'?{}:method.endsWith('/list')?{data:[row()]}:{terminated:true}))}}}
 const created=createCodexProviderControl(options);assert.equal(created.ok,true)
 return {control:created.value,calls,options,setScope:value=>{current=value}}
}
{
 const f=fixture();const a=f.control.requestStop(command,()=>true),b=f.control.requestStop(command,()=>true)
 assert.equal(a,b,'concurrent same command joins');const r=await a
 assert.equal(r.status,'request_ack');assert.equal(r.interruptAcknowledged,true);assert.equal(r.inventoryComplete,true)
 assert.deepEqual(f.calls.map(c=>c.method),['turn/interrupt','thread/backgroundTerminals/list','thread/backgroundTerminals/terminate'])
 assert.deepEqual(f.calls[0].params,{threadId:'thread',turnId:'turn'});assert.deepEqual(f.calls[2].params,{threadId:'thread',processId:'process'})
 assert.equal('stopped' in r,false);assert.equal('quiescent' in r,false);assert.equal(JSON.stringify(r).includes('SECRET'),false)
 assert.equal(await f.control.requestStop(command,()=>true),r);assert.equal(f.calls.length,3)
 assert.equal((await f.control.requestStop({...command,reason:'natural_exit'},()=>true)).reasonCode,'canonical_command_conflict')
 assert.equal((await f.control.requestStop({...command,commandId:'new'},()=>true)).reasonCode,'canonical_command_conflict')
 assert.equal((await f.control.requestStop(command,()=>false)).reasonCode,'scope_changed','historical ACK needs current read fence')
 f.setScope({binding:{...binding,fabric:{...binding.fabric,runId:'new'}},sourceSequence:4,observationCursor:4})
 assert.equal((await f.control.requestStop(command,()=>true)).reasonCode,'scope_changed')
}
// A settled command answers its stored outcome even when a repeat's own budget runs out:
// the repeat writes nothing, and a refusal would read as "nothing was sent".
{
 const busy=ms=>{const until=performance.now()+ms;while(performance.now()<until){}}
 const f=fixture({timeoutMs:200});const r=await f.control.requestStop(command,()=>true);assert.equal(r.status,'request_ack')
 assert.equal(await f.control.requestStop(command,()=>{busy(250);return true}),r);assert.equal(f.calls.length,3)
}
for(const runtimeProfile of ['owned-pty','shared-daemon','remote']){
 const f=fixture(),b={...binding,provider:{...binding.provider,runtimeProfile}}
 assert.equal(createCodexProviderControl({...f.options,binding:b,ownership:{...f.options.ownership,binding:b}}).reasonCode,'unsupported_control_profile')
}
for(const mutate of [o=>o.ownership.binding={...binding,fabric:{...binding.fabric,taskId:'other'}},o=>o.ownership.sourceSequence=-1,
 o=>o.ownership.handles=[{itemId:'item',processId:'process'},{itemId:'another',processId:'process'}],o=>o.ownership.handles[0].token='SECRET',
 o=>o.timeoutMs=NaN,o=>o.timeoutMs=Infinity,o=>o.timeoutMs=0]){
 const f=fixture(),o={...f.options,ownership:structuredClone(f.options.ownership)};mutate(o);assert.equal(createCodexProviderControl(o).ok,false)
}
{
 const f=fixture();assert.equal((await f.control.requestStop({...command,issuedCursor:5},()=>true)).reasonCode,'scope_changed')
 assert.equal(f.calls.length,0,'a command cannot cite unobserved future evidence')
}
// Lists establish membership only, never ownership or termination evidence.
{
 const f=fixture({request:async(method)=>reply(method==='turn/interrupt'?{}:method.endsWith('/list')?{data:[row(),row('foreign','other')]}:{terminated:true})})
 const r=await f.control.requestStop(command,()=>true);assert.equal(r.reasonCode,'unowned_background')
 assert.equal(r.observedBackground[1].owned,false);assert.equal(f.calls.filter(c=>c.method.endsWith('/terminate')).length,1)
}
{
 const f=fixture({request:async(method)=>reply(method==='turn/interrupt'?{}:method.endsWith('/list')?{data:[row('process','wrong-item')]}:{terminated:true})})
 assert.equal((await f.control.requestStop(command,()=>true)).reasonCode,'unowned_background');assert.equal(f.calls.length,2)
}
{
 const f=fixture({request:async(method)=>reply(method==='turn/interrupt'?{}:method.endsWith('/list')?{data:[]}:{terminated:true})})
 const r=await f.control.requestStop(command,()=>true);assert.equal(r.status,'request_ack');assert.equal(r.terminationRequests.length,0)
 assert.equal('quiescent' in r,false,'known handle absent from list is not proof of its exit')
}
{
 const f=fixture({request:async(method)=>reply(method==='turn/interrupt'?{}:method.endsWith('/list')?{data:[row()]}:{terminated:false})})
 const r=await f.control.requestStop(command,()=>true);assert.equal(r.reasonCode,'termination_unacknowledged');assert.equal(r.terminationRequests[0].acknowledged,false)
}
// Follow only exact pagination cursors and finish inventory before terminating.
{
 const f=fixture({handles:[{itemId:'item',processId:'process'},{itemId:'item2',processId:'process2'}],request:async(method,params)=>reply(
 method==='turn/interrupt'?{}:method.endsWith('/list')?(params.cursor===null?{data:[row()],nextCursor:'next'}:{data:[row('process2','item2')],nextCursor:null}):{terminated:true})})
 const r=await f.control.requestStop(command,()=>true);assert.equal(r.status,'request_ack');assert.equal(f.calls[2].params.cursor,'next');assert.equal(f.calls.length,5)
}
for(const [response,reason] of [[{data:[row(),row()]},'duplicate_process'],[{data:[row()],nextCursor:[]},'invalid_page_cursor'],
 [{data:[{...row(),osPid:'pid'}]},'invalid_inventory_row'],[{data:[{...row(),cpuPercent:Infinity}]},'invalid_inventory_row'],
 [{data:Array.from({length:129},()=>row())},'invalid_inventory_reply'],[{data:[],nextCursor:'cycle'},'page_cycle']]){
 const f=fixture({request:async method=>reply(method==='turn/interrupt'?{}:response)})
 const r=await f.control.requestStop(command,()=>true);assert.equal(r.reasonCode,reason);assert.equal(f.calls.some(c=>c.method.endsWith('/terminate')),false)
}
{
 let page=0;const f=fixture({request:async method=>reply(method==='turn/interrupt'?{}:{data:[],nextCursor:`page-${++page}`})})
 assert.equal((await f.control.requestStop(command,()=>true)).reasonCode,'page_limit');assert.equal(f.calls.length,CODEX_CONTROL_LIMITS.pages+1)
}
// Broken replies and lost requests are cached; no timer or repeated call resends.
for(const [response,reason,status] of [[{status:'outcome_unknown',reason:'deadline'},'request_timeout','outcome_unknown'],
 [{status:'not_sent',reason:'closed'},'request_not_sent','refused'],[{status:'error',code:-1},'provider_error','outcome_unknown'],
 [{status:'not_sent',result:{}},'invalid_transport_reply','outcome_unknown'],[reply({accepted:true}),'invalid_interrupt_reply','outcome_unknown'],
 [reply(null),'invalid_interrupt_reply','outcome_unknown']]){
 const f=fixture({request:async()=>response}),r=await f.control.requestStop(command,()=>true)
 assert.equal(r.reasonCode,reason);assert.equal(r.status,status)
 await f.control.requestStop(command,()=>true);assert.equal(f.calls.length,1)
}
{
 const f=fixture({request:async()=>{throw new Error('SECRET-error')}})
 const r=await f.control.requestStop(command,()=>true);assert.equal(r.reasonCode,'transport_failure');assert.equal(JSON.stringify(r).includes('SECRET'),false)
}
// The authority port is synchronous and must return literal true. Incorrect
// async JS ports never grant effects or leak unhandled rejected promises.
for(const fence of [()=>1,()=>({}),()=>Promise.resolve(true),()=>Promise.reject(new Error('PRIVATE'))]){
 const f=fixture();assert.equal((await f.control.requestStop(command,fence)).reasonCode,'scope_changed');assert.equal(f.calls.length,0)
}
{
 const f=fixture(),created=createCodexProviderControl({...f.options,currentScope:()=>Promise.reject(new Error('PRIVATE'))})
 assert.equal(created.ok,true);assert.equal((await created.value.requestStop(command,()=>true)).reasonCode,'scope_changed');assert.equal(f.calls.length,0)
}
// Authority/binding/cursor changes after an awaited reply stop every next effect.
{
 let allow=true;const f=fixture({request:async()=>{allow=false;return reply({})}})
 const r=await f.control.requestStop(command,()=>allow);assert.equal(r.reasonCode,'scope_changed');assert.equal(f.calls.length,1)
}
{
 const f=fixture();f.setScope({binding,sourceSequence:3,observationCursor:4})
 assert.equal((await f.control.requestStop(command,()=>true)).reasonCode,'scope_changed');assert.equal(f.calls.length,0)
}
{
 let f;f=fixture({request:async()=>{f.setScope({binding:{...binding,native:{...binding.native,connectionId:'new'}},sourceSequence:5,observationCursor:5});return reply({})}})
 assert.equal((await f.control.requestStop(command,()=>true)).reasonCode,'scope_changed');assert.equal(f.calls.length,1)
}
// Whole-operation deadlines survive stalled timers and late async port replies.
{
 let resolve;const f=fixture({timeoutMs:5,request:()=>new Promise(r=>{resolve=r})})
 const r=await f.control.requestStop(command,()=>true);assert.equal(r.reasonCode,'deadline');assert.equal(f.calls.length,1)
 resolve(reply({}));await sleep(1);await f.control.requestStop(command,()=>true);assert.equal(f.calls.length,1)
}
{
 const f=fixture({timeoutMs:5,request:()=>{const until=performance.now()+20;while(performance.now()<until){}return Promise.resolve(reply({}))}})
 assert.equal((await f.control.requestStop(command,()=>true)).reasonCode,'deadline');assert.equal(f.calls.length,1)
}
{
 const f=fixture({timeoutMs:5});const r=await f.control.requestStop(command,()=>{const until=performance.now()+20;while(performance.now()<until){}return true})
 assert.equal(r.reasonCode,'deadline');assert.equal(f.calls.length,0,'starved initial authority guard cannot start a late request')
}
{
 let writes=0;const f=fixture({timeoutMs:5,request:async(_method,_params,fence)=>{await sleep(20);if(fence())writes++;return reply({})}})
 assert.equal((await f.control.requestStop(command,()=>true)).reasonCode,'deadline');await sleep(25);assert.equal(writes,0)
}
// Synchronous reentry from the request port joins the installed command.
{
 let nested,f;f=fixture({request:async method=>{if(method==='turn/interrupt')nested=f.control.requestStop(command,()=>true);return reply(method==='turn/interrupt'?{}:{data:[]})}})
 const outer=f.control.requestStop(command,()=>true);assert.equal(nested,outer);assert.equal((await outer).status,'request_ack');assert.equal(f.calls.length,2)
}
console.log('PASS Codex control fixtures: scoped interrupt ACK, owned-only cleanup, bounded pagination, canonical dedup, lost-reply/deadline fences; no native stop proof')
