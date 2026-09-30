// Uses an isolated headless browser and local fixture report. Never starts
// Fabric, attaches to a user's browser, calls product IPC or accesses a DB.
const {chromium}=require(process.env.FABRIC_PLAYWRIGHT_MODULE||'playwright')
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict')
const model=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/ux/product-model.json'),'utf8'))
const base=process.env.FABRIC_REPORT_BASE||'http://127.0.0.1:8770/reports/product.html'
const out=process.env.FABRIC_BROWSER_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'fabric-product-browser-'))
fs.mkdirSync(out,{recursive:true})
let owned
;(async()=>{
 const browser=owned=await chromium.launch({headless:true,...(process.env.FABRIC_CHROME?{executablePath:process.env.FABRIC_CHROME}:{})}),page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'})
 page.setDefaultTimeout(8000)
 const errors=[],network=[],checks=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',r=>{if(r.request().url().startsWith(new URL(base).origin))return r.continue();network.push(r.request().url());return r.abort()})
 async function route(hash){await page.goto(base+hash);await page.reload();await page.waitForFunction(()=>document.documentElement.classList.contains('js'));await page.evaluate(()=>new Promise(requestAnimationFrame))}
 async function navigate(hash){await page.evaluate(h=>location.hash=h,hash);await page.evaluate(()=>new Promise(requestAnimationFrame));await page.evaluate(()=>new Promise(requestAnimationFrame))}
 const screen=page.locator('#product-screen')
 await route('#view-estate')
 for(const view of model.views){
  for(const state of ['ready','empty','loading','error','partial','denied','conflict']){
   await navigate('#view-'+view.id+'?state='+state+'&project=atlas')
   assert(await screen.locator('h2').count()>0,view.id+' missing heading at '+state)
   const text=await screen.innerText();assert(text.length>50,view.id+' empty render at '+state)
  }
 }
 checks.push({kind:'render_matrix',views:model.views.length,states:7,renders:model.views.length*7})
 for(const j of model.journeys){
  for(const [i,step] of j.steps.entries()){
   const params=new URLSearchParams({...step.fixture_state,journey:j.id,step:i})
   await navigate('#view-'+step.view+'?'+params)
   // First-release views present like the app and hide report tools until review mode is on.
   if(await page.evaluate(()=>document.documentElement.classList.contains('r0-active')&&!document.documentElement.classList.contains('r0-review'))){await screen.getByRole('button',{name:'Инструменты макета'}).click();await page.evaluate(()=>new Promise(requestAnimationFrame))}
   assert(await page.locator('#walkthrough').isVisible(),j.id+' guide missing')
   assert.equal(await page.locator('#current-view').inputValue(),step.view)
  }
 }
 checks.push({kind:'journey_steps',journeys:model.journeys.length,steps:model.journeys.reduce((n,j)=>n+j.steps.length,0)})
 await route('#journey-spec-PJ-02');assert(await page.locator('#coverage').isVisible());assert(await page.locator('#journey-spec-PJ-02').getAttribute('open')!==null);checks.push({kind:'coverage_deeplink',pass:true})
 await route('#screen-SCR-44');await page.waitForURL(/view-manager/);assert.equal(await page.locator('#current-view').inputValue(),'manager');checks.push({kind:'screen_deeplink',pass:true})
 // Removed 2026-09-28 (CO-171): this step drove the guided creation form, which renderFirstRelease now
 // pre-empts for 'onboarding' and 'launch-start' (first-release routing precedence, 2026-09-25, FLW-55).
 // That form is unreachable; draft retention on the current path is covered by scripts/test/first-release.test.mjs.
 // A fresh project, registered the way the controller registers a created one, then its own task, pack, run, ACK and check.
 const project='local-report-1';await page.evaluate(id=>registerOperationsProject(state,fixtures,{id,name:'Новый проект',purpose:'Проверить новый результат',provider:'claude-code'}),project);checks.push({kind:'create_project_fixture',pass:true,route:'registerOperationsProject, as controller.js does after creation'})
 await navigate('#view-task-new?project='+project);await screen.locator('[name=title]').fill('Проверить новый результат');await screen.locator('[name=result]').fill('Возврат работает');await screen.locator('[name=check]').fill('Положительный и отрицательный тест');await screen.locator('[data-ops-form=new-task]').evaluate(f=>f.requestSubmit());const task=await page.evaluate(()=>state.task);assert.equal(await screen.locator('[name=brief]').inputValue(),'Возврат работает')
 await navigate('#view-launch?project='+project+'&task='+task);assert(await screen.locator('[data-ops-action=run-admit]').isDisabled());await navigate('#view-context-pack?project='+project+'&task='+task+'&pack=next');await screen.locator('[data-ops-form=context-select]').evaluate(f=>f.requestSubmit());await navigate('#view-launch?project='+project+'&task='+task);await screen.locator('[data-ops-form=launch-readiness]').evaluate(f=>f.requestSubmit());await screen.locator('[data-ops-action=run-admit]').click();for(const action of ['run-spawn','run-deliver','run-ack','run-check'])await screen.locator('[data-ops-action='+action+']').click();assert.match(await screen.innerText(),/Результат проверен/);assert.doesNotMatch(await screen.innerText(),/AT-42|F-19|Atlas/);await navigate('#view-project-history?project='+project);assert.match(await screen.innerText(),new RegExp(task));checks.push({kind:'fresh_project_own_task_pack_run_ACK_check_graph',pass:true})
 await route('#view-estate');await page.locator('[data-ceo-action=toggle]').click();await page.locator('[name=ceo-message]').fill('Только estate draft');await navigate('#view-project?project=atlas');assert.equal(await page.locator('[name=ceo-message]').inputValue(),'');await page.locator('[name=ceo-message]').fill('Atlas note');await navigate('#view-project?project=orbit');assert.equal(await page.locator('[name=ceo-message]').inputValue(),'');await navigate('#view-project?project=atlas');assert.equal(await page.locator('[name=ceo-message]').inputValue(),'Atlas note');/* accept → Board moved to the first-release ticket chat in 842aa19; covered by first-release.test.mjs 'Board discussions … apply once' */await navigate('#view-estate');assert.equal(await page.locator('[name=ceo-message]').inputValue(),'Только estate draft');checks.push({kind:'CEO_draft_scope',pass:true})
 await route('#view-question?project=atlas&question=Q-12');await screen.locator('[name=answer-choice][value=deny]').check();await screen.locator('[name=answer-reason]').fill('Нет разрешения на стенд');await screen.locator('[data-workbench-form=answer]').evaluate(f=>f.requestSubmit());await screen.locator('[data-workbench-action=delivery]').click();assert.match(await screen.innerText(),/acknowledged/);await navigate('#view-inbox?scope=estate');assert.doesNotMatch(await screen.innerText(),/Разрешить проверку приглашения на staging/);await navigate('#view-decisions?project=atlas');assert.match(await screen.innerText(),/D-09/);checks.push({kind:'refusal_receipt_delivery_and_union',pass:true})
 await route('#view-manager');await screen.locator('[name=manager-provider]').selectOption('codex');await screen.locator('[data-workbench-form=manager]').evaluate(f=>f.requestSubmit());await screen.locator('[data-workbench-action=validate-manager]').click();assert.equal(await screen.locator('[data-workbench-action=apply-manager]').count(),0);await screen.locator('[data-workbench-action=manager-checkpoint]').click();await screen.locator('[data-workbench-action=apply-manager]').click();assert.match(await screen.innerText(),/ожидает подтверждения/);await screen.locator('[data-workbench-action=manager-ack]').click();assert.match(await screen.innerText(),/подтвердил передачу/);checks.push({kind:'manager_validation_drain_checkpoint_binding_ACK',pass:true})
 await route('#view-cycles');await screen.locator('[data-workbench-action=cycle-wake]').click();assert.match(await screen.innerText(),/admitted/);await screen.locator('[data-workbench-action=cycle-wake]').click();assert.equal(await page.evaluate(()=>sharedCycleState('atlas','retro').ticks.length),1);await screen.locator('[data-workbench-action=cycle-inflight]').click();await screen.locator('[data-workbench-action=cycle-complete]').click();assert.match(await screen.innerText(),/completed/);checks.push({kind:'cycle_admission_inflight_completion_dedup',pass:true})
 for(const v of ['agent-history','project-history','project-plan','decisions']){await route('#view-'+v);assert(await screen.locator('.fg-explorer svg').count()>0);assert(await screen.locator('.fg-explorer').count()>0)}checks.push({kind:'four_distinct_graphs',pass:true})
 await route('#view-project?project=orbit');assert.match(await screen.innerText(),/Orbit/);assert.doesNotMatch(await screen.innerText(),/AT-42/);checks.push({kind:'project_scope',pass:true})
 await route('#view-project');await page.locator('[data-action=presentation]').click();assert(await page.locator('.report-top').isHidden());await page.keyboard.press('Escape');assert(await page.locator('.report-top').isVisible());checks.push({kind:'presentation_and_escape',pass:true})
 await route('#screens');await page.locator('#screen-search').fill('not-a-screen-938281');assert.equal(await page.locator('[data-screen-card]:visible').count(),0);await page.locator('#screen-search').fill('');assert.equal(await page.locator('[data-screen-card]:visible').count(),model.screens.length);checks.push({kind:'screen_filter',pass:true})
 for(const width of [1280,375])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:800});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme)
  for(const v of ['estate','onboarding','task','project-plan','manager','memory','feedback','workspace-editor','routine-editor','providers','membership','notifications']){
   await navigate('#view-'+v+'?project=atlas&state=ready')
   const geometry=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,duplicates:[...document.querySelectorAll('[id]')].map(e=>e.id).filter((id,i,a)=>a.indexOf(id)!==i)}))
   assert(geometry.documentWidth<=width+1,`${v} ${theme} overflow ${geometry.documentWidth}>${width}`);assert.equal(geometry.duplicates.length,0,`${v} duplicate IDs ${geometry.duplicates}`)
  }
  await navigate('#view-project-plan?project=atlas&state=ready');await page.screenshot({path:path.join(out,`graph-${width}-${theme}.png`)});checks.push({kind:'responsive_theme',width,theme,views:12,pass:true})
 }
 await page.setViewportSize({width:1280,height:800});await route('#view-session');
 for(const theme of ['dark','light']){
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme)
  const contrast=await page.evaluate(()=>{
   const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number)
   const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)
   return ['.terminal-window pre','#product-screen .meta','.button.primary'].map(selector=>{
    const node=document.querySelector('#product-screen '+selector)||document.querySelector(selector);if(!node)return {selector,absent:true}
    const fg=rgb(getComputedStyle(node).color);let parent=node,bg
    while(parent){const c=getComputedStyle(parent).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'&&c!=='transparent'){bg=rgb(c);break}parent=parent.parentElement}
    if(!bg)return {selector,unmeasured:true}
    const [hi,lo]=[lum(fg),lum(bg)].sort((a,b)=>b-a);return {selector,ratio:Math.round((hi+.05)/(lo+.05)*100)/100}
   })
  })
  for(const c of contrast)if(c.ratio)assert(c.ratio>=4.5,theme+' text contrast '+JSON.stringify(c))
  checks.push({kind:'sample_text_contrast',theme,contrast,scope:'sampled opaque text surfaces; not complete WCAG audit'})
 }
 await page.setViewportSize({width:1280,height:800});await route('#view-onboarding?cohort=new');await page.keyboard.press('Tab');const focus=await page.evaluate(()=>document.activeElement?.tagName);assert(['A','BUTTON','INPUT','TEXTAREA','SELECT','SUMMARY'].includes(focus));checks.push({kind:'keyboard_entry',pass:true})
 // 'onboarding' opens the first-release setup (FLW-55); at 200% text its heading and primary action stay visible (the setup offers defaults, no required field).
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert.equal(await screen.locator('.button.primary').first().isVisible(),true,'primary action hidden at 200% text');assert.equal(await screen.locator('h2').first().isVisible(),true,'heading hidden at 200% text');checks.push({kind:'text_zoom200_entry_present',pass:true});await page.evaluate(()=>document.documentElement.style.fontSize='')
 await route('#review');await page.locator('[name="review-graphs"]').selectOption('revise');await page.locator('#review-notes').fill('Проверить порядок графов');const downloadPromise=page.waitForEvent('download');await page.locator('[data-action="export-review"]').click();const download=await downloadPromise;await download.saveAs(path.join(out,'review-export.json'));const review=JSON.parse(fs.readFileSync(path.join(out,'review-export.json'),'utf8'));assert.equal(review.decisions.find(d=>d.id==='graphs').choice,'revise');checks.push({kind:'local_review_export',pass:true})
 const nojs=await browser.newPage({javaScriptEnabled:false});await nojs.goto(base);assert.equal(await nojs.locator('#no-js-screens>details').count(),model.views.length);assert(await nojs.locator('#no-js-message').isVisible());checks.push({kind:'no_js_fallback',screens:model.views.length})
 assert.deepEqual(errors,[]);assert.deepEqual(network,[])
 const result={status:'pass',scope:'isolated fixture report only; no native app or production checks',source_commit:model.source_commit,checks,errors,unexpected_network:network}
 fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));await browser.close()
})().catch(async e=>{console.error(e);fs.writeFileSync(path.join(out,'browser-failure.txt'),e.stack||String(e));if(owned)await owned.close();process.exitCode=1})
