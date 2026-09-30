#!/usr/bin/env node
import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import path from 'node:path'
import {snapshot,writeSnapshot,checkReceipt,git,receiptPath,publicationOnly,verifyCommittedSnapshot,receiptFor} from './workspace-snapshot.mjs'
import {resolveSources,pinnedSources,localSourceDirs,sourcesMatch,sourcePins,fetchTip,lagReport,syncReasons} from './workspace-sources.mjs'
import {completedPublication,verifyDeployment,publicationSource,publicationHazards} from './workspace-release.mjs'
const root=path.resolve(import.meta.dirname,'..'),child=path.join(root,'workspace')
const config=()=>JSON.parse(readFileSync(path.join(root,'workspace.config.json'),'utf8'))
const run=(bin,args,cwd=root)=>execFileSync(bin,args,{cwd,stdio:'inherit'})
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
 const completed=completedPublication(root)
 // Every other repository is read at its current tip. A publication is finished only when Fabric
 // AND each source are what the receipt pins; a new commit in a tool's repository republishes.
 const resolved=resume?null:resolveSources(c)
 if(completed&&(resume||sourcesMatch(completed,resolved))){
  const actual=await verifyDeployment(c,completed)
  if(actual.release!==completed.release)throw Error('Release changed after receipt; inspect configuration changes or rollback before republishing')
  run('git',['push','origin',pushTarget()]);console.log('Workspace already published; parent push verified. '+c.public_origin);process.exit(0)
 }
 if(git(child,'branch','--show-current').toString().trim()!=='main')throw Error('Workspace must be on main; inspect detached state before publishing')
 run('git',['fetch','origin','main'],child)
 git(child,'merge-base','--is-ancestor','origin/main','HEAD')
 const source=publicationSource(root,child)
 // Checked before the gates: a checkout without the deploy remote (a fresh worktree's
 // submodule has only origin) otherwise fails after ten minutes of gates, at the Heroku push.
 try{git(child,'remote','get-url','heroku')}catch{throw Error('The workspace checkout has no heroku remote. NEXT: git -C workspace remote add heroku https://git.heroku.com/'+c.heroku_app+'.git')}
 run('bash',['scripts/ci.sh','fast'])
 const prior=resume?JSON.parse(readFileSync(path.join(child,'content/manifest.json'),'utf8')):null
 const expected=snapshot(root,source,{sources:resume?pinnedSources(prior):resolved})
 if(resume){if(prior.source.commit!==source||prior.content_digest!==expected.manifest.content_digest)throw Error('Resume snapshot does not match current source; inspect the interrupted release')}
 else writeSnapshot(child,expected)
 run('npm',['test'],child)
 run('npm',['run','verify:content'],child)
 if(git(child,'status','--porcelain').toString().trim()){
  // Canonical historical evidence may have .log extensions ignored for runtime
  // logs. The generated manifest, not Git's incidental ignore patterns, owns it.
  run('git',['add','--force','content'],child);run('git',['commit','-m','Publish Fabric source '+source.slice(0,12)],child)
 }
 verifyCommittedSnapshot(child)
 const ws=git(child,'rev-parse','HEAD').toString().trim()
 run('git',['push','origin','main'],child)
 run('git',['push','heroku','main'],child)
 const m=JSON.parse(readFileSync(path.join(child,'content/manifest.json'),'utf8'))
 const verified=await verifyDeployment(c,{source_commit:source,workspace_commit:ws,content_digest:m.content_digest,sources:m.sources??[]})
 writeFileSync(path.join(root,receiptPath),JSON.stringify(receiptFor({manifest:m},{workspace_commit:ws,heroku_app:c.heroku_app,release:verified.release}),null,2)+'\n')
 run('git',['add','workspace',receiptPath]);checkReceipt(root,{requireChild:true,sourceDirs:localSourceDirs(root)});run('bash',['scripts/ci.sh','fast'])
 run('git',['commit','-m','Pin published Fabric workspace '+ws.slice(0,12)])
 run('git',['push','origin',pushTarget()])
 console.log('Published and pinned '+c.public_origin+' · '+ws)
}else if(cmd==='sync'){
 // #region workspace-sync — docs: docs/architecture/report-workspace.md#keeping-it-current
 // Fabric ADR-0093: publish when something is behind, never on a schedule alone. Runs on a clean
 // checkout of main (the scheduled job keeps its own); refuses anything else rather than guess.
 const c=config()
 if(!process.env.FABRIC_WORKSPACE_SYNC_CHECKOUT||path.resolve(process.env.FABRIC_WORKSPACE_SYNC_CHECKOUT)!==root)throw Error('sync moves its checkout to origin/main, so it runs only in the checkout FABRIC_WORKSPACE_SYNC_CHECKOUT names (scripts/install-workspace-sync.sh makes it)')
 if(git(root,'status','--porcelain','--untracked-files=no').toString().split('\n').filter(Boolean).some(r=>r.slice(3)!=='workspace'))throw Error('sync runs on a clean checkout of main; this one has changes')
 run('git',['fetch','-q','origin','main'])
 // Its own checkout: whatever a previous run left (a pin that lost a push race) is dropped by
 // detaching onto origin/main; nobody's work lives here, which is what the guard above ensures.
 run('git',['checkout','-q','--detach','origin/main'])
 run('git',['submodule','update','--init','-q','workspace'])
 const receipt=JSON.parse(readFileSync(path.join(root,receiptPath),'utf8'))
 const sourceChanged=git(root,'diff','--name-only',receipt.source_commit,'HEAD').toString().split('\n').filter(p=>p&&!publicationOnly(p)).length>0
 run('git',['fetch','-q','origin','main'],child)
 run('git',['checkout','-q','-B','main','origin/main'],child)
 const hostAhead=Number(git(child,'rev-list','--count',receipt.workspace_commit+'..origin/main').toString().trim())
 const configured=sourcePins(c)
 const lag=lagReport({pins:receipt.sources??[],configured:configured.map(x=>x.id),graceHours:0,resolve:id=>{
  try{return fetchTip(configured.find(x=>x.id===id))}catch(e){console.log('UNREADABLE '+e.message);return {tip:null}}
 }})
 const reasons=syncReasons({lag,hostAhead,sourceChanged})
 if(!reasons.length){console.log('Workspace current: nothing to publish');process.exit(0)}
 console.log('Publishing because: '+reasons.join('; '))
 // The host's main is exactly origin/main. This checkout is the sync's own, so a snapshot commit a
 // previous run left unpushed (it lost a push race) is dropped here rather than wedging every
 // later run on a fast-forward that can no longer succeed; the next export recreates it.
 run('git',['checkout','-q','-B','main','origin/main'],child)
 run(process.execPath,['scripts/workspace.mjs','publish'])
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
