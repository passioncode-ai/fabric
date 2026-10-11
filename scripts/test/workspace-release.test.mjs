import {test} from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {once} from 'node:events'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,chmodSync,rmSync,existsSync} from 'node:fs'
import path from 'node:path'
import {tmpdir} from 'node:os'
import {validateDeployedVersion,completedPublication,publicationSource,pickDeployment,probeDeployment,deploymentCommit,sameContentAs,verifyDeployment,checkDeployCredentials} from '../workspace-release.mjs'
import {git,snapshot,writeSnapshot,receiptPath} from '../workspace-snapshot.mjs'

const APP='3283cfc0-7d5f-498b-8dac-cab351ab4409',DEP='af85ca04-1dcf-45a4-b1a7-7e0585bb413c',OTHER='139b640c-4d2f-42ef-9be4-dbe6f4267c0f'
const dep=(id,phase,commit)=>({id,phase,services:[{name:'web',source_commit_hash:commit}]})

test('only the ACTIVE App Platform deployment of the pushed commit, serving the expected identity, certifies a publication',()=>{
 const expected={source_commit:'a'.repeat(40),workspace_commit:'b'.repeat(40),content_digest:'c'.repeat(64)}
 const active={id:DEP,phase:'ACTIVE',commit:expected.workspace_commit}
 const version={source:{repository:'https://github.com/passioncode-ai/fabric',commit:expected.source_commit},content_digest:expected.content_digest,deployment:{workspace_commit:expected.workspace_commit,release:null,platform:'digitalocean'}}
 assert.equal(validateDeployedVersion(version,expected,active),DEP)
 assert.equal(validateDeployedVersion({...version,deployment:{...version.deployment,release:DEP}},expected,active),DEP)
 for(const other of [{...version,source:{commit:'d'.repeat(40)}},{...version,content_digest:'d'.repeat(64)},{...version,deployment:{...version.deployment,workspace_commit:'d'.repeat(40)}},{...version,deployment:{...version.deployment,release:OTHER}},{...version,deployment:{...version.deployment,platform:'heroku'}},{...version,deployment:{workspace_commit:expected.workspace_commit,release:'v12'}},{...version,deployment:null}])assert.throws(()=>validateDeployedVersion(other,expected,active),/identity/)
 // A tool repository pinned at another commit is another publication, even with Fabric identical.
 const pin={id:'fabric-agent-adapter',commit:'e'.repeat(40)},withSources={...expected,sources:[pin]}
 assert.equal(validateDeployedVersion({...version,sources:[{...pin,repository:'https://github.com/passioncode-ai/fabric-agent-adapter'}]},withSources,active),DEP)
 for(const sources of [undefined,[],[{...pin,commit:'f'.repeat(40)}]])assert.throws(()=>validateDeployedVersion({...version,sources},withSources,active),/identity/)
 for(const other of [{...active,phase:'BUILDING'},{...active,phase:'SUPERSEDED'},{...active,id:'v12'},{...active,commit:null}])assert.throws(()=>validateDeployedVersion(version,expected,other),/not ACTIVE/)
})

test('the deployment that serves a publication is picked from the API list; failed, foreign and pending ones are told apart',()=>{
 const ws='b'.repeat(40),later='c'.repeat(40),foreign='d'.repeat(40),older='e'.repeat(40)
 assert.equal(deploymentCommit(dep(DEP,'ACTIVE',ws)),ws)
 assert.equal(deploymentCommit({services:[{source_commit_hash:ws},{source_commit_hash:later}]}),null,'two commits in one deployment name none')
 assert.equal(deploymentCommit({services:[]}),null)
 const same=c=>c===later
 assert.deepEqual(pickDeployment([dep(DEP,'ACTIVE',ws),dep(OTHER,'SUPERSEDED',older)],{workspace_commit:ws}),{state:'active',deployment:{id:DEP,phase:'ACTIVE',commit:ws}})
 // Another session's knowledge-base push deployed on top: same content/, so it serves this publication.
 assert.equal(pickDeployment([dep(DEP,'ACTIVE',later),dep(OTHER,'CANCELED',ws)],{workspace_commit:ws},{sameContent:same}).deployment.commit,later)
 assert.equal(pickDeployment([dep(DEP,'BUILDING',later),dep(OTHER,'CANCELED',ws),dep('x','ACTIVE',older)],{workspace_commit:ws},{sameContent:same}).state,'waiting')
 for(const phase of ['PENDING_BUILD','BUILDING','PENDING_DEPLOY','DEPLOYING'])assert.equal(pickDeployment([dep(DEP,phase,ws),dep(OTHER,'ACTIVE',older)],{workspace_commit:ws}).state,'waiting',phase)
 assert.match(pickDeployment([dep(OTHER,'ACTIVE',older)],{workspace_commit:ws}).reason,/no deployment of bbbbbbbbbbbb yet/)
 for(const phase of ['ERROR','CANCELED'])assert.match(pickDeployment([dep(DEP,phase,ws),dep(OTHER,'ACTIVE',older)],{workspace_commit:ws}).reason,new RegExp(phase))
 // Ours went live and was replaced by a deployment with other content: someone else's publication.
 assert.equal(pickDeployment([dep(OTHER,'ACTIVE',foreign),dep(DEP,'SUPERSEDED',ws)],{workspace_commit:ws},{sameContent:same}).state,'failed')
})

test('the deployment probe waits within its deadline, fails fast on a failed deployment and never sends the token to the host',async()=>{
 const ws='b'.repeat(40),expected={source_commit:'a'.repeat(40),workspace_commit:ws,content_digest:'c'.repeat(64)}
 const config={do_app:APP,public_origin:'https://wiki.example.invalid'}
 const env={DIGITALOCEAN_TOKEN:'do-token-fixture',WORKSPACE_USER:'fixture',WORKSPACE_PASSWORD:'fixture-test-password'}
 const served={source:{repository:'https://github.com/passioncode-ai/fabric',commit:expected.source_commit},content_digest:expected.content_digest,deployment:{workspace_commit:ws,release:null,platform:'digitalocean'}}
 const json=(body,status=200)=>({ok:status<400,status,json:async()=>body})
 const fake=lists=>{const calls=[];let n=0;return {calls,fetch:async(url,opts={})=>{
  calls.push({url,auth:opts.headers?.Authorization??null})
  if(url.startsWith('https://api.digitalocean.com/v2/apps/'+APP+'/deployments'))return json({deployments:lists[Math.min(n++,lists.length-1)]})
  if(url.endsWith('/healthz'))return json({ok:true})
  if(url.endsWith('/version.json'))return opts.headers?.Authorization?json(served):json({},401)
  throw Error('unexpected '+url)}}}
 let clock=0;const time={now:()=>clock,sleep:async ms=>{clock+=ms},log:()=>{}}
 const pending=fake([[dep(DEP,'BUILDING',ws)],[dep(DEP,'DEPLOYING',ws)],[dep(DEP,'ACTIVE',ws)]])
 const result=await probeDeployment(config,expected,{env,fetch:pending.fetch,...time})
 assert.deepEqual([result.deployment,result.deployed_commit],[DEP,ws]);assert.equal(clock,20000,'two 10 s waits')
 const api=pending.calls.filter(c=>c.url.includes('digitalocean.com')),host=pending.calls.filter(c=>!c.url.includes('digitalocean.com'))
 assert(api.every(c=>c.auth==='Bearer do-token-fixture'));assert(host.every(c=>!String(c.auth).includes('do-token-fixture')),'the DigitalOcean token never reaches the host')
 assert.equal(host.filter(c=>c.auth?.startsWith('Basic ')).length,1)
 clock=0;const failed=fake([[dep(DEP,'ERROR',ws)]])
 await assert.rejects(probeDeployment(config,expected,{env,fetch:failed.fetch,...time}),/No publication receipt written: .*ERROR/);assert.equal(clock,0,'a failed build is not waited on')
 clock=0;const never=fake([[dep(OTHER,'ACTIVE','e'.repeat(40))]])
 await assert.rejects(probeDeployment(config,expected,{env,fetch:never.fetch,...time,deadlineMs:60000}),/after 60 s: App Platform has no deployment/);assert.equal(clock,60000)
 clock=0;const refused={fetch:async()=>json({},401)}
 await assert.rejects(probeDeployment(config,expected,{env,fetch:refused.fetch,...time}),/refused the token/);assert.equal(clock,0)
 await assert.rejects(probeDeployment(config,expected,{env:{},fetch:pending.fetch,...time}),/credentials are missing/)
 // A live host that serves another identity is not a publication, however long it is waited on.
 clock=0;served.content_digest='d'.repeat(64)
 await assert.rejects(probeDeployment(config,expected,{env,fetch:fake([[dep(DEP,'ACTIVE',ws)]]).fetch,...time,deadlineMs:20000}),/identity differs/)
})

test('a later commit counts as the publication only when it descends from it with an identical content/ tree',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'fabric-same-content-'))
 const g=(...a)=>git(dir,...a).toString().trim()
 g('init','-q');g('config','user.name','Fixture');g('config','user.email','fixture@example.invalid')
 const put=(p,t)=>{mkdirSync(path.dirname(path.join(dir,p)),{recursive:true});writeFileSync(path.join(dir,p),t);g('add','-A');g('-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','commit','-qm',p);return g('rev-parse','HEAD')}
 const before=put('content/a.md','one'),base=put('content/b.md','two'),knowledge=put('knowledge/d.md','D1'),content=put('content/c.md','three')
 const same=sameContentAs(dir,base)
 assert.equal(same(knowledge),true);assert.equal(same(content),false);assert.equal(same(before),false,'an ancestor is not the publication')
 assert.equal(same('f'.repeat(40)),false,'an unknown commit after one fetch attempt is not the publication')
 rmSync(dir,{recursive:true,force:true})
})

test('the publish path never shells out to the Heroku CLI and needs no platform CLI at all',()=>{
 for(const file of ['workspace.mjs','workspace-release.mjs','workspace-snapshot.mjs','workspace-sources.mjs']){
  const code=readFileSync(path.join(import.meta.dirname,'..',file),'utf8')
  assert.doesNotMatch(code,/['"`]heroku['"`]\s*,/,file+' spawns heroku')
  assert.doesNotMatch(code,/['"]push['"]\s*,\s*['"]heroku['"]/,file+' pushes to a heroku remote')
  assert.doesNotMatch(code,/['"`]doctl['"`]/,file+' depends on doctl')
 }
})

test('actual publisher resumes a failed parent push without creating a second snapshot or commit, and never runs heroku',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'fabric-release-fixture-'))
 // The publication lock and status live outside the fixture repository and outside the real ~/.cache (LC-14).
 const stateDir=mkdtempSync(path.join(tmpdir(),'fabric-release-state-'))
 const write=(p,s)=>{mkdirSync(path.dirname(path.join(root,p)),{recursive:true});writeFileSync(path.join(root,p),s)}
 const commit=dir=>{git(dir,'add','.');git(dir,'-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','commit','-qm','fixture');return git(dir,'rev-parse','HEAD').toString().trim()}
 const init=dir=>{mkdirSync(dir,{recursive:true});git(dir,'init','-q');git(dir,'config','user.name','Fixture');git(dir,'config','user.email','fixture@example.invalid')}
 let served,deployed=()=>null
 // One local server plays both the host and the App Platform API (config.do_api points at it). The API
 // answers only to the fixture token, which the fake Observatory runner below injects into the probe.
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json')
  if(req.url.startsWith('/v2/apps/'+APP+'/deployments')){if(req.headers.authorization!=='Bearer do-token-fixture'){res.writeHead(401);return res.end('{}')}return res.end(JSON.stringify({deployments:[dep(DEP,'ACTIVE',deployed())]}))}
  if(req.url==='/version.json'&&!req.headers.authorization){res.writeHead(401);return res.end('{}')}res.end(JSON.stringify(req.url==='/healthz'?{ok:true}:served))})
 server.listen(0,'127.0.0.1');await once(server,'listening')
 try{
  init(root);write('docs/reports/map.html','<h1>Source map</h1>')
  // Host/Fabric suites are verified separately; this fixture exercises the real
  // publisher state machine and real local Git pushes, with external checks stubbed.
  write('scripts/ci.sh','#!/bin/sh\nmkdir -p fake-bin && touch fake-bin/ci-ran\nexit 0\n')
  for(const file of ['workspace.mjs','workspace-snapshot.mjs','workspace-release.mjs','workspace-sources.mjs','lib/bounded-run.mjs'])write('scripts/'+file,readFileSync(path.join(import.meta.dirname,'..',file)))
  write('.gitignore','fake-bin/\nobservatory/\n');const origin='http://127.0.0.1:'+server.address().port;write('workspace.config.json',JSON.stringify({do_app:APP,do_api:origin,public_origin:origin}))
  const source=commit(root),s=snapshot(root,source),child=path.join(root,'workspace');init(child);writeSnapshot(child,s);const ws=commit(child)
  write(receiptPath,JSON.stringify({schema:1,source_commit:source,workspace_commit:ws,content_digest:s.manifest.content_digest,platform:'digitalocean',do_app:APP,deployment:DEP}))
  const parent=commit(root)
  deployed=()=>ws
  served={source:{repository:'https://github.com/passioncode-ai/fabric',commit:source},content_digest:s.manifest.content_digest}
  Object.defineProperty(served,'deployment',{enumerable:true,get:()=>({workspace_commit:deployed(),release:null,platform:'digitalocean'})})
  assert.equal(completedPublication(root).source_commit,source);assert.equal(publicationSource(root,child),source)
  // A heroku on PATH that only records being called: the publication must never reach for it.
  const herokuRan=path.join(root,'fake-bin/heroku-ran')
  write('fake-bin/heroku','#!/bin/sh\ntouch '+herokuRan+'\nexit 1\n');chmodSync(path.join(root,'fake-bin/heroku'),0o755)
  // Project Observatory, faked at its two seams: `project-observatory full-path` and tools/use_secret.py
  // (`names`, and `run … -- cmd`, which injects the three names into cmd's environment only).
  const noObservatory=path.join(root,'fake-bin/no-observatory')
  write('fake-bin/project-observatory','#!/bin/sh\n[ -f '+noObservatory+' ] && exit 127\necho '+path.join(root,'observatory')+'\n');chmodSync(path.join(root,'fake-bin/project-observatory'),0o755)
  write('observatory/tools/use_secret.py',['import os,sys','a=sys.argv[1:]','if a[0]=="names":','    print("  DIGITALOCEAN_TOKEN  vault  vault:fabric/prod\\n  WORKSPACE_PASSWORD  vault  vault:fabric/prod\\n  WORKSPACE_USER  vault  vault:fabric/prod");sys.exit(0)','assert a[0]=="run" and "--vault-only" in a and a[a.index("--env")+1]=="prod", a','cmd=a[a.index("--")+1:]','os.environ.update(DIGITALOCEAN_TOKEN="do-token-fixture",WORKSPACE_USER="fixture",WORKSPACE_PASSWORD="fixture-test-password")','os.execvp(cmd[0],cmd)',''].join('\n'))
  // `npm test` in the workspace doubles as the moment another session commits to it (the race below).
  const race=path.join(root,'fake-bin/race.sh')
  write('fake-bin/npm','#!/bin/sh\nif [ -f '+race+' ]; then sh '+race+' || exit 1; rm -f '+race+'; fi\nexit 0\n');chmodSync(path.join(root,'fake-bin/npm'),0o755)
  const run=(resume=true)=>new Promise(resolve=>{const p=spawn(process.execPath,['scripts/workspace.mjs','publish',...(resume?['--resume']:[])],{cwd:root,env:{...process.env,FABRIC_WORKSPACE_STATE_DIR:stateDir,PATH:path.join(root,'fake-bin')+path.delimiter+process.env.PATH}});let out='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>out+=b);p.on('close',code=>resolve({code,out}))})
  git(root,'remote','add','origin',path.join(root,'nonexistent-remote'))
  const failed=await run();assert.notEqual(failed.code,0);assert.equal(git(root,'rev-parse','HEAD').toString().trim(),parent)
  const remote=mkdtempSync(path.join(tmpdir(),'fabric-release-remote-'));git(remote,'init','--bare','-q');git(root,'remote','set-url','origin',remote)
  const passed=await run();assert.equal(passed.code,0,passed.out);assert.match(passed.out,/already published/)
  assert.equal(git(root,'rev-parse','HEAD').toString().trim(),parent);assert.equal(git(child,'rev-parse','HEAD').toString().trim(),ws)
  assert.equal(git(root,'status','--porcelain').toString().trim(),'')
  const childRemote=mkdtempSync(path.join(tmpdir(),'fabric-child-remote-'))
  git(childRemote,'init','--bare','-q');git(child,'branch','-M','main');git(child,'remote','add','origin',childRemote);git(child,'push','origin','main')
  // App Platform deploys whatever reaches the host's GitHub main.
  deployed=()=>git(childRemote,'rev-parse','main').toString().trim()
  write('workspace/server.mjs','// reviewed host-only change');const host=commit(child);assert.equal(completedPublication(root),null);assert.equal(publicationSource(root,child),source)
  // Without Project Observatory (the deployment credentials) the publication stops before the long gates.
  const ran=path.join(root,'fake-bin/ci-ran');rmSync(ran,{force:true});writeFileSync(noObservatory,'')
  const noSecrets=await run(false);assert.notEqual(noSecrets.code,0);assert.match(noSecrets.out,/Project Observatory is not on PATH/);assert.equal(existsSync(ran),false,'the gates ran before the missing credentials were noticed')
  rmSync(noObservatory)
  const hostPublished=await run(false);assert.equal(hostPublished.code,0,hostPublished.out)
  const hostReceipt=JSON.parse(readFileSync(path.join(root,receiptPath),'utf8'));assert.equal(hostReceipt.source_commit,source);assert.equal(hostReceipt.workspace_commit,host);assert.equal(git(child,'rev-parse','HEAD').toString().trim(),host)
  assert.deepEqual([hostReceipt.platform,hostReceipt.do_app,hostReceipt.deployment,hostReceipt.heroku_app,hostReceipt.release],['digitalocean',APP,DEP,undefined,undefined])
  assert.equal(git(root,'status','--porcelain').toString().trim(),'')
  // 2026-10-05: another session committed to the workspace's knowledge/ while the gates ran, and the push was
  // rejected after the whole run — twice. Outside content/ the publication now re-applies itself on top.
  const other=mkdtempSync(path.join(tmpdir(),'fabric-other-session-'));git(other,'clone','-q',childRemote,'.');git(other,'config','user.name','Other');git(other,'config','user.email','other@example.invalid')
  const otherCommit=(file,text)=>`cd ${other} && git pull -q origin main && mkdir -p $(dirname ${file}) && printf '%s' '${text}' > ${file} && git add -A && git -c core.hooksPath=/dev/null -c commit.gpgsign=false commit -qm other && git push -q origin HEAD:main\n`
  write('workspace/server.mjs','// a second reviewed host change');commit(child)
  writeFileSync(race,otherCommit('knowledge/decisions.md','D1 accepted'))
  const raced=await run(false);assert.equal(raced.code,0,raced.out);assert.match(raced.out,/moved outside content\/ during the gates/)
  const afterRace=git(child,'rev-parse','HEAD').toString().trim()
  assert.equal(git(childRemote,'rev-parse','main').toString().trim(),afterRace)
  assert.equal(readFileSync(path.join(child,'knowledge/decisions.md'),'utf8'),'D1 accepted','the other session\'s commit is kept, not overwritten')
  assert.equal(JSON.parse(readFileSync(path.join(root,receiptPath),'utf8')).workspace_commit,afterRace)
  assert.equal(git(root,'status','--porcelain').toString().trim(),'')
  // A remote change INSIDE content/ is a second publication: refused, and nothing of ours is pushed.
  write('workspace/server.mjs','// a third reviewed host change');commit(child)
  writeFileSync(race,otherCommit('content/stray.md','not ours'))
  const refused=await run(false);assert.notEqual(refused.code,0);assert.match(refused.out,/Another publication changed the workspace content/)
  assert.equal(git(childRemote,'rev-parse','main').toString().trim(),git(other,'rev-parse','HEAD').toString().trim(),'the remote holds the other publication, not ours')
  git(child,'fetch','-q','origin');git(child,'reset','-q','--hard','origin/main')
  const canonical=JSON.parse(readFileSync(path.join(child,'content/manifest.json'),'utf8'))
  for(const patch of [{schema:999},{source:{...canonical.source,repository:'https://wrong.example'}},{exported_at:undefined}]){
   write('workspace/content/manifest.json',JSON.stringify({...canonical,...patch}));const bad=commit(child);write(receiptPath,JSON.stringify({...hostReceipt,workspace_commit:bad}));commit(root)
   assert.equal(completedPublication(root),null);assert.throws(()=>publicationSource(root,child),/provenance/)
  }
  assert.equal(existsSync(herokuRan),false,'the publication ran the heroku CLI')
 }finally{await new Promise(resolve=>server.close(resolve))}
})

test('a published source that is not in this history is a new publication, not an error',async()=>{
 // After the repository was re-created with one clean history (2026-09-30), the receipt and the
 // child manifest name a commit this history does not have. That is "Fabric changed", never a crash.
 const {mkdtempSync,mkdirSync,writeFileSync}=await import('node:fs')
 const {sourceChangedSince}=await import('../workspace-release.mjs')
 const root=mkdtempSync(path.join(tmpdir(),'fabric-new-history-'))
 git(root,'init','-q');git(root,'config','user.name','Fixture');git(root,'config','user.email','fixture@example.invalid')
 mkdirSync(path.join(root,'docs/reports'),{recursive:true});writeFileSync(path.join(root,'docs/reports/map.html'),'<h1>Map</h1>')
 git(root,'add','.');git(root,'-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','commit','-qm','root')
 const head=git(root,'rev-parse','HEAD').toString().trim(),gone='f'.repeat(40)
 const child=path.join(root,'workspace');mkdirSync(path.join(child,'content'),{recursive:true})
 writeFileSync(path.join(child,'content/manifest.json'),JSON.stringify({schema:1,source:{repository:'https://github.com/passioncode-ai/fabric',commit:gone},files:[]}))
 assert.equal(publicationSource(root,child),head)
 assert.equal(sourceChangedSince(root,gone),true)
 assert.equal(sourceChangedSince(root,head),false)
})
