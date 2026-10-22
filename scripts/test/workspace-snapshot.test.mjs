import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {snapshot,writeSnapshot,verifyContent,verifyCommittedSnapshot,checkReceipt,git,receiptPath,digest,sourceSelected,pendingNotice,checkArgs} from '../workspace-snapshot.mjs'
test('the common backlog includes root source registers without exporting hidden configuration',()=>{
 for(const name of ['BACKLOG.md','ROADMAP.md','docs/backlog-sources.json']) assert.equal(sourceSelected(name),true,name)
 for(const name of ['.env','.claude/backlog.json','node_modules/BACKLOG.md','src/tasks.js']) assert.equal(sourceSelected(name),false,name)
})
const write=(root,p,b)=>{mkdirSync(path.dirname(path.join(root,p)),{recursive:true});writeFileSync(path.join(root,p),b)}
function repo(){const root=mkdtempSync(path.join(tmpdir(),'fabric-snapshot-'));git(root,'init','-q');git(root,'config','user.name','Fixture');git(root,'config','user.email','fixture@example.invalid');return root}
function commit(root,msg='fixture'){git(root,'add','.');git(root,'-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','commit','-qm',msg);return git(root,'rev-parse','HEAD').toString().trim()}
function fixture(){const root=repo();write(root,'docs/reports/map.html','<h1>Map</h1>');write(root,'docs/ux/scenarios.md','# Scenario');write(root,'apps/code.js','implementation');write(root,'.env','PRIVATE');const ref=commit(root);return {root,ref}}
test('immutable source snapshot excludes runtime/secrets and ignores dirty working bytes',()=>{
 const {root,ref}=fixture();write(root,'docs/ux/scenarios.md','uncommitted');const s=snapshot(root,ref)
 assert.equal(s.blobs.get('docs/ux/scenarios.md').toString(),'# Scenario');assert.equal(s.blobs.has('.env'),false);assert.equal(s.blobs.has('apps/code.js'),false);assert.equal(s.manifest.content_digest,digest(s.manifest.files))
})
test('symlinks and sensitive paths inside allowed sources fail closed',()=>{
 for(const evil of ['link','secret']){const {root}=fixture();if(evil==='link')symlinkSync('/etc/passwd',path.join(root,'docs/link'));else write(root,'docs/.env','SECRET');commit(root);assert.throws(()=>snapshot(root),/refuses/)}
})
test('git bookkeeping files in a report folder are not documents and do not stop the export; other dotfiles still refuse',()=>{
 // 2026-10-05: raw/.gitkeep and raw/.gitignore in dated report folders reached main and every publish then threw,
 // because the workspace host serves no dot-segment path. They carry no document, so they are left out by name.
 const {root}=fixture();write(root,'docs/reports/r/raw/.gitkeep','');write(root,'docs/reports/r/raw/.gitignore','*.local.log\n');write(root,'docs/reports/r/raw/.gitattributes','* text\n');write(root,'docs/reports/r/raw/probe.json','{}');commit(root)
 const s=snapshot(root);assert.equal(s.blobs.has('docs/reports/r/raw/probe.json'),true)
 for(const p of ['docs/reports/r/raw/.gitkeep','docs/reports/r/raw/.gitignore','docs/reports/r/raw/.gitattributes'])assert.equal(s.blobs.has(p),false,p)
 for(const evil of ['docs/reports/r/.npmrc','docs/.hidden/notes.md','docs/reports/r/.gitkeep.md']){const f=fixture();write(f.root,evil,'x');commit(f.root);assert.throws(()=>snapshot(f.root),/refuses/,evil)}
})
test('export reproduces source, removes obsolete generated entries and detects tampering',()=>{
 const {root,ref}=fixture(),target=repo(),s=snapshot(root,ref);writeSnapshot(target,s);verifyContent(target,s.manifest)
 write(target,'content/docs/obsolete.md','old');assert.throws(()=>verifyContent(target,s.manifest),/does not match/)
 writeSnapshot(target,s);verifyContent(target,s.manifest)
 write(target,'content/docs/ux/scenarios.md','tampered');assert.throws(()=>verifyContent(target,s.manifest),/does not match/)
})
test('export never overwrites an unmanaged content directory',()=>{const {root}=fixture(),target=repo();write(target,'content/human.md','mine');assert.throws(()=>writeSnapshot(target,snapshot(root)),/not owned/);assert.equal(readFileSync(path.join(target,'content/human.md'),'utf8'),'mine')})
test('publication-only pin has no content cycle; later code-only edit invalidates publication',()=>{
 const {root,ref}=fixture(),s=snapshot(root,ref),child=repo();write(child,'README.md','host');const ws=commit(child)
 write(root,receiptPath,JSON.stringify({schema:1,source_commit:ref,workspace_commit:ws,content_digest:s.manifest.content_digest,heroku_app:'fabric-workspace',release:7}))
 mkdirSync(path.join(root,'workspace'));git(root,'update-index','--add','--cacheinfo','160000,'+ws+',workspace');commit(root,'pin')
 assert.equal(checkReceipt(root).source,ref);assert.equal(snapshot(root).manifest.content_digest,s.manifest.content_digest)
 assert.throws(()=>checkReceipt(root,{requireChild:true}),/Initialize/)
 write(root,'apps/code.js','new implementation');commit(root,'product change');assert.throws(()=>checkReceipt(root),/stale/)
})
test('wrong gitlink and false digest cannot pass the receipt check',()=>{
 const {root,ref}=fixture(),s=snapshot(root,ref),ws='a'.repeat(40)
 const r={schema:1,source_commit:ref,workspace_commit:ws,content_digest:s.manifest.content_digest,heroku_app:'fabric-workspace',release:7}
 write(root,receiptPath,JSON.stringify(r));git(root,'update-index','--add','--cacheinfo','160000,'+'b'.repeat(40)+',workspace');commit(root,'wrong pin');assert.throws(()=>checkReceipt(root),/gitlink/)
 r.content_digest='0'.repeat(64);write(root,receiptPath,JSON.stringify(r));commit(root);assert.throws(()=>checkReceipt(root),/digest/)
})
test('mutable source refs and incomplete deployment receipts fail before source comparison',()=>{
 const {root,ref}=fixture(),s=snapshot(root,ref)
 const valid={schema:1,source_commit:ref,workspace_commit:'a'.repeat(40),content_digest:s.manifest.content_digest,heroku_app:'fabric-workspace',release:7}
 for(const patch of [{source_commit:'HEAD'},{release:undefined},{heroku_app:undefined},{release:0},{release:'v7'},{content_digest:'wrong'}]){
  write(root,receiptPath,JSON.stringify({...valid,...patch}));assert.throws(()=>checkReceipt(root),/Invalid workspace receipt/)
 }
})
test('an App Platform receipt names its app and deployment; a Heroku receipt stays valid only as history',()=>{
 const APP='3283cfc0-7d5f-498b-8dac-cab351ab4409',DEP='af85ca04-1dcf-45a4-b1a7-7e0585bb413c'
 const {root}=fixture();write(root,'workspace.config.json',JSON.stringify({do_app:APP}));const ref=commit(root,'config')
 const s=snapshot(root,ref),child=repo();write(child,'README.md','host');const ws=commit(child)
 const valid={schema:1,source_commit:ref,workspace_commit:ws,content_digest:s.manifest.content_digest,platform:'digitalocean',do_app:APP,deployment:DEP}
 mkdirSync(path.join(root,'workspace'));git(root,'update-index','--add','--cacheinfo','160000,'+ws+',workspace')
 write(root,receiptPath,JSON.stringify(valid));commit(root,'pin');assert.equal(checkReceipt(root).source,ref)
 // A Heroku receipt left from before the move still checks while the configuration names no Heroku app.
 write(root,receiptPath,JSON.stringify({schema:1,source_commit:ref,workspace_commit:ws,content_digest:s.manifest.content_digest,heroku_app:'passioncode-fabric-workspace',release:169}));commit(root,'legacy');assert.equal(checkReceipt(root).source,ref)
 write(root,receiptPath,JSON.stringify({...valid,do_app:'139b640c-4d2f-42ef-9be4-dbe6f4267c0f'}));commit(root,'other app');assert.throws(()=>checkReceipt(root),/different App Platform app/)
 for(const patch of [{deployment:'v12'},{deployment:undefined},{do_app:'passioncode-fabric-workspace'},{platform:'heroku'},{heroku_app:'passioncode-fabric-workspace'},{release:169}]){
  write(root,receiptPath,JSON.stringify({...valid,...patch}));assert.throws(()=>checkReceipt(root),/Invalid workspace receipt/,JSON.stringify(patch))
 }
})
test('ignored historical logs cannot disappear between local validation and the published Git commit',()=>{
 const {root}=fixture();write(root,'docs/audit/proof.log','historical evidence');commit(root)
 const target=repo();write(target,'.gitignore','*.log\n');writeSnapshot(target,snapshot(root));commit(target)
 assert.throws(()=>verifyCommittedSnapshot(target),/omits manifest file/)
 git(target,'add','--force','content/docs/audit/proof.log');commit(target);assert.equal(verifyCommittedSnapshot(target).files.some(f=>f.path==='docs/audit/proof.log'),true)
})
test('committed snapshot verification preserves Unicode paths instead of Git display quoting',()=>{
 const {root}=fixture();write(root,'docs/заметки проекта.md','Проверяемые данные');commit(root)
 const target=repo();writeSnapshot(target,snapshot(root));commit(target)
 assert.equal(verifyCommittedSnapshot(target).files.some(f=>f.path==='docs/заметки проекта.md'),true)
})
// #region workspace-pending-tests — docs: docs/architecture/report-workspace.md#a-pending-publication-on-a-push
// By the publication contract a source commit is stale until the pin commit follows it (the scheduled sync, every
// 2 h), so a strict check on every push was red on every source push to main (runs 39565129315, 39592566608,
// 39699805184) and a broken publication looked exactly like the expected wait. `allowPendingHours` tells them apart.
function pendingFixture(){
 const {root,ref}=fixture(),s=snapshot(root,ref),child=repo();write(child,'README.md','host');const ws=commit(child)
 write(root,receiptPath,JSON.stringify({schema:1,source_commit:ref,workspace_commit:ws,content_digest:s.manifest.content_digest,heroku_app:'fabric-workspace',release:7}))
 mkdirSync(path.join(root,'workspace'));git(root,'update-index','--add','--cacheinfo','160000,'+ws+',workspace');commit(root,'pin')
 write(root,'apps/code.js','new implementation');commit(root,'source change after the publication')
 const head=Date.parse(git(root,'show','-s','--format=%cI','HEAD').toString().trim())
 return {root,ref,ws,head}
}
const HOUR=3600_000
test('a stale but valid receipt is a pending publication inside the window and overdue past it',()=>{
 const {root,ref,head}=pendingFixture()
 assert.throws(()=>checkReceipt(root),/stale/,'the strict check is unchanged')
 const r=checkReceipt(root,{allowPendingHours:6,now:head+HOUR})
 assert.equal(r.source,ref);assert.equal(r.pending.window_hours,6);assert.equal(r.pending.age_hours,1);assert.deepEqual(r.pending.changes,['apps/code.js'])
 assert.match(pendingNotice(r),/^::notice title=Workspace publication pending::/m)
 assert.throws(()=>checkReceipt(root,{allowPendingHours:6,now:head+7*HOUR}),/overdue/)
 // A current publication carries no pending block.
 const fresh=fixture(),s=snapshot(fresh.root,fresh.ref),child=repo();write(child,'README.md','host');const ws=commit(child)
 write(fresh.root,receiptPath,JSON.stringify({schema:1,source_commit:fresh.ref,workspace_commit:ws,content_digest:s.manifest.content_digest,heroku_app:'fabric-workspace',release:7}))
 mkdirSync(path.join(fresh.root,'workspace'));git(fresh.root,'update-index','--add','--cacheinfo','160000,'+ws+',workspace');commit(fresh.root,'pin')
 assert.equal(checkReceipt(fresh.root,{allowPendingHours:6}).pending,undefined)
})
test('the pending window never covers a broken receipt: a tampered digest, a wrong pin, a foreign source or a dirty tree',()=>{
 {const {root,ref,ws,head}=pendingFixture(),r=JSON.parse(readFileSync(path.join(root,receiptPath),'utf8'))
  r.content_digest='0'.repeat(64);write(root,receiptPath,JSON.stringify(r));commit(root,'tampered')
  assert.throws(()=>checkReceipt(root,{allowPendingHours:6,now:head+HOUR}),/digest/)
  assert.ok(ref&&ws)}
 {const {root,head}=pendingFixture()
  git(root,'update-index','--add','--cacheinfo','160000,'+'b'.repeat(40)+',workspace');commit(root,'wrong pin')
  assert.throws(()=>checkReceipt(root,{allowPendingHours:6,now:head+HOUR}),/gitlink/)}
 {const {root,head}=pendingFixture(),other=fixture(),r=JSON.parse(readFileSync(path.join(root,receiptPath),'utf8'))
  // A commit with the same documents that HEAD does not contain: valid digest, not this history's publication.
  git(root,'fetch','-q',other.root,other.ref);r.source_commit=other.ref;write(root,receiptPath,JSON.stringify(r));commit(root,'foreign receipt')
  assert.throws(()=>checkReceipt(root,{allowPendingHours:6,now:head+HOUR}),/not an ancestor/)}
 {const {root,head}=pendingFixture();write(root,'apps/code.js','uncommitted')
  assert.throws(()=>checkReceipt(root,{allowPendingHours:6,now:head+HOUR}),/stale/)}
})
test('check options: --allow-pending takes hours (6 by default) and never combines with the strict --require-child',()=>{
 assert.deepEqual(checkArgs([]),{requireChild:false,allowPendingHours:null})
 assert.deepEqual(checkArgs(['--require-child']),{requireChild:true,allowPendingHours:null})
 assert.deepEqual(checkArgs(['--allow-pending']),{requireChild:false,allowPendingHours:6})
 assert.deepEqual(checkArgs(['--allow-pending','12']),{requireChild:false,allowPendingHours:12})
 for(const bad of [['--allow-pending','-1'],['--allow-pending','soon'],['--allow-pending','6','--require-child'],['--strict']])assert.throws(()=>checkArgs(bad),/check/,JSON.stringify(bad))
})
// #endregion workspace-pending-tests
