import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {launchViews,renderLaunch,launchData,syncLaunchWorkspace,addLaunchArtifact,recordLaunchOutcome} from '../product/launch.mjs'
import {createAssistantStore,assistantScope,assistantThread,submitAssistantMessage,applyAssistantProposal,renderAssistant} from '../product/assistant.mjs'
import {routineStore,seedRoutineProposal,renderRoutines} from '../product/routines.mjs'
import {renderProduct} from '../product/renderers.mjs'
const fixtures=JSON.parse(readFileSync('docs/ux/product-fixtures.json','utf8'))
const model=JSON.parse(readFileSync('docs/ux/product-model.json','utf8'))
const fresh=()=>structuredClone(fixtures)
test('compiled report script parses without loading or operating a browser',()=>{
 const html=readFileSync('docs/reports/product.html','utf8');let n=0
 for(const [,attrs,body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!attrs.includes('application/json')){new vm.Script(body);n++}
 assert(n>0)
})
test('all model views render each declared common state without throwing',()=>{
 let n=0;for(const v of model.views)for(const state of ['ready','empty','loading','error','partial','denied','conflict']){const html=renderProduct(v.id,{project:'atlas',state,cohort:'existing',run:'2'},model,fresh());assert.equal(typeof html,'string',v.id+':'+state);assert(html.length>0);n++}assert.equal(n,model.views.length*7)
})
test('every launch view hides a retained draft after access loss and restores it on recovery',()=>{
 for(const view of launchViews){const s={project:'atlas',state:'ready'};launchData(s).newTopic=true;s.launchData.titleDraft='private-draft';s.state='denied';assert(!renderLaunch(view,s).includes('private-draft'),view);s.state='ready';assert(renderLaunch(view,s).includes('private-draft'),view)}
})
test('partial and conflict allow reading topics and graph controls while withholding writes',()=>{
 for(const state of ['partial','conflict']){const s={project:'atlas',state,item:'attention-1',scope:'project'};const h=renderLaunch('launch-board',s);assert.match(h,/data-launch="resolve-topic"[^>]*disabled/);assert(!/data-launch="(?:filter|close-topic)"[^>]*disabled/.test(h));assert(!/data-launch="zoom-in"[^>]*disabled/.test(renderLaunch('launch-plan',s)))}
})
test('new projects are reachable from Home and keep their own empty records',()=>{
 const f=fresh();f.projects.push({id:'local-unit',name:'Only Boreal',purpose:'Own goal',estate:'team-estate'});const s={state:'ready',project:'local-unit'};syncLaunchWorkspace(s,f);assert(renderLaunch('launch-home',s).includes('Only Boreal'));const h=renderLaunch('launch-project',s);assert(h.includes('Own goal'));assert(h.includes('project=local-unit'));assert(!h.includes('Сохраняем не только результат'))
})
test('estate switch isolates launch topics and restores local drafts',()=>{
 const s={state:'ready'};syncLaunchWorkspace(s,fresh());s.launchData.titleDraft='Team draft';syncLaunchWorkspace(Object.assign(s,{estate:'personal-estate'}),{...fresh(),projects:[],questions:[],proposals:[],leases:[]});assert.equal(s.launchData.topics.length,0);assert.equal(s.launchData.projects.length,0);syncLaunchWorkspace(Object.assign(s,{estate:'team-estate'}),fresh());assert.equal(s.launchData.titleDraft,'Team draft')
})
test('legacy obligations keep their own destination and cannot become a context decision',()=>{
 const s={state:'ready'},f=fresh();syncLaunchWorkspace(s,f);const q=s.launchData.obligations.find(t=>t.destination.params.question==='Q-12');assert(q);assert.equal(q.destination.view,'question');assert.notEqual(q.title,s.launchData.topics[0].title);assert(renderLaunch('launch-board',{...s,item:q.id}).includes('question=Q-12'))
})
test('outcome and receipt update exact launch topic without granting a staging effect',()=>{
 const s={state:'ready'};const receipt=recordLaunchOutcome(s,'attention-1','resolve-topic','Адресный пакет с источниками');assert(receipt);assert.equal(s.launchData.topics[0].delivery,'pending');assert.equal(s.launchData.topics[1].status,'open');assert.equal(s.launchData.events.length,1);assert(!('grant' in receipt));assert.equal(recordLaunchOutcome({...s,state:'conflict'},'attention-1','resolve-topic','other'),null)
})
test('assistant Home is global; project and exact task scope survive separate estate keys',()=>{
 const f=fresh(),s={project:'atlas',state:'ready'};assert.equal(assistantScope('launch-home',s,f).project,null);assert.equal(assistantScope('launch-agent',s,f).task,'CTX-AT-42');assert.notEqual(assistantScope('project',s,f).key,assistantScope('project',{...s,estate:'personal-estate'},f).key)
})
test('voice correction preserves original transcript and creates one explicit task intent before receipt',()=>{
 const store=createAssistantStore(),ctx=assistantScope('launch-agent',{project:'atlas',state:'ready',run:'1'},fresh()),t=assistantThread(store,ctx.key);t.voice={phase:'review',original:'Original speech'};t.draft='Создай задачу: Corrected text';const result=submitAssistantMessage(store,ctx);assert.equal(result.message.original,'Original speech');assert.equal(result.message.revision,2);assert.equal(result.message.origin.run,'1');assert.equal(t.messages.length,1);assert.equal(t.proposals.length,1);assert.equal(result.proposal.automatic,true)
})
test('failed artifact save remains unsaved and successful retry is idempotent',async()=>{
 const store=createAssistantStore(),ctx=assistantScope('project',{project:'atlas',state:'ready'},fresh()),t=assistantThread(store,ctx.key);t.draft='Создай задачу: A scoped task';const {proposal}=submitAssistantMessage(store,ctx);await applyAssistantProposal(store,ctx,proposal.id,()=>({ok:false,error:'Rejected'}));assert.equal(proposal.saved,false);assert.equal(proposal.error,'Rejected');let calls=0;const callback=()=>{calls++;return {ok:true,receipt:'r1',entityRef:{view:'launch-board',params:{project:'atlas',item:'one'}}}};await applyAssistantProposal(store,ctx,proposal.id,callback);await applyAssistantProposal(store,ctx,proposal.id,callback);assert.equal(proposal.saved,true);assert.equal(calls,1)
})
test('proposal becomes one Board item, and another project cannot receive it implicitly',()=>{
 const s={state:'ready'},a={id:'one',project:'atlas',title:'Requested work',prompt:'Details',source:'conversation-1:message-1'};syncLaunchWorkspace(s,fresh());assert(addLaunchArtifact(s,a).ok);assert(addLaunchArtifact(s,a).ok);assert.equal(s.launchData.topics.filter(t=>t.id==='ceo:one').length,1);assert.equal(addLaunchArtifact(s,{...a,project:'missing'}).ok,false)
})
test('leaving the recording scope interrupts voice without moving its draft',()=>{
 const store=createAssistantStore(),a=assistantScope('project',{project:'atlas'},fresh()),b=assistantScope('launch-home',{project:'atlas'},fresh());store.context=a;const t=assistantThread(store,a.key);t.voice={phase:'recording'};t.draft='Original scope';renderAssistant(store,b,'');assert.equal(t.voice.phase,'interrupted');assert.equal(t.draft,'Original scope');assert.equal(assistantThread(store,b.key).draft,'')
})
test('cycle proposals deduplicate and exact missing ID cannot edit the first routine',()=>{
 const id=seedRoutineProposal('atlas',{id:'proposal-1',title:'Morning review',prompt:'Collect questions'});assert.equal(seedRoutineProposal('atlas',{id:'proposal-1',title:'Again'}),id);assert.equal(routineStore('atlas').records.find(r=>r.id===id).state,'paused');assert.match(renderRoutines('routine-editor',{project:'atlas',routine:'MISSING'},fresh()),/Цикл не найден/)
})
test('cycle drafts and pending preview are isolated between routine IDs',()=>{
 const d=routineStore('atlas');renderRoutines('routine-editor',{project:'atlas',routine:'RT-1'},fresh());d.draft={...structuredClone(d.records[0]),name:'My draft'};d.reason='Reason';const id=seedRoutineProposal('atlas',{id:'proposal-2',title:'Other cycle'});assert(!renderRoutines('routine-editor',{project:'atlas',routine:id},fresh()).includes('My draft'));assert(renderRoutines('routine-editor',{project:'atlas',routine:'RT-1'},fresh()).includes('My draft'))
})
test('resume follows the last visited project instead of silently returning Atlas',()=>{
 const s={state:'ready',project:'orbit'};syncLaunchWorkspace(s,fresh());renderLaunch('launch-project',s);const h=renderLaunch('launch-home',s);assert.match(h,/id="home-resume-title">Orbit</);assert.match(h,/Продолжить/)
})
test('empty persona retains the avatar selection rather than substituting onboarding',()=>{
 const h=renderLaunch('launch-persona',{state:'empty'});assert.match(h,/data-pulse="save-avatar"/)
})
test('a specific release link overrides an earlier selected candidate',()=>{
 const s={state:'ready',project:'atlas',release:'atlas-042'};const h=renderLaunch('launch-releases',s);assert.match(h,/Atlas 0.4.2/);assert.equal(s.pulseData.release,'atlas-042');assert.match(renderLaunch('launch-releases',{state:'ready',project:'studio',release:'atlas-042'}),/Релиз не найден/)
})
