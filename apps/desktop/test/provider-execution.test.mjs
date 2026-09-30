import assert from 'node:assert/strict'
import { PROVIDER_LIMITS, validateProviderBinding, createProviderObservation, foldProviderObservation,
  reconnectProviderObservation, assessProviderQuiescence, validateProviderStopCommand, validateProviderResumeCommand,
  validateProviderRequestAck, validateProviderResumeAck } from '../src/shared/providerExecution.ts'
const digest='a'.repeat(64), policy='b'.repeat(64), ref=`sha256:${'c'.repeat(64)}`
const binding={schema:'ProviderExecution@1',fabric:{estateId:'estate',taskId:'task',runId:'run',sessionId:'fabric-session'},
 provider:{id:'codex-cli',build:'0.157.1',runtimeProfile:'owned-stdio'},
 native:{status:'observed',connectionId:'connection-1',sessionId:null,threadId:'thread-1',turnId:'turn-1'},execution:{kind:'native-turn',id:'turn-1'},manifestDigest:digest,policyDigest:policy}
const clone=v=>structuredClone(v)
function initial(b=binding){const r=createProviderObservation(b);assert.equal(r.ok,true);return r.value}
function event(state,type,extra={}){return{schema:'ProviderEvent@1',eventId:`event-${state.cursor+1}`,cursor:state.cursor+1,binding:state.binding,evidenceRef:ref,type,...extra}}
function apply(state,type,extra={}){const e=event(state,type,extra),r=foldProviderObservation(state,e);assert.equal(r.accepted,true,r.reasonCode);return r.state}
const inventory=(state,writers=[],patch={})=>event(state,'inventory',{writers,throughCursor:state.cursor,complete:true,admissionClosed:true,unknownWriters:false,...patch})
function proof(){let s=initial();s=apply(s,'turn_terminal',{outcome:'interrupted'});return foldProviderObservation(s,inventory(s)).state}
assert.equal(validateProviderBinding(binding).ok,true,'Codex sessionId absent is honest; thread and turn are required')
{
 const claude=clone(binding);claude.provider.id='claude-code';claude.native={status:'observed',connectionId:'connection-1',sessionId:'claude-session',threadId:null,turnId:null};claude.execution={kind:'host-request',id:'request-1'}
 assert.equal(validateProviderBinding(claude).ok,true)
 claude.native.sessionId=null;assert.equal(validateProviderBinding(claude).reasonCode,'claude_session_required')
}
for(const field of ['threadId','turnId']){const b=clone(binding);b.native[field]=null;assert.equal(validateProviderBinding(b).reasonCode,'codex_thread_turn_required')}
for(const key of ['password','token','rawTranscript','environment']){const b=clone(binding);b[key]='sensitive';assert.equal(validateProviderBinding(b).ok,false)}
for(const mutate of [b=>b.fabric.runId='',b=>b.fabric.sessionId='x'.repeat(129),b=>b.policyDigest='latest',b=>b.provider.runtimeProfile='assume-sandboxed',b=>b.native.connectionId='']) {
 const b=clone(binding);mutate(b);assert.equal(validateProviderBinding(b).ok,false)
}
{
 const b=clone(binding);b.native={status:'unknown',reason:'not_observed'}
 const s=initial(b);assert.equal(assessProviderQuiescence(s,0).reasonCode,'native_identity_unknown')
 assert.equal(foldProviderObservation(s,event(s,'turn_terminal',{outcome:'completed'})).reasonCode,'native_identity_unknown')
}
// JSON arrays and objects must never coerce into trusted enum values.
for (const mutate of [b=>b.provider.id=['codex-cli'],b=>b.provider.runtimeProfile=['owned-stdio'],
 b=>b.execution.kind=['native-turn'],b=>b.native={status:'unknown',reason:['not_observed']}]) {
 const b=clone(binding);mutate(b);assert.equal(validateProviderBinding(b).ok,false)
}
{
 const b=clone(binding);b.provider.id=['codex-cli'];b.native.threadId=null;b.native.turnId=null;b.execution={kind:'host-request',id:'request'}
 assert.equal(validateProviderBinding(b).ok,false,'coercion cannot bypass provider-specific identity')
 for(const [type,extra] of [['turn_terminal',{outcome:['completed']}],
  ['writer',{writer:{kind:['remote'],id:'writer',state:'terminal'}}],
  ['writer',{writer:{kind:'remote',id:'writer',state:['terminal']}}]]) {
  const s=initial(),rejected=foldProviderObservation(s,event(s,type,extra))
  assert.equal(rejected.accepted,false);assert.equal(rejected.state.fault!==null,true)
  assert.equal(foldProviderObservation(rejected.state,inventory(rejected.state)).accepted,false)
  assert.equal(assessProviderQuiescence(rejected.state,rejected.state.cursor).quiescent,false)
 }
 assert.equal(validateProviderStopCommand({commandId:'stop',issuedCursor:0,reason:['operator_stop']}).ok,false)
}
// A long-lived Claude session cannot reuse the prior request's completion.
{
 const first=clone(binding);first.provider.id='claude-code';first.native.sessionId='claude-session';first.native.threadId=null;first.native.turnId=null
 first.execution={kind:'host-request',id:'request-old'}
 const oldState=initial(first),oldCompletion=event(oldState,'turn_terminal',{outcome:'completed'})
 const second=clone(first);second.execution.id='request-current'
 const current=initial(second)
 assert.equal(foldProviderObservation(current,oldCompletion).reasonCode,'foreign_binding')
 assert.equal(assessProviderQuiescence(current,0).quiescent,false)
 assert.equal(reconnectProviderObservation(oldState,{...second,native:{...second.native,connectionId:'reconnected'}}).reasonCode,'foreign_binding')
 delete second.execution;assert.equal(validateProviderBinding(second).ok,false)
 const invented=clone(first);invented.execution.kind='native-turn'
 assert.equal(validateProviderBinding(invented).reasonCode,'request_epoch_required')
}
// Acknowledging cancellation and ending one turn never clears writer uncertainty.
{
 let s=initial();s=apply(s,'request_ack',{commandId:'stop-1'})
 assert.equal(assessProviderQuiescence(s,s.cursor).quiescent,false)
 s=apply(s,'turn_terminal',{outcome:'interrupted'})
 assert.equal(assessProviderQuiescence(s,s.cursor).reasonCode,'inventory_required')
 for(const kind of ['background','child','remote'])s=apply(s,'writer',{writer:{kind,id:kind,state:'active'}})
 s=foldProviderObservation(s,inventory(s,[...s.writers])).state
 assert.equal(assessProviderQuiescence(s,s.cursor).reasonCode,'writers_unresolved')
 for(const w of [...s.writers])s=apply(s,'writer',{writer:{...w,state:'terminal'}})
 s=foldProviderObservation(s,inventory(s,[...s.writers])).state
 assert.equal(assessProviderQuiescence(s,s.cursor).quiescent,true)
 assert.equal(assessProviderQuiescence(s,s.cursor-1).reasonCode,'cursor_mismatch')
 assert.equal(assessProviderQuiescence(s,s.cursor+1).reasonCode,'cursor_mismatch')
}
for(const patch of [{unknownWriters:true},{admissionClosed:false}]){
 let s=initial();s=apply(s,'turn_terminal',{outcome:'completed'});s=foldProviderObservation(s,inventory(s,[],patch)).state
 assert.equal(assessProviderQuiescence(s,s.cursor).quiescent,false)
}
// Partial/paginated inventories and omissions do not silently lose known work.
{
 let s=initial();s=apply(s,'writer',{writer:{kind:'remote',id:'writer',state:'unknown'}})
 for(const [extra,reason] of [[{complete:false},'partial_inventory'],[{throughCursor:0},'inventory_watermark']]){
  const r=foldProviderObservation(s,inventory(s,[...s.writers],extra));assert.equal(r.reasonCode,reason);assert.equal(r.accepted,false)
  assert.equal(r.state.writers.length,1);assert.equal(assessProviderQuiescence(r.state,r.state.cursor).quiescent,false)
 }
 const omitted=foldProviderObservation(s,inventory(s,[]));assert.equal(omitted.reasonCode,'inventory_omits_writer')
 assert.equal(omitted.state.writers.length,1)
 const duplicate=foldProviderObservation(s,inventory(s,[s.writers[0],s.writers[0]]));assert.equal(duplicate.reasonCode,'duplicate_writer')
}
// Provider/profile/build, every Fabric id, and every native id scope the stream.
for(const path of [['fabric','estateId'],['fabric','taskId'],['fabric','runId'],['fabric','sessionId'],['provider','build'],['provider','runtimeProfile'],['native','connectionId'],['native','threadId'],['native','sessionId'],['execution','id']]){
 const s=initial(),e=event(s,'request_ack',{commandId:'stop'});e.binding=clone(e.binding)
 e.binding[path[0]][path[1]]=path[1]==='runtimeProfile'?'remote':'foreign'
 if(path[0]==='execution')e.binding.native.turnId='foreign'
 const r=foldProviderObservation(s,e);assert.equal(r.reasonCode,'foreign_binding');assert.equal(r.state,s)
}
// Exact replay is idempotent; changed reuse, out-of-order or lost events poison
// current proof instead of pretending an incomplete stream is authoritative.
{
 const s=initial(),e=event(s,'request_ack',{commandId:'stop'})
 const first=foldProviderObservation(s,e),repeat=foldProviderObservation(first.state,e)
 assert.equal(repeat.repeated,true);assert.equal(repeat.state,first.state)
 assert.equal(foldProviderObservation(first.state,{...e,commandId:'other'}).reasonCode,'event_id_conflict')
 assert.equal(foldProviderObservation(first.state,{...e,eventId:'new'}).reasonCode,'stale_cursor')
 assert.equal(foldProviderObservation(first.state,{...e,eventId:'new',cursor:3}).reasonCode,'cursor_gap')
 const proved=proof(),conflict=event(proved,'turn_terminal',{outcome:'failed'})
 assert.equal(foldProviderObservation(proved,conflict).reasonCode,'terminal_conflict')
}
{
 const s=proof(),e=event(s,'writer',{writer:{kind:'remote',id:'late',state:'active'}})
 const r=foldProviderObservation(s,e);assert.equal(r.reasonCode,'writer_after_closure')
 assert.equal(assessProviderQuiescence(r.state,r.state.cursor).reasonCode,'resync_required')
 const snapshot=foldProviderObservation(s,inventory(s,[e.writer]));assert.equal(snapshot.reasonCode,'scope_reopened')
 const reopened=foldProviderObservation(s,inventory(s,[],{admissionClosed:false}));assert.equal(reopened.reasonCode,'scope_reopened')
 assert.equal(foldProviderObservation(reopened.state,inventory(reopened.state,[])).reasonCode,'resync_required')
 const updated=apply(s,'writer',{writer:{kind:'child',id:'already-terminal',state:'terminal'}})
 assert.equal(foldProviderObservation(updated,event(updated,'writer',{writer:{kind:'remote',id:'late',state:'active'}})).reasonCode,'writer_after_closure','intervening writer event cannot erase closure fence')
 const leaked=event(s,'request_ack',{commandId:'stop'});leaked.token='not-a-real-secret'
 assert.equal(foldProviderObservation(s,leaked).accepted,false)
}
// Storage is explicitly bounded. No writer/event is evicted to manufacture an
// empty inventory, and sources cannot bypass bounds with oversized identifiers.
{
 let s=initial()
 for(let i=0;i<PROVIDER_LIMITS.writers;i++)s=apply(s,'writer',{writer:{kind:'background',id:`w-${i}`,state:'active'}})
 const r=foldProviderObservation(s,event(s,'writer',{writer:{kind:'remote',id:'overflow',state:'active'}}))
 assert.equal(r.reasonCode,'writer_limit');assert.equal(r.state.writers.length,PROVIDER_LIMITS.writers)
 assert.equal(foldProviderObservation(s,inventory(s,[...s.writers,{kind:'remote',id:'overflow',state:'active'}])).reasonCode,'writer_limit')
}
{
 let s=initial()
 for(let i=0;i<PROVIDER_LIMITS.events;i++)s=apply(s,'request_ack',{commandId:`command-${i}`})
 const r=foldProviderObservation(s,event(s,'request_ack',{commandId:'overflow'}))
 assert.equal(r.reasonCode,'event_limit');assert.equal(r.state.seen.length,PROVIDER_LIMITS.events)
}
// Reconnection preserves writer handles but invalidates terminal/inventory/load
// proofs; foreign run/build/turn cannot be smuggled through an epoch reset.
{
 let s=initial();s=apply(s,'writer',{writer:{kind:'child',id:'child',state:'terminal'}})
 s=apply(s,'load_ack',{manifestDigest:digest,policyDigest:policy});s=apply(s,'turn_terminal',{outcome:'interrupted'})
 s=foldProviderObservation(s,inventory(s,[...s.writers])).state
 assert.equal(assessProviderQuiescence(s,s.cursor).quiescent,true)
 assert.equal(reconnectProviderObservation(s,s.binding).reasonCode,'new_connection_required')
 const next=clone(s.binding);next.native.connectionId='connection-2'
 const reset=reconnectProviderObservation(s,next);assert.equal(reset.ok,true)
 let fresh=reset.value;assert.equal(fresh.cursor,0);assert.equal(fresh.load,null);assert.equal(fresh.writers[0].state,'unknown')
 assert.equal(assessProviderQuiescence(fresh,0).quiescent,false)
 assert.equal(foldProviderObservation(fresh,event(s,'turn_terminal',{outcome:'interrupted'})).reasonCode,'foreign_binding')
 fresh=apply(fresh,'turn_terminal',{outcome:'interrupted'})
 assert.equal(foldProviderObservation(fresh,inventory(fresh,[])).reasonCode,'inventory_omits_writer')
 fresh=foldProviderObservation(fresh,inventory(fresh,[{...fresh.writers[0],state:'terminal'}])).state
 assert.equal(assessProviderQuiescence(fresh,fresh.cursor).quiescent,true)
 const foreign=clone(next);foreign.fabric.runId='new-run';assert.equal(reconnectProviderObservation(s,foreign).reasonCode,'foreign_binding')
}
// Connection history never evicts an old epoch and enables its stale proofs.
{
 const original=proof(),next=clone(binding);next.native.connectionId='connection-2'
 let s=reconnectProviderObservation(original,next).value
 assert.equal(reconnectProviderObservation(s,binding).reasonCode,'retired_connection')
 for(let i=3;i<=PROVIDER_LIMITS.connections;i++) {
  const next=clone(binding);next.native.connectionId=`connection-${i}`
  const r=reconnectProviderObservation(s,next);assert.equal(r.ok,true);s=r.value
 }
 assert.equal(s.retiredConnections.length,PROVIDER_LIMITS.connections-1)
 assert.equal(Object.isFrozen(s.retiredConnections),true)
 const overflow=clone(binding);overflow.native.connectionId='connection-overflow'
 assert.equal(reconnectProviderObservation(s,overflow).reasonCode,'connection_limit')
 assert.equal(reconnectProviderObservation(s,binding).reasonCode,'retired_connection')
 assert.equal(foldProviderObservation(s,event(initial(),'turn_terminal',{outcome:'interrupted'})).reasonCode,'foreign_binding')
 assert.equal(assessProviderQuiescence(s,0).quiescent,false)
}
const command={commandId:'resume-1',issuedCursor:9,checkpointDigest:'d'.repeat(64)}
const ack={binding,commandId:command.commandId,cursor:10,checkpointDigest:command.checkpointDigest,restored:true,
 loadedManifestDigest:digest,loadedPolicyDigest:policy,evidenceRef:ref}
assert.equal(validateProviderResumeAck(binding,command,ack).ok,true)
for(const [patch,reason] of [[{commandId:'foreign'},'resume_target_mismatch'],[{checkpointDigest:'e'.repeat(64)},'resume_target_mismatch'],
 [{cursor:9},'stale_resume_ack'],[{restored:false},'restore_unproved'],[{loadedManifestDigest:'e'.repeat(64)},'load_digest_mismatch'],
 [{loadedPolicyDigest:'e'.repeat(64)},'load_digest_mismatch'],[{evidenceRef:'raw output'},'invalid_evidence']])
 assert.equal(validateProviderResumeAck(binding,command,{...ack,...patch}).reasonCode,reason)
const stop={commandId:'stop-1',issuedCursor:0,reason:'operator_stop'}
assert.equal(validateProviderStopCommand(stop).ok,true);assert.equal(validateProviderStopCommand({...stop,reason:'kill_everything'}).ok,false)
assert.equal(validateProviderResumeCommand(command).ok,true);assert.equal(validateProviderResumeCommand({...command,secret:'extra'}).ok,false)
const requested={binding,commandId:stop.commandId,accepted:true,evidenceRef:ref}
assert.equal(validateProviderRequestAck(binding,stop,requested).ok,true)
assert.equal(validateProviderRequestAck(binding,stop,{...requested,commandId:'other'}).reasonCode,'command_mismatch')
assert.equal(validateProviderResumeAck(binding,command,requested).reasonCode,'invalid_resume_ack','request ACK never proves restoration')
{
 let s=initial();const r=foldProviderObservation(s,event(s,'load_ack',{manifestDigest:digest,policyDigest:'e'.repeat(64)}))
 assert.equal(r.reasonCode,'load_digest_mismatch');assert.equal(r.state.load,null)
 s=apply(s,'request_ack',{commandId:'resume'});assert.equal(s.load,null,'accepted resume does not load new policy')
 assert.equal(Object.isFrozen(s.binding.native),true);assert.equal(Object.isFrozen(s.seen),true)
}
console.log('PASS provider execution contract: provider-specific identity, exact scope, monotonic bounded stream, exhaustive writer proof, epoch resync, immutable receipts, separate stop/restore/load evidence; no native conformance claimed')
