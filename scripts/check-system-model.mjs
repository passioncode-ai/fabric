// Integrity gate for a proposed engineering design, not a runtime/security proof.
import {readFileSync,existsSync} from 'node:fs'
import { aliasProblems, anchorOf, contractOf } from './lib/canonical-id.mjs'
import { cell } from './lib/markdown-table.mjs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {parse} from 'parse5'
import {root,renderSystemMap} from './build-system-map.mjs'
import {STALE,history as gitHistory,repinProblem,siblingRepinProblem,staleProblem} from './lib/public-history.mjs'
const read=p=>readFileSync(path.join(root,p),'utf8')
const json=p=>JSON.parse(read(p))
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)}
const unique=(xs,name)=>{const ids=xs.map(x=>x.id);assert(ids.every(Boolean)&&new Set(ids).size===ids.length,'Missing/duplicate '+name);return new Set(ids)}
const nonempty=x=>typeof x==='string'?x.trim().length>0:Array.isArray(x)?x.length>0:x&&Object.keys(x).length>0
export function validateDesign(model,catalog,{verifySources=true}={}){
 const modules=unique(model.modules,'module'),entities=unique(model.entities,'entity'),relations=unique(model.relations,'relation'),cycles=unique(model.cycles,'cycle'),cards=unique(catalog.items,'task'),nodes=unique(catalog.execution_nodes,'execution node')
 const original=json('docs/audit/2026-09-07-merged-execution-plan.json')
 const originalItems=original.work||original.items||original.tasks||original.cards
 assert(originalItems,'Unknown audit shape')
 const originalIds=new Set(originalItems.map(x=>x.id)),extensionTasks=new Set(),extensionRequirements=[]
 for(const extension of catalog.extensions||[]){
  const file=extension.manifest
  assert(typeof file==='string'&&file.startsWith('docs/evidence/plans/')&&!file.split('/').includes('..')&&file.endsWith('.json'),'Invalid catalog extension path')
  const extra=json(file)
  assert(extra.schema==='fabric-catalog-extension/v1'&&nonempty(extra.reason)&&typeof extra.source==='string'&&extra.source.startsWith('docs/')&&!extra.source.split('/').includes('..')&&existsSync(path.join(root,extra.source)),'Missing extension authority')
  const declared=unique(extra.tasks.map(id=>({id})),'extension task')
  for(const id of declared){assert(!originalIds.has(id)&&!extensionTasks.has(id),'Duplicate extension task');extensionTasks.add(id)}
  extensionRequirements.push(...extra.requirements)
 }
 const expectedCards=new Set([...originalIds,...extensionTasks]);assert(cards.size===expectedCards.size&&[...cards].every(x=>expectedCards.has(x)),'Original/extension task coverage changed')
 const parts=catalog.items.flatMap(c=>c.parts||[]);for(const p of parts)for(const k of ['solution','interfaces','invariants','failure_cases','migration','tests','sources'])assert(nonempty(p[k]),'Missing part '+p.id+'.'+k);const partIds=unique(parts,'part');const all=new Set([...cards,...partIds])
 assert(nodes.size===cards.size+partIds.size-1&&!nodes.has('M183'),'Execution split cardinality changed: M183 has only local/upstream nodes')
 for(const id of all)assert(nodes.has(id)||id==='M183','Missing execution node '+id)
 const checkTasks=(xs,where)=>{assert(Array.isArray(xs)&&xs.length,'Missing task trace '+where);for(const id of xs)assert(all.has(id),'Unknown task '+id+' in '+where)}
 for(const m of model.modules)checkTasks(m.tasks,m.id)
 assert(new Set(model.modules.flatMap(m=>m.tasks)).size===cards.size,'Module coverage does not include all cards')
 for(const e of model.entities){assert(modules.has(e.module),'Unknown entity module '+e.id);assert(['existing','partial','planned'].includes(e.implementation),'Invalid implementation state');for(const k of ['store','scope','identity','fields','invariants','sources'])assert(nonempty(e[k]),'Missing entity '+e.id+'.'+k);checkTasks(e.tasks,e.id)}
 for(const r of model.relations){assert(entities.has(r.source)&&entities.has(r.target),'Dangling relation '+r.id);assert(nonempty(r.payload)&&nonempty(r.kind),'Empty relation payload '+r.id);checkTasks(r.tasks,r.id)}
 for(const c of model.cycles){assert(modules.has(c.module),'Unknown cycle module');const states=unique(c.states,c.id+' state');for(const k of ['trigger','dedup_key','output','rules'])assert(nonempty(c[k]),'Missing cycle '+k);checkTasks(c.tasks,c.id);assert(c.transitions.length,'No transitions');for(const t of c.transitions)assert(states.has(t.from)&&states.has(t.to)&&nonempty(t.guard)&&nonempty(t.carries),'Dangling/unguarded transition '+c.id);for(const t of c.interruptions||[])assert(t.from.every(x=>states.has(x))&&states.has(t.to)&&nonempty(t.guard)&&nonempty(t.carries),'Invalid interruption '+c.id)}
 const edges=new Set();for(const e of catalog.dependency_edges){assert(nodes.has(e.from)&&nodes.has(e.to),'Dangling dependency');assert(nonempty(e.carries),'Empty dependency payload');const key=e.from+'>'+e.to;assert(!edges.has(key),'Duplicate dependency');edges.add(key)}
 const seen=new Set(),active=new Set(),nodeMap=new Map(catalog.execution_nodes.map(x=>[x.id,x]));function visit(id){assert(!active.has(id),'Dependency cycle at '+id);if(seen.has(id))return;active.add(id);for(const dep of nodeMap.get(id).depends_on){assert(nodes.has(dep)&&edges.has(dep+'>'+id),'Missing dependency edge');visit(dep)}active.delete(id);seen.add(id)}
 for(const id of nodes)visit(id)
 // ONE derivation of the alias, and one reading of the row (FA-05). The anchor
 // and the contract address were both derived inline here, once lowercased and
 // once not, and nowhere else — which is how a report came to name `m152-commit`
 // for `M152.commit` and the audit recorded a task that does not exist. The row
 // was split on a bare `|`, which shifts every column after an escaped one.
 const aliasIssues=aliasProblems(catalog.execution_nodes.map(n=>n.id));assert(aliasIssues.length===0,'Alias integrity: '+aliasIssues[0])
 const queue=read('docs/evidence/backlog.md');for(const n of catalog.execution_nodes){const row=queue.split('\n').find(l=>l.includes(`id="${anchorOf(n.id)}"`));assert(row,'Missing human queue row '+n.id);const deps=[...cell(row,3).matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]);assert(JSON.stringify(deps)===JSON.stringify(n.depends_on),'Human queue dependency drift '+n.id);assert(row.includes(`system.html#${contractOf(n.id)}`),'Queue does not address final task contract '+n.id)}
 assert(edges.size===catalog.execution_nodes.reduce((n,x)=>n+x.depends_on.length,0),'Dependency edge/node mismatch')
 for(const c of catalog.items){assert(['deep','recipe','preserve'].includes(c.depth),'Invalid task depth');assert(c.implementation_in_this_change===false,'Spec falsely claims implementation');for(const k of ['solution','sources','tests','migration'])assert(nonempty(c[k]),'Missing task '+c.id+'.'+k);if(c.depth==='deep')for(const k of ['interfaces','invariants','failure_cases'])assert(nonempty(c[k]),'Missing deep contract '+c.id+'.'+k);assert(c.modules.every(x=>modules.has(x)),'Unknown card module');if(nodes.has(c.id))assert(JSON.stringify(c.depends_on)===JSON.stringify(nodeMap.get(c.id).depends_on),'Card dependency mismatch '+c.id)}
 for(const owner of [...model.entities,...catalog.items,...parts])assert(owner.sources.every(x=>x.path&&x.verification),'Unpinned owner source '+owner.id)
 const req=unique(catalog.requirements,'requirement');const origReq=[...original.requirements,...extensionRequirements];unique(origReq,'declared requirement');assert(req.size===origReq.length&&origReq.every(x=>req.has(x.id)),'Requirement coverage changed');for(const declared of extensionRequirements)assert(JSON.stringify(catalog.requirements.find(r=>r.id===declared.id))===JSON.stringify(declared),'Extension requirement drift');for(const r of catalog.requirements)checkTasks(r.work,r.id)
 for(const d of model.decisions){assert(d.status==='proposed'&&existsSync(path.join(root,d.path)),'Decision must resolve as proposed');checkTasks(d.tasks,d.id)}
 // Every citation is tied to an actual research blob. Separate-repo receipts are retained,
 // not re-fetched from the network or pretended to be checked out by CI.
 const receipts=json('docs/evidence/plans/2026-09-07-engineering-contracts/source-receipts.json')
 // The receipts file is a DATED record and keeps the addresses the research read. A citation
 // repinned onto the public history (scripts/lib/public-history.mjs) is found there by the
 // address it was first verified at, `repinned_from`, and must still quote the same excerpt.
 // A SIBLING citation's repin is judged by the closed list (siblingRepinProblem), and its new
 // address is re-read over the network by scripts/check-sibling-commits.mjs.
 const receiptKey=s=>[s.repository,s.commit,s.path,s.line].join(':');const receiptMap=new Map(receipts.map(s=>[receiptKey(s),s]));const blobs=new Map();let citations=0,stale=0,repinned=0
 const hist=verifySources?gitHistory(root):null
 const walk=v=>{if(!v||typeof v!=='object')return;if(v.path&&v.verification){citations++;if(v.verification==='current-design'){assert(existsSync(path.join(root,v.path)),'Missing design source');return}const from=v.repinned_from;const r=receiptMap.get(receiptKey(from?{...v,commit:from.commit,line:from.line}:v));assert(r&&(from?from.file_sha256:v.file_sha256)===r.file_sha256&&v.excerpt===r.excerpt,'Missing/mismatched citation receipt '+v.path);
 if(v.verification===STALE){assert(!from&&v.repository==='fabric','Stale citation must be an unrepinned fabric receipt '+v.path);if(hist){const problem=staleProblem({commit:v.commit,file:v.path,sha:v.file_sha256,line:v.line,excerpt:v.excerpt,stale:v.stale},hist);assert(!problem,'Stale citation '+v.path+': '+problem)}stale++;return}
 if(from){const sibling=v.repository!==undefined&&v.repository!=='fabric';if(sibling||hist){const problem=sibling?siblingRepinProblem(v):repinProblem(v,{sha:v.file_sha256,inHistory:hist.inHistory});assert(!problem,'Repinned citation '+v.path+': '+problem)}repinned++}assert(/^[0-9a-f]{40}$/.test(v.commit)&&Number.isInteger(v.line)&&v.line>0,'Unpinned source '+v.path);if(verifySources&&v.verification==='git-blob'){assert(v.repository==='fabric','Unsupported git source repository');const key=v.commit+':'+v.path;let blob=blobs.get(key);if(!blob){blob=execFileSync('git',['show',key],{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024});blobs.set(key,blob)}assert(createHash('sha256').update(blob).digest('hex')===v.file_sha256&&blob.split('\n')[v.line-1]===v.excerpt,'Source blob/excerpt drift '+v.path)}else assert(['git-blob','retained-sibling-receipt'].includes(v.verification),'Unknown citation verification mode '+v.verification)}for(const x of Object.values(v))walk(x)}
 walk(model);walk(catalog)
 return {tasks:cards.size,deep:catalog.items.filter(x=>x.depth==='deep').length,recipes:catalog.items.filter(x=>x.depth==='recipe').length,preserve:catalog.items.filter(x=>x.depth==='preserve').length,requirements:req.size,modules:modules.size,entities:entities.size,relations:relations.size,cycles:cycles.size,execution_nodes:nodes.size,dependency_edges:edges.size,citation_occurrences:citations,receipts:receipts.length,repinned_citations:repinned,stale_citations:stale,verified_git_files:blobs.size}
}
export function validateRendered(html,expected){assert(html===expected,'Stale generated system map');const walk=n=>[n,...(n.childNodes||[]).flatMap(walk)],tree=walk(parse(html));const attr=(n,k)=>n.attrs?.find(a=>a.name===k)?.value;const ids=tree.map(n=>attr(n,'id')).filter(Boolean);assert(ids.length===new Set(ids).size,'Duplicate generated anchors');for(const n of tree){const href=attr(n,'href');if(href?.startsWith('#'))assert(ids.includes(href.slice(1)),'Missing generated anchor '+href)}return ids.length}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=validateDesign(json('docs/architecture/system-model.json'),json('docs/architecture/engineering-specs.json'));result.html_anchors=validateRendered(read('docs/reports/system.html'),renderSystemMap());console.log('PASS: '+JSON.stringify(result));console.log('Scope: design integrity and pinned sources; not runtime behavior, future acceptance cases or production security.')
}
