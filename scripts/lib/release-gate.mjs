// #region release-gate — docs: docs/adr/0101-the-general-development-plan.md#consequences
// The release gate the operator set on 2026-10-03 (plan row P-02): no release before three independent
// verification iterations, the last ending with no blocking finding open. `scripts/release-mac.mjs`
// reads `docs/launch/release-gate.json` — the version it releases and the ledger that clears it — and
// refuses unless the ledger shows it. Pure over the two texts, so the gate and its test read one rule.

export const ITERATIONS = 3

/** Problems that block releasing `version` with this gate file and ledger text; empty means clear. */
export function releaseGateProblems({ version, gateText, ledgerText }) {
  let gate
  try { gate = JSON.parse(gateText ?? '') } catch { return ['docs/launch/release-gate.json is missing or not JSON'] }
  if (gate?.version !== version) return [`the release gate names version ${gate?.version ?? '(none)'}, the app is ${version}`]
  if (typeof gate.ledger !== 'string' || !gate.ledger) return ['the release gate names no verification ledger']
  if (typeof ledgerText !== 'string' || !ledgerText) return [`the verification ledger ${gate.ledger} cannot be read`]
  const problems = []
  for (let n = 1; n <= ITERATIONS; n++) {
    const m = new RegExp(String.raw`^## Iteration ${n}\s*$([\s\S]*?)(?=^## |(?![\s\S]))`, 'm').exec(ledgerText)
    if (!m) { problems.push(`the ledger has no "## Iteration ${n}" section`); continue }
    const body = m[1]
    if (/_Not started\._/.test(body)) { problems.push(`iteration ${n} has not started`); continue }
    if (!new RegExp(String.raw`^Exit for iteration ${n}:.*Blocking findings open: none\.\s*$`, 'm').test(body))
      problems.push(`iteration ${n} does not end with "Exit for iteration ${n}: … Blocking findings open: none."`)
  }
  return problems
}
// #endregion release-gate
