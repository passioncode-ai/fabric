// Dependency-free integrity gate for the fixture report, not product acceptance.
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {registrySections} from './sync-product-ux.mjs'
import {STALE,STALE_REASONS,history as gitHistory,repinProblem,staleProblem} from './lib/public-history.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const nonempty=v=>typeof v==='string'?v.trim().length>0:Array.isArray(v)?v.length>0:v&&typeof v==='object'&&Object.keys(v).length>0
const check=(condition,message)=>{if(!condition)throw new Error(message)}
const list=(value,label)=>{check(Array.isArray(value),`${label}: expected array`);return value}
const unique=(rows,label)=>{list(rows,label);const ids=rows.map(x=>typeof x==='string'?x:x?.id);check(ids.every(x=>typeof x==='string'&&x.length)&&new Set(ids).size===ids.length,`${label}: missing/duplicate identity`);return new Set(ids)}
const equalSets=(a,b,label)=>check(a.size===b.size&&[...a].every(x=>b.has(x)),`${label}: missing or extra canonical IDs`)
const ref=(id,set,label)=>check(set.has(id),`${label}: dangling reference ${id}`)
const refs=(xs,set,label)=>list(xs,label).forEach(x=>ref(x,set,label))
const sha=s=>createHash('sha256').update(s).digest('hex')
const safePath=p=>typeof p==='string'&&p.length&&!path.isAbsolute(p)&&!p.split(/[\\/]/).includes('..')&&!p.includes('\0')

export function canonicalEntries(markdown,prefix){
 return registrySections(markdown,prefix).map(({id,title,body})=>{const field=k=>body.match(new RegExp(`^- \\*\\*${k}:\\*\\*\\s*([^\\n]*)`,'m'))?.[1]?.trim();return {id,title,status:field('Status'),coverage:field('Coverage'),product:field('Product')}})
}

/** Pure validation with injected source readers. No writes, network or product imports.
 * canonical: {screens,scenarios,flows}, arrays of IDs or parsed canonical entries.
 * engineering: authoritative items (not inferred from the report's active_task_ids).
 * readSource(path) and readGitBlob(commit,path) return text; omitted readers skip IO,
 * but receipts are still required and validated structurally. CLI supplies both.
 * history ({inHistory, readBlob}, scripts/lib/public-history.mjs) re-proves the receipts
 * the public re-creation of the history marked stale or repinned; omitted, their shape
 * alone is checked. A stale receipt counts as nothing verified.
 */
export function validateProductModel(model,fixtures,options={}){
 const {canonical,engineering,readSource,readGitBlob,history}=options
 check(model?.schema==='fabric-product-model/v1','Unsupported product model schema')
 check(model.status==='proposed_product_design'&&model.implementation_in_this_change===false&&model.runtime_audit===false,'Target report falsely claims implementation/runtime audit')
 check(/^[a-f0-9]{40}$/.test(model.source_commit||''),'Unpinned model source commit')
 check(fixtures?.schema==='fabric-product-fixtures/v1'&&nonempty(fixtures.notice),'Fixture data must carry its fictional-data notice')
 check(canonical&&engineering,'Independent canonical registry and engineering catalog required')
 const screens=unique(model.screens,'screens'),views=unique(model.views,'views'),scenarios=unique(model.scenarios,'scenarios'),flows=unique(model.flows,'flows'),journeys=unique(model.journeys,'journeys'),findings=unique(model.findings,'findings'),contexts=unique(model.task_contexts,'task contexts')
 equalSets(screens,unique(canonical.screens,'canonical screens'),'SCR coverage')
 equalSets(scenarios,unique(canonical.scenarios,'canonical scenarios'),'SCN coverage')
 equalSets(flows,unique(canonical.flows,'canonical flows'),'FLW coverage')
 const active=unique(model.active_task_ids,'active tasks'),cards=unique(engineering.items,'engineering items')
 equalSets(active,cards,'Active engineering coverage')
 const screenMap=new Map(model.screens.map(s=>[s.id,s])),viewMap=new Map(model.views.map(v=>[v.id,v])),contextMap=new Map(model.task_contexts.map(t=>[t.id,t]))
 const cardMap=new Map(engineering.items.map(c=>[c.id,c]))
 const knownTasks=new Set([...cards,...(engineering.execution_nodes||[]).map(x=>x.id),...(options.knownTaskIds||[])])
 for(const id of contexts)ref(id,knownTasks,'Task context canonical identity')
 const checkTasks=(xs,where)=>refs(xs,knownTasks,where+' tasks')
 const checkContextRefs=(owner,where)=>{refs(owner.screen_ids||[],screens,where+' screens');refs(owner.view_ids||[],views,where+' views');refs(owner.journey_ids||[],journeys,where+' journeys');refs(owner.finding_ids||[],findings,where+' findings')}
 for(const s of model.screens){
  ref(s.view,views,s.id+' default view');check(viewMap.get(s.view).screen_ids.includes(s.id),s.id+' default view belongs to another screen')
  checkTasks(s.task_ids,s.id);refs(s.flow_ids,flows,s.id+' flows');refs(s.scenario_ids,scenarios,s.id+' scenarios')
  for(const key of ['loading','empty','error','success','permission','stale'])check(nonempty(s.states?.[key]),s.id+' missing state '+key)
  check(nonempty(s.purpose)&&nonempty(s.primary_action),s.id+' missing user purpose/action')
  for(const x of s.interactions||[]){ref(x.target_screen,screens,s.id+' interaction');check(nonempty(x.label)&&nonempty(x.result),s.id+' empty interaction')}
  const seen=new Set([s.id]);let alias=s.alias_of
  while(alias){ref(alias,screens,s.id+' alias');check(!seen.has(alias),s.id+' alias cycle');seen.add(alias);check(screenMap.get(alias).view===s.view,s.id+' alias changes canonical view');alias=screenMap.get(alias).alias_of}
 }
 for(const v of model.views){
  ref(v.screen_id,screens,v.id+' primary screen');refs(v.screen_ids,screens,v.id+' screens');check(v.screen_ids.includes(v.screen_id),v.id+' primary screen absent from ownership')
  checkTasks(v.task_ids||[],v.id);unique(v.states,v.id+' states');check(v.states.length,v.id+' no renderable states')
  if(v.empty_action){ref(v.empty_action.view,views,v.id+' empty action');check(nonempty(v.empty_action.label),v.id+' empty action has no label')}
 }
 for(const [id,screen] of [['agent-history','SCR-40'],['project-history','SCR-40'],['project-plan','SCR-40'],['decisions','SCR-33']]){
  ref(id,views,'Four distinct graph views');check(viewMap.get(id).screen_id===screen,id+' graph semantics attached to wrong screen')
 }
 for(const s of model.scenarios){refs(s.screen_refs||[],screens,s.id+' screens');refs(s.flow_ids||[],flows,s.id+' flows');const original=canonical.scenarios.find(x=>x.id===s.id);if(original&&typeof original==='object'){
  check(s.registry_status===original.status,s.id+' target/implemented status differs from canonical scenario')
  check(s.coverage===original.coverage,s.id+' production coverage differs from canonical scenario')
  if(original.product!==undefined)check(s.product_observation===original.product,s.id+' product observation differs from canonical scenario')
 }}
 for(const f of model.flows){refs(f.screen_refs||[],screens,f.id+' screens');refs(f.scenario_ids||[],scenarios,f.id+' scenarios')}
 const projects=unique(fixtures.projects,'fixture projects'),tasks=unique(fixtures.tasks,'fixture tasks'),runs=unique(fixtures.runs,'fixture runs'),questions=unique(fixtures.questions,'fixture questions')
 const iterations=new Set(fixtures.runs.map(r=>String(r.iteration))),stepCount=list(fixtures.steps,'fixture steps').length
 unique(fixtures.steps,'fixture steps');check(iterations.size===runs.size,'Duplicate fixture run iteration')
 for(const t of fixtures.tasks)ref(t.project,projects,'Fixture task '+t.id)
 for(const q of fixtures.questions){ref(q.project,projects,'Fixture question '+q.id);ref(q.task,tasks,'Fixture question '+q.id);check(fixtures.tasks.find(t=>t.id===q.task).project===q.project,'Fixture question crosses task project')}
 for(const r of fixtures.runs)check(Array.isArray(r.step_states)&&r.step_states.length===stepCount,'Fixture run steps incomplete '+r.id)
 for(const e of fixtures.events||[])if(e.view)ref(e.view,views,'Fixture event')
 const values={pack:['next','past'],cohort:['new','existing'],answer:['committed'],delivery:['pending','acked','acknowledged','needs-restart'],conflict:['yes','no'],phase:['repository','no-context','read-only','verified','running'],managerSwitchStatus:['pending-validation','validated'],selectedManager:['fabric','claude-code','codex','custom']}
 const fixtureState=(state,view,where)=>{
  check(state&&typeof state==='object'&&!Array.isArray(state),where+' missing fixture state')
  for(const [k,v] of Object.entries(state)){
   if(k==='project')ref(v,projects,where+' fixture project')
   else if(k==='run')ref(String(v),iterations,where+' fixture run')
   else if(k==='task')ref(v,tasks,where+' fixture task')
   else if(k==='question')ref(v,questions,where+' fixture question')
   else if(k==='state')check(view.states.includes(v),where+' unsupported view state '+v)
   else if(['taskSaved','managerSwitched','managerPaused','stopRequested','admitted'].includes(k))check(typeof v==='boolean',where+' fixture '+k+' must be boolean')
   else check(values[k]?.includes(v),where+' unknown fixture key/value '+k+'='+v)
  }
 }
 const coveredScenarios=new Set(),coveredFlows=new Set()
 for(const j of model.journeys){
  check(j.status==='target-proposal-not-runtime-validation',j.id+' falsely claims runtime-validated journey')
  for(const k of ['goal','entry','first_value','exit'])check(nonempty(j[k]),j.id+' missing '+k)
  checkTasks(j.task_ids,j.id);const steps=unique(j.steps,j.id+' steps');check(steps.size,j.id+' empty journey')
  for(const [xs,set,label,covered] of [[j.coverage_scenario_ids||[],scenarios,'coverage scenarios',coveredScenarios],[j.coverage_flow_ids||[],flows,'coverage flows',coveredFlows],[j.coverage_screen_ids||[],screens,'coverage screens',null]]){refs(xs,set,j.id+' '+label);xs.forEach(x=>covered?.add(x))}
  refs(j.screen_ids||[],screens,j.id+' screens');refs(j.scenario_ids||[],scenarios,j.id+' scenarios');refs(j.flow_ids||[],flows,j.id+' flows')
  for(const s of j.steps){ref(s.screen,screens,j.id+' step screen');ref(s.view,views,j.id+' step view');check(viewMap.get(s.view).screen_ids.includes(s.screen),j.id+' step view/screen mismatch');refs(s.scenario_ids,scenarios,j.id+' step scenarios');refs(s.flow_ids,flows,j.id+' step flows');s.scenario_ids.forEach(x=>coveredScenarios.add(x));s.flow_ids.forEach(x=>coveredFlows.add(x));check(nonempty(s.action)&&nonempty(s.result),j.id+' empty step outcome');fixtureState(s.fixture_state,viewMap.get(s.view),j.id+' step '+s.id)}
  for(const b of list(j.branches,j.id+' branches')){ref(b.at_step,steps,j.id+' branch step');ref(b.destination_screen,screens,j.id+' branch screen');ref(b.view,views,j.id+' branch view');check(viewMap.get(b.view).screen_ids.includes(b.destination_screen),j.id+' branch view/screen mismatch');refs(b.scenario_ids||[],scenarios,j.id+' branch scenarios');(b.scenario_ids||[]).forEach(x=>coveredScenarios.add(x));check(nonempty(b.condition)&&nonempty(b.recovery),j.id+' branch has no condition/recovery');fixtureState(b.fixture_state,viewMap.get(b.view),j.id+' branch')}
 }
 equalSets(coveredScenarios,scenarios,'Journey SCN coverage');equalSets(coveredFlows,flows,'Journey FLW coverage')
 for(const t of model.task_contexts){checkContextRefs(t,t.id);check(nonempty(t.implementation_context?.required_context),t.id+' missing required context');if(active.has(t.id)){
  check(Array.isArray(t.acceptance)&&t.acceptance.length&&t.acceptance.every(nonempty),t.id+' missing active task acceptance')
  const card=cardMap.get(t.id);check(nonempty(card.sources)&&nonempty(card.tests),t.id+' engineering source refs/acceptance missing')
  check(t.implementation_context.required_context.some(x=>typeof x==='string'&&x.includes('engineering')&&x.includes(t.id)),t.id+' context lacks owning engineering source reference')
  for(const s of card.sources)check(safePath(s.path)&&nonempty(s.verification),t.id+' unresolvable engineering source reference')
 }}
 for(const id of active)ref(id,contexts,'Missing active task context')
 const blobs=new Map();let receipts=0,stale=0,repinned=0
 const source=(s,pinned,where)=>{
  const file=s?.file||s?.path;check(safePath(file),where+' unsafe/missing source path')
  check(Number.isInteger(s.line)&&s.line>0,where+' invalid source line')
  check(s.end_line===undefined||(Number.isInteger(s.end_line)&&s.end_line>=s.line),where+' invalid source span')
  if(pinned||s.commit){
   check(/^[a-f0-9]{40}$/.test(s.commit||'')&&/^[a-f0-9]{64}$/.test(s.file_sha256||''),where+' unpinned source receipt')
   if(s.url){const u=new URL(s.url);check(u.protocol==='https:'&&decodeURIComponent(u.pathname).endsWith('/blob/'+s.commit+'/'+file)&&u.hash==='#L'+s.line,where+' source URL does not address pinned receipt')}
   // Stale evidence keeps its original address as a record and verifies nothing. Its
   // staleness is re-proved, so a receipt that still holds cannot be parked here.
   if(s.verification===STALE){
    check(!s.repinned_from&&STALE_REASONS.includes(s.stale?.reason),where+' stale receipt without its reason')
    if(history){const problem=staleProblem({commit:s.commit,file,sha:s.file_sha256,line:s.line,end_line:s.end_line,excerpt:s.excerpt,stale:s.stale},history);check(!problem,where+' '+problem)}
    stale++;return
   }
   if(s.repinned_from){if(history){const problem=repinProblem(s,{sha:s.file_sha256,inHistory:history.inHistory});check(!problem,where+' '+problem)}repinned++}
   receipts++;if(!readGitBlob)return
   const key=s.commit+':'+file;if(!blobs.has(key))blobs.set(key,readGitBlob(s.commit,file));const blob=blobs.get(key)
   check(sha(blob)===s.file_sha256,where+' source hash mismatch '+file)
   const lines=blob.split('\n');check((s.end_line||s.line)<=lines.length,where+' source span out of bounds')
   if(s.excerpt!==undefined){check(nonempty(s.excerpt),where+' empty source excerpt');const n=s.excerpt.split('\n').length;check(s.line+n-1<=(s.end_line||s.line+n-1),where+' excerpt exceeds cited span');check(lines.slice(s.line-1,s.line-1+n).join('\n')===s.excerpt,where+' source excerpt mismatch '+file)}
  }else if(readSource){const text=readSource(file);check(typeof text==='string'&&s.line<=text.split('\n').length,where+' current source missing/out of bounds')}
 }
 for(const f of model.findings){
  checkTasks(f.task_ids,f.id);refs(f.screen_ids,screens,f.id+' screens');refs(f.scenario_ids||[],scenarios,f.id+' scenarios');check(nonempty(f.acceptance)&&nonempty(f.agent_context),f.id+' unusable finding handoff');check(nonempty(f.evidence),f.id+' no evidence receipt');for(const s of f.evidence)source(s,true,f.id)
 }
 for(const s of model.screens)for(const e of s.current_evidence||[])source(e,true,s.id)
 for(const j of model.journeys)for(const x of [j,...j.steps,...j.branches])for(const s of x.sources||[])source(s,false,j.id)
 for(const c of model.review_choices||[])refs(c.views||[],views,'Review choice '+c.id)
 for(const a of model.flow_alternatives||[]){refs(a.journey_ids,journeys,a.id+' journeys');const ids=unique(a.options,a.id+' options');ref(a.selected,ids,a.id+' selected alternative')}
 return {screens:screens.size,views:views.size,scenarios:scenarios.size,flows:flows.size,journeys:journeys.size,findings:findings.size,active_tasks:active.size,task_contexts:contexts.size,pinned_receipts:receipts,repinned_receipts:repinned,stale_receipts:stale,verified_git_blobs:blobs.size,source_io_checked:Boolean(readSource&&readGitBlob)}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const readSource=p=>readFileSync(path.join(root,p),'utf8'),json=p=>JSON.parse(readSource(p))
  const canonical={screens:canonicalEntries(readSource('docs/ux/screens.md'),'SCR'),scenarios:canonicalEntries(readSource('docs/ux/scenarios.md'),'SCN'),flows:canonicalEntries(readSource('docs/ux/flows.md'),'FLW')}
  const result=validateProductModel(json('docs/ux/product-model.json'),json('docs/ux/product-fixtures.json'),{canonical,engineering:json('docs/architecture/engineering-specs.json'),knownTaskIds:[...readSource('docs/evidence/backlog.md').matchAll(/\bM\d+\b/g)].map(m=>m[0]),readSource,readGitBlob:(commit,file)=>execFileSync('git',['show',commit+':'+file],{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024}),history:gitHistory(root)})
  console.log('PASS product model: '+JSON.stringify(result))
  console.log('Scope: canonical crosswalk, fixture routes and pinned audit receipts; not product/runtime acceptance. Generated HTML parity: node scripts/build-product-report.mjs --check')
 }catch(error){console.error('FAIL product model: '+error.message);process.exitCode=1}
}
