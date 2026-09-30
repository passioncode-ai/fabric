import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {validateProductModel,canonicalEntries} from '../check-product-model.mjs'
import {registrySections,keyedRefinements,projectRegistries} from '../sync-product-ux.mjs'
import {readFileSync} from 'node:fs'

test('AD00: registry bodies stop at any equal or senior heading, even at EOF',()=>{
 for(const prefix of ['SCR','SCN','FLW']){
  for(const heading of ['# Appendix','## Appendix','### Unkeyed appendix']){
   const rows=registrySections(`### ${prefix}-01: Own\n- **Status:** draft\n#### Detail\ninside\n${heading}\nSCN-031\n`,prefix)
   assert.match(rows[0].body,/inside/)
   assert.doesNotMatch(rows[0].body,/SCN-031/)
  }
  assert.match(registrySections(`### ${prefix}-01: Own\nlast line`,prefix)[0].body,/last line/)
 }
})
test('AD00: duplicate registry identities fail before projection',()=>{
 assert.throws(()=>registrySections('### SCR-01: One\n### SCR-01: Two\n','SCR'),/duplicate/i)
})
test('AD00: real registry projection does not attach global appendices to SCR-63',()=>{
 const files=['scenarios','flows','screens'].map(n=>`docs/ux/${n}.md`)
 const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8')
 const original=JSON.parse(read('docs/ux/product-model.json'))
 const model=projectRegistries(original,Object.fromEntries(files.map(f=>[f,read(f)])))
 const last=model.screens.find(s=>s.id==='SCR-63')
 assert(!last.scenario_ids.includes('SCN-031'))
 assert(!last.scenario_ids.includes('SCN-059'))
 assert(last.scenario_ids.includes('SCN-088'))
 assert.deepEqual(model.views.map(v=>v.id),original.views.map(v=>v.id))
 for(const id of ['SCN-090','SCN-091','SCN-092','SCN-093','SCN-094']){
  const scenario=model.scenarios.find(s=>s.id===id)
  assert(model.screens.some(s=>s.scenario_ids.includes(id)),id+' lost screen associations')
  for(const ref of scenario.screen_refs) assert(model.screens.find(s=>s.id===ref).scenario_ids.includes(id))
 }
})
test('AD00: fenced headings are content and appendix metadata cannot upgrade a record',()=>{
 const raw='### SCN-001: Own\n```md\n### SCN-999: Example\n```\n## Appendix\n- **Status:** implemented\n'
 assert.equal(registrySections(raw,'SCN').length,1)
 assert.equal(canonicalEntries(raw,'SCN')[0].status,undefined)
})
test('AD00: only explicitly keyed refinements extend their named owners',()=>{
 const raw='### SCN-090: A\n### SCN-091: B\n### SCN-094: C\n## Refinements\n- SCN-090/091: Open SCR-31.\n\nSCN-094: Open SCR-30.\n\nGeneral SCR-63 prose is not an association.\n'
 const extra=keyedRefinements(raw,'SCN',registrySections(raw,'SCN'))
 assert.match(extra.get('SCN-090'),/SCR-31/)
 assert.match(extra.get('SCN-091'),/SCR-31/)
 assert.match(extra.get('SCN-094'),/SCR-30/)
 assert.doesNotMatch([...extra.values()].join(''),/SCR-63/)
 assert.throws(()=>keyedRefinements(raw+'\nSCN-999: Open SCR-63.','SCN',registrySections(raw,'SCN')),/Unknown refinement/)
})
test('AD00: appendix examples are ignored and mixed-owner keys keep explicit cross references',()=>{
 const raw='### SCR-31: Project\n### SCR-44: CEO\n## Appendix\n```md\nSCR-31: Wrong SCN-999.\n```\n\nSCR-31/44 / SCN-059/042: Explicit shared refinement.\n'
 const extra=keyedRefinements(raw,'SCR',registrySections(raw,'SCR'))
 assert.doesNotMatch([...extra.values()].join(''),/SCN-999/)
 for(const id of ['SCR-31','SCR-44']){assert.match(extra.get(id),/SCN-059/);assert.match(extra.get(id),/SCN-042/)}
})

// Small, complete model of the same crosswalks used by the real report. All
// corruption is in memory; neither fixtures nor generated files are edited.
const commit='a'.repeat(40),blob='// source\nexport const guarded = true\n'
const receipt={file:'src/guard.js',line:2,commit,file_sha256:createHash('sha256').update(blob).digest('hex'),excerpt:'export const guarded = true'}
function specimen(){
 const states={loading:'read pending',empty:'measured empty',error:'source failed',success:'source receipt',permission:'scope checked',stale:'retain snapshot age'}
 const screen=(id,view)=>({id,view,alias_of:null,purpose:'Inspect accountable work',primary_action:'Open evidence',task_ids:['S01'],flow_ids:['FLW-01'],scenario_ids:['SCN-001'],states:{...states},interactions:[],current_evidence:[]})
 const views=[['agent-history','SCR-40'],['project-history','SCR-40'],['project-plan','SCR-40'],['decisions','SCR-33']].map(([id,screen_id])=>({id,screen_id,screen_ids:[screen_id],task_ids:['S01'],states:['ready','error','partial']}))
 const model={schema:'fabric-product-model/v1',status:'proposed_product_design',implementation_in_this_change:false,runtime_audit:false,source_commit:commit,
  screens:[screen('SCR-40','project-history'),screen('SCR-33','decisions')],views,
  scenarios:[{id:'SCN-001',screen_refs:['SCR-40'],flow_ids:['FLW-01'],registry_status:'draft',coverage:'none yet',product_observation:'unobserved'}],
  flows:[{id:'FLW-01',screen_refs:['SCR-40'],scenario_ids:['SCN-001']}],
  journeys:[{id:'PJ-01',status:'target-proposal-not-runtime-validation',goal:'Reach the exact record',entry:'Project link',first_value:'Read source',exit:'Return with context',task_ids:['S01'],steps:[{id:'1',screen:'SCR-40',view:'project-history',scenario_ids:['SCN-001'],flow_ids:['FLW-01'],action:'Open recorded task',result:'Exact source reached',fixture_state:{project:'atlas',run:1,state:'ready'},sources:[]}],branches:[{at_step:'1',condition:'Source unavailable',destination_screen:'SCR-40',view:'project-history',recovery:'Keep snapshot and retry',scenario_ids:['SCN-001'],fixture_state:{state:'error'}}]}],
  findings:[{id:'PF-01',task_ids:['S01'],screen_ids:['SCR-40'],scenario_ids:['SCN-001'],acceptance:[{input:'Wrong scope',expected:'Refused without mutation'}],agent_context:{required_context:['owning scope']},evidence:[{...receipt}]}],
  task_contexts:[{id:'S01',screen_ids:['SCR-40'],view_ids:['project-history'],journey_ids:['PJ-01'],finding_ids:['PF-01'],implementation_context:{required_context:['engineering-specs.json items[S01]']},acceptance:['Foreign project cannot be read']}],active_task_ids:['S01'],review_choices:[],flow_alternatives:[]}
 const fixtures={schema:'fabric-product-fixtures/v1',notice:'Fictional examples, not production data.',projects:[{id:'atlas'},{id:'orbit'}],tasks:[{id:'AT-42',project:'atlas'}],steps:[{id:'check'}],runs:[{id:'run-01',iteration:1,step_states:['done']}],questions:[{id:'Q-12',project:'atlas',task:'AT-42'}],events:[]}
 const options={canonical:{screens:['SCR-40','SCR-33'],scenarios:[{id:'SCN-001',status:'draft',coverage:'none yet',product:'unobserved'}],flows:['FLW-01']},engineering:{items:[{id:'S01',sources:[{path:'src/guard.js',verification:'git-blob'}],tests:['Wrong scope refused']}],execution_nodes:[{id:'S01'}]},readSource:()=>blob,readGitBlob:(c,p)=>{assert.equal(c,commit);assert.equal(p,'src/guard.js');return blob}}
 return {model,fixtures,options}
}
function rejects(name,mutate,pattern){test(name,()=>{const s=specimen();mutate(s);assert.throws(()=>validateProductModel(s.model,s.fixtures,s.options),pattern)})}
test('complete model and pinned evidence pass without filesystem access',()=>{const s=specimen();const r=validateProductModel(s.model,s.fixtures,s.options);assert.equal(r.active_tasks,1);assert.equal(r.verified_git_blobs,1);assert.equal(r.scenarios,1)})
test('canonical status is read from the owning section, not a later scenario',()=>{const s=canonicalEntries('### SCN-001: First\n- **Status:** draft\n- **Coverage:** none yet\n### SCN-002: Second\n- **Status:** implemented\n','SCN');assert.deepEqual(s.map(x=>x.status),['draft','implemented'])})
rejects('canonical screen cannot disappear from the report',s=>s.model.screens.pop(),/SCR coverage/)
rejects('canonical scenario omission is not hidden by copied counts',s=>s.model.scenarios=[],/SCN coverage/)
rejects('screen default cannot point at a non-existing renderer',s=>s.model.screens[0].view='phantom',/default view.*dangling/)
rejects('alias cycle is rejected',s=>s.model.screens[0].alias_of='SCR-40',/alias cycle/)
rejects('four graph meanings cannot collapse into three destinations',s=>s.model.views=s.model.views.filter(v=>v.id!=='agent-history'),/Four distinct graph/)
rejects('journey cannot show another screen under the original label',s=>s.model.journeys[0].steps[0].view='decisions',/step view\/screen mismatch/)
rejects('branch must originate at an actual step',s=>s.model.journeys[0].branches[0].at_step='999',/branch step.*dangling/)
rejects('fixture route cannot silently fall back to the first project',s=>s.model.journeys[0].steps[0].fixture_state.project='missing',/fixture project.*dangling/)
rejects('fixture question cannot borrow a task from another project',s=>s.fixtures.questions[0].project='orbit',/crosses task project/)
rejects('fixture run ordinal must exist',s=>s.model.journeys[0].steps[0].fixture_state.run=9,/fixture run.*dangling/)
rejects('active infrastructure task still needs acceptance',s=>s.model.task_contexts[0].acceptance=[],/missing active task acceptance/)
rejects('active context cannot be removed while active list remains',s=>s.model.task_contexts=[],/Missing active task context/)
rejects('forged audit source hash fails against pinned git blob',s=>s.model.findings[0].evidence[0].file_sha256='0'.repeat(64),/source hash mismatch/)
rejects('true file hash does not excuse a fabricated excerpt',s=>s.model.findings[0].evidence[0].excerpt='export const guarded = false',/source excerpt mismatch/)
rejects('source range beyond actual blob is rejected',s=>s.model.findings[0].evidence[0].end_line=900,/source span out of bounds/)
rejects('receipt cannot read an absolute path',s=>s.model.findings[0].evidence[0].file='/etc/passwd',/unsafe\/missing source path/)
rejects('prototype cannot upgrade canonical draft to implemented',s=>s.model.scenarios[0].registry_status='implemented',/target\/implemented status/)
rejects('target model cannot claim a runtime audit',s=>s.model.runtime_audit=true,/falsely claims implementation\/runtime audit/)
rejects('active task set must come from independent engineering catalog',s=>s.model.active_task_ids=[],/Active engineering coverage/)
rejects('invented later task is not legitimised by its own context row',s=>s.model.task_contexts.push({...s.model.task_contexts[0],id:'M999'}),/Task context canonical identity/)
rejects('source link cannot point at another commit than the verified receipt',s=>s.model.findings[0].evidence[0].url='https://github.com/example/fabric/blob/'+('b'.repeat(40))+'/src/guard.js#L2',/source URL/)
rejects('an empty acceptance string does not constitute a usable test',s=>s.model.task_contexts[0].acceptance=[''],/missing active task acceptance/)
