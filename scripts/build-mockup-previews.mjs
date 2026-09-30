// Preview thumbnails for every prototype view, so the wiki's /mockups gallery shows a
// real render rather than a title. Screenshots come from the SAME artifact the reader
// will open — docs/reports/product.html driven through its own hash router — never from
// a second renderer (R-007: a preview of a model of the page proves the model).
//
// JPEG bytes vary across Chrome builds, so parity is NOT byte equality: the manifest
// pins the sha256 of the inputs (product.html + product-model.json), and `--check`
// verifies the pins and that every view has its file — no browser needed. A changed
// prototype therefore reddens CI until previews are rebuilt, and an unchanged one
// never forces a rebuild.
//
// Runtime is supplied, never downloaded: FABRIC_PLAYWRIGHT_MODULE names an installed
// Playwright, FABRIC_CHROME an installed Chrome executable — the same contract as
// workspace/test/browser.mjs.
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,unlinkSync} from 'node:fs'
import {createHash} from 'node:crypto'
import path from 'node:path'
import {pathToFileURL,fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const sha256=v=>createHash('sha256').update(v).digest('hex')
const productPath=path.join(root,'docs/reports/product.html')
const modelPath=path.join(root,'docs/ux/product-model.json')
const dir=path.join(root,'docs/reports/previews')
const manifestPath=path.join(dir,'previews.json')

const model=JSON.parse(readFileSync(modelPath,'utf8'))
const views=model.views.map(v=>v.id)
const source={
  'docs/reports/product.html':sha256(readFileSync(productPath)),
  'docs/ux/product-model.json':sha256(readFileSync(modelPath))
}

if(process.argv.includes('--check')){
  if(!existsSync(manifestPath)) throw Error('Mockup previews missing: node scripts/build-mockup-previews.mjs')
  const m=JSON.parse(readFileSync(manifestPath,'utf8'))
  for(const [file,digest] of Object.entries(source))
    if(m.source[file]!==digest) throw Error(`Mockup previews stale (${file} changed): node scripts/build-mockup-previews.mjs`)
  const missing=views.filter(id=>!m.views.some(v=>v.id===id&&existsSync(path.join(dir,v.file))))
  if(missing.length) throw Error('Mockup previews missing views: '+missing.join(', '))
  const extra=m.views.filter(v=>!views.includes(v.id))
  if(extra.length) throw Error('Mockup previews carry retired views: '+extra.map(v=>v.id).join(', '))
  console.log(`PASS mockup previews: ${views.length} views pinned to the current prototype`)
  process.exit(0)
}

const moduleName=process.env.FABRIC_PLAYWRIGHT_MODULE
if(!moduleName) throw Error('Set FABRIC_PLAYWRIGHT_MODULE to an installed Playwright module')
// A loopback preview can expose only the built artifact; do not need browser file access.
let previewURL=pathToFileURL(productPath).href
if(process.env.FABRIC_PREVIEW_URL){
 const u=new URL(process.env.FABRIC_PREVIEW_URL)
 if(u.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.username||u.password||u.pathname!=='/product.html'||u.search||u.hash)throw Error('Preview URL must be a plain loopback /product.html')
 const response=await fetch(u);if(!response.ok||sha256(Buffer.from(await response.arrayBuffer()))!==source['docs/reports/product.html'])throw Error('Loopback preview bytes differ from the built artifact')
 previewURL=u.href
}
const {chromium}=createRequire(import.meta.url)(moduleName)
const browser=await chromium.launch({headless:true,...(process.env.FABRIC_CHROME?{executablePath:process.env.FABRIC_CHROME}:{})})
try{
  // deviceScaleFactor 0.5 renders the desktop layout and hands back a half-size bitmap:
  // the thumbnail IS the page at 1240px, not a squeezed mobile rendering of it.
  const context=await browser.newContext({viewport:{width:1240,height:820},deviceScaleFactor:0.5})
  const page=await context.newPage()
  await page.goto(previewURL+'#view-'+views[0],{waitUntil:'load'})
  mkdirSync(dir,{recursive:true})
  const written=[]
  for(const id of views){
    await page.evaluate(v=>{location.hash='#view-'+v},id)
    await page.waitForFunction(()=>document.querySelector('#product-screen')?.childElementCount>0)
    await page.evaluate(()=>window.scrollTo(0,0))
    const box=await page.locator('#product-screen').boundingBox()
    if(!box) throw Error('view '+id+' rendered nothing to screenshot')
    const clip={x:box.x,y:box.y,width:Math.min(box.width,1240),height:Math.min(box.height,720)}
    const file=id+'.jpg'
    await page.screenshot({path:path.join(dir,file),type:'jpeg',quality:80,clip,scale:'device'})
    written.push({id,file})
  }
  // A view removed from the model leaves no orphan bytes behind.
  for(const f of readdirSync(dir)) if(f.endsWith('.jpg')&&!written.some(v=>v.file===f)) unlinkSync(path.join(dir,f))
  writeFileSync(manifestPath,JSON.stringify({schema:1,source,views:written},null,2)+'\n')
  console.log(`Built ${written.length} previews into docs/reports/previews/`)
}finally{await browser.close()}
