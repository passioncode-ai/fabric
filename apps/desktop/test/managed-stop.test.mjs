import assert from 'node:assert/strict'
import { createManagedStop } from '../src/main/managedStop.ts'
const target={taskId:'task',runId:'run',sessionId:'session'}
function fixture(fault='') {
 const calls=[],requests=[];let canonicalReason,observation=null,requestLost=fault==='request-lost',recordLost=fault==='record-lost',recorded=false
 const identity={task_id:'task',task_run_id:'run',session_id:'session'}
 const deps={estateId:'estate',actor:{kind:'person',id:'operator'},samples:3,escalateAfterSample:1,sampleIntervalMs:0,
 guard:async()=>fault!=='authority',authority:()=>({personId:'person',revision:1}),owns:()=>fault!=='foreign',
 halt:()=>{calls.push('halt')},revoke:async()=>{calls.push('revoke');if(fault==='revoke')throw Error('credential-private');return{revoked:true,evidenceRef:'revoke/session'}},
 signal:async(_,signal)=>{calls.push(signal);if(fault==='signal')throw Error('signal')},
 observe:async()=>{calls.push('observe');if(fault==='observe')throw Error('snapshot');return{
 rootExited:fault!=='alive',processTreeQuiescent:!['alive','children'].includes(fault),providerQuiescent:fault!=='provider',
 hostInstanceId:'host',bootId:'boot',processIdentityRef:'process/session',providerObservationRef:'provider/session',outcome:'completed'}},
 commitTranscript:async()=>{calls.push('transcript');if(fault==='transcript')throw Error('write');return{committed:true,evidenceRef:'transcript/session'}},
 wait:async()=>{},db:{rpc:async(name,args)=>{
  calls.push(name)
  if(name==='request_task_run_stop'){
   requests.push(args.p_command_id);canonicalReason ??= args.p_reason
   if(requestLost){requestLost=false;throw Error('lost')}
   if(fault==='request-refused')return{data:{requested:false}}
   return{data:{requested:true,...identity,session_id:fault==='request-mismatch'?'other':'session',command_id:'canonical-command',receipt_seq:1,reason:canonicalReason,basis:recorded?'observed':null,state:recorded?'stopped':'requested'}}
  }
  assert.equal(args.p_command_id,'canonical-command')
  observation=args.p_observation
  const complete=['rootExited','processTreeQuiescent','providerQuiescent','authorityRevoked','transcriptCommitted'].every(k=>observation[k])
  recorded=complete
  if(recordLost){recordLost=false;throw Error('lost')}
  return{data:{recorded:true,...identity,command_id:fault==='record-mismatch'?'other':'canonical-command',receipt_seq:2,basis:complete?'observed':null,state:complete?'stopped':'outcome_unknown'}}
 }}}
 return{deps,calls,requests,get observation(){return observation}}
}
for(const fault of ['','authority','foreign','request-lost','request-refused','request-mismatch','revoke','signal','observe','alive','children','provider','transcript','record-lost','record-mismatch']){
 const f=fixture(fault),stop=createManagedStop(f.deps),r=await stop(target)
 assert.equal(r.state, fault===''||fault==='signal'?'stopped':['authority','foreign','request-refused'].includes(fault)?'refused':'outcome_unknown',fault)
 if(['authority','foreign'].includes(fault))assert.equal(f.calls.length,0)
 if(['request-lost','request-refused','request-mismatch'].includes(fault))assert.equal(f.calls.includes('SIGTERM'),false)
 if(fault==='revoke')assert.equal(f.calls.includes('SIGTERM'),true,'cleanup failure must not prevent termination attempt')
 if(['alive','children','provider'].includes(fault))assert.equal(f.calls.includes('SIGKILL'),false,'normal Stop never escalates without the explicit choice')
 if(['alive','observe'].includes(fault))assert.equal(f.calls.includes('transcript'),false)
 if(f.observation)assert.equal(f.observation.outcome,'cancelled')
 if(fault==='request-lost'){
  const retry=await stop(target);assert.equal(retry.state,'stopped');assert.equal(f.requests[0],f.requests[1],'lost request uses same identity')
 }
 if(fault==='record-lost'){
  const n=f.calls.filter(c=>c==='SIGTERM').length
  const retry=await stop(target);assert.equal(retry.state,'stopped');assert.equal(f.calls.filter(c=>c==='SIGTERM').length,n,'durable receipt re-read without another signal')
 }
}
{
 const f=fixture(),stop=createManagedStop(f.deps)
 const a=stop(target),b=stop(target,'natural_exit')
 assert.equal(a,b,'operator Stop and onExit join same finalizer')
 assert.equal((await a).state,'stopped');assert.equal(f.requests.length,1)
 assert(f.calls.indexOf('halt')<f.calls.indexOf('request_task_run_stop'))
 assert(f.calls.indexOf('request_task_run_stop')<f.calls.indexOf('SIGTERM'))
 assert(f.calls.indexOf('transcript')<f.calls.indexOf('record_task_run_stop_observation'))
}
{
 const f=fixture('children');await createManagedStop(f.deps)(target,'natural_exit')
 assert.equal(f.observation.outcome,'completed','runtime exit can be known while tree remains uncertain')
 assert.equal(f.observation.processTreeQuiescent,false)
}
console.log('PASS managed Stop coordinator: exact generation, canonical repeat, durable intent before signal, lost receipts, shared finalizer, all five evidence boundaries')

{
 const f=fixture('request-lost'),stop=createManagedStop(f.deps)
 await stop(target,'operator_stop');await stop(target,'natural_exit')
 assert.equal(f.observation.outcome,'cancelled','canonical durable reason survives different retry origin')
}
{
 const f=fixture();let owns=true
 f.deps.owns=()=>owns
 f.deps.revoke=async()=>{owns=false;return{revoked:true,evidenceRef:'revoke/session'}}
 const r=await createManagedStop(f.deps)(target)
 assert.equal(r.state,'outcome_unknown');assert.equal(f.calls.includes('SIGTERM'),false)
}
console.log('PASS canonical Stop reason and ownership recheck after asynchronous revocation')
for(const phase of ['requested_state','requested_reason','recorded_state']) {
 const f=fixture(),rpc=f.deps.db.rpc
 f.deps.db.rpc=async(name,args)=>{const r=await rpc(name,args)
  if(phase==='requested_state'&&name==='request_task_run_stop')r.data.state=['requested']
  if(phase==='requested_reason'&&name==='request_task_run_stop')r.data.reason=['operator_stop']
  if(phase==='recorded_state'&&name==='record_task_run_stop_observation')r.data.state=['stopped']
  return r
 }
 assert.equal((await createManagedStop(f.deps)(target)).state,'outcome_unknown')
 if(phase!=='recorded_state')assert.equal(f.calls.includes('SIGTERM'),false)
}
for(const kind of ['success','failure','ownership','hung','lost_request']) {
 const f=fixture(kind==='lost_request'?'request-lost':'provider');f.deps.timeoutMs=20
 let owns=true,lateAllowed
 f.deps.owns=()=>owns
 f.deps.requestProviderStop=async(t,command,allowed)=>{
  f.calls.push('provider_cancel');assert.deepEqual(t,target)
  assert.equal(command.commandId,'canonical-command');assert.equal(command.reason,'operator_stop');assert(allowed())
  if(kind==='failure')throw Error('private provider error')
  if(kind==='ownership')owns=false
  if(kind==='hung'){lateAllowed=allowed;await new Promise(()=>{})}
 }
 const r=await createManagedStop(f.deps)(target)
 assert.equal(r.state,'outcome_unknown','ACK cannot substitute for quiescence')
 if(kind==='lost_request')assert.equal(f.calls.includes('provider_cancel'),false)
 else assert(f.calls.indexOf('request_task_run_stop')<f.calls.indexOf('provider_cancel'))
 if(['success','failure'].includes(kind))assert(f.calls.indexOf('provider_cancel')<f.calls.indexOf('SIGTERM'))
 if(['ownership','hung','lost_request'].includes(kind))assert.equal(f.calls.includes('SIGTERM'),false)
 if(lateAllowed)assert.equal(lateAllowed(),false)
}
{
 const f=fixture();f.deps.timeoutMs=NaN;f.deps.samples=NaN;f.deps.sampleIntervalMs=NaN
 assert.equal((await createManagedStop(f.deps)(target)).state,'stopped','invalid timing config uses finite defaults')
}
console.log('PASS strict Stop receipts and durable typed cancellation before physical teardown')
// A never-resolving dependency cannot hold the operator's Stop indefinitely.
for(const boundary of ['request','revoke','signal','observe','transcript']) {
 const f=fixture();f.deps.timeoutMs=25
 const never=()=>new Promise(()=>{})
 if(boundary==='request')f.deps.db.rpc=never
 else if(boundary==='transcript')f.deps.commitTranscript=never
 else f.deps[boundary]=never
 const started=performance.now(),r=await createManagedStop(f.deps)(target)
 assert.equal(r.state,'outcome_unknown',boundary)
 assert.equal(r.reasonCode,'stop_deadline',boundary)
 assert(performance.now()-started<1000,'deadline bounds hung dependency')
 if(boundary==='request'||boundary==='revoke')assert.equal(f.calls.includes('SIGTERM'),false)
}
{
 const f=fixture();f.deps.timeoutMs=25
 let release,osSignals=0
 f.deps.signal=async(_,signal,stillAllowed)=>{
  await new Promise(r=>{release=r})
  if(stillAllowed())osSignals++
 }
 const r=await createManagedStop(f.deps)(target)
 assert.equal(r.reasonCode,'stop_deadline')
 release();await Promise.resolve();await Promise.resolve()
 assert.equal(osSignals,0,'late native snapshot must not signal after the whole command expired')
}
console.log('PASS Stop deadline: hung ports remain unknown; late native work cannot signal after cancellation')

{
 const f=fixture(),observe=f.deps.observe
 f.deps.observe=async()=>{const result=await observe();delete result.outcome;return result}
 const result=await createManagedStop(f.deps)(target,'natural_exit')
 assert.equal(result.state,'outcome_unknown');assert.equal(result.reasonCode,'exit_outcome_unavailable')
 assert.equal(f.observation,null,'missing natural exit outcome must not persist an invented failure')
}

{
 const f=fixture('children'),stop=createManagedStop(f.deps)
 await stop(target)
 assert.equal(f.calls.includes('SIGKILL'),false)
 await stop(target,'operator_stop',{force:true})
 assert.equal(f.calls.includes('SIGKILL'),true,'explicit force can escalate the owned boundary after renewed authority')
}
console.log('PASS Stop escalation requires the explicit force option')
// A busy synchronous dependency can starve the timer queue; wall-clock
// expiration still overrides a late successful final observation receipt.
{
 const f=fixture(),rpc=f.deps.db.rpc
 f.deps.timeoutMs=10
 f.deps.db.rpc=async(name,args)=>{
   if(name==='record_task_run_stop_observation'){
     const until=performance.now()+30;while(performance.now()<until){}
   }
   return rpc(name,args)
 }
 const r=await createManagedStop(f.deps)(target)
 assert.equal(r.state,'outcome_unknown');assert.equal(r.reasonCode,'stop_deadline')
}
console.log('PASS monotonic Stop deadline despite a final RPC starving the event-loop timer')
