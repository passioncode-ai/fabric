// UX registries own behaviour. These compact report projections are generated,
// never a second editable copy of the scenario or flow wording.
import {readFileSync,writeFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const read=p=>readFileSync(path.join(root,p),'utf8')

const list=(text,pattern)=>[...new Set(text.match(pattern)||[])]
const field=(body,key)=>{const safe=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return body.match(new RegExp('^- \\*\\*'+safe+':\\*\\*\\s*(.*)$','m'))?.[1]?.trim()||''}
// Bound entries by Markdown structure, not by the next matching registry ID.
// Fenced examples are content, never headings. Metadata is read only from body;
// keyed appendix paragraphs contribute references, never status/coverage fields.
export function registrySections(raw,prefix,file='fixture.md'){
 const headings=[];let offset=0,fence=null,line=0
 for(const text of raw.split(/(?<=\n)/)){
  line++
  const mark=text.match(/^ {0,3}(`{3,}|~{3,})/)
  if(mark){if(!fence)fence=mark[1];else if(mark[1][0]===fence[0]&&mark[1].length>=fence.length)fence=null}
  else if(!fence){const h=text.match(/^(#{1,6}) (.+?)\s*$/);if(h)headings.push({depth:h[1].length,title:h[2],offset,line})}
  offset+=text.length
 }
 const seen=new Set(),rows=[]
 for(let i=0;i<headings.length;i++){
  const h=headings[i],m=h.title.match(new RegExp('^('+prefix+'-\\d+): (.+)$'))
  if(h.depth!==3||!m)continue
  if(seen.has(m[1]))throw Error('Duplicate registry identity '+m[1]+' in '+file)
  seen.add(m[1])
  const end=headings.slice(i+1).find(x=>x.depth<=h.depth)?.offset??raw.length
  rows.push({id:m[1],title:m[2],body:raw.slice(h.offset,end),start:h.offset,end,source:{file,line:h.line}})
 }
 return rows
}

export function keyedRefinements(raw,prefix,rows){
 const known=new Set(rows.map(x=>x.id)),out=new Map()
 // Only an explicitly keyed paragraph in an appendix can extend an entry.
 // Unkeyed headings/tables/group prose do not broadcast all references to all IDs.
 let fence=null
 const visible=raw.split(/(?<=\n)/).map(line=>{
  const mark=line.match(/^ {0,3}(`{3,}|~{3,})/),hidden=Boolean(fence)||Boolean(mark)
  if(mark){if(!fence)fence=mark[1];else if(mark[1][0]===fence[0]&&mark[1].length>=fence.length)fence=null}
  return hidden?line.replace(/[^\n]/g,' '):line
 }).join('')
 for(const m of visible.matchAll(/^(?:- )?((?:SCN|SCR|FLW)-\d+(?:\s*[,/]\s*(?:(?:SCN|SCR|FLW)-)?\d+)*):[^\n]*(?:\n(?!\s*$|#|(?:- )?(?:SCN|SCR|FLW)-)[^\n]+)*/gm)){
  if(rows.some(r=>m.index>=r.start&&m.index<r.end))continue
  let ownerPrefix=m[1].split('-')[0]
  const keys=m[1].split(/\s*[,/]\s*/).map(token=>{
   if(token.includes('-'))ownerPrefix=token.split('-')[0]
   return token.includes('-')?token:ownerPrefix+'-'+token
  })
  for(const id of keys.filter(id=>id.startsWith(prefix+'-'))){
   if(!known.has(id))throw Error('Unknown refinement identity '+id)
   // Expand shorthand across ALL prefixes before cross-reference extraction.
   out.set(id,(out.get(id)||'')+'\n'+keys.join(', ')+'\n'+m[0])
  }
 }
 return out
}

export function projectRegistries(input, sources){
const model=structuredClone(input)
const sections=(file,prefix)=>{const rows=registrySections(sources[file],prefix,file),extra=keyedRefinements(sources[file],prefix,rows);return rows.map(r=>({...r,references:r.body+'\n'+(extra.get(r.id)||'')}))}
model.scenarios=sections('docs/ux/scenarios.md','SCN').map(s=>({id:s.id,title:s.title,flow_ids:list(s.references,/FLW-\d+/g),screen_refs:list(s.references,/SCR-\d+/g),coverage:field(s.body,'Coverage')||'none yet',registry_status:field(s.body,'Status')||'draft',product_observation:field(s.body,'Product status')||field(s.body,'Product observation')||field(s.body,'Product')||'unobserved',expected_result:field(s.body,'Expected result'),errors_recovery:field(s.body,'Errors / recovery')||field(s.body,'Errors/recovery')||field(s.body,'Errors & recovery')||field(s.body,'Error / recovery')||field(s.body,'Error handling'),source:s.source}))
model.flows=sections('docs/ux/flows.md','FLW').map(f=>({id:f.id,title:f.title,goal:field(f.body,'Goal'),entry_points:field(f.body,'Entry points'),success_exit:field(f.body,'Success exit'),screen_refs:list(f.references,/SCR-\d+/g),source:f.source,mermaid_source:f.body.match(/```mermaid\n([\s\S]*?)```/)?.[1]?.trim()||'',status:'target_or_mixed_not_coverage_claim',scenario_ids:model.scenarios.filter(s=>s.flow_ids.includes(f.id)).map(s=>s.id)}))
for(const s of sections('docs/ux/screens.md','SCR')){
 const record=model.screens.find(x=>x.id===s.id);if(!record)throw Error('Missing visual record '+s.id)
 record.registry_evidence={file:s.source.file,line:s.source.line,coverage_claim:field(s.body,'Coverage')||'none yet',status_claim:field(s.body,'Status')||'designed'}
 record.flow_ids=list(s.references,/FLW-\d+/g)
 record.scenario_ids=[...new Set([...list(s.references,/SCN-\d+/g),...model.scenarios.filter(x=>x.screen_refs.includes(s.id)).map(x=>x.id)])]
 record.registry_additional_states=[...s.body.matchAll(/^\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*$/gm)].filter(x=>!['State','---','—'].includes(x[1].trim())).map(x=>({state:x[1].trim(),trigger:x[2].trim(),behavior:x[4].trim()}))
}
return model
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const files=['docs/ux/scenarios.md','docs/ux/flows.md','docs/ux/screens.md']
const model=projectRegistries(JSON.parse(read('docs/ux/product-model.json')),Object.fromEntries(files.map(f=>[f,read(f)])))
const out=JSON.stringify(model,null,2)+'\n',file=path.join(root,'docs/ux/product-model.json')
if(process.argv.includes('--check')){if(readFileSync(file,'utf8')!==out)throw Error('UX projection stale: node scripts/sync-product-ux.mjs');console.log('PASS UX projections match canonical registries')}
else {writeFileSync(file,out);console.log(`Synced ${model.scenarios.length} scenarios / ${model.flows.length} flows / ${model.screens.length} screens`)}

}
