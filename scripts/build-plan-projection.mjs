// The wiki's /plan page renders THIS projection, never a second hand-written copy of
// the board. One parser reads the register (markdown-table.mjs, FA-05: `\|` is a
// literal pipe), and the projection is deterministic — same backlog bytes, same JSON —
// so `--check` is byte parity, the same contract build-product-report.mjs holds.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {cells} from './lib/markdown-table.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const read=p=>readFileSync(path.join(root,p),'utf8')
const sha256=v=>createHash('sha256').update(v).digest('hex')

const backlog=read('docs/evidence/backlog.md')
const lines=backlog.split('\n')

// The V1 milestone table: rows between the section heading and the next heading.
const v1Start=lines.findIndex(l=>l.startsWith('## V1 «Возврат в контекст»'))
if(v1Start<0) throw Error('V1 milestone section not found in the board')
const v1End=lines.findIndex((l,i)=>i>v1Start&&l.startsWith('## '))
const v1Rows=lines.slice(v1Start,v1End<0?undefined:v1End)
  .filter(l=>/^\|\s*V1-M\d/.test(l))
  .map(l=>{const c=cells(l).map(x=>x.trim());return {id:c[1],title:c[2],scope:c[3],exit:c[4],status:c[5]}})
if(!v1Rows.length) throw Error('V1 milestone rows not found')

// Build-order batches: the register's own bold first cells. Title only — the /plan
// page links into the board for the full row rather than restating it.
const batches=lines
  .filter(l=>/^\|\s*\*\*(F\d|F5A|DONE)/.test(l))
  .map(l=>{const first=cells(l)[1].trim().replace(/^\*\*|\*\*$/g,'');const sep=first.indexOf('—');
    return {id:(sep<0?first:first.slice(0,sep)).trim(),title:(sep<0?'':first.slice(sep+1)).trim()}})
if(!batches.length) throw Error('Build-order batch rows not found')

const projection={
  schema:1,
  generated_from:{'docs/evidence/backlog.md':sha256(backlog)},
  v1:{anchor:'docs/evidence/backlog.md',rows:v1Rows},
  batches,
  links:{
    backlog:'docs/evidence/backlog.md',
    build_order:'docs/evidence/backlog.md',
    plan:'docs/ux/plans/2026-09-12-v1-context-reentry.md',
    execution:'docs/ux/plans/2026-09-12-v1-execution-plan.md',
    design:'docs/ux/plans/2026-09-12-v1-design-language.md',
    merges:'docs/MERGES.md',
    changelog:'docs/reports/map.html'
  }
}
const out=JSON.stringify(projection,null,2)+'\n'
const file=path.join(root,'docs/reports/plan.json')
if(process.argv.includes('--check')){
  let current='';try{current=readFileSync(file,'utf8')}catch{}
  if(current!==out) throw Error('Plan projection stale: node scripts/build-plan-projection.mjs')
  console.log(`PASS plan projection: ${v1Rows.length} milestones, ${batches.length} batches`)
} else {
  mkdirSync(path.dirname(file),{recursive:true})
  writeFileSync(file,out)
  console.log(`Built docs/reports/plan.json (${v1Rows.length} milestones, ${batches.length} batches)`)
}
