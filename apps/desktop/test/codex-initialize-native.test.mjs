// Manual exact-build protocol probe: real CLI, no thread/turn/model request.
// Own profile, network denied and operator configuration/keychain unreadable.
// This cannot certify Stop, background containment, skills or model acceptance.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import path from 'node:path'
import { createProviderJsonlTransport } from '../src/main/providerJsonlTransport.ts'

if (process.platform !== 'darwin') {
  console.error('NOT_RUN: this probe requires the macOS deny-network sandbox'); process.exit(2)
}
const binary = process.env.FABRIC_CODEX_BIN ?? '/opt/homebrew/bin/codex'
const root=realpathSync(mkdtempSync(path.join(tmpdir(),'fabric-codex-init-')))
const profile=path.join(root,'profile');mkdirSync(profile,{mode:0o700})
const sandbox=path.join(root,'probe.sb')
const quote=value=>JSON.stringify(value)
const denied=['.codex','.claude','.agents','.config','Library/Keychains'].map(p=>path.join(homedir(),p))
writeFileSync(sandbox,[
  '(version 1)','(allow default)','(deny network*)','(deny file-write*)',
  `(allow file-write* (subpath ${quote(root)}))`,
  `(deny file-read* ${denied.map(p=>`(subpath ${quote(p)})`).join(' ')})`,
  '(deny mach-lookup (global-name "com.apple.securityd"))'
].join('\n'),{mode:0o600})
let child, transport, exit, exited=false, stderrBytes=0
async function bounded(promise,ms){
  let timer
  try{return await Promise.race([promise,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),ms)})])}
  finally{clearTimeout(timer)}
}
const methods=[]
const env={PATH:process.env.PATH,LANG:'en_US.UTF-8',CODEX_HOME:profile,TMPDIR:root}
try {
  const build = execFileSync('/usr/bin/sandbox-exec',['-f',sandbox,binary,'--version'],{
    cwd:root,env,encoding:'utf8',timeout:5000,maxBuffer:65536,stdio:['ignore','pipe','pipe']
  }).trim()
  assert.equal(build,'codex-cli 0.157.1','an upgrade requires a new reviewed probe receipt')
  // Provider-specific profile variable has its documented meaning in this
  // child only. Parent environment/profile and global credentials are untouched.
  child=spawn('/usr/bin/sandbox-exec',['-f',sandbox,binary,'app-server','--stdio'],{
    cwd:root,env,
    stdio:['pipe','pipe','pipe']
  })
  exit=new Promise(resolve=>child.once('exit',(code,signal)=>{exited=true;resolve({code,signal})}))
  child.stderr.on('data',bytes=>{stderrBytes+=bytes.length}) // Drain; never retain provider prose.
  child.on('error',()=>{ /* The transport/timeout reports startup uncertainty, not raw process prose. */ })
  transport=createProviderJsonlTransport({input:child.stdout,output:child.stdin,timeoutMs:5000,
    onNotification:method=>{if(methods.length<32)methods.push(method)} })
  const result=await transport.request('initialize',{
    clientInfo:{name:'fabric_protocol_probe',title:'Fabric isolated protocol probe',version:'0.0.0'},
    capabilities:{experimentalApi:true}
  })
  assert.equal(result.status,'reply','real CLI must return a structured initialize reply')
  assert.equal(result.result.codexHome,profile,'the CLI actually selected the owned profile')
  assert.equal(result.result.platformOs,'macos')
  assert.equal(typeof result.result.userAgent,'string')
  child.stdin.end()
  const ending=await bounded(exit,5000)
  assert.ok(ending,'owned server must exit after input closes')
  assert.equal(ending.code,0)
  console.log(JSON.stringify({status:'PASS',build,boundary:'owned stdio initialize only',
    profileVerified:true,network:'denied',operatorConfig:'denied',modelRequests:0,
    notificationMethods:methods,stderrBytes,exitCode:ending.code}))
} finally {
  transport?.close()
  if(child?.pid&&!exited){
    child.kill('SIGTERM')
    await bounded(exit,1000)
    if(!exited){child.kill('SIGKILL');await bounded(exit,1000)}
    if(!exited)throw new Error('Owned probe exit was not observed; preserve fixture at '+root)
  }
  rmSync(root,{recursive:true,force:true})
}
