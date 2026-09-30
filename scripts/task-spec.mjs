import {productSpec} from './product-spec.mjs'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {root} from './build-system-map.mjs'
const catalog=JSON.parse(readFileSync(path.join(root,'docs/architecture/engineering-specs.json'),'utf8'))
const id=process.argv[2],parent=catalog.items.find(c=>c.id===id||c.parts?.some(p=>p.id===id))
if(!parent){console.error('Usage: node scripts/task-spec.mjs <task ID>, for example M188 or M152.commit');process.exitCode=2}
else{
 const selected=parent.id===id?parent:parent.parts.find(p=>p.id===id)
 const deps=catalog.dependency_edges.filter(e=>e.to===id)
 console.log(`# ${id}: ${selected.title||parent.title}\n\nTarget specification; not an implementation receipt. Source baseline ${catalog.source_commit}.\n\n`+readFileSync(path.join(root,catalog.global_contract),'utf8')+`\n\n## Execution contract\n\n\`\`\`json\n${JSON.stringify(selected,null,2)}\n\`\`\`\n\n## Required input contracts\n\n\`\`\`json\n${JSON.stringify(deps,null,2)}\n\`\`\``)
 console.log(`\n## Visual UX handoff\n\n\`\`\`json\n${JSON.stringify(productSpec(parent.id),null,2)}\n\`\`\``)
 if(selected!==parent)console.log(`\n## Shared parent contract (all parts)\n\n\`\`\`json\n${JSON.stringify({...parent,parts:undefined},null,2)}\n\`\`\``)
}
