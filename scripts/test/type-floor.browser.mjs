// Nothing below 11 px, and the Pulse's chart still fits (W6 of the quality waves, 2026-11-15, ui UI-10). The renderer's
// own stylesheets on the chart PulseScreen.tsx renders: 28 days, a count inside each bar and the day under it. Every
// visible text is 11 px or more; at every width a count fits its bar, and no visible day label reaches its neighbour.
// Below 550 px the count leaves the bar (it stays in the bar's title) and every other day is named. Watched failing
// before the narrow rule: at 500 px all 28 counts ran past their bars.
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,base),'utf8')
const src='apps/desktop/src/renderer/src/'
const css=['launch/rail.css','launch/launch.css','Onboarding.launch.css','start/start.css','tokens.paperclip.css','tokens.passioncode.css','tokens.app.css','styles.css','components.css'].map(f=>read(src+f)).join('\n')
const bars=Array.from({length:28},(_,i)=>`<button class="fp-bar"><span style="--fp-bar:${30+i*2}%">${100+i}</span><small>${String(i+1).padStart(2,'0')}</small></button>`).join('')
const page=`<!doctype html><html><head><style>${css}</style></head><body><div class="app launch-root"><div class="lp" style="padding:16px"><div class="fp-chart" style="--fp-days:28">${bars}</div><div class="fp-chart-legend"><span>Events</span></div><span class="lp-pill">pill</span></div></div></body></html>`
const browser=await chromium.launch({headless:true,...(process.env.FABRIC_CHROME?{executablePath:process.env.FABRIC_CHROME}:{})});let checks=0
try{
  for(const width of [1024,800,500,420]){
    const p=await browser.newPage({viewport:{width,height:600}});await p.setContent(page)
    const r=await p.evaluate(()=>{
      const shown=(e)=>getComputedStyle(e).visibility!=='hidden'&&parseFloat(getComputedStyle(e).fontSize)>0
      const texts=[...document.querySelectorAll('.lp *')].filter((e)=>[...e.childNodes].some((n)=>n.nodeType===3&&n.textContent.trim())&&shown(e))
      const small=texts.map((e)=>({t:e.className||e.tagName,px:parseFloat(getComputedStyle(e).fontSize)})).filter((x)=>x.px<11)
      const bs=[...document.querySelectorAll('.fp-bar')]
      const countsOver=bs.filter((b)=>{const s=b.querySelector('span');return shown(s)&&s.scrollWidth>s.clientWidth+0.5}).length
      const labels=bs.map((b)=>b.querySelector('small')).filter(shown).map((s)=>s.getBoundingClientRect())
      const touching=labels.slice(1).filter((l,i)=>l.left<labels[i].right).length
      return{small,countsOver,touching,labels:labels.length}
    })
    assert.deepEqual(r.small,[],`width ${width}: text under 11px`)
    assert.equal(r.countsOver,0,`width ${width}: ${r.countsOver} counts run past their bars`)
    assert.equal(r.touching,0,`width ${width}: ${r.touching} day labels reach their neighbour`)
    assert.ok(r.labels>=14,`width ${width}: only ${r.labels} days are named`)
    checks+=4;await p.close()
  }
}finally{await browser.close()}
console.log(`type floor: ${checks} checks pass`)
