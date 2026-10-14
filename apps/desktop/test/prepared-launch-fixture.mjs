// Fixture for the production compiler/store boundary; no model/native calls.
import {createScopedStore} from '../src/main/scopedStore.ts'
import {createPreparedLaunchInputs} from '../src/main/preparedLaunchInput.ts'
export const preparedIds={estate:'11111111-1111-4111-8111-111111111111',task:'22222222-2222-4222-8222-222222222222',session:'33333333-3333-4333-8333-333333333333',project:'44444444-4444-4444-8444-444444444444'}
export function preparedFixture(options={}){
 const id={...preparedIds,...options.ids},f={reads:[],task:{id:id.task,project_id:id.project,instruction:options.instruction??'bounded work',option_id:'claude-code',brief_what:null,brief_why:null,brief_expected:null},project:{id:id.project,repo_path:'/tmp',name:'Fixture',purpose:'Bounded preparation'}}
 const db={from(table){return {select(columns){const filters=[],q={eq(k,v){filters.push([k,v]);return q},is(){return q},order(){return q},limit(){return q},maybeSingle(){return q},then(resolve,reject){const run=async()=>{f.reads.push({table,columns,filters});if(f.readHook){const r=await f.readHook(table,columns,filters);if(r!==undefined)return r}const data=table==='project_tasks'?f.task:table==='projects'?f.project:[];return {data:structuredClone(data),error:null,count:0}};return run().then(resolve,reject)}};return q}}}}
 const store=createScopedStore(db,{kind:'estate',estateId:id.estate})
 // Ordinary preparation needs headroom under shared-host load (N-040): at 100 ms a loaded host refused ordinary
 // cases as resource_prepared_input_unavailable before the behaviour under test. Deadline tests pass their own timeoutMs.
 const deps={store,estateId:id.estate,maxEntries:8,maxInstructionBytes:65536,contextBudget:12000,timeoutMs:5000,...options.deps}
 return Object.assign(f,{id,store,deps,inputs:createPreparedLaunchInputs(deps),request:{taskId:id.task,sessionId:id.session,trigger:'operator',permissionMode:null}})
}

// Coordinator-only dependency for the older N029/R3 tests. It proves no worker
// storage or native ownership; resource-managed-unit.test exercises those real collaborators.
export function coordinatorUnits(resources){
 const handles=new WeakSet()
 return {resources,async prepare(packet){const h=Object.freeze({sessionId:packet.sessionId});handles.add(h);return {state:'observed',value:h,complete:false,executionAuthorized:false}},
  async attachAdmission(h){return handles.has(h)},async current(h){return handles.has(h)},native(h){return handles.has(h)?h:null},
  async observe(h){return {state:handles.has(h)?'observed':'unknown',complete:false,executionAuthorized:false}}}
}
