import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8')
const dataURL='data:text/javascript;base64,'+Buffer.from(read('scripts/product/graphs.mjs')).toString('base64')
const css=['apps/desktop/src/renderer/src/tokens.paperclip.css','apps/desktop/src/renderer/src/tokens.passioncode.css','apps/desktop/src/renderer/src/tokens.app.css','scripts/product/graphs.css'].map(read).join('\n')
const fixtures={projects:[{id:'orbit',name:'Orbit'}],tasks:[{id:'OR-18',project:'orbit',title:'Повтор event id',state:'running'}],decisions:[{id:'OD-1',project:'orbit',task:'OR-18',title:'Записанное решение',reason:'Проверить дедупликацию',author:'Оператор',created_at:'2026-09-07T14:31:09.125+02:00',context_pack:'OR-CP-01',evidence:['OR-E-01']}],projectRuns:[{id:'OR-18-run-1',project:'orbit',task:'OR-18',pack:'OR-CP-01',iteration:1},{id:'OR-18-run-2',project:'orbit',task:'OR-18',pack:'OR-CP-02',iteration:2}]}
const browser=await chromium.launch({headless:true,...(process.env.FABRIC_CHROME?{executablePath:process.env.FABRIC_CHROME}:{})})
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.setContent(`<html><head><style>${css}</style></head><body><main></main><script type="module">import * as g from '${dataURL}';window.f=${JSON.stringify(fixtures)};window.draw=(read='ready')=>{window.clean?.();document.querySelector('main').innerHTML=g.renderGraph('decisions',{project:'orbit',agent:'orbit-builder',fixtures:window.f,state:{read}});window.clean=g.attachGraphInteractions(document.querySelector('main'),{onNavigate:(nav,event)=>{event.preventDefault();window.nav=nav}})};window.draw();window.ready=true;</script></body></html>`)
 await page.waitForFunction(()=>window.ready);const graph=page.locator('.fg-explorer'),inspector=graph.locator('[data-graph-inspector]')
 const select=()=>graph.locator('.fg-node[data-graph-value="node:OD-1"]').click()
 await select();assert.match(await inspector.innerText(),/2026-09-07T14:31:09.125\+02:00/)
 await inspector.getByRole('link',{name:'Открыть точный контекст OR-CP-01',exact:true}).click()
 const nav=await page.evaluate(()=>window.nav),p=new URLSearchParams(nav.href.split('?')[1]);assert.equal(p.get('run'),'OR-18-run-1');assert.equal(p.get('task'),'OR-18');assert.equal(p.get('project'),'orbit');assert.equal(p.get('pack'),'past');assert.equal(p.get('agent'),'orbit-builder');assert.ok(nav.returnHref.includes('graphSelected=node%3AOD-1'))
 await page.evaluate(()=>{window.f.projectRuns=[];window.draw()});await select();assert.match(await inspector.innerText(),/OR-CP-01/);assert.match(await inspector.innerText(),/Последний прогон не подставляется/);assert.equal(await inspector.getByRole('link',{name:/Открыть точный контекст/}).count(),0)
 await page.evaluate(()=>{window.f.projectRuns=[{id:'OR-18-run-1',project:'orbit',task:'OR-18',pack:'OR-CP-01'}];window.draw('denied-source')});await select();assert.equal(await inspector.getByRole('link',{name:/Открыть точный контекст/}).count(),0);assert.match(await inspector.innerText(),/Источник пакета недоступен/)
 await page.evaluate(()=>{delete window.f.decisions[0].created_at;delete window.f.decisions[0].context_pack;window.draw()});await select();assert.match(await inspector.innerText(),/Не записано в источнике/);assert.match(await inspector.innerText(),/Точный пакет не приложен/)
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[])
 console.log('Graph provenance browser: exact timestamp/run/scope/back, absent mapping, denied source, unknown provenance, 390px: 6 checks pass; page errors 0.')
}finally{await browser.close()}
