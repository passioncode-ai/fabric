// Independent neutral fixture replay; production compiler and exact pinned parser are reused.
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,rmSync,existsSync,symlinkSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,dirname,resolve} from 'node:path'
import {execFileSync,spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const owner=resolve('.'),cut='docs/reports/2026-10-04-unified-execution',out='docs/reports/review-neutral-cut'
const sha=b=>createHash('sha256').update(b).digest('hex')
const results=[]
const root=mkdtempSync(join(tmpdir(),'fabric-independent-compiler-'))
const put=(path,bytes)=>{mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),typeof bytes==='string'?bytes:JSON.stringify(bytes,null,2)+'\n')}
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const run=(program,args)=>{const r=spawnSync(program,args,{cwd:root,encoding:'utf8'});return {exit:r.status,stdout:r.stdout,stderr:r.stderr}}
const record=(name,observed,expected,detail)=>results.push({name,observed,expected,matched:JSON.stringify(observed)===JSON.stringify(expected),detail})
try {
 for(const path of ['scripts/build-unified-plan.py','scripts/unified-plan.mjs','scripts/unified-canonical-sources.mjs']){mkdirSync(dirname(join(root,path)),{recursive:true});copyFileSync(join(owner,path),join(root,path))}
 if(process.env.COMPILER_CONTROL_REVISION)writeFileSync(join(root,'scripts/build-unified-plan.py'),execFileSync('git',['show',process.env.COMPILER_CONTROL_REVISION+':scripts/build-unified-plan.py'],{cwd:owner}));
 const pinned=execFileSync('git',['ls-tree','HEAD','workspace'],{cwd:owner,encoding:'utf8'}).match(/commit ([a-f0-9]{40})/)[1]
 execFileSync('git',['clone','--shared','--no-checkout','--quiet',join(owner,'workspace'),join(root,'workspace')],{stdio:'pipe'})
 execFileSync('git',['-C',join(root,'workspace'),'sparse-checkout','init','--cone'],{stdio:'pipe'})
 execFileSync('git',['-C',join(root,'workspace'),'sparse-checkout','set','lib'],{stdio:'pipe'})
 execFileSync('git',['-C',join(root,'workspace'),'checkout','--quiet',pinned],{stdio:'pipe'})
 const table=rows=>'| ID | Packet | Status |\n|---|---|---|\n'+rows.map(([id,title])=>`| ${id} | ${title} | open |`).join('\n')+'\n'
 put('docs/evidence/backlog.md','<!-- general-plan:begin -->\n| 1 · Example | outcome | none | P-01 |\n<!-- general-plan:end -->\n\n'+table([['P-01','Example-agent canonical parent']]))
 put('docs/evidence/communication.md',table(Array.from({length:14},(_,i)=>['COM-'+String(i+1).padStart(2,'0'),'Example-agent communication packet '+(i+1)])))
 put('docs/evidence/second-owner.md',table([['COM-01','Independent owner identity']]))
 const declaration=path=>({path,goal:'agent-workplace',kind:'tasks',format:'table',idColumn:'ID',titleColumn:'Packet',statusColumn:'Status'})
 put('docs/backlog-sources.json',{schema:1,repository:'https://github.com/passioncode-ai/fabric',sources:['docs/evidence/backlog.md','docs/evidence/communication.md','docs/evidence/second-owner.md' ].map(declaration)})
 put('AGENTS.md','Example-agent source-only standing instructions. No release or live authority.\n');put('docs/ux/vision.md','Example-agent vision.\n');put('docs/adr/0101-the-general-development-plan.md','Example source authority.\n')
 const ctx={outcome:'One bounded example-agent outcome',sources:['docs/evidence/backlog.md'],scope:['docs/example-agent.json'],steps:['Read exact source'],acceptance:['Source-bound check'],risks:['Historical proof scope'],stop_conditions:['Hold until reviewed'],resume:'Reconcile exact source'}
 put(cut+'/checks/execution.json',{source_revision:'a'.repeat(40),scope:'Historical lint only',status:'PASS',live_admission:'NOT_RUN'})
 put(cut+'/packets/release.json',{tasks:[{id:'UP-01',canonical_ids:['P-01'],lane:1,title:'Example inherited done',kind:'implementation',dispatch:'done',priority_group:0,depends_on:[],context:ctx}]})
 put(cut+'/packets/start-adoption.json',{tasks:[{id:'P-01.parent',canonical_id:'P-01',lane:1,title:'Example held parent',canonical_sources:['docs/evidence/backlog.md'],file_scope:['docs/example-agent.json'],implementation_steps:['Read owner'],definition_of_done:['Independent bounded review']}]})
 put(cut+'/packets/agents-memory.json',{tasks:[]});put(cut+'/packets/reach-horizon.json',{tasks:[],horizon_coverage:[]});put(cut+'/impacts.json',[]);put(cut+'/plan.json','Historical cut must not change.\n');put('privacy.local.json',[])
 put('docs/example-subject/a.js','export const value = 1\n');put('docs/example-subject/b.js','export const value = 2\n');put('docs/evidence/dependency.md','Example-agent dependency material.\n');put('.gitignore','docs/example-subject/ignored.js\n');git('init','-q');git('add','docs','scripts','AGENTS.md','.gitignore');git('update-index','--add','--cacheinfo',`160000,${pinned},workspace`);git('-c','user.name=Independent Fixture','-c','user.email=fixture@example.test','commit','-qm','neutral committed fixture')
 let revision=git('rev-parse','HEAD')
 const compile=()=>run('python3',['scripts/build-unified-plan.py','--output',out,'--source-revision',revision,'--privacy-deny-file','privacy.local.json'])
 const check=()=>run('node',['scripts/unified-plan.mjs','--report',out,'check'])
 const recon='docs/evidence/plans/unified-current-reconciliation.json'
 const foundation=revision, models=['docs/example-subject/a.js','docs/example-subject/b.js']
 const clear=()=>rmSync(join(root,out),{recursive:true,force:true})
 const commit=(paths=['docs','scripts','AGENTS.md'])=>{git('add',...paths);git('-c','user.name=Independent Fixture','-c','user.email=fixture@example.test','commit','-qm','neutral owner input');revision=git('rev-parse','HEAD');return revision}
 const reset=()=>{rmSync(join(root,'docs'),{recursive:true,force:true});git('reset','--hard',foundation);git('clean','-fdx');put('privacy.local.json',[]);revision=foundation}
 const inventory=()=>JSON.parse(run('node',['scripts/unified-plan.mjs','inventory','--source-revision',revision]).stdout)
 const row=inventory().tasks.find(t=>t.id==='P-01')
 const old=process.env.COMPILER_CONTROL_REVISION==='537ca82d90e7bb814a907209cb303bbed8633e1e'
 const make=()=>{
  const basis=revision,ref=path=>({path,revision:basis,sha256:sha(readFileSync(join(root,path)))})
  const packet={id:'P-01.qualify-source',canonical_key:row.key,related_canonical_keys:[],basis_revision:basis,basis_sources:['AGENTS.md',row.path,'scripts/unified-plan.mjs',...models].map(ref),operation:'qualification',title:'Example-agent bounded qualification',context:{...ctx,sources:[row.path,'scripts/unified-plan.mjs'],scope:['docs/example-subject']},output_scope:['docs/example-agent-new-receipts'],rollback:'Discard only task-owned isolated changes',authority:{kind:'source-owner-bounded-work',repository:'https://github.com/passioncode-ai/fabric',actions:['code','check','commit','push'],standing:ref('AGENTS.md'),requested_source:ref(row.path)},dependencies:[{kind:'source-input',purpose:'Bounded source input only',ref:ref('docs/evidence/dependency.md')}],acceptance_gates:[{id:'P-01.parent',requirement:'Native/full/release gates remain separate',required_for:'parent-acceptance'}],impact_scope:[]}
  return {schema:'unified-owner-reconciliation/1',repository:'https://github.com/passioncode-ai/fabric',packets:[packet]}
 }
 const publish=s=>{if(old){s=structuredClone(s);for(const p of s.packets){p.context.scope.push(...(p.output_scope??[]));delete p.output_scope}}put(recon,s);commit([recon]);clear()}
 const refusal=(name,c)=>record(name,[c.exit!==0,existsSync(join(root,out,'plan.json'))],[true,false],c)
 const next=()=>run('node',['scripts/unified-plan.mjs','--report',out,'next'])
 const scenario=(name,mutate)=>{reset();const s=make();mutate(s);publish(s);refusal(name,compile())}
 reset();let source=make();publish(source);let c=compile();record('complete-directory-positive',c.exit,0,c)
 if(c.exit!==0)throw Error(c.stderr)
 let plan=JSON.parse(readFileSync(join(root,out,'plan.json')));record('positive-one-ready-leaf',JSON.parse(next().stdout).ready.map(t=>t.id),[source.packets[0].id])
 const cliPacket=run('node',['scripts/unified-plan.mjs','--report',out,'packet',source.packets[0].id]);const packet=JSON.parse(cliPacket.stdout)
 const required=['AGENTS.md',row.path,'scripts/unified-plan.mjs',...models,'docs/evidence/dependency.md',recon]
 record('packet-all-reference-pins',required.every(p=>packet.source_pins.some(s=>s.path===p&&s.commit===revision)),true)
 const graph=JSON.parse(readFileSync(join(root,out,'audit-graph.json'))),node=graph.nodes.find(n=>n.title===source.packets[0].title),cold=JSON.parse(readFileSync(join(root,out,'cold-packets',node.id+'.json')))
 record('cold-all-reference-pins',required.every(p=>cold.inputs.some(s=>s.address===p&&s.commit===revision)),true)
 record('cold-explicit-input-targets',cold.source_scope.input_targets,['docs/example-subject'])
 record('cold-explicit-new-output-targets',cold.source_scope.new_output_targets,['docs/example-agent-new-receipts'])
 for(const [name,mutate]of [
  ['original-omitted-descendant-changed',s=>{s.packets[0].basis_sources=s.packets[0].basis_sources.filter(r=>r.path!==models[0]);put(models[0],'export const value = 99\n');commit()}],
  ['missing-explicit-output-field',s=>delete s.packets[0].output_scope],
  ['changed-descendant',s=>{put(models[0],'export const value = 99\n');commit()}],
  ['added-committed-descendant',s=>{put('docs/example-subject/c.js','export const value = 3\n');commit()}],
  ['deleted-committed-descendant',s=>{rmSync(join(root,models[0]));commit()}],
  ['untracked-descendant',s=>put('docs/example-subject/untracked.js','export const value = 3\n')],
  ['ignored-descendant',s=>{put('docs/example-subject/ignored.js','export const value = 3\n')}],
  ['symlink-descendant',s=>symlinkSync('a.js',join(root,'docs/example-subject/link.js'))],
  ['fifo-descendant',s=>execFileSync('mkfifo',[join(root,'docs/example-subject/fifo')])],
  ['file-to-directory',s=>{rmSync(join(root,models[0]));mkdirSync(join(root,models[0]));put(models[0]+'/child.js','value');commit()}],
  ['hidden-descendant',s=>put('docs/example-subject/.hidden','value')],
  ['added-257-descendants',s=>{for(let i=0;i<257;i++)put('docs/example-subject/extra-'+i+'.js','value');commit()}],
  ['directory-1025-entry-bound',s=>{for(let i=0;i<1025;i++)mkdirSync(join(root,'docs/example-subject/empty-'+i))}],
  ['output-glob-path',s=>s.packets[0].output_scope=['docs/new-*']],
  ['output-parent-traversal',s=>s.packets[0].output_scope=['docs/../outside']],
  ['output-cross-workspace',s=>s.packets[0].output_scope=['workspace/new-output']],
  ['missing-basis-descendant-ref',s=>s.packets[0].basis_sources=s.packets[0].basis_sources.filter(r=>r.path!==models[0])],
  ['grandfathered-file-as-output',s=>{s.packets[0].context.scope=['scripts/unified-plan.mjs'];s.packets[0].output_scope=[models[0]];s.packets[0].basis_sources=s.packets[0].basis_sources.filter(r=>r.path!==models[0]);rmSync(join(root,models[0]));commit()}],
  ['missing-input-not-output',s=>{s.packets[0].context.scope=['docs/nonexistent-input']}],
  ['live-output-exists',s=>mkdirSync(join(root,'docs/example-agent-new-receipts'))],
  ['output-input-overlap',s=>s.packets[0].output_scope=['docs/example-subject/new-receipts']],
  ['output-output-overlap',s=>s.packets[0].output_scope=['docs/new-output','docs/new-output/nested']],
  ['output-symlink-parent',s=>{symlinkSync('example-subject',join(root,'docs/output-link'));s.packets[0].output_scope=['docs/output-link/new']}],
  ['output-live-file-parent',s=>{put('docs/output-file','content');s.packets[0].output_scope=['docs/output-file/new']}],
  ['scope-symlink-root',s=>{symlinkSync('example-subject',join(root,'docs/input-link'));s.packets[0].context.scope=['docs/input-link']}],
  ['output-forged-status',s=>s.packets[0].status='done'],
  ['output-release-grant',s=>s.packets[0].authority.actions.push('release')]
 ])scenario(name,mutate)
 reset();for(let i=0;i<257;i++)put('docs/example-subject/extra-'+i+'.js','value');commit();source=make();publish(source);refusal('immutable-directory-257-file-bound',compile())
 // A historical file cannot become a directory parent for a newly named output.
 reset();put('docs/historical-file','content');commit();source=make();rmSync(join(root,'docs/historical-file'));mkdirSync(join(root,'docs/historical-file'));commit();source.packets[0].output_scope=['docs/historical-file/new'];publish(source);refusal('output-historical-file-parent',compile())
 // Parent scope and typed acceptance must remain independent of one bounded candidate.
 reset();source=make();publish(source);c=compile();if(c.exit!==0){console.error(JSON.stringify(results,null,2));throw Error(c.stderr)};plan=JSON.parse(readFileSync(join(root,out,'plan.json')));record('no-parent-completion',plan.tasks.every(t=>t.dispatch!=='done'),true)
 console.log(JSON.stringify({candidate:execFileSync('git',['rev-parse','HEAD'],{cwd:owner,encoding:'utf8'}).trim(),pinnedParser:pinned,compilerControlRevision:process.env.COMPILER_CONTROL_REVISION??null,fixtureRevision:revision,results},null,2))

} finally {rmSync(root,{recursive:true,force:true})}
