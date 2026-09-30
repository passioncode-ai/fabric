import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {checkReceipt,receiptPath,git,publicationOnly,snapshot} from './workspace-snapshot.mjs'
import {localSourceDirs,pinnedSources} from './workspace-sources.mjs'

// A completed parent pointer can survive a failed push. Recognize it without
// exporting B as a new source; an ordinary repeated publish is idempotent too.
// Completed means the pin and the receipt are COMMITTED, not merely valid — so only those
// two paths decide it. Asking whether the whole tree is clean answered a different
// question, and any unrelated edit made a finished publication look unfinished.
export function publicationPointerDirty(porcelain,{receipt=receiptPath}={}){
 return porcelain.split('\n').filter(Boolean).map(row=>row.slice(3)).some(p=>p==='workspace'||p===receipt)
}
export function completedPublication(root){
 try{
  // checkReceipt also accepts a staged pin so it can run BEFORE committing.
  if(publicationPointerDirty(git(root,'status','--porcelain').toString()))return null
  checkReceipt(root,{requireChild:true,sourceDirs:localSourceDirs(root)});return JSON.parse(readFileSync(path.join(root,receiptPath),'utf8'))
 }catch{return null}
}
// What in the parent tree can actually reach a publication. Only the index can: the
// snapshot is exported from a committed ref (`publicationSource` below), and the closing
// commit stages `workspace` and the receipt by name — but `git commit` writes the WHOLE
// index, so anything already staged rides along inside the pin commit. An unstaged edit
// is the operator's work in flight and is reported, never refused; refusing it made a
// publication wait on unrelated work that could not affect it.
export function publicationHazards(porcelain,{resume=false,receipt=receiptPath}={}){
 return porcelain.split('\n').filter(Boolean).filter(row=>{
  if(row.startsWith('??'))return false
  if(row[0]===' ')return false
  const path=row.slice(3)
  if(path==='workspace')return false
  if(path===receipt&&resume)return false
  return true
 }).map(row=>row.slice(3))
}
/** Has Fabric changed since `commit`, counting only non-publication paths? A commit that is not an
 * ancestor of HEAD — absent from this history, or on another line — counts as changed. */
export function sourceChangedSince(root,commit){
 try{git(root,'merge-base','--is-ancestor',commit,'HEAD')}catch{return true}
 return git(root,'diff','--name-only',commit,'HEAD').toString().split('\n').some(p=>p&&!publicationOnly(p))
}
export function publicationSource(root,child,{pinned=pinnedSources}={}){
 const manifest=JSON.parse(readFileSync(path.join(child,'content/manifest.json'),'utf8'))
 if(!/^[a-f0-9]{40}$/.test(manifest.source?.commit||''))throw Error('Child source must be an immutable commit')
 // A source this history does not contain (the repository was re-created with one clean history
 // on 2026-09-30) is not an error: it means Fabric changed, so HEAD is the new source.
 if(sourceChangedSince(root,manifest.source.commit))return git(root,'rev-parse','HEAD').toString().trim()
 if(JSON.stringify(manifest)!==JSON.stringify(snapshot(root,manifest.source.commit,{sources:pinned(manifest)}).manifest))throw Error('Host-only publication refuses modified snapshot provenance')
 return manifest.source.commit
}
export function validateDeployedVersion(version,expected,release){
 if(release?.status!=='succeeded'||release.current!==true||!Number.isSafeInteger(release.version)||release.version<1)throw Error('Heroku release is not current and successful')
 if(version?.source?.repository!=='https://github.com/passioncode-ai/fabric'||version.source.commit!==expected.source_commit||version.content_digest!==expected.content_digest||version.deployment?.workspace_commit!==expected.workspace_commit||version.deployment?.release!=='v'+release.version||JSON.stringify((version.sources??[]).map(x=>[x.id,x.commit]))!==JSON.stringify((expected.sources??[]).map(x=>[x.id,x.commit])))throw Error('Running workspace identity differs from the expected source, content, sources, build or release')
 return release.version
}
export async function verifyDeployment(config,expected){
 const cli=args=>execFileSync('heroku',args,{encoding:'utf8',maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']})
 const secret=name=>{try{return cli(['config:get',name,'--app',config.heroku_app]).replace(/\r?\n$/,'')}catch{throw Error('Cannot read Heroku access configuration: '+name)}}
 const user=secret('WORKSPACE_USER'),password=secret('WORKSPACE_PASSWORD')
 if(!user||!password)throw Error('Heroku access configuration is missing')
 const headers={Authorization:'Basic '+Buffer.from(user+':'+password).toString('base64')}
 let last='Deployment verification did not run'
 // Heroku can return while the new dyno is still booting. Bounded observation,
 // never a blind success on the healthy old release.
 for(let attempt=0;attempt<6;attempt++){
  try{
   const opts={redirect:'error',signal:AbortSignal.timeout(10000)}
   const health=await fetch(config.public_origin+'/healthz',opts)
   if(!health.ok||(await health.json()).ok!==true)throw Error('Workspace health check failed')
   const anonymous=await fetch(config.public_origin+'/version.json',{redirect:'error',signal:AbortSignal.timeout(10000)})
   if(anonymous.status!==401)throw Error('Workspace content is not closed to anonymous access')
   const result=await fetch(config.public_origin+'/version.json',{...opts,signal:AbortSignal.timeout(10000),headers})
   if(!result.ok)throw Error('Authenticated workspace version unavailable')
   const version=await result.json(),release=JSON.parse(cli(['releases:info','--app',config.heroku_app,'--json']))
   validateDeployedVersion(version,expected,release)
   return {release:release.version,version}
  }catch(e){last=e.message;console.log('Waiting for verified workspace release ('+(attempt+1)+'/6): '+last);if(attempt<5)await new Promise(resolve=>setTimeout(resolve,3000))}
 }
 throw Error('No publication receipt written: '+last)
}
