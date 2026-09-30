import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {classifyFabricIntent,fabricCapabilities,fabricReadResult} from '../product/concierge.mjs'
import {createDemoProject} from '../product/new-project.mjs'
import {guideRecord,renderGuided} from '../product/guided.mjs'
import {createOperationsState,createFabricTask} from '../product/operations.mjs'
import {createAssistantStore,assistantScope,assistantThread,submitAssistantMessage,renderAssistant} from '../product/assistant.mjs'
const fresh=()=>JSON.parse(readFileSync('docs/ux/product-fixtures.json','utf8'))
const model=JSON.parse(readFileSync('docs/ux/product-model.json','utf8'))
test('every capability leads to a known view; reads and unsupported input never silently create tasks',()=>{
 for(const c of fabricCapabilities)assert(model.views.some(v=>v.id===c.view),c.id)
 assert.equal(classifyFabricIntent('Найди проект Atlas').mode,'read');assert.equal(classifyFabricIntent('случайный неизвестный запрос').mode,'clarify');assert.equal(classifyFabricIntent('Создай задачу: проверить вход').mode,'write');assert.equal(classifyFabricIntent('Настрой агента Reviewer').mode,'draft');assert.equal(classifyFabricIntent('Добавь тему на доску').id,'topic')
})
test('project discovery only uses accessible fixture set and no match is explicit',()=>{
 const ctx={estate:'personal-estate',projects:[],project:null};const r=fabricReadResult(classifyFabricIntent('Найди Atlas'),'Найди Atlas',ctx,{projects:[]});assert.match(r.text,/нет/);assert.equal(r.links.length,1)
})
test('create idempotency is estate-scoped and does not reassign an earlier project',()=>{
 const draft={draftId:'estate-regression',name:'First',purpose:'Goal',estate:'team-estate'};const a=createDemoProject(draft),b=createDemoProject({...draft,estate:'personal-estate'});assert.notEqual(a.id,b.id);assert.equal(a.estate,'team-estate');assert.equal(createDemoProject(draft).id,a.id)
})
test('guide draft and project progress do not leak across project or estate',()=>{
 const a=guideRecord({guideView:'launch-guide',project:'atlas'});a.task='PRIVATE';assert.notEqual(guideRecord({guideView:'launch-guide',project:'orbit'}).task,'PRIVATE');assert.notEqual(guideRecord({guideView:'launch-guide',project:'atlas',estate:'personal-estate'}).task,'PRIVATE');assert.equal(guideRecord({guideView:'launch-guide',project:'atlas'}).task,'PRIVATE');assert(!renderGuided('launch-guide',{project:'atlas',state:'denied'},fresh()).includes('PRIVATE'))
})
test('Fabric creates one real backlog Task with receipt, no run, and refuses changed retries or foreign estate',()=>{
 const f=fresh(),s={state:'ready',project:'atlas',ops:createOperationsState(f)},a={requestId:'ceo-test',project:'atlas',title:'Создай задачу: own result',source:'conversation-test'};const r=createFabricTask(s,f,a);assert(r.ok);assert.equal(createFabricTask(s,f,a).entityRef.params.task,r.entityRef.params.task);const task=f.tasks.find(t=>t.id===r.entityRef.params.task);assert(task);assert.equal(task.title,'own result');assert.equal(s.ops.tasks[task.id].state,'backlog');assert.equal(s.ops.tasks[task.id].runner,'');assert.equal(createFabricTask(s,f,{...a,title:'Changed'}).ok,false);assert.equal(createFabricTask({...s,estate:'personal-estate'},f,a).ok,false);assert.equal(createFabricTask({...s,state:'conflict'},f,a).ok,false)
})
test('paused schedule permits conversation while scope and receipt remain explicit',()=>{
 const ctx={...assistantScope('project',{project:'atlas',state:'ready'},fresh()),paused:true},store=createAssistantStore(),t=assistantThread(store,ctx.key);t.draft='Найди Atlas';const result=submitAssistantMessage(store,ctx);assert(result.message);assert.equal(result.intent.id,'projects');assert.equal(t.proposals.length,0);t.draft='Создай задачу: проверить вход';assert.equal(submitAssistantMessage(store,ctx).proposal.automatic,true);const html=renderAssistant(store,ctx,'');assert.match(html,/Циклы на паузе/);assert.match(html,/data-ceo-scope/)
})
test('unscoped explicit task asks for project instead of creating in a hidden default',()=>{
 const ctx=assistantScope('launch-home',{project:'atlas'},fresh()),store=createAssistantStore();assistantThread(store,ctx.key).draft='Создай задачу: first';const {proposal}=submitAssistantMessage(store,ctx);assert.equal(proposal.automatic,false);assert.equal(proposal.project,'')
})
