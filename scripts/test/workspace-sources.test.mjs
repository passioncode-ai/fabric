// Fabric Workspace as the wiki of every tool (agent-registry plan AR-0.5). Besides Fabric's own
// documents, the snapshot carries other PassionCode.ai repositories under repos/<id>/, each pinned
// to its own commit. These tests hold the exporter, the receipt and the lag check to that contract.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {snapshot,writeSnapshot,checkReceipt,git,receiptPath,digest,sourceSelected,receiptFor} from '../workspace-snapshot.mjs'
import {lagReport,sourcePins} from '../workspace-sources.mjs'

const write=(root,p,b)=>{mkdirSync(path.dirname(path.join(root,p)),{recursive:true});writeFileSync(path.join(root,p),b)}
function repo(){const root=mkdtempSync(path.join(tmpdir(),'fabric-sources-'));git(root,'init','-q');git(root,'config','user.name','Fixture');git(root,'config','user.email','fixture@example.invalid');return root}
function commit(root,msg='fixture',date){const env=date?{...process.env,GIT_COMMITTER_DATE:date,GIT_AUTHOR_DATE:date}:process.env;git(root,'add','.');execGit(root,env,'-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','commit','-qm',msg);return git(root,'rev-parse','HEAD').toString().trim()}
const execGit=(root,env,...args)=>execFileSync('git',args,{cwd:root,env})
function fabric(){const root=repo();write(root,'docs/reports/map.html','<h1>Map</h1>');write(root,'README.md','# Fabric');return {root,ref:commit(root)}}
function tool(files={'README.md':'# Fabric Agent Adapter','AGENTS.md':'rules','docs/guide.md':'guide','plugins/x/skills/y/SKILL.md':'skill','src/index.js':'code','.env':'PRIVATE'}){const dir=repo();for(const [p,b] of Object.entries(files))write(dir,p,b);return {dir,ref:commit(dir)}}
const adapter=(t,extra={})=>({id:'fabric-agent-adapter',repository:'https://github.com/passioncode-ai/fabric-agent-adapter',dir:t.dir,commit:t.ref,...extra})

test('a source lands under repos/<id>/ with documentation only, pinned to its own commit',()=>{
 const f=fabric(),t=tool(),s=snapshot(f.root,f.ref,{sources:[adapter(t)]})
 const paths=s.manifest.files.map(x=>x.path)
 for(const p of ['repos/fabric-agent-adapter/README.md','repos/fabric-agent-adapter/AGENTS.md','repos/fabric-agent-adapter/docs/guide.md','repos/fabric-agent-adapter/plugins/x/skills/y/SKILL.md'])assert.ok(paths.includes(p),p)
 assert.equal(paths.some(p=>p.endsWith('src/index.js')||p.endsWith('.env')),false)
 assert.deepEqual(s.manifest.sources,[{id:'fabric-agent-adapter',repository:'https://github.com/passioncode-ai/fabric-agent-adapter',commit:t.ref,exported_at:git(t.dir,'show','-s','--format=%cI',t.ref).toString().trim()}])
 assert.equal(s.manifest.content_digest,digest(s.manifest.files))
 assert.deepEqual(paths,[...paths].sort((a,b)=>a<b?-1:a>b?1:0))
})

test('without sources the manifest stays byte-identical to the single-source shape',()=>{
 const f=fabric(),plain=snapshot(f.root,f.ref),empty=snapshot(f.root,f.ref,{sources:[]})
 assert.equal(JSON.stringify(empty.manifest),JSON.stringify(plain.manifest))
 assert.equal('sources' in plain.manifest,false)
})

test('a source refuses a sensitive or non-regular file, a foreign repository, a bad id, a moving ref and an empty selection',()=>{
 const f=fabric()
 assert.throws(()=>snapshot(f.root,f.ref,{sources:[adapter(tool({'README.md':'x','docs/secrets/key.md':'SECRET'}))]}),/refuses sensitive/)
 assert.equal(snapshot(f.root,f.ref,{sources:[adapter(tool({'README.md':'x','docs/.env':'SECRET'}))]}).manifest.files.some(x=>x.path.includes('.env')),false)
 const linked=tool();execFileSync('ln',['-s','/etc/passwd',path.join(linked.dir,'docs/link.md')]);const lref=commit(linked.dir)
 assert.throws(()=>snapshot(f.root,f.ref,{sources:[adapter({dir:linked.dir,ref:lref})]}),/non-regular/)
 const t=tool()
 assert.throws(()=>snapshot(f.root,f.ref,{sources:[adapter(t,{repository:'https://github.com/attacker/fabric-agent-adapter'})]}),/Invalid workspace source/)
 assert.throws(()=>snapshot(f.root,f.ref,{sources:[adapter(t,{id:'../x'})]}),/Invalid workspace source/)
 assert.throws(()=>snapshot(f.root,f.ref,{sources:[adapter(t,{commit:'main'})]}),/Invalid workspace source/)
 assert.throws(()=>snapshot(f.root,f.ref,{sources:[adapter(t),adapter(t)]}),/Invalid workspace source/)
 assert.throws(()=>snapshot(f.root,f.ref,{sources:[adapter(tool({'src/a.js':'x'}))]}),/selects no documents/)
})

test('the organization defaults repository is exported under a plain folder name',()=>{
 const f=fabric(),t=tool({'CONTRIBUTING.md':'# Contributing','profile/README.md':'# Profile'})
 const s=snapshot(f.root,f.ref,{sources:[{id:'org-github',repository:'https://github.com/passioncode-ai/.github',dir:t.dir,commit:t.ref}]})
 assert.ok(s.manifest.files.some(x=>x.path==='repos/org-github/CONTRIBUTING.md'))
 assert.ok(s.manifest.files.some(x=>x.path==='repos/org-github/profile/README.md'))
})

test('the source selection keeps entry documents, docs, schemas and skills, and nothing else',()=>{
 for(const p of ['README.md','README.ru.md','AGENTS.md','CONTEXT.md','CONTRIBUTING.md','RULES.md','ONBOARDING.md','SECURITY.md','CHANGELOG.md','repositories.json','docs/a/b.md','profile/README.md','schemas/x.json','plugins/p/skills/s/SKILL.md','SKILL.md'])assert.equal(sourceSelected(p),true,p)
 for(const p of ['src/index.ts','package.json','CLAUDE.md','test/docs/x.md','.github/workflows/ci.yml','plugins/p/skills/s/scripts/run.py','docs/.gitkeep','docs/ux/.docpaths-allow','docs/.hidden/a.md'])assert.equal(sourceSelected(p),false,p)
})

test('a path the workspace host cannot serve fails the export instead of the deployment',()=>{
 const f=fabric()
 assert.throws(()=>snapshot(f.root,f.ref,{sources:[adapter(tool({'README.md':'x','docs/50%.md':'y'}))]}),/host cannot serve/)
 write(f.root,'docs/a:b.md','colon');const ref=commit(f.root)
 assert.throws(()=>snapshot(f.root,ref),/host cannot serve/)
})

test('the receipt pins every source; the check verifies Fabric alone without clones and everything with them',()=>{
 const f=fabric(),t=tool(),src=[adapter(t)],s=snapshot(f.root,f.ref,{sources:src}),child=repo()
 writeSnapshot(child,s);const ws=commit(child,'publish')
 const r=receiptFor(s,{workspace_commit:ws,heroku_app:'fabric-workspace',release:7})
 assert.deepEqual(r.sources,[{id:'fabric-agent-adapter',repository:'https://github.com/passioncode-ai/fabric-agent-adapter',commit:t.ref,files_digest:digest(s.manifest.files.filter(x=>x.path.startsWith('repos/fabric-agent-adapter/')))}])
 assert.equal(r.fabric_digest,digest(s.manifest.files.filter(x=>!x.path.startsWith('repos/'))))
 write(f.root,receiptPath,JSON.stringify(r));mkdirSync(path.join(f.root,'workspace'));git(f.root,'update-index','--add','--cacheinfo','160000,'+ws+',workspace');commit(f.root,'pin')
 const dirs={'fabric-agent-adapter':t.dir}
 assert.equal(checkReceipt(f.root,{sourceDirs:dirs}).sources,'recomputed')
 assert.equal(checkReceipt(f.root,{sourceDirs:{}}).sources,'pinned; not recomputed without a local clone')
 const lied={...r,sources:[{...r.sources[0],files_digest:'0'.repeat(64)}]};write(f.root,receiptPath,JSON.stringify(lied));commit(f.root,'lie')
 assert.throws(()=>checkReceipt(f.root,{sourceDirs:dirs}),/source digest mismatch/)
 const noFabric={...r,fabric_digest:'0'.repeat(64)};write(f.root,receiptPath,JSON.stringify(noFabric));commit(f.root,'lie2')
 assert.throws(()=>checkReceipt(f.root,{sourceDirs:{}}),/digest mismatch/)
 for(const bad of [{sources:[{id:'x',commit:'main',files_digest:'0'.repeat(64)}]},{sources:[{...r.sources[0]}],fabric_digest:undefined}]){write(f.root,receiptPath,JSON.stringify({...r,...bad}));assert.throws(()=>checkReceipt(f.root),/Invalid workspace receipt/)}
})

test('sourcePins turns configuration into pins and refuses what the host would refuse',()=>{
 assert.deepEqual(sourcePins({sources:[{id:'org-github',repository:'https://github.com/passioncode-ai/.github'}]}).map(x=>x.id),['org-github'])
 assert.deepEqual(sourcePins({}),[])
 assert.throws(()=>sourcePins({sources:[{id:'a',repository:'https://gitlab.com/passioncode-ai/a'}]}),/Invalid workspace source/)
})

test('lag: current, within grace, stale, diverged, unpublished and unreachable are told apart',()=>{
 const t=tool(),pin=t.ref
 write(t.dir,'docs/new.md','new');const next=commit(t.dir,'new doc','2026-09-28T00:00:00Z')
 const now=Date.parse('2026-09-29T12:00:00Z'),tipOf=id=>({dir:t.dir,tip:id==='gone'?null:next})
 const rows=lagReport({pins:[{id:'current',commit:next},{id:'late',commit:pin}],configured:['current','late','fresh'],resolve:tipOf,now,graceHours:48})
 assert.deepEqual(rows.map(r=>[r.id,r.state]),[['current','current'],['late','within-grace'],['fresh','unpublished']])
 const stale=lagReport({pins:[{id:'late',commit:pin}],configured:['late'],resolve:tipOf,now,graceHours:24})
 assert.equal(stale[0].state,'stale');assert.equal(stale[0].behind,1)
 const other=tool({'README.md':'# rewritten history'});const diverged=lagReport({pins:[{id:'late',commit:other.ref}],configured:['late'],resolve:tipOf,now,graceHours:24})
 assert.equal(diverged[0].state,'diverged')
 const gone=lagReport({pins:[{id:'gone',commit:pin}],configured:['gone'],resolve:tipOf,now,graceHours:24})
 assert.equal(gone[0].state,'unreachable')
})

test('sync publishes when a source is behind, the host moved or Fabric changed, and only then',async()=>{
 const {syncReasons}=await import('../workspace-sources.mjs')
 const current=[{id:'a',state:'current'},{id:'b',state:'within-grace'}]
 assert.deepEqual(syncReasons({lag:current,hostAhead:0,sourceChanged:false}),[])
 assert.deepEqual(syncReasons({lag:[...current,{id:'c',state:'stale'}],hostAhead:0,sourceChanged:false}),['source c is stale'])
 assert.deepEqual(syncReasons({lag:[{id:'d',state:'unpublished'},{id:'e',state:'diverged'}],hostAhead:0,sourceChanged:false}),['source d is unpublished','source e is diverged'])
 assert.deepEqual(syncReasons({lag:current,hostAhead:2,sourceChanged:false}),['the workspace host is 2 commit(s) ahead of its pin (knowledge base or host)'])
 assert.deepEqual(syncReasons({lag:current,hostAhead:0,sourceChanged:true}),['Fabric changed since the published source'])
 // An unreadable source is not a reason to publish over it: nothing is known about it.
 assert.deepEqual(syncReasons({lag:[{id:'f',state:'unreachable'}],hostAhead:0,sourceChanged:false}),[])
})

test('sync drops only its own unfinished publication, never anything else',async()=>{
 const {syncLeftovers}=await import('../workspace-sources.mjs')
 // A publication that failed after writing the receipt leaves exactly these two paths behind.
 assert.deepEqual(syncLeftovers('M  docs/workspace-receipt.json\nM  workspace\n'),{discard:['docs/workspace-receipt.json','workspace'],refuse:[]})
 assert.deepEqual(syncLeftovers(' M workspace\n'),{discard:['workspace'],refuse:[]})
 assert.deepEqual(syncLeftovers(''),{discard:[],refuse:[]})
 // Anything else is someone's change: refuse and touch nothing.
 assert.deepEqual(syncLeftovers('M  docs/workspace-receipt.json\n M README.md\n'),{discard:['docs/workspace-receipt.json'],refuse:['README.md']})
})
