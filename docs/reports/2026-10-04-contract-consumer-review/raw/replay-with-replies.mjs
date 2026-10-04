// Independent review artifact. Run from an isolated Fabric checkout with FABRIC_CONTRACT_NEW.
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolve, join } from 'node:path'
const root=resolve('.'), contract=process.env.FABRIC_CONTRACT_NEW
if(!contract) throw Error('FABRIC_CONTRACT_NEW must select the exact compiled normative checkout')
const load=p=>import(pathToFileURL(join(root,p)).href)
const { hubServerFor }=await load('apps/desktop/src/main/hubTools.ts')
const { normaliseAccessRequest }=await load('apps/desktop/src/shared/access.ts')
const { AgentSurface }=await load('apps/desktop/src/main/agentSurface.ts')
const { Client }=await load('apps/desktop/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')
const { InMemoryTransport }=await load('apps/desktop/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js')
const cases=[['underscore','receive_project_message'],['dotted','demo.run'],['two','ab'],['maximum','a'.repeat(128)],['maximum-underscore','a'+'_'.repeat(127)],['leading-underscore','_leading'],['one','a'],['too-long','a'.repeat(129)],['uppercase','Uppercase'],['space','bad space'],['slash','bad/name'],['colon','bad:name'],['number',42],['prototype','constructor'],['prototype-dotted','demo.constructor'],['middle-newline','read\nmessage'],['terminal-LF','read_message\n'],['terminal-CR','read_message\r'],['terminal-CRLF','read_message\r\n'],['terminal-LS','read_message\u2028'],['terminal-PS','read_message\u2029']]
const args=capability=>({agentId:'example-agent',capability,input:{}})
const extra=[['unknown-field',{...args('read_message'),extra:true}],['wrong-input-array',{...args('read_message'),input:[]}],['wrong-input-null',{...args('read_message'),input:null}],['wrong-id',{...args('read_message'),agentId:'Invalid Agent'}],['empty-key',{...args('read_message'),idempotencyKey:''}],['maximum-key',{...args('read_message'),idempotencyKey:'k'.repeat(256)}],['over-key',{...args('read_message'),idempotencyKey:'k'.repeat(257)}]]
const code=`import {createValidator,validateDocument} from './src/validator.ts';import {SCHEMA_PREFIX} from './src/contract.ts';import {readFileSync} from 'node:fs';(async()=>{const input=JSON.parse(readFileSync(0,'utf8'));const v=await createValidator();const rows=[];for(const [schema,file,key] of [['manifest.schema.json','manifest-mcp.json','manifest'],['interop-agent-call.schema.json','interop-agent-call.json','call'],['pipeline.schema.json','pipeline.json','pipeline'],['service-well-known.schema.json','service-well-known-capabilities.json','service']]){for(const [id,name] of input.cases){const d=JSON.parse(readFileSync('fixtures/positive/'+file,'utf8'));if(key==='manifest')d.capabilities[0].name=name;else if(key==='call')d.capability=name;else if(key==='pipeline')d.stages[0].capability=name;else d.surfaces.mcp.capabilities=[name];const r=validateDocument(v,SCHEMA_PREFIX+'schemas/'+schema,d);rows.push({id,schema,valid:r.valid,errors:r.errors.map(e=>e.keyword)});}}for(const [id,d] of input.extra){const r=validateDocument(v,SCHEMA_PREFIX+'schemas/interop-agent-call.schema.json',d);rows.push({id,schema:'interop-agent-call.schema.json',valid:r.valid,errors:r.errors.map(e=>e.keyword)});}console.log(JSON.stringify(rows));})();`
const normative=JSON.parse(execFileSync(join(contract,'node_modules/.bin/tsx'),['-e',code],{cwd:contract,input:JSON.stringify({cases,extra}),encoding:'utf8'}))
let routed=0
const server=hubServerFor({kind:'binding',binding:{id:'review-binding',agent_id:'example-agent'}},{access:{},call:async()=>{routed++;return {content:[{type:'text',text:'accepted'}]}}})
const client=new Client({name:'independent-review',version:'1.0.0'});const [ct,st]=InMemoryTransport.createLinkedPair();await server.connect(st);await client.connect(ct)
const tool=(await client.listTools()).tools.find(t=>t.name==='agent.call')
const rows=[]
for(const [id,d] of [...cases.map(([id,name])=>[id,args(name)]),...extra]){
 const before=routed;let error=null,reply=null;try{reply=await client.callTool({name:'agent.call',arguments:d})}catch(e){error=String(e.message).split('\n')[0]}
 const normativeCall=normative.find(r=>r.id===id&&r.schema==='interop-agent-call.schema.json').valid
 const normalized='capability' in d&&cases.some(([i])=>i===id)?normaliseAccessRequest({agentId:'example-agent',callee:'fabric-inbox',capabilities:[d.capability],resources:['news@example.com'],reason:'review'}).ok:null
 rows.push({id,arguments:d,compiledCall:normativeCall,realSdkAccepted:routed>before,normalisedRequest:normalized,error,isError:reply?.isError??false,responseText:reply?.content?.[0]?.text??null})
}
await client.close();await server.close()
let written=0
const surface=new AgentSurface({db:{},journal:{append:async()=>({seq:++written})},ptys:()=>undefined,estateId:'review-estate'})
const session=surface.serverFor({estateId:'review-estate',projectId:'review-project',sessionId:'review-session',taskId:null})
const sc=new Client({name:'independent-session-review',version:'1.0.0'});const [sct,sst]=InMemoryTransport.createLinkedPair();await session.connect(sst);await sc.connect(sct)
const sessionTools=(await sc.listTools()).tools.map(t=>t.name);const sessionCases=[]
for(const [id,name,d] of [['stage-positive','fabric_stage_report',{stage:'review',step:1}],['stage-negative','fabric_stage_report',{stage:42}],['no-agent-call','agent.call',args('read_message')]]){const before=written;let error=null,reply=null;try{reply=await sc.callTool({name,arguments:d})}catch(e){error=String(e.message).split('\n')[0]}sessionCases.push({id,handlerWrote:written>before,error,isError:reply?.isError??false,responseText:reply?.content?.[0]?.text??null})}
await sc.close();await session.close()
console.log(JSON.stringify({fabricSource:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),contractSource:execFileSync('git',['rev-parse','HEAD'],{cwd:contract,encoding:'utf8'}).trim(),servedSchema:tool.inputSchema,normative,rows,sessionTools,sessionCases},null,2))
