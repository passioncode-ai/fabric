import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planProblems, PLAN_BEGIN, PLAN_END } from '../lib/plan-ids.mjs'
const plan = (rows) => `# Backlog\n${PLAN_BEGIN}\n| Lane | Outcome | Delivers |\n|---|---|---|\n${rows}\n${PLAN_END}\n`
const docs = { 'docs/evidence/plans/x.md': '| AR-7 | conversion |\n### N1 · real providers\n', 'docs/launch/adoption/packets/AD00.md': '# AD00' }
test('resolves ids defined by a row, a heading and a file, and the plan\'s own P-rows', () => {
  const b = plan('| P-01 | first run | AR-7, N1, AD00 |')
  assert.deepEqual(planProblems(b, { ...docs, 'docs/evidence/backlog.md': b }), [])
})
test('refuses an id nothing defines (the planted dangling id)', () => {
  const b = plan('| P-01 | first run | AR-7, AR-99 |')
  assert.deepEqual(planProblems(b, { ...docs, 'docs/evidence/backlog.md': b }), ['the plan cites AR-99, which no document under docs/ defines'])
})
test('an id defined only inside the plan block itself does not count as defined', () => {
  const b = plan('| P-01 | x | M999 |\n| M999 | fake | — |')
  assert.ok(planProblems(b, { 'docs/evidence/backlog.md': b }).some((p) => p.includes('M999')))
})
test('a missing block is a problem, not a pass', () => {
  assert.deepEqual(planProblems('# nothing', {}), ['the general plan block (general-plan:begin/end) is missing from docs/evidence/backlog.md'])
})
