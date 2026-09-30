// Reproducible, isolated review of the actual gate. Never writes to its source repo.
// Usage: node scripts/test/check-design-map.test.mjs [repo-root]
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,symlinkSync,rmSync} from 'node:fs'
import {execFileSync,spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import path from 'node:path'
import {tmpdir} from 'node:os'
const sourceRoot=path.resolve(process.argv[2]??path.join(import.meta.dirname,'../..'))
const sourcePath=path.join(sourceRoot,'scripts/check-design-map.mjs')
const source=readFileSync(sourcePath,'utf8')
const root=mkdtempSync(path.join(tmpdir(),'fabric-map-gate-fixture-'))
const write=(p,s)=>{mkdirSync(path.dirname(path.join(root,p)),{recursive:true});writeFileSync(path.join(root,p),s)}
const git=(...args)=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','-c','user.name=Gate fixture','-c','user.email=fixture@example.invalid',...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']})
const run=(refresh=false)=>{const p=spawnSync(process.execPath,['scripts/check-design-map.mjs',...(refresh?['--refresh']:[])],{cwd:root,encoding:'utf8'});return {exit:p.status,stdout:p.stdout.trim(),stderr:p.stderr.trim()}}
write('scripts/check-design-map.mjs',source)
symlinkSync(path.join(sourceRoot,'node_modules'),path.join(root,'node_modules'),'dir')
write('.gitignore','node_modules\n')
write('apps/source.ts','export const revision = 1\n')
write('docs/adr/decision.md','accepted architecture v1\n')
write('docs/evidence/plans/brief.md','execution dependencies v1\n')
git('init','-q');git('add','.');git('commit','-qm','fixture source baseline')
const initial='<html><body><h2 id="changelog">Log</h2><div data-iteration="v1"><a href="#current">review</a></div><section id="current"></section><section id="old"></section></body></html>\n'
write('docs/reports/map.html',initial)
const bootstrap=run(true)
if(bootstrap.exit!==0)throw Error('Bootstrap failed: '+JSON.stringify(bootstrap))
git('add','docs/reports/map.html');git('commit','-qm','fixture committed map')
const tracked=['apps/source.ts','docs/adr/decision.md','docs/evidence/plans/brief.md','docs/reports/map.html']
const original=new Map(tracked.map(p=>[p,readFileSync(path.join(root,p),'utf8')]))
const reset=()=>{for(const [p,s] of original)write(p,s)}
const map=s=>write('docs/reports/map.html',s)
const baseline=original.get('docs/reports/map.html')
const results=[]
const record=(name,expected,action,group='requested')=>{reset();action?.();const actual=run();results.push({name,group,expected_exit:expected===0?0:'nonzero',pass:expected===0?actual.exit===0:actual.exit!==0,...actual})}
record('committed baseline checks successfully',0)
record('ADR-only source mutation refuses unchanged map',1,()=>write('docs/adr/decision.md','accepted architecture v2\n'))
record('execution-brief-only mutation refuses unchanged map',1,()=>write('docs/evidence/plans/brief.md','dependencies v2\n'))
record('previous public anchor removal refuses',1,()=>map(baseline.replace('<section id="old"></section>','')))
for(const q of ['double','single','unquoted'])record('broken internal link with '+q+' attribute refuses',1,()=>map(baseline.replace('</body>',(q==='double'?'<a href="#missing">x</a>':q==='single'?"<a href='#missing'>x</a>":'<a href=#missing>x</a>')+'</body>')))
for(const q of ['single','unquoted'])record('duplicate id with '+q+' attribute refuses',1,()=>map(baseline.replace('</body>',(q==='single'?"<section id='old'></section>":'<section id=old></section>')+'</body>')))
reset();write('apps/source.ts','export const revision = 2\n')
const staleRefresh=run(true)
results.push({name:'source mutation plus refresh with committed iteration refuses',group:'requested',expected_exit:'nonzero',pass:staleRefresh.exit!==0,...staleRefresh})
reset();write('apps/source.ts','export const revision = 2\n')
map(baseline.replace('<div data-iteration="v1">','<div data-iteration="v2"><a href="#current">changed source; review current; remains none</a></div><div data-iteration="v1">'))
for(const [name,refresh] of [['new uncommitted iteration refresh',true],['new iteration check',false],['repeat refresh of same uncommitted iteration',true],['repeat refresh check',false]]){const actual=run(refresh);results.push({name,group:'requested',expected_exit:0,pass:actual.exit===0,...actual})}
write('apps/source.ts','export const revision = 3\n')
for(const [name,refresh] of [['same uncommitted iteration refinement refresh',true],['same iteration refined source check',false]]){const actual=run(refresh);results.push({name,group:'requested',expected_exit:0,pass:actual.exit===0,...actual})}
// Scope-limited parser controls run refresh with a NEW iteration, so the
// changed-iteration check cannot mask a missed anchor/link validation.
const parserCase=(name,expected,mutate)=>{
  reset()
  const fresh=baseline.replace('<div data-iteration="v1">','<div data-iteration="v2"><a href="#current">review</a></div><div data-iteration="v1">')
  map(mutate(fresh))
  const actual=run(true)
  results.push({name,group:'parser-regression',expected_exit:expected===0?0:'nonzero',pass:expected===0?actual.exit===0:actual.exit!==0,...actual})
}
parserCase('valid uppercase HREF to nonexistent anchor refuses',1,s=>s.replace('</body>','<a HREF="#missing">x</a></body>'))
parserCase('quoted greater-than before broken href refuses',1,s=>s.replace('</body>','<a title="a > b" href="#missing">x</a></body>'))
parserCase('valid single-quoted special changelog attributes refresh successfully',0,s=>s.replace('id="changelog"',"id='changelog'").replace('data-iteration="v2"',"data-iteration='v2'"))
// Real directory/link shapes from the independently versioned report workspace.
reset()
const fresh=baseline.replace('<div data-iteration="v1">','<div data-iteration="v3"><a href="#current">publication boundary</a></div><div data-iteration="v1">')
map(fresh);write('workspace/skills/maintaining-fabric-workspace/SKILL.md','host skill')
write('docs/workspace-receipt.json','{"publication":1}')
mkdirSync(path.join(root,'.agents/skills'),{recursive:true})
symlinkSync('../../workspace/skills/maintaining-fabric-workspace',path.join(root,'.agents/skills/maintaining-fabric-workspace'))
for(const [name,refresh] of [['directory submodule projection and skill link refresh',true],['initialized projection checks',false]]){const actual=run(refresh);results.push({name,group:'publication-boundary',pass:actual.exit===0,...actual})}
write('workspace/skills/maintaining-fabric-workspace/SKILL.md','next published skill');write('docs/workspace-receipt.json','{"publication":2}')
{const actual=run();results.push({name:'publication-only output does not stale its own source map',group:'publication-boundary',pass:actual.exit===0,...actual})}
rmSync(path.join(root,'workspace'),{recursive:true})
{const actual=run();results.push({name:'uninitialized submodule keeps symlink fingerprint stable',group:'publication-boundary',pass:actual.exit===0,...actual})}
const requested=results.filter(r=>r.group==='requested')
const report={source:sourcePath,sha256:createHash('sha256').update(source).digest('hex'),fixture_root:root,generated_at:new Date().toISOString(),requested_pass:requested.every(r=>r.pass),requested_count:requested.length,requested_pass_count:requested.filter(r=>r.pass).length,results}
writeFileSync(path.join(root,'result.json'),JSON.stringify(report,null,2)+'\n')
const concise=results.map(r=>`${r.pass?'PASS':'FAIL'} ${r.group}: ${r.name}; exit=${r.exit}${r.pass?'':'\n'+(r.stderr.split('\n').find(s=>s.startsWith('Error:'))??r.stdout)}`).join('\n')+'\n'
writeFileSync(path.join(root,'result.log'),concise)
console.log(JSON.stringify({source:sourcePath,sha256:report.sha256,fixture_root:root,requested_pass:report.requested_pass,requested_pass_count:report.requested_pass_count,requested_count:report.requested_count,total_count:results.length,all_pass:results.every(r=>r.pass)}))
console.log(concise)

process.exitCode=results.every(r=>r.pass)?0:1
