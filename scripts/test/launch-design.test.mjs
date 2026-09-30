import test from 'node:test'
import assert from 'node:assert/strict'
import {renderLaunch} from '../product/launch.mjs'
test('adding a normal topic never outranks an existing high-priority obligation',()=>{
 const s={state:'ready',project:'atlas'};renderLaunch('launch-home',s)
 s.launchData.topics.unshift({id:'new',project:'atlas',title:'New normal topic',status:'open',priority:'Обычный',kind:'Тема'})
 const html=renderLaunch('launch-home',s)
 assert(html.indexOf('Какой контекст передавать')<html.indexOf('New normal topic'))
})
test('global and project board scopes remain different reads',()=>{
 const s={state:'ready',project:'atlas',scope:'estate'}
 assert(renderLaunch('launch-board',s).includes('Уточнить критерии подборки'))
 assert(!renderLaunch('launch-board',{...s,scope:'project'}).includes('Уточнить критерии подборки'))
})
test('conflict retains the topic draft while visibly disabling submission',()=>{
 const s={state:'ready',project:'atlas'};renderLaunch('launch-home',s)
 s.launchData.newTopic=true;s.launchData.titleDraft='keep me';s.state='conflict'
 const html=renderLaunch('launch-home',s)
 assert(html.includes('value="keep me"'));assert.match(html,/data-launch="save-topic"[^>]*disabled/)
})
test('a historic run renders its own version rather than the next package',()=>{
 const html=renderLaunch('launch-agent',{state:'ready',project:'atlas',launchTab:'context',run:'1',pack:'past'})
 assert(html.includes('Сохранённый пакет запуска 1'));assert(html.includes('CTX-AT-42 · версия 1'))
 assert(!html.includes('CTX-AT-42 · версия 2'))
})
