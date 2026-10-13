// Reproduction: from repository root, node --experimental-strip-types --input-type=module < this-file
// Original review harness prints negativeControlPassed; process exit 0 alone is NOT acceptance.
import { FabricMcpProxy } from './apps/desktop/src/main/fabricMcp.ts'
import { makeHubCall } from './apps/desktop/src/main/fabricMcpClient.ts'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
for (const file of ['apps/desktop/src/main/fabricMcp.ts','apps/desktop/src/main/fabricMcpClient.ts','apps/desktop/test/fabric-mcp.test.mjs']) console.log('SHA256',file,createHash('sha256').update(readFileSync(file)).digest('hex'))
let resolveOpen; let opened=0, left=0, calls=0
const hub={ok:true,origin:'http://127.0.0.1:47070',mcpUrl:'http://127.0.0.1:47070/mcp',pid:1,doorToken:'D'.repeat(43)}
const proxy=new FabricMcpProxy({runner:'claude-code',cwd:'/synthetic',locate:()=>hub,store:{list:()=>[{id:'owned',credential:'C'.repeat(43)}],save:()=>'',forget:()=>{},pending:()=>null,keepPending:()=>{},forgetPending:()=>{}},hubCall:async()=>({isError:false,value:{session:{bearer:'B'.repeat(32),projectId:'p',projectName:'p'}}}),openSession:()=>{opened++;return new Promise(r=>resolveOpen=r)},sleep:async()=>{},log:()=>{}})
const connecting=proxy.connectOnce();await new Promise(r=>setImmediate(r));await proxy.close()
resolveOpen({listTools:async()=>[],callTool:async()=>{calls++;return{}},close:async()=>{left++},leave:async()=>{left++}})
await connecting;await proxy.call('synthetic_no_effect',{})
console.log('CLOSE_RACE',JSON.stringify({opened,left,calls,state:proxy.state.kind,negativeControlPassed:left===1&&calls===0&&proxy.state.kind!=='connected'}));await proxy.close()
const original=globalThis.fetch;const sent=[]
globalThis.fetch=async(input,init)=>{
 const message=init?.body?JSON.parse(init.body):null;sent.push({method:init?.method,rpc:message?.method??null})
 if(init?.method==='GET')return new Response('',{status:429,headers:{'retry-after':'60'}})
 if(message?.method==='initialize')return new Response(JSON.stringify({jsonrpc:'2.0',id:message.id,result:{protocolVersion:message.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'synthetic',version:'1'}}}),{status:200,headers:{'content-type':'application/json'}})
 if(message?.method==='notifications/initialized')return new Response(null,{status:202})
 return new Response(JSON.stringify({jsonrpc:'2.0',id:message.id,result:{content:[],structuredContent:{ok:true}}}),{status:200,headers:{'content-type':'application/json'}})
}
try{
 let outcome;try{outcome=await makeHubCall()('http://127.0.0.1:47070/mcp','SYNTHETIC','synthetic_no_effect',{})}catch(e){outcome={code:e.code}}
 console.log('SDK_GET_429',JSON.stringify({sent,outcome,negativeControlPassed:!sent.some(x=>x.rpc==='tools/call')}))
}finally{globalThis.fetch=original}
