// No grid grows past its container (W1 of the quality waves, 2026-11-15, ui UI-8). A grid's implicit or `1fr` column is
// `minmax(auto,1fr)`: it grows to its widest child, so a long path, a link or a code line pushed a column, then the
// page, sideways. Every class the renderer's stylesheets give `display:grid`, rendered in a 600 px column with a
// 400-character word with no break (a path, a link): the grid and its children end inside the column. A grid that holds only its own fixed
// controls is named in FIXED with the reason. Watched failing before the fix on the classes the audit listed.
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,base),'utf8')
const src='apps/desktop/src/renderer/src/'
const files=['launch/rail.css','launch/launch.css','Onboarding.launch.css','start/start.css','tokens.paperclip.css','tokens.passioncode.css','tokens.app.css','styles.css','components.css']
const css=files.map(f=>read(src+f)).join('\n')
const classes=[...new Set([...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/\.([a-zA-Z][\w-]*)\s*\{[^}]*display\s*:\s*grid/g)].map(m=>m[1]))]
// A grid that holds one icon or mark of its own fixed size, or whose label column is sized to its labels by design.
const FIXED=new Map([
  ['fab-console-close','an icon button: it holds its close icon'],
  ['rail-console','an icon button: it holds its console icon'],
  ['session-detach','an icon button: it holds its detach icon'],
  ['lp-agent-icon','a 34 px mark: it holds the agent\'s initials'],
  ['fp-indicator','a 30 px mark: it holds one state dot'],
  ['st-card-mark','a 30 px mark: it holds one glyph'],
  ['st-facts','`max-content minmax(0,1fr)`: its first column is its labels by design, the values column shrinks'],
  ['as-facts','`max-content minmax(0,1fr)` with subgrid rows: its first column is the agent page\'s labels by design, the values column shrinks'],
])
const wide='x'.repeat(400)
const browser=await chromium.launch({headless:true,...(process.env.FABRIC_CHROME?{executablePath:process.env.FABRIC_CHROME}:{})})
let over=[]
try{
  const p=await browser.newPage({viewport:{width:1200,height:800}})
  await p.setContent(`<!doctype html><html><head><style>${css}</style></head><body><div class="app launch-root"><div class="lp"><div id="col" style="width:600px"></div></div></div></body></html>`)
  over=await p.evaluate(({classes,wide})=>{
    const col=document.getElementById('col'),out=[]
    for(const c of classes){
      col.innerHTML=`<div class="${c}" id="g"><span>${wide}</span><span>b</span></div>`
      const g=document.getElementById('g')
      if(getComputedStyle(g).display!=='grid')continue
      const gr=g.getBoundingClientRect(),cr=col.getBoundingClientRect()
      const kid=g.firstElementChild.getBoundingClientRect()
      if(gr.right>cr.right+1||kid.width>cr.width+1)out.push({c,grid:Math.round(gr.width),child:Math.round(kid.width),cols:getComputedStyle(g).gridTemplateColumns.slice(0,60)})
    }
    return out
  },{classes,wide})
}finally{await browser.close()}
const bad=over.filter(o=>!FIXED.has(o.c))
assert.deepEqual(bad.map(o=>o.c),[],`grids that grow past a 600 px column: ${bad.map(o=>`.${o.c} (${o.child}px)`).join(', ')}`)
console.log(`layout stress: ${classes.length} grid classes, none grows past its column`)
