// Verify the report's review controls and local destinations, independently of product behavior.
const {chromium}=require(process.env.FABRIC_PLAYWRIGHT_MODULE||'playwright')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const base=process.env.FABRIC_COVERAGE_BASE||'http://127.0.0.1:8770/reports/completeness.html'
const matrix=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/evidence/plans/2026-09-07-mockup-completeness/resolution-matrix.json')))
;(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.FABRIC_CHROME?{executablePath:process.env.FABRIC_CHROME}:{})})
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(base)
  assert.equal(await page.locator('[data-row]').count(),matrix.rows.length)
  await page.locator('#filter').selectOption('review-decision')
  assert.equal(await page.locator('[data-row]:visible').count(),matrix.rows.filter(r=>r.disposition==='review-decision').length)
  await page.locator('#filter').selectOption('remaining')
  assert.equal(await page.locator('[data-row]:visible').count(),matrix.rows.filter(r=>r.disposition==='remaining').length)
  await page.locator('#filter').selectOption('all');await page.locator('#search').fill('impossible-review-row-99321')
  assert.equal(await page.locator('[data-row]:visible').count(),0)
  await page.locator('#search').fill('');await page.goto(base+'#gap-SRC-02')
  assert.equal(await page.locator('#gap-SRC-02').evaluate(e=>e.open),true)
  checks.push('All rows rendered; status/search filters and exact deep link expose review choice')
  const links=await page.locator('a[href]').evaluateAll(es=>[...new Set(es.map(e=>e.href))])
  let checked=0
  for(const href of links){if(!href.startsWith(new URL(base).origin))continue;const u=new URL(href);u.hash='';const r=await page.request.get(u.href);assert.equal(r.status(),200,href);checked++}
  checks.push('All '+checked+' local link destinations return200; external code URLs are not live-verified')
  for(const theme of ['dark','light'])for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),theme+' '+width+' overflow')
   checks.push('Geometry '+theme+' '+width)
  }
  assert.deepEqual(errors,[])
  const receipt={status:'pass',scope:'review-report controls and destinations; not product acceptance',checks,errors}
  if(process.env.FABRIC_COVERAGE_OUTPUT)fs.writeFileSync(process.env.FABRIC_COVERAGE_OUTPUT,JSON.stringify(receipt,null,2)+'\n')
  console.log(JSON.stringify(receipt,null,2))
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
