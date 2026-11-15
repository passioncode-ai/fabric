// The agent page keeps its two columns apart (the operator's screenshot, 2026-11-15: the tasks and their filter chips
// ran under the session card and «Написать агенту»). The renderer's own stylesheets on the markup AgentPage.tsx renders:
// `.as-cols > .as-main + .as-side`, with the directions' strip of cards (`.ap-dir .lp-dir-strip`), the tasks' head with
// its chips and the task cards. Every block of the main column ends where the side column begins, at every width the
// two columns show, and the strip scrolls inside its column. Watched failing before the fix: `.as-main`'s implicit
// column was `auto`, the strip widened it, and a task card ended 800 px past the side column's left edge.
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,base),'utf8')
const src='apps/desktop/src/renderer/src/'
const css=['launch/rail.css','launch/launch.css','Onboarding.launch.css','start/start.css','tokens.paperclip.css','tokens.passioncode.css','tokens.app.css','styles.css','components.css'].map(f=>read(src+f)).join('\n')
const cards=Array.from({length:9},(_,i)=>`<li><a class="lp-dir-card" href="#"><span class="lp-dir-title">Direction ${i}: a title long enough to wrap twice</span><span class="lp-dir-source">на проверке · ${i} ч</span></a></li>`).join('')
const tasks=Array.from({length:7},(_,i)=>`<li class="ap-task"><details><summary><span class="ap-chev"></span><span class="ap-task-words"><span class="ap-task-title">Задача ${i}: ${'длинное название '.repeat(8)}</span><span class="ap-task-meta">взял вчера</span></span><span class="ap-pill">на проверке</span></summary></details></li>`).join('')
const page=`<!doctype html><html><head><style>${css}</style></head><body><div class="app launch-root"><div class="as-cols">
<div class="as-main"><section class="as-now"><h4 class="as-kicker">Сейчас</h4><p class="as-now-task">Task</p></section>
<section class="lp-dir ap-dir"><h4>Направления</h4><div class="lp-dir-rows"><div class="lp-dir-row"><h4>Проект</h4><ul class="lp-dir-strip">${cards}</ul></div></div></section>
<div class="as-tasks-head"><h4>Задачи</h4><span class="lp-meta">сначала новые · 7 за сессию</span><span class="as-lanes"><button class="as-chip">Все <span class="as-chip-n">7</span></button><button class="as-chip">В работе <span class="as-chip-n">1</span></button><button class="as-chip">На проверке <span class="as-chip-n">6</span></button></span></div>
<ul class="ap-tasks">${tasks}</ul></div>
<aside class="as-side"><section class="as-session"><h4>Сессия</h4></section><section class="as-questions"><h4>Вопросы этого агента</h4></section></aside>
</div></div></body></html>`
const browser=await chromium.launch({headless:true,...(process.env.FABRIC_CHROME?{executablePath:process.env.FABRIC_CHROME}:{})});let checks=0
try{
  for(const width of [1800,1280,1024]){
    const p=await browser.newPage({viewport:{width,height:900}});await p.setContent(page)
    const r=await p.evaluate(()=>{
      const side=document.querySelector('.as-side').getBoundingClientRect().left
      const blocks=[...document.querySelectorAll('.as-main > *, .ap-task, .as-lanes, .as-chip')].map(e=>({cls:e.className,right:Math.round(e.getBoundingClientRect().right)}))
      const strip=document.querySelector('.lp-dir-strip')
      return{side:Math.round(side),over:blocks.filter(b=>b.right>side),scrolls:strip.scrollWidth>strip.clientWidth}
    })
    assert.deepEqual(r.over,[],`width ${width}: blocks of the main column end past the side column at ${r.side}: ${JSON.stringify(r.over.slice(0,3))}`)
    assert.ok(r.scrolls,`width ${width}: the strip of directions should scroll inside its column`)
    checks+=2;await p.close()
  }
}finally{await browser.close()}
console.log(`agent page columns: ${checks} checks pass`)
