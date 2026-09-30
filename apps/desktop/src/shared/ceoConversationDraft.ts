/** Bounded local recovery data, never the authoritative conversation history. */
import { prepareCeoSend, type CeoSend, type CeoContext } from './ceoConversation.ts'
import { prepareOriginalInstruction } from './commandIngress.ts'
export const CEO_DRAFT_LIMITS = Object.freeze({ records:32, intents:32, inFlight:32, unresolved:8, bytes:4*1024*1024, attempts:3, namespaceFiles:8, namespaceBytes:16*1024*1024 })
export const ceoId=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
export const ceoInt=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0
export function ceoObject(v:unknown,keys:string[]):Record<string,unknown>|null {
 if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return null
 const ds=Object.getOwnPropertyDescriptors(v)
 if(Reflect.ownKeys(ds).length!==keys.length||keys.some(k=>!Object.hasOwn(ds,k)||!('value'in ds[k])||!ds[k].enumerable))return null
 return Object.fromEntries(keys.map(k=>[k,ds[k].value]))
}
/** Descriptor-only bounded copy for decoded IPC/JSON objects. Proxy traps remain
 * outside this contract; production IPC must supply structured-cloned JSON. */
export function ceoJson(input:unknown,maxBytes=4*1024*1024):unknown {
 let nodes=0,bytes=0;const seen=new Set<object>()
 const visit=(v:unknown,depth:number):unknown=>{
  if(++nodes>8192||depth>8)throw new Error('invalid_input')
  if(v===null||typeof v==='boolean')return v
  if(typeof v==='string'){bytes+=new TextEncoder().encode(v).length;if(bytes>maxBytes||v.length>65536)throw new Error('invalid_input');return v}
  if(typeof v==='number'&&Number.isSafeInteger(v))return v
  if(!v||typeof v!=='object'||seen.has(v))throw new Error('invalid_input')
  seen.add(v);const ds=Object.getOwnPropertyDescriptors(v);let out:unknown
  if(Array.isArray(v)){
   const length=ds.length?.value;if(!Number.isSafeInteger(length)||length>64||Reflect.ownKeys(ds).length!==length+1)throw new Error('invalid_input')
   out=Array.from({length},(_,i)=>{const d=ds[String(i)];if(!d||!('value'in d)||!d.enumerable)throw new Error('invalid_input');return visit(d.value,depth+1)})
  }else{
   if(![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(ds).length>32)throw new Error('invalid_input')
   const pairs=Reflect.ownKeys(ds).map(k=>{const d=typeof k==='string'?ds[k]:null;if(!d||!('value'in d)||!d.enumerable)throw new Error('invalid_input');return [k,visit(d.value,depth+1)]})
   out=Object.fromEntries(pairs)
  }
  seen.delete(v);return out
 }
 const out=visit(input,0);if(new TextEncoder().encode(JSON.stringify(out)).length>maxBytes)throw new Error('invalid_input');return out
}
export interface CeoDraft {conversation_id:string;version:string;text:string;context:CeoContext;expected_revision:number;subject_revision:number}
export interface CeoAccepted {ok:true;conversation_id:string;operation_id:string;message_id:string;request_id:string;revision:number;receipt_seq:number;canonical_digest:string;state:'accepted_pending';dispatch:'unavailable';repeated:boolean}
export interface CeoIntent {conversation_id:string;operation_id:string;draft_version:string;envelope:CeoSend;status:'saved_locally'|'commit_unknown'|'accepted_pending'|'refused';attempts:number;receipt:CeoAccepted|null;reason_code:string|null}
export interface CeoDraftFile {schema:'CeoDraftFile@1';estate_id:string;person_id:string;drafts:CeoDraft[];intents:CeoIntent[]}
export const emptyCeoDrafts=(estate_id:string,person_id:string):CeoDraftFile=>({schema:'CeoDraftFile@1',estate_id,person_id,drafts:[],intents:[]})
const synthetic='00000000-0000-4000-8000-000000000000'
export function prepareCeoDraft(v:unknown):CeoDraft|null {
 const p=ceoObject(v,['conversation_id','version','text','context','expected_revision','subject_revision'])
 if(!p||!ceoId(p.conversation_id)||!ceoId(p.version)||typeof p.text!=='string'||p.text.includes('\0')||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(p.text)||new TextEncoder().encode(p.text).length>32768)return null
 // Empty composer text is valid local state, but never a sendable instruction.
 const clean=p.text.trim()?prepareOriginalInstruction(p.text):{state:'prepared' as const,value:p.text};if(clean.state!=='prepared')return null
 const test=prepareCeoSend({schema:'CeoSend@1',operation_id:synthetic,message_id:synthetic,conversation_id:p.conversation_id,
  expected_revision:p.expected_revision,subject_revision:p.subject_revision,input_channel:'text',text:p.text.trim()?p.text:'draft',preparation_version:'har06-ceo-v1',context:p.context})
 if(!test.ok)return null
 const result={conversation_id:p.conversation_id,version:p.version,text:clean.value,context:test.value.context,expected_revision:test.value.expected_revision,subject_revision:test.value.subject_revision}
 if(new TextEncoder().encode(JSON.stringify(result)).length>65536)return null
 return result
}
export function parseCeoAccepted(v:unknown):CeoAccepted|null {
 const p=ceoObject(v,['ok','conversation_id','operation_id','message_id','request_id','revision','receipt_seq','canonical_digest','state','dispatch','repeated'])
 if(!p||p.ok!==true||!['conversation_id','operation_id','message_id','request_id'].every(k=>ceoId(p[k]))||!ceoInt(p.revision)||p.revision<1||!ceoInt(p.receipt_seq)||p.receipt_seq<1||typeof p.canonical_digest!=='string'||!/^[0-9a-f]{64}$/.test(p.canonical_digest)||p.state!=='accepted_pending'||p.dispatch!=='unavailable'||typeof p.repeated!=='boolean')return null
 return p as unknown as CeoAccepted
}
const reasons=new Set(['unavailable','stale_revision','idempotency_conflict','unsupported_context','invalid_input','too_large','invalid_boundary','identity_conflict','capacity_exceeded'])
export const ceoRefusal=(v:unknown):string|null=>typeof v==='string'&&reasons.has(v)?v:null
/** Input is JSON decoded by localState. Reject stale/unprepared bytes, never
 * sanitize a stored frozen message into a new meaning during recovery. */
export function validateCeoDraftFile(v:unknown):CeoDraftFile|null {
 let snapshot:unknown;try{snapshot=ceoJson(v)}catch{return null}
 const p=ceoObject(snapshot,['schema','estate_id','person_id','drafts','intents'])
 if(!p||p.schema!=='CeoDraftFile@1'||!ceoId(p.estate_id)||!ceoId(p.person_id)||!Array.isArray(p.drafts)||!Array.isArray(p.intents)||p.drafts.length>CEO_DRAFT_LIMITS.records||p.intents.length>CEO_DRAFT_LIMITS.intents)return null
 const drafts:CeoDraft[]=[],intents:CeoIntent[]=[]
 for(const raw of p.drafts){const d=prepareCeoDraft(raw);if(!d||JSON.stringify(d)!==JSON.stringify(raw)||drafts.some(x=>x.conversation_id===d.conversation_id))return null;drafts.push(d)}
 for(const raw of p.intents){
  const i=ceoObject(raw,['conversation_id','operation_id','draft_version','envelope','status','attempts','receipt','reason_code'])
  if(!i||!ceoId(i.conversation_id)||!ceoId(i.operation_id)||!ceoId(i.draft_version)||!ceoInt(i.attempts)||i.attempts>CEO_DRAFT_LIMITS.attempts||!['saved_locally','commit_unknown','accepted_pending','refused'].includes(i.status as string))return null
  const prepared=prepareCeoSend(i.envelope)
  if(!prepared.ok||JSON.stringify(prepared.value)!==JSON.stringify(i.envelope)||prepared.value.conversation_id!==i.conversation_id||prepared.value.operation_id!==i.operation_id||intents.some(x=>x.operation_id===i.operation_id||x.envelope.message_id===prepared.value.message_id))return null
  if(i.status==='saved_locally'&&i.attempts!==0||i.status!=='saved_locally'&&i.attempts===0)return null
  const receipt=i.receipt===null?null:parseCeoAccepted(i.receipt)
  if(i.status==='accepted_pending'? !receipt||receipt.conversation_id!==i.conversation_id||receipt.operation_id!==i.operation_id||receipt.message_id!==prepared.value.message_id||receipt.revision!==prepared.value.expected_revision+1 : i.receipt!==null)return null
  if(i.status==='refused'? !ceoRefusal(i.reason_code) : i.reason_code!==null)return null
  intents.push({...i,envelope:prepared.value,receipt} as unknown as CeoIntent)
 }
 if(intents.filter(i=>i.status==='saved_locally'||i.status==='commit_unknown').length>CEO_DRAFT_LIMITS.unresolved)return null
 if(new Set(intents.filter(i=>i.status==='saved_locally'||i.status==='commit_unknown').map(i=>i.conversation_id)).size!==intents.filter(i=>i.status==='saved_locally'||i.status==='commit_unknown').length)return null
 const result={schema:'CeoDraftFile@1',estate_id:p.estate_id,person_id:p.person_id,drafts,intents} as CeoDraftFile
 return new TextEncoder().encode(JSON.stringify(result,null,2)).length<=CEO_DRAFT_LIMITS.bytes?result:null
}
