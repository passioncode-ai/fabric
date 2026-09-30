// Checks the planning artifact, not product behavior or the truth of UX judgments.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const plan=JSON.parse(fs.readFileSync('docs/launch/operator-plan.json','utf8'));
const fail=message=>{throw new Error(message)};
const unique=(xs,label)=>{if(new Set(xs).size!==xs.length)fail(`Duplicate ${label}`);return new Set(xs)};
const ids=unique(plan.nodes.map(n=>n.id),'packet');
const reqs=unique(plan.requirements,'requirement');
const caps=unique(plan.capabilities,'capability');
const findings=unique(plan.findings,'finding');
for(const key of ['entry','audit','plan','contract'])if(!fs.existsSync(plan[key]))fail(`Missing ${key}: ${plan[key]}`);
const audit=fs.readFileSync(plan.audit,'utf8'), spec=fs.readFileSync(plan.plan,'utf8'), brief=fs.readFileSync(plan.entry,'utf8');
for(const r of reqs)if(!brief.includes(`| ${r} |`))fail(`Requirement absent from brief: ${r}`);
for(const f of findings)if(!audit.includes(`| ${f} |`))fail(`Finding absent from audit: ${f}`);
const rows=audit.split('\n').filter(l=>/^\| C\d+ \|/.test(l));
const rowIds=unique(rows.map(l=>l.split('|')[1].trim()),'audit capability');
if(rowIds.size!==caps.size||[...caps].some(c=>!rowIds.has(c)))fail('Capability inventory and audit differ');
for(const n of plan.nodes){
  if(!spec.includes(`### ${n.id} —`))fail(`Packet has no detailed spec: ${n.id}`);
  if(!n.owner||n.status!=='planned')fail(`Invalid planning state: ${n.id}`);
  for(const [field,allowed] of [['requirements',reqs],['capabilities',caps],['findings',findings]]){
    if(!n[field]?.length)fail(`${n.id} lacks ${field}`);
    for(const value of n[field])if(!allowed.has(value))fail(`Unknown ${field}: ${value}`);
  }
}
// Broad UX/acceptance packets must not mask an unserved implementation requirement.
const implementation=plan.nodes.filter(n=>!['OX-02','OX-12'].includes(n.id));
for(const [field,values] of [['requirements',reqs],['capabilities',caps]])for(const v of values){
  if(!implementation.some(n=>n[field].includes(v)))fail(`Unserved ${field}: ${v}`);
}
for(const f of findings)if(!plan.nodes.some(n=>n.findings.includes(f)))fail(`Unserved finding: ${f}`);
const incoming=new Map([...ids].map(id=>[id,0])),seenEdges=new Set();
for(const e of plan.edges){
  if(!ids.has(e.from)||!ids.has(e.to)||e.from===e.to)fail('Invalid dependency');
  if(!['data','control','authorization','resource'].includes(e.kind)||!e.payload?.trim())fail('Untyped or empty dependency');
  const key=`${e.from}->${e.to}`;if(seenEdges.has(key))fail('Duplicate dependency');seenEdges.add(key);
  incoming.set(e.to,incoming.get(e.to)+1);
}
const layers=[];let done=0;
while(done<ids.size){const layer=[...incoming].filter(([,n])=>n===0).map(([id])=>id);if(!layer.length)fail('Dependency cycle');layers.push(layer);for(const id of layer){incoming.set(id,-1);done++;for(const e of plan.edges.filter(e=>e.from===id))incoming.set(e.to,incoming.get(e.to)-1)}}
for(const p of plan.external_prerequisites)if(!ids.has(p.node)||!p.meaning||!fs.existsSync(p.home))fail('Unresolved external prerequisite');
for(const r of plan.resource_constraints){for(const p of r.paths)if(!fs.existsSync(p))fail(`Unresolved resource: ${p}`);for(const id of r.nodes)if(!ids.has(id))fail('Unknown resource owner')}
if(!/^[a-f0-9]{40}$/.test(plan.baseline))fail('Missing immutable source baseline');
execFileSync('git',['cat-file','-e',`${plan.baseline}^{commit}`]);
let references=0;
for(const m of audit.matchAll(/`((?:scripts|apps)\/[^`:\s]+):([\d,–-]+)`/g)){
  const body=execFileSync('git',['show',`${plan.baseline}:${m[1]}`],{encoding:'utf8'});
  const max=body.split('\n').length;
  for(const line of m[2].split(/[,–-]/).map(Number))if(line<1||line>max)fail(`Invalid source line ${m[1]}:${line}`);
  references++;
}
if(references<30)fail('Evidence references unexpectedly missing');
const totals={PASS:0,PARTIAL:0,FAIL:0,BLOCKED:0};
for(const row of rows){const v=row.match(/\| (PARTIAL|FAIL|BLOCKED|PASS):/);if(!v)fail('Missing capability verdict');totals[v[1]]++}
const summary=`${totals.PARTIAL} PARTIAL / ${totals.FAIL} FAIL / ${totals.BLOCKED} BLOCKED / ${totals.PASS} end-to-end PASS`;
if(!audit.includes(summary))fail('Published totals differ from rows');
console.log(JSON.stringify({result:'PASS',scope:'planning references, trace and DAG; not UX/runtime acceptance',requirements:reqs.size,capabilities:caps.size,findings:findings.size,packets:ids.size,edges:plan.edges.length,sourceReferences:references,totals,layers}));
