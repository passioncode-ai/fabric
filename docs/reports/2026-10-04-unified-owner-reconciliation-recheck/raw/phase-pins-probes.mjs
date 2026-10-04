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
 const impactsPath=cut+'/impacts.json',receiptPath='docs/evidence/typed-receipt.json'
 const impact=(id='I-01')=>({id,severity:'blocking',disposition:'open',targets:['P-01'],evidence:'Example-agent bounded receipt absent',action:'Keep parent acceptance held'})
 const phase=()=>{reset();put(impactsPath,[impact()]);commit();return make()}
 const decision=s=>{const b=s.packets[0].basis_revision;return {id:'I-01',effect:'parent-acceptance-only',reason:'Bounded source work can proceed; parent acceptance remains held',source:{path:impactsPath,revision:b,sha256:sha(readFileSync(join(root,impactsPath)))}}}
 const frontier=()=>{const n=next();return n.exit===0?JSON.parse(n.stdout):n}
 let s=phase();publish(s);let c=compile();record('undecided-phase-compiles',c.exit,0,c);let f=frontier();record('undecided-phase-holds-leaf',f.ready.length,0,f)
 s=phase();s.packets[0].impact_scope=[decision(s)];publish(s);c=compile();record('explicit-parent-only-compiles',c.exit,0,c);f=frontier();record('explicit-parent-only-bounded-ready',f.ready.map(t=>t.id),[s.packets[0].id],f);record('explicit-parent-only-parent-still-held',f.held.some(t=>t.id==='UP-01'&&t.reasons.includes('impact I-01')),true,f)
 for(const [name,mutate]of [
  ['unknown-phase-decision',s=>s.packets[0].impact_scope[0].id='I-unknown'],
  ['global-phase-clear',s=>s.packets[0].impact_scope[0].effect='all-work'],
  ['bounded-design-phase-exemption',s=>s.packets[0].operation='bounded-design'],
  ['mutated-phase-input',s=>{put(impactsPath,[{...impact(),action:'Changed owner phase input'}]);commit()}]
 ]){s=phase();s.packets[0].impact_scope=[decision(s)];mutate(s);publish(s);refusal(name,compile())}
 s=phase();put(impactsPath,[impact(),impact('I-02')]);commit();s=make();s.packets[0].impact_scope=[decision(s)];publish(s);c=compile();record('new-unreviewed-phase-compiles',c.exit,0,c);f=frontier();record('new-unreviewed-phase-blocks',f.ready.length,0,f);record('new-phase-exact-block-reason',f.held.find(t=>t.id===s.packets[0].id)?.reasons.includes('impact I-02'),true,f)
 for(const [name,change]of [['unknown-severity',i=>i.severity='unknown'],['unknown-disposition',i=>i.disposition='completed']]){reset();const i=impact();change(i);put(impactsPath,[i]);commit();s=make();publish(s);c=compile();record(name+'-compile-no-status-authority',c.exit,0,c);for(const args of [['check'],['next'],['packet',s.packets[0].id],['impacts',s.packets[0].id]]){const r=run('node',['scripts/unified-plan.mjs','--report',out,...args]);record(name+'-'+args[0],[r.exit!==0,r.stdout===''],[true,true],r)}}
 // Receipt and phase references absent from hand-written ctx.sources must still reach cold readers.
 s=phase();s.packets[0].impact_scope=[decision(s)];const basis=s.packets[0].basis_revision,receipt={schema:'unified-scoped-receipt/1',repository:s.repository,subject_key:s.packets[0].canonical_key,basis_revision:basis,scope:'Exact example-agent source prerequisite',proof_tier:'focused',result:'PASS'};put(receiptPath,receipt);const receiptRevision=commit();s.packets[0].dependencies.push({kind:'scoped-acceptance',subject_key:s.packets[0].canonical_key,scope:receipt.scope,proof_tier:receipt.proof_tier,receipt:{path:receiptPath,revision:receiptRevision,sha256:sha(readFileSync(join(root,receiptPath)))}});publish(s);c=compile();record('receipt-phase-compile',c.exit,0,c)
 const plan=JSON.parse(readFileSync(join(root,out,'plan.json'))),packet=JSON.parse(run('node',['scripts/unified-plan.mjs','--report',out,'packet',s.packets[0].id]).stdout),graph=JSON.parse(readFileSync(join(root,out,'audit-graph.json'))),node=graph.nodes.find(n=>n.title===s.packets[0].title),cold=JSON.parse(readFileSync(join(root,out,'cold-packets',node.id+'.json')))
 for(const p of ['AGENTS.md',...models,'docs/evidence/dependency.md',impactsPath,receiptPath,recon]){record('packet-pin-'+p,packet.source_pins.some(r=>r.path===p&&r.commit===revision&&r.sha256===sha(readFileSync(join(root,p)))),true);record('cold-pin-'+p,cold.inputs.some(r=>r.address===p&&r.commit===revision&&r.sha256===sha(readFileSync(join(root,p)))),true)}
 record('receipt-phase-ready-candidate-only',frontier().ready.map(t=>t.id),[s.packets[0].id]);record('receipt-phase-no-done',plan.tasks.every(t=>t.dispatch!=='done'),true)
 for(const shape of ['drop-impact-source','clear-phase-holds','parent-done']){const forged=structuredClone(plan);if(shape==='drop-impact-source')forged.sources=forged.sources.filter(r=>r.path!==impactsPath);if(shape==='clear-phase-holds')forged.impacts=[];if(shape==='parent-done')forged.tasks.find(t=>t.id==='UP-01').dispatch='done';put(out+'/plan.json',forged);for(const args of [['check'],['next'],['packet',s.packets[0].id],['impacts',s.packets[0].id]]){const r=run('node',['scripts/unified-plan.mjs','--report',out,...args]);record('forged-'+shape+'-'+args[0],[r.exit!==0,r.stdout===''],[true,true],r)}}
 console.log(JSON.stringify({candidate:execFileSync('git',['rev-parse','HEAD'],{cwd:owner,encoding:'utf8'}).trim(),pinnedParser:pinned,fixtureRevision:revision,results},null,2))
} finally {rmSync(root,{recursive:true,force:true})}
