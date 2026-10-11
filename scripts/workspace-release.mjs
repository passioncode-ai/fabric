import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {checkReceipt,receiptPath,git,publicationOnly,snapshot} from './workspace-snapshot.mjs'
import {localSourceDirs,pinnedSources} from './workspace-sources.mjs'
import {boundedRun,nonInteractiveGitEnv} from './lib/bounded-run.mjs'

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
// #region workspace-deploy — docs: docs/architecture/report-workspace.md#deployment-on-digitalocean-app-platform
// The workspace host runs on DigitalOcean App Platform (app `do_app` in workspace.config.json), which
// deploys every push to the host's GitHub `main`. Publication therefore pushes to GitHub only, then
// proves the deployment: the App Platform API must report the deployment of the pushed commit ACTIVE,
// and the running host's /version.json must name that commit and the expected source, content and pins.
// No platform CLI is involved — neither Heroku's (retired 2026-10-08) nor doctl.
const FABRIC='https://github.com/passioncode-ai/fabric'
export const DO_API='https://api.digitalocean.com'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const COMMIT=/^[a-f0-9]{40}$/
const MIN=60_000
// Credentials come only from Project Observatory (vault, project `fabric`, env `prod`), injected into
// the probe child alone: the gates, npm and git never see them, and no value reaches argv or a log.
export const SECRETS={project:'fabric',env:'prod',names:['DIGITALOCEAN_TOKEN','WORKSPACE_USER','WORKSPACE_PASSWORD']}
export const DEPLOY_DEADLINE_MS=15*MIN
const POLL_MS=10_000
const FAILED=new Set(['ERROR','CANCELED','SUPERSEDED'])

/** The one commit an App Platform deployment built (every service of this app builds the same repo). */
export function deploymentCommit(d){
 const commits=[...new Set((d?.services??[]).map(s=>s?.source_commit_hash).filter(Boolean))]
 return commits.length===1&&COMMIT.test(commits[0])?commits[0]:null
}

/**
 * Which deployment serves this publication, from the API's newest-first list. Ours is the deployment of
 * `workspace_commit`, or of a later commit that only moved outside content/ (another session's
 * knowledge-base push lands on the same `main` and App Platform deploys it too, possibly cancelling ours
 * while it builds) — `sameContent(commit)` decides that. Anything else is someone else's publication.
 */
export function pickDeployment(deployments,{workspace_commit},{sameContent=()=>false}={}){
 const rows=(deployments??[]).map(d=>({id:d?.id,phase:d?.phase,commit:deploymentCommit(d)}))
 const carries=r=>Boolean(r.commit)&&(r.commit===workspace_commit||sameContent(r.commit))
 const active=rows.find(r=>r.phase==='ACTIVE')
 if(active&&carries(active))return {state:'active',deployment:active}
 const newest=rows.find(carries)
 if(!newest)return {state:'waiting',reason:'App Platform has no deployment of '+workspace_commit.slice(0,12)+' yet'+(active?.commit?' (ACTIVE: '+active.commit.slice(0,12)+')':'')}
 if(FAILED.has(newest.phase))return {state:'failed',reason:'the App Platform deployment '+newest.id+' of '+newest.commit.slice(0,12)+' is '+newest.phase+(active?.commit?'; ACTIVE is '+active.id+' at '+active.commit.slice(0,12):'')}
 return {state:'waiting',reason:'deployment '+newest.id+' of '+newest.commit.slice(0,12)+' is '+newest.phase}
}

export function validateDeployedVersion(version,expected,deployment){
 if(deployment?.phase!=='ACTIVE'||!UUID.test(deployment.id||'')||!COMMIT.test(deployment.commit||''))throw Error('App Platform deployment is not ACTIVE with an id and a full commit')
 const d=version?.deployment
 if(version?.source?.repository!==FABRIC||version.source.commit!==expected.source_commit||version.content_digest!==expected.content_digest||d?.platform!=='digitalocean'||d.workspace_commit!==deployment.commit||!(d.release===null||d.release===deployment.id)||JSON.stringify((version.sources??[]).map(x=>[x.id,x.commit]))!==JSON.stringify((expected.sources??[]).map(x=>[x.id,x.commit])))throw Error('Running workspace identity differs from the expected source, content, sources, build or deployment')
 return deployment.id
}

const final=message=>Object.assign(Error(message),{final:true})
/**
 * Bounded observation of one publication, run INSIDE the secrets runner (it reads the three names from
 * its own environment). Fails at once on a failed deployment; otherwise waits up to `deadlineMs`.
 */
export async function probeDeployment(config,expected,{env=process.env,fetch=globalThis.fetch,sameContent,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,deadlineMs=DEPLOY_DEADLINE_MS,intervalMs=POLL_MS,log=console.log}={}){
 const token=env.DIGITALOCEAN_TOKEN,user=env.WORKSPACE_USER,password=env.WORKSPACE_PASSWORD
 if(!token||!user||!password)throw final('Deployment credentials are missing: run through Project Observatory ('+SECRETS.names.join(', ')+')')
 if(!UUID.test(config.do_app||''))throw final('workspace.config.json has no valid do_app')
 const api=(config.do_api||DO_API)+'/v2/apps/'+config.do_app+'/deployments?per_page=20'
 const auth={Authorization:'Basic '+Buffer.from(user+':'+password).toString('base64')}
 const get=(url,headers)=>fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000),...(headers?{headers}:{})})
 const started=now();let last='Deployment verification did not run'
 for(let attempt=1;;attempt++){
  try{
   const listed=await get(api,{Authorization:'Bearer '+token,Accept:'application/json'})
   if(listed.status===401||listed.status===403)throw final('The App Platform API refused the token (HTTP '+listed.status+')')
   if(!listed.ok)throw Error('App Platform API answered HTTP '+listed.status)
   const pick=pickDeployment((await listed.json()).deployments,expected,{sameContent})
   if(pick.state==='failed')throw final(pick.reason)
   if(pick.state==='waiting')throw Error(pick.reason)
   const health=await get(config.public_origin+'/healthz')
   if(!health.ok||(await health.json()).ok!==true)throw Error('Workspace health check failed')
   const anonymous=await get(config.public_origin+'/version.json')
   if(anonymous.status!==401)throw Error('Workspace content is not closed to anonymous access')
   const result=await get(config.public_origin+'/version.json',auth)
   if(!result.ok)throw Error('Authenticated workspace version unavailable (HTTP '+result.status+')')
   const version=await result.json()
   validateDeployedVersion(version,expected,pick.deployment)
   return {deployment:pick.deployment.id,deployed_commit:pick.deployment.commit,version}
  }catch(e){
   if(e.final)throw Error('No publication receipt written: '+e.message)
   last=e.message
  }
  const waited=now()-started
  if(waited>=deadlineMs)throw Error('No publication receipt written after '+Math.round(waited/1000)+' s: '+last)
  log('Waiting for the verified App Platform deployment ('+attempt+', '+Math.round(waited/1000)+' s): '+last)
  await sleep(Math.min(intervalMs,Math.max(0,deadlineMs-waited)))
 }
}

/** Does `commit` descend from `base` with an identical content/ tree? Fetches once when it is unknown. */
export function sameContentAs(child,base){
 const seen=new Map();let fetched=false
 const env=nonInteractiveGitEnv()
 const g=(...args)=>execFileSync('git',args,{cwd:child,timeout:120000,killSignal:'SIGKILL',env,stdio:['ignore','pipe','ignore']}).toString().trim()
 const known=c=>{try{g('cat-file','-e',c+'^{commit}');return true}catch{return false}}
 return commit=>{
  if(seen.has(commit))return seen.get(commit)
  if(!known(commit)&&!fetched){fetched=true;try{g('fetch','-q','origin','main')}catch{}}
  if(!known(commit))return false
  let same=false
  try{g('merge-base','--is-ancestor',base,commit);same=g('rev-parse',base+':content')===g('rev-parse',commit+':content')}catch{}
  seen.set(commit,same);return same
 }
}

/** The installed Project Observatory secrets runner, or a refusal that names the fix. */
export function observatoryRunner({exec=execFileSync}={}){
 let dir
 try{dir=exec('project-observatory',['full-path'],{encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']}).trim()}
 catch{throw Error('Project Observatory is not on PATH; the publication reads its deployment credentials there. NEXT: install it, then re-run scripts/install-workspace-sync.sh')}
 const tool=path.join(dir,'tools','use_secret.py')
 if(!existsSync(tool))throw Error('Project Observatory has no tools/use_secret.py under '+dir)
 return tool
}
/** Checked before the long gates: the runner exists and knows every name (values are never read here). */
export function checkDeployCredentials({exec=execFileSync}={}){
 const tool=observatoryRunner({exec})
 let listed=''
 try{listed=exec('python3',[tool,'names',SECRETS.project],{encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe']})}catch(e){throw Error('Project Observatory cannot list the '+SECRETS.project+' credentials: '+(e.message||e).split('\n')[0])}
 const known=new Set(listed.split('\n').map(l=>l.trim().split(/\s+/)[0]).filter(Boolean))
 const missing=SECRETS.names.filter(n=>!known.has(n))
 if(missing.length)throw Error('Project Observatory has no '+missing.join(', ')+' for project '+SECRETS.project+'. NEXT: store them with tools/vault.py put')
 return tool
}

const self=fileURLToPath(import.meta.url)
/**
 * Verify a publication: run the probe in a child that alone holds the credentials, through the
 * Observatory runner (`--vault-only`). The child's verdict comes back through a file, never argv.
 */
export async function verifyDeployment(config,expected,{root,child=path.join(root,'workspace'),run=boundedRun,exec=execFileSync,timeoutMs=DEPLOY_DEADLINE_MS+2*MIN}={}){
 const tool=observatoryRunner({exec})
 const dir=mkdtempSync(path.join(tmpdir(),'fabric-workspace-deploy-'))
 try{
  const input=path.join(dir,'input.json'),output=path.join(dir,'result.json')
  writeFileSync(input,JSON.stringify({config:{do_app:config.do_app,public_origin:config.public_origin,...(config.do_api?{do_api:config.do_api}:{})},expected,child}),{mode:0o600})
  await run('python3',[tool,'run','--env',SECRETS.env,'--vault-only',SECRETS.project,SECRETS.names.join(','),'--',process.execPath,self,'probe',input,output],{cwd:root,timeoutMs})
  const result=JSON.parse(readFileSync(output,'utf8'))
  if(!UUID.test(result.deployment||''))throw Error('The deployment probe returned no deployment id')
  return result
 }finally{rmSync(dir,{recursive:true,force:true})}
}

// The probe entry point: `node workspace-release.mjs probe <input.json> <result.json>`, run by
// verifyDeployment inside the secrets runner.
if(process.argv[1]&&path.resolve(process.argv[1])===self&&process.argv[2]==='probe'){
 const [input,output]=process.argv.slice(3)
 const {config,expected,child}=JSON.parse(readFileSync(input,'utf8'))
 const env={DIGITALOCEAN_TOKEN:process.env.DIGITALOCEAN_TOKEN,WORKSPACE_USER:process.env.WORKSPACE_USER,WORKSPACE_PASSWORD:process.env.WORKSPACE_PASSWORD}
 // Nothing this process starts (git fetch) inherits a credential.
 for(const name of SECRETS.names)delete process.env[name]
 try{
  const result=await probeDeployment(config,expected,{env,sameContent:sameContentAs(child,expected.workspace_commit)})
  writeFileSync(output,JSON.stringify({deployment:result.deployment,deployed_commit:result.deployed_commit}))
  console.log('Verified App Platform deployment '+result.deployment+' of '+result.deployed_commit.slice(0,12))
 }catch(e){console.error(e.message);process.exitCode=1}
}
// #endregion workspace-deploy
