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
 git('init','-q');git('add','docs','scripts','AGENTS.md');git('update-index','--add','--cacheinfo',`160000,${pinned},workspace`);git('-c','user.name=Independent Fixture','-c','user.email=fixture@example.test','commit','-qm','neutral committed fixture')
 let revision=git('rev-parse','HEAD')
 const compile=()=>run('python3',['scripts/build-unified-plan.py','--output',out,'--source-revision',revision,'--privacy-deny-file','privacy.local.json'])
 const check=()=>run('node',['scripts/unified-plan.mjs','--report',out,'check'])
 const recon='docs/evidence/plans/unified-current-reconciliation.json'
 const commit=()=>{git('add','docs','scripts','AGENTS.md');git('-c','user.name=Independent Fixture','-c','user.email=fixture@example.test','commit','-qm','neutral owner input');revision=git('rev-parse','HEAD');return revision}
 const inv=run('node',['scripts/unified-plan.mjs','inventory','--source-revision',revision]);const row=JSON.parse(inv.stdout).tasks.find(t=>t.id==='P-01')
 const basis=revision,ref=path=>({path,revision:basis,sha256:sha(readFileSync(join(root,path)))})
 const packet={id:'P-01.qualify-source',canonical_key:row.key,related_canonical_keys:[],basis_revision:basis,basis_sources:['AGENTS.md',row.path,'scripts/unified-plan.mjs'].map(ref),operation:'qualification',title:'Example-agent bounded qualification',context:{...ctx,sources:[row.path,'scripts/unified-plan.mjs'],scope:['scripts/unified-plan.mjs']},output_scope:['docs/example-agent-receipts'],rollback:'Discard only task-owned isolated source changes',authority:{kind:'source-owner-bounded-work',repository:'https://github.com/passioncode-ai/fabric',actions:['code','check','commit','push'],standing:ref('AGENTS.md'),requested_source:ref(row.path)},dependencies:[{kind:'source-input',purpose:'Bounded source input only',ref:ref(row.path)}],acceptance_gates:[{id:'P-01.parent',requirement:'Full native and release authority remains separate',required_for:'parent-acceptance'}],impact_scope:[]}
 const source={schema:'unified-owner-reconciliation/1',repository:'https://github.com/passioncode-ai/fabric',packets:[packet]}
 const clear=()=>rmSync(join(root,out),{recursive:true,force:true})
 const publish=s=>{put(recon,s);commit();clear()}
 let c=compile();record('absent-owner-keeps-inherited-holds',c.exit,0,c)
 let plan=JSON.parse(readFileSync(join(root,out,'plan.json')))
 record('absent-owner-no-current-authority',plan.owner_reconciliation,null)
 record('absent-owner-empty-frontier',JSON.parse(run('node',['scripts/unified-plan.mjs','--report',out,'next']).stdout).ready.length,0)
 publish(source);c=compile();record('current-owner-compile',c.exit,0,c)
 plan=JSON.parse(readFileSync(join(root,out,'plan.json')))
 record('one-bounded-candidate-only',JSON.parse(run('node',['scripts/unified-plan.mjs','--report',out,'next']).stdout).ready.map(t=>t.id),[packet.id])
 record('all-inherited-acceptance-still-held',plan.tasks.filter(t=>t.historical_dispatch).every(t=>t.dispatch==='design-gated'),true)
 record('no-parent-done',plan.tasks.every(t=>t.dispatch!=='done'),true)
 record('owner-input-full-source-pin',plan.sources.some(s=>s.path===recon&&s.commit===revision),true)
 const planfile=join(root,out,'plan.json'),save=p=>writeFileSync(planfile,JSON.stringify(p))
 for(const shape of ['suppress-owner','remove-owner-task','parent-done','release-claim','tasks-claim']){
  const p=structuredClone(plan)
  if(shape==='suppress-owner'){delete p.owner_reconciliation;p.sources=p.sources.filter(s=>s.path!==recon)}
  if(shape==='remove-owner-task')p.tasks=p.tasks.filter(t=>t.id!==packet.id)
  if(shape==='parent-done'){const t=p.tasks.find(t=>t.id==='UP-01');t.dispatch='done';t.evidence={path:cut+'/checks/execution.json',sha256:sha(readFileSync(join(root,cut+'/checks/execution.json')))}}
  if(shape==='release-claim')p.tasks.find(t=>t.id===packet.id).context.owner_reconciliation.authority.actions.push('release')
  if(shape==='tasks-claim')p.tasks.find(t=>t.id===packet.id).context.tasks_support={negotiated:true,supported:true}
  save(p)
  for(const args of [['check'],['next'],['packet',packet.id],['impacts',packet.id]]){const r=run('node',['scripts/unified-plan.mjs','--report',out,...args]);record('derived-'+shape+'-'+args[0],[r.exit!==0,r.stdout===''],[true,true],r)}
 }
 save(plan)
 const original=readFileSync(join(root,recon));put(recon,original.toString()+' ');let r=run('node',['scripts/unified-plan.mjs','--report',out,'next']);record('dirty-owner-refuses-frontier',[r.exit!==0,r.stdout===''],[true,true],r);writeFileSync(join(root,recon),original)
 rmSync(join(root,recon));r=run('node',['scripts/unified-plan.mjs','--report',out,'next']);record('missing-discovered-owner-refuses-frontier',[r.exit!==0,r.stdout===''],[true,true],r);writeFileSync(join(root,recon),original)
 for(const [name,mutate] of [
  ['release-actions',p=>p.authority.actions.push('release')],['source-done',p=>p.status='done'],['source-tasks-capability',p=>p.tasks_support=true],['renamed-subject',p=>p.id='COM-01.qualify-source'],['cross-owner',p=>p.canonical_key=p.canonical_key.replace('/fabric:', '/other-owner:')],['unknown-proof-tier',p=>p.dependencies.push({kind:'scoped-acceptance',subject_key:p.canonical_key,scope:'MCP Tasks negotiated',proof_tier:'mcp-tasks',receipt:null})],['cross-workspace-scope',p=>p.context.scope=['workspace/lib/backlog.mjs']]
 ]){const s=structuredClone(source);mutate(s.packets[0]);publish(s);const r=compile();record('source-'+name+'-refused',[r.exit!==0,existsSync(join(root,out,'plan.json'))],[true,false],r)}
 for(const result of [null,'NOT_RUN','FAIL','PASS']){
  const s=structuredClone(source),p=s.packets[0],dep={kind:'scoped-acceptance',subject_key:row.key,scope:'Exact example-agent native prerequisite',proof_tier:'native',receipt:null}
  if(result!==null){const path='docs/evidence/scoped-receipt.json';put(path,{schema:'unified-scoped-receipt/1',repository:s.repository,subject_key:row.key,basis_revision:basis,scope:dep.scope,proof_tier:dep.proof_tier,result});const rev=commit();dep.receipt={path,revision:rev,sha256:sha(readFileSync(join(root,path)))}}
  p.dependencies.push(dep);publish(s);const c=compile();record('receipt-'+String(result)+'-valid',c.exit,0,c)
  if(c.exit===0){const next=run('node',['scripts/unified-plan.mjs','--report',out,'next']);record('receipt-'+String(result)+'-frontier',JSON.parse(next.stdout).ready.map(t=>t.id),result==='PASS'?[packet.id]:[])}
 }
 for(const [name,change] of [['foreign-owner',r=>r.repository='https://github.com/example/foreign'],['wrong-subject',r=>r.subject_key=row.key.replace('P-01','COM-01')],['old-basis',r=>r.basis_revision='a'.repeat(40)],['rebound-scope',r=>r.scope='Release accepted'],['focused-as-native',r=>r.proof_tier='focused'],['tasks-as-proof',r=>r.tasks_supported=true]]){
  const path='docs/evidence/scoped-receipt.json',receipt={schema:'unified-scoped-receipt/1',repository:source.repository,subject_key:row.key,basis_revision:basis,scope:'Exact example-agent native prerequisite',proof_tier:'native',result:'PASS'};change(receipt);put(path,receipt);const rev=commit(),s=structuredClone(source)
  s.packets[0].dependencies.push({kind:'scoped-acceptance',subject_key:row.key,scope:'Exact example-agent native prerequisite',proof_tier:'native',receipt:{path,revision:rev,sha256:sha(readFileSync(join(root,path)))}});publish(s);const r=compile();record('receipt-'+name+'-refused',[r.exit!==0,existsSync(join(root,out,'plan.json'))],[true,false],r)
 }
 // Existing directory scopes can hide a changed descendant from basis contracts.
 put('docs/example-subject/model.js','export const revision = 1\n');commit()
 const directoryBasis=revision,directoryRef=path=>({path,revision:directoryBasis,sha256:sha(readFileSync(join(root,path)))})
 const broad=structuredClone(source),bp=broad.packets[0];bp.basis_revision=directoryBasis;bp.basis_sources=['AGENTS.md',row.path,'scripts/unified-plan.mjs'].map(directoryRef);bp.authority.standing=directoryRef('AGENTS.md');bp.authority.requested_source=directoryRef(row.path);bp.dependencies=[{kind:'source-input',purpose:'Current owner source',ref:directoryRef(row.path)}];bp.context.scope=['docs/example-subject']
 put('docs/example-subject/model.js','export const revision = 2\n');commit();publish(broad);const directory=compile();record('changed-descendant-in-existing-directory-scope-refused',directory.exit!==0,true,directory);{const r=run('node',['scripts/unified-plan.mjs','--report',out,'next']);record('changed-descendant-directory-not-ready',[r.exit!==0 || !JSON.parse(r.stdout).ready.some(t=>t.id===packet.id)], [true],r)}
 console.log(JSON.stringify({candidate:execFileSync('git',['rev-parse','HEAD'],{cwd:owner,encoding:'utf8'}).trim(),pinnedParser:pinned,fixtureRevision:revision,results},null,2))
} finally {rmSync(root,{recursive:true,force:true})}
