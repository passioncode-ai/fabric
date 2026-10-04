// #region unified-plan-tests — docs: docs/reports/2026-10-04-unified-execution/protocol.md#recovery-and-source-change
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { validatePlan, frontier, taskPacket } from '../unified-plan.mjs'

const digest = s => createHash('sha256').update(s).digest('hex')
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'fabric-unified-plan-'))
  const source = '<!-- general-plan:begin -->\n| 1 · Start | outcome | none | P-01 |\n<!-- general-plan:end -->\n'
  mkdirSync(join(root, 'docs/evidence'), { recursive: true })
  writeFileSync(join(root, 'docs/evidence/backlog.md'), source)
  const context = {
    outcome: 'A cold reader can reproduce the check',
    sources: ['docs/evidence/backlog.md'], scope: ['scripts/unified-plan.mjs'],
    steps: ['Read the pinned source', 'Execute the scoped negative control'],
    acceptance: ['The actual CLI exits nonzero on omitted canonical work'],
    risks: ['Source changes invalidate dispatch'],
    stop_conditions: ['Stop on source drift'], resume: 'Reconcile the source and regenerate the cut',
  }
  const plan = { schema: 1, baseline: 'a'.repeat(40), constraints: ['Canonical register owns delivery status'],
    sources: [{ path: 'docs/evidence/backlog.md', sha256: digest(source) }],
    lanes: [{ number: 1, canonical_ids: ['P-01'] }],
    tasks: [{ id: 'P-01.design', title: 'Reconcile start', canonical_ids: ['P-01'], lane: 1,
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
// #endregion unified-plan-tests
