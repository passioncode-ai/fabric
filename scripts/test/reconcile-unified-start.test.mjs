// #region unified-start-review-tests — docs: docs/reports/2026-10-04-unified-execution/protocol.md#recovery-and-source-change
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, symlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { reconcileStart, parseStartArgs } from '../reconcile-unified-start.mjs'

const owner = fileURLToPath(new URL('../..', import.meta.url)), hash = s => createHash('sha256').update(s).digest('hex')
const report = 'docs/reports/overlay-fixture', reviewPath = `${report}/current-start-review.json`
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'fabric-start-review-'))
  // No detached auto-gc/maintenance: it writes into .git while the fixture is being removed (ENOTEMPTY).
  const git = (...args) => execFileSync('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']}).toString().trim()
  const write = (path, value) => {mkdirSync(dirname(join(root, path)), {recursive: true});writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value))}
  const source = 'docs/evidence/backlog.md'
  write(source, '<!-- general-plan:begin -->\n| 1 · Start | Start | none | CO-180, P-01 |\n<!-- general-plan:end -->\n')
  const manifest = 'docs/backlog-sources.json';write(manifest, {schema: 1, sources: [{path: source}]})
  for (const path of ['scripts/reconcile-unified-start.mjs', 'scripts/unified-plan.mjs', 'scripts/unified-canonical-sources.mjs']) {mkdirSync(dirname(join(root,path)),{recursive:true});copyFileSync(join(owner,path),join(root,path))}
  const context = {outcome:'One bounded Start deliverable',sources:[source],scope:['docs/handoffs/start.json'],steps:['Run scoped check'],acceptance:['Exact owned receipt'],risks:['Native remains NOT_RUN'],stop_conditions:['Missing authority refuses effect'],resume:'Reconcile committed inputs'}
  const packet = `${report}/CO-180.prepare.json`, evidence = `${report}/CO-180-check.json`
  write(packet, {schema:1,id:'CO-180.prepare',context});write(evidence, {task:'CO-180.prepare',scope:'design preparation only',native:'NOT_RUN'})
  const review = {schema:1,review:[{id:'CO-180.prepare',dispatch:'done',packet,evidence:{path:evidence,scope:'CO-180.prepare'}}]}
  write(reviewPath,review)
  git('init','-q')
  const commit = () => {git('add','docs','scripts',':(exclude)'+report+'/plan.json');git('-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','review source');return git('rev-parse','HEAD')}
  let revision = commit()
  const inventoryReader = (_root, rev) => ({schema:1,commit:rev,sources:[source,manifest].map(path=>({path,sha256:hash(readFileSync(join(root,path))),commit:rev})),tasks:[{key:'fabric:'+source+':CO-180',id:'CO-180',path:source}],contexts:[]})
  const plan = () => ({schema:1,baseline:revision,constraints:['Canonical status and native authority preserved'],canonical_inventory:inventoryReader(root,revision),sources:[source,manifest].map(path=>({path,sha256:hash(readFileSync(join(root,path))),commit:revision})),lanes:[{number:1,canonical_ids:['CO-180','P-01']}],tasks:[{id:'CO-180',canonical_ids:['CO-180'],canonical_keys:['fabric:'+source+':CO-180'],lane:1,title:'Whole feature remains held',kind:'design-review',dispatch:'design-gated',priority_group:0,depends_on:[{id:'CO-180.prepare',carries:'Preparation-only dossier'}],context},{id:'CO-180.prepare',canonical_ids:['CO-180'],canonical_keys:['fabric:'+source+':CO-180'],lane:1,title:'Prepare one leaf',kind:'activation-design',dispatch:'design-gated',priority_group:0,depends_on:[],historical_dispatch:'done',historical_evidence:{path:'old.json',scope:'old pure preparation',source_revision:'a'.repeat(40)},context:{...context,research_provenance:{source_revision:'a'.repeat(40)}}},{id:'P-01',canonical_ids:['P-01'],canonical_keys:[],lane:1,title:'Start umbrella remains held',kind:'design-review',dispatch:'design-gated',priority_group:0,depends_on:[],context},{id:'P-01.prepare',canonical_ids:['P-01'],canonical_keys:[],lane:1,title:'Prepare umbrella reconciliation',kind:'activation-design',dispatch:'design-gated',priority_group:0,depends_on:[],context}],impacts:[]})
  const deny=join(root,'privacy.local.json');writeFileSync(deny,'[]')
  const reset = () => write(report+'/plan.json',plan());reset()
  const apply=()=>reconcileStart({root,report,review:reviewPath,privacyFile:deny},{inventoryReader})
  const unchangedFailure = pattern => {const bytes=readFileSync(join(root,report,'plan.json'));assert.throws(apply,pattern);assert.deepEqual(readFileSync(join(root,report,'plan.json')),bytes);assert(!existsSync(join(root,report,'.start-review.lock')))}
  try {run({root,review,packet,evidence,context,write,apply,plan,reset,deny,unchangedFailure,commit:()=>{revision=commit();reset();return revision},get revision(){return revision}})} finally {rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:50})}
}
test('explicit reviewed preparation is completed with current pins; parent and historical proof remain held',()=>fixture(f=>{
  const next=f.apply(), leaf=next.tasks.find(t=>t.id==='CO-180.prepare')
  assert.equal(leaf.dispatch,'done');assert.equal(leaf.evidence.scope,leaf.id);assert.equal(leaf.evidence.source_revision,f.revision)
  assert.equal(next.tasks.find(t=>t.id==='CO-180').dispatch,'design-gated')
  assert.equal(leaf.historical_evidence.source_revision,'a'.repeat(40));assert.equal(leaf.context.research_provenance.source_revision,'a'.repeat(40))
  for(const path of [reviewPath,f.packet,f.evidence,'scripts/reconcile-unified-start.mjs'])assert(next.sources.some(p=>p.path===path&&p.commit===f.revision&&p.sha256===hash(readFileSync(join(f.root,path)))))
  assert.match(next.start_review.adapter_projection,/predecessor snapshots/)
  assert.deepEqual(f.apply(),next,'repeating the committed overlay is deterministic')
}))
test('uncommitted evidence, packet, review and executable code refuse before replacing plan',()=>fixture(f=>{
  for(const path of [f.evidence,f.packet,reviewPath,'scripts/reconcile-unified-start.mjs']){
    const before=readFileSync(join(f.root,path));writeFileSync(join(f.root,path),Buffer.concat([before,Buffer.from('\n ')]))
    f.unchangedFailure(/uncommitted|differs/);writeFileSync(join(f.root,path),before)
  }
}))
test('P-01 preparation may reconcile the Start umbrella while parent and other preparations remain held',()=>fixture(f=>{
  f.review.review=[{id:'P-01.prepare',dispatch:'done',packet:f.packet,evidence:{path:f.evidence,scope:'P-01.prepare'}}]
  f.write(f.packet,{schema:1,id:'P-01.prepare',context:f.context});f.write(reviewPath,f.review);f.commit()
  const next=f.apply();assert.equal(next.tasks.find(t=>t.id==='P-01.prepare').dispatch,'done')
  assert.equal(next.tasks.find(t=>t.id==='P-01').dispatch,'design-gated');assert.equal(next.tasks.find(t=>t.id==='CO-180.prepare').dispatch,'design-gated')
}))
test('whole parent closure and activation attempts cannot be smuggled through preparation review',()=>fixture(f=>{
  f.review.review[0].id='CO-180';f.write(reviewPath,f.review);f.commit();f.unchangedFailure(/only distinct existing Start preparation/)
  f.review.review=[];f.review.new_tasks=[{id:'CO-180',dispatch:'done'}];f.write(reviewPath,f.review);f.commit();f.unchangedFailure(/distinct bounded Start child/)
}))
test('wrong evidence scope and missing current proof are refused',()=>fixture(f=>{
  f.review.review[0].evidence.scope='CO-180';f.write(reviewPath,f.review);f.commit();f.unchangedFailure(/evidence scope/)
  f.review.review[0].evidence.scope='CO-180.prepare';delete f.review.review[0].evidence;f.write(reviewPath,f.review);f.commit();f.unchangedFailure(/lacks current bounded evidence/)
}))
test('a new context source absent from the baseline cannot be silently pinned',()=>fixture(f=>{
  f.write(f.packet,{schema:1,id:'CO-180.prepare',context:{...f.context,sources:[...f.context.sources,'docs/handoffs/uncommitted-contract.json']}})
  f.commit();f.write('docs/handoffs/uncommitted-contract.json',{unreviewed:true});f.unchangedFailure(/absent from immutable source/)
}))
test('bounded child can close only its exact explicit receipt, never activate an implementation',()=>fixture(f=>{
  f.review.new_tasks=[{...f.plan().tasks[0],id:'CO-180.1',title:'One observed bounded implementation',kind:'implementation',dispatch:'done',depends_on:[],context:{...structuredClone(f.context),scope:[f.packet]},evidence:{path:f.evidence,scope:'CO-180.1'}}]
  f.write(reviewPath,f.review);f.commit()
  const next=f.apply();assert.equal(next.tasks.find(t=>t.id==='CO-180.1').dispatch,'done');assert.equal(next.tasks.find(t=>t.id==='CO-180').dispatch,'design-gated')
  f.review.new_tasks[0].dispatch='candidate';f.write(reviewPath,f.review);f.commit();f.unchangedFailure(/cannot be activated/)
}))
test('completed bounded implementation scope cannot hide changed code outside context sources',()=>fixture(f=>{
  const implemented='scripts/owned-start-code.mjs';f.write(implemented,'export const fixture = 1\n')
  f.review.new_tasks=[{...f.plan().tasks[0],id:'CO-180.1',title:'Bounded code receipt',kind:'implementation',dispatch:'done',depends_on:[],context:{...structuredClone(f.context),scope:[implemented]},evidence:{path:f.evidence,scope:'CO-180.1'}}]
  f.write(reviewPath,f.review);f.commit()
  f.write(implemented,'export const fixture = 2\n');f.unchangedFailure(/uncommitted|differs/)
}))
test('unsafe paths, linked evidence and a private decoded packet refuse without output changes',()=>fixture(f=>{
  f.review.review[0].packet='../outside';f.write(reviewPath,f.review);f.commit();f.unchangedFailure(/unsafe review input/)
  f.review.review[0].packet=f.packet;f.review.review[0].evidence.path=report+'/linked.json';symlinkSync(join(f.root,f.evidence),join(f.root,report,'linked.json'));f.write(reviewPath,f.review);f.commit();f.unchangedFailure(/linked review input/)
  f.review.review[0].evidence.path=f.evidence;f.write(reviewPath,f.review);f.write(f.packet,{schema:1,id:'CO-180.prepare',context:{...f.context,risks:['PRIVATE_OVERLAY_SENTINEL']}});f.commit();writeFileSync(f.deny,JSON.stringify(['PRIVATE_OVERLAY_SENTINEL']));f.unchangedFailure(/private input refused/)
}))
test('overlay options are explicit and reject unknown, duplicate or missing values',()=>{
  assert.deepEqual(parseStartArgs(['--report','docs/reports/x','--review','docs/reports/x/review.json','--privacy-deny-file','/tmp/local.json']),{report:'docs/reports/x',review:'docs/reports/x/review.json',privacyFile:'/tmp/local.json'})
  for(const args of [[],['--unknown','x'],['--report'],['--report','x','--report','y']])assert.throws(()=>parseStartArgs(args),/usage|required/)
})
// #endregion unified-start-review-tests
