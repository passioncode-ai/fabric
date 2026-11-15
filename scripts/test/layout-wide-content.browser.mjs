// Wide content never widens a page past the window (W1 of the quality waves, 2026-11-15, ui UI-4, UI-5, UI-6, UI-8).
// A grid's `1fr` track is `minmax(auto,1fr)`: it grows to its widest child, so a row of cards, a long link or a path in a
// title pushed the page sideways where nothing scrolls. The renderer's own stylesheets on the markup three screens render:
// a project page's two columns collapsing at 850 px with a strip of direction cards (ProjectLaunch.tsx, WorkDirections.tsx),
// a feed post with a long link (CommsFeed.tsx) and a kanban card titled with a path (KanbanBoard.tsx). Every block ends
// inside its container. Watched failing before the fix: the project page's column was 1 898 px at 800 px, the feed's link
// ran 232 px past the edge.
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,base),'utf8')
const src='apps/desktop/src/renderer/src/'
const css=['launch/rail.css','launch/launch.css','Onboarding.launch.css','start/start.css','tokens.paperclip.css','tokens.passioncode.css','tokens.app.css','styles.css','components.css'].map(f=>read(src+f)).join('\n')
const cards=Array.from({length:9},(_,i)=>`<li><button type="button" class="lp-dir-card"><span class="lp-dir-title">Direction ${i}: a title long enough to wrap</span></button></li>`).join('')
const link='https://example.com/'+'segment-without-a-break-'.repeat(10)
const path='apps/desktop/src/renderer/src/launch/'+'VeryLongComponentName'.repeat(4)+'.tsx'
const screens={
  project:`<div class="lp-project-grid" id="box"><div id="main"><section class="lp-panel"><div class="lp-panel-head"><h3>Направления</h3><button class="lp-button">Новая задача</button></div><div class="lp-dir-rows"><div class="lp-dir-row"><ul class="lp-dir-strip">${cards}</ul></div></div></section></div><aside class="lp-side"><section class="lp-panel"><h3>Цель</h3></section></aside></div>`,
  feed:`<ul class="lc-posts" id="box"><li><button type="button" class="lc-post" id="main"><span class="lc-head"><b>media-house</b><time>2 ч</time></span><span class="lc-text">Ссылка: ${link}</span></button></li></ul>`,
  kanban:`<div class="lk-col" id="box" style="width:240px"><button type="button" class="lk-card" id="main"><span>${path}</span><small>fabric</small></button></div>`,
}
const browser=await chromium.launch({headless:true,...(process.env.FABRIC_CHROME?{executablePath:process.env.FABRIC_CHROME}:{})});let checks=0
try{
  for(const width of [1280,1024,800]){
    for(const [name,html] of Object.entries(screens)){
      const p=await browser.newPage({viewport:{width,height:900}})
      await p.setContent(`<!doctype html><html><head><style>${css}</style></head><body><div class="app launch-root"><div class="lp" id="page">${html}</div></div></body></html>`)
      const r=await p.evaluate(()=>{
        const page=document.querySelector('#page').getBoundingClientRect(),box=document.querySelector('#box').getBoundingClientRect()
        const over=[...document.querySelectorAll('#box *')].filter(e=>getComputedStyle(e).display!=='contents'&&!e.closest('.lp-dir-strip>li'))
          .map(e=>({tag:e.tagName+'.'+e.className,right:Math.round(e.getBoundingClientRect().right)})).filter(e=>e.right>Math.round(box.right)+1)
        return{page:Math.round(page.right),window:innerWidth,box:Math.round(box.right),over:over.slice(0,3),scrollX:document.documentElement.scrollWidth}
      })
      assert.ok(r.box<=r.page+1&&r.page<=r.window,`${name} at ${width}: the container ends at ${r.box}, the page at ${r.page}, the window at ${r.window}`)
      assert.deepEqual(r.over,[],`${name} at ${width}: blocks end past their container at ${r.box}`)
      assert.ok(r.scrollX<=r.window,`${name} at ${width}: the document is ${r.scrollX}px wide in a ${r.window}px window`)
      checks+=3;await p.close()
    }
  }
  // ui UI-3: with the side panel open at 1024 and 1280 px the project page has a column of its own width, never two in
  // the room the panel leaves (178 px measured before the fix).
  for(const width of [1280,1024]){
    const p=await browser.newPage({viewport:{width,height:900}})
    await p.setContent(`<!doctype html><html><head><style>${css}</style></head><body><div class="app launch-root"><div class="fab-shell"><aside class="rail"><div class="rail-brand"><b>Fabric</b></div></aside><div class="fab-main"><div class="fab-place"><div class="shell shell-with-panel"><main class="content"><div class="lp">${screens.project}</div></main><aside class="ceo-panel"><div class="panel-head"><h2 class="panel-title">Search</h2></div></aside></div></div></div></div></div></body></html>`)
    const w=await p.evaluate(()=>Math.round(document.querySelector('#main').getBoundingClientRect().width))
    assert.ok(w>=300,`project with the panel at ${width}: the main column is ${w}px`)
    checks+=1;await p.close()
  }
}finally{await browser.close()}
console.log(`layout wide content: ${checks} checks pass`)
