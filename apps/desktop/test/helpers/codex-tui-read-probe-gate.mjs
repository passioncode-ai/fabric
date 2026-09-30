// Test-only T3a policy for COMPLETE WebSocket messages. Not a frame parser,
// listener, authentication endpoint, provider adapter, or production capability.
import { performance } from 'node:perf_hooks'

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const fields = (value, required, optional = []) => object(value) && required.every(k => Object.hasOwn(value,k)) &&
  Object.keys(value).every(k => required.includes(k) || optional.includes(k))
const optional = (value,key,predicate) => !Object.hasOwn(value,key) || predicate(value[key])
const safeId = id => typeof id === 'string' ? /^[A-Za-z0-9._:-]{1,64}$/.test(id) : Number.isSafeInteger(id) && id >= 0
const idKey = id => `${typeof id}:${id}`
const version = value => optional(value,'jsonrpc',v => v === '2.0')
const defaultCaps = {
  explicitGatewayOauth:v=>v === false, requestAttestation:v=>v === false,
  extensions:v=>v === null, mcpServerOpenaiFormElicitation:v=>v === false,
  optOutNotificationMethods:v=>v === null || Array.isArray(v) && v.length === 0
}
function validInitialize(params) {
  if (!fields(params,['clientInfo','capabilities'])) return false
  const info=params.clientInfo,caps=params.capabilities
  return fields(info,['name','version'],['title']) && info.name === 'codex-tui' && info.version === '0.157.1' &&
    optional(info,'title',v=>v === null) && fields(caps,['experimentalApi'],Object.keys(defaultCaps)) &&
    caps.experimentalApi === true && Object.entries(defaultCaps).every(([k,p])=>optional(caps,k,p))
}
function swallowThenable(value) {
  if (value && (typeof value === 'object' || typeof value === 'function')) {
    try { if (typeof value.then === 'function') Promise.resolve(value).catch(()=>undefined) } catch { /* Invalid owned port. */ }
  }
}

/**
 * One immutable, host-attributed epoch per gate. The owner must authenticate the
 * sockets, bind callbacks to this instance/epoch, supply fully reassembled text
 * messages, and close both transports on denial. No caller may swap its ports.
 * Writes are synchronous: return literal true after a bounded enqueue and check
 * the supplied fence at the actual enqueue edge. Async/buffering adapters are
 * unsupported until separately proved; a failed enqueue is outcome-unknown.
 */
export function createCodexTuiReadProbeGate({epoch,backendProfile,writeUpstream,writeDownstream,
  onClose=()=>{},now=()=>performance.now(),lifetimeMs=10_000,maxMessageBytes=16_384,maxTotalBytes=65_536,maxMessages=12}) {
  if (typeof epoch !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(epoch) || typeof backendProfile !== 'string' ||
    !backendProfile.startsWith('/') || backendProfile.length>4096 || typeof writeUpstream !== 'function' ||
    typeof writeDownstream !== 'function' || typeof onClose !== 'function' || typeof now !== 'function' ||
    !Number.isSafeInteger(lifetimeMs) || lifetimeMs<1 || lifetimeMs>30_000 ||
    !Number.isSafeInteger(maxMessageBytes) || maxMessageBytes<128 || maxMessageBytes>65_536 ||
    !Number.isSafeInteger(maxTotalBytes) || maxTotalBytes<maxMessageBytes || maxTotalBytes>262_144 ||
    !Number.isSafeInteger(maxMessages) || maxMessages<1 || maxMessages>32) throw new Error('invalid_probe_gate_configuration')
  const started=now()
  if (!Number.isFinite(started)) throw new Error('invalid_probe_gate_clock')
  const deadline=started+lifetimeMs
  let phase='new',reason=null,lastNow=started,bytes=0,messages=0,upstreamWrites=0,downstreamWrites=0,pending=null
  const seen=new Set(),observations=[]
  let timer
  const close=(why='owner_closed')=>{
    if (phase === 'closed') return
    phase='closed';reason=why;pending=null;clearTimeout(timer)
    try { swallowThenable(onClose()) } catch { /* Denial is already sticky. */ }
  }
  const alive=()=>{
    if (phase === 'closed') return false
    let current
    try { current=now() } catch { close('clock_failed');return false }
    if (!Number.isFinite(current) || current<lastNow) {close('invalid_clock');return false}
    lastNow=current
    if (current>=deadline) {close('deadline');return false}
    return true
  }
  timer=setTimeout(()=>close('deadline'),lifetimeMs);timer.unref?.()
  const denied=why=>{close(why);return {status:'denied',reason}}
  const decode=(data,isBinary)=>{
    if (isBinary !== false) throw new Error('nontext_message')
    let source,n
    if (typeof data === 'string') {
      if (data.length>maxMessageBytes) throw new Error('message_bound')
      if (!data.isWellFormed()) throw new Error('invalid_utf8')
      n=Buffer.byteLength(data);source=data
    } else if (data instanceof Uint8Array) {
      n=data.byteLength
      if (n>maxMessageBytes) throw new Error('message_bound')
      try { source=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(data) }
      catch { throw new Error('invalid_utf8') }
    } else throw new Error('invalid_message_type')
    if (n>maxMessageBytes || bytes+n>maxTotalBytes || messages>=maxMessages) throw new Error('message_bound')
    bytes+=n;messages++
    // Reject excessive nesting before JSON.parse. This scan is not a JSON or WS
    // parser: JSON.parse validates syntax; compact equality rejects duplicates,
    // alternate escape/number spellings and prototype-key ambiguities.
    let quoted=false,escaped=false,depth=0,compact=''
    for (const ch of source) {
      if (quoted) {
        compact+=ch
        if (escaped) escaped=false
        else if (ch === '\\') escaped=true
        else if (ch === '"') quoted=false
      } else if (ch === '"') {quoted=true;compact+=ch}
      else {
        if (ch === '{' || ch === '[') {if (++depth>12) throw new Error('nesting_bound')}
        else if (ch === '}' || ch === ']') depth--
        if (!/[ \r\n\t]/.test(ch)) compact+=ch
      }
    }
    let value
    try {value=JSON.parse(source)} catch {throw new Error('invalid_json')}
    if (!object(value)) throw new Error('invalid_envelope')
    if (JSON.stringify(value)!==compact) throw new Error('noncanonical_json')
    return value
  }
  const write=(direction,value,method)=>{
    if (!alive()) return {status:'denied',reason}
    const wire=JSON.stringify(value)
    if (!alive()) return {status:'denied',reason}
    let result
    try {result=(direction==='upstream'?writeUpstream:writeDownstream)(wire,alive)}
    catch {return denied('write_failed')}
    if (result!==true) {swallowThenable(result);return denied('write_unconfirmed')}
    if (direction==='upstream') upstreamWrites++;else downstreamWrites++
    observations.push({direction,method}) // Only authored whitelist labels; never raw IDs/payloads.
    if (!alive()) return {status:'denied',reason}
    return {status:'forwarded'}
  }
  const receive=(direction,data,context)=>{
    if (!object(context)) return denied('invalid_context')
    const {epoch:incomingEpoch,isBinary}=context
    // A stale callback cannot poison or publish to a new connection.
    if (incomingEpoch!==epoch) return {status:'ignored',reason:'foreign_epoch'}
    if (!alive()) return {status:'denied',reason}
    let value
    try {value=decode(data,isBinary)} catch (e) {
      const allowed=['nontext_message','invalid_utf8','message_bound','invalid_message_type','nesting_bound','invalid_json','invalid_envelope','noncanonical_json']
      return denied(allowed.includes(e.message)?e.message:'invalid_message')
    }
    if (!alive()) return {status:'denied',reason}
    if (direction==='upstream') {
      if (!version(value) || typeof value.method!=='string') return denied('invalid_client_envelope')
      if (value.method==='initialized') {
        if (phase!=='awaiting_initialized' || !fields(value,['method'],['jsonrpc','params']) ||
          !optional(value,'params',v=>v===null)) return denied('invalid_initialized')
        phase='ready'
        return write(direction,value,'initialized')
      }
      if (!fields(value,['id','method','params'],['jsonrpc']) || !safeId(value.id)) return denied('invalid_client_envelope')
      if (seen.has(idKey(value.id))) return denied('repeated_request_id')
      if (value.method==='initialize') {
        if (phase!=='new' || value.id!=='initialize' || !validInitialize(value.params)) return denied('invalid_initialize')
        phase='initializing'
      } else if (value.method==='account/read') {
        if (phase!=='ready' || !Number.isSafeInteger(value.id) || value.id<1 ||
          !fields(value.params,['refreshToken']) || value.params.refreshToken!==false) return denied('invalid_account_read')
        phase='reading_account'
      } else return denied('method_not_allowed')
      seen.add(idKey(value.id));pending={id:value.id,method:value.method}
      return write(direction,value,value.method)
    }
    // No forwarding of server requests, notifications, error text or approvals.
    if (!fields(value,['id','result'],['jsonrpc']) || !version(value) || !pending || value.id!==pending.id)
      return denied('unexpected_server_message')
    const method=pending.method,result=value.result
    if (method==='initialize') {
      if (phase!=='initializing' || !fields(result,['codexHome','platformFamily','platformOs','userAgent']) ||
        result.codexHome!==backendProfile || result.platformFamily!=='unix' || result.platformOs!=='macos' ||
        typeof result.userAgent!=='string' || result.userAgent.length>512 || !result.userAgent.includes('0.157.1'))
        return denied('invalid_initialize_result')
      phase='awaiting_initialized'
    } else {
      if (phase!=='reading_account' || !fields(result,['account','requiresOpenaiAuth'],['workspaceRouting']) ||
        result.account!==null || result.requiresOpenaiAuth!==true || !optional(result,'workspaceRouting',v=>v===null))
        return denied('account_not_empty')
      phase='account_observed'
    }
    pending=null
    return write(direction,value,method)
  }
  return Object.freeze({
    client:(data,context)=>receive('upstream',data,context),
    server:(data,context)=>receive('downstream',data,context),
    close:()=>close('owner_closed'),
    snapshot:()=>Object.freeze({phase,reason,bytes,messages,upstreamWrites,downstreamWrites,pending:pending!==null,
      observations:observations.map(o=>Object.freeze({...o}))})
  })
}
