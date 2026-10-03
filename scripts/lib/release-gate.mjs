// #region release-gate — docs: docs/launch/release-mac.md#cut-a-release
// The release gate the operator set on 2026-10-03 (plan row P-02): no release before three independent
// verification iterations, each closed. `scripts/release-mac.mjs` reads `docs/launch/release-gate.json` —
// the version it releases and the ledger that clears it — FROM THE COMMIT, and refuses unless the ledger
// shows it. Iteration 3 found a typed sentence was enough; the verdict is now computed from the rows:
//   * exactly one `## Iteration N` heading for each N, and none still `_Not started._`;
//   * the section links its reviewer reports (`…/iteration-N/…`);
//   * every finding row `| VN-k | … |` ends with a disposition: fixed, ruled (a register id), not a
//     defect, not recoverable, or stopped — anything else is an open finding;
//   * the section's LAST non-blank line is `Exit for iteration N: … Blocking findings open: none.`, the
//     only "Blocking findings open:" in it.
// Pure over the texts, so the gate and its test read one rule.

export const ITERATIONS = 3
const DISPOSED = /^(?:fixed|ruled|not a defect|not recoverable|stopped)\b/i

/** Problems that block releasing `version`; empty means clear. */
export function releaseGateProblems({ version, gateText, ledgerText }) {
  let gate
  try { gate = JSON.parse(gateText ?? '') } catch { return ['docs/launch/release-gate.json is missing or not JSON'] }
  if (gate?.version !== version) return [`the release gate names version ${gate?.version ?? '(none)'}, the app is ${version}`]
  if (typeof gate.ledger !== 'string' || !/^docs\/[\w./-]+\.md$/.test(gate.ledger) || gate.ledger.includes('..'))
    return ['the release gate must name a ledger under docs/ (a .md path, no "..")']
  if (typeof ledgerText !== 'string' || !ledgerText) return [`the verification ledger ${gate.ledger} cannot be read`]
  const problems = []
  const lines = ledgerText.split('\n')
  for (let n = 1; n <= ITERATIONS; n++) {
    const starts = lines.flatMap((l, i) => (new RegExp(String.raw`^## Iteration ${n}\s*$`).test(l) ? [i] : []))
    if (starts.length !== 1) { problems.push(`the ledger has ${starts.length} "## Iteration ${n}" headings; exactly one is required`); continue }
    const from = starts[0] + 1
    const next = lines.findIndex((l, i) => i >= from && /^## /.test(l))
    const body = lines.slice(from, next < 0 ? lines.length : next)
    const text = body.join('\n')
    if (/_Not started\._/.test(text)) { problems.push(`iteration ${n} has not started`); continue }
    if (!new RegExp(String.raw`\]\([^)]*iteration-${n}/[^)]+\)`).test(text)) problems.push(`iteration ${n} links no reviewer report (…/iteration-${n}/…)`)
    for (const row of body) {
      const m = new RegExp(String.raw`^\| (V${n}-\d+) \|`).exec(row)
      if (!m) continue
      const cells = row.split('|').slice(1, -1).map((c) => c.trim())
      if (!DISPOSED.test(cells.at(-1) ?? '')) problems.push(`${m[1]} has no disposition (fixed, ruled, not a defect, not recoverable, stopped)`)
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
