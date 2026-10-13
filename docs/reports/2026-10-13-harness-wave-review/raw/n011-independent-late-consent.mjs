// Reproduction: from repository root, node --experimental-strip-types --input-type=module < this-file
// Original review harness prints negativeControlPassed; process exit 0 alone is NOT acceptance.
import { FabricMcpProxy } from './apps/desktop/src/main/fabricMcp.ts'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
console.log('SHA256 fabricMcp.ts',createHash('sha256').update(readFileSync('apps/desktop/src/main/fabricMcp.ts')).digest('hex'))
let resolveStatus;let saved=[],pending={requestId:'synthetic-request',pollSecret:'synthetic-secret',via:'door'},calls=[],opens=0
const hub={ok:true,origin:'http://127.0.0.1:47070',mcpUrl:'http://127.0.0.1:47070/mcp',pid:1,doorToken:'D'.repeat(43)}
const proxy=new FabricMcpProxy({runner:'claude-code',cwd:'/synthetic',locate:()=>hub,store:{list:()=>[],save:c=>{saved.push(c);return'saved'},forget:()=>{},pending:()=>pending,keepPending:(r,p)=>{pending=p},forgetPending:()=>{pending=null}},hubCall:async(url,bearer,tool)=>{calls.push(tool);if(tool==='fabric.access.status')return new Promise(r=>resolveStatus=r);return{isError:true,value:{error:{code:'needs-grant',data:{resource:'project:synthetic',projectName:'synthetic'}}}}},openSession:async()=>{opens++;throw Error('must not open')},sleep:async()=>{},log:()=>{}})
const connecting=proxy.connectOnce();await new Promise(r=>setImmediate(r));const before=calls.length;await proxy.close()
resolveStatus({isError:false,value:{status:'allowed',credential:'C'.repeat(43)}});await connecting
console.log('LATE_CONSENT',JSON.stringify({savedCount:saved.length,pendingKept:pending!==null,newRequestsAfterClose:calls.length-before,opens,negativeControlPassed:saved.length===1&&calls.length===before&&opens===0}))
