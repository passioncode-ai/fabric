// Fabric owns source content; the workspace owns its read-only publication.
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync,rmSync,lstatSync,readdirSync} from 'node:fs'
import path from 'node:path'

export const receiptPath='docs/workspace-receipt.json'
export const publicationOnly=p=>p==='workspace'||p.startsWith('workspace/')||p===receiptPath
// Git's own bookkeeping (an empty folder's .gitkeep, a report's raw/.gitignore) is not a document, and the host
// serves no dot-segment path: left out by exact name, while every other dotfile still fails the export.
export const gitBookkeeping=p=>/(^|\/)\.git(?:keep|ignore|attributes)$/.test(p)
export const selected=p=>!publicationOnly(p)&&!gitBookkeeping(p)&&(p.startsWith('docs/')||p.startsWith('assets/brand/')||p.startsWith('registry/')||['README.md','CONTEXT.md','AGENTS.md'].includes(p))
export const sha=b=>createHash('sha256').update(b).digest('hex')
// Bounded and non-interactive (lifecycle LC-02/LC-03, review m9): a local git call that waits on a person or a
// lock never holds a publication forever.
export const git=(root,...args)=>execFileSync('git',args,{cwd:root,maxBuffer:80*1024*1024,timeout:120000,killSignal:'SIGKILL',env:{...process.env,GIT_TERMINAL_PROMPT:'0'}})
export const digest=files=>sha(JSON.stringify(files))

// Other PassionCode.ai repositories join the snapshot under repos/<id>/, each at its own pinned
// commit (agent-registry plan AR-0.5). Only their documentation travels: the entry documents,
// docs/, the org profile, schemas and every skill's SKILL.md. The id is a plain folder name; the
// repository may be dotted (`.github`, the organization defaults), which a folder may not.
export const sourceSelected=p=>!p.split('/').some(x=>x.startsWith('.'))&&(/^(README(\.[a-z]{2})?|AGENTS|CONTEXT|CONTRIBUTING|RULES|ONBOARDING|SECURITY|CHANGELOG|BACKLOG|ROADMAP)\.md$/.test(p)||p==='repositories.json'||/^(docs|profile|schemas)\//.test(p)||/(^|\/)SKILL\.md$/.test(p))
// The host's own path rule (fabric-workspace lib/snapshot.mjs#safePath): checked here so an
// unservable path fails the export, not the deployment it would otherwise take down.
export const hostServable=p=>p.length<=700&&!/[\\\x00-\x1f\x7f?#%:]/.test(p)&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'&&!x.startsWith('.'))
export const sourceId=/^[a-z0-9][a-z0-9.-]{0,62}$/
export const sourceRepository=/^https:\/\/github\.com\/passioncode-ai\/\.?[a-z0-9][a-z0-9.-]{0,62}$/
const byPath=(a,b)=>a.path<b.path?-1:a.path>b.path?1:0
const commitDate=(root,commit)=>git(root,'show','-s','--format=%cI',commit).toString().trim()

function collect(root,commit,select,prefix,blobs,files){
 const rows=git(root,'ls-tree','-rz','--full-tree',commit).toString().split('\0').filter(Boolean)
 let n=0
 for(const row of rows){
  const match=/^(\d+) (\w+) ([a-f0-9]+)\t(.+)$/.exec(row)
  if(!match)throw Error('Unreadable git tree record')
  const [,mode,type,oid,p]=match
  if(!select(p))continue
  if(type!=='blob'||!['100644','100755'].includes(mode))throw Error('Export refuses non-regular tracked source: '+prefix+p)
  if(/(^|\/)(\.env(?:\.|$)|secrets?(?:\/|$)|\.git(?:\/|$))/.test(p))throw Error('Export refuses sensitive path: '+prefix+p)
  if(!hostServable(prefix+p))throw Error('Export refuses a path the workspace host cannot serve: '+prefix+p)
  const bytes=git(root,'cat-file','blob',oid)
  blobs.set(prefix+p,bytes);files.push({path:prefix+p,sha256:sha(bytes),bytes:bytes.length});n++
 }
 return n
}

export function snapshot(root,ref='HEAD',{sources=[]}={}){
 const commit=git(root,'rev-parse','--verify',ref+'^{commit}').toString().trim()
 const blobs=new Map(), files=[], pins=[]
 collect(root,commit,selected,'',blobs,files)
 if(!files.some(x=>x.path==='docs/reports/map.html'))throw Error('No living design map in source snapshot')
 const ids=new Set()
 for(const src of sources){
  if(!sourceId.test(src?.id||'')||ids.has(src.id)||!sourceRepository.test(src.repository||'')||!/^[a-f0-9]{40}$/.test(src.commit||'')||typeof src.dir!=='string')throw Error('Invalid workspace source: '+JSON.stringify({id:src?.id,repository:src?.repository,commit:src?.commit}))
  ids.add(src.id)
  const pinned=git(src.dir,'rev-parse','--verify',src.commit+'^{commit}').toString().trim()
  if(!collect(src.dir,pinned,sourceSelected,'repos/'+src.id+'/',blobs,files))throw Error('Workspace source selects no documents: '+src.id)
  pins.push({id:src.id,repository:src.repository,commit:pinned,exported_at:commitDate(src.dir,pinned)})
 }
 files.sort(byPath)
 // Without sources the manifest keeps its single-source bytes: the key is added only when used.
 return {blobs,manifest:{schema:1,source:{repository:'https://github.com/passioncode-ai/fabric',commit},...(pins.length?{sources:pins}:{}),content_digest:digest(files),files,exported_at:commitDate(root,commit)}}
}

const ownedBy=id=>f=>f.path.startsWith('repos/'+id+'/')
const fabricOwned=f=>!f.path.startsWith('repos/')
// The receipt pins each source and carries two partial digests, so a checkout without the source
// clones (CI) still verifies Fabric's own part, and a machine with them verifies everything.
// A receipt names where it was deployed: App Platform (`platform`, `do_app`, `deployment` id) since
// 2026-10-08; a receipt written before then names its Heroku app and release number and stays valid
// as history until the next publication replaces it.
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export function receiptFor(s,{workspace_commit,platform,do_app,deployment,heroku_app,release}){
 const deployed=platform==='digitalocean'?{platform,do_app,deployment}:{heroku_app,release}
 const r={schema:1,source_commit:s.manifest.source.commit,workspace_commit,content_digest:s.manifest.content_digest,...deployed}
 if(s.manifest.sources?.length){
  r.fabric_digest=digest(s.manifest.files.filter(fabricOwned))
  r.sources=s.manifest.sources.map(x=>({id:x.id,repository:x.repository,commit:x.commit,files_digest:digest(s.manifest.files.filter(ownedBy(x.id)))}))
 }
 return r
}

export function writeSnapshot(target,s){
 if(!existsSync(path.join(target,'.git')))throw Error('Target must be a workspace Git checkout')
 const dest=path.join(target,'content'),stage=path.join(target,'.content-stage-'+process.pid),old=path.join(target,'.content-old-'+process.pid)
 if(existsSync(stage)||existsSync(old))throw Error('Interrupted export residue: inspect before retrying')
 if(existsSync(dest)&&(!lstatSync(dest).isDirectory()||lstatSync(dest).isSymbolicLink()||!existsSync(path.join(dest,'manifest.json'))))throw Error('Refusing to replace content not owned by the exporter')
 mkdirSync(stage)
 try{
  for(const [p,b] of s.blobs){mkdirSync(path.dirname(path.join(stage,p)),{recursive:true});writeFileSync(path.join(stage,p),b)}
  writeFileSync(path.join(stage,'manifest.json'),JSON.stringify(s.manifest,null,2)+'\n')
  if(existsSync(dest))renameSync(dest,old)
  try{renameSync(stage,dest)}catch(e){if(existsSync(old))renameSync(old,dest);throw e}
  if(existsSync(old))rmSync(old,{recursive:true})
 }finally{if(existsSync(stage))rmSync(stage,{recursive:true})}
}

export function verifyContent(target,manifest){
 const base=path.join(target,'content'),actual=[]
 function walk(dir,prefix=''){
  for(const name of readdirSync(dir)){
   const p=prefix+name,full=path.join(dir,name),stat=lstatSync(full)
   if(stat.isSymbolicLink())throw Error('Workspace content symlink: '+p)
   if(stat.isDirectory())walk(full,p+'/')
   else if(p!=='manifest.json'){const b=readFileSync(full);actual.push({path:p,sha256:sha(b),bytes:b.length})}
  }
 }
 walk(base);actual.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)
 if(digest(actual)!==manifest.content_digest||JSON.stringify(actual)!==JSON.stringify(manifest.files))throw Error('Workspace content does not match its manifest')
}

export function verifyCommittedSnapshot(target){
 const manifest=JSON.parse(git(target,'show','HEAD:content/manifest.json').toString())
 const tracked=new Set(git(target,'ls-tree','-rz','--name-only','HEAD','content/').toString().split('\0').filter(Boolean))
 for(const file of manifest.files){
  const p='content/'+file.path
  if(!tracked.has(p))throw Error('Published snapshot commit omits manifest file (possibly ignored by Git): '+file.path)
  const bytes=git(target,'show','HEAD:'+p)
  if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw Error('Committed snapshot bytes differ from manifest: '+file.path)
 }
 if(tracked.size!==manifest.files.length+1)throw Error('Unexpected file in committed content tree')
 return manifest
}

export function checkReceipt(root,{requireChild=false,sourceDirs=null}={}){
 const receipt=JSON.parse(readFileSync(path.join(root,receiptPath),'utf8'))
 if(receipt.schema!==1||!/^[a-f0-9]{40}$/.test(receipt.source_commit||'')||!/^[a-f0-9]{40}$/.test(receipt.workspace_commit||'')||!/^[a-f0-9]{64}$/.test(receipt.content_digest||'')||!deployedAt(receipt))throw Error('Invalid workspace receipt: immutable source/workspace SHAs, digest, app and deployment are required')
 const pins=receipt.sources??[]
 if(!Array.isArray(pins)||(pins.length&&!/^[a-f0-9]{64}$/.test(receipt.fabric_digest||''))||new Set(pins.map(x=>x?.id)).size!==pins.length||!pins.every(x=>sourceId.test(x?.id||'')&&sourceRepository.test(x.repository||'')&&/^[a-f0-9]{40}$/.test(x.commit||'')&&/^[a-f0-9]{64}$/.test(x.files_digest||'')))throw Error('Invalid workspace receipt: every source needs an id, a passioncode-ai repository, an immutable commit and its files digest, plus the Fabric digest')
 git(root,'merge-base','--is-ancestor',receipt.source_commit,'HEAD')
 if(existsSync(path.join(root,'workspace.config.json'))){
  const config=JSON.parse(readFileSync(path.join(root,'workspace.config.json'),'utf8'))
  if(receipt.platform==='digitalocean'&&config.do_app!==receipt.do_app)throw Error('Receipt names a different App Platform app')
  // A Heroku receipt is history once the configuration names no Heroku app; while one is named it must match.
  if(receipt.platform===undefined&&config.heroku_app!==undefined&&config.heroku_app!==receipt.heroku_app)throw Error('Receipt names a different Heroku app')
 }
 // A source is recomputed where its clone holds the pinned commit; otherwise only its pin is held.
 const dirs=sourceDirs??{}
 const local=pins.length>0&&pins.every(x=>dirs[x.id]&&hasCommit(dirs[x.id],x.commit))
 let s,sources='none'
 if(local){
  s=snapshot(root,receipt.source_commit,{sources:pins.map(x=>({...x,dir:dirs[x.id]}))})
  const r=receiptFor(s,receipt)
  for(const [i,x] of pins.entries())if(r.sources[i].id!==x.id||r.sources[i].files_digest!==x.files_digest)throw Error('Receipt source digest mismatch: '+x.id)
  if(s.manifest.content_digest!==receipt.content_digest)throw Error('Receipt source digest mismatch')
  sources='recomputed'
 }else{
  s=snapshot(root,receipt.source_commit)
  if(s.manifest.content_digest!==(pins.length?receipt.fabric_digest:receipt.content_digest))throw Error('Receipt source digest mismatch')
  if(pins.length)sources='pinned; not recomputed without a local clone'
 }
 const changes=git(root,'diff','--name-only',receipt.source_commit,'HEAD').toString().trim().split('\n').filter(p=>p&&!publicationOnly(p))
 const dirty=git(root,'status','--porcelain','--untracked-files=normal').toString().split('\n').filter(Boolean).filter(row=>!publicationOnly(row.slice(3)))
 if(changes.length||dirty.length)throw Error('Workspace is stale; finish source changes, commit, then node scripts/workspace.mjs publish. '+[...changes,...dirty].slice(0,8).join(', '))
 const staged=git(root,'ls-files','--stage','workspace').toString().trim()
 if(staged.split(/\s+/)[0]!=='160000'||staged.split(/\s+/)[1]!==receipt.workspace_commit)throw Error('Workspace gitlink and receipt disagree')
 const child=path.join(root,'workspace')
 const result=extra=>({source:receipt.source_commit,workspace:receipt.workspace_commit,files:s.manifest.files.length,...(pins.length?{sources}:{}),...extra})
 if(existsSync(path.join(child,'.git'))){
  if(git(child,'rev-parse','HEAD').toString().trim()!==receipt.workspace_commit)throw Error('Initialized submodule is at the wrong commit')
  if(git(child,'status','--porcelain').toString().trim())throw Error('Workspace has uncommitted changes')
  const m=JSON.parse(readFileSync(path.join(child,'content/manifest.json'),'utf8'))
  if(sources==='recomputed'||!pins.length){if(JSON.stringify(m)!==JSON.stringify(s.manifest))throw Error('Child manifest and canonical source manifest disagree')}
  else{
   // Without the clones the child's Fabric part must still equal the recomputed Fabric export,
   // and each source's rows must hash to the digest the receipt pinned.
   if(JSON.stringify(m.files.filter(fabricOwned))!==JSON.stringify(s.manifest.files)||m.content_digest!==receipt.content_digest||JSON.stringify((m.sources??[]).map(x=>[x.id,x.commit]))!==JSON.stringify(pins.map(x=>[x.id,x.commit]))||pins.some(x=>digest(m.files.filter(ownedBy(x.id)))!==x.files_digest))throw Error('Child manifest and canonical source manifest disagree')
  }
  verifyContent(child,m)
  verifyCommittedSnapshot(child)
  return result({files:m.files.length,child:'verified'})
 }
 if(requireChild)throw Error('Initialize workspace submodule before full publication verification')
 return result({child:'not checked; absent locally'})
}
function deployedAt(r){
 if(r.platform==='digitalocean')return UUID.test(r.do_app||'')&&UUID.test(r.deployment||'')&&r.heroku_app===undefined&&r.release===undefined
 return r.platform===undefined&&Number.isSafeInteger(r.release)&&r.release>=1&&/^[-a-z0-9]{3,30}$/.test(r.heroku_app||'')
}
export const hasCommit=(dir,commit)=>{try{git(dir,'cat-file','-e',commit+'^{commit}');return true}catch{return false}}
