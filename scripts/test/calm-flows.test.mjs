import test from 'node:test'
import assert from 'node:assert/strict'
import {guideRecord,attachGuided,renderGuided} from '../product/guided.mjs'
import {launchData,renderLaunch,syncLaunchWorkspace} from '../product/launch.mjs'
function guideHarness(s,fixtures){const listeners={},nav=[];let created=0;attachGuided({addEventListener:(k,v)=>listeners[k]=v},{state:()=>s,fixtures:()=>fixtures,rerender(){},navigate:(...a)=>nav.push(a),create:()=>{created++;return{id:'unexpected'}}});return{act:a=>listeners.click({target:{closest:()=>({dataset:{guide:a}})},preventDefault(){}}),nav,get created(){return created}}}
test('leaving guide does not award missing task or board outcomes',()=>{
 const s={guideView:'launch-guide',project:'calm-incomplete'},g=guideRecord(s),h=guideHarness(s,{projects:[]});h.act('complete');assert(!g.finished);g.task='t';h.act('complete');assert(!g.finished);g.topic='q';h.act('complete');assert(g.finished)
})
test('archived duplicate has recovery link and cannot create another project',()=>{
 const s={guideView:'launch-start',draftId:'calm-archive',state:'ready'},g=guideRecord(s);Object.assign(g,{name:'Again',purpose:'Goal',repo:'/same',step:3});const f={projects:[{id:'archived',name:'Before',repo:'/same',archived:true}]},h=guideHarness(s,f);h.act('review');h.act('create');assert.equal(h.created,0);assert.equal(h.nav.length,0);assert.equal(g.archive,'archived');assert(renderGuided('launch-start',s,f).includes('#view-archive?'))
})
test('new project overview and plan use own scope; empty tasks do not fabricate Atlas work',()=>{
 const s={project:'new-project',scope:'project',state:'ready'},d=launchData(s);d.projects=[{id:'new-project',name:'My project',purpose:'My outcome'}];d.fixtureTasks=[];d.fixtureAgents=[];d.topics=[]
 for(const view of ['launch-project','launch-plan']){const html=renderLaunch(view,s);assert(html.includes('My outcome'));assert(!html.includes('CTX-AT-42'));assert(!html.includes('project=atlas'))}
 d.fixtureTasks=[{id:'own',project:'new-project',title:'My task',state:'backlog'}];assert(renderLaunch('launch-plan',s).includes('task=own'))
})
test('portfolio history asks for a project instead of borrowing Atlas history',()=>{
 const s={state:'ready',scope:'estate',launchLevel:'portfolio',launchMode:'history'},html=renderLaunch('launch-plan',s);assert(html.includes('История по проектам'));assert(!html.includes('Исследованы точки потери истории'));assert(!html.includes('CTX-AT-43 зависит'))
})
