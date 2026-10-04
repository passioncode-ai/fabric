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
 const source=path=>({path,goal:'agent-workplace',kind:'tasks',format:'table',idColumn:'ID',titleColumn:'Packet',statusColumn:'Status'})
 put('docs/backlog-sources.json',{schema:1,repository:'https://github.com/passioncode-ai/fabric',sources:['docs/evidence/backlog.md','docs/evidence/communication.md','docs/evidence/second-owner.md'].map(source)})
 put('docs/ux/vision.md','Example-agent vision.\n');put('docs/adr/0101-the-general-development-plan.md','Example source authority.\n')
 const ctx={outcome:'One bounded example-agent outcome',sources:['docs/evidence/backlog.md'],scope:['docs/example-agent.json'],steps:['Read exact source'],acceptance:['Source-bound check'],risks:['Historical proof scope'],stop_conditions:['Hold until reviewed'],resume:'Reconcile exact source'}
 put(cut+'/checks/execution.json',{source_revision:'a'.repeat(40),scope:'Historical lint only',status:'PASS',live_admission:'NOT_RUN'})
 put(cut+'/packets/release.json',{tasks:[{id:'UP-01',canonical_ids:['P-01'],lane:1,title:'Example inherited done',kind:'implementation',dispatch:'done',priority_group:0,depends_on:[],context:ctx}]})
 put(cut+'/packets/start-adoption.json',{tasks:[{id:'P-01.parent',canonical_id:'P-01',lane:1,title:'Example held parent',canonical_sources:['docs/evidence/backlog.md'],file_scope:['docs/example-agent.json'],implementation_steps:['Read owner'],definition_of_done:['Independent bounded review']}]})
 put(cut+'/packets/agents-memory.json',{tasks:[]});put(cut+'/packets/reach-horizon.json',{tasks:[],horizon_coverage:[]});put(cut+'/impacts.json',[]);put(cut+'/plan.json','Historical cut must not change.\n');put('privacy.local.json',[])
 git('init','-q');git('add','docs','scripts');git('update-index','--add','--cacheinfo',`160000,${pinned},workspace`);git('-c','user.name=Independent Fixture','-c','user.email=fixture@example.test','commit','-qm','neutral committed fixture')
 let revision=git('rev-parse','HEAD')
 const compile=()=>run('python3',['scripts/build-unified-plan.py','--output',out,'--source-revision',revision,'--privacy-deny-file','privacy.local.json'])
 const check=()=>run('node',['scripts/unified-plan.mjs','--report',out,'check'])
 const c=compile();record('production-parser-compile',c.exit,0,c)
 if(c.exit!==0) throw Error('positive compile failed: '+c.stderr)
 const planfile=join(root,out,'plan.json'),plan=JSON.parse(readFileSync(planfile)),save=p=>writeFileSync(planfile,JSON.stringify(p))
 record('baseline-validation',check().exit,0,check())
 record('all-15-source-qualified-COM-rows',plan.canonical_inventory.tasks.filter(t=>t.id.startsWith('COM-')).length,15)
 record('colliding-COM-01-has-two-keys',new Set(plan.canonical_inventory.tasks.filter(t=>t.id==='COM-01').map(t=>t.key)).size,2)
 record('all-input-pins-use-committed-revision',plan.sources.every(s=>s.commit===revision),true)
 const held=plan.tasks.filter(t=>t.historical_dispatch);record('inherited-candidate-and-done-held',held.every(t=>t.dispatch==='design-gated'),true)
 const next=run('node',['scripts/unified-plan.mjs','--report',out,'next']);record('empty-frontier-stays-held',JSON.parse(next.stdout).ready.length,0)
 const changed=structuredClone(plan);changed.tasks=changed.tasks.filter(t=>!t.canonical_ids.includes('COM-14'));save(changed);record('omitted-COM-row-rejected',check().exit!==0,true,check());save(plan)
 for(const dispatch of ['candidate','done']){
  const forged=structuredClone(plan),t=forged.tasks.find(t=>t.id==='UP-01');t.dispatch=dispatch
  if(dispatch==='candidate'){t.kind='design-review';t.id='UP-01.prepare'}
  save(forged);const r=check();record('historical-proof-repromoted-'+dispatch,r.exit!==0,true,r)
 }
 save(plan)
 const rebind=structuredClone(plan),t=rebind.tasks.find(t=>t.id==='UP-01');t.dispatch='done';t.evidence.source_revision=revision;t.evidence.scope='Current release acceptance';save(rebind);record('historical-proof-rebound-to-current',check().exit!==0,true,check());save(plan)
 const pins=structuredClone(plan);pins.sources[0].commit='f'.repeat(40);save(pins);record('wrong-pin-revision-rejected',check().exit!==0,true,check());save(plan)
 const original=readFileSync(join(root,cut+'/packets/start-adoption.json'));put(cut+'/packets/start-adoption.json',original.toString()+'\n');record('research-byte-drift-rejected',check().exit!==0,true,check());writeFileSync(join(root,cut+'/packets/start-adoption.json'),original)
 put('docs/unified-plan-current.json',{schema:1,report:out,status:'done'});record('pointer-status-authority-rejected',run('node',['scripts/unified-plan.mjs','check']).exit!==0,true)
 put('docs/unified-plan-current.json',{schema:1,report:'docs/reports/../../outside'});record('pointer-path-escape-rejected',run('node',['scripts/unified-plan.mjs','check']).exit!==0,true)
 const caller=readFileSync(join(root,'docs/evidence/communication.md'));put('docs/evidence/communication.md',caller.toString()+'\n');rmSync(join(root,out),{recursive:true,force:true});const dirty=compile();record('dirty-input-compile-rejected',dirty.exit!==0,true,dirty);record('dirty-rejection-before-output',existsSync(join(root,out,'plan.json')),false)
 console.log(JSON.stringify({candidate:execFileSync('git',['rev-parse','HEAD'],{cwd:owner,encoding:'utf8'}).trim(),pinnedParser:pinned,fixtureRevision:revision,results},null,2))
} finally {rmSync(root,{recursive:true,force:true})}
