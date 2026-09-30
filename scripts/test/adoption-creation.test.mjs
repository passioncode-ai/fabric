import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { creationRecord, creationRoute, creationList, discardCreation, normalizedCreation, updateCreation, reviewCreation, commitCreation, pendCreation, reconcileCreation, createDemoProject, demoProjects } from '../product/new-project.mjs'
import { guideRecord, renderGuided, attachGuided, guidedViews } from '../product/guided.mjs'
import { renderProduct } from '../product/renderers.mjs'
import { renderWorkbench } from '../product/workbench.mjs'
import { registerOperationsProject, createOperationsState, createFabricTask } from '../product/operations.mjs'
import { registerIntegrationProject } from '../product/integrations.mjs'
import { applyPulseAction } from '../product/pulse.mjs'
const fresh=()=>JSON.parse(readFileSync('docs/ux/product-fixtures.json','utf8'))
const model=JSON.parse(readFileSync('docs/ux/product-model.json','utf8'))
let n=0
function harness(estate='team-estate',projects=[]){
 const s={estate,draftId:'ad03-'+(++n),guideView:'launch-start',project:'atlas',state:'ready'},listeners={},nav=[],created=[]
 attachGuided({addEventListener:(event,fn)=>listeners[event]=fn},{state:()=>s,fixtures:()=>({projects}),rerender(){},navigate:(...args)=>nav.push(args),create:payload=>{created.push(payload);return createDemoProject(payload)}})
 const act=(action,data={})=>listeners.click({target:{closest:()=>({dataset:{guide:action,...data}})}})
 const input=(field,value)=>listeners.input({target:{dataset:{guideField:field},value,type:typeof value==='boolean'?'checkbox':'text',checked:value}})
 return {s,act,input,nav,created,g:guideRecord(s)}
}
function idea(h){h.act('mode',{mode:'idea'});h.act('next');h.input('name','Own idea');h.input('purpose','Own outcome');h.act('next')}
test('both supported view aliases share one record and same renderer; Help resumes exact id',()=>{
 const h=harness();idea(h);assert.equal(creationRoute('onboarding'),'launch-start');assert(guidedViews.includes('onboarding'))
 assert.equal(guideRecord({...h.s,guideView:'onboarding'}),h.g)
 const f=fresh();assert.equal(renderGuided('onboarding',h.s,f),renderGuided('launch-start',h.s,f))
 assert.match(renderProduct('onboarding',h.s,model,f),/Познакомьтесь с Fabric/)
 assert.equal(renderWorkbench('onboarding',h.s,f),renderGuided('launch-start',h.s,f))
 assert.match(renderGuided('launch-help',h.s,f),new RegExp('draftId='+h.s.draftId))
 for(const kind of ['error','loading','partial','conflict'])assert.match(renderGuided('launch-start',{...h.s,state:kind},f),new RegExp('draftId='+h.s.draftId))
})
test('source → purpose → review; executor and advanced setup are optional disclosure',()=>{
 const h=harness();h.act('mode',{mode:'idea'});h.act('next');assert.equal(h.g.step,1)
 const html=renderGuided('launch-start',h.s,{projects:[]});assert.match(html,/<details class="disclosure"[^>]*><summary>Исполнитель и начальная конфигурация/)
 h.input('name','Simple');h.input('purpose','One result');h.act('next');assert.equal(h.g.step,2);assert.equal(h.g.review.provider,'later');h.act('create');assert.equal(h.created.length,1);assert.equal(h.nav.at(-1)[0],'launch-guide')
 assert.deepEqual(h.created[0].stages,[]);assert.equal(h.created[0].futureConsent,false)
})
test('single to idea clears EFFECTIVE source before duplicate/review/create; switching back detects archive',()=>{
 for(const archived of [true,false]){
  const h=harness('team-estate',[{id:'prior',name:'Previous',repo:'/same',archived}]);h.input('repo','/same');idea(h)
  assert.equal(h.g.repo,'/same');assert.equal(h.g.review.repo,'');assert.equal(h.g.review.repoMode,'none');h.act('create');assert.equal(h.created.length,1);assert.equal(h.created[0].repo,'')
  const other=harness('team-estate',[{id:'prior',name:'Previous',repo:'/same',archived}]);other.input('repo','/same');idea(other);other.act('mode',{mode:'single'});other.act('review');assert.equal(other.g.review,null);assert.equal(other.g.duplicate,'prior');other.act('create');assert.equal(other.created.length,0)
 }
})
test('one immutable reviewed payload, double submit and changed retry never creates twice',()=>{
 const h=harness();idea(h);h.act('create');h.act('create');assert.equal(h.created.length,1)
 const id=h.g.project;h.input('name','Later name');h.act('create');assert.equal(h.created.length,1);assert.equal(h.g.project,id);assert.equal(demoProjects.get(id).name,'Own idea');assert.match(h.g.notice,/Проект уже создан/);assert.equal(commitCreation(h.g,()=>{throw Error('No retry')},h.s).ok,false)
 const j=harness();idea(j);j.input('name','Changed before submit');j.act('create');assert.equal(j.created.length,0);assert.match(j.g.notice,/Проверьте проект/);j.act('review');j.act('create');assert.equal(j.created.length,1);assert.equal(j.created[0].name,'Changed before submit')
})
test('pending command reconciles exact original payload, holds discard and duplicate confirm',()=>{
 const h=harness();idea(h);h.act('unknown');const pending=structuredClone(h.g.pending);h.input('name','Later edit');h.act('create');assert.equal(h.created.length,0);h.act('discard');assert.equal(creationRecord(h.s),h.g)
 h.act('reconcile');h.act('reconcile');assert.equal(h.created.length,1);assert.deepEqual(h.created[0],pending.payload);assert.equal(h.g.receipt.project,h.g.project)
})
test('two estates and two drafts retain exact content; discard is addressed',()=>{
 const a=harness();idea(a);const b=creationRecord(a.s,true);updateCreation(b,'name','Second')
 assert.notEqual(b.draftId,a.g.draftId);assert.equal(creationRecord({estate:a.s.estate}),b);assert.equal(creationRecord(a.s),a.g)
 const other=creationRecord({...a.s,estate:'personal-estate'});assert.notEqual(other,a.g);assert.equal(other.name,'');discardCreation(b);assert(creationList(a.s.estate).includes(a.g));assert(!creationList(a.s.estate).includes(b))
})
test('persona old URL is preserved but aliases canonical creation; skip preserves identity',()=>{
 const h=harness();h.input('name','Retained');const state={...h.s,cohort:'new'};assert.equal(applyPulseAction(state,'skip-avatar'),'onboarding');assert.equal(guideRecord({...state,guideView:'onboarding'}),h.g);assert.equal(h.g.name,'Retained')
})
test('read denial and read-only prevent create and delayed reconciliation',()=>{
 for(const state of ['denied','partial','conflict','loading','error','read-only','stale','unknown','unsupported-state']){const h=harness();idea(h);h.s.state=state;h.act('create');assert.equal(h.created.length,0);assert.equal(commitCreation(h.g,()=>{throw Error('must not create')},h.s).ok,false)}
 const h=harness();idea(h);pendCreation(h.g,[]);assert.equal(reconcileCreation(h.g,()=>{throw Error('must not create')},{phase:'read-only'}).ok,false)
})
test('advanced software stages/provider survive same review; observer scope validated and paused by default',()=>{
 const f=[{id:'target',estate:'team-estate',name:'Target'}],h=harness('team-estate',f);idea(h);h.input('starter','software');h.input('provider','codex');h.input('stage-1','Define contract');h.input('stage-2','Independent review');h.act('review');h.act('create')
 const p=demoProjects.get(h.g.project);assert.deepEqual(p.startupSpec.stages,['Define contract','Independent review']);assert.deepEqual(p.startupSpec.roles,['Product manager','Builder','Reviewer']);assert.equal(p.startupSpec.routines,'paused');assert.equal(p.admitted,false);assert.deepEqual(p.tasks,[]);assert.deepEqual(p.runs,[])
 const o=harness('team-estate',f);idea(o);o.input('starter','observer');o.act('review');assert.equal(o.g.review,null);o.input('target','target');o.input('futureConsent',true);o.act('review');assert.equal(o.g.review.target,'target');assert.equal(o.g.review.futureConsent,true)
 o.input('target','foreign');o.act('review');assert.equal(o.g.review,null)
})
test('source validation and folder failure states do not create; manual fallback keeps purpose',()=>{
 const h=harness();h.input('name','Manual');h.input('purpose','Retained');h.act('review');assert.equal(h.g.review,null)
 h.act('mode',{mode:'folder'});for(const state of ['denied','cancelled','empty','partial']){h.act('scan-state',{state});assert.equal(h.created.length,0);assert.equal(h.g.scan,state)}
 h.act('mode',{mode:'idea'});h.act('review');assert.equal(h.g.review.purpose,'Retained')
})
test('repository research suggestions remain explicit and page-local',()=>{
 const h=harness();h.input('repo','org/repo');h.act('inspect');assert.equal(h.g.name,'');h.act('suggestion',{field:'name',choice:'accept'});assert.equal(h.g.name,'repo');h.act('suggestion',{field:'purpose',choice:'reject'});assert.equal(h.g.purpose,'');h.act('unavailable');assert.equal(h.g.inspection.status,'unavailable')
})

test('actual controller route prefix resolves target Estate before draft hydration', async()=>{
 const {runInNewContext}=await import('node:vm')
 const source=readFileSync('scripts/product/controller.js','utf8')
 // Execute the actual routing prefix through its hydration boundary. Rendering,
 // network and DOM are deliberately not stubbed into a claimed browser pass.
 const start=source.indexOf('function renderRoute(focus=true) {'),end=source.indexOf("  if(v==='authority')",start)
 assert(start>=0&&end>start)
 const route=source.slice(start,end)+'return state\n}\n}\nrenderRoute(false)'
 const draftId='scope-prefix-'+(++n),original=creationRecord({estate:'team-estate',draftId});updateCreation(original,'name','Team-only draft')
 const own=creationRecord({estate:'personal-estate',draftId});updateCreation(own,'name','Personal-only draft')
 const state={estate:'team-estate',project:'atlas',draftId,draft:original}
 const context={state,currentView:'estate',location:{hash:'#view-onboarding?estate=personal-estate&project=personal-empty&draftId='+draftId},URLSearchParams,model,scopeMemory:new Map(),scopedKeys:['draft'],routeKeys:['estate','project','draftId'],estateId:()=>state.estate||'team-estate',creationRoute,creationRecord,creationList}
 const result=runInNewContext(route,context)
 assert.equal(result.estate,'personal-estate');assert.equal(result.draft,own);assert.equal(result.draft.name,'Personal-only draft');assert.equal(original.name,'Team-only draft')
})

test('callback throw and malformed receipt preserve frozen intent for explicit reconciliation',()=>{
 for(const create of [()=>{throw Error('lost reply')},()=>null,()=>({}),()=>({id:''}),()=>({id:42})]){
  const h=harness();idea(h);const frozen=structuredClone(h.g.review);assert.equal(commitCreation(h.g,create,h.s).kind,'unknown');assert.deepEqual(h.g.pending.payload,frozen);assert.equal(h.g.project,null)
  updateCreation(h.g,'name','Later edit');let request;const result=reconcileCreation(h.g,payload=>{request=payload;return createDemoProject(payload)},h.s);assert(result.ok);assert.deepEqual(request,frozen);assert.equal(h.g.pending,null);assert.equal(demoProjects.get(result.project.id).name,'Own idea')
 }
})

test('lost reply after actual fixture commit reconciles one Project under same request identity',()=>{
 const h=harness();idea(h);const before=demoProjects.size;let committed
 const unknown=commitCreation(h.g,payload=>{committed=createDemoProject(payload);throw Error('reply lost after commit')},h.s)
 assert.equal(unknown.kind,'unknown');assert.equal(demoProjects.size,before+1)
 const recovered=reconcileCreation(h.g,createDemoProject,h.s);assert(recovered.ok);assert.equal(recovered.project.id,committed.id);assert.equal(demoProjects.size,before+1)
})

test('stale/unknown route states show recovery without editable creation or optimistic success',()=>{
 const h=harness();idea(h)
 for(const state of ['stale','unknown','unsupported-state']){const html=renderGuided('launch-start',{...h.s,state},{projects:[]});assert.match(html,/Перечитать/);assert(!html.includes('data-guide="create"'));assert(!html.includes('data-guide-field='));assert.match(html,new RegExp('draftId='+h.s.draftId))}
})


test('Help resumes the addressed existing project after unrelated creation; unfinished draft is separately labelled',()=>{
 const h=harness();idea(h);h.act('create');const f=fresh();f.projects.push(demoProjects.get(h.g.project))
 const help=renderGuided('launch-help',{...h.s,project:'atlas'},f)
 assert.match(help,/#view-launch-guide\?estate=team-estate&amp;project=atlas/)
 assert(!help.includes('#view-launch-guide?estate=team-estate&amp;project='+h.g.project))
 const d=harness();idea(d);const draftHelp=renderGuided('launch-help',{...d.s,project:'atlas'},f)
 assert.match(draftHelp,/Продолжить черновик/);assert.match(draftHelp,new RegExp('draftId='+d.s.draftId));assert.match(draftHelp,/#view-launch-guide\?estate=team-estate&amp;project=atlas/)
 const foreign=renderGuided('launch-help',{...h.s,estate:'personal-estate',project:'atlas'},f)
 assert(!foreign.includes('#view-launch-guide?estate=personal-estate&amp;project=atlas'))
})

test('folder manual fallback exposes a single source input and retains purpose before review',()=>{
 const h=harness();h.input('name','Manual');h.input('purpose','Keep this outcome');h.act('mode',{mode:'folder'});h.act('scan-state',{state:'denied'});h.act('next')
 assert.equal(h.g.step,0);assert.equal(h.g.mode,'single');assert.equal(h.g.purpose,'Keep this outcome')
 assert.match(renderGuided('launch-start',h.s,{projects:[]}),/data-guide-field="repo"/)
 h.input('repo','/manual/project');h.act('next');h.act('next');assert.equal(h.g.review.repo,'/manual/project');assert.equal(h.g.review.purpose,'Keep this outcome');h.act('create');assert.equal(h.created.length,1)
})


test('actual controller registration bridge never invents a deferred executor, binding or session',async()=>{
 const {runInNewContext}=await import('node:vm'),source=readFileSync('scripts/product/controller.js','utf8')
 const start=source.indexOf('function commitProjectDraft(draft)'),end=source.indexOf("document.addEventListener('input'",start)
 for(const provider of ['later','codex']){
  const f=fresh(),s={estate:'team-estate',state:'ready',ops:createOperationsState(f)},h=harness();idea(h);h.input('provider',provider);h.act('review')
  const bridge=runInNewContext(source.slice(start,end)+'\ncommitProjectDraft',{state:s,fixtures:f,estateId:()=>s.estate,createDemoProject,registerIntegrationProject,registerOperationsProject,structuredClone})
  const r=commitCreation(h.g,bridge,s);assert(r.ok);const id=r.project.id,row=f.projects.find(p=>p.id===id),agents=s.ops.agents.filter(a=>a.project===id),sessions=Object.values(s.ops.sessions).filter(a=>a.project===id)
  assert.equal(row.pmActive,false);assert.equal(row.routinesPaused,true);assert.equal(row.startupSpec.routines,'paused')
  assert.equal(agents.length,provider==='later'?0:1);assert.equal(sessions.length,provider==='later'?0:1);assert(!agents.some(a=>a.provider==='later'))
  if(provider==='codex'){assert.equal(agents[0].provider,'codex');assert.equal(agents[0].certified,false)}
  const t=createFabricTask({...s,project:id},f,{requestId:'ad03-first-task',project:id,title:'First real result',source:'ad03-test'});assert(t.ok);assert.equal(s.ops.tasks[t.entityRef.params.task].runner,'');assert.equal(Object.values(s.ops.runs).filter(r=>r.project===id).length,0)
  assert.equal(commitCreation(h.g,bridge,s).project.id,id);assert.equal(s.ops.agents.filter(a=>a.project===id).length,agents.length)
 }
})
