#!/usr/bin/env node
import {homedir} from 'node:os'
import {createHash,randomUUID} from 'node:crypto'
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import path from 'node:path'
import {snapshot,writeSnapshot,checkReceipt,git,receiptPath,publicationOnly,verifyCommittedSnapshot,receiptFor} from './workspace-snapshot.mjs'
import {resolveSources,pinnedSources,localSourceDirs,sourcesMatch,sourcePins,fetchTip,lagReport,syncReasons,syncLeftovers} from './workspace-sources.mjs'
import {completedPublication,verifyDeployment,publicationSource,publicationHazards,sourceChangedSince} from './workspace-release.mjs'
import {boundedRun,nonInteractiveGitEnv,acquireLock,writeStatus,rotateLog,killAll} from './lib/bounded-run.mjs'
const root=path.resolve(import.meta.dirname,'..'),child=path.join(root,'workspace')
const config=()=>JSON.parse(readFileSync(path.join(root,'workspace.config.json'),'utf8'))
// #region workspace-bounded — docs: docs/adr/0106-fabric-adopts-the-product-lifecycle-contract.md#3-a-scheduled-job-is-bounded-exclusive-and-observable
// Every command has a deadline and runs in its own process group (lifecycle LC-02/LC-03): an
// `execFileSync` with no timeout left the scheduled sync waiting 5 h 27 min on a publish child that
// had deadlocked while exiting, and launchd skipped every interval behind it.
const MIN=60_000
const LIMIT={git:3*MIN,gate:40*MIN,test:10*MIN,publish:75*MIN}
const run=(bin,args,cwd=root,timeoutMs=bin==='git'?LIMIT.git:LIMIT.test)=>boundedRun(bin,args,{cwd,timeoutMs,env:bin==='git'?nonInteractiveGitEnv():process.env})
const state=process.env.FABRIC_WORKSPACE_STATE_DIR||path.join(homedir(),'.cache','fabric-workspace')
const lockFile=path.join(state,'publish.lock'),statusFile=path.join(state,'sync-status.json')
// One publisher at a time on this machine, whichever checkout it runs in: the scheduled sync and a
// manual publish raced on the same remotes (failed pushes, ff-only aborts in the 2026-10-03 log).
// The sync's own publish child inherits the token and is admitted as the holder.
const holdPublication=()=>{
 const token=process.env.FABRIC_WORKSPACE_LOCK_TOKEN||randomUUID()
 const lock=acquireLock(lockFile,{token})
 if(!lock){let who='';try{who=' (held by pid '+JSON.parse(readFileSync(lockFile,'utf8')).pid+')'}catch{}throw Object.assign(Error('Another workspace publication is running'+who+'; this one stops rather than race it'),{code:'ELOCKED'})}
 process.env.FABRIC_WORKSPACE_LOCK_TOKEN=token
 process.once('exit',()=>lock.release())
 return lock
}
// #endregion workspace-bounded
const clean=dir=>{if(git(dir,'status','--porcelain').toString().trim())throw Error('Commit or preserve your changes first: '+dir)}
const cmd=process.argv[2]||'status'
// A detached checkout of main (the scheduled sync's own) pushes its pin to main; a branch pushes itself.
const pushTarget=()=>git(root,'branch','--show-current').toString().trim()?'HEAD':'HEAD:main'
if(cmd==='status'){
 if(!existsSync(path.join(child,'.git'))){console.log('Workspace is not initialized. NEXT: git submodule update --init workspace');process.exit(0)}
 try{
  console.log(JSON.stringify(checkReceipt(root,{sourceDirs:localSourceDirs(root)}),null,2))
  if(!completedPublication(root))console.log('Publication pin or receipt is pending a parent commit. NEXT: node scripts/workspace.mjs publish --resume')
  else console.log('NEXT: open '+config().public_origin)
 }catch(e){console.log(e.message);console.log('NEXT: finish the current source iteration, then run node scripts/workspace.mjs publish')}
}else if(cmd==='check'){
 console.log('PASS workspace publication: '+JSON.stringify(checkReceipt(root,{requireChild:process.argv.includes('--require-child'),sourceDirs:localSourceDirs(root)})))
}else if(cmd==='export'){
 const ref=process.argv[3]||'HEAD',target=path.resolve(process.argv[4]||child)
 if(target===root)throw Error('Cannot export into the source repository')
 clean(target);const s=snapshot(root,ref,{sources:resolveSources(config())});writeSnapshot(target,s);console.log(JSON.stringify({source:s.manifest.source.commit,sources:(s.manifest.sources??[]).map(x=>x.id+'@'+x.commit.slice(0,12)),digest:s.manifest.content_digest,files:s.manifest.files.length}))
}else if(cmd==='publish'){
 // Source commit → workspace release → parent pin. The last commit only changes projections.
 const resume=process.argv.includes('--resume')
 const porcelain=git(root,'status','--porcelain').toString()
 const hazards=publicationHazards(porcelain,{resume})
 if(hazards.length)throw Error('Publication refuses staged parent changes; the pin commit would carry them: '+hazards.join(', '))
 const inFlight=porcelain.split('\n').filter(Boolean).filter(r=>r[0]===' '||r.startsWith('??')).map(r=>r.slice(3))
 if(inFlight.length)console.log('Publishing past '+inFlight.length+' uncommitted parent change(s); the snapshot comes from a commit, so they are not in it: '+inFlight.slice(0,4).join(', ')+(inFlight.length>4?' …':''))
 clean(child);const c=config()
 holdPublication()
 const completed=completedPublication(root)
 // Every other repository is read at its current tip. A publication is finished only when Fabric
 // AND each source are what the receipt pins; a new commit in a tool's repository republishes.
 const resolved=resume?null:resolveSources(c)
 if(completed&&(resume||sourcesMatch(completed,resolved))){
  const actual=await verifyDeployment(c,completed)
  if(actual.release!==completed.release)throw Error('Release changed after receipt; inspect configuration changes or rollback before republishing')
  await run('git',['push','origin',pushTarget()]);console.log('Workspace already published; parent push verified. '+c.public_origin);process.exit(0)
 }
 if(git(child,'branch','--show-current').toString().trim()!=='main')throw Error('Workspace must be on main; inspect detached state before publishing')
 await run('git',['fetch','origin','main'],child)
 git(child,'merge-base','--is-ancestor','origin/main','HEAD')
 const source=publicationSource(root,child)
 // Checked before the gates: a checkout without the deploy remote (a fresh worktree's
 // submodule has only origin) otherwise fails after ten minutes of gates, at the Heroku push.
 try{git(child,'remote','get-url','heroku')}catch{throw Error('The workspace checkout has no heroku remote. NEXT: git -C workspace remote add heroku https://git.heroku.com/'+c.heroku_app+'.git')}
 // PROPORTIONAL (lifecycle LC-03). Fabric's gate verifies Fabric's source; when that source is the
 // commit the last receipt already published, its verdict stands, and a publication triggered by
 // another repository's commit does not re-run the whole product CI — twice — on a busy machine.
 // The workspace's own tests and content verification below still run on every publication.
 let receiptSource=null;try{receiptSource=JSON.parse(readFileSync(path.join(root,receiptPath),'utf8')).source_commit}catch{}
 const fabricChanged=!receiptSource||sourceChangedSince(root,receiptSource)
 if(fabricChanged)await run('bash',['scripts/ci.sh','fast'],root,LIMIT.gate)
 else console.log('Fabric source unchanged since the published '+receiptSource.slice(0,12)+'; its gate verdict stands')
 const prior=resume?JSON.parse(readFileSync(path.join(child,'content/manifest.json'),'utf8')):null
 const expected=snapshot(root,source,{sources:resume?pinnedSources(prior):resolved})
 if(resume){if(prior.source.commit!==source||prior.content_digest!==expected.manifest.content_digest)throw Error('Resume snapshot does not match current source; inspect the interrupted release')}
 else writeSnapshot(child,expected)
 await run('npm',['test'],child)
 await run('npm',['run','verify:content'],child)
 if(git(child,'status','--porcelain').toString().trim()){
  // Canonical historical evidence may have .log extensions ignored for runtime
  // logs. The generated manifest, not Git's incidental ignore patterns, owns it.
  await run('git',['add','--force','content'],child);await run('git',['commit','-m','Publish Fabric source '+source.slice(0,12)],child)
 }
 verifyCommittedSnapshot(child)
 const ws=git(child,'rev-parse','HEAD').toString().trim()
 await run('git',['push','origin','main'],child)
 await run('git',['push','heroku','main'],child)
 const m=JSON.parse(readFileSync(path.join(child,'content/manifest.json'),'utf8'))
 const verified=await verifyDeployment(c,{source_commit:source,workspace_commit:ws,content_digest:m.content_digest,sources:m.sources??[]})
 writeFileSync(path.join(root,receiptPath),JSON.stringify(receiptFor({manifest:m},{workspace_commit:ws,heroku_app:c.heroku_app,release:verified.release}),null,2)+'\n')
 await run('git',['add','workspace',receiptPath]);checkReceipt(root,{requireChild:true,sourceDirs:localSourceDirs(root)})
 // The pin commit changes only projections (the gitlink and the receipt); the gate runs again only
 // when it ran above, i.e. when the source it verifies changed.
 if(fabricChanged)await run('bash',['scripts/ci.sh','fast'],root,LIMIT.gate)
 await run('git',['commit','-m','Pin published Fabric workspace '+ws.slice(0,12)])
 await run('git',['push','origin',pushTarget()])
 console.log('Published and pinned '+c.public_origin+' · '+ws)
}else if(cmd==='sync'){
 // #region workspace-sync — docs: docs/architecture/report-workspace.md#keeping-it-current
 // Fabric ADR-0093: publish when something is behind, never on a schedule alone. Runs on a clean
 // checkout of main (the scheduled job keeps its own); refuses anything else rather than guess.
 const c=config()
 // Bounded, exclusive and observable (lifecycle LC-03): a watchdog below the 2 h interval, the
 // machine-wide publication lock, a status record a host can read, and a rotated log.
 const startedAt=new Date().toISOString(),log=process.env.FABRIC_WORKSPACE_SYNC_LOG
 if(log)rotateLog(log)
 const status=(outcome,reason)=>writeStatus(statusFile,{schema:'WorkspaceSync@1',pid:process.pid,started_at:startedAt,ended_at:outcome==='running'?null:new Date().toISOString(),outcome,reason:reason??null})
 const finish=(outcome,reason,code)=>{status(outcome,reason);console.log('== sync '+outcome+(reason?': '+reason:'')+' · '+new Date().toISOString());process.exit(code)}
 const watchdogMs=Number(process.env.FABRIC_WORKSPACE_SYNC_DEADLINE_MS)||100*MIN
 setTimeout(()=>{killAll();finish('timeout','the run passed its '+Math.round(watchdogMs/MIN)+' min watchdog; every step it started was ended',124)},watchdogMs).unref()
 for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>{killAll();finish('stopped','received '+sig,143)})
 // A run that finds another publication in progress is not a failure: it steps aside (exit 0).
 const fail=e=>{killAll();const locked=e?.code==='ELOCKED';finish(locked?'locked':'failed',String(e?.message||e).split('\n')[0],locked?0:1)}
 process.on('uncaughtException',fail);process.on('unhandledRejection',fail)
 console.log('== sync start · '+startedAt+' · pid '+process.pid)
 status('running')
 holdPublication()
 if(!process.env.FABRIC_WORKSPACE_SYNC_CHECKOUT||path.resolve(process.env.FABRIC_WORKSPACE_SYNC_CHECKOUT)!==root)throw Error('sync moves its checkout to origin/main, so it runs only in the checkout FABRIC_WORKSPACE_SYNC_CHECKOUT names (scripts/install-workspace-sync.sh makes it)')
 const left=syncLeftovers(git(root,'status','--porcelain','--untracked-files=no').toString())
 if(left.refuse.length)throw Error('sync runs on a clean checkout of main; this one has changes: '+left.refuse.slice(0,5).join(', '))
 // A previous run's unfinished publication (receipt + gitlink) is this checkout's own leftover.
 if(left.discard.includes('docs/workspace-receipt.json')){git(root,'restore','--staged','--worktree','docs/workspace-receipt.json');console.log('Dropped the receipt an unfinished earlier publication left behind')}
 if(left.discard.includes('workspace'))git(root,'restore','--staged','workspace')
 await run('git',['fetch','-q','origin','main'])
 // Its own checkout: whatever a previous run left (a pin that lost a push race) is dropped by
 // detaching onto origin/main; nobody's work lives here, which is what the guard above ensures.
 await run('git',['checkout','-q','--detach','origin/main'])
 await run('git',['submodule','update','--init','-q','workspace'])
 // A lockfile that moved since the last install would break every run until someone installed by
 // hand; the sync installs from the lockfile it is about to test (offline-first).
 const lockHash=createHash('sha256').update(readFileSync(path.join(root,'pnpm-lock.yaml'))).digest('hex'),stamp=path.join(root,'node_modules','.fabric-lock-hash')
 if(!existsSync(stamp)||readFileSync(stamp,'utf8').trim()!==lockHash){await run('pnpm',['install','--frozen-lockfile','--prefer-offline'],root,LIMIT.test);writeFileSync(stamp,lockHash+'\n')}
 const receipt=JSON.parse(readFileSync(path.join(root,receiptPath),'utf8'))
 const sourceChanged=sourceChangedSince(root,receipt.source_commit)
 await run('git',['fetch','-q','origin','main'],child)
 await run('git',['checkout','-q','-B','main','origin/main'],child)
 const hostAhead=Number(git(child,'rev-list','--count',receipt.workspace_commit+'..origin/main').toString().trim())
 const configured=sourcePins(c)
 const lag=lagReport({pins:receipt.sources??[],configured:configured.map(x=>x.id),graceHours:0,resolve:id=>{
  try{return fetchTip(configured.find(x=>x.id===id))}catch(e){console.log('UNREADABLE '+e.message);return {tip:null}}
 }})
 const reasons=syncReasons({lag,hostAhead,sourceChanged})
 if(!reasons.length)finish('current','nothing to publish',0)
 console.log('Publishing because: '+reasons.join('; '))
 // The host's main is exactly origin/main. This checkout is the sync's own, so a snapshot commit a
 // previous run left unpushed (it lost a push race) is dropped here rather than wedging every
 // later run on a fast-forward that can no longer succeed; the next export recreates it.
 await run('git',['checkout','-q','-B','main','origin/main'],child)
 await run(process.execPath,['scripts/workspace.mjs','publish'],root,LIMIT.publish)
 finish('published',reasons.join('; '),0)
 // #endregion workspace-sync
}else if(cmd==='lag'){
 // How far each tool repository's published pin trails its default branch. Reads the network;
 // exit 0 = every source current or within grace, 1 = stale/diverged/unpublished, 2 = unreadable.
 const i=process.argv.indexOf('--grace-hours'),graceHours=i>0?Number(process.argv[i+1]):24
 if(!Number.isFinite(graceHours)||graceHours<0)throw Error('--grace-hours takes a non-negative number')
 const receipt=JSON.parse(readFileSync(path.join(root,receiptPath),'utf8')),configured=sourcePins(config())
 const rows=lagReport({pins:receipt.sources??[],configured:configured.map(x=>x.id),graceHours,resolve:id=>{
  try{return fetchTip(configured.find(x=>x.id===id))}catch(e){console.log('UNREADABLE '+e.message);return {tip:null}}
 }})
 for(const r of rows)console.log([r.state.toUpperCase().padEnd(12),r.id.padEnd(30),r.pin?.slice(0,12)??'-',r.tip?'→ '+r.tip.slice(0,12):'',r.behind?r.behind+' commit(s) behind, oldest '+r.oldest_unpublished_hours+' h':''].join(' ').trimEnd())
 const bad=rows.filter(r=>['stale','diverged','unpublished'].includes(r.state)),unread=rows.filter(r=>r.state==='unreachable')
 console.log(rows.length+' source(s), grace '+graceHours+' h: '+(bad.length?bad.length+' behind. NEXT: node scripts/workspace.mjs publish':unread.length?unread.length+' unreadable; nothing is known about them':'all current'))
 process.exit(bad.length?1:unread.length?2:0)
}else throw Error('Usage: node scripts/workspace.mjs [status|check [--require-child]|export [commit] [target]|publish [--resume]|lag [--grace-hours N]|sync]')
