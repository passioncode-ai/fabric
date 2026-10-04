// #region i3-plan-gate-probe — docs: docs/reports/2026-10-04-hub-i3-plan/README.md#findings
import { releaseGateProblems } from '../../../../scripts/lib/release-gate.mjs'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const source = new URL('../../../../scripts/lib/release-gate.mjs', import.meta.url)
const gate = { version: '0.3.1', ledger: 'docs/ledger.md' }
const ledger = '# Fabric 0.3.1\n' + [1, 2, 3].map(n => `\n## Iteration ${n}\n[only reviewer](review/iteration-${n}/single.md)\n\nExit for iteration ${n}: closed. Blocking findings open: none.\n`).join('')
const problems = releaseGateProblems({ version: '0.3.1', gateText: JSON.stringify(gate), ledgerText: ledger })
console.log(JSON.stringify({ source_baseline: '3b2878fc9283db5fc9a81697ba8538a01630b8d9', source_path: 'scripts/lib/release-gate.mjs', source_sha256: createHash('sha256').update(readFileSync(source)).digest('hex'), gate, ledger, problems, scope: 'Pure text check only; no tag, workflow, publication or live release action.' }, null, 2))
// #endregion i3-plan-gate-probe
