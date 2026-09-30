import assert from 'node:assert/strict'
import { createCodexTuiReadProbeGate } from './helpers/codex-tui-read-probe-gate.mjs'

const init={id:'initialize',method:'initialize',params:{clientInfo:{name:'codex-tui',version:'0.157.1',title:null},
  capabilities:{experimentalApi:true,explicitGatewayOauth:false,requestAttestation:false,extensions:null,
    mcpServerOpenaiFormElicitation:false,optOutNotificationMethods:null}}}
const initialized={method:'initialized'}
const account={id:1,method:'account/read',params:{refreshToken:false}}
const profile='/owned/probe/backend-profile'
const initReply={id:'initialize',result:{codexHome:profile,platformFamily:'unix',platformOs:'macos',userAgent:'codex_cli_rs/0.157.1 (codex-tui/0.157.1)'}}
const accountReply={id:1,result:{account:null,requiresOpenaiAuth:true,workspaceRouting:null}}
const active=[]
function fixture(overrides={}) {
  const up=[],down=[];let closes=0
  const deps={epoch:'connection-1',backendProfile:profile,
    writeUpstream:(s,allowed)=>{if(allowed()!==true)return false;up.push(JSON.parse(s));return true},
    writeDownstream:(s,allowed)=>{if(allowed()!==true)return false;down.push(JSON.parse(s));return true},
    onClose:()=>{closes++},...overrides}
  const gate=createCodexTuiReadProbeGate(deps);active.push(gate)
  const ctx={epoch:deps.epoch,isBinary:false}
  const client=v=>gate.client(JSON.stringify(v),ctx),server=v=>gate.server(JSON.stringify(v),ctx)
  const ready=()=>{assert.equal(client(init).status,'forwarded');assert.equal(server(initReply).status,'forwarded');assert.equal(client(initialized).status,'forwarded')}
  return {gate,ctx,client,server,ready,up,down,closes:()=>closes}
}
let tests=0
async function test(name,fn){await fn();tests++;console.log('PASS '+name)}
try {
  await test('exact initialize/initialized/account-read sequence forwards only reviewed messages',()=>{
    const f=fixture();f.ready();assert.equal(f.client(account).status,'forwarded');assert.equal(f.server(accountReply).status,'forwarded')
    assert.deepEqual(f.up,[init,initialized,account]);assert.deepEqual(f.down,[initReply,accountReply])
    assert.equal(f.gate.snapshot().phase,'account_observed');assert.equal(f.gate.snapshot().pending,false)
    assert.deepEqual(f.gate.snapshot().observations,[{direction:'upstream',method:'initialize'},
      {direction:'downstream',method:'initialize'},{direction:'upstream',method:'initialized'},
      {direction:'upstream',method:'account/read'},{direction:'downstream',method:'account/read'}])
  })
  await test('turn/start and all unreviewed methods are denied before upstream write, in every phase',()=>{
    const methods=['turn/start','turn/steer','thread/start','thread/resume','thread/fork','command/exec',
      'config/value/write','account/login/start','account/logout','model/list','configRequirements/read','thread/list','anything/new']
    for(const stage of ['new','initializing','ready','account_observed'])for(const method of methods){
      const f=fixture();if(stage==='initializing')f.client(init);else if(stage!=='new')f.ready()
      if(stage==='account_observed'){f.client(account);f.server(accountReply)}
      const before=f.up.length
      assert.equal(f.client({id:2,method,params:{}}).status,'denied',stage+'/'+method)
      assert.equal(f.up.length,before);assert.equal(f.gate.snapshot().phase,'closed')
      f.client(init);assert.equal(f.up.length,before,'denial remains sticky')
    }
  })
  await test('initialize identity, capabilities, shape and JSON-RPC version cannot expand privileges',()=>{
    const cases=[{...init,id:1},{...init,jsonrpc:'1.0'},{...init,extra:true},
      {...init,params:{...init.params,extra:true}},
      {...init,params:{...init.params,clientInfo:{name:'other',version:'0.157.1'}}},
      {...init,params:{...init.params,clientInfo:{name:'codex-tui',version:'0.157.2'}}},
      {...init,params:{...init.params,clientInfo:{...init.params.clientInfo,title:'not-native'}}}]
    for(const [key,value] of Object.entries({experimentalApi:1,requestAttestation:true,explicitGatewayOauth:true,
      extensions:{'openai/form':{}},mcpServerOpenaiFormElicitation:true,optOutNotificationMethods:['thread/started'],unknown:true}))
      cases.push({...init,params:{...init.params,capabilities:{...init.params.capabilities,[key]:value}}})
    for(const value of cases){const f=fixture();assert.equal(f.client(value).status,'denied');assert.equal(f.up.length,0)}
  })
  await test('account-read requires initialization acknowledgement and literal refreshToken:false',()=>{
    for(const bad of [{}, {refreshToken:true},{refreshToken:0},{refreshToken:null},{refresh_token:false},{refreshToken:false,extra:true}]){
      const f=fixture();f.ready();const n=f.up.length;assert.equal(f.client({...account,params:bad}).status,'denied');assert.equal(f.up.length,n)
    }
    for(const stage of ['new','initializing','awaiting_initialized']){
      const f=fixture();if(stage!=='new')f.client(init);if(stage==='awaiting_initialized')f.server(initReply)
      const n=f.up.length;assert.equal(f.client(account).status,'denied');assert.equal(f.up.length,n)
    }
    const f=fixture();f.ready();f.client(account);f.server(accountReply)
    const n=f.up.length;assert.equal(f.client({...account,id:2}).status,'denied');assert.equal(f.up.length,n)
  })
  await test('malformed/batched/duplicate/deep/binary/invalid UTF8 input never reaches upstream',()=>{
    const inputs=['{','[]','[{}]','null','true','1','{"method":"turn/start","method":"initialize","id":"initialize","params":{}}',
      '{"x":'+ '['.repeat(13)+'0'+']'.repeat(13)+'}',JSON.stringify(init).slice(0,20),
      Uint8Array.from([0x7b,0x22,0xc3,0x28,0x22,0x7d]),'\uFEFF'+JSON.stringify(init)]
    for(const input of inputs){const f=fixture();assert.equal(f.gate.client(input,f.ctx).status,'denied');assert.equal(f.up.length,0)}
    for(const isBinary of [true,undefined,0,'false']){const f=fixture();assert.equal(f.gate.client(JSON.stringify(init),{...f.ctx,isBinary}).status,'denied');assert.equal(f.up.length,0)}
    const f=fixture();assert.equal(f.gate.client(JSON.stringify(init),null).status,'denied');assert.equal(f.up.length,0)
  })
  await test('complete text bytes and ordinary whitespace preserve exact allowed JSON semantics',()=>{
    const f=fixture();const pretty=JSON.stringify(init,null,2)
    assert.equal(f.gate.client(Buffer.from(pretty),f.ctx).status,'forwarded');assert.deepEqual(f.up,[init])
    const f2=fixture();assert.equal(f2.client({...init,jsonrpc:'2.0'}).status,'forwarded')
  })
  await test('message size, cumulative bytes and message count are hard bounds',()=>{
    const f=fixture({maxMessageBytes:512,maxTotalBytes:512});f.client(init)
    assert.equal(f.server({...initReply,result:{...initReply.result,userAgent:'x'.repeat(1000)}}).status,'denied');assert.equal(f.down.length,0)
    const f2=fixture({maxMessageBytes:1024,maxTotalBytes:1024});f2.ready();f2.client(account)
    const n=f2.down.length;assert.equal(f2.server({...accountReply,result:{...accountReply.result,extra:'x'.repeat(800)}}).status,'denied');assert.equal(f2.down.length,n)
    const f3=fixture({maxMessages:2});f3.client(init);f3.server(initReply)
    assert.equal(f3.client(initialized).status,'denied');assert.equal(f3.up.length,1)
  })
  await test('foreign or stale epochs are ignored; late callbacks cannot reopen a closed connection',()=>{
    const f=fixture();assert.equal(f.gate.client(JSON.stringify(init),{...f.ctx,epoch:'old'}).status,'ignored');assert.equal(f.up.length,0)
    f.ready();f.client(account);f.gate.close();assert.equal(f.server(accountReply).status,'denied');assert.equal(f.down.length,1)
    const newer=fixture({epoch:'connection-2'});assert.equal(newer.gate.server(JSON.stringify(accountReply),f.ctx).status,'ignored')
    assert.equal(newer.down.length,0);assert.equal(newer.gate.snapshot().phase,'new');newer.ready()
  })
  await test('duplicate/foreign/type-changed RPC IDs cannot correlate a response or grant another request',()=>{
    for(const wrong of [{...initReply,id:1},{...initReply,id:'other'}]){
      const f=fixture();f.client(init);assert.equal(f.server(wrong).status,'denied');assert.equal(f.down.length,0)
    }
    const f=fixture();f.ready();const n=f.up.length;assert.equal(f.client(init).status,'denied');assert.equal(f.up.length,n)
    const f2=fixture();f2.ready();f2.client(account);assert.equal(f2.server({...accountReply,id:'1'}).status,'denied');assert.equal(f2.down.length,1)
  })
  await test('server requests, notifications and error payloads are never forwarded or retained',()=>{
    const canary='synthetic-secret-canary'
    for(const value of [{id:9,method:'item/commandExecution/requestApproval',params:{secret:canary}},
      {method:'thread/started',params:{secret:canary}},{id:'initialize',error:{message:canary,code:-32000}},
      {id:'initialize',result:[],secret:canary}]){
      const f=fixture();f.client(init);assert.equal(f.server(value).status,'denied');assert.equal(f.down.length,0)
      assert.ok(!JSON.stringify(f.gate.snapshot()).includes(canary));assert.equal(f.closes(),1)
    }
    const f=fixture();f.client({id:1,method:canary,params:{secret:canary}})
    assert.ok(!JSON.stringify(f.gate.snapshot()).includes(canary))
  })
  await test('foreign backend profile, unexpected platform and nonempty real account fail closed',()=>{
    for(const patch of [{codexHome:'/operator/.codex'},{platformFamily:'windows'},{platformOs:'linux'},
      {userAgent:'different-build'},{unknown:true}]){
      const f=fixture();f.client(init);assert.equal(f.server({...initReply,result:{...initReply.result,...patch}}).status,'denied');assert.equal(f.down.length,0)
    }
    for(const result of [{account:{type:'apiKey'},requiresOpenaiAuth:true},
      {account:null,requiresOpenaiAuth:false},{account:null,requiresOpenaiAuth:true,workspaceRouting:{}},
      {requiresOpenaiAuth:true},{account:null,requiresOpenaiAuth:'true'}]){
      const f=fixture();f.ready();f.client(account);assert.equal(f.server({...accountReply,result}).status,'denied');assert.equal(f.down.length,1)
    }
  })
  await test('deadline remains sticky before parse, at final enqueue edge, and for a late response',async()=>{
    let now=0
    const f=fixture({now:()=>now,lifetimeMs:100});now=101
    assert.equal(f.client(init).status,'denied');assert.equal(f.up.length,0);now=0
    assert.equal(f.client(init).status,'denied');assert.equal(f.gate.snapshot().reason,'deadline')
    now=0;const writes=[]
    const f2=fixture({now:()=>now,lifetimeMs:100,writeUpstream:(s,allowed)=>{now=101;if(!allowed())return false;writes.push(s);return true}})
    assert.equal(f2.client(init).status,'denied');assert.equal(writes.length,0)
    const f3=fixture({lifetimeMs:2});f3.client(init)
    await new Promise(r=>setTimeout(r,10))
    assert.equal(f3.server(initReply).status,'denied');assert.equal(f3.down.length,0);assert.equal(f3.gate.snapshot().reason,'deadline')
  })
  await test('regressing/nonfinite clocks and invalid bounds never grant forwarding',()=>{
    for(const bad of [NaN,Infinity,-1]){
      let now=0;const f=fixture({now:()=>now});now=bad
      assert.equal(f.client(init).status,'denied');assert.equal(f.up.length,0)
    }
    for(const patch of [{lifetimeMs:Infinity},{lifetimeMs:0},{maxMessages:33},{maxTotalBytes:10},{maxMessageBytes:0},
      {epoch:''},{backendProfile:'relative'},{writeUpstream:null}])assert.throws(()=>fixture(patch),/invalid_probe_gate_configuration/)
  })
  await test('write failure/async malformed ports close once and cannot create a later grant',async()=>{
    for(const result of [false,undefined,1,{},Promise.reject(new Error('synthetic'))]){
      const f=fixture({writeUpstream:()=>result});assert.equal(f.client(init).status,'denied');assert.equal(f.closes(),1)
      assert.equal(f.client(init).status,'denied');assert.equal(f.closes(),1)
    }
    const f=fixture({writeUpstream:()=>{throw new Error('raw-port-secret')}})
    assert.equal(f.client(init).status,'denied');assert.ok(!JSON.stringify(f.gate.snapshot()).includes('raw-port-secret'))
    const f2=fixture({onClose:()=>Promise.reject(new Error('close-secret'))});f2.gate.close()
    await new Promise(r=>setImmediate(r))
  })
  console.log(`PASS T3a complete-message policy: ${tests} groups; native TUI, websocket framing/auth and real backend NOT_RUN`)
} finally {for(const gate of active)gate.close()}
