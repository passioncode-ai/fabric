// #region unified-compiler-tests — docs: docs/handoffs/2026-10-04-unified-canonical-recompile.md#checks-and-integration
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, existsSync, readdirSync, symlinkSync } from 'node:fs'
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
  const parser=process.env.FABRIC_COMPILER_TEST_WORKSPACE || join(owner,'workspace')
  const copy = path => {mkdirSync(dirname(join(root,path)),{recursive:true});copyFileSync(join(owner,path),join(root,path))}
  const oldPlan=JSON.parse(readFileSync(join(owner,input,'plan.json'),'utf8'))
  const paths=new Set([...oldPlan.sources.map(s=>s.path),'docs/backlog-sources.json','docs/adr/0101-the-general-development-plan.md',`${input}/checks/execution.json`,`${input}/impacts.json`,
    ...oldPlan.tasks.filter(t=>t.evidence).map(t=>t.evidence.path),
    ...['release','start-adoption','agents-memory','reach-horizon'].map(name=>`${input}/packets/${name}.json`),
    'scripts/build-unified-plan.py','scripts/unified-plan.mjs','scripts/unified-canonical-sources.mjs','AGENTS.md'])
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
test('JSON-escaped private literals are refused in decoded plan before any publication bytes exist',()=>fixture(f=>{
  const packet=join(f.root,input,'packets/agents-memory.json')
  const data=JSON.parse(readFileSync(packet,'utf8'))
  const rows=data.tasks ?? data.packets
  rows[0].constraints_and_failure_modes=['PRIVATE_DECODED_SENTINEL']
  writeFileSync(packet,JSON.stringify(data).replaceAll('PRIVATE_DECODED_SENTINEL','\\u0050RIVATE_DECODED_SENTINEL'))
  f.commit();writeFileSync(f.deny,JSON.stringify(['PRIVATE_DECODED_SENTINEL']))
  const result=f.compile();assert.notEqual(result.status,0);assert.match(result.stderr,/Private generated plan refused/)
  assert(!result.stderr.includes('PRIVATE_DECODED_SENTINEL'));assert(!existsSync(join(f.root,output)))
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
const reconciliationPath='docs/evidence/plans/unified-current-reconciliation.json'
function ownerSource(f) {
  const basis=f.revision
  const inventory=spawnSync('node',['scripts/unified-plan.mjs','inventory','--source-revision',basis],{cwd:f.root,encoding:'utf8'})
  assert.equal(inventory.status,0,inventory.stderr)
  const rows=JSON.parse(inventory.stdout).tasks
  const row=rows.find(t=>t.id==='P-08')
  assert(row)
  const ref=path=>({path,revision:basis,sha256:createHash('sha256').update(readFileSync(join(f.root,path))).digest('hex')})
  const packet={id:'P-08.qualify-source',canonical_key:row.key,related_canonical_keys:[],basis_revision:basis,
    basis_sources:[row.path,'scripts/unified-plan.mjs'].map(ref),operation:'qualification',title:'Qualify bounded example-agent source work',
    context:{outcome:'Assemble and qualify current bounded source work without accepting its parent',sources:[row.path,'scripts/unified-plan.mjs'],scope:['scripts/unified-plan.mjs'],steps:['Read source','Run exact owned checks'],acceptance:['Record exact-source scoped results and unresolved gates'],risks:['Historical receipt is not current acceptance'],stop_conditions:['Stop before release or live changes'],resume:'Read current pinned source and scoped receipts'},
    output_scope:['docs/handoffs/example-agent-qualification'],rollback:'Discard only task-owned isolated changes',authority:{kind:'source-owner-bounded-work',repository:'https://github.com/passioncode-ai/fabric',actions:['code','check','commit','push'],standing:ref('AGENTS.md'),requested_source:ref(row.path)},
    dependencies:[{kind:'source-input',purpose:'Current owner source',ref:ref(row.path)}],acceptance_gates:[{id:'P-08.parent',requirement:'Native/full/independent/human release gates remain separate',required_for:'parent-acceptance'}],
    impact_scope:JSON.parse(readFileSync(join(f.root,input,'impacts.json'),'utf8')).filter(i=>i.severity==='blocking'&&i.disposition==='open'&&i.targets.includes('P-08')).map(i=>({id:i.id,effect:'parent-acceptance-only',reason:'Qualification is work to investigate this gate; parent stays open',source:ref(input+'/impacts.json')}))}
  return {schema:'unified-owner-reconciliation/1',repository:'https://github.com/passioncode-ai/fabric',packets:[packet]}
}
function publishOwner(f,source) {
  writeFileSync(join(f.root,reconciliationPath),JSON.stringify(source));f.commit()
}
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
test('committed owner qualification activates only its bounded leaf and keeps parent impacts open',()=>fixture(f=>{
  const source=ownerSource(f);publishOwner(f,source)
  const result=f.compile();assert.equal(result.status,0,result.stderr);assert.equal(f.check().status,0,f.check().stderr)
  const plan=JSON.parse(readFileSync(join(f.root,output,'plan.json'),'utf8'))
  assert.equal(plan.owner_reconciliation.path,reconciliationPath);assert.equal(plan.owner_reconciliation.commit,f.revision)
  assert(plan.sources.some(s=>s.path===reconciliationPath&&s.commit===f.revision))
  const task=plan.tasks.find(t=>t.id==='P-08.qualify-source');assert.equal(task.dispatch,'candidate')
  const next=spawnSync('node',['scripts/unified-plan.mjs','--report',output,'next'],{cwd:f.root,encoding:'utf8'})
  assert.equal(next.status,0,next.stderr);assert.deepEqual(JSON.parse(next.stdout).ready.map(t=>t.id),['P-08.qualify-source'])
  assert(plan.tasks.filter(t=>t.historical_dispatch).every(t=>t.dispatch==='design-gated'))
  assert(task.preparation_only_impacts.length>0)
  for(const id of task.preparation_only_impacts)assert.equal(plan.impacts.find(i=>i.id===id).disposition,'open')
  const graph=JSON.parse(readFileSync(join(f.root,output,'audit-graph.json'),'utf8'))
  const node=graph.nodes.find(n=>n.title===task.title)
  const cold=JSON.parse(readFileSync(join(f.root,output,'cold-packets',node.id+'.json'),'utf8'))
  assert.deepEqual(cold.source_scope.edit_targets,[...source.packets[0].context.scope,...source.packets[0].output_scope])
  assert.deepEqual(cold.source_scope.input_targets,source.packets[0].context.scope);assert.deepEqual(cold.source_scope.new_output_targets,source.packets[0].output_scope)
}))
test('existing directory scope cannot hide a changed descendant from basis byte contracts',()=>fixture(f=>{
  const path='docs/example-subject/model.js';mkdirSync(dirname(join(f.root,path)),{recursive:true});writeFileSync(join(f.root,path),'export const revision = 1\n');f.commit()
  const source=ownerSource(f);source.packets[0].context.scope=['docs/example-subject']
  writeFileSync(join(f.root,path),'export const revision = 2\n');f.commit();publishOwner(f,source)
  const result=f.compile();assert.notEqual(result.status,0,'changed committed directory child must not become runnable');assert(!existsSync(join(f.root,output,'plan.json')))
}))
test('complete immutable existing directory inventory qualifies only with every descendant byte contract',()=>fixture(f=>{
  const paths=['docs/example-subject/model.js','docs/example-subject/nested/schema.json'];for(const path of paths){mkdirSync(dirname(join(f.root,path)),{recursive:true});writeFileSync(join(f.root,path),'{}\n')}f.commit()
  const source=ownerSource(f),packet=source.packets[0];packet.context.scope=['docs/example-subject']
  for(const path of paths)packet.basis_sources.push({path,revision:packet.basis_revision,sha256:createHash('sha256').update(readFileSync(join(f.root,path))).digest('hex')})
  publishOwner(f,source);const result=f.compile();assert.equal(result.status,0,result.stderr);assert.equal(f.check().status,0,f.check().stderr)
  const plan=JSON.parse(readFileSync(join(f.root,output,'plan.json'),'utf8'));for(const path of paths)assert(plan.sources.some(s=>s.path===path))
  const packetView=spawnSync('node',['scripts/unified-plan.mjs','--report',output,'packet',packet.id],{cwd:f.root,encoding:'utf8'});assert.equal(packetView.status,0,packetView.stderr)
  const view=JSON.parse(packetView.stdout);for(const path of paths)assert(view.source_pins.some(s=>s.path===path))
  const graph=JSON.parse(readFileSync(join(f.root,output,'audit-graph.json'),'utf8'));const node=graph.nodes.find(n=>n.title===packet.title)
  const cold=JSON.parse(readFileSync(join(f.root,output,'cold-packets',node.id+'.json'),'utf8'));for(const path of paths)assert(cold.inputs.some(s=>s.address===path&&s.commit===f.revision))
  const next=spawnSync('node',['scripts/unified-plan.mjs','--report',output,'next'],{cwd:f.root,encoding:'utf8'});assert.equal(next.status,0,next.stderr);assert.deepEqual(JSON.parse(next.stdout).ready.map(t=>t.id),[packet.id])
}))
test('directory inventory rejects deleted added untracked hidden linked nonregular and excessive descendants',()=>{
  for(const mutation of ['delete','add','untracked','ignored','hidden','link','fifo','type-change','bound'])fixture(f=>{
    const path='docs/example-subject/model.js';mkdirSync(dirname(join(f.root,path)),{recursive:true});writeFileSync(join(f.root,path),'{}\n');f.commit()
    const source=ownerSource(f),packet=source.packets[0];packet.context.scope=['docs/example-subject'];packet.basis_sources.push({path,revision:packet.basis_revision,sha256:createHash('sha256').update(readFileSync(join(f.root,path))).digest('hex')})
    if(mutation==='delete')rmSync(join(f.root,path))
    if(mutation==='add'||mutation==='untracked')writeFileSync(join(f.root,'docs/example-subject/extra.js'),'{}\n')
    if(mutation==='ignored'){writeFileSync(join(f.root,'.gitignore'),'docs/example-subject/ignored.js\n');writeFileSync(join(f.root,'docs/example-subject/ignored.js'),'{}\n')}
    if(mutation==='type-change'){rmSync(join(f.root,path));mkdirSync(join(f.root,path));writeFileSync(join(f.root,path,'nested.js'),'{}\n')}
    if(mutation==='hidden')writeFileSync(join(f.root,'docs/example-subject/.hidden'),'{}\n')
    if(mutation==='link')symlinkSync(join(f.root,'scripts/unified-plan.mjs'),join(f.root,'docs/example-subject/linked.js'))
    if(mutation==='fifo')execFileSync('mkfifo',[join(f.root,'docs/example-subject/pipe')])
    if(mutation==='bound')for(let i=0;i<1025;i++)writeFileSync(join(f.root,'docs/example-subject/extra-'+i),'{}\n')
    if(mutation==='untracked'){writeFileSync(join(f.root,reconciliationPath),JSON.stringify(source));f.commit();writeFileSync(join(f.root,'docs/example-subject/untracked.js'),'{}\n')}
    else publishOwner(f,source)
    const result=f.compile();assert.notEqual(result.status,0,mutation);assert(!existsSync(join(f.root,output,'plan.json')),mutation)
  })
})
test('new outputs require explicit absent nonoverlapping source-safe paths',()=>{
  for(const mutation of ['implicit','existing-file','existing-directory','old-deleted','overlap','output-overlap','linked-parent','file-parent','historical-file-parent','glob'])fixture(f=>{
    let source=ownerSource(f),packet=source.packets[0]
    if(mutation==='implicit'){packet.context.scope.push('docs/example-new-input');packet.output_scope=[]}
    if(mutation==='existing-file')packet.output_scope=['scripts/unified-plan.mjs']
    if(mutation==='existing-directory')packet.output_scope=['docs/evidence']
    if(mutation==='old-deleted'){const path='docs/example-deleted-output.json';writeFileSync(join(f.root,path),'{}\n');f.commit();source=ownerSource(f);packet=source.packets[0];rmSync(join(f.root,path));packet.output_scope=[path]}
    if(mutation==='overlap')packet.output_scope=['scripts/unified-plan.mjs/extra']
    if(mutation==='output-overlap')packet.output_scope=['docs/example-new-output','docs/example-new-output/nested']
    if(mutation==='linked-parent'){symlinkSync(join(f.root,'docs/evidence'),join(f.root,'docs/example-link'));packet.output_scope=['docs/example-link/new']}
    if(mutation==='file-parent')packet.output_scope=['AGENTS.md/new']
    if(mutation==='historical-file-parent'){const path='docs/example-old-parent';writeFileSync(join(f.root,path),'{}\n');f.commit();source=ownerSource(f);packet=source.packets[0];rmSync(join(f.root,path));mkdirSync(join(f.root,path));packet.output_scope=[path+'/new-output']}
    if(mutation==='glob')packet.output_scope=['docs/example-output/*']
    publishOwner(f,source);const result=f.compile();assert.notEqual(result.status,0,mutation);assert(!existsSync(join(f.root,output,'plan.json')),mutation)
  })
})
test('missing or NOT_RUN scoped acceptance holds only the bounded owner packet',()=>fixture(f=>{
  const source=ownerSource(f);source.packets[0].dependencies.push({kind:'scoped-acceptance',subject_key:source.packets[0].canonical_key,scope:'native same-build',proof_tier:'native',receipt:null});publishOwner(f,source)
  assert.equal(f.compile().status,0);assert.equal(f.check().status,0)
  let plan=JSON.parse(readFileSync(join(f.root,output,'plan.json'),'utf8'))
  assert.equal(plan.tasks.find(t=>t.id==='P-08.qualify-source').dispatch,'design-gated')
  rmSync(join(f.root,output),{recursive:true,force:true})
  const path='docs/handoffs/fixture-native-receipt.json',packet=source.packets[0]
  mkdirSync(dirname(join(f.root,path)),{recursive:true})
  writeFileSync(join(f.root,path),JSON.stringify({schema:'unified-scoped-receipt/1',repository:source.repository,subject_key:packet.canonical_key,basis_revision:packet.basis_revision,scope:'native same-build',proof_tier:'native',result:'NOT_RUN'}))
  const revision=f.commit();packet.dependencies.at(-1).receipt={path,revision,sha256:createHash('sha256').update(readFileSync(join(f.root,path))).digest('hex')};publishOwner(f,source)
  assert.equal(f.compile().status,0);assert.equal(f.check().status,0)
  plan=JSON.parse(readFileSync(join(f.root,output,'plan.json'),'utf8'));assert.equal(plan.tasks.find(t=>t.id===packet.id).dispatch,'design-gated')
  assert.match(plan.tasks.find(t=>t.id===packet.id).context.owner_holds.join(' '),/NOT_RUN/)
  rmSync(join(f.root,output),{recursive:true,force:true})
  const accepted=JSON.parse(readFileSync(join(f.root,path),'utf8'));accepted.result='PASS';writeFileSync(join(f.root,path),JSON.stringify(accepted))
  const acceptedRevision=f.commit();packet.dependencies.at(-1).receipt={path,revision:acceptedRevision,sha256:createHash('sha256').update(readFileSync(join(f.root,path))).digest('hex')};publishOwner(f,source)
  assert.equal(f.compile().status,0);assert.equal(f.check().status,0)
  plan=JSON.parse(readFileSync(join(f.root,output,'plan.json'),'utf8'));assert.equal(plan.tasks.find(t=>t.id===packet.id).dispatch,'candidate');assert(plan.tasks.every(t=>t.dispatch!=='done'))
}))
test('owner source refuses forged identity, done state, receipt, release authority and impact scope',()=>fixture(f=>{
  const original=ownerSource(f)
  const mutants=[
    ['cross-owner',p=>p.canonical_key=p.canonical_key.replace('/fabric:','/other-owner:')],
    ['renamed-owner',p=>p.id='CO-179.qualify-source'],
    ['done',p=>p.status='done'],
    ['forged-byte-contract',p=>p.basis_sources[0].sha256='f'.repeat(64)],
    ['release-grant',p=>p.authority.actions.push('release')],
    ['global-impact-clear',p=>p.impact_scope[0].effect='resolved'],
    ['forged-impact-digest',p=>p.impact_scope[0].source.sha256='f'.repeat(64)],
  ]
  for(const [name,mutate]of mutants){const bad=structuredClone(original);mutate(bad.packets[0]);publishOwner(f,bad);const result=f.compile();assert.notEqual(result.status,0,name);assert(!existsSync(join(f.root,output,'plan.json')),name)}
}))
test('derived owner packet, applicability or done mutations cannot bypass deterministic parity',()=>fixture(f=>{
  const source=ownerSource(f);publishOwner(f,source);assert.equal(f.compile().status,0)
  const file=join(f.root,output,'plan.json'),original=JSON.parse(readFileSync(file,'utf8'))
  for(const mutate of [p=>delete p.owner_reconciliation,p=>p.sources=p.sources.filter(s=>s.path!==reconciliationPath),p=>p.tasks.find(t=>t.id==='P-08.qualify-source').preparation_only_impacts.push('NEW-IMPACT'),p=>{const t=p.tasks.find(t=>t.id==='P-08.qualify-source');t.dispatch='done';t.evidence={path:input+'/checks/execution.json',sha256:createHash('sha256').update(readFileSync(join(f.root,input,'checks/execution.json'))).digest('hex')}},p=>p.tasks=p.tasks.filter(t=>t.id!=='P-08.qualify-source')]){
    const forged=structuredClone(original);mutate(forged);writeFileSync(file,JSON.stringify(forged));const check=f.check();assert.notEqual(check.status,0);assert.equal(check.stdout,'')
  }
  writeFileSync(file,JSON.stringify(original));rmSync(join(f.root,reconciliationPath))
  const missing=f.check();assert.notEqual(missing.status,0);assert.match(missing.stderr,/source missing|reconciliation source missing|source unreadable/i)
}))
test('changed impact or subject bytes and dirty owner source cannot retain old qualification authority',()=>fixture(f=>{
  const source=ownerSource(f);publishOwner(f,source)
  const file=join(f.root,reconciliationPath);writeFileSync(file,readFileSync(file,'utf8')+' ')
  let result=f.compile();assert.notEqual(result.status,0);assert.match(result.stderr,/Dirty or forged reconciliation/)
  writeFileSync(file,JSON.stringify(source))
  const impact=join(f.root,input,'impacts.json'),originalImpact=readFileSync(impact,'utf8');writeFileSync(impact,originalImpact+'\n')
  f.commit();result=f.compile();assert.notEqual(result.status,0);assert.match(result.stderr,/Dirty or forged reconciliation/)
  writeFileSync(impact,originalImpact)
  const subject=join(f.root,'scripts/unified-plan.mjs');writeFileSync(subject,readFileSync(subject,'utf8')+'\n// changed subject byte contract\n')
  f.commit();result=f.compile();assert.notEqual(result.status,0);assert.match(result.stderr,/Dirty or forged reconciliation/)
}))
test('new blocking impact remains blocking without an exact owner applicability decision',()=>fixture(f=>{
  const path=join(f.root,input,'impacts.json'),impacts=JSON.parse(readFileSync(path,'utf8'))
  impacts.push({id:'I-new',targets:['P-08'],severity:'blocking',disposition:'open',evidence:'New current source observation',action:'Owner must investigate new scope'})
  writeFileSync(path,JSON.stringify(impacts));f.commit()
  const source=ownerSource(f);source.packets[0].impact_scope=source.packets[0].impact_scope.filter(i=>i.id!=='I-new');publishOwner(f,source)
  const c=f.compile();assert.equal(c.status,0,c.stderr);assert.equal(f.check().status,0,f.check().stderr)
  const next=spawnSync('node',['scripts/unified-plan.mjs','--report',output,'next'],{cwd:f.root,encoding:'utf8'})
  assert.equal(next.status,0,next.stderr);const frontier=JSON.parse(next.stdout);assert.equal(frontier.ready.length,0)
  assert(frontier.held.find(t=>t.id==='P-08.qualify-source').reasons.includes('impact I-new'))
}))
test('a pinned scoped receipt cannot substitute historical basis, foreign owner or current scope',()=>fixture(f=>{
  const original=ownerSource(f),path='docs/evidence/fixture-scoped-receipt.json',packet=original.packets[0]
  for(const change of [r=>r.basis_revision='a'.repeat(40),r=>r.repository='https://github.com/example/other-owner',r=>r.scope='Different operation',r=>r.proof_tier='focused']){
    const receipt={schema:'unified-scoped-receipt/1',repository:original.repository,subject_key:packet.canonical_key,basis_revision:packet.basis_revision,scope:'Native same-build',proof_tier:'native',result:'PASS'}
    change(receipt);writeFileSync(join(f.root,path),JSON.stringify(receipt));const rev=f.commit()
    const source=structuredClone(original);source.packets[0].dependencies.push({kind:'scoped-acceptance',subject_key:packet.canonical_key,scope:'Native same-build',proof_tier:'native',receipt:{path,revision:rev,sha256:createHash('sha256').update(readFileSync(join(f.root,path))).digest('hex')}});publishOwner(f,source)
    const c=f.compile();assert.notEqual(c.status,0);assert.match(c.stderr,/forged subject, basis, scope or proof tier/);assert(!existsSync(join(f.root,output,'plan.json')))
  }
}))
test('published descendant content retains pinned parser identity; unrelated workspace history is refused',()=>fixture(f=>{
  const parser=join(f.root,'workspace')
  const git=(...args)=>execFileSync('git',args,{cwd:parser,stdio:['ignore','pipe','pipe']}).toString().trim()
  const pin=git('rev-parse','HEAD')
  writeFileSync(join(parser,'lib/publication-fixture.md'),'New publication content, unchanged parser.\n')
  git('add','lib/publication-fixture.md')
  git('-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','content publication')
  assert.notEqual(git('rev-parse','HEAD'),pin)
  const result=f.compile();assert.equal(result.status,0,result.stderr)
  const plan=JSON.parse(readFileSync(join(f.root,output,'plan.json'),'utf8'))
  assert.equal(plan.canonical_inventory.parser.commit,pin)
  assert.equal(f.check().status,0,f.check().stderr)
  git('checkout','--orphan','unrelated-fixture')
  git('-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','unrelated history, identical parser bytes')
  const refused=f.check();assert.notEqual(refused.status,0);assert.match(refused.stderr,/not a descendant/)
}))
// #endregion unified-compiler-tests
