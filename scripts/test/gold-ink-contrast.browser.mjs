// Gold reads in both themes (W6 of the quality waves, 2026-11-15, ui UI-12, UI-13). The rail's counters, the favourite
// star and the undo links were the fill's yellow as text, 1.34:1 on white; a selected row or agent, the graph's centre and
// the active tab were marked by that yellow alone, 1.3 to 1.45:1. The renderer's own stylesheets, both themes: gold text
// reads at 4.5:1 or more against its panel, a gold marker at 3:1 or more. Watched failing before the fix in the light theme.
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,base),'utf8')
const src='apps/desktop/src/renderer/src/'
const css=['launch/rail.css','launch/launch.css','Onboarding.launch.css','start/start.css','tokens.paperclip.css','tokens.passioncode.css','tokens.app.css','styles.css','components.css'].map(f=>read(src+f)).join('\n')
const body=`<div class="app launch-root"><aside class="rail" style="background:var(--app-panel)"><a href="#"><span class="rail-name">Доска</span><span class="rail-c" id="count">3</span></a><span class="rail-star" id="star">★</span><button class="act-line-undo" id="undo">Вернуть</button></aside>
<div class="lp" style="background:var(--app-panel)"><button class="lp-topic is-selected" id="row"><span>Выбранная строка</span></button><div class="ag-row is-selected" id="agent">агент</div><div class="tab-btn active" id="tab">Вкладка</div></div></div>`
const lum=(c)=>{const [r,g,b]=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4});return 0.2126*r+0.7152*g+0.0722*b}
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05)}
const browser=await chromium.launch({headless:true,...(process.env.FABRIC_CHROME?{executablePath:process.env.FABRIC_CHROME}:{})});let checks=0
try{
  for(const theme of ['dark','light']){
    const p=await browser.newPage({viewport:{width:1200,height:600}})
    await p.setContent(`<!doctype html><html data-theme="${theme}"><head><style>${css}</style></head><body>${body}</body></html>`)
    const c=await p.evaluate(()=>{
      const g=(s,prop)=>getComputedStyle(document.querySelector(s))[prop]
      const panel=getComputedStyle(document.documentElement).getPropertyValue('--app-panel').trim()
      const probe=document.createElement('i');probe.style.color=panel;document.body.append(probe);const panelRgb=getComputedStyle(probe).color
      const rowMark=g('#row','boxShadow').match(/rgba?\([^)]*\)/)?.[0]??''
      return{panel:panelRgb,count:g('#count','color'),star:g('#star','color'),undo:g('#undo','color'),row:rowMark,agent:g('#agent','borderTopColor'),tab:g('#tab','borderTopColor')}
    })
    for(const k of ['count','star','undo']){const r=ratio(c[k],c.panel);assert.ok(r>=4.5,`${theme}: ${k} text ${c[k]} reads at ${r.toFixed(2)}:1 on ${c.panel}`);checks++}
    for(const k of ['row','agent','tab']){const r=ratio(c[k],c.panel);assert.ok(r>=3,`${theme}: ${k} marker ${c[k]} reads at ${r.toFixed(2)}:1 on ${c.panel}`);checks++}
    await p.close()
  }
}finally{await browser.close()}
console.log(`gold ink contrast: ${checks} checks pass`)
