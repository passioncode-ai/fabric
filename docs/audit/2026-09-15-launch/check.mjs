// Check conservation and dependency integrity, not product implementation.
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=dirname(fileURLToPath(import.meta.url)),root=resolve(dir,'../../..');
const inv=JSON.parse(readFileSync(resolve(dir,'inventory.json'))),plan=JSON.parse(readFileSync(resolve(dir,'launch.json')));
const hash=x=>createHash('sha256').update(x).digest('hex');
const check=(condition,message)=>{if(!condition)throw Error(message);};
const paths=execFileSync('git',['ls-tree','-r','--name-only',inv.source_commit,'docs'],{encoding:'utf8'}).trim().split('\n');
check(JSON.stringify(paths.sort())===JSON.stringify(inv.documents.map(d=>d.path).sort()),'Inventory omitted/added a baseline doc');
for(const d of inv.documents)check(existsSync(resolve(root,d.path)),'Source removed: '+d.path);
const originals=new Map();
for(const r of inv.rows){
 if(!originals.has(r.path))originals.set(r.path,execFileSync('git',['show',inv.source_commit+':'+r.path],{encoding:'utf8',maxBuffer:8*1024*1024}).split('\n'));
 check(originals.get(r.path)[r.line-1]===r.raw,'Altered source row '+r.key);
 check(hash(r.raw)===r.sha256,'Wrong row hash '+r.key);
}
const backlog='docs/evidence/backlog.md',carry='docs/evidence/specs/2026-08-16-software-fabric-carryover.md';
for(const p of [backlog,carry]){
 const current=readFileSync(resolve(root,p),'utf8');
 for(const r of inv.rows.filter(r=>r.path===p)){
  if(p===carry&&r.id==='CO-165'){
   const now=current.split('\n').find(l=>l.startsWith('| CO-165 |'));
   check(now?.includes('Scope extended by the operator'),'Missing CO-165 routing note');
   for(const c of r.cells)check(now.includes(c),'CO-165 erased old cell');
  }else check(current.includes(r.raw),'Existing register row changed/removed: '+r.key);
 }
}
const ids=new Set(plan.nodes.map(n=>n.id)),used=new Set();check(ids.size===plan.nodes.length,'Duplicate packet');
let edges=0;for(const n of plan.nodes){
 for(const r of n.requirements){check(plan.requirements.includes(r),'Unknown requirement');used.add(r);}
 for(const d of n.depends_on)check(ids.has(d),'Unresolved dependency '+d);
 check(n.edges.length===n.depends_on.length,'Missing edge payload');
 for(const e of n.edges)check(e.carries.length>10&&e.to_id===n.id&&n.depends_on.includes(e.from_id),'Invalid edge');
 edges+=n.edges.length;
 for(const p of n.edit_targets)check(existsSync(resolve(root,p)),'Unresolved edit target '+p);
 check(n.positive&&n.negative&&n.rollback&&n.proposed_output&&n.exclusions,'Incomplete packet '+n.id);
}
check(used.size===plan.requirements.length,'Lost requirement');
const done=new Set(),layers=[];while(done.size<ids.size){const layer=plan.nodes.filter(n=>!done.has(n.id)&&n.depends_on.every(x=>done.has(x)));check(layer.length,'Dependency cycle');layers.push(layer.map(n=>n.id));layer.forEach(n=>done.add(n.id));}
let links=0;for(const name of ['README.md','packets.md','contracts.md','checks.md']){
 const s=readFileSync(resolve(dir,name),'utf8');
 for(const m of s.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){
  const href=m[1];if(/^(https?:|#)/.test(href))continue;
  check(existsSync(resolve(dir,decodeURI(href.split('#')[0]))),'Missing local link '+name+': '+href);links++;
 }
}
console.log(JSON.stringify({result:'PASS',scope:'conservation, references, requirement trace, DAG; no runtime coverage',documents:paths.length,preservedRows:inv.rows.length,packets:ids.size,requirements:used.size,edges,layers,localLinks:links}));
