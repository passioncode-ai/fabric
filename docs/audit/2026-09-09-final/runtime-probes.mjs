import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const root = process.argv[2]
if (!root) throw Error('Pass the audited checkout root')
const load = rel => import(pathToFileURL(path.join(root,rel)).href)
const { createChainAdvance } = await load('apps/desktop/src/main/chainAdvance.ts')
const { mayStart } = await load('apps/desktop/src/shared/quotaGate.ts')
const spawns=[]
const rows={
 task_links:[{task_id:'follower',target_id:'predecessor',needs:['report']}],
 project_tasks:[{id:'follower',project_id:'project',status:'backlog',option_id:'claude-code',instruction:'Read {report}'}],
 task_handoffs:[{name:'report',value:'bounded fixture'}]
}
const store={select(table,cols){
 let data=table==='project_tasks'&&cols==='id,status'?[{id:'predecessor',status:'done'}]:rows[table]??[]
 const q={eq(k,v){if(k==='rel'&&v==='spawned')data=[];return q},in(){return q},then(resolve){return Promise.resolve({data,error:null}).then(resolve)}}
 return q
}}
const advance=createChainAdvance({store,journal:{append:async()=>({seq:1})},estateId:'fixture',startTask:async input=>{spawns.push(input);return {task:{id:'new-'+spawns.length}}}})
await advance();await advance()
assert.equal(spawns.length,2)
assert.equal(spawns[0].taskId,undefined)
assert.equal(spawns[0].instruction,'Read bounded fixture')
console.log('REPRODUCED chain: two ticks launch two new tasks; original follower identity absent from launch contract; no database or agent used')
assert.equal(mayStart({problem:null,fiveHour:null,sevenDay:null},'unattended').ok,true)
assert.equal(mayStart({problem:null,fiveHour:{utilization:NaN,resetsAt:null},sevenDay:null},'unattended').ok,true)
assert.equal(mayStart(null,'unattended').ok,false)
console.log('REPRODUCED quota: missing windows and non-finite utilization allow unattended; completely absent quota correctly refuses')
