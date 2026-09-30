import {test} from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {once} from 'node:events'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,chmodSync,rmSync,existsSync} from 'node:fs'
import path from 'node:path'
import {tmpdir} from 'node:os'
import {validateDeployedVersion,completedPublication,publicationSource} from '../workspace-release.mjs'
import {git,snapshot,writeSnapshot,receiptPath} from '../workspace-snapshot.mjs'

test('healthy old source/build/release and pending releases cannot certify publication',()=>{
 const expected={source_commit:'a'.repeat(40),workspace_commit:'b'.repeat(40),content_digest:'c'.repeat(64)}
 const version={source:{repository:'https://github.com/passioncode-ai/fabric',commit:expected.source_commit},content_digest:expected.content_digest,deployment:{workspace_commit:expected.workspace_commit,release:'v12'}}
 const release={version:12,status:'succeeded',current:true}
 assert.equal(validateDeployedVersion(version,expected,release),12)
 for(const other of [{...version,source:{commit:'d'.repeat(40)}},{...version,content_digest:'d'.repeat(64)},{...version,deployment:{...version.deployment,workspace_commit:'d'.repeat(40)}},{...version,deployment:{...version.deployment,release:'v11'}},{...version,deployment:null}])assert.throws(()=>validateDeployedVersion(other,expected,release),/identity/)
 // A tool repository pinned at another commit is another publication, even with Fabric identical.
 const pin={id:'fabric-agent-adapter',commit:'e'.repeat(40)},withSources={...expected,sources:[pin]}
 assert.equal(validateDeployedVersion({...version,sources:[{...pin,repository:'https://github.com/passioncode-ai/fabric-agent-adapter'}]},withSources,release),12)
 for(const sources of [undefined,[],[{...pin,commit:'f'.repeat(40)}]])assert.throws(()=>validateDeployedVersion({...version,sources},withSources,release),/identity/)
 for(const other of [{...release,status:'pending'},{...release,current:false},{...release,version:13}])assert.throws(()=>validateDeployedVersion(version,expected,other))
})

test('actual publisher resumes a failed parent push without creating a second snapshot or commit',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'fabric-release-fixture-'))
 const write=(p,s)=>{mkdirSync(path.dirname(path.join(root,p)),{recursive:true});writeFileSync(path.join(root,p),s)}
 const commit=dir=>{git(dir,'add','.');git(dir,'-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','commit','-qm','fixture');return git(dir,'rev-parse','HEAD').toString().trim()}
 const init=dir=>{mkdirSync(dir,{recursive:true});git(dir,'init','-q');git(dir,'config','user.name','Fixture');git(dir,'config','user.email','fixture@example.invalid')}
 let served
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/version.json'&&!req.headers.authorization){res.writeHead(401);return res.end('{}')}res.end(JSON.stringify(req.url==='/healthz'?{ok:true}:served))})
 server.listen(0,'127.0.0.1');await once(server,'listening')
 try{
  init(root);write('docs/reports/map.html','<h1>Source map</h1>')
  // Host/Fabric suites are verified separately; this fixture exercises the real
  // publisher state machine and real local Git pushes, with external checks stubbed.
  write('scripts/ci.sh','#!/bin/sh\nmkdir -p fake-bin && touch fake-bin/ci-ran\nexit 0\n')
  for(const file of ['workspace.mjs','workspace-snapshot.mjs','workspace-release.mjs','workspace-sources.mjs'])write('scripts/'+file,readFileSync(path.join(import.meta.dirname,'..',file)))
  write('.gitignore','fake-bin/\n');write('workspace.config.json',JSON.stringify({heroku_app:'fabric-workspace',public_origin:'http://127.0.0.1:'+server.address().port}))
  const source=commit(root),s=snapshot(root,source),child=path.join(root,'workspace');init(child);writeSnapshot(child,s);const ws=commit(child)
  write(receiptPath,JSON.stringify({schema:1,source_commit:source,workspace_commit:ws,content_digest:s.manifest.content_digest,heroku_app:'fabric-workspace',release:12}))
  const parent=commit(root)
  served={source:{repository:'https://github.com/passioncode-ai/fabric',commit:source},content_digest:s.manifest.content_digest,deployment:{workspace_commit:ws,release:'v12'}}
  assert.equal(completedPublication(root).source_commit,source);assert.equal(publicationSource(root,child),source)
  write('fake-bin/heroku',`#!/usr/bin/env node\nconst a=process.argv.slice(2);if(a[0]==='config:get')console.log(a[1]==='WORKSPACE_USER'?'fixture':'fixture-test-password');else console.log(JSON.stringify({status:'succeeded',current:true,version:12}));\n`);chmodSync(path.join(root,'fake-bin/heroku'),0o755)
  write('fake-bin/npm','#!/bin/sh\nexit 0\n');chmodSync(path.join(root,'fake-bin/npm'),0o755)
  const run=(resume=true)=>new Promise(resolve=>{const p=spawn(process.execPath,['scripts/workspace.mjs','publish',...(resume?['--resume']:[])],{cwd:root,env:{...process.env,PATH:path.join(root,'fake-bin')+path.delimiter+process.env.PATH}});let out='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>out+=b);p.on('close',code=>resolve({code,out}))})
  git(root,'remote','add','origin',path.join(root,'nonexistent-remote'))
  const failed=await run();assert.notEqual(failed.code,0);assert.equal(git(root,'rev-parse','HEAD').toString().trim(),parent)
  const remote=mkdtempSync(path.join(tmpdir(),'fabric-release-remote-'));git(remote,'init','--bare','-q');git(root,'remote','set-url','origin',remote)
  const passed=await run();assert.equal(passed.code,0,passed.out);assert.match(passed.out,/already published/)
  assert.equal(git(root,'rev-parse','HEAD').toString().trim(),parent);assert.equal(git(child,'rev-parse','HEAD').toString().trim(),ws)
  assert.equal(git(root,'status','--porcelain').toString().trim(),'')
  const childRemote=mkdtempSync(path.join(tmpdir(),'fabric-child-remote-')),heroku=mkdtempSync(path.join(tmpdir(),'fabric-heroku-remote-'))
  git(childRemote,'init','--bare','-q');git(heroku,'init','--bare','-q');git(child,'branch','-M','main');git(child,'remote','add','origin',childRemote);git(child,'push','origin','main')
  write('workspace/server.mjs','// reviewed host-only change');const host=commit(child);assert.equal(completedPublication(root),null);assert.equal(publicationSource(root,child),source)
  // A child without its Heroku remote stops before the long gates run, naming the fix.
  const ran=path.join(root,'fake-bin/ci-ran');rmSync(ran,{force:true})
  const noHeroku=await run(false);assert.notEqual(noHeroku.code,0);assert.match(noHeroku.out,/no heroku remote/);assert.equal(existsSync(ran),false,'the gates ran before the missing remote was noticed')
  git(child,'remote','add','heroku',heroku)
  served.deployment.workspace_commit=host
  const hostPublished=await run(false);assert.equal(hostPublished.code,0,hostPublished.out)
  const hostReceipt=JSON.parse(readFileSync(path.join(root,receiptPath),'utf8'));assert.equal(hostReceipt.source_commit,source);assert.equal(hostReceipt.workspace_commit,host);assert.equal(git(child,'rev-parse','HEAD').toString().trim(),host)
  assert.equal(git(root,'status','--porcelain').toString().trim(),'')
  const canonical=JSON.parse(readFileSync(path.join(child,'content/manifest.json'),'utf8'))
  for(const patch of [{schema:999},{source:{...canonical.source,repository:'https://wrong.example'}},{exported_at:undefined}]){
   write('workspace/content/manifest.json',JSON.stringify({...canonical,...patch}));const bad=commit(child);write(receiptPath,JSON.stringify({...hostReceipt,workspace_commit:bad}));commit(root)
   assert.equal(completedPublication(root),null);assert.throws(()=>publicationSource(root,child),/provenance/)
  }
 }finally{await new Promise(resolve=>server.close(resolve))}
})
