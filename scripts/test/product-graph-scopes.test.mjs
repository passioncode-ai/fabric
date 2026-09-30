import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createGraphModel,renderGraph,graphReturnHref,graphRouteState,createGraphState} from '../product/graphs.mjs'
const fixture=JSON.parse(readFileSync(new URL('../../docs/ux/product-fixtures.json',import.meta.url)))
function data(){const f=structuredClone(fixture);f.agents=f.agents.map(a=>({...a,project:f.projects.find(p=>p.name===a.scope)?.id,binding:'binding-'+a.id+'-1',session:'session-'+a.id}));f.projectRuns=[{id:'OR-18-run-1',iteration:1,task:'OR-18',project:'orbit',agent:'orbit-builder',binding:'binding-orbit-builder-1',session:'session-orbit-builder',phase:'running',plan_version:'orbit-plan-v3',command:'admit-or18',delivery:'acknowledged',steps:[{id:'or-check',title:'Проверить повтор event id',status:'active'}],receipts:[]}];return f}

test('Orbit history uses OR18 and its exact own TaskRun without Atlas source objects',()=>{
 const m=createGraphModel('history',{project:'orbit',fixtures:data()})
 assert.equal(m.nodes.some(n=>n.id==='AT-42'),false);assert.ok(m.nodes.some(n=>n.id==='OR-18'))
 const r=m.nodes.find(n=>n.id==='OR-18-run-1');assert.equal(r.revision,'orbit-plan-v3');assert.equal(r.task,'OR-18');assert.equal(r.steps[0].id,'or-check');assert.ok(r.href.includes('project=orbit'));assert.ok(r.href.includes('run=OR-18-run-1'))
 assert.ok(m.edges.every(e=>m.nodes.some(n=>n.id===e.from)&&m.nodes.some(n=>n.id===e.to)))
})
test('Reviewer receives assigned task but no invented Builder runs',()=>{
 const m=createGraphModel('agent',{project:'atlas',agent:'reviewer',fixtures:data()})
 assert.ok(m.nodes.some(n=>n.id==='AT-47'));assert.equal(m.nodes.some(n=>n.id==='AT-42'),false);assert.equal(m.nodes.some(n=>n.type==='run'),false)
 assert.ok(m.diagnostics.some(d=>d.includes('неизвестна')))
})
test('Reviewer history includes exact admitted run and preserves independent steps',()=>{
 const f=data();f.projectRuns.push({id:'AT-47-run-1',iteration:1,task:'AT-47',project:'atlas',agent:'reviewer',binding:'binding-reviewer-1',phase:'admitted',plan_version:'review-plan-v1',delivery:'not dispatched'})
 const m=createGraphModel('agent',{project:'atlas',agent:'reviewer',fixtures:f}),r=m.nodes.find(n=>n.id==='AT-47-run-1')
 assert.equal(r.revision,'review-plan-v1');assert.deepEqual(r.steps,[]);assert.ok(r.href.includes('agent=reviewer'));assert.ok(r.href.includes('task=AT-47'))
 assert.ok(r.detail.includes('не передан'))
})
test('agent from different project never falls back to a same-name agent',()=>{
 const m=createGraphModel('agent',{project:'orbit',agent:'builder',fixtures:data()})
 assert.equal(m.nodes.length,0);assert.ok(m.unavailable)
 const actual=createGraphModel('agent',{project:'orbit',agent:'orbit-builder',fixtures:data()});assert.ok(actual.nodes.some(n=>n.id==='OR-18'))
})
test('unscoped or wrong-project run cannot be attached using task title or numeric iteration',()=>{
 const f=data();f.projectRuns.push({id:'foreign',iteration:1,task:'OR-18',project:'atlas',agent:'orbit-builder',plan_version:'wrong'});f.projectRuns.push({id:'missing-scope',task:'OR-18',agent:'orbit-builder'})
 const m=createGraphModel('history',{project:'orbit',fixtures:f});assert.equal(m.nodes.some(n=>['foreign','missing-scope'].includes(n.id)),false)
})
test('new Atlas TaskRun appears instead of disappearing behind fixed run1/2 fixture',()=>{
 const f=data();f.projectRuns.push({id:'AT-42-run-3',iteration:3,task:'AT-42',project:'atlas',agent:'builder',binding:'binding-builder-1',phase:'running',plan_version:'plan-v3',step_states:['pending']})
 const m=createGraphModel('agent',{project:'atlas',agent:'builder',fixtures:f});assert.ok(m.nodes.some(n=>n.id==='AT-42-run-3'));assert.equal(m.nodes.find(n=>n.id==='AT-42-run-3').steps[0].status,'pending')
})
test('target plan joins only explicit goal and dependency refs, retaining unassigned backlog',()=>{
 const f=data();f.tasks.find(t=>t.id==='OR-18').goal_id='goal-orbit';f.goals=[{id:'goal-orbit',title:'Надёжная доставка',project:'orbit',revision:'or-plan-1'}]
 f.taskLinks=[{project:'orbit',from:'AT-42',to:'OR-18',rel:'needs',source:'foreign-attempt',payload:'Should not join'}]
 const m=createGraphModel('plan',{project:'orbit',fixtures:f})
 assert.ok(m.edges.some(e=>e.from==='goal-orbit'&&e.to==='OR-18'));assert.equal(m.edges.some(e=>e.from==='AT-42'),false);assert.equal(m.nodes.some(n=>n.id==='AT-42'),false)
 const unlinked=createGraphModel('plan',{project:'orbit',fixtures:{...data(),goals:[],taskLinks:[]}});assert.equal(unlinked.progress.total,0);assert.match(unlinked.revision,/неизвестна/);assert.ok(unlinked.diagnostics.length)
})
test('other-project decisions retain their own actor/evidence and explicit replacement only',()=>{
 const f=data();f.decisions=[{id:'OD-1',project:'orbit',title:'Дедупликация по event id',author:'Оператор',task:'OR-18',evidence:['OR-E-02'],reason:'Повтор доставки'}, {id:'D-08',project:'atlas',title:'Other'}]
 const m=createGraphModel('decisions',{project:'orbit',fixtures:f});assert.deepEqual(m.nodes.map(n=>n.id),['OD-1']);assert.deepEqual(m.nodes[0].citations,['OR-E-02']);assert.equal(m.edges.length,0)
})
test('exact project/agent/TaskRun scope survives return URL and source inspector links',()=>{
 const state=createGraphState({runId:'AT-47-run-1',agent:'reviewer',selected:'node:AT-47',mode:'outline'}),route=graphReturnHref('agent',state,'atlas','reviewer')
 const restored=graphRouteState(route);assert.equal(restored.agent,'reviewer');assert.equal(restored.runId,'AT-47-run-1')
 const html=renderGraph('agent',{project:'orbit',agent:'orbit-builder',fixtures:data(),state:{selected:'node:OR-18-run-1'}})
 const inspector=html.split('data-graph-inspector')[1].split('</aside>')[0]
 assert.ok(inspector.includes('project=orbit'));assert.ok(inspector.includes('agent=orbit-builder'));assert.ok(inspector.includes('run=OR-18-run-1'));assert.equal(inspector.includes('project=atlas'),false)
})
test('full curated Builder/Atlas graph retained when no extra actual runs passed',()=>{
 const m=createGraphModel('agent',{project:'atlas',agent:'builder',fixtures:fixture,state:{run:2}})
 assert.equal(m.generic,undefined);assert.ok(m.nodes.some(n=>n.id==='Q-12'));assert.ok(m.edges.some(e=>e.type==='assignment'))
})
test('cancelled tasks remain cancelled and cyclic SHOULD dependencies remain visible diagnostics',()=>{
 const f=data();f.tasks.find(t=>t.id==='OR-18').state='cancelled';f.tasks.push({id:'OR-19',title:'Next',project:'orbit',state:'backlog',owner:'Builder'});f.taskLinks=[{project:'orbit',from:'OR-18',to:'OR-19',rel:'needs',source:'or-plan'},{project:'orbit',from:'OR-19',to:'OR-18',rel:'needs',source:'or-plan'}]
 const m=createGraphModel('plan',{project:'orbit',fixtures:f});assert.equal(m.nodes.find(n=>n.id==='OR-18').status,'cancelled');assert.ok(m.diagnostics.some(d=>d.includes('Цикл зависимостей')))
})
