// Optional real-browser behavior checks. No server, database, product process or
// network request. Set PLAYWRIGHT_MODULE to a locally available package entry.
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {renderGraph} from '../product/graphs.mjs'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8')
const fixtures=JSON.parse(read('docs/ux/product-fixtures.json'))
const source=read('scripts/product/graphs.mjs')
const css=['apps/desktop/src/renderer/src/tokens.paperclip.css','apps/desktop/src/renderer/src/tokens.passioncode.css','apps/desktop/src/renderer/src/tokens.app.css','scripts/product/graphs.css'].map(read).join('\n')
const moduleURL='data:text/javascript;base64,'+Buffer.from(source).toString('base64')
const browser=await chromium.launch({headless:true,...(process.env.FABRIC_CHROME?{executablePath:process.env.FABRIC_CHROME}:{})})
let checks=0
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}body{margin:0;padding:16px}#mount{max-width:1280px;margin:auto}</style></head><body><main id="mount">${renderGraph('history',{id:'test-graph',fixtures})}</main><script type="module">import * as g from '${moduleURL}';window.g=g;window.fixture=${JSON.stringify(fixtures)};window.snapshots=[];window.navigations=[];window.cleanup=g.attachGraphInteractions(document.getElementById('mount'),{onStateChange:s=>window.snapshots.push(s),onNavigate:(x,e)=>{e.preventDefault();window.navigations.push(x)}});window.ready=true;</script></body></html>`)
 await page.waitForFunction(()=>window.ready)
 if(process.env.GRAPH_DESKTOP_SCREENSHOT)await page.screenshot({path:process.env.GRAPH_DESKTOP_SCREENSHOT,fullPage:true})
 const graph=page.locator('.fg-explorer'),node=id=>graph.locator(`[data-graph-action="select"][data-graph-value="node:${id}"]`).first()
 await node('run-01').click();assert.match(await graph.locator('[data-graph-inspector]').innerText(),/plan-v1/);assert.match(await graph.locator('[data-graph-inspector]').innerText(),/Проверка не пройдена/);checks++
 await graph.locator('[data-graph-inspector] a').filter({hasText:'К прогону 1'}).click();let nav=await page.evaluate(()=>window.navigations.at(-1));assert.ok(nav.href.includes('run=1'));assert.equal(nav.state.selected,'node:run-01');assert.ok(nav.returnHref.includes('graphSelected=node%3Arun-01'));checks++
 await graph.locator('[data-graph-action="mode"][data-graph-value="outline"]').click();assert.equal(await graph.locator('.fg-viewport').isVisible(),false);assert.equal(await graph.locator('.fg-data-list').isVisible(),true);checks++
 await graph.locator('[data-graph-action="mode"][data-graph-value="graph"]').click();await graph.locator('.fg-filters summary').click();await graph.locator('[data-graph-control="query"]').fill('Q-12');assert.equal(await graph.locator('.fg-node').count(),1);assert.equal(await page.evaluate(()=>window.snapshots.at(-1).selected),'');checks++
 await graph.locator('[data-graph-action="clear"]').first().click();assert.equal(await graph.locator('[data-graph-control="query"]').inputValue(),'');await graph.locator('[data-graph-viewport]').focus();let before=await page.evaluate(()=>window.snapshots.at(-1).camera.x);await page.keyboard.press('ArrowRight');assert.notEqual(await page.evaluate(()=>window.snapshots.at(-1).camera.x),before);checks++
 before=await page.evaluate(()=>window.snapshots.at(-1).camera.zoom);await page.keyboard.press('+');assert.ok((await page.evaluate(()=>window.snapshots.at(-1).camera.zoom))>before);checks++
 await graph.locator('[data-graph-action="expand"]').click();assert.equal(await graph.evaluate(e=>e.classList.contains('fg-expanded')),true);await page.keyboard.press('Escape');assert.equal(await graph.evaluate(e=>e.classList.contains('fg-expanded')),false);checks++
 await page.evaluate(()=>{window.cleanup();document.getElementById('mount').innerHTML=window.g.renderGraph('agent',{id:'agent-test',fixtures:window.fixture,state:{run:1}});window.cleanup=window.g.attachGraphInteractions(document.getElementById('mount'),{onStateChange:s=>window.snapshots.push(s)})});await graph.locator('[data-graph-control="run"]').selectOption('2');assert.equal(await graph.locator('.fg-node[data-graph-value="node:run-01"]').count(),0);assert.equal(await graph.locator('.fg-node[data-graph-value="node:run-02"]').count(),1);checks++
 await page.setViewportSize({width:390,height:844});await node('Q-12').click();assert.match(await graph.locator('[data-graph-inspector]').innerText(),/Оператор/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks++
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await graph.locator('.fg-node').first().evaluate(e=>getComputedStyle(e).animationName),'none');checks++
 await page.evaluate(()=>{window.cleanup();document.getElementById('mount').innerHTML=window.g.renderGraph('history',{id:'preview-test',fixtures:window.fixture,compact:true});window.cleanup=window.g.attachGraphInteractions(document.getElementById('mount'),{onStateChange:s=>window.snapshots.push(s)})});await node('Q-12').click();assert.ok((await graph.locator('[data-graph-navigate]').getAttribute('href')).includes('graphSelected=node%3AQ-12'));checks++
 await page.evaluate(()=>{window.cleanup();const snapshots=window.snapshots.length;document.querySelector('[data-graph-action="select"]').click();window.cleanupCount=snapshots===window.snapshots.length});assert.equal(await page.evaluate(()=>window.cleanupCount),true);checks++
 assert.deepEqual(errors,[])
 if(process.env.GRAPH_SCREENSHOT)await page.screenshot({path:process.env.GRAPH_SCREENSHOT,fullPage:true})
 console.log(`Graph browser behavior: ${checks} checks passed; page errors: ${errors.length}.`)
}finally{await browser.close()}
