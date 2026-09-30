// MANUAL T3b: native view + one owned empty thread. Never a model turn.
// Run the real-WS gateway fixture tests first. No production capability promotion.
import { spawn,execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtempSync,mkdirSync,realpathSync,writeFileSync,rmSync } from 'node:fs'
import { tmpdir,homedir } from 'node:os'
import { randomBytes,createHash } from 'node:crypto'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { fileURLToPath } from 'node:url'
import { createNativeProbeGateway,WebSocket,loadProbeSchemas } from './helpers/codex-tui-native-probe-gateway.mjs'
const check=(v,reason)=>{if(!v)throw new Error(reason)},sleep=ms=>new Promise(r=>setTimeout(r,ms))
const codes=new Set(['unreviewed_build','backend_ready_timeout','backend_exited','gateway_denied','native_ready_timeout','model_migration_prompt','native_exit_timeout','native_exit_failed','inference_attempted','observer_failed','thread_survival_unproved','backend_cleanup_failed','pty_cleanup_failed','sandbox_negative_failed'])
if(process.platform!=='darwin'){console.log(JSON.stringify({status:'NOT_RUN',reason:'macos_required'}));process.exit(2)}
const root=realpathSync(mkdtempSync(path.join(tmpdir(),'fabric-codex-tui-native-')))
const profile=path.join(root,'backend'),tuiProfile=path.join(root,'tui'),cwd=path.join(root,'project')
let python,schemas
const binary=process.env.FABRIC_CODEX_BIN??'/opt/homebrew/bin/codex'
const frontendToken=randomBytes(32).toString('hex'),backendToken=randomBytes(32).toString('hex')
const env=profile=>({PATH:'/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin',LANG:'en_US.UTF-8',CODEX_HOME:profile,TMPDIR:root,TERM:'xterm-256color'})
let rendered={codex:false,model:false,prompt:false},modelChoiceSent=false,success=null,failure=null,noForkVerified=false,backend,backendExit=null,pty,ptyExit=null,nativeExit=null,gateway,stub,observer,stage='setup',ready=false,outputBytes=0,inferenceAttempts=0,threadId=null,observerVerified=false,sandboxNegative=false
const ownedSockets=new Set(),terminalDiagnostics=new Set()

const wait=async(predicate,ms,reason)=>{const until=performance.now()+ms;while(performance.now()<until){if(predicate())return;await sleep(20)}throw new Error(reason)}
function policy(name,{listen=false,outbound=null}){
 const target=path.join(root,name+'.sb')
 writeFileSync(target,['(version 1)','(allow default)','(deny process-fork)','(deny network*)',...(listen?['(allow network-bind (local ip "localhost:*"))','(allow network-inbound (local ip "localhost:*"))']:[]),
  ...(outbound?[`(allow network-outbound (remote ip "localhost:${outbound}"))`]:[]),
  '(deny file-write*)',`(allow file-write* (subpath ${JSON.stringify(root)}) (literal "/dev/tty") (literal "/dev/null"))`,
  '(deny file-read-data)',
  `(allow file-read-data (literal "/") (subpath ${JSON.stringify(root)}) ${['/System','/usr/lib','/usr/share','/usr/bin','/usr/sbin','/bin','/sbin','/Library/Developer/CommandLineTools','/Applications/Xcode.app','/opt/homebrew/Caskroom/codex/0.157.1'].map(p=>`(subpath ${JSON.stringify(p)})`).join(' ')} (literal "/dev/null") (literal "/dev/tty") (literal "/dev/urandom") (literal "/dev/random") (literal "/opt/homebrew/bin/codex") (literal "/private/etc/localtime") (literal "/private/etc/passwd"))`,
  `(deny file-read-data (subpath ${JSON.stringify(homedir())}))`,
  '(deny mach-lookup (global-name "com.apple.securityd"))'].join('\n'),{mode:0o600})
 return target
}
async function observerRead(port,id){
 observer=new WebSocket(`ws://127.0.0.1:${port}/`,{headers:{Authorization:`Bearer ${backendToken}`},maxPayload:65_536,perMessageDeflate:false,handshakeTimeout:2000})
 observer.on('error',()=>{});let result,invalid=false
 observer.on('message',(data,binary)=>{
  if(binary){invalid=true;return}try{const v=JSON.parse(data)
   if(v.method==='remoteControl/status/changed'&&!Object.hasOwn(v,'id')&&schemas['v2/RemoteControlStatusChangedNotification'](v.params)&&v.params.status==='disabled'&&v.params.environmentId===null)return
   if(v.id==='observer-init'&&schemas['v1/InitializeResponse'](v.result)&&v.result.codexHome===profile){observer.send(JSON.stringify({method:'initialized'}));observer.send(JSON.stringify({id:'observer-thread',method:'thread/read',params:{threadId:id,includeTurns:false}}))}
   else if(v.id==='observer-thread'&&schemas['v2/ThreadReadResponse'](v.result))result=v.result
   else invalid=true
  }catch{invalid=true}
 })
 await wait(()=>observer.readyState===WebSocket.OPEN||observer.readyState===WebSocket.CLOSED,3000,'observer_failed');check(observer.readyState===WebSocket.OPEN,'observer_failed')
 observer.send(JSON.stringify({id:'observer-init',method:'initialize',params:{clientInfo:{name:'fabric_tui_survival_probe',version:'0.157.1'},capabilities:{experimentalApi:true}}}))
 await wait(()=>result||invalid,3000,'observer_failed')
 check(!invalid&&result.thread.id===id&&result.thread.cwd===cwd&&result.thread.modelProvider==='probe-local'&&result.thread.turns.length===0,'thread_survival_unproved');observerVerified=true;observer.close()
}
try{
 for(const p of [profile,tuiProfile,cwd])mkdirSync(p,{mode:0o700})
 python=realpathSync('/Library/Developer/CommandLineTools/usr/bin/python3');schemas=loadProbeSchemas()
 stub=createServer((req,res)=>{inferenceAttempts++;req.resume();res.writeHead(403,{'Content-Type':'application/json'});res.end('{"error":"probe_inference_forbidden"}')})
 stub.on('connection',s=>{ownedSockets.add(s);s.on('close',()=>ownedSockets.delete(s));s.setTimeout(2000,()=>s.destroy())})
 await new Promise(r=>stub.listen(0,'127.0.0.1',r));const stubPort=stub.address().port
 const config=`model = "gpt-5.4"\nmodel_provider = "probe-local"\napproval_policy = "never"\nsandbox_mode = "read-only"\ncheck_for_update_on_startup = false\nweb_search = "disabled"\n[features]\nplugins = false\n[model_providers.probe-local]\nname = "Owned no-inference fixture"\nbase_url = "http://127.0.0.1:${stubPort}/v1"\nwire_api = "responses"\nrequires_openai_auth = false\n[projects.${JSON.stringify(cwd)}]\ntrust_level = "trusted"\n`
 for(const p of [profile,tuiProfile])writeFileSync(path.join(p,'config.toml'),config,{mode:0o600})
 const backendPolicy=policy('backend',{listen:true,outbound:stubPort});stage='backend_no_fork_check'
 const forkProbe='import os,sys\nok=[]\ntry:\n p=os.fork()\n if p==0:os._exit(0)\n os.waitpid(p,0);ok.append(False)\nexcept PermissionError:ok.append(True)\ntry:\n p=os.posix_spawn("/usr/bin/true",["true"],{});os.waitpid(p,0);ok.append(False)\nexcept PermissionError:ok.append(True)\nsys.exit(0 if all(ok) else 9)'
 execFileSync('/usr/bin/sandbox-exec',['-f',backendPolicy,python,'-c',forkProbe],{cwd,env:env(profile),timeout:3000,stdio:['ignore','pipe','pipe']})
 stage='build_check'
 const build=execFileSync('/usr/bin/sandbox-exec',['-f',backendPolicy,binary,'--version'],{cwd,env:env(profile),timeout:5000,maxBuffer:65536,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 check(build==='codex-cli 0.157.1','unreviewed_build');stage='backend'
 backend=spawn('/usr/bin/sandbox-exec',['-f',backendPolicy,binary,'app-server','--listen','ws://127.0.0.1:0','--ws-auth','capability-token','--ws-token-sha256',createHash('sha256').update(backendToken).digest('hex')],{cwd,env:env(profile),stdio:['pipe','pipe','pipe']})
 backend.on('error',()=>{backendExit={error:true}});backend.on('exit',(code,signal)=>{backendExit={code,signal}})
 let port=null,backendBytes=0,partial=''
 backend.stdout.on('data',chunk=>{backendBytes+=chunk.length;if(backendBytes>1_048_576)backend.kill('SIGTERM')})
 backend.stderr.on('data',chunk=>{backendBytes+=chunk.length;if(backendBytes>1_048_576){backend.kill('SIGTERM');return}partial+=chunk.toString();if(partial.length>16384){backend.kill('SIGTERM');partial='';return}
  let at;while((at=partial.indexOf('\n'))>=0){const line=partial.slice(0,at);partial=partial.slice(at+1);const match=/^\s*listening on:\s*ws:\/\/127\.0\.0\.1:(\d+)\s*$/.exec(line);if(match)port=Number(match[1])}})
 await wait(()=>port||backendExit,7000,'backend_ready_timeout');check(port&&!backendExit,'backend_exited')
 gateway=await createNativeProbeGateway({upstreamPort:port,upstreamToken:backendToken,frontendToken,profile,cwd,timeoutMs:20_000})
 const tuiPolicy=policy('tui',{outbound:gateway.port});stage='tui_no_fork_check'
 execFileSync('/usr/bin/sandbox-exec',['-f',tuiPolicy,python,'-c',forkProbe],{cwd,env:env(tuiProfile),timeout:3000,stdio:['ignore','pipe','pipe']})
 noForkVerified=true
 stage='tui_containment_checks'
 // Actual containment negatives: a harmless owned listener, backend direct port,
 // and operator-home path must not be reachable from the TUI sandbox.
 const probeCode='import socket,sys; s=socket.socket(); s.settimeout(.3)\ntry:\n s.connect(("127.0.0.1",int(sys.argv[1]))); sys.exit(9)\nexcept OSError:\n sys.exit(0)'
 for(const deniedPort of [port,stubPort]){
  const receipt=execFileSync('/usr/bin/sandbox-exec',['-f',tuiPolicy,python,'-c',probeCode,String(deniedPort)],{cwd,env:env(tuiProfile),timeout:3000,stdio:['ignore','pipe','pipe']});check(receipt.length===0,'sandbox_negative_failed')
 }
 const readProbe='import os,sys\ntry:\n os.listdir(sys.argv[1]);sys.exit(9)\nexcept PermissionError:\n sys.exit(0)'
 execFileSync('/usr/bin/sandbox-exec',['-f',tuiPolicy,python,'-c',readProbe,homedir()],{cwd,env:env(tuiProfile),timeout:3000,stdio:['ignore','pipe','pipe']});sandboxNegative=true
 stage='native_view'
 pty=spawn(python,['-u',fileURLToPath(new URL('./helpers/codex-tui-probe-pty.py',import.meta.url)),'/usr/bin/sandbox-exec','-f',tuiPolicy,binary,'--remote',`ws://127.0.0.1:${gateway.port}/`,'--remote-auth-token-env','FABRIC_TUI_PROBE_TOKEN','--no-alt-screen'],{cwd,env:{...env(tuiProfile),FABRIC_TUI_PROBE_TOKEN:frontendToken},stdio:['pipe','pipe','pipe']})
 pty.stdin.on('error',()=>{});pty.on('error',()=>{ptyExit={error:true}});pty.on('exit',(code,signal)=>{ptyExit={code,signal}});pty.stderr.on('data',()=>{})
 let tail='',display='',rawDisplay=''
 pty.stdout.on('data',chunk=>{tail+=chunk.toString();if(tail.length>100000){pty.stdin.write('TERM\n');tail='';return}let at
  while((at=tail.indexOf('\n'))>=0){const line=tail.slice(0,at);tail=tail.slice(at+1);let e;try{e=JSON.parse(line)}catch{continue}
   if(e.type==='exit'||e.type==='cleanup-exit')nativeExit={kind:e.type,code:e.code}
   if(e.type==='output'){const bytes=Buffer.from(e.bytes,'base64');outputBytes+=bytes.length
    if(outputBytes>1_048_576){pty.stdin.write('TERM\n');continue}rawDisplay=(rawDisplay+bytes.toString('utf8')).slice(-32768);display=stripVTControlCharacters(rawDisplay)
    // Conservative visible readiness: actual rendered Codex title and owned
    // model, coupled with a successful native thread/start response below.
    for(const [code,pattern] of [['model_migration',/Try\s*new\s*model|Use\s*existing\s*model|Codex\s*just\s*got\s*an\s*upgrade/i],['permission_denied',/Permission denied|Operation not permitted/i],['tty_unavailable',/not a terminal|could not.*terminal|\/dev\/tty/i],['config_failed',/failed to load.*config|error loading.*config/i],['network_failed',/connection refused|failed to connect/i],['missing_file',/No such file or directory/i]])if(pattern.test(display))terminalDiagnostics.add(code)
    if(!modelChoiceSent&&/Try\s*new\s*model/.test(display)&&/Use\s*existing\s*model/.test(display)){modelChoiceSent=true;pty.stdin.write('KEEP_MODEL\n')}
    rendered={codex:/codex/i.test(display),model:/gpt\s*-\s*5\s*\.\s*4/i.test(display),prompt:display.includes('›')}
    if(rendered.codex&&rendered.model&&rendered.prompt&&gateway.snapshot().threadStartReply)ready=true
   }
  }})
 await wait(()=>ready&&gateway.snapshot().threadStartReply||gateway.snapshot().reason||nativeExit||ptyExit,12000,'native_ready_timeout')
 check(!gateway.snapshot().reason,'gateway_denied');check(ready&&gateway.snapshot().threadStartReply,'native_ready_timeout');threadId=gateway.snapshot().threadId
 stage='view_exit';check(gateway.armExit(threadId),'gateway_denied');pty.stdin.write('QUIT\n')
 await wait(()=>nativeExit,3500,'native_exit_timeout');check(nativeExit.kind==='exit'&&nativeExit.code===0,'native_exit_failed')
 check(!gateway.snapshot().reason||gateway.snapshot().reason==='view_disconnected','gateway_denied');check(!backendExit,'backend_exited');check(inferenceAttempts===0,'inference_attempted');check(gateway.snapshot().unsubscribeStatus==='unsubscribed','native_exit_failed');stage='backend_survival';await observerRead(port,threadId)
 success={status:'PASS',boundary:'native empty-thread view only',build,threadId,readyView:true,modelChoiceSent,unsubscribeStatus:gateway.snapshot().unsubscribeStatus,nativeExit,backendSurvival:observerVerified,threadStartRequests:gateway.snapshot().threadStartRequests,inferenceAttempts,sandboxNegative,noForkVerified,observations:gateway.snapshot().observations,outputBytes}
}catch(error){
 failure={status:'FAIL',stage,reason:codes.has(error.message)?error.message:'probe_operation_failed',nativeExit,ready,rendered,modelChoiceSent,outputBytes,terminalDiagnostics:[...terminalDiagnostics],threadId:gateway?.snapshot().threadId??null,inferenceAttempts,sandboxNegative,noForkVerified,gateway:gateway?.snapshot()??null};process.exitCode=1
}finally{
 observer?.terminate();gateway?.close()
 if(pty&&!ptyExit){pty.stdin.write('TERM\n');try{await wait(()=>ptyExit,3500,'pty_cleanup_failed')}catch{process.exitCode=1}}
 if(backend&&!backendExit){backend.kill('SIGTERM');try{await wait(()=>backendExit,3000,'backend_cleanup_failed')}catch{backend.kill('SIGKILL');try{await wait(()=>backendExit,2000,'backend_cleanup_failed')}catch{process.exitCode=1}}}
 for(const s of ownedSockets)s.destroy();if(stub)await new Promise(r=>stub.close(r))
 const gatewayCleanup=gateway?await gateway.finished:{status:'closed'}
 const cleaned=(!pty||ptyExit&&nativeExit)&&(!backend||backendExit)&&gatewayCleanup.status==='closed'
 if(inferenceAttempts!==0){failure={status:'FAIL',reason:'inference_attempted',inferenceAttempts};process.exitCode=1}
 if(!cleaned){failure={status:'FAIL',reason:'cleanup_unobserved_fixture_retained'};process.exitCode=1}
 if(cleaned)rmSync(root,{recursive:true,force:true})
 console.log(JSON.stringify({...failure??success??{status:'FAIL',reason:'no_receipt'},cleanup:cleaned?'observed':'unknown_fixture_retained',backendExit,ptyExit,nativeExit,gatewayCleanup}))
}
