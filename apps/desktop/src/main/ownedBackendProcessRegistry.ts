// Physical native process ownership only. Provider capability remains NOT_BOUND.
// Trusted main calls this from the existing managedLaunch prepare/beforeSpawn seam.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { closeSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, statSync, writeSync } from 'node:fs'
import path from 'node:path'
import { Writable, type Readable } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'
import { performance } from 'node:perf_hooks'
import type { AdmissionReceipt } from '../shared/admission.ts'
import { createProcessBoundary, type OwnedProcess } from './processBoundary.ts'
import { createStopHostIdentity } from './stopHostIdentity.ts'
import { isMeasuredRuntime } from './runtimeAdmission.ts'

export interface BackendProcessRecipe { executable:string; executableSha256:string; argv:string[]; cwd:string; env:Record<string,string> }
export interface BackendProcessAuthority { personId:string; revision:number }
/** Object identity is the main-only capability. A serialized copy cannot claim pipes. */
export interface OwnedBackendHandle { readonly kind:'OwnedBackendHandle@1'; readonly ownerId:string; readonly channelEpoch:string }
export interface BackendProcessRegistryOptions {
  rootDir:string
  estateId:string
  recipe:BackendProcessRecipe
  authority():BackendProcessAuthority|null
  timeoutMs?:number
  /** A loopback backend announces its listener on stderr (B2b-1). Only a whole line matching this
   * non-global pattern is read, its first group as the port; no other stderr text is kept. */
  listener?:{pattern:RegExp;timeoutMs?:number}
  /** The host identity main's Stop runtime already uses (B3-2), so a process reference means the
   * same thing to both; without it the registry mints its own boot identity. */
  host?:{hostInstanceId:string;bootId:string}
  /** Called once when an owned root exits, after the registry has recorded it (B3-2): main turns it
   * into the Stop runtime's natural exit. A throwing listener changes nothing here. */
  onExit?(handle:OwnedBackendHandle):void
}
/** Per-launch arguments appended to the fixed recipe, e.g. a per-backend token digest. Never persisted. */
export interface BackendLaunchArgs { argv:string[] }
export type BackendListener = {state:'listening';port:number}|{state:'unknown';reasonCode:string}
export type BackendProcessLaunch = {state:'owned';handle:OwnedBackendHandle}|{state:'refused'|'outcome_unknown';reasonCode:string;handle?:OwnedBackendHandle}
const LIMITS=Object.freeze({history:128,active:8,recipeBytes:65536,frameBytes:1048576,launchArgs:8,launchArgBytes:512,stderrScan:1048576,stderrLine:16384})
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const shape=(v:unknown,keys:string[]):v is Record<string,unknown>=>{
  if(!v||typeof v!=='object'||Object.getPrototypeOf(v)!==Object.prototype)return false
  const d=Object.getOwnPropertyDescriptors(v);return Reflect.ownKeys(v).length===keys.length&&keys.every(k=>d[k]&&'value'in d[k])
}
const fault=()=>Error('backend_ownership_unavailable')
const absorb=(v:unknown)=>{try{if(v&&typeof(v as PromiseLike<unknown>).then==='function')void Promise.resolve(v).catch(()=>{})}catch{/* A hostile thenable's getter threw; the value is already refused. */}}
const grant=(fn:()=>unknown)=>{try{const v=fn();if(v===true)return true;absorb(v)}catch{/* A throwing grant callback is a refusal: fail closed. */}return false}
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
function authority(v:unknown):BackendProcessAuthority|null {
  if(!shape(v,['personId','revision'])||!uuid(v.personId)||!Number.isSafeInteger(v.revision)||(v.revision as number)<1){absorb(v);return null}
  return{personId:v.personId.toLowerCase(),revision:v.revision as number}
}
function recipe(v:BackendProcessRecipe):BackendProcessRecipe {
  if(!shape(v,['executable','executableSha256','argv','cwd','env'])||typeof v.executable!=='string'||!path.isAbsolute(v.executable)||v.executable.length>4096||
    typeof v.cwd!=='string'||!path.isAbsolute(v.cwd)||v.cwd.length>4096||/[\x00-\x1f]/.test(v.cwd+v.executable)||
    typeof v.executableSha256!=='string'||!/^[a-f0-9]{64}$/.test(v.executableSha256)||!Array.isArray(v.argv)||v.argv.length>64||Reflect.ownKeys(v.argv).length!==v.argv.length+1||
    !v.env||typeof v.env!=='object'||Object.getPrototypeOf(v.env)!==Object.prototype||Reflect.ownKeys(v.env).length>128||Reflect.ownKeys(v.env).length!==Object.keys(v.env).length)throw fault()
  let bytes=0;const argv:string[]=[],env:Record<string,string>={}
  for(let i=0;i<v.argv.length;i++){const d=Object.getOwnPropertyDescriptor(v.argv,String(i));if(!d||!('value'in d)||typeof d.value!=='string'||d.value.includes('\0')||(bytes+=Buffer.byteLength(d.value))>LIMITS.recipeBytes)throw fault();argv.push(d.value)}
  for(const [k,d]of Object.entries(Object.getOwnPropertyDescriptors(v.env))){if(!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(k)||!('value'in d)||typeof d.value!=='string'||d.value.includes('\0')||(bytes+=Buffer.byteLength(k+d.value))>LIMITS.recipeBytes)throw fault();Object.defineProperty(env,k,{value:d.value,enumerable:true})}
  const executable=realpathSync(v.executable),cwd=realpathSync(v.cwd),s=statSync(executable)
  if(!s.isFile()||!(s.mode&0o111)||(s.mode&0o022)||s.size>128*1024*1024||!statSync(cwd).isDirectory()||createHash('sha256').update(readFileSync(executable)).digest('hex')!==v.executableSha256)throw fault()
  return freeze({executable,executableSha256:v.executableSha256,argv,cwd,env})
}
interface Run {estateId:string;projectId:string;taskId:string;runId:string;runOrdinal:number;sessionId:string}
function run(receipt:AdmissionReceipt,estateId:string,sessionId:string):Run|null {
  // Read only needed own data properties. Admitted journal receipt remains the
  // authority; this shape check is not a second task admission policy.
  if(!receipt||typeof receipt!=='object'||Object.getPrototypeOf(receipt)!==Object.prototype)return null
  const d=Object.getOwnPropertyDescriptors(receipt),get=(k:string)=>d[k]&&'value'in d[k]?d[k].value:undefined
  if(get('admitted')!==true||!uuid(sessionId)||!['project_id','task_id','task_run_id','session_id'].every(k=>uuid(get(k)))||get('session_id').toLowerCase()!==sessionId.toLowerCase()||!Number.isSafeInteger(get('run_ordinal'))||get('run_ordinal')<1)return null
  return{estateId,projectId:get('project_id').toLowerCase(),taskId:get('task_id').toLowerCase(),runId:get('task_run_id').toLowerCase(),runOrdinal:get('run_ordinal'),sessionId:sessionId.toLowerCase()}
}
/** Privileged fault-injection seams; never expose through renderer IPC. The
 * default owns actual spawn/ps/pipe syscalls, not caller-asserted process facts. */
export interface BackendProcessSystem {
  spawn: typeof spawn
  boundary: ReturnType<typeof createProcessBoundary>
  fdIdentity(fd:number):string
  write(fd:number,bytes:Buffer):number
}
const physicalPipeIdentity=(fd:number)=>{const s=fstatSync(fd,{bigint:true});if(!s.isSocket())throw fault();return `${s.dev}/${s.ino}/${s.rdev}/${s.mode}`}
const nativeSystem:BackendProcessSystem={spawn,boundary:createProcessBoundary(),fdIdentity:physicalPipeIdentity,write:(fd,bytes)=>writeSync(fd,bytes)}
// Measured private Node Pipe ABI, not a general Writable effect guarantee.
const pipeFd=(child:ChildProcessWithoutNullStreams):number=>{
  const fd=(child.stdin as unknown as {_handle?:{fd?:unknown}})._handle?.fd
  if(!Number.isSafeInteger(fd)||(fd as number)<0)throw fault();return fd as number
}
interface Entry {
  handle:OwnedBackendHandle;run:Run;authority:BackendProcessAuthority;child:ChildProcessWithoutNullStreams|null;owned:OwnedProcess|null
  state:'reserved'|'owned'|'outcome_unknown'|'exited';reason:string;channel:'unbound'|'open'|'lost';fenced:boolean;rootExit:boolean;exitCode:number|null;exitSignal:string|null
  group:'unobserved'|'active'|'quiescent'|'unknown';stderrBytes:number;joined:boolean;output:Writable|null;pending?:Promise<BackendProcessLaunch>
  /** A request's own fence while its bytes cross the write edge (B2a); set only inside `edge`. */
  edgeFence:(()=>boolean)|null;edgeVerdict:'written'|'fenced'|'refused'|null;writing:boolean
  listenerPort:number|null;listenerWaiters:((v:BackendListener)=>void)[];stderrLine:string;stderrLineLength:number
}
/** Single trusted main-process writer per Estate/root. Markers prevent a new
 * registry/host invocation from re-spawning an old Run. They never restore live
 * ownership from disk. SQL remains the cross-process/machine launch authority. */
export function createOwnedBackendProcessRegistry(options:BackendProcessRegistryOptions,native:BackendProcessSystem=nativeSystem){
  // The private pipe ABI below is measured per runtime tuple (E0), never assumed from a version.
  if(!isMeasuredRuntime()||!uuid(options.estateId))throw fault()
  const estateId=options.estateId.toLowerCase(),timeout=options.timeoutMs??5000
  if(!Number.isSafeInteger(timeout)||timeout<1||timeout>30000)throw fault()
  let launchRecipe:BackendProcessRecipe,host:{hostInstanceId:string;bootId:string},dir:string
  const history=new Map<string,Run>()
  try{
    launchRecipe=recipe(options.recipe)
    if(options.host!==undefined){if(!shape(options.host,['hostInstanceId','bootId'])||!uuid(options.host.hostInstanceId)||!uuid(options.host.bootId))throw fault();host=freeze({hostInstanceId:options.host.hostInstanceId,bootId:options.host.bootId})}
    else host=createStopHostIdentity(options.rootDir)
    dir=options.rootDir
    for(const part of ['backend-processes',estateId]){dir=path.join(dir,part);try{mkdirSync(dir,{mode:0o700})}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e}const s=lstatSync(dir);if(!s.isDirectory()||s.isSymbolicLink()||(s.mode&0o777)!==0o700||(process.getuid&&s.uid!==process.getuid()))throw fault()}
    const names=readdirSync(dir);if(names.length>LIMITS.history)throw fault()
    for(const name of names){
      if(!/^[a-f0-9-]{36}\.json$/.test(name))throw fault()
      const file=path.join(dir,name),s=lstatSync(file)
      if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||(s.mode&0o777)!==0o600||s.size>4096||(process.getuid&&s.uid!==process.getuid()))throw fault()
      const value:unknown=JSON.parse(readFileSync(file,'utf8'))
      if(!shape(value,['schema','run','ownerId','channelEpoch'])||value.schema!=='BackendSpawnIntent@1'||
        !shape(value.run,['estateId','projectId','taskId','runId','runOrdinal','sessionId']))throw fault()
      const saved=value.run
      if(saved.estateId!==estateId||!['estateId','projectId','taskId','runId','sessionId'].every(k=>uuid(saved[k]))||
        !Number.isSafeInteger(saved.runOrdinal)||(saved.runOrdinal as number)<1||!uuid(value.ownerId)||!uuid(value.channelEpoch)||name!==saved.runId+'.json')throw fault()
      history.set(saved.runId as string,saved as unknown as Run)
    }
  }catch{throw fault()}
  const boundary=native.boundary,entries=new Map<string,Entry>(),handles=new WeakMap<OwnedBackendHandle,Entry>()
  let retired=false,checking=false,queryingAuthority=false
  const held=()=>{if(queryingAuthority)return null;queryingAuthority=true;try{return authority(options.authority())}catch{/* Unreadable authority is unavailable authority; start and write refuse. */return null}finally{queryingAuthority=false}}
  const get=(handle:OwnedBackendHandle)=>{const e=handles.get(handle);if(!e||entries.get(e.run.runId)!==e)throw fault();return e}
  const settleListener=(e:Entry,v:BackendListener)=>{const w=e.listenerWaiters;e.listenerWaiters=[];for(const f of w)f(v)}
  const lose=(e:Entry,reason:string)=>{if(e.fenced)return;e.fenced=true;e.reason=reason;e.channel='lost';if(e.state!=='exited')e.state='outcome_unknown';e.output?.destroy(fault());settleListener(e,{state:'unknown',reasonCode:reason})}
  const listenerPattern=options.listener?.pattern
  if(options.listener&&(!(listenerPattern instanceof RegExp)||listenerPattern.global||listenerPattern.sticky))throw fault()
  const listenerTimeout=options.listener?.timeoutMs??timeout
  if(!Number.isSafeInteger(listenerTimeout)||listenerTimeout<1||listenerTimeout>30000)throw fault()
  /** Whole stderr lines, bounded; only a listener match is kept, as a port. Native text never leaves. */
  const scanStderr=(e:Entry,decoder:StringDecoder,chunk:Buffer)=>{
    if(!listenerPattern||e.fenced||e.stderrBytes>LIMITS.stderrScan)return
    // One length per line across every chunk: a line longer than the bound is skipped whole, so no
    // tail of it can be read as a receipt; at most the bound is ever kept.
    const piece=decoder.write(chunk);let start=0,newline
    while((newline=piece.indexOf('\n',start))>=0){
      const part=piece.slice(start,newline);e.stderrLineLength+=part.length
      const line=e.stderrLineLength<=LIMITS.stderrLine?e.stderrLine+part:null
      e.stderrLine='';e.stderrLineLength=0;start=newline+1
      if(line===null)continue
      const m=listenerPattern.exec(line);if(!m)continue
      const port=Number(m[1])
      if(!/^\d{1,5}$/.test(m[1]??'')||port<1||port>65535){lose(e,'invalid_listener_receipt');return}
      if(e.listenerPort!==null){lose(e,'duplicate_listener_receipt');return}
      e.listenerPort=port;settleListener(e,{state:'listening',port})
    }
    const rest=piece.slice(start);e.stderrLineLength+=rest.length
    e.stderrLine=e.stderrLineLength<=LIMITS.stderrLine?e.stderrLine+rest:''
  }
  const allowed=(e:Entry)=>{
    if(retired||e.fenced||e.rootExit||e.state!=='owned'||e.channel!=='open'||checking)return false
    checking=true
    try{const now=held();if(!now||JSON.stringify(now)!==JSON.stringify(e.authority)){lose(e,'authority_changed');return false}return !retired&&!e.fenced&&!e.rootExit&&e.state==='owned'&&e.channel==='open'}finally{checking=false}
  }
  const inspect=async(e:Entry)=>{
    let exited=e.rootExit;let observed=e.owned?await boundary.observe(e.owned,exited):null
    if(e.owned&&!exited&&e.rootExit){exited=true;observed=await boundary.observe(e.owned,true)}
    e.group=observed?.state??'unknown'
    if(e.rootExit&&observed?.state==='quiescent')e.state='exited'
    return snapshot(e)
  }
  const snapshot=(e:Entry)=>{const admissionFenced=!allowed(e);return freeze({handleId:e.handle.ownerId,channelEpoch:e.handle.channelEpoch,run:{...e.run},authority:{...e.authority},host:{...host},
    physicalState:e.state,reasonCode:e.reason,channelState:e.channel,listenerPort:e.listenerPort,provider:'NOT_BOUND' as const,admissionFenced,rootExitObserved:e.rootExit,exitCode:e.exitCode,exitSignal:e.exitSignal,processGroup:e.group,allDescendants:'unknown' as const,
    processIdentityRef:e.owned?`process:${createHash('sha256').update(JSON.stringify([host.hostInstanceId,host.bootId,e.run.sessionId,{pid:e.owned.pid,group:e.owned.group,start:e.owned.start}])).digest('hex')}`:null,stderrBytes:e.stderrBytes})}
  function mark(e:Entry){
    if(history.has(e.run.runId)||history.size>=LIMITS.history||[...history.values()].some(r=>r.sessionId===e.run.sessionId))throw fault()
    const fd=openSync(path.join(dir,e.run.runId+'.json'),'wx',0o600)
    try{const bytes=Buffer.from(JSON.stringify({schema:'BackendSpawnIntent@1',run:e.run,ownerId:e.handle.ownerId,channelEpoch:e.handle.channelEpoch}));let offset=0;while(offset<bytes.length){const n=writeSync(fd,bytes,offset,bytes.length-offset);if(n<1)throw fault();offset+=n}fsyncSync(fd);if(fstatSync(fd).nlink!==1)throw fault()}finally{closeSync(fd)}
    const d=openSync(dir,'r');try{fsyncSync(d)}finally{closeSync(d)}
    history.set(e.run.runId,e.run)
  }
  function launchArgs(v:BackendLaunchArgs|undefined):string[]|null{
    if(v===undefined)return []
    if(!shape(v,['argv'])||!Array.isArray(v.argv)||v.argv.length>LIMITS.launchArgs||Reflect.ownKeys(v.argv).length!==v.argv.length+1)return null
    const out:string[]=[]
    for(let i=0;i<v.argv.length;i++){const d=Object.getOwnPropertyDescriptor(v.argv,String(i));if(!d||!('value'in d)||typeof d.value!=='string'||!d.value||/[\x00-\x1f]/.test(d.value)||Buffer.byteLength(d.value)>LIMITS.launchArgBytes)return null;out.push(d.value)}
    return out
  }
  function start(receipt:AdmissionReceipt,sessionId:string,beforeSpawn:()=>Promise<boolean>,launch?:BackendLaunchArgs):Promise<BackendProcessLaunch>{
    const deadline=performance.now()+timeout,r=run(receipt,estateId,sessionId),extra=launchArgs(launch)
    if(!r||typeof beforeSpawn!=='function')return Promise.resolve({state:'refused',reasonCode:'invalid_admitted_run'})
    if(!extra)return Promise.resolve({state:'refused',reasonCode:'invalid_launch_args'})
    const prior=entries.get(r.runId)
    if(prior){if(JSON.stringify(prior.run)!==JSON.stringify(r))return Promise.resolve({state:'refused',reasonCode:'run_identity_conflict'});return prior.pending??Promise.resolve({state:'refused',reasonCode:'run_already_consumed',handle:prior.handle})}
    // A marker for this Run means an earlier registry reserved it — a child may exist. That is not
    // capacity, and a launch must read it as unknown, never as "nothing started" (B1).
    if(history.has(r.runId))return Promise.resolve({state:'refused',reasonCode:'run_marker_present'})
    if(retired||history.size>=LIMITS.history||entries.size>=LIMITS.history||[...entries.values()].filter(e=>e.state!=='exited').length>=LIMITS.active)return Promise.resolve({state:'refused',reasonCode:'owner_unavailable_or_capacity'})
    const a=held();if(!a)return Promise.resolve({state:'refused',reasonCode:'authority_unavailable'})
    const handle=freeze({kind:'OwnedBackendHandle@1' as const,ownerId:randomUUID(),channelEpoch:randomUUID()})
    const e:Entry={handle,run:r,authority:a,child:null,owned:null,state:'reserved',reason:'spawn_reserved',channel:'unbound',fenced:false,rootExit:false,exitCode:null,exitSignal:null,group:'unobserved',stderrBytes:0,joined:false,output:null,edgeFence:null,edgeVerdict:null,writing:false,listenerPort:null,listenerWaiters:[],stderrLine:'',stderrLineLength:0}
    entries.set(r.runId,e);handles.set(handle,e)
    let expired=false,timer:ReturnType<typeof setTimeout>|undefined
    const live=()=>{
      if(retired||expired||performance.now()>=deadline||e.fenced)return false
      const now=held()
      return JSON.stringify(now)===JSON.stringify(a)&&!retired&&!expired&&!e.fenced&&entries.get(r.runId)===e&&performance.now()<deadline
    }
    const task=(async():Promise<BackendProcessLaunch>=>{
      try{
        mark(e)
        recipe(launchRecipe)
        if(!live())throw fault()
        // Existing managedLaunch owns begin.granted. Its exact final SQL guard is
        // awaited here; no new admission/lease policy or caller-asserted owner.
        const verdict=await Promise.race([Promise.resolve().then(()=>{if(!live())throw fault();return beforeSpawn()}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(fault())},Math.max(0,deadline-performance.now()))})])
        if(verdict!==true||!live())throw fault()
        let child:ChildProcessWithoutNullStreams
        try{child=native.spawn(launchRecipe.executable,[...launchRecipe.argv,...extra],{cwd:launchRecipe.cwd,env:{...launchRecipe.env},detached:true,stdio:'pipe',shell:false})}
        catch{/* A synchronous throw may follow native materialization; the typed outcome carries the reason. */lose(e,'spawn_outcome_unknown');return{state:'outcome_unknown',reasonCode:e.reason,handle}}
        e.child=child
        child.on('error',()=>lose(e,'native_process_error'))
        child.on('exit',(code,signal)=>{e.rootExit=true;e.exitCode=Number.isSafeInteger(code)?code:null;e.exitSignal=signal??null;lose(e,'backend_root_exit');void inspect(e).catch(()=>{e.group='unknown'})
          try{options.onExit?.(handle)}catch{/* The exit is recorded; a listener's failure cannot change it. */}})
        for(const stream of [child.stdin,child.stdout]){stream.on('error',()=>lose(e,'owned_channel_error'));stream.on('close',()=>lose(e,'owned_channel_closed'))}
        child.stdout.on('end',()=>lose(e,'owned_channel_end'))
        const stderrDecoder=new StringDecoder('utf8')
        child.stderr.on('data',(chunk:Buffer)=>{scanStderr(e,stderrDecoder,chunk);e.stderrBytes=Math.min(Number.MAX_SAFE_INTEGER,e.stderrBytes+chunk.length)})
        child.stderr.on('error',()=>{/* Drain diagnostics without persisting or exposing native text. */})
        if(!Number.isSafeInteger(child.pid)||child.pid!<=1)throw fault()
        const capture=boundary.capture(child.pid!).then(owned=>{e.owned=owned;return owned})
        await Promise.race([capture,new Promise<never>((_,reject)=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>{expired=true;reject(fault())},Math.max(0,deadline-performance.now()))})])
        if(!e.owned||!live()||e.rootExit||child.stdin.destroyed||child.stdout.destroyed)throw fault()
        e.state='owned';e.channel='open';e.group='active';e.reason='physical_process_owned'
        return{state:'owned',handle}
      }catch{/* Typed refusal or unknown outcome; e.reason reaches the caller and the snapshot. */lose(e,e.child?'capture_or_launch_unknown':'spawn_not_granted');return{state:e.child?'outcome_unknown':'refused',reasonCode:e.reason,handle}}
      finally{expired=true;if(timer)clearTimeout(timer)}
    })()
    e.pending=task;void task.finally(()=>{if(e.pending===task)e.pending=undefined});return task
  }
  return {
    start,
    snapshot(handle:OwnedBackendHandle){return snapshot(get(handle))},
    /** The port the owned backend announced on its own stderr, within the listener deadline. A lost
     * owner, a root exit, a duplicate or malformed receipt and the deadline are all unknown. */
    listener(handle:OwnedBackendHandle):Promise<BackendListener>{
      const e=get(handle)
      if(!listenerPattern)return Promise.resolve({state:'unknown',reasonCode:'listener_not_configured'})
      if(e.fenced)return Promise.resolve({state:'unknown',reasonCode:e.reason})
      if(e.listenerPort!==null)return Promise.resolve({state:'listening',port:e.listenerPort})
      return new Promise(resolve=>{
        const timer=setTimeout(()=>{e.listenerWaiters=e.listenerWaiters.filter(f=>f!==done);resolve({state:'unknown',reasonCode:'listener_timeout'})},listenerTimeout)
        const done=(v:BackendListener)=>{clearTimeout(timer);resolve(v)}
        e.listenerWaiters.push(done)
      })
    },
    canWrite(handle:OwnedBackendHandle){try{return allowed(get(handle))}catch{/* An unknown or foreign handle cannot write. */return false}},
    async inspect(handle:OwnedBackendHandle){return inspect(get(handle))},
    /** Exactly once, trusted main only. These are the actual spawned child's
     * pipes, not streams supplied by a caller. No provider handshake is implied. */
    claimStdio(handle:OwnedBackendHandle):{handle:OwnedBackendHandle;input:Readable;output:Writable;stillOwned:()=>boolean;edge:(fence:()=>boolean,write:()=>boolean)=>boolean|'fenced'}{
      const e=get(handle);if(e.joined||!allowed(e)||!e.child)throw fault();e.joined=true
      const child=e.child
      let fd:number,stamp:string,physical:string
      try{fd=pipeFd(child);stamp=native.fdIdentity(fd);physical=physicalPipeIdentity(fd)}catch{lose(e,'pipe_adapter_unavailable');throw fault()}
      const exact=()=>e.child===child&&!child.stdin.destroyed&&pipeFd(child)===fd
      const gate=():'ok'|'fenced'|'refused'=>{
        try{
          if(!allowed(e)||!exact()||native.fdIdentity(fd)!==stamp||!allowed(e))return 'refused'
          // The request's own fence is the LAST callback (B2a): a command revoked by any authority or
          // descriptor callback above sends nothing. Its refusal is that command's, not the owner's.
          if(e.edgeFence&&!grant(e.edgeFence))return 'fenced'
          // All authority/test callbacks are finished. Registry + builtin fstat
          // run synchronously before one syscall; no libuv write queue exists.
          return !retired&&!e.fenced&&!e.rootExit&&e.state==='owned'&&e.channel==='open'&&e.child===child&&physicalPipeIdentity(fd)===physical?'ok':'refused'
        }catch{/* Any fault in the final fence denies the syscall; the write path records stdio_write_refused. */return 'refused'}
      }
      const output=new Writable({highWaterMark:LIMITS.frameBytes,write(chunk,encoding,callback){
        if(e.writing){lose(e,'stdio_reentrant_write');callback(fault());return}
        e.writing=true
        try{
          const verdict=Buffer.isBuffer(chunk)&&chunk.length<=LIMITS.frameBytes?gate():'refused'
          if(verdict==='fenced'){e.edgeVerdict='fenced';callback();return}
          if(verdict!=='ok'){e.edgeVerdict='refused';lose(e,'stdio_write_refused');callback(fault());return}
          try{
            if(native.write(fd,chunk)!==chunk.length)throw fault()
            e.edgeVerdict='written';callback()
          }catch{/* Partial write, EAGAIN or error: sticky unknown, bytes never retried; the reason is in the snapshot. */e.edgeVerdict='refused';lose(e,'stdio_write_unknown');callback(fault())}
        }finally{e.writing=false}
      },destroy(error,callback){lose(e,'owned_channel_detached');callback(error)}})
      // No corking or async _write callback: Node cannot enqueue later effects.
      // Reject oversized input before Writable converts strings/queues bytes.
      const write=output.write.bind(output)
      output.write=((chunk:unknown,...args:unknown[])=>{
        const length=typeof chunk==='string'?Buffer.byteLength(chunk):Buffer.isBuffer(chunk)||chunk instanceof Uint8Array?chunk.byteLength:NaN
        if(!Number.isSafeInteger(length)||length>LIMITS.frameBytes||!allowed(e)){lose(e,'stdio_write_refused');throw fault()}
        return (write as (...a:unknown[])=>boolean)(chunk,...args)
      }) as typeof output.write
      output.cork=()=>{lose(e,'stdio_queue_forbidden');throw fault()}
      // Transport lifetime ends through destroy. A generic end(chunk) path is
      // unsupported so it cannot bypass the pre-enqueue bound.
      output.end=(()=>{lose(e,'stdio_end_forbidden');throw fault()}) as typeof output.end
      output.on('error',()=>lose(e,'stdio_write_unknown'));e.output=output
      /** One write under a request's fence, which the edge checks after every other callback. A
       * fenced write sent no bytes and reports `'fenced'`; the owner stays open. A write that did not
       * reach the edge synchronously would escape its fence, so it fences the owner instead. */
      const edge=(fence:()=>boolean,write:()=>boolean):boolean|'fenced'=>{
        if(e.edgeFence||e.writing||typeof fence!=='function'){lose(e,'stdio_reentrant_write');throw fault()}
        e.edgeFence=fence;e.edgeVerdict=null
        try{
          const accepted=write(),verdict=e.edgeVerdict
          if(verdict===null){lose(e,'stdio_queue_forbidden');return accepted}
          return verdict==='fenced'?'fenced':accepted
        }finally{e.edgeFence=null;e.edgeVerdict=null}
      }
      return Object.freeze({handle,input:child.stdout,output,stillOwned:()=>allowed(e),edge})
    },
    connectionLost(handle:OwnedBackendHandle){lose(get(handle),'connection_lost')},
    /** Local process effect only; caller supplies the existing durable Stop/
     * cleanup authority. A sent signal never settles a Run or grants a retry. */
    async signalOwned(handle:OwnedBackendHandle,signal:'SIGTERM'|'SIGKILL',stillAllowed:()=>boolean){
      const e=get(handle);if(!['SIGTERM','SIGKILL'].includes(signal)||!e.owned)return{sent:false,reasonCode:'owned_process_unavailable'}
      return boundary.signal(e.owned,signal,()=>entries.get(e.run.runId)===e&&grant(stillAllowed))
    },
    retire(){retired=true;for(const e of entries.values())lose(e,'registry_retired')}
  }
}
