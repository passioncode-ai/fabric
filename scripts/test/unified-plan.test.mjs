// #region unified-plan-tests — docs: docs/reports/2026-10-04-unified-execution/protocol.md#recovery-and-source-change
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { publicInputProblems } from '../unified-canonical-sources.mjs'
import { validatePlan as productionValidatePlan, frontier, taskPacket, selectedReport, REPORT, readPlan, parseArgs } from '../unified-plan.mjs'

const digest = s => createHash('sha256').update(s).digest('hex')
// The unit boundary receives a parser response. Actual pinned common-parser and
// compiler integration runs separately in build-unified-plan.test.mjs after
// workspace initialization; these fixtures need no private-repository access.
function fixtureInventory(root,revision) {
  const repository='https://github.com/passioncode-ai/fabric'
  const manifest=JSON.parse(readFileSync(join(root,'docs/backlog-sources.json'),'utf8'))
  const paths=[...new Set(['docs/backlog-sources.json',...manifest.sources.map(s=>s.path)])].sort()
  const tasks=manifest.sources.flatMap(source=>readFileSync(join(root,source.path),'utf8').split('\n').flatMap((line,i)=>{
    const m=line.match(/^\| (P-01|COM-01) \| ([^|]+) \| (open) \|$/)
    return m?[{key:`${repository}:${source.path}:${m[1]}`,id:m[1],path:source.path,title:m[2].trim(),status:m[3],line:i+1}]:[]
  }))
  return {schema:1,scope:'unit parser response',repository,commit:revision,declarations:manifest.sources,
    sources:paths.map(path=>({path,sha256:digest(readFileSync(join(root,path))),commit:revision})),tasks,contexts:[]}
}
const validatePlan=(plan,root)=>productionValidatePlan(plan,root,{inventoryReader:fixtureInventory,expectedPlanReader:null})
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'fabric-unified-plan-'))
  const source = '<!-- general-plan:begin -->\n| 1 · Start | outcome | none | P-01 |\n<!-- general-plan:end -->\n\n| ID | Packet | Status |\n|---|---|---|\n| P-01 | Start | open |\n'
  mkdirSync(join(root, 'docs/evidence'), { recursive: true })
  writeFileSync(join(root, 'docs/evidence/backlog.md'), source)
  const manifest = JSON.stringify({schema:1,repository:'https://github.com/passioncode-ai/fabric',sources:[{path:'docs/evidence/backlog.md',goal:'agent-workplace',kind:'tasks',format:'table',idColumn:'ID',titleColumn:'Packet',statusColumn:'Status'}]})
  writeFileSync(join(root,'docs/backlog-sources.json'),manifest)
  const git = (...args) => execFileSync('git',args,{cwd:root,stdio:['ignore','pipe','pipe']}).toString().trim()
  git('init','-q');git('add','docs')
  git('-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','canonical fixture')
  const revision=git('rev-parse','HEAD')
  const context = {
    outcome: 'A cold reader can reproduce the check',
    sources: ['docs/evidence/backlog.md'], scope: ['scripts/unified-plan.mjs'],
    steps: ['Read the pinned source', 'Execute the scoped negative control'],
    acceptance: ['The actual CLI exits nonzero on omitted canonical work'],
    risks: ['Source changes invalidate dispatch'],
    stop_conditions: ['Stop on source drift'], resume: 'Reconcile the source and regenerate the cut',
  }
  const inventory=fixtureInventory(root,revision)
  const plan = { schema: 1, baseline: revision, constraints: ['Canonical register owns delivery status'], canonical_inventory:inventory,
    sources: [{ path: 'docs/evidence/backlog.md', sha256: digest(source),commit:revision },{path:'docs/backlog-sources.json',sha256:digest(manifest),commit:revision}],
    lanes: [{ number: 1, canonical_ids: ['P-01'] }],
    tasks: [{ id: 'P-01.design', title: 'Reconcile start', canonical_ids: ['P-01'], canonical_keys:[inventory.tasks[0].key],lane: 1,
      kind: 'design', dispatch: 'candidate', priority_group: 0, depends_on: [], context }], impacts: [] }
  try { run({ root, plan, source, context }) } finally { rmSync(root, { recursive: true, force: true }) }
}
test('complete packet preserves program constraints and exact leaf context', () => fixture(({root, plan}) => {
  assert.deepEqual(validatePlan(plan, root), [])
  assert.equal(taskPacket(plan, 'P-01.design').task.context.outcome, plan.tasks[0].context.outcome)
  assert.equal(frontier(plan).ready[0].id, 'P-01.design')
}))
test('omitted canonical work cannot pass the coverage gate', () => fixture(({root, plan}) => {
  plan.tasks = []
  assert.match(validatePlan(plan, root).join('\n'), /P-01.*uncovered/)
}))
test('changed source blocks a previously complete packet', () => fixture(({root, plan}) => {
  writeFileSync(join(root, 'docs/evidence/backlog.md'), 'changed source')
  assert.match(validatePlan(plan, root).join('\n'), /source changed/)
}))
test('every context source is pinned; an untargeted blocking finding is refused', () => fixture(({root, plan}) => {
  writeFileSync(join(root, 'docs/evidence/contract.md'), 'untracked contract')
  plan.tasks[0].context.sources.push('docs/evidence/contract.md')
  plan.impacts = [{id: 'I-1', targets: [], severity: 'blocking', disposition: 'open', evidence: 'source', action: 'revise'}]
  const problems = validatePlan(plan, root).join('\n')
  assert.match(problems, /unpinned context source/)
  assert.match(problems, /nonempty targets/)
}))
test('blocking finding stops only its affected task until explicitly resolved', () => fixture(({root, plan}) => {
  plan.impacts = [{ id: 'I-1', targets: ['P-01'], severity: 'blocking', disposition: 'open', evidence: 'primary source', action: 'Revise contract' }]
  assert.equal(frontier(plan).ready.length, 0)
  assert.deepEqual(frontier(plan).held[0].reasons, ['impact I-1'])
  plan.impacts[0].disposition = 'incorporated'
  plan.impacts[0].resolution = 'Packet now includes corrected contract'
  assert.equal(frontier(plan).ready.length, 1)
}))
test('cycles, missing payloads and unknown dependencies are refused', () => fixture(({root, plan, context}) => {
  plan.tasks[0].depends_on = [{id: 'T-2', carries: ''}]
  plan.tasks.push({ ...plan.tasks[0], id: 'T-2', depends_on: [{id: 'P-01.design', carries: 'control: reviewed output'}], context })
  assert.match(validatePlan(plan, root).join('\n'), /cycle/)
  assert.match(validatePlan(plan, root).join('\n'), /missing dependency payload/)
  plan.tasks[0].depends_on = [{id: 'absent', carries: 'data: artifact'}]
  assert.match(validatePlan(plan, root).join('\n'), /unknown dependency/)
}))
test('unknown impact targets, path escape and empty cold context are refused', () => fixture(({root, plan}) => {
  plan.sources[0].path = '../secret'
  delete plan.tasks[0].context.acceptance
  plan.impacts = [{id: 'I-1', targets: ['UNKNOWN'], severity: 'blocking', disposition: 'open', evidence: 'source', action: 'act'}]
  const problems = validatePlan(plan, root).join('\n')
  assert.match(problems, /unsafe source path/)
  assert.match(problems, /missing context acceptance/)
  assert.match(problems, /unknown impact target/)
}))
test('external owner and human gate do not become runnable with a delivered message', () => fixture(({plan}) => {
  plan.tasks[0].dispatch = 'owned-elsewhere'
  assert.equal(frontier(plan).ready.length, 0)
  plan.tasks[0].dispatch = 'operator-gated'
  assert.equal(frontier(plan).ready.length, 0)
}))
test('canonical priority precedes computed downstream count; dependency requires done proof', () => fixture(({plan, context}) => {
  plan.tasks.push({ ...plan.tasks[0], id: 'T-2', priority_group: 1, depends_on: [], context })
  plan.tasks.push({ ...plan.tasks[0], id: 'T-3', priority_group: 1, depends_on: [{id: 'T-2', carries: 'data: reviewed contract'}], context })
  assert.equal(frontier(plan).ready[0].id, 'P-01.design')
  assert(frontier(plan).held.find(x => x.id === 'T-3'))
  plan.tasks[1].dispatch = 'done'
  plan.tasks[1].evidence = {path: 'checks/receipt.json', sha256: 'a'.repeat(64)}
  assert(frontier(plan).ready.find(x => x.id === 'T-3'))
}))
test('a missing or changed completion receipt fails validation', () => fixture(({root, plan}) => {
  plan.tasks[0].dispatch = 'done'
  plan.tasks[0].evidence = {path: 'missing.json', sha256: 'a'.repeat(64)}
  assert.match(validatePlan(plan, root).join('\n'), /evidence unreadable/)
  writeFileSync(join(root, 'missing.json'), 'actual receipt')
  assert.match(validatePlan(plan, root).join('\n'), /evidence changed/)
  plan.tasks[0].evidence.sha256 = digest('actual receipt')
  assert.deepEqual(validatePlan(plan, root), [])
}))
test('a new blocking impact invalidates completed prerequisite satisfaction', () => fixture(({plan, context}) => {
  plan.tasks[0].dispatch = 'done'
  plan.tasks[0].evidence = {path: 'checks/receipt.json', sha256: 'a'.repeat(64)}
  plan.tasks.push({...plan.tasks[0], id: 'NEXT', canonical_ids: ['NEXT'], dispatch: 'candidate', depends_on: [{id: 'P-01.design', carries: 'data: approved contract'}], context})
  plan.impacts = [{id: 'I-1', targets: ['P-01'], severity: 'blocking', disposition: 'open', evidence: 'contract source', action: 'revise contract'}]
  assert.equal(frontier(plan).ready.length, 0)
  assert.match(frontier(plan).held[0].reasons.join('\n'), /requires P-01.design/)
}))
test('write scope cannot escape the repo directly or through a linked parent', () => fixture(({root, plan}) => {
  plan.tasks[0].context.scope = ['../../outside-owner.json']
  assert.match(validatePlan(plan, root).join('\n'), /unsafe write scope/)
  symlinkSync(tmpdir(), join(root, 'escape'))
  plan.tasks[0].context.scope = ['escape/outside-owner.json']
  assert.match(validatePlan(plan, root).join('\n'), /write scope escapes/)
}))
test('a broad unreviewed parent cannot be promoted to candidate by dropping dependencies', () => fixture(({root, plan}) => {
  plan.tasks[0].kind = 'design-review'
  assert.match(validatePlan(plan, root).join('\n'), /broad parent cannot dispatch/)
  plan.tasks[0].id = 'P-01.design.prepare'
  assert.deepEqual(validatePlan(plan, root), [])
}))

test('a newly declared canonical source cannot hide outside the general-plan lanes', () => fixture(({root, plan}) => {
  const source = '| ID | Packet | Status |\n|---|---|---|\n| COM-01 | Contract and source map | open |\n'
  writeFileSync(join(root, 'docs/evidence/com.md'), source)
  writeFileSync(join(root, 'docs/backlog-sources.json'), JSON.stringify({schema:1, repository:'https://github.com/passioncode-ai/fabric', sources:[
    {path:'docs/evidence/com.md',goal:'agent-workplace',kind:'tasks',format:'table',idColumn:'ID',titleColumn:'Packet',statusColumn:'Status'}
  ]}))
  assert.match(validatePlan(plan, root).join('\n'), /canonical.*inventory|canonical.*coverage|uncovered.*COM-01/i)
}))

test('source pins cannot substitute a different or forged immutable commit', () => fixture(({root, plan}) => {
  plan.sources[0].commit = 'f'.repeat(40)
  assert.match(validatePlan(plan, root).join('\n'), /source revision mismatch/)
}))
test('identical IDs in different canonical files retain both owner identities', () => fixture(({root, plan}) => {
  const path='docs/evidence/other.md'
  const source='| ID | Packet | Status |\n|---|---|---|\n| P-01 | Independent owning source | open |\n'
  writeFileSync(join(root,path),source)
  const manifest=JSON.parse(readFileSync(join(root,'docs/backlog-sources.json'),'utf8'))
  manifest.sources.push({...manifest.sources[0],path})
  writeFileSync(join(root,'docs/backlog-sources.json'),JSON.stringify(manifest))
  execFileSync('git',['add','docs'],{cwd:root})
  execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','second owner source'],{cwd:root})
  plan.baseline=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()
  plan.canonical_inventory=fixtureInventory(root,plan.baseline)
  plan.sources=plan.canonical_inventory.sources
  assert.match(validatePlan(plan,root).join('\n'), /uncovered canonical task: P-01.*other.md/)
  const row=plan.canonical_inventory.tasks.find(t=>t.path===path)
  plan.tasks.push({...plan.tasks[0],id:'second-owner',canonical_keys:[row.key],context:{...plan.tasks[0].context,sources:[path]}})
  assert.deepEqual(validatePlan(plan,root),[])
}))
test('held canonical source references cannot become executable by removing dependencies',()=>fixture(({root,plan})=>{
  plan.tasks[0].kind='canonical-source-review'
  assert.match(validatePlan(plan,root).join('\n'),/held canonical source reference cannot dispatch/)
}))
test('one current pointer selects only a report path and explicit selection stays reproducible',()=>fixture(({root})=>{
  assert.equal(selectedReport(root),REPORT)
  writeFileSync(join(root,'docs/unified-plan-current.json'),JSON.stringify({schema:1,report:'docs/reports/new-cut'}))
  assert.equal(selectedReport(root),'docs/reports/new-cut')
  assert.equal(selectedReport(root,REPORT),REPORT)
  writeFileSync(join(root,'docs/unified-plan-current.json'),JSON.stringify({schema:1,report:'docs/reports/new-cut',status:'done'}))
  assert.throws(()=>selectedReport(root),/only schema and report path/)
  writeFileSync(join(root,'docs/unified-plan-current.json'),JSON.stringify({schema:1,report:'../outside'}))
  assert.throws(()=>selectedReport(root),/invalid current plan pointer/)
}))
test('privacy diagnostics redact matching source paths without echoing a private literal',()=>{
  const problems=publicInputProblems([{path:'docs/SYNTHETIC_PRIVATE_SENTINEL.json',bytes:Buffer.from('SYNTHETIC_PRIVATE_SENTINEL')}],['SYNTHETIC_PRIVATE_SENTINEL'])
  assert.deepEqual(problems,['private input refused: <redacted source path>'])
})
test('default selection is unchanged and explicit new cut reads its own plan', () => fixture(({root, plan}) => {
  assert.deepEqual(parseArgs([]), {report: REPORT, verb: 'check', id: undefined})
  mkdirSync(join(root, REPORT), {recursive: true})
  writeFileSync(join(root, REPORT, 'plan.json'), JSON.stringify(plan))
  const next = 'docs/reports/new-cut/dispatch'
  mkdirSync(join(root, next), {recursive: true})
  writeFileSync(join(root, next, 'plan.json'), JSON.stringify({...plan, baseline: 'b'.repeat(40)}))
  assert.equal(readPlan(root).baseline, plan.baseline)
  assert.equal(readPlan(root, next).baseline, 'b'.repeat(40))
  assert.deepEqual(parseArgs(['packet', 'P-01.design', '--report', next]), {report: next, verb: 'packet', id: 'P-01.design'})
}))
test('selector refuses malformed options, path traversal and linked report or plan', () => fixture(({root, plan}) => {
  for (const args of [['--unknown'], ['--report'], ['--report', 'x', '--report', 'y'], ['packet'], ['check', 'extra']]) assert.throws(() => parseArgs(args), /unknown option|usage/)
  for (const path of ['/tmp/report', '../report', 'docs/../report', 'docs//report', './report', 'C:/report', 'docs\\report']) assert.throws(() => readPlan(root, path), /unsafe report/)
  mkdirSync(join(root, 'real-report'))
  writeFileSync(join(root, 'real-report/plan.json'), JSON.stringify(plan))
  symlinkSync(join(root, 'real-report'), join(root, 'linked-report'))
  assert.throws(() => readPlan(root, 'linked-report'), /symlink/)
  mkdirSync(join(root, 'linked-plan'))
  symlinkSync(join(root, 'real-report/plan.json'), join(root, 'linked-plan/plan.json'))
  assert.throws(() => readPlan(root, 'linked-plan'), /symlink/)
  symlinkSync(tmpdir(), join(root, 'outside'))
  assert.throws(() => readPlan(root, 'outside/new-report'), /symlink/)
}))
test('compiler rejects unknown options/baselines and unsafe cuts before reading or writing inputs', () => fixture(({root}) => {
  const compiler = fileURLToPath(new URL('../build-unified-plan.py', import.meta.url))
  const deny = join(root, 'privacy.local.json')
  writeFileSync(deny, '[]')
  const run = args => spawnSync('python3', [compiler, ...args, '--privacy-deny-file', deny], {encoding: 'utf8'})
  for (const [args, message] of [
    [['--unknown', '--report', 'docs/reports/new-cut', '--baseline', 'a'.repeat(40)], /unrecognized arguments/],
    [['--report', '../outside', '--baseline', 'a'.repeat(40)], /unsafe report/],
    [['--report', 'docs/reports/new-cut'], /required.*--source-revision/],
    [['--report', 'docs/reports/new-cut', '--baseline', 'HEAD'], /full lowercase/],
    [['--report', 'docs/reports/new-cut', '--baseline', 'a'.repeat(40)], /unknown baseline/],
    [['--baseline', 'a'.repeat(40)], /generation requires --output/],
    [['--report', REPORT, '--baseline', 'a'.repeat(40)], /Refusing to overwrite/],
  ]) { const result = run(args); assert.notEqual(result.status, 0); assert.match(result.stderr, message) }
  // A report selector must never follow even an internal directory symlink.
  mkdirSync(join(root, 'docs/reports'), {recursive: true})
  const linked = join(root, 'docs/reports/linked')
  symlinkSync(tmpdir(), linked)
  mkdirSync(join(root, 'scripts'))
  const isolatedCompiler = join(root, 'scripts/build-unified-plan.py')
  copyFileSync(compiler, isolatedCompiler)
  const result = spawnSync('python3', [isolatedCompiler, '--report', 'docs/reports/linked', '--baseline', 'a'.repeat(40), '--privacy-deny-file', deny], {encoding: 'utf8'})
  assert.equal(result.status, 2)
  assert.match(result.stderr, /symlink/)
}))
// #endregion unified-plan-tests
