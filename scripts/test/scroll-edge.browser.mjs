// A row of cards that scrolls says so (W1 of the quality waves, 2026-11-15, ui UI-7). The renderer's own stylesheets on
// a project page's strip of directions (WorkDirections.tsx) and the kanban board (KanbanBoard.tsx): with more cards than
// fit, the right edge fades at the start of the row and the fade is gone at its end; a row that fits has none. Watched
// failing before the rule: no row ever faded.
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,base),'utf8')
const src='apps/desktop/src/renderer/src/'
const css=['launch/rail.css','launch/launch.css','Onboarding.launch.css','start/start.css','tokens.paperclip.css','tokens.passioncode.css','tokens.app.css','styles.css','components.css'].map(f=>read(src+f)).join('\n')
const strip=(n)=>`<ul class="lp-dir-strip" id="row">${Array.from({length:n},(_,i)=>`<li><button type="button" class="lp-dir-card"><span class="lp-dir-title">Direction ${i}</span></button></li>`).join('')}</ul>`
const board=(n)=>`<div class="lk-board" id="row">${Array.from({length:n},(_,i)=>`<section class="lk-col"><h3>Column ${i}</h3></section>`).join('')}</div>`
const browser=await chromium.launch({headless:true,...(process.env.FABRIC_CHROME?{executablePath:process.env.FABRIC_CHROME}:{})});let checks=0
try{
  for(const [name,make] of [['directions',strip],['kanban',board]]){
    for(const [n,scrolls] of [[12,true],[1,false]]){
      const p=await browser.newPage({viewport:{width:900,height:600}})
      await p.setContent(`<!doctype html><html><head><style>${css}</style></head><body><div class="app launch-root"><div class="lp" style="width:800px">${make(n)}</div></div></body></html>`)
      const fade=async()=>p.evaluate(()=>{const r=document.getElementById('row');return{fade:parseFloat(getComputedStyle(r).getPropertyValue('--lp-edge-fade'))||0,over:r.scrollWidth>r.clientWidth}})
      await p.waitForTimeout(50)
      const start=await fade()
      assert.equal(start.over,scrolls,`${name} with ${n}: overflow ${start.over}`)
      if(scrolls){
        assert.ok(start.fade>=30,`${name}: the edge should fade while cards wait past it (${start.fade}px)`)
        await p.evaluate(()=>{const r=document.getElementById('row');r.scrollLeft=r.scrollWidth});await p.waitForTimeout(100)
        const end=await fade()
        assert.ok(end.fade<1,`${name}: at the end of the row the fade should be gone (${end.fade}px)`)
        checks+=3
      }else{assert.ok(start.fade<1,`${name}: a row that fits should not fade (${start.fade}px)`);checks+=2}
      await p.close()
    }
  }
}finally{await browser.close()}
console.log(`scroll edge: ${checks} checks pass`)
