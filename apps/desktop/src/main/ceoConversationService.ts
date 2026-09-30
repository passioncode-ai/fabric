/** Electron-free CW-N1a core. No worker or production binding. SQL identity is
 * derived from trusted held authority; operator/agent inputs never supply it.
 * One main-process writer is required by localState CAS (not a host-wide lock). */
import { createHash,randomUUID } from 'node:crypto'
import { mkdirSync,lstatSync,readdirSync } from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { readLocal,writeLocal,type LocalFile,type LocalRead } from './localState.ts'
import { LOCAL_OPERATOR_PERSON } from './identity.ts'
import { canonicalCeoSend,historicalCeoSend,historicalCeoSendCanonical,prepareCeoSend,type CeoSend } from '../shared/ceoConversation.ts'
import { CEO_DRAFT_LIMITS,ceoId,ceoInt,ceoObject,ceoJson,prepareCeoDraft,parseCeoAccepted,ceoRefusal,emptyCeoDrafts,validateCeoDraftFile,
 type CeoDraft,type CeoDraftFile,type CeoIntent,type CeoAccepted } from '../shared/ceoConversationDraft.ts'
export interface CeoTrustedIdentity {estateId:string;personId:string;revision:number;actor:{kind:'person';id:string}}
interface AuthArgs {p_estate_id:string;p_person_id:string;p_revision:number}
interface Reply {data:unknown;error?:unknown}
type Fence=()=>boolean
type Rpc<A>=(args:A,stillAllowed:Fence)=>PromiseLike<Reply>
/** If a port delays its network write, it MUST check stillAllowed at that write.
 * SQL is still the transactional authority; timeout is never proof of no commit. */
export interface CeoConversationRpc {
 open:Rpc<AuthArgs&{p_actor:CeoTrustedIdentity['actor'];p_operation_id:string;p_conversation_id:string;p_subject_kind:string;p_subject_id:string}>
 send:Rpc<AuthArgs&{p_actor:CeoTrustedIdentity['actor'];p_envelope:CeoSend}>
 read:Rpc<AuthArgs&{p_conversation_id:string;p_after_ordinal:number;p_limit:number}>
 receipt:Rpc<AuthArgs&{p_conversation_id:string;p_operation_id:string}>
}
export interface CeoConversationDeps {rootDir:string;identity:{held():CeoTrustedIdentity|null;guard():PromiseLike<CeoTrustedIdentity|null>};rpc:CeoConversationRpc;online:()=>boolean;timeoutMs?:number}
export type CeoFailure={ok:false;state:'refused'|'commit_unknown';reason_code:string;conversation_id?:string;operation_id?:string}
export type CeoResult<T>={ok:true;state:'ready'|'saved_locally'|'accepted_pending';value:T;conversation_id?:string;operation_id?:string}|CeoFailure
interface Scope {identity:CeoTrustedIdentity;key:string;allowed:Fence;guard():Promise<void>;wait<T>(fn:()=>PromiseLike<T>):Promise<T>;close():void}
class Refused extends Error {readonly code:string;constructor(code:string){super(code);this.code=code}}
const digest=(e:string,u:string,p:CeoSend)=>createHash('sha256').update(canonicalCeoSend(e,u,p)).digest('hex')
const historicalDigest=(e:string,u:string,p:CeoSend)=>createHash('sha256').update(historicalCeoSendCanonical(e,u,p)).digest('hex')
const hash=/^[0-9a-f]{16}$/
const fail=(reason_code:string,conversation_id?:string,operation_id?:string,state:'refused'|'commit_unknown'='refused'):CeoFailure=>({ok:false,state,reason_code,...(ceoId(conversation_id)?{conversation_id}:{}),...(ceoId(operation_id)?{operation_id}:{})})
function identity(v:unknown):CeoTrustedIdentity|null {
 const p=ceoObject(v,['estateId','personId','revision','actor']);if(!p||!ceoId(p.estateId)||!ceoId(p.personId)||!ceoInt(p.revision)||p.revision<1)return null
 const a=ceoObject(p.actor,['kind','id']);if(!a||a.kind!=='person'||(a.id!==p.personId&&!(p.personId===LOCAL_OPERATOR_PERSON&&a.id==='operator')))return null
 // Preserve the actor already produced by the trusted identity port; never invent one here.
 return {estateId:p.estateId,personId:p.personId,revision:p.revision,actor:a as CeoTrustedIdentity['actor']}
}
const signature=(i:CeoTrustedIdentity)=>JSON.stringify(i)
const auth=(s:Scope):AuthArgs=>({p_estate_id:s.identity.estateId,p_person_id:s.identity.personId,p_revision:s.identity.revision})
function discardAsync(v:unknown):void {if(v instanceof Promise)void v.catch(()=>{/* malformed synchronous host port; no grant */})}
function currentIdentity(deps:CeoConversationDeps):CeoTrustedIdentity|null {const v=deps.identity.held();discardAsync(v);return identity(v)}
function scope(deps:CeoConversationDeps):Scope {
 const held=currentIdentity(deps);if(!held)throw new Refused('unavailable')
 const duration=deps.timeoutMs??10000;if(!Number.isSafeInteger(duration)||duration<1||duration>60000)throw new Refused('invalid_timeout')
 const deadline=performance.now()+duration;let expired=false,closed=false
 const allowed=()=>{
  if(closed||expired||performance.now()>=deadline){expired=true;return false}
  try{
   const now=currentIdentity(deps)
   // A synchronous identity port can consume the remaining budget at the write edge.
   if(closed||expired||performance.now()>=deadline){expired=true;return false}
   return !!now&&signature(now)===signature(held)
  }catch{/* Identity faults revoke the fence; the caller receives a fixed refusal, never private port errors. */return false}
 }
 const check=()=>{if(!allowed())throw new Refused(expired?'timeout':'authority_changed')}
 const wait=async<T>(fn:()=>PromiseLike<T>):Promise<T>=>{
  check();let timer:ReturnType<typeof setTimeout>|undefined
  try{
   const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(new Refused('timeout'))},Math.max(1,deadline-performance.now()))})
   const pending=Promise.resolve().then(()=>{check();return fn()})
   const value=await Promise.race([pending,timeout]);check();return value
  }finally{if(timer)clearTimeout(timer)}
 }
 const guard=async()=>{const current=identity(await wait(()=>deps.identity.guard()));check();if(!current||signature(current)!==signature(held))throw new Refused('authority_changed')}
 return {identity:held,key:`${held.estateId}/${held.personId}/${held.revision}`,allowed,guard,wait,close:()=>{closed=true}}
}
function directory(deps:CeoConversationDeps,s:Scope):string {
 if(!s.allowed())throw new Refused('authority_changed')
 const owner=process.getuid?.()
 let dir=path.join(deps.rootDir,'ceo-conversations')
 for(const part of ['',s.identity.estateId,s.identity.personId]){
  if(part)dir=path.join(dir,part)
  try{mkdirSync(dir,{mode:0o700})}catch(error){if((error as {code?:string}).code!=='EEXIST')throw new Refused('local_unavailable')}
  const st=lstatSync(dir);if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o777)!==0o700||(owner!==undefined&&st.uid!==owner))throw new Refused('unsafe_local_permissions')
 }
 let total=0;const files=readdirSync(dir)
 if(files.length>CEO_DRAFT_LIMITS.namespaceFiles)throw new Refused('local_capacity')
 for(const f of files){
  if(!/^drafts\.json(?:\.last-good|\.tmp(?:\.last-good)?|\.quarantined-[a-zA-Z0-9-]+)?$/.test(f))throw new Refused('unexpected_local_file')
  const st=lstatSync(path.join(dir,f));if(st.nlink!==1||!st.isFile()||st.isSymbolicLink()||(st.mode&0o777)!==0o600||(owner!==undefined&&st.uid!==owner))throw new Refused('unsafe_local_permissions')
  total+=st.size;if(st.size>CEO_DRAFT_LIMITS.bytes||total>CEO_DRAFT_LIMITS.namespaceBytes)throw new Refused('local_capacity')
 }
 return dir
}
function spec(deps:CeoConversationDeps,s:Scope):LocalFile<CeoDraftFile>{
 return {dir:directory(deps,s),file:'drafts.json',empty:emptyCeoDrafts(s.identity.estateId,s.identity.personId),validate:(v)=>{
  const p=validateCeoDraftFile(v);if(!p||p.estate_id!==s.identity.estateId||p.person_id!==s.identity.personId)return null
  for(const i of p.intents)if(i.receipt&&i.receipt.canonical_digest!==digest(p.estate_id,p.person_id,i.envelope))return null
  return p
 }}
}
function local(deps:CeoConversationDeps,s:Scope):LocalRead<CeoDraftFile>{const r=readLocal(spec(deps,s));if(r.status==='unreadable')throw new Refused('local_recovery_required');return r}
function save(deps:CeoConversationDeps,s:Scope,next:CeoDraftFile,revision:string):string {
 if(!s.allowed())throw new Refused('authority_changed')
 const st=spec(deps,s),candidate=st.validate(next);if(!candidate)throw new Refused('local_capacity_or_invalid')
 // Reserve both atomic-write phases, including live/last-good temporary files.
 // Quarantine is retained; a successful save must not make its next read refuse.
 const bytes=Buffer.byteLength(JSON.stringify(candidate,null,2)),sizes=new Map(readdirSync(st.dir).map(name=>[name,lstatSync(path.join(st.dir,name)).size]))
 const capacity=()=>{if(sizes.size>CEO_DRAFT_LIMITS.namespaceFiles||[...sizes.values()].reduce((n,size)=>n+size,0)>CEO_DRAFT_LIMITS.namespaceBytes)throw new Refused('local_capacity')}
 sizes.set('drafts.json.tmp',bytes);capacity();sizes.delete('drafts.json.tmp');sizes.set('drafts.json',bytes);capacity()
 sizes.set('drafts.json.tmp.last-good',bytes);capacity();sizes.delete('drafts.json.tmp.last-good');sizes.set('drafts.json.last-good',bytes);capacity()
 if(!s.allowed())throw new Refused('authority_changed')
 const result=writeLocal(st,next,revision)
 if(result.status==='conflict')throw new Refused('draft_conflict')
 if(result.status==='failed')throw new Refused('local_save_unknown')
 return result.revision
}
function matches(receipt:CeoAccepted,s:Scope,p:CeoSend):boolean{return receipt.conversation_id===p.conversation_id&&receipt.operation_id===p.operation_id&&receipt.message_id===p.message_id&&receipt.revision===p.expected_revision+1&&receipt.canonical_digest===digest(s.identity.estateId,s.identity.personId,p)}
function decoded(reply:Reply):unknown {
 const p=ceoObject(reply,['data','error'])??ceoObject(reply,['data']);if(!p)throw new Refused('invalid_response')
 if(p.error!==null&&p.error!==undefined)throw new Refused('rpc_unavailable');return ceoJson(p.data,4*1024*1024)
}
function refusal(value:unknown):string|null {const p=ceoObject(value,['ok','reason_code']);return p?.ok===false?(ceoRefusal(p.reason_code)??(p.reason_code==='not_found'?'not_found':null)):null}
function expectedRevision(r:LocalRead<CeoDraftFile>,expected:string|null):void {
 if(expected===null){if(r.status!=='default_missing')throw new Refused('draft_conflict')}
 else if(typeof expected!=='string'||!hash.test(expected)||expected!==r.revision)throw new Refused('draft_conflict')
}
export function createCeoConversationService(deps:CeoConversationDeps){
 const active=new Map<string,Promise<CeoResult<unknown>>>()
 let inFlight=0
 async function run<T>(cid:string|undefined,op:string|undefined,fn:(s:Scope)=>Promise<CeoResult<T>>):Promise<CeoResult<T>>{
  if(inFlight>=CEO_DRAFT_LIMITS.inFlight)return fail('busy',cid,op)
  inFlight++
  let s:Scope|undefined;try{s=scope(deps);await s.guard();const result=await fn(s);if(result.ok&&!s.allowed())return fail(result.state==='saved_locally'?'local_save_unknown':'completion_unavailable',cid,op,result.state==='accepted_pending'?'commit_unknown':'refused');return result}catch(e){/* The result is the observable typed failure; raw private filesystem/port diagnostics must not enter ops logs. */return fail(e instanceof Refused?e.code:'invalid_response',cid,op)}finally{s?.close();inFlight--}
 }
 async function rpc<T>(s:Scope,fn:()=>PromiseLike<Reply>,parse:(v:unknown)=>T):Promise<T>{
  await s.guard();const reply=await s.wait(fn);await s.guard();return parse(decoded(reply))
 }
 function view(r:LocalRead<CeoDraftFile>,cid:string){return {revision:r.revision,local_status:r.status,draft:r.value.drafts.find(d=>d.conversation_id===cid)??null,intents:r.value.intents.filter(i=>i.conversation_id===cid)}}
 async function readDraft(conversationId:string){return run(conversationId,undefined,async s=>{
  if(!ceoId(conversationId))throw new Refused('invalid_input');const r=local(deps,s)
  return {ok:true,state:'ready',conversation_id:conversationId,value:view(r,conversationId)}
 })}
 async function saveDraft(conversationId:string,expectedLocalRevision:string|null,input:unknown){
  let snapshot:unknown;try{snapshot=ceoJson(input,65536)}catch{/* Malformed input is returned as a fixed refusal; do not log the private draft. */return fail('invalid_input',conversationId)}
  return run(conversationId,undefined,async s=>{
  if(!ceoId(conversationId))throw new Refused('invalid_input')
  const p=ceoObject(snapshot,['text','context','expected_revision','subject_revision']);if(!p)throw new Refused('invalid_input')
  const r=local(deps,s);expectedRevision(r,expectedLocalRevision)
  const version=randomUUID() // Never reuse an edit identity after an accepted draft was removed.
  const draft=prepareCeoDraft({conversation_id:conversationId,version,...p});if(!draft)throw new Refused('invalid_input')
  const next={...r.value,drafts:[...r.value.drafts.filter(d=>d.conversation_id!==conversationId),draft]}
  const revision=save(deps,s,next,r.revision)
  return {ok:true,state:'saved_locally',conversation_id:conversationId,value:{revision,draft,local_status:'ready'}}
 })}
 async function freezeSend(conversationId:string,expectedLocalRevision:string,input:{operationId:string;messageId:string}){
  let snapshot:unknown;try{snapshot=ceoJson(input,1024)}catch{/* Malformed input is returned as a fixed refusal; do not log the private draft. */return fail('invalid_input',conversationId)}
  return run(conversationId,undefined,async s=>{
  const p=ceoObject(snapshot,['operationId','messageId']);if(!p||!ceoId(conversationId)||!ceoId(p.operationId)||!ceoId(p.messageId))throw new Refused('invalid_input')
  const r=local(deps,s);expectedRevision(r,expectedLocalRevision)
  const old=r.value.intents.find(i=>i.operation_id===p.operationId)
  if(old){if(old.conversation_id!==conversationId||old.envelope.message_id!==p.messageId||r.value.drafts.some(d=>d.conversation_id===conversationId&&d.version!==old.draft_version))throw new Refused('idempotency_conflict');return {ok:true,state:old.status==='accepted_pending'?'accepted_pending':'saved_locally',conversation_id:conversationId,operation_id:p.operationId,value:{revision:r.revision,intent:old}}}
  if(r.value.intents.some(i=>i.conversation_id===conversationId&&(i.status==='saved_locally'||i.status==='commit_unknown')))throw new Refused('unresolved_send')
  const d=r.value.drafts.find(d=>d.conversation_id===conversationId);if(!d)throw new Refused('missing_draft')
  const prepared=prepareCeoSend({schema:'CeoSend@1',operation_id:p.operationId,message_id:p.messageId,conversation_id:conversationId,
   expected_revision:d.expected_revision,subject_revision:d.subject_revision,input_channel:'text',text:d.text,preparation_version:'har06-ceo-v1',context:d.context})
  if(!prepared.ok)throw new Refused(prepared.reason_code)
  const intent:CeoIntent={conversation_id:conversationId,operation_id:p.operationId,draft_version:d.version,envelope:prepared.value,status:'saved_locally',attempts:0,receipt:null,reason_code:null}
  const revision=save(deps,s,{...r.value,intents:[...r.value.intents,intent]},r.revision)
  return {ok:true,state:'saved_locally',conversation_id:conversationId,operation_id:p.operationId,value:{revision,intent}}
 })}
 function updateIntent(s:Scope,original:CeoIntent,change:Partial<CeoIntent>,clear:boolean):string {
  const r=local(deps,s),current=r.value.intents.find(i=>i.operation_id===original.operation_id)
  if(!current||canonicalCeoSend(s.identity.estateId,s.identity.personId,current.envelope)!==canonicalCeoSend(s.identity.estateId,s.identity.personId,original.envelope))throw new Refused('intent_changed')
  // Concurrent receipt/retry must never downgrade an accepted result.
  if(current.status==='accepted_pending'){
   if(change.status!=='accepted_pending')throw new Refused('attempt_superseded')
   if(change.receipt&&current.receipt&&(change.receipt.request_id!==current.receipt.request_id||change.receipt.receipt_seq!==current.receipt.receipt_seq||change.receipt.canonical_digest!==current.receipt.canonical_digest))throw new Refused('conflicting_receipt')
  }
  // A late first-attempt refusal says nothing about a later attempt. Starting
  // a request must also consume the current local attempt, not an old snapshot.
  if(change.status!=='accepted_pending'&&(current.attempts!==original.attempts||current.status!==original.status))throw new Refused('attempt_superseded')
  const intents=r.value.intents.map(i=>i===current?{...i,...change,attempts:Math.max(i.attempts,change.attempts??0)}:i)
  const drafts=r.value.drafts.filter(d=>!(clear&&d.conversation_id===original.conversation_id&&d.version===original.draft_version))
  return save(deps,s,{...r.value,intents,drafts},r.revision)
 }
 async function perform(conversationId:string,operationId:string,mode:'send'|'reconcile'|'retry'):Promise<CeoResult<unknown>>{
  return run<unknown>(conversationId,operationId,async s=>{
   if(!ceoId(conversationId)||!ceoId(operationId))throw new Refused('invalid_input')
   const r=local(deps,s),i=r.value.intents.find(x=>x.conversation_id===conversationId&&x.operation_id===operationId)
   if(!i)throw new Refused('missing_intent')
   if(i.status==='accepted_pending')return {ok:true,state:'accepted_pending',conversation_id:conversationId,operation_id:operationId,value:{receipt:i.receipt,revision:r.revision}}
   if(i.status==='refused')return fail(i.reason_code??'unavailable',conversationId,operationId)
   const willSend=mode==='retry'||(mode==='send'&&i.status==='saved_locally')
   const online=deps.online();discardAsync(online)
   if(online!==true)return i.status==='commit_unknown'?fail('offline',conversationId,operationId,'commit_unknown'):{ok:true,state:'saved_locally',conversation_id:conversationId,operation_id:operationId,value:{revision:r.revision,intent:i}}
   let attempted=i
   if(willSend){
    if(i.attempts>=CEO_DRAFT_LIMITS.attempts)return fail('retry_limit',conversationId,operationId,'commit_unknown')
    await s.guard();attempted={...i,status:'commit_unknown',attempts:i.attempts+1}
    updateIntent(s,i,{status:'commit_unknown',attempts:attempted.attempts},false)
   }
   try{
    const value=await rpc(s,()=>willSend?deps.rpc.send({...auth(s),p_actor:s.identity.actor,p_envelope:structuredClone(i.envelope)},s.allowed):deps.rpc.receipt({...auth(s),p_conversation_id:conversationId,p_operation_id:operationId},s.allowed),v=>v)
    const accepted=parseCeoAccepted(value)
    if(accepted){if(!matches(accepted,s,i.envelope))throw new Refused('invalid_receipt')
     const revision=updateIntent(s,attempted,{status:'accepted_pending',attempts:Math.max(1,attempted.attempts),receipt:accepted,reason_code:null},true)
     return {ok:true,state:'accepted_pending',conversation_id:conversationId,operation_id:operationId,value:{receipt:accepted,revision}}
    }
    const reason=refusal(value);if(!reason)throw new Refused('invalid_response')
    if(reason==='not_found')return fail('receipt_not_found',conversationId,operationId,'commit_unknown')
    // A refusal to a retry cannot prove an earlier lost attempt did not commit.
    if(reason==='unavailable'||attempted.attempts>1||!willSend)return fail(reason,conversationId,operationId,'commit_unknown')
    updateIntent(s,attempted,{status:'refused',reason_code:reason},false)
    return fail(reason,conversationId,operationId)
   }catch(e){/* Preserve the durable intent and return uncertainty; raw transport errors may include private request content. */return fail(e instanceof Refused?e.code:'rpc_unavailable',conversationId,operationId,'commit_unknown')}
  })
 }
 function joined(cid:string,op:string,mode:'send'|'reconcile'|'retry'){
  if(!ceoId(cid)||!ceoId(op))return Promise.resolve(fail('invalid_input'))
  let key:string;try{const i=currentIdentity(deps);if(!i)return Promise.resolve(fail('unavailable',cid,op));key=`${signature(i)}/${cid}/${op}`}catch{/* No current authority: return unavailable without retaining private identity-port diagnostics. */return Promise.resolve(fail('unavailable',cid,op))}
  const pending=active.get(key);if(pending)return pending
  if(active.size>=CEO_DRAFT_LIMITS.inFlight)return Promise.resolve(fail('busy',cid,op))
  const result=perform(cid,op,mode).finally(()=>{if(active.get(key)===result)active.delete(key)})
  active.set(key,result);return result
 }
 async function forgetSettled(conversationId:string,operationId:string,expectedLocalRevision:string){return run(conversationId,operationId,async s=>{
  if(!ceoId(conversationId)||!ceoId(operationId))throw new Refused('invalid_input')
  const r=local(deps,s);expectedRevision(r,expectedLocalRevision);const i=r.value.intents.find(x=>x.conversation_id===conversationId&&x.operation_id===operationId)
  if(!i||!['accepted_pending','refused'].includes(i.status))throw new Refused('unresolved_send')
  const revision=save(deps,s,{...r.value,intents:r.value.intents.filter(x=>x!==i)},r.revision)
  return {ok:true,state:'saved_locally',conversation_id:conversationId,operation_id:operationId,value:{revision}}
 })}
 /** The local history and cleanup list (C3): this Person's kept drafts and sends, each with what it
  * allows, from the local files alone. An unreadable namespace is local_recovery_required, never
  * empty. A draft behind an unresolved send cannot be discarded; a saved send can be sent, an
  * unknown one must be reconciled, and only a settled one can be forgotten. */
 async function inventory(){return run(undefined,undefined,async s=>{
  const r=local(deps,s)
  const unresolved=new Set(r.value.intents.filter(i=>i.status==='saved_locally'||i.status==='commit_unknown').map(i=>i.conversation_id))
  const preview=(t:string)=>[...t].slice(0,80).join('')
  const drafts=[...r.value.drafts].sort((a,b)=>a.conversation_id<b.conversation_id?-1:a.conversation_id>b.conversation_id?1:0).map(d=>{
   const blockedBy=unresolved.has(d.conversation_id)?'unresolved_send' as const:null
   return {conversation_id:d.conversation_id,preview:preview(d.text),blockedBy,actions:blockedBy?[]:['discard']}
  })
  const sends=r.value.intents.map(i=>({conversation_id:i.conversation_id,operation_id:i.operation_id,status:i.status,
   actions:i.status==='saved_locally'?['send']:i.status==='commit_unknown'?['reconcile']:['forget']}))
  const open=[...unresolved].length
  return {ok:true,state:'ready',value:{revision:r.revision,local_status:r.status,drafts,sends,
   capacity:{drafts:r.value.drafts.length,draftLimit:CEO_DRAFT_LIMITS.records,unresolved:open,unresolvedLimit:CEO_DRAFT_LIMITS.unresolved,
    full:r.value.drafts.length>=CEO_DRAFT_LIMITS.records||open>=CEO_DRAFT_LIMITS.unresolved}}}
 })}
 /** Explicit local cleanup. Unresolved sends retain their frozen input and IDs. */
 async function discardDraft(conversationId:string,expectedLocalRevision:string){return run(conversationId,undefined,async s=>{
  if(!ceoId(conversationId))throw new Refused('invalid_input')
  const r=local(deps,s);expectedRevision(r,expectedLocalRevision)
  if(r.value.intents.some(i=>i.conversation_id===conversationId&&(i.status==='saved_locally'||i.status==='commit_unknown')))throw new Refused('unresolved_send')
  const revision=save(deps,s,{...r.value,drafts:r.value.drafts.filter(d=>d.conversation_id!==conversationId)},r.revision)
  return {ok:true,state:'saved_locally',conversation_id:conversationId,value:{revision}}
 })}
 async function open(input:{operationId:string;conversationId:string;subjectKind:'global'|'project'|'question';subjectId:string}){
  let snapshot:unknown;try{snapshot=ceoJson(input,1024)}catch{/* Fixed validation response is sufficient; raw input must not be copied to diagnostics. */return fail('invalid_input')}
  return run(undefined,undefined,async s=>{
  const p=ceoObject(snapshot,['operationId','conversationId','subjectKind','subjectId'])
  if(!p||!ceoId(p.operationId)||!ceoId(p.conversationId)||!ceoId(p.subjectId)||!['global','project','question'].includes(p.subjectKind as string)||(p.subjectKind==='global'&&p.subjectId!==p.conversationId))throw new Refused('invalid_input')
  let result:Record<string,unknown>
  try{result=await rpc(s,()=>deps.rpc.open({...auth(s),p_actor:s.identity.actor,p_operation_id:p.operationId as string,p_conversation_id:p.conversationId as string,p_subject_kind:p.subjectKind as string,p_subject_id:p.subjectId as string},s.allowed),value=>{
   const no=refusal(value);if(no)throw new Refused(no)
   const q=ceoObject(value,['ok','conversation_id','revision','receipt_seq','repeated'])
   if(!q||q.ok!==true||!ceoId(q.conversation_id)||!ceoInt(q.revision)||!ceoInt(q.receipt_seq)||q.receipt_seq<1||typeof q.repeated!=='boolean'||(p.subjectKind==='global'&&q.conversation_id!==p.conversationId))throw new Refused('invalid_response')
   return q
  })
  }catch(e){/* Return the fixed error and original valid IDs for reconciliation; never log raw private RPC data. */const code=e instanceof Refused?e.code:'rpc_unavailable';return fail(code,p.conversationId as string,p.operationId as string,ceoRefusal(code)?'refused':'commit_unknown')}
  return {ok:true,state:'ready',conversation_id:result.conversation_id as string,value:result}
 })}
 async function read(conversationId:string,afterOrdinal=0,limit=50){return run(conversationId,undefined,async s=>{
  if(!ceoId(conversationId)||!ceoInt(afterOrdinal)||!ceoInt(limit)||limit<1||limit>50)throw new Refused('invalid_input')
  const result=await rpc(s,()=>deps.rpc.read({...auth(s),p_conversation_id:conversationId,p_after_ordinal:afterOrdinal,p_limit:limit},s.allowed),value=>{
   const no=refusal(value);if(no)throw new Refused(no)
   const absent=ceoObject(value,['ok','reason_code','content_state']);if(absent?.ok===false&&absent.reason_code==='unavailable'&&absent.content_state==='unavailable')throw new Refused('unavailable')
   const q=ceoObject(value,['ok','conversation_id','revision','subject','messages','next_ordinal'])
   if(!q||q.ok!==true||q.conversation_id!==conversationId||!ceoInt(q.revision)||!Array.isArray(q.messages)||q.messages.length>limit)throw new Refused('invalid_response')
   const subject=ceoObject(q.subject,['kind','id','owner_project_id','current']);if(!subject||!['global','project','question'].includes(subject.kind as string)||!ceoId(subject.id)||(subject.owner_project_id!==null&&!ceoId(subject.owner_project_id)))throw new Refused('invalid_response')
   if(subject.kind==='global'&&(subject.id!==conversationId||subject.owner_project_id!==null)||subject.kind==='project'&&subject.id!==subject.owner_project_id)throw new Refused('invalid_response')
   if(subject.current!==null){
    const cur=ceoObject(subject.current,subject.kind==='global'?['revision','project_id','active']:['revision','project_id','active','status'])
    if(!cur||!ceoInt(cur.revision)||cur.project_id!==subject.owner_project_id||typeof cur.active!=='boolean'||subject.kind!=='global'&&!['active','archived','open','answered','withdrawn','stale'].includes(cur.status as string))throw new Refused('invalid_response')
   }
   let ordinal=afterOrdinal;const ids=new Set<string>(),requests=new Set<string>()
   for(const raw of q.messages){
    const m=ceoObject(raw,['message_id','ordinal','request_id','receipt_seq','content_state','envelope','canonical_digest','dispatch'])
    if(!m||!ceoId(m.message_id)||ids.has(m.message_id)||!ceoId(m.request_id)||requests.has(m.request_id)||!ceoInt(m.ordinal)||m.ordinal!==ordinal+1||m.ordinal>q.revision||!ceoInt(m.receipt_seq)||m.receipt_seq<1||m.dispatch!=='unavailable')throw new Refused('invalid_response')
    ids.add(m.message_id);requests.add(m.request_id);ordinal=m.ordinal
    if(m.content_state==='unavailable'){if(m.envelope!==null||m.canonical_digest!==null)throw new Refused('invalid_response')}
    else if(m.content_state==='available'){
     // Stored history is checked as history (CO-172): migration 64's rules and its digest, text untouched.
     const p=historicalCeoSend(m.envelope);if(!p.ok||p.value.conversation_id!==conversationId||p.value.message_id!==m.message_id||p.value.expected_revision+1!==m.ordinal||m.canonical_digest!==historicalDigest(s.identity.estateId,s.identity.personId,p.value))throw new Refused('invalid_response')
    }else throw new Refused('invalid_response')
   }
   if(ordinal<q.revision){if(q.messages.length!==limit||q.next_ordinal!==ordinal)throw new Refused('invalid_response')}
   else if(q.next_ordinal!==null)throw new Refused('invalid_response')
   return q
  })
  return {ok:true,state:'ready',conversation_id:conversationId,value:result}
 })}
 return {open,read,readDraft,saveDraft,freezeSend,forgetSettled,discardDraft,inventory,send:(c:string,o:string)=>joined(c,o,'send'),reconcile:(c:string,o:string)=>joined(c,o,'reconcile'),retrySavedInput:(c:string,o:string)=>joined(c,o,'retry')}
}
