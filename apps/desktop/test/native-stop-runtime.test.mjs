import assert from 'node:assert/strict'
import { createNativeStopRuntime, nativeExitOutcome } from '../src/main/nativeStopRuntime.ts'
const tick=()=>new Promise(resolve=>setTimeout(resolve,0))
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}}
function fixture(fault='') {
 const calls=[],states=[],commands=[],signals=[]
 let observation,canonical,stopped=false,requestLost=fault==='request-lost',recordLost=fault==='record-lost'
 let session={sessionId:'session',optionId:fault==='shell'?'shell':'claude-code',startedAt:123}
 let target=fault==='shell'?null:{taskId:'task',runId:'run',sessionId:'session'}
 let task=target?.taskId??null, allowed=true, running=fault==='alive'
 const identity={task_id:'task',task_run_id:'run',session_id:'session'}
 const deps={estateId:'estate',actor:{kind:'person',id:'operator'},hostInstanceId:'host',bootId:'boot',
 timeoutMs:200,samples:3,sampleIntervalMs:0,escalateAfterSample:1,
 guard:async()=>{calls.push('guard');return allowed&&fault!=='guard'},authority:()=>({personId:'person',revision:1}),
 lookup:async()=>{calls.push('lookup');if(fault==='lookup')throw Error('private lookup error');return target},
 localTask:()=>task,onState:s=>states.push(s),
 ptys:{get:()=>session,list:()=>session?[session]:[],haltInput:()=>calls.push('halt'),
 signalProcess:async(id,signal,stillAllowed)=>{assert.equal(id,'session');if(stillAllowed()){signals.push(signal);calls.push(signal)}},
 observeProcess:async()=>{calls.push('observe');if(fault==='observe')throw Error('private process error');return{
 rootExited:!running,processTreeQuiescent:!running&&fault!=='children',processIdentity:{pid:222,group:222,start:'today'},
 exitCode:fault==='malformed'?null:fault==='failed'?17:0,exitSignal:fault==='signal'?15:null}},
 ensureClosedReceipt:async()=>{calls.push('closed');return fault!=='closed'}},
 revoke:async()=>{calls.push('revoke');return{revoked:fault!=='revoke',evidenceRef:'revoke:session'}},
 finalizeTranscript:async()=>{calls.push('transcript');return{committed:fault!=='transcript',evidenceRef:'transcript:session'}},
 provider:{observe:async()=>{calls.push('provider');return{quiescent:fault!=='provider',evidenceRef:'provider:session'}}},
 db:{rpc:async(name,args)=>{
 calls.push(name)
 if(name==='request_task_run_stop'){
  commands.push(args.p_command_id);canonical??={id:'canonical',reason:args.p_reason}
  if(requestLost){requestLost=false;throw Error('lost request')}
  if(fault==='refused')return{data:{requested:false}}
  return{data:{requested:true,...identity,session_id:fault==='foreign-receipt'?'foreign':'session',command_id:canonical.id,
   receipt_seq:stopped?2:1,state:stopped?'stopped':'requested',reason:canonical.reason,basis:stopped?'observed':null}}
 }
 assert.equal(name,'record_task_run_stop_observation');assert.equal(args.p_command_id,canonical.id)
 observation=args.p_observation
 const complete=['rootExited','processTreeQuiescent','providerQuiescent','authorityRevoked','transcriptCommitted'].every(k=>observation[k]===true)&&
  ['hostInstanceId','bootId','processIdentityRef','providerObservationRef','authorityRevocationRef','transcriptRef'].every(k=>typeof observation[k]==='string'&&observation[k])
 stopped=complete
 if(recordLost){recordLost=false;throw Error('lost record')}
 return{data:{recorded:true,...identity,command_id:canonical.id,receipt_seq:2,state:stopped?'stopped':'outcome_unknown',basis:stopped?'observed':null}}
 }}}
 return{deps,calls,states,commands,signals,get observation(){return observation},set target(v){target=v},set task(v){task=v},set session(v){session=v},set allowed(v){allowed=v},set running(v){running=v}}
}
for(const fault of ['','guard','lookup','refused','foreign-receipt','request-lost','record-lost','observe','children','provider','closed','revoke','transcript']) {
 const f=fixture(fault),runtime=createNativeStopRuntime(f.deps)
 const promise=runtime.stop('session');assert.equal(f.states[0].state,'requested','requested state precedes first async lookup')
 const result=await promise
 assert.equal(result.state,fault===''?'stopped':['guard','refused'].includes(fault)?'refused':'outcome_unknown',fault)
 if(['guard','lookup','refused','foreign-receipt','request-lost'].includes(fault))assert.equal(f.signals.length,0,fault+' cannot signal')
 if(['guard','lookup'].includes(fault))assert.equal(f.calls.includes('halt'),true,'local input halts even while authoritative reads fail')
 if(['closed','observe'].includes(fault))assert.equal(f.calls.includes('transcript'),false,'transcript cannot precede closed receipt')
 if(fault===''){
  assert.equal(result.managed,true);assert.equal(result.runId,'run');assert.equal(result.basis,'observed')
  assert(f.calls.indexOf('closed')<f.calls.indexOf('transcript'))
  assert(f.calls.indexOf('transcript')<f.calls.indexOf('record_task_run_stop_observation'))
  assert.match(f.observation.processIdentityRef,/^process:[a-f0-9]{64}$/)
 }
 if(fault==='request-lost'){
  const retry=await runtime.stop('session','natural_exit');assert.equal(retry.state,'stopped')
  assert.equal(f.commands[0],f.commands[1]);assert.equal(f.observation.outcome,'cancelled')
 }
 if(fault==='record-lost'){
  const signals=f.signals.length;assert.equal((await runtime.stop('session')).state,'stopped');assert.equal(f.signals.length,signals)
 }
}
// Provider conformance is opt-in. No agent id grants proof by default.
{
 const f=fixture('shell');f.deps.timeoutMs=NaN;f.deps.samples=NaN
 assert.equal((await createNativeStopRuntime(f.deps).stop('session')).state,'stopped')
}
{
 const f=fixture('provider')
 f.deps.provider.requestStop=async(sessionId,command,allowed)=>{
  assert.equal(sessionId,'session');assert.equal(command.commandId,'canonical');assert.equal(command.reason,'operator_stop')
  assert(allowed());f.calls.push('provider_cancel')
 }
 assert.equal((await createNativeStopRuntime(f.deps).stop('session')).state,'outcome_unknown')
 assert(f.calls.indexOf('request_task_run_stop')<f.calls.indexOf('provider_cancel'))
 assert(f.calls.indexOf('provider_cancel')<f.calls.indexOf('SIGTERM'))
}
for(const optionId of ['claude-code','codex','unknown-provider']) {
 const f=fixture();delete f.deps.provider;f.session={sessionId:'session',optionId,startedAt:123}
 assert.equal((await createNativeStopRuntime(f.deps).stop('session')).state,'outcome_unknown')
 assert.equal(f.observation.providerQuiescent,false)
}
for(const fault of ['malformed','failed','signal','']) {
 const f=fixture(fault),result=await createNativeStopRuntime(f.deps).stop('session','natural_exit')
 assert.equal(result.state,fault==='malformed'?'outcome_unknown':'stopped',fault)
 if(fault==='malformed')assert.equal(f.observation,undefined,'no invented outcome is persisted')
 else assert.equal(f.observation.outcome,fault===''?'completed':'failed_known')
}
assert.equal(nativeExitOutcome(null),undefined)
assert.equal(nativeExitOutcome({rootExited:true,exitCode:0,exitSignal:'15'}),undefined)
for(const exitCode of [null,undefined,'0',NaN,-1,1.2])assert.equal(nativeExitOutcome({rootExited:true,exitCode,exitSignal:null}),undefined)
assert.equal(nativeExitOutcome({rootExited:false,exitCode:0,exitSignal:null}),undefined)
// A known local task with no DB row or conflicting identity never becomes shell.
for(const kind of ['missing','session','task','local']) {
 const f=fixture()
 if(kind==='missing')f.target=null
 if(kind==='session')f.target={taskId:'task',runId:'run',sessionId:'other'}
 if(kind==='task')f.target={taskId:'foreign',runId:'run',sessionId:'session'}
 if(kind==='local')f.session=null
 const r=await createNativeStopRuntime(f.deps).stop('session')
 assert.notEqual(r.state,'stopped');assert.equal(f.signals.length,0);assert.equal(f.calls.includes('request_task_run_stop'),false)
}
// The same session has one lookup/finalizer across callback, operator and shutdown.
{
 const f=fixture(),gate=deferred();f.deps.lookup=async()=>{f.calls.push('lookup');await gate.promise;return{taskId:'task',runId:'run',sessionId:'session'}}
 const runtime=createNativeStopRuntime(f.deps),a=runtime.stop('session'),b=runtime.stop('session','launch_failure')
 assert.equal(a,b);runtime.onExit('session');const shutdown=runtime.shutdown()
 await tick();assert(f.calls.indexOf('halt')<f.calls.indexOf('lookup'),'input closes before lookup resolves')
 gate.resolve();assert.equal((await a).state,'stopped');assert.equal((await shutdown)[0].state,'stopped')
 assert.equal(f.calls.filter(x=>x==='lookup').length,1);assert.equal(f.commands.length,1)
}
// A signal port invoking onExit must not await its own joined finalizer.
{
 const f=fixture();let runtime
 f.deps.ptys.signalProcess=async()=>{runtime.onExit('session');f.calls.push('signal-callback')}
 runtime=createNativeStopRuntime(f.deps)
 assert.equal((await runtime.stop('session')).state,'stopped');assert.equal(f.commands.length,1)
}
// Default stop stays TERM-only; Force is a fresh authorized attempt, not an upgrade.
{
 const f=fixture('alive'),runtime=createNativeStopRuntime(f.deps)
 const a=runtime.stop('session'),upgrade=runtime.stop('session','operator_stop',{force:true})
 assert.equal(a,upgrade);assert.equal((await a).state,'outcome_unknown');assert.deepEqual(f.signals,['SIGTERM'])
 f.allowed=false
 assert.equal((await runtime.stop('session','operator_stop',{force:true})).state,'refused');assert.equal(f.signals.includes('SIGKILL'),false)
 f.allowed=true
 assert.equal((await runtime.stop('session','operator_stop',{force:true})).state,'outcome_unknown');assert(f.signals.includes('SIGKILL'))
}
// A known unbound shell can stop physically, but receives no fabricated Run receipt.
{
 const f=fixture('shell'),r=await createNativeStopRuntime(f.deps).stop('session')
 assert.equal(r.state,'stopped');assert.equal(r.managed,false);assert.equal(r.commandId,undefined);assert.equal(r.runId,undefined);assert.equal(r.receiptSeq,undefined)
 assert.equal(f.commands.length,0)
}
{
 const f=fixture();f.target=null;f.task=null;delete f.deps.provider
 const r=await createNativeStopRuntime(f.deps).stop('session')
 assert.equal(r.state,'outcome_unknown');assert.equal(r.managed,false);assert.equal(r.reasonCode,'provider_termination_unproved')
 assert.deepEqual(f.signals,['SIGTERM']);assert.equal(f.commands.length,0)
}
// Free agent terminals use the same physical Stop without synthetic Run facts.
for(const optionId of ['claude-code','codex']) {
 const f=fixture();f.target=null;f.task=null;f.session={sessionId:'session',optionId,startedAt:'2026-09-27T12:00:00Z'};delete f.deps.provider
 const r=await createNativeStopRuntime(f.deps).stop('session')
 assert.equal(r.state,'outcome_unknown');assert.equal(r.runId,undefined);assert.equal(r.receiptSeq,undefined)
 assert.deepEqual(f.signals,['SIGTERM']);assert.equal(f.commands.length,0)
}
{
 const f=fixture('shell');f.running=true;const runtime=createNativeStopRuntime(f.deps)
 assert.equal((await runtime.stop('session')).state,'outcome_unknown');assert.deepEqual(f.signals,['SIGTERM'])
 assert.equal((await runtime.stop('session','operator_stop',{force:true})).state,'outcome_unknown');assert(f.signals.includes('SIGKILL'))
}
// Expiry depends on monotonic elapsed time, even when the event loop cannot
// deliver setTimeout while an ostensibly asynchronous port blocks synchronously.
{
 const f=fixture();f.deps.timeoutMs=5
 f.deps.lookup=async()=>{const until=performance.now()+20;while(performance.now()<until){};return{taskId:'task',runId:'run',sessionId:'session'}}
 const r=await createNativeStopRuntime(f.deps).stop('session')
 assert.equal(r.state,'outcome_unknown');assert.equal(r.reasonCode,'stop_deadline')
 assert.equal(f.calls.includes('guard'),false);assert.equal(f.signals.length,0);assert.equal(f.commands.length,0)
}
// Every asynchronous boundary is bounded; resolving after timeout cannot begin
// another Stop, send a late signal, persist a fabricated observation or transcript.
for(const boundary of ['lookup','guard','revoke','signal','observe','closed','transcript','provider','request']) {
 const f=fixture(),gate=deferred();f.deps.timeoutMs=10
 if(boundary==='lookup')f.deps.lookup=async()=>{await gate.promise;return{taskId:'task',runId:'run',sessionId:'session'}}
 if(boundary==='guard')f.deps.guard=async()=>{await gate.promise;return true}
 if(boundary==='revoke')f.deps.revoke=async()=>{await gate.promise;return{revoked:true,evidenceRef:'r'}}
 if(boundary==='signal')f.deps.ptys.signalProcess=async(_,signal,allowed)=>{await gate.promise;if(allowed())f.signals.push(signal)}
 if(boundary==='observe')f.deps.ptys.observeProcess=async()=>{await gate.promise;return{rootExited:true,processTreeQuiescent:true,exitCode:0}}
 if(boundary==='closed')f.deps.ptys.ensureClosedReceipt=async()=>{await gate.promise;return true}
 if(boundary==='transcript')f.deps.finalizeTranscript=async()=>{await gate.promise;return{committed:true,evidenceRef:'t'}}
 if(boundary==='provider')f.deps.provider.observe=async()=>{await gate.promise;return{quiescent:true,evidenceRef:'p'}}
 if(boundary==='request')f.deps.db.rpc=async()=>{await gate.promise;return{data:{requested:true}}}
 const runtime=createNativeStopRuntime(f.deps),r=await runtime.stop('session')
 assert.equal(r.state,'outcome_unknown',boundary)
 const signals=f.signals.length,calls=f.calls.length
 gate.resolve();await tick();await tick()
 assert.equal(f.signals.length,signals,boundary+' late signal');assert.equal(f.calls.length,calls,boundary+' late work')
 assert.equal(f.states.filter(s=>s.state!=='requested').length,1,boundary+' one terminal UI result')
}
// Session recycling while provider work awaits is not authority over its replacement.
{
 const f=fixture();f.deps.revoke=async()=>{f.session={sessionId:'session',optionId:'claude-code',startedAt:124};return{revoked:true,evidenceRef:'r'}}
 assert.equal((await createNativeStopRuntime(f.deps).stop('session')).state,'outcome_unknown');assert.equal(f.signals.length,0)
}
console.log('PASS native Stop runtime: real coordinator, exact target, callback coalescing, closed-before-transcript, conservative providers, honest outcomes, explicit Force, bounded late continuations, lost receipts')
