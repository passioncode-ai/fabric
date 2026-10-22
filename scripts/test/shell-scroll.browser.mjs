// The 0.3.7 shell scrolls (2026-10-22, the operator: «главный экран не скроллится»). The renderer's own stylesheets,
// in the order the built bundle loads them (App's import graph first: rail.css, launch.css, Onboarding.launch.css,
// start.css; then main.tsx's), on the markup LaunchShell.tsx and App.tsx render: `.fab-place > [notice] .shell > main.content`
// with an optional side panel, then the act line. A page taller than the window is reached with the mouse wheel; the
// rail, the top bar, a notice, a side panel and the act line stay where they are; the page keeps the place's width
// (nothing scrolls sideways, in the window or in the place); a console fills the page; the scan's pinned foot stays
// above the act line. Watched failing on 747b0306 (the shell grew past `.app.launch-root`, which clips: the wheel
// moved nothing) and on the first fix of this change (`.content` sized to its widest line: 1500 px in a 1064 px place,
// a console 65 px wide, the act line scrolled away).
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,base),'utf8')
const src='apps/desktop/src/renderer/src/'
const css=['launch/rail.css','launch/launch.css','Onboarding.launch.css','start/start.css','tokens.paperclip.css','tokens.passioncode.css','tokens.app.css','styles.css','components.css'].map(f=>read(src+f)).join('\n')
const long='A sentence long enough to be wider than any window if nothing wrapped it, '.repeat(6)
const cards=Array.from({length:40},(_,i)=>`<section class="lp-card"><h3>Card ${i}</h3><p>${i===3?long:'row'}</p></section>`).join('')
const projects=Array.from({length:60},(_,i)=>`<li><a href="#"><span class="rail-dot"></span><span class="rail-name">project ${i}</span></a></li>`).join('')
const panel=`<aside class="ceo-panel" id="panel"><div class="panel-head"><h2 class="panel-title">Search</h2></div>${Array.from({length:60},(_,i)=>`<p>hit ${i}</p>`).join('')}</aside>`
const shell=({page,notice='',withPanel=false,settings=''})=>`<!doctype html><html><head><style>${css}</style></head><body><div id="root"><div class="app launch-root"><div class="fab-shell">
<aside class="rail"><div class="rail-brand"><b>Fabric</b></div><button class="rail-create">+</button><nav class="rail-places"><a href="#" class="on"><span class="rail-name">Главная</span></a></nav><p class="rail-sect">Проекты</p><div class="rail-projects"><ul>${projects}</ul></div></aside>
<div class="fab-main"><header class="fab-top"><h1>Главная</h1></header><div class="fab-place">${notice}<div class="${withPanel?'shell shell-with-panel':'shell'}"><main class="content"${settings?' hidden':''}>${page}</main>${settings}${withPanel?panel:''}</div><div class="act-line" id="act">Отменено · <button class="act-line-undo">Вернуть</button></div></div></div></div></div></div></body></html>`
const pages={
  home:{page:`<div class="lp">${cards}<p id="last">LAST</p></div>`},
  history:{page:`<div class="hx"><ul class="hx-list">${Array.from({length:80},(_,i)=>`<li class="hx-row"><div class="hx-act"><span class="hx-time">10:0${i%10}</span><span class="hx-who">agent</span><span class="hx-said">act ${i}</span><span class="hx-end"></span></div></li>`).join('')}</ul><p id="last">LAST</p></div>`},
  notice:{notice:`<div class="banner" id="notice">Стек недоступен. Пробуем сейчас.</div>`,page:`${cards}<p id="last">LAST</p>`},
  panel:{withPanel:true,page:`<div class="lp">${cards}<p id="last">LAST</p></div>`},
  // Settings is rendered beside the hidden page, not inside it (0.3.10 review ER-1).
  settings:{page:`<p>the page under Settings</p>`,settings:`<main class="lp lp-settings">${cards}<p id="last">LAST</p></main>`},
  // Three notices at once (stack health, a link notice, an error): the page keeps half the place (ER-3).
  notices:{notice:[1,2,3].map(i=>`<div class="banner" id="${i===1?'notice':'n'+i}">${'Уведомление. '.repeat(120)}</div>`).join(''),page:`${cards}<p id="last">LAST</p>`},
  scan:{page:`<div class="st">${cards}<p id="last">LAST</p><div class="st-foot" id="foot"><button>Add 12 as projects</button></div></div>`},
}
const rect=sel=>{const e=document.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,width:r.width,height:r.height}}
const browser=await chromium.launch({headless:true,...(process.env.FABRIC_CHROME?{executablePath:process.env.FABRIC_CHROME}:{})});let checks=0
try{
  for(const width of [1280,800]){
    for(const [name,spec] of Object.entries(pages)){
      const page=await browser.newPage({viewport:{width,height:720}})
      await page.setContent(shell(spec))
      const pin=['.rail','.fab-top','#act','#notice','#panel']
      const before=await page.evaluate(([pin,rect])=>Object.fromEntries(pin.map(s=>[s,eval(rect)(s)?.top])),[pin,rect.toString()])
      const geo=await page.evaluate(()=>{const p=document.querySelector('.fab-place'),c=document.querySelector('.fab-place>.shell>main:not([hidden])');return{place:p.clientWidth,placeScroll:p.scrollWidth,content:c.getBoundingClientRect().width,contentScroll:c.scrollWidth-c.clientWidth,windowScroll:document.documentElement.scrollWidth-innerWidth,last:document.getElementById('last').getBoundingClientRect().bottom}})
      assert.ok(geo.last>720,`${name}@${width}: the fixture is taller than the window`)
      assert.ok(geo.placeScroll<=geo.place+1&&geo.windowScroll<=0&&geo.contentScroll<=1,`${name}@${width}: nothing scrolls sideways (${JSON.stringify(geo)})`);checks++
      assert.ok(geo.content>=Math.min(geo.place-(spec.withPanel?400:0),geo.place)*0.9,`${name}@${width}: the page keeps the place's width (${JSON.stringify(geo)})`);checks++
      await page.mouse.move(spec.withPanel?200+20:width-100,400)
      for(let i=0;i<60;i++) await page.mouse.wheel(0,400)
      await page.waitForTimeout(150)
      const after=await page.evaluate(([pin,rect])=>{const f=eval(rect);return{pins:Object.fromEntries(pin.map(s=>[s,f(s)?.top])),last:f('#last'),act:f('#act'),foot:f('#foot')}},[pin,rect.toString()])
      const ceiling=after.foot?after.foot.top:after.act.top
      assert.ok(after.last.top>=0&&after.last.bottom<=ceiling+1,`${name}@${width}: the wheel brings the last row into view above the act line (${JSON.stringify(after)})`);checks++
      for(const s of pin) if(before[s]!==undefined) assert.equal(after.pins[s],before[s],`${name}@${width}: ${s} stays where it was`)
      checks++
      assert.ok(after.act.bottom<=721&&after.act.top>=600,`${name}@${width}: the act line is at the window's foot (${JSON.stringify(after.act)})`);checks++
      if(after.foot) {assert.ok(after.foot.bottom<=after.act.top+1,`${name}@${width}: the scan's foot stays above the act line (${JSON.stringify(after)})`);checks++}
      if(name==='notices'){const h=await page.evaluate(()=>({page:document.querySelector('.fab-place>.shell').getBoundingClientRect().height,place:document.querySelector('.fab-place').getBoundingClientRect().height}));assert.ok(h.page>=h.place*0.45,`notices@${width}: the page keeps half the place (${JSON.stringify(h)})`);checks++}
      await page.close()
    }
  }
  {
    // Focus reaching a control at the foot of Settings scrolls the page, never the place (0.3.10 review ER-2).
    const page=await browser.newPage({viewport:{width:1280,height:720}})
    await page.setContent(shell({page:'<p>under</p>',settings:`<main class="lp lp-settings">${cards}<button id="deep">deep</button></main>`}))
    await page.evaluate(()=>{document.getElementById('deep').focus();document.getElementById('deep').scrollIntoView({block:'end'})})
    const r=await page.evaluate(()=>({place:document.querySelector('.fab-place').scrollTop,act:document.getElementById('act').getBoundingClientRect().bottom,top:document.querySelector('.fab-top').getBoundingClientRect().top}))
    assert.ok(r.place===0&&r.act<=721&&r.top===0,`focus at the foot of Settings scrolls the page, not the place (${JSON.stringify(r)})`);checks++
    await page.close()
  }
  {
    // A visually hidden label deep in a page (the project page has them) never makes the window scroll (iteration 2 UX-1).
    const page=await browser.newPage({viewport:{width:1280,height:720}})
    await page.setContent(shell({page:`<div class="lp">${cards}<label class="st-visually-hidden" style="position:absolute;top:3000px">hidden</label><p id="last">LAST</p></div>`}))
    await page.mouse.move(100,400); for(let i=0;i<10;i++) await page.mouse.wheel(0,600)
    await page.keyboard.press('PageDown'); await page.keyboard.press('End'); await page.waitForTimeout(100)
    const w=await page.evaluate(()=>({doc:document.scrollingElement.scrollTop,rail:document.querySelector('.rail').getBoundingClientRect().top,top:document.querySelector('.fab-top').getBoundingClientRect().top}))
    assert.ok(w.doc===0&&w.rail===0&&w.top===0,`the window itself never scrolls (${JSON.stringify(w)})`);checks++
    await page.close()
  }
  {
    // Print shows the whole page, not one window of it (0.3.10 review ER-1, iteration 2).
    const page=await browser.newPage({viewport:{width:1280,height:720}})
    await page.setContent(shell({page:`<div class="lp">${cards}<p id="last">LAST</p></div>`}))
    await page.emulateMedia({media:'print'})
    const pr=await page.evaluate(()=>{const m=document.querySelector('.fab-place>.shell>main');return{clipped:m.scrollHeight>m.clientHeight+1,doc:document.documentElement.scrollHeight,rail:getComputedStyle(document.querySelector('.rail')).display,act:getComputedStyle(document.getElementById('act')).display}})
    assert.ok(!pr.clipped&&pr.doc>2000&&pr.rail==='none'&&pr.act==='none',`print shows the whole page (${JSON.stringify(pr)})`);checks++
    // A short window: the act line stays inside the window (ER-4).
    await page.emulateMedia({media:'screen'});await page.setViewportSize({width:1280,height:360})
    const act=await page.evaluate(()=>document.getElementById('act').getBoundingClientRect())
    assert.ok(act.bottom<=361&&act.top>=0,`a short window keeps the act line in it (${JSON.stringify(act)})`);checks++
    await page.close()
  }
  {
    // A tiny window with a notice and a long act line (a refusal with its words): the line's foot stays in the window,
    // and the line scrolls inside itself (iteration 3 ER-3, ER-4).
    const page=await browser.newPage({viewport:{width:800,height:240}})
    await page.setContent(shell({notice:`<div class="banner" id="notice">${'Уведомление. '.repeat(40)}</div>`,page:`${cards}<p id="last">LAST</p>`}).replace('Отменено · <button class="act-line-undo">Вернуть</button>',`<span class="act-line-refused">${'Не отменено: причина. '.repeat(60)}</span><button class="act-line-undo">Вернуть</button>`))
    const a=await page.evaluate(()=>{const r=document.getElementById('act').getBoundingClientRect();return{top:r.top,bottom:r.bottom}})
    assert.ok(a.bottom<=241&&a.top>=0,`a tiny window keeps the whole act line in it (${JSON.stringify(a)})`);checks++
    await page.close()
  }
  {
    // A short window with three notices and a refused act: the act line stays whole in the window (iteration 3 UX-1).
    for(const h of [360,480,520,600,640,660,720,900]){
    const page=await browser.newPage({viewport:{width:1280,height:h}})
    await page.setContent(shell({notice:[1,2,3].map(i=>`<div class="banner"${i===1?' id="notice"':''}>${'Уведомление. '.repeat(60)}</div>`).join(''),page:`${cards}<p id="last">LAST</p>`}).replace('Отменено · <button class="act-line-undo">Вернуть</button>',`<span class="act-line-refused">${'Не отменено: причина. '.repeat(30)}</span><button class="act-line-undo">Вернуть</button>`))
    const a3=await page.evaluate(()=>{const r=document.getElementById('act').getBoundingClientRect();return{top:r.top,bottom:r.bottom}})
    assert.ok(a3.bottom<=h+1&&a3.top>=0,`three notices at ${h} px leave the act line whole (${JSON.stringify(a3)})`);checks++
    await page.close()
    }
  }
  for(const notice of ['',`<div class="banner">Нет связи с базой.</div>`]){
    const page=await browser.newPage({viewport:{width:1280,height:720}})
    await page.setContent(shell({notice,page:`<div class="session-window"><div class="terminal-host" id="term" style="flex:1"><div class="xterm">x</div></div></div>`}))
    const term=await page.evaluate(()=>{const c=document.querySelector('.content').getBoundingClientRect(),t=document.getElementById('term').getBoundingClientRect();return{content:{w:c.width,h:c.height},term:{w:t.width,h:t.height}}})
    assert.ok(term.term.w>=term.content.w*0.9&&term.term.h>=term.content.h*0.8&&term.term.h>300,`a console fills the page${notice?' under a notice':''} (${JSON.stringify(term)})`);checks++
    await page.close()
  }
  console.log(`Shell scroll browser: ${checks} checks pass.`)
}finally{await browser.close()}
