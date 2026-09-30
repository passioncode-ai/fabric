// Addressable implementation handoff, using existing contracts rather than a
// separate plan. Does not claim that the target design has been implemented.
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const read=p=>readFileSync(path.join(root,p),'utf8')
export function productSpec(id){
 const m=JSON.parse(read('docs/ux/product-model.json'))
 const task=m.task_contexts.find(t=>t.id===id)||m.task_contexts.find(t=>t.id===id.split('.')[0])
 const screen=m.screens.find(s=>s.id===id),view=m.views.find(v=>v.id===id),journey=m.journeys.find(j=>j.id===id)
 if(!task&&!screen&&!view&&!journey)throw Error('Unknown UX target '+id)
 const screenIds=new Set(task?.screen_ids|| (screen?[screen.id]:view?view.screen_ids:journey.steps.map(s=>s.screen)))
 const screens=m.screens.filter(s=>screenIds.has(s.id)),views=m.views.filter(v=>v.screen_ids.some(id=>screenIds.has(id)))
 const journeys=journey?[journey]:m.journeys.filter(j=>task?task.journey_ids.includes(j.id):j.steps.some(s=>screenIds.has(s.screen)))
 const scenarioIds=new Set([...screens.flatMap(s=>s.scenario_ids),...journeys.flatMap(j=>[...(j.coverage_scenario_ids||[]),...j.steps.flatMap(s=>s.scenario_ids)])])
 const flowIds=new Set([...screens.flatMap(s=>s.flow_ids),...journeys.flatMap(j=>[...(j.coverage_flow_ids||[]),...j.steps.flatMap(s=>s.flow_ids||[])])])
 return {id,status:'target-design-not-implementation-evidence',source_commit:m.source_commit,authority:m.source_authority,scope:m.coverage_semantics,task_context:task,visual_report:'docs/reports/product.html',entry:screen?'#screen-'+screen.id:view?'#view-'+view.id:journey?'#journey-'+journey.id:'#handoff-'+task.id,required_reading:['docs/architecture/system-contract.md','docs/ux/vision.md','docs/ux/scenarios.md','docs/ux/flows.md','docs/ux/screens.md'],screens,views,journeys,scenarios:m.scenarios.filter(s=>scenarioIds.has(s.id)),flows:m.flows.filter(f=>flowIds.has(f.id)),findings:m.findings.filter(f=>task?task.finding_ids.includes(f.id):f.screen_ids.some(id=>screenIds.has(id)))}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(!process.argv[2])throw Error('Usage: node scripts/product-spec.mjs <SCR-34 | memory | PJ-02 | M188>');console.log(JSON.stringify(productSpec(process.argv[2]),null,2))}
 catch(e){console.error(e.message);process.exitCode=2}
}
