// Переписка reads at every width (W1 of the quality waves, 2026-11-15, ui UI-1, UI-2, UI-9). The renderer's own
// stylesheets on the markup CommsScreen.tsx renders: a thread row (`button.lp-topic.lp-topic-plain`) and an opened
// thread's message (`article.lp-message`) with its request facts and a body that has a line break and a long link.
// Each part is at least as wide as a readable line, nothing ends past its container, and the body keeps its line
// breaks in the ink colour. Watched failing before the fix: both reused the Board's numbered row (`.lp-topic`, a
// 24 px first column), so a message's sender, facts and text stood in a 24 px column, 1 794 px tall.
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,base),'utf8')
const src='apps/desktop/src/renderer/src/'
const css=['launch/rail.css','launch/launch.css','Onboarding.launch.css','start/start.css','tokens.paperclip.css','tokens.passioncode.css','tokens.app.css','styles.css','components.css'].map(f=>read(src+f)).join('\n')
const link='https://example.com/'+'a-very-long-path-segment/'.repeat(12)
const row=`<button type="button" class="lp-topic lp-topic-plain" id="row"><span><span class="lp-topic-title" id="row-title">Перенос окна на пятницу и что из этого следует для плана</span><span class="lp-meta">fabric, media-house</span></span><span class="lp-topic-end"><span class="lp-pill attention">Новое</span><span class="lp-pill">12 сообщений</span><small>2 ч назад</small></span></button>`
const message=`<article class="lp-message" id="msg"><div class="lp-message-head"><span><span class="lp-topic-title" id="sender">media-house</span><span class="lp-meta">claude-code · 15 нояб. 2026 г., 02:10</span></span><span class="lp-message-pills"><span class="lp-pill">доверенный</span><span class="lp-pill">запрос</span></span></div>
<dl class="lp-facts" id="facts"><div><dt>Состояние</dt><dd><span class="lp-pill">в очереди</span></dd></div><div><dt>Действие</dt><dd><span class="lp-pill">не начато</span></dd></div><div><dt>Кому</dt><dd>fabric · change.request</dd></div></dl>
<p class="lp-message-body" id="body">Первая строка просьбы.\nВторая строка, со ссылкой ${link}</p></article>`
const page=`<!doctype html><html><head><style>${css}</style></head><body><div class="app launch-root"><div class="lp" id="lp" style="padding:16px">${row}${message}</div></div></body></html>`
const browser=await chromium.launch({headless:true,...(process.env.FABRIC_CHROME?{executablePath:process.env.FABRIC_CHROME}:{})});let checks=0
try{
  for(const width of [1800,1280,1024,800]){
    const p=await browser.newPage({viewport:{width,height:900}});await p.setContent(page)
    const r=await p.evaluate(()=>{
      const box=s=>{const b=document.querySelector(s).getBoundingClientRect();return{w:Math.round(b.width),h:Math.round(b.height),right:Math.round(b.right)}}
      const edge=document.querySelector('#lp').getBoundingClientRect().right
      const body=document.querySelector('#body'),cs=getComputedStyle(body)
      const muted=getComputedStyle(document.querySelector('.lp-meta')).color
      return{edge:Math.round(edge),rowTitle:box('#row-title'),sender:box('#sender'),facts:box('#facts'),body:box('#body'),
        white:cs.whiteSpace,color:cs.color,muted,lines:Math.round(body.getBoundingClientRect().height/parseFloat(cs.lineHeight))}
    })
    assert.ok(r.rowTitle.w>=200,`width ${width}: the thread row's title is ${r.rowTitle.w}px wide`)
    assert.ok(r.sender.w>=60&&r.sender.h<60,`width ${width}: the sender stands in ${r.sender.w}x${r.sender.h}px`)
    assert.ok(r.facts.w>=200&&r.body.w>=200,`width ${width}: facts ${r.facts.w}px, body ${r.body.w}px`)
    for(const [k,b] of Object.entries({rowTitle:r.rowTitle,sender:r.sender,facts:r.facts,body:r.body}))
      assert.ok(b.right<=r.edge+1,`width ${width}: ${k} ends at ${b.right}, past the page at ${r.edge}`)
    assert.equal(r.white,'pre-wrap',`width ${width}: the body should keep its line breaks`)
    assert.notEqual(r.color,r.muted,`width ${width}: the body should read in the ink colour, not muted`)
    assert.ok(r.lines<=12,`width ${width}: the body takes ${r.lines} lines`)
    checks+=8;await p.close()
  }
}finally{await browser.close()}
console.log(`comms thread: ${checks} checks pass`)
