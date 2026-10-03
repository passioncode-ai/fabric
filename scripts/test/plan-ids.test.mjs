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

// ── iteration 2: the forms the reviewer planted on a copy of docs/ and watched pass ──
test('every closing word the workspace knows is finished here too, bold or dated', () => {
  const files = { 'docs/c.md': [
    '| CO-013 | x | **resolved 2026-08-25** — fixed |',
    '| M153 | x | **shipped** 2026-10-03 |',
    '| M158 | x | complete |',
    '| V1-M1 | x | готово |',
    '| AR-4 | x | cancelled |'
  ].join('\n') }
  const b = plan('| 1 · x | y | z | CO-013, M153, M158, V1-M1, AR-4 |')
  const p = planProblems(b, { ...files, 'docs/evidence/backlog.md': b })
  for (const id of ['CO-013', 'M153', 'M158', 'V1-M1', 'AR-4']) assert.ok(p.some((x) => x.includes(id) && x.includes('finished')), id + '\n' + p.join('\n'))
})
test('an adoption packet that passed — by its Status line or its receipt — is finished', () => {
  const files = {
    'docs/launch/adoption/packets/AD02.md': '# AD02\n\nStatus: **passed**. Plan, not implementation receipt.',
    'docs/launch/adoption/packets/AD03.md': '# AD03\n\nStatus: **blocked-on-receipts**.',
    'docs/launch/adoption/receipts/AD04.json': JSON.stringify({ packet: 'AD04', status: 'passed' }),
    'docs/launch/adoption/packets/AD04.md': '# AD04\n\nStatus: **blocked-on-receipts**.'
  }
  const b = plan('| 4 · adopt | y | z | AD02, AD03, AD04 |')
  const p = planProblems(b, { ...files, 'docs/evidence/backlog.md': b })
  assert.ok(p.some((x) => x.includes('AD02') && x.includes('finished')), p.join('\n'))
  assert.ok(p.some((x) => x.includes('AD04') && x.includes('finished')), 'a passed receipt outranks a stale Status line\n' + p.join('\n'))
  assert.ok(!p.some((x) => x.includes('AD03')), p.join('\n'))
})
test('a P-id resolves only from the plan table, never from a persona heading of the same id', () => {
  const files = { 'docs/ux/foundation.md': '### P-05: AI-native project builder' }
  const b = plan('| 1 · start | y | z | P-01, P-05 |\n| P-01 | x | open | y |')
  const p = planProblems(b, { ...files, 'docs/evidence/backlog.md': b })
  assert.ok(p.some((x) => x.includes('P-05')), p.join('\n'))
})
test('the closing vocabulary agrees with the workspace normaliser wherever that says done or cancelled', async (t) => {
  const { existsSync } = await import('node:fs')
  const lib = new URL('../../workspace/lib/backlog.mjs', import.meta.url)
  if (!existsSync(lib)) { t.skip('the workspace submodule is not initialised'); return }
  const { normalizeStatus } = await import(lib)
  const { CLOSING_WORDS, isFinished } = await import('../lib/plan-ids.mjs')
  for (const w of ['done', 'closed', 'resolved', 'shipped', 'complete', 'completed', 'закрыто', 'готово', 'решено', 'cancelled', 'canceled', 'dropped', 'superseded', 'отменено'])
    assert.ok(['done', 'cancelled'].includes(normalizeStatus(w)) && CLOSING_WORDS.includes(w) && isFinished(w), w)
  for (const w of ['open', 'partial', 'partly shipped', 'blocked', 'proposed', 'in progress']) assert.equal(isFinished(w), false, w)
})
