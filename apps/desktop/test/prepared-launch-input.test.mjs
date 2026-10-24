import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createHash} from 'node:crypto'
import {compileContextPack} from '../src/main/contextPack.ts'
import {preparedFixture} from './prepared-launch-fixture.mjs'
import {createPreparedLaunchInputs,preparedLaunchMatches} from '../src/main/preparedLaunchInput.ts'
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex')
test('actual scoped task and context compile once, exact body bytes and frozen ownership',async()=>{
 const f=preparedFixture({instruction:'  hello\nмир 🌍  '}),r=await f.inputs.prepare(f.request);assert.equal(r.state,'observed');const p=r.packet
 assert.equal(p.instructionBody,f.task.instruction);assert.equal(p.instructionSha256,sha(f.task.instruction));assert.equal(p.context.sha256,sha(p.context.markdown));assert.equal(p.executionAuthorized,false)
 assert.equal(f.reads.filter(x=>x.table==='memory_facts').length,1);assert.ok(f.reads.every(x=>x.filters.some(([k,v])=>k==='estate_id'&&v===f.id.estate)))
 assert.ok(f.inputs.owns(p));assert.ok(Object.isFrozen(p.context.factIds));assert.ok(preparedLaunchMatches(p,{sessionId:f.id.session,projectId:f.id.project,taskId:f.id.task,optionId:'claude-code',cwd:'/tmp',permissionMode:null}))
 assert.equal(f.inputs.owns({...p}),false);assert.equal(await f.inputs.current({...p}),false)
 assert.equal(await f.inputs.current(p),true);assert.equal(f.reads.filter(x=>x.table==='memory_facts').length,1,'currentness never recompiles')
 f.inputs.release(p);assert.equal(await f.inputs.current(p),false)
})
for(const field of ['instruction','option_id','brief_why'])test(`changed ${field} between compiler and second read refuses`,async()=>{
 const f=preparedFixture();f.readHook=table=>{if(table==='memory_facts')f.task[field]='changed'}
 assert.notEqual((await f.inputs.prepare(f.request)).state,'observed')
})
for(const kind of ['task-missing','task-error','project-error','instruction-limit','shell','custom-agent','mode','chain','facts-routine'])test(`${kind} cannot yield required prepared packet`,async()=>{
 const f=preparedFixture(kind==='instruction-limit'?{deps:{maxInstructionBytes:1}}:{})
 if(kind==='task-missing')f.task=null;if(kind==='task-error')f.readHook=t=>t==='project_tasks'?{error:{message:'private'},data:null}:undefined
 if(kind==='project-error')f.readHook=t=>t==='projects'?{error:{message:'private'},data:null}:undefined
 if(kind==='shell')f.task.option_id='shell';if(kind==='custom-agent')f.task.option_id=f.id.task
 if(kind==='mode')f.request.permissionMode='invalid';if(kind==='chain')f.request.trigger='chain'
 if(kind==='facts-routine'){f.request.trigger='routine';f.readHook=t=>t==='memory_facts'?{error:{message:'private'},data:null}:undefined}
 const r=await f.inputs.prepare(f.request);assert.notEqual(r.state,'observed');assert.ok(!JSON.stringify(r).includes('private'))
})
// Revision 5 (0.3.6 review ER-1): a valid budget smaller than the head still yields the packet, the instruction whole and
// no memory selected; only an invalid budget or the instruction's own byte limit refuses.
test('a tiny valid context budget still yields the packet with the instruction whole',async()=>{
 const f=preparedFixture({instruction:'do the work '.repeat(50)+'END-OF-TASK',deps:{contextBudget:1}}),r=await f.inputs.prepare(f.request)
 assert.equal(r.state,'observed');assert.ok(r.packet.context.markdown.includes('END-OF-TASK'));assert.deepEqual([...r.packet.context.factIds],[])
})
test('before spawn currentness reads actual task/folder, not supplied identity echo',async()=>{
 const f=preparedFixture(),r=await f.inputs.prepare(f.request);assert.equal(r.state,'observed');f.project.repo_path='/changed';assert.equal(await f.inputs.current(r.packet),false)
})
test('30 timeouts retain one unsettled I/O, late resolution causes no more reads, fresh preparation succeeds',async()=>{
 // 1000 ms, not 5: the fresh preparation at the end must finish inside the same deadline. A loaded CI runner missed 5 ms
 // (hosted run 40081520536, 2026-10-24), and 50 ms failed 3 of 520 runs at load 60; 1000 ms failed none of 100. Only the
 // first call waits for the deadline (the others find the read still unsettled), so the test takes about a second.
 const f=preparedFixture({deps:{timeoutMs:1000}});let resolve;f.readHook=()=>new Promise(r=>{resolve=r})
 assert.equal((await f.inputs.prepare(f.request)).state,'unknown');for(let i=0;i<30;i++)assert.equal((await f.inputs.prepare(f.request)).state,'unknown');assert.equal(f.reads.length,1)
 resolve({data:f.task,error:null});await new Promise(r=>setImmediate(r));assert.equal(f.reads.length,1);delete f.readHook
 assert.equal((await f.inputs.prepare(f.request)).state,'observed')
})
test('active packet capacity and release are local bounds, no reservation release',async()=>{
 const f=preparedFixture({deps:{maxEntries:1}}),r=await f.inputs.prepare(f.request);assert.equal(r.state,'observed')
 const next={...f.request,sessionId:f.id.project};assert.equal((await f.inputs.prepare(next)).state,'refused');f.inputs.release(r.packet);assert.equal((await f.inputs.prepare(next)).state,'observed')
})
test('constructor bounds copied, target/body digest corruption rejected',async()=>{
 const f=preparedFixture();f.deps.contextBudget=1;const r=await f.inputs.prepare(f.request);assert.equal(r.state,'observed')
 for(const packet of [{...r.packet,instructionBody:'other'},{...r.packet,context:{...r.packet.context,markdown:'other'}},{...r.packet,contentDigest:'0'.repeat(64)}])assert.equal(preparedLaunchMatches(packet,{sessionId:f.id.session,projectId:f.id.project,taskId:f.id.task}),false)
 assert.throws(()=>createPreparedLaunchInputs({...f.deps,maxEntries:0}))
})

test('mismatched or mutated actual store scope cannot label another Estate as the configured one',async()=>{
 const f=preparedFixture();assert.throws(()=>createPreparedLaunchInputs({...f.deps,estateId:f.id.project}))
 f.store.scope.estateId=f.id.project;assert.equal((await f.inputs.prepare(f.request)).state,'unknown')
 const g=preparedFixture();g.readHook=t=>{if(t==='memory_facts')g.store.scope.estateId=g.id.project}
 assert.notEqual((await g.inputs.prepare(g.request)).state,'observed')
})

test('actual compiler retains unsettled sibling after another context read rejects',async()=>{
 const f=preparedFixture({deps:{timeoutMs:10}});let resolve, facts=0
 f.readHook=table=>{if(table==='project_repos')throw Error('private sibling failure');if(table==='memory_facts'){facts++;return new Promise(r=>{resolve=r})}}
 assert.equal((await f.inputs.prepare(f.request)).state,'unknown')
 for(let i=0;i<10;i++)assert.equal((await f.inputs.prepare(f.request)).state,'unknown')
 assert.equal(facts,1);resolve({data:[],error:null,count:0});await new Promise(r=>setImmediate(r));delete f.readHook
 assert.equal((await f.inputs.prepare(f.request)).state,'observed')
})

test('replacing visible scope cannot hide mutation of the original ScopedStore closure scope',async()=>{
 const f=preparedFixture(),captured=f.store.scope;f.store.scope={...captured};captured.estateId=f.id.project
 assert.equal((await f.inputs.prepare(f.request)).state,'unknown');assert.equal(f.reads.length,0)
})

test('legacy compiler still rejects promptly with a hung sibling; retained settlement is prepared-only',async()=>{
 const f=preparedFixture();let resolve
 f.readHook=t=>{if(t==='project_repos')throw Error('synthetic unavailable');if(t==='memory_facts')return new Promise(r=>{resolve=r})}
 const outcome=compileContextPack({store:f.store,projectId:f.id.project}).then(()=>false,()=>true)
 assert.equal(await Promise.race([outcome,new Promise(r=>setTimeout(()=>r(false),30))]),true)
 resolve?.({data:[],error:null,count:0})
})
