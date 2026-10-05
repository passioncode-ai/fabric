import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {snapshot,writeSnapshot,verifyContent,verifyCommittedSnapshot,checkReceipt,git,receiptPath,digest,sourceSelected} from '../workspace-snapshot.mjs'
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
