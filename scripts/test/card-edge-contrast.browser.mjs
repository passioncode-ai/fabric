// The edge of a card a person clicks is seen (W6 of the quality waves, 2026-11-15, ui UI-14). Cards, rows and posts that
// open something were edged with the divider colour, 1.33 to 1.43:1 against their panel, so on a calm screen they read
// as plain text. The renderer's own stylesheets, both themes: each such edge reads at 3:1 or more (WCAG 1.4.11).
// Watched failing before the control-line token.
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,base),'utf8')
const src='apps/desktop/src/renderer/src/'
const css=['launch/rail.css','launch/launch.css','Onboarding.launch.css','start/start.css','tokens.paperclip.css','tokens.passioncode.css','tokens.app.css','styles.css','components.css'].map(f=>read(src+f)).join('\n')
const CARDS=['lp-dir-card','lk-card','lc-post','ag-row','lp-glance-card','cr-choice']
const lum=(c)=>{const [r,g,b]=c.map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4});return 0.2126*r+0.7152*g+0.0722*b}
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05)}
const browser=await chromium.launch({headless:true,...(process.env.FABRIC_CHROME?{executablePath:process.env.FABRIC_CHROME}:{})});let checks=0
try{
  for(const theme of ['dark','light']){
    const p=await browser.newPage()
    await p.setContent(`<!doctype html><html data-theme="${theme}"><head><style>${css}</style></head><body><div class="app launch-root"><div class="lp"><section class="lp-panel" id="panel">${CARDS.map(c=>`<button type="button" class="${c}" id="${c}">x</button>`).join('')}</section></div></div></body></html>`)
    const r=await p.evaluate((cards)=>{
      const rgb=(c)=>{const x=document.createElement('canvas').getContext('2d');x.fillStyle=c;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data].slice(0,3)}
      return{panel:rgb(getComputedStyle(document.getElementById('panel')).backgroundColor),edges:Object.fromEntries(cards.map(c=>[c,rgb(getComputedStyle(document.getElementById(c)).borderTopColor)]))}
    },CARDS)
    for(const [c,edge] of Object.entries(r.edges)){const k=ratio(edge,r.panel);assert.ok(k>=3,`${theme}: .${c} edge reads at ${k.toFixed(2)}:1`);checks++}
    await p.close()
  }
}finally{await browser.close()}
console.log(`card edge contrast: ${checks} checks pass`)
