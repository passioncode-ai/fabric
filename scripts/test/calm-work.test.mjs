import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {operationsState,renderOperations,attachOperationsInteractions} from '../product/operations.mjs'
const fixture=JSON.parse(readFileSync('docs/ux/product-fixtures.json','utf8'))
const fresh=()=>{const fixtures=structuredClone(fixture),state={project:'atlas',task:'AT-42',run:'run-02',state:'ready'};return {fixtures,state,o:operationsState(state,fixtures)}}
// Check native disclosure boundaries without depending on screenshot dimensions.
function visibleMarkup(html){const stack=[];let out='';for(const token of html.split(/(<\/?details\b[^>]*>)/i)){if(/^<details\b/i.test(token))stack.push(/\bopen(?:[\s=>]|$)/.test(token));else if(/^<\/details/i.test(token))stack.pop();else if(stack.every(Boolean))out+=token}return out}
function button(html,action){return html.match(new RegExp('<button\\b[^>]*data-ops-action="'+action+'"[^>]*>'))?.[0]}
function harness(x){const listeners={},root={addEventListener:(type,fn)=>listeners[type]=fn,contains:()=>true};attachOperationsInteractions(root,{state:()=>x.state,fixtures:x.fixtures,rerender(){},navigate(view,patch){Object.assign(x.state,patch);x.state._opsView=view}});return action=>{const html=renderOperations('run',x.state,x.fixtures),tag=button(html,action);assert(tag,'action exists: '+action);assert(!tag.includes(' disabled'),'action enabled: '+action);const b={dataset:{opsAction:action,opsId:x.state.run,opsValue:''},disabled:false};listeners.click({target:{closest:selector=>selector==='[data-ops-action]'?b:null},preventDefault(){}})}}
test('task opens for reading with one primary transition; editing and other transitions stay available',()=>{
 const x=fresh(),html=renderOperations('task',x.state,x.fixtures),visible=visibleMarkup(html)
 assert(visible.includes(x.o.tasks['AT-42'].brief));assert(!visible.includes('data-ops-form="task-brief"'))
 assert(html.includes('data-ops-form="task-brief"'));assert(html.includes('data-ops-form="task-destination"'))
 assert.equal((html.match(/data-ops-action="task-move"/g)||[]).length,1)
 x.o.errors['task:AT-42']='Ошибка записи';x.o.drafts['task:AT-42'].brief='Мой несохранённый текст'
 const failed=visibleMarkup(renderOperations('task',x.state,x.fixtures));assert(failed.includes('Ошибка записи'));assert(failed.includes('Мой несохранённый текст'));assert(failed.includes('data-ops-form="task-brief"'))
})
test('run prioritises measured status and active controls; exact context remains disclosed',()=>{
 const x=fresh(),html=renderOperations('run',x.state,x.fixtures),visible=visibleMarkup(html)
 assert(html.indexOf('Исполнение и приёмка')<html.indexOf('Точный контекст допуска'))
 assert(button(visible,'run-stop'));assert(button(visible,'run-check'));assert(!button(visible,'run-spawn'))
 assert(!visible.includes('Config revision'));assert(html.includes('Config revision'));assert(html.includes('pack=past'))
 assert(button(html,'run-spawn-fail'));assert(!button(visible,'run-spawn-fail'));assert(!button(visible,'run-feed-fail'))
})
test('failed spawn, unknown delivery and requested stop retain visible recovery through actual handlers',()=>{
 const x=fresh();x.o.runs['run-02'].phase='admitted';const act=harness(x)
 act('run-spawn-fail');assert.equal(x.o.runs['run-02'].phase,'spawn-failed');assert(button(visibleMarkup(renderOperations('run',x.state,x.fixtures)),'run-spawn'))
 act('run-spawn');act('run-delivery-unknown');assert.equal(x.o.runs['run-02'].phase,'dispatch-unknown');assert(button(visibleMarkup(renderOperations('run',x.state,x.fixtures)),'run-ack'))
 act('run-ack');act('run-stop');assert.equal(x.o.runs['run-02'].phase,'stop-requested');assert(button(visibleMarkup(renderOperations('run',x.state,x.fixtures)),'run-stopped'))
 act('run-stopped');assert.equal(x.o.runs['run-02'].phase,'stopped');assert.notEqual(x.o.tasks['AT-42'].state,'done');assert(button(visibleMarkup(renderOperations('run',x.state,x.fixtures)),'run-retry'))
})
test('failed feed keeps its read action visible and source failure simulation disclosed',()=>{
 const x=fresh(),act=harness(x);act('run-feed-fail')
 const visible=visibleMarkup(renderOperations('run',x.state,x.fixtures));assert(visible.includes('Первое чтение не удалось'));assert(button(visible,'run-feed-read'));assert(!button(visible,'run-feed-fail'))
 act('run-feed-read');assert.equal(x.o.runs['run-02'].feed.status,'ready')
})
test('unknown admission retains visible reconciliation outside simulation controls',()=>{
 const x=fresh();x.o.tasks['AT-42'].pendingAdmission={command:'same-command'}
 const html=renderOperations('launch',x.state,x.fixtures),visible=visibleMarkup(html)
 assert(button(visible,'run-admit-reconcile'));assert(visible.includes('same-command'));assert(button(html,'run-admit-unknown'));assert(!button(visible,'run-admit-unknown'));assert(!button(visible,'run-admit-refused'))
})
