import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.FABRIC_PLAYWRIGHT_MODULE ?? '/Users/sshlg/.cache/fabric-playwright/node_modules/playwright-core/index.mjs')
const out=process.env.FABRIC_REVIEW_OUT ?? 'docs/reports/2026-10-04-hub-i3-ux/raw'
const base=process.env.FABRIC_REVIEW_URL ?? 'http://127.0.0.1:5299'
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-mock-keychain']})
const results=[]
const captures=[]
try {
for(const locale of ['en','ru'])for(const theme of ['light','dark']){
 const p=await browser.newPage({viewport:{width:760,height:1000},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message))
 for(const state of ['empty','loading','unreadable','hubOff','notconnected','reconnectWaiting','declined','failed','withdrawn','connectedLateRecord','full','long']){
  await p.goto(`${base}/?s=${state}&l=${locale}&t=${theme}`);await p.getByRole('complementary',{name:locale==='en'?'Agent access':'Доступ агентов'}).waitFor();await p.waitForTimeout(220);await p.evaluate(()=>document.fonts.ready)
  const text=await p.locator('.ceo-panel').innerText();const buttons=await p.locator('.ceo-panel button').evaluateAll(xs=>xs.map(x=>({text:x.textContent,disabled:x.disabled,aria:x.getAttribute('aria-label')})))
  if(state==='hubOff')assert.ok(buttons.some(x=>x.disabled))
  if(state==='unreadable')assert.ok(buttons.some(x=>x.text===(locale==='en'?'Try again':'Попробовать снова')))
  if(state==='reconnectWaiting')assert.ok(buttons.some(x=>x.text===(locale==='en'?'Reconnect':'Переподключить')&&x.disabled))
  if(['empty','unreadable','failed','long'].includes(state)){const file=`browser-${state}-${locale}-${theme}.png`;await p.screenshot({path:path.join(out,file)});captures.push({file,revision:'3b2878fc9283db5fc9a81697ba8538a01630b8d9',route:p.url(),scenario:state==='failed'?'SCN-133':'SCN-132',state,viewport:{width:760,height:1000,devicePixelRatio:await p.evaluate(()=>devicePixelRatio)},locale,theme,motion:'reduced',capturedAt:new Date().toISOString(),source:'Playwright Chromium production-component harness',fonts:'document.fonts.ready awaited'})}
  const overflow=await p.locator('.access-asks li,.access-acts .toolbar').evaluateAll(xs=>xs.filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>x.className))
  results.push({locale,theme,state,text,buttons,overflow,errors:[...errors]})
 }
 for(const decide of ['expired','noopen']){
  await p.goto(`${base}/?s=notconnected&l=${locale}&t=${theme}&decide=${decide}`)
  const allow=p.getByRole('button',{name:locale==='en'?'Allow and connect Fabric Inbox for Research desk':'Разрешить и подключить Fabric Inbox: Research desk',exact:true})
  await allow.click();await p.waitForTimeout(220)
  results.push({locale,theme,state:`allow-${decide}`,text:await p.locator('.ceo-panel').innerText(),calls:await p.evaluate(()=>window.__calls),focus:await p.evaluate(()=>document.activeElement?.textContent)})
 }
 await p.goto(`${base}/?s=full&l=${locale}&t=${theme}&v=board`);await p.locator('.lp-access-facts').first().waitFor();await p.getByRole('button',{name:locale==='en'?'Allow Research desk':'Разрешить: Research desk',exact:true}).click();await p.waitForTimeout(220)
 results.push({locale,theme,state:'board-allow',calls:await p.evaluate(()=>window.__calls),focus:await p.evaluate(()=>document.activeElement?.textContent),errors})
 await p.close()
}
}finally{await browser.close()}
await fs.writeFile(path.join(out,'browser-baseline.json'),JSON.stringify({source:'3b2878fc9283db5fc9a81697ba8538a01630b8d9',evidence:'Production React components/CSS/i18n with fake window.fabric; not Electron or live consent',cases:results},null,2)+'\n')
await fs.writeFile(path.join(out,'captures.json'),JSON.stringify(captures,null,2)+'\n')
console.log(JSON.stringify({cases:results.length,errors:results.filter(x=>x.errors?.length).length,overflows:results.filter(x=>x.overflow?.length).length}))
