import test from 'node:test'
import assert from 'node:assert/strict'
import { createGraphModel, createGraphState, reduceGraphState, visibleGraph, renderGraph, graphReturnHref, graphRouteState, graphKind } from '../product/graphs.mjs'
import { readFileSync } from 'node:fs'
const fixtures=JSON.parse(readFileSync(new URL('../../docs/ux/product-fixtures.json',import.meta.url)))
const build=(kind,state={})=>createGraphModel(kind,{fixtures,state})

test('four semantic graphs remain different projections and route aliases do not merge them',()=>{
  const all=['plan','history','agent','decisions'].map(k=>build(k))
  assert.equal(new Set(all.map(m=>m.route)).size,4)
  assert.ok(all[0].edges.some(e=>e.type==='membership'))
  assert.ok(all[1].edges.some(e=>e.type==='execution'))
  assert.ok(all[2].edges.some(e=>e.type==='assignment'))
  assert.ok(all[3].edges.some(e=>e.type==='citation'))
  assert.equal(graphKind('agent-history'),'agent')
  assert.throws(()=>graphKind('all'),/Unknown/)
})
test('each iteration has its own plan and independent step claims; rendering second cannot mutate first',()=>{
  const first=build('agent',{run:1}),before=JSON.stringify(first)
  const second=build('agent',{run:2})
  const run1=first.nodes.find(n=>n.id==='run-01'),run2=second.nodes.find(n=>n.id==='run-02')
  assert.equal(run1.revision,'plan-v1');assert.equal(run2.revision,'plan-v2')
  assert.equal(run1.steps[3].status,'failed');assert.equal(run2.steps[3].status,'pending')
  assert.ok(run1.steps.every(n=>n.claim==='declared'))
  assert.equal(JSON.stringify(first),before)
  assert.equal(second.nodes.some(n=>n.id==='run-01'),false)
})
test('failed verification is distinct from agent completed step claim',()=>{
  const m=build('agent',{run:1})
  assert.equal(m.nodes.find(n=>n.id==='run-01').steps[2].status,'done')
  assert.equal(m.nodes.find(n=>n.id==='E-14').claim,'verified')
  assert.equal(m.nodes.find(n=>n.id==='E-14').status,'failed')
})
test('plan progress retains completed membership and historical revision never gains later task',()=>{
  const legacy={...fixtures};delete legacy.goals;delete legacy.taskLinks;const current=createGraphModel('plan',{fixtures:legacy}),old=createGraphModel('plan',{fixtures:legacy,state:{revision:'plan-v1'}})
  assert.deepEqual(current.progress,{done:1,total:4})
  assert.ok(current.edges.some(e=>e.from==='goal-access'&&e.to==='AT-38'))
  assert.equal(old.nodes.some(n=>n.id==='AT-47'),false)
  assert.deepEqual(old.progress,{done:1,total:3})
})
test('recorded creator, assignee and Board recipient are not collapsed into a completed handoff',()=>{
  const m=build('agent'),created=m.nodes.find(n=>n.id==='AT-47'),q=m.nodes.find(n=>n.id==='Q-12')
  assert.equal(created.creator,'Builder');assert.equal(created.assignee,'Reviewer')
  assert.equal(q.board,'Atlas · вопросы');assert.equal(q.assignee,'Оператор')
  assert.ok(m.edges.some(e=>e.type==='assignment'))
  assert.equal(m.edges.some(e=>e.type==='consumed'||e.type==='answer'),false)
})
test('unknown decision authorship and absent retrieval are explicit; pack inclusion is separate from basis citation',()=>{
  const m=createGraphModel('decisions',{fixtures:{...fixtures,decisions:[]}}),d=m.nodes.find(n=>n.id==='D-08')
  assert.match(d.creator,/не указан/)
  assert.deepEqual(d.citations,['E-14'])
  assert.equal(m.edges.some(e=>e.from==='CP-01'&&e.type==='citation'),false)
  assert.ok(m.edges.some(e=>e.from==='F-19'&&e.to==='CP-01'&&e.type==='included'))
  assert.ok(m.edges.some(e=>e.from==='F-19'&&e.to==='F-21'&&e.type==='supersession'))
})
test('search filters remove dangling visual edges and clear hidden selection',()=>{
  const m=build('history'),s=createGraphState({selected:'node:AT-42'})
  const next=reduceGraphState(s,{type:'filter',key:'query',value:'Q-12'},m),v=visibleGraph(m,next)
  assert.equal(next.selected,'');assert.ok(v.nodes.length>0)
  assert.equal(v.nodes.every(n=>[n.id,n.source,n.title].join(' ').includes('Q-12')),true)
  const ids=new Set(v.nodes.map(n=>n.id));assert.ok(v.edges.every(e=>ids.has(e.from)&&ids.has(e.to)))
  assert.ok(v.hidden>0)
})
test('pagination preserves totals and selection independent of camera and presentation',()=>{
  const m=build('history'),s=createGraphState({limit:2,selected:'node:AT-42'}),v=visibleGraph(m,s)
  assert.equal(v.nodes.length,2);assert.equal(v.remaining,m.nodes.length-2)
  const next=reduceGraphState(reduceGraphState(s,{type:'more'},m),{type:'mode',value:'outline'},m)
  assert.equal(visibleGraph(m,next).nodes.length,m.nodes.length);assert.equal(next.selected,s.selected)
})
test('compact factual preview favors current work instead of oldest failed run',()=>{
  const m=build('history'),v=visibleGraph(m,{...createGraphState(),compact:true})
  assert.ok(v.nodes.some(n=>n.id==='run-02'));assert.ok(v.nodes.some(n=>n.id==='Q-12'))
  assert.equal(v.nodes.some(n=>n.id==='run-01'),false);assert.ok(v.hidden>0)
})
test('unlinked records remain a list without guessed edges',()=>{
  const m=build('history',{read:'unlinked'})
  assert.ok(m.nodes.length>0);assert.deepEqual(m.edges,[])
})
test('missing referenced fixture object is an explicit boundary, never silently fabricated',()=>{
  const altered=structuredClone(fixtures);altered.tasks=altered.tasks.filter(t=>t.id!=='AT-42')
  const m=createGraphModel('history',{fixtures:altered}),n=m.nodes.find(n=>n.id==='AT-42')
  assert.equal(n.sourceState,'missing');assert.equal(n.status,'unknown');assert.equal(n.href,undefined)
})
test('denied source is not replaced by current source or navigable as if authorized',()=>{
  const m=build('decisions',{read:'denied-source'}),n=m.nodes.find(n=>n.id==='E-14')
  assert.equal(n.sourceState,'denied');assert.equal(n.sourceHref,null)
  const rendered=renderGraph('decisions',{fixtures,state:{read:'denied-source',selected:'node:E-14'}})
  const inspector=rendered.split('data-graph-inspector')[1].split('</aside>')[0]
  assert.equal(inspector.includes('data-graph-navigate href="#view-reports'),false)
})
test('non-Atlas and custom draft scopes have no Atlas nodes, history or source snapshot',()=>{
  for(const options of [{project:'orbit'},{state:{project:'studio'}},{state:{project:'atlas',created:true}}]) {
    const m=createGraphModel('history',options)
    assert.equal(m.nodes.length,0);assert.equal(m.asOf,null)
    const rendered=renderGraph('history',options)
    assert.equal(rendered.includes('data-graph-value="node:AT-42"'),false)
    assert.equal(rendered.includes('09:42:00'),false)
  }
})
test('empty read is distinct from not-yet-read loading',()=>{
  assert.equal(build('history',{read:'empty'}).nodes.length,0)
  assert.equal(build('history',{read:'loading'}).nodes.length,0)
  assert.notEqual(renderGraph('history',{state:{read:'empty'}}),renderGraph('history',{state:{read:'loading'}}))
})
test('camera zoom retains the point under cursor and clamps hostile dimensions',()=>{
  const m=build('plan'),s=createGraphState({camera:{x:20,y:40,zoom:.5}})
  const next=reduceGraphState(s,{type:'zoom',factor:2,x:200,y:120},m)
  assert.equal((200-s.camera.x)/s.camera.zoom,(200-next.camera.x)/next.camera.zoom)
  assert.equal((120-s.camera.y)/s.camera.zoom,(120-next.camera.y)/next.camera.zoom)
  assert.equal(reduceGraphState(next,{type:'zoom',factor:100},m).camera.zoom,2)
  const moved=reduceGraphState(next,{type:'pan',x:Infinity,y:-9999999},m)
  assert.ok(Number.isFinite(moved.camera.x));assert.equal(moved.camera.y,-10000)
})
test('fit uses visible subset, not the entire hidden history',()=>{
  const m=build('history'),s=createGraphState({query:'Q-12'})
  const fitted=reduceGraphState(s,{type:'fit',width:700,height:500},m)
  assert.ok(fitted.camera.zoom>0);assert.ok(fitted.camera.zoom<=1)
  assert.ok(Number.isFinite(fitted.camera.x));assert.ok(Number.isFinite(fitted.camera.y))
})
test('graph scope, selected source, filters and exact camera survive source navigation URL roundtrip',()=>{
  const s=createGraphState({run:1,revision:'plan-v1',selected:'node:run-01',mode:'outline',query:'Builder & «review»',status:'failed',read:'stale',camera:{x:-82,y:27,zoom:.66},fitted:true})
  const route=graphReturnHref('agent',s,'atlas'),restored=graphRouteState(route)
  assert.deepEqual(restored,s)
  assert.ok(route.startsWith('#view-agent-history?project=atlas'))
})
test('URL false flags and hostile fixture text cannot enable expanded view or break script context',()=>{
  assert.equal(createGraphState({expanded:'false'}).expanded,false)
  const altered=structuredClone(fixtures);altered.tasks[1].title='</script><img src=x onerror=alert(1)>'
  const rendered=renderGraph('plan',{fixtures:altered})
  assert.equal((rendered.match(/<script\b/g)||[]).length,1)
  assert.equal(rendered.includes('<img src=x'),false)
  assert.ok(rendered.includes('\\u003c/script>'))
})
test('new controller decision appears by exact question without inventing replacement or delivery',()=>{
  const f=structuredClone(fixtures);f.questions[0].state='resolved';f.decisions=[{id:'D-09',title:'Проверить на staging',question:'Q-12',task:'AT-42',project:'atlas',reason:'Один проверочный запрос',author:'Оператор',evidence:['Q-12'],state:'current'}]
  const m=createGraphModel('decisions',{fixtures:f}),d=m.nodes.find(n=>n.id==='D-09')
  assert.equal(d.creator,'Оператор');assert.equal(m.nodes.find(n=>n.id==='Q-12').status,'done')
  assert.ok(m.edges.some(e=>e.from==='Q-12'&&e.to==='D-09'&&e.type==='settlement'))
  assert.equal(m.edges.some(e=>e.from==='D-08'&&e.to==='D-09'),false)
  assert.equal(m.edges.some(e=>e.type==='acknowledged'),false)
})
