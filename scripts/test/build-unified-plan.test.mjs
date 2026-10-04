// #region unified-compiler-tests — docs: docs/handoffs/2026-10-04-unified-canonical-recompile.md#checks-and-integration
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'

const owner = fileURLToPath(new URL('../..',import.meta.url))
const input = 'docs/reports/2026-10-04-unified-execution'
const output = 'docs/reports/2026-10-04-unified-compiler-fixture'
function fixture(run) {
  const root=mkdtempSync(join(tmpdir(),'fabric-unified-compiler-'))
  const parser=join(owner,'workspace')
  const copy = path => {mkdirSync(dirname(join(root,path)),{recursive:true});copyFileSync(join(owner,path),join(root,path))}
  const oldPlan=JSON.parse(readFileSync(join(owner,input,'plan.json'),'utf8'))
  const paths=new Set([...oldPlan.sources.map(s=>s.path),'docs/backlog-sources.json','docs/adr/0101-the-general-development-plan.md',`${input}/checks/execution.json`,`${input}/impacts.json`,
    ...oldPlan.tasks.filter(t=>t.evidence).map(t=>t.evidence.path),
    ...['release','start-adoption','agents-memory','reach-horizon'].map(name=>`${input}/packets/${name}.json`),
    'scripts/build-unified-plan.py','scripts/unified-plan.mjs','scripts/unified-canonical-sources.mjs'])
  const manifest=JSON.parse(readFileSync(join(owner,'docs/backlog-sources.json'),'utf8'))
  for(const source of manifest.sources)paths.add(source.path)
  for(const path of paths)copy(path)
  if(process.env.FABRIC_COMPILER_TEST_BASELINE)copyFileSync(process.env.FABRIC_COMPILER_TEST_BASELINE,join(root,'scripts/build-unified-plan.py'))
  const com='docs/evidence/compiler-fixture-com.md'
  writeFileSync(join(root,com),'## Canonical communication task status\n\n| ID | Packet | Priority | Depends on | Status |\n|---|---|---|---|---|\n'+Array.from({length:14},(_,i)=>`| COM-${String(i+1).padStart(2,'0')} | example-agent packet ${i+1} | P0 | ${i?'COM-'+String(i).padStart(2,'0'):'Hub convergence'} | open |`).join('\n')+'\n')
  manifest.sources.push({path:com,goal:'agent-workplace',kind:'tasks',format:'table',idColumn:'ID',titleColumn:'Packet',statusColumn:'Status',heading:'Canonical communication task status'})
  writeFileSync(join(root,'docs/backlog-sources.json'),JSON.stringify(manifest))
  writeFileSync(join(root,input,'plan.json'),'historical input cut must remain unchanged\n')
  const parserCommit=execFileSync('git',['-C',parser,'rev-parse','HEAD'],{encoding:'utf8'}).trim()
  execFileSync('git',['clone','--shared','--no-checkout','--quiet',parser,join(root,'workspace')],{stdio:'pipe'})
  execFileSync('git',['-C',join(root,'workspace'),'sparse-checkout','init','--cone'],{stdio:'pipe'})
  execFileSync('git',['-C',join(root,'workspace'),'sparse-checkout','set','lib'],{stdio:'pipe'})
  execFileSync('git',['-C',join(root,'workspace'),'checkout','--quiet',parserCommit],{stdio:'pipe'})
  const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:['ignore','pipe','pipe']}).toString().trim()
  git('init','-q');git('add','docs','scripts')
  git('update-index','--add','--cacheinfo',`160000,${parserCommit},workspace`)
  const commit=()=>{git('add','--','.',':(exclude)workspace',':(exclude)privacy.local.json');git('add','-f','--',...paths);git('-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','compiler fixture');return git('rev-parse','HEAD')}
  let revision=commit()
  const deny=join(root,'privacy.local.json');writeFileSync(deny,'[]')
  const compile=(extra=[])=>spawnSync('python3',['scripts/build-unified-plan.py','--output',output,'--source-revision',revision,'--privacy-deny-file',deny,...extra],{cwd:root,encoding:'utf8'})
  const check=()=>spawnSync('node',['scripts/unified-plan.mjs','--report',output,'check','--privacy-deny-file',deny],{cwd:root,encoding:'utf8'})
  const api={root,com,output,deny,compile,check,commit:()=>{revision=commit();return revision},get revision(){return revision}}
  try{run(api)}finally{rmSync(root,{recursive:true,force:true})}
}
test('real research inputs compile all manifest sources, keep 14 COM rows held and preserve the dated input',t=>fixture(f=>{
  const result=f.compile();assert.equal(result.status,0,result.stderr)
  assert.equal(readFileSync(join(f.root,input,'plan.json'),'utf8'),'historical input cut must remain unchanged\n','compiler must preserve the historical input cut')
  const plan=JSON.parse(readFileSync(join(f.root,output,'plan.json'),'utf8'))
  assert.equal(plan.baseline,f.revision)
  assert.equal(plan.canonical_inventory.tasks.filter(t=>t.path===f.com).length,14)
  for(const row of plan.canonical_inventory.tasks)assert(plan.tasks.some(t=>t.canonical_keys.includes(row.key)),row.key)
  for(const source of plan.canonical_inventory.sources)assert(plan.sources.some(s=>s.path===source.path&&s.commit===f.revision&&s.sha256===source.sha256))
  assert(plan.sources.every(s=>s.commit===f.revision))
  const cold=JSON.parse(readFileSync(join(f.root,output,'cold-packets/N-001.json'),'utf8'))
  assert.equal(cold.source_revision,f.revision);assert.equal(cold.dispatch,'design-gated')
  assert(cold.inputs.every(s=>s.commit===f.revision))
  const audit=JSON.parse(readFileSync(join(f.root,output,'audit-graph.json'),'utf8'))
  assert(audit.nodes.every(n=>n.check.includes('--report '+output)))
  assert.equal(plan.research_source_revision,'41f994a709990ad72621fa834768a8833e7d93e1')
  for(const id of ['UP-01','P-08.preflight','N1.metadata','CO-179.prepare']) {
    const task=plan.tasks.find(t=>t.id===id)
    assert.equal(task.dispatch,'design-gated',id);assert.equal(task.historical_dispatch,'done',id)
    assert(task.historical_evidence.source_revision);assert(task.historical_evidence.scope)
  }
  assert(plan.tasks.filter(t=>t.canonical_ids.some(id=>/^COM-/.test(id))).every(t=>t.dispatch==='owned-elsewhere'))
  assert.equal(readFileSync(join(f.root,input,'plan.json'),'utf8'),'historical input cut must remain unchanged\n')
  assert.equal(f.check().status,0,f.check().stderr)
  const next=spawnSync('node',['scripts/unified-plan.mjs','--report',output,'next'],{cwd:f.root,encoding:'utf8'})
  assert.equal(next.status,0,next.stderr)
  const frontier=JSON.parse(next.stdout);assert.equal(frontier.ready.length,0);assert(!frontier.ready.some(t=>/^COM-/.test(t.id)))
  t.diagnostic(JSON.stringify({canonical_rows:plan.canonical_inventory.tasks.length,COM_rows:plan.canonical_inventory.tasks.filter(t=>t.path===f.com).length,source_pins:plan.sources.length,derived_records:plan.tasks.length,ready:frontier.ready.length}))
  plan.tasks=plan.tasks.filter(t=>!t.canonical_ids.includes('COM-14'))
  writeFileSync(join(f.root,output,'plan.json'),JSON.stringify(plan))
  assert.match(f.check().stderr,/uncovered canonical task: COM-14/)
}))
test('a changed canonical source cannot be assigned the old immutable revision',()=>fixture(f=>{
  writeFileSync(join(f.root,f.com),readFileSync(join(f.root,f.com),'utf8').replace('example-agent packet 1','Changed source packet'))
  const result=f.compile();assert.notEqual(result.status,0);assert.match(result.stderr,/uncommitted|differs from source revision/)
  assert(!existsSync(join(f.root,output,'plan.json')))
}))
test('private input sentinel is refused before writing and never echoed into diagnostics',()=>fixture(f=>{
  const packet=join(f.root,input,'packets/release.json')
  const data=JSON.parse(readFileSync(packet,'utf8'));data.tasks[0].context.risks.push('PRIVATE_INPUT_SENTINEL')
  writeFileSync(packet,JSON.stringify(data));f.commit();writeFileSync(f.deny,JSON.stringify(['PRIVATE_INPUT_SENTINEL']))
  const result=f.compile();assert.notEqual(result.status,0);assert.match(result.stderr,/Private input refused/i)
  assert(!result.stderr.includes('PRIVATE_INPUT_SENTINEL'));assert(!existsSync(join(f.root,output,'plan.json')))
}))
test('private metadata remains in its owning source and cannot be copied through a full research packet',()=>fixture(f=>{
  const packet=join(f.root,input,'packets/agents-memory.json')
  const data=JSON.parse(readFileSync(packet,'utf8'));data.private_context={visibility:'private',notes:'Owner-only material'}
  writeFileSync(packet,JSON.stringify(data));f.commit()
  const result=f.compile();assert.notEqual(result.status,0);assert.match(result.stderr,/Private metadata refused/i)
  assert(!existsSync(join(f.root,output,'plan.json')))
}))
test('recompilation refuses to overwrite an existing cut or the historical input directory',()=>fixture(f=>{
  mkdirSync(join(f.root,output),{recursive:true});writeFileSync(join(f.root,output,'plan.json'),'preserve existing cut')
  const result=f.compile();assert.notEqual(result.status,0);assert.match(result.stderr,/Refusing to overwrite/)
  assert.equal(readFileSync(join(f.root,output,'plan.json'),'utf8'),'preserve existing cut')
  const historical=f.compile(['--output',input]);assert.notEqual(historical.status,0);assert.equal(readFileSync(join(f.root,input,'plan.json'),'utf8'),'historical input cut must remain unchanged\n')
}))
test('missing or locally changed pinned common parser stops compilation',()=>fixture(f=>{
  const parser=join(f.root,'workspace/lib/backlog.mjs')
  writeFileSync(parser,readFileSync(parser,'utf8')+'\n// changed parser fixture\n')
  const changed=f.compile();assert.notEqual(changed.status,0);assert.match(changed.stderr,/parser has uncommitted changes/)
  assert(!existsSync(join(f.root,output,'plan.json')))
  rmSync(join(f.root,'workspace'),{recursive:true,force:true})
  const missing=f.compile();assert.notEqual(missing.status,0);assert.match(missing.stderr,/submodule update --init workspace/)
  assert(!existsSync(join(f.root,output,'plan.json')))
}))
test('production parity refuses authority forgeries across every dispatching CLI verb',()=>fixture(f=>{
  const compile=f.compile();assert.equal(compile.status,0,compile.stderr)
  const file=join(f.root,output,'plan.json'),original=JSON.parse(readFileSync(file,'utf8'))
  const mutants=[
    ['historical-proof-repromoted-done',p=>{p.tasks.find(t=>t.id==='UP-01').dispatch='done'}],
    ['historical-proof-rebound-to-current',p=>{const t=p.tasks.find(t=>t.id==='UP-01');t.dispatch='done';t.evidence.source_revision=f.revision;t.evidence.scope='Current release acceptance'}],
    ['historical-proof-repromoted-candidate',p=>{const t=p.tasks.find(t=>t.id==='UP-01');t.id='UP-01.prepare';t.kind='design-review';t.dispatch='candidate'}],
    ['historical-markers-deleted',p=>{for(const t of p.tasks){delete t.historical_dispatch;delete t.historical_evidence;delete t.context.research_provenance}delete p.research_source_revision;delete p.reconciliation}],
    ['dependency-payload-relabelled',p=>{const t=p.tasks.find(t=>t.depends_on.length);t.depends_on[0].carries='Forged owner authority'}],
    ['bounded-scope-relabelled',p=>{p.tasks[0].context.scope=['docs/forged-owner-acceptance.json']}],
  ]
  for(const [name,mutate]of mutants){
    const forged=structuredClone(original);mutate(forged);writeFileSync(file,JSON.stringify(forged))
    for(const args of [['check'],['next'],['packet','UP-01'],['impacts','UP-01']]){
      const r=spawnSync('node',['scripts/unified-plan.mjs','--report',output,...args],{cwd:f.root,encoding:'utf8'})
      assert.notEqual(r.status,0,name+' '+args.join(' '));assert.match(r.stderr,/compiled graph differs from committed inputs/,name);assert.equal(r.stdout,'',name)
    }
  }
  writeFileSync(file,JSON.stringify(original));assert.equal(f.check().status,0,f.check().stderr)
}))
test('emit-plan reconstructs exact production graph without writing or overwriting any cut',()=>fixture(f=>{
  assert.equal(f.compile().status,0)
  const original=readFileSync(join(f.root,output,'plan.json'),'utf8'),historical=readFileSync(join(f.root,input,'plan.json'),'utf8')
  const snapshot=()=>{
    const files=[]
    const walk=dir=>{for(const entry of readdirSync(join(f.root,dir),{withFileTypes:true})){
      if(entry.name==='.git')continue
      const path=join(dir,entry.name)
      if(entry.isDirectory())walk(path)
      else if(entry.isFile())files.push([path,createHash('sha256').update(readFileSync(join(f.root,path))).digest('hex')])
    }}
    walk('');return files.sort((a,b)=>a[0].localeCompare(b[0],'en'))
  }
  const before=snapshot()
  for(const selected of [output,input,'docs/reports/never-created']){
    const r=spawnSync('python3',['scripts/build-unified-plan.py','--emit-plan','--source-revision',f.revision,'--output',selected,'--privacy-deny-file',f.deny],{cwd:f.root,encoding:'utf8',maxBuffer:32*1024*1024})
    assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),JSON.parse(original))
  }
  assert.equal(readFileSync(join(f.root,output,'plan.json'),'utf8'),original)
  assert.equal(readFileSync(join(f.root,input,'plan.json'),'utf8'),historical)
  assert(!existsSync(join(f.root,'docs/reports/never-created')))
  assert.deepEqual(snapshot(),before,'emit-plan must not create, remove or modify repository files')
}))
// #endregion unified-compiler-tests
