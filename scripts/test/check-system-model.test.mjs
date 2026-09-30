// Plant defects that would otherwise make an attractive report an unreliable contract.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {root,renderSystemMap} from '../build-system-map.mjs'
import {validateDesign,validateRendered} from '../check-system-model.mjs'
const model=JSON.parse(readFileSync(path.join(root,'docs/architecture/system-model.json'))),catalog=JSON.parse(readFileSync(path.join(root,'docs/architecture/engineering-specs.json')))
const cases=[
 ['undeclared extension',(m,c)=>c.extensions=[],/coverage/],
 ['duplicate extension',(m,c)=>c.extensions.push(c.extensions[0]),/Duplicate extension task/],
 ['baseline task removed',(m,c)=>c.items=c.items.filter(x=>x.id!=='S02'),/coverage/],
 ['extension requirement drift',(m,c)=>c.requirements.find(x=>x.id==='PA-R02').requirement='only manual switching',/Extension requirement drift/],
 ['lost task',(m,c)=>c.items.pop(),/coverage/],
 ['duplicate entity',m=>m.entities.push(m.entities[0]),/duplicate entity/],
 ['dangling relation',m=>m.relations[0].target='absent',/Dangling relation/],
 ['unnamed payload',(m,c)=>c.dependency_edges[0].carries='',/Empty dependency payload/],
 ['dependency cycle',(m,c)=>{const n=c.execution_nodes[0];n.depends_on.push(n.id);c.dependency_edges.push({from:n.id,to:n.id,carries:'bad self prerequisite'})},/Dependency cycle/],
 ['missing cycle state',m=>m.cycles[0].transitions[0].to='absent',/transition/],
 ['lost source',(m,c)=>c.items.find(x=>x.depth==='deep').sources=[],/Missing task/],
 ['changed source excerpt',m=>m.entities[0].sources[0].excerpt+=' fabricated',/citation receipt/],
 ['false delivery',(m,c)=>c.items[0].implementation_in_this_change=true,/falsely claims/],
 ['missing acceptance',(m,c)=>c.items.find(x=>x.depth==='deep').tests=[],/Missing task/]
]
for(const [name,change,error] of cases){const m=structuredClone(model),c=structuredClone(catalog);change(m,c);assert.throws(()=>validateDesign(m,c,{verifySources:false}),error,name)}
const html=renderSystemMap();assert.throws(()=>validateRendered(html+'<!-- stale -->',html),/Stale/)
const duplicate=html.replace('</main>','<div id="tasks"></div></main>');assert.throws(()=>validateRendered(duplicate,duplicate),/Duplicate/)
const dangling=html.replace('</main>','<a href="#missing-receipt">missing</a></main>');assert.throws(()=>validateRendered(dangling,dangling),/Missing generated anchor/)
console.log(`PASS: ${cases.length+3} planted contract/report defects refused`)
