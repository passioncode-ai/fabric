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

test('refuses an id-shaped token the gate does not know, instead of skipping it', () => {
  const b = plan('| 1 · x | y | z | AR-7, AR-2.99x, ZZ-9 |')
  const p = planProblems(b, { ...docs, 'docs/evidence/backlog.md': b })
  assert.ok(p.some((x) => x.includes('AR-2.99x')), p.join('\n'))
  assert.ok(p.some((x) => x.includes('ZZ-9')), p.join('\n'))
})
test('a lane that cites no work is a problem', () => {
  const b = plan('| 1 · empty | an outcome | ready now | — |\n| P-01 | x | open | y |')
  assert.ok(planProblems(b, { 'docs/evidence/backlog.md': b }).some((x) => x.includes('lane "1 · empty" cites no work')))
})
test('a lane that schedules finished work is a problem', () => {
  const files = { ...docs, 'docs/evidence/x.md': '| AD00 | thing | passed 2026-09-17 |\n| AD02 | other | open |' }
  const b = plan('| 5 · fit | y | z | AD00, AD02 |')
  const p = planProblems(b, { ...files, 'docs/evidence/backlog.md': b })
  assert.ok(p.some((x) => x.includes('AD00') && x.includes('finished')), p.join('\n'))
  assert.ok(!p.some((x) => x.includes('AD02')), 'open work is fine')
})
test('knows the plan ids the repository uses: FR-A, MEM-P1, F7, OX-03', () => {
  const files = { 'docs/a.md': '| FR-A extension | x |\n## MEM-P1 · capture\n| **F7 — remainder** | M98 |\n| OX-03 | x | open |\n| M98 | y | open |' }
  const b = plan('| 7 · rest | y | z | FR-A, MEM-P1, F7, OX-03, M98 |')
  assert.deepEqual(planProblems(b, { ...files, 'docs/evidence/backlog.md': b }), [])
})
test('a prerequisite that starts with "Passed …" is not a finished status', () => {
  const files = { 'docs/c.md': '| AD13 | Passed AD12 selection receipt plus the capture boundary | scope pinned |\n| AD14 | x | **shipped 2026-09-09** — closed by its own rest |' }
  const b = plan('| 4 · adopt | y | z | AD13, AD14 |')
  const p = planProblems(b, { ...files, 'docs/evidence/backlog.md': b })
  assert.ok(!p.some((x) => x.includes('AD13')), p.join('\n'))
  assert.ok(p.some((x) => x.includes('AD14') && x.includes('finished')), p.join('\n'))
})
