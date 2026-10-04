import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { releaseGateProblems } from '../lib/release-gate.mjs'
import { verifiedCandidateProblem } from '../lib/release-mac.mjs'

// #region release-review-receipts-test — docs: docs/handoffs/release-review-receipts-20261004/README.md#checks
const schema = 'fabric-release-reviews/1'
const levels = ['ux', 'errors', 'docs', 'data', 'plan']
const candidate = 'a'.repeat(40)
const iteration = n => `## Iteration ${n}\n\n| ID | Disposition |\n|---|---|\n| V${n}-1 | fixed: test receipt |\n\nExit for iteration ${n}: closed. Blocking findings open: none.\n`
const ledger = (...parts) => `# Ledger — Fabric 0.3.1\n\n${parts.join('\n')}`
function fixture() {
  const artifacts = new Map()
  const iterations = [1, 2, 3].map(n => ({ iteration: n, candidateCommit: n === 3 ? candidate : String(n).repeat(40), reviews: levels.map(level => {
    // Deliberately no iteration-N directory convention: metadata owns the iteration.
    const report = `docs/reports/review-${n}-${level}/README.md`
    const receipt = `docs/reports/review-${n}-${level}/receipt.json`
    const reportText = `# ${level} review\n\nReport for candidate ${n === 3 ? candidate : String(n).repeat(40)}.\n`
    artifacts.set(report, reportText)
    artifacts.set(receipt, JSON.stringify({ schema, version: '0.3.1', iteration: n, level,
      candidateCommit: n === 3 ? candidate : String(n).repeat(40), report,
      reportSha256: createHash('sha256').update(reportText).digest('hex'), reviewerRun: `review-${n}-${level}`,
      status: 'closed', blockingFindingsOpen: [], findings: [{ id: `finding-${n}-${level}`, status: 'fixed', evidence: ['test: regression verified'] }] }))
    return { level, report, receipt }
  }) }))
  return { artifacts, gate: { version: '0.3.1', ledger: 'docs/ledger.md', verifiedCommit: candidate, reviewReceipts: { schema, iterations } }, ledgerText: ledger(...[1, 2, 3].map(iteration)) }
}
const check = f => releaseGateProblems({ version: '0.3.1', gateText: JSON.stringify(f.gate), ledgerText: f.ledgerText, readCommitted: p => f.artifacts.get(p) })
const first = f => f.gate.reviewReceipts.iterations[0].reviews[0]
function changeReceipt(f, mutate) {
  const p = first(f).receipt, receipt = JSON.parse(f.artifacts.get(p))
  mutate(receipt); f.artifacts.set(p, JSON.stringify(receipt))
}
function refuses(mutate, pattern) {
  const f = fixture(); mutate(f)
  const problems = check(f)
  assert.ok(problems.some(p => pattern.test(p)), problems.join('\n'))
}

test('PL10: three fabricated closures with nonexistent single reports refuse', () => {
  const fake = '# Fabric 0.3.1\n' + [1, 2, 3].map(n => `\n## Iteration ${n}\n[only reviewer](review/iteration-${n}/nonexistent.md)\n\nExit for iteration ${n}: closed. Blocking findings open: none.\n`).join('')
  assert.ok(releaseGateProblems({ version: '0.3.1', gateText: JSON.stringify({ version: '0.3.1', ledger: 'docs/ledger.md' }), ledgerText: fake }).length > 0)
})
test('exact candidate receipts for all five levels across three closed iterations clear', () => {
  assert.deepEqual(check(fixture()), [])
})
test('validated declared reports may follow the verified source; undeclared, altered and executable paths refuse', () => {
  const f = fixture(), report = first(f).report
  const git = args => args[0] === 'merge-base' ? '' : args[0] === 'diff' ? report : assert.fail('unexpected git call')
  const verify = () => verifiedCandidateProblem({ version: '0.3.1', gateText: JSON.stringify(f.gate), readCommitted: p => f.artifacts.get(p) }, git)
  assert.equal(verify(), null)
  f.artifacts.set(report, 'changed bytes')
  assert.match(verify(), /unverified/)
  const valid = fixture()
  for (const changed of ['docs/reports/unlisted/README.md', 'docs/reports/review-1-ux/probe.mjs', 'apps/desktop/src/main/agentSurface.ts'])
    assert.match(verifiedCandidateProblem({ version: '0.3.1', gateText: JSON.stringify(valid.gate), readCommitted: p => valid.artifacts.get(p) }, args => args[0] === 'diff' ? changed : ''), /unverified/)
})
test('artifact reader must be supplied by the committed-file owner', () => {
  const f = fixture()
  assert.match(releaseGateProblems({ version: '0.3.1', gateText: JSON.stringify(f.gate), ledgerText: f.ledgerText }).join('\n'), /committed-file reader/)
})
test('missing report or receipt, wrong bytes and unreadable JSON refuse', () => {
  refuses(f => f.artifacts.delete(first(f).report), /report is absent/)
  refuses(f => f.artifacts.delete(first(f).receipt), /receipt is absent/)
  refuses(f => f.artifacts.set(first(f).report, 'changed after review'), /report hash/)
  refuses(f => f.artifacts.set(first(f).receipt, '{broken'), /not JSON/)
})
test('schema, count, missing or duplicate levels and reused artifacts refuse', () => {
  refuses(f => f.gate.reviewReceipts.schema = 'future/2', /requires reviewReceipts schema/)
  refuses(f => f.gate.reviewReceipts.iterations.pop(), /exactly three iterations/)
  refuses(f => f.gate.reviewReceipts.iterations[1].iteration = 1, /iteration 1 exactly once/)
  refuses(f => f.gate.reviewReceipts.iterations[0].reviews.pop(), /exactly five review levels/)
  refuses(f => f.gate.reviewReceipts.iterations[0].reviews[1].level = 'ux', /level ux exactly once/)
  refuses(f => f.gate.reviewReceipts.iterations[0].reviews[1].report = first(f).report, /reuses review artifact/)
  refuses(f => f.gate.reviewReceipts.iterations[0].reviews[1].receipt = first(f).receipt, /reuses review artifact/)
})
test('receipt binds version, level, iteration, report and exact candidate; final candidate matches verifiedCommit', () => {
  for (const [key, value] of [['schema', 'future/2'], ['version', '0.3.0'], ['level', 'plan'], ['iteration', 2], ['report', 'docs/wrong.md'], ['candidateCommit', 'b'.repeat(40)]])
    refuses(f => changeReceipt(f, r => r[key] = value), /receipt does not match/)
  refuses(f => f.gate.reviewReceipts.iterations[0].candidateCommit = 'short', /exact candidate commit/)
  refuses(f => f.gate.verifiedCommit = 'b'.repeat(40), /iteration 3 candidate must equal/)
  refuses(f => delete f.gate.verifiedCommit, /iteration 3 candidate must equal/)
})
test('same declared reviewerRun across levels or iterations refuses, without proving independence', () => {
  refuses(f => changeReceipt(f, r => r.reviewerRun = 'review-2-plan'), /reuses declared reviewerRun/)
  refuses(f => changeReceipt(f, r => r.reviewerRun = ''), /no declared reviewerRun/)
})
test('structured closure refuses open/missing findings, nonclosed status and nonempty blockers', () => {
  refuses(f => changeReceipt(f, r => r.status = 'open'), /not closed/)
  refuses(f => changeReceipt(f, r => r.blockingFindingsOpen = ['V1-1']), /not closed/)
  refuses(f => changeReceipt(f, r => delete r.blockingFindingsOpen), /not closed/)
  refuses(f => changeReceipt(f, r => delete r.findings), /structured findings/)
  refuses(f => changeReceipt(f, r => r.findings[0].status = 'fixed?'), /unsupported finding/)
  refuses(f => changeReceipt(f, r => r.findings[0].evidence = []), /unsupported finding/)
  refuses(f => changeReceipt(f, r => r.findings.push(r.findings[0])), /unsupported finding/)
})
test('invalid paths are refused before the owner is asked to read them', () => {
  for (const p of ['../private.md', 'docs/../private.md', 'docs/./x.md', 'docs//x.md', '/docs/x.md', 'https://example.test/x.md']) {
    const f = fixture(); first(f).report = p
    const readPaths = []
    const problems = releaseGateProblems({ version: '0.3.1', gateText: JSON.stringify(f.gate), ledgerText: f.ledgerText, readCommitted: q => { readPaths.push(q); return f.artifacts.get(q) } })
    assert.ok(problems.some(q => /invalid report path/.test(q)), p)
    assert.ok(!readPaths.includes(p), p)
  }
})
test('ledger closure is computed as well: open rows, duplicate headings, hidden exits and version near-misses refuse', () => {
  refuses(f => f.ledgerText = f.ledgerText.replace('| V3-1 | fixed: test receipt |', '| **V3-1** | fixed? still open |'), /V3-1 has no disposition/)
  refuses(f => f.ledgerText += '\n## Iteration 3\n_Not started._\n', /2 "## Iteration 3" headings/)
  refuses(f => f.ledgerText = f.ledgerText.replace('Exit for iteration 3:', 'Blocking findings open: none.\nExit for iteration 3:'), /iteration 3 must end/)
  refuses(f => f.ledgerText = ledger(iteration(1), iteration(2), '## Iteration 3\n_Not started._\n'), /iteration 3 has not started/)
  for (const title of ['0.3.0', '0.3.10', '10.3.1', '0.3.1.2'])
    refuses(f => f.ledgerText = f.ledgerText.replace('Fabric 0.3.1', `Fabric ${title}`), /does not name version 0.3.1/)
})
test('the existing hub ledger unconditionally refuses, whether iteration 3 says Started or Not started', () => {
  const root = new URL('../../', import.meta.url)
  const hubText = readFileSync(new URL('docs/evidence/plans/2026-10-04-hub-verification.md', root), 'utf8')
  for (const text of [hubText, hubText.replace(/_Not started\._/g, 'Started; findings remain open.')]) {
    const f = fixture(); f.ledgerText = text
    const problems = check(f)
    assert.ok(problems.length > 0, 'existing unfinished hub ledger cleared')
    assert.ok(problems.some(p => /iteration 3 (?:has not started|must end)/.test(p)), problems.join('\n'))
  }
})
test('historical 0.3.0 ledger remains readable but its legacy text does not qualify a release', () => {
  const root = new URL('../../', import.meta.url)
  const gt = readFileSync(new URL('docs/launch/release-gate.json', root), 'utf8')
  const gate = JSON.parse(gt)
  const old = readFileSync(new URL('docs/evidence/plans/2026-10-03-verification.md', root), 'utf8')
  assert.equal(gate.version, JSON.parse(readFileSync(new URL('apps/desktop/package.json', root), 'utf8')).version)
  const problems = releaseGateProblems({ version: '0.3.0', gateText: JSON.stringify({ version: '0.3.0', ledger: 'docs/evidence/plans/2026-10-03-verification.md' }), ledgerText: old })
  assert.equal(problems.length, 1, problems.join('\n'))
  assert.match(problems[0], /legacy ledger text is not release qualification/)
})
test('real Git-object reader refuses disk-only artifacts and preserves exact committed report bytes', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-review-gate-'))
  const git = args => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    git(['init', '-q']); git(['config', 'user.email', 'fixture@example.test']); git(['config', 'user.name', 'Fixture'])
    const f = fixture()
    for (const [p, text] of f.artifacts) { mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); writeFileSync(path.join(dir, p), text) }
    writeFileSync(path.join(dir, 'seed'), 'fixture')
    git(['add', 'seed']); git(['commit', '-qm', 'Seed'])
    const atHead = p => { try { return git(['show', `HEAD:${p}`]) } catch { return null } }
    const input = { version: '0.3.1', gateText: JSON.stringify(f.gate), ledgerText: f.ledgerText, readCommitted: atHead }
    assert.match(releaseGateProblems(input).join('\n'), /absent from the release commit/)
    git(['add', 'docs']); git(['commit', '-qm', 'Commit review artifacts'])
    assert.deepEqual(releaseGateProblems(input), [])
    writeFileSync(path.join(dir, first(f).report), 'uncommitted replacement')
    assert.deepEqual(releaseGateProblems(input), [])
    git(['add', first(f).report]); git(['commit', '-qm', 'Change reviewed bytes'])
    assert.match(releaseGateProblems(input).join('\n'), /report hash/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
// #endregion release-review-receipts-test
