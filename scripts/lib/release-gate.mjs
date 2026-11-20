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
    // Three iterations are three reviews of three successive candidates; one commit named three times is one
    // review counted thrice (I3 P-1). Existence and ancestry are checked against git by release-mac.
    else if (packet.iterations.some(other => other !== iteration && other?.candidateCommit === iteration.candidateCommit))
      problems.push(`iteration ${n} must name a distinct candidate commit`)
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
// #region release-ui-rounds — docs: docs/launch/release-mac.md#ui-rounds-before-a-release
// The owner, 2026-11-20 (brief `2026-11-20-release-ui-rounds-and-graph-docs-brief.md`, item 1): «перед тем, как будем
// выкатывать версии, будем прогонять их … несколько кругов UI, все изменения, связанные экраны, а поначалу вообще все
// надо будет прогнать … в соответствии с нашей документацией, брендовому пакету, элементам». From UI_ROUNDS_FROM on, a
// release names its interface review rounds in `gate.uiRounds`: at least UI_ROUNDS_MIN, each a design-tester round over
// the changed and related screens, checked against the documentation, the scenarios, the brand pack and the component
// set, closed with no blocking finding; the last one reviewed the exact verifiedCommit. Until a round over ALL screens
// is recorded in docs/brand/ui-rounds.json, one of the release's rounds must cover all screens (scope `all`).
// 0.3.27 is exempt: its three review iterations closed before the rule. WIP (2026-11-21): the ADR recording this rule is
// not written yet (docs/handoffs/2026-11-21-package-4-paused/README.md).
export const UI_ROUNDS_FROM = '0.3.28'
export const UI_ROUNDS_MIN = 2
export const UI_ROUNDS_SCHEMA = 'fabric-ui-rounds/1'
export const UI_ROUNDS_CHECKED = Object.freeze(['docs', 'scenarios', 'brand-pack', 'components'])
export const UI_ROUNDS_HISTORY = 'docs/brand/ui-rounds.json'
const versionAtLeast = (v, floor) => {
  const a = String(v).split('-')[0].split('.').map(Number), b = floor.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i]
  return true
}
/** Whether `version` owes interface review rounds. */
export const owesUiRounds = (version) => versionAtLeast(version, UI_ROUNDS_FROM)

/** Problems with the release's interface review rounds; empty when they clear it (or the version predates the rule). */
export function uiRoundProblems(gate, version, readCommitted) {
  if (!owesUiRounds(version)) return []
  const packet = gate?.uiRounds
  if (packet?.schema !== UI_ROUNDS_SCHEMA) return [`from ${UI_ROUNDS_FROM} a release names its interface review rounds: gate.uiRounds with schema ${UI_ROUNDS_SCHEMA} (docs/launch/release-mac.md#ui-rounds-before-a-release)`]
  const rounds = Array.isArray(packet.rounds) ? packet.rounds : []
  if (rounds.length < UI_ROUNDS_MIN) return [`the release names ${rounds.length} interface review round(s); at least ${UI_ROUNDS_MIN} are required`]
  if (typeof readCommitted !== 'function') return ['the release gate requires a committed-file reader for interface review artifacts']
  const read = (p) => { try { const t = readCommitted(p); return typeof t === 'string' && t.length ? t : null } catch { return null } }
  const problems = [], paths = new Set(), runs = new Set()
  let history = []
  try { history = JSON.parse(read(UI_ROUNDS_HISTORY) ?? '{"rounds":[]}').rounds ?? [] } catch { problems.push(`${UI_ROUNDS_HISTORY} is not JSON`) }
  const fullBefore = history.some((r) => r?.scope === 'all')
  rounds.forEach((round, i) => {
    const label = `interface round ${i + 1}`
    if (round?.round !== i + 1) problems.push(`${label} must be numbered ${i + 1}`)
    if (!['all', 'changed'].includes(round?.scope)) problems.push(`${label} scope must be all or changed`)
    if (!SHA.test(round?.candidateCommit ?? '')) problems.push(`${label} must name an exact candidate commit`)
    for (const [field, extension] of [['report', 'md'], ['receipt', 'json']]) {
      if (!docPath(round?.[field], extension)) { problems.push(`${label} has an invalid ${field} path under docs/`); return }
      if (paths.has(round[field])) problems.push(`${label} reuses ${round[field]}`)
      paths.add(round[field])
    }
    const reportText = read(round.report), receiptText = read(round.receipt)
    if (reportText === null) problems.push(`${label} report is absent from the release commit: ${round.report}`)
    if (receiptText === null) { problems.push(`${label} receipt is absent from the release commit: ${round.receipt}`); return }
    let r
    try { r = JSON.parse(receiptText) } catch { problems.push(`${label} receipt is not JSON`); return }
    if (r?.schema !== UI_ROUNDS_SCHEMA || r.version !== version || r.round !== round.round || r.scope !== round.scope || r.candidateCommit !== round.candidateCommit || r.report !== round.report)
      problems.push(`${label} receipt does not match its schema, version, round, scope, report and exact candidate`)
    if (reportText !== null && r?.reportSha256 !== createHash('sha256').update(reportText).digest('hex')) problems.push(`${label} report hash does not match its committed bytes`)
    if (!Array.isArray(r?.screens) || !r.screens.length || !r.screens.every(nonempty)) problems.push(`${label} receipt names no screens`)
    const missing = UI_ROUNDS_CHECKED.filter((c) => !(r?.checkedAgainst ?? []).includes(c))
    if (missing.length) problems.push(`${label} was not checked against ${missing.join(', ')}`)
    if (!nonempty(r?.reviewerRun)) problems.push(`${label} receipt has no declared reviewerRun`)
    else { if (runs.has(r.reviewerRun)) problems.push(`${label} reuses reviewerRun ${r.reviewerRun}`); runs.add(r.reviewerRun) }
    if (r?.status !== 'closed' || !Array.isArray(r.blockingFindingsOpen) || r.blockingFindingsOpen.length) problems.push(`${label} receipt is not closed with an empty blockingFindingsOpen array`)
  })
  if (rounds.at(-1)?.candidateCommit !== gate.verifiedCommit) problems.push('the last interface round must review the exact verifiedCommit')
  if (!fullBefore && !rounds.some((r) => r?.scope === 'all')) problems.push(`no round over all screens is recorded in ${UI_ROUNDS_HISTORY}: one of this release's rounds must have scope all`)
  return problems
}
// #endregion release-ui-rounds
/** Only valid committed review metadata may be added after the reviewed source. */
export function validatedReviewArtifactPaths(gate, version, readCommitted) {
  if (reviewProblems(gate, version, readCommitted).length) return new Set()
  const paths = gate.reviewReceipts.iterations.flatMap(item => item.reviews.flatMap(review => [review.report, review.receipt]))
  // The interface rounds' reports land after the commit they reviewed, as the review iterations' do.
  if (owesUiRounds(version) && !uiRoundProblems(gate, version, readCommitted).length)
    paths.push(...gate.uiRounds.rounds.flatMap((round) => [round.report, round.receipt]))
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
  const problems = [...reviewProblems(gate, version, readCommitted), ...uiRoundProblems(gate, version, readCommitted)]
  const lines = ledgerText.split('\n')
  const title = lines.find((l) => /^# /.test(l)) ?? ''
  const exact = new RegExp(String.raw`(?<![\d.])${version.replace(/\./g, '\\.')}(?![\d]|\.\d)`)
  if (!exact.test(title)) problems.push(`the ledger ${gate.ledger} does not name version ${version} in its title ("${title.replace(/^# /, '')}"); each release is cleared by its own ledger`)
  const others = (title.match(/(?<![\d.])\d+\.\d+\.\d+(?![\d]|\.\d)/g) ?? []).filter(v => v !== version)
  if (others.length) problems.push(`the ledger ${gate.ledger} title names another version (${others.join(', ')}); it must name ${version} alone`)
  const candidates = new Map((gate.reviewReceipts?.iterations ?? []).filter(it => SHA.test(it?.candidateCommit ?? '')).map(it => [it.iteration, it.candidateCommit]))
  for (let n = 1; n <= ITERATIONS; n++) {
    const starts = lines.flatMap((l, i) => (new RegExp(String.raw`^## Iteration ${n}\s*$`).test(l) ? [i] : []))
    if (starts.length !== 1) { problems.push(`the ledger has ${starts.length} "## Iteration ${n}" headings; exactly one is required`); continue }
    const from = starts[0] + 1
    const next = lines.findIndex((l, i) => i >= from && /^## /.test(l))
    const body = lines.slice(from, next < 0 ? lines.length : next)
    const text = body.join('\n')
    if (/_Not started\._/.test(text)) { problems.push(`iteration ${n} has not started`); continue }
    // The ledger section says which commit it reviewed, so receipts written for another commit cannot close it (I3 P-1).
    if (candidates.has(n) && !text.includes(candidates.get(n)))
      problems.push(`iteration ${n} of the ledger does not name its candidate commit ${candidates.get(n)} in full`)
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
