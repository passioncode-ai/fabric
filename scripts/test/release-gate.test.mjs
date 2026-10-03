import { test } from 'node:test'
import assert from 'node:assert/strict'
import { releaseGateProblems } from '../lib/release-gate.mjs'

const gateText = JSON.stringify({ version: '0.3.0', ledger: 'docs/evidence/plans/x.md' })
const iteration = (n, exit = true) => `## Iteration ${n}\n\n[report](x/iteration-${n}/r.md)\n\n| ID | Disposition |\n|---|---|\n| V${n}-1 | fixed: a |\n\n${exit ? `Exit for iteration ${n}: every finding fixed or ruled. Blocking findings open: none.` : 'Exit for iteration 2: Blocking findings open: V2-3.'}\n`
const ledger = (...parts) => `# Ledger\n\n## Protocol\n\nx\n\n${parts.join('\n')}`

test('three iterations, each closed with none blocking, clear the release', () => {
  assert.deepEqual(releaseGateProblems({ version: '0.3.0', gateText, ledgerText: ledger(iteration(1), iteration(2), iteration(3)) }), [])
})
test('an iteration not started, or ending with a blocking finding, refuses', () => {
  const p = releaseGateProblems({ version: '0.3.0', gateText, ledgerText: ledger(iteration(1), iteration(2, false), '## Iteration 3\n\n_Not started._\n') })
  assert.ok(p.some((x) => x.includes('iteration 2 must end')), p.join('\n'))
  assert.ok(p.some((x) => x.includes('iteration 3 has not started')), p.join('\n'))
})
test('a gate for another version, or none, refuses', () => {
  assert.match(releaseGateProblems({ version: '0.4.0', gateText, ledgerText: ledger(iteration(1), iteration(2), iteration(3)) })[0], /names version 0.3.0, the app is 0.4.0/)
  assert.match(releaseGateProblems({ version: '0.3.0', gateText: '', ledgerText: '' })[0], /missing or not JSON/)
})
test('the real gate file and ledger refuse while iteration 3 has not started', async (t) => {
  const { readFileSync } = await import('node:fs')
  const root = new URL('../../', import.meta.url)
  const gt = readFileSync(new URL('docs/launch/release-gate.json', root), 'utf8')
  const gate = JSON.parse(gt)
  const ledgerText = readFileSync(new URL(gate.ledger, root), 'utf8')
  if (!/^## Iteration 3\s*\n+_Not started\._/m.test(ledgerText)) { t.skip('iteration 3 has started; the gate is judged by the cases above'); return }
  const p = releaseGateProblems({ version: gate.version, gateText: gt, ledgerText })
  assert.ok(p.length > 0, 'the gate must not be clear before iteration 3 closes')
})

test('the verdict is computed: an open row, a second heading, a hidden blocking line, a missing report link or a ledger outside docs/ refuse', () => {
  const ok = [iteration(1), iteration(2)]
  const open3 = '## Iteration 3\n\n[r](x/iteration-3/r.md)\n\n| V3-1 | blocking | open |\n\nExit for iteration 3: done. Blocking findings open: none.\n'
  assert.ok(releaseGateProblems({ version: '0.3.0', gateText, ledgerText: ledger(...ok, open3) }).some((x) => x.includes('V3-1 has no disposition')))
  const twice = ledger(...ok, iteration(3), '## Iteration 3\n\n_Not started._\n')
  assert.ok(releaseGateProblems({ version: '0.3.0', gateText, ledgerText: twice }).some((x) => x.includes('2 "## Iteration 3" headings')))
  const hidden = '## Iteration 3\n\n[r](x/iteration-3/r.md)\n\nBlocking findings open: none.\n\nExit for iteration 3: Blocking findings open: V3-4.\n'
  assert.ok(releaseGateProblems({ version: '0.3.0', gateText, ledgerText: ledger(...ok, hidden) }).some((x) => x.includes('iteration 3 must end')))
  const nolink = '## Iteration 3\n\n| V3-1 | fixed |\n\nExit for iteration 3: x. Blocking findings open: none.\n'
  assert.ok(releaseGateProblems({ version: '0.3.0', gateText, ledgerText: ledger(...ok, nolink) }).some((x) => x.includes('links no reviewer report')))
  assert.match(releaseGateProblems({ version: '0.3.0', gateText: JSON.stringify({ version: '0.3.0', ledger: '../../etc/x.md' }), ledgerText: 'x' })[0], /under docs\//)
})
