import { test } from 'node:test'
import assert from 'node:assert/strict'
import { releaseGateProblems } from '../lib/release-gate.mjs'

const gateText = JSON.stringify({ version: '0.3.0', ledger: 'docs/evidence/plans/x.md' })
const iteration = (n, exit = true) => `## Iteration ${n}\n\n[report](x/iteration-${n}/r.md)\n\n| ID | Disposition |\n|---|---|\n| V${n}-1 | fixed: a |\n\n${exit ? `Exit for iteration ${n}: every finding fixed or ruled. Blocking findings open: none.` : 'Exit for iteration 2: Blocking findings open: V2-3.'}\n`
const ledger = (...parts) => `# Ledger — Fabric 0.3.0\n\n## Protocol\n\nx\n\n${parts.join('\n')}`

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
test('a finding row in any spelling is read, and "fixed?" is not a disposition (confirmation pass)', () => {
  const ok = [iteration(1), iteration(2)]
  for (const row of ['|V3-41| x | open |', '|  V3-41 | x | open |', '| **V3-41** | x | open |', ' | V3-41 | x | open |', '| V3-41 | x | fixed? no — still open |']) {
    const third = `## Iteration 3\n\n[r](x/iteration-3/r.md)\n\n${row}\n\nExit for iteration 3: x. Blocking findings open: none.\n`
    assert.ok(releaseGateProblems({ version: '0.3.0', gateText, ledgerText: ledger(...ok, third) }).some((x) => x.includes('V3-41 has no disposition')), row)
  }
})

// PL-1 (0.3.1 verification, iteration 1): the gate tied the gate file to the app version but not the
// LEDGER to a version — bumping two strings would have cleared 0.3.1 (the hub) on 0.3.0's closed ledger.
test('the ledger must name the version it clears in its title: 0.3.0\'s closed ledger refuses a 0.3.1 gate', () => {
  const closed = (title) => `# ${title}\n\n## Protocol\n\nx\n\n${[iteration(1), iteration(2), iteration(3)].join('\n')}`
  const gate031 = JSON.stringify({ version: '0.3.1', ledger: 'docs/evidence/plans/x.md' })
  const for030 = closed('Release verification — Fabric 0.3.0: three independent iterations')
  assert.ok(releaseGateProblems({ version: '0.3.1', gateText: gate031, ledgerText: for030 }).some((x) => x.includes('does not name version 0.3.1')))
  // a version that merely CONTAINS the one asked for is not it (0.3.10, 10.3.1)
  for (const t of ['Fabric 0.3.10', 'Fabric 10.3.1', 'Fabric 0.3.1.2', 'no version at all'])
    assert.ok(releaseGateProblems({ version: '0.3.1', gateText: gate031, ledgerText: closed(t) }).some((x) => x.includes('does not name version 0.3.1')), t)
  assert.deepEqual(releaseGateProblems({ version: '0.3.1', gateText: gate031, ledgerText: closed('Release verification — Fabric 0.3.1, the hub (ADR-0115): three independent iterations') }), [])
})
test('the real files: 0.3.0\'s ledger clears only 0.3.0, and the hub\'s ledger does not clear 0.3.1 before its iterations close', async () => {
  const { readFileSync } = await import('node:fs')
  const root = new URL('../../', import.meta.url)
  const read = (p) => readFileSync(new URL(p, root), 'utf8')
  const old = 'docs/evidence/plans/2026-10-03-verification.md'
  const hub = 'docs/evidence/plans/2026-10-04-hub-verification.md'
  const gateFor = (version, ledger) => JSON.stringify({ version, ledger })
  assert.deepEqual(releaseGateProblems({ version: '0.3.0', gateText: gateFor('0.3.0', old), ledgerText: read(old) }), [])
  assert.ok(releaseGateProblems({ version: '0.3.1', gateText: gateFor('0.3.1', old), ledgerText: read(old) }).some((x) => x.includes('does not name version 0.3.1')))
  const hubText = read(hub)
  assert.ok(releaseGateProblems({ version: '0.3.1', gateText: gateFor('0.3.1', hub), ledgerText: hubText }).length > 0 || /^## Iteration 3\s*$/m.test(hubText) && !/_Not started\._/.test(hubText),
    'the hub ledger must not clear 0.3.1 while an iteration is open')
})
