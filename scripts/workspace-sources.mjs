// The other repositories of Fabric Workspace (agent-registry plan AR-0.5): where their clones
// live, how a publication pins them, and how far each pin has fallen behind its repository.
// The clones are a cache, never a source of truth: each is a bare mirror of one repository,
// refreshed before a publication, and the pin written into the receipt is what the wiki shows.
import {execFileSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync} from 'node:fs'
import {homedir} from 'node:os'
import path from 'node:path'
import {git,sourceId,sourceRepository,hasCommit,receiptPath} from './workspace-snapshot.mjs'

export const cacheRoot=(env=process.env)=>env.FABRIC_WORKSPACE_SOURCES||path.join(homedir(),'.cache','fabric-workspace','sources')
export const sourceDir=(id,env=process.env)=>path.join(cacheRoot(env),id+'.git')
const tipRef='refs/fabric-workspace/tip'

/** The configured sources, validated the way the host validates them. */
export function sourcePins(config){
 const list=config?.sources??[],ids=new Set()
 if(!Array.isArray(list))throw Error('Invalid workspace source list')
 return list.map(x=>{
  if(!sourceId.test(x?.id||'')||ids.has(x.id)||!sourceRepository.test(x.repository||''))throw Error('Invalid workspace source: '+JSON.stringify(x))
  ids.add(x.id);return {id:x.id,repository:x.repository}
 })
}

/**
 * Refresh one bare mirror and return its default-branch tip. The network is bounded (one clone or
 * one fetch, 120 s) and a failure is thrown with the repository named: a publication that cannot
 * read a source stops rather than silently publishing the old pin as if it were current.
 */
export function fetchTip(src,env=process.env){
 const dir=sourceDir(src.id,env)
 const run=(args,cwd)=>execFileSync('git',args,{cwd,timeout:120000,killSignal:'SIGKILL',stdio:['ignore','pipe','pipe'],env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_SSH_COMMAND:process.env.GIT_SSH_COMMAND??'ssh -o BatchMode=yes -o ConnectTimeout=15'}})
 try{
  if(!existsSync(dir)){mkdirSync(path.dirname(dir),{recursive:true});run(['clone','-q','--bare',src.repository,dir])}
  run(['fetch','-q','--prune',src.repository,'+HEAD:'+tipRef],dir)
 }catch(e){throw Error('Cannot read workspace source '+src.id+' ('+src.repository+'): '+String(e.stderr||e.message).trim().split('\n').at(-1))}
 return {dir,tip:git(dir,'rev-parse',tipRef).toString().trim()}
}

/** The sources to export now: every configured one at its freshly fetched tip. */
export function resolveSources(config,{env=process.env,fetch=fetchTip}={}){
 return sourcePins(config).map(src=>{const {dir,tip}=fetch(src,env);return {...src,dir,commit:tip}})
}

/** The sources a prior publication pinned, resolved to local clones (for --resume). */
export function pinnedSources(manifest,{env=process.env,fetch=fetchTip}={}){
 return (manifest.sources??[]).map(x=>{
  const dir=sourceDir(x.id,env)
  if(!hasCommit(dir,x.commit))fetch(x,env)
  if(!hasCommit(dir,x.commit))throw Error('Pinned workspace source commit is gone from its repository: '+x.id+' '+x.commit)
  return {id:x.id,repository:x.repository,dir,commit:x.commit}
 })
}


/**
 * How far each published pin trails its repository. `resolve(id)` returns {dir, tip}, or a null
 * tip when the repository could not be read. States:
 *   current       the pin is the tip
 *   within-grace  the tip moved, and its oldest unpublished commit is younger than the grace
 *   stale         the oldest unpublished commit is older than the grace
 *   diverged      the pin is no longer an ancestor of the tip (history rewritten)
 *   unpublished   the source is configured but no publication pinned it yet
 *   unreachable   the repository could not be read; nothing is known, so nothing is green
 */
export function lagReport({pins,configured,resolve,now=Date.now(),graceHours=24}){
 const rows=[],byId=new Map(pins.map(p=>[p.id,p]))
 for(const id of configured){
  const pin=byId.get(id)
  if(!pin){rows.push({id,state:'unpublished'});continue}
  const {dir,tip}=resolve(id)
  if(!tip){rows.push({id,pin:pin.commit,state:'unreachable'});continue}
  if(tip===pin.commit){rows.push({id,pin:pin.commit,tip,state:'current',behind:0});continue}
  let ancestor=false
  try{git(dir,'merge-base','--is-ancestor',pin.commit,tip);ancestor=true}catch{}
  if(!ancestor){rows.push({id,pin:pin.commit,tip,state:'diverged'});continue}
  const unpublished=git(dir,'rev-list','--reverse',pin.commit+'..'+tip).toString().trim().split('\n').filter(Boolean)
  const oldest=Date.parse(git(dir,'show','-s','--format=%cI',unpublished[0]).toString().trim())
  const hours=(now-oldest)/3600000
  rows.push({id,pin:pin.commit,tip,behind:unpublished.length,oldest_unpublished_hours:Math.round(hours),state:hours>graceHours?'stale':'within-grace'})
 }
 return rows
}

/** Local mirrors for the sources the committed receipt pins, where they exist. */
export function localSourceDirs(root,env=process.env){
 let pins=[]
 try{pins=JSON.parse(readFileSync(path.join(root,receiptPath),'utf8')).sources??[]}catch{return {}}
 return Object.fromEntries(pins.filter(x=>existsSync(sourceDir(x.id,env))).map(x=>[x.id,sourceDir(x.id,env)]))
}

/** True when the resolved tips are exactly what the receipt already pins. */
export const sourcesMatch=(receipt,resolved)=>JSON.stringify((receipt?.sources??[]).map(x=>[x.id,x.commit]))===JSON.stringify(resolved.map(x=>[x.id,x.commit]))

/**
 * Why a sync must publish (Fabric ADR-0093): a source behind its repository, the host repository
 * ahead of the pinned workspace commit (a knowledge-base or host change), or Fabric changed since
 * the published source. An unreachable source is not a reason: publishing over it would pin
 * nothing new and claim a freshness nobody measured. An empty list means the wiki is current.
 */
export function syncReasons({lag,hostAhead,sourceChanged}){
 const reasons=lag.filter(r=>['stale','diverged','unpublished'].includes(r.state)).map(r=>'source '+r.id+' is '+r.state)
 if(hostAhead>0)reasons.push('the workspace host is '+hostAhead+' commit(s) ahead of its pin (knowledge base or host)')
 if(sourceChanged)reasons.push('Fabric changed since the published source')
 return reasons
}

/**
 * What a failed earlier sync left in the sync's OWN checkout (Fabric ADR-0093): a publication that
 * deployed and wrote its receipt but failed before the pin commit leaves the receipt and the
 * workspace gitlink changed. Those two paths are the sync's own and are dropped; any other
 * changed path is someone's work, so the sync refuses and touches nothing.
 */
export function syncLeftovers(porcelain){
 const own=new Set(['docs/workspace-receipt.json','workspace']),discard=[],refuse=[]
 for(const row of porcelain.split('\n').filter(Boolean)){
  const p=row.slice(3)
  ;(own.has(p)?discard:refuse).push(p)
 }
 return {discard,refuse}
}
