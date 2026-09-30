import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {calmFamilies,renderCalmAtlas,renderCalmNav} from '../product/calm.mjs'
import {fabricContextItems,resolveFabricAttachments} from '../product/context-items.mjs'
import {createAssistantStore,assistantScope,assistantThread,submitAssistantMessage} from '../product/assistant.mjs'
const model=JSON.parse(readFileSync('docs/ux/product-model.json','utf8'))
const fixtures=JSON.parse(readFileSync('docs/ux/product-fixtures.json','utf8'))
test('every model view has one operator family and remains reachable in navigation and atlas',()=>{
 const assigned=calmFamilies.flatMap(f=>f.views),nav=renderCalmNav('launch-home',{project:'atlas'},model,fixtures),atlas=renderCalmAtlas({state:'ready'},model)
 for(const v of model.views){assert.equal(assigned.filter(id=>id===v.id).length,1,v.id);assert(nav.includes('#view-'+v.id+'?'));assert(atlas.includes('#view-'+v.id+'?'))}
 assert.equal(assigned.length,model.views.length)
})
test('references are scoped to accessible projects and access loss blocks send without consuming draft',()=>{
 const f={projects:[{id:'a',name:'A'},{id:'b',name:'B',archived:true}],tasks:[{id:'t',project:'a',title:'Task'},{id:'other',project:'b'},{id:'no-project'}]}
 const items=fabricContextItems(f);assert.deepEqual(items.map(x=>x.id),['project:a','tasks:a:t'])
 const store=createAssistantStore(),context={key:'estate|a',project:'a',allowed:true,items:[]},t=assistantThread(store,context.key)
 t.draft='Создай задачу';t.attachments=[items[1]];assert.equal(submitAssistantMessage(store,context),null);assert.equal(t.draft,'Создай задачу');assert.equal(t.messages.length,0);assert(t.notice.includes('недоступен'))
})
test('cross-project references never change destination, originals or per-scope drafts',()=>{
 const store=createAssistantStore(),items=fabricContextItems({projects:[{id:'a',name:'A'},{id:'b',name:'B'}]})
 const context={key:'estate|a',estate:'estate',project:'a',label:'A',allowed:true,items},t=assistantThread(store,context.key)
 const other=assistantThread(store,'estate|estate');other.draft='Общий черновик';t.draft='Создай задачу: проверка';t.attachments=[items[1]]
 const r=submitAssistantMessage(store,context);assert.equal(r.proposal.project,'a');assert.equal(r.message.origin.project,'a');assert.equal(r.message.attachments[0].project,'b');assert.equal(other.draft,'Общий черновик');assert.equal(t.attachments.length,0)
 items[1].title='Changed';assert.equal(r.message.attachments[0].title,'B');assert.equal(resolveFabricAttachments([{id:'missing'}],items).ok,false)
})
test('home defaults to estate; project views default to their project without a task from another route',()=>{
 const s={project:'atlas',estate:'team-estate',state:'ready',task:'AT-42'}
 assert.equal(assistantScope('launch-home',s,fixtures).project,null);assert.equal(assistantScope('launch-project',s,fixtures).project,'atlas');assert.equal(assistantScope('launch-project',s,fixtures).task,null)
})
test('unfinished voice capture cannot submit a pre-existing text draft',()=>{
 const store=createAssistantStore(),ctx={key:'a',allowed:true,project:'a',items:[]},t=assistantThread(store,'a');t.draft='Не отправлять до расшифровки'
 for(const phase of ['recording','processing']){t.voice.phase=phase;assert.equal(submitAssistantMessage(store,ctx),null);assert.equal(t.messages.length,0);assert(t.draft)}
})
