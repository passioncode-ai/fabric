import assert from 'node:assert/strict'
import { createCodexProviderState,normalizeCodexNotification as notify,registerCodexOwnedProcess as own,
 normalizeCodexBackgroundInventory as inventory } from '../src/main/codexProviderEvents.ts'
import { assessProviderQuiescence,PROVIDER_LIMITS } from '../src/shared/providerExecution.ts'
// Minimal fixture facts follow locally generated codex 0.157.1 v2 schemas:
// TurnCompleted, ItemStarted/Completed, TerminalInteraction, ProcessExited,
// ThreadBackgroundTerminalsListResponse and ThreadItem's child-agent variants.
// These are protocol fixtures, not a recording or provider conformance receipt.
const binding={schema:'ProviderExecution@1',fabric:{estateId:'estate',taskId:'task',runId:'run',sessionId:'fabric'},
 provider:{id:'codex-cli',build:'0.157.1',runtimeProfile:'owned-stdio'},
 native:{status:'observed',connectionId:'connection',sessionId:null,threadId:'thread',turnId:'turn'},
 execution:{kind:'native-turn',id:'turn'},manifestDigest:'a'.repeat(64),policyDigest:'b'.repeat(64)}
const fresh=()=>{const r=createCodexProviderState(binding);assert.equal(r.ok,true);return r.value}
const source=(s,extra={})=>({connectionId:'connection',sequence:s.sourceSequence+1,eventId:`source-${s.sourceSequence+1}`,...extra})
const assertOK=r=>{assert.equal(r.accepted,true,r.reasonCode);return r.state}
const done=(status='completed',items=[])=>({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status,items}}})
const command=(id='item',patch={})=>({type:'commandExecution',id,status:'inProgress',command:'SECRET-command',cwd:'/SECRET/path',commandActions:[],...patch})
const item=(value,ended=false)=>({method:ended?'item/completed':'item/started',params:{threadId:'thread',turnId:'turn',item:value,[ended?'completedAtMs':'startedAtMs']:1}})
const interaction={method:'item/commandExecution/terminalInteraction',params:{threadId:'thread',turnId:'turn',itemId:'item',processId:'pty',stdin:'SECRET-stdin'}}
const exit=(processHandle='owned')=>({method:'process/exited',params:{processHandle,exitCode:0,stdout:'SECRET-output',stderr:'SECRET-error',stdoutCapReached:false,stderrCapReached:false}})
const pages=(rows=[],nextCursor=null)=>({threadId:'thread',pages:[{requestCursor:null,response:{data:rows,nextCursor}}]})
const row=(processId='pty',itemId='item')=>({processId,itemId,command:'SECRET-command',cwd:'/SECRET/path'})
const coverage=s=>({binding,throughSourceSequence:s.sourceSequence,admissionClosed:true,coveredKinds:['background','child','remote'],evidenceRef:`sha256:${'c'.repeat(64)}`})
const quiescent=s=>assessProviderQuiescence(s.observation,s.observation.cursor).quiescent
for(const status of ['completed','interrupted','failed']){
 let s=fresh();s=assertOK(notify(s,source(s),done(status)))
 assert.equal(quiescent(s),false,'turn terminal is not writer proof')
 const empty=assertOK(inventory(s,source(s),pages()));assert.equal(quiescent(empty),false,'list absence never closes admission')
 const src=source(s),cov=coverage(s),r=inventory(s,src,pages(),cov);s=assertOK(r)
 assert.equal(quiescent(s),true,'explicit trusted coverage plus closed scope and observed turn')
 assert.equal(inventory(s,src,pages(),cov).repeated,true)
 assert.equal(Object.isFrozen(s.observation),true)
}
for(const patch of [{provider:{...binding.provider,build:'next'}},{provider:{...binding.provider,id:'claude-code'}},{native:{status:'unknown',reason:'not_observed'}}])
 assert.equal(createCodexProviderState({...binding,...patch}).ok,false)
// Command backgrounding and connection-owned process handles are disjoint.
{
 let s=fresh();s=assertOK(notify(s,source(s),item(command())))
 s=assertOK(notify(s,source(s),interaction));assert.equal(s.observation.writers.length,2)
 s=assertOK(notify(s,source(s),item(command('item',{status:'completed',processId:'pty',exitCode:null}),true)))
 assert.equal(s.observation.writers.every(w=>w.state==='unknown'),true)
 assert.equal(notify(s,source(s),exit('pty')).reasonCode,'unowned_process')
 s=assertOK(notify(s,source(s),done()))
 s=assertOK(inventory(s,source(s),pages(),coverage(s)))
 assert.equal(quiescent(s),false,'missing active-list row does not mean terminal')
 s=assertOK(notify(s,source(s),item(command('item',{status:'completed',processId:'pty',exitCode:0}),true)))
 s=assertOK(inventory(s,source(s),pages(),coverage(s)));assert.equal(quiescent(s),true)
 assert.equal(JSON.stringify(s).includes('SECRET'),false);assert.equal(JSON.stringify(s).includes('/SECRET/path'),false)
}
{
 let s=fresh();s=assertOK(own(s,source(s),'owned'))
 const invalid={...source(s),connectionId:'other'};assert.equal(notify(s,invalid,exit()).reasonCode,'foreign_connection')
 s=assertOK(notify(s,source(s),exit()));s=assertOK(notify(s,source(s),done()))
 s=assertOK(inventory(s,source(s),pages(),coverage(s)));assert.equal(quiescent(s),true)
 assert.equal(JSON.stringify(s).includes('SECRET'),false)
}
// A malformed replay cannot alias a valid omitted/null scalar field.
{
 let s=fresh();const src=source(s),msg=done();s=assertOK(notify(s,src,msg));s=assertOK(inventory(s,source(s),pages(),coverage(s)))
 const malformed=structuredClone(msg);malformed.params.turn.itemsView=null
 const r=notify(s,src,malformed);assert.equal(r.accepted,false);assert.equal(quiescent(r.state),false)
 let c=fresh();const cs=source(c),cm=item(command('item',{status:'completed',exitCode:null}),true)
 c=assertOK(notify(c,cs,cm));const bad=structuredClone(cm);bad.params.item.exitCode=NaN
 assert.equal(notify(c,cs,bad).accepted,false)
}
// An exact old receipt is independent of links/status learned afterwards.
{
 let s=fresh();const src=source(s),msg=item(command());s=assertOK(notify(s,src,msg))
 s=assertOK(notify(s,source(s),interaction))
 assert.equal(notify(s,src,msg).repeated,true)
 const invSource=source(s),input=pages([row()]);s=assertOK(inventory(s,invSource,input))
 s=assertOK(notify(s,source(s),item(command('item',{processId:'pty',status:'completed',exitCode:0}),true)))
 assert.equal(inventory(s,invSource,input).repeated,true)
 assert.equal(s.observation.writers.every(w=>w.state==='terminal'),true)
}
// Terminal turn snapshots can still contain unresolved command items. They
// are not item/completed notifications and do not poison later reconciliation.
{
 let s=fresh();s=assertOK(notify(s,source(s),done('interrupted',[command('item',{processId:'pty'})])))
 assert.equal(s.observation.terminal.outcome,'interrupted')
 assert.equal(s.observation.writers.every(w=>w.state==='unknown'),true)
 s=assertOK(inventory(s,source(s),pages(),coverage(s)));assert.equal(quiescent(s),false)
 s=assertOK(notify(s,source(s),item(command('item',{processId:'pty',status:'failed',exitCode:130}),true)))
 s=assertOK(inventory(s,source(s),pages(),coverage(s)));assert.equal(quiescent(s),true)
}
// Evidence identity intentionally excludes raw text, not merely its plaintext.
{
 const s=fresh(),src=source(s)
 const a=notify(s,src,item(command())),b=notify(s,src,item(command('item',{command:'different PRIVATE',cwd:'/other/private'})))
 assert.deepEqual(a,b,'command/cwd must not influence evidence hashes')
 const registered=assertOK(own(s,src,'owned')),payload=exit(),other=structuredClone(payload)
 other.params.stdout='other PRIVATE';other.params.stderr='other PRIVATE'
 assert.deepEqual(notify(registered,source(registered),payload),notify(registered,source(registered),other),'output must not influence evidence hashes')
}
// Complete pagination is linked, bounded and does not drop known processes.
{
 let s=fresh();const input={threadId:'thread',pages:[{requestCursor:null,response:{data:[row()],nextCursor:'next'}},{requestCursor:'next',response:{data:[row('pty2','item2')],nextCursor:null}}]}
 s=assertOK(inventory(s,source(s),input));assert.equal(s.observation.writers.length,2)
 s=assertOK(inventory(s,source(s),pages()));assert.equal(s.observation.writers.length,2)
 assert.equal(s.observation.writers.every(w=>w.state==='unknown'),true)
}
for(const [input,reason] of [[pages([],'next'),'partial_inventory'],[{threadId:'thread',pages:[{requestCursor:'wrong',response:{data:[]}}]},'invalid_page'],
 [{threadId:'thread',pages:[{requestCursor:null,response:{data:[],nextCursor:'a'}},{requestCursor:'a',response:{data:[],nextCursor:'a'}}]},'page_cycle'],
 [{threadId:'thread',pages:[{requestCursor:null,response:{data:[]}},{requestCursor:null,response:{data:[]}}]},'unexpected_page'],
 [pages([row(),row()]),'duplicate_process'],[pages(Array.from({length:129},(_,i)=>row(`p${i}`,`i${i}`))),'invalid_page'],
 [{threadId:'thread',pages:Array.from({length:65},()=>({requestCursor:null,response:{data:[]}}))},'invalid_pages']]) {
 const s=fresh(),r=inventory(s,source(s),input);assert.equal(r.reasonCode,reason);assert.equal(r.accepted,false);assert.equal(quiescent(r.state),false)
}
// Native payload errors, malformed enum arrays, foreign scope and unsupported
// writer subtypes cannot be normalized into a clean closed inventory.
for(const [message,reason] of [[done(['completed']),'invalid_turn_terminal'],[done('inProgress'),'invalid_turn_terminal'],
 [{...done(),params:{threadId:'foreign',turn:{id:'turn',status:'completed',items:[]}}},'foreign_turn'],
 [{...done(),error:{message:'SECRET'}},'invalid_notification'],[{method:'new/writer',params:{}},'unsupported_notification'],
 [item({...command(),type:'mcpToolCall'}),'unsupported_item_type'],[item({...command(),status:['inProgress']}),'invalid_command_item'],
 [item({...command(),processId:14}),'invalid_process_id'],[done('completed',[{id:'x',type:'newWriter'}]),'unsupported_item_type'],
 [{method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed',items:[],itemsView:'summary'}}},'invalid_turn_terminal']]) {
 const s=fresh(),r=notify(s,source(s),message);assert.equal(r.reasonCode,reason);assert.equal(r.accepted,false)
}
// Malformed scope is not a valid foreign notification: it invalidates any
// prior proof, whereas a well-formed message for another turn is ignored.
{
 let s=fresh();s=assertOK(notify(s,source(s),done()));s=assertOK(inventory(s,source(s),pages(),coverage(s)))
 assert.equal(quiescent(s),true)
 for(const malformed of [{method:'turn/completed',params:{threadId:'thread'}},
  {method:'item/started',params:{threadId:'thread',turnId:['turn'],item:command()}},
  {method:'item/commandExecution/terminalInteraction',params:{threadId:'thread'}}]) {
  const r=notify(s,source(s),malformed);assert.equal(r.reasonCode,'invalid_turn_scope');assert.equal(quiescent(r.state),false)
 }
 const r=inventory(s,source(s),{threadId:[],pages:[]});assert.equal(r.reasonCode,'invalid_thread_scope');assert.equal(quiescent(r.state),false)
}
// Child completion/tool ACK is only last-known state; it does not prove the
// child's background/remote writers stopped. New child variants stay blocked.
{
 let s=fresh();s=assertOK(notify(s,source(s),item({id:'collab',type:'collabAgentToolCall',senderThreadId:'thread',receiverThreadIds:['child'],
 status:'completed',tool:'wait',agentsStates:{child:{status:'completed',message:'SECRET-child'}},prompt:'SECRET-prompt'},true)))
 s=assertOK(notify(s,source(s),item({id:'activity',type:'subAgentActivity',agentPath:'SECRET-path',agentThreadId:'child',kind:'completed'},true)))
 assert.equal(s.observation.writers.length,1);assert.equal(s.observation.writers[0].state,'unknown')
 s=assertOK(notify(s,source(s),done()));s=assertOK(inventory(s,source(s),pages(),coverage(s)))
 assert.equal(quiescent(s),false);assert.equal(JSON.stringify(s).includes('SECRET'),false)
}
// Stable normalized replay never grants effects, gaps poison, scope stays exact.
{
 let s=fresh();const src=source(s),msg=done();s=assertOK(notify(s,src,msg))
 assert.equal(notify(s,src,msg).repeated,true)
 assert.equal(notify(s,src,done('failed')).reasonCode,'source_id_conflict')
 assert.equal(notify(s,source(s,{sequence:10}),done()).reasonCode,'source_gap')
 assert.equal(notify(s,source(s,{sequence:1}),done()).reasonCode,'stale_source')
 assert.equal(notify(s,{...source(s),token:'SECRET'},done()).reasonCode,'invalid_source')
 for(const cov of [{...coverage(s),binding:{...binding,fabric:{...binding.fabric,runId:'other'}}},{...coverage(s),throughSourceSequence:0},
  {...coverage(s),coveredKinds:['background']},{...coverage(s),admissionClosed:false}])
  assert.equal(inventory(s,source(s),pages(),cov).reasonCode,'invalid_host_coverage')
 const r=notify(s,source(s,{sequence:10}),done())
 assert.equal(inventory(r.state,source(r.state),pages(),coverage(r.state)).reasonCode,'resync_required')
}
{
 let s=fresh()
 for(let i=0;i<PROVIDER_LIMITS.events;i++)s=assertOK(notify(s,source(s),item({id:`text${i}`,type:'agentMessage',text:'SECRET'})))
 assert.equal(notify(s,source(s),done()).reasonCode,'source_limit')
}
console.log('PASS Codex 0.157.1 normalization fixtures: exact scope/order, owned handles, child uncertainty, complete pagination, explicit host coverage, no raw content; native conformance not claimed')
