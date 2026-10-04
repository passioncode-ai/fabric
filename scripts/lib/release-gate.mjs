// #region release-gate — docs: docs/launch/release-mac.md#how-a-release-is-made
// The release gate the operator set on 2026-10-03 (plan row P-02): no release before three independent
// verification iterations, each closed. `scripts/release-mac.mjs` reads `docs/launch/release-gate.json` —
// the version it releases and the ledger that clears it — FROM THE COMMIT, and refuses unless the ledger
// shows it. Iteration 3 found a typed sentence was enough; the verdict is computed from rows and receipts:
//   * exactly one `## Iteration N` heading for each N, and none still `_Not started._`;
//   * three versioned receipt groups each cover ux/errors/docs/data/plan; their artifacts exist
//     in the release commit, report bytes match their hash, and structured findings are closed;
//   * every finding row `| VN-k | … |` ends with a disposition: fixed, ruled (a register id), not a
//     defect, not recoverable, or stopped — anything else is an open finding;
//   * the section's LAST non-blank line is `Exit for iteration N: … Blocking findings open: none.`, the
//     only "Blocking findings open:" in it;
//   * the ledger's title (its first `# ` line) names the version it clears, exactly — verification of
//     0.3.1 found that bumping two strings would have cleared the hub on 0.3.0's closed ledger (PL-1).
// The owner supplies a committed-file reader. Reviewer identity/freshness remains a manual check;
// unique declared run labels cannot prove independent contexts.

import { createHash } from 'node:crypto'

export const ITERATIONS = 3
export const REVIEW_SCHEMA = 'fabric-release-reviews/1'
export const REVIEW_LEVELS = Object.freeze(['ux', 'errors', 'docs', 'data', 'plan'])
const SHA = /^[0-9a-f]{40}$/
const disposed = new Set(['fixed', 'ruled', 'not-a-defect', 'not-recoverable', 'stopped'])
const docPath = (p, extension) => typeof p === 'string' && new RegExp(`^docs/[\\w./-]+\\.${extension}$`).test(p) && p.split('/').every(part => part && part !== '.' && part !== '..')
const nonempty = value => typeof value === 'string' && value.trim().length > 0

/** Check declared artifact bytes and closure; does not authenticate the reviewer. */
function reviewProblems(gate, version, readCommitted) {
  const packet = gate.reviewReceipts
  if (packet?.schema !== REVIEW_SCHEMA) return [`the release gate requires reviewReceipts schema ${REVIEW_SCHEMA}; legacy ledger text is not release qualification`]
  const problems = []
  if (!Array.isArray(packet.iterations) || packet.iterations.length !== ITERATIONS)
    return ['reviewReceipts must contain exactly three iterations']
  if (typeof readCommitted !== 'function') return ['the release gate requires a committed-file reader for review artifacts']
  const paths = new Set(), runs = new Set()
  const read = p => { try { const text = readCommitted(p); return typeof text === 'string' && text.length ? text : null } catch { return null } }
  for (let n = 1; n <= ITERATIONS; n++) {
    const matches = packet.iterations.filter(item => item?.iteration === n)
    if (matches.length !== 1) { problems.push(`reviewReceipts must name iteration ${n} exactly once`); continue }
    const iteration = matches[0]
    if (!SHA.test(iteration.candidateCommit ?? '')) problems.push(`iteration ${n} must name an exact candidate commit`)
    if (n === ITERATIONS && (!SHA.test(gate.verifiedCommit ?? '') || iteration.candidateCommit !== gate.verifiedCommit))
      problems.push('iteration 3 candidate must equal the exact verifiedCommit')
    if (!Array.isArray(iteration.reviews) || iteration.reviews.length !== REVIEW_LEVELS.length) {
      problems.push(`iteration ${n} must contain exactly five review levels`); continue
    }
    for (const level of REVIEW_LEVELS)
      if (iteration.reviews.filter(review => review?.level === level).length !== 1)
        problems.push(`iteration ${n} must name level ${level} exactly once`)
    for (const review of iteration.reviews) {
      if (!review || !REVIEW_LEVELS.includes(review.level)) { problems.push(`iteration ${n} has an unknown review level`); continue }
      const label = `iteration ${n} ${review.level}`
      let safe = true
      for (const [field, extension] of [['report', 'md'], ['receipt', 'json']]) {
        if (!docPath(review[field], extension)) { problems.push(`${label} has an invalid ${field} path under docs/`); safe = false; continue }
        if (paths.has(review[field])) problems.push(`${label} reuses review artifact ${review[field]}`)
        paths.add(review[field])
      }
      if (!safe) continue
      const reportText = read(review.report), receiptText = read(review.receipt)
      if (reportText === null) problems.push(`${label} report is absent from the release commit: ${review.report}`)
      if (receiptText === null) { problems.push(`${label} receipt is absent from the release commit: ${review.receipt}`); continue }
      let receipt
      try { receipt = JSON.parse(receiptText) } catch { problems.push(`${label} receipt is not JSON`); continue }
      if (receipt?.schema !== REVIEW_SCHEMA || receipt.version !== version || receipt.iteration !== n || receipt.level !== review.level || receipt.candidateCommit !== iteration.candidateCommit || receipt.report !== review.report)
        problems.push(`${label} receipt does not match its schema, version, iteration, level, report and exact candidate`)
      if (reportText !== null && receipt?.reportSha256 !== createHash('sha256').update(reportText).digest('hex'))
        problems.push(`${label} report hash does not match its committed bytes`)
      if (!nonempty(receipt?.reviewerRun)) problems.push(`${label} receipt has no declared reviewerRun`)
      else {
        if (runs.has(receipt.reviewerRun)) problems.push(`${label} reuses declared reviewerRun ${receipt.reviewerRun}`)
        runs.add(receipt.reviewerRun)
      }
      if (receipt?.status !== 'closed' || !Array.isArray(receipt.blockingFindingsOpen) || receipt.blockingFindingsOpen.length)
        problems.push(`${label} receipt is not closed with an empty blockingFindingsOpen array`)
      if (!Array.isArray(receipt?.findings)) { problems.push(`${label} receipt has no structured findings array`); continue }
      const ids = new Set()
      for (const finding of receipt.findings) {
        if (!nonempty(finding?.id) || ids.has(finding.id) || !disposed.has(finding.status) || !Array.isArray(finding.evidence) || !finding.evidence.length || !finding.evidence.every(nonempty))
          problems.push(`${label} has an open or unsupported finding disposition`)
        ids.add(finding?.id)
      }
    }
  }
  return problems
}
/** Only valid committed review metadata may be added after the reviewed source. */
export function validatedReviewArtifactPaths(gate, version, readCommitted) {
  if (reviewProblems(gate, version, readCommitted).length) return new Set()
  const paths = gate.reviewReceipts.iterations.flatMap(item => item.reviews.flatMap(review => [review.report, review.receipt]))
  return new Set(paths.filter(p => /^docs\/(?:reports|evidence\/reviews)\//.test(p)))
}
const DISPOSED = /^(?:fixed|ruled|not a defect|not recoverable|stopped)(?=$|[\s:;,.(`—–-])/i
const plain = (cell) => cell.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*`_]/g, '').trim()
/** Cells of a table row, split on unescaped pipes. */
const cellsOf = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim())

/** Problems that block releasing `version`; empty means clear. */
export function releaseGateProblems({ version, gateText, ledgerText, readCommitted }) {
  let gate
  try { gate = JSON.parse(gateText ?? '') } catch { return ['docs/launch/release-gate.json is missing or not JSON'] }
  if (gate?.version !== version) return [`the release gate names version ${gate?.version ?? '(none)'}, the app is ${version}`]
  if (typeof gate.ledger !== 'string' || !/^docs\/[\w./-]+\.md$/.test(gate.ledger) || gate.ledger.includes('..'))
    return ['the release gate must name a ledger under docs/ (a .md path, no "..")']
  if (typeof ledgerText !== 'string' || !ledgerText) return [`the verification ledger ${gate.ledger} cannot be read`]
  const problems = reviewProblems(gate, version, readCommitted)
  const lines = ledgerText.split('\n')
  const title = lines.find((l) => /^# /.test(l)) ?? ''
  const exact = new RegExp(String.raw`(?<![\d.])${version.replace(/\./g, '\\.')}(?![\d]|\.\d)`)
  if (!exact.test(title)) problems.push(`the ledger ${gate.ledger} does not name version ${version} in its title ("${title.replace(/^# /, '')}"); each release is cleared by its own ledger`)
  for (let n = 1; n <= ITERATIONS; n++) {
    const starts = lines.flatMap((l, i) => (new RegExp(String.raw`^## Iteration ${n}\s*$`).test(l) ? [i] : []))
    if (starts.length !== 1) { problems.push(`the ledger has ${starts.length} "## Iteration ${n}" headings; exactly one is required`); continue }
    const from = starts[0] + 1
    const next = lines.findIndex((l, i) => i >= from && /^## /.test(l))
    const body = lines.slice(from, next < 0 ? lines.length : next)
    const text = body.join('\n')
    if (/_Not started\._/.test(text)) { problems.push(`iteration ${n} has not started`); continue }
    for (const row of body) {
      if (!row.trim().startsWith('|')) continue
      const cells = cellsOf(row)
      const id = plain(cells[0] ?? '')
      if (!new RegExp(String.raw`^V${n}-\d+$`).test(id)) continue
      if (!DISPOSED.test(plain(cells.at(-1) ?? ''))) problems.push(`${id} has no disposition (fixed, ruled, not a defect, not recoverable, stopped)`)
    }
    const meaningful = body.filter((l) => l.trim() !== '')
    const last = meaningful.at(-1) ?? ''
    const said = (text.match(/Blocking findings open:/g) ?? []).length
    if (said !== 1 || !new RegExp(String.raw`^Exit for iteration ${n}:.*Blocking findings open: none\.\s*$`).test(last))
      problems.push(`iteration ${n} must end with its one line "Exit for iteration ${n}: … Blocking findings open: none."`)
  }
  return problems
}
// #endregion release-gate
