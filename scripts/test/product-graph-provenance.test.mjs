import test from 'node:test'
import assert from 'node:assert/strict'
import {createGraphModel, renderGraph} from '../product/graphs.mjs'

const record={id:'D-09',title:'Сохранить границу входа',project:'atlas',task:'AT-42',author:'Оператор',reason:'Записанное основание ответа',created_at:'2026-09-07T14:31:09.125+02:00',context_pack:'CP-decision',evidence:['Q-12-receipt'],state:'current'}
const run={id:'AT-42-run-3',project:'atlas',task:'AT-42',pack:'CP-decision',iteration:3}
function fixture(decision=record,runs=[run]){return {projects:[{id:decision.project,name:decision.project}],tasks:[{id:decision.task,project:decision.project,title:'Задача',state:'running'}],decisions:[decision],projectRuns:runs}}
function project(decision=record,runs=[run]){return createGraphModel('decisions',{project:decision.project,fixtures:fixture(decision,runs)}).nodes.find(n=>n.id===decision.id)}
const inspect=(decision,runs,read='ready')=>renderGraph('decisions',{project:decision.project,fixtures:fixture(decision,runs),state:{selected:'node:'+decision.id,read}}).split('data-graph-inspector')[1].split('</aside>')[0]
const params=href=>new URLSearchParams(href.split('?')[1])

test('curated Atlas decision preserves exact recorded timestamp and package instead of fixture clock',()=>{
 const n=project();assert.equal(n.time,record.created_at);assert.equal(n.contextPack,'CP-decision');assert.equal(n.suppliedContext,'CP-decision')
 const p=params(n.contextHref);assert.equal(p.get('project'),'atlas');assert.equal(p.get('task'),'AT-42');assert.equal(p.get('run'),'AT-42-run-3');assert.equal(p.get('pack'),'past')
 const view=inspect(record,[run]);assert.ok(view.includes(record.created_at));assert.ok(view.includes('Открыть точный контекст CP-decision'));assert.ok(view.includes(record.reason));assert.equal(view.includes('09:42'),false)
})
test('generic Orbit decision uses context_pack and exact own run, preserving original timezone',()=>{
 const d={...record,id:'OR-D-1',project:'orbit',task:'OR-18',created_at:'2026-08-12T11:03:00Z',context_pack:'OR-CP-01',pack:'wrong-legacy'},r={...run,id:'OR-18-run-1',project:'orbit',task:'OR-18',pack:'OR-CP-01'}
 const n=project(d,[run,r]);assert.equal(n.time,d.created_at);assert.equal(n.contextPack,'OR-CP-01');assert.equal(params(n.contextHref).get('project'),'orbit');assert.equal(params(n.contextHref).get('run'),r.id)
 assert.equal(inspect(d,[run,r]).includes('project=atlas'),false)
})
test('missing timestamp and package remain explicitly unknown, no latest run fallback',()=>{
 const d={...record,created_at:undefined,context_pack:null,pack:'legacy-ignored'},n=project(d)
 assert.equal(n.time,'Не записано в источнике');assert.equal(n.contextPack,null);assert.equal(n.contextHref,null)
 assert.ok(inspect(d,[run]).includes('Точный пакет не приложен'));assert.equal(inspect(d,[run]).includes('Открыть точный контекст'),false)
})
test('known package with missing, foreign or wrong-task run has no substituted context destination',()=>{
 for(const rows of [[],[{...run,project:'orbit'}],[{...run,task:'AT-47'}],[{...run,pack:'CP-latest'}]]){
  const n=project(record,rows);assert.equal(n.contextPack,'CP-decision');assert.equal(n.contextHref,null);assert.ok(n.contextNote.includes('Последний прогон не подставляется'))
 }
})
test('ambiguous package-to-run references stay inspectable without choosing an arbitrary iteration',()=>{
 const n=project(record,[run,{...run,id:'AT-42-run-4',iteration:4}]);assert.equal(n.contextHref,null);assert.equal(n.contextPack,'CP-decision')
 const duplicate=project(record,[run,{...run}]);assert.equal(params(duplicate.contextHref).get('run'),run.id)
})
test('legacy explicit pack field supported only when canonical context_pack absent; mode is not an ID',()=>{
 const d={...record};delete d.context_pack;d.pack='CP-decision';assert.equal(project(d).contextPack,'CP-decision')
 for(const value of ['past','next','',{},false]){assert.equal(project({...d,pack:value}).contextPack,null);assert.equal(project({...d,pack:value}).contextHref,null)}
})
test('denied generic source cannot expose package navigation while known address stays recorded',()=>{
 const d={...record,id:'OD-1',project:'orbit',task:'OR-18'},r={...run,project:'orbit',task:'OR-18'}
 for(const read of ['denied-source','missing-source']){const view=inspect(d,[r],read);assert.equal(view.includes('Открыть точный контекст'),false);assert.ok(view.includes('Источник пакета недоступен'))}
})
test('raw provenance text is escaped and source inputs remain immutable',()=>{
 const d={...record,created_at:'<time>not-normalized</time>',context_pack:'CP-<unsafe>'},r={...run,pack:d.context_pack},f=fixture(d,[r]),before=JSON.stringify(f)
 createGraphModel('decisions',{project:'atlas',fixtures:f});const view=inspect(d,[r]);assert.ok(view.includes('&lt;time&gt;not-normalized&lt;/time&gt;'));assert.ok(view.includes('CP-&lt;unsafe&gt;'));assert.equal(JSON.stringify(f),before)
})
