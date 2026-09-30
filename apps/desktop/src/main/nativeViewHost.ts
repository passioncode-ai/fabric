// Main-process-only concrete POSIX view host. No execution journal, provider
// RPC, credential revocation, Run mutation or backend Stop port exists here.
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fstatSync, readFileSync, realpathSync, statSync, writeSync } from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { createProcessBoundary, type OwnedProcess, type ProcessObservation } from './processBoundary.ts'
import { createNativeViewLifecycle, NATIVE_VIEW_LIMITS, type NativeViewOwner, type NativeViewTicket } from './nativeViewLifecycle.ts'

export interface NativeViewLaunchRecipe {
  /** Trusted host allowlist entry, not an executable selected by the renderer. */
  executable: string
  executableSha256: string
  argv: string[]
  cwd: string
  /** Complete explicit environment; process.env is never merged. */
  env: Record<string, string>
  cols: number
  rows: number
}
interface NativePty {
  readonly pid: number
  /** node-pty 1.1.0 POSIX private ABI. Missing/changed ABI is unsupported. */
  readonly fd: number
  onData(cb: (data: string) => void): { dispose(): void }
  onExit(cb: (exit: { exitCode: number; signal?: number }) => void): { dispose(): void }
  on(event: 'close' | 'error', cb: (...args: unknown[]) => void): unknown
}
export interface NativeViewHostOptions {
  owner: NativeViewOwner
  currentOwner(): NativeViewOwner | null
  recipe: NativeViewLaunchRecipe
  timeoutMs?: number
  onOutput?(ticket: NativeViewTicket, data: string, cursor: number): void
  onObservation?(ticket: NativeViewTicket, observation: NativeViewLocalObservation): void
}
export interface NativeViewLocalObservation {
  rootExitObserved: boolean
  exitCode: number | null
  exitSignal: number | null
  processGroup: 'unobserved' | 'active' | 'quiescent' | 'unknown'
  /** Process group observation cannot prove that no descendant escaped unseen. */
  allDescendants: 'unknown'
  inputAvailable: boolean
  reasonCode: string
}
/** Privileged system seams for offline fault injection. Never expose through IPC.
 * Default implementation below uses real node-pty, fstat/writeSync and ps. */
export interface NativeViewHostSystem {
  load(): { version: string; spawn(file: string, argv: string[], options: { cwd: string; env: Record<string,string>; cols: number; rows: number; name: string }): NativePty }
  fdIdentity(fd: number): string
  write(fd: number, bytes: Uint8Array): number
  boundary: ReturnType<typeof createProcessBoundary>
}
const require = createRequire(import.meta.url)
const physicalFdIdentity=(fd:number)=>{const s=fstatSync(fd);if(!s.isCharacterDevice())throw Error('not_pty');return `${s.dev}/${s.ino}/${s.rdev}/${s.mode}`}
const system: NativeViewHostSystem = {
  load: () => ({ version: require('node-pty/package.json').version, spawn: require('node-pty').spawn }),
  fdIdentity: physicalFdIdentity,
  write: (fd,bytes) => writeSync(fd,bytes), boundary: createProcessBoundary()
}
const err = () => Error('native_view_unavailable')
const shape = (v:unknown, keys:string[]):v is Record<string,unknown> => {
  if(!v||typeof v!=='object'||Object.getPrototypeOf(v)!==Object.prototype)return false
  const d=Object.getOwnPropertyDescriptors(v);return Reflect.ownKeys(v).length===keys.length&&keys.every(k=>d[k]&&'value'in d[k])
}
function recipeCopy(v: NativeViewLaunchRecipe): NativeViewLaunchRecipe {
  if(!shape(v,['executable','executableSha256','argv','cwd','env','cols','rows'])||
    typeof v.executable!=='string'||!path.isAbsolute(v.executable)||typeof v.cwd!=='string'||!path.isAbsolute(v.cwd)||
    v.executable.length>4096||v.cwd.length>4096||/[\x00-\x1f]/.test(v.executable+v.cwd)||
    typeof v.executableSha256!=='string'||!/^[a-f0-9]{64}$/.test(v.executableSha256)||
    !Array.isArray(v.argv)||v.argv.length>64||Reflect.ownKeys(v.argv).length!==v.argv.length+1||
    !Number.isInteger(v.cols)||v.cols<20||v.cols>500||!Number.isInteger(v.rows)||v.rows<5||v.rows>200)throw err()
  const argv:string[]=[];let size=0
  for(let i=0;i<v.argv.length;i++){const d=Object.getOwnPropertyDescriptor(v.argv,String(i));if(!d||!('value'in d)||typeof d.value!=='string'||d.value.includes('\0')||(size+=Buffer.byteLength(d.value))>65536)throw err();argv.push(d.value)}
  if(!v.env||typeof v.env!=='object'||Object.getPrototypeOf(v.env)!==Object.prototype||Reflect.ownKeys(v.env).length>128||Reflect.ownKeys(v.env).length!==Object.keys(v.env).length)throw err()
  const env:Record<string,string>={}
  for(const [k,d]of Object.entries(Object.getOwnPropertyDescriptors(v.env))){if(!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(k)||!('value'in d)||typeof d.value!=='string'||d.value.includes('\0')||(size+=Buffer.byteLength(k+d.value))>65536)throw err();Object.defineProperty(env,k,{value:d.value,enumerable:true})}
  const executable=realpathSync(v.executable),cwd=realpathSync(v.cwd),s=statSync(executable)
  if(!statSync(cwd).isDirectory()||!s.isFile()||!(s.mode&0o111)||(s.mode&0o022)||s.size>128*1024*1024||createHash('sha256').update(readFileSync(executable)).digest('hex')!==v.executableSha256)throw err()
  return Object.freeze({executable,executableSha256:v.executableSha256,argv:Object.freeze(argv) as unknown as string[],cwd,env:Object.freeze(env),cols:v.cols,rows:v.rows})
}
interface Entry {
  ticket: NativeViewTicket; handle: NativePty; fd: number; fdStamp: string|null; physicalStamp:string|null; fdClosed: boolean
  rootExit: boolean; exitCode: number|null; exitSignal: number|null; owned: OwnedProcess|null
  group: NativeViewLocalObservation['processGroup']; reason: string; halted: boolean; closed: boolean; cursor: number
  observing?: Promise<void>; closing?: Promise<void>
}
/** One already-owned backend epoch + one allowlisted view recipe. A recipe only
 * constrains what this host spawns; it does not establish backend ownership or
 * prove that an arbitrary executable is semantically a view. Bootstrap owns that
 * allowlist decision. This factory is intentionally absent from renderer IPC. */
export function createNativeViewHost(options: NativeViewHostOptions, native: NativeViewHostSystem = system) {
  // This private-fd identity adapter has native acceptance only on macOS.
  // Linux PTY identity needs its own measured adapter before admission.
  if(process.platform!=='darwin')throw err()
  let recipe:NativeViewLaunchRecipe,adapter:ReturnType<NativeViewHostSystem['load']>
  try{recipe=recipeCopy(options.recipe);adapter=native.load()}catch{throw err()}
  if(adapter.version!=='1.1.0'||typeof adapter.spawn!=='function')throw err()
  const timeout=options.timeoutMs??5000
  if(!Number.isSafeInteger(timeout)||timeout<1||timeout>30000)throw err()
  const entries=new Map<number,Entry>()
  const observeCallback=options.onObservation,outputCallback=options.onOutput
  let checking=false
  const local=(ticket:NativeViewTicket):Entry|undefined=>{
    const e=entries.get(ticket.attachment)
    // Only the coordinator can invoke these private ports. Still compare the
    // full immutable ticket, never just attachment number or a reused PID.
    return e&&JSON.stringify(e.ticket)===JSON.stringify(ticket)?e:undefined
  }
  const observation=(e:Entry):NativeViewLocalObservation=>({rootExitObserved:e.rootExit,exitCode:e.exitCode,exitSignal:e.exitSignal,processGroup:e.group,allDescendants:'unknown',inputAvailable:!e.halted&&!e.fdClosed&&!e.rootExit&&!lifecycle.isAdmissionFenced(),reasonCode:e.reason})
  const emit=(fn:()=>unknown)=>{try{const value=fn();if(value&&typeof (value as PromiseLike<unknown>).then==='function'){void Promise.resolve(value).catch(()=>{});lifecycle.connectionLost(lifecycle.owner.backend.connectionId)}}catch{/* Callback failure becomes sticky owner loss; do not log raw output or callback errors. */lifecycle.connectionLost(lifecycle.owner.backend.connectionId)}}
  const notify=(e:Entry)=>emit(()=>observeCallback?.(e.ticket,Object.freeze(observation(e))))
  const owned=(e:Entry)=>entries.get(e.ticket.attachment)===e&&!e.closed
  const exactFd=(e:Entry)=>{try{return owned(e)&&!e.fdClosed&&!e.rootExit&&e.handle.fd===e.fd&&e.fdStamp!==null&&native.fdIdentity(e.fd)===e.fdStamp}catch{/* Closed or unreadable fd denies the effect; lifecycle returns the typed refusal. */return false}}
  const gate=(e:Entry,fence:()=>boolean,fd=false)=>{
    if(checking)return false
    checking=true
    try{
      if(fence()!==true||!owned(e))return false
      if(!fd)return true
      if(!exactFd(e)||fence()!==true)return false
      // Host callbacks/accessors have finished. The last check uses only our
      // private registry and a closed-over builtin fstat, not another host port.
      return owned(e)&&!e.halted&&!e.fdClosed&&!e.rootExit&&e.physicalStamp!==null&&physicalFdIdentity(e.fd)===e.physicalStamp
    }catch{/* An unavailable fence is a denied effect, reported by the lifecycle receipt. */return false}finally{checking=false}
  }
  const refresh=(e:Entry):Promise<void>=>{
    if(e.observing)return e.observing
    e.observing=(async()=>{
      let sampledExit=e.rootExit
      let state:ProcessObservation=e.owned?await native.boundary.observe(e.owned,sampledExit):{state:'unknown',rootExited:sampledExit,members:[],reasonCode:'capture_unavailable'}
      // Exit can arrive while ps is pending. Do not interpret a pre-exit sample
      // as a failed post-exit closure observation. Root exit is monotonic.
      if(e.owned&&!sampledExit&&e.rootExit){sampledExit=true;state=await native.boundary.observe(e.owned,true)}
      if(entries.get(e.ticket.attachment)!==e)return
      e.group=state.state;e.reason=state.reasonCode
      if(e.rootExit&&state.state==='quiescent'){
        e.closed=true;e.halted=true;lifecycle.viewExited(e.ticket)
      }else if(e.rootExit){e.halted=true;lifecycle.connectionLost(lifecycle.owner.backend.connectionId)}
      notify(e)
    })().catch(()=>{e.group='unknown';e.reason='observation_unavailable';e.halted=true;lifecycle.connectionLost(lifecycle.owner.backend.connectionId);notify(e)}).finally(()=>{e.observing=undefined})
    return e.observing
  }
  const close=(e:Entry,fence:()=>boolean):Promise<void>=>{
    if(e.closed)return Promise.resolve()
    if(e.closing)return e.closing
    const deadline=performance.now()+timeout;e.halted=true
    e.closing=(async()=>{
      if(!e.owned||!gate(e,fence))throw err()
      // Only the captured view group, never a backend PID or mutable "current".
      // No automatic SIGKILL and no node-pty kill/destroy (bare/deferred PID signal).
      await native.boundary.signal(e.owned,'SIGTERM',()=>performance.now()<deadline&&gate(e,fence))
      while(performance.now()<deadline){await refresh(e);if(e.closed)return;if(!gate(e,fence))throw err();await new Promise(r=>setTimeout(r,Math.min(20,Math.max(1,deadline-performance.now()))))}
      throw err()
    })().finally(()=>{e.closing=undefined})
    return e.closing
  }
  const lifecycle=createNativeViewLifecycle(options.owner,{
    currentOwner:options.currentOwner,
    ownsView:ticket=>{const e=local(ticket);return !!e&&owned(e)},
    openView:async(ticket,fence)=>{
      if(entries.has(ticket.attachment)||entries.size>=NATIVE_VIEW_LIMITS.attachments)throw err()
      // Revalidate executable allowlist immediately before the synchronous spawn.
      try{recipeCopy(recipe)}catch{throw err()}
      if(fence()!==true)throw err()
      let h:NativePty
      try{h=adapter.spawn(recipe.executable,[...recipe.argv],{cwd:recipe.cwd,env:{...recipe.env},cols:recipe.cols,rows:recipe.rows,name:'xterm-256color'})}
      catch{
        // Native fork may have succeeded before node-pty throws (e.g. fd setup).
        // Without a returned handle there is no safe PID to infer or signal.
        lifecycle.connectionLost(lifecycle.owner.backend.connectionId);throw err()
      }
      const e:Entry={ticket,handle:h,fd:-1,fdStamp:null,physicalStamp:null,fdClosed:false,rootExit:false,exitCode:null,exitSignal:null,owned:null,group:'unobserved',reason:'view_spawned',halted:false,closed:false,cursor:0}
      entries.set(ticket.attachment,e)
      // Bind callbacks before asynchronous process capture; no early output gap.
      let setupFailed=false
      try{
      e.fd=h.fd
      h.on('close',()=>{e.fdClosed=true;e.halted=true})
      h.on('error',()=>{e.fdClosed=true;e.halted=true;e.reason='pty_error';lifecycle.connectionLost(lifecycle.owner.backend.connectionId);notify(e)})
      h.onExit(value=>{e.rootExit=true;e.fdClosed=true;e.halted=true;e.exitCode=Number.isSafeInteger(value.exitCode)?value.exitCode:null;e.exitSignal=Number.isSafeInteger(value.signal)?value.signal!:null;void refresh(e)})
      h.onData(data=>{
        if(typeof data!=='string'||data.length>1024*1024){e.halted=true;lifecycle.connectionLost(lifecycle.owner.backend.connectionId);return}
        e.cursor+=data.length
        if(!Number.isSafeInteger(e.cursor)||!lifecycle.acceptOutput(ticket,e.cursor))return
        emit(()=>outputCallback?.(ticket,data,e.cursor))
      })
      }catch{/* Preserve the handle for exact compensation below; it returns a fixed unavailable receipt. */setupFailed=true;e.halted=true}
      try{
        if(!Number.isSafeInteger(h.pid)||h.pid<=1)throw err()
        // Capture remains attempted after listener/descriptor setup failure so
        // compensation can still address this exact newly created view group.
        e.owned=await native.boundary.capture(h.pid)
        if(setupFailed||!Number.isSafeInteger(e.fd)||e.fd<0)throw err()
        e.physicalStamp=physicalFdIdentity(e.fd)
        e.fdStamp=native.fdIdentity(e.fd)
        if(!gate(e,fence,true))throw err()
        e.group='active';e.reason='view_attached';notify(e)
        return {ticket,opened:true}
      }catch{e.halted=true;e.reason='view_open_unconfirmed';throw err()}
    },
    writeView:async(ticket,text,fence)=>{
      const e=local(ticket)
      if(!e||e.halted||typeof text!=='string'||!text.length||text.length>NATIVE_VIEW_LIMITS.inputChars)throw err()
      const bytes=Buffer.from(text)
      if(bytes.length>65536||!gate(e,fence,true)||e.halted)throw err()
      try{
        // A single synchronous syscall; node-pty.write queues invisible retries.
        // Partial progress is ambiguous and must never be retried automatically.
        const count=native.write(e.fd,bytes)
        if(count!==bytes.length)throw err()
      }catch{e.halted=true;e.reason='view_write_unknown';throw err()}
      return {ticket,written:true}
    },
    closeView:async(ticket,fence)=>{const e=local(ticket);if(!e)throw err();await close(e,fence);return {ticket,closed:true}},
    disposeView:async(ticket,fence)=>{const e=local(ticket);if(!e)throw err();await close(e,fence);return {ticket,closed:true}}
  },{timeoutMs:timeout})
  return {
    // Observed-exit/output acknowledgment hooks are host-private. Consumers
    // cannot manufacture a closure receipt or advance a display cursor.
    lifecycle:Object.freeze({owner:lifecycle.owner,attach:lifecycle.attach,reconnect:lifecycle.reconnect,detach:lifecycle.detach,write:lifecycle.write,snapshot:lifecycle.snapshot,isAdmissionFenced:lifecycle.isAdmissionFenced,connectionLost:lifecycle.connectionLost,retire:lifecycle.retire}),
    snapshot(){return {owner:lifecycle.snapshot(),views:[...entries.values()].map(e=>({ticket:e.ticket,...observation(e)}))}},
    /** Explicit local observation; never establishes provider quiescence. */
    async inspect(ticket:NativeViewTicket){const e=[...entries.values()].find(e=>e.ticket===ticket);if(!e)throw err();await refresh(e);return Object.freeze(observation(e))}
  }
}
