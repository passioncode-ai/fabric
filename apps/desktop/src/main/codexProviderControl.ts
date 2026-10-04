import { validateProviderBinding, validateProviderStopCommand, PROVIDER_LIMITS } from '../shared/providerExecution.ts'
import type { ProviderExecutionBinding, ProviderStopCommand, Validation } from '../shared/providerExecution.ts'

// Measured 0.157.1 owned-stdio protocol only. Control ACKs are not execution
// evidence; even terminated:true cannot prove child/remote writer quiescence.
export const CODEX_CONTROL_LIMITS = Object.freeze({ pages: 32, handles: 128, requests: 161 })
export interface CodexControlScope {
  binding: ProviderExecutionBinding; sourceSequence: number; observationCursor: number
}
export interface CodexOwnedBackground extends CodexControlScope {
  handles: readonly { itemId: string; processId: string }[]
}
export interface CodexControlPorts {
  binding: ProviderExecutionBinding
  ownership: CodexOwnedBackground
  currentScope(): CodexControlScope | null
  transport: {
    /** Initiate synchronously, or recheck stillAllowed at the actual deferred
     * write boundary. A timed-out Promise must never enqueue a later write. */
    request(method: string, params: unknown, stillAllowed: () => boolean): Promise<unknown>
  }
  timeoutMs?: number
}
export interface CodexStopRequestResult {
  status: 'request_ack' | 'refused' | 'outcome_unknown'
  reasonCode: string
  binding: ProviderExecutionBinding
  commandId: string
  interruptAcknowledged: boolean
  /** All list pages replied; this is not an atomic writer census or closure. */
  inventoryComplete: boolean
  // Native ids only; no command/cwd/stdin/stdout/stderr or provider error text.
  observedBackground: readonly { itemId: string; processId: string; owned: boolean }[]
  terminationRequests: readonly { itemId: string; processId: string; acknowledged: boolean }[]
}
export interface CodexProviderControl {
  requestStop(command: ProviderStopCommand, stillAllowed: () => boolean): Promise<CodexStopRequestResult>
}
const obj = (v: unknown): v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v) && Object.getPrototypeOf(v)===Object.prototype
const id = (v: unknown): v is string => typeof v==='string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v)
const cursor = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number)>=0
const canonical = (v:unknown):string => Array.isArray(v)?`[${v.map(canonical).join(',')}]`:obj(v)?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v)
const freeze = <T>(v:T):T => {if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const discardAsync = (v:unknown) => {if(v&&(typeof v==='object'||typeof v==='function'))void Promise.resolve(v).catch(()=>undefined)}
const copy = <T>(v:T):T => JSON.parse(JSON.stringify(v)) as T
function validScope(v:unknown,binding:ProviderExecutionBinding):v is CodexControlScope {
  return obj(v)&&cursor(v.sourceSequence)&&cursor(v.observationCursor)&&validateProviderBinding(v.binding).ok&&canonical(v.binding)===canonical(binding)
}
export function createCodexProviderControl(ports:CodexControlPorts):Validation<CodexProviderControl> {
  const parsed=validateProviderBinding(ports.binding)
  if(!parsed.ok)return parsed
  const binding=parsed.value,native=binding.native
  if(binding.provider.id!=='codex-cli'||binding.provider.build!=='0.157.1'||binding.provider.runtimeProfile!=='owned-stdio'||native.status!=='observed')
    return {ok:false,reasonCode:'unsupported_control_profile'}
  const threadId=native.threadId,turnId=native.turnId
  const ownership=ports.ownership
  if(!validScope(ownership,binding)||Object.keys(ownership).some(k=>!['binding','sourceSequence','observationCursor','handles'].includes(k))||!Array.isArray(ownership.handles)||ownership.handles.length>CODEX_CONTROL_LIMITS.handles||
    !ownership.handles.every(h=>obj(h)&&Object.keys(h).every(k=>['itemId','processId'].includes(k))&&id(h.itemId)&&id(h.processId))||
    new Set(ownership.handles.map(h=>h.processId)).size!==ownership.handles.length)
    return {ok:false,reasonCode:'invalid_ownership_snapshot'}
  if(typeof ports.currentScope!=='function'||typeof ports.transport?.request!=='function')return {ok:false,reasonCode:'invalid_ports'}
  const timeoutMs=ports.timeoutMs??10_000
  if(typeof timeoutMs!=='number'||!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>60_000)return {ok:false,reasonCode:'invalid_timeout'}
  const held=freeze(copy(ownership)),scopeFloor={sourceSequence:held.sourceSequence,observationCursor:held.observationCursor}
  let checkingScope=false
  let canonicalCommand:ProviderStopCommand|null=null,pending:Promise<CodexStopRequestResult>|null=null,cached:CodexStopRequestResult|null=null
  function base(commandId:string,status:CodexStopRequestResult['status'],reasonCode:string):CodexStopRequestResult {
    return freeze({status,reasonCode,binding,commandId,interruptAcknowledged:false,inventoryComplete:false,observedBackground:[],terminationRequests:[]})
  }
  function scopedAllowed(stillAllowed:()=>boolean,minimumCursor:number):boolean {
    if(checkingScope)return false
    checkingScope=true
    try {
      const grant:unknown=stillAllowed()
      if(grant!==true){discardAsync(grant);return false}
      const current=ports.currentScope()
      if(!obj(current)){discardAsync(current);return false}
      if(!validScope(current,binding)||current.sourceSequence<scopeFloor.sourceSequence||current.observationCursor<Math.max(scopeFloor.observationCursor,minimumCursor))return false
      scopeFloor.sourceSequence=current.sourceSequence;scopeFloor.observationCursor=current.observationCursor
      return true
    } catch {
      // Scope faults revoke permission; callers receive the fixed scope_changed outcome, never raw port errors.
      return false
    } finally {checkingScope=false}
  }
  async function execute(command:ProviderStopCommand,stillAllowed:()=>boolean,deadline:number):Promise<CodexStopRequestResult> {
    let expired=false,attempted=false,interruptAcknowledged=false,inventoryComplete=false,requests=0
    const observedBackground:{itemId:string;processId:string;owned:boolean}[]=[],terminationRequests:{itemId:string;processId:string;acknowledged:boolean}[]=[]
    const result=(status:CodexStopRequestResult['status'],reasonCode:string):CodexStopRequestResult=>freeze({status,reasonCode,binding,commandId:command.commandId,
      interruptAcknowledged,inventoryComplete,observedBackground:copy(observedBackground),terminationRequests:copy(terminationRequests)})
    const allowed=()=>{
      if(expired||performance.now()>=deadline){expired=true;return false}
      const permit=scopedAllowed(stillAllowed,command.issuedCursor)
      if(performance.now()>=deadline){expired=true;return false}
      return permit
    }
    let timeout!:ReturnType<typeof setTimeout>
    const elapsed=new Promise<{status:'control_timeout'}>(resolve=>{timeout=setTimeout(()=>{expired=true;resolve({status:'control_timeout'})},Math.max(1,deadline-performance.now()))})
    type Step={ok:true;reply:unknown}|{ok:false;result:CodexStopRequestResult}
    async function rpc(method:string,params:unknown):Promise<Step> {
      if(!allowed())return {ok:false,result:result(attempted?'outcome_unknown':'refused',expired?'deadline':'scope_changed')}
      if(++requests>CODEX_CONTROL_LIMITS.requests)return {ok:false,result:result('outcome_unknown','request_limit')}
      attempted=true
      let response:unknown
      try {response=await Promise.race([ports.transport.request(method,params,allowed),elapsed])}
      catch {return {ok:false,result:result('outcome_unknown','transport_failure')}}
      if(!allowed())return {ok:false,result:result('outcome_unknown',expired?'deadline':'scope_changed')}
      if(!obj(response)||typeof response.status!=='string')return {ok:false,result:result('outcome_unknown','invalid_transport_reply')}
      const shape=response.status==='reply'?['status','result']:response.status==='error'?['status','code']:['status','reason']
      if(Object.keys(response).some(k=>!shape.includes(k))||shape.some(k=>!Object.hasOwn(response,k))||
        (response.status==='error'&&!Number.isSafeInteger(response.code))||
        (['not_sent','outcome_unknown'].includes(response.status)&&typeof response.reason!=='string'))
        return {ok:false,result:result('outcome_unknown','invalid_transport_reply')}
      if(response.status==='not_sent')return {ok:false,result:result(interruptAcknowledged?'outcome_unknown':'refused','request_not_sent')}
      if(response.status==='outcome_unknown')return {ok:false,result:result('outcome_unknown',response.reason==='deadline'?'request_timeout':'request_outcome_unknown')}
      if(response.status==='error')return {ok:false,result:result('outcome_unknown','provider_error')}
      if(response.status!=='reply'||!Object.hasOwn(response,'result'))return {ok:false,result:result('outcome_unknown','invalid_transport_reply')}
      return {ok:true,reply:response.result}
    }
    try {
      const interruption=await rpc('turn/interrupt',{threadId,turnId})
      if(!interruption.ok)return interruption.result
      if(!obj(interruption.reply)||Object.keys(interruption.reply).length!==0)return result('outcome_unknown','invalid_interrupt_reply')
      interruptAcknowledged=true
      let next:string|null=null;const visited=new Set<string>(),seen=new Set<string>()
      for(let page=0;page<CODEX_CONTROL_LIMITS.pages;page++){
        const listed=await rpc('thread/backgroundTerminals/list',{threadId,cursor:next,limit:CODEX_CONTROL_LIMITS.handles})
        if(!listed.ok)return listed.result
        if(!obj(listed.reply)||Object.keys(listed.reply).some(k=>!['data','nextCursor'].includes(k))||!Array.isArray(listed.reply.data)||listed.reply.data.length>CODEX_CONTROL_LIMITS.handles)return result('outcome_unknown','invalid_inventory_reply')
        for(const row of listed.reply.data){
          if(!obj(row)||Object.keys(row).some(k=>!['itemId','processId','command','cwd','cpuPercent','osPid','rssKb'].includes(k))||!id(row.itemId)||!id(row.processId)||typeof row.command!=='string'||typeof row.cwd!=='string'||
            (row.cpuPercent!=null&&(typeof row.cpuPercent!=='number'||!Number.isFinite(row.cpuPercent)))||
            (row.osPid!=null&&(!cursor(row.osPid)||row.osPid>4294967295))||(row.rssKb!=null&&!cursor(row.rssKb)))return result('outcome_unknown','invalid_inventory_row')
          if(seen.has(row.processId))return result('outcome_unknown','duplicate_process')
          seen.add(row.processId)
          if(seen.size>CODEX_CONTROL_LIMITS.handles)return result('outcome_unknown','handle_limit')
          observedBackground.push({itemId:row.itemId,processId:row.processId,owned:held.handles.some(h=>h.itemId===row.itemId&&h.processId===row.processId)})
        }
        const token=listed.reply.nextCursor
        if(token!==undefined&&token!==null&&(typeof token!=='string'||token.length<1||token.length>PROVIDER_LIMITS.idLength))return result('outcome_unknown','invalid_page_cursor')
        next=token==null?null:token
        if(next===null){inventoryComplete=true;break}
        if(visited.has(next))return result('outcome_unknown','page_cycle')
        visited.add(next)
      }
      if(!inventoryComplete)return result('outcome_unknown','page_limit')
      for(const handle of observedBackground){
        if(!handle.owned)continue
        const stopped=await rpc('thread/backgroundTerminals/terminate',{threadId,processId:handle.processId})
        if(!stopped.ok)return stopped.result
        if(!obj(stopped.reply)||Object.keys(stopped.reply).some(k=>k!=='terminated')||typeof stopped.reply.terminated!=='boolean')return result('outcome_unknown','invalid_terminate_reply')
        terminationRequests.push({itemId:handle.itemId,processId:handle.processId,acknowledged:stopped.reply.terminated})
      }
      if(!allowed())return result('outcome_unknown',expired?'deadline':'scope_changed')
      if(observedBackground.some(h=>!h.owned))return result('outcome_unknown','unowned_background')
      if(terminationRequests.some(r=>!r.acknowledged))return result('outcome_unknown','termination_unacknowledged')
      return result('request_ack','requests_acknowledged')
    }finally{clearTimeout(timeout);expired=true}
  }
  // Cache is connection-local. A supervisor must persist canonical commands
  // and unknown outcomes; constructing another controller is not a retry grant.
  function requestStop(input:ProviderStopCommand,stillAllowed:()=>boolean):Promise<CodexStopRequestResult>{
    const deadline=performance.now()+timeoutMs
    const checked=validateProviderStopCommand(input)
    if(!checked.ok)return Promise.resolve(base(obj(input)&&id(input.commandId)?input.commandId:'invalid','refused',checked.reasonCode))
    const command=checked.value
    if(canonicalCommand&&canonical(canonicalCommand)!==canonical(command))return Promise.resolve(base(command.commandId,'refused','canonical_command_conflict'))
    // A changed scope never reveals a stored answer, but an attempted command is not "refused" either (I3 E-4).
    if(!scopedAllowed(stillAllowed,command.issuedCursor))return Promise.resolve(base(command.commandId,cached||pending?'outcome_unknown':'refused','scope_changed'))
    if(canonicalCommand&&canonical(canonicalCommand)!==canonical(command))return Promise.resolve(base(command.commandId,'refused','canonical_command_conflict'))
    // A repeat writes nothing: its stored or in-flight outcome is the answer, and a refusal here
    // would tell the caller nothing was sent after a write may already have happened.
    if(cached)return Promise.resolve(cached)
    if(pending)return pending
    if(performance.now()>=deadline)return Promise.resolve(base(command.commandId,'refused','deadline'))
    canonicalCommand=command
    // Install the shared promise before any user port can synchronously reenter.
    let settle!:(r:CodexStopRequestResult)=>void
    pending=new Promise(resolve=>{settle=resolve})
    const joined=pending
    void execute(command,stillAllowed,deadline).then(r=>{cached=r;pending=null;settle(r)},()=>{cached=base(command.commandId,'outcome_unknown','control_failure');pending=null;settle(cached)})
    return joined
  }
  return {ok:true,value:{requestStop}}
}
