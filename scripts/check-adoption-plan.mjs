import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function validate({inventory,review,plan,journey,viewIds}){
 const need=(ok,msg)=>{if(!ok)throw Error(msg)};
 const unique=(xs,name)=>need(new Set(xs).size===xs.length,'duplicate '+name);
 const views=inventory.families.flatMap(f=>f.views.map(v=>v.view));unique(views,'view');
 need(JSON.stringify([...views].sort())===JSON.stringify([...viewIds].sort()),'view coverage mismatch');
 need(inventory.counts.views===views.length&&inventory.counts.families===inventory.families.length,'inventory counts');
 const packetIds=plan.packets.map(p=>p.id),decisionIds=review.decisions.map(d=>d.id),findingIds=review.findings.map(f=>f.id);
 unique(packetIds,'packet');unique(decisionIds,'decision');unique(findingIds,'finding');
 const byId=Object.fromEntries(plan.packets.map(p=>[p.id,p])),seen=new Set(),active=new Set();
 function walk(id){need(byId[id],'unknown dependency '+id);need(!active.has(id),'dependency cycle');if(seen.has(id))return;active.add(id);for(const d of byId[id].depends_on)walk(d);active.delete(id);seen.add(id);}
 packetIds.forEach(walk);
 for(const p of plan.packets){
  need(p.acceptance.length&&p.negative_checks.length&&p.stop_conditions.length&&p.write_candidates.length,'incomplete packet '+p.id);
  need(p.inputs.length===p.depends_on.length,'missing dependency binding '+p.id);need(p.test_write_candidates?.length,'missing test owner '+p.id);for(const i of p.inputs){need(i.minimum_proof_tier===byId[i.packet]?.required_output_tier&&i.required_status==='passed','invalid edge proof '+p.id);need(i.predicate===(i.packet==='AD12'?'selected-and-accepted-STT-port':'acceptance-complete-and-contract-bound'),'invalid edge predicate '+p.id);}for(const dep of p.depends_on)need(packetIds.indexOf(dep)<packetIds.indexOf(p.id),'non-topological order');
  for(const d of p.depends_on)need(p.inputs.some(i=>i.packet===d&&i.receipt===byId[d].output),'wrong upstream output '+p.id);
  need(p.baseline_sources.length>0,'missing source pins '+p.id);
  for(const s of p.baseline_sources)need(s.commit===plan.baseline&&/^[a-f0-9]{64}$/.test(s.sha256),'invalid source pin');
  need(p.status!=='ready-for-bounded-work'||p.id==='AD00'||p.id==='AD02','unbound ready packet');
 }
 for(const f of review.findings){need(f.decisions.length,'orphan finding '+f.id);for(const id of f.decisions)need(review.decisions.some(d=>d.id===id&&d.findings.includes(f.id)),'broken finding/decision relation');}
 for(const d of review.decisions){need(d.choice&&d.alternative&&d.packets.length,'unreviewed decision '+d.id);for(const id of d.findings)need(findingIds.includes(id),'unknown finding');for(const id of d.packets)need(packetIds.includes(id),'unknown packet');}
 unique(journey.phases.map(p=>p.id),'phase');for(const p of journey.phases){need(p.steps.length&&p.errors.length&&p.receipt,'incomplete phase');for(const id of p.packets)need(packetIds.includes(id),'unknown phase packet');}
 const reqs=plan.modules.flatMap(m=>m.requirements);unique(reqs,'requirement');for(const p of plan.packets)need(plan.modules.some(m=>m.id===p.module),'missing module');
 return {views:views.length,families:inventory.families.length,observations:findingIds.length,decisions:decisionIds.length,packets:packetIds.length,phases:journey.phases.length};
}
export function load(){const j=p=>JSON.parse(readFileSync(path.join(root,p),'utf8'));return {inventory:j('docs/launch/adoption/inventory.json'),review:j('docs/launch/adoption/findings.json'),plan:j('docs/launch/adoption/plan.json'),journey:j('docs/launch/adoption/journey.json'),viewIds:j('docs/ux/product-model.json').views.map(v=>v.id)}};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const data=load(),count=validate(data);const checked=new Set();
 for(const p of data.plan.packets){
  if(!existsSync(path.join(root,'docs/launch/adoption/packets/'+p.id+'.md')))throw Error('Missing packet file '+p.id);
  for(const f of [...p.read_paths,...p.write_candidates,...p.test_write_candidates])if(!existsSync(path.join(root,f)))throw Error('Unresolved owned path '+f);
  for(const s of p.baseline_sources){if(checked.has(s.path))continue;checked.add(s.path);const bytes=execFileSync('git',['show',s.commit+':'+s.path],{cwd:root,maxBuffer:16*1024*1024});if(createHash('sha256').update(bytes).digest('hex')!==s.sha256)throw Error('Source hash mismatch '+s.path);}
 }
 const html=readFileSync(path.join(root,'docs/reports/adoption.html'),'utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 if(new Set(ids).size!==ids.length)throw Error('Duplicate report anchors');
 for(const [,target] of html.matchAll(/href="#([^"]+)"/g))if(!ids.includes(target))throw Error('Missing report anchor '+target);
 console.log('PASS structural adoption plan '+JSON.stringify(count)+', '+checked.size+' immutable source pins. Not semantic/runtime/UX acceptance.');
}
