// Test-only T3b: authenticated complete WebSocket transport, one fresh thread,
// no turns, credentials, approvals or arbitrary execution. Not a product adapter.
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { createHash, timingSafeEqual } from 'node:crypto'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
const require = createRequire(new URL('../fixtures/codex-tui-probe/package.json', import.meta.url))
const { WebSocket, WebSocketServer } = require('ws')
const Ajv = require('ajv')
const manifest=JSON.parse(readFileSync(new URL('../fixtures/codex-tui-probe/schema-digests.json',import.meta.url)))
const obj=v=>v!==null && typeof v==='object' && !Array.isArray(v)
const keys=(v,allowed)=>obj(v)&&Object.keys(v).every(k=>allowed.includes(k))
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9._:-]{1,96}$/.test(v)||Number.isSafeInteger(v)&&v>=1
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const requests={
  initialize:['v1/InitializeParams','v1/InitializeResponse'],
  'account/read':['v2/GetAccountParams','v2/GetAccountResponse'],
  'config/read':['v2/ConfigReadParams','v2/ConfigReadResponse'],
  'model/list':['v2/ModelListParams','v2/ModelListResponse'],
  'configRequirements/read':[null,'v2/ConfigRequirementsReadResponse'],
  'collaborationMode/list':['v2/CollaborationModeListParams','v2/CollaborationModeListResponse'],
  'hooks/list':['v2/HooksListParams','v2/HooksListResponse'],
  'skills/list':['v2/SkillsListParams','v2/SkillsListResponse'],
  'thread/loaded/list':['v2/ThreadLoadedListParams','v2/ThreadLoadedListResponse'],
  'thread/list':['v2/ThreadListParams','v2/ThreadListResponse'],
  'thread/read':['v2/ThreadReadParams','v2/ThreadReadResponse'],
  'thread/turns/list':['v2/ThreadTurnsListParams','v2/ThreadTurnsListResponse'],
  'thread/start':['v2/ThreadStartParams','v2/ThreadStartResponse'],
  'thread/unsubscribe':['v2/ThreadUnsubscribeParams','v2/ThreadUnsubscribeResponse']
}
// Authored method vocabulary from pinned ServerNotification.json; diagnostic labels
// only. This does not add any message to the forwarding allowlist.
// Diagnostic-only authored labels from pinned ClientRequest; never permissions.
const knownProtocolRequests=["initialize", "server/diagnostics", "userVerification/status", "userVerification/enroll", "userVerification/delete", "userVerification/verify", "userVerification/cancel", "thread/start", "thread/resume", "thread/fork", "thread/archive", "thread/delete", "thread/unsubscribe", "thread/increment_elicitation", "thread/decrement_elicitation", "thread/name/set", "thread/goal/set", "thread/goal/get", "thread/goal/clear", "thread/queue/add", "thread/queue/list", "thread/queue/update", "thread/queue/delete", "thread/queue/reorder", "thread/queue/start", "thread/metadata/update", "thread/attachment/add", "thread/attachment/list", "thread/attachment/remove", "thread/section/move", "thread/settings/update", "thread/memoryMode/set", "memory/status", "memory/reset", "rollout/compress", "thread/unarchive", "thread/compact/start", "thread/shellCommand", "thread/approveGuardianDeniedAction", "thread/backgroundTerminals/clean", "thread/backgroundTerminals/list", "thread/backgroundTerminals/terminate", "thread/revert", "thread/list", "project/list", "project/read", "project/create", "project/import", "project/update", "project/move", "project/delete", "threadSection/list", "threadSection/create", "threadSection/update", "threadSection/delete", "thread/search", "thread/searchOccurrences", "thread/loaded/list", "thread/read", "thread/turns/list", "thread/items/list", "thread/inject_items", "skills/list", "skills/extraRoots/set", "hooks/list", "marketplace/add", "marketplace/remove", "marketplace/upgrade", "plugin/list", "plugin/search", "plugin/installed", "plugin/reconcile", "plugin/read", "plugin/skill/read", "plugin/share/save", "plugin/share/updateTargets", "plugin/share/list", "plugin/share/checkout", "plugin/share/delete", "app/read", "app/list", "app/installed", "fs/readFile", "fs/writeFile", "fs/createDirectory", "fs/getMetadata", "fs/readDirectory", "fs/remove", "fs/copy", "fs/watch", "fs/unwatch", "skills/config/write", "plugin/install", "plugin/uninstall", "turn/start", "turn/settings/update", "turn/steer", "turn/interrupt", "thread/realtime/start", "thread/realtime/appendAudio", "thread/realtime/appendText", "thread/realtime/appendSpeech", "thread/realtime/stop", "thread/timeline/list", "thread/realtime/listVoices", "review/start", "model/list", "account/gatewayOAuth/read", "account/gatewayOAuth/login", "account/gatewayOAuth/cancel", "modelProvider/capabilities/read", "experimentalFeature/list", "permissionProfile/list", "experimentalFeature/enablement/set", "remoteControl/enable", "remoteControl/disable", "remoteControl/status/read", "remoteControl/pairing/start", "remoteControl/pairing/status", "remoteControl/client/list", "remoteControl/client/revoke", "collaborationMode/list", "mock/experimentalMethod", "environment/add", "environment/info", "environment/status", "mcpServer/oauth/login", "config/mcpServer/reload", "mcpServerStatus/list", "mcpServer/resource/read", "mcpServer/event/stream/start", "mcpServer/event/stream/stop", "mcpServer/tool/call", "windowsSandbox/setupStart", "windowsSandbox/readiness", "account/login/start", "account/bedrock/discover", "account/bedrock/setup", "account/login/cancel", "account/logout", "account/rateLimits/read", "account/rateLimitResetCredit/consume", "account/usage/read", "account/workspaceMessages/read", "account/sendAddCreditsNudgeEmail", "feedback/upload", "command/exec", "command/exec/write", "command/exec/terminate", "command/exec/resize", "process/spawn", "process/writeStdin", "process/kill", "process/resizePty", "config/read", "externalAgentConfig/detect", "externalAgentConfig/import", "externalAgentConfig/import/recordHistory", "externalAgentConfig/import/readHistories", "config/value/write", "config/batchWrite", "configRequirements/read", "account/read", "fuzzyFileSearch", "fuzzyFileSearch/sessionStart", "fuzzyFileSearch/sessionUpdate", "fuzzyFileSearch/sessionStop"]
const knownProtocolNotifications=["error", "thread/started", "thread/status/changed", "thread/archived", "thread/deleted", "thread/unarchived", "thread/closed", "thread/reverted", "skills/changed", "thread/name/updated", "thread/attachment/updated", "thread/goal/updated", "thread/goal/cleared", "thread/queue/changed", "project/changed", "thread/project/updated", "thread/environment/connected", "thread/environment/disconnected", "thread/settings/updated", "thread/tokenUsage/updated", "turn/started", "hook/started", "turn/completed", "hook/completed", "turn/diff/updated", "turn/plan/updated", "item/started", "item/autoApprovalReview/started", "item/autoApprovalReview/completed", "autoApprovalReview/strictReviewRequired", "item/completed", "item/agentMessage/delta", "item/plan/delta", "command/exec/outputDelta", "process/outputDelta", "process/exited", "item/commandExecution/outputDelta", "item/commandExecution/terminalInteraction", "item/fileChange/outputDelta", "item/fileChange/patchUpdated", "serverRequest/resolved", "item/mcpToolCall/progress", "mcpServer/oauthLogin/completed", "mcpServer/startupStatus/updated", "mcpServer/event/stream/notification", "account/updated", "account/gatewayOAuth/changed", "account/rateLimits/updated", "app/list/updated", "remoteControl/status/changed", "externalAgentConfig/import/progress", "externalAgentConfig/import/completed", "fs/changed", "item/reasoning/summaryTextDelta", "item/reasoning/summaryPartAdded", "item/reasoning/textDelta", "thread/compacted", "model/rerouted", "model/verification", "modelProvider/authRecoveryStarted", "modelProvider/authRecoveryCompleted", "turn/moderationMetadata", "model/safetyBuffering/updated", "warning", "guardianWarning", "deprecationNotice", "configWarning", "fuzzyFileSearch/sessionUpdated", "fuzzyFileSearch/sessionCompleted", "thread/realtime/started", "thread/realtime/itemAdded", "thread/realtime/item/started", "thread/realtime/item/transcript/delta", "thread/realtime/item/completed", "thread/realtime/transcript/delta", "thread/realtime/transcript/done", "thread/realtime/outputAudio/delta", "thread/realtime/sdp", "thread/realtime/error", "thread/realtime/closed", "windows/worldWritableWarning", "windowsSandbox/setupCompleted", "account/login/completed"]
let cachedSchemas
export function loadProbeSchemas(directory=process.env.FABRIC_CODEX_TUI_SCHEMA_DIR??'/tmp/fabric-codex-protocol-01571') {
  if(cachedSchemas?.directory===directory)return cachedSchemas.validators
  const ajv=new Ajv({strict:false,allErrors:false,validateFormats:false}),validators={}
  for(const [name,digest] of Object.entries(manifest)) {
    const bytes=readFileSync(path.join(directory,name))
    if(createHash('sha256').update(bytes).digest('hex')!==digest)throw new Error('unreviewed_schema_bytes')
    validators[name.slice(0,-5)]=ajv.compile(JSON.parse(bytes))
  }
  cachedSchemas={directory,validators};return validators
}
export { WebSocket }
export async function createNativeProbeGateway({upstreamPort,upstreamToken,frontendToken,profile,cwd,
  schemaDirectory,timeoutMs=20_000}) {
  if(!Number.isInteger(upstreamPort)||upstreamPort<1||upstreamPort>65535||
    !/^[a-f0-9]{64}$/.test(upstreamToken)||!/^[a-f0-9]{64}$/.test(frontendToken)||upstreamToken===frontendToken||
    !path.isAbsolute(profile)||!path.isAbsolute(cwd)||!Number.isInteger(timeoutMs)||timeoutMs<20||timeoutMs>30_000)
    throw new Error('invalid_gateway_configuration')
  const schemas=loadProbeSchemas(schemaDirectory)
  const server=createServer((_req,res)=>{res.writeHead(404);res.end()})
  const wss=new WebSocketServer({noServer:true,maxPayload:65_536,perMessageDeflate:false,clientTracking:false})
  let phase='new',reason=null,client=null,upstream=null,claimed=false,bytes=0,messageCount=0,started=false,threadId=null,ownedSessionId=null,threadStartReply=false,remoteStatusShape=null,invalidRequestShape=null,threadReplyShape=null,exitArmed=false,unsubscribeReply=false,unsubscribeStatus=null,dynamicToolsRejected=false,retryIntent=null
  const deadline=performance.now()+timeoutMs,pending=new Map(),seen=new Set(),counts={},observations=[]
  let finishResolve,finishOnce=false,listenerClosed=false,cleanupTimer=null
  const finished=new Promise(resolve=>{finishResolve=resolve})
  const sockets=new Set()
  const finish=(status)=>{if(!finishOnce){finishOnce=true;clearTimeout(cleanupTimer);finishResolve({status})}}
  const checkClosed=()=>{if(reason && listenerClosed && sockets.size===0 && (!client||client.readyState===WebSocket.CLOSED) &&
    (!upstream||upstream.readyState===WebSocket.CLOSED))finish('closed')}
  const close=(why)=>{if(reason!==null)return;reason=why;phase='closed';clearTimeout(timer)
    cleanupTimer=setTimeout(()=>finish('unknown'),1500)
    client?.terminate();upstream?.terminate();for(const socket of sockets)socket.destroy()
    server.close(()=>{listenerClosed=true;checkClosed()});checkClosed()}
  server.on('close',()=>{listenerClosed=true;checkClosed()})
  const timer=setTimeout(()=>close('deadline'),timeoutMs);timer.unref()
  const alive=()=>{if(reason)return false;if(performance.now()>=deadline){close('deadline');return false}return true}
  const record=(direction,method)=>observations.push({direction,method})
  const send=(socket,value,direction,method)=>{
    const wire=JSON.stringify(value)
    if(!alive())return false
    if(socket?.readyState!==WebSocket.OPEN||socket.bufferedAmount+Buffer.byteLength(wire)>131_072){close('write_unavailable');return false}
    socket.send(wire,{binary:false},error=>{if(error)close('write_failed')});record(direction,method);return true
  }
  const decode=(data,binary)=>{
    if(!alive())return null
    bytes+=data.byteLength;messageCount++
    if(binary||bytes>1_048_576||messageCount>96){close('message_bound');return null}
    let text,value
    try {text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(data)
      let depth=0,quoted=false,escape=false,compact=''
      for(const ch of text){if(quoted){compact+=ch;if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch==='"')quoted=false}
        else if(ch==='"'){quoted=true;compact+=ch}else{if(ch==='{'||ch==='['){if(++depth>24)throw new Error()}
          else if(ch==='}'||ch===']')depth--;if(!/[ \r\n\t]/.test(ch))compact+=ch}}
      value=JSON.parse(text);if(!obj(value)||JSON.stringify(value)!==compact)throw new Error()
    }catch{close('invalid_message');return null}
    if(!alive())return null;return value
  }
  const schema=(name,value)=>name===null?value==null:schemas[name](value)
  const onlyNullOr=(params,key,allowed)=>!Object.hasOwn(params,key)||params[key]===null||allowed(params[key])
  const validRequest=(method,p)=>{
    if(method==='initialize')return keys(p,['clientInfo','capabilities'])&&keys(p.clientInfo,['name','version','title'])&&
      p.clientInfo.name==='codex-tui'&&p.clientInfo.version==='0.157.1'&&onlyNullOr(p.clientInfo,'title',()=>false)&&
      keys(p.capabilities,['experimentalApi','explicitGatewayOauth','requestAttestation','extensions','mcpServerOpenaiFormElicitation','optOutNotificationMethods'])&&
      p.capabilities.experimentalApi===true&&['explicitGatewayOauth','requestAttestation','mcpServerOpenaiFormElicitation'].every(k=>!Object.hasOwn(p.capabilities,k)||p.capabilities[k]===false)&&
      onlyNullOr(p.capabilities,'extensions',()=>false)&&onlyNullOr(p.capabilities,'optOutNotificationMethods',v=>eq(v,[]))
    // Pinned account.rs:550 omits false on serialization and defaults absent to false.
    if(method==='account/read')return eq(p,{refreshToken:false})||eq(p,{})
    if(method==='config/read')return keys(p,['cwd','includeLayers'])&&(p.cwd==='.'||p.cwd===cwd)&&(!Object.hasOwn(p,'includeLayers')||p.includeLayers===false)
    if(method==='configRequirements/read')return p==null
    if(method==='collaborationMode/list')return eq(p,{})
    if(method==='model/list')return keys(p,['cursor','limit','includeHidden'])&&p.includeHidden===true&&onlyNullOr(p,'cursor',()=>false)&&onlyNullOr(p,'limit',()=>false)
    if(method==='hooks/list'||method==='skills/list')return keys(p,method==='skills/list'?['cwds','forceReload']:['cwds'])&&
      (!Object.hasOwn(p,'cwds')||eq(p.cwds,[])||eq(p.cwds,[cwd]))&&(!Object.hasOwn(p,'forceReload')||typeof p.forceReload==='boolean')
    if(method==='thread/list')return started&&keys(p,['originators','cursor','limit','sortKey','sortDirection','modelProviders','sourceKinds','archived','sectionId','projectId','parentThreadId','ancestorThreadId','cwd','useStateDbOnly','searchTerm'])&&p.limit===10&&p.sortKey==='recency_at'&&eq(p.modelProviders,[])&&(eq(p.sourceKinds,[])||eq(p.sourceKinds,['exec','appServer']))&&p.archived===false&&p.useStateDbOnly===true&&['originators','cursor','sortDirection','sectionId','projectId','parentThreadId','ancestorThreadId','cwd','searchTerm'].every(k=>onlyNullOr(p,k,()=>false))
    if(method==='thread/read')return threadId!==null&&eq(p,{threadId,includeTurns:false})
    if(method==='thread/turns/list')return threadId!==null&&keys(p,['threadId','cursor','limit','sortDirection','itemsView'])&&p.threadId===threadId&&p.limit===1&&['cursor','sortDirection','itemsView'].every(k=>onlyNullOr(p,k,()=>false))
    if(method==='thread/loaded/list')return started&&keys(p,['cursor','limit'])&&onlyNullOr(p,'cursor',()=>false)&&onlyNullOr(p,'limit',()=>false)
    if(method==='thread/unsubscribe')return exitArmed&&threadStartReply&&eq(p,{threadId})
    if(method==='thread/start')return keys(p,['model','modelProvider','serviceTier','cwd','runtimeWorkspaceRoots','approvalPolicy','approvalsReviewer','sandbox','permissions','config','ephemeral','historyMode','sessionStartSource','threadSource','developerInstructions','baseInstructions','dynamicTools','environments','experimentalRawEvents','allowProviderModelFallback','personality','projectId','selectedCapabilityRoots','serviceName','mockExperimentalField','multiAgentMode','daybreakEnabled'])&&
      onlyNullOr(p,'model',v=>v==='gpt-5.4')&&onlyNullOr(p,'modelProvider',()=>false)&&onlyNullOr(p,'cwd',v=>v===cwd)&&
      onlyNullOr(p,'runtimeWorkspaceRoots',()=>false)&&p.approvalPolicy==='never'&&onlyNullOr(p,'approvalsReviewer',v=>v==='user')&&
      p.sandbox==='read-only'&&onlyNullOr(p,'permissions',()=>false)&&onlyNullOr(p,'config',v=>eq(v,{})||eq(v,{web_search:'disabled'}))&&p.ephemeral===false&&p.historyMode==='paginated'&&
      onlyNullOr(p,'sessionStartSource',v=>v==='startup')&&p.threadSource==='user'&&
      ['serviceTier','developerInstructions','baseInstructions','dynamicTools','environments','personality','projectId','selectedCapabilityRoots','serviceName','mockExperimentalField','multiAgentMode','daybreakEnabled'].every(k=>onlyNullOr(p,k,()=>false))&&
      (!Object.hasOwn(p,'experimentalRawEvents')||p.experimentalRawEvents===false)&&(!Object.hasOwn(p,'allowProviderModelFallback')||p.allowProviderModelFallback===false)
    return false
  }
  const notificationEnvelope=v=>keys(v,['method','params','jsonrpc','emittedAtMs'])&&(!Object.hasOwn(v,'jsonrpc')||v.jsonrpc==='2.0')&&(!Object.hasOwn(v,'emittedAtMs')||Number.isSafeInteger(v.emittedAtMs)&&v.emittedAtMs>=0)
  const ownedThread=t=>obj(t)&&uuid(t.id)&&uuid(t.sessionId)&&(!ownedSessionId||t.sessionId===ownedSessionId)&&t.parentThreadId==null&&t.forkedFromId==null&&['cli','appServer','vscode'].includes(t.source)&&t.cwd===cwd&&t.modelProvider==='probe-local'&&t.ephemeral===false&&t.preview===''&&t.projectId===null&&Array.isArray(t.turns)&&t.turns.length===0
  server.on('connection',socket=>{
    if(reason){socket.destroy();return}
    sockets.add(socket);socket.on('close',()=>{sockets.delete(socket);checkClosed()})
    if(sockets.size>4){close('connection_bound');return}
    socket.setTimeout(3000,()=>socket.destroy())
  })
  server.on('upgrade',(req,socket,head)=>{
    const auth=req.headers.authorization,want=`Bearer ${frontendToken}`
    const authorized=typeof auth==='string'&&Buffer.byteLength(auth)===Buffer.byteLength(want)&&timingSafeEqual(Buffer.from(auth),Buffer.from(want))
    if(!authorized||req.url!=='/'||req.headers.origin||!alive()||claimed){socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');return}
    claimed=true
    wss.handleUpgrade(req,socket,head,ws=>{
      client=ws;socket.setTimeout(0)
      ws.on('error',()=>close('client_transport_error'));ws.on('close',()=>{close('view_disconnected');checkClosed()})
      upstream=new WebSocket(`ws://127.0.0.1:${upstreamPort}/`,{headers:{Authorization:`Bearer ${upstreamToken}`},maxPayload:65_536,perMessageDeflate:false,handshakeTimeout:3000})
      upstream.on('error',()=>close('backend_transport_error'));upstream.on('close',()=>{if(!reason)close('backend_disconnected');checkClosed()})
      // The client cannot send into an unready upstream queue. Pause inbound socket
      // until the authenticated backend socket is ready; ws retains bounded parser.
      ws.pause();upstream.once('open',()=>{if(alive())ws.resume()})
      ws.on('message',(data,binary)=>{
        const v=decode(data,binary);if(!v)return
        if(typeof v.method!=='string'||v.method.length>128){close('invalid_method');return}
        if(v.method==='initialized'){
          if(phase!=='awaiting_initialized'||!keys(v,['method','params','jsonrpc'])||(v.params!=null)||Object.hasOwn(v,'jsonrpc')&&v.jsonrpc!=='2.0'){close('invalid_initialized');return}
          phase='ready';send(upstream,v,'upstream','initialized');return
        }
        if(!id(v.id)){close('invalid_request_id');return}
        // Optional plugin inventory is explicitly unavailable, never fetched.
        if(v.method==='plugin/list'){
          const p=v.params,key=typeof v.id+':'+v.id,refusalPhase=threadStartReply?'pluginRefusedAfterThread':'pluginRefusedBeforeThread'
          if(phase!=='ready'||counts[refusalPhase]||!keys(v,['id','method','params','jsonrpc'])||!id(v.id)||Object.hasOwn(v,'jsonrpc')&&v.jsonrpc!=='2.0'||seen.has(key)||!schemas['v2/PluginListParams'](p)||!keys(p,['cwds','marketplaceKinds','forceRefetch'])||!eq(p.cwds,[cwd])||!onlyNullOr(p,'marketplaceKinds',()=>false)||Object.hasOwn(p,'forceRefetch')&&p.forceRefetch!==false){invalidRequestShape={method:'plugin/list',schemaValid:schemas['v2/PluginListParams'](p),cwdMatches:eq(p?.cwds,[cwd]),marketplaceNull:p?.marketplaceKinds==null,forceFalse:p?.forceRefetch===false,forceAbsent:!Object.hasOwn(p??{},'forceRefetch'),repeat:!!counts[refusalPhase]};record('denied','plugin/list');close('invalid_plugin_read');return}
          seen.add(key);counts[refusalPhase]=1;counts.pluginInventoryRefused=(counts.pluginInventoryRefused??0)+1;send(ws,{id:v.id,error:{code:-32601,message:'plugin inventory unavailable in this probe'}},'local_rejection','plugin/list');return
        }
        if(!keys(v,['id','method','params','jsonrpc'])||!id(v.id)||Object.hasOwn(v,'jsonrpc')&&v.jsonrpc!=='2.0'||!Object.hasOwn(requests,v.method)){
          if(knownProtocolRequests.includes(v.method))record('denied',v.method)
          close('method_not_allowed');return
        }
        const pair=requests[v.method],key=typeof v.id+':'+v.id
        // Exact native compatibility fallback; denied tools never reach backend.
        if(v.method==='thread/start'&&phase==='ready'&&!started&&!dynamicToolsRejected&&!seen.has(key)&&pending.size<8&&schema(pair[0],v.params)&&Array.isArray(v.params.dynamicTools)&&
          typeof v.id==='string'&&v.id.startsWith('startup-thread-start-')&&uuid(v.id.slice(21))&&validRequest(v.method,{...v.params,dynamicTools:null})){
          dynamicToolsRejected=true;seen.add(key);retryIntent=JSON.stringify({...v.params,dynamicTools:null})
          send(ws,{id:v.id,error:{code:-32602,message:'dynamicTools unsupported by this probe'}},'local_rejection','thread/start');return
        }
        if(v.method==='thread/start'&&dynamicToolsRejected&&(typeof v.id!=='string'||!v.id.startsWith('legacy-thread-start-')||!uuid(v.id.slice(20))||JSON.stringify({...v.params,dynamicTools:null})!==retryIntent)){
          record('denied','thread/start');close('invalid_retry');return
        }
        if(seen.has(key)||pending.size>=8||!schema(pair[0],v.params)||!validRequest(v.method,v.params)){
          invalidRequestShape={method:v.method,schemaValid:schema(pair[0],v.params),policyValid:validRequest(v.method,v.params),repeatedId:seen.has(key),pendingBound:pending.size>=8}
          if(v.method==='thread/start'&&obj(v.params)){
            const p=v.params
            invalidRequestShape.thread={model:onlyNullOr(p,'model',v=>v==='gpt-5.4'),provider:onlyNullOr(p,'modelProvider',()=>false),cwd:onlyNullOr(p,'cwd',v=>v===cwd),cwdDot:p.cwd==='.',roots:onlyNullOr(p,'runtimeWorkspaceRoots',()=>false),approval:p.approvalPolicy==='never',reviewer:onlyNullOr(p,'approvalsReviewer',v=>v==='user'),sandbox:p.sandbox==='read-only',permissions:onlyNullOr(p,'permissions',()=>false),config:onlyNullOr(p,'config',v=>eq(v,{})||eq(v,{web_search:'disabled'})),ephemeral:p.ephemeral===false,history:p.historyMode==='paginated',source:p.threadSource==='user',sessionStart:onlyNullOr(p,'sessionStartSource',v=>v==='startup'),nullFields:Object.fromEntries(['serviceTier','developerInstructions','baseInstructions','dynamicTools','environments','personality','projectId','selectedCapabilityRoots','serviceName','mockExperimentalField','multiAgentMode','daybreakEnabled'].map(k=>[k,onlyNullOr(p,k,()=>false)])),raw:!Object.hasOwn(p,'experimentalRawEvents')||p.experimentalRawEvents===false,fallback:!Object.hasOwn(p,'allowProviderModelFallback')||p.allowProviderModelFallback===false}
          }
          record('denied',v.method);close('invalid_request');return
        }
        if(v.method==='initialize'){if(phase!=='new'||v.id!=='initialize'){close('invalid_order');return}phase='initializing'}
        else if(phase!=='ready'){close('invalid_order');return}
        if(v.method==='thread/list'){const variant=eq(v.params.sourceKinds,[])?'thread/list:interactive':'thread/list:service';if(counts[variant]){close('request_count');return}counts[variant]=1}
        counts[v.method]=(counts[v.method]??0)+1
        if(counts[v.method]>(v.method==='thread/list'?2:['skills/list','hooks/list'].includes(v.method)?3:1)){close('request_count');return}
        if(v.method==='thread/start')started=true
        seen.add(key);pending.set(key,{method:v.method,id:v.id});send(upstream,v,'upstream',v.method)
      })
      upstream.on('message',(data,binary)=>{
        const v=decode(data,binary);if(!v)return
        if(v.method!==undefined){
          if(typeof v.method!=='string'||v.method.length>128){close('invalid_method');return}
          if(v.method==='remoteControl/status/changed'){
            const p=v.params
            remoteStatusShape={schemaValid:schemas['v2/RemoteControlStatusChangedNotification'](p),envelopeValid:notificationEnvelope(v),hasId:Object.hasOwn(v,'id'),idNull:v.id===null,knownExtraFields:['trace','_meta','seq','sequenceNumber','timestamp','eventId','traceId','spanId','requestId'].filter(k=>Object.hasOwn(v,k)),
              phaseAllowed:['awaiting_initialized','ready'].includes(phase),statusDisabled:p?.status==='disabled',
              environment:!Object.hasOwn(p??{},'environmentId')?'absent':p.environmentId===null?'null':'other',
              installation:p?.installationId===''?'empty':typeof p?.installationId==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(p.installationId)?'bounded':'invalid',
              serverName:p?.serverName===''?'empty':typeof p?.serverName==='string'&&p.serverName.length<=128&&!/[\u0000-\u001f]/.test(p.serverName)?'bounded':'invalid'}
            if(!notificationEnvelope(v)||
              !['awaiting_initialized','ready'].includes(phase)||counts.remoteStatus||
              !schemas['v2/RemoteControlStatusChangedNotification'](p)||!keys(p,['status','environmentId','installationId','serverName'])||
              p.status!=='disabled'||p.environmentId!==null||!/^[a-zA-Z0-9_-]{1,128}$/.test(p.installationId)||
              typeof p.serverName!=='string'||p.serverName.length<1||p.serverName.length>128||/[\u0000-\u001f]/.test(p.serverName)){
              record('denied','remoteControl/status/changed');close('unexpected_server_message');return
            }
            counts.remoteStatus=1;send(ws,v,'downstream','remoteControl/status/changed');return
          }
          if(!notificationEnvelope(v)||v.method!=='thread/started'||!started||!schemas['v2/ThreadStartedNotification'](v.params)||!ownedThread(v.params.thread)||
            threadId&&threadId!==v.params.thread.id){if(knownProtocolNotifications.includes(v.method))record('denied',v.method);close('unexpected_server_message');return}
          threadId=v.params.thread.id;ownedSessionId=v.params.thread.sessionId;send(ws,v,'downstream','thread/started');return
        }
        if(!id(v.id)){close('invalid_reply_id');return}
        const key=typeof v.id+':'+v.id,p= pending.get(key)
        if(!keys(v,['id','result','jsonrpc'])||!p||Object.hasOwn(v,'jsonrpc')&&v.jsonrpc!=='2.0'||!schema(requests[p.method][1],v.result)){close('invalid_reply');return}
        if(p.method==='initialize'){
          if(v.result.codexHome!==profile||v.result.platformOs!=='macos'||v.result.platformFamily!=='unix'){close('foreign_backend');return}
          phase='awaiting_initialized'
        }
        if(p.method==='account/read'&&(v.result.account!==null||v.result.requiresOpenaiAuth!==false||v.result.workspaceRouting!=null)){close('nonfixture_account');return}
        if(p.method==='config/read'&&(v.result.config.model_provider!=='probe-local'||v.result.config.sandbox_mode!=='read-only'||v.result.config.approval_policy!=='never'||v.result.config.web_search!=='disabled'||v.result.config.features?.plugins!==false||v.result.layers!=null)){close('foreign_config');return}
        if(p.method==='thread/start'){
          const r=v.result,t=r.thread
          threadReplyShape={owned:ownedThread(t),id:uuid(t.id),session:uuid(t.sessionId),sessionMatches:!ownedSessionId||t.sessionId===ownedSessionId,parentAbsent:t.parentThreadId==null,forkAbsent:t.forkedFromId==null,sourceCli:t.source==='cli',sourceAppServer:t.source==='appServer',sourceVscode:t.source==='vscode',cwd:t.cwd===cwd,provider:t.modelProvider==='probe-local',ephemeral:t.ephemeral===false,preview:t.preview==='',project:t.projectId===null,turns:t.turns.length===0,resultCwd:r.cwd===cwd,resultModel:r.model==='gpt-5.4',resultProvider:r.modelProvider==='probe-local',approval:r.approvalPolicy==='never',reviewer:r.approvalsReviewer==='user',sandbox:r.sandbox.type==='readOnly',noNetwork:r.sandbox.networkAccess!==true}

          if(!ownedThread(v.result.thread)||threadId&&threadId!==v.result.thread.id||v.result.modelProvider!=='probe-local'||v.result.cwd!==cwd||v.result.model!=='gpt-5.4'||v.result.approvalPolicy!=='never'||v.result.approvalsReviewer!=='user'||v.result.sandbox.type!=='readOnly'||v.result.sandbox.networkAccess===true){close('foreign_thread');return}
          threadId=v.result.thread.id;ownedSessionId=v.result.thread.sessionId;threadStartReply=true
        }
        if(p.method==='thread/list'&&(!keys(v.result,['data','nextCursor','backwardsCursor'])||v.result.nextCursor!=null||v.result.backwardsCursor!=null||v.result.data.length>1||v.result.data.some(t=>!ownedThread(t)||!threadId||t.id!==threadId))){close('foreign_thread_list');return}
        if(p.method==='thread/read'&&(!keys(v.result,['thread'])||!ownedThread(v.result.thread)||v.result.thread.id!==threadId)){close('foreign_thread_read');return}
        if(p.method==='thread/turns/list'&&(!keys(v.result,['data','nextCursor','backwardsCursor'])||v.result.nextCursor!=null||v.result.backwardsCursor!=null||v.result.data.length!==0)){close('nonempty_turns');return}
        if(p.method==='thread/loaded/list'&&(!keys(v.result,['data','nextCursor'])||v.result.nextCursor!=null||v.result.data.length>1||v.result.data.some(id=>!uuid(id)||!threadId||id!==threadId))){close('foreign_loaded_thread');return}
        if(p.method==='thread/unsubscribe'){if(!keys(v.result,['status'])){close('invalid_unsubscribe_reply');return}unsubscribeReply=true;unsubscribeStatus=v.result.status}
        pending.delete(key);send(ws,v,'downstream',p.method)
      })
    })
  })
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
  return {port:server.address().port,armExit:(ownedId)=>{if(!alive()||!threadStartReply||exitArmed||ownedId!==threadId)return false;exitArmed=true;return true},close:()=>close('owner_closed'),finished,
    snapshot:()=>({phase,reason,dynamicToolsRejected,threadId,threadStartReply,exitArmed,unsubscribeReply,unsubscribeStatus,remoteStatusShape,invalidRequestShape,threadReplyShape,methodCounts:{...counts},threadStartRequests:counts['thread/start']??0,bytes,messageCount,observations:[...observations]})}
}
